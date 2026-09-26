// Terrain brushes (live editing; ROADMAP M10's brushes, brought forward): raise, lower, flatten,
// smooth and naturalize, painted in strokes. A stroke is one operation (`brush`, doc/ops.ts): the
// brush's settings and its dabs, each a point where the brush pressed once. This one piece of code
// applies a stroke in the build (step 6, in order with the sculpt edits) and on the page while the
// player paints, so the map on screen is the map the operation replays to, byte for byte.
//
// - Everything is integers: dab centres in quarter tiles, pressure in 1/1024 of a level, the
//   falloff from a table of squared distances. The same dabs give the same levels on every machine.
// - Raise, lower and flatten gather pressure under each dab (a smooth falloff, full at the centre,
//   nothing at the brush's edge); a tile moves one whole level for each level of pressure it has
//   gathered. The middle of the brush moves a tile a whole level the first time it passes over
//   it, so a click, or a quick sweep, always shows; holding the brush still keeps pressing. The
//   edge rule: the change a stroke makes never differs by more than one level between
//   neighbouring tiles, so a brush never makes a cliff of its own; its edge slopes down to the
//   ground round it in whole-level steps.
// - Smooth and naturalize work where the brush presses, a level at a time as pressure gathers:
//   smooth moves a tile toward the mean of its neighbours; naturalize wears cliffs into slopes and
//   breaks long straight edges (noise from the stroke's seed), as weather would.
// - Levels stay within 0–16 (the in-game editor's range; a higher imported tile is never raised).
// - Brushes shape each column's top (`layer: "top"`); the 3D stages extend them to the runs
//   below (caves), with the same dabs.

import { fmix32 } from "../../math/hash";

export type BrushTool = "raise" | "lower" | "flatten" | "smooth" | "naturalize";

export interface BrushParams {
  tool: BrushTool;
  /** Radius in tiles (0.5–24, in steps of 0.25). */
  size: number;
  /** How fast it works, 1–10: at 5 the middle of a raise moves a level every 6 dabs. */
  strength: number;
  /** Flatten: the level it flattens to. */
  level?: number;
  /** Naturalize: the seed of its noise. */
  seed?: number;
  /** The run of each column it shapes: the top (the surface). Runs below come with the 3D
   *  stages (caves and overhangs). */
  layer?: "top";
  /** Dab centres in quarter tiles: [x0, y0, x1, y1, …]; tile (x, y)'s middle is (4x + 2, 4y + 2). */
  dabs: number[];
}

export const BRUSH_TOOLS: readonly BrushTool[] = ["raise", "lower", "flatten", "smooth", "naturalize"];
export const BRUSH_MAX_LEVEL = 16;
export const BRUSH_SIZE_MIN = 0.5;
export const BRUSH_SIZE_MAX = 24;
/** Pressure for one level. */
export const LEVEL = 1024;
/** Most dabs one stroke may hold (a long stroke; the page starts a new one past it). */
export const MAX_DABS = 40_000;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Pressure a dab adds at the middle of the brush: strength 5 moves a level every 6 dabs. */
export function dabPressure(strength: number): number {
  return Math.floor((LEVEL * Math.max(1, Math.min(10, Math.round(strength)))) / 30);
}

/** The brush's radius in quarter tiles. */
function radius4(size: number): number {
  return Math.max(2, Math.min(96, Math.round(size * 4)));
}

/** Falloff by squared distance (in sixteenths of a tile²): 256 at the middle, 0 at the edge,
 *  (1 − d²/R²)² between. Integer arithmetic, exact everywhere. */
function falloffTable(r4: number): Uint16Array {
  const R2 = r4 * r4;
  const t = new Uint16Array(R2 + 1);
  for (let d2 = 0; d2 < R2; d2++) {
    const a = R2 - d2;
    t[d2] = Math.floor((a * a * 256) / (R2 * R2));
  }
  return t;
}

/** The tiles a stroke can change: its dabs' discs (plus the tiles next to them that smooth and
 *  naturalize read), on the map. Null for a stroke without dabs. */
