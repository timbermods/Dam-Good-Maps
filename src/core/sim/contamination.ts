// Soil contamination at steady state (notes/water_and_soil.md Q5; port of prototype/watersim.py
// `contamination`). Only water with contamination ≥ 0.5 contaminates soil: 2·(c − 0.5) on and
// beside it, then −1/7 per tile (√2/7 diagonally) and −5/7 per level climbed, so pure badwater
// reaches about 7 tiles. A tile is contaminated when its value is above 0; plants die there.

import { MinHeap } from "../math/grid";

const SQRT2 = Math.SQRT2;

export function soilContamination(
  floor: Uint8Array,
  depth: Float64Array,
  contamination: Float64Array,
  W: number,
  H: number,
  barrier?: Uint8Array | null,
): Float64Array {
  const N = W * H;
  const V = new Float64Array(N);
  const bad = new Uint8Array(N);
  const surfCeil = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    bad[i] = depth[i] > 0 && contamination[i] >= 0.5 ? 1 : 0;
    surfCeil[i] = Math.ceil(floor[i] + depth[i] - 1e-9);
  }
  const heap = new MinHeap();
  // sources in index order (numpy's nonzero order), each seeding itself and its 4-neighbours
  for (let i = 0; i < N; i++) {
    if (!bad[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    const v0 = 2 * (contamination[i] - 0.5);
    if (v0 > V[i]) V[i] = v0;
    heap.push(-V[i], i);
    for (let k = 0; k < 4; k++) {
      const xx = k === 1 ? x - 1 : k === 3 ? x + 1 : x;
      const yy = k === 0 ? y - 1 : k === 2 ? y + 1 : y;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const j = yy * W + xx;
      if (bad[j]) continue;
      const v = v0 - (5 / 7) * Math.max(0, floor[j] - surfCeil[i]);
      if (v > V[j]) {
        V[j] = v;
        heap.push(-v, j);
      }
    }
  }
  while (heap.size > 0) {
    const i = heap.pop();
    const v0 = -heap.lastKey;
    if (v0 < V[i] - 1e-9) continue;
    const x = i % W;
    const y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const j = yy * W + xx;
        if (barrier && barrier[j]) continue;
        const v = v0 - (dx && dy ? SQRT2 : 1) / 7 - (5 / 7) * Math.max(0, floor[j] - floor[i]);
        if (v > V[j] + 1e-9) {
          V[j] = v;
          heap.push(-v, j);
        }
      }
    }
  }
  for (let i = 0; i < N; i++) if (V[i] < 0.001) V[i] = 0;
  return V;
}
