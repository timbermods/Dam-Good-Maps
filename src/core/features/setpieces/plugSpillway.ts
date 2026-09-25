// The plugged spillway (PLAN §9.6): a side channel from a lake to lower ground (a map edge, a lower
// river or lake), its bed one level below the lake's sill, closed where it leaves the lake by a line
// of Blockage tiles. The plug's top stands at the sill, so the lake keeps its level and spills over
// the plug as over its own outlet; demolishing the plug lowers the spillway's sill by one level and
// the lake drains a level down it: a strategic choice (drain the lake for its land, or send its
// water down another valley). The map with the plug is what validation proves; the report says what
// removing it does (an estimate from the lake's area, D71).

import { polygonMask } from "../geometry";
import { hash32, tileHash01 } from "../../math/hash";
import { carveChannel, channelBounds, channelTiles, checkChannel, routeChannel, type ChannelPlan } from "../route";
import { clipRect, type BuildTarget, type Rect } from "../target";
import type { LakeFeature, SetPieceFeature } from "../schema";
import { clearsText, fmt, inMap, POINT_SCHEMA, pointOf, type PlanContext, type PlanOutcome, type PlanRecord } from "./common";
import type { SetPieceBlock, SetPieceBuilder } from "./index";

export interface SpillwayPlan {
  lake: string;
  /** The lake's sill: the plug's top. The spillway's bed starts one below. */
  level: number;
  outlet: number[];
  outletLevels: number[];
  outletWidth: number;
  outletTo: string;
  /** The plug's tiles across the channel where it leaves the lake: x0, y0, x1, y1, … */
  plug: number[];
  /** Blocks of water the lake would lose if the plug were demolished (its area × one level). */
  release: number;
}

function outletOf(p: SpillwayPlan): ChannelPlan {
  return { tiles: p.outlet, levels: p.outletLevels, width: p.outletWidth, to: p.outletTo };
}

/** The tiles of a lake's water (its basin, without its islands). */
export function lakeWater(f: LakeFeature, W: number, H: number): Uint8Array {
  const m = polygonMask(f.params.outline, W, H);
  for (const isl of f.params.islands ?? []) {
    const im = polygonMask(isl.outline, W, H);
    for (let i = 0; i < m.length; i++) if (im[i]) m[i] = 0;
  }
  return m;
}

