// The one build pipeline (PLAN §19.8): features in, terrain and entities out. Generation plans the
// features first (gen/riverValley.ts) and then runs this; the editor will run the same code after
// every edit. It is a pure function of (spec, features): rebuilding a saved document reproduces the
// map exactly (PLAN §19.7).
//
// Steps built: 1 base terrain, 2 landforms, 3 set-piece terrain, 4 rivers and lakes, 5 start bench,
// 7 integrity pass, 8 slopes, 9 water sources, 10 the canonical water settle with soil moisture and
// soil contamination (M2), 11 resources placed on the simulated moisture, 12 the start. Steps 6 and
// 13 (sculpt and entity edits) arrive with the editor.

import { coordinatesForMinCorner, ORIENTATIONS, rotate } from "../format/footprints";
import { bush, RUIN_VARIANTS, ruin, slope, startingLocation, tree, waterSource, type EntitySpec, type TreeSpecies } from "../format/entities";
import type { MapSpec } from "../spec/mapspec";
import { hash32, tileHash01 } from "../math/hash";
import { fbm } from "../math/noise";
import { runsToTiles } from "../math/grid";
import { stream, type Rng } from "../math/rng";
import { soilContamination } from "../sim/contamination";
import { moistureBarrier, waterModel, type MapObject } from "../sim/model";
import { moisture } from "../sim/moisture";
import { canonicalSettle, type CanonicalWater } from "../sim/prefill";
import type { WaterModel } from "../sim/water";
import { bedAt, floorAt, pathField, polygonMask, type PathField } from "./geometry";
import { DERIVED_SLOPES, entityId } from "./ids";
import { placeSlopes, type PlacedSlope } from "./slopes";
import { BUILDERS, type SetPieceSource } from "./setpieces";
import type {
  BerryPatchFeature,
  Feature,
  ForestFeature,
  LakeFeature,
  LandformFeature,
  RiverFeature,
  RuinFieldFeature,
  SetPieceFeature,
  StartFeature,
} from "./schema";

export const START_CLEAR_RADIUS = 3; // PLAN §7.7: nothing within Chebyshev 3 of the start centre
export const MAX_TERRAIN = 16; // PLAN §20, D4

export class BuildTarget {
  readonly W: number;
  readonly H: number;
  readonly seed: number;
  readonly heights: Uint8Array;
  readonly protectedMask: Uint8Array;
  readonly notes: string[] = [];
  private readonly features: Map<string, Feature>;
  private readonly fields = new Map<string, PathField>();

  constructor(spec: MapSpec, features: readonly Feature[]) {
    this.W = spec.size.x;
    this.H = spec.size.y;
    this.seed = spec.seed;
    this.heights = new Uint8Array(this.W * this.H);
    this.protectedMask = new Uint8Array(this.W * this.H);
    this.features = new Map(features.map((f) => [f.id, f]));
  }

  river(id: string): RiverFeature | undefined {
    const f = this.features.get(id);
    return f && f.kind === "river" ? f : undefined;
  }

  pathField(riverId: string): PathField {
    let f = this.fields.get(riverId);
    if (!f) {
      const r = this.river(riverId);
      if (!r) throw new Error(`unknown river ${riverId}`);
      f = pathField(r.params.path, this.W, this.H);
      this.fields.set(riverId, f);
    }
    return f;
  }

  protect(i: number): void {
    this.protectedMask[i] = 1;
  }

  note(msg: string): void {
    this.notes.push(msg);
  }
}

export interface PlacedSource {
  x: number;
  y: number;
  z: number;
  strength: number;
  owner: string;
  template: "WaterSource" | "BadwaterSource";
}

export interface BuildResult {
  W: number;
  H: number;
  seed: number;
  heights: Uint8Array;
  /** Settled water depth per tile: the canonical settle (PLAN §19.7), written into the file. */
  water: Float64Array;
  /** Contamination of that water, 0–1. */
  contamination: Float64Array;
  /** Soil moisture at steady state (> 0 = moist: living plants survive). */
  moisture: Float64Array;
  /** Soil contamination at steady state (> 0 kills plants). */
  soilContamination: Float64Array;
  /** The water model the settle ran on, and the settle itself (ticks, settled, saturation). */
  waterModel: WaterModel;
  settle: CanonicalWater;
  /** Tiles taken by objects on the ground (start zone, slopes, sources, resources). */
  occupied: Uint8Array;
  channel: Uint8Array;
  entities: EntitySpec[];
  slopes: PlacedSlope[];
  sources: PlacedSource[];
  start?: { x: number; y: number; z: number; feature: string };
  notes: string[];
}