export function brushBounds(p: Pick<BrushParams, "size" | "dabs" | "tool">, W: number, H: number): Rect | null {
  if (p.dabs.length < 2) return null;
  const r = Math.ceil(radius4(p.size) / 4) + (p.tool === "smooth" || p.tool === "naturalize" ? 1 : 0);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let k = 0; k + 1 < p.dabs.length; k += 2) {
    const x = Math.floor(p.dabs[k] / 4);
    const y = Math.floor(p.dabs[k + 1] / 4);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const out = { x0: Math.max(0, x0 - r), y0: Math.max(0, y0 - r), x1: Math.min(W - 1, x1 + r), y1: Math.min(H - 1, y1 + r) };
  return out.x0 <= out.x1 && out.y0 <= out.y1 ? out : null;
}

/** Whether a stroke reads its tiles' neighbours (smooth, naturalize): a rebuild that touches its
 *  tiles applies it over all of them. */
export function brushReadsNeighbours(p: Pick<BrushParams, "tool">): boolean {
  return p.tool === "smooth" || p.tool === "naturalize";
}

/** A stroke being applied to a heightfield, dab by dab. `heights` is changed in place; `write(i)`
 *  says which tiles it may change (the build's region, a column the brush leaves alone). The
 *  result after all dabs does not depend on how they were handed in. */
export class BrushStroke {
  readonly W: number;
  readonly H: number;
  private readonly heights: Uint8Array;
  private readonly settings: Omit<BrushParams, "dabs">;
  private readonly write: (i: number) => boolean;
  private readonly r4: number;
  private readonly table: Uint16Array;
  private readonly rate: number;
  /** Pressure gathered per tile, and the heights before the stroke (raise, lower, flatten). */
  private readonly acc: Int32Array;
  private readonly before: Uint8Array | null;
  /** Level steps each tile has had (naturalize's noise). */
  private readonly steps: Uint16Array | null;
  /** Tiles the middle of the brush has passed over (the first pass moves them a whole level). */
  private readonly swept: Uint8Array;
  private dabCount = 0;
  /** The tiles the stroke has pressed on so far. */
  private box: Rect | null = null;
  /** Work buffers for the edge rule. */
  private moved: Int16Array | null = null;

  constructor(settings: Omit<BrushParams, "dabs">, heights: Uint8Array, W: number, H: number, write: (i: number) => boolean = () => true) {
    this.W = W;
    this.H = H;
    this.heights = heights;
    this.settings = settings;
    this.write = write;
    this.r4 = radius4(settings.size);
    this.table = falloffTable(this.r4);
    this.rate = dabPressure(settings.strength);
    this.acc = new Int32Array(W * H);
    const pointwise = settings.tool === "raise" || settings.tool === "lower" || settings.tool === "flatten";
    this.before = pointwise ? heights.slice() : null;
    this.steps = settings.tool === "naturalize" ? new Uint16Array(W * H) : null;
    this.swept = new Uint8Array(W * H);
  }

  /** Dabs so far. */
  get dabs(): number {
    return this.dabCount;
  }

  /** The tiles pressed so far (null before the first dab). */
  get bounds(): Rect | null {
    return this.box;
  }

