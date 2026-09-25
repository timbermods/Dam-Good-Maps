// The canonical settle's starting state (PLAN §10, D27) on the column graph. Today's pre-fill
// (src/core/sim/prefill.ts) works on tiles; this is the same algorithm with columns as nodes and
// "the two columns overlap" as the edge, so on a heightfield (one column per tile) it gives the
// same numbers in the same order.
//
// - Spill levels: a priority flood from the columns of edge tiles that drain into the padding (an
//   edge tile of an emitter is walled off). A column's level is the highest of its floor (raised by
//   a partial obstacle) and the level it was reached from. A level above the column's ceiling means
//   the column is full and under pressure: head = ceiling + 8 × overflow.
// - Paths: from every running emitter, water walks to overlapping columns whose spill level is not
//   higher. Every column on a path that stands below its spill level starts full (with overflow up
//   to the cap); the others start at min(1, 0.3·Q/w), w the shorter of the x and y runs of such
//   columns through it.

import { MinHeap } from "../../../src/core/math/grid";
import { OPEN_CEILING } from "./columns";
import { PRESSURE, MAX_PRESSURE, type StackSim } from "./stackwater";

export interface Prefill {
  depth: Float64Array;
  overflow: Float64Array;
  cont: Float64Array;
  spill: Float64Array;
}

export function spillLevels3d(sim: StackSim, port = true): Float64Array {
  const { N, M, W, H, Fl } = sim;
  const cols = sim.cols;
  const level = new Float64Array(M);
  for (let c = 0; c < M; c++) {
    const i = c % N;
    if (Math.floor(c / N) >= cols.count[i]) continue;
    let lim = 0;
    if (cols.heightLimit) {
      const v = cols.heightLimit[Fl[c] * N + i];
      if (v >= 0) lim = v;
    }
    level[c] = Fl[c] + lim;
  }
  const filled = level.slice();
  const seen = new Uint8Array(M);
  const heap = new MinHeap();
  // outlets: columns of edge tiles with an edge into the padding
  for (let s = 0; s < cols.L; s++) {
    for (let i = 0; i < N; i++) {
      if (s >= cols.count[i]) continue;
      const x = i % W;
      const y = (i - x) / W;
      if (!(x === 0 || y === 0 || x === W - 1 || y === H - 1)) continue;
      const c = s * N + i;
      let outlet = false;
      for (let e = sim.eStart[c]; e < sim.eStart[c + 1]; e++) if (sim.eTarget[e] === -1) outlet = true;
      if (!outlet) continue;
      seen[c] = 1;
      heap.push(filled[c], c);
    }
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const lv = heap.lastKey;
    for (let e = sim.eStart[c]; e < sim.eStart[c + 1]; e++) {
      const t = sim.eTarget[e];
      if (t < 0 || seen[t]) continue;
      seen[t] = 1;
      if (filled[t] < lv) filled[t] = lv;
      heap.push(filled[t], t);
    }
  }
  // columns no outlet reaches (sealed caves) keep their floor level: they start empty
  if (!port) for (let c = 0; c < M; c++) if (!seen[c]) filled[c] = level[c];
  return filled;
}

export function prefill3d(sim: StackSim): Prefill {
  const { N, M, W, Fl, Ce } = sim;
  const cols = sim.cols;
  const spill = spillLevels3d(sim);
  const q = new Float64Array(M);
  const qBad = new Float64Array(M);
  const path = new Uint8Array(M);
  const mark = new Int32Array(M);
  const queue = new Int32Array(M);
  let stamp = 0;
  for (const em of sim.emitters) {
    if (!(em.strength > 0)) continue;
    stamp++;
    let head = 0;
    let tail = 0;
    for (const c of em.cols) if (mark[c] !== stamp) { mark[c] = stamp; queue[tail++] = c; }
    while (head < tail) {
      const c = queue[head++];
      q[c] += em.strength;
      if (em.contamination > 0) qBad[c] += em.strength * em.contamination;
      path[c] = 1;
      for (let e = sim.eStart[c]; e < sim.eStart[c + 1]; e++) {
        const t = sim.eTarget[e];
        if (t < 0 || mark[t] === stamp || spill[t] > spill[c]) continue;
        mark[t] = stamp;
        queue[tail++] = t;
      }
    }
  }
  // open-channel columns and their x and y runs, through overlapping open columns of the tiles
  // beside them (on a heightfield: the tile runs of today's pre-fill)
  const open = new Uint8Array(M);
  for (let c = 0; c < M; c++) open[c] = path[c] && !(spill[c] > Fl[c]) ? 1 : 0;
  const neighbourOpen = (c: number, k: number): number => {
    for (let e = sim.eStart[c]; e < sim.eStart[c + 1]; e++) {
      if (sim.eDir[e] !== k) continue;
      const t = sim.eTarget[e];
      if (t >= 0 && open[t]) return t;
    }
    return -1;
  };
  const runOf = (c: number, a: number, b: number): number => {
    let n = 1;
    for (let t = neighbourOpen(c, a); t >= 0; t = neighbourOpen(t, a)) n++;
    for (let t = neighbourOpen(c, b); t >= 0; t = neighbourOpen(t, b)) n++;
    return n;
  };
  const depth = new Float64Array(M);
  const overflow = new Float64Array(M);
  const cont = new Float64Array(M);
  for (let c = 0; c < M; c++) {
    if (!path[c]) continue;
    let d: number;
    if (spill[c] > Fl[c]) {
      d = spill[c] - Fl[c];
      const cap = Ce[c] - Fl[c];
      if (d > cap) {
        let o = (spill[c] - Ce[c]) / PRESSURE;
        const maxO = (MAX_PRESSURE - Ce[c]) / PRESSURE;
        if (o > maxO) o = maxO;
        overflow[c] = Ce[c] < OPEN_CEILING ? o : 0;
        d = cap;
      }
    } else {
      const rx = runOf(c, 1, 3);
      const ry = runOf(c, 0, 2);
      const w = rx < ry ? rx : ry;
      d = (0.3 * q[c]) / w;
      if (d > 1) d = 1;
      const cap = Ce[c] - Fl[c];
      if (d > cap) d = cap;
    }
    depth[c] = d;
    cont[c] = d > 0 && q[c] > 0 ? qBad[c] / q[c] : 0;
  }
  void W;
  void cols;
  return { depth, overflow, cont, spill };
}
