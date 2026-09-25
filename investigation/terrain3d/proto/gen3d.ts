// The carving prototype (step 4.3): a multi-level landscape, then 3D forms found in it and carved
// by processes that keep the game's rules, then every check: the support rule, walking (with
// natural ramps), the stacked water, and what today's heightfield water would make of the same map.
//
// Two settings show the range the design asks for:
// - ordinary: relief within 16; a tunnel joining two valleys through a ridge, and a spring cave
//   with a pool. Occasional and modest.
// - high (a high Verticality): relief to the game's full 22; on top of the above, a cliff path of
//   ledges up a massif, a massif face leaning out over the terrace below, a cave off the cliff
//   path, a natural sky bridge over a gorge at the top of the massif, a tall arch through the
//   ridge, and an underground river from a high basin through the massif, out of the cliff face.
//
//   npx tsx investigation/terrain3d/proto/gen3d.ts --size 128 --vert high [--seed 1] [--out dir] [--maps dir]

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Vox, findFaces, findTunnels, findGaps, carveGallery, straightPath, leanOut, cliffPath, skyBridge, windowArch, type Face } from "./carve3d";
import { checkSupport } from "./support";
import { FloorGraph, SLOPE_ORIENTATION, type Slope } from "./walk3d";
import { waterColumns, terrainRuns, slotAt, OPEN_CEILING } from "./columns";
import { StackSim, settle, type StackEmitter } from "./stackwater";
import { prefill3d } from "./prefill3d";
import { writeStacked } from "./write3d";
import { fbm } from "../../../src/core/math/noise";
import { sinDet } from "../../../src/core/math/detmath";
import { levelRegions } from "../../../src/core/math/grid";
import { guidFrom, tileHash01 } from "../../../src/core/math/hash";
import { startingLocation, waterSource, slope as slopeEntity, tree, bush, blockObject, ruin, type EntitySpec } from "../../../src/core/format/entities";
import { WaterSim, settle as settle2d } from "../../../src/core/sim/water";
import { prefill as prefill2d } from "../../../src/core/sim/prefill";

export type Verticality = "ordinary" | "high";

interface Plan { vf: number; bed: number; tN: number; M: number; peak: number; R: number }
const PLANS: Record<Verticality, Plan> = {
  ordinary: { vf: 4, bed: 3, tN: 8, M: 13, peak: 15, R: 10 },
  high: { vf: 4, bed: 3, tN: 10, M: 20, peak: 22, R: 16 },
};

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

export interface Gen3dResult {
  vx: Vox;
  entities: EntitySpec[];
  report: Record<string, unknown>;
  sim: StackSim;
  bytes: Uint8Array;
}

