// The game's water substep on a heightfield, task by task in the game's order (FIDELITY.md, "Water").
// Depth and flow follow the repository's validated port (src/core/sim/water.ts); this copy adds what
// that port leaves out: the game's contamination transport and diffusion, evaporation of every
// column, the dam rule's floor condition, the source bookkeeping and the evaporation modifiers the
// soil pass hands over one tick late. Arithmetic is 64-bit; the game's is 32-bit.
import type { WaterModel } from '../../../src/core/sim/water';

export const DT = 0.3; // WaterSimulationTaskStarter: TickTimeSpec 0.6 s over SubstepCount 2
const K = 2.25 * DT; // WaterSimulatorSpec.WaterFlowFactor × dt
const SPILL = 0.1; // WaterSpillThreshold
const KEEP = 0.999; // OutflowsUpdateTask: stored momentum kept per substep
const DAM_KEEP = 0.995; // … and again under a height limit
const BAL = 0.8; // OutflowBalancingScaler
const FAST_DEPTH = 0.02, FAST = 0.001, NORMAL = 0.0001; // evaporation per second
const DIFFUSION_FLOW = 0.125, DIFFUSION_HEIGHT = 0.1, DIFFUSION_RATE = 0.45;
const OPP = [2, 3, 0, 1];

/** What the water simulation reads of one source in a tick: WaterSourceRegistry's snapshot. */
export interface SourceSnapshot {
    cells: number[];
    strength: number;
    contamination: number;
}

/** Switches back to what the study's first model did, one rule group at a time (fidelity.ts). */
export interface WaterLegacy {
    /** Mix contamination by gross flows into the evaporated depth, without diffusion. */
    contamination?: boolean;
    /** Evaporate only wet columns, find dams without the floor condition, apply no spill threshold at the
     *  map edge, and leave the source tiles' previous depth alone. */
    bookkeeping?: boolean;
}

export class GameWater {
    readonly W: number;
    readonly H: number;
    readonly N: number;
    readonly F: Float64Array;
    /** Partial obstacle height at the tile's own floor, −1 where there is none. */
    readonly dam: Float64Array | null;
    D: Float64Array;
    Dold: Float64Array;
    C: Float64Array;
    /** Stored outflow momentum (ColumnOutflows), 4 per tile, index 4·i + k: 0 −y, 1 −x, 2 +y, 3 +x. */
    readonly out: Float64Array;
    /** WaterEvaporationMap: the water reads `evapBuffered`; the soil pass writes `evapCurrent`. */
    evapBuffered: Float64Array;
    evapCurrent: Float64Array;
    sources: SourceSnapshot[] = [];
    ticks = 0;
    legacy: WaterLegacy = {};
    private readonly f: Float64Array;
    private readonly buf: Float64Array;
    private readonly count: Uint8Array;
    private readonly flags: Uint8Array;
    private readonly wall: Uint8Array;
    private readonly mark: Int32Array;
    private stamp = 0;
    private wet: Int32Array;
    private wetCount = 0;
    private prevWet: Int32Array;
    private prevWetCount = 0;
    private readonly active: Int32Array;
    private activeCount = 0;
    private readonly sourceCells: Int32Array;
    /** Neighbour of tile c in direction k at 4·c + k, −1 outside the map. */
    private readonly nb: Int32Array;

    constructor(model: WaterModel, depth: ArrayLike<number>, contamination: ArrayLike<number>, evaporation: ArrayLike<number>, outflows?: ArrayLike<number>) {
        const { W, H } = model, N = W * H;
        this.W = W; this.H = H; this.N = N;
        this.F = model.floor;
        this.dam = model.dam;
        this.D = Float64Array.from(depth);
        this.Dold = Float64Array.from(depth);
        this.C = Float64Array.from(contamination);
        this.out = new Float64Array(4 * N);
        if (outflows) this.out.set(outflows);
        this.evapBuffered = Float64Array.from(evaporation);
        this.evapCurrent = Float64Array.from(evaporation);
        this.f = new Float64Array(4 * N);
        this.buf = new Float64Array(N);
        this.count = new Uint8Array(N);
        this.flags = new Uint8Array(N);
        this.mark = new Int32Array(N);
        this.wet = new Int32Array(N);
        this.prevWet = new Int32Array(N);
        this.active = new Int32Array(N);
        this.nb = new Int32Array(4 * N);
        for (let c = 0; c < N; c++) {
            const x = c % W, y = (c - x) / W;
            this.nb[4 * c] = y > 0 ? c - W : -1;
            this.nb[4 * c + 1] = x > 0 ? c - 1 : -1;
            this.nb[4 * c + 2] = y < H - 1 ? c + W : -1;
            this.nb[4 * c + 3] = x < W - 1 ? c + 1 : -1;
        }
        // WaterMapBoundary: the padding beside every source tile is solid, whether the source runs or not.
        this.wall = new Uint8Array(N);
        const cells: number[] = [], seen = new Uint8Array(N);
        for (const e of model.emitters) for (const i of e.cells) {
            const x = i % W, y = (i - x) / W;
            if (y === 0) this.wall[i] |= 1;
            if (x === 0) this.wall[i] |= 2;
            if (y === H - 1) this.wall[i] |= 4;
            if (x === W - 1) this.wall[i] |= 8;
            if (!seen[i]) { seen[i] = 1; cells.push(i); }
        }
        this.sourceCells = Int32Array.from(cells);
        for (let i = 0; i < N; i++) if (this.D[i] > 0) this.wet[this.wetCount++] = i;
    }

