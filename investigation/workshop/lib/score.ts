// The interestingness score, prototype (PLAN §12 extended by the workshop study). Every component
// is 0–1 and computable on any map, generated or imported, from its measured record
// (lib/measures.ts); the score is 100 × the weighted mean. Parameters (norms, targets, weights) live
// in one JSON object, so the product can adopt them as data and a rating fit (fit-score.ts) can
// replace the targets and weights without code changes.
//
// PLAN §12's components, with rivers read from the settled water where a map has no river features,
// and its dam value turned round (Kyler, 2026-09-24: reservoirs are the player's engineering, not a
// gift of the terrain):
//   engineering  clean water to work with, but no short dam near the start that already holds a
//                drought's water: 0 when a dam of 5 tiles or fewer within 20 tiles does, 0.4 within
//                40, 0.8 when the shortest holding dam is 6–12 tiles, 1 beyond or none
//   height    levels covering 1%+ of the map, and one-level steps near their target share
//   landmarks falls, plateaus (against the size class's official median), a gorge, islands
//   river     the main watercourse's sinuosity and length over the diagonal
//   pacing    living trees, berries and scrap by distance from the start, against the official rings
//   regions   level regions and water bodies of 1%+, groves of 50+
//   tradeoff  the best land is not also the easiest to water
//   frontier  scrap and the largest reservoir site beyond half the start's reach
// and four from the study:
//   surprise  how far the map is from its nearest familiar map (the official maps and the current
//             generator), by the variety score (lib/variety.ts): novelty
//   vertical  relief, cliffs, the tallest fall and tall falls (verticality makes its own challenges)
//   natural   few long straight steps, and ridges that vary in thickness
//   water     the water share near its target

export const COMPONENTS = ["engineering", "height", "landmarks", "river", "pacing", "regions", "tradeoff", "frontier", "surprise", "vertical", "natural", "water"] as const;
export type Component = (typeof COMPONENTS)[number];

export interface ScoreParams {
  version: 1;
  weights: Record<Component, number>;
  targets: {
    /** Share of height steps that are one level. */
    step1Share: number;
    /** Share of the map under water. */
    waterShare: number;
  };
  bands: { step1Share: number; waterShare: number };
  norms: {
    levels1pct: [number, number];
    regions: [number, number];
    sinuosity: [number, number];
    courseLength: [number, number];
    /** Official median plateau count per size class. */
    plateausBySize: Record<"small" | "medium" | "large" | "max", number>;
    /** Official median ring shares (0–16, 16–32, 32–64, 64–128, 128+ tiles from the start). */
    rings: { trees: number[]; bushes: number[]; scrap: number[] };
    /** Nearest-familiar-map distance (variety score): [0, 1] ends. */
    surprise: [number, number];
    /** Share of steps in straight runs of 8+: [natural, engineered] ends. */
    straight: [number, number];
    /** Ridge thickness variation: [engineered, natural] ends. */
    ridgeCV: [number, number];
  };
}

