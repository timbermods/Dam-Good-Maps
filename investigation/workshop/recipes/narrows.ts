// Natural dam narrows (the refinement note): the generated dam site is a straight rock band of one
// thickness and one height (D25). This recipe replaces it with two hillside spurs that reach in from
// the valley's sides and almost meet at the river: each is thick at its root and thin at its tip,
// bent, lumpy, and a little higher or lower than the other. The reservoir must still hold under the
// real checks (water.reservoir), and the narrows is measured with the naturalness metric.

import { bedAt, pointAtArc } from "../../../src/core/features/geometry";
import { hash32 } from "../../../src/core/math/hash";
import { fbm } from "../../../src/core/math/noise";
import type { Feature, LandformFeature, Point, RiverFeature, SetPieceFeature } from "../../../src/core/features/schema";
import { dependentsOf } from "../../../src/core/doc/ops";
import { apply, clearResources, groundUnder, newId, RecipeFailure, type Recipe, type RecipeContext } from "./lib";

/** An outline along a centreline whose width changes along it. */
function taper(center: Point[], widths: number[]): Point[] {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(center.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([center[i][0] + (nx * widths[i]) / 2, center[i][1] + (ny * widths[i]) / 2]);
    right.push([center[i][0] - (nx * widths[i]) / 2, center[i][1] - (ny * widths[i]) / 2]);
  }
  return [...left, ...right.reverse()];
}

function landform(ctx: RecipeContext, params: LandformFeature["params"], label: string): void {
  const feature = { id: newId(ctx), kind: "landform", origin: "user", locked: false, params } as Feature;
  apply(ctx, [{ op: "addFeature", params: { feature } }], label);
}

export const spurNarrows: Recipe = {
  id: "spur-narrows",
  name: "Dam narrows between two hillside spurs",
  pattern: "natural-narrows",
  whimsical: false,
  theme: "riverValley",
  apply(ctx) {
    const { W, H } = ctx;
    const dam = ctx.session.features.find((f): f is SetPieceFeature => f.kind === "setPiece" && f.params.kind === "damSite");
    if (!dam) throw new RecipeFailure("the base has no dam site");
    const plan = dam.params.plan as unknown as { river: string; at: number; thickness: number; halfSpan: number; topLevel: number; crest: number };
    const river = ctx.session.features.find((f): f is RiverFeature => f.id === plan.river && f.kind === "river");
    if (!river) throw new RecipeFailure("the dam site's river is gone");
    const deps = dependentsOf(ctx.session.features, dam.id);
    if (deps.length) throw new RecipeFailure(`the dam site has dependents: ${deps.map((d) => d.kind).join(", ")}`);
    apply(ctx, [{ op: "deleteFeature", params: { id: dam.id } }], "remove the straight ridge");
    const path = river.params.path;
    const { p, normal } = pointAtArc(path, plan.at);
    // the valley's axis: from the river's source to its outlet
    const [ax0, ay0] = path[0];
    const [ax1, ay1] = path[path.length - 1];
    const al = Math.hypot(ax1 - ax0, ay1 - ay0) || 1;
    const axis: Point = [(ax1 - ax0) / al, (ay1 - ay0) / al];
    const across: Point = [-axis[1], axis[0]];
    void normal;
    const bed = bedAt(river.params.bedProfile, plan.at);
    const crestLevel = bed + plan.crest;
    const hw = river.params.width / 2;
    const seed = hash32(ctx.spec.seed, "spurs", ctx.attempt);
    const tall = ctx.rand() < 0.5 ? 1 : -1;
    for (const side of [1, -1] as const) {
      const root = plan.halfSpan + 5 + 3 * ctx.rand();
      const tip = hw + 1 + (side === tall ? 0.5 : 2) + ctx.rand();
      const bend = (2 + 3 * ctx.rand()) * (ctx.rand() < 0.5 ? 1 : -1);
      const rootWidth = 11 + 5 * ctx.rand();
      const tipWidth = 4 + 2 * ctx.rand();
      const center: Point[] = [];
      const widths: number[] = [];
      const n = 12;
      for (let k = 0; k <= n; k++) {
        const t = k / n; // 0 at the root, 1 at the tip
        const d = root + (tip - root) * t;
        const lateral = bend * Math.sin(Math.PI * t) + 1.2 * fbm(seed + side, k * 3, side * 7, 6, 2);
        center.push([p[0] + side * across[0] * d + axis[0] * lateral, p[1] + side * across[1] * d + axis[1] * lateral]);
        const lump = 1 + 0.3 * fbm(seed + 11 * side, k * 5, 3, 5, 2);
        widths.push(Math.max(3, (rootWidth + (tipWidth - rootWidth) * t) * lump));
      }
      // roots that would run off the map stop at its edge
      const clamp = (o: Point[]): Point[] => o.map(([x, y]) => [Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y))]);
      const outline = clamp(taper(center, widths));
      clearResources(ctx, outline, 1);
      const ground = groundUnder(ctx, outline);
      // an apron with gentle sides up to the crest, a core above it, and a crown toward the root
      const core = Math.min(16, crestLevel + 1 + (side === tall ? 1 : 0));
      landform(ctx, { kind: "ridge", edgeStyle: "gentle", outline, height: core, base: ground.min }, "a spur's apron");
      const coreLine = clamp(taper(center.slice(0, 11), widths.slice(0, 11).map((w) => 0.6 * w)));
      landform(ctx, { kind: "ridge", edgeStyle: "cliff", outline: coreLine, height: core }, "a spur's core");
      const crownN = 5 + Math.floor(3 * ctx.rand());
      const crown = clamp(taper(center.slice(0, crownN), widths.slice(0, crownN).map((w) => 0.45 * w)));
      landform(ctx, { kind: "ridge", edgeStyle: "cliff", outline: crown, height: Math.min(16, Math.max(core + 1, plan.topLevel - (side === tall ? 0 : 1))) }, "a spur's crown");
    }
    ctx.notes.push(`spurs: crest ${crestLevel}, ridge top ${plan.topLevel}`);
  },
};