export function gen3d(S: number, vert: Verticality, seed: number): Gen3dResult {
  const p = PLANS[vert];
  const W = S, H = S, N = S * S;
  const vx = new Vox(W, H);
  const report: Record<string, unknown> = { size: S, verticality: vert, seed, plan: p };
  const features: Record<string, unknown>[] = [];
  const t0 = process.cpuUsage();

  // ------------------------------------------------------------------ 1. the base landscape
  const yc = (x: number) => S * 0.4 + S * 0.035 * sinDet((6.283185307179586 * x) / (0.9 * S));
  const vw = Math.round(S * 0.1), tw = Math.round(S * 0.12), rw = Math.max(5, Math.round(S * 0.05)), sw = Math.round(S * 0.1);
  const gx = Math.round(S * 0.68), gHalf = Math.max(3, Math.round(S * 0.03));
  const gEnd = vw + tw + Math.round(S * 0.25);
  const bx = Math.round(S * 0.45), by = Math.round(yc(Math.round(S * 0.45)) + vw + tw + S * 0.13), rB = Math.max(4, Math.round(S * 0.055));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // boundaries wobble smoothly along x, so cliff lines stay continuous
    const nb = Math.round(fbm(seed + 1, x, 0, Math.max(6, S * 0.15)) * 3);
    const nm = Math.round(fbm(seed + 9, x, 0, Math.max(6, S * 0.15)) * 2);
    const d = y - yc(x);
    let h: number;
    if (Math.abs(d) <= 2) h = p.bed;
    else if (d >= -vw && d <= vw + nb) h = p.vf;
    else if (d > vw + nb && d <= vw + tw + nm) h = p.tN + (fbm(seed + 2, x, y, Math.max(4, S * 0.06)) > 0.35 ? 1 : 0);
    else if (d > vw + tw + nm) h = Math.min(p.peak, p.M + Math.max(0, Math.round(fbm(seed + 3, x, y, Math.max(6, S * 0.12)) * 3)));
    else if (d >= -vw - rw) h = p.R;
    else if (d >= -vw - rw - sw) h = p.vf;
    else h = p.vf + 2 + (fbm(seed + 4, x, y, Math.max(4, S * 0.08)) > 0.2 ? 1 : 0);
    // a gorge into the massif, its floor climbing one level every 2 tiles up to the terrace's level
    const gOff = Math.round(fbm(seed + 5, 0, y, Math.max(4, S * 0.1)) * 2);
    if (d > vw + nb && d <= gEnd && Math.abs(x - gx - gOff) <= gHalf) h = Math.min(h, p.vf + Math.floor((d - vw) / 2), p.tN);
    // a high basin on the massif
    const bd = Math.sqrt((x - bx) * (x - bx) + (y - by) * (y - by)) + fbm(seed + 6, x, y, 5) * 1.5;
    if (vert === "high" && bd <= rB && h >= p.M) h = p.M - 4;
    vx.column(x, y, h);
  }
  const h0 = vx.surface();
  report.baseRelief = { min: Math.min(...h0), max: Math.max(...h0) };

  // the start: on the south bank, a flat 3×3 at the valley floor with its door toward −y
  const sx = Math.round(S * 0.2);
  const sy = Math.round(yc(sx)) - 9;
  const start = { x: sx, y: sy, z: p.vf };
  const keep = new Uint8Array(N); // tiles the carvers leave alone (the start and its door)
  for (let dy = -2; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) if (vx.inside(sx + dx, sy + dy)) keep[(sy + dy) * W + sx + dx] = 1;

  const sources: { x: number; y: number; z: number; strength: number; what: string }[] = [];
  // the river: sources across its channel on the west edge (a sealed mouth), draining east
  for (let y = 0; y < H; y++) if (Math.abs(y - yc(0)) <= 2) sources.push({ x: 0, y, z: p.bed, strength: vert === "high" ? 1.25 : 1, what: "river" });

  const heights = () => { const s = vx.surface(); const u = new Uint8Array(N); for (let i = 0; i < N; i++) u[i] = s[i]; return u; };
  const channel = (path: [number, number][], bed: number, width: number) => {
    for (const [x, y] of path) for (let dx = 0; dx < width; dx++) for (let z = bed; z < p.peak + 1; z++) {
      if (!vx.inside(x + dx, y)) continue;
      // only cut through open ground, never through a roof: stop at the first air above
      if (z >= vx.top(x + dx, y)) break;
      vx.set(x + dx, y, z, false);
    }
  };

  // ------------------------------------------------------------------ 2. a tunnel through the ridge
  {
    const hh = heights();
    const regs = levelRegions(hh, W, H).labels;
    const sites = findTunnels(vx.surface(), W, H, regs, 4);
    // the route a player needs: joins separate land on one level, near the start
    sites.sort((a, b) => a.length + 0.2 * Math.abs(a.a[0] - sx) - (b.length + 0.2 * Math.abs(b.a[0] - sx)));
    const t = sites.find((s) => s.z === p.vf && Math.abs(s.a[0] - sx) > 6);
    if (t) {
      const path = straightPath(t.a, t.b, (k) => (fbm(seed + 7, k, 0, 5) > 0.3 ? 1 : 0));
      const height = vert === "high" ? 3 : 2;
      const n = carveGallery(vx, path, () => t.z, 2, height);
      features.push({ kind: "tunnel", through: "ridge", level: t.z, length: t.length + 1, width: 2, height, cells: n, candidates: sites.length });
    } else features.push({ kind: "tunnel", found: false, candidates: sites.length });
  }

  // ------------------------------------------------------------------ 3. a spring cave with a pool
  let spring: { x: number; y: number; z: number } | null = null;
  const faces0 = findFaces(vx.surface(), W, H, 4);
  const terraceFace = faces0.find((f) => f.dir === 0 && f.top >= p.tN && f.top <= p.tN + 1 && f.base === p.vf && f.tiles.length >= 10);
  let caveTiles: [number, number][] = [];
  if (terraceFace) {
    // the face tile nearest the start, east of it
    let best = 0, bestD = 1e9;
    for (let k = 0; k < terraceFace.tiles.length; k++) {
      const [fx] = terraceFace.tiles[k];
      const dd = Math.abs(fx - (sx + 12));
      if (dd < bestD) { bestD = dd; best = k; }
    }
    const [fx, fy] = terraceFace.tiles[best];
    const len = vert === "high" ? 14 : 10;
    const path: [number, number][] = [];
    for (let k = 0; k < len; k++) path.push([fx, fy + k]);
    const pool = 4;
    const n = carveGallery(vx, path, (k) => (k >= len - pool ? p.vf - 1 : p.vf), 3, 3);
    // put back the floor under the higher part (the gallery cut down to its floor only)
    caveTiles = path;
    spring = { x: fx, y: fy + len - 2, z: p.vf - 1 };
    sources.push({ ...spring, strength: 0.5, what: "spring cave" });
    // its stream across the valley floor to the river
    const out: [number, number][] = [];
    for (let y = fy - 1; y > yc(fx) + 2; y--) out.push([fx, y]);
    channel(out, p.vf - 1, 2);
    features.push({ kind: "cave", with: "spring and pool", level: p.vf, length: len, width: 3, height: 3, poolTiles: pool * 3, roofThickness: p.tN - (p.vf + 3), cells: n });
  } else features.push({ kind: "cave", found: false });

  const extraRewards: { x: number; y: number; z: number; template: string }[] = [];
  let cliffLedge: { x: number; y: number; z: number }[] = [];
  let basinOutlet = -1;
  let exit: { x: number; y: number; z: number } | null = null;
  if (vert === "high") {
    const faces = findFaces(vx.surface(), W, H, 5);
    const massif: Face | undefined = faces.find((f) => f.dir === 0 && f.top >= p.M && f.base <= p.tN + 1 && f.tiles.length >= 3 * (p.M - p.tN) + 12);
    if (massif) {
      // ---------------------------------------------------------------- 4. a cliff path of ledges
      const step = 3;
      const ledge = cliffPath(vx, massif, p.tN, step);
      cliffLedge = ledge;
      const pathEnd = (p.M - p.tN) * step + 2;
      features.push({ kind: "cliff path", from: p.tN, to: p.M, ledgeTiles: ledge.length, rise: `1 level per ${step} tiles`, sheltered: "the ledge is cut 2 deep and 3 high into the face" });
      // ---------------------------------------------------------------- 5. a cave off the path
      const mid = ledge.find((l) => l.z === Math.floor((p.tN + p.M) / 2) && (l.y === massif.tiles[0][1] - 1 || true));
      if (mid) {
        // branch from the middle of its step, so the 3-wide cave keeps off the next step's floor
        const atLevel = ledge.filter((l) => l.z === mid.z);
        const inners = atLevel.filter((_, j) => j % 2 === 1).map((l) => [l.x, l.y] as [number, number]);
        const [ix, iy] = inners[Math.floor(inners.length / 2)];
        const path: [number, number][] = [];
        for (let k = 1; k <= 8; k++) path.push([ix, iy + k]);
        const n = carveGallery(vx, path, () => mid.z, 3, 3);
        extraRewards.push({ x: ix - 1, y: iy + 6, z: mid.z, template: "MediumRelic" });
        features.push({ kind: "cliffside cave", level: mid.z, length: 8, width: 3, cells: n, holds: "a medium relic" });
      }
      // ---------------------------------------------------------------- 6. an underground river
      {
        const ex = bx;
        const k0 = massif.tiles.findIndex(([x]) => x === ex);
        if (k0 >= 0 && k0 > pathEnd + 4) {
          const [fx, fy] = massif.tiles[k0];
          // from the basin's edge toward the face, the bed falling one level every 2 tiles
          // from the basin's centre south to its rim: the cut starts on the first rim tile
          let startY = by;
          while (startY > fy && vx.top(ex, startY) < p.M) startY--;
          const exitZ = p.tN + 3;
          const path: [number, number][] = [];
          for (let y = startY + 1; y >= fy; y--) path.push([ex, y]);
          const sill = p.M - 2; // the bed where the cut starts; the gallery's square footprint may lower it by one
          const bed = (k: number) => Math.max(exitZ, sill - Math.floor(k / 2));
          const n = carveGallery(vx, path, bed, 2, 3);
          exit = { x: fx, y: fy, z: bed(path.length - 1) };
          // the lake's outlet: the lowest air in the first rim tile, after the cut
          for (let z = p.M - 4; z < p.M; z++) if (!vx.get(ex, startY, z)) { basinOutlet = z; break; }
          // the stream below: across the terrace, over its edge, across the valley to the river
          const run1: [number, number][] = [];
          for (let y = fy - 1; y > yc(ex) + 2; y--) run1.push([ex, y]);
          const onTerrace = run1.filter(([, y]) => vx.top(ex, y) >= p.tN);
          const onValley = run1.filter(([, y]) => vx.top(ex, y) < p.tN);
          channel(onTerrace, p.tN - 1, 2);
          channel(onValley, p.vf - 1, 2);
          sources.push({ x: bx, y: by, z: p.M - 4, strength: 1, what: "basin spring" });
          features.push({ kind: "underground river", from: `a basin at ${p.M - 4} on the massif`, outlet: basinOutlet, exitLevel: exit.z, tunnelLength: path.length, cells: n, fall: `${exit.z - p.tN} levels out of the face onto the terrace, then ${p.tN - p.vf} over the terrace edge` });
        }
      }
      // ---------------------------------------------------------------- 7. the face leans out
      {
        const tiles = massif.tiles.filter(([x], k) => k > pathEnd + 6 && Math.abs(x - bx) > 6);
        const lean: Face = { ...massif, tiles };
        const z0 = p.M - 7;
        const ext = leanOut(vx, lean, z0, (k, z) => (fbm(seed + 8, lean.tiles[k][0], z, 8) > -0.25 ? 1 : 0));
        features.push({ kind: "overhanging cliff", faceTiles: tiles.length, from: z0, to: p.M, overhang: ext, over: "the terrace, which becomes a sheltered lower level" });
      }
    }
    // ---------------------------------------------------------------- 8. a sky bridge over the gorge
    {
      const gaps = findGaps(vx.surface(), W, H, p.M, 4, 5, 3 * gHalf + 4).filter((g) => g.dir === 3 && Math.abs(g.a[0] + g.span / 2 - gx) <= gHalf + 2);
      const hs = vx.surface();
      const g = gaps.find((c) => hs[c.a[1] * W + c.a[0]] === hs[c.b[1] * W + c.b[0]]) ?? gaps[0];
      if (g) {
        g.level = Math.min(hs[g.a[1] * W + g.a[0]], hs[g.b[1] * W + g.b[0]]);
        const r = skyBridge(vx, g, 3);
        features.push({ kind: "sky bridge", level: g.level, span: g.span, height: g.level - g.floor, corbelLayers: r.layers, width: 3, candidates: gaps.length });
      }
    }
    // ---------------------------------------------------------------- 9. a tall arch through the ridge
    {
      const ax = Math.round(S * 0.82);
      const cy = Math.round(yc(ax)) - vw - 1;
      const height = p.R - p.vf - 3;
      const n = windowArch(vx, ax, cy, 0, p.vf, 9, height, rw + 3);
      features.push({ kind: "natural arch", through: "the ridge", level: p.vf, span: 9, height, lintel: p.R - p.vf - height, cells: n });
    }
  }
  report.features = features;
  report.carveCpuMs = cpuMs(t0);

  // ------------------------------------------------------------------ checks: support
  // The carvers keep the rule one at a time; where two meet (a cave mouth under a ledge), a roof
  // piece can end up too far from support. The build's last terrain pass applies the game's rule
  // and drops what the game would drop, then everything is checked again.
  const sup0 = checkSupport(W, H, vx.v, vx.L);
  for (const v of sup0.unsupported) vx.v[v] = 0;
  const sup = checkSupport(W, H, vx.v, vx.L);
  report.support = { droppedByTheRulePass: sup0.unsupported.length, at: sup0.unsupported.slice(0, 8).map((v) => { const z = Math.floor(v / N), i = v - z * N; return [i % W, (i - (i % W)) / W, z]; }), unsupportedAfter: sup.unsupported.length };

  // ------------------------------------------------------------------ checks: walking
  const g = new FloorGraph(W, H, vx.v, vx.L);
  const startNode = p.vf * N + (sy + 1) * W + (sx + 1);
  const keepClear = new Uint8Array(N);
  for (let i = 0; i < N; i++) keepClear[i] = keep[i];
  for (const s of sources) keepClear[s.y * W + s.x] = 1;
  const slopes: Slope[] = g.autoSlopes(startNode, 400, 6, keepClear);
  const reach = g.reach(startNode, slopes);
  const reg = g.regions();
  const perLevel: Record<number, { walkable: number; reached: number; roofed: number }> = {};
  const regInfo = new Map<number, { z: number; n: number; reached: boolean; roofed: number; x: number; y: number }>();
  for (let v = 0; v < g.node.length; v++) {
    if (!g.node[v]) continue;
    const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
    const roofed = g.headroom(x, y, z) < 99 ? 1 : 0;
    const e = (perLevel[z] ??= { walkable: 0, reached: 0, roofed: 0 });
    e.walkable++;
    if (reach[v]) e.reached++;
    e.roofed += roofed;
    const r = reg[v];
    const ri = regInfo.get(r) ?? { z, n: 0, reached: !!reach[v], roofed: 0, x, y };
    ri.n++;
    ri.roofed += roofed;
    regInfo.set(r, ri);
  }
  const stairOnly = [...regInfo.values()].filter((r) => !r.reached && r.n >= 20).sort((a, b) => b.z - a.z || b.n - a.n);
  report.walk = {
    slopes: slopes.length,
    perLevel,
    reachedShare: share(Object.values(perLevel).reduce((s, e) => s + e.reached, 0), Object.values(perLevel).reduce((s, e) => s + e.walkable, 0)),
    stairOnlyRegions: stairOnly.slice(0, 12).map((r) => ({ level: r.z, nodes: r.n, roofedNodes: r.roofed, at: [r.x, r.y] })),
  };
  // the places each feature opens, and whether the start reaches them without stairs
  const places: Record<string, unknown> = {};
  const reached = (x: number, y: number, z: number) => g.isNode(x, y, z) && reach[z * N + y * W + x] === 1;
  places["side valley (beyond the ridge)"] = anyReached(g, reach, N, W, (x, y, z) => z === p.vf && y < yc(x) - vw - rw - 2 && y > yc(x) - vw - rw - sw + 2);
  places["terrace"] = anyReached(g, reach, N, W, (x, y, z) => (z === p.tN || z === p.tN + 1) && y > yc(x) + vw + 3 && y < yc(x) + vw + tw - 3);
  places["massif top"] = anyReached(g, reach, N, W, (x, y, z) => z >= p.M && y > yc(x) + vw + tw + 4 && x < gx - gHalf - 2);
  places["massif east of the gorge"] = anyReached(g, reach, N, W, (x, y, z) => z >= p.M && y > yc(x) + vw + tw + 4 && x > gx + gHalf + 2);
  places["ridge top"] = anyReached(g, reach, N, W, (x, y, z) => z === p.R && y < yc(x) - vw && y >= yc(x) - vw - rw - 3);
  if (spring) places["spring cave floor"] = reached(spring.x, spring.y - 3, p.vf) || reached(spring.x - 1, spring.y - 4, p.vf);
  report.places = places;
  {
    // reach along the terrace's middle row, west to east: # reached, . walkable not reached
    let row = "";
    for (let x = 0; x < W; x += 2) {
      const y = Math.round(yc(x) + vw + tw / 2);
      const z = vx.top(x, y);
      row += !g.isNode(x, y, z) ? " " : reach[z * N + y * W + x] ? "#" : ".";
    }
    report.terraceRow = row;
  }
  // how far up the cliff path the start's walk gets (levels of ledge tiles reached)
  if (cliffLedge.length) {
    const lv = new Map<number, [number, number]>();
    for (const l of cliffLedge) {
      const e = lv.get(l.z) ?? [0, 0];
      e[0]++;
      if (reached(l.x, l.y, l.z)) e[1]++;
      lv.set(l.z, e);
    }
    report.cliffPathReach = [...lv.entries()].sort((a, b) => a[0] - b[0]).map(([z, [n, r]]) => `${z}:${r}/${n}`).join(" ");
  }

  // rewards: relics on the highest stair-only ground, and in the cliffside cave
  const entities: EntitySpec[] = [];
  const id = (...k: (string | number)[]) => guidFrom("terrain3d", seed, S, vert, ...k);
  entities.push(startingLocation({ id: id("start"), owner: "start", x: sx, y: sy, z: p.vf, orientation: "Cw0" }));
  for (const [k, s] of sources.entries()) entities.push(waterSource({ id: id("src", k), owner: s.what, x: s.x, y: s.y, z: s.z, strength: s.strength }));
  for (const [k, s] of slopes.entries()) entities.push(slopeEntity({ id: id("slope", k), owner: "slopes", x: s.x, y: s.y, z: s.z, orientation: SLOPE_ORIENTATION[s.dir] }));
  const rewards: Record<string, unknown>[] = [];
  const top = stairOnly.find((r) => r.z >= p.R - 1);
  if (top) {
    entities.push(ruin({ id: id("ruin", "top"), owner: "reward", x: top.x, y: top.y, z: top.z, height: 4, variant: "B", orientation: "Cw0" }));
    rewards.push({ what: "a ruin column (60 scrap)", level: top.z, reachedBy: "player stairs only" });
  }
  for (const [k, r] of extraRewards.entries()) {
    entities.push(blockObject({ id: id("relic", k), owner: "reward", x: r.x, y: r.y, z: r.z, template: r.template, orientation: "Cw0" }));
    rewards.push({ what: r.template, level: r.z, reachedBy: reached(r.x, r.y, r.z) || reached(r.x + 1, r.y, r.z) ? "the cliff path" : "stairs" });
  }
  report.rewards = rewards;
  // a forest and berries on the moist valley floor, off the start and the water; bushes in the cave
  let trees = 0, bushes = 0;
  const hNow = vx.surface();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const d = y - yc(x);
    if (keep[i] || Math.abs(d) < 4 || Math.abs(d) > vw - 1 || hNow[i] !== p.vf || !g.isNode(x, y, p.vf)) continue;
    const r = tileHash01(seed + 11, x, y);
    if (r < 0.18) { entities.push(tree({ id: id("tree", i), owner: "forest", x, y, z: p.vf, species: r < 0.12 ? "Pine" : "Birch" })); trees++; }
    else if (r < 0.23) { entities.push(bush({ id: id("bush", i), owner: "berries", x, y, z: p.vf, ripe: true })); bushes++; }
  }
  for (const [k, [x, y]] of caveTiles.slice(1, 4).entries()) {
    if (!g.isNode(x + 1, y, p.vf)) continue;
    entities.push(bush({ id: id("cavebush", k), owner: "cave", x: x + 1, y, z: p.vf, ripe: true }));
    bushes++;
  }
  report.resources = { trees, bushes };

  // ------------------------------------------------------------------ checks: water
  const cols = waterColumns(W, H, vx.v, [], vx.L);
  const emitters: StackEmitter[] = [];
  for (const s of sources) {
    const i = s.y * W + s.x;
    const slot = slotAt(cols, i, s.z);
    emitters.push({ cols: slot >= 0 ? [slot * N + i] : [], tiles: [i], strength: slot >= 0 ? s.strength : 0, contamination: 0 });
  }
  const sim = new StackSim({ cols, emitters }, "game");
  const pf = prefill3d(sim);
  sim.setState(pf.depth, pf.overflow, pf.cont);
  const t1 = process.cpuUsage();
  const st = settle(sim, 6);
  const water: Record<string, unknown> = { settled: st.settled, ticks: st.ticks, cpuMs: cpuMs(t1), levels: cols.L, sourceStrength: sources.reduce((s, x) => s + x.strength, 0), edgeOutflow: round(sim.edgeOutflow()) };
  let roofedWet = 0, roofedVol = 0, pressured = 0;
  for (let c = 0; c < sim.M; c++) {
    if (sim.D[c] > 0.05 && cols.ceil[c] < OPEN_CEILING) { roofedWet++; roofedVol += sim.D[c] + sim.O[c]; }
    if (sim.O[c] > 0) pressured++;
  }
  water.roofedWetColumns = roofedWet;
  water.roofedVolume = round(roofedVol);
  water.pressurisedColumns = pressured;
  if (spring) {
    const poolCol = (x: number, y: number) => { const i = y * W + x; const s = slotAt(cols, i, p.vf - 1); return s >= 0 ? sim.D[s * N + i] : 0; };
    water.springPoolDepth = round(poolCol(spring.x, spring.y));
    const mouth = (spring.y - (vert === "high" ? 12 : 8)) * W + spring.x;
    const ms = slotAt(cols, mouth, p.vf);
    water.caveFloorSheetDepth = ms >= 0 ? round(sim.D[ms * N + mouth]) : null;
  }
  if (exit && vert === "high") {
    const i = exit.y * W + exit.x;
    const s = slotAt(cols, i, exit.z);
    water.undergroundRiverAtExit = s >= 0 ? round(sim.D[s * N + i]) : null;
    const bi = by * W + bx;
    const bs = slotAt(cols, bi, p.M - 4);
    water.basinSurface = bs >= 0 ? round(p.M - 4 + sim.D[bs * N + bi]) : null;
    water.basinOutlet = basinOutlet;
  }
  // the ridge tunnel stays dry
  report.water = water;

  // today's heightfield water on the same map: one column per tile at the top surface
  {
    const surf = vx.surface();
    const floor = new Float64Array(N);
    for (let i = 0; i < N; i++) floor[i] = surf[i];
    const em2 = sources.map((s) => ({ cells: [s.y * W + s.x], strength: s.strength, contamination: 0 }));
    const m2 = { W, H, floor, dam: null, emitters: em2 };
    const sim2 = new WaterSim(m2, prefill2d(m2));
    const r2 = settle2d(sim2, { maxDays: 6 });
    let wet3 = 0, wet2 = 0, both = 0, sheet = 0;
    for (let i = 0; i < N; i++) {
      let a = false;
      for (let k = 0; k < cols.count[i]; k++) if (sim.D[k * N + i] > 0.05) a = true;
      const b = sim2.D[i] > 0.05;
      if (a) wet3++;
      if (b) wet2++;
      if (a && b) both++;
      // water the heightfield puts on top of terrain that stands over a cave or tunnel
      if (b && terrainRunsCount(vx, i) > 1) sheet++;
    }
    report.heightfieldWater = { settled: r2.settled, wetTiles: wet2, stackedWetTiles: wet3, tileIou: round(both / Math.max(1, wet2 + wet3 - both)), wetOnRoofs: sheet };
  }

  report.totalCpuMs = cpuMs(t0);
  const bytes = writeStacked(W, H, vx.v, cols, sim, entities, `Dam Good Maps terrain-3D prototype: ${vert} verticality, seed ${seed}, ${S}x${S}.`);
  report.fileBytes = bytes.length;
  report.runs = { maxRunsPerTile: terrainRuns(W, H, vx.v).L, multiRunTiles: countMulti(vx) };
  return { vx, entities, report, sim, bytes };
}