export interface BuildOptions {
  /** Stop before resources (the planner uses the terrain, slopes and water to plan them). */
  stopBeforeResources?: boolean;
  /** Stop before the water settle (the planner looks for flat ground on the built terrain). */
  stopBeforeWater?: boolean;
  /** Reuse the canonical settle of a previous build of exactly the same terrain and sources. */
  settleCache?: SettleCache;
}

/** The last canonical settle and the model it ran on. The settle depends only on the water model,
 *  so the planner's base build and the full build of the same attempt share it: the result is
 *  identical to settling again, only faster. */
export class SettleCache {
  private last: { model: WaterModel; emitters: string; water: CanonicalWater } | null = null;

  get(m: WaterModel): CanonicalWater | null {
    const l = this.last;
    if (!l || l.model.W !== m.W || l.model.H !== m.H || l.emitters !== JSON.stringify(m.emitters)) return null;
    for (let i = 0; i < m.floor.length; i++) if (l.model.floor[i] !== m.floor[i]) return null;
    if (!!l.model.dam !== !!m.dam) return null;
    if (l.model.dam && m.dam) for (let i = 0; i < m.dam.length; i++) if (l.model.dam[i] !== m.dam[i]) return null;
    return l.water;
  }

  set(m: WaterModel, water: CanonicalWater): void {
    this.last = { model: { ...m, floor: m.floor.slice(), dam: m.dam ? m.dam.slice() : null }, emitters: JSON.stringify(m.emitters), water };
  }
}

/** A built entity as a map object (for the water model and validation). */
export function toMapObject(e: EntitySpec): MapObject {
  return { template: e.template, x: e.x, y: e.y, z: e.z, orientation: e.orientation, flipped: e.flipped, components: { ...(e.before ?? {}), ...e.components } };
}

