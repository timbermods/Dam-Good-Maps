// Live editing: terrain brushes (raise, lower, flatten, smooth, naturalize) painted in strokes.
// Blocking, breakage (Kyler's brief): a stroke's operation replays to identical bytes; what the page
// paints under the cursor is exactly what the operation builds; undo and redo are always correct,
// and an incremental rebuild equals a full one; a stroke survives "Generate, keeping my edits" and
// the project file.

import { describe, expect, it } from "vitest";
import { decodeProject } from "../../src/core/doc/document";
import type { EditOp } from "../../src/core/doc/ops";
import { MapSession } from "../../src/core/doc/session";
import { applyBrush, BrushStroke, type BrushParams, type BrushTool } from "../../src/core/features/raster/brush";
import { StrokePreview } from "../../src/core/features/raster/strokePreview";
import { writeTimber } from "../../src/core/format/timber";
import { generate } from "../../src/core/gen/generate";
import { makeSpec, type ThemeId } from "../../src/core/spec/mapspec";
import { mulberry } from "./brushRandom";

const TOOLS: BrushTool[] = ["raise", "lower", "flatten", "smooth", "naturalize"];

/** A random stroke on a W × H map: a wandering path of dabs away from the start. */
function randomStroke(rand: () => number, W: number, H: number, tool: BrushTool, avoid: { x: number; y: number } | null): BrushParams {
  const size = [1, 2, 3.5, 6, 9][Math.floor(rand() * 5)];
  let x = 12 + rand() * (W - 24);
  let y = 12 + rand() * (H - 24);
  if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < 18) {
    x = (x + W / 2) % (W - 12);
    y = (y + H / 2) % (H - 12);
  }
  const dabs: number[] = [];
  const n = 1 + Math.floor(rand() * 60);
  for (let k = 0; k < n; k++) {
    x = Math.min(W - 1, Math.max(0, x + (rand() - 0.5) * 3));
    y = Math.min(H - 1, Math.max(0, y + (rand() - 0.5) * 3));
    dabs.push(Math.min(4 * W - 1, Math.round(x * 4)), Math.min(4 * H - 1, Math.round(y * 4)));
  }
  return { tool, size, strength: 1 + Math.floor(rand() * 10), ...(tool === "flatten" ? { level: Math.floor(rand() * 17) } : {}), ...(tool === "naturalize" ? { seed: Math.floor(rand() * 1e6) } : {}), dabs };
}

describe("a brush stroke is exact", () => {
  it("the same dabs give the same levels however they are handed in, and a click always shows", () => {
    const W = 40;
    const H = 30;
    const rand = mulberry(7);
    const ground = new Uint8Array(W * H);
    for (let i = 0; i < ground.length; i++) ground[i] = 3 + Math.floor(rand() * 6);
    for (const tool of TOOLS) {
      const p = randomStroke(rand, W, H, tool, null);
      const whole = ground.slice();
      applyBrush(p, whole, W, H);
      // in chunks, as the page hands them in frame by frame
      const chunked = ground.slice();
      const { dabs, ...settings } = p;
      const s = new BrushStroke(settings, chunked, W, H);
      for (let k = 0; k < dabs.length; ) {
        const n = 2 * (1 + Math.floor(rand() * 4));
        s.add(dabs.slice(k, k + n));
        k += n;
      }
      expect(Array.from(chunked), tool).toEqual(Array.from(whole));
    }
    // one click of a raise brush lifts the middle of the brush a level
    const flat = new Uint8Array(W * H).fill(5);
    applyBrush({ tool: "raise", size: 3, strength: 1, dabs: [4 * 20 + 2, 4 * 15 + 2] }, flat, W, H);
    expect(flat[15 * W + 20]).toBe(6);
    expect(flat[15 * W + 30]).toBe(5);
  });

  it("a brush never makes a cliff of its own: its change steps down one level at a time", () => {
    const W = 48;
    const H = 48;
    const flat = new Uint8Array(W * H).fill(2);
    const dabs: number[] = [];
    for (let k = 0; k < 400; k++) dabs.push(4 * 24 + 2, 4 * 24 + 2);
    applyBrush({ tool: "raise", size: 4, strength: 10, dabs }, flat, W, H);
    // pressed long in one place: a peak as high as its brush lets it slope, one level a tile
    expect(flat[24 * W + 24]).toBeGreaterThanOrEqual(6);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        for (const j of [i - 1, i + 1, i - W, i + W]) expect(Math.abs(flat[i] - flat[j])).toBeLessThanOrEqual(1);
      }
  });

  it.each([
    ["riverValley", 96, 3],
    ["islands", 96, 5],
  ] as [ThemeId, number, number][])("%s %i²: what the page paints is what the operation builds, byte for byte, and replays to the same file", (theme, size, seed) => {
    const r = generate(makeSpec({ seed, theme, size: { x: size, y: size } }));
    const s = MapSession.fromGenerated(r, r.file);
    s.setWaterMode("defer");
    const rand = mulberry(seed * 31);
    const W = size;
    for (let k = 0; k < 10; k++) {
      const tool = TOOLS[k % TOOLS.length];
      const p = randomStroke(rand, W, W, tool, s.built.start ?? null);
      // the page: its copy of the terrain, painted dab by dab
      const shown = s.built.heights.slice();
      const { dabs, ...settings } = p;
      const preview = new StrokePreview(settings, s.terrainState(), shown, W, W);
      for (let j = 0; j < dabs.length; j += 6) preview.add(dabs.slice(j, j + 6));
      // the worker: the operation
      const u = s.apply({ op: "brush", params: p }, "user", "stroke");
      expect(u.errors).toEqual([]);
      expect(Array.from(shown), `${tool} stroke ${k}`).toEqual(Array.from(s.built.heights));
      expect(Array.from(preview.pre)).toEqual(Array.from(s.terrainState().pre));
    }
    // the log replays to the same map: a full build, and the project file opened again
    const full = s.fullBuild();
    expect(Array.from(full.heights)).toEqual(Array.from(s.built.heights));
    const again = MapSession.open(decodeProject(s.project()));
    expect(Array.from(again.built.heights)).toEqual(Array.from(s.built.heights));
    s.settleCanonical();
    expect(Buffer.from(s.exportTimber().bytes).equals(Buffer.from(again.exportTimber().bytes))).toBe(true);
  });
});

