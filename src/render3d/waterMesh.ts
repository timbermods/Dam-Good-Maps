// Water surfaces (PLAN §14.2: "water surfaces as translucent quads at depth"), meshed per chunk
// like the terrain. Each wet tile gets a flat quad at its surface; where a neighbour's water or
// ground is lower, a curtain hangs from the surface down to it, so falls and steps read as falling
// water. Water in caves (below a tile's surface water) gets its top quad only. Each vertex carries
// the column's depth and badwater share, which the shader turns into colour and opacity.

import { CHUNK } from "./mesh";
import type { SurfaceWater, WaterView } from "./model";

export interface WaterMeshData {
  positions: Float32Array;
  /** depth, contamination per vertex. */
  data: Float32Array;
  /** Axis normal per vertex. */
  normals: Int8Array;
  indices: Uint32Array;
  quads: number;
}

class WaterBuffer {
  pos: number[] = [];
  data: number[] = [];
  nrm: number[] = [];
  quads = 0;
  quad(c: number[], depth: number, cont: number, nx: number, ny: number, nz: number): void {
    for (let k = 0; k < 12; k++) this.pos.push(c[k]);
    for (let v = 0; v < 4; v++) {
      this.data.push(depth, cont);
      this.nrm.push(nx * 127, ny * 127, nz * 127);
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
    return { positions: new Float32Array(this.pos), data: new Float32Array(this.data), normals: new Int8Array(this.nrm), indices, quads: n };
  }
}

/** Lower than this below the surface, a neighbour gets a curtain. */
const STEP = 0.02;

export function meshWaterChunk(W: number, H: number, heights: Uint8Array, sw: SurfaceWater, view: WaterView, lowerByTile: Map<number, number[]> | null, cx: number, cy: number): WaterMeshData {
  const b = new WaterBuffer();
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(W, x0 + CHUNK);
  const y1 = Math.min(H, y0 + CHUNK);
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
        b.quad([x, s, -y, x + 1, s, -y, x + 1, s, -(y + 1), x, s, -(y + 1)], d, c, 0, 1, 0);
        // curtains toward lower neighbours, from the surface down to them (never below the floor)
        const e = level(x + 1, y);
        if (e < s - STEP) {
          const lo = Math.max(e, f);
          b.quad([x + 1, lo, -y, x + 1, lo, -(y + 1), x + 1, s, -(y + 1), x + 1, s, -y], d, c, 1, 0, 0);
        }
        const wv = level(x - 1, y);
        if (wv < s - STEP) {
          const lo = Math.max(wv, f);
          b.quad([x, lo, -(y + 1), x, lo, -y, x, s, -y, x, s, -(y + 1)], d, c, -1, 0, 0);
        }
        const n = level(x, y + 1);
        if (n < s - STEP) {
          const lo = Math.max(n, f);
          b.quad([x + 1, lo, -(y + 1), x, lo, -(y + 1), x, s, -(y + 1), x + 1, s, -(y + 1)], d, c, 0, 0, -1);
        }
        const so = level(x, y - 1);
        if (so < s - STEP) {
          const lo = Math.max(so, f);
          b.quad([x, lo, -y, x + 1, lo, -y, x + 1, s, -y, x, s, -y], d, c, 0, 0, 1);
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
