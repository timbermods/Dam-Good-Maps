// Measure one map with the app's own validators and analysis (PLAN §11, analysis/metrics.ts), on
// our canonical settle of its water (never the water an older file stores), plus what the workshop
// study adds: water bodies and flow direction, dam sites over the whole map, the 1.0 objects,
// caves, the raw quantities behind the start rules, naturalness, and a layout signature for the
// variety score. Generated and imported maps go through the same function, so every comparison is
// like for like.

import { damSites, maxFloodFor, type DamSite } from "../../../src/core/analysis/damsites";
import { measure, type MapMetrics } from "../../../src/core/analysis/metrics";
import { components, walkRegions } from "../../../src/core/analysis/regions";
import { rawEntity, type EntitySpec } from "../../../src/core/format/entities";
import { FOOTPRINTS, footprintTiles, slopeHighSide, worldBlocks } from "../../../src/core/format/footprints";
import type { TimberFile } from "../../../src/core/format/timber";
import { floorsOf, surfaceOf } from "../../../src/core/format/world";
import type { Feature } from "../../../src/core/features/schema";
import { distanceFrom, MinHeap } from "../../../src/core/math/grid";
import { isDelayed, mapObjects, specifiedStrength, type MapObject } from "../../../src/core/sim/model";
import type { MapSpec } from "../../../src/core/spec/mapspec";
import { validateMap, type Validation } from "../../../src/core/validate/checks";
import { WALK_BLOCKERS } from "../../../src/core/validate/playability";
import type { CanonicalWater } from "../../../src/core/sim/prefill";
import type { WaterModel } from "../../../src/core/sim/water";
import { naturalness, type Naturalness } from "./naturalness";

export const LIVING_TREES = new Set(["Pine", "Birch", "Oak", "Maple", "ChestnutTree", "Mangrove"]);
export const ALL_TREES = new Set([...LIVING_TREES, "Succulent"]);
export const FOOD_BUSHES = new Set(["BlueberryBush", "CoffeeBush", "Dandelion", "Spadderdock", "Cattail"]);
export const OBJECTS_1_0 = [
  "Thorns", "NaturalDam", "Blockage", "NaturalOverhang2x1", "NaturalOverhang3x1", "NaturalOverhang4x1",
  "SmallRelic", "MediumRelic", "LargeRelic", "GeothermalField", "UndergroundRuins", "UnstableCore",
  "WaterSeep", "BadwaterSeep", "BadtideDrain", "Aquifer", "AncientAquiferDrill", "ReservePile", "ReserveTank", "ReserveWarehouse",
] as const;

const WET_CAL = 0.1;
const BAD_CAL = 0.3;
const GRID = 16;

export interface CheckRecord {
  ok: boolean;
  applicable: boolean;
  value: string | number | null;
  class: string;
}

export interface StartMeasures {
  x: number;
  y: number;
  z: number;
  /** The validator's numbers (straight distances, current rules). */
  pumpableWater: number | null;
  reach: number;
  reachShare: number;
  bushes20: number;
  trees20: number;
  badwater: number | null;
  ruinsNear: number;
  /** Raw quantities behind the start-rules change: pumpable clean water bordering the land the
   *  colony walks to at the start's own level (no slopes), by walking and straight distance; living
   *  trees and living bushes within 20 tiles' walk (slopes included). */
  waterNoSlopeWalk: number | null;
  waterNoSlopeStraight: number | null;
  levelRegion: number;
  livingTreesWalk20: number;
  treesWalk20: number;
  livingBushesWalk20: number;
  slopesWithin25: number;
}

export interface MapMeasures {
  W: number;
  H: number;
  area: number;
  checks: Record<string, CheckRecord>;
  passedImport: boolean;
  settleTicks: number;
  settled: boolean;
  metrics: Omit<MapMetrics, "rivers" | "edgeRivers" | "meander" | "sinuosity" | "lakes" | "bedDrops2" | "groveMedian" | "edgeExits"> & Partial<MapMetrics>;
  terrain: {
    minHeight: number;
    medianHeight: number;
    levels1pct: number;
    above16: boolean;
    caveColumns: number;
    caveShare: number;
  };
  water: {
    badwaterShare: number;
    cleanShare: number;
    bodies: number;
    largestBodyShare: number;
    lakes: number;
    lakeShare: number;
    ponds: number;
    islands100: number;
    maxFallDrop: number;
    tallFalls: number;
    moistShare: number;
    inflows: number;
    springs: number;
    outflows: number;
    flow: string;
    sourceEdgeShare: number | null;
  };
  sources: Record<string, { count: number; strength: number }>;
  /** Water that is not running from day one, which a steady state of the running sources cannot
   *  show: delayed sources (TimeActivatedComponent enabled), aquifers (off until a powered drill),
   *  seeps (off above 0.8 deep), badtide drains; and why this map's settled water or start may
   *  not be representative (`special`, empty when it is). */
  mechanics: {
    cleanRunning: number;
    cleanDelayed: number;
    aquifers: number;
    seeps: number;
    drains: number;
    badDelayed: number;
    cores: number;
    special: string[];
  };
  dams: {
    sites: number;
    per10k: number;
    ratio100per10k: number;
    bestRatio: number;
    bestVolume: number;
    medianLength: number | null;
    nearStartBest: number;
    naturalStorage: number;
  };
  resources: {
    trees: number;
    livingTrees: number;
    succulents: number;
    factionPlants: number;
    species: Record<string, number>;
    groves5: number;
    groveMedian: number;
    largestGrove: number;
    dominantShare: number | null;
    bushes: number;
    livingBushes: number;
    ruins: number;
    scrap: number;
    ruinFields10: number;
    ruinsInFieldsShare: number | null;
  };
  objects: Record<string, number>;
  slopes: number;
  starts: number;
  start: StartMeasures | null;
  natural: Naturalness;
  layout: { heights: number[]; water: number[] };
  /** The inputs of the interestingness score (PLAN §12) that need the map itself. */
  score: ScoreInputs;
}

