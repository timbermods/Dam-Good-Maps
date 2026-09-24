// The 1.0 map objects a generated map carries (PLAN §5.4–5.5, §7.7 step 5): mine sites
// (UndergroundRuins), relics, geothermal fields, thorn belts and, when the Advanced setting asks,
// unstable cores. Every theme's planner places them on its built ground, after the water settled
// and before the resources: on flat dry ground outside flood reach, each in its distance band from
// the start (validate/playability.ts `extras.placement` proves both), with a ring of level ground
// round it so a beaver can reach it (a mine's entrance, a relic's demolition, a field's engine).
//
// Thorn belts are the "thorn-barred valley" of PLAN §9.4: a blotchy belt across the way from the
// start to a relic or a geothermal field, never within 20 tiles of the start.

import type { BuildResult } from "../features/build";
import { featureId } from "../features/ids";
import { footprintAt, fitProblems, OBJECT_NAMES, rotatedSize } from "../features/objects";
import type { Feature, MapObjectFeature, MapObjectKind } from "../features/schema";
import { polygonMask } from "../features/geometry";
import { ORIENTATIONS, type Orientation } from "../format/footprints";
import { distanceFrom, tilesToRuns } from "../math/grid";
import { stream, type Rng } from "../math/rng";
import type { MapSpec } from "../spec/mapspec";
import { bandScale, EXTRA_BANDS, FLOOD_MARGIN, WET } from "../validate/playability";

export interface ExtrasInput {
  spec: MapSpec;
  /** The built ground: terrain, slopes, sources and the settled water (build step 10). */
  base: BuildResult;
  /** The planned features so far (reservoir sites, set pieces). */
  features: readonly Feature[];
  /** Tiles no object may take: the player's features, locks and keep-out regions (regeneration). */
  protect?: Uint8Array | null;
  /** More tiles to keep off (a dam site's band, badwater basins). */
  avoid?: Uint8Array | null;
  candidate: number;
  attempt: number;
}

/** How many of each object the settings ask for on this map (PLAN §5.4–5.5). */
export function extraCounts(spec: MapSpec, rng: Rng): Partial<Record<MapObjectKind, number>> {
  const s = spec.settings;
  const area = spec.size.x * spec.size.y;
  const out: Partial<Record<MapObjectKind, number>> = {};
  out.mineSite = s.resources.mineSites;
  if (s.resources.geothermal === "some") out.geothermal = 1 + (area >= 128 * 128 ? 1 : 0) + (area >= 192 * 192 ? 1 : 0);
  if (s.resources.relics === "some") {
    out.relicSmall = 1 + rng.int(0, 3);
    out.relicMedium = (area >= 128 * 128 ? 1 : 0) + rng.int(0, 2);
    out.relicLarge = area >= 192 * 192 ? 1 : 0;
  }
  if (s.hazards.thornBelts === "some") out.thornBelt = 1 + rng.int(0, 3);
  if (s.hazards.unstableCores === "on") out.unstableCore = 1 + rng.int(0, 4);
  return out;
}

/** Placing order: the biggest footprints first, so they find room. */
const ORDER: MapObjectKind[] = ["mineSite", "relicLarge", "geothermal", "relicMedium", "relicSmall", "unstableCore"];

