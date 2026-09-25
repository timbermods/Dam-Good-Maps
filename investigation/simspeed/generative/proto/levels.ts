// Snapping the eroded field to the game's terrain levels (0–16, D4). The field is stretched so its
// p2–p98 spread covers the genome's relief above its base; contour edges wobble a little so
// terraces follow the ground, not straight lines; in the terraced share of the map levels are
// grouped into benches `step` levels high (cliffs), elsewhere every level is its own step. Tiny
// level regions are merged into their neighbours, and single-tile pits and spikes go, as the build's
// integrity pass would remove them.

import { hash32 } from "../../../../src/core/math/hash";
import { fbm } from "../../../../src/core/math/noise";
import { levelRegions, MinHeap } from "../../../../src/core/math/grid";
import type { Genome } from "./genome";
import { clamp, smoothstep } from "./num";

export const MAX_LEVEL = 16;

function percentile(v: Float64Array, p: number): number {
  const s = Array.from(v).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

export function snapLevels(field: Float64Array, g: Genome, seed: number, W: number, H: number): Uint8Array {
  const N = W * H;
  const lo = percentile(field, 0.02);
  const hi = percentile(field, 0.98);
  const span = Math.max(1e-6, hi - lo);
  const top = Math.min(MAX_LEVEL - 0.6, g.base + g.relief);
  const js = hash32(seed, "contour-jitter");
  const ts = hash32(seed, "terrace-mask");
  const out = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = (field[i] - lo) / span;
      let L = g.base + t * (top - g.base) + g.terrace.jitter * fbm(js, x, y, 7, 2);
      // a soft cap two levels below the editor's limit: ground above it bends toward 16 instead of
      // being cut flat there (cut tops made flat walls where a river crossed them)
      if (L > MAX_LEVEL - 2) {
        const over = L - (MAX_LEVEL - 2);
        L = MAX_LEVEL - 2 + (2 * over) / (over + 2);
      }
      let lv = Math.round(L);
      if (g.terrace.step > 1 && g.terrace.share > 0) {
        // benches in part of the map: a noise mask covering about `share` of it
        const m = smoothstep((fbm(ts, x, y, g.terrace.cell, 2) + 1) / 2 - (1 - g.terrace.share) + 0.5);
        if (m > 0.5) {
          const st = g.terrace.step;
          L = Math.floor(L / st + 0.5) * st;
          lv = Math.round(L);
        }
      }
      out[i] = clamp(lv, 1, MAX_LEVEL);
    }
  }
  mergeSmallRegions(out, W, H, 6);
  cleanPitsAndSpikes(out, W, H, null);
  return out;
}

/** Level regions smaller than `min` tiles take the most common level round them. */
export function mergeSmallRegions(h: Uint8Array, W: number, H: number, min: number, keep: Uint8Array | null = null): void {
  for (let pass = 0; pass < 3; pass++) {
    const { labels, size } = levelRegions(h, W, H);
    let changed = false;
    const votes = new Map<number, Map<number, number>>();
    for (let i = 0; i < W * H; i++) {
      if (size[labels[i]] >= min || keep?.[i]) continue;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (labels[j] === labels[i]) continue;
        const m = votes.get(labels[i]) ?? votes.set(labels[i], new Map()).get(labels[i])!;
        m.set(h[j], (m.get(h[j]) ?? 0) + 1);
      }
    }
    const to = new Map<number, number>();
    for (const [lab, m] of votes) {
      let best = -1;
      let bn = -1;
      for (const [lv, n] of [...m].sort((a, b) => a[0] - b[0])) if (n > bn) {
        bn = n;
        best = lv;
      }
      if (best >= 0) to.set(lab, best);
    }
    for (let i = 0; i < W * H; i++) {
      const v = to.get(labels[i]);
      if (v !== undefined && !keep?.[i]) {
        h[i] = v;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/** The build's integrity rule (raster/terrain.ts `integrityAt`): a tile lower than all four
 *  neighbours rises to the lowest, one higher than all four falls to the highest. */
export function cleanPitsAndSpikes(h: Uint8Array, W: number, H: number, keep: Uint8Array | null): number {
  let changed = 0;
  for (let pass = 0; pass < 4; pass++) {
    const src = h.slice();
    let n = 0;
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (keep?.[i]) continue;
        const a = src[i - 1];
        const b = src[i + 1];
        const c = src[i - W];
        const d = src[i + W];
        const lo = Math.min(a, b, c, d);
        const hi = Math.max(a, b, c, d);
        if (src[i] < lo) {
          h[i] = lo;
          n++;
        } else if (src[i] > hi) {
          h[i] = hi;
          n++;
        }
      }
    changed += n;
    if (!n) break;
  }
  return changed;
}

/** Fill every closed hollow that holds no planned water (`keep`), up to its spill level: a dry hollow
 *  below a source is pre-filled by the canonical settle and then only evaporates, so the water would
 *  never settle (water.settles). Open valleys stay: a dam across one is still a reservoir. Returns the
 *  number of tiles raised. */
export function fillDryHollows(h: Uint8Array, W: number, H: number, keep: Uint8Array): number {
  const N = W * H;
  // priority flood from the edge through the kept water too (it drains through its outlet)
  const filled = new Int16Array(N).fill(-1);
  const heap = new MinHeap();
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
      filled[i] = h[i];
      heap.push(h[i], i);
    }
  }
  while (heap.size) {
    const c = heap.pop();
    const lv = heap.lastKey;
    const x = c % W;
    const y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (filled[j] >= 0) continue;
      filled[j] = h[j] > lv ? h[j] : lv;
      heap.push(filled[j], j);
    }
  }
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (keep[i] || filled[i] <= h[i]) continue;
    h[i] = filled[i];
    n++;
  }
  return n;
}
