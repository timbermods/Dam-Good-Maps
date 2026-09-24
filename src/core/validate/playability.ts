// Playability checks (PLAN §11.3–11.5): the map's own water settled with the game's rules, then
// whether a colony can survive and grow from its start. Check ids, rules and thresholds match
// prototype/playability.py, which stays the oracle: tools/oracle.ts runs both on the same files and
// compares every verdict.
//
// Unlike the prototype's first version, every emitter and blocker is handled through its
// footprint (PLAN §11.5): a BadwaterSource emits on its rotated 3×3, seeps, badtide drains and
// aquifers follow their rules (sim/model.ts), and multi-tile objects block walking on every tile.
// Nothing here assumes one start per map beyond vanilla's `start.count`: the start checks run for
// "the start" through one function, which Timber Together maps (D5) can call per colony.

import { damSites, type DamSite } from "../analysis/damsites";
import { components, walkRegions } from "../analysis/regions";
import { footprintTiles, slopeHighSide, worldBlocks, FOOTPRINTS } from "../format/footprints";
import { polygonMask } from "../features/geometry";
import type { Feature } from "../features/schema";
import { density, DROUGHT, REACH_MIN, reservoirNeeded } from "../gen/calibrated";
import { distanceFrom } from "../math/grid";
import { soilContamination } from "../sim/contamination";
import { droughtStorage } from "../sim/drought";
import { moistureBarrier, type MapObject } from "../sim/model";
import { moisture } from "../sim/moisture";
import type { CanonicalWater } from "../sim/prefill";
import { TICKS_PER_DAY, type WaterModel } from "../sim/water";
import { DIFFICULTY_RULES, type Difficulty, type MapSpec } from "../spec/mapspec";
import type { Collector, FixOp } from "./report";

/** Water deeper than this counts as a water tile (prototype `wet = D > 0.05`). */
export const WET = 0.05;
/** Water with this much contamination or more is badwater to a beaver. */
export const BAD = 0.05;
export const PUMP_REACH = 2; // Folktails WaterPump pipe depth below its base
export const NEAR = 20; // gatherers, lumberjacks and scavengers work within 20 steps
export const RESERVOIR_RADIUS = 40;
export const BLUEBERRY_DAYS_TO_DIE_DRY = 9;
export const TREES = ["Pine", "Birch", "Oak"] as const;
export const WALK_BLOCKERS = new Set([
  "Thorns", "Blockage", "NaturalDam", "UnstableCore", "GeothermalField", "UndergroundRuins", "SmallRelic", "MediumRelic", "LargeRelic",
]);
const RESERVE = { scarce: 1, normal: 1.5, plenty: 3 } as const;
const START_AREA = { small: 0.6, normal: 1, large: 1.8 } as const;

/** Thresholds for one map: from its spec, or the difficulty's defaults for an imported map. */
export interface Rules {
  difficulty: Difficulty;
  waterWithin: number;
  treesWithin20: number;
  bushesWithin20: number;
  badwaterWithin: number;
  ruinsWithin: number;
  reachMin: number;
  droughtDays: number;
  /** Stored water needed near the start: the colony's drought need × the drought reserve. */
  reservoirNeed: number;
  maxWaterShare: number;
  multipliers: { scrap: number; trees: number; bushes: number };
}

export function rulesFor(spec: MapSpec | null, designedFor: Difficulty = "normal"): Rules {
  const difficulty = spec?.designedFor ?? designedFor;
  const d = DIFFICULTY_RULES[difficulty];
  const s = spec?.settings;
  const r = s?.start.rules ?? d;
  return {
    difficulty,
    waterWithin: r.waterWithin,
    treesWithin20: r.treesWithin20,
    bushesWithin20: r.bushesWithin20,
    badwaterWithin: s ? s.hazards.badwaterDistance : r.badwaterWithin,
    ruinsWithin: r.ruinsWithin,
    reachMin: REACH_MIN[s?.terrain.buildableLand ?? "normal"] * START_AREA[s?.start.area ?? "normal"],
    droughtDays: DROUGHT[difficulty].days,
    reservoirNeed: reservoirNeeded(difficulty) * RESERVE[s?.water.droughtReserve ?? "normal"],
    maxWaterShare: spec && (spec.theme === "lakeBasin" || spec.theme === "islands") ? 0.55 : 0.35,
    multipliers: s
      ? { scrap: s.resources.ruins / 100, trees: s.resources.forestDensity / 100, bushes: s.resources.berryBushes / 100 }
      : { scrap: 1, trees: 1, bushes: 1 },
  };
}

