// Water surfaces (PLAN §14.2: "water surfaces as translucent quads at depth"), meshed per chunk
// like the terrain. Each wet tile gets a flat quad at its surface; where a neighbour's water or
// ground is lower, a curtain hangs from the surface down to it, so falls and steps read as falling
// water. Water in caves (below a tile's surface water) gets its top quad only. Each vertex carries
// a depth and badwater share, which the shader turns into colour and opacity (Map look, D86: a
// top's corners share them with the tiles round the corner, so the water thins toward the shore
// and badwater blends into clean water), and flags for the foam: which sides of a top meet the
// shore, and which take a fall from higher water.

import { CHUNK } from "./mesh";
import type { SurfaceWater, WaterView } from "./model";

/** Foam flags of a water top: bits 0–3 the sides (east, west, north, south) where it meets the
 *  shore, bits 4–7 the sides where a fall comes down into it. A curtain's flags are its drop
 *  (`dropFlags`): the taller the fall, the more white water; the map's edge has none. */
export const SHORE_BITS = [1, 2, 4, 8] as const;
export const FALL_IN_BITS = [16, 32, 64, 128] as const;

export interface WaterMeshData {
  positions: Float32Array;
  /** depth, contamination per vertex. */
  data: Float32Array;
  /** Foam flags per vertex (SHORE_BITS, FALL_IN_BITS). */
  flags: Float32Array;
  /** Axis normal per vertex. */
  normals: Int8Array;
  indices: Uint32Array;
  quads: number;
}

class WaterBuffer {
  pos: number[] = [];
  data: number[] = [];
  nrm: number[] = [];
  flg: number[] = [];
  quads = 0;
  quad(c: number[], depth: number, cont: number, nx: number, ny: number, nz: number, flags = 0): void {
    this.quad4(c, [depth, depth, depth, depth], [cont, cont, cont, cont], nx, ny, nz, flags);
  }
  /** A quad with its own depth and badwater share at each corner. */
  quad4(c: number[], depth: readonly number[], cont: readonly number[], nx: number, ny: number, nz: number, flags = 0): void {
    for (let k = 0; k < 12; k++) this.pos.push(c[k]);
    for (let v = 0; v < 4; v++) {
      this.data.push(depth[v], cont[v]);
      this.nrm.push(nx * 127, ny * 127, nz * 127);
      this.flg.push(flags);
    }
    this.quads++;
  }
  finish(): WaterMeshData {
    const n = this.quads;
    const indices = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) {
      const v = q * 4;
      indices.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    return { positions: new Float32Array(this.pos), data: new Float32Array(this.data), flags: new Float32Array(this.flg), normals: new Int8Array(this.nrm), indices, quads: n };
  }
}

/** Lower than this below the surface, a neighbour gets a curtain. */
const STEP = 0.02;
/** Higher than this above the surface, a neighbour's water falls into a tile (foam there). */
const FALL = 0.3;

/** A curtain's flags: its drop in thirtieths of a level, to 254; 255 at the map's edge (the side
 *  of the water there, no fall). */
export const EDGE_CURTAIN = 255;
export function dropFlags(top: number, bottom: number, edge: boolean): number {
  return edge ? EDGE_CURTAIN : Math.min(254, Math.round((top - bottom) * 30));
}

