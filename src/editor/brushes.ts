// The terrain brushes on the page (live editing): raise, lower, flatten, smooth and naturalize,
// painted straight onto the map. The page paints each dab on its own copy of the terrain as the
// build would (core/features/raster/strokePreview.ts) and redraws only what changed, so the ground
// moves under the cursor in the same frame; when the button comes up, the stroke goes to the
// worker as one operation (`brush`), which replays it byte for byte and brings the slopes, the
// plants and the water. The worker is never waited on while painting.
//
// Controls: left-drag paints; right- or middle-drag and the wheel move the camera; Shift inverts
// (raise ↔ lower); Ctrl+click picks flatten's level from the ground; [ and ] change the size;
// Shift+wheel the strength; 1–5 pick a brush; Esc cancels a stroke in progress.

import type { MapRenderer, PointerTool } from "../render3d";
import type { BrushParams, BrushTool } from "../core/features/raster/brush";
import { StrokePreview, type TerrainState } from "../core/features/raster/strokePreview";

export type { BrushTool };

export interface BrushSettings {
  tool: BrushTool;
  /** Radius in tiles. */
  size: number;
  /** 1–10. */
  strength: number;
  /** Flatten's level: picked with Ctrl+click, else the ground where a stroke starts. */
  level: number | null;
}

export const DEFAULT_BRUSH: BrushSettings = { tool: "raise", size: 5, strength: 5, level: null };

export const BRUSHES: { tool: BrushTool; name: string; key: string; hint: string }[] = [
  { tool: "raise", name: "Raise", key: "1", hint: "Raise the ground. Hold still to raise it more." },
  { tool: "lower", name: "Lower", key: "2", hint: "Lower the ground. Hold still to dig deeper." },
  { tool: "flatten", name: "Flatten", key: "3", hint: "Flatten to one level: the ground where you start, or Ctrl+click to pick a level." },
  { tool: "smooth", name: "Smooth", key: "4", hint: "Smooth steps and bumps toward the ground round them." },
  { tool: "naturalize", name: "Naturalize", key: "5", hint: "Wear cliffs into slopes and break straight edges, as weather would." },
];

export const BRUSH_NAMES: Record<BrushTool, string> = { raise: "Raise", lower: "Lower", flatten: "Flatten", smooth: "Smooth", naturalize: "Naturalize" };

export const SIZE_MIN = 1;
export const SIZE_MAX = 24;

/** Brush sizes the [ and ] keys step through. */
const SIZES = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 21, 24];

export function nextSize(size: number, dir: 1 | -1): number {
  if (dir > 0) return SIZES.find((s) => s > size + 1e-9) ?? SIZE_MAX;
  return [...SIZES].reverse().find((s) => s < size - 1e-9) ?? SIZE_MIN;
}

/** A finished stroke: its operation, its history label, and the terrain before and after it (the
 *  page undoes and redoes a stroke at once, without waiting for the worker). */
export interface Stroke {
  params: BrushParams;
  label: string;
  rect: { x0: number; y0: number; x1: number; y1: number };
  before: { shown: Uint8Array; pre: Uint8Array };
  after: { shown: Uint8Array; pre: Uint8Array };
}

export interface PainterHost {
  renderer: MapRenderer;
  W: number;
  H: number;
  /** The shown heights (changed in place while painting), and the terrain the build starts from. */
  heights(): Uint8Array;
  terrain(): TerrainState;
  settings(): BrushSettings;
  /** A stroke ended with changes: send it (the host updates its terrain to `pre`). */
  commit(stroke: Stroke, pre: Uint8Array): void;
  /** Ctrl+click on flatten: the level picked. */
  picked(level: number): void;
  /** Shift+wheel: a new strength (the page shows it beside the pointer while it changes). */
  strength(value: number, ev?: WheelEvent): void;
  /** A stroke started or ended (the water waits while painting, when asked). */
  painting(on: boolean): void;
  /** Words beside the pointer (flatten's level: "level 7"), or null. */
  note?(text: string | null, ev: PointerEvent | null): void;
  /** Whether water stands on the tile. */
  wet?(x: number, y: number): boolean;
  /** The stroke's ground so far, a rectangle of the shown heights at a time: the water flows on it
   *  while painting (D197). */
  draft?(rect: { x0: number; y0: number; x1: number; y1: number }, heights: Uint8Array): void;
  /** The stroke was taken back: its water goes. */
  cancelDraft?(): void;
}

