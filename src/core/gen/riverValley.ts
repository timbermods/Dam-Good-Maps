// River Valley (PLAN §8), the prototype's archetype ported as a feature planner (ROADMAP M1).
// Premise "gorge-dammed basin": a river enters from the west edge, drops over a cascade into a
// basin that a rock ridge pinches into a gorge (the dam site), then over falls, and leaves at the
// east edge. The colony starts on a bench above the basin.
//
// The planner emits features only (PLAN §19.2). It builds the terrain part of them once (build
// steps up to the slopes and the planned water) to plan groves, berry patches and ruin fields on
// real ground, then hands the full list to the one build pipeline.

import type { Orientation } from "../format/footprints";
import { build } from "../features/build";
import { arcAtX, bedAt, pointAtArc, round } from "../features/geometry";
import { featureId } from "../features/ids";
import type {
  BerryPatchFeature,
  Feature,
  ForestFeature,
  LakeFeature,
  LandformFeature,
  Point,
  RiverFeature,
  RuinFieldFeature,
  SetPieceFeature,
  StartFeature,
  TerraceBand,
} from "../features/schema";
import { distanceFrom, tilesToRuns } from "../math/grid";
import { PI, sinDet, TWO_PI } from "../math/detmath";
import { stream, type Rng } from "../math/rng";
import type { MapSpec } from "../spec/mapspec";
import { groupSizes, growBlob, pickSeeds, punchHoles } from "./blobs";
import { BUSHES, density, FOREST, RIVER_FLOW_MULTIPLIER, RUIN_HEIGHT_SHARES, RUINS } from "./calibrated";

const BED_TOP = 8; // basin bed level; the upper reach sits 2 higher, the lower reach 2 lower
const RIVER_WIDTH = 4.4; // tiles with centre distance < 2.2 are channel (5 rows)
const MEANDER = 0.16;
const BENCH_RADIUS = { small: 5, normal: 6, large: 8 } as const;