export function meshWaterChunk(W: number, H: number, heights: Uint8Array, sw: SurfaceWater, view: WaterView, lowerByTile: Map<number, number[]> | null, cx: number, cy: number): WaterMeshData {
  const b = new WaterBuffer();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(W, x0 + CHUNK);
  const y1 = Math.min(H, y0 + CHUNK);
  /** A top's corner (tile-corner coordinates) shares the water of the tiles round it at its own
   *  level: their mean depth, dry ground counting as none (so the water thins toward the shore),
   *  and their mean badwater share (so badwater blends into clean water where they meet). */
  const corner = (cxx: number, cyy: number, s: number, d: number, c: number): [number, number] => {
    let dn = 0;
    let ds = 0;
    let cn = 0;
    let cs = 0;
    for (let yy = cyy - 1; yy <= cyy; yy++)
      for (let xx = cxx - 1; xx <= cxx; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        const ns = sw.surface[j];
        if (ns === ns) {
          if (Math.abs(ns - s) > 0.35) continue;
          dn++;
          ds += sw.depth[j];
          cn++;
          cs += sw.contamination[j];
        } else if (heights[j] >= s - 0.05) dn++;
      }
    return [dn ? ds / dn : d, cn ? cs / cn : c];
  };
  /** What stands at a neighbour: its water surface, else its ground; off the map, nothing. */
  const level = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= W || y >= H) return -Infinity;
    const i = y * W + x;
    const s = sw.surface[i];
    return s === s ? s : heights[i];
  };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      const s = sw.surface[i];
      if (s === s) {
        const d = sw.depth[i];
        const c = sw.contamination[i];
        const f = sw.floor[i];
        // foam: a side meets the shore where dry ground stands at the surface or above it, and
        // takes a fall where the neighbour's water stands well above it
        let flags = 0;
        for (let k = 0; k < 4; k++) {
          const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          const ns = sw.surface[j];
          if (ns === ns) {
            if (ns > s + FALL) flags |= FALL_IN_BITS[k];
          } else if (heights[j] >= s - 0.05) flags |= SHORE_BITS[k];
        }
        const k0 = corner(x, y, s, d, c);
        const k1 = corner(x + 1, y, s, d, c);
        const k2 = corner(x + 1, y + 1, s, d, c);
        const k3 = corner(x, y + 1, s, d, c);
        b.quad4([x, s, -y, x + 1, s, -y, x + 1, s, -(y + 1), x, s, -(y + 1)], [k0[0], k1[0], k2[0], k3[0]], [k0[1], k1[1], k2[1], k3[1]], 0, 1, 0, flags);
        // curtains toward lower neighbours: down to the ground (never below the floor), or, where
        // the water falls to lower water, all the way to it, in front of the cliff (a fall)
        const drop = (xx: number, yy: number): number => {
          const lv = level(xx, yy);
          if (!(lv < s - STEP)) return NaN;
          const inside = xx >= 0 && yy >= 0 && xx < W && yy < H;
          const wetBelow = inside && sw.surface[yy * W + xx] === sw.surface[yy * W + xx];
          return wetBelow ? lv : Math.max(lv, f);
        };
        const O = 0.015; // a fall stands just off the cliff's face
        const e = drop(x + 1, y);
        if (e === e) {
          const X = e < f ? x + 1 + O : x + 1;
          b.quad([X, e, -y, X, e, -(y + 1), X, s, -(y + 1), X, s, -y], d, c, 1, 0, 0, dropFlags(s, e, x + 1 >= W));
        }
        const wv = drop(x - 1, y);
        if (wv === wv) {
          const X = wv < f ? x - O : x;
          b.quad([X, wv, -(y + 1), X, wv, -y, X, s, -y, X, s, -(y + 1)], d, c, -1, 0, 0, dropFlags(s, wv, x === 0));
        }
        const n = drop(x, y + 1);
        if (n === n) {
          const Z = n < f ? -(y + 1) - O : -(y + 1);
          b.quad([x + 1, n, Z, x, n, Z, x, s, Z, x + 1, s, Z], d, c, 0, 0, -1, dropFlags(s, n, y + 1 >= H));
        }
        const so = drop(x, y - 1);
        if (so === so) {
          const Z = so < f ? -y + O : -y;
          b.quad([x, so, Z, x + 1, so, Z, x + 1, s, Z, x, s, Z], d, c, 0, 0, 1, dropFlags(s, so, y === 0));
        }
      }
      const lower = lowerByTile?.get(i);
      if (lower) {
        for (const k of lower) {
          const ls = view.floor[k] + view.depth[k];
          b.quad([x, ls, -y, x + 1, ls, -y, x + 1, ls, -(y + 1), x, ls, -(y + 1)], view.depth[k], view.contamination[k], 0, 1, 0);
        }
      }
    }
  }
  return b.finish();
}

/** Lower water columns (in caves) grouped by tile. */
export function lowerByTile(sw: SurfaceWater, view: WaterView): Map<number, number[]> | null {
  if (!sw.lower.length) return null;
  const m = new Map<number, number[]>();
  for (const k of sw.lower) {
    const i = view.tile[k];
    const list = m.get(i);
    if (list) list.push(k);
    else m.set(i, [k]);
  }
  return m;
}

/** Chunks whose water differs between two surface-water states (a curtain reads the neighbours,
 *  so a chunk is also dirty when a tile beside it changed). */
export function changedWaterChunks(W: number, H: number, a: SurfaceWater, b: SurfaceWater, aLower: number, bLower: number): Set<string> {
  const out = new Set<string>();
  const mark = (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      out.add(`${Math.floor(xx / CHUNK)},${Math.floor(yy / CHUNK)}`);
    }
  };
  if (aLower || bLower) {
    // caves: rare; remesh everything
    for (let cy = 0; cy * CHUNK < H; cy++) for (let cx = 0; cx * CHUNK < W; cx++) out.add(`${cx},${cy}`);
    return out;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const sa = a.surface[i];
      const sb = b.surface[i];
      const same = (sa !== sa && sb !== sb) || (sa === sb && a.contamination[i] === b.contamination[i] && a.depth[i] === b.depth[i]);
      if (!same) mark(x, y);
    }
  }
  return out;
}