export function build(spec: MapSpec, features: readonly Feature[], opts: BuildOptions = {}): BuildResult {
  const t = new BuildTarget(spec, features);
  const { W, H, heights } = t;
  const N = W * H;

  // 1. base terrain: generated layouts cover every tile with their landforms; the fill is a floor
  heights.fill(2);

  // 2. landforms, in document order
  for (const f of features) if (f.kind === "landform") rasterizeLandform(f, t);

  // 3. set-piece terrain
  for (const f of features) {
    if (f.kind !== "setPiece") continue;
    const b = BUILDERS[f.params.kind];
    if (b) b.rasterize(f, t);
    else t.note(`set piece ${f.params.kind} (${f.id}) is not built by this version`);
  }

  // 4. rivers and lakes: lakes set their basin floor, then river beds carve (the river wins)
  for (const f of features) if (f.kind === "lake") rasterizeLake(f, t);
  const channel = new Uint8Array(N);
  for (const f of features) if (f.kind === "river") rasterizeRiver(f, t, channel);

  // 5. the start bench (and, later, object pads)
  const starts = features.filter((f): f is StartFeature => f.kind === "start");
  for (const f of starts) {
    const [cx, cy] = f.params.position;
    const r = f.params.benchRadius;
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
        // the bench never fills the river channel (it would dam the river)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && !channel[y * W + x]) {
          heights[y * W + x] = f.params.benchLevel;
          t.protect(y * W + x);
        }
      }
    }
  }

  // 7. integrity pass: clip to the editor limit, remove single-tile pits and spikes off channels
  for (let i = 0; i < N; i++) if (heights[i] > MAX_TERRAIN) heights[i] = MAX_TERRAIN;
  integrityPass(heights, W, H, t.protectedMask, channel);

  // reserve the start zone and the river mouths before slopes are placed
  const occupied = new Uint8Array(N);
  const start = starts[0];
  let startInfo: BuildResult["start"];
  if (start) {
    const [cx, cy] = start.params.position;
    startInfo = { x: cx, y: cy, z: heights[cy * W + cx], feature: start.id };
    for (let y = cy - START_CLEAR_RADIUS; y <= cy + START_CLEAR_RADIUS; y++)
      for (let x = cx - START_CLEAR_RADIUS; x <= cx + START_CLEAR_RADIUS; x++)
        if (x >= 0 && x < W && y >= 0 && y < H) occupied[y * W + x] = 1;
    // the tiles in front of the door stay free: the entrance and the 3×3 beyond it
    const [dx, dy] = rotate(start.params.orientation, 0, -1);
    const ax = cx + 3 * dx;
    const ay = cy + 3 * dy;
    for (let y = ay - 1; y <= ay + 1; y++)
      for (let x = ax - 1; x <= ax + 1; x++) if (x >= 0 && x < W && y >= 0 && y < H) occupied[y * W + x] = 1;
  }
  const mouths = new Map<string, number[]>();
  for (const f of features) {
    if (f.kind !== "river") continue;
    const tiles = mouthTiles(f, t);
    mouths.set(f.id, tiles);
    for (const i of tiles) occupied[i] = 1;
  }
  const pieceSources: { feature: SetPieceFeature; src: SetPieceSource }[] = [];
  for (const f of features) {
    if (f.kind !== "setPiece") continue;
    for (const src of BUILDERS[f.params.kind]?.sources?.(f) ?? []) {
      pieceSources.push({ feature: f, src });
      for (const [dx, dy] of src.tiles) {
        const x = src.x + dx;
        const y = src.y + dy;
        if (x >= 0 && x < W && y >= 0 && y < H) occupied[y * W + x] = 1;
      }
    }
  }

  // 8. slopes
  const slopes = startInfo ? placeSlopes(heights, W, H, startInfo, occupied, Math.floor(Math.max(W, H) * 0.6)) : [];
  const entities: EntitySpec[] = [];
  for (const s of slopes) {
    const i = s.y * W + s.x;
    occupied[i] = 1;
    entities.push(slope({ id: entityId(DERIVED_SLOPES, "Slope", i), owner: DERIVED_SLOPES, x: s.x, y: s.y, z: s.z, orientation: s.orientation }));
  }

  // 9. water sources: a river entering on the map edge gets a source on every channel tile of its
  //    mouth (a sealed mouth, PLAN §7.6); the padding next to any other border tile drains.
  const sources: PlacedSource[] = [];
  for (const f of features) {
    if (f.kind !== "river") continue;
    const tiles = mouths.get(f.id)!;
    if (!tiles.length) continue;
    const each = Math.min(8, Math.round((f.params.flow / tiles.length) * 1000) / 1000);
    for (const i of tiles) {
      const x = i % W;
      const y = (i - x) / W;
      sources.push({ x, y, z: heights[i], strength: each, owner: f.id, template: "WaterSource" });
      entities.push(waterSource({ id: entityId(f.id, "WaterSource", i), owner: f.id, x, y, z: heights[i], strength: each }));
    }
  }
  //    set pieces add theirs (the badwater marsh)
  for (const { feature, src } of pieceSources) {
    if (src.x < 0 || src.x >= W || src.y < 0 || src.y >= H) continue;
    const i = src.y * W + src.x;
    const bad = src.template === "BadwaterSource";
    sources.push({ x: src.x, y: src.y, z: heights[i], strength: src.strength, owner: feature.id, template: src.template });
    entities.push(waterSource({ id: entityId(feature.id, src.template, i), owner: feature.id, x: src.x, y: src.y, z: heights[i], strength: src.strength, bad }));
  }
  const base = { W, H, seed: spec.seed, heights, occupied, channel, entities, slopes, sources, start: startInfo, notes: t.notes };
  if (opts.stopBeforeWater) {
    const none = new Float64Array(N);
    const model = waterModel(W, H, heights, []);
    return { ...base, water: none, contamination: none, moisture: none, soilContamination: none, waterModel: model, settle: { settled: false, ticks: 0, depth: none, contamination: none, sat: new Uint8Array(N) } };
  }

  // 10. the canonical water settle (PLAN §19.7), then soil moisture and contamination on it
  const objects = entities.map(toMapObject);
  const model = waterModel(W, H, heights, objects);
  let settle = opts.settleCache?.get(model) ?? null;
  if (!settle) {
    settle = canonicalSettle(model);
    opts.settleCache?.set(model, settle);
  }
  const barrier = moistureBarrier(W, H, objects);
  const moist = moisture(heights, settle.depth, settle.contamination, W, H, barrier);
  const soil = soilContamination(heights, settle.depth, settle.contamination, W, H, barrier);

  const result: BuildResult = {
    ...base,
    water: settle.depth,
    contamination: settle.contamination,
    moisture: moist,
    soilContamination: soil,
    waterModel: model,
    settle,
  };
  if (opts.stopBeforeResources) return result;

  // 11. resources: berries, forests, ruin fields (map objects arrive in M7)
  for (const f of features) if (f.kind === "berryPatch") rasterizeBerries(f, result);
  for (const f of features) if (f.kind === "forest") rasterizeForest(f, result);
  for (const f of features) if (f.kind === "ruinField") rasterizeRuins(f, result);

  // 12. the start entity
  if (start) {
    const [cx, cy] = start.params.position;
    const o = start.params.orientation;
    const [x, y] = coordinatesForMinCorner(3, 3, cx - 1, cy - 1, o);
    entities.push(startingLocation({ id: entityId(start.id, "StartingLocation", 0), owner: start.id, x, y, z: heights[cy * W + cx], orientation: o, player: start.params.player }));
  }
  return result;
}