/** PLAN §12's components, measured on any map (imports have no features, so rivers are read from
 *  the settled water). */
export interface ScoreInputs {
  /** Best volume per dam tile within 60 tiles of the start, and the other sites there of 100+. */
  damRatioNearStart: number;
  damSites100NearStart: number;
  /** Raised tables: level regions of max(40, area/1000)+ tiles whose every neighbour is lower. */
  plateaus: number;
  /** Water between walls 3+ levels above its surface on both sides within 4 tiles. */
  gorgeTiles: number;
  /** The main watercourse through the settled water, from its sources to where it leaves the map:
   *  its length over the straight line (1 when there is none), and its length over the diagonal. */
  courseSinuosity: number;
  courseLengthPerDiagonal: number;
  /** Shares of living trees, berry bushes and scrap by distance from the start (0–16, 16–32, 32–64,
   *  64–128, 128+ tiles). */
  rings: { trees: number[] | null; bushes: number[] | null; scrap: number[] | null };
  /** Level regions and water bodies of 1%+ of the map, groves of 50+ trees. */
  regions: number;
  /** Share of the three largest flat regions whose own pumpable water is over 10 tiles away. */
  tradeoff: number;
  /** Share of scrap, and whether the largest reservoir site, lie beyond half the start's reach. */
  frontier: number;
}

export interface MeasureOptions {
  spec?: MapSpec | null;
  features?: readonly Feature[] | null;
  /** The build's own water (generated maps), so it is not settled twice. */
  water?: { model: WaterModel; settled: CanonicalWater };
}

function round(v: number, d = 3): number {
  const k = 10 ** d;
  return Math.round(v * k) / k;
}

export function measureFile(file: TimberFile, opts: MeasureOptions = {}): { m: MapMeasures; v: Validation } {
  const generated = !!opts.spec;
  const v = validateMap(file, {
    profile: generated ? "generate" : "import",
    external: !generated,
    spec: opts.spec ?? null,
    designedFor: opts.spec?.designedFor ?? "normal",
    features: opts.features ?? null,
    water: opts.water,
  });
  return { m: measureValidated(file, v, opts.features ?? null), v };
}

