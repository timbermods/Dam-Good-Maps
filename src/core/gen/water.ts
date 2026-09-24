// Water a theme adds on its built ground (PLAN §5.3, §5.4, §9.5): ponds for the Lakes and basins
// setting, and badwater basins for the Badwater settings. Both are planned by the shared planners
// the editor uses (a lake by its basin, the badwater basin builder), on the layout's terrain, so a
// generated pond or basin is the same feature a player draws.

import { buildTerrain } from "../features/build";
import { featureId } from "../features/ids";
import { bedAt, pathField, pointAtArc, polygonMask, round } from "../features/geometry";
import { channelTiles } from "../features/route";
import { planSetPiece, type PlanContext } from "../features/setpieces";
import type { Feature, LakeFeature, Point, RiverFeature, SetPieceFeature } from "../features/schema";
import { planLake } from "../doc/tools";
import { cosDet, PI, sinDet } from "../math/detmath";
import { distanceFrom } from "../math/grid";
import type { Rng } from "../math/rng";
import type { LayoutTargets } from "./layout";

/** The ground a planner places on: the terrain of its layout so far. */
export interface PlanGround {
  W: number;
  H: number;
  seed: number;
  heights: Uint8Array;
  channel: Uint8Array;
  protect: Uint8Array;
}

export function groundOf(W: number, H: number, seed: number, features: readonly Feature[]): PlanGround {
  const t = buildTerrain({ W, H, seed, features });
  return { W, H, seed, ...t };
}

/** A pond's spring: enough to keep 20–60 tiles full against evaporation, and its outlet flowing. */
export const POND_SPRING = 0.25;

/** A roughly elliptical outline of `n` points round (cx, cy). */
function blobOutline(rng: Rng, cx: number, cy: number, rx: number, ry: number, n = 12): Point[] {
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    // a regular polygon's corners from a rotated unit step (no trigonometry on output paths)
    const a = (k / n) * 2;
    const [ux, uy] = unitAt(a);
    const j = rng.range(0.85, 1.15);
    out.push([round(cx + rx * j * ux, 2), round(cy + ry * j * uy, 2)]);
  }
  return out;
}

/** (cos, sin) of a·π, from the deterministic sine (PLAN §2.1). */
function unitAt(a: number): [number, number] {
  return [cosDet(a * PI), sinDet(a * PI)];
}

/** Riverside ponds (natural basins of 20+ tiles, PLAN §5.3): each dug into the floodplain beside a
 *  river, its floor `floorDepth` below the river's bed, and joined to the river by a short cut at the
 *  bed's level. The river keeps it full (no spring), its water stands at the river's level, and it
 *  keeps its water below the bed through a drought: natural storage near the start. */
