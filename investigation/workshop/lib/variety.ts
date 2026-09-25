// The variety score: how different two maps are, in layout and in features, and how varied a set
// of maps is.
//
// - Layout: each map's 16×16 picture (lib/measures.ts `layoutSignature`: mean height rank and water
//   share per cell). Two maps are compared under the 8 rotations and mirrors of the square and the
//   closest one counts, so a rotated or mirrored copy is not a new layout:
//     L(A, B) = min over T of 0.7·mean|hA − T(hB)| + 0.3·mean|wA − T(wB)|.
// - Features: 14 size-free numbers (relief, cliffs, one-level steps, flat land, water, lakes,
//   islands, falls, basins, dam sites, trees, berries, scrap, caves), each divided by its spread
//   over the reference maps: F(A, B) = the root mean square of the differences.
// - Distance: V(A, B) = 0.5·L/L0 + 0.5·F/F0, with L0 and F0 the median L and F over pairs of
//   workshop maps, so a typical pair of workshop maps is 1 apart.
// - A set's variety is the mean V over its pairs. The generator's variety is reported as a share of
//   the workshop's.

export interface VarietyInput {
  key: string;
  layout: { heights: number[]; water: number[] };
  features: number[];
}

export const FEATURE_NAMES = [
  "relief", "cliffShare", "step1Share", "flatShare", "waterShare", "lakeShare", "islands", "waterfalls",
  "basins", "damSitesPer10k", "treesPer10k", "bushesPer10k", "scrapPer1k", "caveShare",
] as const;

/** The feature vector of a measured record (measure.ts / measure-generated.ts output). */
export function featureVector(r: {
  area: number;
  metrics: { heightRange: number; cliffShare: number; step1Share: number; flatShare: number; waterShare: number; waterfalls: number; basins20: number; treesPer10k: number; bushesPer10k: number; scrapPer1k: number };
  water: { lakeShare: number; islands100: number };
  dams: { per10k: number };
  terrain: { caveShare: number };
}): number[] {
  const m = r.metrics;
  const per10k = 1e4 / r.area;
  return [
    m.heightRange,
    m.cliffShare,
    m.step1Share,
    m.flatShare,
    m.waterShare,
    r.water.lakeShare,
    Math.log1p(r.water.islands100),
    Math.log1p(m.waterfalls * per10k),
    Math.log1p(m.basins20 * per10k),
    Math.log1p(r.dams.per10k),
    Math.log1p(m.treesPer10k),
    Math.log1p(m.bushesPer10k),
    Math.log1p(m.scrapPer1k),
    Math.sqrt(r.terrain.caveShare),
  ];
}

const G = 16;
/** The 8 symmetries of the square grid, as index maps. */
const SYMS: Int32Array[] = (() => {
  const out: Int32Array[] = [];
  for (let s = 0; s < 8; s++) {
    const m = new Int32Array(G * G);
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        let u = x;
        let v = y;
        if (s & 4) [u, v] = [v, u];
        if (s & 1) u = G - 1 - u;
        if (s & 2) v = G - 1 - v;
        m[y * G + x] = v * G + u;
      }
    }
    out.push(m);
  }
  return out;
})();

export function layoutDistance(a: VarietyInput["layout"], b: VarietyInput["layout"]): number {
  let best = Infinity;
  for (const sym of SYMS) {
    let dh = 0;
    let dw = 0;
    for (let k = 0; k < G * G; k++) {
      dh += Math.abs(a.heights[k] - b.heights[sym[k]]);
      dw += Math.abs(a.water[k] - b.water[sym[k]]);
    }
    const d = (0.7 * dh + 0.3 * dw) / (G * G);
    if (d < best) best = d;
  }
  return best;
}

export interface Scale {
  /** Spread of each feature over the reference maps. */
  spread: number[];
  /** Median layout and feature distances over pairs of reference maps. */
  L0: number;
  F0: number;
}

function median(v: number[]): number {
  const s = v.slice().sort((p, q) => p - q);
  return s.length ? s[s.length >> 1] : 0;
}

export function featureDistance(a: number[], b: number[], spread: number[]): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) {
    const d = (a[k] - b[k]) / (spread[k] || 1);
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

/** The scale from a reference set (the workshop maps). */
export function scaleFrom(ref: VarietyInput[]): Scale {
  const n = ref.length;
  const dims = ref[0].features.length;
  const spread: number[] = [];
  for (let k = 0; k < dims; k++) {
    const v = ref.map((r) => r.features[k]).sort((p, q) => p - q);
    // a robust spread: the p10–p90 range over 2.56 (the normal's σ), floored
    const p10 = v[Math.floor(0.1 * (n - 1))];
    const p90 = v[Math.floor(0.9 * (n - 1))];
    spread.push(Math.max((p90 - p10) / 2.56, 1e-6));
  }
  const ls: number[] = [];
  const fs: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      ls.push(layoutDistance(ref[i].layout, ref[j].layout));
      fs.push(featureDistance(ref[i].features, ref[j].features, spread));
    }
  }
  return { spread, L0: median(ls), F0: median(fs) };
}

export function distance(a: VarietyInput, b: VarietyInput, s: Scale): number {
  return 0.5 * (layoutDistance(a.layout, b.layout) / s.L0) + 0.5 * (featureDistance(a.features, b.features, s.spread) / s.F0);
}

/** Mean distance over the pairs of a set. */
export function setVariety(set: VarietyInput[], s: Scale): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      sum += distance(set[i], set[j], s);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Each map's distance to its nearest neighbour in another set (novelty against that set). */
export function nearest(from: VarietyInput[], to: VarietyInput[], s: Scale): number[] {
  return from.map((a) => to.reduce((m, b) => (a.key === b.key ? m : Math.min(m, distance(a, b, s))), Infinity));
}
