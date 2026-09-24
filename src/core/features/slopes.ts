// Derived slopes (PLAN §7.5, build step 8). Beavers cannot cross even a 1-level step without a
// Slope, and player stairs cost 70 science. Grow a tree of same-level regions from the start's
// region; for every neighbouring region one level up or down within `radius`, place one Slope on
// the boundary pair nearest the start (two on long boundaries). A slope stands on the low tile, its
// high side toward the higher neighbour; the tile behind its low side must be at the same level.

import { levelRegions } from "../math/grid";
import type { Orientation } from "../format/footprints";

export interface PlacedSlope {
  x: number;
  y: number;
  z: number;
  orientation: Orientation;
}

// high side (dx, dy) -> orientation: Cw0 south, Cw90 west, Cw180 north, Cw270 east
function orientationFor(dx: number, dy: number): Orientation {
  if (dx === 0 && dy === -1) return "Cw0";
  if (dx === -1 && dy === 0) return "Cw90";
  if (dx === 0 && dy === 1) return "Cw180";
  return "Cw270";
}

export function placeSlopes(
  h: Uint8Array,
  W: number,
  H: number,
  start: { x: number; y: number },
  occupied: Uint8Array,
  radius: number,
): PlacedSlope[] {
  const { labels } = levelRegions(h, W, H);
  // boundary pairs between regions one level apart: key "low,high" -> [lowTile, dx, dy][]
  const pairs = new Map<string, [number, number, number][]>();
  const adj = new Map<number, Set<number>>();
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (const [dx, dy] of dirs) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const j = yy * W + xx;
        if (h[j] !== h[i] + 1) continue;
        const a = labels[i];
        const b = labels[j];
        const key = `${a},${b}`;
        let list = pairs.get(key);
        if (!list) pairs.set(key, (list = []));
        list.push([i, dx, dy]);
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
  }
  const root = labels[start.y * W + start.x];
  const seen = new Set<number>([root]);
  let frontier = [root];
  const placed: PlacedSlope[] = [];
  const used: [number, number][] = [];
  const occ = occupied.slice();

  const tryPlace = (cand: [number, number, number][], extra: boolean): number => {
    const scored = cand
      .map((c) => {
        const x = c[0] % W;
        const y = (c[0] - x) / W;
        return { c, x, y, d2: (x - start.x) ** 2 + (y - start.y) ** 2 };
      })
      .sort((p, q) => p.d2 - q.d2 || p.c[0] - q.c[0] || p.c[1] - q.c[1] || p.c[2] - q.c[2]);
    let n = 0;
    for (const { c, x, y } of scored) {
      const [i, dx, dy] = c;
      const lx = x - dx;
      const ly = y - dy;
      if (lx < 0 || lx >= W || ly < 0 || ly >= H) continue;
      const li = ly * W + lx;
      if (occ[i] || occ[li] || h[li] !== h[i]) continue;
      if (used.some(([ux, uy]) => Math.abs(x - ux) + Math.abs(y - uy) < 12)) continue;
      placed.push({ x, y, z: h[i], orientation: orientationFor(dx, dy) });
      occ[i] = 1;
      used.push([x, y]);
      n++;
      if (n >= (extra ? 2 : 1)) break;
    }
    return n;
  };

  while (frontier.length) {
    const next: number[] = [];
    for (const r of frontier) {
      const neighbours = [...(adj.get(r) ?? [])].sort((a, b) => a - b);
      for (const n of neighbours) {
        if (seen.has(n)) continue;
        const cand = [...(pairs.get(`${r},${n}`) ?? []), ...(pairs.get(`${n},${r}`) ?? [])].filter(([i]) => {
          const x = i % W;
          const y = (i - x) / W;
          return Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) <= radius;
        });
        if (tryPlace(cand, cand.length > 60)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return placed;
}