export function measureValidated(file: TimberFile, v: Validation, features: readonly Feature[] | null): MapMeasures {
  const w = file.world;
  const W = w.sizeX;
  const H = w.sizeY;
  const N = W * H;
  const h = surfaceOf(w);
  const floors = floorsOf(w);
  const objects = mapObjects(w);
  const water = v.water!;
  const a = v.analysis!;
  const D = water.depth;
  const C = water.contamination;

  const checks: Record<string, CheckRecord> = {};
  for (const c of v.report.checks) {
    checks[c.id] = { ok: c.ok, applicable: c.applicable !== false, value: typeof c.value === "number" || typeof c.value === "string" ? c.value : null, class: c.class };
  }

  // ---- the app's own metrics (analysis/metrics.ts)
  const entities: EntitySpec[] = w.entities.map((e) => ({ ...rawEntity(e, "import"), components: (e.Components ?? {}) as EntitySpec["components"] }));
  const srcs = objects.filter((o) => o.template === "WaterSource" || o.template === "BadwaterSource").map((o) => ({ template: o.template, strength: specifiedStrength(o.components) }));
  const starts = objects.filter((o) => o.template === "StartingLocation");
  const centre = starts.length === 1 ? startCentre(starts[0]) : null;
  const metrics = measure({
    features: features ?? [],
    built: { W, H, heights: h, water: D, entities, sources: srcs, start: centre ?? undefined },
    report: v.report,
    analysis: a,
  });

  // ---- terrain
  const sorted = h.slice().sort();
  const counts = new Map<number, number>();
  for (const x of h) counts.set(x, (counts.get(x) ?? 0) + 1);
  let caves = 0;
  for (const f of floors) if (f > 1) caves++;

  // ---- water
  const wet = new Uint8Array(N);
  let nWet = 0;
  let nBad = 0;
  let nClean = 0;
  for (let i = 0; i < N; i++) {
    if (D[i] >= WET_CAL) {
      wet[i] = 1;
      nWet++;
      if (C[i] >= BAD_CAL) nBad++;
      else nClean++;
    }
  }
  const bodies = components(wet, W, H, false);
  const bigBodies = bodies.sizes.filter((s) => s >= 10);
  const pools = poolStats(h, D, wet, W, H);
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = wet[i] ? 0 : 1;
  const lc = components(land, W, H, false);
  const touchesEdge = new Set<number>();
  for (let x = 0; x < W; x++) touchesEdge.add(lc.labels[x]).add(lc.labels[(H - 1) * W + x]);
  for (let y = 0; y < H; y++) touchesEdge.add(lc.labels[y * W]).add(lc.labels[y * W + W - 1]);
  const islands = lc.sizes.filter((s, k) => s >= 100 && !touchesEdge.has(k)).length;
  let maxDrop = 0;
  const tall = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!wet[i]) continue;
      const s = h[i] + D[i];
      for (const n of [x + 1 < W ? i + 1 : -1, y + 1 < H ? i + W : -1]) {
        if (n < 0 || !wet[n]) continue;
        const d = Math.abs(s - (h[n] + D[n]));
        if (d > maxDrop) maxDrop = d;
        if (d >= 4) tall[i] = tall[n] = 1;
      }
    }
  }
  let moist = 0;
  for (let i = 0; i < N; i++) if (a.moisture[i] > 0 && !wet[i]) moist++;
  const flow = flowOf(v.model!, D, W, H);

  const sources: Record<string, { count: number; strength: number }> = {};
  const mech = { cleanRunning: 0, cleanDelayed: 0, aquifers: 0, seeps: 0, drains: 0, badDelayed: 0, cores: 0, special: [] as string[] };
  for (const o of objects) {
    if (o.template === "UnstableCore") mech.cores++;
    if (!["WaterSource", "BadwaterSource", "WaterSeep", "BadwaterSeep", "Aquifer", "BadtideDrain"].includes(o.template)) continue;
    const s = (sources[o.template] ??= { count: 0, strength: 0 });
    s.count++;
    const st = specifiedStrength(o.components);
    s.strength = round(s.strength + st, 3);
    const late = isDelayed(o.components);
    if (o.template === "WaterSource") late ? (mech.cleanDelayed += st) : (mech.cleanRunning += st);
    else if (o.template === "WaterSeep") mech.seeps += st;
    else if (o.template === "Aquifer") mech.aquifers += st;
    else if (o.template === "BadtideDrain") mech.drains += st;
    else if (late) mech.badDelayed += st;
  }
  {
    const caveShare = [...floors].filter((f) => f > 1).length / N;
    const clean = mech.cleanRunning + mech.cleanDelayed + mech.aquifers + mech.seeps;
    if (caveShare >= 0.02) mech.special.push("caves: water under roofs");
    if (clean > 0 && mech.cleanDelayed >= 0.25 * clean) mech.special.push("delayed sources");
    if (clean > 0 && mech.aquifers >= 0.25 * clean) mech.special.push("aquifers");
    if (clean > 0 && mech.seeps >= 0.5 * (mech.cleanRunning + mech.seeps)) mech.special.push("seeps");
    if (mech.cores > 0) mech.special.push("unstable cores");
    if (centre && h[centre.y * W + centre.x] !== centre.z) mech.special.push("start below the top surface");
    for (const k of ["cleanRunning", "cleanDelayed", "aquifers", "seeps", "drains", "badDelayed"] as const) mech[k] = round(mech[k], 3);
  }

  // ---- dam sites over the whole map (clean water, crests 1-3), sampled evenly
  const clean = new Uint8Array(N);
  for (let i = 0; i < N; i++) clean[i] = D[i] > 0.05 && C[i] < 0.05 ? 1 : 0;
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) surf[i] = h[i] + D[i];
  const stride = Math.min(8, Math.max(3, Math.round(nClean / 2000)));
  const sites: DamSite[] = nClean ? damSites(h, clean, surf, W, H, null, Infinity, [1, 2, 3], stride, 30, 0) : [];
  const lengths = sites.map((s) => s.length).sort((p, q) => p - q);

  // ---- resources and objects
  const res = resourceStats(objects, W, H);
  const objCounts: Record<string, number> = {};
  for (const t of OBJECTS_1_0) objCounts[t] = 0;
  let slopes = 0;
  for (const o of objects) {
    if (o.template in objCounts) objCounts[o.template]++;
    if (o.template === "Slope") slopes++;
  }

  // ---- the start
  const start = centre ? startStats(h, W, H, objects, centre, D, C, wet, a.startDistance!, v) : null;

  return {
    W,
    H,
    area: N,
    checks,
    passedImport: v.report.passed,
    settleTicks: water.ticks,
    settled: water.settled,
    metrics: { ...metrics, reach: Number.isFinite(metrics.reach) ? metrics.reach : 0 },
    terrain: {
      minHeight: sorted[0],
      medianHeight: sorted[N >> 1],
      levels1pct: [...counts.values()].filter((c) => c >= 0.01 * N).length,
      above16: sorted[N - 1] > 16,
      caveColumns: caves,
      caveShare: round(caves / N, 4),
    },
    water: {
      badwaterShare: round(nBad / N, 4),
      cleanShare: round(nClean / N, 4),
      bodies: bigBodies.length,
      largestBodyShare: round((bigBodies.reduce((m, s) => Math.max(m, s), 0) || 0) / N, 4),
      lakes: pools.lakes,
      lakeShare: round(pools.lakeTiles / N, 4),
      ponds: pools.ponds,
      islands100: islands,
      maxFallDrop: round(maxDrop, 2),
      tallFalls: components(tall, W, H, true).sizes.length,
      moistShare: round(moist / N, 4),
      ...flow,
    },
    sources,
    mechanics: mech,
    dams: {
      sites: sites.length,
      per10k: round((sites.length * 1e4) / N, 2),
      ratio100per10k: round((sites.filter((s) => s.ratio >= 100).length * 1e4) / N, 2),
      bestRatio: round(sites[0]?.ratio ?? 0, 1),
      bestVolume: round(sites.reduce((m, s) => Math.max(m, s.volume), 0), 1),
      medianLength: lengths.length ? lengths[lengths.length >> 1] : null,
      nearStartBest: round(a.bestDam?.volume ?? 0, 1),
      naturalStorage: round(a.naturalStorage, 1),
    },
    resources: res,
    objects: objCounts,
    slopes,
    starts: starts.length,
    start,
    natural: naturalness(h, W, H, D, sites, maxFloodFor(W, H)),
    layout: layoutSignature(h, D, W, H),
    score: scoreInputs(h, W, H, D, C, objects, v, sites, wet),
  };
}