// ------------------------------------------------------------------------------ terrain rasterizers

function rasterizeLandform(f: LandformFeature, t: BuildTarget): void {
  const p = f.params;
  const { W, H, heights } = t;
  if (p.along) {
    const river = t.river(p.along.river);
    if (!river) return t.note(`landform ${f.id}: river ${p.along.river} not found`);
    const field = t.pathField(p.along.river);
    const hw = p.along.halfWidth;
    if (p.kind === "valley") {
      // the valley floor: the floodplain level of the nearest river reach, out past any wiggle
      for (let i = 0; i < W * H; i++) {
        if (field.d[i] < hw + 8) heights[i] = floorAt(river.params, field.s[i], p.along.floorAboveBed);
      }
      return;
    }
    if (p.kind === "terraces") {
      const side = p.along.side ?? 1;
      const bands = p.along.bands ?? [];
      const wob = p.along.wobble ?? { amp: 0, cell: 24, amp2: 0, cell2: 8 };
      const base = p.along.baseLevel ?? 0;
      const maxLevel = Math.min(MAX_TERRAIN, p.along.maxLevel ?? MAX_TERRAIN);
      const s1 = hash32(t.seed, f.id, "wobble");
      const s2 = hash32(t.seed, f.id, "wobble2");
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (field.side[i] !== side) continue;
          const dn = field.d[i] + wob.amp * fbm(s1, x, y, wob.cell, 3) + wob.amp2 * fbm(s2, x, y, wob.cell2, 3);
          const out = dn - hw;
          if (out <= 0) continue;
          let lift = 0;
          for (const b of bands) if (out > b.at) lift += b.rise;
          const floor = floorAt(river.params, field.s[i], p.along.floorAboveBed);
          heights[i] = Math.min(maxLevel, Math.max(floor, base + lift));
        }
      }
      return;
    }
  }
  if (p.outline && p.height !== undefined) {
    const mask = polygonMask(p.outline, W, H);
    for (let i = 0; i < W * H; i++) if (mask[i]) heights[i] = Math.min(MAX_TERRAIN, p.height);
    return;
  }
  t.note(`landform ${f.id} (${p.kind}) has no shape this version can build`);
}

function rasterizeLake(f: LakeFeature, t: BuildTarget): void {
  const { W, H, heights } = t;
  const mask = polygonMask(f.params.outline, W, H);
  const river = f.params.river ? t.river(f.params.river) : undefined;
  const field = river ? t.pathField(river.id) : undefined;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || t.protectedMask[i]) continue;
    if (river && field) heights[i] = floorAt(river.params, field.s[i], f.params.floorDepth);
    else heights[i] = Math.max(0, f.params.outlet.sill - f.params.floorDepth);
  }
}