function planSpillway(req: PlanRecord, ctx: PlanContext, id: string | null): PlanOutcome {
  const { W, H } = ctx;
  const lake = ctx.features.find((f): f is LakeFeature => f.kind === "lake" && f.id === req.lake);
  if (!lake) return { ok: false, errors: ["pick a lake: a spillway drains a lake"] };
  if (lake.params.planned || lake.params.river) return { ok: false, errors: ["a reservoir site holds no water until it is dammed: pick a lake"] };
  const level = lake.params.outlet.sill;
  if (level < 1) return { ok: false, errors: ["the lake is at the bottom of the map: there is no lower ground for a spillway"] };
  const width = typeof req.width === "number" ? req.width : 3;
  const at = pointOf(req.at);
  const water = lakeWater(lake, W, H);
  // the route leaves the lake's water (its tiles never set the spillway's bed) through the shore near
  // the point asked for (anywhere on the shore without one)
  const from: number[] = [];
  let near = 0;
  for (let i = 0; i < W * H; i++) {
    if (!water[i]) continue;
    from.push(i);
    const x = i % W;
    const y = (i - x) / W;
    if (!at || (x - at[0]) * (x - at[0]) + (y - at[1]) * (y - at[1]) <= 36) near++;
  }
  if (!near) return { ok: false, errors: ["click the lake's shore where the spillway should leave it"] };
  const blocked = new Uint8Array(W * H);
  if (ctx.start) {
    const r = ctx.start.radius + 4;
    for (let y = ctx.start.y - r; y <= ctx.start.y + r; y++) for (let x = ctx.start.x - r; x <= ctx.start.x + r; x++) if (inMap(W, H, x, y)) blocked[y * W + x] = 1;
  }
  const lakeMask = polygonMask(lake.params.outline, W, H);
  for (let i = 0; i < W * H; i++) {
    if (ctx.locked?.[i] || ctx.protect?.[i] || (lakeMask[i] && !water[i])) blocked[i] = 1;
    // the shore away from the point asked for is closed
    if (at && !lakeMask[i]) {
      const x = i % W;
      const y = (i - x) / W;
      const touches = (x > 0 && water[i - 1]) || (x < W - 1 && water[i + 1]) || (y > 0 && water[i - W]) || (y < H - 1 && water[i + W]);
      if (touches && (x - at[0]) * (x - at[0]) + (y - at[1]) * (y - at[1]) > 49) blocked[i] = 1;
    }
  }
  for (const i of from) blocked[i] = 0;
  const route = routeChannel({ W, H, heights: ctx.heights, features: ctx.features, channel: ctx.channel, occupied: ctx.occupied }, from, level - 1, width, blocked, id ?? lake.id);
  if (!route) return { ok: false, errors: ["there is no lower ground for the spillway to drain to from here"] };
  if (route.to === lake.id) return { ok: false, errors: ["the spillway would drain back into its own lake"] };
  // the plug: every channel tile beside the lake's water, so the water reaches the spillway only
  // over the plug (a straight channel out of a straight shore: the line across its first tile)
  const plug: number[] = [];
  for (const i of [...channelTiles(route, W, H).bed.keys()].sort((a, b) => a - b)) {
    if (water[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    if ((x > 0 && water[i - 1]) || (x < W - 1 && water[i + 1]) || (y > 0 && water[i - W]) || (y < H - 1 && water[i + W])) plug.push(x, y);
  }
  if (plug.length < 2 || plug.length > 18) return { ok: false, errors: ["the spillway would leave the lake along its shore: pick another place"] };
  let area = 0;
  for (let i = 0; i < W * H; i++) area += water[i];
  const plan: SpillwayPlan = { lake: lake.id, level, outlet: route.tiles, outletLevels: route.levels, outletWidth: route.width, outletTo: route.to, plug, release: area };
  const target = route.to === "edge" ? "the map edge" : `the ${ctx.features.find((f) => f.id === route.to)?.kind === "lake" ? "lake" : "river"}`;
  const report = [
    `a spillway ${route.width} tile${route.width > 1 ? "s" : ""} wide and ${route.levels.length} long runs from the lake to ${target}, closed by a plug of ${plug.length / 2} Blockage tile${plug.length > 2 ? "s" : ""}`,
    `demolishing the plug lowers the lake by about one level: about ${fmt(area)} water flows down the spillway`,
  ];
  const cleared = clearsText(ctx, new Set(channelTiles(route, W, H).bed.keys()));
  if (cleared) report.push(`clears ${cleared}`);
  return { ok: true, request: req, plan: plan as unknown as PlanRecord, report };
}

export const plugSpillway: SetPieceBuilder = {
  kind: "plugSpillway",
  request: {
    type: "object",
    required: ["lake"],
    properties: {
      lake: { type: "string" },
      at: POINT_SCHEMA,
      width: { enum: [1, 3, 5] },
    },
  },
  limits: () => ({ width: { min: 1, max: 5 } }),
  plan: planSpillway,
  check(plan: PlanRecord, W: number, H: number): string[] {
    const p = plan as unknown as SpillwayPlan;
    if (typeof p.lake !== "string") return ["a spillway belongs to a lake"];
    if (!Number.isInteger(p.level) || p.level < 1 || p.level > 16) return ["the spillway's plug stands at level 1–16"];
    if (!Array.isArray(p.plug) || p.plug.length < 2 || p.plug.length % 2) return ["the spillway needs its plug"];
    for (let k = 0; k < p.plug.length; k += 2) if (!inMap(W, H, p.plug[k], p.plug[k + 1])) return ["the spillway's plug is off the map"];
    const c = checkChannel(outletOf(p), W, H);
    if (c.length) return c;
    return p.outletLevels[0] < p.level ? [] : ["the spillway's bed must start below its plug"];
  },
  rasterize(feature: SetPieceFeature, t: BuildTarget): void {
    carveChannel(outletOf(feature.params.plan as unknown as SpillwayPlan), t, feature);
  },
  footprint(feature: SetPieceFeature, t: Pick<BuildTarget, "W" | "H">): Rect | "all" | null {
    const b = channelBounds(outletOf(feature.params.plan as unknown as SpillwayPlan));
    return b && clipRect(b, t.W, t.H, 1);
  },
  blocks(feature: SetPieceFeature): SetPieceBlock[] {
    const p = feature.params.plan as unknown as SpillwayPlan;
    const sO = hash32(feature.id, "orientation");
    const sF = hash32(feature.id, "flip");
    const out: SetPieceBlock[] = [];
    for (let k = 0; k + 1 < p.plug.length; k += 2) {
      const x = p.plug[k];
      const y = p.plug[k + 1];
      out.push({ template: "Blockage", x, y, turn: Math.floor(tileHash01(sO, x, y) * 4), flipped: tileHash01(sF, x, y) < 0.5 });
    }
    return out;
  },
  clears(feature: SetPieceFeature, W: number, H: number): number[] {
    const { bed, bank } = channelTiles(outletOf(feature.params.plan as unknown as SpillwayPlan), W, H);
    return [...new Set([...bed.keys(), ...bank.keys()])].sort((a, b) => a - b);
  },
  area(feature: SetPieceFeature, W: number, H: number): number[] {
    return [...channelTiles(outletOf(feature.params.plan as unknown as SpillwayPlan), W, H).bed.keys()].sort((a, b) => a - b);
  },
};