// --------------------------------------------------------------------------- score inputs

const RINGS = [16, 32, 64, 128, Infinity];

function ringShares(sd: Float64Array | null, pts: { i: number; w: number }[]): number[] | null {
  if (!sd || !pts.length) return null;
  const out = [0, 0, 0, 0, 0];
  let tot = 0;
  for (const p of pts) {
    const d = sd[p.i];
    if (!Number.isFinite(d)) continue;
    const k = RINGS.findIndex((r) => d < r);
    out[k] += p.w;
    tot += p.w;
  }
  return tot ? out.map((v) => round(v / tot, 3)) : null;
}

export function scoreInputs(
  h: Uint8Array,
  W: number,
  H: number,
  D: ArrayLike<number>,
  C: ArrayLike<number>,
  objects: readonly MapObject[],
  v: Validation,
  sites: readonly DamSite[],
  wet: Uint8Array,
): ScoreInputs {
  const N = W * H;
  const a = v.analysis!;
  const sd = a.startDistance;
  // dam value near the start (the validator samples within 60 tiles of it)
  const near = a.damSites.slice().sort((p, q) => q.ratio - p.ratio);
  // plateaus (prototype/analysis.py `plateaus`): level regions whose rim drops on 90%+ of its sides
  const lr = levelRegionsOf(h, W, H);
  const minArea = Math.max(40, Math.floor(N / 1000));
  const rimLower = new Float64Array(lr.size.length);
  const rimTotal = new Float64Array(lr.size.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (const n of [x + 1 < W ? i + 1 : -1, y + 1 < H ? i + W : -1]) {
        if (n < 0 || lr.labels[n] === lr.labels[i]) continue;
        rimTotal[lr.labels[i]]++;
        rimTotal[lr.labels[n]]++;
        if (h[n] < h[i]) rimLower[lr.labels[i]]++;
        else if (h[i] < h[n]) rimLower[lr.labels[n]]++;
      }
    }
  }
  let plateaus = 0;
  for (let k = 0; k < lr.size.length; k++) if (lr.size[k] >= minArea && rimTotal[k] && rimLower[k] / rimTotal[k] >= 0.9) plateaus++;
  // gorges: water between walls 3+ above its surface on both sides within 4 tiles
  let gorge = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!wet[i]) continue;
      const s = h[i] + D[i] + 3;
      const wall = (dx: number, dy: number) => {
        for (let k = 1; k <= 4; k++) {
          const xx = x + k * dx;
          const yy = y + k * dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
          if (h[yy * W + xx] >= s) return true;
        }
        return false;
      };
      if ((wall(1, 0) && wall(-1, 0)) || (wall(0, 1) && wall(0, -1))) gorge++;
    }
  }
  const course = courseOf(v.model!, D, W, H);
  // resources by distance from the start
  const trees: { i: number; w: number }[] = [];
  const bushes: { i: number; w: number }[] = [];
  const scrap: { i: number; w: number }[] = [];
  const treeTiles: number[] = [];
  for (const o of objects) {
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const i = o.y * W + o.x;
    if (LIVING_TREES.has(o.template)) {
      treeTiles.push(i);
      if (!isDead(o)) trees.push({ i, w: 1 });
    } else if (FOOD_BUSHES.has(o.template) && !isDead(o)) bushes.push({ i, w: 1 });
    else if (o.template.startsWith("RuinColumnH")) scrap.push({ i, w: 15 * Number(o.template.slice(11)) });
  }
  // regions: level regions and water bodies of 1%+, groves of 50+
  const one = 0.01 * N;
  const bodies = components(wet, W, H, false).sizes.filter((s) => s >= one).length;
  const groves = clusterSizes(treeTiles, W, H).sizes.filter((s) => s >= 50).length;
  const regions = lr.size.filter((s) => s >= one).length + bodies + groves;
  // tradeoff: the three largest flat (dry) regions, and their own pumpable water
  const dryCount = new Map<number, number>();
  for (let i = 0; i < N; i++) if (!wet[i]) dryCount.set(lr.labels[i], (dryCount.get(lr.labels[i]) ?? 0) + 1);
  const big = [...dryCount].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k]) => k);
  let far = 0;
  for (const k of big) {
    const L = lr.level[k];
    const pump = new Uint8Array(N);
    let any = false;
    for (let i = 0; i < N; i++) {
      const s = h[i] + D[i];
      if (D[i] >= 0.3 && C[i] < 0.05 && s >= L - 2 && s <= L + 0.01) {
        pump[i] = 1;
        any = true;
      }
    }
    if (!any) {
      far++;
      continue;
    }
    const dist = distanceFrom(pump, W, H);
    let best = Infinity;
    for (let i = 0; i < N; i++) if (lr.labels[i] === k && dist[i] < best) best = dist[i];
    if (best > 10) far++;
  }
  // frontier: scrap and the largest reservoir site beyond half the start's reach
  let frontier = 0;
  if (sd) {
    let maxD = 0;
    for (let i = 0; i < N; i++) if (Number.isFinite(sd[i]) && sd[i] > maxD) maxD = sd[i];
    const half = maxD / 2;
    let tot = 0;
    let beyond = 0;
    for (const p of scrap) {
      tot += p.w;
      if (sd[p.i] > half) beyond += p.w;
    }
    const bigSite = sites.slice().sort((p, q) => q.volume - p.volume)[0];
    const parts: number[] = [];
    if (tot) parts.push(beyond / tot);
    if (bigSite) parts.push(sd[bigSite.y * W + bigSite.x] > half ? 1 : 0);
    frontier = parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : 0;
  }
  return {
    damRatioNearStart: round(near[0]?.ratio ?? 0, 1),
    damSites100NearStart: near.filter((s) => s.ratio >= 100).length,
    plateaus,
    gorgeTiles: gorge,
    courseSinuosity: round(course.sinuosity, 3),
    courseLengthPerDiagonal: round(course.length / Math.sqrt(W * W + H * H), 3),
    rings: { trees: ringShares(sd, trees), bushes: ringShares(sd, bushes), scrap: ringShares(sd, scrap) },
    regions,
    tradeoff: big.length ? round(far / big.length, 3) : 0,
    frontier: round(frontier, 3),
  };
}

