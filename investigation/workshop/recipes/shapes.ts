// Shape premises: a heart-shaped lake, an island in a moat, a crater lake, a spiral mountain. Each
// is drawn with the editor's own planners (landforms by outline, lakes by basin) on a generated
// River Valley base, in the highlands away from the start and the river.

import { polygonMask } from "../../../src/core/features/geometry";
import { RUIN_HEIGHT_SHARES } from "../../../src/core/gen/calibrated";
import { tilesToRuns } from "../../../src/core/math/grid";
import { planContextOf, planLake } from "../../../src/core/doc/tools";
import type { Feature, LakeFeature, Point } from "../../../src/core/features/schema";
import {
  addLandform,
  apply,
  circle,
  clearResources,
  findSpot,
  forbidden,
  groundUnder,
  heart,
  newId,
  RecipeFailure,
  slopeBetween,
  spotScaled,
  type Recipe,
  type RecipeContext,
} from "./lib";

const scaleOf = (ctx: RecipeContext) => Math.min(ctx.W, ctx.H) / 128;
const spread = (ctx: RecipeContext, outline: Point[]) => {
  const g = groundUnder(ctx, outline);
  return g.max - g.min;
};

/** A lake of its own with islands in it: planned by the lake tool, islands added to its plan. */
function lakeWithIslands(ctx: RecipeContext, outline: Point[], islands: (sill: number) => { outline: Point[]; height: number }[], label: string): LakeFeature {
  const plan = planLake({ outline, floorDepth: 2, spring: 0.5 }, planContextOf(ctx.session), newId(ctx), "user");
  if (!plan.ok) throw new RecipeFailure(`${label}: ${plan.errors.join("; ")}`);
  const f = plan.feature as LakeFeature;
  f.params.islands = islands(f.params.outlet.sill);
  apply(ctx, plan.ops, label);
  ctx.notes.push(...plan.report);
  return f;
}

/** A ruin field on the tiles of an outline that stand at one level (the highest level there). */
function ruinsOn(ctx: RecipeContext, outline: Point[], scrap: number, label: string): void {
  const { W, H } = ctx;
  const mask = polygonMask(outline, W, H);
  const h = ctx.session.built.heights;
  let top = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) top = Math.max(top, h[i]);
  const tiles: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] && h[i] === top) tiles.push(i);
  if (tiles.length < 12) return;
  const feature: Feature = {
    id: newId(ctx),
    kind: "ruinField",
    origin: "user",
    locked: false,
    params: { area: tilesToRuns(tiles, W), scrapTarget: scrap, heightMix: [...RUIN_HEIGHT_SHARES], centerBias: 0.35 },
  };
  apply(ctx, [{ op: "addFeature", params: { feature } }], label);
}

export const heartLake: Recipe = {
  id: "heart-lake",
  name: "Heart lake",
  pattern: "shape-silhouette",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    const full = Math.round((28 + 10 * ctx.rand()) * s);
    const fit = spotScaled(ctx, 0.56 * full, forbidden(ctx, 10), (x, y, k) => -spread(ctx, heart(x, y, full * k)));
    if (!fit) throw new RecipeFailure("no room for the heart");
    const size = full * fit.k;
    const spot = fit.at;
    const outline = heart(spot[0], spot[1], size);
    clearResources(ctx, outline, 3);
    lakeWithIslands(ctx, outline, () => [], "heart-shaped lake");
  },
};

export const moatIsland: Recipe = {
  id: "moat-island",
  name: "Island in a moat",
  pattern: "ring-moat",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    const R0 = (15 + 5 * ctx.rand()) * s;
    const moat = Math.max(4, Math.round(5 * s));
    const fit = spotScaled(ctx, R0 + 3, forbidden(ctx, 10), (x, y, k) => -spread(ctx, circle(x, y, R0 * k)));
    if (!fit) throw new RecipeFailure("no room for the moat");
    const R = Math.max(moat + 5, (R0 + 3) * fit.k - 3);
    const [cx, cy] = fit.at;
    const outline = circle(cx, cy, R, 32, 0.06, ctx.rand);
    const isle = circle(cx, cy, R - moat, 24, 0.12, ctx.rand);
    clearResources(ctx, outline, 3);
    lakeWithIslands(ctx, outline, (sill) => [{ outline: isle, height: Math.min(16, sill + 2 + Math.floor(2 * ctx.rand())) }], "moat");
    ruinsOn(ctx, circle(cx, cy, R - moat - 2, 20), Math.round(900 * s * s), "ruins on the island");
  },
};

export const craterLake: Recipe = {
  id: "crater-lake",
  name: "Crater lake with an island",
  pattern: "crater-lake",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    const R0 = (17 + 5 * ctx.rand()) * s;
    const fit = spotScaled(ctx, R0 + 2, forbidden(ctx, 12), (x, y, k) => -spread(ctx, circle(x, y, R0 * k)));
    if (!fit) throw new RecipeFailure("no room for the crater");
    const Rout = (R0 + 2) * fit.k - 2;
    const [cx, cy] = fit.at;
    const skirt = circle(cx, cy, Rout, 32, 0.08, ctx.rand);
    const wall = circle(cx, cy, 0.78 * Rout, 32, 0.06, ctx.rand);
    clearResources(ctx, skirt, 2);
    const g = groundUnder(ctx, skirt);
    // a gentle skirt, then the crater's steep wall; the lake is dug inside it
    addLandform(ctx, { outline: skirt, kind: "hill", edgeStyle: "gentle", height: Math.min(16, g.max + 2) }, "crater skirt");
    addLandform(ctx, { outline: wall, kind: "hill", edgeStyle: "cliff", height: Math.min(16, g.max + 4 + Math.floor(2 * ctx.rand())) }, "crater wall");
    const inner = circle(cx, cy, 0.5 * Rout, 28, 0.05, ctx.rand);
    lakeWithIslands(ctx, inner, (sill) => [{ outline: circle(cx, cy, 0.17 * Rout, 16, 0.15, ctx.rand), height: Math.min(16, sill + 2) }], "crater lake");
  },
};