/** Quarter tiles, for a dab's centre on a map `size` tiles across. */
const q = (v: number, size: number) => Math.max(0, Math.min(4 * size - 1, Math.round(v * 4)));

/** Paints strokes with the brushes: the renderer's pointer tool while a brush is out. */
export class BrushPainter {
  /** The stroke being painted: where the cursor is (`last`), where the last dab was (`dabAt`). */
  private stroke: { preview: StrokePreview; settings: Omit<BrushParams, "dabs">; dabs: number[]; level: number; plane: number; last: [number, number]; dabAt: [number, number]; lastDab: number; raf: number; drafted: { x0: number; y0: number; x1: number; y1: number } | null; draftAt: number } | null = null;
  private cursorAt: [number, number] | null = null;
  /** A left-drag that began off the map: it paints from where it first reaches the map. */
  private waiting = false;
  readonly tool: PointerTool;

  constructor(private readonly host: PainterHost) {
    const self = this;
    this.tool = {
      // with a brush out the left button paints and never turns the camera, even when the drag
      // starts off the map
      down(hit, ev) {
        if (ev.button !== 0) return false;
        if (!hit) {
          self.waiting = true;
          return true;
        }
        if ((ev.ctrlKey || ev.metaKey) && host.settings().tool === "flatten") {
          host.picked(host.renderer.heightAt(hit.x, hit.y));
          self.showCursor();
          return true;
        }
        self.begin(hit.x + 0.5, hit.y + 0.5, ev);
        return true;
      },
      move(hit, ev) {
        if (self.waiting) {
          if (!hit) return;
          self.waiting = false;
          self.begin(hit.x + 0.5, hit.y + 0.5, ev);
          return;
        }
        self.moveTo(ev);
      },
      up() {
        self.waiting = false;
        self.end();
      },
      cancel() {
        self.waiting = false;
        self.cancel();
      },
      hover(hit, ev) {
        if (!hit) {
          self.cursorAt = null;
          host.renderer.setBrushCursor(null);
          host.note?.(null, null);
          return;
        }
        // flatten says its level beside the pointer (the only words the tools show, D184); with
        // Ctrl, the level a click picks (on water, its bed: the ground under it)
        if (host.settings().tool === "flatten") {
          const s = host.settings();
          const here = host.renderer.heightAt(hit.x, hit.y);
          const picking = ev.ctrlKey || ev.metaKey;
          const level = picking || s.level === undefined ? here : s.level;
          host.note?.(`level ${level}`, ev);
        } else host.note?.(null, null);
        const p = host.renderer.pickAtLevel(ev.clientX, ev.clientY, host.renderer.heightAt(hit.x, hit.y));
        self.cursorAt = p ? [p.point[0], -p.point[2]] : [hit.x + 0.5, hit.y + 0.5];
        self.showCursor();
      },
      // Shift+scroll: the strength (D196, as the game; browsers turn a Shift+wheel sideways)
      wheel(ev) {
        if (!ev.shiftKey) return false;
        const s = host.settings();
        host.strength(Math.max(1, Math.min(10, s.strength + ((ev.deltaY || ev.deltaX) < 0 ? 1 : -1))), ev);
        return true;
      },
    };
  }

  get painting(): boolean {
    return this.stroke !== null;
  }

