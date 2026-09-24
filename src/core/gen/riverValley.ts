// River Valley (PLAN §8), the prototype's archetype ported as a feature planner (ROADMAP M1).
// Premise "gorge-dammed basin": a river enters from the west edge, drops over a cascade into a
// basin that a rock ridge pinches into a gorge (the dam site), then over falls, past a badwater
// marsh, and leaves at the east edge. The colony starts on a bench above the basin.
//
// The planner emits features only (PLAN §19.2). It builds the terrain part of them (build steps up
// to the water sources) to find flat ground for the marsh, then builds through the canonical water
// settle to plan groves, berry patches and ruin fields on the simulated moisture, and hands the full
// list to the one build pipeline.

import type { Orientation } from "../format/footprints";
import { arcAtX, bedAt, floorAt, pathField, pointAtArc, polygonMask, round } from "../features/geometry";
import { buildMap, START_CLEAR_RADIUS, type LockedLayer, type SettleCache } from "../features/build";
import { featureId } from "../features/ids";
import { planSetPiece, type PlanContext as PieceContext, type PlanRecord } from "../features/setpieces";
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
import { BADWATER_RATIO, BUSHES, density, FOREST, RIVER_FLOW_MULTIPLIER, RUIN_HEIGHT_SHARES, RUINS } from "./calibrated";

const BED_TOP = 8; // basin bed level; the upper reach sits 2 higher, the lower reach 2 lower
const MIN_RIVER_WIDTH = 4.4; // tiles with centre distance < 2.2 are channel (5 rows)
const MAX_RIVER_WIDTH = 8.4;

/** Channel width for a flow: wide enough that the water stays about 0.55 deep, well inside its
 *  one-level banks. A channel passes its flow over a lip at about 0.3·q deep (q = flow per tile of
 *  width) and its surface climbs about 0.0015·q per tile upstream of the lip (PLAN §9.2), so long
 *  flat reaches on big maps need a wider channel (PLAN §20, D26). */
export function riverWidth(flow: number, W: number): number {
  const reach = 0.8 * W; // the longest flat reach, in tiles along the river
  const q = 0.55 / (0.3 + 0.0015 * reach);
  return Math.min(MAX_RIVER_WIDTH, Math.max(MIN_RIVER_WIDTH, round(flow / q, 2)));
}
const MEANDER = 0.16;
const BENCH_RADIUS = { small: 5, normal: 6, large: 8 } as const;

/** Regeneration constraints for the planner (PLAN §7.0). */
export interface PlanContext {
  /** Tiles the planner keeps its rivers, lakes, set pieces, start and resources off: the player's
   *  features, locked regions and keep-out regions. */
  protect: Uint8Array | null;
  /** The player's features, built with the plan, so the resources are planned on their ground. */
  features: readonly Feature[];
  /** What a regeneration keeps under locks. */
  locked: LockedLayer | null;
}

/** The planner could not keep its layout off the protected tiles. */
export class PlanConflict extends Error {}

/** Layouts drawn per attempt before the planner gives up on the protected tiles. */
export const MAX_LAYOUT_TRIES = 24;

