// Outflow channels: the way a set piece's or a lake's water leaves (PLAN §9.2 standalone falls,
// §9.5 badwater outlets, lakes by outlet sill). A route is planned once on the current map, from the
// piece's own tiles to where water drains (a map edge, a river's channel or a lake), and stored in
// the feature; rebuilds carve the stored route and never plan it again (PLAN §19.3).
//
// The carve: every route tile gets a channel of `width` tiles across (a square of side `width`
// around it, width 1, 3 or 5), at a bed level that never rises along the route, and the tiles
// around the channel are raised to one level above the bed where they are lower (banks), so the
// water stays in it. A bed that follows the ground down where the ground falls, and cuts through it
// where it rises, drains whatever the terrain.

import { MinHeap } from "../math/grid";
import { polygonMask } from "./geometry";
import type { BuildTarget } from "./target";
import type { Feature } from "./schema";

export interface ChannelPlan {
  /** Route tiles from the first tile outside the piece to the outlet, as x0, y0, x1, y1, … */
  tiles: number[];
  /** Bed level per route tile, never rising along the route. */
  levels: number[];
  /** Channel width in tiles: 1, 3 or 5. */
  width: number;
  /** Where the water goes: "edge", or the id of the river or lake it joins. */
  to: string;
}

export interface RouteInput {
  W: number;
  H: number;
  heights: Uint8Array;
  features: readonly Feature[];
  /** River channel tiles of the current map (the built map's `channel`), when known. */
  channel?: Uint8Array | null;
  /** Tiles taken by objects: the route prefers to go round them. */
  occupied?: Uint8Array | null;
}

/** The channel width that carries `flow` blocks per second well inside banks one level high
 *  (about 0.3·S/w deep, PLAN §9.2): 1 tile up to 1, 3 tiles up to 4, 5 beyond. */
export function channelWidth(flow: number): number {
  return flow <= 1 ? 1 : flow <= 4 ? 3 : 5;
}

/** Plan a route from `from` (tile indices the water leaves from, at bed level `level`) to where it
 *  drains. `blocked` tiles are never entered (the piece's own body, the start's zone, locks).
 *  `skip` names the feature being planned, so it never drains into itself. Null when no route
 *  exists. */
export function routeChannel(inp: RouteInput, from: readonly number[], level: number, width: number, blocked: Uint8Array, skip: string | null): ChannelPlan | null {
  const { W, H, heights: h } = inp;
  const N = W * H;
  const r = (width - 1) >> 1;
  // goals: the map border, river channel tiles at or below the level, and lake basins whose water
  // stands at or below it
  const goal = new Int32Array(N).fill(-1); // -1 none, -2 edge, else index into goalIds
  const goalIds: string[] = [];
  for (let x = 0; x < W; x++) {
    goal[x] = -2;
    goal[(H - 1) * W + x] = -2;
  }
  for (let y = 0; y < H; y++) {
    goal[y * W] = -2;
    goal[y * W + W - 1] = -2;
  }
  for (const f of inp.features) {
    if (f.id === skip) continue;
    if (f.kind === "lake" && !f.params.planned && f.params.outlet.sill <= level) {
      const m = polygonMask(f.params.outline, W, H);
      const k = goalIds.push(f.id) - 1;
      for (let i = 0; i < N; i++) if (m[i] && goal[i] === -1) goal[i] = k;
    }
  }
  if (inp.channel) {
    for (const f of inp.features) {
      if (f.id === skip || f.kind !== "river") continue;
      const k = goalIds.push(f.id) - 1;
      // the channel tiles of this river: the built channel mask under its path's corridor
      const path = f.params.path;
      let x0 = W;
      let y0 = H;
      let x1 = -1;
      let y1 = -1;
      for (const [px, py] of path) {
        x0 = Math.min(x0, Math.floor(px) - 10);
        y0 = Math.min(y0, Math.floor(py) - 10);
        x1 = Math.max(x1, Math.ceil(px) + 10);
        y1 = Math.max(y1, Math.ceil(py) + 10);
      }
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          const i = y * W + x;
          if (inp.channel[i] && h[i] <= level && goal[i] === -1 && nearPath(path, x, y, f.params.width / 2 + 0.5)) goal[i] = k;
        }
    }
  }
  const start = new Uint8Array(N);
  for (const i of from) start[i] = 1;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const heap = new MinHeap();
  // the route begins at the tiles next to the piece
  for (const i of from) {
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (start[n] || blocked[n]) continue;
      const c = stepCost(inp, n, level);
      if (c < dist[n]) {
        dist[n] = c;
        prev[n] = -1;
        heap.push(c, n);
      }
    }
  }
  const done = new Uint8Array(N);
  let end = -1;
  while (heap.size > 0) {
    const c = heap.pop();
    if (done[c]) continue;
    done[c] = 1;
    if (goal[c] !== -1 && fits(W, H, c, r, blocked)) {
      end = c;
      break;
    }
    const x = c % W;
    const y = (c - x) / W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (done[n] || start[n] || blocked[n]) continue;
      const d = dist[c] + stepCost(inp, n, level);
      if (d < dist[n]) {
        dist[n] = d;
        prev[n] = c;
        heap.push(d, n);
      }
    }
  }
  if (end < 0) return null;
  const path: number[] = [];
  for (let c = end; c >= 0; c = prev[c]) path.push(c);
  path.reverse();
  // bed levels: never rising, and one level under the lowest ground beside the channel where the
  // ground falls below the level
  const tiles: number[] = [];
  const levels: number[] = [];
  let lv = level;
  for (const c of path) {
    const x = c % W;
    const y = (c - x) / W;
    let g = Infinity;
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (start[n] || goal[n] >= 0) continue;
        if (h[n] < g) g = h[n];
      }
    if (g !== Infinity && g - 1 < lv) lv = Math.max(0, g - 1);
    tiles.push(x, y);
    levels.push(lv);
  }
  const k = goal[end];
  return { tiles, levels, width, to: k === -2 ? "edge" : goalIds[k] };
}