function terrainRunsCount(vx: Vox, i: number): number {
  let n = 0, inSolid = false;
  for (let z = 0; z < vx.L; z++) {
    const s = vx.v[z * vx.N + i] === 1;
    if (s && !inSolid) n++;
    inSolid = s;
  }
  if (vx.v[i] === 0) n++; // run 0 is empty when the bottom voxel is air
  return n;
}
function countMulti(vx: Vox): number {
  let n = 0;
  for (let i = 0; i < vx.N; i++) if (terrainRunsCount(vx, i) > 1) n++;
  return n;
}
function anyReached(g: FloorGraph, reach: Uint8Array, N: number, W: number, pred: (x: number, y: number, z: number) => boolean): boolean | null {
  let any = false;
  for (let v = 0; v < reach.length; v++) {
    if (!g.node[v]) continue;
    const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
    if (!pred(x, y, z)) continue;
    any = true;
    if (reach[v]) return true;
  }
  return any ? false : null;
}
function share(a: number, b: number): number {
  return round(a / Math.max(1, b));
}
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
function cpuMs(t: NodeJS.CpuUsage): number {
  const d = process.cpuUsage(t);
  return Math.round((d.user + d.system) / 1000);
}

// ------------------------------------------------------------------------------ command line
if (process.argv[1] && process.argv[1].endsWith("gen3d.ts")) {
  const S = Number(arg("size", "128"));
  const vert = arg("vert", "high") as Verticality;
  const seed = Number(arg("seed", "1"));
  const outDir = arg("out", "investigation/terrain3d/results");
  const mapsDir = arg("maps", "");
  mkdirSync(outDir, { recursive: true });
  const r = gen3d(S, vert, seed);
  writeFileSync(join(outDir, `carve-${vert}-${S}.json`), JSON.stringify(r.report, null, 1) + "\n");
  if (mapsDir) {
    mkdirSync(mapsDir, { recursive: true });
    writeFileSync(join(mapsDir, `terrain3d-${vert}-${S}-${seed}.timber`), r.bytes);
    // voxels for the mesher benchmark
    writeFileSync(join(mapsDir, `terrain3d-${vert}-${S}-${seed}.vox`), Buffer.from(r.vx.v));
  }
  console.log(JSON.stringify(r.report, null, 1));
}
