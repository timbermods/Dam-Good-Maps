// The start requirements (PLAN §5.6, §11.4; D85, Kyler 2026-09-24): a unit test for each. On a
// small made-up map the validator's playability checks run on water given directly (no settle), so
// each case changes one thing: where the water is, what it is, how the start walks to it, and how
// many living trees and berry bushes stand within 20 tiles' walk.
//
//   1. Water without stairs: clean water a pump reaches touches a shore tile on the start's own
//      level, within the rule's walk of the start and without any slope.
//   2. Starting trees: living trees within 20 tiles' walk (slopes allowed) ≥ Minimum starting trees.
//   3. Starting bushes: living berry bushes within 20 tiles' walk ≥ Minimum starting bushes.

import { describe, expect, it } from "vitest";
import { walkDistance } from "../../src/core/analysis/walk";
import type { Orientation } from "../../src/core/format/footprints";
import { moisture } from "../../src/core/sim/moisture";
import { waterModel, type MapObject } from "../../src/core/sim/model";
import type { CanonicalWater } from "../../src/core/sim/prefill";
import { DIFFICULTY_RULES, makeSpec } from "../../src/core/spec/mapspec";
import { checkPlayability, rulesFor, type Rules } from "../../src/core/validate/playability";
import { Collector, type CheckResult } from "../../src/core/validate/report";

const W = 48;
const H = 48;
const N = W * H;
const START = { x: 12, y: 24 };

interface Scene {
  heights: Uint8Array;
  depth: Float64Array;
  contamination: Float64Array;
  objects: MapObject[];
}

/** Level 5 ground; the start's 3×3 at (11–13, 23–25); a river 3 wide at x = 34–36, its bed one
 *  level below the bank (4) and its water 0.6 deep, so a pump on the bank reaches it. The shore
 *  tile x = 33 is 20 tiles' walk from the start's 3×3. */
function scene(): Scene {
  const heights = new Uint8Array(N).fill(5);
  const depth = new Float64Array(N);
  const contamination = new Float64Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 34; x <= 36; x++) {
      heights[y * W + x] = 4;
      depth[y * W + x] = 0.6;
    }
  const objects: MapObject[] = [obj("StartingLocation", START.x - 1, START.y - 1, 5)];
  return { heights, depth, contamination, objects };
}

function obj(template: string, x: number, y: number, z: number, orientation: Orientation = "Cw0", components: Record<string, unknown> = {}): MapObject {
  return { template, x, y, z, orientation, flipped: false, components: components as MapObject["components"] };
}

function plant(s: Scene, template: "Pine" | "BlueberryBush", tiles: [number, number][], dead = false): void {
  for (const [x, y] of tiles) s.objects.push(obj(template, x, y, s.heights[y * W + x], "Cw0", dead ? { LivingNaturalResource: { IsDead: true } } : {}));
}

/** The moist, dry-footed tiles of a scene (where living plants survive). */
function moist(s: Scene): Uint8Array {
  const M = moisture(s.heights, s.depth, s.contamination, W, H, null);
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = M[i] > 0 && !(s.depth[i] > 0) ? 1 : 0;
  return out;
}

/** `n` tiles that are moist, reachable within `lo`–`hi` tiles' walk of the start (slopes allowed),
 *  and off the start, in index order. */
function spots(s: Scene, n: number, lo: number, hi: number, taken = new Set<number>()): [number, number][] {
  const m = moist(s);
  const d = walkDistance(s.heights, W, H, null, slopeLinks(s), START, 200);
  const out: [number, number][] = [];
  for (let i = 0; i < N && out.length < n; i++) {
    const x = i % W;
    const y = (i - x) / W;
    if (!m[i] || taken.has(i) || d[i] < lo || d[i] > hi || (Math.abs(x - START.x) <= 1 && Math.abs(y - START.y) <= 1)) continue;
    taken.add(i);
    out.push([x, y]);
  }
  expect(out.length, "enough places to plant").toBe(n);
  return out;
}

function slopeLinks(s: Scene): [number, number][] {
  const out: [number, number][] = [];
  for (const o of s.objects) if (o.template === "Slope" && o.orientation === "Cw90") out.push([o.y * W + o.x, o.y * W + o.x - 1]);
  return out;
}

