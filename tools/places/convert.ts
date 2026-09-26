// One real place from one survey patch (Real places, second round: Kyler, 2026-09-25 and 26; PLAN
// §20 D151, D152, D164, D171, D200): the land as it is, the water sources where water begins, the
// start where the start requirements hold, and the map built and checked as the gallery builds it
// (src/core/places/place.ts). tools/places-convert.ts runs it on many patches and chooses.
//
// 1. The terrain: the survey's patch, cropped and quantised to 16 levels (hydro.ts), as it is. No
//    wall or rim along the edges (D151), and water may drain off the map (D152).
// 2. The sources (D171), only where water begins: a row across each river's mouth where it comes
//    into the map (channel tiles on the edge at the channel's level, about 0.5 of strength each as
//    the generator's mouth rows have, up to 12), and a spring at each channel head inside; at most
//    8 of them. The flow is the survey's, twice the official maps' water strength for the map's
//    size, shared by the square root of the area each drains, at most 8 a tile. Then the water
//    settles, and any source the water of another reaches (water.source_in_flow) or whose water
//    never reaches the map's edge (water.outflow) goes, its flow shared among the rest; again, until
//    none does. At least one source stays. Real land's valley floors are wide and flat at 16
//    levels, so twice the official flow can spread too thin for a pump (0.3 deep): when the start's
//    water or any other check fails, the conversion runs again with 4 and then 8 times it (more
//    flow from the sources' strength, as D171 allows; never from sources downstream). A map whose
//    water stands on more than 60% of it, however thin, reads as flooded and fails.
// 3. The start: flat dry 3×3s with a dry ring and their door's tile on their level, the best in
//    each 8×8 block by moist land near, then scored by the walk to clean water a pump reaches
//    (start.water) and the moist land within 20 tiles' walk (where groves and bushes grow); the
//    best are tried in turn: the place is built (its resources planned on the ground) and checked
//    with every check of the generate profile, and the first that passes is the start.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { sourcesInFlow } from "../../src/core/analysis/sources";
import { components } from "../../src/core/analysis/regions";
import { pumpShoreDistance, reachAt, walkDistance } from "../../src/core/analysis/walk";
import { waterSource, type EntitySpec } from "../../src/core/format/entities";
import { density } from "../../src/core/gen/calibrated";
import { encodeHeights, buildPlace, type PlaceData } from "../../src/core/places/place";
import { moistureBarrier, waterModel, type MapObject } from "../../src/core/sim/model";
import { moisture } from "../../src/core/sim/moisture";
import { canonicalSettle, type CanonicalWater } from "../../src/core/sim/prefill";
import { DIFFICULTY_RULES } from "../../src/core/spec/mapspec";
import { validateMap } from "../../src/core/validate/checks";
import { crop, quantise, rivers, type Edge } from "./hydro";

export const PATCHES = "investigation/landscapes/.cache/patches";
const HALO = 32;
/** Levels (the survey's library: 16). */
const CAP = 16;
/** Tiles of a river's mouth that get a source, at most. */
const MOUTH = 12;
/** A source's strength, as the generator's mouth rows give each tile (PLAN §7.6: 0.5, 0.25-1.0). */
const PER_TILE = 0.5;
/** Sources a map starts with, at most (the survey's 8). */
const GROUPS = 8;
/** Start positions tried in full, at most. */
const TRIES = 6;
/** The share of the map any water may stand on, however thin. Flat real land at 16 levels can carry
 *  a film of water over most of a map: it passes the flood check (which counts water over 0.05
 *  deep), but the map reads as flooded. */
export const MAX_COVER = 0.6;

/** The share of the map's tiles with any water on them. */
export function waterCover(depth: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < depth.length; i++) if (depth[i] > 0.001) n++;
  return n / depth.length;
}

/** The flows tried, as multiples of the official maps' water strength for the map's size. */
const FLOWS = [2, 4, 8];