    /** WaterEvaporationMap.Tick: last tick's soil pass becomes this tick's evaporation. */
    swapEvaporation(): void {
        const t = this.evapBuffered;
        this.evapBuffered = this.evapCurrent;
        this.evapCurrent = t;
    }

    /** The height limit that FlowLimitCalculator.GetHeightLimit finds for flow from c into n: a
     *  partial obstacle sits at n's floor, and the search runs from max(floors) below ceil(surface). */
    private limit(c: number, n: number, Hc: number): number {
        if (!this.dam || n < 0) return -1;
        const lim = this.dam[n];
        return lim >= 0 && (this.legacy.bookkeeping || this.F[c] <= this.F[n]) && this.F[n] < Math.ceil(Hc) ? lim : -1;
    }

    private buildActive(): void {
        const s = ++this.stamp, mark = this.mark, act = this.active;
        let n = 0;
        const add = (i: number) => { if (mark[i] !== s) { mark[i] = s; act[n++] = i; } };
        for (let k = 0; k < this.wetCount; k++) {
            const i = this.wet[k];
            add(i);
            for (let d = 0; d < 4; d++) { const j = this.nb[4 * i + d]; if (j >= 0) add(j); }
        }
        for (let k = 0; k < this.sourceCells.length; k++) add(this.sourceCells[k]);
        this.activeCount = n;
    }