export function planExtras(inp: ExtrasInput): MapObjectFeature[] {
  const { spec, base: b } = inp;
  const { W, H } = b;
  const N = W * H;
  const seed = spec.seed;
  const rng = stream(seed, "objects", inp.candidate, inp.attempt);
  const counts = extraCounts(spec, rng);
  const out: MapObjectFeature[] = [];
  if (!b.start) return out;
  const sx = b.start.x;
  const sy = b.start.y;
  const startMask = new Uint8Array(N);
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) startMask[y * W + x] = 1;
  const sd = distanceFrom(startMask, W, H);
  const h = b.heights;

  // tiles an object may not take: other objects and the start's zone (build.occupied), rivers, the
  // flood reach (water within the margin + 1, reservoir sites), the protected set-piece tiles, the
  // player's tiles and the map's border
  const blocked = new Uint8Array(N);
  const margin = FLOOD_MARGIN + 1;
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i - x) / W;
    if (b.occupied[i] || b.channel[i] || b.cache.terrain.protect[i] || inp.protect?.[i] || inp.avoid?.[i] || x < 2 || y < 2 || x > W - 3 || y > H - 3) blocked[i] = 1;
    if (b.water[i] > WET)
      for (let dy = -margin; dy <= margin; dy++)
        for (let dx = -margin; dx <= margin; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) blocked[yy * W + xx] = 1;
        }
  }
  for (const f of inp.features) {
    if (f.kind !== "lake") continue;
    const m = polygonMask(f.params.outline, W, H);
    for (let i = 0; i < N; i++) if (m[i]) blocked[i] = 1;
  }
  // start's zone and a margin: nothing of this within 8 tiles
  for (let i = 0; i < N; i++) if (sd[i] < 8) blocked[i] = 1;

  const scale = bandScale(W, H);
  const id = (kind: MapObjectKind, k: number) => {
    const role = `mapObject/${kind}/${k}`;
    return { id: featureId(seed, "mapObject", role), role };
  };

  // the largest square of level, free tiles with its south-west corner at each tile
  const square = () => {
    const sq = new Int32Array(N);
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (blocked[i]) continue;
        if (x === W - 1 || y === H - 1) {
          sq[i] = 1;
          continue;
        }
        const a = i + 1;
        const c = i + W;
        const d = i + W + 1;
        if (h[a] !== h[i] || h[c] !== h[i] || h[d] !== h[i]) sq[i] = 1;
        else sq[i] = 1 + Math.min(sq[a], sq[c], sq[d]);
      }
    return sq;
  };

  const placed: { kind: MapObjectKind; tiles: [number, number][] }[] = [];
  const take = (tiles: readonly (readonly [number, number])[], ring: number) => {
    for (const [x, y] of tiles)
      for (let dy = -ring; dy <= ring; dy++)
        for (let dx = -ring; dx <= ring; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) blocked[yy * W + xx] = 1;
        }
  };

  for (const kind of ORDER) {
    const want = counts[kind] ?? 0;
    const band = EXTRA_BANDS[kind];
    // a little inside the validator's band, so rounding never puts an object on its edge
    const lo = (band.scaled ? band.lo * scale : band.lo) + 1;
    const hi = (band.scaled ? band.hi * scale : band.hi) - 1;
    for (let k = 0; k < want; k++) {
      const orientation: Orientation = ORIENTATIONS[rng.int(0, 4)];
      const [a, c] = rotatedSize(kind, orientation);
      const side = Math.max(a, c) + 2;
      const sq = square();
      const cands: number[] = [];
      for (let y = 1; y + side <= H; y++)
        for (let x = 1; x + side <= W; x++) {
          const i = (y - 1) * W + (x - 1);
          if (sq[i] < side) continue;
          // the footprint's nearest tile to the start, roughly: its corner nearest the start
          const d = sd[y * W + x];
          if (d < lo - side || d > hi + side) continue;
          cands.push(y * W + x);
        }
      let done = false;
      for (let tries = 0; tries < 40 && cands.length && !done; tries++) {
        const pick = cands[rng.int(0, cands.length)];
        const x = pick % W;
        const y = (pick - x) / W;
        const tiles = footprintAt(kind, x, y, orientation);
        let d = Infinity;
        for (const [tx, ty] of tiles) d = Math.min(d, sd[ty * W + tx]);
        if (d < lo || d > hi) continue;
        if (fitProblems(kind, tiles, { W, H, heights: h, water: b.water, channel: b.channel, occupied: b.occupied }).length) continue;
        const { id: fid, role } = id(kind, k);
        const core = kind === "unstableCore" ? { radius: 2 + rng.int(0, 2), cycles: 5 + rng.int(0, 8) } : undefined;
        out.push({ id: fid, kind: "mapObject", origin: "generated", role, locked: false, params: { kind, placement: { x, y, orientation }, ...(core ? { core } : {}) } });
        placed.push({ kind, tiles });
        // cores keep clear of each other by their blast and more; the rest by a few tiles
        take(tiles, kind === "unstableCore" ? core!.radius + 4 : 3);
        done = true;
      }
    }
  }

  // thorn belts: across the way from the start to a relic or a geothermal field
  const beltsWant = counts.thornBelt ?? 0;
  const targets = placed.filter((p) => p.kind === "geothermal" || p.kind.startsWith("relic"));
  for (let k = 0, made = 0; made < beltsWant && k < beltsWant + 10; k++) {
    // in front of a relic or a field first; then anywhere on dry ground
    const tgt = targets.length && k < beltsWant + 3 ? targets[k % targets.length] : null;
    const belt = thornBelt(rng, tgt?.tiles ?? null, { W, H, h, sd, blocked, water: b.water });
    if (!belt) continue;
    const { id: fid, role } = id("thornBelt", made);
    out.push({ id: fid, kind: "mapObject", origin: "generated", role, locked: false, params: { kind: "thornBelt", placement: { area: tilesToRuns(belt, W) } } });
    take(belt.map((i) => [i % W, Math.floor(i / W)] as [number, number]), 1);
    made++;
  }
  return out;
}

