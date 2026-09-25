// Resources on the settled water (PLAN §7.7, §9.7): ruin fields on dry flat ground away from the
// start, berry patches beside water (the first ones near the start), and single-species groves:
// alive on moist soil, stored dead on dry soil. Every theme's planner runs this on its built ground
// (terrain, slopes, sources and the canonical settle), so the resources sit where the water keeps
// them alive.

import type { BerryPatchFeature, Feature, ForestFeature, RuinFieldFeature } from "../features/schema";
import { featureId } from "../features/ids";
import { reachAt, walkDistance } from "../analysis/walk";
import { entityTiles } from "../features/edits";
import { WALK_BLOCKERS } from "../validate/playability";
import type { EntitySpec } from "../format/entities";
import { slopeHighSide } from "../format/footprints";
import { distanceFrom, tilesToRuns } from "../math/grid";
import { stream } from "../math/rng";
import type { MapSpec } from "../spec/mapspec";
import { groupSizes, growBlob, pickSeeds, punchHoles } from "./blobs";
import { BUSHES, density, FOREST, RUIN_HEIGHT_SHARES, RUINS } from "./calibrated";

export interface Ground {
  W: number;
  H: number;
  heights: Uint8Array;
  water: Float64Array;
  moisture: Float64Array;
  soilContamination: Float64Array;
  occupied: Uint8Array;
  start?: { x: number; y: number };
  /** The objects built so far: their slopes say where the colony can walk. */
  entities?: readonly EntitySpec[];
}

/** How far the colony walks from the start to each tile (slopes allowed, round the objects that
 *  block walking): the start requirements count living trees and bushes within 20 tiles' walk
 *  (PLAN §5.6, D85). Null without a start. */
function walkFromStart(g: Ground): Float64Array | null {
  if (!g.start || !g.entities) return null;
  const { W, H } = g;
  const links: [number, number][] = [];
  const blocked = new Uint8Array(W * H);
  for (const e of g.entities) {
    if (WALK_BLOCKERS.has(e.template)) for (const [x, y] of entityTiles(e)) if (x >= 0 && y >= 0 && x < W && y < H) blocked[y * W + x] = 1;
    if (e.template !== "Slope") continue;
    const [dx, dy] = slopeHighSide(e.orientation);
    const hx = e.x + dx;
    const hy = e.y + dy;
    if (e.x < 0 || e.y < 0 || e.x >= W || e.y >= H || hx < 0 || hy < 0 || hx >= W || hy >= H) continue;
    links.push([e.y * W + e.x, hy * W + hx]);
  }
  const d = walkDistance(g.heights, W, H, blocked, links, g.start);
  const out = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = reachAt(d, W, H, i);
  return out;
}

/** Near the start, food and wood go within this walk (the requirements count 20). */
const NEAR_WALK = 18;

/** Regeneration constraints (PLAN §7.0): tiles resources keep off, and what locks kept. */
export interface ResourceConstraints {
  protect: Uint8Array | null;
  lockedMask: Uint8Array | null;
}

/** The start rules' targets for what the generator places near the start (PLAN §5.6): a little
 *  above each minimum the validator enforces, so a map meets its requirements on the first
 *  attempt. The generator never aims below a minimum (D85). */
export function nearStartTargets(spec: MapSpec): { trees: number; bushes: number; ruinsClear: number } {
  const r = spec.settings.start.rules;
  return {
    trees: Math.max(FOREST.nearStart.minLiving, Math.ceil(1.2 * r.treesWithin20)),
    bushes: Math.max(spec.settings.resources.berriesNearStart, Math.ceil(1.15 * r.bushesWithin20)),
    // official nearest ruin to the start: p10 22; Normal's rule is 15
    ruinsClear: r.ruinsWithin + 7,
  };
}

/** A second district's site needs a grove of 40+ trees and 20+ berry bushes near it (PLAN §9.8). */
export const SITE_TREES = 48;
export const SITE_BUSHES = 24;

