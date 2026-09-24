// Dam site (PLAN §9.1): a rock ridge across a river valley, cut by the channel, so one short dam
// across the gap holds the basin upstream. The ridge runs well past the valley floor into the
// terraces so the reservoir cannot leak round its ends, and its top stays at least two levels
// above the useful crest. It is planned with its river in the generation context.
//
// The ridge is a straight band square to the valley's axis (the line from the river's source to its
// outlet), as in the prototype, so a river that runs along the axis crosses it exactly once. Each
// end runs on until it has gone SEAL tiles into ground at least one level above the useful crest
// (terrain from build step 2), so the reservoir cannot leak round it (PLAN §20, D25). A band that
// followed the river's arc position (M1) broke up on the inside of bends.

import { fbm } from "../../math/noise";
import { hash32 } from "../../math/hash";
import { bedAt, pointAtArc } from "../geometry";
import type { BuildTarget } from "../build";
import type { SetPieceFeature } from "../schema";
import type { SetPieceBuilder } from "./index";

export interface DamSitePlan {
  river: string;
  /** Arc position of the ridge centre along the river. */
  at: number;
  /** Ridge thickness along the river, in tiles. */
  thickness: number;
  /** The farthest the ridge reaches out from the river on each side, in tiles. */
  halfSpan: number;
  /** Level of the ridge top. */
  topLevel: number;
  /** Useful dam crest above the river bed, 1–3 (PLAN §9.1). */
  crest: number;
  /** Wiggle of the ridge faces, in tiles. */
  wobble: number;
}

/** Tiles the ridge runs on into ground above the crest. */
const SEAL = 4;

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
    const path = river.params.path;
    const c = pointAtArc(path, p.at).p;
    const ax = path[path.length - 1][0] - path[0][0];
    const ay = path[path.length - 1][1] - path[0][1];
    const al = Math.sqrt(ax * ax + ay * ay) || 1;
    const tx = ax / al; // along the valley axis
    const ty = ay / al;
    const nx = -ty; // across it
    const ny = tx;
    const high = bedAt(river.params.bedProfile, p.at) + p.crest + 1;
    const half = p.thickness / 2 + p.wobble;
    // how far the ridge reaches on each side: SEAL tiles into high ground, at most halfSpan
    const reach = [0, 0];
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      let run = 0;
      let k = Math.ceil(channelHalf);
      for (; k < p.halfSpan; k++) {
        let inside = true;
        let allHigh = true;
        for (let a = -Math.ceil(half); a <= Math.ceil(half); a++) {
          const x = Math.round(c[0] + sgn * k * nx + a * tx);
          const y = Math.round(c[1] + sgn * k * ny + a * ty);
          if (x < 0 || x >= W || y < 0 || y >= H) {
            inside = false;
            break;
          }
          if (heights[y * W + x] < high) allHigh = false;
        }
        if (!inside) break;
        run = allHigh ? run + 1 : 0;
        if (run >= SEAL) break;
      }
      reach[side] = k;
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (field.d[i] < channelHalf + 0.5) continue;
        const along = (x - c[0]) * tx + (y - c[1]) * ty;
        if (Math.abs(along) > half) continue;
        const across = (x - c[0]) * nx + (y - c[1]) * ny;
        if (across > reach[0] || -across > reach[1]) continue;
        const wob = p.wobble * fbm(noiseSeed, x, y, 24, 3);
        if (Math.abs(along + wob) > p.thickness / 2) continue;
        if (heights[i] < p.topLevel) heights[i] = p.topLevel;
        t.protect(i);
      }
    }
  },
};