  /** Redraw the brush under the cursor (after a change of size, tool or level). */
  showCursor(): void {
    const at = this.stroke ? this.stroke.last : this.cursorAt;
    if (!at) return;
    const s = this.host.settings();
    const tool = this.stroke ? (this.stroke.settings.tool as BrushTool) : s.tool;
    const level = tool === "flatten" ? (this.stroke ? this.stroke.level : (s.level ?? this.host.renderer.heightAt(Math.floor(at[0]), Math.floor(at[1])))) : null;
    // smart Lower: blue where a stroke would carve a bed the water follows
    const water = this.stroke ? !!this.stroke.settings.channel : tool === "lower" && this.byWater(at[0], at[1]);
    this.host.renderer.setBrushCursor({ x: at[0], y: at[1], radius: s.size, tool, level, water });
  }

  /** Whether water stands on the tile at (x, y) or beside it. */
  private byWater(x: number, y: number): boolean {
    const wet = this.host.wet;
    if (!wet) return false;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && ny >= 0 && nx < this.host.W && ny < this.host.H && wet(nx, ny)) return true;
      }
    return false;
  }

  hideCursor(): void {
    this.cursorAt = null;
    this.host.renderer.setBrushCursor(null);
  }

  private begin(x: number, y: number, ev: PointerEvent): void {
    const h = this.host;
    const s = h.settings();
    let tool = s.tool;
    // Shift inverts: raise ↔ lower
    if (ev.shiftKey && (tool === "raise" || tool === "lower")) tool = tool === "raise" ? "lower" : "raise";
    const level = s.level ?? h.renderer.heightAt(Math.floor(x), Math.floor(y));
    const settings: Omit<BrushParams, "dabs"> = {
      tool,
      size: s.size,
      strength: s.strength,
      ...(tool === "flatten" ? { level } : {}),
      ...(tool === "naturalize" ? { seed: (Math.random() * 0x7fffffff) | 0 } : {}),
      // smart Lower (D184): a stroke that starts in or beside water carves a bed it follows
      ...(tool === "lower" && this.byWater(x, y) ? { channel: true } : {}),
    };
    const preview = new StrokePreview(settings, h.terrain(), h.heights(), h.W, h.H);
    // the stroke follows the cursor on the level it started on, so the brush stays under the
    // pointer while the ground rises or sinks beneath it
    const plane = tool === "flatten" ? level : h.renderer.heightAt(Math.floor(x), Math.floor(y));
    const p = h.renderer.pickAtLevel(ev.clientX, ev.clientY, plane);
    const at: [number, number] = p ? [p.point[0], -p.point[2]] : [x, y];
    this.stroke = { preview, settings, dabs: [], level, plane, last: at, dabAt: at, lastDab: performance.now(), raf: 0, drafted: null, draftAt: 0 };
    h.painting(true);
    this.dab([at]);
    this.loop();
  }

  /** The pointer moved while painting: dabs along the way, a fifth of the brush apart. */
  private moveTo(ev: PointerEvent): void {
    const st = this.stroke;
    if (!st) return;
    const events = typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : [];
    const list = events.length ? events : [ev];
    const spacing = Math.max(0.25, Math.min(2, this.host.settings().size * 0.2));
    const points: [number, number][] = [];
    let [lx, ly] = st.dabAt;
    for (const e of list) {
      const p = this.host.renderer.pickAtLevel(e.clientX, e.clientY, st.plane);
      if (!p) continue;
      const x = Math.max(0, Math.min(this.host.W - 0.01, p.point[0]));
      const y = Math.max(0, Math.min(this.host.H - 0.01, -p.point[2]));
      st.last = [x, y];
      const d = Math.hypot(x - lx, y - ly);
      if (d < spacing) continue;
      const n = Math.floor(d / spacing);
      for (let k = 1; k <= n; k++) points.push([lx + ((x - lx) * k * spacing) / d, ly + ((y - ly) * k * spacing) / d]);
      lx = points[points.length - 1][0];
      ly = points[points.length - 1][1];
    }
    if (points.length) this.dab(points);
    else this.showCursor();
  }

  /** Press the brush at these points: the ground changes in this frame. */
  private dab(points: [number, number][]): void {
    const st = this.stroke!;
    const h = this.host;
    const add: number[] = [];
    for (const [x, y] of points) add.push(q(x, h.W), q(y, h.H));
    st.dabs.push(...add);
    st.lastDab = performance.now();
    st.dabAt = points[points.length - 1];
    const r = st.preview.add(add);
    if (r) {
      h.renderer.updateTerrainRect(h.heights(), r);
      const d = st.drafted;
      st.drafted = d ? { x0: Math.min(d.x0, r.x0), y0: Math.min(d.y0, r.y0), x1: Math.max(d.x1, r.x1), y1: Math.max(d.y1, r.y1) } : { ...r };
      this.sendDraft(false);
    }
    this.showCursor();
  }

  /** The ground the stroke changed since the last time, to the water (D197): at once for the first
   *  change, then at most once a frame. */
  private sendDraft(force: boolean): void {
    const st = this.stroke;
    const h = this.host;
    if (!st || !st.drafted || !h.draft) return;
    const now = performance.now();
    if (!force && st.draftAt && now - st.draftAt < 1000 / 60) return;
    st.draftAt = now;
    const r = st.drafted;
    st.drafted = null;
    h.draft(r, cut(h.heights(), r, h.W));
  }

  /** Holding still keeps pressing, thirty times a second. */
  private loop(): void {
    const st = this.stroke;
    if (!st) return;
    st.raf = requestAnimationFrame(() => {
      if (this.stroke !== st) return;
      if (performance.now() - st.lastDab >= 1000 / 30) this.dab([st.last]);
      this.sendDraft(false);
      this.loop();
    });
  }

  /** The button came up: the stroke becomes one operation. */
  end(): void {
    const st = this.stroke;
    if (!st) return;
    cancelAnimationFrame(st.raf);
    this.stroke = null;
    const h = this.host;
    h.painting(false);
    h.renderer.refreshShadows();
    const tiles = st.preview.changed();
    if (!tiles) return;
    const b = st.preview.bounds!;
    const rect = { x0: Math.max(0, b.x0 - 1), y0: Math.max(0, b.y0 - 1), x1: Math.min(h.W - 1, b.x1 + 1), y1: Math.min(h.H - 1, b.y1 + 1) };
    const before = h.terrain();
    const shown = h.heights();
    const stroke: Stroke = {
      params: { ...st.settings, dabs: st.dabs },
      label: `${BRUSH_NAMES[st.settings.tool as BrushTool]}, ${tiles} tile${tiles === 1 ? "" : "s"}`,
      rect,
      before: { shown: cut(st.preview.start, rect, h.W), pre: cut(before.pre, rect, h.W) },
      after: { shown: cut(shown, rect, h.W), pre: cut(st.preview.pre, rect, h.W) },
    };
    h.commit(stroke, st.preview.pre);
  }

  /** Esc: the stroke never happened. */
  cancel(): void {
    const st = this.stroke;
    if (!st) return;
    cancelAnimationFrame(st.raf);
    this.stroke = null;
    const r = st.preview.restore();
    if (r) this.host.renderer.updateTerrainRect(this.host.heights(), r);
    this.host.renderer.refreshShadows();
    this.host.cancelDraft?.();
    this.host.painting(false);
    this.showCursor();
  }
}


/** A rectangle's bytes out of a W-wide map. */
export function cut(a: Uint8Array, r: { x0: number; y0: number; x1: number; y1: number }, W: number): Uint8Array {
  const w = r.x1 - r.x0 + 1;
  const out = new Uint8Array(w * (r.y1 - r.y0 + 1));
  for (let y = r.y0; y <= r.y1; y++) out.set(a.subarray(y * W + r.x0, y * W + r.x1 + 1), (y - r.y0) * w);
  return out;
}

/** Put a rectangle's bytes back into a W-wide map. */
export function paste(a: Uint8Array, part: Uint8Array, r: { x0: number; y0: number; x1: number; y1: number }, W: number): void {
  const w = r.x1 - r.x0 + 1;
  for (let y = r.y0; y <= r.y1; y++) a.set(part.subarray((y - r.y0) * w, (y - r.y0 + 1) * w), y * W + r.x0);
}
