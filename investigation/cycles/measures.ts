import { components } from '../../src/core/analysis/regions';
import { spillLevels } from '../../src/core/sim/prefill';
import { walkDistance, reachAt } from '../../src/core/analysis/walk';
import { footprintTiles, slopeHighSide } from '../../src/core/format/footprints';
import { WALK_BLOCKERS } from '../../src/core/validate/playability';
import type { BuildResult } from '../../src/core/features/build';
import { CycleModel, SPECIES } from './model';
export const WET = .05, BAD = .05;
export const rounded = (n: number) => Math.round(n * 1000) / 1000;
export interface Region {
    id: number;
    name: string;
    kind: string;
    x: number;
    y: number;
    tiles: number;
    initialVolume: number;
}
export class Measures {
    regions: Region[] = [];
    labels: Int32Array;
    initialBodies: Int32Array;
    initialWet: Uint8Array;
    nearPlants: Uint8Array;
    shore: Uint8Array;
    firstDry: Float32Array;
    firstBad: Float32Array;
    firstWaterLost: number | null = null;
    firstSoilClean: number | null = null;
    constructor(readonly model: CycleModel, readonly waterWithin: number) {
        const b = model.built, N = b.W * b.H;
        this.initialWet = Uint8Array.from(b.water, d => d > WET ? 1 : 0);
        this.initialBodies = components(this.initialWet, b.W, b.H).labels;
        this.labels = new Int32Array(N).fill(-1);
        const spill = spillLevels(b.waterModel);
        for (const basin of [true, false]) {
            const mask = Uint8Array.from(b.water, (d, i) => d > WET && ((spill[i] - b.waterModel.floor[i] > .15) === basin) ? 1 : 0);
            const c = components(mask, b.W, b.H), groups: number[][] = c.sizes.map(() => []);
            for (let i = 0; i < N; i++)
                if (c.labels[i] >= 0)
                    groups[c.labels[i]].push(i);
            for (const cells of groups) {
                const id = this.regions.length;
                let volume = 0, x = 0, y = 0;
                for (const i of cells) {
                    this.labels[i] = id;
                    volume += b.water[i];
                    x += i % b.W;
                    y += Math.floor(i / b.W);
                }
                x = Math.round(x / cells.length);
                y = Math.round(y / cells.length);
                const kind = basin ? (cells.length >= 64 ? 'Lake' : 'Pool') : 'River';
                this.regions.push({ id, name: `${kind} at (${x}, ${y})`, kind, x, y, tiles: cells.length, initialVolume: rounded(volume) });
            }
        }
        const blocked = new Uint8Array(N), links: [
            number,
            number
        ][] = [];
        for (const o of b.entities) {
            if (WALK_BLOCKERS.has(o.template))
                for (const [x, y] of footprintTiles(o.template, o))
                    if (x >= 0 && y >= 0 && x < b.W && y < b.H)
                        blocked[y * b.W + x] = 1;
            if (o.template === 'Slope') {
                const [dx, dy] = slopeHighSide(o.orientation), x = o.x + dx, y = o.y + dy;
                if (x >= 0 && y >= 0 && x < b.W && y < b.H)
                    links.push([o.y * b.W + o.x, y * b.W + x]);
            }
        }
        if (!b.start)
            throw new Error('Generated map has no start');
        const flat = walkDistance(b.heights, b.W, b.H, blocked, [], b.start);
        const walk = walkDistance(b.heights, b.W, b.H, blocked, links, b.start);
        this.nearPlants = Uint8Array.from(model.plants, p => reachAt(walk, b.W, b.H, p.tile) <= 20 ? 1 : 0);
        this.shore = new Uint8Array(N);
        for (let i = 0; i < N; i++)
            if (flat[i] <= waterWithin && b.heights[i] === b.start.z) {
                const x = i % b.W, y = Math.floor(i / b.W);
                for (const j of [y > 0 ? i - b.W : -1, x > 0 ? i - 1 : -1, y + 1 < b.H ? i + b.W : -1, x + 1 < b.W ? i + 1 : -1])
                    if (j >= 0)
                        this.shore[j] = 1;
            }
        this.firstDry = new Float32Array(N).fill(-1);
        this.firstBad = new Float32Array(N).fill(-1);
    }
    sample(day: number) {
        const m = this.model, s = m.sim, b = m.built, N = s.N;
        const wet = Uint8Array.from(s.D, d => d > WET ? 1 : 0), c = components(wet, b.W, b.H);
        const descendants = new Map<number, Set<number>>();
        const volume = new Float64Array(this.regions.length), clean = new Float64Array(this.regions.length);
        let total = 0, badVolume = 0, wetTiles = 0, badTiles = 0, soil = 0, moist = 0, dried = 0, pumpTiles = 0, outside = 0;
        for (let i = 0; i < N; i++) {
            const d = s.D[i], bad = s.C[i] >= BAD, lab = this.labels[i];
            total += d;
            badVolume += d * s.C[i];
            if (lab >= 0) {
                volume[lab] += d;
                if (!bad)
                    clean[lab] += d;
            }
            else
                outside += d;
            if (m.SC[i] > 0)
                soil++;
            if (m.M[i] > 0)
                moist++;
            if (wet[i]) {
                wetTiles++;
                if (bad) {
                    badTiles++;
                    if (this.firstBad[i] < 0)
                        this.firstBad[i] = day;
                }
                const parent = this.initialBodies[i];
                if (parent >= 0) {
                    let set = descendants.get(parent);
                    if (!set) {
                        set = new Set();
                        descendants.set(parent, set);
                    }
                    set.add(c.labels[i]);
                }
            }
            if (this.initialWet[i] && !wet[i]) {
                dried++;
                if (this.firstDry[i] < 0)
                    this.firstDry[i] = day;
            }
            const surface = b.heights[i] + d;
            if (this.shore[i] && d >= .3 && !bad && surface >= b.start!.z - 2 && surface <= b.start!.z + .01)
                pumpTiles++;
        }
        if (!pumpTiles && this.firstWaterLost === null)
            this.firstWaterLost = day;
        const plants = { treesLost: 0, bushesLost: 0, nearTreesAlive: 0, nearBushesAlive: 0, nearLogs: 0, originalTrees: 0, originalBushes: 0 };
        m.plants.forEach((p, k) => {
            const tree = SPECIES[p.species].logs > 0, bush = p.species === 'BlueberryBush';
            if (!p.initialDead) {
                if (tree)
                    plants.originalTrees++;
                if (bush)
                    plants.originalBushes++;
                if (p.dead) {
                    if (tree)
                        plants.treesLost++;
                    if (bush)
                        plants.bushesLost++;
                }
            }
            if (this.nearPlants[k]) {
                if (tree) {
                    plants.nearLogs += SPECIES[p.species].logs;
                    if (!p.dead)
                        plants.nearTreesAlive++;
                }
                if (bush && !p.dead)
                    plants.nearBushesAlive++;
            }
        });
        return { day, volume: rounded(total), badVolume: rounded(badVolume), wetTiles, badTiles, soilTiles: soil, moistTiles: moist, driedTiles: dried,
            pools: c.sizes.filter(n => n >= 4).length, splitBodies: [...descendants.values()].filter(set => set.size > 1).length,
            maxFragments: Math.max(0, ...[...descendants.values()].map(set => set.size)), pumpTiles, plants,
            regionVolume: Array.from(volume, rounded), regionCleanVolume: Array.from(clean, rounded), outsideBaselineVolume: rounded(outside) };
    }
}
export function rle(values: ArrayLike<number>): number[] {
    const out: number[] = [];
    for (let i = 0; i < values.length;) {
        const v = values[i];
        let end = i + 1;
        while (end < values.length && values[end] === v)
            end++;
        out.push(end - i, v);
        i = end;
    }
    return out;
}
/** Display only: millimetre water and 0.001 contamination. Measures use full precision. */
export function frame(model: CycleModel, initial: Uint8Array) {
    const s = model.sim;
    const state = Uint8Array.from(s.D, (d, i) => d > WET ? (s.C[i] >= BAD ? 4 : d >= .3 ? 3 : 2) : model.SC[i] > 0 ? 5 : initial[i] ? 6 : model.M[i] > 0 ? 1 : 0);
    return { state: rle(state), depth: rle(Uint16Array.from(s.D, d => Math.min(65535, Math.round(d * 1000)))),
        bad: rle(Uint16Array.from(s.C, c => Math.round(c * 1000))), dead: model.plants.flatMap((p, k) => p.dead ? [k] : []) };
}
