// Naturalness of a heightfield: how straight its height steps run, and how much its ridges and the
// rims that hold water vary in thickness and height. Engineered terrain has long straight steps and
// ridges of one thickness and one height (a straight dam ridge, a bowl with an even rim); terrain
// that reads as natural wanders and varies. Every number is in tiles or levels, so maps of any
// size compare directly.
//
// - Straight runs: a step is a tile side between two levels. A run is a line of steps along one
//   row or column with the same sign and the same upper level (one contour, straight). Reported:
//   the longest run, the step-weighted 95th percentile, and the share of steps in runs of 8+.
// - Ridges: a crest tile is a tile whose raised band (the tiles at or above its level through it,
//   along x or along y) is at most 12 wide, drops lower on both ends, and holds nothing higher.
//   Crest tiles joined 8-ways form a ridge; ridges of 10+ tiles are measured by the variation of
//   the band's width (coefficient of variation) and of the crest level (standard deviation).
// - Rims: the ring of tiles round a natural basin (priority flood of the terrain) or round a dam
//   site's reservoir. Its thickness at each tile is the distance to ground outside that is lower
//   than the water line, capped at 20; its height is its level above the water line.
// - Shores: the straight-run share of the settled water's edge.

import { distanceFrom } from "../../../src/core/math/grid";
import { components } from "../../../src/core/analysis/regions";
import { spillLevels } from "../../../src/core/sim/prefill";
import { waterModel } from "../../../src/core/sim/model";
import type { DamSite } from "../../../src/core/analysis/damsites";

export interface Naturalness {
  stepEdges: number;
  longestRun: number;
  runP95: number;
  straightShare8: number;
  meanRun: number;
  ridges: number;
  ridgeThicknessCV: number | null;
  ridgeHeightStd: number | null;
  /** Share of ridges with a thickness CV under 0.1 and a crest std under 0.25: engineered. */
  uniformRidgeShare: number | null;
  basinRims: number;
  basinRimThicknessCV: number | null;
  basinRimHeightStd: number | null;
  basinRimThicknessMean: number | null;
  damRims: number;
  damRimThicknessCV: number | null;
  damRimHeightStd: number | null;
  damRimThicknessMean: number | null;
  /** The ground within 8 tiles of each end of the best dam sites' lines (the narrows' shoulders). */
  narrowsThicknessCV: number | null;
  narrowsHeightStd: number | null;
  shoreStraightShare8: number | null;
  /** Share of water tiles in channels one or two tiles wide (ditches). */
  ditchShare: number | null;
}

const MAX_BAND = 12;
const RIM_CAP = 20;