/** A place's own fields: the resources' seed comes from `survey`, so a conversion's checks hold for
 *  whatever title the place gets. */
export type PlaceMeta = Omit<PlaceData, "format" | "W" | "H" | "heights" | "sources" | "start" | "badwater">;

/** What the conversion made of one patch in one mode. */
export interface Converted {
  /** The survey's row id: `<location>-<size>-<metres>-<mode>-16`. */
  row: string;
  ok: boolean;
  /** Why not: the checks the best start failed, or what went wrong. */
  reason?: string;
  size: number;
  heights?: string;
  sources?: [number, number, number][];
  start?: [number, number];
  /** The flow, as a multiple of the official maps' water strength for the map's size. */
  flow?: number;
  /** The share of the map any water stands on (MAX_COVER at most). */
  cover?: number;
  /** Sources taken out because another's water reached them, or theirs reached no edge. */
  dropped?: { inFlow: number; noOutflow: number };
  settled?: boolean;
  ticks?: number;
  /** Advisory checks the map does not meet (information). */
  advisories?: string[];
  ms: number;
}

/** The patch's elevations, with their halo. */
export function readPatch(key: string): Float32Array {
  const b = gunzipSync(readFileSync(`${PATCHES}/${key}.f32.gz`));
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

/** The heights of a survey row: its patch cropped and quantised in its mode. */
export function rowHeights(row: string): { size: number; heights: Uint8Array } {
  const m = /^(.+)-(\d+)-(\d+)-(\w+)-(\d+)$/.exec(row);
  if (!m) throw new Error(`not a survey row: ${row}`);
  const size = Number(m[2]);
  const raw = readPatch(`${m[1]}-${m[2]}-${m[3]}`);
  return { size, heights: quantise(crop(raw, size + 2 * HALO, size, HALO), m[4], Number(m[5])) };
}

type Group = { tiles: number[]; share: number };

/** The source groups where water begins, with their share of the flow: each river's mouth row (as
 *  many tiles as its share gives at about PER_TILE each, centred on the channel's lowest tile on the
 *  edge, along the channel at its level), and each head's spring. */
function beginnings(raw: Float32Array, size: number, h: Uint8Array, flow: number): Group[] {
  const found = rivers(raw, size, HALO);
  const all = [...found.entries, ...found.heads].sort((a, b) => b.area - a.area).slice(0, GROUPS);
  const sum = all.reduce((s, g) => s + Math.sqrt(g.area), 0);
  const shareOf = (area: number) => (flow * Math.sqrt(area)) / sum;
  const entries = found.entries.filter((e) => all.includes(e));
  const heads = found.heads.filter((e) => all.includes(e));
  const out: (Group & { area: number })[] = [];
  const taken = new Uint8Array(size * size);
  const along = (e: Edge, t: number) => (e === "south" ? t : e === "north" ? (size - 1) * size + t : e === "west" ? t * size : t * size + size - 1);
  for (const e of entries) {
    const t0 = e.edge === "south" || e.edge === "north" ? e.x : e.y;
    // the channel's level at the crossing: the lowest edge tile within 2
    let tc = t0;
    for (let t = Math.max(0, t0 - 2); t <= Math.min(size - 1, t0 + 2); t++) if (h[along(e.edge, t)] < h[along(e.edge, tc)]) tc = t;
    const level = h[along(e.edge, tc)];
    if (!level || taken[along(e.edge, tc)]) continue;
    let a = tc;
    let b = tc;
    const want = Math.max(1, Math.min(MOUTH, Math.round(shareOf(e.area) / PER_TILE)));
    while (b - a + 1 < want) {
      const left = a > 0 && h[along(e.edge, a - 1)] <= level && !taken[along(e.edge, a - 1)];
      const right = b < size - 1 && h[along(e.edge, b + 1)] <= level && !taken[along(e.edge, b + 1)];
      if (!left && !right) break;
      // grow toward the side nearer the crossing's middle first
      if (left && (!right || tc - a <= b - tc)) a--;
      else b++;
    }
    const tiles: number[] = [];
    for (let t = a; t <= b; t++) {
      const i = along(e.edge, t);
      if (h[i] > 0) tiles.push(i);
    }
    if (!tiles.length) continue;
    for (const i of tiles) taken[i] = 1;
    out.push({ area: e.area, tiles, share: shareOf(e.area) });
  }
  for (const s of heads) {
    const i = s.y * size + s.x;
    if (!h[i] || taken[i]) continue;
    // not on a mouth's row or next to one: that water is already there
    if (out.some((g) => g.tiles.some((t) => Math.max(Math.abs((t % size) - s.x), Math.abs(Math.floor(t / size) - s.y)) <= 3))) continue;
    taken[i] = 1;
    out.push({ area: s.area, tiles: [i], share: shareOf(s.area) });
  }
  out.sort((a, b) => b.area - a.area);
  // the flow of a river or head that got no source goes to the rest
  const got = out.reduce((s, g) => s + g.share, 0);
  return out.map((g) => ({ tiles: g.tiles, share: (g.share * flow) / got }));
}

/** Each group's share of the flow, and its tiles' strengths (at most 8 a tile, at least 0.1). */
function strengths(groups: Group[], size: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const g of groups) {
    const each = Math.min(8, Math.max(0.1, g.share / g.tiles.length));
    for (const i of g.tiles) out.push([i % size, Math.floor(i / size), Math.round(each * 1000) / 1000]);
  }
  return out;
}