    private substep(): void {
        const { F, D, C, out, f, wall, dam, nb } = this;
        // ClearBuffersTask; a tile that was wet last substep and is dry now holds no momentum after
        // this substep's WaterParametersUpdateTask, and nothing reads it before then.
        for (let k = 0; k < this.prevWetCount; k++) {
            const i = this.prevWet[k], b = 4 * i;
            f[b] = f[b + 1] = f[b + 2] = f[b + 3] = 0;
            if (!(D[i] > 0)) out[b] = out[b + 1] = out[b + 2] = out[b + 3] = 0;
        }
        this.buildActive();

        // OutflowsUpdateTask, for every wet tile, from the start-of-substep state.
        for (let w = 0; w < this.wetCount; w++) {
            const c = this.wet[w], Fc = F[c], Dc = D[c], Hc = Fc + Dc, b = 4 * c;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k], inside = n >= 0;
                const Fn = inside ? F[n] : 0, Dn = inside ? D[n] : 0;
                if (wall[c] & (1 << k) || Fn >= Hc) { f[b + k] = 0; continue; }
                let e = Hc - (Fn + Dn);
                let prev = KEEP * out[b + k];
                let fk: number;
                const lim = inside ? this.limit(c, n, Hc) : -1;
                if (lim >= 0) {
                    prev *= DAM_KEEP;
                    const hd = Hc - Fn;
                    if (hd < lim) {
                        const a = clamp01(clamp01((lim - hd) / 0.1) * clamp(1 - 2.25 * (Hc - (Fc + this.Dold[c])), 0.5, 2));
                        fk = prev - 0.02 * a;
                    } else {
                        if (hd - lim < 0.1 && e > 0) e *= (hd - lim) / 0.1;
                        fk = prev + K * e;
                    }
                } else {
                    // The padding outside the map is an open column: floor 0, never wet.
                    if (Dn === 0 && Fn === Fc && (inside || !this.legacy.bookkeeping)) e -= SPILL;
                    fk = prev + K * e;
                }
                f[b + k] = fk > 0 ? fk : 0;
            }
            const s = f[b] + f[b + 1] + f[b + 2] + f[b + 3];
            if (s * DT > Dc) {
                const r = Dc / (s * DT);
                f[b] *= r; f[b + 1] *= r; f[b + 2] *= r; f[b + 3] *= r;
            }
        }

        // WaterParametersUpdateTask: depth, stored momentum and evaporation of every column (a dry
        // column that receives water still loses the fast rate).
        const act = this.active, evap = this.evapBuffered, legacy = this.legacy;
        const mixed = legacy.contamination ? this.buf : null;
        for (let a = 0; a < this.activeCount; a++) {
            const c = act[a], b = 4 * c;
            let net = 0;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k], inflow = n >= 0 ? f[4 * n + OPP[k]] : 0, outflow = f[b + k];
                net += inflow - outflow;
                const m = outflow - inflow * BAL;
                out[b + k] = outflow > 0 && m > 0 ? m : 0;
            }
            const Dc = D[c];
            const rate = legacy.bookkeeping && !(Dc > 0) ? 0 : (Dc < FAST_DEPTH ? FAST : NORMAL) * evap[c];
            this.Dold[c] = Dc;
            const d1 = Dc + (net - rate) * DT;
            D[c] = d1 > 0 ? d1 : 0;
            if (mixed) {
                // The first model: the depth left after outflow at its own concentration, plus inflows.
                let outsum = 0, cin = 0;
                for (let k = 0; k < 4; k++) {
                    outsum += f[b + k];
                    const n = nb[4 * c + k];
                    if (n >= 0) cin += f[4 * n + OPP[k]] * C[n];
                }
                const rem = Dc - outsum * DT, mass = C[c] * (rem > 0 ? rem : 0) + cin * DT;
                mixed[c] = D[c] > 1e-9 ? clamp01(mass / Math.max(D[c], 1e-9)) : 0;
            }
        }
        if (mixed) {
            for (let a = 0; a < this.activeCount; a++) C[act[a]] = mixed[act[a]];
            this.sourcesStep();
            return this.finishSubstep();
        }

        // SimulateContaminationTask: mix by the net stored flow from each neighbour, after the depth
        // update; mark neighbours that exchange slowly at nearly equal surfaces for diffusion.
        const buf = this.buf, count = this.count, flags = this.flags;
        for (let a = 0; a < this.activeCount; a++) {
            const c = act[a];
            count[c] = 0; flags[c] = 0; buf[c] = 0;
            const Dc = D[c];
            if (!(Dc > 0)) continue;
            let received = 0, change = 0;
            for (let k = 0; k < 4; k++) {
                const n = nb[4 * c + k];
                const net = (n >= 0 ? out[4 * n + OPP[k]] : 0) - out[4 * c + k];
                if (net === 0) continue;
                const amount = net * DT;
                if (amount > 0) { received += amount; change += amount * C[n]; }
                if (n < 0 || net >= DIFFUSION_FLOW || net <= -DIFFUSION_FLOW) continue;
                if (dam && ((Dc <= 1 && dam[c] >= 0) || (D[n] <= 1 && dam[n] >= 0))) continue;
                if (!(D[n] > 0)) continue;
                const hn = D[n] + F[n], hc = Dc + F[c];
                if ((hn > hc ? hn - hc : hc - hn) > DIFFUSION_HEIGHT) continue;
                flags[c] |= 1 << k;
                count[c]++;
            }
            if (received > 0) {
                const v = (C[c] * (Dc - received) + change) / Dc;
                buf[c] = v < 0 ? 0 : v > 1 ? 1 : v;
            } else buf[c] = C[c];
        }
        // UpdateContaminationTask.
        for (let a = 0; a < this.activeCount; a++) {
            const c = act[a], Dc = D[c];
            if (!(Dc > 0)) { C[c] = 0; continue; }
            let v = buf[c];
            if (count[c]) {
                let sum = 0;
                const share = 1 / count[c];
                for (let k = 0; k < 4; k++) {
                    if (!(flags[c] & (1 << k))) continue;
                    const n = nb[4 * c + k], delta = buf[n] - buf[c];
                    const amount = delta > 0 ? Math.min(delta, buf[n] / count[n]) : Math.max(delta, -share * buf[c]);
                    sum += D[n] / (Dc + D[n]) * amount * DIFFUSION_RATE;
                }
                v += sum * DT;
            }
            C[c] = v > 1 ? 1 : v;
        }

        this.sourcesStep();
        this.finishSubstep();
    }

    /** UpdateWaterSourcesTask: every source, even one at zero strength, rewrites its tiles. */
    private sourcesStep(): void {
        const D = this.D, C = this.C, bookkeeping = this.legacy.bookkeeping;
        for (const src of this.sources) {
            const add = DT * src.strength / src.cells.length;
            if (bookkeeping && !(add > 0)) continue;
            for (const i of src.cells) {
                const d0 = D[i];
                if (!bookkeeping) this.Dold[i] = d0;
                const d1 = d0 + add > 0 ? d0 + add : 0;
                D[i] = d1;
                if (d1 !== 0) {
                    const v = (C[i] * d0 + src.contamination * (bookkeeping ? add : d1 - d0)) / d1;
                    C[i] = v < 0 ? 0 : v > 1 ? 1 : v;
                } else C[i] = 0;
            }
        }
    }

    private finishSubstep(): void {
        const D = this.D, act = this.active;
        const t = this.prevWet;
        this.prevWet = this.wet;
        this.prevWetCount = this.wetCount;
        this.wet = t;
        let n = 0;
        for (let a = 0; a < this.activeCount; a++) if (D[act[a]] > 0) this.wet[n++] = act[a];
        this.wetCount = n;
    }

    /** One tick: two substeps (WaterSimulationTaskStarter.Simulate). */
    tick(): void {
        this.substep();
        this.substep();
        this.ticks++;
    }

    volume(): number {
        let s = 0;
        for (let i = 0; i < this.N; i++) s += this.D[i];
        return s;
    }
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