function median(v: number[]): number | null {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function meanStd(v: number[]): [number, number] {
  let m = 0;
  for (const x of v) m += x;
  m /= v.length || 1;
  let s = 0;
  for (const x of v) s += (x - m) * (x - m);
  return [m, Math.sqrt(s / (v.length || 1))];
}

/** Straight runs of steps in a grid of levels (or of a mask, as levels 0/1). */
export function stepRuns(h: ArrayLike<number>, W: number, H: number): number[] {
  const runs: number[] = [];
  // sides between x and x+1, running along y
  for (let x = 0; x + 1 < W; x++) {
    let len = 0;
    let key = 0;
    for (let y = 0; y < H; y++) {
      const a = h[y * W + x];
      const b = h[y * W + x + 1];
      const k = a === b ? 0 : (b > a ? 1 : -1) * (1 + Math.max(a, b));
      if (k !== 0 && k === key) len++;
      else {
        if (len) runs.push(len);
        len = k !== 0 ? 1 : 0;
      }
      key = k;
    }
    if (len) runs.push(len);
  }
  // sides between y and y+1, running along x
  for (let y = 0; y + 1 < H; y++) {
    let len = 0;
    let key = 0;
    for (let x = 0; x < W; x++) {
      const a = h[y * W + x];
      const b = h[(y + 1) * W + x];
      const k = a === b ? 0 : (b > a ? 1 : -1) * (1 + Math.max(a, b));
      if (k !== 0 && k === key) len++;
      else {
        if (len) runs.push(len);
        len = k !== 0 ? 1 : 0;
      }
      key = k;
    }
    if (len) runs.push(len);
  }
  return runs;
}

export function runStats(runs: number[]): { edges: number; longest: number; p95: number; share8: number; mean: number } {
  let edges = 0;
  let longest = 0;
  let long8 = 0;
  for (const r of runs) {
    edges += r;
    if (r > longest) longest = r;
    if (r >= 8) long8 += r;
  }
  // step-weighted 95th percentile: 5% of steps lie in runs longer than this
  const sorted = runs.slice().sort((a, b) => b - a);
  let acc = 0;
  let p95 = 0;
  for (const r of sorted) {
    acc += r;
    p95 = r;
    if (acc >= 0.05 * edges) break;
  }
  return { edges, longest, p95, share8: edges ? long8 / edges : 0, mean: runs.length ? edges / runs.length : 0 };
}

/** Crest tiles: band width across the tile at its own level (0 = not a crest). */
export function crestWidths(h: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const L = h[i];
      let best = 0;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        let w = 1;
        let closed = 0;
        let higher = false;
        for (const s of [1, -1]) {
          let k = 1;
          for (;;) {
            const xx = x + s * k * dx;
            const yy = y + s * k * dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
            const v = h[yy * W + xx];
            if (v < L) {
              closed++;
              break;
            }
            if (v > L) higher = true;
            w++;
            k++;
            if (w > MAX_BAND) break;
          }
        }
        if (closed === 2 && !higher && w <= MAX_BAND && (best === 0 || w < best)) best = w;
      }
      out[i] = best;
    }
  }
  return out;
}

function ridgeStats(h: Uint8Array, W: number, H: number): { ridges: number; cv: number | null; std: number | null; uniform: number | null } {
  const cw = crestWidths(h, W, H);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = cw[i] ? 1 : 0;
  const { labels, sizes } = components(mask, W, H, true);
  const groups: number[][] = sizes.map(() => []);
  for (let i = 0; i < W * H; i++) if (labels[i] >= 0 && sizes[labels[i]] >= 10) groups[labels[i]].push(i);
  const cvs: number[] = [];
  const stds: number[] = [];
  let uniform = 0;
  for (const g of groups) {
    if (g.length < 10) continue;
    const [m, s] = meanStd(g.map((i) => cw[i]));
    const [, hs] = meanStd(g.map((i) => h[i]));
    const cv = m ? s / m : 0;
    cvs.push(cv);
    stds.push(hs);
    if (cv < 0.1 && hs < 0.25) uniform++;
  }
  return { ridges: cvs.length, cv: median(cvs), std: median(stds), uniform: cvs.length ? uniform / cvs.length : null };
}

/** Thickness and height of the ring round a set of tiles held at `level`. */
export function rimOf(h: Uint8Array, W: number, H: number, inside: Uint8Array, level: number, exclude?: Set<number>): { thick: number[]; high: number[]; tiles: number[] } {
  const N = W * H;
  const low = new Uint8Array(N);
  let any = false;
  for (let i = 0; i < N; i++) {
    if (!inside[i] && h[i] < level && !exclude?.has(i)) {
      low[i] = 1;
      any = true;
    }
  }
  const d = any ? distanceFrom(low, W, H) : null;
  const thick: number[] = [];
  const high: number[] = [];
  const tiles: number[] = [];
  for (let i = 0; i < N; i++) {
    if (inside[i] || exclude?.has(i) || h[i] < level) continue;
    const x = i % W;
    const y = (i - x) / W;
    let ring = false;
    if (x > 0 && inside[i - 1]) ring = true;
    else if (x + 1 < W && inside[i + 1]) ring = true;
    else if (y > 0 && inside[i - W]) ring = true;
    else if (y + 1 < H && inside[i + W]) ring = true;
    if (!ring) continue;
    thick.push(Math.min(RIM_CAP, d ? d[i] : RIM_CAP));
    high.push(h[i] - level);
    tiles.push(i);
  }
  return { thick, high, tiles };
}