export function planRiverValley(spec: MapSpec, attempt: number, candidate = 0): Feature[] {
  const W = spec.size.x;
  const H = spec.size.y;
  const seed = spec.seed;
  const rng = stream(seed, "layout", candidate, attempt);
  const id = (kind: Feature["kind"], role: string) => featureId(seed, kind, role);

  // ------------------------------------------------------------------ macro layout (prototype plan_valley)
  const ph1 = rng.float() * TWO_PI;
  const ph2 = rng.float() * TWO_PI;
  const l1 = W * rng.range(0.7, 1.1);
  const l2 = W * rng.range(0.3, 0.45);
  const centre = (x: number) =>
    H / 2 + H * MEANDER * sinDet((TWO_PI * x) / l1 + ph1) + H * MEANDER * 0.35 * sinDet((TWO_PI * x) / l2 + ph2);
  const gorgeX = Math.floor(W * rng.range(0.42, 0.58));
  const basinLen = Math.floor(W * rng.range(0.14, 0.2));
  const basinX0 = Math.max(4, gorgeX - basinLen - 2);
  const basinX1 = gorgeX - 6; // ends clear of the ridge (it spans about ±4 around the gorge)
  const fallsX = Math.floor(Math.min(W - 8, gorgeX + W * rng.range(0.16, 0.24)));
  const cascadeX = Math.max(3, basinX0 - 2);
  const halfWidth = round(H * 0.2, 2);

  const path: Point[] = [];
  for (let x = 0; x < W - 1; x += 4) path.push([x, round(centre(x), 2)]);
  path.push([W - 1, round(centre(W - 1), 2)]);

  const riverId = id("river", "river/main");
  const cascadeId = id("setPiece", "setpiece/waterfall/cascade");
  const fallsId = id("setPiece", "setpiece/waterfall/falls");
  const sCascade = round(arcAtX(path, cascadeX), 2);
  const sFalls = round(arcAtX(path, fallsX), 2);
  const sGorge = round(arcAtX(path, gorgeX), 2);
  const bedProfile = {
    start: BED_TOP + 2,
    steps: [
      { at: sCascade, drop: 2, setPiece: cascadeId },
      { at: sFalls, drop: 2, setPiece: fallsId },
    ],
  };
  const floorTop = bedAt(bedProfile, sGorge) + 1; // the basin's floodplain

  const flowBase = density("water_strength_per_10k", W * H) * ((W * H) / 1e4);
  const flow = round(flowBase * RIVER_FLOW_MULTIPLIER[spec.settings.water.riverFlow], 2);

  const river: RiverFeature = {
    id: riverId,
    kind: "river",
    origin: "generated",
    role: "river/main",
    locked: false,
    params: {
      path,
      width: RIVER_WIDTH,
      bedDepth: 1,
      bedProfile,
      flow,
      style: "meandering",
      meander: MEANDER,
      entry: { edge: "west" },
      exit: { edge: "east" },
      badwater: false,
    },
  };

  const waterfall = (fid: string, role: string, at: number): SetPieceFeature => ({
    id: fid,
    kind: "setPiece",
    origin: "generated",
    role,
    locked: false,
    params: { kind: "waterfall", request: { mode: "on-river", drop: 2 }, plan: { mode: "on-river", river: riverId, at, drop: 2 }, report: [] },
  });

  const valley: LandformFeature = {
    id: id("landform", "landform/valley"),
    kind: "landform",
    origin: "generated",
    role: "landform/valley",
    locked: false,
    params: { kind: "valley", edgeStyle: "terraced", along: { river: riverId, halfWidth, floorAboveBed: 1 } },
  };

  const terraces = (side: 1 | -1, name: string): LandformFeature => {
    const bands: TerraceBand[] = [];
    let edge = 0;
    while (edge < H) {
      edge += rng.range(9, 16);
      const rise = rng.float() > 0.18 ? 1 : rng.float() < 0.7 ? 2 : 3;
      bands.push({ at: round(edge - 9, 2), rise });
    }
    return {
      id: id("landform", `landform/terraces/${name}`),
      kind: "landform",
      origin: "generated",
      role: `landform/terraces/${name}`,
      locked: false,
      params: {
        kind: "terraces",
        edgeStyle: "terraced",
        along: {
          river: riverId,
          halfWidth,
          floorAboveBed: 1,
          side,
          baseLevel: floorTop,
          bands,
          wobble: { amp: 3.2, cell: 24, amp2: 0.96, cell2: 8 },
          maxLevel: spec.settings.terrain.highestTerrain,
        },
      },
    };
  };

  // the basin: the valley widens upstream of the gorge; a planned lake (dry until dammed). The
  // outline runs column by column (the river flows west to east), which never self-intersects the
  // way offsets along a meandering path would.
  const left: Point[] = [];
  const right: Point[] = [];
  const steps = Math.max(2, Math.ceil((basinX1 - basinX0) / 2));
  for (let k = 0; k <= steps; k++) {
    const x = basinX0 + ((basinX1 - basinX0) * k) / steps;
    const w = halfWidth * (1 + 0.45 * sinDet((PI * k) / steps));
    const c = centre(x);
    left.push([round(x, 2), round(c + w, 2)]);
    right.push([round(x, 2), round(c - w, 2)]);
  }
  const gorgePoint = pointAtArc(path, sGorge).p;
  const lake: LakeFeature = {
    id: id("lake", "lake/basin/primary"),
    kind: "lake",
    origin: "generated",
    role: "lake/basin/primary",
    locked: false,
    params: {
      outline: [...left, ...right.reverse()],
      floorDepth: 1,
      outlet: { at: [round(gorgePoint[0], 2), round(gorgePoint[1], 2)], sill: bedAt(bedProfile, sGorge), to: "river", target: riverId },
      inflow: { rivers: [riverId] },
      planned: true,
      river: riverId,
    },
  };

  const damSite: SetPieceFeature = {
    id: id("setPiece", "setpiece/damSite/primary"),
    kind: "setPiece",
    origin: "generated",
    role: "setpiece/damSite/primary",
    locked: false,
    params: {
      kind: "damSite",
      request: { crest: 2 },
      plan: { river: riverId, at: sGorge, thickness: 5, halfSpan: round(halfWidth + 14, 2), topLevel: floorTop + 4, crest: 2, wobble: 1.25 },
      report: [],
    },
  };

  // the start bench: above the basin, 6–9 tiles from the channel, door facing the river
  const sx = rng.int(basinX0 + 2, Math.max(basinX0 + 3, gorgeX - 6));
  const side = rng.float() < 0.5 ? 1 : -1;
  const dist = rng.int(6, 10);
  const sy = Math.min(H - 9, Math.max(8, Math.round(centre(sx) + side * dist)));
  const orientation: Orientation = centre(sx) < sy ? "Cw0" : "Cw180";
  const start: StartFeature = {
    id: id("start", "start/main"),
    kind: "start",
    origin: "generated",
    role: "start/main",
    locked: false,
    params: {
      position: [sx, sy],
      orientation,
      benchRadius: BENCH_RADIUS[spec.settings.start.area],
      benchLevel: floorTop + 1,
      player: 0,
    },
  };

  const layout: Feature[] = [
    river,
    valley,
    terraces(1, "north"),
    terraces(-1, "south"),
    lake,
    damSite,
    waterfall(cascadeId, "setpiece/waterfall/cascade", sCascade),
    waterfall(fallsId, "setpiece/waterfall/falls", sFalls),
    start,
  ];

  // ------------------------------------------------------------------ resources on the built terrain
  const base = build(spec, layout, { stopBeforeResources: true });
  const resources = planResources(spec, base, candidate, attempt);
  return [...layout, ...resources];
}

