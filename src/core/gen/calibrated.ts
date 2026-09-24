// Calibrated targets (PLAN §4, §5): the TypeScript side of prototype/calibrated.py. The numbers come
// from investigation/calibration.json; tests/contract/calibrated.test.ts asserts the two agree.

/** Official size-class medians, interpolated in log(area) (PLAN §5 "size-aware"). */
export const SIZE_ANCHORS = [3750, 16384, 36864, 65536] as const;
export const DENSITY = {
  scrap_per_1k_tiles: [840, 705, 236, 237],
  trees_per_10k: [1715, 1061, 534, 500],
  bushes_per_10k: [265, 92, 40, 38],
  water_strength_per_10k: [5.0, 2.2, 1.2, 1.1],
  ruin_field_columns: [21, 31, 40, 41],
  /** Natural basins of 20+ tiles per map (analyze_maps.py `basins.count_ge20`; PLAN §5.3 Lakes and
   *  basins): the official size-class medians. */
  basins_ge20: [1.5, 4, 15.5, 15],
} as const;
export type DensityKey = keyof typeof DENSITY;

/** log(area) interpolation without Math.log: ln(a) − ln(b) = ln(a/b), and the anchors are fixed,
 *  so the interpolation weight is computed from a deterministic ln of a ratio. */
export function density(key: DensityKey, area: number): number {
  const ys = DENSITY[key];
  const a = Math.max(area, 1);
  if (a <= SIZE_ANCHORS[0]) return ys[0];
  for (let i = 1; i < SIZE_ANCHORS.length; i++) {
    if (a <= SIZE_ANCHORS[i]) {
      const t = lnDet(a / SIZE_ANCHORS[i - 1]) / lnDet(SIZE_ANCHORS[i] / SIZE_ANCHORS[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** Natural log for x in [1, 64] by halving to [1, 2) and the atanh series (basic operations only). */
export function lnDet(x: number): number {
  if (x <= 0) throw new Error("lnDet of a non-positive number");
  let k = 0;
  while (x >= 2) {
    x /= 2;
    k++;
  }
  while (x < 1) {
    x *= 2;
    k--;
  }
  const z = (x - 1) / (x + 1);
  const z2 = z * z;
  let term = z;
  let sum = 0;
  for (let n = 1; n < 60; n += 2) {
    sum += term / n;
    term *= z2;
  }
  return 2 * sum + k * 0.6931471805599453;
}

/** Official ruin column height shares H1…H8 (calibration.json ruin_height_shares.official). */
export const RUIN_HEIGHT_SHARES = [0.282, 0.224, 0.173, 0.103, 0.079, 0.052, 0.042, 0.044];

export const RUINS = {
  singlesShare: 0.05,
  centerBias: 0.35,
  holeShare: 0.05,
  compactness: 2 as const,
  minStartDist: 22, // official nearest ruin to the start: p10 22
  minFieldSpacing: 18,
  sizeFactors: [0.6, 0.8, 1.0, 1.2, 1.5, 1.9],
};

export const FOREST = {
  livingShare: 0.4,
  youngShare: 0.35,
  grove: { scattered: { median: 6, cap: 120 }, normal: { median: 10, cap: 180 }, bigWoods: { median: 20, cap: 300 } },
  nearStart: { radius: 18, minLiving: 40 },
};

export const BUSHES = {
  patchMedian: 20,
  nearStartRadius: 16,
};

export const RIVER_FLOW_MULTIPLIER = { trickle: 0.6, normal: 1, strong: 2, lush: 4 } as const;

/** Badwater-to-clean strength ratio by the Badwater setting (PLAN §5.4; official median 0.65). */
export const BADWATER_RATIO = { off: 0, low: 0.3, normal: 0.65, high: 1.2 } as const;

/** Drought reserve multipliers (PLAN §5.3). */
export const RESERVE = { scarce: 1, normal: 1.5, plenty: 3 } as const;
/** Lakes and basins: multipliers on the official natural-basin median for the size (PLAN §5.3). */
export const LAKES = { none: 0, few: 0.5, some: 1, many: 2 } as const;

/** Stored water a colony needs through the worst drought (PLAN §11.4). */
export const DROUGHT = {
  easy: { days: 4, colony: 40 },
  normal: { days: 9, colony: 50 },
  hard: { days: 30, colony: 50 },
} as const;

export function reservoirNeeded(d: keyof typeof DROUGHT): number {
  const { days, colony } = DROUGHT[d];
  const span = days + 0.5;
  const drink = colony * 0.424 * span;
  return Math.round(drink + (drink / 2) * 0.0535 * span);
}

/** Reachable land for Buildable land = Tight / Normal / Generous (PLAN §5.2). */
export const REACH_MIN = { tight: 750, normal: 1300, generous: 2500 } as const;
