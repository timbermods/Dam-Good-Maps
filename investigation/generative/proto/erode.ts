// Drainage and erosion on a height field (floats or levels): Barnes' priority flood from the map
// edge gives every tile its spill level and a receiver (the tile the flood reached it from), so
// water on any tile has a path to an edge; stream-power incision then cuts valleys where much
// water gathers, and a little diffusion softens the slopes. Exact arithmetic only (sqrt for the
// stream power's A^0.5); the heap breaks ties by tile index, so every run agrees.

import { MinHeap } from "../../../src/core/math/grid";

const D8: readonly [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export interface Drainage {
  /** The filled surface: every tile at least its spill level. */
  filled: Float64Array;
  /** The receiver of each tile (-1 for an outlet on the edge). */
  rcv: Int32Array;
  /** Tiles in the order the flood reached them (outlets first). */
  order: Int32Array;
  /** Tiles draining through each tile, itself included. */
  area: Float64Array;
}

/**
 * The priority flood. `outlet(i)` says which border tiles drain (default: all of them); `blocked`
 * tiles are never entered (walls the water cannot cross). With `eight`, water moves to all eight
 * neighbours, else only side to side (the game's water).
 */
export function drainage(h: ArrayLike<number>, W: number, H: number, opts: { outlet?: (i: number) => boolean; eight?: boolean; epsilon?: number } = {}): Drainage {
  const N = W * H;
  const filled = new Float64Array(N);
  const rcv = new Int32Array(N).fill(-2);
  const order = new Int32Array(N);
  const heap = new MinHeap();
  const eps = opts.epsilon ?? 0;
  const nb = opts.eight === false ? D8.slice(0, 4) : D8;
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i - x) / W;
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && (!opts.outlet || opts.outlet(i))) {
      rcv[i] = -1;
      filled[i] = h[i];
      heap.push(h[i], i);
    }
  }
  let n = 0;
  while (heap.size) {
    const c = heap.pop();
    const lv = heap.lastKey;
    if (lv > filled[c]) continue;
    order[n++] = c;
    const x = c % W;
    const y = (c - x) / W;
    for (const [dx, dy] of nb) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (rcv[j] !== -2) continue;
      rcv[j] = c;
      const f = h[j] > lv + eps ? h[j] : lv + eps;
      filled[j] = f;
      heap.push(f, j);
    }
  }
  const area = new Float64Array(N).fill(1);
  for (let k = n - 1; k >= 0; k--) {
    const i = order[k];
    const r = rcv[i];
    if (r >= 0) area[r] += area[i];
  }
  return { filled, rcv, order: n === N ? order : order.slice(0, n), area };
}

/** Stream-power incision (implicit, Braun and Willett 2013, m = 0.5, n = 1) and diffusion. */
export function erode(U: Float64Array, W: number, H: number, iterations: number, k: number, diffusion: number): Float64Array {
  const h = U.slice();
  const N = W * H;
  const tmp = new Float64Array(N);
  for (let it = 0; it < iterations; it++) {
    const d = drainage(h, W, H, { epsilon: 1e-6 });
    for (let q = 0; q < d.order.length; q++) {
      const i = d.order[q];
      const r = d.rcv[i];
      if (r < 0) continue;
      if (!(h[i] > h[r])) continue;
      const dx = (i % W) - (r % W);
      const dy = Math.floor(i / W) - Math.floor(r / W);
      const len = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const F = (k * Math.sqrt(d.area[i])) / len;
      h[i] = (h[i] + F * h[r]) / (1 + F);
    }
    if (diffusion > 0) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const a = x > 0 ? h[i - 1] : h[i];
          const b = x + 1 < W ? h[i + 1] : h[i];
          const c = y > 0 ? h[i - W] : h[i];
          const e = y + 1 < H ? h[i + W] : h[i];
          tmp[i] = h[i] + diffusion * ((a + b + c + e) / 4 - h[i]);
        }
      h.set(tmp);
    }
  }
  return h;
}