  /** Apply more dabs (quarter-tile pairs). Returns the rectangle whose tiles may have changed. */
  add(dabs: ArrayLike<number>): Rect | null {
    const { W, H, r4, table } = this;
    const R2 = r4 * r4;
    const r = Math.ceil(r4 / 4);
    const sequential = !this.before;
    let touched: Rect | null = null;
    for (let k = 0; k + 1 < dabs.length; k += 2) {
      const cx = dabs[k];
      const cy = dabs[k + 1];
      const tx = Math.floor(cx / 4);
      const ty = Math.floor(cy / 4);
      this.dabCount++;
      const x0 = Math.max(0, tx - r);
      const x1 = Math.min(W - 1, tx + r);
      const y0 = Math.max(0, ty - r);
      const y1 = Math.min(H - 1, ty + r);
      if (x0 > x1 || y0 > y1) continue;
      for (let y = y0; y <= y1; y++) {
        const dy = 4 * y + 2 - cy;
        for (let x = x0; x <= x1; x++) {
          const dx = 4 * x + 2 - cx;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R2) continue;
          const w = table[d2];
          if (!w) continue;
          const i = y * W + x;
          // the middle of the brush moves a tile a level the first time it passes over it: a
          // click, or a quick sweep, always shows
          let add: number;
          if (w >= 128 && !this.swept[i]) {
            this.swept[i] = 1;
            add = Math.max(LEVEL, Math.floor((this.rate * w) / 256));
          } else add = Math.floor((this.rate * w) / 256);
          if (!add) continue;
          this.acc[i] += add;
          if (sequential && this.acc[i] >= LEVEL) this.stepTile(i);
        }
      }
      touched = grow(touched, { x0, y0, x1, y1 });
      this.box = grow(this.box, { x0, y0, x1, y1 });
    }
    if (!touched) return null;
    if (sequential) return pad(touched, 1, W, H);
    // raise, lower and flatten: the whole stroke's change again, with its edge rule
    this.applyPointwise();
    return this.box;
  }

  /** Smooth and naturalize: a tile moves a level for each level of pressure it gathers, toward
   *  what its neighbours are now. */
  private stepTile(i: number): void {
    const { W, H, heights } = this;
    while (this.acc[i] >= LEVEL) {
      this.acc[i] -= LEVEL;
      if (!this.write(i)) continue;
      const x = i % W;
      const y = (i - x) / W;
      const h = heights[i];
      if (this.settings.tool === "smooth") {
        let sum = 0;
        let n = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++)
          for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) {
            sum += heights[yy * W + xx];
            n++;
          }
        // the neighbourhood's mean, rounded half up
        const target = Math.floor((2 * sum + n) / (2 * n));
        if (target > h && h < BRUSH_MAX_LEVEL) heights[i] = h + 1;
        else if (target < h) heights[i] = h - 1;
        continue;
      }
      // naturalize: wear cliffs into slopes, fill their feet, and wiggle long straight edges
      let lo = h;
      let hi = h;
      if (x > 0) ({ lo, hi } = mm(heights[i - 1], lo, hi));
      if (x < W - 1) ({ lo, hi } = mm(heights[i + 1], lo, hi));
      if (y > 0) ({ lo, hi } = mm(heights[i - W], lo, hi));
      if (y < H - 1) ({ lo, hi } = mm(heights[i + W], lo, hi));
      const step = this.steps![i]++;
      const n = fmix32((this.settings.seed ?? 0) ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(step + 1, 0x85ebca77)) & 1023;
      if (h - lo >= 2) heights[i] = h - 1;
      else if (hi - h >= 2 && h < BRUSH_MAX_LEVEL) heights[i] = h + 1;
      else if (h > lo && n < 200) heights[i] = h - 1;
      else if (h < hi && n >= 1024 - 200 && h < BRUSH_MAX_LEVEL) heights[i] = h + 1;
    }
  }

  /** Raise, lower, flatten: each tile's whole levels of pressure, limited by the edge rule (the
   *  change differs by at most one level between neighbours), applied to its height before the
   *  stroke. */
  private applyPointwise(): void {
    const b = this.box!;
    const { W, acc, heights } = this;
    const before = this.before!;
    const bw = b.x1 - b.x0 + 1;
    const bh = b.y1 - b.y0 + 1;
    const n = bw * bh;
    if (!this.moved || this.moved.length < n) this.moved = new Int16Array(Math.max(n, 256));
    const m = this.moved;
    for (let y = 0; y < bh; y++) {
      const row = (b.y0 + y) * W + b.x0;
      for (let x = 0; x < bw; x++) m[y * bw + x] = Math.min(BRUSH_MAX_LEVEL, Math.floor(acc[row + x] / LEVEL));
    }
    // the edge rule: a 4-neighbour distance transform from the ground round the stroke (0 outside)
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const k = y * bw + x;
        let v = m[k];
        const left = x > 0 ? m[k - 1] : 0;
        const up = y > 0 ? m[k - bw] : 0;
        if (left + 1 < v) v = left + 1;
        if (up + 1 < v) v = up + 1;
        m[k] = v;
      }
    for (let y = bh - 1; y >= 0; y--)
      for (let x = bw - 1; x >= 0; x--) {
        const k = y * bw + x;
        let v = m[k];
        const right = x < bw - 1 ? m[k + 1] : 0;
        const down = y < bh - 1 ? m[k + bw] : 0;
        if (right + 1 < v) v = right + 1;
        if (down + 1 < v) v = down + 1;
        m[k] = v;
      }
    const { tool, level } = this.settings;
    const L = Math.max(0, Math.min(BRUSH_MAX_LEVEL, level ?? 0));
    for (let y = 0; y < bh; y++) {
      const row = (b.y0 + y) * W + b.x0;
      for (let x = 0; x < bw; x++) {
        const i = row + x;
        if (!this.write(i)) continue;
        const h0 = before[i];
        const d = m[y * bw + x];
        let h = h0;
        if (tool === "raise") h = h0 >= BRUSH_MAX_LEVEL ? h0 : Math.min(BRUSH_MAX_LEVEL, h0 + d);
        else if (tool === "lower") h = Math.max(0, h0 - d);
        else h = h0 > L ? Math.max(L, h0 - d) : Math.min(L, h0 + d);
        heights[i] = h;
      }
    }
  }
}

