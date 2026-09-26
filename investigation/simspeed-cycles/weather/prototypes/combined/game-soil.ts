// Soil moisture, cluster saturation, evaporation modifiers and soil contamination, one game tick at a
// time (FIDELITY.md, "Soil"). Each tick reads the water as the previous tick left it and its own
// values from the previous tick, as the game's parallel tasks do. Values are 32-bit floats, as the
// game stores them. A tile is recomputed only when one of its inputs changed; `full` recomputes every
// tile, and the tests check that both give the same bytes.
const f = Math.fround;
// SoilMoistureSimulatorSpec, scaled per tick by SoilMoistureSimulationTaskStarter.Load.
const M_DECAY = f(f(1.25) * f(0.6)), M_SPREAD = f(f(6.66) * f(0.6));
const M_MIN_WATER_C = f(0.01), M_SCALER = f(1 / f(0.53)), M_MIN = f(0.01), M_DIAG = f(1.414), M_VERTICAL = 6, M_MAX = 16;
const MAX_SAT = 8;
/** The order the game reads the four water neighbours: −y, −x, +y, +x (indices into the table below). */
const WATER_ORDER = [0, 1, 3, 2];
// SoilContaminationSimulatorSpec, scaled by SoilContaminationSimulationTaskStarter.Load.
const C_MAX = f(1 - f(0.001)), C_REG = f(1 / 7), C_DIAG = f(f(Math.SQRT2) / 7);
const C_DECAY = f(f(0.033) * f(0.6)), C_SPREAD = f(f(0.066) * f(0.6)), C_MIN_WATER = f(0.5);
const C_SCALER = f(1 / f(1 - f(0.5))), C_VERTICAL = f(f(5) / 7), C_THRESHOLD = f(0.001);
const C_UP = f(f(0.035) * f(0.6)), C_DOWN = f(f(0.01) * f(0.6));
/** SoilMoistureSimulationTaskStarter.InitializeEvaporationModifiers, in float. */
export const EVAPORATION = Array.from({ length: 10 }, (_, i) => {
    const n = 10 - i;
    return f(f(f(f(f(0.0595) * n) * n) + f(f(0.101) * n)) + f(0.72));
});

export interface SoilInput {
    W: number;
    H: number;
    /** Terrain height: the top of the solid ground, where plants stand. */
    z: Uint8Array;
    /** Floor of the water column (above a Blockage it is one higher than the ground). */
    F: Float64Array;
    /** Thorns: no moisture, no contamination (SoilBarrierSpec). */
    fullBarrier: Uint8Array;
    aboveBarrier: Uint8Array;
    contaminationBarrier: Uint8Array;
}

export class GameSoil {
    readonly N: number;
    /** SoilMoistureSimulator.MoistureLevels after the last pass. */
    readonly M: Float32Array;
    /** SoilContaminationSimulator candidates and levels after the last pass. */
    readonly cand: Float32Array;
    readonly level: Float32Array;
    /** Cluster saturation of the water the last pass read (0 on dry tiles). */
    readonly sat: Uint8Array;
    private readonly wn: Uint8Array;
    private readonly countMark: Uint8Array;
    private readonly saturationMark: Uint8Array;
    private readonly countDirty: Int32Array;
    private readonly saturationDirty: Int32Array;
    private readonly nb: Int32Array;
    // What the last pass read of each water tile, to find what changed: its own state, what it gives
    // its neighbours' moisture and soil contamination, and its rounded-up depth.
    private readonly pWet: Uint8Array;
    private readonly pSurf: Int32Array;
    private readonly pDepth: Int32Array;
    private readonly pC: Float32Array;
    private readonly pSat: Uint8Array;
    private readonly pGive: Int32Array;
    private readonly pBad: Float32Array;
    private wetList: Int32Array;
    private wetCount = 0;
    private prevWetList: Int32Array;
    private prevWetCount = 0;
    private readonly mark: Int32Array;
    private readonly markC: Int32Array;
    private stamp = 0;
    private readonly dirty: Int32Array;
    private readonly dirtyC: Int32Array;
    private mChanged: number[] = [];
    private cChanged: number[] = [];
    private converging: number[] = [];
    private first = true;
    passes = 0;

