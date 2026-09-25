// Terrain runs and water columns of a voxel map, built by the game's own rules (Timberborn 1.1.2.4).
//
// Terrain (`ColumnTerrainMap.LoadColumns`): each tile's solid voxels as runs [floor, ceiling). Run 0
// always starts at z = 0 and is empty (ceiling 0) when the bottom voxel is air, so every other run
// is terrain that must be held up by the support rule (support.ts).
//
// Water (`WaterSimulator.CreateColumns` and the obstacle methods): every tile starts as one open
// column [0, 34) (34 = total height 33 + 1). Each solid voxel is added as a full obstacle, bottom to
// top, then the map objects' obstacles are added: a full obstacle fills one cell, splitting,
// shrinking or removing the column it falls in; a horizontal obstacle at z splits a column at z
// without filling a cell (a roof). Water columns are the air gaps; slot k is the k-th from the
// bottom, which is how the file stores water (`WaterMapNew`, index slot·X·Y + y·X + x).

import { rotate, type Orientation } from "../../../src/core/format/footprints";

export const TERRAIN_LAYERS = 23;
export const TOTAL_HEIGHT = 33;
/** The ceiling of an open column: `WaterSimulator._maxColumnHeight` = total height + 1. */
export const OPEN_CEILING = TOTAL_HEIGHT + 1;

/** Solid runs per tile. Run k of tile i is [floor[k·N + i], ceil[k·N + i]). */
export interface TerrainRuns {
  W: number;
  H: number;
  N: number;
  L: number;
  count: Uint8Array;
  floor: Uint8Array;
  ceil: Uint8Array;
}

export function terrainRuns(W: number, H: number, voxels: Uint8Array, layers = TERRAIN_LAYERS): TerrainRuns {
  const N = W * H;
  const lists: number[][] = [];
  let L = 1;
  for (let i = 0; i < N; i++) {
    const runs: number[] = [];
    // ColumnTerrainMap.LoadColumns: `flag` starts true with floor 0, so run 0 always starts at z = 0
    let inSolid = true;
    let floor = 0;
    for (let z = 0; z < layers; z++) {
      if (voxels[z * N + i]) {
        if (!inSolid) floor = z;
        inSolid = true;
      } else {
        if (inSolid) runs.push(floor, z);
        inSolid = false;
      }
    }
    if (inSolid) runs.push(floor, layers);
    lists.push(runs);
    if (runs.length / 2 > L) L = runs.length / 2;
  }
  const count = new Uint8Array(N);
  const fl = new Uint8Array(L * N);
  const ce = new Uint8Array(L * N);
  for (let i = 0; i < N; i++) {
    const r = lists[i];
    count[i] = r.length / 2;
    for (let k = 0; k < r.length / 2; k++) {
      fl[k * N + i] = r[2 * k];
      ce[k * N + i] = r[2 * k + 1];
    }
  }
  return { W, H, N, L, count, floor: fl, ceil: ce };
}

/** True when a tile is not one solid run from z = 0 (a cave, overhang, arch or floating ground). */
export function isMultiRun(t: TerrainRuns, i: number): boolean {
  return t.count[i] > 1;
}

/** A map object that changes the water columns or emits water, in world cells. */
export interface WaterObjectPlacement {
  template: string;
  x: number;
  y: number;
  z: number;
  orientation: Orientation;
  flipped: boolean;
}

/** Local obstacle layout of the map templates that change water columns (their blueprints):
 *  `WaterObstacleSpec` + `FinishableWaterObstacleSpec.Height` (1 = a full obstacle at the base z,
 *  0.65 = a partial obstacle, `WaterObstacle.AddToWaterService`) and
 *  `FinishableHorizontalWaterObstacleSpec.Obstacles` (local x, y, z above the object's z). */
