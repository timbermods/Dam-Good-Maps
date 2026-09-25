// Landmark premises: a badwater volcano, a hanging lake on a mesa, a field of mesas with ruins on
// top, and twin waterfalls. Drawn with the editor's planners and the shared set-piece builders on a
// generated River Valley base.

import { polygonMask } from "../../../src/core/features/geometry";
import { RUIN_HEIGHT_SHARES } from "../../../src/core/gen/calibrated";
import { tilesToRuns } from "../../../src/core/math/grid";
import { planContextOf, planLake } from "../../../src/core/doc/tools";
import type { Feature, LakeFeature, Point, SetPieceFeature } from "../../../src/core/features/schema";
import type { Facing } from "../../../src/core/features/setpieces/common";
import {
  addLandform,
  addPiece,
  apply,
  circle,
  clearResources,
  findSpot,
  forbidden,
  groundUnder,
  newId,
  RecipeFailure,
  makeRoom,
  spotScaled,
  startOf,
  type Recipe,
  type RecipeContext,
} from "./lib";

const scaleOf = (ctx: RecipeContext) => Math.min(ctx.W, ctx.H) / 128;
const spread = (ctx: RecipeContext, outline: Point[]) => {
  const g = groundUnder(ctx, outline);
  return g.max - g.min;
};
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function ruinField(ctx: RecipeContext, tiles: number[], scrap: number, label: string): void {
  if (tiles.length < 12) return;
  const feature: Feature = {
    id: newId(ctx),
    kind: "ruinField",
    origin: "user",
    locked: false,
    params: { area: tilesToRuns(tiles, ctx.W), scrapTarget: scrap, heightMix: [...RUIN_HEIGHT_SHARES], centerBias: 0.35 },
  };
  apply(ctx, [{ op: "addFeature", params: { feature } }], label);
}

/** The top tiles of an outline (its highest level), as built. */
function topTiles(ctx: RecipeContext, outline: Point[]): number[] {
  const mask = polygonMask(outline, ctx.W, ctx.H);
  const h = ctx.session.built.heights;
  let top = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) top = Math.max(top, h[i]);
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] && h[i] === top) out.push(i);
  return out;
}

export const volcano: Recipe = {
  id: "volcano",
  name: "Badwater volcano",
  pattern: "volcano",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    // the volcano replaces the base's first badwater basin, which the generator placed far enough
    // downstream; its strength moves to the crater
    const basins = ctx.session.features.filter((f): f is SetPieceFeature => f.kind === "setPiece" && f.params.kind === "badwaterBasin" && f.params.plan.mode === "basin");
    if (!basins.length) throw new RecipeFailure("the base has no badwater basin to turn into a volcano");
    const old = basins[0];
    const oldAt: [number, number] = [Number(old.params.plan.x) + 1, Number(old.params.plan.y) + 1];
    const strength = Number(old.params.plan.strength);
    apply(ctx, [{ op: "deleteFeature", params: { id: old.id } }], "remove the base's badwater basin");
    const R0 = (15 + 4 * ctx.rand()) * s;
    const st = startOf(ctx);
    const rule = ctx.spec.settings.hazards.badwaterDistance;
    const blocked = forbidden(ctx, 10);
    // the badwater rule counts the crater (and its 7-tile soil contamination), not the flanks
    const fit = spotScaled(ctx, R0 + 1, blocked, (x, y, k) => (dist([x, y], st) < rule + 14 ? -1e6 : 0) - dist([x, y], oldAt) - 2 * spread(ctx, circle(x, y, R0 * k)));
    const R = fit ? (R0 + 1) * fit.k - 1 : R0;
    const spot = fit?.at;
    if (!spot || dist(spot, st) < rule + 14) throw new RecipeFailure("no room for a volcano far enough from the start");
    const [cx, cy] = spot;
    const cone = circle(cx, cy, R, 36, 0.1, ctx.rand);
    clearResources(ctx, cone, 2);
    const g = groundUnder(ctx, cone);
    const top = Math.min(15, g.max + Math.max(4, Math.floor(R / 3.2)));
    // a cone: gentle flanks (one level every 3 tiles) round a steeper core
    addLandform(ctx, { outline: cone, kind: "hill", edgeStyle: "gentle", height: top - 1 }, "volcano flanks");
    addLandform(ctx, { outline: circle(cx, cy, 0.42 * R, 20, 0.12, ctx.rand), kind: "hill", edgeStyle: "cliff", height: top }, "volcano cone");
    addPiece(ctx, "badwaterBasin", { mode: "basin", at: [cx, cy], strength }, "the crater's badwater spring");
  },
};

export const hangingLake: Recipe = {
  id: "hanging-lake",
  name: "Hanging lake on a mesa",
  pattern: "sky-tower",
  whimsical: true,
  theme: "riverValley",
  apply(ctx) {
    const s = scaleOf(ctx);
    const R0 = (10 + 3 * ctx.rand()) * s;
    const fit = spotScaled(ctx, R0 + 2, forbidden(ctx, 10), (x, y, k) => -spread(ctx, circle(x, y, R0 * k)));
    if (!fit) throw new RecipeFailure("no room for the mesa");
    const R = (R0 + 2) * fit.k - 2;
    const [cx, cy] = fit.at;
    const mesa = circle(cx, cy, R, 28, 0.14, ctx.rand);
    clearResources(ctx, mesa, 2);
    const g = groundUnder(ctx, mesa);
    const height = Math.min(15, g.max + 5 + Math.floor(3 * ctx.rand()));
    addLandform(ctx, { outline: mesa, kind: "plateau", edgeStyle: "cliff", height }, "the mesa");
    // a tarn on top; its outlet is routed down the mesa's side to the river (a cascade)
    const plan = planLake({ outline: circle(cx, cy, 0.55 * R, 20, 0.1, ctx.rand), floorDepth: 2, spring: 0.75 }, planContextOf(ctx.session), newId(ctx), "user");
    if (!plan.ok) throw new RecipeFailure(`the tarn: ${plan.errors.join("; ")}`);
    apply(ctx, plan.ops, "the tarn");
    const lake = plan.feature as LakeFeature;
    ctx.notes.push(`tarn at level ${lake.params.outlet.sill}, outlet ${lake.params.outlet.path ? lake.params.outlet.path.length / 2 : 0} tiles down to ${lake.params.outlet.to}`);
  },
};