function check(s: Scene, rules: Partial<Rules> = {}): Record<string, CheckResult> {
  const base = rulesFor(null, "normal");
  const c = new Collector("generate");
  const model = waterModel(W, H, s.heights, s.objects);
  const water: CanonicalWater = { settled: true, ticks: 0, depth: s.depth, contamination: s.contamination, sat: new Uint8Array(N) };
  checkPlayability({ W, H, surface: s.heights, objects: s.objects, model, water, rules: { ...base, ...rules }, features: null }, c);
  return Object.fromEntries(c.checks.map((r) => [r.id, r]));
}

/** A scene that meets all three requirements at Normal: 45 living trees and 35 living bushes
 *  within 20 tiles' walk. */
function good(): Scene {
  const s = scene();
  const taken = new Set<number>();
  plant(s, "Pine", spots(s, 45, 2, 18, taken));
  plant(s, "BlueberryBush", spots(s, 35, 2, 18, taken));
  return s;
}

describe("the three start requirements (PLAN §5.6, D85)", () => {
  it("Normal's defaults are 20 tiles' walk, 40 trees and 30 bushes; Easy 12, 60, 40; Hard 28, 20, 20", () => {
    const r = (d: "easy" | "normal" | "hard") => DIFFICULTY_RULES[d];
    expect([r("easy").waterWithin, r("easy").treesWithin20, r("easy").bushesWithin20]).toEqual([12, 60, 40]);
    expect([r("normal").waterWithin, r("normal").treesWithin20, r("normal").bushesWithin20]).toEqual([20, 40, 30]);
    expect([r("hard").waterWithin, r("hard").treesWithin20, r("hard").bushesWithin20]).toEqual([28, 20, 20]);
    // an imported map uses its difficulty's defaults; a generated one its settings
    expect(rulesFor(null, "hard").waterWithin).toBe(28);
    const spec = makeSpec({ seed: 1, designedFor: "easy" });
    spec.settings.start.rules.waterWithin = 33;
    expect(rulesFor(spec).waterWithin).toBe(33);
  });

  it("a map that meets all three passes, and the other start rules are only targets", () => {
    const c = check(good());
    expect(c["start.water"].ok).toBe(true);
    expect(c["start.water"].value).toBe(20);
    expect(c["start.wood"].ok).toBe(true);
    expect(c["start.wood"].value).toBe(45);
    expect(c["start.food"].ok).toBe(true);
    expect(c["start.food"].value).toBe(35);
    for (const id of ["start.badwater", "start.reach", "start.ruins_clear", "water.reservoir"]) expect(c[id].advisory, id).toBe(true);
    expect(c["start.reach_water"]).toBeUndefined();
  });

  it("water beyond the walking distance fails, and the water setting moves the result", () => {
    const s = good();
    expect(check(s, { waterWithin: 19 })["start.water"].ok).toBe(false);
    expect(check(s, { waterWithin: 20 })["start.water"].ok).toBe(true);
    // a wall on the way: the walk goes round it, farther than the straight line
    for (let y = 10; y <= 38; y++) s.heights[y * W + 25] = 9;
    const c = check(s, { waterWithin: 20 });
    expect(c["start.water"].ok).toBe(false);
    expect(Number(c["start.water"].value)).toBeGreaterThan(20);
    expect(check(s, { waterWithin: 40 })["start.water"].ok).toBe(true);
  });

  it("water reached only by a slope fails: the shore is on another level", () => {
    const s = good();
    // the start's side rises one level; the bank below it is reached by a slope
    for (let y = 0; y < H; y++) for (let x = 0; x <= 29; x++) s.heights[y * W + x] = 6;
    s.objects = s.objects.map((o) => (o.x <= 29 ? { ...o, z: 6 } : o));
    s.objects.push(obj("Slope", 30, 24, 5, "Cw90"));
    const c = check(s, { waterWithin: 40 });
    // a pump on the start's level would reach the water (0–2 levels below), but not without stairs
    expect(c["start.water"].ok).toBe(false);
    expect(c["start.water"].value).toBe("none");
  });

  it("only badwater fails", () => {
    const s = good();
    for (let i = 0; i < N; i++) if (s.depth[i] > 0) s.contamination[i] = 1;
    const c = check(s);
    expect(c["start.water"].ok).toBe(false);
    expect(c["start.water"].value).toBe("none");
  });

  it("water too shallow to pump, or out of a pump's reach, fails", () => {
    const shallow = good();
    for (let i = 0; i < N; i++) if (shallow.depth[i] > 0) shallow.depth[i] = 0.2;
    expect(check(shallow)["start.water"].ok).toBe(false);
    const deep = good();
    for (let y = 0; y < H; y++) for (let x = 34; x <= 36; x++) deep.heights[y * W + x] = 1; // surface 1.6, 3.4 below
    expect(check(deep)["start.water"].ok).toBe(false);
  });

  it("trees below the minimum fail, and Minimum starting trees moves the result", () => {
    const s = scene();
    const taken = new Set<number>();
    plant(s, "Pine", spots(s, 39, 2, 18, taken));
    plant(s, "BlueberryBush", spots(s, 35, 2, 18, taken));
    expect(check(s)["start.wood"].ok).toBe(false);
    expect(check(s, { treesWithin20: 39 })["start.wood"].ok).toBe(true);
    expect(check(good(), { treesWithin20: 46 })["start.wood"].ok).toBe(false);
  });

  it("trees too far away, dead trees, and trees on soil that kills them do not count", () => {
    const s = scene();
    const taken = new Set<number>();
    plant(s, "BlueberryBush", spots(s, 35, 2, 18, taken));
    plant(s, "Pine", spots(s, 30, 2, 18, taken));
    plant(s, "Pine", spots(s, 20, 21.5, 40, taken)); // beyond 20 tiles' walk
    plant(s, "Pine", spots(s, 20, 2, 18, taken), true); // dead
    // living trees on dry ground (moisture 0) die: they are not counted either
    const dry: [number, number][] = [];
    const m = moist(s);
    for (let y = 18; y <= 30 && dry.length < 10; y++) for (let x = 3; x <= 8 && dry.length < 10; x++) if (!m[y * W + x]) dry.push([x, y]);
    expect(dry.length).toBe(10);
    plant(s, "Pine", dry);
    const c = check(s);
    expect(c["start.wood"].value).toBe(30);
    expect(c["start.wood"].ok).toBe(false);
  });

  it("trees across a slope count (slopes allowed); trees on a cliff top beyond reach do not", () => {
    const s = scene();
    const taken = new Set<number>();
    plant(s, "BlueberryBush", spots(s, 35, 2, 18, taken));
    // a raised shelf north of the start, joined by a slope, with a pond on it that keeps it moist
    // (the pond's surface is above the start's level: no pump on the start's level reaches it)
    for (let y = 30; y <= 40; y++) for (let x = 8; x <= 20; x++) s.heights[y * W + x] = 6;
    for (let y = 34; y <= 36; y++)
      for (let x = 13; x <= 15; x++) {
        s.heights[y * W + x] = 5;
        s.depth[y * W + x] = 0.6;
      }
    s.objects.push(obj("Slope", 14, 29, 5, "Cw180"));
    const m = moist(s);
    const shelf: [number, number][] = [];
    for (let y = 31; y <= 39 && shelf.length < 42; y++) for (let x = 9; x <= 19 && shelf.length < 42; x++) if (m[y * W + x]) shelf.push([x, y]);
    expect(shelf.length).toBe(42);
    plant(s, "Pine", shelf);
    // with the slope the shelf is within reach; without it, only its edge trees are cut from below
    const withSlope = check(s, { treesWithin20: 40 });
    s.objects = s.objects.filter((o) => o.template !== "Slope");
    const without = check(s, { treesWithin20: 40 });
    expect(withSlope["start.wood"].ok).toBe(true);
    expect(Number(without["start.wood"].value)).toBeLessThan(Number(withSlope["start.wood"].value));
    expect(without["start.wood"].ok).toBe(false);
  });

  it("bushes below the minimum or too far away fail, and Minimum starting bushes moves the result", () => {
    const s = scene();
    const taken = new Set<number>();
    plant(s, "Pine", spots(s, 45, 2, 18, taken));
    plant(s, "BlueberryBush", spots(s, 25, 2, 18, taken));
    plant(s, "BlueberryBush", spots(s, 15, 21.5, 40, taken));
    const c = check(s);
    expect(c["start.food"].value).toBe(25);
    expect(c["start.food"].ok).toBe(false);
    expect(check(s, { bushesWithin20: 25 })["start.food"].ok).toBe(true);
    expect(check(s, { bushesWithin20: 26 })["start.food"].ok).toBe(false);
  });
});