function levelRegionsOf(h: Uint8Array, W: number, H: number): { labels: Int32Array; level: number[]; size: number[] } {
  const labels = new Int32Array(W * H).fill(-1);
  const level: number[] = [];
  const size: number[] = [];
  const q = new Int32Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (labels[s] >= 0) continue;
    const lab = level.length;
    labels[s] = lab;
    let head = 0;
    let tail = 0;
    q[tail++] = s;
    while (head < tail) {
      const c = q[head++];
      const x = c % W;
      const y = (c - x) / W;
      for (const n of [x > 0 ? c - 1 : -1, x + 1 < W ? c + 1 : -1, y > 0 ? c - W : -1, y + 1 < H ? c + W : -1]) {
        if (n >= 0 && labels[n] < 0 && h[n] === h[s]) {
          labels[n] = lab;
          q[tail++] = n;
        }
      }
    }
    level.push(h[s]);
    size.push(tail);
  }
  return { labels, level, size };
}

/** The main watercourse: through the settled water (8-way, √2 diagonals) from the clean sources to
 *  the draining map edge tile with the deepest water (or, with no draining edge, to the farthest
 *  wet tile). Its sinuosity is its length over the straight line from the source it started at. */
function courseOf(model: WaterModel, D: ArrayLike<number>, W: number, H: number): { length: number; sinuosity: number } {
  const N = W * H;
  const dist = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const heap = new MinHeap();
  const walled = new Uint8Array(N);
  const onEdge = (i: number) => {
    const x = i % W;
    const y = (i - x) / W;
    return x === 0 || y === 0 || x === W - 1 || y === H - 1;
  };
  for (const e of model.emitters) {
    for (const c of e.cells) if (onEdge(c)) walled[c] = 1;
    if (e.contamination > 0 || e.strength <= 0) continue;
    for (const c of e.cells) {
      if (dist[c] === 0) continue;
      dist[c] = 0;
      from[c] = c;
      heap.push(0, c);
    }
  }
  if (!heap.size) return { length: 0, sinuosity: 1 };
  while (heap.size) {
    const c = heap.pop();
    const k = heap.lastKey;
    if (k > dist[c]) continue;
    const x = c % W;
    const y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      if (!(D[n] > 0.05)) continue;
      const nd = k + (dx && dy ? Math.SQRT2 : 1);
      if (nd < dist[n]) {
        dist[n] = nd;
        from[n] = from[c];
        heap.push(nd, n);
      }
    }
  }
  let end = -1;
  for (let i = 0; i < N; i++) {
    if (!onEdge(i) || walled[i] || !Number.isFinite(dist[i]) || !(D[i] > 0.05)) continue;
    if (end < 0 || D[i] > D[end]) end = i;
  }
  if (end < 0) {
    for (let i = 0; i < N; i++) if (Number.isFinite(dist[i]) && (end < 0 || dist[i] > dist[end])) end = i;
  }
  if (end < 0 || !(dist[end] > 0)) return { length: 0, sinuosity: 1 };
  const s = from[end];
  const straight = Math.hypot((end % W) - (s % W), Math.floor(end / W) - Math.floor(s / W));
  return { length: dist[end], sinuosity: straight > 0 ? Math.max(1, dist[end] / straight) : 1 };
}

// ------------------------------------------------------------------------------------ helpers

export function startCentre(s: MapObject): { x: number; y: number; z: number } {
  const cells = worldBlocks(FOOTPRINTS.StartingLocation, s).filter((b) => b.localZ === 0);
  let sx = 0;
  let sy = 0;
  for (const b of cells) {
    sx += b.x;
    sy += b.y;
  }
  return { x: Math.round(sx / cells.length), y: Math.round(sy / cells.length), z: s.z };
}

