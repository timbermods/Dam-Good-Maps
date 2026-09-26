// Waterfalls with shape and volume (Map look, PLAN §20 D201). Where water pours over a lip into
// lower water, it leaves the lip and arcs outward and down as a curved translucent ribbon with
// thickness, and lands in the pool below:
// - the ribbon's outer face is a parabola from the lip (level there, as water leaving a brink) to
//   the landing; its inner face runs a lip's depth inside it, thinning as the water falls;
// - the arc reaches further out for stronger flow and taller falls (`fallReach`);
// - a splash of whitewater lies on the pool where it lands, in the landing zone only; the water
//   shader draws a line of foam along the lip's brink (waterMesh.ts `LIP_BITS`);
// - a stepped cascade is a fall at every step, each with its own lip and splash;
// - adjacent lip tiles pouring the same way into the same water share their corners, so a wide fall
//   is one continuous ribbon; its free ends are closed (the thickness shows) and fray.
//
// The flow at the lip: the view carries no flow, and needs none. At a drop the water simulation
// empties the lip tile every substep (its outflow is clamped to the water it holds), so the water
// pouring over a side per second is the lip's depth over the substep (sim/water.ts DT), shared among
// the sides it flows out of by their head, as the simulation shares it (`lipOutflow`; within a few
// per cent of the simulation's own outflow at the falls of the generated maps, tested). So the falls
// follow every water update, and the live water's frames, with nothing more sent.
//
// Cheap on 256² maps with many falls: each fall is one instance (16 floats) of a small shared
// template (`fallTemplate`), which the vertex shader bends into the arc (materials.ts
// `fallMaterial`); the water mesher lists a chunk's falls when it meshes the chunk's water, so only
// changed chunks are listed again, and nothing is rebuilt per frame. From afar (a tile under
// FALL_NEAR_PX pixels) a fall is a single sheet with its splash; the light look always draws that.
//
// Pure TypeScript, no three.js.

import { DT } from "../core/sim/water";
import type { SurfaceWater } from "./model";

/** A drop at least this tall into lower water is a fall (a smaller step is a curtain). */
export const FALL_MIN = 0.3;
/** Water within this of another's surface is the same water (waterMesh.ts SAME_WATER). */
const SAME_WATER = 0.35;

/** The arc's shape: the reach before its soft limit is `reach` · flow^flowPower · drop^dropPower
 *  tiles; it never passes `limit` tiles (or twice that where the pool goes on past the landing
 *  tile), nor falls below `least`. The ribbon is the lip's depth thick (`thickness` bounds it, and
 *  never more than `ofDrop` of the drop), thinning by `thinning` of it as it falls. A free end of the
 *  lip stands `inset` in from the tile's corner, and up to `narrow` more for a thin trickle (a
 *  one-wide lip carrying little water is a narrow stream). */
export const FALL_SHAPE = {
  reach: 0.55,
  flowPower: 0.7,
  dropPower: 0.45,
  limit: 1.1,
  least: 0.05,
  thickness: [0.06, 0.45] as readonly [number, number],
  ofDrop: 0.8,
  thinning: 0.4,
  inset: 0.03,
  narrow: 0.25,
  /** The ribbon stands this far off the cliff's face. */
  off: 0.015,
} as const;

/** The splash on the pool: it reaches a spread of `base` + `flow` · √(the flow) + `drop` · (the
 *  drop, counted to 6 levels) tiles out past the impact line (never past its room), a third of that
 *  back toward the cliff, and `side` past a free end of the lip. */
export const FALL_SPLASH = { base: 0.3, flow: 0.2, drop: 0.05, side: 0.12 } as const;

/** Below this many pixels a tile, a fall is drawn as a single sheet (and its splash). */
export const FALL_NEAR_PX = 6;

/** Segments along the arc, near and far. The template spaces them by the square of their share, so
 *  most bend the arc at the lip, where it turns. */
export const FALL_SEGMENTS = { near: 12, far: 4 } as const;