export interface ScoreRecord {
  area: number;
  metrics: { waterfalls: number; waterShare: number; step1Share: number; heightRange: number; cliffShare: number };
  terrain: { levels1pct: number };
  water: { islands100: number; maxFallDrop: number; tallFalls: number };
  natural: { straightShare8: number; ridgeThicknessCV: number | null };
  score: {
    damRatioNearStart: number;
    damSites100NearStart: number;
    plateaus: number;
    gorgeTiles: number;
    courseSinuosity: number;
    courseLengthPerDiagonal: number;
    rings: { trees: number[] | null; bushes: number[] | null; scrap: number[] | null };
    regions: number;
    tradeoff: number;
    frontier: number;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const norm = (v: number, [lo, hi]: [number, number]) => (hi === lo ? 0.5 : clamp01((v - lo) / (hi - lo)));

function sizeClass(area: number): "small" | "medium" | "large" | "max" {
  return area <= 12_000 ? "small" : area <= 20_000 ? "medium" : area <= 45_000 ? "large" : "max";
}

/** Earth mover's distance between two 5-bin ring profiles, 0 (same) to 1 (opposite ends). */
export function ringDistance(a: number[], b: number[]): number {
  let cum = 0;
  let d = 0;
  for (let k = 0; k < a.length - 1; k++) {
    cum += a[k] - b[k];
    d += Math.abs(cum);
  }
  return d / (a.length - 1);
}

/** The shortest straight dam near the start that holds a Normal drought's need (obviousness.ts). */
export interface ReservoirHelp {
  shortestHolding20: number | null;
  shortestHolding40: number | null;
}

export function engineering(obv: ReservoirHelp | null): number {
  if (!obv) return 0.5;
  if (obv.shortestHolding20 !== null && obv.shortestHolding20 <= 5) return 0;
  const s40 = obv.shortestHolding40;
  if (s40 !== null && s40 <= 5) return 0.4;
  if (s40 !== null && s40 <= 12) return 0.8;
  return 1;
}

export function components(r: ScoreRecord, p: ScoreParams, surprise: number | null, obv: ReservoirHelp | null = null): Record<Component, number> {
  const s = r.score;
  const n = p.norms;
  const height = 0.5 * norm(r.terrain.levels1pct, n.levels1pct) + 0.5 * clamp01(1 - Math.abs(r.metrics.step1Share - p.targets.step1Share) / p.bands.step1Share);
  const plateauMedian = Math.max(1, n.plateausBySize[sizeClass(r.area)]);
  const landmarks = 0.35 * Math.min(1, r.metrics.waterfalls / 4) + 0.25 * Math.min(1, s.plateaus / plateauMedian) + 0.2 * (s.gorgeTiles >= 15 ? 1 : 0) + 0.2 * Math.min(1, r.water.islands100 / 3);
  const river = 0.5 * norm(s.courseSinuosity, n.sinuosity) + 0.5 * norm(s.courseLengthPerDiagonal, n.courseLength);
  const ds: number[] = [];
  if (s.rings.trees) ds.push(ringDistance(s.rings.trees, n.rings.trees));
  if (s.rings.bushes) ds.push(ringDistance(s.rings.bushes, n.rings.bushes));
  if (s.rings.scrap) ds.push(ringDistance(s.rings.scrap, n.rings.scrap));
  const pacing = ds.length ? 1 - ds.reduce((a, b) => a + b, 0) / ds.length : 0.5;
  const regions = norm(s.regions, n.regions);
  const natural = 0.5 * (1 - norm(r.natural.straightShare8, n.straight)) + 0.5 * (r.natural.ridgeThicknessCV === null ? 0.5 : norm(r.natural.ridgeThicknessCV, n.ridgeCV));
  const water = clamp01(1 - Math.abs(r.metrics.waterShare - p.targets.waterShare) / p.bands.waterShare);
  const vertical =
    0.3 * norm(r.metrics.heightRange, [8, 16]) + 0.2 * norm(r.metrics.cliffShare, [0.05, 0.2]) + 0.3 * norm(r.water.maxFallDrop, [2, 10]) + 0.2 * Math.min(1, r.water.tallFalls / 2);
  return {
    engineering: engineering(obv),
    height,
    landmarks,
    river,
    pacing,
    regions,
    tradeoff: s.tradeoff,
    frontier: s.frontier,
    surprise: surprise === null ? 0.5 : norm(surprise, n.surprise),
    vertical,
    natural,
    water,
  };
}

export function scoreOf(c: Record<Component, number>, w: Record<Component, number>): number {
  let sum = 0;
  let tot = 0;
  for (const k of COMPONENTS) {
    sum += (w[k] ?? 0) * c[k];
    tot += w[k] ?? 0;
  }
  return tot ? (100 * sum) / tot : 0;
}

/** PLAN §12's weights, reshaped by the study and Kyler's notes (2026-09-24): novelty and
 *  verticality weigh as much as landmarks; a ready-made reservoir no longer scores. */
export const DEFAULT_WEIGHTS: Record<Component, number> = {
  engineering: 0.08,
  height: 0.08,
  landmarks: 0.12,
  river: 0.06,
  pacing: 0.1,
  regions: 0.07,
  tradeoff: 0.07,
  frontier: 0.04,
  surprise: 0.14,
  vertical: 0.14,
  natural: 0.06,
  water: 0.04,
};