export function planRiverValley(spec: MapSpec, attempt: number, candidate = 0, settleCache?: SettleCache, context?: PlanContext): Feature[] {
  const W = spec.size.x;
  const H = spec.size.y;
  const seed = spec.seed;
  const rng = stream(seed, "layout", candidate, attempt);
  const id = (kind: Feature["kind"], role: string) => featureId(seed, kind, role);

  for (let tryN = 0; ; tryN++) {

    // ------------------------------------------------------------------ macro layout (prototype plan_valley)
    const ph1 = rng.float() * TWO_PI;
    const ph2 = rng.float() * TWO_PI;
    const l1 = W * rng.range(0.7, 1.1);
    const l2 = W * rng.range(0.3, 0.45);
    // the valley floor reaches about halfWidth + 11 tiles from the river before the first terrace;
    // keeping that inside the map keeps a dammed basin off the map edge (edges drain, PLAN §9.1)
    const edgeMargin = H * 0.2 + 12;
    const centre = (x: number) =>
      Math.min(
        H - 1 - edgeMargin,
        Math.max(edgeMargin, H / 2 + H * MEANDER * sinDet((TWO_PI * x) / l1 + ph1) + H * MEANDER * 0.35 * sinDet((TWO_PI * x) / l2 + ph2)),
      );
    // the gorge goes on the gentlest stretch near its drawn place: a river crossing the ridge at a
    // steep angle leaves a gap no short straight dam can close (PLAN §9.1, D25)
    const gorgeDraw = Math.floor(W * rng.range(0.42, 0.58));
    let gorgeX = gorgeDraw;
    let gentlest = Infinity;
    const reachX = Math.round(W * 0.08);
    for (let x = Math.max(Math.round(W * 0.38), gorgeDraw - reachX); x <= Math.min(Math.round(W * 0.62), gorgeDraw + reachX); x++) {
      const slope = Math.abs(centre(x + 3) - centre(x - 3)) / 6;
      const score = slope + 0.002 * Math.abs(x - gorgeDraw);
      if (score < gentlest) {
        gentlest = score;
        gorgeX = x;
      }
    }
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
    const riverW = riverWidth(flow, W);

    const river: RiverFeature = {
      id: riverId,
      kind: "river",
      origin: "generated",
      role: "river/main",
      locked: false,
      params: {
        path,
        width: riverW,
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

    // the set pieces come from the shared builders (PLAN §7.3, §19.3), planned on the macro layout
    const layoutCtx = (features: Feature[]): PieceContext => ({ W, H, seed, features, heights: new Uint8Array(0) });
    const piece = (kind: SetPieceFeature["params"]["kind"], request: PlanRecord, ctx: PieceContext, fid: string, role: string): SetPieceFeature => {
      const r = planSetPiece(kind, request, ctx, { id: fid, origin: "generated", role }, true);
      if (!r.ok) throw new Error(`River Valley's ${role}: ${r.errors.join("; ")}`);
      return r.feature;
    };
    const waterfall = (fid: string, role: string, at: number): SetPieceFeature =>
      piece("waterfall", { mode: "on-river", river: riverId, at, drop: 2 }, layoutCtx([river]), fid, role);

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
      // the basin stays 4 tiles off the map edges: a reservoir must never touch an edge (PLAN §9.1)
      left.push([round(x, 2), round(Math.min(H - 5, c + w), 2)]);
      right.push([round(x, 2), round(Math.max(4, c - w), 2)]);
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

    // the ridge's top stands 3 above the crest: the floodplain + 4 (PLAN §9.1, D25)
    const damSite = piece("damSite", { river: riverId, at: sGorge, crest: 2 }, layoutCtx([river]), id("setPiece", "setpiece/damSite/primary"), "setpiece/damSite/primary");

    // the start bench: above the basin, 6–10 tiles from the channel's edge, door facing the river
    // (the dam site must lie within 40 tiles of the start, PLAN §9.1: move the start downstream,
    // then across the river, until the gorge is within 34 tiles of it)
    let sx = rng.int(basinX0 + 2, Math.max(basinX0 + 3, gorgeX - 6));
    let side = rng.float() < 0.5 ? 1 : -1;
    const dist = riverW / 2 + rng.int(6, 10); // 6–10 tiles from the channel edge (PLAN §7.2)
    // walk away from the river until the true distance to its path is `dist` (the river can be
    // steep here, so the vertical offset alone would put the start in the water)
    const startY = (x: number, sd: number) => {
      let y = Math.round(centre(x));
      while (y > 8 && y < H - 9 && distToPath(path, x, y) < dist) y += sd;
      return Math.min(H - 9, Math.max(8, y));
    };
    const toGorge = (x: number, sd: number) => {
      const dx = x - gorgePoint[0];
      const dy = startY(x, sd) - gorgePoint[1];
      return Math.sqrt(dx * dx + dy * dy);
    };
    const lastX = Math.max(basinX0 + 2, gorgeX - 7);
    while (sx < lastX && toGorge(sx, side) > 34) sx++;
    if (toGorge(sx, side) > 34 && toGorge(sx, -side) < toGorge(sx, side)) side = -side;
    const sy = startY(sx, side);
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

    // regeneration (PLAN §7.0): the layout stays off the player's features, locks and keep-out
    // regions; a layout that touches them is drawn again from the same stream
    if (context?.protect) {
      const hit = layoutConflict(context.protect, W, H, river, lake, start, damSite);
      if (hit) {
        if (tryN + 1 < MAX_LAYOUT_TRIES) continue;
        throw new PlanConflict(`the river valley could not keep ${hit} off your features, locks and keep-out areas (${MAX_LAYOUT_TRIES} layouts tried)`);
      }
    }

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

    // ------------------------------------------------------------------ the badwater marsh (PLAN §9.5, D24)
    // a BadwaterSource 3×3 on flat floodplain beside the river below the falls, as far from the start
    // as possible (the prototype's rule, with its offset from the channel scaled to the channel's
    // width); its water joins the river downstream of the start
    const ratio = BADWATER_RATIO[spec.settings.hazards.badwater];
    if (ratio > 0) {
      const ground = buildMap({ W, H, seed, features: [...layout, ...(context?.features ?? [])], locked: context?.locked }, { stopBeforeWater: true });
      const strength = Math.min(3, Math.max(1, round(flow * ratio, 2)));
      const role = "setpiece/badwaterBasin/marsh";
      const marsh = planSetPiece(
        "badwaterBasin",
        { mode: "marsh", badwater: spec.settings.hazards.badwater, river: riverId, fromX: fallsX + 3, far: [sx, sy], strength },
        { W, H, seed, features: layout, heights: ground.heights, occupied: ground.occupied, locked: context?.protect ?? null },
        { id: id("setPiece", role), origin: "generated", role },
      );
      // no flat floodplain below the falls: this layout has no marsh
      if (marsh.ok) layout.splice(layout.length - 1, 0, marsh.feature);
    }

    // ------------------------------------------------------------------ resources on the settled water
    const base = buildMap({ W, H, seed, features: [...layout, ...(context?.features ?? [])], locked: context?.locked }, { stopBeforeResources: true, settleCache });
    const resources = planResources(spec, base, candidate, attempt, context);
    return [...layout, ...resources];
  }
}

// --------------------------------------------------------------------------------------- resources

interface Ground {
  W: number;
  H: number;
  heights: Uint8Array;
  water: Float64Array;
  moisture: Float64Array;
  soilContamination: Float64Array;
  occupied: Uint8Array;
  start?: { x: number; y: number };
}

function planResources(spec: MapSpec, g: Ground, candidate: number, attempt: number, context?: PlanContext): Feature[] {
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
    // living plants need moist, dry-footed, clean soil
    moist[i] = g.moisture[i] > 0 && !wet[i] && !(g.soilContamination[i] > 0) ? 1 : 0;
  }
  // regeneration: nothing on the player's features, locked regions or keep-out regions
  const keepOff = context?.protect;
  const kept = context?.locked?.mask;
  if (keepOff || kept) for (let i = 0; i < N; i++) if (keepOff?.[i] || kept?.[i]) free[i] = 0;
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

/** Distance from (x, y) to a polyline. */
function distToPath(path: Point[], x: number, y: number): number {
  let best = Infinity;
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
    const d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export type { Rng };

/** What of a drawn layout lands on protected tiles (PLAN §7.0): the channel with a tile of bank,
 *  the basin, the dam ridge across the valley floor, or the start with its bench and clear zone. */
function layoutConflict(
  protect: Uint8Array,
  W: number,
  H: number,
  river: RiverFeature,
  lake: LakeFeature,
  start: StartFeature,
  dam: SetPieceFeature,
): string | null {
  const N = W * H;
  const field = pathField(river.params.path, W, H);
  const bank = river.params.width / 2 + 1;
  for (let i = 0; i < N; i++) if (protect[i] && field.d[i] < bank) return "the river";
  const basin = polygonMask(lake.params.outline, W, H);
  for (let i = 0; i < N; i++) if (protect[i] && basin[i]) return "the basin";
  const [cx, cy] = start.params.position;
  const r = Math.max(start.params.benchRadius, START_CLEAR_RADIUS + 1);
  for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) if (protect[y * W + x]) return "the start";
  // the ridge reaches across the valley floor and into the first terraces (damSite.ts)
  const plan = dam.params.plan as { at: number; thickness: number; wobble: number };
  const path = river.params.path;
  const c = pointAtArc(path, plan.at).p;
  const ax = path[path.length - 1][0] - path[0][0];
  const ay = path[path.length - 1][1] - path[0][1];
  const al = Math.sqrt(ax * ax + ay * ay) || 1;
  const half = plan.thickness / 2 + plan.wobble + 1;
  const across = H * 0.2 + 12;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!protect[y * W + x]) continue;
      const along = ((x - c[0]) * ax + (y - c[1]) * ay) / al;
      const side = ((y - c[1]) * ax - (x - c[0]) * ay) / al;
      if (Math.abs(along) <= half && Math.abs(side) <= across) return "the dam site";
    }
  return null;
}
