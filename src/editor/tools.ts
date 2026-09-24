// The editor's drawing tools in this version (PLAN §20, D42): a rectangle dragged on the map makes
// a plateau (Land) or a forest, berry patch or ruin field (Resources). The shaping tools with
// outlines, edge styles and handles arrive with roadmap M5 (land and water) and M7 (resources);
// these make the same features, so what they draw stays editable when those tools arrive.

import type { Feature } from "../core/features/schema";
import { FOREST, RUIN_HEIGHT_SHARES, RUINS } from "../core/gen/calibrated";
import { newId, rectOutline, rectRuns } from "./features";

export type ToolKind = "plateau" | "forest" | "berryPatch" | "ruinField";

export const TOOL_NAMES: Record<ToolKind, string> = { plateau: "Plateau", forest: "Forest", berryPatch: "Berry patch", ruinField: "Ruin field" };

export const TOOL_HINTS: Record<ToolKind, string> = {
  plateau: "Drag a rectangle on the map to raise a plateau with cliff edges.",
  forest: "Drag a rectangle on the map to plant a forest. Trees grow alive where the soil stays moist.",
  berryPatch: "Drag a rectangle on the map to plant blueberry bushes.",
  ruinField: "Drag a rectangle on the map to place a field of ruin columns (scrap metal).",
};

export type Species = "Pine" | "Birch" | "Oak" | "mixed";

export interface ToolOptions {
  /** Plateau height, or 0 for two levels above the highest ground under it. */
  height: number;
  /** Share of tiles that get a tree or bush, 0.1–1. */
  density: number;
  species: Species;
}

export const DEFAULT_OPTIONS: ToolOptions = { height: 0, density: 0.6, species: "mixed" };

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MAX_HEIGHT = 16;

/** The feature a tool makes from a rectangle of tiles. */
export function featureFromRect(kind: ToolKind, r: Rect, o: ToolOptions, W: number, heights: Uint8Array): Feature {
  const base = { id: newId(), origin: "user" as const, locked: false };
  const tiles = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  switch (kind) {
    case "plateau": {
      let top = 0;
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) top = Math.max(top, heights[y * W + x]);
      const height = o.height > 0 ? o.height : Math.min(MAX_HEIGHT, top + 2);
      return { ...base, kind: "landform", params: { kind: "plateau", edgeStyle: "cliff", outline: rectOutline(r), height } };
    }
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
  }
}

// ---------------------------------------------------------------------------------- overlays

export type Rgba = [number, number, number, number];

export const SELECTED: Rgba = [255, 208, 90, 105];
export const MOVING: Rgba = [110, 214, 255, 150];
export const DRAWING: Rgba = [150, 235, 120, 140];

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