export const OBSTACLES: Record<string, { full?: [number, number][]; partial?: { at: [number, number]; height: number }; horizontal?: [number, number, number][] }> = {
  Blockage: { full: [[0, 0]] },
  NaturalDam: { partial: { at: [0, 0], height: 0.65 } },
  NaturalOverhang2x1: { full: [[0, 0]], horizontal: [[0, 0, 1], [0, 1, 1]] },
  NaturalOverhang3x1: { full: [[0, 0]], horizontal: [[0, 0, 1], [0, 1, 1], [0, 2, 1]] },
  NaturalOverhang4x1: { full: [[0, 0]], horizontal: [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  BadtideDrain: { full: [[0, 0]], horizontal: [[0, 1, 0], [0, 1, 1]] },
};

/** Flow directions as the game's integer offsets, in our tile terms: 0 = −y, 1 = −x, 2 = +y, 3 = +x. */
export const DIR_OF_ORIENTATION: Record<Orientation, number> = { Cw0: 2, Cw90: 3, Cw180: 0, Cw270: 1 };

export function worldTile(p: WaterObjectPlacement, lx: number, ly: number, sizeX = 1, flippable = false): [number, number] {
  const x = p.flipped && flippable ? sizeX - 1 - lx : lx;
  const [dx, dy] = rotate(p.orientation, x, ly);
  return [p.x + dx, p.y + dy];
}

/** Water columns per tile, slot-major like the game (column id = slot·N + tile). */
export interface WaterColumns {
  W: number;
  H: number;
  N: number;
  /** Largest column count of any tile (the file's `Levels` is at least this). */
  L: number;
  count: Uint8Array;
  floor: Int16Array;
  ceil: Int16Array;
  /** Partial obstacles (NaturalDam): height limit per (tile, z), index z·N + tile; −1 = none. */
  heightLimit: Float64Array | null;
  /** Direction limiters (badtide drains' emitter cells): per (tile, z), 0 = none, else 1 + direction. */
  dirLimit: Uint8Array | null;
}

export function waterColumns(W: number, H: number, voxels: Uint8Array, objects: readonly WaterObjectPlacement[], layers = TERRAIN_LAYERS): WaterColumns {
  const N = W * H;
  const cols: number[][] = []; // per tile: [floor0, ceil0, floor1, ceil1, ...] bottom to top
  for (let i = 0; i < N; i++) cols.push([0, OPEN_CEILING]);

  const find = (c: number[], z: number): number => {
    for (let k = 0; k < c.length; k += 2) {
      if (z < c[k]) break;
      if (z < c[k + 1]) return k;
    }
    return -1;
  };
  // WaterSimulator.AddFullObstacleInternal
  const addFull = (i: number, z: number) => {
    const c = cols[i];
    const k = find(c, z);
    if (k < 0) return; // the game throws here; a valid map never adds an obstacle inside terrain
    if (c[k] === z) {
      if (c[k + 1] - 1 === z) c.splice(k, 2);
      else c[k] = z + 1;
    } else if (c[k + 1] - 1 === z) {
      c[k + 1] = z;
    } else {
      const top = c[k + 1];
      c[k + 1] = z;
      c.splice(k + 2, 0, z + 1, top);
    }
  };
  // WaterSimulator.AddHorizontalObstacleInternal (first obstacle at a cell only)
  const hcount = new Map<number, number>();
  const addHorizontal = (i: number, z: number) => {
    const key = z * N + i;
    const n = (hcount.get(key) ?? 0) + 1;
    hcount.set(key, n);
    if (n !== 1) return;
    const c = cols[i];
    const k = find(c, z);
    if (k < 0 || c[k] === z) return;
    const top = c[k + 1];
    c[k + 1] = z;
    c.splice(k + 2, 0, z, top);
  };

  for (let i = 0; i < N; i++) for (let z = 0; z < layers; z++) if (voxels[z * N + i]) addFull(i, z);

  let heightLimit: Float64Array | null = null;
  let dirLimit: Uint8Array | null = null;
  const inside = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  for (const o of objects) {
    const rule = OBSTACLES[o.template];
    if (!rule) continue;
    const flippable = o.template === "Blockage" || o.template === "NaturalDam";
    for (const [lx, ly] of rule.full ?? []) {
      const [x, y] = worldTile(o, lx, ly, 1, flippable);
      if (inside(x, y)) addFull(y * W + x, o.z);
    }
    if (rule.partial) {
      const [x, y] = worldTile(o, rule.partial.at[0], rule.partial.at[1], 1, flippable);
      if (inside(x, y)) {
        if (!heightLimit) heightLimit = new Float64Array((OPEN_CEILING + 1) * N).fill(-1);
        heightLimit[o.z * N + y * W + x] = rule.partial.height;
      }
    }
    for (const [lx, ly, lz] of rule.horizontal ?? []) {
      const [x, y] = worldTile(o, lx, ly);
      if (inside(x, y)) addHorizontal(y * W + x, o.z + lz);
    }
    if (o.template === "BadtideDrain") {
      // DirectionalWaterSource: the emitter cell (0, 1) at the object's z
      const [x, y] = worldTile(o, 0, 1);
      if (inside(x, y)) {
        if (!dirLimit) dirLimit = new Uint8Array((OPEN_CEILING + 1) * N);
        dirLimit[o.z * N + y * W + x] = 1 + DIR_OF_ORIENTATION[o.orientation];
      }
    }
  }

  let L = 1;
  for (let i = 0; i < N; i++) if (cols[i].length / 2 > L) L = cols[i].length / 2;
  const count = new Uint8Array(N);
  const floor = new Int16Array(L * N);
  const ceil = new Int16Array(L * N);
  for (let i = 0; i < N; i++) {
    const c = cols[i];
    count[i] = c.length / 2;
    for (let k = 0; k < c.length / 2; k++) {
      floor[k * N + i] = c[2 * k];
      ceil[k * N + i] = c[2 * k + 1];
    }
  }
  return { W, H, N, L, count, floor, ceil, heightLimit, dirLimit };
}

/** The slot of the column that contains z on tile i, or −1. */
export function slotAt(wc: WaterColumns, i: number, z: number): number {
  for (let k = 0; k < wc.count[i]; k++) {
    const id = k * wc.N + i;
    if (z < wc.floor[id]) break;
    if (z < wc.ceil[id]) return k;
  }
  return -1;
}

/** A column is roofed when something closes it from above (its ceiling is below the open sky). */
export function isRoofed(wc: WaterColumns, id: number): boolean {
  return wc.ceil[id] < OPEN_CEILING;
}