function sourceEntities(sources: [number, number, number][], h: Uint8Array, size: number): EntitySpec[] {
  return sources.map(([x, y, strength]) => waterSource({ id: `s${x},${y}`, owner: "convert", x, y, z: h[y * size + x], strength }));
}

function mapObject(e: EntitySpec): MapObject {
  return { template: e.template, x: e.x, y: e.y, z: e.z, orientation: e.orientation, flipped: e.flipped, components: { ...(e.before ?? {}), ...e.components } };
}

/** Sources whose water reaches no map edge (water.outflow's rule: their wet region touches no
 *  edge tile but a source's own). */
function noOutflow(model: ReturnType<typeof waterModel>, depth: ArrayLike<number>): Set<number> {
  const { W, H } = model;
  const N = W * H;
  const any = new Uint8Array(N);
  for (let i = 0; i < N; i++) any[i] = depth[i] > 0 ? 1 : 0;
  const { labels } = components(any, W, H, false);
  const emitting = new Uint8Array(N);
  for (const e of model.emitters) for (const i of e.cells) emitting[i] = 1;
  const drains = new Set<number>();
  for (let i = 0; i < N; i++) {
    if (labels[i] < 0 || emitting[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) drains.add(labels[i]);
  }
  const bad = new Set<number>();
  model.emitters.forEach((e, k) => {
    if (!(e.strength > 0)) return;
    const lab = labels[e.cells[0]];
    if (lab >= 0 && !drains.has(lab)) bad.add(k);
  });
  return bad;
}

/** Start positions, best first: flat dry 3×3s (their ring dry, their door's tile on their level),
 *  the best in each 8×8 block by moist land within 16 tiles, then by the walk to pumpable clean
 *  water and the moist land and ground within 20 tiles' walk. Returns the StartingLocation's
 *  corner tile. */
function starts(h: Uint8Array, W: number, H: number, water: CanonicalWater, M: ArrayLike<number>): [number, number][] {
  const N = W * H;
  const D = water.depth;
  const integral = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = (y + 1) * (W + 1) + x + 1;
      integral[k] = integral[k - 1] + integral[k - W - 1] - integral[k - W - 2] + (M[i] > 0 && !(D[i] > 0) ? 1 : 0);
    }
  const count = (x: number, y: number, r: number) => {
    const l = Math.max(0, x - r);
    const b = Math.max(0, y - r);
    const rr = Math.min(W, x + r + 1);
    const t = Math.min(H, y + r + 1);
    return integral[t * (W + 1) + rr] - integral[t * (W + 1) + l] - integral[b * (W + 1) + rr] + integral[b * (W + 1) + l];
  };
  const blocks = new Map<number, { x: number; y: number; score: number }>();
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x;
      const z = h[i];
      if (!z || D[i] > 0) continue;
      let ok = h[(y - 2) * W + x] === z;
      for (let dy = -2; dy <= 2 && ok; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = (y + dy) * W + x + dx;
          if (D[j] > 0 || (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && h[j] !== z)) {
            ok = false;
            break;
          }
        }
      if (!ok) continue;
      const score = count(x, y, 16);
      const key = Math.floor(y / 8) * 1000 + Math.floor(x / 8);
      const old = blocks.get(key);
      if (!old || score > old.score) blocks.set(key, { x, y, score });
    }
  const rules = DIFFICULTY_RULES.normal;
  const scored: { x: number; y: number; score: number }[] = [];
  for (const c of [...blocks.values()].sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x).slice(0, 64)) {
    const walk = walkDistance(h, W, H, null, [], c, 24);
    const shore = pumpShoreDistance(walk, h, W, H, D, water.contamination).distance;
    let moist = 0;
    let reach = 0;
    for (let i = 0; i < N; i++) {
      const w = reachAt(walk, W, H, i);
      if (w > 20) continue;
      reach++;
      if (M[i] > 0 && !(D[i] > 0) && Math.max(Math.abs((i % W) - c.x), Math.abs(Math.floor(i / W) - c.y)) > 3) moist++;
    }
    const score = (shore <= rules.waterWithin ? 1e7 : 0) + (shore <= 12 ? 1e6 : 0) + Math.min(moist, 250) * 1000 + Math.min(reach, 999) - (Number.isFinite(shore) ? shore : 99);
    scored.push({ x: c.x, y: c.y, score });
  }
  scored.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  return scored.map((c) => [c.x - 1, c.y - 1]);
}