function mm(v: number, lo: number, hi: number): { lo: number; hi: number } {
  return { lo: v < lo ? v : lo, hi: v > hi ? v : hi };
}

function grow(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

function pad(r: Rect, n: number, W: number, H: number): Rect {
  return { x0: Math.max(0, r.x0 - n), y0: Math.max(0, r.y0 - n), x1: Math.min(W - 1, r.x1 + n), y1: Math.min(H - 1, r.y1 + n) };
}

/** Apply a whole stroke to `heights` (the build's step 6). */
export function applyBrush(p: BrushParams, heights: Uint8Array, W: number, H: number, write: (i: number) => boolean = () => true): void {
  const { dabs, ...settings } = p;
  new BrushStroke(settings, heights, W, H, write).add(dabs);
}

/** Why a stroke's parameters are not a stroke this map can take (empty when they are). */
export function brushProblems(p: BrushParams, W: number, H: number): string[] {
  if (!BRUSH_TOOLS.includes(p.tool)) return [`there is no ${String(p.tool)} brush`];
  if (!(p.size >= BRUSH_SIZE_MIN && p.size <= BRUSH_SIZE_MAX)) return [`a brush is ${BRUSH_SIZE_MIN} to ${BRUSH_SIZE_MAX} tiles across its radius`];
  if (!(p.strength >= 1 && p.strength <= 10)) return ["a brush's strength is 1 to 10"];
  if (p.tool === "flatten" && !(Number.isInteger(p.level) && p.level! >= 0 && p.level! <= BRUSH_MAX_LEVEL)) return [`flatten needs a level from 0 to ${BRUSH_MAX_LEVEL}`];
  if (p.seed !== undefined && !Number.isInteger(p.seed)) return ["a brush's seed is a whole number"];
  if (p.dabs.length < 2 || p.dabs.length % 2) return ["a stroke needs its dabs, as pairs of numbers"];
  if (p.dabs.length > 2 * MAX_DABS) return [`a stroke holds at most ${MAX_DABS} dabs`];
  for (let k = 0; k < p.dabs.length; k += 2) {
    const x = p.dabs[k];
    const y = p.dabs[k + 1];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 4 * W || y >= 4 * H) return [`a dab at (${x / 4}, ${y / 4}) is outside the ${W}×${H} map`];
  }
  return [];
}
