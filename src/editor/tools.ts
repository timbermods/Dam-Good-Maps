// The editor's drawing tools (EDITOR_PLAN §4). Land: hills, plateaus, ridges, canyons, valleys and
// islands drawn by their outline, with a height and an edge style, and terraced cliffs. Water:
// rivers drawn point by point from source to outlet, lakes by their basin, waterfalls, dam sites,
// gorges, badwater springs, weirs, plugs and plugged spillways. Resources: forests, berry patches
// and ruin fields drawn as areas (the worker shows where plants live and how ruins cluster), mine
// sites, relics and geothermal fields. Land: thorn belts. Advanced mode: unstable cores and any
// object placed by hand, with the game's footprint rules.
//
// An outline is dragged as a rectangle or clicked point by point; a river is clicked point by
// point; the rest are placed with one click. The worker plans the result on the map (the shared
// builders), the editor shows it with its report, and Place applies it as one step. Objects show
// their footprint green or red under the pointer before the click.

import type { Feature, LandformFeature, MapObjectKind, Point } from "../core/features/schema";
import { polygonMask } from "../core/features/geometry";
import { FOOTPRINTS, type Orientation } from "../core/format/footprints";
import { rotatedSize } from "../core/features/objects";
import type { Facing } from "../core/features/setpieces/common";
import { FOREST, RUIN_HEIGHT_SHARES, RUINS } from "../core/gen/calibrated";
import type { ToolRequest } from "../worker/session";
import { newId, rectOutline, rectRuns } from "./features";
import { DAM_OVERLAY } from "../render3d/palette";

export type LandKind = LandformFeature["params"]["kind"];
export type ToolKind =
  | "hill" | "plateau" | "ridge" | "canyon" | "valley" | "island" | "terracedCliffs" | "slope" | "thornBelt"
  | "river" | "lake" | "source" | "badwaterSource" | "waterfall" | "damSite" | "gorge" | "badwater" | "weir" | "plug" | "spillway"
  | "forest" | "berryPatch" | "ruinField" | "mineSite" | "relic" | "geothermal" | "core" | "object";

export const TOOL_NAMES: Record<ToolKind, string> = {
  hill: "Hill",
  plateau: "Plateau",
  ridge: "Ridge",
  canyon: "Canyon",
  valley: "Valley",
  island: "Island",
  terracedCliffs: "Terraced cliffs",
  slope: "Slope",
  river: "River",
  lake: "Lake",
  source: "Water source",
  badwaterSource: "Badwater source",
  waterfall: "Waterfall",
  damSite: "Dam site",
  gorge: "Gorge",
  badwater: "Badwater spring",
  forest: "Forest",
  berryPatch: "Berry patch",
  ruinField: "Ruin field",
  thornBelt: "Thorn belt",
  weir: "Weir",
  plug: "Plug",
  spillway: "Plugged spillway",
  mineSite: "Mine site",
  relic: "Relic",
  geothermal: "Geothermal field",
  core: "Unstable core",
  object: "Object",
};

const OUTLINE_HINT = "Drag a rectangle, or click its corners and double-click to finish.";

export const TOOL_HINTS: Record<ToolKind, string> = {
  hill: `Draw the hill. ${OUTLINE_HINT}`,
  plateau: `Draw the plateau. ${OUTLINE_HINT}`,
  ridge: `Draw the ridge. ${OUTLINE_HINT}`,
  canyon: `Draw the canyon. ${OUTLINE_HINT}`,
  valley: `Draw the valley. ${OUTLINE_HINT}`,
  island: `Draw the island. ${OUTLINE_HINT}`,
  terracedCliffs: "Click the spot beside the water where the bottom band starts. The bands rise away from the way it faces.",
  slope: "Slopes appear by themselves where the colony needs them. Click the low tile beside a 1-level step to add one there, or click a slope to remove it.",
  river: "Drag from the source to the outlet, or click its bends and double-click. Start at the map edge or inland; end at the edge, in a river or in a lake. [ and ] change its width.",
  lake: "Click a hollow: a spring at its lowest point fills it into a lake, and the water spills on over its rim.",
  source: "Click where water starts: it spreads from there at once. Strength sets how much.",
  badwaterSource: "Click where badwater starts: it spreads from there at once, and poisons the ground it reaches.",
  waterfall: "Click where the lip goes. On a river, the river drops there. Anywhere else, it builds its own cliff, springs and outflow.",
  damSite: "Click a river where the dam should go. A rock ridge closes the valley so one short dam holds a reservoir.",
  gorge: "Click a river where the gorge starts. It narrows the river between high walls downstream.",
  badwater: "Click where the badwater spring goes, away from the start. Its water leaves through one outlet you can dam.",
  forest: `Draw the forest. ${OUTLINE_HINT} Green shows where trees live.`,
  berryPatch: `Draw the berry patch. ${OUTLINE_HINT} Bushes grow on moist ground, beside water.`,
  ruinField: `Draw the area. ${OUTLINE_HINT} Ruin columns grow in fields on level ground (scrap metal).`,
  thornBelt: `Draw the belt. ${OUTLINE_HINT} Thorns block walking; builders clear them.`,
  weir: "Click a river. A natural dam across it holds the water 0.65 deep upstream.",
  plug: "Click a river. A line of blockage closes it; demolish it later to let the water through.",
  spillway: "Click a lake's shore. A channel runs to lower ground, closed by a plug at the lake.",
  mineSite: "Click level, dry ground. The scrap mine is built on it late in the game.",
  relic: "Click level, dry ground. Demolishing a relic gives science: the farther out, the more.",
  geothermal: "Click level, dry ground. A geothermal engine on it makes power for free.",
  core: "Click level, dry ground far from the start. It explodes in the cycle you set and can't be removed.",
  object: "Pick an object, then click where it goes. Green: the game keeps it there. Red: it would be deleted.",
};

