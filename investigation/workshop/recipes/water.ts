// Water premises: an oxbow lake beside the river, and a valley whose river runs north to south (or
// south to north) instead of west to east (D67).

import { pathField, pointAtArc, polygonMask } from "../../../src/core/features/geometry";
import { RUIN_HEIGHT_SHARES } from "../../../src/core/gen/calibrated";
import { tilesToRuns } from "../../../src/core/math/grid";
import type { EditOp } from "../../../src/core/doc/ops";
import type { Feature, LandformFeature, Point, RiverFeature, StartFeature } from "../../../src/core/features/schema";
import { addLake, addPiece, addRiver, apply, band, circle, findSpot, forbidden, newId, RecipeFailure, type Recipe, type RecipeContext } from "./lib";

const scaleOf = (ctx: RecipeContext) => Math.min(ctx.W, ctx.H) / 128;

function mainRiver(ctx: RecipeContext): RiverFeature {
  const r = ctx.session.features.find((f): f is RiverFeature => f.kind === "river" && f.role === "river/main");
  if (!r) throw new RecipeFailure("the base has no main river");
  return r;
}

function arcLength(path: Point[]): number {
  let l = 0;
  for (let i = 0; i + 1 < path.length; i++) l += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  return l;
}

export const oxbowLake: Recipe = {
  id: "oxbow-lake",
  name: "Oxbow lake",
  pattern: "meander-loop",
  whimsical: false,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    const river = mainRiver(ctx);
    const L = arcLength(river.params.path);
    const hw = river.params.width / 2;
    const blocked = forbidden(ctx, 6);
    for (let tries = 0; tries < 24; tries++) {
      const at = L * (0.2 + 0.6 * ctx.rand());
      const { p, normal } = pointAtArc(river.params.path, at);
      const side = ctx.rand() < 0.5 ? 1 : -1;
      const Rc = (8 + 4 * ctx.rand()) * s;
      const O: Point = [p[0] + side * normal[0] * (hw + 4 + 0.3 * Rc), p[1] + side * normal[1] * (hw + 4 + 0.3 * Rc)];
      // a U bulging away from the river, its horns curving back toward it
      const base = Math.atan2(side * normal[1], side * normal[0]);
      const arc: Point[] = [];
      for (let k = 0; k <= 14; k++) {
        const a = base - 1.35 + (2.7 * k) / 14;
        arc.push([O[0] + Rc * Math.cos(a), O[1] + Rc * Math.sin(a)]);
      }
      const outline = band(arc, Math.max(3, 4 * s));
      const mask = polygonMask(outline, ctx.W, ctx.H);
      let ok = true;
      for (let i = 0; i < mask.length && ok; i++) if (mask[i] && blocked[i]) ok = false;
      if (!ok) continue;
      try {
        addLake(ctx, { outline, floorDepth: 2, spring: 0.25 }, "oxbow lake");
        return;
      } catch (e) {
        if (!(e instanceof RecipeFailure)) throw e;
        ctx.notes.push(e.message);
      }
    }
    throw new RecipeFailure("no place for an oxbow beside the river");
  },
};

/** Delete the generated layout: set pieces, lakes, landforms, rivers, map objects, ruin fields and
 *  berry patches (forests stay: they are replanted by the new moisture). */
function clearLayout(ctx: RecipeContext): void {
  const fs = ctx.session.features;
  const ops: EditOp[] = [];
  for (const r of fs) {
    if (r.kind === "river" && r.params.bedProfile.steps.some((st) => st.setPiece)) {
      ops.push({ op: "updateFeature", params: { id: r.id, patch: { params: { bedProfile: { start: r.params.bedProfile.start, steps: [] } } } } });
    }
  }
  if (ops.length) apply(ctx, ops, "take the falls out of the rivers");
  const order = ["setPiece", "lake", "landform", "mapObject", "ruinField", "berryPatch"] as const;
  const del: EditOp[] = [];
  for (const k of order) for (const f of ctx.session.features) if (f.kind === k) del.push({ op: "deleteFeature", params: { id: f.id } });
  // tributaries before the rivers they join
  const rivers = ctx.session.features.filter((f): f is RiverFeature => f.kind === "river");
  rivers.sort((a, b) => Number("river" in b.params.exit) - Number("river" in a.params.exit));
  for (const r of rivers) del.push({ op: "deleteFeature", params: { id: r.id } });
  apply(ctx, del, "clear the generated layout");
}

function rawFeature(ctx: RecipeContext, f: Omit<Feature, "id" | "origin" | "locked">, label: string): Feature {
  const feature = { ...f, id: newId(ctx), origin: "user", locked: false } as Feature;
  apply(ctx, [{ op: "addFeature", params: { feature } }], label);
  return feature;
}

