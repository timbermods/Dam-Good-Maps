// What the editor knows about features on the page (EDITOR_PLAN §4): their plain names, which tiles
// each covers (for hover, selection and highlights), what stands on a tile in plain language, and
// how a feature moves. Pure TypeScript on the map view and the feature list the worker sends.

import { pathField, pointAtArc, polygonMask, type PathField } from "../core/features/geometry";
import { BUILDERS } from "../core/features/setpieces";
import type { Feature, Point, RiverFeature } from "../core/features/schema";
import { runsToTiles, tilesToRuns, type Runs } from "../core/math/grid";
import type { OpParams } from "../core/doc/ops";
import { movePatch as corePatch } from "../core/doc/tools";
import { OBJECT_NAMES as OBJECT_KIND_NAMES, objectTiles } from "../core/features/objects";
import { DEAD, YOUNG, type EntityView, type SurfaceWater } from "../render3d/model";

// ------------------------------------------------------------------------------------- names

const LANDFORMS: Record<string, string> = {
  hill: "Hill",
  plateau: "Plateau",
  ridge: "Ridge",
  canyon: "Canyon",
  valley: "Valley floor",
  island: "Island",
  terraces: "Terraces",
};

const SET_PIECES: Record<string, string> = {
  waterfall: "Waterfall",
  damSite: "Dam site",
  gorge: "Gorge",
  terracedCliffs: "Terraced cliffs",
  badwaterBasin: "Badwater spring",
  plugSpillway: "Plugged spillway",
  obstaclePayoff: "Obstacle",
  secondDistrict: "Second district site",
};

const SPECIES: Record<string, string> = { Pine: "pine", Birch: "birch", Oak: "oak", Succulent: "succulent" };

function speciesList(mix: Record<string, number | undefined>): string {
  const names = Object.entries(mix)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k]) => SPECIES[k] ?? k.toLowerCase());
  return names.length > 2 ? "mixed" : names.join(" and ");
}

/** A feature's plain name ("Plateau", "Pine forest", "River"). */
export function featureName(f: Feature): string {
  switch (f.kind) {
    case "landform":
      return LANDFORMS[f.params.kind] ?? "Landform";
    case "river":
      return f.params.badwater ? "Badwater river" : "River";
    case "lake":
      return f.params.planned ? "Reservoir site" : "Lake";
    case "setPiece":
      return SET_PIECES[f.params.kind] ?? "Set piece";
    case "forest": {
      const s = speciesList(f.params.speciesMix as Record<string, number>);
      return s ? `${s[0].toUpperCase()}${s.slice(1)} forest` : "Forest";
    }
    case "berryPatch":
      return "Berry patch";
    case "ruinField":
      return "Ruin field";
    case "mapObject":
      return OBJECT_KIND_NAMES[f.params.kind];
    case "start":
      return "Start";
  }
}

/** Which of the four tabs a feature belongs to (EDITOR_PLAN §4). */
export type Tab = "land" | "water" | "resources" | "start";

export function tabOf(f: Feature): Tab {
  switch (f.kind) {
    case "landform":
      return "land";
    case "river":
    case "lake":
    case "setPiece":
      return "water";
    case "start":
      return "start";
    case "mapObject":
      // thorn belts are drawn on the land; weirs and plugs sit in the water; the rest are resources
      return f.params.kind === "thornBelt" ? "land" : f.params.kind === "weir" || f.params.kind === "plug" ? "water" : "resources";
    default:
      return "resources";
  }
}

// ---------------------------------------------------------------------------------- tile index

/** The tiles each feature covers, cached by the feature's parameters. */
export class FeatureIndex {
  private cache = new Map<string, { key: string; tiles: Int32Array }>();
  private fields = new Map<string, { key: string; field: PathField }>();
  /** Per tile: the index (into `features`) of the area feature (forest, berries, ruins), the
   *  terrain feature (landform, lake) and the river covering it; −1 for none. */
  area: Int32Array;
  terrain: Int32Array;
  river: Int32Array;
  features: Feature[] = [];

  constructor(
    readonly W: number,
    readonly H: number,
  ) {
    this.area = new Int32Array(W * H);
    this.terrain = new Int32Array(W * H);
    this.river = new Int32Array(W * H);
  }