function poolStats(h: Uint8Array, D: ArrayLike<number>, wet: Uint8Array, W: number, H: number): { lakes: number; ponds: number; lakeTiles: number } {
  // level water: 4-connected wet tiles whose surfaces differ by under 0.05
  const N = W * H;
  const lab = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  const sizes: number[] = [];
  const inner: number[] = [];
  let n = 0;
  for (let s = 0; s < N; s++) {
    if (!wet[s] || lab[s] >= 0) continue;
    lab[s] = n;
    let head = 0;
    let tail = 0;
    q[tail++] = s;
    while (head < tail) {
      const c = q[head++];
      const x = c % W;
      const y = (c - x) / W;
      const sc = h[c] + D[c];
      for (const nb of [x > 0 ? c - 1 : -1, x + 1 < W ? c + 1 : -1, y > 0 ? c - W : -1, y + 1 < H ? c + W : -1]) {
        if (nb < 0 || !wet[nb] || lab[nb] >= 0) continue;
        if (Math.abs(h[nb] + D[nb] - sc) >= 0.05) continue;
        lab[nb] = n;
        q[tail++] = nb;
      }
    }
    sizes.push(tail);
    n++;
  }
  const notPool = new Uint8Array(N);
  for (let i = 0; i < N; i++) notPool[i] = lab[i] >= 0 && sizes[lab[i]] >= 20 ? 0 : 1;
  // distance from each pool tile to anything outside its pool (a neighbour pool counts as outside)
  const edge = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (notPool[i]) {
      edge[i] = 1;
      continue;
    }
    const x = i % W;
    const y = (i - x) / W;
    for (const nb of [x > 0 ? i - 1 : -1, x + 1 < W ? i + 1 : -1, y > 0 ? i - W : -1, y + 1 < H ? i + W : -1]) if (nb >= 0 && lab[nb] !== lab[i]) edge[i] = 1;
  }
  const d = distanceFrom(edge, W, H);
  for (let k = 0; k < n; k++) inner.push(0);
  for (let i = 0; i < N; i++) if (lab[i] >= 0 && d[i] > inner[lab[i]]) inner[lab[i]] = d[i];
  let lakes = 0;
  let ponds = 0;
  let lakeTiles = 0;
  for (let k = 0; k < n; k++) {
    if (sizes[k] >= 100 && inner[k] >= 3) {
      lakes++;
      lakeTiles += sizes[k];
    } else if (sizes[k] >= 20 && inner[k] >= 2) ponds++;
  }
  return { lakes, ponds, lakeTiles };
}

const COMPASS = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];

/** Where the water comes from and goes: clean emitters on the map edge (inflows), inland
 *  (springs), and the wet border tiles that drain (outflows). The main flow is from the strength-
 *  weighted centre of the clean emitters to the depth-weighted centre of the draining edge, as a
 *  compass direction with north = +y; "closed" when no water leaves the map. */
function flowOf(model: WaterModel, D: ArrayLike<number>, W: number, H: number): { inflows: number; springs: number; outflows: number; flow: string; sourceEdgeShare: number | null } {
  const onEdge = (i: number) => {
    const x = i % W;
    const y = (i - x) / W;
    return x === 0 || y === 0 || x === W - 1 || y === H - 1;
  };
  const walled = new Uint8Array(W * H);
  let sx = 0;
  let sy = 0;
  let sw = 0;
  const edgeCells: number[] = [];
  const inlandCells: number[] = [];
  let emitters = 0;
  let edgeEmitters = 0;
  for (const e of model.emitters) {
    for (const c of e.cells) if (onEdge(c)) walled[c] = 1;
    if (e.contamination > 0 || e.strength <= 0) continue;
    emitters++;
    const near = e.cells.some((c) => {
      const x = c % W;
      const y = (c - x) / W;
      return x <= 2 || y <= 2 || x >= W - 3 || y >= H - 3;
    });
    if (near) edgeEmitters++;
    for (const c of e.cells) {
      const x = c % W;
      const y = (c - x) / W;
      sx += (x * e.strength) / e.cells.length;
      sy += (y * e.strength) / e.cells.length;
      sw += e.strength / e.cells.length;
      (near ? edgeCells : inlandCells).push(c);
    }
  }
  let ox = 0;
  let oy = 0;
  let ow = 0;
  const drains: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!onEdge(i) || walled[i] || !(D[i] > 0.05)) continue;
    const x = i % W;
    const y = (i - x) / W;
    ox += x * D[i];
    oy += y * D[i];
    ow += D[i];
    drains.push(i);
  }
  let flow = "none";
  if (sw > 0 && ow > 0) {
    const dx = ox / ow - sx / sw;
    const dy = oy / ow - sy / sw;
    if (Math.abs(dx) + Math.abs(dy) < 0.1 * Math.max(W, H)) flow = "local";
    else {
      const ang = Math.atan2(dy, dx);
      flow = COMPASS[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
    }
  } else if (sw > 0) flow = "closed";
  return {
    inflows: clusters(edgeCells, W, 4),
    springs: clusters(inlandCells, W, 4),
    outflows: clusters(drains, W, 4),
    flow,
    sourceEdgeShare: emitters ? round(edgeEmitters / emitters, 2) : null,
  };
}