function rasterizeRiver(f: RiverFeature, t: BuildTarget, channel: Uint8Array): void {
  const { W, H, heights } = t;
  const field = t.pathField(f.id);
  const half = f.params.width / 2;
  for (let i = 0; i < W * H; i++) {
    if (field.d[i] < half) {
      heights[i] = bedAt(f.params.bedProfile, field.s[i]);
      channel[i] = 1;
    }
  }
}

/** Channel tiles on the map border where the river enters (its sealed mouth). */
function mouthTiles(f: RiverFeature, t: BuildTarget): number[] {
  const entry = f.params.entry;
  if (!("edge" in entry)) return [];
  const { W, H } = t;
  const field = t.pathField(f.id);
  const half = f.params.width / 2;
  const out: number[] = [];
  const border = (x: number, y: number) => {
    const i = y * W + x;
    if (field.d[i] < half) out.push(i);
  };
  if (entry.edge === "west") for (let y = 0; y < H; y++) border(0, y);
  else if (entry.edge === "east") for (let y = 0; y < H; y++) border(W - 1, y);
  else if (entry.edge === "south") for (let x = 0; x < W; x++) border(x, 0);
  else for (let x = 0; x < W; x++) border(x, H - 1);
  return out;
}

function integrityPass(h: Uint8Array, W: number, H: number, prot: Uint8Array, channel: Uint8Array): void {
  const copy = h.slice();
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (prot[i] || channel[i]) continue;
      const a = copy[i - 1];
      const b = copy[i + 1];
      const c = copy[i - W];
      const d = copy[i + W];
      const v = copy[i];
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      if (v < lo) h[i] = lo; // pit
      else if (v > hi) h[i] = hi; // spike
    }
  }
}

// ---------------------------------------------------------------------------- resource rasterizers

function place(r: BuildResult, i: number): boolean {
  if (r.occupied[i] || r.water[i] > 0) return false;
  r.occupied[i] = 1;
  return true;
}

function rasterizeBerries(f: BerryPatchFeature, r: BuildResult): void {
  const { W } = r;
  const sPlace = hash32(r.seed, f.id, "place");
  const sRipe = hash32(r.seed, f.id, "ripe");
  const sGrow = hash32(r.seed, f.id, "regrow");
  for (const i of runsToTiles(f.params.area, W)) {
    const x = i % W;
    const y = (i - x) / W;
    if (i < 0 || i >= r.heights.length) continue;
    if (f.params.density < 1 && tileHash01(sPlace, x, y) >= f.params.density) continue;
    if (r.moisture[i] <= 0 || r.soilContamination[i] > 0) continue; // a bush on dry or contaminated soil dies
    if (!place(r, i)) continue;
    const ripe = tileHash01(sRipe, x, y) < f.params.ripeShare;
    const regrowth = Math.round((0.1 + 0.8 * tileHash01(sGrow, x, y)) * 1000) / 1000;
    r.entities.push(bush({ id: entityId(f.id, "BlueberryBush", i), owner: f.id, x, y, z: r.heights[i], ripe, regrowth }));
  }
}

function rasterizeForest(f: ForestFeature, r: BuildResult): void {
  const { W } = r;
  const species = (Object.keys(f.params.speciesMix) as TreeSpecies[]).sort();
  const weights = species.map((s) => f.params.speciesMix[s] ?? 0);
  const total = weights.reduce((a, b) => a + b, 0);
  const sPlace = hash32(r.seed, f.id, "place");
  const sSpecies = hash32(r.seed, f.id, "species");
  const sYoung = hash32(r.seed, f.id, "young");
  const sGrowth = hash32(r.seed, f.id, "growth");
  for (const i of runsToTiles(f.params.area, W)) {
    if (i < 0 || i >= r.heights.length) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (f.params.density < 1 && tileHash01(sPlace, x, y) >= f.params.density) continue;
    let sp = species[0];
    if (species.length > 1 && total > 0) {
      let k = tileHash01(sSpecies, x, y) * total;
      for (let j = 0; j < species.length; j++) {
        k -= weights[j];
        if (k < 0) {
          sp = species[j];
          break;
        }
      }
    }
    const moist = r.moisture[i] > 0;
    const poisoned = r.soilContamination[i] > 0;
    let dead: boolean;
    if (sp === "Succulent") {
      if (moist || poisoned || f.params.life === "dead") continue; // succulents live only on dry, clean soil
      dead = false;
    } else if (f.params.life === "alive") {
      if (!moist || poisoned) continue;
      dead = false;
    } else if (f.params.life === "dead") dead = true;
    else dead = !moist || poisoned; // auto: official maps store trees on dry soil dead
    if (!place(r, i)) continue;
    let growth = 1;
    if (!dead && tileHash01(sYoung, x, y) < f.params.youngShare) {
      growth = Math.round((0.2 + 0.75 * tileHash01(sGrowth, x, y)) * 1000) / 1000;
    }
    r.entities.push(tree({ id: entityId(f.id, sp, i), owner: f.id, x, y, z: r.heights[i], species: sp, dead, growth }));
  }
}