/** The water cover of a conversion kept from before `cover` was recorded: its sources settled
 *  again on its terrain. */
export function coverOf(r: Converted): number {
  const h = Uint8Array.from(r.heights!, (c) => parseInt(c, 36));
  const model = waterModel(r.size, r.size, h, sourceEntities(r.sources!, h, r.size).map(mapObject));
  return waterCover(canonicalSettle(model).depth);
}

/** Convert one survey row: see the file's header. `meta` is the place's own (its id, title and the
 *  rest), which the built map's description and the resources' seed use. */
export function convertRow(row: string, meta: PlaceMeta): Converted {
  const t0 = performance.now();
  const m = /^(.+)-(\d+)-(\d+)-(\w+)-(\d+)$/.exec(row);
  if (!m) throw new Error(`not a survey row: ${row}`);
  const size = Number(m[2]);
  const raw = readPatch(`${m[1]}-${m[2]}-${m[3]}`);
  const h = quantise(crop(raw, size + 2 * HALO, size, HALO), m[4], CAP);
  const N = size * size;
  const fail = (reason: string, extra: Partial<Converted> = {}): Converted => ({ row, ok: false, reason, size, ms: Math.round(performance.now() - t0), ...extra });

  // 2 and 3, with more flow each time a check fails (see the file's header)
  let last: Converted | null = null;
  for (const times of FLOWS) {
    const r = attempt(row, meta, raw, size, h, times, fail);
    if (r.ok) return { ...r, ms: Math.round(performance.now() - t0) };
    last = r;
    // land where no source or start fits does not change with the flow
    // land where no source or start fits does not change with the flow, and more flow only
    // spreads water wider
    if (/^no river|^start: no flat|^water covers/.test(r.reason ?? "")) break;
  }
  return { ...last!, ms: Math.round(performance.now() - t0) };
}

