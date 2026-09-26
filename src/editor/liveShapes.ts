// Live shape tools (live editing): a hill, a plateau, a ridge, a canyon, a valley, an island, a lake
// or a resource area shows its real result while it is dragged, and letting go places it. A handle
// on a placed landform (move, resize, height) does the same. The worker plans the shape with the
// tools' own planners and builds its terrain with the build's own steps (previewShape), so what
// shows is what is placed; the page redraws only the tiles that change, and puts the ground back
// when the drag is cancelled. One request is in flight at a time; the newest waits and replaces
// any older one waiting.

import type { Remote } from "comlink";
import type { MapRenderer } from "../render3d";
import type { GeneratorApi } from "../worker/generator.worker";
import type { ShapePreview, ShapeRequest } from "../worker/session";
import type { Point } from "../core/features/schema";
import { cut, paste } from "./brushes";

type Rect = { x0: number; y0: number; x1: number; y1: number };

export interface ShapeHost {
  api: Remote<GeneratorApi>;
  renderer: MapRenderer;
  W: number;
  H: number;
  /** The shown heights (changed in place while the shape is dragged). */
  heights(): Uint8Array;
  /** What the shape says and covers (null: nothing to show). */
  show(p: ShapePreview | null): void;
}

export class ShapeDrag {
  private readonly base: Uint8Array;
  private shown: Rect | null = null;
  private busy = false;
  private next: ShapeRequest | null = null;
  private over = false;
  /** The last answer (what a release places). */
  preview: ShapePreview | null = null;

  constructor(private readonly host: ShapeHost) {
    this.base = host.heights().slice();
  }

  /** The shape changed: show its result as soon as the worker has it. */
  update(req: ShapeRequest): void {
    if (this.over) return;
    if (this.busy) {
      this.next = req;
      return;
    }
    void this.send(req);
  }

  private async send(req: ShapeRequest): Promise<void> {
    this.busy = true;
    let p: ShapePreview | null = null;
    try {
      p = await this.host.api.previewShape(req);
    } catch {
      p = null;
    }
    this.busy = false;
    if (this.over) return;
    if (p) this.apply(p);
    const n = this.next;
    this.next = null;
    if (n) void this.send(n);
  }

  private apply(p: ShapePreview): void {
    this.preview = p;
    const h = this.host;
    const heights = h.heights();
    const before = this.shown;
    if (before) paste(heights, cut(this.base, before, h.W), before, h.W);
    if (p.ok && p.rect && p.heights) paste(heights, p.heights, p.rect, h.W);
    this.shown = p.ok ? p.rect : null;
    const r = union(before, this.shown);
    if (r) h.renderer.updateTerrainRect(heights, r);
    h.show(p);
  }

  /** Put the ground back as it was (Esc, or a shape the worker refused). */
  cancel(): void {
    this.over = true;
    const h = this.host;
    if (this.shown) {
      paste(h.heights(), cut(this.base, this.shown, h.W), this.shown, h.W);
      h.renderer.updateTerrainRect(h.heights(), this.shown);
      h.renderer.refreshShadows();
    }
    this.shown = null;
    h.show(null);
  }

  /** The drag ended and the shape is being placed: the result stays on screen until the worker's
   *  map replaces it. */
  finish(): void {
    this.over = true;
    this.host.renderer.refreshShadows();
    this.host.show(null);
  }
}

function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** An ellipse inside a dragged rectangle of tiles (a hill, an island, a ridge, a lake: rounded
 *  shapes, so their steps run as natural contours). Its tiles are the ones whose middles lie in
 *  it, by the rasterizers' rule. */
export function ellipseOutline(r: Rect, n = 36): Point[] {
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  const rx = (r.x1 - r.x0 + 1) / 2;
  const ry = (r.y1 - r.y0 + 1) / 2;
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.push([Math.round((cx + rx * Math.cos(a)) * 100) / 100, Math.round((cy + ry * Math.sin(a)) * 100) / 100]);
  }
  return out;
}

/** A landform's outline moved by (dx, dy) tiles. */
export function moveOutline(outline: readonly Point[], dx: number, dy: number): Point[] {
  return outline.map(([x, y]) => [x + dx, y + dy]);
}

/** A landform's outline scaled so its bounding box becomes `to` (a resize handle). */
export function fitOutline(outline: readonly Point[], to: { x0: number; y0: number; x1: number; y1: number }): Point[] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const sx = x1 > x0 ? (to.x1 - to.x0) / (x1 - x0) : 1;
  const sy = y1 > y0 ? (to.y1 - to.y0) / (y1 - y0) : 1;
  return outline.map(([x, y]) => [Math.round((to.x0 + (x - x0) * sx) * 100) / 100, Math.round((to.y0 + (y - y0) * sy) * 100) / 100]);
}

/** An outline's bounding box. */
export function outlineBox(outline: readonly Point[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}
