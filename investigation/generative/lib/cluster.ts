// Average-linkage (UPGMA) agglomerative clustering, cut at a fixed height: clusters merge while the
// mean distance between their members is below `cut`. Chosen before any result was looked at
// (docs/m9-design.md, "Measures"): it does not chain like single linkage, needs no cluster count,
// and its cut is read from the workshop maps, never tuned on the generated ones. Ties merge the
// lowest pair of indices first, so the result is the same on every run.

export function upgma(n: number, dist: (i: number, j: number) => number, cut: number): number[][] {
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  // the distance matrix, and the running mean distance between clusters
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i * n + j] = D[j * n + i] = dist(i, j);
  let alive = clusters.map((_, i) => i);
  const between = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) between.set(key(a, b), D[a * n + b]);
  const members: number[][] = clusters.map((c) => c.slice());
  for (;;) {
    let best = Infinity;
    let pa = -1;
    let pb = -1;
    for (let x = 0; x < alive.length; x++)
      for (let y = x + 1; y < alive.length; y++) {
        const a = alive[x];
        const b = alive[y];
        const d = between.get(key(a, b))!;
        if (d < best) {
          best = d;
          pa = a;
          pb = b;
        }
      }
    if (pa < 0 || !(best < cut)) break;
    // merge b into a: the mean distance to every other cluster, weighted by size
    const na = members[pa].length;
    const nb = members[pb].length;
    for (const c of alive) {
      if (c === pa || c === pb) continue;
      const da = between.get(key(pa, c))!;
      const db = between.get(key(pb, c))!;
      between.set(key(pa, c), (na * da + nb * db) / (na + nb));
    }
    members[pa] = members[pa].concat(members[pb]);
    members[pb] = [];
    alive = alive.filter((c) => c !== pb);
  }
  clusters = alive.map((c) => members[c].sort((p, q) => p - q));
  return clusters.sort((p, q) => q.length - p.length || p[0] - q[0]);
}

/** A robust scale for a set of vectors: each dimension's p10–p90 range over 2.56 (the normal's σ,
 *  as lib/variety.ts), floored; and the median pairwise distance, so a typical pair is 1 apart. */
export interface VecScale {
  spread: number[];
  d0: number;
  /** The p10 nearest-peer distance within the reference set (the cut for its clusters). */
  nnP10: number;
  nnMedian: number;
}

export function rms(a: number[], b: number[], spread: number[]): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) {
    const d = (a[k] - b[k]) / (spread[k] || 1);
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

function pct(v: number[], p: number): number {
  const s = v.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

export function scaleOf(ref: number[][]): VecScale {
  const n = ref.length;
  const dims = ref[0].length;
  const spread: number[] = [];
  for (let k = 0; k < dims; k++) {
    const v = ref.map((r) => r[k]);
    spread.push(Math.max((pct(v, 0.9) - pct(v, 0.1)) / 2.56, 1e-6));
  }
  const pairs: number[] = [];
  const nn = new Array(n).fill(Infinity);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = rms(ref[i], ref[j], spread);
      pairs.push(d);
      if (d < nn[i]) nn[i] = d;
      if (d < nn[j]) nn[j] = d;
    }
  const d0 = pct(pairs, 0.5) || 1;
  return { spread, d0, nnP10: pct(nn, 0.1) / d0, nnMedian: pct(nn, 0.5) / d0 };
}

export function scaledDistance(a: number[], b: number[], s: VecScale): number {
  return rms(a, b, s.spread) / s.d0;
}
