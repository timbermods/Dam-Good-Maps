import { JsonFloat } from '../../src/core/format/json';
import type { EntitySpec } from '../../src/core/format/entities';
import { waterSource } from '../../src/core/format/entities';
import { waterModel, type MapObject, objectTile } from '../../src/core/sim/model';
import { FOOTPRINTS } from '../../src/core/format/footprints';
import { WaterSim, DT, type WaterState } from '../../src/core/sim/water';
import { drainage } from '../generative/proto/erode';

export interface CarveMap {
  name: string; W: number; H: number; heights: Uint8Array; entities: EntitySpec[];
  water: WaterState; maxHeight: number;
}
export interface Settings { walls: 'steep' | 'wide'; layers: boolean; strength: number }
export const DEFAULTS: Settings = { walls: 'wide', layers: true, strength: 4 };
export const STEPS_PER_SECOND = 10;
export const WATER_TICKS_PER_STEP = 4;
export const plainEntities = (entities: EntitySpec[]): EntitySpec[] => JSON.parse(JSON.stringify(entities, (_key, value) => value instanceof JsonFloat ? value.value : value));
export const isPlant = (e: EntitySpec) => /^(Pine|Birch|Oak|Succulent|BlueberryBush)$/.test(e.template);
export function objects(entities: EntitySpec[]): MapObject[] {
  return entities.map(e => ({ ...e, components: { ...e.before, ...e.components } }));
}
export function modelFor(map: CarveMap) { return waterModel(map.W, map.H, map.heights, objects(map.entities)); }
export function placeSource(map: CarveMap, tile: number, strength: number): CarveMap {
  if (!Number.isInteger(tile) || tile < 0 || tile >= map.W * map.H || !(strength > 0 && strength <= 8)) throw new Error('Invalid source');
  const e = waterSource({ id: 'carve-source', owner: 'carve', x: tile % map.W, y: Math.floor(tile / map.W), z: map.heights[tile], strength });
  return { ...map, entities: plainEntities([...map.entities.filter(e => e.id !== 'carve-source'), e]) };
}
/** V2 erodeHard's coefficient exactly: hard rock retains 15% incision, 20% diffusion.
 * Hidden horizontal beds at levels 4, 8, 12, 16, 20. No per-tile random rubble. */
export function hardness(level: number, layers: boolean): number {
  return layers && level > 0 && level % 4 === 0 ? 1 : 0;
}
export function protectedGround(map: CarveMap): Uint8Array {
  const keep = new Uint8Array(map.W * map.H);
  for (const e of map.entities) {
    if (isPlant(e) || /Source|Seep|Slope/.test(e.template)) continue;
    const fp = FOOTPRINTS[e.template]?.size ?? [1, 1, 1];
    const margin = e.template === 'StartingLocation' ? 1 : 0;
    for (let y = -margin; y < fp[1] + margin; y++) for (let x = -margin; x < fp[0] + margin; x++) {
      const [xx, yy] = objectTile(e, x, y);
      if (xx >= 0 && yy >= 0 && xx < map.W && yy < map.H) keep[yy * map.W + xx] = 1;
    }
  }
  return keep;
}
export interface Metrics { cut: number; deposited: number; exported: number; suspended: number; bankCuts: number; bendCuts: number; steps: number; stable: boolean }
const DX = [0, -1, 0, 1], DY = [-1, 0, 1, 0], OPP = [2, 3, 0, 1];

