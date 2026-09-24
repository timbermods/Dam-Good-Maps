// Shared set-piece builders (PLAN §19.3): one module per kind, used by the generator's planner and,
// later, the editor's tools and Claude. `plan` resolves a request against the map and clamps it to
// what the map allows, reporting every reduction; `rasterize` builds the stored plan and never
// plans again. M1 has the two kinds the prototype builds, in the generation context only: the dam
// site (gorge ridge across a valley) and the on-river waterfall (a bed step).

import type { BuildTarget } from "../build";
import type { SetPieceFeature, SetPieceKind } from "../schema";
import { damSite } from "./damSite";
import { waterfall } from "./waterfall";

export interface AchievableRanges {
  [param: string]: { min: number; max: number; typical?: [number, number] };
}

export interface SetPieceBuilder {
  kind: SetPieceKind;
  limits(target: BuildTarget): AchievableRanges;
  rasterize(feature: SetPieceFeature, target: BuildTarget): void;
}

export const BUILDERS: Partial<Record<SetPieceKind, SetPieceBuilder>> = {
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