/** Groups of tiles within `gap` (Chebyshev) of each other. */
function clusters(tiles: number[], W: number, gap: number): number {
  const parent = tiles.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  for (let p = 0; p < tiles.length; p++) {
    for (let q = p + 1; q < tiles.length; q++) {
      const a = tiles[p];
      const b = tiles[q];
      if (Math.max(Math.abs((a % W) - (b % W)), Math.abs(Math.floor(a / W) - Math.floor(b / W))) <= gap) parent[find(p)] = find(q);
    }
  }
  return new Set(tiles.map((_, k) => find(k))).size;
}

function isDead(o: MapObject): boolean {
  const lnr = o.components.LivingNaturalResource as { IsDead?: boolean } | undefined;
  return !!lnr && lnr.IsDead === true;
}

function resourceStats(objects: readonly MapObject[], W: number, H: number): MapMeasures["resources"] {
  const species: Record<string, number> = {};
  let trees = 0;
  let living = 0;
  let succ = 0;
  let faction = 0;
  let bushes = 0;
  let livingBushes = 0;
  let ruins = 0;
  let scrap = 0;
  const treeAt = new Map<number, string>();
  const ruinTiles: number[] = [];
  for (const o of objects) {
    const t = o.template;
    if (ALL_TREES.has(t)) {
      trees++;
      species[t] = (species[t] ?? 0) + 1;
      if (t === "Succulent") succ++;
      if (!isDead(o)) living++;
      if (["Maple", "ChestnutTree", "Mangrove"].includes(t)) faction++;
      if (o.x >= 0 && o.y >= 0 && o.x < W && o.y < H) treeAt.set(o.y * W + o.x, t);
    } else if (FOOD_BUSHES.has(t)) {
      bushes++;
      if (!isDead(o)) livingBushes++;
      if (t !== "BlueberryBush") faction++;
    } else if (t.startsWith("RuinColumnH")) {
      ruins++;
      scrap += 15 * Number(t.slice(11));
      if (o.x >= 0 && o.y >= 0 && o.x < W && o.y < H) ruinTiles.push(o.y * W + o.x);
    }
  }
  const grove = clusterSizes([...treeAt.keys()], W, H);
  const groves = grove.sizes.filter((s) => s >= 5).sort((p, q) => p - q);
  const dom: number[] = [];
  grove.members.forEach((m) => {
    if (m.length < 20) return;
    const c = new Map<string, number>();
    for (const i of m) c.set(treeAt.get(i)!, (c.get(treeAt.get(i)!) ?? 0) + 1);
    dom.push(Math.max(...c.values()) / m.length);
  });
  dom.sort((p, q) => p - q);
  const rf = clusterSizes(ruinTiles, W, H);
  const fields = rf.sizes.filter((s) => s >= 10);
  return {
    trees,
    livingTrees: living,
    succulents: succ,
    factionPlants: faction,
    species,
    groves5: groves.length,
    groveMedian: groves.length ? groves[groves.length >> 1] : 0,
    largestGrove: grove.sizes.reduce((m, s) => Math.max(m, s), 0),
    dominantShare: dom.length ? round(dom[dom.length >> 1], 3) : null,
    bushes,
    livingBushes,
    ruins,
    scrap,
    ruinFields10: fields.length,
    ruinsInFieldsShare: ruins ? round(fields.reduce((s, x) => s + x, 0) / ruins, 3) : null,
  };
}

/** Clusters of tiles touching 8-ways (Chebyshev 1). */
function clusterSizes(tiles: number[], W: number, H: number): { sizes: number[]; members: number[][] } {
  const mask = new Uint8Array(W * H);
  for (const t of tiles) mask[t] = 1;
  const { labels, sizes } = components(mask, W, H, true);
  const members: number[][] = sizes.map(() => []);
  for (const t of new Set(tiles)) if (labels[t] >= 0) members[labels[t]].push(t);
  return { sizes, members };
}

/** Walking distance from the start's 3×3 over land the colony can walk: 4-neighbour moves on one
 *  level (1), diagonals when both orthogonal tiles are on that level too (√2), slope links (1). */
export function walkDistance(h: Uint8Array, W: number, H: number, blocked: Uint8Array, links: readonly [number, number][], start: { x: number; y: number }): Float64Array {
  const N = W * H;
  const adj = new Map<number, number[]>();
  for (const [p, q] of links) {
    (adj.get(p) ?? adj.set(p, []).get(p)!).push(q);
    (adj.get(q) ?? adj.set(q, []).get(q)!).push(p);
  }
  const d = new Float64Array(N).fill(Infinity);
  const heap = new MinHeap();
  for (let y = start.y - 1; y <= start.y + 1; y++) {
    for (let x = start.x - 1; x <= start.x + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      d[i] = 0;
      heap.push(0, i);
    }
  }
  const S2 = Math.SQRT2;
  const ok = (i: number, lv: number) => !blocked[i] && h[i] === lv;
  while (heap.size) {
    const c = heap.pop();
    const k = heap.lastKey;
    if (k > d[c]) continue;
    const x = c % W;
    const y = (c - x) / W;
    const lv = h[c];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const n = yy * W + xx;
      if (!ok(n, lv)) continue;
      if (dx && dy && !(ok(y * W + xx, lv) && ok(yy * W + x, lv))) continue;
      const nd = k + (dx && dy ? S2 : 1);
      if (nd < d[n]) {
        d[n] = nd;
        heap.push(nd, n);
      }
    }
    for (const n of adj.get(c) ?? []) {
      if (blocked[n]) continue;
      const nd = k + 1;
      if (nd < d[n]) {
        d[n] = nd;
        heap.push(nd, n);
      }
    }
  }
  return d;
}

