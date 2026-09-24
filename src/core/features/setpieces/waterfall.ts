// Waterfall (PLAN §9.2). On a river, a fall is a step in the river's bed profile: the river's own
// flow goes over it, so its terrain is the river's carve. The set piece holds the lip position and
// drop so the editor and Claude can grab it; standalone falls (header pool, springs, plunge pool)
// arrive with the editor tools (roadmap M5).

import type { BuildTarget } from "../target";
import type { SetPieceFeature } from "../schema";
import type { SetPieceBuilder } from "./index";

export interface WaterfallPlan {
  mode: "on-river";
  river: string;
  /** Arc position of the lip along the river. */
  at: number;
  /** Levels the bed drops at the lip. */
  drop: number;
}

export const waterfall: SetPieceBuilder = {
  kind: "waterfall",
  // PLAN §9.10: the drop does not depend on map size; 15 is the editor-safe hard maximum and 12
  // the practical one; generated falls are 2–8.
  limits: () => ({ drop: { min: 1, max: 15, typical: [3, 8] } }),
  rasterize(feature: SetPieceFeature, t: BuildTarget): void {
    const p = feature.params.plan as unknown as WaterfallPlan;
    const river = t.river(p.river);
    if (!river) return;
    // The river carries the step (its bedProfile step references this set piece). Nothing else to
    // build for an on-river fall; check the two agree so an edit cannot split them silently.
    const step = river.params.bedProfile.steps.find((s) => s.setPiece === feature.id);
    if (!step || step.drop !== p.drop || Math.abs(step.at - p.at) > 1e-9) {
      t.note(`waterfall ${feature.id} and river ${p.river} disagree about the step at ${p.at}`);
    }
  },
  // an on-river fall writes no terrain of its own
  footprint: () => null,
};
