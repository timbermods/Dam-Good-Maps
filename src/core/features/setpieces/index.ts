// Shared set-piece builders (PLAN §19.3): one module per kind, used by the generator's planner and,
// later, the editor's tools and Claude. `plan` resolves a request against the map and clamps it to
// what the map allows, reporting every reduction; `rasterize` builds the stored plan and never
// plans again. The kinds the prototype builds exist, in the generation context only: the dam site
// (gorge ridge across a valley), the on-river waterfall (a bed step) and, from M2, the badwater
// marsh.

import type { BuildTarget, Rect } from "../target";
import type { SetPieceFeature, SetPieceKind } from "../schema";
import { badwaterBasin } from "./badwaterBasin";
import { damSite } from "./damSite";
import { waterfall } from "./waterfall";

export interface AchievableRanges {
  [param: string]: { min: number; max: number; typical?: [number, number] };
}

/** A water source a set piece adds (build step 9), at Cw0 with its Coordinates at (x, y). */
export interface SetPieceSource {
  template: "WaterSource" | "BadwaterSource";
  x: number;
  y: number;
  strength: number;
  /** Tiles it covers relative to (x, y); they are kept free of slopes and resources. */
  tiles: [number, number][];
}

export interface SetPieceBuilder {
  kind: SetPieceKind;
  limits(target: BuildTarget): AchievableRanges;
  rasterize(feature: SetPieceFeature, target: BuildTarget): void;
  /** Every tile the rasterizer reads or writes (a dirty-region rebuild widens to it), or "all". */
  footprint(feature: SetPieceFeature, target: BuildTarget): Rect | "all" | null;
  /** The sources the set piece adds, if any. */
  sources?(feature: SetPieceFeature): SetPieceSource[];
}

export const BUILDERS: Partial<Record<SetPieceKind, SetPieceBuilder>> = {
  badwaterBasin,
  damSite,
  waterfall,
};

/** Clamp a requested value to a range; the report line says what changed. */
export function clampReported(name: string, value: number, range: { min: number; max: number }, report: string[]): number {
  if (value < range.min) {
    report.push(`${name} ${value} raised to ${range.min}, the smallest this map allows`);
    return range.min;
  }
  if (value > range.max) {
    report.push(`${name} ${value} reduced to ${range.max}, the largest this map allows`);
    return range.max;
  }
  return value;
}