export const LAND_TOOLS: ToolKind[] = ["hill", "plateau", "ridge", "canyon", "valley", "island", "terracedCliffs", "slope", "thornBelt"];
export const WATER_TOOLS: ToolKind[] = ["river", "lake", "source", "badwaterSource", "waterfall", "damSite", "gorge", "badwater", "weir", "plug", "spillway"];
export const RESOURCE_TOOLS: ToolKind[] = ["forest", "berryPatch", "ruinField", "mineSite", "relic", "geothermal"];
/** Tools advanced mode adds (on the Resources tab). */
export const ADVANCED_TOOLS: ToolKind[] = ["core", "object"];

/** How a tool takes its shape from the map. */
export function gestureOf(t: ToolKind): "outline" | "path" | "point" | "rect" {
  if (t === "river") return "path";
  if (t === "terracedCliffs" || t === "waterfall" || t === "damSite" || t === "gorge" || t === "badwater" || t === "slope") return "point";
  if (t === "weir" || t === "plug" || t === "spillway" || t === "mineSite" || t === "relic" || t === "geothermal" || t === "core" || t === "object") return "point";
  if (t === "lake" || t === "source" || t === "badwaterSource") return "point";
  return "outline";
}

/** The map object a tool places, when it places one with a footprint. */
export function objectKindOf(t: ToolKind, o: ToolOptions): MapObjectKind | null {
  switch (t) {
    case "mineSite":
      return "mineSite";
    case "geothermal":
      return "geothermal";
    case "core":
      return "unstableCore";
    case "relic":
      return o.relic === "large" ? "relicLarge" : o.relic === "medium" ? "relicMedium" : "relicSmall";
    default:
      return null;
  }
}

/** Templates advanced mode places by hand (the common set: they load for both factions). */
export const PLACE_TEMPLATES: [string, string][] = [
  ["Pine", "Pine"],
  ["Birch", "Birch"],
  ["Oak", "Oak"],
  ["Succulent", "Succulent"],
  ["BlueberryBush", "Blueberry bush"],
  ["RuinColumnH1", "Ruin column, 1 high"],
  ["RuinColumnH3", "Ruin column, 3 high"],
  ["RuinColumnH5", "Ruin column, 5 high"],
  ["RuinColumnH8", "Ruin column, 8 high"],
  ["WaterSource", "Water source"],
  ["BadwaterSource", "Badwater source"],
  ["Slope", "Slope"],
  ["Thorns", "Thorns"],
  ["NaturalDam", "Natural dam"],
  ["Blockage", "Blockage"],
  ["SmallRelic", "Small relic"],
  ["MediumRelic", "Medium relic"],
  ["LargeRelic", "Large relic"],
  ["GeothermalField", "Geothermal field"],
  ["UndergroundRuins", "Underground ruins (mine site)"],
];

/** The footprint's south-west corner that centres an object on the tile clicked. */
export function cornerAt(kind: MapObjectKind, x: number, y: number, o: Orientation): [number, number] {
  const [a, b] = rotatedSize(kind, o);
  return [x - Math.floor((a - 1) / 2), y - Math.floor((b - 1) / 2)];
}