/** Floats per fall instance:
 *  [0, 1] the lip edge's first corner (world X, Z); [2] its side (0 east, 1 west, 2 north, 3 south)
 *  + 4 × its free ends (1: the first corner's, 2: the second's); [3] the flow over it (blocks a
 *  second per tile of edge); [4, 5] the lip's surface and [6, 7] the landing's at the two corners;
 *  [8, 9] the reach and [10, 11] the thickness at the two corners; [12, 13] the badwater share at
 *  the two corners; [14] its room, out from the lip edge (1 tile, or 2 where the pool goes on past
 *  the landing tile); [15] the lip's depth. The second corner is the first plus the lip's
 *  `tangent`. */
export const FALL_STRIDE = 16;

/** Sides as the water mesher numbers them: east, west, north (+y), south (−y), in tiles. */
const SX = [1, -1, 0, 0] as const;
const SY = [0, 0, 1, -1] as const;

/** Along a lip on side k, in tiles: the direction from its first corner to its second (up × out,
 *  so every side's faces wind the same way). */
export function tangent(k: number): [number, number] {
  // out in the world (X, Z) is (SX, −SY), and Y × out = (outZ, −outX) = (−SY, −SX); in tiles
  // (X, −Z) that is (−SY, SX)
  return [-SY[k], SX[k]];
}

