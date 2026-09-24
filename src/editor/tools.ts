// The editor's drawing tools (EDITOR_PLAN §4). Land: hills, plateaus, ridges, canyons, valleys and
// islands drawn by their outline, with a height and an edge style, and terraced cliffs. Water:
// rivers drawn point by point from source to outlet, lakes by their basin, waterfalls, dam sites,
// gorges and badwater springs. Resources (roadmap M7 brings their own tools): forests, berry
// patches and ruin fields as rectangles.
//
// An outline is dragged as a rectangle or clicked point by point; a river is clicked point by
// point; the rest are placed with one click. The worker plans the result on the map (the shared
// builders), the editor shows it with its report, and Place applies it as one step.

import type { Feature, LandformFeature, Point } from "../core/features/schema";
import type { Facing } from "../core/features/setpieces/common";
import { FOREST, RUIN_HEIGHT_SHARES, RUINS } from "../core/gen/calibrated";
import type { ToolRequest } from "../worker/session";
import { newId, rectOutline, rectRuns } from "./features";

export type LandKind = LandformFeature["params"]["kind"];
export type ToolKind = "hill" | "plateau" | "ridge" | "canyon" | "valley" | "island" | "terracedCliffs" | "slope" | "river" | "lake" | "waterfall" | "damSite" | "gorge" | "badwater" | "forest" | "berryPatch" | "ruinField";

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
  waterfall: "Waterfall",
  damSite: "Dam site",
  gorge: "Gorge",
  badwater: "Badwater spring",
  forest: "Forest",
  berryPatch: "Berry patch",
  ruinField: "Ruin field",
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
  river: "Click from the source to the outlet, then double-click. Start at the map edge or inland; end at the edge, in a river or in a lake.",
  lake: `Draw the lake's basin. ${OUTLINE_HINT} The water fills to the lowest ground round it.`,
  waterfall: "Click where the lip goes. On a river, the river drops there. Anywhere else, it builds its own cliff, springs and outflow.",
  damSite: "Click a river where the dam should go. A rock ridge closes the valley so one short dam holds a reservoir.",
  gorge: "Click a river where the gorge starts. It narrows the river between high walls downstream.",
  badwater: "Click where the badwater spring goes, away from the start. Its water leaves through one outlet you can dam.",
  forest: "Drag a rectangle on the map to plant a forest. Trees grow alive where the soil stays moist.",
  berryPatch: "Drag a rectangle on the map to plant blueberry bushes.",
  ruinField: "Drag a rectangle on the map to place a field of ruin columns (scrap metal).",
};

export const LAND_TOOLS: ToolKind[] = ["hill", "plateau", "ridge", "canyon", "valley", "island", "terracedCliffs", "slope"];
export const WATER_TOOLS: ToolKind[] = ["river", "lake", "waterfall", "damSite", "gorge", "badwater"];
export const RESOURCE_TOOLS: ToolKind[] = ["forest", "berryPatch", "ruinField"];

/** How a tool takes its shape from the map. */
export function gestureOf(t: ToolKind): "outline" | "path" | "point" | "rect" {
  if (t === "river") return "path";
  if (t === "forest" || t === "berryPatch" || t === "ruinField") return "rect";
  if (t === "terracedCliffs" || t === "waterfall" || t === "damSite" || t === "gorge" || t === "badwater" || t === "slope") return "point";
  return "outline";
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
}

export const DEFAULT_OPTIONS: ToolOptions = {
  height: 0,
  edge: "gentle",
  density: 0.6,
  species: "mixed",
  flow: "steady",
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
export function toolRequest(t: ToolKind, o: ToolOptions, g: { points?: Point[]; at?: [number, number]; river?: { id: string; at: number } | null }): ToolRequest | null {
  switch (t) {
    case "hill":
    case "plateau":
    case "ridge":
    case "canyon":
    case "valley":
    case "island":
      if (!g.points || g.points.length < 3) return null;
      return { tool: "landform", outline: g.points, kind: t, edgeStyle: o.edge, ...(o.height > 0 ? { height: o.height } : {}), ...(o.edge === "terraced" ? { bandDepth: o.bandDepth } : {}) };
    case "lake":
      if (!g.points || g.points.length < 3) return null;
      return { tool: "lake", outline: g.points, spring: o.spring, ...(o.level > 0 ? { level: o.level } : {}) };
    case "river":
      if (!g.points || g.points.length < 2) return null;
      return { tool: "river", points: g.points, flow: FLOW[o.flow] };
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

export const SELECTED: Rgba = [255, 208, 90, 105];
export const MOVING: Rgba = [110, 214, 255, 150];
export const DRAWING: Rgba = [150, 235, 120, 140];
export const PREVIEW: Rgba = [90, 170, 255, 150];
export const GOOD: Rgba = [80, 200, 90, 170];
export const BAD: Rgba = [230, 60, 50, 180];
export const DAM: Rgba = [255, 140, 20, 200];
export const PROBLEM: Rgba = [230, 60, 50, 150];

export interface OverlayLayer {
  tiles: ArrayLike<number>;
  color: Rgba;
  /** Shift the tiles by (dx, dy) (a move preview). */
  dx?: number;
  dy?: number;
}

/** Paint the overlay texture: tint the tiles of each layer (later layers on top). */
export function paintOverlay(data: Uint8Array, W: number, H: number, layers: readonly OverlayLayer[]): void {
  data.fill(0);
  for (const l of layers) {
    const dx = l.dx ?? 0;
    const dy = l.dy ?? 0;
    for (let k = 0; k < l.tiles.length; k++) {
      const i = l.tiles[k];
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