/** No wall clock, random numbers or frame-dependent batches in this state machine. */
export class CarveRun {
  readonly map: CarveMap;
  readonly sim: WaterSim;
  readonly sign: Int8Array;
  readonly keep: Uint8Array;
  readonly wear: Float64Array;
  readonly sediment: Float64Array;
  readonly touched: Uint8Array;
  readonly neighbours: Int32Array;
  readonly basin: Float64Array;
  readonly reached: Uint8Array;
  readonly original: Uint8Array;
  readonly metrics: Metrics = { cut: 0, deposited: 0, exported: 0, suspended: 0, bankCuts: 0, bendCuts: 0, steps: 0, stable: false };
  private quiet = 0;
  private lastDepth: Float64Array;
  constructor(input: CarveMap, readonly settings: Settings) {
    if (input.heights.length !== input.W * input.H || !['steep', 'wide'].includes(settings.walls)) throw new Error('Invalid map/settings');
    this.map = { ...input, heights: input.heights.slice(), entities: plainEntities(input.entities), water: { depth: input.water.depth.slice(), contamination: input.water.contamination.slice() } };
    this.original = input.heights.slice();
    this.keep = protectedGround(input);
    this.sim = new WaterSim(modelFor(this.map), this.map.water);
    const N = input.W * input.H;
    this.sign = new Int8Array(N); this.wear = new Float64Array(N); this.sediment = new Float64Array(N); this.touched = new Uint8Array(N);
    this.lastDepth = this.sim.D.slice();
    this.reached = new Uint8Array(N);
    const selected = input.entities.find(e => e.id === 'carve-source');
    if (selected) this.reached[selected.y * input.W + selected.x] = 1;
    else for (const e of this.sim.emitters) for (const i of e.cells) this.reached[i] = 1;
    // Shared M9 drainage identifies receiving basins, not an imposed channel.
    this.basin = drainage(input.heights, input.W, input.H, { eight: false }).filled;
    this.neighbours = new Int32Array(N * 4).fill(-1);
    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
      const x = i % input.W + DX[k], y = Math.floor(i / input.W) + DY[k];
      if (x >= 0 && y >= 0 && x < input.W && y < input.H) this.neighbours[4 * i + k] = y * input.W + x;
    }
  }
  step(): number[] {
    if (this.metrics.stable) return [];
    const { sim, map, neighbours: nb, sediment: sed } = this;
    const h = map.heights, N = h.length;
    sim.run(WATER_TICKS_PER_STEP);
    this.metrics.steps++;
    const power = new Float64Array(N), q = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
    const bank = new Float64Array(N), bend = new Float64Array(N), carry = new Float64Array(N);
    const delta = new Int8Array(N);
    const front = this.reached.slice();
    for (let i = 0; i < N; i++) if (this.reached[i]) for (let k = 0; k < 4; k++) {
      const j = nb[4*i+k];
      if (j >= 0 && sim.out[4*i+k] > .001) front[j] = 1;
    }
    this.reached.set(front);
    // Actual outgoing flux and hydraulic gradient: sqrt(Q) S, M9's m=.5,n=1.
    for (let i = 0; i < N; i++) {
      if (sim.D[i] <= .015) continue;
      let slope = 0;
      for (let k = 0; k < 4; k++) {
        const j = nb[4*i+k], f = sim.out[4*i+k] / DT;
        q[i] += f; vx[i] += DX[k] * f; vy[i] += DY[k] * f;
        const head = j < 0 ? 0 : sim.F[j] + sim.D[j];
        slope += f * Math.max(0, sim.F[i] + sim.D[i] - head);
      }
      power[i] = q[i] > 0 ? Math.sqrt(q[i]) * slope / q[i] : 0;
    }
    // Weathering/slumping only propagates from water or already eroded ground.
    // The repose threshold changes width; hard bands keep larger, persistent lips.
    for (let i = 0; i < N; i++) {
      if (!((this.reached[i] && sim.D[i] > .03) || this.sign[i] < 0)) continue;
      for (let k = 0; k < 4; k++) {
        const j = nb[4*i+k]; if (j < 0) continue;
        const hard = hardness(h[j], this.settings.layers);
        const repose = (this.settings.walls === 'wide' ? 1 : 3) + hard;
        const excess = h[j] - h[i] - repose;
        if (excess > 0) bank[j] = Math.max(bank[j], .11 * excess * (1 - .8 * hard));
        // Incoming momentum continuing beyond a turn attacks the outside bank.
        if (q[i] > .08 && h[j] > h[i] && sim.D[j] < .3) {
          let ix = 0, iy = 0;
          for (let a = 0; a < 4; a++) {
            const u = nb[4*i+a]; if (u < 0) continue;
            const incoming = sim.out[4*u+OPP[a]] / DT;
            ix -= DX[a] * incoming; iy -= DY[a] * incoming;
          }
          const il = Math.sqrt(ix*ix+iy*iy), ol = Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]);
          if (il > .02 && ol > .02) {
            const turn = Math.max(0, 1 - (ix*vx[i]+iy*vy[i])/(il*ol));
            const outside = Math.max(0, (ix*DX[k]+iy*DY[k])/il);
            bend[j] = Math.max(bend[j], .12 * turn * outside * Math.sqrt(q[i]) * (1 - .85*hard));
          }
        }
      }
    }
    // Advect a bounded fraction of load with actual four-way flow. Remainder stays
    // suspended; losses only cross a draining boundary and are explicitly counted.
    for (let i = 0; i < N; i++) {
      if (sed[i] <= 0) continue;
      if (sim.D[i] < .015) {
        let j = -1;
        for (let k = 0; k < 4; k++) { const n = nb[4*i+k]; if (n >= 0 && h[n] < h[i] && (j < 0 || h[n] < h[j])) j = n; }
        if (j >= 0) { carry[j] += sed[i]*.5; carry[i] += sed[i]*.5; continue; }
      }
      const moved = sed[i] * Math.min(.85, q[i] * DT / Math.max(.1, sim.D[i]));
      carry[i] += sed[i] - moved;
      if (q[i] > 0) for (let k = 0; k < 4; k++) {
        const amount = moved * (sim.out[4*i+k]/DT) / q[i], j = nb[4*i+k];
        if (j >= 0) carry[j] += amount; else this.metrics.exported += amount;
      }
    }
    sed.set(carry);
    for (let i = 0; i < N; i++) {
      if (this.keep[i]) continue;
      const hard = hardness(h[i], this.settings.layers);
      // Thin sheets do little work; submerged basin floors receive sediment.
      const submerged = Math.max(0, this.basin[i] - h[i]);
      const incision = this.reached[i] && sim.D[i] > .04 && submerged < .8 ? .24 * Math.max(0, power[i] - .035) * (1 - .85 * hard) : 0;
      if (this.sign[i] <= 0 && h[i] > 0) {
        this.wear[i] += Math.min(.7, incision + bank[i] + bend[i]);
        if (this.wear[i] >= 1) delta[i] = -1;
      }
      // Capacity falls with speed and slope. Accumulate whole voxel volumes only.
      // Lake/delta deposits cannot rise above water; bars stay below local surface.
      const capacity = .6 * q[i] * (1 + 4*power[i]);
      if (!delta[i] && this.sign[i] >= 0 && sed[i] >= 1 + capacity && power[i] < .22 &&
          sim.D[i] > 1.03 && h[i] < map.maxHeight) delta[i] = 1;
    }
    this.rejectIsolated(delta);
    const changed: number[] = [];
    for (let i = 0; i < N; i++) {
      if (!delta[i]) continue;
      changed.push(i); this.sign[i] = delta[i]; this.touched[i] = 1;
      h[i] += delta[i]; sim.F[i] += delta[i];
      // Preserve free surface where possible; newly cut ground fills in subsequent
      // WaterSim ticks, rather than creating water by increasing its depth.
      if (delta[i] > 0) { sim.D[i] = Math.max(0, sim.D[i]-1); sed[i] -= 1; this.metrics.deposited++; }
      else {
        sed[i] += 1; this.wear[i] = Math.max(0, this.wear[i]-1); this.metrics.cut++;
        if (bank[i] > 0) this.metrics.bankCuts++;
        if (bend[i] > 0) this.metrics.bendCuts++;
      }
    }
    if (changed.length) {
      const hit = new Set(changed);
      map.entities = map.entities.filter(e => !(isPlant(e) && hit.has(e.y*map.W+e.x))).map(e =>
        /Source|Seep|Slope/.test(e.template) ? { ...e, z: h[e.y*map.W+e.x] } : e);
    }
    this.quiet = changed.length ? 0 : this.quiet + 1;
    // A long quiet interval includes slow hard-rock wear and flow propagation.
    // Stability is checked only on deterministic step boundaries, never timeouts.
    if (this.quiet >= 240 && this.metrics.steps % 40 === 0) {
      let moving = 0;
      for (let i = 0; i < N; i++) if (Math.abs(sim.D[i]-this.lastDepth[i]) > .005) moving++;
      if (moving <= N * .005) this.metrics.stable = true;
    }
    if (this.metrics.steps % 40 === 0) this.lastDepth = sim.D.slice();
    this.metrics.suspended = sed.reduce((a, b) => a + b, 0);
    map.water = { depth: sim.D, contamination: sim.C };
    return changed;
  }
  /** Reject newly-created one-tile extrema, including an untouched spike left by
   * lowering its neighbours. Rejection, never opposite-sign corrective edits. */
  private rejectIsolated(d: Int8Array) {
    const h = this.map.heights, nb = this.neighbours;
    let again = true;
    while (again) {
      again = false;
      for (let i = 0; i < h.length; i++) {
        if (nb[4*i] < 0 || nb[4*i+1] < 0 || nb[4*i+2] < 0 || nb[4*i+3] < 0) continue;
        const ns = [nb[4*i], nb[4*i+1], nb[4*i+2], nb[4*i+3]];
        const v = h[i]+d[i], lo = Math.min(...ns.map(j => h[j]+d[j])), hi = Math.max(...ns.map(j => h[j]+d[j]));
        const oldLo = Math.min(...ns.map(j => h[j])), oldHi = Math.max(...ns.map(j => h[j]));
        if ((v < lo && h[i] >= oldLo) || (v > hi && h[i] <= oldHi)) {
          if (d[i]) { d[i] = 0; again = true; }
          else for (const j of ns) if (d[j]) { d[j] = 0; again = true; }
        }
      }
    }
  }
}



