// Terrain rasterizers (PLAN §19.8 steps 2–7): landforms, lakes, rivers, the start bench, sculpt
// edits and the integrity pass. Each writes only the target's region, tile by tile, and reports the
// rectangle it can touch (`footprint`) so an edit rebuilds only that area (PLAN §19.7).

import { fbm } from "../../math/noise";
import { hash32 } from "../../math/hash";
import type { Runs } from "../../math/grid";
import { bedAt, floorAt, polygonMask } from "../geometry";
import type { Edge, Feature, LakeFeature, LandformFeature, RiverFeature, StartFeature } from "../schema";
import { boundsOf, clipRect, type BuildTarget, type Rect } from "../target";

export const MAX_TERRAIN = 16; // PLAN §20, D4

// ------------------------------------------------------------------------------------ landforms

export function rasterizeLandform(f: LandformFeature, t: BuildTarget): void {
  const p = f.params;
  const { heights } = t;
  if (p.along) {
    const river = t.river(p.along.river);
    if (!river) return t.note(`landform ${f.id}: river ${p.along.river} not found`);
    const field = t.pathField(p.along.river);
    const hw = p.along.halfWidth;
    if (p.kind === "valley") {
      // the valley floor: the floodplain level of the nearest river reach, out past any wiggle
      const floorAbove = p.along.floorAboveBed;
      t.forEach((i) => {
        if (field.d[i] < hw + 8 && t.writable(i, f)) heights[i] = floorAt(river.params, field.s[i], floorAbove);
      });
      return;
    }
    if (p.kind === "terraces") {
      const along = p.along;
      const side = along.side ?? 1;
      const bands = along.bands ?? [];
      const wob = along.wobble ?? { amp: 0, cell: 24, amp2: 0, cell2: 8 };
      const base = along.baseLevel ?? 0;
      const maxLevel = Math.min(MAX_TERRAIN, along.maxLevel ?? MAX_TERRAIN);
      const s1 = hash32(t.seed, f.id, "wobble");
      const s2 = hash32(t.seed, f.id, "wobble2");
      t.forEach((i, x, y) => {
        if (field.side[i] !== side || !t.writable(i, f)) return;
        const dn = field.d[i] + wob.amp * fbm(s1, x, y, wob.cell, 3) + wob.amp2 * fbm(s2, x, y, wob.cell2, 3);
        const out = dn - hw;
        if (out <= 0) return;
        let lift = 0;
        for (const b of bands) if (out > b.at) lift += b.rise;
        const floor = floorAt(river.params, field.s[i], along.floorAboveBed);
        heights[i] = Math.min(maxLevel, Math.max(floor, base + lift));
      });
      return;
    }
  }
  if (p.outline && p.height !== undefined) {
    const mask = polygonMask(p.outline, t.W, t.H);
    const level = Math.min(MAX_TERRAIN, p.height);
    t.forEach((i) => {
      if (mask[i] && t.writable(i, f)) heights[i] = level;
    });
    return;
  }
  t.note(`landform ${f.id} (${p.kind}) has no shape this version can build`);
}

// ---------------------------------------------------------------------------------- lakes, rivers

export function rasterizeLake(f: LakeFeature, t: BuildTarget): void {
  const { heights } = t;
  const mask = polygonMask(f.params.outline, t.W, t.H);
  const river = f.params.river ? t.river(f.params.river) : undefined;
  const field = river ? t.pathField(river.id) : undefined;
  t.forEach((i) => {
    if (!mask[i] || t.protectedMask[i] || !t.writable(i, f)) return;
    if (river && field) heights[i] = floorAt(river.params, field.s[i], f.params.floorDepth);
    else heights[i] = Math.max(0, f.params.outlet.sill - f.params.floorDepth);
  });
}

export function rasterizeRiver(f: RiverFeature, t: BuildTarget): void {
  const { heights, channel } = t;
  const field = t.pathField(f.id);
  const half = f.params.width / 2;
  t.forEach((i) => {
    if (field.d[i] < half && t.writable(i, f)) {
      heights[i] = bedAt(f.params.bedProfile, field.s[i]);
      channel[i] = 1;
    }
  });
}

/** Channel tiles on the map border where the river enters (its sealed mouth, PLAN §7.6). */
export function mouthTiles(f: RiverFeature, t: Pick<BuildTarget, "W" | "H" | "pathField">): number[] {
  const entry = f.params.entry;
  if (!("edge" in entry)) return [];
  const { W, H } = t;
  const field = t.pathField(f.id);
  const half = f.params.width / 2;
  const out: number[] = [];
  const border = (x: number, y: number) => {
    const i = y * W + x;
    if (field.d[i] < half) out.push(i);
  };
  const edge: Edge = entry.edge;
  if (edge === "west") for (let y = 0; y < H; y++) border(0, y);
  else if (edge === "east") for (let y = 0; y < H; y++) border(W - 1, y);
  else if (edge === "south") for (let x = 0; x < W; x++) border(x, 0);
  else for (let x = 0; x < W; x++) border(x, H - 1);
  return out;
}

// ----------------------------------------------------------------------------------------- start