export interface PlayabilityInput {
  W: number;
  H: number;
  surface: Uint8Array;
  /** Every map object, in file order. */
  objects: readonly MapObject[];
  model: WaterModel;
  water: CanonicalWater;
  rules: Rules;
  /** The features the map was built from (generated and edited maps); null for imports. */
  features: readonly Feature[] | null;
  /** Entity ids in object order, for `where` and fixes. */
  ids?: readonly string[];
}

/** What the checks measured, for the preview layers and the map card. */
export interface PlayabilityAnalysis {
  moisture: Float64Array;
  soilContamination: Float64Array;
  /** Land walkable from the start (1), for the reach layer. */
  reach: Uint8Array;
  /** Chamfer distance from the start's 3×3, in tiles. */
  startDistance: Float64Array | null;
  /** Distance from the start to pumpable clean water (Infinity if none). */
  waterDistance: number;
  damSites: DamSite[];
  /** The best dam site within 40 tiles of the start, and the natural water kept there. */
  bestDam: DamSite | null;
  naturalStorage: number;
}

const N4: readonly [number, number][] = [[0, -1], [-1, 0], [0, 1], [1, 0]];

export function checkPlayability(inp: PlayabilityInput, c: Collector): PlayabilityAnalysis {
  const { W, H, surface: h, objects, water, rules, model } = inp;
  const N = W * H;
  const D = water.depth;
  const C = water.contamination;
  const id = (k: number) => inp.ids?.[k];

  // ---- blockers by footprint: walking (Thorns, Blockage, relics, ...) and moisture (Thorns)
  const blocked = new Uint8Array(N);
  for (const o of objects) {
    if (!WALK_BLOCKERS.has(o.template) || !FOOTPRINTS[o.template]) continue;
    for (const [x, y] of footprintTiles(o.template, o)) if (x >= 0 && x < W && y >= 0 && y < H) blocked[y * W + x] = 1;
  }
  const barrier = moistureBarrier(W, H, objects);

  // ---- water
  const wet = new Uint8Array(N);
  const clean = new Uint8Array(N);
  let wetCount = 0;
  let cleanCount = 0;
  for (let i = 0; i < N; i++) {
    if (D[i] > WET) {
      wet[i] = 1;
      wetCount++;
      if (C[i] < BAD) {
        clean[i] = 1;
        cleanCount++;
      }
    }
  }
  c.add({
    id: "water.settles",
    class: "playability",
    ok: water.settled,
    value: water.ticks,
    limit: 4 * TICKS_PER_DAY,
    message: water.settled
      ? `the water settles after ${water.ticks} ticks (${(water.ticks / TICKS_PER_DAY).toFixed(1)} days)`
      : `the water is still moving after 4 game days`,
  });
  const share = wetCount / N;
  c.add({
    id: "water.no_flood",
    class: "playability",
    ok: share <= rules.maxWaterShare,
    value: Math.round(share * 1000) / 1000,
    limit: rules.maxWaterShare,
    message: `${Math.round(share * 100)}% of the map is under water (at most ${Math.round(rules.maxWaterShare * 100)}%; official maps reach 40% at p90)`,
  });
  const minClean = Math.floor(0.02 * N);
  c.add({
    id: "water.clean_exists",
    class: "playability",
    ok: cleanCount >= 0.02 * N,
    value: cleanCount,
    limit: minClean,
    message: `${cleanCount} tiles of clean water (at least 2% of the map, ${minClean})`,
  });
  checkOutflow(inp, c);
  const bodies = components(clean, W, H, false);
  let largest = 0;
  for (const s of bodies.sizes) if (s > largest) largest = s;
  c.add({
    id: "water.clean_reach",
    class: "playability",
    ok: largest >= 40,
    value: largest,
    limit: 40,
    message: `the largest body of clean water badwater never reaches has ${largest} tiles (at least 40)`,
  });
  const planned = inp.features?.some((f) => f.kind === "setPiece" && f.params.kind === "badwaterBasin" && (f.params.plan as { outlet?: unknown }).outlet);
  // a source never stops, so a blocked outlet only holds the badwater while the basin fills: the
  // proof of §9.5 comes with the badwater settings that place basins (roadmap M6, D51)
  if (planned) c.notApplicable("water.badwater_contained", "playability", "the containment rule comes with the badwater settings (roadmap M6)");
  else c.notApplicable("water.badwater_contained", "playability", "no badwater basin with a planned outlet on this map");

  const M = moisture(h, D, C, W, H, barrier);
  const SC = soilContamination(h, D, C, W, H, barrier);
  const analysis: PlayabilityAnalysis = {
    moisture: M,
    soilContamination: SC,
    reach: new Uint8Array(N),
    startDistance: null,
    waterDistance: Infinity,
    damSites: [],
    bestDam: null,
    naturalStorage: 0,
  };

  // ---- the start (vanilla: exactly one; `start.count` reports anything else)
  const starts = objects.map((o, k) => [o, k] as const).filter(([o]) => o.template === "StartingLocation");
  if (starts.length !== 1) {
    for (const cid of START_CHECKS) c.notApplicable(cid, "playability", `needs exactly one start (the map has ${starts.length})`, cid === "plants.drought");
    return analysis;
  }
  checkStart(inp, c, starts[0][0], { M, SC, wet, clean, blocked, barrier }, analysis, id);
  return analysis;
}

