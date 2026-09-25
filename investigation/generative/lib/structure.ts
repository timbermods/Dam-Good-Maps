// The shape of a map's river network and of its relief, as vectors (for clustering, scaled on the
// workshop maps) and as coarse codes (for counting distinct shapes), read from a measured record
// (investigation/workshop/lib/measures.ts), so generated, official and workshop maps compare. Flow
// direction is left out on purpose: a network turned to another heading is the same shape.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RIVER_KEYS = ["inflows", "springs", "outflows", "bodies", "lakes", "ponds", "falls", "sinuosity", "length", "lakeShare", "islands"] as const;
export const RELIEF_KEYS = ["range", "levels", "plateaus", "cliffs", "oneLevel", "flat", "basins", "ridges", "gorge"] as const;

export function riverVector(r: any): number[] {
  const w = r.water;
  const per10k = 1e4 / r.area;
  return [
    Math.log1p(w.inflows),
    Math.log1p(w.springs),
    Math.log1p(w.outflows),
    Math.log1p(w.bodies),
    Math.log1p(w.lakes),
    Math.log1p(w.ponds),
    Math.log1p(r.metrics.waterfalls * per10k),
    r.score.courseSinuosity,
    r.score.courseLengthPerDiagonal,
    w.lakeShare,
    Math.log1p(w.islands100),
  ];
}

export function reliefVector(r: any): number[] {
  const m = r.metrics;
  const per10k = 1e4 / r.area;
  return [
    m.heightRange,
    r.terrain.levels1pct,
    Math.log1p(r.score.plateaus * per10k),
    m.cliffShare,
    m.step1Share,
    m.flatShare,
    Math.log1p(m.basins20 * per10k),
    Math.log1p(r.natural.ridges * per10k),
    Math.log1p(r.score.gorgeTiles),
  ];
}

const bucket = (v: number, cuts: number[]) => cuts.filter((c) => v >= c).length;

/** A coarse code of the river network: how many rivers come in from edges and springs, go out,
 *  how many lakes and falls. */
export function riverCode(r: any): string {
  const w = r.water;
  return [Math.min(w.inflows, 3), Math.min(w.springs, 4), Math.min(w.outflows, 3), Math.min(w.lakes, 3), bucket(r.metrics.waterfalls, [1, 3, 6]), bucket(w.islands100, [1, 3])].join("");
}

/** A coarse code of the relief: range, plateaus per 10k tiles, cliffs, basins, ridges. */
export function reliefCode(r: any): string {
  const m = r.metrics;
  const per10k = 1e4 / r.area;
  return [bucket(m.heightRange, [9, 12, 15]), bucket(r.score.plateaus * per10k, [2, 5, 10]), bucket(m.cliffShare, [0.08, 0.16]), bucket(m.basins20 * per10k, [1, 3]), bucket(r.natural.ridges * per10k, [3, 8])].join("");
}