/** The start bench (step 5). It never fills the river channel, which it would dam. */
export function rasterizeBench(f: StartFeature, t: BuildTarget): void {
  const [cx, cy] = f.params.position;
  const r = f.params.benchRadius;
  t.forEach((i, x, y) => {
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && !t.channel[i] && t.writable(i, f)) {
      t.heights[i] = f.params.benchLevel;
      t.protect(i);
    }
  });
}

// ---------------------------------------------------------------------------------------- sculpt

export interface SculptEdit {
  params: { mode: string; cells: Runs; amount?: number; level?: number; step?: number };
}

export function sculptBounds(s: SculptEdit): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [y, a, b] of s.params.cells) {
    if (a < x0) x0 = a;
    if (b > x1) x1 = b;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x0 <= x1 ? { x0, y0, x1, y1 } : null;
}

/** Brushes that read neighbouring cells: a rebuild that touches their cells rebuilds all of them. */
export function sculptReadsNeighbours(s: SculptEdit): boolean {
  return s.params.mode === "smooth";
}

/** Apply one sculpt edit (step 6) to the region's cells. Heights stay within 0–16, the in-game
 *  editor's range (the brushes are defined that way, like the game's own). */
export function applySculpt(s: SculptEdit, t: BuildTarget): void {
  const { W, heights } = t;
  const p = s.params;
  if (p.mode === "smooth") {
    // the median of each cell's 3×3 neighbours inside the brush, read before the brush applies
    const inBrush = new Map<number, number>();
    for (const [y, a, b] of p.cells) for (let x = a; x <= b; x++) inBrush.set(y * W + x, heights[y * W + x]);
    const out: [number, number][] = [];
    for (const [y, a, b] of p.cells) {
      for (let x = a; x <= b; x++) {
        const i = y * W + x;
        if (!t.inRegion(i)) continue;
        const vals: number[] = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const v = inBrush.get((y + dy) * W + (x + dx));
            if (v !== undefined && x + dx >= 0 && x + dx < W) vals.push(v);
          }
        vals.sort((m, n) => m - n);
        out.push([i, vals[vals.length >> 1]]);
      }
    }
    for (const [i, v] of out) heights[i] = v;
    return;
  }
  for (const [y, a, b] of p.cells) {
    for (let x = a; x <= b; x++) {
      const i = y * W + x;
      if (!t.inRegion(i)) continue;
      const h = heights[i];
      switch (p.mode) {
        case "raise":
          if (h < MAX_TERRAIN) heights[i] = Math.min(MAX_TERRAIN, h + (p.amount ?? 0));
          break;
        case "lower":
          heights[i] = Math.max(0, h - (p.amount ?? 0));
          break;
        case "flatten":
          heights[i] = p.level ?? h;
          break;
        case "terrace": {
          const step = p.step ?? 2;
          heights[i] = Math.floor(h / step) * step;
          break;
        }
        default:
          break;
      }
    }
  }
}

// ------------------------------------------------------------------------------------- integrity

/** Step 7 for the tiles of `tiles`: clip to the editor limit and remove single-tile pits and
 *  spikes off channels, reading the unclipped `pre` heights of the four neighbours through the same
 *  clip. `candidate(i)` says which tiles the pass may change. */
export function integrityAt(
  pre: Uint8Array,
  out: Uint8Array,
  W: number,
  H: number,
  prot: Uint8Array,
  channel: Uint8Array,
  candidate: (i: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const clip = (i: number) => (candidate(i) && pre[i] > MAX_TERRAIN ? MAX_TERRAIN : pre[i]);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const v = clip(i);
      out[i] = v;
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2 || prot[i] || channel[i] || !candidate(i)) continue;
      const a = clip(i - 1);
      const b = clip(i + 1);
      const c = clip(i - W);
      const d = clip(i + W);
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      if (v < lo) out[i] = lo; // pit
      else if (v > hi) out[i] = hi; // spike
    }
  }
}

// ------------------------------------------------------------------------------------- footprints

/** The rectangle a terrain feature's rasterizer can write, "all", or null (none). */
export function terrainFootprint(f: Feature, t: Pick<BuildTarget, "W" | "H" | "river">): Rect | "all" | null {
  const { W, H } = t;
  switch (f.kind) {
    case "landform": {
      const p = f.params;
      if (p.along) {
        if (p.kind === "terraces") return "all";
        const river = t.river(p.along.river);
        if (!river) return null;
        const b = boundsOf(river.params.path);
        return b && clipRect(b, W, H, Math.ceil(p.along.halfWidth + 8) + 1);
      }
      const b = p.outline ? boundsOf(p.outline) : null;
      return b && clipRect(b, W, H, 1);
    }
    case "lake": {
      const b = boundsOf(f.params.outline);
      return b && clipRect(b, W, H, 1);
    }
    case "river": {
      const b = boundsOf(f.params.path);
      return b && clipRect(b, W, H, Math.ceil(f.params.width / 2) + 1);
    }
    case "start": {
      const [x, y] = f.params.position;
      const r = f.params.benchRadius + 1;
      return clipRect({ x0: x - r, y0: y - r, x1: x + r, y1: y + r }, W, H);
    }
    default:
      return null;
  }
}