  update(features: readonly Feature[]): void {
    this.features = features as Feature[];
    this.area.fill(-1);
    this.terrain.fill(-1);
    this.river.fill(-1);
    const seen = new Set<string>();
    features.forEach((f, k) => {
      seen.add(f.id);
      const tiles = this.tilesOf(f);
      const into = f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField" ? this.area : f.kind === "river" ? this.river : f.kind === "landform" || f.kind === "lake" ? this.terrain : null;
      if (!into) return;
      // later landforms and lakes are built over earlier ones: the last one wins
      for (const i of tiles) into[i] = k;
    });
    for (const id of [...this.cache.keys()]) if (!seen.has(id)) this.cache.delete(id);
  }

  riverField(f: RiverFeature): PathField {
    const key = JSON.stringify(f.params.path);
    const c = this.fields.get(f.id);
    if (c && c.key === key) return c.field;
    const field = pathField(f.params.path, this.W, this.H);
    this.fields.set(f.id, { key, field });
    return field;
  }

  /** The tiles a feature covers (the ones its outline, area or channel holds). */
  tilesOf(f: Feature): Int32Array {
    // features that follow a river (valley landforms, set pieces) change with it
    const dep = f.kind === "landform" ? f.params.along?.river : f.kind === "setPiece" ? (f.params.plan as { river?: unknown }).river : undefined;
    const depKey = typeof dep === "string" ? JSON.stringify(this.features.find((g) => g.id === dep)?.params ?? null) : "";
    const key = JSON.stringify(f.params) + depKey;
    const c = this.cache.get(f.id);
    if (c && c.key === key) return c.tiles;
    const tiles = Int32Array.from(this.computeTiles(f));
    this.cache.set(f.id, { key, tiles });
    return tiles;
  }

  private computeTiles(f: Feature): number[] {
    const { W, H } = this;
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const mask = (m: Uint8Array) => {
      const out: number[] = [];
      for (let i = 0; i < m.length; i++) if (m[i]) out.push(i);
      return out;
    };
    switch (f.kind) {
      case "forest":
      case "berryPatch":
      case "ruinField":
        return runsToTiles(f.params.area, W).filter((i) => i >= 0 && i < W * H);
      case "lake":
        return mask(polygonMask(f.params.outline, W, H));
      case "landform": {
        const p = f.params;
        if (p.outline) return mask(polygonMask(p.outline, W, H));
        if (!p.along) return [];
        const river = this.features.find((g): g is RiverFeature => g.id === p.along!.river && g.kind === "river");
        if (!river) return [];
        const field = this.riverField(river);
        const out: number[] = [];
        const hw = p.along.halfWidth;
        for (let i = 0; i < W * H; i++) {
          if (p.kind === "valley" ? field.d[i] < hw : field.side[i] === (p.along.side ?? 1) && field.d[i] >= hw) out.push(i);
        }
        return out;
      }
      case "river": {
        const field = this.riverField(f);
        const out: number[] = [];
        const half = f.params.width / 2;
        for (let i = 0; i < W * H; i++) if (field.d[i] < half) out.push(i);
        return out;
      }
      case "start": {
        const [cx, cy] = f.params.position;
        const out: number[] = [];
        for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (inMap(x, y)) out.push(y * W + x);
        return out;
      }
      case "setPiece":
        return this.setPieceTiles(f).filter(([x, y]) => inMap(x, y)).map(([x, y]) => y * W + x);
      case "mapObject":
        return objectTiles(f, W, H).filter(([x, y]) => inMap(x, y)).map(([x, y]) => y * W + x);
      default:
        return [];
    }
  }

  private setPieceTiles(f: Extract<Feature, { kind: "setPiece" }>): [number, number][] {
    const own = BUILDERS[f.params.kind]?.area?.(f, this.W, this.H, this.features);
    if (own?.length) return own.map((i) => [i % this.W, Math.floor(i / this.W)]);
    const plan = f.params.plan as Record<string, unknown>;
    if (f.params.kind === "badwaterBasin" && typeof plan.x === "number" && typeof plan.y === "number") {
      const out: [number, number][] = [];
      for (let y = plan.y; y < plan.y + 3; y++) for (let x = plan.x; x < plan.x + 3; x++) out.push([x, y]);
      return out;
    }
    const river = this.features.find((g): g is RiverFeature => g.kind === "river" && g.id === plan.river);
    if (!river || typeof plan.at !== "number") return [];
    const { p, normal } = pointAtArc(river.params.path, plan.at);
    if (f.params.kind === "damSite") {
      const half = Math.ceil(river.params.width / 2) + 2;
      const out: [number, number][] = [];
      for (let k = -half; k <= half; k++) out.push([Math.round(p[0] + normal[0] * k), Math.round(p[1] + normal[1] * k)]);
      return out;
    }
    const half = Math.ceil(river.params.width / 2);
    const out: [number, number][] = [];
    for (let k = -half; k <= half; k++) out.push([Math.round(p[0] + normal[0] * k), Math.round(p[1] + normal[1] * k)]);
    return out;
  }

