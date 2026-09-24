// Badwater (PLAN §9.5). M2 builds the prototype's badwater marsh (PLAN §20, D24): a BadwaterSource
// 3×3 on the flat floodplain beside the river below the falls, as far from the start as the valley
// allows. Its water runs into the river and leaves the map downstream of the start. The contained
// side basin with a single outlet (the full §9.5 set piece, with the `water.badwater_contained`
// proof) arrives with the shared builder in roadmap M5; its plan will carry an `outlet`.

import type { BuildTarget } from "../build";
import type { SetPieceFeature } from "../schema";
import type { SetPieceBuilder, SetPieceSource } from "./index";

export interface MarshPlan {
  mode: "marsh";
  /** Minimum corner of the 3×3 source (it is placed Cw0, so this is its Coordinates). */
  x: number;
  y: number;
  /** The floodplain level the pad is levelled to. */
  level: number;
  /** BadwaterSource strength, blocks per second over its 9 tiles (1–3, PLAN §5.4). */
  strength: number;
}

export const badwaterBasin: SetPieceBuilder = {
  kind: "badwaterBasin",
  limits: () => ({ strength: { min: 1, max: 3 } }),
  rasterize(feature: SetPieceFeature, t: BuildTarget): void {
    const p = feature.params.plan as unknown as MarshPlan;
    if (p.mode !== "marsh") return t.note(`badwater basin ${feature.id}: mode ${String(p.mode)} is not built by this version`);
    for (let y = p.y; y < p.y + 3; y++) {
      for (let x = p.x; x < p.x + 3; x++) {
        if (x < 0 || x >= t.W || y < 0 || y >= t.H) continue;
        t.heights[y * t.W + x] = p.level;
        t.protect(y * t.W + x);
      }
    }
  },
  sources(feature: SetPieceFeature): SetPieceSource[] {
    const p = feature.params.plan as unknown as MarshPlan;
    if (p.mode !== "marsh") return [];
    return [{ template: "BadwaterSource", x: p.x, y: p.y, strength: p.strength, tiles: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] }];
  },
};