export const northSouth: Recipe = {
  id: "north-south",
  name: "Valley running north to south",
  pattern: "river-direction",
  whimsical: false,
  theme: "riverValley",
  apply(ctx) {
    const { W, H } = ctx;
    const s = scaleOf(ctx);
    const old = mainRiver(ctx);
    const flow = old.params.flow;
    const width = old.params.width;
    clearLayout(ctx);
    const southward = ctx.rand() < 0.5;
    // the course: from one edge to the other, wandering across the middle
    const xr = W * (0.42 + 0.16 * ctx.rand());
    const n = 6;
    const pts: Point[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const y = southward ? H - 1 - t * (H - 1) : t * (H - 1);
      const x = k === 0 || k === n - 1 ? xr + (ctx.rand() - 0.5) * 0.1 * W : xr + (ctx.rand() - 0.5) * 0.22 * W;
      pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
    const bed = 7;
    const floor = bed + 1;
    const hw = Math.round((0.17 + 0.05 * ctx.rand()) * W);
    // the start: on a bench beside the river, halfway down, the door toward the water
    const L = arcLength(pts);
    const s0 = L * (0.42 + 0.14 * ctx.rand());
    const { p, normal } = pointAtArc(pts, s0);
    const side = ctx.rand() < 0.5 ? 1 : -1;
    const off = width / 2 + 7;
    const sx = Math.round(p[0] + side * normal[0] * off);
    const sy = Math.round(p[1] + side * normal[1] * off);
    const dx = p[0] - sx;
    const dy = p[1] - sy;
    const orientation = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "Cw90" : "Cw270") : dy < 0 ? "Cw0" : "Cw180";
    const start = ctx.session.features.find((f): f is StartFeature => f.kind === "start")!;
    apply(ctx, [{ op: "updateFeature", params: { id: start.id, patch: { params: { position: [sx, sy], orientation, benchLevel: floor + 1 } } } }], "move the start beside the new river");
    // the ground: one level everywhere, then the river, its valley floor and terraces on both sides
    rawFeature(ctx, { kind: "landform", params: { kind: "plateau", edgeStyle: "cliff", outline: [[-0.5, -0.5], [W - 0.5, -0.5], [W - 0.5, H - 0.5], [-0.5, H - 0.5]], height: floor } } as Omit<LandformFeature, "id" | "origin" | "locked">, "the ground");
    const river = addRiver(ctx, { points: pts, flow, width }, "the new river") as RiverFeature;
    rawFeature(ctx, { kind: "landform", params: { kind: "valley", edgeStyle: "terraced", along: { river: river.id, halfWidth: hw, floorAboveBed: 1 } } } as Omit<LandformFeature, "id" | "origin" | "locked">, "the valley floor");
    const top = 16;
    for (const sd of [1, -1] as const) {
      const bands = [];
      let at = 0;
      let lv = floor;
      while (lv < top) {
        const rise = ctx.rand() < 0.7 ? 1 : 2;
        bands.push({ at: Math.round(at), rise });
        lv += rise;
        at += 6 + 5 * ctx.rand();
      }
      rawFeature(ctx, { kind: "landform", params: { kind: "terraces", edgeStyle: "terraced", along: { river: river.id, halfWidth: hw, floorAboveBed: 1, side: sd, baseLevel: floor, bands, wobble: { amp: 3.2, cell: 24, amp2: 1, cell2: 8 }, maxLevel: top } } } as Omit<LandformFeature, "id" | "origin" | "locked">, "terraces");
    }
    // the dam site upstream of the start, a fall downstream
    const Lr = arcLength(river.params.path);
    addPiece(ctx, "damSite", { river: river.id, at: Math.max(8, Math.min(Lr - 8, s0 - 22 * s)), crest: 2 }, "the dam site");
    try {
      addPiece(ctx, "waterfall", { mode: "on-river", river: river.id, at: Math.min(Lr - 10, s0 + 28 * s), drop: 2 }, "a fall downstream");
    } catch (e) {
      if (!(e instanceof RecipeFailure)) throw e;
      ctx.notes.push(e.message);
    }
    // food and wood near the start, ruins on the terraces far from it
    const field = pathField(river.params.path, W, H);
    const berries: number[] = [];
    const wood: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const d = Math.hypot(x - sx, y - sy);
        if (field.d[i] < width / 2 + 1.5 || Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= 4) continue;
        if (d <= 13 && field.d[i] < hw) berries.push(i);
        else if (d > 13 && d <= 22) wood.push(i);
      }
    const ops: EditOp[] = [
      { op: "addFeature", params: { feature: { id: newId(ctx), kind: "berryPatch", origin: "user", locked: false, params: { area: tilesToRuns(berries, W), density: 0.35, ripeShare: 1 } } } },
      { op: "addFeature", params: { feature: { id: newId(ctx), kind: "forest", origin: "user", locked: false, params: { area: tilesToRuns(wood, W), density: 0.3, speciesMix: { Pine: 45, Birch: 30, Oak: 25 }, life: "auto", youngShare: 0.35, groveSize: 12 } } } },
    ];
    apply(ctx, ops, "berries and groves near the start");
    const blocked = forbidden(ctx, 30);
    for (let k = 0; k < 3; k++) {
      const spot = findSpot(ctx, 5 * s + 2, blocked, (x, y) => field.d[y * W + x]);
      if (!spot) break;
      const disc = circle(spot[0], spot[1], 5 * s + 1, 16);
      const mask = polygonMask(disc, W, H);
      const hgt = ctx.session.built.heights;
      let lvl = 0;
      for (let i = 0; i < mask.length; i++) if (mask[i]) lvl = Math.max(lvl, hgt[i]);
      const tiles: number[] = [];
      for (let i = 0; i < mask.length; i++) if (mask[i] && hgt[i] === lvl) tiles.push(i);
      for (let i = 0; i < mask.length; i++) if (mask[i]) blocked[i] = 1;
      if (tiles.length < 12) continue;
      apply(ctx, [{ op: "addFeature", params: { feature: { id: newId(ctx), kind: "ruinField", origin: "user", locked: false, params: { area: tilesToRuns(tiles, W), scrapTarget: Math.round(2400 * s * s), heightMix: [...RUIN_HEIGHT_SHARES], centerBias: 0.35 } } } }], "a ruin field");
    }
    ctx.notes.push(`the river runs ${southward ? "north to south" : "south to north"}`);
  },
};