/** The Coordinates that centre a template's rotated footprint on the tile clicked. */
export function coordinatesAt(template: string, x: number, y: number, o: Orientation): [number, number] {
  const fp = FOOTPRINTS[template];
  if (!fp) return [x, y];
  const [sx, sy] = fp.size;
  const a = o === "Cw90" || o === "Cw270" ? sy : sx;
  const b = o === "Cw90" || o === "Cw270" ? sx : sy;
  const mx = x - Math.floor((a - 1) / 2);
  const my = y - Math.floor((b - 1) / 2);
  switch (o) {
    case "Cw0":
      return [mx, my];
    case "Cw90":
      return [mx, my + sx - 1];
    case "Cw180":
      return [mx + sx - 1, my + sy - 1];
    case "Cw270":
      return [mx + sy - 1, my];
  }
}

export type Species = "Pine" | "Birch" | "Oak" | "mixed";
export type FlowWord = "gentle" | "steady" | "strong";
export type Edge = LandformFeature["params"]["edgeStyle"];

export interface ToolOptions {
  /** A landform's level, or 0 for the default (a little above or below the ground). */
  height: number;
  edge: Edge;
  /** Share of tiles that get a tree or bush, 0.1–1. */
  density: number;
  species: Species;
  /** A river's or a waterfall's flow. */
  flow: FlowWord;
  /** A river's width in tiles (0: as wide as its flow needs), and how deep its bed lies below its
   *  banks (1–4). */
  riverWidth: number;
  riverDepth: number;
  /** A drawn river's strength (its source, blocks of water per second), and whether it meanders
   *  a little (Natural) or keeps its course exactly as drawn (Exact). */
  riverFlow: number;
  riverNatural: boolean;
  /** A water source's strength (and a lake's spring), and a badwater source's, blocks per second. */
  sourceStrength: number;
  badwaterStrength: number;
  /** A lake's water level, or 0 for the lowest ground round it. */
  level: number;
  /** A lake's spring, blocks per second. */
  spring: number;
  facing: Facing;
  fallWidth: number;
  drop: number;
  crest: number;
  gorgeLength: number;
  gorgeWidth: number;
  wallHeight: number;
  stairs: boolean;
  bands: number;
  bandDepth: number;
  cliffWidth: number;
  strength: number;
  /** Map objects and entities placed by hand: their facing, a relic's size, a core's countdown. */
  turn: Orientation;
  relic: "small" | "medium" | "large";
  coreRadius: number;
  coreCycles: number;
  /** A forest: only where trees live, or dead ones on dry ground too. */
  life: "alive" | "auto";
  /** The object advanced mode places. */
  template: string;
}

export const DEFAULT_OPTIONS: ToolOptions = {
  height: 0,
  edge: "gentle",
  density: 0.6,
  species: "mixed",
  flow: "steady",
  riverWidth: 0,
  riverDepth: 1,
  riverFlow: 2,
  riverNatural: true,
  sourceStrength: 1.5,
  badwaterStrength: 1,
  level: 0,
  spring: 0.5,
  facing: "north",
  fallWidth: 8,
  drop: 6,
  crest: 2,
  gorgeLength: 16,
  gorgeWidth: 5,
  wallHeight: 3,
  stairs: true,
  bands: 4,
  bandDepth: 8,
  cliffWidth: 16,
  strength: 1.5,
  turn: "Cw0",
  relic: "small",
  coreRadius: 2,
  coreCycles: 6,
  life: "alive",
  template: "Blockage",
};