  /** The features under a tile, most specific first: the start, set pieces, resource areas,
   *  rivers, lakes and landforms. */
  candidatesAt(x: number, y: number): Feature[] {
    const { W, H } = this;
    if (x < 0 || y < 0 || x >= W || y >= H) return [];
    const i = y * W + x;
    const out: Feature[] = [];
    for (const f of this.features) if (f.kind === "start" && this.tilesOf(f).includes(i)) out.push(f);
    for (const f of this.features) if (f.kind === "mapObject" && this.tilesOf(f).includes(i)) out.push(f);
    for (const f of this.features) if (f.kind === "setPiece" && this.tilesOf(f).includes(i)) out.push(f);
    if (this.area[i] >= 0) out.push(this.features[this.area[i]]);
    if (this.river[i] >= 0) out.push(this.features[this.river[i]]);
    if (this.terrain[i] >= 0) {
      const t = this.features[this.terrain[i]];
      out.push(t);
      // a free-standing landform over the valley: the valley too
      for (let k = this.features.length - 1; k >= 0; k--) {
        const f = this.features[k];
        if (f !== t && (f.kind === "landform" || f.kind === "lake") && this.tilesOf(f).includes(i)) out.push(f);
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------------- hover text

export interface TileContext {
  W: number;
  H: number;
  heights: Uint8Array;
  water: SurfaceWater;
  entities: EntityView;
  /** Tile index → entity indices on it. */
  entitiesAt: Map<number, number[]>;
  index: FeatureIndex | null;
}

export function entitiesByTile(v: EntityView, W: number): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (let k = 0; k < v.count; k++) {
    const i = v.y[k] * W + v.x[k];
    const list = m.get(i);
    if (list) list.push(k);
    else m.set(i, [k]);
  }
  return m;
}

const OBJECT_NAMES: Record<string, string> = {
  Pine: "pine",
  Birch: "birch",
  Oak: "oak",
  Succulent: "succulent",
  BlueberryBush: "blueberry bush",
  Slope: "slope",
  WaterSource: "water source",
  BadwaterSource: "badwater source",
  StartingLocation: "district center",
  Blockage: "blockage",
  NaturalDam: "natural dam",
  Thorns: "thorns",
  GeothermalField: "geothermal field",
  UndergroundRuins: "underground ruins",
  UnstableCore: "unstable core",
  SmallRelic: "small relic",
  MediumRelic: "medium relic",
  LargeRelic: "large relic",
};

function objectName(template: string, flags: number): string {
  const ruin = /^RuinColumnH(\d)$/.exec(template);
  if (ruin) return `ruin column, ${ruin[1]} high`;
  const base = OBJECT_NAMES[template] ?? template.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  if (flags & DEAD) return `dead ${base}`;
  if (flags & YOUNG) return `young ${base}`;
  return base;
}

/** What stands on a tile, in plain language: "Plateau, height 12, pine forest". */
export function describeTile(c: TileContext, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= c.W || y >= c.H) return "";
  const i = y * c.W + x;
  const parts: string[] = [];
  const idx = c.index;
  const terrain = idx && idx.terrain[i] >= 0 ? idx.features[idx.terrain[i]] : null;
  const river = idx && idx.river[i] >= 0 ? idx.features[idx.river[i]] : null;
  const area = idx && idx.area[i] >= 0 ? idx.features[idx.area[i]] : null;
  const start = idx?.features.find((f) => f.kind === "start" && idx.tilesOf(f).includes(i));
  if (start) parts.push("Start");
  if (river) parts.push(featureName(river));
  else if (terrain) parts.push(featureName(terrain));
  parts.push(`height ${c.heights[i]}`);
  const d = c.water.depth[i];
  if (c.water.surface[i] === c.water.surface[i] && d > 0.001) parts.push(`${c.water.contamination[i] >= 0.05 ? "badwater" : "water"} ${d < 0.1 ? d.toFixed(2) : d.toFixed(1)} deep`);
  if (area) parts.push(featureName(area).toLowerCase());
  const here = c.entitiesAt.get(i);
  if (here?.length) {
    // the objects on the tile, unless the area already says it all (a living tree in a forest)
    const names = [...new Set(here.map((k) => objectName(c.entities.templates[c.entities.template[k]], c.entities.flags[k])))];
    const plain = /^(pine|birch|oak|succulent|blueberry bush)$/;
    if (!(area && names.length === 1 && plain.test(names[0]))) parts.push(...names.slice(0, 2));
  }
  const text = parts.join(", ");
  return text[0].toUpperCase() + text.slice(1);
}

// -------------------------------------------------------------------------------------- moving

/** Why a feature cannot be moved by its handle (null: it can). */
export function moveBlocked(f: Feature): string | null {
  switch (f.kind) {
    case "setPiece":
      if (f.params.kind === "badwaterBasin" && f.params.plan.mode === "marsh") return "The generated badwater marsh stays where the valley put it.";
      return null;
    case "mapObject":
      return null;
    case "landform":
      return f.params.outline ? null : "This follows its river: move the river instead.";
    case "lake":
      return f.params.river ? "This belongs to its river's dam site: it moves with the river." : null;
    default:
      return null;
  }
}

/** The bounding box of a feature's own coordinates (its path, outline, area or position). */
function coordsBounds(f: Feature, W: number, H: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let pts: Point[] = [];
  switch (f.kind) {
    case "forest":
    case "berryPatch":
    case "ruinField":
      for (const [y, a, b] of f.params.area) pts.push([a, y], [b, y]);
      break;
    case "mapObject":
      pts = objectTiles(f, W, H);
      break;
    case "start":
      pts = [[f.params.position[0] - 1, f.params.position[1] - 1], [f.params.position[0] + 1, f.params.position[1] + 1]];
      break;
    case "landform":
      pts = f.params.outline ?? [];
      break;
    case "lake":
      pts = f.params.outline;
      break;
    case "river":
      pts = f.params.path.filter(([x, y]) => x > 0 && y > 0 && x < W - 1 && y < H - 1);
      break;
    case "setPiece": {
      // a set piece is planned again where it lands; its builder fits it on the map
      const p = f.params.plan;
      const a = (Array.isArray(p.lip) ? p.lip : Array.isArray(p.at) ? p.at : typeof p.x === "number" ? [Number(p.x) + 1, Number(p.y) + 1] : null) as number[] | null;
      if (a) pts = [[a[0], a[1]]];
      else return { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
      break;
    }
    default:
      return null;
  }
  if (!pts.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** Clamp a move so the feature stays on the map (the handle stops at the edge). */
export function clampMove(f: Feature, dx: number, dy: number, W: number, H: number): [number, number] {
  const b = coordsBounds(f, W, H);
  if (!b) return [0, 0];
  const cx = Math.max(-Math.floor(b.x0), Math.min(W - 1 - Math.ceil(b.x1), dx));
  const cy = Math.max(-Math.floor(b.y0), Math.min(H - 1 - Math.ceil(b.y1), dy));
  return [cx, cy];
}

const onEdge = (v: number, max: number) => v <= 0 || v >= max;

/** The `updateFeature` patch that moves a feature by (dx, dy) tiles (the core's rule: a river keeps
 *  its edge ends on their edge, the start's bench takes the ground level at its new place). */
export function movePatch(f: Feature, dx: number, dy: number, W: number, H: number, heights: Uint8Array): OpParams["updateFeature"]["patch"] {
  return corePatch(f, dx, dy, W, H, heights);
}

/** Where a feature's move handle sits: the middle of its tiles. */
export function anchorOf(index: FeatureIndex, f: Feature): [number, number] | null {
  if (f.kind === "start") return [f.params.position[0], f.params.position[1]];
  const tiles = index.tilesOf(f);
  if (!tiles.length) return null;
  let sx = 0;
  let sy = 0;
  for (const i of tiles) {
    sx += i % index.W;
    sy += Math.floor(i / index.W);
  }
  // the tile of the feature closest to its centroid (so the handle sits on the feature)
  const mx = sx / tiles.length;
  const my = sy / tiles.length;
  let best = tiles[0];
  let bd = Infinity;
  for (const i of tiles) {
    const d = (i % index.W - mx) ** 2 + (Math.floor(i / index.W) - my) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return [best % index.W, Math.floor(best / index.W)];
}

// ------------------------------------------------------------------------------------- drawing

/** A rectangle of tiles from two corners, clipped to the map. */
export function rectOf(a: [number, number], b: [number, number], W: number, H: number): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.max(0, Math.min(a[0], b[0])),
    y0: Math.max(0, Math.min(a[1], b[1])),
    x1: Math.min(W - 1, Math.max(a[0], b[0])),
    y1: Math.min(H - 1, Math.max(a[1], b[1])),
  };
}

export function rectRuns(r: { x0: number; y0: number; x1: number; y1: number }, W: number): Runs {
  const tiles: number[] = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) tiles.push(y * W + x);
  return tilesToRuns(tiles, W);
}

/** An outline whose tiles (by the centre rule of the rasterizers) are exactly the rectangle's. */
export function rectOutline(r: { x0: number; y0: number; x1: number; y1: number }): Point[] {
  return [
    [r.x0 - 0.5, r.y0 - 0.5],
    [r.x1 + 0.5, r.y0 - 0.5],
    [r.x1 + 0.5, r.y1 + 0.5],
    [r.x0 - 0.5, r.y1 + 0.5],
  ];
}

/** A random id for a feature the player makes (PLAN §19.4). */
export function newId(): string {
  return crypto.randomUUID();
}

// ------------------------------------------------------------------------------------- the start

export interface StartCheck {
  /** Why the district center cannot stand there (null: it can). */
  problem: string | null;
  /** The 3×3 footprint and the tile at its door. */
  tiles: number[];
  door: number;
  /** Tiles to the nearest water a pump reaches (0–2 levels below the start, 0.3+ deep), trees and
   *  living berry bushes within 20 tiles. */
  water: number | null;
  trees: number;
  bushes: number;
}

/** The start's footprint and nearby water, wood and food at (x, y), from what the page shows
 *  (EDITOR_PLAN §4: the footprint preview, green or red, and simple indicators). `level` is the
 *  bench level for a start that levels its ground (a generated map), or null for an imported start
 *  that stands on the ground as it is. */
export function checkStartAt(c: TileContext, x: number, y: number, door: [number, number], level: number | null, self: string | null): StartCheck {
  const { W, H } = c;
  const tiles: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push((y + dy) * W + (x + dx));
  const doorI = door[1] * W + door[0];
  let problem: string | null = null;
  const z = level ?? c.heights[y * W + x];
  for (const i of [...tiles, doorI]) {
    const tx = i % W;
    const ty = Math.floor(i / W);
    if (tx < 1 || ty < 1 || tx > W - 2 || ty > H - 2 || i < 0) {
      problem = "too close to the map edge";
      break;
    }
    if (c.index && c.index.river[i] >= 0) {
      problem = "in a river";
      break;
    }
    if (c.water.depth[i] > 0.05) {
      problem = "under water";
      break;
    }
    if (level === null && c.heights[i] !== z) {
      problem = "not on level ground";
      break;
    }
    const here = c.entitiesAt.get(i);
    if (here?.some((k) => c.entities.owners[c.entities.owner[k]] !== self && !/^(Pine|Birch|Oak|Succulent|BlueberryBush|RuinColumnH\d|StartingLocation)$/.test(c.entities.templates[c.entities.template[k]]))) {
      problem = "on an object";
      break;
    }
  }
  // indicators: pumpable water, trees and bushes within 20 tiles (straight distance)
  let water: number | null = null;
  let trees = 0;
  let bushes = 0;
  const r = 24;
  for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++)
    for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) {
      const i = yy * W + xx;
      const d = Math.max(0, Math.hypot(xx - x, yy - y) - 1);
      const depth = c.water.depth[i];
      const surface = c.heights[i] + depth;
      if (depth >= 0.3 && c.water.contamination[i] < 0.05 && surface <= z + 0.01 && surface >= z - 2 && (water === null || d < water)) water = Math.round(d);
      if (d > 20) continue;
      for (const k of c.entitiesAt.get(i) ?? []) {
        const t = c.entities.templates[c.entities.template[k]];
        const dead = (c.entities.flags[k] & DEAD) !== 0;
        if (t === "Pine" || t === "Birch" || t === "Oak") trees++;
        else if (t === "BlueberryBush" && !dead) bushes++;
      }
    }
  return { problem, tiles, door: doorI, water, trees, bushes };
}

/** The river whose channel holds tile (x, y), and the arc position there (a click on a river). */
export function riverAt(index: FeatureIndex, x: number, y: number): { id: string; at: number } | null {
  const { W, H } = index;
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const k = index.river[y * W + x];
  if (k < 0) return null;
  const f = index.features[k];
  if (f.kind !== "river") return null;
  const field = index.riverField(f);
  return { id: f.id, at: Math.round(field.s[y * W + x] * 100) / 100 };
}