    constructor(readonly g: SoilInput, moisture: ArrayLike<number>, contamination: ArrayLike<number>, candidates: ArrayLike<number> = contamination) {
        const N = g.W * g.H;
        this.N = N;
        this.M = Float32Array.from(moisture);
        this.level = Float32Array.from(contamination);
        this.cand = Float32Array.from(candidates);
        this.sat = new Uint8Array(N);
        this.wn = new Uint8Array(N);
        this.countMark = new Uint8Array(N);
        this.saturationMark = new Uint8Array(N);
        this.countDirty = new Int32Array(N);
        this.saturationDirty = new Int32Array(N);
        this.pWet = new Uint8Array(N);
        this.pSurf = new Int32Array(N);
        this.pDepth = new Int32Array(N);
        this.pC = new Float32Array(N);
        this.pSat = new Uint8Array(N);
        this.pGive = new Int32Array(N).fill(-1);
        this.pBad = new Float32Array(N).fill(-1);
        this.wetList = new Int32Array(N);
        this.prevWetList = new Int32Array(N);
        this.mark = new Int32Array(N);
        this.markC = new Int32Array(N);
        this.dirty = new Int32Array(N);
        this.dirtyC = new Int32Array(N);
        // Eight neighbours of each tile, −1 outside: −y, −x, +x, +y, then the diagonals.
        this.nb = new Int32Array(8 * N);
        const { W, H } = g;
        for (let i = 0; i < N; i++) {
            const x = i % W, y = (i - x) / W;
            const at = (dx: number, dy: number) => (x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H) ? -1 : i + dy * W + dx;
            [at(0, -1), at(-1, 0), at(1, 0), at(0, 1), at(-1, -1), at(1, -1), at(-1, 1), at(1, 1)].forEach((j, k) => { this.nb[8 * i + k] = j; });
        }
        for (let i = 0; i < N; i++) if (this.level[i] !== this.cand[i]) this.converging.push(i);
    }

