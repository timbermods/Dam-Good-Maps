// Dam site (PLAN §9.1): a rock ridge across a river valley, cut by the channel, so one short dam
// across the gap holds the basin upstream. The ridge runs well past the valley floor into the
// terraces so the reservoir cannot leak round its ends, and its top stays at least two levels
// above the useful crest. In M1 it is planned with its river in the generation context.

import { fbm } from "../../math/noise";
import { hash32 } from "../../math/hash";
import type { BuildTarget } from "../build";
import type { SetPieceFeature } from "../schema";
import type { SetPieceBuilder } from "./index";

export interface DamSitePlan {
  river: string;
  /** Arc position of the ridge centre along the river. */
  at: number;
  /** Ridge thickness along the river, in tiles. */
  thickness: number;
  /** Half-width of the ridge across the valley (valley half-width + extent past it). */
  halfSpan: number;
  /** Level of the ridge top. */
  topLevel: number;
  /** Useful dam crest above the river bed, 1–3 (PLAN §9.1). */
  crest: number;
  /** Wiggle of the ridge faces, in tiles. */
  wobble: number;
}

export const damSite: SetPieceBuilder = {
  kind: "damSite",
  limits: () => ({
    crest: { min: 1, max: 4, typical: [1, 3] },
    thickness: { min: 3, max: 6 },
    topLevel: { min: 2, max: 16 },
  }),
  rasterize(feature: SetPieceFeature, t: BuildTarget): void {
    const p = feature.params.plan as unknown as DamSitePlan;
    const river = t.river(p.river);
    if (!river) return;
    const field = t.pathField(p.river);
    const channelHalf = river.params.width / 2;
    const noiseSeed = hash32(t.seed, feature.id, "wobble");
    const { W, H, heights } = t;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const d = field.d[i];
        if (d >= p.halfSpan || d < channelHalf + 0.5) continue;
        const wob = p.wobble * fbm(noiseSeed, x, y, 24, 3);
        if (Math.abs(field.s[i] - p.at + wob) > p.thickness / 2) continue;
        if (heights[i] < p.topLevel) heights[i] = p.topLevel;
        t.protect(i);
      }
    }
  },
};