describe("undo and redo of strokes", () => {
  it("random strokes, undone and redone: undo all gives back the map exactly, and each state equals a full build", () => {
    const r = generate(makeSpec({ seed: 13, size: { x: 96, y: 96 } }));
    const s = MapSession.fromGenerated(r, r.file);
    s.setWaterMode("defer");
    const W = 96;
    const rand = mulberry(99);
    const start = { heights: Array.from(s.built.heights), entities: s.built.entities.map((e) => `${e.id}@${e.x},${e.y},${e.z}`) };
    const ops: EditOp[] = [];
    for (let k = 0; k < 14; k++) ops.push({ op: "brush", params: randomStroke(rand, W, W, TOOLS[Math.floor(rand() * TOOLS.length)], s.built.start ?? null) });
    const states: number[][] = [];
    for (const op of ops) {
      expect(s.apply(op).ok).toBe(true);
      states.push(Array.from(s.built.heights));
    }
    // back and forth at random, checking against a full build now and then
    let at = ops.length;
    for (let k = 0; k < 30; k++) {
      if (rand() < 0.55 && at > 0) {
        s.undo();
        at--;
      } else if (at < ops.length) {
        s.redo();
        at++;
      }
      expect(Array.from(s.built.heights)).toEqual(at ? states[at - 1] : start.heights);
      if (k % 7 === 0) expect(Array.from(s.fullBuild().heights)).toEqual(Array.from(s.built.heights));
    }
    while (s.undo()) at--;
    expect(Array.from(s.built.heights)).toEqual(start.heights);
    expect(s.built.entities.map((e) => `${e.id}@${e.x},${e.y},${e.z}`)).toEqual(start.entities);
    const cleanFile = writeTimber(s.exportFile(s.fullBuild()));
    expect(Buffer.from(cleanFile).equals(Buffer.from(r.bytes))).toBe(true);
  });
});

describe("strokes survive regenerating and the project file", () => {
  it("Generate, keeping my edits: the stroke is applied to the new map", () => {
    const r = generate(makeSpec({ seed: 21, size: { x: 96, y: 96 } }));
    const s = MapSession.fromGenerated(r, r.file);
    const dabs: number[] = [];
    for (let k = 0; k < 30; k++) dabs.push(4 * 70 + 2, 4 * 20 + 2 + Math.round((4 * k) / 3));
    const stroke: BrushParams = { tool: "raise", size: 4, strength: 6, dabs };
    expect(s.apply({ op: "brush", params: stroke }, "user", "Raise, 40 tiles").ok).toBe(true);
    const g = s.regenerate({ designedFor: "hard", settings: makeSpec({ seed: 21, size: { x: 96, y: 96 }, designedFor: "hard" }).settings });
    expect(g.ok).toBe(true);
    expect(s.orphans()).toEqual([]);
    expect(s.history().map((h) => h.label)).toEqual(["Raise, 40 tiles", "Change settings and regenerate"]);
    const op = s.document.edits.find((e) => e.op === "brush");
    expect(op?.params).toEqual(stroke);
    // the new map with the stroke is a full build of the new generation and the stroke
    expect(Array.from(s.fullBuild().heights)).toEqual(Array.from(s.built.heights));
    // and the project file keeps it
    const again = MapSession.open(decodeProject(s.project()));
    expect(Array.from(again.built.heights)).toEqual(Array.from(s.built.heights));
  });
});