export function planResources(spec: MapSpec, g: Ground, candidate: number, attempt: number, constraints?: ResourceConstraints, sites: readonly { x: number; y: number }[] = []): Feature[] {
  const { W, H } = g;
  const N = W * H;
  const area = N;
  const seed = spec.seed;
  const near = nearStartTargets(spec);
  const free = new Uint8Array(N);
  const moist = new Uint8Array(N);
  const wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    wet[i] = g.water[i] > 0 ? 1 : 0;
    free[i] = !g.occupied[i] && !wet[i] ? 1 : 0;
    // living plants need moist, dry-footed, clean soil
    moist[i] = g.moisture[i] > 0 && !wet[i] && !(g.soilContamination[i] > 0) ? 1 : 0;
  }
  // regeneration: nothing on the player's features, locked regions or keep-out regions
  const keepOff = constraints?.protect;
  const kept = constraints?.lockedMask;
  if (keepOff || kept) for (let i = 0; i < N; i++) if (keepOff?.[i] || kept?.[i]) free[i] = 0;
  const startMask = new Uint8Array(N);
  if (g.start) {
    for (let y = g.start.y - 1; y <= g.start.y + 1; y++)
      for (let x = g.start.x - 1; x <= g.start.x + 1; x++) startMask[y * W + x] = 1;
  }
  const startDist = distanceFrom(startMask, W, H);
  // near the start, food and wood go within the colony's walk (other tiles only as a fallback)
  const walk = walkFromStart(g);
  const byWalk = (i: number) => (!walk || walk[i] <= NEAR_WALK ? 1 : 0.05);
  // near-start groves and patches grow only within the walk, so every plant of them counts
  let nearWalk: Uint8Array | null = null;
  if (walk) {
    nearWalk = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (walk[i] <= NEAR_WALK) nearWalk[i] = 1;
  }
  const out: Feature[] = [];
  const anchorRole = (prefix: string, tiles: number[]) => `${prefix}/${tiles[0]}`;

  // ---- ruin fields first: flat dry ground away from the start, one level each (PLAN §9.7)
  const ruinRng = stream(seed, "ruins", candidate, attempt);
  const mix = RUIN_HEIGHT_SHARES;
  const meanH = mix.reduce((a, s, k) => a + s * (k + 1), 0);
  const targetScrap = ((density("scrap_per_1k_tiles", area) * area) / 1000) * (spec.settings.resources.ruins / 100);
  const targetColumns = Math.round(targetScrap / (15 * meanH));
  const inFields = Math.round(targetColumns * (1 - RUINS.singlesShare));
  const fm = density("ruin_field_columns", area);
  const sizes = RUINS.sizeFactors.map((k) => Math.floor(fm * k));
  const minStart = near.ruinsClear;
  const ruinFree = new Uint8Array(N);
  let allowedCount = 0;
  for (let i = 0; i < N; i++) {
    ruinFree[i] = free[i] && !moist[i] && startDist[i] >= minStart ? 1 : 0;
    allowedCount += ruinFree[i];
  }
  if (allowedCount < 0.05 * N) {
    // too little dry land away from water: allow moist ground too
    for (let i = 0; i < N; i++) ruinFree[i] = free[i] && startDist[i] >= minStart ? 1 : 0;
  }
  const centres: [number, number][] = [];
  let placed = 0;
  for (let tries = 0; placed < inFields && tries < 200; tries++) {
    const size = Math.min(ruinRng.pick(sizes), inFields - placed);
    if (size < 12) break;
    const cands: number[] = [];
    for (let i = 0; i < N; i++) if (ruinFree[i]) cands.push(i);
    if (!cands.length) break;
    const s = ruinRng.pick(cands);
    const sx = s % W;
    const sy = (s - sx) / W;
    if (centres.some(([cx, cy]) => (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy) < RUINS.minFieldSpacing * RUINS.minFieldSpacing)) continue;
    const level = g.heights[s];
    const allowed = new Uint8Array(N);
    for (let i = 0; i < N; i++) allowed[i] = ruinFree[i] && g.heights[i] === level ? 1 : 0;
    let tiles = growBlob(ruinRng, allowed, W, H, s, Math.floor(size / (1 - RUINS.holeShare)), RUINS.compactness);
    if (tiles.length < Math.max(12, Math.floor(size / 2))) continue;
    tiles = punchHoles(ruinRng, tiles, W, RUINS.holeShare);
    const role = anchorRole("ruinField", tiles);
    const f: RuinFieldFeature = {
      id: featureId(seed, "ruinField", role),
      kind: "ruinField",
      origin: "generated",
      role,
      locked: false,
      params: { area: tilesToRuns(tiles, W), scrapTarget: Math.round(tiles.length * 15 * meanH), heightMix: [...mix], centerBias: RUINS.centerBias },
    };
    out.push(f);
    // take the field and a one-tile moat so separate fields never touch
    for (const i of tiles) {
      const x = i % W;
      const y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) ruinFree[yy * W + xx] = 0;
        }
      free[i] = 0;
    }
    let cx = 0;
    let cy = 0;
    for (const i of tiles) {
      cx += i % W;
      cy += (i - (i % W)) / W;
    }
    centres.push([cx / tiles.length, cy / tiles.length]);
    placed += tiles.length;
  }

  // ---- berry patches beside water, the first ones near the start (PLAN §7.7)
  const vegRng = stream(seed, "veg", candidate, attempt);
  const waterDist = distanceFrom(wet, W, H);
  const nearWater = (i: number) => waterDist[i] <= 5;
  const bushTotal = Math.floor(((density("bushes_per_10k", area) * area) / 1e4) * (spec.settings.resources.berryBushes / 100));
  let bushCount = 0;
  const patch = (seedTile: number, size: number, ripeShare: number, within: Uint8Array | null = null): number => {
    const allowed = new Uint8Array(N);
    for (let i = 0; i < N; i++) allowed[i] = free[i] && moist[i] && (!within || within[i]) ? 1 : 0;
    if (!allowed[seedTile]) return 0;
    const tiles = growBlob(vegRng, allowed, W, H, seedTile, size, 1.5);
    for (const i of tiles) free[i] = 0;
    const role = anchorRole("berryPatch", tiles);
    const f: BerryPatchFeature = {
      id: featureId(seed, "berryPatch", role),
      kind: "berryPatch",
      origin: "generated",
      role,
      locked: false,
      params: { area: tilesToRuns(tiles, W), density: 1, ripeShare },
    };
    out.push(f);
    bushCount += tiles.length;
    return tiles.length;
  };
  if (g.start) {
    const want = near.bushes;
    // 2–3 patches as PLAN §7.7 says, more when the target is large or the moist land near the
    // start is narrow (a canyon floor): patches until the target is met, at most 6 a pass. They go
    // within the colony's walk first (D85 counts 20 tiles' walk), beyond it only when that walk
    // holds too little moist land.
    const each = Math.max(4, Math.floor(want / Math.max(2, Math.ceil(want / 30))));
    let got = 0;
    for (const within of nearWalk ? [nearWalk, null] : [null]) {
      if (got >= want) break;
      const w = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const x = i % W;
        const y = (i - x) / W;
        const dx = x - g.start.x;
        const dy = y - g.start.y;
        if (dx * dx + dy * dy <= BUSHES.nearStartRadius * BUSHES.nearStartRadius && free[i] && moist[i] && (!within || within[i])) w[i] = (nearWater(i) ? 2 : 1) * byWalk(i);
      }
      for (const s of pickSeeds(vegRng, w, W, 6, 6)) {
        got += patch(s, Math.min(each, Math.max(4, want - got)), 1, within);
        if (got >= want) break;
      }
    }
  }
  // a second district's berries (PLAN §9.8)
  for (const site of sites) {
    const w = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const dx = x - site.x;
      const dy = y - site.y;
      if (dx * dx + dy * dy <= BUSHES.nearStartRadius * BUSHES.nearStartRadius && free[i] && moist[i]) w[i] = nearWater(i) ? 2 : 1;
    }
    let got = 0;
    for (const s of pickSeeds(vegRng, w, W, 4, 6)) {
      got += patch(s, Math.max(4, SITE_BUSHES - got), 1);
      if (got >= SITE_BUSHES) break;
    }
  }
  for (let guard = 0; bushCount < bushTotal && guard < 500; guard++) {
    const w = new Float64Array(N);
    for (let i = 0; i < N; i++) if (free[i] && moist[i]) w[i] = nearWater(i) ? 4 : 1;
    const seeds = pickSeeds(vegRng, w, W, 1, 1);
    if (!seeds.length) break;
    const size = Math.max(4, Math.min(80, Math.floor(vegRng.logNormal(BUSHES.patchMedian, 0.6))));
    if (patch(seeds[0], size, 0.55) === 0) break;
  }

  // ---- groves: single-species, alive on moist soil and stored dead on dry soil (PLAN §7.7)
  const grove = FOREST.grove[spec.settings.resources.groveSize];
  const treeTotal = Math.floor(((density("trees_per_10k", area) * area) / 1e4) * (spec.settings.resources.forestDensity / 100));
  const mixW = spec.settings.resources.speciesMix;
  const species = ["Pine", "Birch", "Oak", "Succulent"] as const;
  const speciesW = [mixW.pine, mixW.birch, mixW.oak, mixW.succulent];
  const anySpecies = speciesW.some((w) => w > 0);
  let treeCount = 0;
  const growGrove = (seedTile: number, size: number, living: boolean, within: Uint8Array | null = null): number => {
    const allowed = new Uint8Array(N);
    for (let i = 0; i < N; i++) allowed[i] = free[i] && (living ? moist[i] : !moist[i]) && (!within || within[i]) ? 1 : 0;
    if (!allowed[seedTile]) return 0;
    const tiles = growBlob(vegRng, allowed, W, H, seedTile, size, 0.8);
    let sp: (typeof species)[number] = species[anySpecies ? vegRng.weighted(speciesW) : 0];
    if (sp === "Succulent" && living) sp = livingSpecies(speciesW); // succulents are the dry-land tree
    for (const i of tiles) free[i] = 0;
    const role = anchorRole("forest/grove", tiles);
    const f: ForestFeature = {
      id: featureId(seed, "forest", role),
      kind: "forest",
      origin: "generated",
      role,
      locked: false,
      params: { area: tilesToRuns(tiles, W), density: 1, speciesMix: { [sp]: 1 }, groveSize: tiles.length, life: "auto", youngShare: FOREST.youngShare },
    };
    out.push(f);
    treeCount += tiles.length;
    return tiles.length;
  };
  if (g.start) {
    const r = FOREST.nearStart.radius;
    let got = 0;
    const each = Math.floor(grove.median * 1.5);
    // within the colony's walk first, as the berries
    for (const within of nearWalk ? [nearWalk, null] : [null]) {
      if (got >= near.trees) break;
      const w = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const x = i % W;
        const y = (i - x) / W;
        const dx = x - g.start.x;
        const dy = y - g.start.y;
        if (dx * dx + dy * dy <= r * r && free[i] && moist[i] && (!within || within[i])) w[i] = byWalk(i);
      }
      for (const s of pickSeeds(vegRng, w, W, Math.max(4, Math.ceil(near.trees / Math.max(1, each)) + 3), 5)) {
        got += growGrove(s, each, true, within);
        if (got >= near.trees) break;
      }
    }
  }
  // a second district's grove (PLAN §9.8)
  for (const site of sites) {
    const w = new Float64Array(N);
    const r = FOREST.nearStart.radius;
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const dx = x - site.x;
      const dy = y - site.y;
      if (dx * dx + dy * dy <= r * r && free[i] && moist[i]) w[i] = 1;
    }
    let got = 0;
    const each = Math.floor(grove.median * 1.5);
    for (const s of pickSeeds(vegRng, w, W, Math.max(4, Math.ceil(SITE_TREES / Math.max(1, each)) + 3), 5)) {
      got += growGrove(s, each, true);
      if (got >= SITE_TREES) break;
    }
  }
  const livingTarget = Math.floor(treeTotal * FOREST.livingShare);
  for (const size of groupSizes(vegRng, Math.max(0, livingTarget - treeCount), grove.median, grove.cap)) {
    const w = new Uint8Array(N);
    for (let i = 0; i < N; i++) w[i] = free[i] && moist[i] ? 1 : 0;
    const seeds = pickSeeds(vegRng, w, W, 1, 1);
    if (!seeds.length) break;
    growGrove(seeds[0], size, true);
  }
  for (const size of groupSizes(vegRng, Math.max(0, treeTotal - treeCount), grove.median, grove.cap)) {
    const w = new Uint8Array(N);
    for (let i = 0; i < N; i++) w[i] = free[i] && !moist[i] ? 1 : 0;
    const seeds = pickSeeds(vegRng, w, W, 1, 1);
    if (!seeds.length) break;
    growGrove(seeds[0], size, false);
  }
  return out;
}

/** The species a living grove takes when the draw gave Succulent: the heaviest of the others,
 *  Pine when all three weigh nothing. */
function livingSpecies(w: readonly number[]): "Pine" | "Birch" | "Oak" {
  if (w[1] > w[0] && w[1] >= w[2]) return "Birch";
  if (w[2] > w[0] && w[2] > w[1]) return "Oak";
  return "Pine";
}