const DIRS: readonly [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Moving onto tile i: one per tile, plus the levels the channel cuts through. */
function stepCost(inp: RouteInput, i: number, level: number): number {
  const cut = inp.heights[i] - level;
  return 1 + (cut > 0 ? 3 * cut : 0) + (inp.occupied?.[i] ? 0.5 : 0);
}

/** Whether the channel's square around tile c stays clear of blocked tiles. */
function fits(W: number, H: number, c: number, r: number, blocked: Uint8Array): boolean {
  if (r === 0) return true;
  const x = c % W;
  const y = (c - x) / W;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && blocked[ny * W + nx]) return false;
    }
  return true;
}

function nearPath(path: readonly [number, number][], x: number, y: number, d: number): boolean {
  const d2 = d * d;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, ay] = path[i];
    const vx = path[i + 1][0] - ax;
    const vy = path[i + 1][1] - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = ax + t * vx - x;
    const py = ay + t * vy - y;
    if (px * px + py * py < d2) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------ carving

/** The tiles a carved channel writes: channel tiles with their bed, and bank tiles with the level
 *  they are raised to (at least). Computed from the plan alone, so every rebuild agrees. */
export function channelTiles(c: ChannelPlan, W: number, H: number): { bed: Map<number, number>; bank: Map<number, number> } {
  const r = (c.width - 1) >> 1;
  const bed = new Map<number, number>();
  const bank = new Map<number, number>();
  const n = c.levels.length;
  for (let k = 0; k < n; k++) {
    const x = c.tiles[2 * k];
    const y = c.tiles[2 * k + 1];
    const lv = c.levels[k];
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = ny * W + nx;
        if (Math.abs(dx) <= r && Math.abs(dy) <= r) {
          const b = bed.get(i);
          if (b === undefined || lv < b) bed.set(i, lv);
        } else {
          const b = bank.get(i);
          if (b === undefined || lv + 1 > b) bank.set(i, lv + 1);
        }
      }
  }
  for (const i of bed.keys()) bank.delete(i);
  return { bed, bank };
}

/** Carve a stored channel into the target: beds exactly, banks raised where lower. Tiles in `keep`
 *  (the piece's own body, written after) and the last route tile's goal water are left to their
 *  owners. */
export function carveChannel(c: ChannelPlan, t: BuildTarget, f: Feature, keep?: (i: number) => boolean): void {
  const { bed, bank } = channelTiles(c, t.W, t.H);
  const h = t.heights;
  for (const [i, lv] of bed) {
    if (!t.inRegion(i) || !t.writable(i, f) || keep?.(i)) continue;
    // the channel never fills a river's or lake's water it drains into
    if (t.channel[i] && h[i] <= lv) continue;
    h[i] = lv;
    t.protect(i);
  }
  for (const [i, lv] of bank) {
    if (!t.inRegion(i) || !t.writable(i, f) || keep?.(i) || t.channel[i]) continue;
    if (h[i] < lv) h[i] = lv;
  }
}

/** The bounding rectangle of a stored channel, with its banks. */
export function channelBounds(c: ChannelPlan): { x0: number; y0: number; x1: number; y1: number } | null {
  const n = c.levels.length;
  if (!n) return null;
  const r = ((c.width - 1) >> 1) + 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let k = 0; k < n; k++) {
    const x = c.tiles[2 * k];
    const y = c.tiles[2 * k + 1];
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  }
  return { x0, y0, x1, y1 };
}

/** Problems of a stored channel: on the map, levels 0–16 and never rising, width 1, 3 or 5. */
export function checkChannel(c: ChannelPlan, W: number, H: number): string[] {
  if (!Array.isArray(c.tiles) || !Array.isArray(c.levels) || c.tiles.length !== 2 * c.levels.length || c.levels.length === 0) return ["the outflow channel is malformed"];
  if (![1, 3, 5].includes(c.width)) return ["the outflow channel is 1, 3 or 5 tiles wide"];
  for (let k = 0; k < c.levels.length; k++) {
    const x = c.tiles[2 * k];
    const y = c.tiles[2 * k + 1];
    if (!Number.isInteger(x) || !Number.isInteger(y) || !(x >= 0 && y >= 0 && x < W && y < H)) return ["the outflow channel leaves the map"];
    const lv = c.levels[k];
    if (!Number.isInteger(lv) || lv < 0 || lv > 16) return ["the outflow channel's levels are 0–16"];
    if (k > 0 && lv > c.levels[k - 1]) return ["the outflow channel's bed rises: water would not drain"];
    if (k > 0 && Math.abs(x - c.tiles[2 * k - 2]) + Math.abs(y - c.tiles[2 * k - 1]) !== 1) return ["the outflow channel's tiles must join side to side"];
  }
  return [];
}