export const mesaField: Recipe = {
  id: "mesa-field",
  name: "Mesa field with ruins on top",
  pattern: "mesa-field",
  whimsical: false,
  theme: "riverValley",
  apply(ctx) {
    const { W, H } = ctx;
    const s = scaleOf(ctx);
    const blocked = forbidden(ctx, 12);
    const fit = spotScaled(ctx, 20 * s, blocked, (x, y, k) => -spread(ctx, circle(x, y, 20 * s * k)) + ctx.rand());
    if (!fit) throw new RecipeFailure("no room for a mesa field");
    const Rr = 20 * s * fit.k;
    const region = fit.at;
    const placed: [number, number, number][] = [];
    for (let tries = 0; tries < 400 && placed.length < 9; tries++) {
      const a = ctx.rand() * 2 * Math.PI;
      const d = Math.sqrt(ctx.rand()) * (Rr - 5 * s);
      const r = Math.max(3, (3.5 + 3 * ctx.rand()) * s * (placed.length > 3 ? 0.8 : 1));
      const x = region[0] + d * Math.cos(a);
      const y = region[1] + d * Math.sin(a);
      if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < pr + r + 2)) continue;
      placed.push([x, y, r]);
    }
    if (placed.length < 4) throw new RecipeFailure("too few mesas fit");
    clearResources(ctx, circle(region[0], region[1], Rr, 28), 1);
    const mesas: Point[][] = [];
    for (const [x, y, r] of placed) {
      const outline = circle(x, y, r, 18, 0.18, ctx.rand);
      const g = groundUnder(ctx, outline);
      addLandform(ctx, { outline, kind: "plateau", edgeStyle: "cliff", height: Math.min(16, g.max + 2 + Math.floor(4 * ctx.rand())) }, "a mesa");
      mesas.push(outline);
    }
    // ruins on the two biggest mesas: a payoff that needs stairs (PLAN §9.4)
    const order = placed.map((p, k) => [p[2], k] as const).sort((a, b) => b[0] - a[0]);
    for (const [, k] of order.slice(0, 2)) ruinField(ctx, topTiles(ctx, mesas[k]), Math.round(700 * s * s), "ruins on a mesa");
    void W;
    void H;
  },
};

export const twinFalls: Recipe = {
  id: "twin-falls",
  name: "Twin waterfalls",
  pattern: "landmark-falls",
  whimsical: false,
  theme: "riverValley",
  apply(ctx) {
    const { W, H } = ctx;
    const s = scaleOf(ctx);
    const main = ctx.session.features.find((f) => f.kind === "river" && f.role === "river/main");
    if (!main || main.kind !== "river") throw new RecipeFailure("the base has no main river");
    const st = startOf(ctx);
    const blocked = forbidden(ctx, 10);
    // two falls side by side on one valley side, facing the river
    const width = Math.max(3, Math.round((4 + 3 * ctx.rand()) * s));
    const gap = width + Math.round(6 * s);
    const tries: { lip: [number, number]; facing: Facing; score: number }[] = [];
    for (let k = 0; k < 60; k++) {
      const x = Math.round(12 + ctx.rand() * (W - 24));
      const y = Math.round(12 + ctx.rand() * (H - 24));
      if (blocked[y * W + x] || blocked[y * W + Math.min(W - 1, x + gap)]) continue;
      // face the river: toward whichever way the channel lies
      const riverY = main.params.path.reduce((m, p) => (Math.abs(p[0] - x) < Math.abs(m[0] - x) ? p : m))[1];
      const facing: Facing = riverY < y ? "south" : "north";
      const d = Math.abs(riverY - y);
      if (d < 14 * s || d > 40 * s) continue;
      tries.push({ lip: [x, y], facing, score: -Math.abs(d - 22 * s) + (dist([x, y], st) > 30 * s ? 5 : -20) });
    }
    tries.sort((a, b) => b.score - a.score);
    for (const t of tries.slice(0, 6)) {
      const drop = Math.max(4, Math.min(9, Math.round((5 + 4 * ctx.rand()) * Math.max(0.8, s))));
      let first = false;
      try {
        // the falls reshape the ground: optional pieces and objects near them go first
        const span = 2 * width + gap + 16;
        makeRoom(ctx, circle(t.lip[0] + gap / 2, t.lip[1], span / 2, 16), 4);
        addPiece(ctx, "waterfall", { mode: "standalone", lip: t.lip, facing: t.facing, width, drop, flow: 1 }, "the first fall");
        first = true;
        addPiece(ctx, "waterfall", { mode: "standalone", lip: [t.lip[0] + gap, t.lip[1]], facing: t.facing, width, drop: drop + (ctx.rand() < 0.5 ? 1 : -1), flow: 1 }, "the second fall");
        return;
      } catch (e) {
        if (!(e instanceof RecipeFailure)) throw e;
        if (first) ctx.session.undo();
        ctx.notes.push(e.message);
      }
    }
    throw new RecipeFailure(`no place for two falls side by side (${ctx.notes.slice(-1)[0] ?? "none tried"})`);
  },
};
