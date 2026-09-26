// Browser-safe copy: avoid spreading 65,536 values onto the worker stack.
import { drainage } from "../landscapes/lib/terrain";
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
    filledMetresMax: d.filled.reduce((max, v, i) => inPatch(i) ? Math.max(max, v - raw[i]) : max, 0),
  };
}