/** The reservoir of a dam site (the flood of damCandidate, with its tiles). */
export function damReservoir(h: Uint8Array, W: number, H: number, s: DamSite, maxFlood: number): { tiles: Uint8Array; line: Set<number>; crest: number } | null {
  const [dy, dx] = s.dir;
  const crest = h[s.y * W + s.x] + s.height;
  const line = new Set<number>([s.y * W + s.x]);
  for (const sgn of [1, -1]) {
    for (let k = 1; k <= 10; k++) {
      const yy = s.y + sgn * k * dy;
      const xx = s.x + sgn * k * dx;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return null;
      if (h[yy * W + xx] >= crest) break;
      line.add(yy * W + xx);
    }
  }
  const [py, px] = dy === 0 ? [1, 0] : [0, 1];
  const cands = [[s.y + py, s.x + px], [s.y - py, s.x - px]].filter(([yy, xx]) => xx >= 0 && yy >= 0 && xx < W && yy < H && !line.has(yy * W + xx));
  // either side may be the reservoir: take the one whose flood stays closed
  for (const [yy, xx] of cands) {
    const start = yy * W + xx;
    if (h[start] >= crest) continue;
    const tiles = new Uint8Array(W * H);
    tiles[start] = 1;
    const q = [start];
    let ok = true;
    for (let head = 0; head < q.length && ok; head++) {
      if (q.length > maxFlood) ok = false;
      const c = q[head];
      const cx = c % W;
      const cy = (c - cx) / W;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ddx;
        const ny = cy + ddy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
          ok = false;
          break;
        }
        const n = ny * W + nx;
        if (tiles[n] || line.has(n) || h[n] >= crest) continue;
        tiles[n] = 1;
        q.push(n);
      }
    }
    if (ok && q.length >= 10) return { tiles, line, crest };
  }
  return null;
}

export function naturalness(h: Uint8Array, W: number, H: number, depth: ArrayLike<number> | null, sites: readonly DamSite[], maxFlood: number): Naturalness {
  const N = W * H;
  const rs = runStats(stepRuns(h, W, H));
  const rid = ridgeStats(h, W, H);

  // natural basins: depressions of the terrain alone (the priority flood with the edge draining)
  const spill = spillLevels(waterModel(W, H, h, []));
  const basin = new Uint8Array(N);
  for (let i = 0; i < N; i++) basin[i] = spill[i] > h[i] + 1e-9 ? 1 : 0;
  const bl = components(basin, W, H, false);
  const bCV: number[] = [];
  const bStd: number[] = [];
  const bMean: number[] = [];
  const order = bl.sizes.map((s, k) => [s, k]).filter(([s]) => s >= 20).sort((a, b) => b[0] - a[0]).slice(0, 12);
  for (const [, k] of order) {
    const inside = new Uint8Array(N);
    let level = 0;
    for (let i = 0; i < N; i++) {
      if (bl.labels[i] === k) {
        inside[i] = 1;
        if (spill[i] > level) level = spill[i];
      }
    }
    const r = rimOf(h, W, H, inside, Math.round(level));
    if (r.thick.length < 8) continue;
    const [m, s] = meanStd(r.thick);
    bCV.push(m ? s / m : 0);
    bStd.push(meanStd(r.high)[1]);
    bMean.push(m);
  }

  // dam-site reservoirs: the best sites (by volume per dam tile), at most 6
  const dCV: number[] = [];
  const dStd: number[] = [];
  const dMean: number[] = [];
  const nCV: number[] = [];
  const nStd: number[] = [];
  for (const s of sites.slice(0, 6)) {
    const res = damReservoir(h, W, H, s, maxFlood);
    if (!res) continue;
    const r = rimOf(h, W, H, res.tiles, res.crest, res.line);
    if (r.thick.length < 8) continue;
    const [m, sd] = meanStd(r.thick);
    dCV.push(m ? sd / m : 0);
    dStd.push(meanStd(r.high)[1]);
    dMean.push(m);
    // the shoulders: rim tiles within 8 tiles of the dam line
    const lineTiles = [...res.line];
    const near = r.tiles.map((t, k) => [t, k] as const).filter(([t]) => {
      const x = t % W;
      const y = (t - x) / W;
      return lineTiles.some((l) => Math.max(Math.abs((l % W) - x), Math.abs(Math.floor(l / W) - y)) <= 8);
    });
    if (near.length >= 4) {
      const [nm, ns] = meanStd(near.map(([, k]) => r.thick[k]));
      nCV.push(nm ? ns / nm : 0);
      nStd.push(meanStd(near.map(([, k]) => r.high[k]))[1]);
    }
  }

  // shores and ditches of the settled water
  let shore: number | null = null;
  let ditch: number | null = null;
  if (depth) {
    const wet = new Uint8Array(N);
    let nWet = 0;
    for (let i = 0; i < N; i++) if (depth[i] >= 0.1) (wet[i] = 1), nWet++;
    if (nWet >= 20) {
      shore = runStats(stepRuns(wet, W, H)).share8;
      let narrow = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!wet[i]) continue;
          let wx = 1;
          for (let k = x + 1; k < W && wet[y * W + k] && wx <= 3; k++) wx++;
          for (let k = x - 1; k >= 0 && wet[y * W + k] && wx <= 3; k--) wx++;
          let wy = 1;
          for (let k = y + 1; k < H && wet[k * W + x] && wy <= 3; k++) wy++;
          for (let k = y - 1; k >= 0 && wet[k * W + x] && wy <= 3; k--) wy++;
          if (Math.min(wx, wy) <= 2) narrow++;
        }
      }
      ditch = narrow / nWet;
    }
  }

  const med = (v: number[]) => median(v);
  return {
    stepEdges: rs.edges,
    longestRun: rs.longest,
    runP95: rs.p95,
    straightShare8: rs.share8,
    meanRun: rs.mean,
    ridges: rid.ridges,
    ridgeThicknessCV: rid.cv,
    ridgeHeightStd: rid.std,
    uniformRidgeShare: rid.uniform,
    basinRims: bCV.length,
    basinRimThicknessCV: med(bCV),
    basinRimHeightStd: med(bStd),
    basinRimThicknessMean: med(bMean),
    damRims: dCV.length,
    damRimThicknessCV: med(dCV),
    damRimHeightStd: med(dStd),
    damRimThicknessMean: med(dMean),
    narrowsThicknessCV: med(nCV),
    narrowsHeightStd: med(nStd),
    shoreStraightShare8: shore,
    ditchShare: ditch,
  };
}