    /** One tick of the soil tasks, from water depth D and contamination C as the last tick left
     *  them. Writes the evaporation modifiers for the next tick's water into `evaporation`. */
    step(D: Float64Array, C: Float64Array, evaporation: Float64Array, full = false): void {
        const { N } = this, { z, F } = this.g, sat = this.sat, wn = this.wn, nb = this.nb;
        // WateredNeighborsCountingTask and ClusterSaturationCalculationTask.
        const t = this.prevWetList;
        this.prevWetList = this.wetList;
        this.prevWetCount = this.wetCount;
        this.wetList = t;
        let wc = 0, countN = 0, saturationN = 0;
        const cm = this.countMark, sm = this.saturationMark, cd = this.countDirty, sd = this.saturationDirty;
        const addCount = (i: number) => { if (!cm[i]) { cm[i] = 1; cd[countN++] = i; } };
        const addSaturation = (i: number) => { if (!sm[i]) { sm[i] = 1; sd[saturationN++] = i; } };
        for (let i = 0; i < N; i++) {
            const wet = D[i] > 0 ? 1 : 0;
            if (wet) this.wetList[wc++] = i;
            if (wet !== this.pWet[i]) {
                addCount(i);
                for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0) addCount(j); }
            }
        }
        this.wetCount = wc;
        // Only a changed wet bit (own or one of eight neighbours) can alter wn.
        for (let k = 0; k < countN; k++) {
            const i = cd[k]; cm[i] = 0;
            let c = 0;
            if (D[i] > 0) {
                c = 1;
                for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0 && D[j] > 0) c++; }
            }
            if (c !== wn[i]) {
                wn[i] = c;
                addSaturation(i);
                for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) addSaturation(j); }
            }
        }
        // All counts are final before any saturation reads them. The per-tile order is unchanged.
        for (let k = 0; k < saturationN; k++) {
            const i = sd[k]; sm[i] = 0;
            if (!(D[i] > 0)) { sat[i] = 0; continue; }
            let s = wn[i];
            for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0 && wn[j] > s) s = wn[j] - 1; }
            sat[i] = s > MAX_SAT ? MAX_SAT : s;
        }
        // WaterEvaporationCalculationTask.
        for (let i = 0; i < N; i++) evaporation[i] = sat[i] ? EVAPORATION[sat[i]] : 1;

        // Which tiles can change. Moisture: a tile whose own water changed, a tile beside water whose
        // offer to it changed, and the neighbours of a tile whose moisture or rounded depth changed.
        // Soil contamination: tiles beside badwater (≥ 0.5) that changed, and the neighbours of a
        // tile whose candidate changed. Every other tile would compute its last value again.
        const s = ++this.stamp, mark = this.mark, markC = this.markC, dirty = this.dirty, dirtyC = this.dirtyC;
        let n = 0, nc = 0;
        const add = (i: number) => { if (mark[i] !== s) { mark[i] = s; dirty[n++] = i; } };
        const addC = (i: number) => { if (markC[i] !== s) { markC[i] = s; dirtyC[nc++] = i; } };
        const initializing = full || this.first;
        if (initializing) for (let i = 0; i < N; i++) { add(i); addC(i); }
        else {
            for (const i of this.mChanged) { add(i); for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0) add(j); } }
            for (const i of this.cChanged) { addC(i); for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0) addC(j); } }
            const check = (i: number) => {
                const wet = D[i] > 0 ? 1 : 0, c = wet ? f(C[i]) : 0;
                const surf = wet ? Math.ceil(f(F[i] + f(D[i]))) : 0, depth = wet ? Math.ceil(f(D[i])) : 0;
                const give = wet ? waterMoisture(sat[i], c) : -1, bad = wet && c >= C_MIN_WATER ? c : -1;
                if (wet !== this.pWet[i] || c !== this.pC[i] || sat[i] !== this.pSat[i]) add(i);
                if (wet !== this.pWet[i] || surf !== this.pSurf[i] || give !== this.pGive[i])
                    for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) add(j); }
                if (depth !== this.pDepth[i])
                    for (let d = 0; d < 8; d++) { const j = nb[8 * i + d]; if (j >= 0) add(j); }
                if (bad !== this.pBad[i] || (bad >= 0 && surf !== this.pSurf[i]))
                    for (let d = 0; d < 4; d++) { const j = nb[8 * i + d]; if (j >= 0) addC(j); }
                // No other check reads this tile's old descriptors. Publish the exact
                // values already calculated, after all of this tile's comparisons.
                this.pWet[i] = wet; this.pSurf[i] = surf; this.pDepth[i] = depth;
                this.pC[i] = c; this.pSat[i] = sat[i]; this.pGive[i] = give; this.pBad[i] = bad;
            };
            for (let k = 0; k < wc; k++) check(this.wetList[k]);
            // A still-wet tile was already checked; repeated add/addC calls were no-ops.
            for (let k = 0; k < this.prevWetCount; k++) {
                const i = this.prevWetList[k]; if (!(D[i] > 0)) check(i);
            }
        }
        this.first = false;
        // The first/full pass does not execute check; initialize its descriptors here.
        if (initializing) {
        // Remember the water this pass read.
        for (let k = 0; k < this.prevWetCount; k++) {
            const i = this.prevWetList[k];
            this.pWet[i] = 0; this.pSurf[i] = 0; this.pDepth[i] = 0; this.pC[i] = 0; this.pSat[i] = 0; this.pGive[i] = -1; this.pBad[i] = -1;
        }
        for (let k = 0; k < wc; k++) {
            const i = this.wetList[k], c = f(C[i]);
            this.pWet[i] = 1; this.pSurf[i] = Math.ceil(f(F[i] + f(D[i]))); this.pDepth[i] = Math.ceil(f(D[i])); this.pC[i] = c; this.pSat[i] = sat[i];
            this.pGive[i] = waterMoisture(sat[i], c); this.pBad[i] = c >= C_MIN_WATER ? c : -1;
        }

        }

        // MoistureCalculationTask: read last tick's values, then write.
        const mNew: number[] = [];
        for (let k = 0; k < n; k++) {
            const i = dirty[k], v = this.moistureAt(i, D, C);
            if (v !== this.M[i]) mNew.push(i, v);
        }
        // ContaminationCandidatesCountingTask, then ContaminationsUpdateTask.
        const cNew: number[] = [];
        for (let k = 0; k < nc; k++) {
            const i = dirtyC[k], v = this.candidateAt(i, D, C);
            if (v !== this.cand[i]) cNew.push(i, v);
        }
        this.mChanged = [];
        for (let k = 0; k < mNew.length; k += 2) { this.M[mNew[k]] = mNew[k + 1]; this.mChanged.push(mNew[k]); }
        this.cChanged = [];
        for (let k = 0; k < cNew.length; k += 2) { this.cand[cNew[k]] = cNew[k + 1]; this.cChanged.push(cNew[k]); }
        const moving: number[] = [];
        const s2 = ++this.stamp;
        const update = (i: number) => {
            if (mark[i] === s2) return;
            mark[i] = s2;
            const lv = this.level[i], cd = this.cand[i];
            const diff = f(cd - lv), rate = diff > 0 ? C_UP : C_DOWN;
            let v = diff <= rate && diff >= -rate ? cd : f(lv + Math.sign(diff) * rate);
            if (v < C_THRESHOLD) v = 0;
            this.level[i] = v;
            if (v !== cd) moving.push(i);
        };
        if (full) for (let i = 0; i < N; i++) update(i);
        else { for (const i of this.cChanged) update(i); for (const i of this.converging) update(i); }
        this.converging = moving;
        this.passes++;
    }

    /** MoistureCalculationTask.CalculateMoistureForCell on a heightfield. */
    private moistureAt(i: number, D: Float64Array, C: Float64Array): number {
        const { z, F, fullBarrier, aboveBarrier } = this.g, nb = this.nb, M = this.M, sat = this.sat;
        if (fullBarrier[i]) return 0;
        const zi = z[i], own = F[i] === zi;
        if (own && D[i] > 0 && f(C[i]) <= M_MIN_WATER_C && !aboveBarrier[i]) return 2 * sat[i];
        let num = 0;
        for (let q = 0; q < 4 && num < M_MAX; q++) {
            const j = nb[8 * i + WATER_ORDER[q]];
            if (j < 0 || !(F[j] <= zi && D[j] > 0)) continue;
            const surf = Math.ceil(f(F[j] + f(D[j])));
            if (surf <= 0) continue;
            if (F[j] >= zi && (aboveBarrier[i] || aboveBarrier[j])) continue;
            const v = waterMoisture(sat[j], f(C[j])) - Math.max(0, zi - surf) * M_VERTICAL;
            if (v > num) num = v;
        }
        let spread = 0;
        if (num < M_MAX) for (let d = 0; d < 8; d++) {
            const j = nb[8 * i + d];
            if (j < 0) continue;
            const last = M[j];
            if (last === 0) continue;
            const cost = d < 4 ? 1 : M_DIAG;
            const up = zi - z[j];
            let v: number;
            if (up < 0) v = f(last - cost);
            else {
                const covered = F[j] <= z[j] ? Math.ceil(f(D[j])) : 0;
                const climb = up - covered;
                v = climb < 0 ? f(last - cost) : f(f(last - climb * M_VERTICAL) - cost);
            }
            if (v > spread) spread = v;
        }
        const last = M[i];
        let decayed = f(last - M_DECAY);
        if (decayed < 0) decayed = 0;
        let v = decayed;
        if (num > decayed && num >= spread) { const cap = f(last + M_SPREAD); v = num > cap ? cap : num; }
        else if (spread > decayed) v = spread;
        const cont = own ? f(C[i]) : 0;
        const out = f(v * f(1 - cont));
        return out < M_MIN ? 0 : out;
    }

    /** ContaminationCandidatesCountingTask.GetContaminationCandidate on a heightfield. */
    private candidateAt(i: number, D: Float64Array, C: Float64Array): number {
        const { z, F, contaminationBarrier, aboveBarrier } = this.g, nb = this.nb, cand = this.cand;
        if (contaminationBarrier[i]) return 0;
        const zi = z[i];
        let num = 0;
        for (let q = 0; q < 4 && num < C_MAX; q++) {
            const j = nb[8 * i + WATER_ORDER[q]];
            if (j < 0 || !(F[j] <= zi && f(C[j]) > 0)) continue;
            const c = f(f(C[j]) - C_MIN_WATER);
            if (c < 0) continue;
            const surf = D[j] > 0 ? Math.ceil(f(F[j] + f(D[j]))) : 0;
            if (surf <= 0) continue;
            if (F[j] >= zi && (aboveBarrier[i] || aboveBarrier[j])) continue;
            const base = f(c * C_SCALER), up = zi - surf;
            const v = up < 0 ? base : f(base - f(up * C_VERTICAL));
            if (v > num) num = v;
        }
        let spread = 0;
        if (num < C_MAX) for (let d = 0; d < 8; d++) {
            const j = nb[8 * i + d];
            if (j < 0) continue;
            const up = Math.max(0, zi - z[j]);
            const v = f(f(cand[j] - f(up * C_VERTICAL)) - (d < 4 ? C_REG : C_DIAG));
            if (v > spread) spread = v;
        }
        const last = cand[i];
        let decayed = f(last - C_DECAY);
        if (decayed < 0) decayed = 0;
        if (num > decayed && num >= spread) { const cap = f(last + C_SPREAD); return num > cap ? cap : num; }
        return spread > decayed ? spread : decayed;
    }
}

/** MoistureCalculationTask.GetMoisture: the range a water tile gives, cut by its contamination. */
function waterMoisture(sat: number, c: number): number {
    if (c < M_MIN_WATER_C) return 2 * sat;
    const s = f(c * M_SCALER);
    if (s >= 1) return 0;
    return Math.trunc(f(f(2 * sat) * f(1 - s)));
}
