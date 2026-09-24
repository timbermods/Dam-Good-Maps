// Badwater (PLAN §9.5). M2 builds the prototype's badwater marsh (PLAN §20, D24): a BadwaterSource
// 3×3 beside the river below the falls, as far from the start as the valley allows. The source sits
// in a pit one level below the floodplain, and a one-tile ditch at the same level runs from the pit
// to the river, so the badwater drains straight into the river downstream of the start instead of
// spreading as a sheet over the flat floodplain. The contained side basin with a single outlet (the
// full §9.5 set piece, with the `water.badwater_contained` proof) arrives with the shared builder in
// roadmap M5; its plan will carry an `outlet`.

import type { BuildTarget } from "../build";
import type { SetPieceFeature } from "../schema";
import type { SetPieceBuilder, SetPieceSource } from "./index";

export interface MarshPlan {
  mode: "marsh";
  /** Minimum corner of the 3×3 source (it is placed Cw0, so this is its Coordinates). */
  x: number;
  y: number;
  /** The level of the pit floor and the ditch (one below the floodplain around them). */
  level: number;
  /** BadwaterSource strength, blocks per second over its 9 tiles (1–3, PLAN §5.4). */
  strength: number;
  /** Ditch tiles from the pit to the river, as a flat list x0, y0, x1, y1, ... */
  ditch: number[];
}

function pitTiles(p: MarshPlan): [number, number][] {
  const out: [number, number][] = [];
  for (let y = p.y; y < p.y + 3; y++) for (let x = p.x; x < p.x + 3; x++) out.push([x, y]);
  for (let k = 0; k + 1 < p.ditch.length; k += 2) out.push([p.ditch[k], p.ditch[k + 1]]);
  return out;
}

export const badwaterBasin: SetPieceBuilder = {
  kind: "badwaterBasin",
  limits: () => ({ strength: { min: 1, max: 3 } }),
  rasterize(feature: SetPieceFeature, t: BuildTarget): void {
    const p = feature.params.plan as unknown as MarshPlan;
    if (p.mode !== "marsh") return t.note(`badwater basin ${feature.id}: mode ${String(p.mode)} is not built by this version`);
    for (const [x, y] of pitTiles(p)) {
      if (x < 0 || x >= t.W || y < 0 || y >= t.H) continue;
      t.heights[y * t.W + x] = p.level;
      t.protect(y * t.W + x);
    }
  },
  sources(feature: SetPieceFeature): SetPieceSource[] {
    const p = feature.params.plan as unknown as MarshPlan;
    if (p.mode !== "marsh") return [];
    return [{ template: "BadwaterSource", x: p.x, y: p.y, strength: p.strength, tiles: pitTiles(p).map(([x, y]) => [x - p.x, y - p.y]) }];
  },
};
