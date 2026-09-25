// The opening of a map: what the first hours look like from the start, read from the analysis the
// validators use (any map with one start and water a steady state can show: generated, official or
// workshop). It answers the brief's five questions:
//   1. the start's water: where it is, what kind (a river, a lake, a pond, a stream), and how it
//      behaves in the difficulty's drought (the analytic drought water of sim/drought.ts);
//   2. the nearest good dam site (a straight dam holding the colony's drought need);
//   3. the nearest threat (badwater or contaminated soil, thorns, unstable cores);
//   4. the directions and kinds of land to expand into (walkable with the map's slopes);
//   5. what lies hidden further out (relics, geothermal fields, mine sites, ruins, other water,
//      falls beyond 40 tiles).
// Two slots wait for the Codex investigations: the weather-cycle signature (investigation/cycles)
// and the strategy axes (investigation/mechanics). Until their PRs land they are empty and do not
// count in the distance.

import { damSites } from "../../../src/core/analysis/damsites";
import { components } from "../../../src/core/analysis/regions";
import { walkDistance } from "../../../src/core/analysis/walk";
import { FOOTPRINTS, footprintTiles, slopeHighSide } from "../../../src/core/format/footprints";
import { DROUGHT, reservoirNeeded } from "../../../src/core/gen/calibrated";
import { distanceFrom } from "../../../src/core/math/grid";
import { droughtStorage } from "../../../src/core/sim/drought";
import { waterModel, type MapObject } from "../../../src/core/sim/model";
import { WALK_BLOCKERS } from "../../../src/core/validate/playability";

export const OPENING_KEYS = [
  "walk", "body", "running", "still", "droughtKeep", "damDist", "damLen", "threatDist", "threatUp", "thornDist",
  "land", "openDirs", "moistShare", "levels", "farScrap", "farObjects", "farWater", "farFalls",
] as const;
export type OpeningKey = (typeof OPENING_KEYS)[number];

export interface Opening {
  v: Record<OpeningKey, number>;
  /** Plain facts for the "how it plays" card. */
  facts: {
    waterKind: "river" | "lake" | "pond" | "stream" | "none";
    waterWalk: number;
    drought: "holds" | "shrinks" | "dries";
    dam: { dist: number; length: number; dir: string } | null;
    threat: { kind: "badwater" | "thorns" | "core"; dist: number; dir: string; upstream: boolean } | null;
    openTo: string[];
    land: "wide" | "some" | "tight";
    levelsNear: number;
    hidden: string[];
  };
  /** The workshop study's obviousness (obviousness.ts): the shortest straight dam within 20 and 40
   *  tiles of the start whose reservoir holds a Normal drought's need with the Normal reserve (380
   *  blocks). A good natural dam site near the start: one of 5 tiles or fewer within 40. */
  shortest20: number | null;
  shortest40: number | null;
  /** Waiting for investigation/cycles and investigation/mechanics. */
  cycle: number[] | null;
  axes: number[] | null;
}

const COMPASS = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];

/** Compass sector (0 east, counter-clockwise) of the offset (dx, dy), north = +y, without atan2. */
export function sectorOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  // compare against the 22.5° lines with tan(22.5°) = √2 − 1
  const t = Math.SQRT2 - 1;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay <= t * ax) return dx > 0 ? 0 : 4;
  if (ax <= t * ay) return dy > 0 ? 2 : 6;
  if (dx > 0) return dy > 0 ? 1 : 7;
  return dy > 0 ? 3 : 5;
}