/** The narrows of one dam site: its dam line's length, the shoulders (rim tiles within 8 tiles of the
 *  dam line: thickness CV and height std) and the ridge crests within 12 tiles of the line (crest
 *  height std and band-width CV). Null when the site's reservoir cannot be flooded again. */
export function narrowsOf(h: Uint8Array, W: number, H: number, s: DamSite, maxFlood: number): { length: number; shoulderCV: number; shoulderStd: number; crestStd: number | null; crestCV: number | null } | null {
  const res = damReservoir(h, W, H, s, maxFlood);
  if (!res) return null;
  const r = rimOf(h, W, H, res.tiles, res.crest, res.line);
  const line = [...res.line];
  const nearLine = (t: number, d: number) => {
    const x = t % W;
    const y = (t - x) / W;
    return line.some((l) => Math.max(Math.abs((l % W) - x), Math.abs(Math.floor(l / W) - y)) <= d);
  };
  const sh = r.tiles.map((t, k) => [t, k] as const).filter(([t]) => nearLine(t, 8));
  if (sh.length < 4) return null;
  const [m, sd] = meanStd(sh.map(([, k]) => r.thick[k]));
  const cw = crestWidths(h, W, H);
  const crest: number[] = [];
  for (let i = 0; i < W * H; i++) if (cw[i] && nearLine(i, 12)) crest.push(i);
  const cs = crest.length >= 5 ? meanStd(crest.map((i) => h[i]))[1] : null;
  const cc = crest.length >= 5 ? (() => { const [cm, cd] = meanStd(crest.map((i) => cw[i])); return cm ? cd / cm : 0; })() : null;
  return { length: line.length, shoulderCV: m ? sd / m : 0, shoulderStd: meanStd(sh.map(([, k]) => r.high[k]))[1], crestStd: cs, crestCV: cc };
}