/** The checks that need the start, in report order. */
const START_CHECKS = [
  "start.dry", "start.water", "start.badwater", "start.reach", "start.reach_water", "start.food", "start.wood", "start.ruins_clear",
  "plants.survive", "plants.drought", "water.reservoir", "resources.scrap", "resources.trees", "resources.bushes", "ruins.fields",
  "ruins.access", "extras.placement",
];

function checkOutflow(inp: PlayabilityInput, c: Collector): void {
  const { W, H, model, water, features } = inp;
  if (!features) {
    c.notApplicable("water.outflow", "playability", "needs the map's planned lakes (imported maps have none)");
    return;
  }
  const N = W * H;
  const any = new Uint8Array(N);
  for (let i = 0; i < N; i++) any[i] = water.depth[i] > 0 ? 1 : 0;
  const { labels } = components(any, W, H, false);
  const emitting = new Uint8Array(N);
  for (const e of model.emitters) for (const i of e.cells) emitting[i] = 1;
  // regions that drain: they reach a map-edge tile that is not walled off by a source
  const drains = new Set<number>();
  for (let i = 0; i < N; i++) {
    if (labels[i] < 0 || emitting[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) drains.add(labels[i]);
  }
  for (const f of features) {
    if (f.kind !== "lake") continue;
    const mask = polygonMask(f.params.outline, W, H);
    for (let i = 0; i < N; i++) if (mask[i] && labels[i] >= 0) drains.add(labels[i]);
  }
  const bad: [number, number][] = [];
  for (const e of model.emitters) {
    if (!(e.strength > 0)) continue;
    const lab = labels[e.cells[0]];
    if (lab >= 0 && !drains.has(lab)) bad.push([e.cells[0] % W, Math.floor(e.cells[0] / W)]);
  }
  c.add({
    id: "water.outflow",
    class: "playability",
    ok: bad.length === 0,
    value: bad.length,
    limit: 0,
    message: bad.length
      ? `${bad.length} sources feed water that reaches neither a map edge nor a planned lake (it would pool and flood)`
      : "every source's water drains to a map edge or a planned lake",
    ...(bad.length ? { where: { tiles: bad.slice(0, 20) } } : {}),
  });
}

interface Fields {
  M: Float64Array;
  SC: Float64Array;
  wet: Uint8Array;
  clean: Uint8Array;
  blocked: Uint8Array;
  /** Thorns: no moisture, no soil contamination (null when the map has none). */
  barrier: Uint8Array | null;
}

function checkStart(
  inp: PlayabilityInput,
  c: Collector,
  start: MapObject,
  fl: Fields,
  analysis: PlayabilityAnalysis,
  id: (k: number) => string | undefined,
): void {
  const { W, H, surface: h, objects, water, rules, model } = inp;
  const N = W * H;
  const D = water.depth;
  const C = water.contamination;
  const { M, SC, wet, clean, blocked, barrier } = fl;
  // the district center's middle tile
  const cells = worldBlocks(FOOTPRINTS.StartingLocation, start).filter((b) => b.localZ === 0);
  let sumX = 0;
  let sumY = 0;
  for (const b of cells) {
    sumX += b.x;
    sumY += b.y;
  }
  const sx = Math.round(sumX / cells.length);
  const sy = Math.round(sumY / cells.length);
  const sz = start.z;
  const startMask = new Uint8Array(N);
  let flooded = false;
  for (let y = sy - 2; y <= sy + 2; y++) {
    for (let x = sx - 2; x <= sx + 2; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (wet[y * W + x]) flooded = true;
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) startMask[y * W + x] = 1;
    }
  }
  const sd = distanceFrom(startMask, W, H);
  analysis.startDistance = sd;
  c.add({
    id: "start.dry",
    class: "playability",
    ok: !flooded,
    where: { tiles: [[sx, sy]] },
    message: flooded ? "water stands within 2 tiles of the district center after the water settles" : "the district center and its ring stay dry after the water settles",
  });

  // pumpable clean water: at least 0.3 deep, its surface 0–2 levels below the start
  const pumpable = new Uint8Array(N);
  let dw = Infinity;
  let nearest = -1;
  for (let i = 0; i < N; i++) {
    const s = h[i] + D[i];
    if (clean[i] && D[i] >= 0.3 && s >= sz - PUMP_REACH && s <= sz + 0.01) {
      pumpable[i] = 1;
      if (sd[i] < dw) {
        dw = sd[i];
        nearest = i;
      }
    }
  }
  analysis.waterDistance = dw;
  const dwText = Number.isFinite(dw) ? `${dw.toFixed(1)} tiles` : "nowhere";
  c.add({
    id: "start.water",
    class: "playability",
    ok: dw <= rules.waterWithin,
    value: Number.isFinite(dw) ? Math.round(dw * 10) / 10 : "none",
    limit: rules.waterWithin,
    ...(nearest >= 0 ? { where: { tiles: [[nearest % W, Math.floor(nearest / W)]] as [number, number][] } } : {}),
    message:
      dw <= rules.waterWithin
        ? `clean pumpable water is ${dwText} from the start (${cap(rules.difficulty)} allows ${rules.waterWithin})`
        : `the start is ${dwText} from pumpable clean water; ${cap(rules.difficulty)} allows ${rules.waterWithin} (beavers go thirsty on day 6)`,
  });
  let db = Infinity;
  let badAt = -1;
  for (let i = 0; i < N; i++) {
    if ((SC[i] > 0 || (wet[i] && C[i] >= BAD)) && sd[i] < db) {
      db = sd[i];
      badAt = i;
    }
  }
  c.add({
    id: "start.badwater",
    class: "playability",
    ok: db >= rules.badwaterWithin,
    value: Number.isFinite(db) ? Math.round(db * 10) / 10 : "none",
    limit: rules.badwaterWithin,
    ...(badAt >= 0 ? { where: { tiles: [[badAt % W, Math.floor(badAt / W)]] as [number, number][] } } : {}),
    message: Number.isFinite(db) ? `the nearest badwater or contaminated soil is ${Math.round(db)} tiles from the start (at least ${rules.badwaterWithin})` : "no badwater or contaminated soil on the map",
  });

  // reach: same-level land joined by slopes (beavers cannot climb a 1-level step)
  const links: [number, number][] = [];
  for (const o of objects) {
    if (o.template !== "Slope") continue;
    const [dx, dy] = slopeHighSide(o.orientation);
    const hx = o.x + dx;
    const hy = o.y + dy;
    if (o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) continue;
    if (hx >= 0 && hx < W && hy >= 0 && hy < H) links.push([o.y * W + o.x, hy * W + hx]);
  }
  const labels = walkRegions(h, W, H, blocked, links);
  const root = labels[sy * W + sx];
  const reach = analysis.reach;
  let dry = 0;
  for (let i = 0; i < N; i++) {
    if (root >= 0 && labels[i] === root) {
      reach[i] = 1;
      if (!wet[i]) dry++;
    }
  }
  c.add({
    id: "start.reach",
    class: "playability",
    ok: dry >= rules.reachMin,
    value: dry,
    limit: rules.reachMin,
    message: `${dry} dry tiles are walkable from the start through slopes (at least ${rules.reachMin}; official p10 1,007)`,
  });
  const touches = (i: number) => {
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of N4) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && reach[yy * W + xx]) return true;
    }
    return false;
  };
  let reachWater = false;
  for (let i = 0; i < N && !reachWater; i++) if (pumpable[i] && (reach[i] || touches(i))) reachWater = true;
  c.add({
    id: "start.reach_water",
    class: "playability",
    ok: reachWater,
    message: reachWater ? "the pumpable water borders land the colony can walk to" : "no pumpable water borders land the colony can walk to",
  });

  // food and wood within 20 tiles, on or beside walkable land
  const reachable = (o: MapObject) => {
    const i = o.y * W + o.x;
    return o.x >= 0 && o.x < W && o.y >= 0 && o.y < H && sd[i] <= NEAR && (reach[i] || touches(i));
  };
  const dead = (o: MapObject) => {
    const lnr = o.components.LivingNaturalResource as { IsDead?: boolean } | undefined;
    return !!lnr && lnr.IsDead === true;
  };
  let bushes = 0;
  let trees = 0;
  for (const o of objects) {
    if (o.template === "BlueberryBush" && !dead(o) && reachable(o)) bushes++;
    else if ((TREES as readonly string[]).includes(o.template) && reachable(o)) trees++;
  }
  c.add({
    id: "start.food",
    class: "playability",
    ok: bushes >= rules.bushesWithin20,
    value: bushes,
    limit: rules.bushesWithin20,
    message: `${bushes} living berry bushes within 20 tiles of the start (at least ${rules.bushesWithin20}; Normal's food lasts about 4 days)`,
  });
  c.add({
    id: "start.wood",
    class: "playability",
    ok: trees >= rules.treesWithin20,
    value: trees,
    limit: rules.treesWithin20,
    message: `${trees} trees within 20 tiles of the start (at least ${rules.treesWithin20})`,
  });
  const ruinsNear: string[] = [];
  let ruinsNearCount = 0;
  objects.forEach((o, k) => {
    if (!o.template.startsWith("RuinColumnH")) return;
    if (o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) return;
    if (sd[o.y * W + o.x] < rules.ruinsWithin) {
      ruinsNearCount++;
      const e = id(k);
      if (e) ruinsNear.push(e);
    }
  });
  c.add({
    id: "start.ruins_clear",
    class: "playability",
    ok: ruinsNearCount === 0,
    value: ruinsNearCount,
    limit: 0,
    message: `${ruinsNearCount} ruin columns within ${rules.ruinsWithin} tiles of the start`,
    ...(ruinsNear.length ? { where: { entities: ruinsNear }, fix: [fixDelete(ruinsNear, "Remove the ruin columns next to the start")] } : {}),
  });

  // plants survive: living ones on moist, dry-footed, clean soil; succulents on dry soil
  const wrong: string[] = [];
  let wrongCount = 0;
  objects.forEach((o, k) => {
    const alive = !dead(o);
    if (!alive || o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) return;
    const i = o.y * W + o.x;
    let bad = false;
    if ((TREES as readonly string[]).includes(o.template) || o.template === "BlueberryBush") bad = M[i] <= 0 || D[i] > 0 || SC[i] > 0;
    else if (o.template === "Succulent") bad = M[i] > 0;
    if (bad) {
      wrongCount++;
      const e = id(k);
      if (e) wrong.push(e);
    }
  });
  c.add({
    id: "plants.survive",
    class: "playability",
    ok: wrongCount === 0,
    value: wrongCount,
    limit: 0,
    message: wrongCount ? `${wrongCount} living plants stand on soil that kills them (dry, flooded or contaminated)` : "every living plant is on soil where it survives",
    ...(wrong.length ? { where: { entities: wrong }, fix: [fixDelete(wrong, "Remove the plants that would die")] } : {}),
  });

  // advisory: berry bushes near the start that lose their moisture in a long drought
  const dryLimit = 0.9 * BLUEBERRY_DAYS_TO_DIE_DRY;
  if (rules.droughtDays <= dryLimit) {
    c.add({
      id: "plants.drought",
      class: "playability",
      advisory: true,
      ok: true,
      value: 0,
      limit: 0,
      message: `${cap(rules.difficulty)} droughts (${rules.droughtDays} days) are shorter than a berry bush survives dry`,
    });
  } else {
    const kept = droughtStorage(model, D, rules.droughtDays);
    const Cd = new Float64Array(N);
    for (let i = 0; i < N; i++) Cd[i] = kept[i] > 0 ? C[i] : 0;
    const Md = moisture(h, kept, Cd, W, H, barrier);
    const thirsty: string[] = [];
    let thirstyCount = 0;
    objects.forEach((o, k) => {
      if (o.template !== "BlueberryBush" || dead(o) || o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) return;
      const i = o.y * W + o.x;
      if (sd[i] > NEAR || Md[i] > 0) return;
      thirstyCount++;
      const e = id(k);
      if (e) thirsty.push(e);
    });
    c.add({
      id: "plants.drought",
      class: "playability",
      advisory: true,
      ok: thirstyCount === 0,
      value: thirstyCount,
      limit: 0,
      message: thirstyCount
        ? `${thirstyCount} berry bushes near the start dry out in a ${rules.droughtDays}-day drought (their water drains; a blueberry dies after about ${BLUEBERRY_DAYS_TO_DIE_DRY} dry days). Irrigate or dam upstream.`
        : `the berry bushes near the start keep moist soil through a ${rules.droughtDays}-day drought`,
      ...(thirsty.length ? { where: { entities: thirsty } } : {}),
    });
  }

  // drought: a reservoir site near the start that holds the colony through the worst drought
  const kept = droughtStorage(model, D, rules.droughtDays);
  let natural = 0;
  for (let i = 0; i < N; i++) if (sd[i] <= RESERVOIR_RADIUS) natural += kept[i];
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) surf[i] = h[i] + D[i];
  const sites = damSites(h, clean, surf, W, H, sd);
  analysis.damSites = sites;
  analysis.naturalStorage = natural;
  let best: DamSite | null = null;
  for (const s of sites) if (sd[s.y * W + s.x] <= RESERVOIR_RADIUS && (!best || s.volume > best.volume)) best = s;
  analysis.bestDam = best;
  const held = Math.max(natural, best ? best.volume : 0);
  const need = rules.reservoirNeed;
  const colony = DROUGHT[rules.difficulty].colony;
  c.add({
    id: "water.reservoir",
    class: "playability",
    ok: held >= need,
    value: Math.round(held),
    limit: Math.round(need),
    ...(best ? { where: { tiles: [[best.x, best.y]] as [number, number][] } } : {}),
    message: `the best dam site within ${RESERVOIR_RADIUS} tiles holds ${Math.round(best ? best.volume : 0)} and natural pools keep ${Math.round(natural)}; ${Math.round(need)} carries ${colony} beavers through a ${rules.droughtDays}-day drought`,
  });

  // resource totals: at least half the official median for this map size (about the official p10)
  const area = N;
  let scrap = 0;
  let treeTotal = 0;
  let bushTotal = 0;
  const ruins: MapObject[] = [];
  for (const o of objects) {
    if (o.template.startsWith("RuinColumnH")) {
      scrap += 15 * Number(o.template.slice(11));
      ruins.push(o);
    } else if ((TREES as readonly string[]).includes(o.template) || o.template === "Succulent") treeTotal++;
    else if (o.template === "BlueberryBush") bushTotal++;
  }
  const res: [string, number, number, string][] = [
    ["scrap", scrap, (0.5 * density("scrap_per_1k_tiles", area) * area) / 1e3 * rules.multipliers.scrap, "scrap metal in ruins"],
    ["trees", treeTotal, (0.5 * density("trees_per_10k", area) * area) / 1e4 * rules.multipliers.trees, "trees"],
    ["bushes", bushTotal, (0.5 * density("bushes_per_10k", area) * area) / 1e4 * rules.multipliers.bushes, "berry bushes"],
  ];
  for (const [key, have, need2, what] of res) {
    c.add({
      id: `resources.${key}`,
      class: "playability",
      ok: have >= need2,
      value: have,
      limit: Math.round(need2),
      message: `${have} ${what} (at least ${Math.round(need2)}: half the official median for this map size)`,
    });
  }

  // ruins: fields of touching columns, each scavengeable from its own level
  if (ruins.length) {
    const rmask = new Uint8Array(N);
    const count = new Int32Array(N);
    for (const o of ruins) {
      if (o.x < 0 || o.x >= W || o.y < 0 || o.y >= H) continue;
      rmask[o.y * W + o.x] = 1;
      count[o.y * W + o.x]++;
    }
    const cl = components(rmask, W, H, true);
    const perField = new Array<number>(cl.sizes.length).fill(0);
    for (let i = 0; i < N; i++) if (cl.labels[i] >= 0) perField[cl.labels[i]] += count[i];
    let inFields = 0;
    for (const n of perField) if (n >= 10) inFields += n;
    const shareIn = inFields / ruins.length;
    c.add({
      id: "ruins.fields",
      class: "playability",
      ok: shareIn >= 0.8,
      value: Math.round(shareIn * 100) / 100,
      limit: 0.8,
      message: `${Math.round(shareIn * 100)}% of ruin columns are in fields of 10 or more (at least 80%; official median 97%)`,
    });
    let noAccess = 0;
    for (const o of ruins) {
      let okAccess = false;
      for (let dy = -1; dy <= 1 && !okAccess; dy++)
        for (let dx = -1; dx <= 1 && !okAccess; dx++) {
          if (!dx && !dy) continue;
          const xx = o.x + dx;
          const yy = o.y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H && h[yy * W + xx] === o.z && !blocked[yy * W + xx]) okAccess = true;
        }
      if (!okAccess) noAccess++;
    }
    c.add({
      id: "ruins.access",
      class: "playability",
      ok: noAccess === 0,
      value: noAccess,
      limit: 0,
      message: noAccess ? `${noAccess} ruin columns have no neighbour at their level for a scavenger to stand on` : "every ruin column can be scavenged from its own level",
    });
  } else {
    c.notApplicable("ruins.fields", "playability", "no ruins on this map");
    c.notApplicable("ruins.access", "playability", "no ruins on this map");
  }
  c.notApplicable(
    "extras.placement",
    "playability",
    inp.features ? "no relics, geothermal fields or mine sites are placed by this version (roadmap M7)" : "distance bands are generator rules; imported maps keep their objects",
  );
}

function fixDelete(entities: string[], label: string): FixOp {
  return { op: "deleteEntities", label, params: { entities } };
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