/** Defaults that change with the tool: a plateau keeps the cliff edges it always had. */
export function optionsFor(t: ToolKind, o: ToolOptions): ToolOptions {
  if (t === "plateau" && o.edge === DEFAULT_OPTIONS.edge) return { ...o, edge: "cliff" };
  return o;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const FLOW = { gentle: 1, steady: 2, strong: 4 } as const;

/** What the worker plans for a tool's gesture: an outline, a path, a point or a rectangle. */
export function toolRequest(t: ToolKind, o: ToolOptions, g: { points?: Point[]; at?: [number, number]; river?: { id: string; at: number } | null; W?: number; H?: number }): ToolRequest | null {
  switch (t) {
    case "forest":
    case "berryPatch":
    case "ruinField":
      if (!g.points || g.points.length < 3) return null;
      return { tool: "area", kind: t, outline: g.points, density: t === "ruinField" ? 1 : o.density, ...(t === "forest" ? { species: o.species, life: o.life } : {}) };
    case "thornBelt": {
      if (!g.points || g.points.length < 3 || !g.W || !g.H) return null;
      const m = polygonMask(g.points, g.W, g.H);
      const tiles: number[] = [];
      for (let i = 0; i < m.length; i++) if (m[i]) tiles.push(i);
      return { tool: "object", kind: "thornBelt", tiles, density: o.density };
    }
    case "weir":
    case "plug":
      return g.river ? { tool: "object", kind: t, river: g.river } : null;
    case "spillway":
      return g.at ? { tool: "spillway", at: g.at } : null;
    case "mineSite":
    case "relic":
    case "geothermal":
    case "core": {
      if (!g.at) return null;
      const kind = objectKindOf(t, o)!;
      return { tool: "object", kind, at: cornerAt(kind, g.at[0], g.at[1], o.turn), orientation: o.turn, ...(t === "core" ? { core: { radius: o.coreRadius, cycles: o.coreCycles } } : {}) };
    }
    case "object": {
      if (!g.at) return null;
      const [x, y] = coordinatesAt(o.template, g.at[0], g.at[1], o.turn);
      return { tool: "entity", template: o.template, x, y, orientation: o.turn };
    }
    case "hill":
    case "plateau":
    case "ridge":
    case "canyon":
    case "valley":
    case "island":
      if (!g.points || g.points.length < 3) return null;
      return { tool: "landform", outline: g.points, kind: t, edgeStyle: o.edge, ...(o.height > 0 ? { height: o.height } : {}), ...(o.edge === "terraced" ? { bandDepth: o.bandDepth } : {}) };
    case "lake":
    case "source":
    case "badwaterSource": {
      // a source on the tile (a lake's spring stands at its hollow's lowest point, found by the page)
      if (!g.at) return null;
      const s = t === "badwaterSource" ? o.badwaterStrength : o.sourceStrength;
      return { tool: "entity", template: t === "badwaterSource" ? "BadwaterSource" : "WaterSource", x: g.at[0], y: g.at[1], orientation: "Cw0", components: { WaterSource: { SpecifiedStrength: s, CurrentStrength: s } } };
    }
    case "river":
      if (!g.points || g.points.length < 2) return null;
      // drawn with the editor's rules (a branch from water, an end on dry ground fills its hollow),
      // natural or exact
      return { tool: "river", points: g.points, flow: o.riverFlow, drawn: true, ...(o.riverNatural ? { natural: true } : {}), ...(o.riverWidth > 0 ? { width: o.riverWidth } : {}), ...(o.riverDepth > 1 ? { bedDepth: o.riverDepth } : {}) };
    case "waterfall":
      if (g.river) return { tool: "setPiece", piece: "waterfall", request: { mode: "on-river", river: g.river.id, at: g.river.at, drop: o.drop } };
      if (!g.at) return null;
      return { tool: "setPiece", piece: "waterfall", request: { mode: "standalone", lip: g.at, facing: o.facing, width: o.fallWidth, drop: o.drop, flow: o.flow } };
    case "damSite":
      return g.river ? { tool: "setPiece", piece: "damSite", request: { river: g.river.id, at: g.river.at, crest: o.crest } } : null;
    case "gorge":
      return g.river ? { tool: "setPiece", piece: "gorge", request: { river: g.river.id, from: g.river.at, length: o.gorgeLength, width: o.gorgeWidth, wallHeight: o.wallHeight, access: o.stairs ? "stairs" : "none" } } : null;
    case "terracedCliffs":
      return g.at ? { tool: "setPiece", piece: "terracedCliffs", request: { at: g.at, facing: o.facing, bands: o.bands, depth: o.bandDepth, width: o.cliffWidth } } : null;
    case "badwater":
      return g.at ? { tool: "setPiece", piece: "badwaterBasin", request: { mode: "basin", at: g.at, strength: o.strength } } : null;
    default:
      return null;
  }
}

/** The resource features a rectangle makes (forest, berry patch, ruin field). */
export function featureFromRect(kind: ToolKind, r: Rect, o: ToolOptions, W: number, heights: Uint8Array): Feature {
  const base = { id: newId(), origin: "user" as const, locked: false };
  const tiles = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  switch (kind) {
    case "forest": {
      const speciesMix = o.species === "mixed" ? { Pine: 0.47, Birch: 0.27, Oak: 0.2, Succulent: 0.06 } : { [o.species]: 1 };
      return { ...base, kind: "forest", params: { area: rectRuns(r, W), density: o.density, speciesMix, life: "auto", youngShare: FOREST.youngShare } };
    }
    case "berryPatch":
      return { ...base, kind: "berryPatch", params: { area: rectRuns(r, W), density: o.density, ripeShare: 0.5 } };
    case "ruinField": {
      const meanH = RUIN_HEIGHT_SHARES.reduce((s, v, k) => s + v * (k + 1), 0);
      return {
        ...base,
        kind: "ruinField",
        params: { area: rectRuns(r, W), scrapTarget: Math.round(tiles * 15 * meanH), heightMix: [...RUIN_HEIGHT_SHARES], centerBias: RUINS.centerBias },
      };
    }
    default: {
      // a plateau from a rectangle, as M4 drew it: cliff edges, two levels above the ground
      let top = 0;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) top = Math.max(top, heights[y * W + x]);
      const height = o.height > 0 ? o.height : Math.min(16, top + 2);
      return { ...base, kind: "landform", params: { kind: "plateau", edgeStyle: "cliff", outline: rectOutline(r), height } };
    }
  }
}