export const spiralMountain: Recipe = {
  id: "spiral-mountain",
  name: "Spiral mountain or spiral quarry",
  pattern: "spiral",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const { W, H } = ctx;
    const s = scaleOf(ctx);
    const R0 = (14 + 4 * ctx.rand()) * s;
    const fit = spotScaled(ctx, R0 + 2, forbidden(ctx, 10), (x, y, k) => -spread(ctx, circle(x, y, R0 * k)));
    if (!fit) throw new RecipeFailure("no room for the spiral");
    const R = (R0 + 2) * fit.k - 2;
    const [cx, cy] = fit.at;
    const disc = circle(cx, cy, R + 1, 32);
    const g = groundUnder(ctx, disc);
    // on low ground a mountain climbs; on high ground a quarry winds down (a reverse helix)
    const up = g.max <= 9;
    // the ramp starts from the highest ground round it: a quarry is cut down from the rim
    const base = g.max;
    const K = up ? Math.min(9, 15 - base) : Math.min(9, base - 2);
    if (K < 5) throw new RecipeFailure(`ground at levels ${g.min}-${g.max}: no room for 5 turns of the ramp`);
    clearResources(ctx, disc, 2);
    const step = up ? 1 : -1;
    const turns = 1.5;
    const r0 = 0.24 * R;
    const w = (R - r0) / turns;
    const tMax = 2 * Math.PI * turns;
    const phase = ctx.rand() * 2 * Math.PI;
    const sense = ctx.rand() < 0.5 ? 1 : -1;
    const at = (t: number, dr: number): Point => {
      const r = R - w / 2 - ((R - r0 - w / 2) * t) / tMax + dr;
      const a = phase + sense * t;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const segs: { outline: Point[]; height: number }[] = [];
    for (let k = 0; k < K; k++) {
      // each step starts a little inside the one before, so the two share an edge (no gap)
      const t0 = Math.max(0, (tMax * k) / K - (k ? 2 / (R - ((R - r0) * k) / K) : 0));
      const t1 = (tMax * (k + 1)) / K;
      const n = 8;
      const outer: Point[] = [];
      const inner: Point[] = [];
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / n;
        outer.push(at(t, w / 2));
        inner.push(at(t, -w / 2));
      }
      segs.push({ outline: [...outer, ...inner.reverse()], height: base + step * (1 + k) });
    }
    for (const [k, sg] of segs.entries()) addLandform(ctx, { outline: sg.outline, kind: up ? "plateau" : "canyon", edgeStyle: "cliff", height: sg.height }, `spiral step ${k + 1}`);
    const summit = circle(cx, cy, Math.max(3, r0), 16);
    const coreLevel = base + step * (K + 1);
    addLandform(ctx, { outline: summit, kind: up ? "plateau" : "canyon", edgeStyle: "cliff", height: coreLevel }, up ? "summit" : "quarry floor");
    // the ramp: a slope at each step, where the spiral turns a level
    const masks = [...segs.map((sg) => polygonMask(sg.outline, W, H)), polygonMask(summit, W, H)];
    const heights = [...segs.map((sg) => sg.height), coreLevel];
    const h = () => ctx.session.built.heights;
    const inAny = (i: number) => masks.some((m) => m[i]);
    const ops = [];
    const edge = at(0, 0).map(Math.round) as [number, number];
    const first = up
      ? slopeBetween(ctx, (i) => h()[i] === base && !inAny(i), (i) => !!masks[0][i] && h()[i] === heights[0], edge)
      : slopeBetween(ctx, (i) => !!masks[0][i] && h()[i] === heights[0], (i) => h()[i] === base && !inAny(i), edge);
    if (first) ops.push(first);
    for (let k = 0; k + 1 < masks.length; k++) {
      const near = (k + 1 < segs.length ? at((tMax * (k + 1)) / K, 0) : [cx, cy]).map(Math.round) as [number, number];
      const a = (i: number) => !!masks[k][i] && h()[i] === heights[k];
      const b = (i: number) => !!masks[k + 1][i] && h()[i] === heights[k + 1];
      const op = up ? slopeBetween(ctx, a, b, near) : slopeBetween(ctx, b, a, near);
      if (!op) throw new RecipeFailure(`no place for the slope at step ${k + 2}`);
      ops.push(op);
    }
    apply(ctx, ops, "the spiral's slopes");
    ruinsOn(ctx, summit, Math.round(600 * s * s), up ? "ruins on the summit" : "ruins at the bottom of the quarry");
    ctx.notes.push(up ? `a spiral mountain climbing ${K + 1} levels` : `a spiral quarry winding ${K + 1} levels down`);
  },
};
