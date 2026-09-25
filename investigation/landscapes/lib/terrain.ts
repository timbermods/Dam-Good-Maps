import { MinHeap } from "../../../src/core/math/grid";
export const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
export function neighbours(i: number, W: number, H: number, diagonal = true) {
  const x = i % W,
    y = Math.floor(i / W),
    out: number[] = [];
  for (const [dx, dy] of DIRS.slice(0, diagonal ? 8 : 4)) {
    const xx = x + dx,
      yy = y + dy;
    if (xx >= 0 && xx < W && yy >= 0 && yy < H) out.push(yy * W + xx);
  }
  return out;
}
/** Priority flood only supplies routing elevations. Never fills the exported terrain. */
export function drainage(h: ArrayLike<number>, W: number, H: number) {
  const N = W * H,
    filled = Float64Array.from(h),
    seen = new Uint8Array(N),
    rank = new Int32Array(N),
    parent = new Int32Array(N).fill(-1),
    order = new Int32Array(N),
    heap = new MinHeap();
  for (let i = 0; i < N; i++)
    if (i % W === 0 || i % W === W - 1 || i < W || i >= N - W) {
      seen[i] = 1;
      heap.push(h[i], i);
    }
  let count = 0;
  while (heap.size) {
    const i = heap.pop();
    rank[i] = count;
    order[count++] = i;
    for (const j of neighbours(i, W, H))
      if (!seen[j]) {
        seen[j] = 1;
        filled[j] = Math.max(h[j], filled[i]);
        parent[j] = i;
        heap.push(filled[j], j);
      }
  }
  const to = parent.slice(),
    acc = new Float64Array(N).fill(1);
  for (let k = 0; k < N; k++) {
    const i = order[k];
    if (parent[i] < 0) continue;
    let best = -Infinity;
    for (const j of neighbours(i, W, H)) {
      if (rank[j] >= rank[i] || filled[j] > filled[i]) continue;
      const len =
        i % W !== j % W && Math.floor(i / W) !== Math.floor(j / W)
          ? Math.SQRT2
          : 1;
      const slope = (filled[i] - filled[j]) / len;
      if (slope > best) {
        best = slope;
        to[i] = j;
      }
    }
  }
  for (let k = N - 1; k >= 0; k--) {
    const i = order[k];
    if (to[i] >= 0) acc[to[i]] += acc[i];
  }
  return { to, acc, filled, order, rank };
}
export function quantise(h: Float32Array, mode: string, cap: number) {
  const sorted = h.slice().sort(),
    lo = sorted[0],
    hi = sorted[sorted.length - 1],
    span = hi - lo;
  const out = new Uint8Array(h.length);
  let error = 0,
    cov = 0,
    vx = 0,
    vy = 0;
  let mx = 0,
    my = 0;
  for (let i = 0; i < h.length; i++) {
    const u = span ? (h[i] - lo) / span : 0;
    // Linear preserves one level per 30 m, saturating at the comparison cap.
    // Compressed keeps low relief and flattens peaks; normalised uses the full local range.
    const v =
      mode === "linear"
        ? (h[i] - lo) / 30
        : mode === "compressed"
          ? (cap * Math.log1p(4 * u)) / Math.log(5)
          : cap * u;
    out[i] = Math.max(0, Math.min(cap, Math.round(v)));
    mx += u;
    my += out[i] / cap;
    error += (u - out[i] / cap) ** 2;
  }
  mx /= h.length;
  my /= h.length;
  for (let i = 0; i < h.length; i++) {
    const x = (span ? (h[i] - lo) / span : 0) - mx,
      y = out[i] / cap - my;
    cov += x * y;
    vx += x * x;
    vy += y * y;
  }
  const occupied = new Set(out).size;
  return {
    heights: out,
    mapping: {
      mode,
      cap,
      minMetres: lo,
      maxMetres: hi,
      reliefMetres: span,
      occupiedLevels: occupied,
      shapeCorrelation: vx && vy ? cov / Math.sqrt(vx * vy) : null,
      normalisedRMSE: Math.sqrt(error / h.length),
      saturatedShare:
        out.reduce((s, v) => s + (v === cap ? 1 : 0), 0) / out.length,
      readabilityProxy:
        occupied >= 5 && vx > 0 && vy > 0 && cov / Math.sqrt(vx * vy) >= 0.9,
    },
  };
}
export function crop(
  h: ArrayLike<number>,
  W: number,
  size: number,
  halo: number,
) {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      out[y * size + x] = h[(y + halo) * W + x + halo];
  return out;
}
export function sourcesFromHalo(raw: Float32Array, size: number, halo: number) {
  const W = size + halo * 2,
    d = drainage(raw, W, W),
    N = size * size,
    threshold = Math.max(32, N * 0.01),
    incoming = new Uint16Array(raw.length),
    inPatch = (i: number) =>
      i % W >= halo &&
      i % W < halo + size &&
      Math.floor(i / W) >= halo &&
      Math.floor(i / W) < halo + size;
  for (let i = 0; i < raw.length; i++)
    if (d.to[i] >= 0 && d.acc[i] >= threshold) incoming[d.to[i]]++;
  const entries = new Map<number, number>(),
    outlets = new Map<number, number>();
  for (let i = 0; i < raw.length; i++)
    if (d.to[i] >= 0) {
      const j = d.to[i];
      if (!inPatch(i) && inPatch(j) && d.acc[i] >= threshold)
        entries.set(j, Math.max(entries.get(j) || 0, d.acc[i]));
      if (inPatch(i) && !inPatch(j) && d.acc[i] >= threshold)
        outlets.set(i, d.acc[i]);
    }
  for (let i = 0; i < raw.length; i++)
    if (inPatch(i) && d.acc[i] >= threshold && !incoming[i])
      entries.set(i, d.acc[i]);
  const central = (i: number) =>
    (Math.floor(i / W) - halo) * size + (i % W) - halo;
  const sources = [...entries]
    .sort((a, b) => b[1] - a[1])
    .filter(([i]) => {
      let p = i;
      for (let k = 0; k < 4; k++) {
        if (d.to[p] < 0 || !inPatch(d.to[p])) return false;
        p = d.to[p];
      }
      return true;
    })
    .slice(0, 8)
    .map(([i, area]) => {
      const entry = i;
      for (let k = 0; k < 3; k++) {
        if (!inPatch(d.to[i])) break;
        const c = central(i),
          x = c % size,
          y = Math.floor(c / size);
        if (x > 1 && x < size - 2 && y > 1 && y < size - 2) break;
        i = d.to[i];
      }
      return {
        i: central(i),
        area,
        kind:
          central(entry) % size === 0 ||
          central(entry) % size === size - 1 ||
          central(entry) < size ||
          central(entry) >= N - size
            ? "inferred entry"
            : "inferred channel head",
        entry: central(entry),
      };
    });
  return {
    sources,
    outlets: [...outlets]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([i, area]) => ({ i: central(i), area })),
    threshold,
    filledMetresMax: Math.max(
      ...Array.from(d.filled, (v, i) => v - raw[i]).filter((_, i) =>
        inPatch(i),
      ),
    ),
  };
}