export function placeRiversidePonds(opts: {
  rng: Rng;
  ground: PlanGround;
  rivers: readonly RiverFeature[];
  count: number;
  /** Tiles no pond may touch (the start's zone, set pieces, a reservoir basin). */
  avoid: Uint8Array;
  /** Some ponds within this distance of this tile first (the drought reserve's natural storage). */
  near?: { x: number; y: number; count: number };
  floorDepth: number;
  /** The lowest river bed a pond may join: the reaches below take in badwater (the canonical
   *  pre-fill spreads it along a flat reach into a pond, which no flow ever flushes). */
  minSill?: number;
  idOf: (k: number) => { id: string; role: string };
}): LakeFeature[] {
  const { rng, ground: g } = opts;
  const { W, H } = g;
  const out: LakeFeature[] = [];
  if (opts.count <= 0 || !opts.rivers.length) return out;
  const avoid = opts.avoid.slice();
  const lengths = opts.rivers.map((r) => pathLength(r.params.path));
  for (let k = 0; k < opts.count; k++) {
    const wantNear = opts.near && k < opts.near.count;
    let placed: LakeFeature | null = null;
    for (let tries = 0; tries < 80 && !placed; tries++) {
      const ri = rng.weighted(lengths);
      const r = opts.rivers[ri];
      const len = lengths[ri];
      const s = rng.range(6, Math.max(7, len - 6));
      const side = rng.float() < 0.5 ? 1 : -1;
      const rx = rng.range(2.7, 4.2);
      const ry = rng.range(2.7, 4.2);
      const gap = rng.range(2, 5);
      const jitter = rng.float();
      // the bed is flat 8 tiles either side (no step, no plunge gorge beside the pond)
      const bed = bedAt(r.params.bedProfile, s);
      if (r.params.bedProfile.steps.some((st) => Math.abs(st.at - s) < 10)) continue;
      if (opts.minSill !== undefined && bed < opts.minSill) continue;
      const { p, normal } = pointAtArc(r.params.path, s);
      const half = r.params.width / 2;
      const off = half + gap + ry;
      const cx = p[0] + side * normal[0] * off;
      const cy = p[1] + side * normal[1] * off;
      if (wantNear) {
        const dx = cx - opts.near!.x;
        const dy = cy - opts.near!.y;
        if (dx * dx + dy * dy > 30 * 30) continue;
      }
      const outline = blobOutline(rng, cx, cy, rx, ry);
      const mask = polygonMask(outline, W, H);
      // the pond and a ring of 2 round it lie on the river's floodplain, off the channel
      let tiles = 0;
      let ok = true;
      const x0 = Math.floor(cx - rx * 1.15 - 3);
      const x1 = Math.ceil(cx + rx * 1.15 + 3);
      const y0 = Math.floor(cy - ry * 1.15 - 3);
      const y1 = Math.ceil(cy + ry * 1.15 + 3);
      if (x0 < 3 || y0 < 3 || x1 > W - 4 || y1 > H - 4) continue;
      for (let y = y0; y <= y1 && ok; y++)
        for (let x = x0; x <= x1 && ok; x++) {
          const i = y * W + x;
          let nearMask = false;
          for (let dy = -2; dy <= 2 && !nearMask; dy++) for (let dx = -2; dx <= 2 && !nearMask; dx++) if (mask[(y + dy) * W + x + dx]) nearMask = true;
          if (!nearMask) continue;
          if (avoid[i] || g.channel[i] || g.protect[i] || g.heights[i] !== bed + 1) ok = false;
          if (mask[i]) tiles++;
        }
      if (!ok || tiles < 24) continue;
      // the cut: from the pond's edge straight toward the river, side to side, to the channel
      const cut: number[] = [];
      let x = Math.round(cx);
      let y = Math.round(cy);
      const tx = p[0];
      const ty = p[1];
      let guard = 0;
      while (!g.channel[y * W + x] && guard++ < 40) {
        const ddx = tx - x;
        const ddy = ty - y;
        if (Math.abs(ddx) > Math.abs(ddy) || (Math.abs(ddx) === Math.abs(ddy) && jitter < 0.5)) x += Math.sign(ddx);
        else y += Math.sign(ddy);
        if (!mask[y * W + x]) cut.push(x, y);
      }
      if (!g.channel[y * W + x] || cut.length < 4) continue;
      const levels = cut.map(() => bed).slice(0, cut.length / 2);
      const { id, role } = opts.idOf(k);
      const lake: LakeFeature = {
        id,
        kind: "lake",
        origin: "generated",
        role,
        locked: false,
        params: {
          outline,
          floorDepth: opts.floorDepth,
          outlet: { at: [cut[0], cut[1]], sill: bed, to: "river", target: r.id, path: cut, levels, width: 1 },
          inflow: { rivers: [r.id] },
          planned: false,
        },
      };
      for (let yy = y0 - 3; yy <= y1 + 3; yy++) for (let xx = x0 - 3; xx <= x1 + 3; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) avoid[yy * W + xx] = 1;
      placed = lake;
    }
    if (placed) out.push(placed);
  }
  return out;
}