/** A blotchy belt of 13–40 thorns (official belts fill 30–70% of their box): a band 2–3 tiles
 *  thick across the line from a target to the start, 5–8 tiles in front of the target; or, with no
 *  target, across a random stretch of dry ground. Every thorn keeps 22 tiles from the start. */
function thornBelt(
  rng: Rng,
  target: [number, number][] | null,
  g: { W: number; H: number; h: Uint8Array; sd: Float64Array; blocked: Uint8Array; water: Float64Array },
): number[] | null {
  const { W, H, sd, blocked } = g;
  let cx: number;
  let cy: number;
  let ux: number;
  let uy: number;
  if (target) {
    // the target's middle, and the way toward the start (down the distance field)
    let mx = 0;
    let my = 0;
    for (const [x, y] of target) {
      mx += x;
      my += y;
    }
    mx /= target.length;
    my /= target.length;
    let bx = Math.round(mx);
    let by = Math.round(my);
    const back = 5 + rng.int(0, 4);
    for (let s = 0; s < back; s++) {
      let best = -1;
      let bd = sd[by * W + bx];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = bx + dx;
        const yy = by + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (sd[yy * W + xx] < bd) {
          bd = sd[yy * W + xx];
          best = yy * W + xx;
        }
      }
      if (best < 0) break;
      bx = best % W;
      by = (best - bx) / W;
    }
    cx = bx;
    cy = by;
    const dx = mx - bx;
    const dy = my - by;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    // across the way: perpendicular to it
    ux = -dy / l;
    uy = dx / l;
  } else {
    const free: number[] = [];
    for (let i = 0; i < W * H; i++) if (!blocked[i] && g.sd[i] > 30) free.push(i);
    if (!free.length) return null;
    const p = free[rng.int(0, free.length)];
    cx = p % W;
    cy = (p - cx) / W;
    const a = rng.int(0, 4);
    ux = [1, 0, 0.7071, 0.7071][a];
    uy = [0, 1, 0.7071, -0.7071][a];
  }
  const half = 4 + rng.int(0, 5); // 9–17 tiles across
  const thick = 1 + rng.int(0, 2); // 2–3 tiles deep
  const keep = rng.range(0.45, 0.7);
  const tiles: number[] = [];
  const seen = new Set<number>();
  for (let s = -half; s <= half; s++)
    for (let t = 0; t <= thick; t++) {
      // s runs along the belt, t across it
      const x = Math.round(cx + ux * s - uy * t);
      const y = Math.round(cy + uy * s + ux * t);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x;
      if (seen.has(i)) continue;
      seen.add(i);
      if (blocked[i] || sd[i] < 22 || g.water[i] > 0) continue;
      if (rng.float() > keep) continue;
      tiles.push(i);
    }
  if (tiles.length < 13) return null;
  return tiles.slice(0, 40).sort((a, b) => a - b);
}

export { OBJECT_NAMES };