export function openingOf(
  h: Uint8Array,
  W: number,
  H: number,
  depth: ArrayLike<number>,
  contam: ArrayLike<number>,
  objects: readonly MapObject[],
  start: { x: number; y: number; z: number },
  difficulty: "easy" | "normal" | "hard" = "normal",
  moisture: ArrayLike<number> | null = null,
): Opening {
  const N = W * H;
  const D = depth;
  const C = contam;
  const sx = start.x;
  const sy = start.y;
  const sz = start.z;
  const sm = new Uint8Array(N);
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) sm[y * W + x] = 1;
  const sd = distanceFrom(sm, W, H);
  const blocked = new Uint8Array(N);
  const links: [number, number][] = [];
  for (const o of objects) {
    if (WALK_BLOCKERS.has(o.template) && FOOTPRINTS[o.template]) for (const [x, y] of footprintTiles(o.template, o)) if (x >= 0 && y >= 0 && x < W && y < H) blocked[y * W + x] = 1;
    if (o.template !== "Slope") continue;
    const [dx, dy] = slopeHighSide(o.orientation);
    const hx = o.x + dx;
    const hy = o.y + dy;
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H || hx < 0 || hy < 0 || hx >= W || hy >= H) continue;
    links.push([o.y * W + o.x, hy * W + hx]);
  }
  const flat = walkDistance(h, W, H, blocked, [], start, 64);
  const walk = walkDistance(h, W, H, blocked, links, start, 90);
  // 1. the start's water: the nearest shore on its own level touching clean pumpable water
  let wBest = Infinity;
  let wTile = -1;
  for (let i = 0; i < N; i++) {
    const s = h[i] + D[i];
    if (!(D[i] >= 0.3 && C[i] < 0.05 && s >= sz - 2 && s <= sz + 0.01)) continue;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      if (h[n] === sz && flat[n] < wBest) {
        wBest = flat[n];
        wTile = i;
      }
    }
  }
  const wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) wet[i] = D[i] > 0.05 ? 1 : 0;
  const bodies = components(wet, W, H, false);
  const model = waterModel(W, H, h, objects as MapObject[]);
  const kept = droughtStorage(model, D, DROUGHT[difficulty].days);
  let bodySize = 0;
  let running = 0;
  let still = 0;
  let keep = 0;
  let waterKind: Opening["facts"]["waterKind"] = "none";
  const bodyLab = wTile >= 0 ? bodies.labels[wTile] : -1;
  if (bodyLab >= 0) {
    bodySize = bodies.sizes[bodyLab];
    let vol = 0;
    let kv = 0;
    let deep = 0;
    for (let i = 0; i < N; i++) {
      if (bodies.labels[i] !== bodyLab) continue;
      vol += D[i];
      kv += kept[i];
      if (D[i] >= 1) deep++;
    }
    for (const e of model.emitters) if (e.contamination === 0 && e.strength > 0 && e.cells.some((c) => bodies.labels[c] === bodyLab)) running += e.strength;
    still = deep / Math.max(1, bodySize);
    keep = vol > 0 ? kv / vol : 0;
    waterKind = still >= 0.25 && bodySize >= 100 ? "lake" : bodySize < 100 ? "pond" : running < 1 ? "stream" : "river";
  }
  // 2. the nearest good dam site: a straight dam whose reservoir holds the drought need
  const need = reservoirNeeded(difficulty);
  const clean = new Uint8Array(N);
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    clean[i] = D[i] > 0.05 && C[i] < 0.05 ? 1 : 0;
    surf[i] = h[i] + D[i];
  }
  const allSites = damSites(h, clean, surf, W, H, sd, 60, [1, 2, 3], 2, 0, 0);
  const sites = allSites.filter((s) => s.volume >= need);
  const holding = (r: number) => allSites.filter((s) => sd[s.y * W + s.x] <= r && s.volume >= 380).map((s) => s.length);
  const h40 = holding(40);
  const h20 = holding(20);
  let dam: Opening["facts"]["dam"] = null;
  let damDist = 70;
  let damLen = 25;
  for (const s of sites) {
    const d = sd[s.y * W + s.x];
    if (d < damDist || (d === damDist && s.length < damLen)) {
      damDist = d;
      damLen = s.length;
      dam = { dist: Math.round(d), length: s.length, dir: COMPASS[sectorOf(s.x - sx, s.y - sy)] };
    }
  }
  // 3. the nearest threat
  let threat: Opening["facts"]["threat"] = null;
  let tBad = Infinity;
  let tBadAt = -1;
  for (let i = 0; i < N; i++) {
    if (((D[i] > 0.05 && C[i] >= 0.3) || false) && sd[i] < tBad) {
      tBad = sd[i];
      tBadAt = i;
    }
  }
  // badwater that reaches the start's own water body (in badtide it flows there)
  let upstream = 0;
  if (bodyLab >= 0) for (let i = 0; i < N; i++) if (bodies.labels[i] === bodyLab && C[i] >= 0.05) upstream = 1;
  let tThorn = Infinity;
  let tThornAt = -1;
  let tCore = Infinity;
  let tCoreAt = -1;
  for (const o of objects) {
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const d = sd[o.y * W + o.x];
    if (o.template === "Thorns" && d < tThorn) {
      tThorn = d;
      tThornAt = o.y * W + o.x;
    }
    if (o.template === "UnstableCore" && d < tCore) {
      tCore = d;
      tCoreAt = o.y * W + o.x;
    }
  }
  const dirOf = (i: number) => COMPASS[sectorOf((i % W) - sx, Math.floor(i / W) - sy)];
  if (tBadAt >= 0 && tBad <= Math.min(tThorn, tCore)) threat = { kind: "badwater", dist: Math.round(tBad), dir: dirOf(tBadAt), upstream: upstream === 1 };
  else if (tThornAt >= 0 && tThorn <= tCore) threat = { kind: "thorns", dist: Math.round(tThorn), dir: dirOf(tThornAt), upstream: false };
  else if (tCoreAt >= 0) threat = { kind: "core", dist: Math.round(tCore), dir: dirOf(tCoreAt), upstream: false };
  // 4. land to expand into: walkable dry land (slopes allowed) within 60 tiles' walk
  const sector = new Float64Array(8);
  let land = 0;
  let landNear = 0;
  let moistLand = 0;
  const levels = new Set<number>();
  for (let i = 0; i < N; i++) {
    if (!(walk[i] <= 60) || D[i] > 0.05) continue;
    land++;
    if (walk[i] <= 30) landNear++;
    if (walk[i] <= 40) levels.add(h[i]);
    const x = i % W;
    const y = (i - x) / W;
    sector[sectorOf(x - sx, y - sy)]++;
  }
  // moist land (the settle's soil moisture; without it, land within 6 tiles of water)
  const dWet = moisture ? null : distanceFrom(wet, W, H);
  for (let i = 0; i < N; i++) if (walk[i] <= 60 && !(D[i] > 0.05) && (moisture ? moisture[i] > 0 : dWet![i] <= 6)) moistLand++;
  const open: string[] = [];
  for (let k = 0; k < 8; k++) if (land > 0 && sector[k] / land >= 0.08) open.push(COMPASS[k]);
  // 5. further out: beyond 40 tiles (straight distance from the start)
  let scrap = 0;
  let farScrap = 0;
  let farObjects = 0;
  const hidden: string[] = [];
  const seen = new Set<string>();
  for (const o of objects) {
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const d = sd[o.y * W + o.x];
    if (o.template.startsWith("RuinColumnH")) {
      const s = 15 * Number(o.template.slice(11));
      scrap += s;
      if (d > 40) farScrap += s;
    }
    if (d > 40 && /Relic|GeothermalField|UndergroundRuins/.test(o.template)) {
      farObjects++;
      const name = o.template.includes("Relic") ? "relics" : o.template === "GeothermalField" ? "a geothermal field" : "mine sites";
      if (!seen.has(name)) {
        seen.add(name);
        hidden.push(name);
      }
    }
  }
  let farWater = 0;
  const far = new Set<number>();
  for (let i = 0; i < N; i++) if (wet[i] && sd[i] > 40 && bodies.labels[i] !== bodyLab && bodies.sizes[bodies.labels[i]] >= 100) far.add(bodies.labels[i]);
  farWater = far.size;
  if (farWater) hidden.push(farWater > 1 ? "other lakes and rivers" : "another lake or river");
  let farFalls = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x + 1 < W; x++) {
      const i = y * W + x;
      if (!wet[i] || !wet[i + 1] || sd[i] <= 40) continue;
      if (Math.abs(h[i] + D[i] - h[i + 1] - D[i + 1]) >= 2) farFalls++;
    }
  if (farFalls) hidden.push("waterfalls");
  if (scrap > 0 && farScrap / scrap >= 0.5) hidden.push("most of the ruins");
  const v: Record<OpeningKey, number> = {
    walk: Number.isFinite(wBest) ? wBest : 40,
    body: Math.log1p(bodySize),
    running: Math.log1p(running),
    still,
    droughtKeep: keep,
    damDist,
    damLen,
    threatDist: Math.min(100, tBad),
    threatUp: upstream,
    thornDist: Math.min(100, tThorn),
    land: Math.log1p(landNear),
    openDirs: open.length,
    moistShare: land ? moistLand / land : 0,
    levels: levels.size,
    farScrap: scrap ? farScrap / scrap : 0,
    farObjects: Math.log1p(farObjects),
    farWater: Math.log1p(farWater),
    farFalls: Math.log1p(farFalls),
  };
  return {
    v,
    facts: {
      waterKind,
      waterWalk: Math.round(v.walk),
      drought: keep >= 0.6 ? "holds" : keep >= 0.2 ? "shrinks" : "dries",
      dam,
      threat,
      openTo: open,
      land: landNear >= 1500 ? "wide" : landNear >= 600 ? "some" : "tight",
      levelsNear: levels.size,
      hidden,
    },
    shortest20: h20.length ? Math.min(...h20) : null,
    shortest40: h40.length ? Math.min(...h40) : null,
    cycle: null,
    axes: null,
  };
}

export function openingVector(o: Opening): number[] {
  return OPENING_KEYS.map((k) => o.v[k]);
}
