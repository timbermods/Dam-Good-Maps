// The editor's tools beside the brushes (EDITOR_PLAN §4; the brush kit is the core, PLAN §20 D182:
// hills and valleys come from the brushes). Land: terraced cliffs, slopes and thorn belts.
// Water: sources (clean or bad; the rest of the water emerges from the land, D184), waterfalls, dam
// sites, gorges, badwater springs, weirs, plugs and plugged spillways.
// Resources: mine sites, relics and geothermal fields. Advanced mode: unstable cores and any object
// placed by hand, with the game's footprint rules.
//
// A source is placed live; a thorn belt's outline is dragged as a rectangle or
// clicked point by point, and the rest are placed with one click, planned by the worker (the shared
// builders) and shown with their report before Place. Objects show their footprint green or red
// under the pointer before the click.

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
  | "terracedCliffs" | "slope" | "thornBelt"
  | "source" | "waterfall" | "damSite" | "gorge" | "badwater" | "weir" | "plug" | "spillway"
  | "mineSite" | "relic" | "geothermal" | "core" | "object";

export const TOOL_NAMES: Record<ToolKind, string> = {
  terracedCliffs: "Terraced cliffs",
  slope: "Slope",
  source: "Source",
  waterfall: "Waterfall",
  damSite: "Dam site",
  gorge: "Gorge",
  badwater: "Badwater spring",
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
  terracedCliffs: "Click the spot beside the water where the bottom band starts. The bands rise away from the way it faces.",
  slope: "Slopes appear by themselves where the colony needs them. Click the low tile beside a 1-level step to add one there, or click a slope to remove it.",
  source: "Click where water starts: it spreads at once. Over a source, Alt+scroll sets its strength; drag it to move it.",
  waterfall: "Click where the lip goes. On a river, the river drops there. Anywhere else, it builds its own cliff, springs and outflow.",
  damSite: "Click a river where the dam should go. A rock ridge closes the valley so one short dam holds a reservoir.",
  gorge: "Click a river where the gorge starts. It narrows the river between high walls downstream.",
  badwater: "Click where the badwater spring goes, away from the start. Its water leaves through one outlet you can dam.",
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

export const LAND_TOOLS: ToolKind[] = ["terracedCliffs", "slope", "thornBelt"];
export const WATER_TOOLS: ToolKind[] = ["source", "waterfall", "damSite", "gorge", "badwater", "weir", "plug", "spillway"];
export const RESOURCE_TOOLS: ToolKind[] = ["mineSite", "relic", "geothermal"];
/** Tools advanced mode adds (on the Resources tab). */
export const ADVANCED_TOOLS: ToolKind[] = ["core", "object"];

/** How a tool takes its shape from the map. */
export function gestureOf(t: ToolKind): "outline" | "path" | "point" | "rect" {
  if (t === "terracedCliffs" || t === "waterfall" || t === "damSite" || t === "gorge" || t === "badwater" || t === "slope") return "point";
  if (t === "weir" || t === "plug" || t === "spillway" || t === "mineSite" || t === "relic" || t === "geothermal" || t === "core" || t === "object") return "point";
  if (t === "source") return "point";
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
  /** A thorn belt's share of tiles with thorns, 0.1–1. */
  density: number;
  /** A standalone waterfall's flow. */
  flow: FlowWord;
  /** A source's water, clean or bad, and its strength in blocks per second (clean: one tile, at
   *  most 8; bad: 3 × 3, at most 72). */
  sourceBad: boolean;
  sourceStrength: number;
  badwaterStrength: number;
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
  /** The object advanced mode places. */
  template: string;
}

/** A water source's strengths, blocks per second (one tile: at most 8, the game's most per tile),
 *  and a badwater source's (its 3 × 3 tiles: at most 72): the slider's steps, and scroll's. */
export const SOURCE_STRENGTHS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8];
export const BADWATER_STRENGTHS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 72];

export const DEFAULT_OPTIONS: ToolOptions = {
  density: 0.6,
  flow: "steady",
  sourceBad: false,
  sourceStrength: 1.5,
  badwaterStrength: 1,
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
  template: "Blockage",
};

/** A tool's options (kept for the tools whose defaults change with the tool). */
export function optionsFor(_t: ToolKind, o: ToolOptions): ToolOptions {
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
    case "source": {
      // a clean source on the tile, a bad one (3 × 3) round it
      if (!g.at) return null;
      const s = o.sourceBad ? o.badwaterStrength : o.sourceStrength;
      const template = o.sourceBad ? "BadwaterSource" : "WaterSource";
      const [x, y] = coordinatesAt(template, g.at[0], g.at[1], "Cw0");
      return { tool: "entity", template, x, y, orientation: "Cw0", components: { WaterSource: { SpecifiedStrength: s, CurrentStrength: s } } };
    }
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