/** One conversion at one flow: `times` the official maps' water strength for the map's size. */
function attempt(row: string, meta: PlaceMeta, raw: Float32Array, size: number, h: Uint8Array, times: number, fail: (reason: string, extra?: Partial<Converted>) => Converted): Converted {
  const N = size * size;
  const flow = (times * density("water_strength_per_10k", N) * N) / 1e4;
  let groups = beginnings(raw, size, h, flow);
  if (!groups.length) return fail("no river comes in and no channel starts on this land");
  const dropped = { inFlow: 0, noOutflow: 0 };
  let sources = strengths(groups, size);
  let model = waterModel(size, size, h, sourceEntities(sources, h, size).map(mapObject));
  let water = canonicalSettle(model);
  for (let round = 0; round < 6; round++) {
    const objects = sourceEntities(sources, h, size).map(mapObject);
    const inFlow = new Set(sourcesInFlow(model, objects, water.depth).inFlow);
    const pools = noOutflow(model, water.depth);
    // which groups go: a group goes when any of its tiles is flagged
    let at = 0;
    const gone = groups.map((g) => {
      const idx = g.tiles.map(() => at++);
      const flow = idx.some((k) => inFlow.has(k));
      const pool = idx.some((k) => pools.has(k));
      return flow ? "flow" : pool ? "pool" : null;
    });
    if (!gone.some(Boolean)) break;
    const keep = groups.filter((_, k) => !gone[k]);
    if (!keep.length) {
      // keep the strongest where it is: it is where water begins, if anything is
      groups = [groups[0]];
      if (gone[0] === "pool") return fail("water.outflow: the only source's water never leaves the map", { heights: encodeHeights(h), dropped, flow: times });
      break;
    }
    for (const g of gone) if (g === "flow") dropped.inFlow++;
    else if (g === "pool") dropped.noOutflow++;
    const kept = keep.reduce((s, g) => s + g.share, 0);
    groups = keep.map((g) => ({ tiles: g.tiles, share: (g.share * flow) / kept }));
    sources = strengths(groups, size);
    model = waterModel(size, size, h, sourceEntities(sources, h, size).map(mapObject));
    water = canonicalSettle(model);
  }
  const cover = waterCover(water.depth);
  const base = { heights: encodeHeights(h), sources, dropped, settled: water.settled, ticks: water.ticks, flow: times, cover };
  if (!water.settled) return fail("water.settles: the water does not settle within 4 days", base);
  if (cover > MAX_COVER) return fail(`water covers ${Math.round(cover * 100)}% of the map (at most ${Math.round(MAX_COVER * 100)}%)`, base);

  // 3. the start: the best positions, each built and checked in full
  const objects = sourceEntities(sources, h, size).map(mapObject);
  const M = moisture(h, water.depth, water.contamination, size, size, moistureBarrier(size, size, objects));
  const tried = starts(h, size, size, water, M).slice(0, TRIES);
  if (!tried.length) return fail("start: no flat dry 3×3 with a dry ring on this land", base);
  let best: { failing: string[]; advisories: string[] } | null = null;
  for (const start of tried) {
    const place: PlaceData = { format: 2, ...meta, W: size, H: size, heights: base.heights, sources, start };
    const built = buildPlace(place, water);
    const v = validateMap(built.file, { profile: "generate", designedFor: "normal", features: [], water: { model: built.model, settled: built.settle } });
    const failing = v.report.checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false && !c.approximate).map((c) => c.id);
    const advisories = v.report.checks.filter((c) => !c.ok && c.advisory && c.applicable !== false).map((c) => c.id);
    if (v.report.passed && !failing.length) return { row, ok: true, size, ...base, start, advisories, ms: 0 };
    if (!best || failing.length < best.failing.length) best = { failing, advisories };
  }
  return fail(`the best of ${tried.length} starts fails ${best!.failing.join(", ")}`, base);
}