/** The first corner of side k of tile (x, y), in tiles (tile corner coordinates). */
export function firstCorner(x: number, y: number, k: number): [number, number] {
  const [tx, ty] = tangent(k);
  // the side's middle, less half the tangent
  return [x + 0.5 + SX[k] * 0.5 - tx * 0.5, y + 0.5 + SY[k] * 0.5 - ty * 0.5];
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The water pouring over side k of tile i each second, per tile of edge (see the file comment):
 *  the tile's depth over the simulation's substep, shared among the sides it flows out of by their
 *  head (the neighbour's water surface, or its ground where dry; none where the neighbour's floor
 *  stands at the water's surface or above it; the map's edge counts for none). */
export function lipOutflow(W: number, H: number, heights: Uint8Array, sw: SurfaceWater, x: number, y: number, k: number): number {
  const i = y * W + x;
  const s = sw.surface[i];
  if (!(s === s)) return 0;
  let sum = 0;
  let mine = 0;
  for (let kk = 0; kk < 4; kk++) {
    const xx = x + SX[kk];
    const yy = y + SY[kk];
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const j = yy * W + xx;
    const ns = sw.surface[j];
    const wet = ns === ns;
    const floor = wet ? sw.floor[j] : heights[j];
    if (floor >= s) continue;
    const e = s - (wet ? ns : heights[j]);
    if (!(e > 0)) continue;
    sum += e;
    if (kk === k) mine = e;
  }
  return sum > 0 ? (sw.depth[i] / DT) * (mine / sum) : 0;
}

/** How far out (tiles) a fall of `drop` levels carrying `flow` lands: further for stronger flow and
 *  taller falls, softly limited so it lands in its pool (`room`: 1 tile, or 2 where the pool goes on
 *  past the landing tile). */
export function fallReach(flow: number, drop: number, room = 1): number {
  const S = FALL_SHAPE;
  const raw = S.reach * Math.pow(Math.max(0, flow), S.flowPower) * Math.pow(Math.max(0, drop), S.dropPower);
  const cap = S.limit * room;
  return Math.max(S.least, cap * (1 - Math.exp(-raw / cap)));
}

/** The ribbon's thickness at the lip: the lip's depth, within bounds. */
export function fallThickness(depth: number, drop: number): number {
  const S = FALL_SHAPE;
  return Math.min(clamp(depth, S.thickness[0], S.thickness[1]), S.ofDrop * drop);
}

/** A point of the fall's arc, w from 0 (the lip) to 1 (the landing): [out, up], out from the lip's
 *  edge in tiles and up as a height; `inner` the inner face's (a thickness inside the outer one,
 *  thinning as it falls, never behind the cliff or below the landing). The outer face is the
 *  parabola up = top − (top − land) · w², out = reach · w: level at the lip, the water leaving the
 *  brink, and steeper as it falls. As the vertex shader (materials.ts `fallMaterial`) draws it. */
export function arcPoint(reach: number, top: number, land: number, thickness: number, w: number, inner = false): [number, number] {
  const h = Math.max(top - land, 0.01);
  let out = reach * w;
  let up = top - h * w * w;
  if (inner) {
    const tx = reach;
    const ty = -2 * h * w;
    const l = Math.hypot(tx, ty) || 1;
    // the outer face's normal, out and up: the tangent turned a quarter
    const nx = -ty / l;
    const ny = tx / l;
    const th = thickness * (1 - FALL_SHAPE.thinning * w);
    out = Math.max(0, out - nx * th);
    up = Math.max(land, up - ny * th);
  }
  return [out + FALL_SHAPE.off, up];
}

/** The length of the outer arc from the lip to w (tiles), for the streaks' flow down the fall. */
export function arcLength(reach: number, top: number, land: number, w: number): number {
  const h = Math.max(top - land, 0.01);
  const X = Math.max(reach, 1e-4);
  const r = Math.sqrt(X * X + 4 * h * h * w * w);
  return 0.5 * (w * r + ((X * X) / (2 * h)) * Math.asinh((2 * h * w) / X));
}

interface Lip {
  top: number;
  land: number;
  flow: number;
  reach: number;
  thickness: number;
  bad: number;
  room: number;
  depth: number;
}

/** The fall over side k of tile (x, y), or null where none: its lip's surface, its landing's, the
 *  flow over it, its reach and thickness, its badwater share (blended, `bad`) and its room. */
export function lipAt(W: number, H: number, heights: Uint8Array, sw: SurfaceWater, bad: Float32Array, x: number, y: number, k: number): Lip | null {
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const i = y * W + x;
  const top = sw.surface[i];
  if (!(top === top)) return null;
  const xx = x + SX[k];
  const yy = y + SY[k];
  if (xx < 0 || yy < 0 || xx >= W || yy >= H) return null;
  const land = sw.surface[yy * W + xx];
  if (!(land === land) || !(top - land >= FALL_MIN)) return null;
  // the pool goes on past the landing tile: the fall may reach a little further
  const x2 = xx + SX[k];
  const y2 = yy + SY[k];
  const beyond = x2 >= 0 && y2 >= 0 && x2 < W && y2 < H ? sw.surface[y2 * W + x2] : NaN;
  const room = beyond === beyond && Math.abs(beyond - land) <= SAME_WATER ? 2 : 1;
  const drop = top - land;
  const flow = lipOutflow(W, H, heights, sw, x, y, k);
  const depth = sw.depth[i];
  return { top, land, flow, reach: fallReach(flow, drop, room), thickness: fallThickness(depth, drop), bad: bad[i], room, depth };
}

/** Whether two lips side by side pour into the same water from the same water: one ribbon. */
function joins(a: Lip, b: Lip | null): b is Lip {
  return !!b && Math.abs(a.top - b.top) <= SAME_WATER && Math.abs(a.land - b.land) <= SAME_WATER;
}

/** Add the fall over side k of tile (x, y) to `out` (FALL_STRIDE floats); false where there is none.
 *  At a corner shared with the next lip along the edge, pouring into the same water, the two share
 *  their surfaces, reach, thickness and badwater share, so the ribbon runs on unbroken; elsewhere
 *  the corner is a free end. */
export function pushFall(out: number[], W: number, H: number, heights: Uint8Array, sw: SurfaceWater, bad: Float32Array, x: number, y: number, k: number): boolean {
  const me = lipAt(W, H, heights, sw, bad, x, y, k);
  if (!me) return false;
  const [tx, ty] = tangent(k);
  const a = lipAt(W, H, heights, sw, bad, x - tx, y - ty, k);
  const b = lipAt(W, H, heights, sw, bad, x + tx, y + ty, k);
  const ja = joins(me, a);
  const jb = joins(me, b);
  const at = (o: Lip | null, joined: boolean, f: (l: Lip) => number) => (joined ? (f(me) + f(o!)) / 2 : f(me));
  const [cx, cy] = firstCorner(x, y, k);
  const free = (ja ? 0 : 1) | (jb ? 0 : 2);
  out.push(
    cx,
    -cy,
    k + 4 * free,
    me.flow,
    at(a, ja, (l) => l.top),
    at(b, jb, (l) => l.top),
    at(a, ja, (l) => l.land),
    at(b, jb, (l) => l.land),
    at(a, ja, (l) => l.reach),
    at(b, jb, (l) => l.reach),
    at(a, ja, (l) => l.thickness),
    at(b, jb, (l) => l.thickness),
    at(a, ja, (l) => l.bad),
    at(b, jb, (l) => l.bad),
    me.room,
    me.depth,
  );
  return true;
}

/** The shared template every fall bends (materials.ts `fallMaterial`): per vertex `rib` = (u across
 *  the lip, 0–1; w along the arc, 0–1; 1 on the inner face or edge; kind), kind 0 the ribbon's faces
 *  (close up), 1 and 2 its ends at u = 0 and 1 (close up, drawn at a free end only), 3 the single
 *  sheet from afar, 4 the splash on the pool (both). Triangles back to front as seen from outside
 *  the fall: the splash, the inner face, the ends, the outer face, then the far sheet; each face
 *  wound to face out of the ribbon. */
export function fallTemplate(): { rib: Float32Array; index: Uint16Array } {
  const rib: number[] = [];
  const index: number[] = [];
  let n = 0;
  const vert = (u: number, w: number, inner: number, kind: number) => {
    rib.push(u, w, inner, kind);
    return n++;
  };
  const ws = (segments: number) => Array.from({ length: segments + 1 }, (_, s) => (s / segments) ** 2);
  // (u, w) to the world winds inward (tangent × down the arc), so a face out of the ribbon takes
  // its corners (0,0), (0,1), (1,0)
  const strip = (a: number[], b: number[], out: boolean) => {
    for (let s = 0; s + 1 < a.length; s++) {
      if (out) index.push(a[s], a[s + 1], b[s], b[s], a[s + 1], b[s + 1]);
      else index.push(a[s], b[s], a[s + 1], b[s], b[s + 1], a[s + 1]);
    }
  };
  // the splash, facing up
  const s00 = vert(0, 0, 0, 4);
  const s10 = vert(1, 0, 0, 4);
  const s01 = vert(0, 1, 0, 4);
  const s11 = vert(1, 1, 0, 4);
  index.push(s00, s01, s10, s10, s01, s11);
  const near = ws(FALL_SEGMENTS.near);
  // the inner face, facing the cliff
  strip(
    near.map((w) => vert(0, w, 1, 0)),
    near.map((w) => vert(1, w, 1, 0)),
    false,
  );
  // the ends: at u = 0 facing back along the lip, at u = 1 forward (outer edge × inner edge)
  strip(
    near.map((w) => vert(0, w, 0, 1)),
    near.map((w) => vert(0, w, 1, 1)),
    false,
  );
  strip(
    near.map((w) => vert(1, w, 0, 2)),
    near.map((w) => vert(1, w, 1, 2)),
    true,
  );
  // the outer face
  strip(
    near.map((w) => vert(0, w, 0, 0)),
    near.map((w) => vert(1, w, 0, 0)),
    true,
  );
  // the sheet from afar
  const far = ws(FALL_SEGMENTS.far);
  strip(
    far.map((w) => vert(0, w, 0, 3)),
    far.map((w) => vert(1, w, 0, 3)),
    true,
  );
  return { rib: new Float32Array(rib), index: new Uint16Array(index) };
}