// --------------------------------------------------------------------------------------- resources

interface Ground {
  W: number;
  H: number;
  heights: Uint8Array;
  water: Float32Array;
  moisture: Float32Array;
  occupied: Uint8Array;
  start?: { x: number; y: number };
}

function planResources(spec: MapSpec, g: Ground, candidate: number, attempt: number): Feature[] {
  const { W, H } = g;
  const N = W * H;
  const area = N;
  const seed = spec.seed;
  const free = new Uint8Array(N);
  const moist = new Uint8Array(N);
  const wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    wet[i] = g.water[i] > 0 ? 1 : 0;
    free[i] = !g.occupied[i] && !wet[i] ? 1 : 0;
    moist[i] = g.moisture[i] > 0 && !wet[i] ? 1 : 0;
  }
  const startMask = new Uint8Array(N);
  if (g.start) {
    for (let y = g.start.y - 1; y <= g.start.y + 1; y++)
      for (let x = g.start.x - 1; x <= g.start.x + 1; x++) startMask[y * W + x] = 1;
  }
  const startDist = distanceFrom(startMask, W, H);
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
  const minStart = Math.max(RUINS.minStartDist, spec.settings.start.rules.ruinsWithin);
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
  const patch = (seedTile: number, size: number, ripeShare: number): number => {
    const allowed = new Uint8Array(N);
    for (let i = 0; i < N; i++) allowed[i] = free[i] && moist[i] ? 1 : 0;
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
    const w = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const dx = x - g.start.x;
      const dy = y - g.start.y;
      if (dx * dx + dy * dy <= BUSHES.nearStartRadius * BUSHES.nearStartRadius && free[i] && moist[i]) w[i] = nearWater(i) ? 2 : 1;
    }
    const seeds = pickSeeds(vegRng, w, W, 2, 6);
    const want = spec.settings.resources.berriesNearStart;
    for (const s of seeds) patch(s, Math.max(4, Math.floor(want / Math.max(1, seeds.length))), 1);
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
  let treeCount = 0;
  const growGrove = (seedTile: number, size: number, living: boolean): number => {
    const allowed = new Uint8Array(N);
    for (let i = 0; i < N; i++) allowed[i] = free[i] && (living ? moist[i] : !moist[i]) ? 1 : 0;
    if (!allowed[seedTile]) return 0;
    const tiles = growBlob(vegRng, allowed, W, H, seedTile, size, 0.8);
    let sp: (typeof species)[number] = species[vegRng.weighted(speciesW)];
    if (sp === "Succulent" && living) sp = "Pine"; // succulents are the dry-land tree
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
    const w = new Float64Array(N);
    const r = FOREST.nearStart.radius;
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const dx = x - g.start.x;
      const dy = y - g.start.y;
      if (dx * dx + dy * dy <= r * r && free[i] && moist[i]) w[i] = 1;
    }
    let got = 0;
    for (const s of pickSeeds(vegRng, w, W, 4, 5)) {
      got += growGrove(s, Math.floor(grove.median * 1.5), true);
      if (got >= FOREST.nearStart.minLiving) break;
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

export type { Rng };