/** Heights for a ruin field's tiles (PLAN §9.7): sampled from the height mix, assigned by smooth
 *  noise (clumps, lattice 2.5 tiles) plus centerBias·(1 − r/rmax) plus a little jitter, tallest to
 *  the highest key. Depends only on the area and the feature's stream. */
export function assignRuinHeights(tiles: number[], W: number, rng: Rng, mix: number[], centerBias: number): number[] {
  const n = tiles.length;
  if (!n) return [];
  const hs: number[] = [];
  for (let k = 0; k < n; k++) hs.push(rng.weighted(mix) + 1);
  const xs = tiles.map((i) => i % W);
  const ys = tiles.map((i) => (i - (i % W)) / W);
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < n; k++) {
    cx += xs[k];
    cy += ys[k];
  }
  cx /= n;
  cy /= n;
  const r = xs.map((x, k) => Math.sqrt((x - cx) * (x - cx) + (ys[k] - cy) * (ys[k] - cy)));
  let rmax = 0;
  for (const v of r) if (v > rmax) rmax = v;
  if (rmax === 0) rmax = 1;
  const clump = 2.5;
  const x0 = xs.reduce((a, v) => Math.min(a, v), Infinity);
  const y0 = ys.reduce((a, v) => Math.min(a, v), Infinity);
  const gx = Math.floor((xs.reduce((a, v) => Math.max(a, v), -Infinity) - x0) / clump) + 2;
  const gy = Math.floor((ys.reduce((a, v) => Math.max(a, v), -Infinity) - y0) / clump) + 2;
  const lat: number[] = [];
  for (let k = 0; k < gx * gy; k++) lat.push(rng.float());
  const keys = tiles.map((_, k) => {
    const fx = (xs[k] - x0) / clump;
    const fy = (ys[k] - y0) / clump;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const a = lat[iy * gx + ix] * (1 - tx) + lat[iy * gx + ix + 1] * tx;
    const b = lat[(iy + 1) * gx + ix] * (1 - tx) + lat[(iy + 1) * gx + ix + 1] * tx;
    return a * (1 - ty) + b * ty + centerBias * (1 - r[k] / rmax) + 0.15 * rng.float();
  });
  const order = tiles.map((_, k) => k).sort((a, b) => keys[b] - keys[a] || a - b);
  const sorted = [...hs].sort((a, b) => b - a);
  const out = new Array<number>(n);
  order.forEach((k, rank) => (out[k] = sorted[rank]));
  return out;
}

function rasterizeRuins(f: RuinFieldFeature, r: BuildResult): void {
  const { W } = r;
  const tiles = runsToTiles(f.params.area, W).filter((i) => i >= 0 && i < r.heights.length);
  const heights = assignRuinHeights(tiles, W, stream(r.seed, f.id, "heights"), f.params.heightMix, f.params.centerBias);
  const sVariant = hash32(r.seed, f.id, "variant");
  const sOrient = hash32(r.seed, f.id, "orientation");
  tiles.forEach((i, k) => {
    if (!place(r, i)) return;
    const x = i % W;
    const y = (i - x) / W;
    const variant = RUIN_VARIANTS[Math.floor(tileHash01(sVariant, x, y) * RUIN_VARIANTS.length)];
    const orientation = ORIENTATIONS[Math.floor(tileHash01(sOrient, x, y) * 4)];
    r.entities.push(ruin({ id: entityId(f.id, `RuinColumnH${heights[k]}`, i), owner: f.id, x, y, z: r.heights[i], height: heights[k], variant, orientation }));
  });
}