function startStats(
  h: Uint8Array,
  W: number,
  H: number,
  objects: readonly MapObject[],
  s: { x: number; y: number; z: number },
  D: ArrayLike<number>,
  C: ArrayLike<number>,
  wet: Uint8Array,
  sd: Float64Array,
  v: Validation,
): StartMeasures {
  const N = W * H;
  const blocked = new Uint8Array(N);
  for (const o of objects) {
    if (!WALK_BLOCKERS.has(o.template) || !FOOTPRINTS[o.template]) continue;
    for (const [x, y] of footprintTiles(o.template, o)) if (x >= 0 && x < W && y >= 0 && y < H) blocked[y * W + x] = 1;
  }
  const links: [number, number][] = [];
  let slopes25 = 0;
  for (const o of objects) {
    if (o.template !== "Slope") continue;
    const [dx, dy] = slopeHighSide(o.orientation);
    const hx = o.x + dx;
    const hy = o.y + dy;
    if (o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) continue;
    if (sd[o.y * W + o.x] <= 25) slopes25++;
    if (hx >= 0 && hx < W && hy >= 0 && hy < H) links.push([o.y * W + o.x, hy * W + hx]);
  }
  const wd = walkDistance(h, W, H, blocked, links, s);
  const wd0 = walkDistance(h, W, H, blocked, [], s);
  const reachAt = (dist: Float64Array, i: number) => {
    const x = i % W;
    const y = (i - x) / W;
    let best = dist[i];
    for (const n of [x > 0 ? i - 1 : -1, x + 1 < W ? i + 1 : -1, y > 0 ? i - W : -1, y + 1 < H ? i + W : -1]) if (n >= 0 && dist[n] + 1 < best) best = dist[n] + 1;
    return best;
  };
  // pumpable clean water beside the start's own level, no slopes
  let walk0 = Infinity;
  let straight0 = Infinity;
  for (let i = 0; i < N; i++) {
    const surf = h[i] + D[i];
    if (!(D[i] >= 0.3 && C[i] < 0.05 && surf >= s.z - 2 && surf <= s.z + 0.01)) continue;
    const r = reachAt(wd0, i);
    if (!Number.isFinite(r)) continue;
    if (r < walk0) walk0 = r;
    if (sd[i] < straight0) straight0 = sd[i];
  }
  let level = 0;
  for (let i = 0; i < N; i++) if (Number.isFinite(wd0[i]) && !wet[i]) level++;
  let lt = 0;
  let at = 0;
  let lb = 0;
  for (const o of objects) {
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const i = o.y * W + o.x;
    const isTree = LIVING_TREES.has(o.template);
    const isBush = FOOD_BUSHES.has(o.template);
    if (!isTree && !isBush) continue;
    if (reachAt(wd, i) > 20) continue;
    if (isTree) {
      at++;
      if (!isDead(o)) lt++;
    } else if (!isDead(o)) lb++;
  }
  const num = (id: string) => {
    const c = v.report.checks.find((r) => r.id === id);
    return typeof c?.value === "number" ? c.value : null;
  };
  const reach = num("start.reach") ?? 0;
  return {
    ...s,
    pumpableWater: Number.isFinite(v.analysis!.waterDistance) ? round(v.analysis!.waterDistance, 1) : null,
    reach,
    reachShare: round(reach / N, 3),
    bushes20: num("start.food") ?? 0,
    trees20: num("start.wood") ?? 0,
    badwater: num("start.badwater"),
    ruinsNear: num("start.ruins_clear") ?? 0,
    waterNoSlopeWalk: Number.isFinite(walk0) ? round(walk0, 1) : null,
    waterNoSlopeStraight: Number.isFinite(straight0) ? round(straight0, 1) : null,
    levelRegion: level,
    livingTreesWalk20: lt,
    treesWalk20: at,
    livingBushesWalk20: lb,
    slopesWithin25: slopes25,
  };
}

/** A 16×16 picture of the map for the variety score: each cell's mean height rank (0 lowest, 1
 *  highest, so relief of any size compares) and its share of water. */
export function layoutSignature(h: Uint8Array, D: ArrayLike<number>, W: number, H: number): { heights: number[]; water: number[] } {
  const N = W * H;
  const hist = new Array(256).fill(0);
  for (const v of h) hist[v]++;
  const rank = new Array(256).fill(0);
  let below = 0;
  for (let lv = 0; lv < 256; lv++) {
    rank[lv] = N > 1 ? (below + (hist[lv] - 1) / 2) / (N - 1) : 0;
    below += hist[lv];
  }
  const hs = new Array(GRID * GRID).fill(0);
  const ws = new Array(GRID * GRID).fill(0);
  const n = new Array(GRID * GRID).fill(0);
  for (let y = 0; y < H; y++) {
    const gy = Math.min(GRID - 1, Math.floor((y * GRID) / H));
    for (let x = 0; x < W; x++) {
      const gx = Math.min(GRID - 1, Math.floor((x * GRID) / W));
      const k = gy * GRID + gx;
      const i = y * W + x;
      hs[k] += rank[h[i]];
      ws[k] += D[i] >= WET_CAL ? 1 : 0;
      n[k]++;
    }
  }
  return { heights: hs.map((v, k) => round(v / Math.max(1, n[k]), 3)), water: ws.map((v, k) => round(v / Math.max(1, n[k]), 3)) };
}
