import { drainage, neighbours } from "./terrain";
import { components } from "../../../src/core/analysis/regions";
import { stepRuns } from "../../workshop/lib/naturalness";
export function quantiles(values: number[]) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    n: a.length,
    p10: a.length ? a[Math.floor((a.length - 1) * 0.1)] : null,
    p50: a.length ? a[Math.floor((a.length - 1) * 0.5)] : null,
    p90: a.length ? a[Math.floor((a.length - 1) * 0.9)] : null,
  };
}
/** D8 is a single-receiver drainage proxy. Physical splitting is measured separately. */
export function terrainMetrics(
  h: Uint8Array,
  W: number,
  H: number,
  water?: any,
  waterFloor: ArrayLike<number> = h,
) {
  const N = W * H,
    d = drainage(h, W, H),
    threshold = Math.max(32, N * 0.01),
    channel = Uint8Array.from(d.acc, (v) => (v >= threshold ? 1 : 0)),
    up: number[][] = Array.from({ length: N }, () => []);
  let length = 0,
    cells = 0;
  const heightHistogram = new Array(23).fill(0),
    slopeHistogram = new Array(23).fill(0);
  for (let i = 0; i < N; i++) {
    heightHistogram[h[i]]++;
    for (const j of [i % W < W - 1 ? i + 1 : -1, i < N - W ? i + W : -1])
      if (j >= 0) slopeHistogram[Math.abs(h[i] - h[j])]++;
    if (channel[i]) {
      cells++;
      if (d.to[i] >= 0 && channel[d.to[i]]) {
        up[d.to[i]].push(i);
        length += Math.hypot(
          (i % W) - (d.to[i] % W),
          Math.floor(i / W) - Math.floor(d.to[i] / W),
        );
      }
    }
  }
  const heads: number[] = [],
    junctions: number[] = [],
    sinuosity: number[] = [],
    angles: number[] = [],
    segmentLengths: number[] = [];
  for (let i = 0; i < N; i++)
    if (channel[i]) {
      if (up[i].length === 0) heads.push(i);
      if (up[i].length >= 2) junctions.push(i);
    }
  for (let i = 0; i < N; i++)
    if (channel[i] && up[i].length !== 1) {
      let j = i,
        len = 0;
      for (let k = 0; k < N; k++) {
        const next = d.to[j];
        if (next < 0 || !channel[next]) break;
        len += Math.hypot(
          (next % W) - (j % W),
          Math.floor(next / W) - Math.floor(j / W),
        );
        j = next;
        if (up[j].length !== 1) break;
      }
      const direct = Math.hypot(
        (i % W) - (j % W),
        Math.floor(i / W) - Math.floor(j / W),
      );
      if (len >= 5 && direct > 0) {
        sinuosity.push(len / direct);
        segmentLengths.push(len);
      }
    }
  for (const i of junctions) {
    const arms = up[i]
      .slice()
      .sort((a, b) => d.acc[b] - d.acc[a])
      .slice(0, 2)
      .map((a) => {
        for (let k = 0; k < 4; k++) {
          if (!up[a].length) break;
          a = up[a].reduce((p, q) => (d.acc[p] > d.acc[q] ? p : q));
        }
        return [(a % W) - (i % W), Math.floor(a / W) - Math.floor(i / W)];
      });
    const [a, b] = arms;
    const dot =
      (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
    angles.push((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
  }
  const widths1: number[] = [],
    widths2: number[] = [],
    sections: number[][] = [];
  const cc = Array.from(channel.keys()).filter((i) => channel[i]);
  const stride = Math.max(1, Math.floor(cc.length / 64));
  for (let k = 0; k < cc.length; k += stride) {
    const i = cc[k],
      j = d.to[i];
    if (j < 0) continue;
    const dx = (j % W) - (i % W),
      dy = Math.floor(j / W) - Math.floor(i / W),
      len = Math.hypot(dx, dy),
      profile: number[] = [];
    for (let t = -12; t <= 12; t++) {
      const x = Math.round((i % W) - (dy / len) * t),
        y = Math.round(Math.floor(i / W) + (dx / len) * t);
      profile.push(
        x >= 0 && x < W && y >= 0 && y < H ? h[y * W + x] - h[i] : NaN,
      );
    }
    if (profile.some((v) => !Number.isFinite(v))) continue;
    sections.push(profile);
    for (const [lev, dst] of [
      [1, widths1],
      [2, widths2],
    ] as const) {
      let a = 12,
        b = 12;
      while (a > 0 && profile[a - 1] < lev) a--;
      while (b < 24 && profile[b + 1] < lev) b++;
      if (a > 0 && b < 24) dst.push(b - a + 1);
    }
  }
  const runs = stepRuns(h, W, H),
    slopeN = slopeHistogram.reduce((a, b) => a + b, 0),
    heightDist = heightHistogram.map((x) => x / N),
    slopeDist = slopeHistogram.map((x) => x / slopeN);
  let flowTiles = 0,
    splitTiles = 0,
    rejoinTiles = 0;
  const indegree = new Uint8Array(N),
    fallMask = new Uint8Array(N),
    drops: number[] = [];
  if (water) {
    const D = water.depth,
      out = water.out;
    for (let i = 0; i < N; i++)
      if (D[i] > 0.05) {
        if (out) {
          const ns = [
            i >= W ? i - W : -1,
            i % W > 0 ? i - 1 : -1,
            i < N - W ? i + W : -1,
            i % W < W - 1 ? i + 1 : -1,
          ];
          let total = 0;
          for (let k = 0; k < 4; k++) total += out[4 * i + k];
          let count = 0;
          for (let k = 0; k < 4; k++)
            if (ns[k] >= 0 && out[4 * i + k] > Math.max(0.005, total * 0.15)) {
              count++;
              indegree[ns[k]]++;
            }
          if (total > 0.005) flowTiles++;
          if (count >= 2) splitTiles++;
        }
        for (const j of neighbours(i, W, H, false))
          if (D[j] > 0.05) {
            const drop = waterFloor[i] + D[i] - waterFloor[j] - D[j];
            if (drop >= 1) {
              fallMask[i] = 1;
              drops.push(drop);
            }
          }
      }
    for (const c of indegree) if (c >= 2) rejoinTiles++;
  }
  const falls = components(fallMask, W, H, true),
    centres = falls.sizes.map(() => [0, 0, 0]);
  for (let i = 0; i < N; i++)
    if (falls.labels[i] >= 0) {
      const a = centres[falls.labels[i]];
      a[0] += i % W;
      a[1] += Math.floor(i / W);
      a[2]++;
    }
  for (const a of centres) {
    a[0] /= a[2];
    a[1] /= a[2];
  }
  const spacing = centres
    .map((a, i) =>
      Math.min(
        ...centres
          .filter((_, j) => j !== i)
          .map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])),
      ),
    )
    .filter(Number.isFinite);
  let loops = 0;
  if (water) {
    const land = Uint8Array.from(water.depth, (v: number) =>
        v <= 0.05 ? 1 : 0,
      ),
      c = components(land, W, H, true),
      touch = new Set<number>();
    for (let i = 0; i < N; i++)
      if (i % W === 0 || i % W === W - 1 || i < W || i >= N - W)
        touch.add(c.labels[i]);
    loops = c.sizes.filter((n, k) => n >= 4 && !touch.has(k)).length;
  }
  return {
    network: {
      thresholdCells: threshold,
      channelCells: cells,
      lengthTiles: length,
      drainageDensity: length / N,
      heads: heads.length,
      junctions: junctions.length,
      branchingPer10k: (junctions.length / N) * 1e4,
      sinuosity: quantiles(sinuosity),
      junctionAngleDegrees: quantiles(angles),
      segmentLengthTiles: quantiles(segmentLengths),
      flowSplitTileShare: flowTiles ? splitTiles / flowTiles : null,
      flowRejoinTileShare: flowTiles ? rejoinTiles / flowTiles : null,
      wetEnclosedLandComponents: loops,
    },
    relief: {
      heightHistogram: heightDist,
      slopeHistogram: slopeDist,
      levelStepLength: quantiles(runs),
      valleyWidth1: quantiles(widths1),
      valleyWidth2: quantiles(widths2),
      valleyCrossSectionMean: sections.length
        ? Array.from(
            { length: 25 },
            (_, i) => sections.reduce((s, p) => s + p[i], 0) / sections.length,
          )
        : null,
      narrowingRatio: widths2.length
        ? Math.min(...widths2) / Math.max(...widths2)
        : null,
    },
    falls: {
      count: centres.length,
      drop: quantiles(drops),
      nearestSpacingTiles: quantiles(spacing),
    },
  };
}