function pathLength(path: readonly Point[]): number {
  let l = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const dx = path[k + 1][0] - path[k][0];
    const dy = path[k + 1][1] - path[k][1];
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

/** Ponds (natural basins of 20+ tiles, PLAN §5.3): each a lake of its own dug into ground that is
 *  nearly flat, with a spring and an outlet to a river or the map edge, kept off the start, the
 *  rivers, the set pieces and each other. `near` asks some of them within 40 tiles of the start
 *  (the drought reserve's natural storage). */
export function placePonds(opts: {
  rng: Rng;
  ground: PlanGround;
  features: readonly Feature[];
  count: number;
  /** Tiles no pond or outlet may touch (the start's zone, set pieces, a reservoir basin). */
  avoid: Uint8Array;
  start: { x: number; y: number; radius: number } | null;
  near?: number;
  floorDepth?: number;
  idOf: (k: number) => { id: string; role: string };
}): LakeFeature[] {
  const { rng, ground: g, count } = opts;
  const { W, H } = g;
  const N = W * H;
  const out: LakeFeature[] = [];
  if (count <= 0) return out;
  const avoid = opts.avoid.slice();
  for (let i = 0; i < N; i++) if (g.channel[i]) avoid[i] = 1;
  const protect = g.protect.slice();
  const channelNear = distanceFrom(g.channel, W, H);
  const riverLevel = nearestLevel(g.channel, g.heights, W, H);
  const startD = opts.start ? distanceFrom(pointMask(W, H, opts.start.x, opts.start.y), W, H) : null;
  for (let k = 0; k < count; k++) {
    const wantNear = (opts.near ?? 0) > k && startD !== null;
    let placed: LakeFeature | null = null;
    for (let tries = 0; tries < 40 && !placed; tries++) {
      const rx = rng.range(2.8, 4.4);
      const ry = rng.range(2.8, 4.4);
      const m = Math.ceil(Math.max(rx, ry) * 1.15) + 3;
      const cx = rng.range(m + 2, W - m - 3);
      const cy = rng.range(m + 2, H - m - 3);
      const ci = Math.round(cy) * W + Math.round(cx);
      if (wantNear && startD![ci] > 34) continue;
      if (channelNear[ci] < m + 2) continue;
      const outline = blobOutline(rng, cx, cy, rx, ry);
      const mask = polygonMask(outline, W, H);
      let tiles = 0;
      let lo = 99;
      let hi = -1;
      let ok = true;
      for (let y = Math.floor(cy - m); y <= Math.ceil(cy + m) && ok; y++)
        for (let x = Math.floor(cx - m); x <= Math.ceil(cx + m) && ok; x++) {
          const i = y * W + x;
          if (avoid[i]) ok = false;
          if (!mask[i]) continue;
          tiles++;
          lo = Math.min(lo, g.heights[i]);
          hi = Math.max(hi, g.heights[i]);
        }
      // a pond stands 3+ levels above the river it drains to, so its outlet falls into the river
      // and the river's water never backs up into it (a pond held at the river's level sloshes with
      // it and the water takes days to settle)
      if (!ok || tiles < 22 || hi - lo > 1 || lo < 3 || lo < riverLevel[ci] + 3) continue;
      const ctx: PlanContext = { W, H, seed: g.seed, features: opts.features, heights: g.heights, channel: g.channel, start: opts.start, protect, locked: null };
      const { id, role } = opts.idOf(k);
      const r = planLake({ outline, floorDepth: opts.floorDepth ?? 2, spring: POND_SPRING }, ctx, id, "generated");
      if (!r.ok || r.feature.kind !== "lake") continue;
      const lake = { ...r.feature, role } as LakeFeature;
      // a long flat outlet carries the thin stream of a pond as a sheet that takes days to settle:
      // keep the ponds whose outlet falls away within a few tiles at a time
      if (flatRun(lake.params.outlet.levels ?? []) > MAX_FLAT_OUTLET) continue;
      // the pond, its rim and its outlet channel are taken
      const bed = lake.params.outlet.path ? channelTiles({ tiles: lake.params.outlet.path, levels: lake.params.outlet.levels!, width: lake.params.outlet.width!, to: "" }, W, H) : null;
      for (let y = Math.floor(cy - m - 3); y <= Math.ceil(cy + m + 3); y++)
        for (let x = Math.floor(cx - m - 3); x <= Math.ceil(cx + m + 3); x++) if (x >= 0 && y >= 0 && x < W && y < H) avoid[y * W + x] = 1;
      if (bed) {
        for (const i of bed.bed.keys()) {
          avoid[i] = 1;
          protect[i] = 1;
        }
        for (const i of bed.bank.keys()) avoid[i] = 1;
      }
      for (let i = 0; i < N; i++) if (mask[i]) protect[i] = 1;
      placed = lake;
    }
    if (placed) out.push(placed);
  }
  return out;
}

/** The longest run of equal levels along an outlet channel. */
function flatRun(levels: readonly number[]): number {
  let best = 0;
  let run = 0;
  for (let k = 0; k < levels.length; k++) {
    run = k > 0 && levels[k] === levels[k - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** The longest flat stretch a pond's outlet may have. */
const MAX_FLAT_OUTLET = 8;

/** The level of the nearest set tile of `mask` (a breadth-first spread; ties by index order). */
function nearestLevel(mask: Uint8Array, h: Uint8Array, W: number, H: number): Int16Array {
  const N = W * H;
  const out = new Int16Array(N).fill(-1);
  const queue = new Int32Array(N);
  let tail = 0;
  for (let i = 0; i < N; i++)
    if (mask[i]) {
      out[i] = h[i];
      queue[tail++] = i;
    }
  if (!tail) return out;
  for (let head = 0; head < tail; head++) {
    const c = queue[head];
    const x = c % W;
    const y = (c - x) / W;
    const nb = [x > 0 ? c - 1 : -1, x + 1 < W ? c + 1 : -1, y > 0 ? c - W : -1, y + 1 < H ? c + W : -1];
    for (const n of nb) {
      if (n < 0 || out[n] >= 0) continue;
      out[n] = out[c];
      queue[tail++] = n;
    }
  }
  return out;
}

function pointMask(W: number, H: number, x: number, y: number): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) m[yy * W + xx] = 1;
  return m;
}

/** Badwater (PLAN §5.4, §9.5): the badwater setting's total strength in basins of 1–3 each, placed
 *  about `distance + 14` tiles from the start (the Badwater distance setting moves them), each with
 *  its one outlet draining to `drains` (the reaches downstream of the start) or a map edge, never
 *  past the start. */
export function placeBadwater(opts: {
  rng: Rng;
  ground: PlanGround;
  t: LayoutTargets;
  /** Rivers the outlets may join, each cut to the reach where badwater may enter it. */
  drains: RiverFeature[];
  /** Tiles no basin may touch. */
  avoid: Uint8Array;
  /** Tiles no outlet may cross (ponds, a reservoir basin, the player's protected tiles). */
  noRoute: Uint8Array;
  start: { x: number; y: number };
  idOf: (k: number) => { id: string; role: string };
}): SetPieceFeature[] {
  const { rng, ground: g, t } = opts;
  const { W, H } = g;
  const N = W * H;
  const out: SetPieceFeature[] = [];
  if (!(t.badwater > 0)) return out;
  const n = Math.max(1, Math.ceil(t.badwater / 3));
  const each = round(Math.min(3, Math.max(1, t.badwater / n)), 2);
  const D = t.badwaterDistance;
  // the basin's floor keeps D + 12 from the start (its water's soil contamination reaches 7 tiles),
  // its outlet D + 8
  const sd = distanceFrom(pointMask(W, H, opts.start.x, opts.start.y), W, H);
  const avoid = opts.avoid.slice();
  // rivers other than the drains' reaches: no outlet may cross them or run beside them (within 2
  // tiles, where its water would spill into theirs)
  const blockedWater = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!g.channel[y * W + x]) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) blockedWater[yy * W + xx] = 1;
        }
    }
  for (const r of opts.drains) {
    const f = pathField(r.params.path, W, H);
    for (let i = 0; i < N; i++) if (f.d[i] < r.params.width / 2 + 3) blockedWater[i] = 0;
  }
  const protect = g.protect.slice();
  for (let i = 0; i < N; i++) if (blockedWater[i] || opts.noRoute[i]) protect[i] = 1;
  for (let k = 0; k < n; k++) {
    const target = D + 14 + 6 * k;
    // candidate centres: at least D + 12 from the start, nearest the target distance first
    const cands: [number, number][] = [];
    for (let y = 6; y < H - 6; y++)
      for (let x = 6; x < W - 6; x++) {
        const i = y * W + x;
        if (sd[i] < D + 12 || avoid[i]) continue;
        let clear = true;
        for (let dy = -5; dy <= 5 && clear; dy++) for (let dx = -5; dx <= 5 && clear; dx++) if (avoid[(y + dy) * W + x + dx] || g.channel[(y + dy) * W + x + dx]) clear = false;
        if (clear) cands.push([Math.abs(sd[i] - target) + rng.float() * 6, i]);
      }
    cands.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let done: SetPieceFeature | null = null;
    for (let c = 0; c < cands.length && c < 60 && !done; c++) {
      const i = cands[c][1];
      const x = i % W;
      const y = (i - x) / W;
      const ctx: PlanContext = {
        W,
        H,
        seed: g.seed,
        features: opts.drains,
        heights: g.heights,
        channel: g.channel,
        // the builder keeps its basin off the start's zone and its outlet 12 tiles beyond it
        start: { x: opts.start.x, y: opts.start.y, radius: Math.max(4, D - 4) },
        protect,
        locked: null,
      };
      const { id, role } = opts.idOf(k);
      const r = planSetPiece("badwaterBasin", { mode: "basin", at: [x, y], strength: each }, ctx, { id, origin: "generated", role }, true);
      if (!r.ok) continue;
      const plan = r.feature.params.plan as { outlet: number[]; outletLevels: number[]; outletWidth: number; x: number; y: number };
      const ch = channelTiles({ tiles: plan.outlet, levels: plan.outletLevels, width: plan.outletWidth, to: "" }, W, H);
      let near = false;
      for (const j of ch.bed.keys()) if (sd[j] < D + 8) near = true;
      if (near) continue;
      done = r.feature;
      // the next basins keep off this one and its outlet, and so do their outlets (a channel's
      // banks would raise this basin's floor)
      for (let yy = plan.y - 8; yy <= plan.y + 10; yy++)
        for (let xx = plan.x - 8; xx <= plan.x + 10; xx++) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          avoid[yy * W + xx] = 1;
          if (yy >= plan.y - 5 && yy <= plan.y + 7 && xx >= plan.x - 5 && xx <= plan.x + 7) protect[yy * W + xx] = 1;
        }
      for (const j of [...ch.bed.keys(), ...ch.bank.keys()]) {
        avoid[j] = 1;
        protect[j] = 1;
      }
    }
    if (done) out.push(done);
  }
  return out;
}

/** A river cut to the reach from arc position `from` on: the part a badwater outlet may join. */
export function reachOf(r: RiverFeature, from: number): RiverFeature {
  const path = r.params.path;
  const pts: Point[] = [];
  let acc = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, ay] = path[k];
    const [bx, by] = path[k + 1];
    const l = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    if (acc + l >= from) {
      if (!pts.length) {
        const u = l > 0 ? Math.max(0, (from - acc) / l) : 0;
        pts.push([ax + u * (bx - ax), ay + u * (by - ay)]);
      }
      pts.push([bx, by]);
    }
    acc += l;
  }
  if (pts.length < 2) pts.push(path[path.length - 1]);
  return { ...r, params: { ...r.params, path: pts } };
}

export { featureId };