// ---------------------------------------------------------------------------------- overlays

export type Rgba = [number, number, number, number];

/** The selected feature: its outline only, so its own ground shows through. */
export const SELECTED: Rgba = [255, 208, 90, 190];
export const MOVING: Rgba = [110, 214, 255, 150];
export const DRAWING: Rgba = [150, 235, 120, 140];
export const PREVIEW: Rgba = [90, 170, 255, 150];
export const GOOD: Rgba = [80, 200, 90, 170];
export const BAD: Rgba = [230, 60, 50, 180];
/** A resource area's preview: plants that would stand dead, and tiles nothing is placed on. */
export const DEAD: Rgba = [185, 130, 60, 170];
export const BARE: Rgba = [140, 140, 140, 110];
/** Dam sites: alpha 255 draws them hatched light and dark with a dark rim (the 3D view), so they
 *  show on any ground or water in any colours (Map look, D114). */
export const DAM: Rgba = [...DAM_OVERLAY];
export const PROBLEM: Rgba = [230, 60, 50, 150];

export interface OverlayLayer {
  tiles: ArrayLike<number>;
  color: Rgba;
  /** Shift the tiles by (dx, dy) (a move preview). */
  dx?: number;
  dy?: number;
  /** Tint only the tiles on the edge of the set (a selection's outline). */
  outline?: boolean;
}

/** Paint the overlay texture: tint the tiles of each layer (later layers on top). */
export function paintOverlay(data: Uint8Array, W: number, H: number, layers: readonly OverlayLayer[]): void {
  data.fill(0);
  for (const l of layers) {
    const dx = l.dx ?? 0;
    const dy = l.dy ?? 0;
    let inSet: Uint8Array | null = null;
    if (l.outline) {
      inSet = new Uint8Array(W * H);
      for (let k = 0; k < l.tiles.length; k++) inSet[l.tiles[k]] = 1;
    }
    for (let k = 0; k < l.tiles.length; k++) {
      const i = l.tiles[k];
      if (inSet) {
        const ox = i % W;
        const oy = (i - ox) / W;
        const inner = ox > 0 && oy > 0 && ox < W - 1 && oy < H - 1 && inSet[i - 1] && inSet[i + 1] && inSet[i - W] && inSet[i + W];
        if (inner) continue;
      }
      const x = (i % W) + dx;
      const y = Math.floor(i / W) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4;
      data[o] = l.color[0];
      data[o + 1] = l.color[1];
      data[o + 2] = l.color[2];
      data[o + 3] = l.color[3];
    }
  }
}

export function rectTiles(r: Rect, W: number): number[] {
  const out: number[] = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push(y * W + x);
  return out;
}

/** The tiles along a polyline (for drawing a river or an outline while it is drawn). */
export function lineTiles(points: readonly Point[], W: number, H: number, closed = false): number[] {
  const out = new Set<number>();
  const n = points.length;
  for (let k = 0; k + 1 < n + (closed && n > 2 ? 1 : 0); k++) {
    const [ax, ay] = points[k];
    const [bx, by] = points[(k + 1) % n];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(ax + ((bx - ax) * s) / steps);
      const y = Math.round(ay + ((by - ay) * s) / steps);
      if (x >= 0 && y >= 0 && x < W && y < H) out.add(y * W + x);
    }
  }
  if (n === 1) {
    const [x, y] = points[0];
    if (x >= 0 && y >= 0 && x < W && y < H) out.add(Math.round(y) * W + Math.round(x));
  }
  return [...out];
}

/** An outline whose tiles (by the rasterizers' centre rule) are exactly the rectangle's. */
export function rectToOutline(r: Rect): Point[] {
  return rectOutline(r);
}
