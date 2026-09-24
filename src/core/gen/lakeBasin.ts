// Lake Basin (PLAN §8), premise "Rising lake": a lake at the heart of the map at its spill level, fed
// by rivers from the edges, with one outlet to the east edge through a narrow gap: the prime dam site,
// where a short dam raises the whole lake. Terraces rise from the shore to the highlands at the map's
// edges, in rings round the lake. The colony starts on a shore bench one above the lake.
//
// Like the valley planner (valley.ts), the settings move the layout: relief sets how far the land
// rises from the lake floor to the highest terrain, terracing how many of the rings' rises are one
// level, buildable land the width of the shore, rivers the number of inflows (0: the lake has a
// spring), river flow their water, waterfalls the falls on them, drought reserve the lake's depth,
// lakes and basins the riverside ponds, and the badwater settings the badwater basins, whose
// outlets join the outlet river below the dam site.

import { slopeHighSide, type Orientation } from "../format/footprints";
import { walkRegions } from "../analysis/regions";
import { buildMap, START_CLEAR_RADIUS, type SettleCache } from "../features/build";
import { featureId } from "../features/ids";
import { pathField, pointAtArc, polygonMask, round } from "../features/geometry";
import { planSetPiece, type PlanContext as PieceContext } from "../features/setpieces";
import { lakeWater } from "../features/setpieces/plugSpillway";
import type { BedStep, Feature, LakeFeature, LandformFeature, Point, RiverFeature, SetPieceFeature, StartFeature } from "../features/schema";
import { cosDet, PI, sinDet, TWO_PI } from "../math/detmath";
import { distanceFrom } from "../math/grid";
import { stream, type Rng } from "../math/rng";
import type { MapSpec } from "../spec/mapspec";
import { bandsFor, drawBands, fitRelief, layoutTargets } from "./layout";
import { farReach, MAX_LAYOUT_TRIES, objectsAndResources, PlanConflict, riverWidth, type PlanContext } from "./valley";
import { groundOf, placeBadwater, placeRiversidePonds, reachOf } from "./water";

/** Layout parameters per archetype (PLAN §8: a typed table). */
export const LAKES = {
  lakeBasin: {
    /** The lake's share of a 128² map (PLAN §6: target water share 0.30 with the rivers). */
    lakeShare: [0.18, 0.24] as [number, number],
    /** Larger maps shrink the share by (128² ÷ area) to this power (a lake fills by its outlet's
     *  head over its whole area, D64). */
    shrink: 0.75,
    /** The lake's radius at most this share of the map's side, and at least `ring` tiles (a
     *  share of the side) of land round it. */
    maxRadius: 0.34,
    ring: 0,
    /** Wobble of the outline. */
    wobble: [0.04, 0.1, 0.03, 0.07] as [number, number, number, number],
    /** The shore bench round the lake, in tiles, by buildable land. */
    shore: { tight: 11, normal: 14, generous: 18 },
    /** Outline points round the lake and its rings. */
    points: 32,
    /** Islands in the lake: none. */
    islands: false,
  },
  islands: {
    // a sea of 40–48% of a 128² map (PLAN §6: target water share 0.45), a smaller share beyond
    lakeShare: [0.4, 0.48] as [number, number],
    shrink: 0.5,
    maxRadius: 0.44,
    ring: 0.09,
    wobble: [0.03, 0.06, 0.02, 0.05] as [number, number, number, number],
    shore: { tight: 9, normal: 11, generous: 14 },
    points: 40,
    islands: true,
  },
};
export const LAKE_BASIN = LAKES.lakeBasin;

const BENCH_RADIUS = { small: 5, normal: 6, large: 8 } as const;

export function planLakeBasin(spec: MapSpec, attempt: number, candidate = 0, settleCache?: SettleCache, context?: PlanContext): Feature[] {
  const W = spec.size.x;
  const H = spec.size.y;
  const seed = spec.seed;
  const t = layoutTargets(spec);
  const rng = stream(seed, "layout", candidate, attempt);
  const id = (kind: Feature["kind"], role: string) => featureId(seed, kind, role);
  const hard = spec.designedFor === "hard";
  const A = spec.archetype === "islands" ? LAKES.islands : LAKES.lakeBasin;
  // the lake keeps its water below the outlet's sill through a drought: deeper for more reserve,
  // and 4 deep on Hard (30 days evaporate 1.6)
  const floorDepth = hard ? 4 : t.reserve >= 3 ? 3 : 2;

  for (let tryN = 0; ; tryN++) {
    // ------------------------------------------------------------------ the lake's shape
    // on maps larger than 128² the lake's share shrinks with the side (the official Lakes map, 256²,
    // is 14% water): a lake fills by its outlet's head over its whole area, and a vast one would
    // not settle within the canonical settle's 4 days
    const r = Math.min(1, 16384 / (W * H));
    const shrink = A.shrink === 0.75 ? Math.sqrt(r) * Math.sqrt(Math.sqrt(r)) : Math.sqrt(r); // × r^0.75 or r^0.5
    const share = rng.range(A.lakeShare[0], A.lakeShare[1]) * shrink;
    const aspect = rng.range(0.8, 1.25);
    const rMean = Math.sqrt((share * W * H) / PI);
    const cx = W * rng.range(0.42, 0.48);
    const cy = H * rng.range(0.46, 0.54);
    const ph1 = rng.float() * TWO_PI;
    const ph2 = rng.float() * TWO_PI;
    const a1 = rng.range(A.wobble[0], A.wobble[1]);
    const a2 = rng.range(A.wobble[2], A.wobble[3]);
    // the lake keeps a ring of land round it (Islands: its shore and the start)
    const land = Math.round(A.ring * Math.min(W, H));
    const fit = 1 + A.wobble[1] + A.wobble[3];
    const rx = Math.min(A.maxRadius * W, rMean * Math.sqrt(aspect), land ? (Math.min(cx, W - 1 - cx) - land) / fit : Infinity);
    const ry = Math.min(A.maxRadius * H, rMean / Math.sqrt(aspect), land ? (Math.min(cy, H - 1 - cy) - land) / fit : Infinity);
    /** The lake's radius factor at angle θ (a smooth wobble, no trigonometry beyond detmath). */
    const wob = (th: number) => 1 + a1 * sinDet(2 * th + ph1) + a2 * sinDet(3 * th + ph2);
    const ring = (grow: number): Point[] => {
      const out: Point[] = [];
      const n = A.points;
      for (let k = 0; k < n; k++) {
        const th = (TWO_PI * k) / n;
        const f = wob(th);
        out.push([round(cx + (rx * f + grow) * cosDet(th), 2), round(cy + (ry * f + grow) * sinDet(th), 2)]);
      }
      return out;
    };
    const lakeOutline = ring(0);
    const shore = A.shore[spec.settings.terrain.buildableLand];
    // how far the rings may reach: to the nearest map edge, less a margin
    const room = Math.max(8, Math.min(cx - rx, W - 1 - cx - rx, cy - ry, H - 1 - cy - ry) * 1.25 - shore - 2);
    const draws = drawBands(rng, t.p1);

    // ---- rivers: the outlet east, inflows from the other edges at angles apart from each other
    const inflows = Math.min(3, t.rivers);
    const inflowAngles: number[] = [];
    const baseAngles = [PI, 0.55 * PI, 1.45 * PI]; // west, north, south
    const order = rng.shuffle([0, 1, 2]);
    for (let k = 0; k < inflows; k++) inflowAngles.push(baseAngles[order[k]] + rng.range(-0.18, 0.18) * PI);
    const outAngle = rng.range(-0.15, 0.15) * PI;
    const inflowFlow = inflows ? round(t.flow / inflows, 2) : 0;
    // Islands' sea drains by two outlets, each sized for half the water
    const outW = riverWidth(A.islands ? round(t.flow / 2, 2) : t.flow, W);
    const inW = inflows ? riverWidth(inflowFlow, W) : 0;
    const startAngleDraw = rng.float();
    const startEdgeDraw = rng.int(6, 10);
    const stepDraws = [0, 1, 2, 3].map(() => rng.float());
    const damDraw = rng.range(0.45, 0.6);

    const lakeId = id("lake", "lake/central");
    const outId = id("river", "river/outlet");
    const lakePoint = (th: number): Point => {
      const f = wob(th);
      return [cx + rx * f * cosDet(th), cy + ry * f * sinDet(th)];
    };
    // Islands: 6–25 islands of 100+ tiles in the sea, clear of the rivers' mouths (PLAN §8)
    // Islands' second outlet: of west, north and south, the way farthest from the inflows
    let second: { angle: number; end: Point; edge: "west" | "east" | "south" | "north" } | null = null;
    if (A.islands) {
      let best = -1;
      let angle = PI;
      for (const a of [PI, 0.5 * PI, 1.5 * PI]) {
        let gap = Infinity;
        for (const u of inflowAngles) {
          let dd = Math.abs(a - u) % TWO_PI;
          if (dd > PI) dd = TWO_PI - dd;
          gap = Math.min(gap, dd);
        }
        if (gap > best + 1e-9) {
          best = gap;
          angle = a;
        }
      }
      const dx = cosDet(angle);
      const dy = sinDet(angle);
      let tEdge = Infinity;
      if (dx > 1e-9) tEdge = Math.min(tEdge, (W - 1 - cx) / dx);
      if (dx < -1e-9) tEdge = Math.min(tEdge, -cx / dx);
      if (dy > 1e-9) tEdge = Math.min(tEdge, (H - 1 - cy) / dy);
      if (dy < -1e-9) tEdge = Math.min(tEdge, -cy / dy);
      const ex = cx + tEdge * dx;
      const ey = cy + tEdge * dy;
      const edge = Math.abs(ex) < 0.5 ? "west" : Math.abs(ex - (W - 1)) < 0.5 ? "east" : Math.abs(ey) < 0.5 ? "south" : "north";
      const end: Point = edge === "west" || edge === "east" ? [edge === "west" ? 0 : W - 1, round(Math.min(H - 13, Math.max(12, ey)), 2)] : [round(Math.min(W - 13, Math.max(12, ex)), 2), edge === "south" ? 0 : H - 1];
      second = { angle, end, edge };
    }
    const islandDraws = A.islands ? placeIslands(rng, lakeOutline, [outAngle, ...inflowAngles, ...(second ? [second.angle] : [])].map(lakePoint), W, H) : [];

    const make = (shift: number) => {
      // levels: the lake floor sits `range` below the highest terrain; the lake's level L is its
      // outlet's sill, and the shore one above it
      const L = Math.max(floorDepth + 1, Math.min(t.top - 4, t.top - t.range + floorDepth + shift));
      const lift = t.top - (L + 1);
      const bands = bandsFor(draws, lift, room, undefined, 0, t.land.cliffs);
      // the highlands, then rings from the outermost down to the shore
      const features: Feature[] = [];
      features.push({
        id: id("landform", "landform/highlands"),
        kind: "landform",
        origin: "generated",
        role: "landform/highlands",
        locked: false,
        params: { kind: "plateau", edgeStyle: "cliff", outline: [[-1, -1], [W, -1], [W, H], [-1, H]], height: t.top },
      } as LandformFeature);
      let level = t.top;
      for (let k = bands.length - 1; k >= 0; k--) {
        level -= bands[k].rise;
        const grow = shore + bands[k].at;
        features.push({
          id: id("landform", `landform/ring/${k}`),
          kind: "landform",
          origin: "generated",
          role: `landform/ring/${k}`,
          locked: false,
          params: { kind: "valley", edgeStyle: bands[k].rise > 1 ? "cliff" : "terraced", outline: ring(grow), height: level },
        } as LandformFeature);
      }

      // the outlet: from the lake's edge to the east edge, its bed at the lake's level to the dam
      // site, then down in steps
      const o0 = lakePoint(outAngle);
      const ey = Math.min(H - 12, Math.max(12, o0[1] + (W - 1 - o0[0]) * 0.25 * sinDet(outAngle)));
      const outPath: Point[] = [];
      const n = 8;
      for (let q = 0; q <= n; q++) {
        const u = q / n;
        const x = o0[0] + (W - 1 - o0[0]) * u;
        const y = o0[1] + (ey - o0[1]) * u + 2.5 * sinDet(PI * u) * (stepDraws[3] - 0.5);
        outPath.push([round(x, 2), round(y, 2)]);
      }
      outPath[outPath.length - 1] = [W - 1, round(ey, 2)];
      const outLen = pathLen(outPath);
      const sDam = round(outLen * damDraw, 2);
      // below the dam site the outlet falls 2 to the edge when the waterfalls are Many and there is
      // room (12 tiles clear of the ridge and the edge)
      const outSteps: BedStep[] = [];
      if (t.waterfalls === "many" && outLen - 6 - (sDam + 12) >= 0 && L >= 3) {
        outSteps.push({ at: round((sDam + 12 + outLen - 6) / 2, 2), drop: 2, setPiece: id("setPiece", "setpiece/waterfall/outlet/0") });
      }
      const outlet: RiverFeature = {
        id: outId,
        kind: "river",
        origin: "generated",
        role: "river/outlet",
        locked: false,
        params: {
          path: outPath,
          width: outW,
          bedDepth: 1,
          bedProfile: { start: L, steps: outSteps },
          flow: round(t.flow, 2),
          style: "straight",
          entry: { lake: lakeId },
          exit: { edge: "east" },
          badwater: false,
        },
      };
      const rivers: RiverFeature[] = [outlet];
      // Islands: a second outlet carries half the sea's water to another edge, so the sea rises
      // only a little above its sill and settles within the canonical settle's days (D70)
      if (second) {
        const [x0, y0] = lakePoint(second.angle);
        const pts: Point[] = [];
        for (let q = 0; q <= 8; q++) {
          const u = q / 8;
          pts.push([round(x0 + (second.end[0] - x0) * u, 2), round(y0 + (second.end[1] - y0) * u, 2)]);
        }
        pts[8] = [second.end[0], second.end[1]];
        rivers.push({
          id: id("river", "river/outlet/1"),
          kind: "river",
          origin: "generated",
          role: "river/outlet/1",
          locked: false,
          params: { path: pts, width: outW, bedDepth: 1, bedProfile: { start: L, steps: [] }, flow: round(t.flow / 2, 2), style: "straight", entry: { lake: lakeId }, exit: { edge: second.edge }, badwater: false },
        });
      }
      const valleys: LandformFeature[] = [
        {
          id: id("landform", "landform/valley/outlet"),
          kind: "landform",
          origin: "generated",
          role: "landform/valley/outlet",
          locked: false,
          params: { kind: "valley", edgeStyle: "cliff", along: { river: outId, halfWidth: round(outW / 2 + 3, 2), floorAboveBed: 1 } },
        },
      ];
      if (second)
        valleys.push({
          id: id("landform", "landform/valley/outlet/1"),
          kind: "landform",
          origin: "generated",
          role: "landform/valley/outlet/1",
          locked: false,
          params: { kind: "valley", edgeStyle: "cliff", along: { river: id("river", "river/outlet/1"), halfWidth: round(outW / 2 + 3, 2), floorAboveBed: 1 } },
        });

      // inflows: from the map edge down to the lake's level, in 1-level steps (2-level falls when
      // the waterfalls are Few or Many: one on each of the first two rivers, or every step)
      for (let k = 0; k < inflows; k++) {
        const th = inflowAngles[k];
        const end = lakePoint(th);
        const dx = cosDet(th);
        const dy = sinDet(th);
        // the edge point along the direction from the lake's middle
        let tEdge = Infinity;
        if (dx > 1e-9) tEdge = Math.min(tEdge, (W - 1 - cx) / dx);
        if (dx < -1e-9) tEdge = Math.min(tEdge, -cx / dx);
        if (dy > 1e-9) tEdge = Math.min(tEdge, (H - 1 - cy) / dy);
        if (dy < -1e-9) tEdge = Math.min(tEdge, -cy / dy);
        let ex = cx + tEdge * dx;
        let ey2 = cy + tEdge * dy;
        const edge = Math.abs(ex) < 0.5 ? "west" : Math.abs(ex - (W - 1)) < 0.5 ? "east" : Math.abs(ey2) < 0.5 ? "south" : "north";
        ex = Math.min(W - 1, Math.max(0, round(ex, 2)));
        ey2 = Math.min(H - 1, Math.max(0, round(ey2, 2)));
        // keep the mouth 10 tiles off the corners
        if (edge === "west" || edge === "east") ey2 = Math.min(H - 11, Math.max(10, ey2));
        else ex = Math.min(W - 11, Math.max(10, ex));
        const path: Point[] = [];
        const m = 6;
        for (let q = 0; q <= m; q++) {
          const u = q / m;
          path.push([round(ex + (end[0] - ex) * u, 2), round(ey2 + (end[1] - ey2) * u, 2)]);
        }
        const len = pathLen(path);
        const entryBed = Math.max(L, t.top - 3);
        const climb = entryBed - L;
        // one fall (2–3 levels) where the river reaches the shore when the waterfalls are Few (the
        // first inflow) or Many (every inflow); the rest of the climb in 1-level steps upstream of
        // it, 12 tiles clear of the fall
        const fallHere = climb >= 2 && (t.waterfalls === "many" || (t.waterfalls === "few" && k === 0));
        const steps: BedStep[] = [];
        const reach = len - shore - 4; // arc positions from the edge; the stretch across the shore stays flat
        // a short river takes its whole climb in the fall (no step within 12 tiles of it)
        const top1 = fallHere ? reach - 13 : reach;
        const fallDrop = fallHere ? (top1 < 6 ? climb : Math.min(3, climb)) : 0;
        const ones = climb - fallDrop;
        for (let q = 0; q < ones; q++) steps.push({ at: round(3 + ((Math.max(4, top1) - 3) * (q + 0.5 + 0.3 * (stepDraws[k] - 0.5))) / ones, 2), drop: 1 });
        if (fallHere) steps.push({ at: round(Math.max(4, reach), 2), drop: fallDrop, setPiece: id("setPiece", `setpiece/waterfall/inflow/${k}`) });
        const rid = id("river", `river/inflow/${k}`);
        rivers.push({
          id: rid,
          kind: "river",
          origin: "generated",
          role: `river/inflow/${k}`,
          locked: false,
          params: {
            path,
            width: inW,
            bedDepth: 1,
            bedProfile: { start: L + steps.reduce((a, s) => a + s.drop, 0), steps },
            flow: inflowFlow,
            style: "straight",
            entry: { edge },
            exit: { lake: lakeId },
            badwater: false,
          },
        });
        valleys.push({
          id: id("landform", `landform/valley/inflow/${k}`),
          kind: "landform",
          origin: "generated",
          role: `landform/valley/inflow/${k}`,
          locked: false,
          params: { kind: "valley", edgeStyle: "cliff", along: { river: rid, halfWidth: round(inW / 2 + 3, 2), floorAboveBed: 1 } },
        });
      }

      const lake: LakeFeature = {
        id: lakeId,
        kind: "lake",
        origin: "generated",
        role: "lake/central",
        locked: false,
        params: {
          outline: lakeOutline,
          floorDepth,
          outlet: { at: [round(o0[0], 2), round(o0[1], 2)], sill: L, to: "river", target: outId },
          inflow: inflows ? { rivers: rivers.filter((r) => r.role?.startsWith("river/inflow/")).map((r) => r.id) } : { spring: round(t.flow, 2) },
          planned: false,
          ...(islandDraws.length ? { islands: islandDraws.map((i) => ({ outline: i.outline, height: Math.min(t.top, L + i.rise) })) } : {}),
        },
      };

      // the set pieces: the dam site on the outlet (its crest 1: the shore stays dry when the lake
      // rises), and the falls on the rivers
      const piece = (kind: SetPieceFeature["params"]["kind"], request: Record<string, number | string>, role: string): SetPieceFeature => {
        const ctx: PieceContext = { W, H, seed, features: rivers, heights: new Uint8Array(0) };
        const r = planSetPiece(kind, request, ctx, { id: id("setPiece", role), origin: "generated", role }, true);
        if (!r.ok) throw new Error(`Lake Basin's ${role}: ${r.errors.join("; ")}`);
        return r.feature;
      };
      const damSite = piece("damSite", { river: outId, at: sDam, crest: 1 }, "setpiece/damSite/primary");
      const falls: SetPieceFeature[] = [];
      for (const r of rivers)
        for (const st of r.params.bedProfile.steps)
          if (st.setPiece) {
            const role = Object.keys(roleIds).find((k) => roleIds[k] === st.setPiece) ?? "";
            falls.push(piece("waterfall", { mode: "on-river", river: r.id, at: st.at, drop: st.drop }, role));
          }

      // the start: on the shore, 6–10 tiles from the water, at the angle farthest from the
      // rivers' mouths, its door toward the lake
      const used = [outAngle, ...inflowAngles, ...(second ? [second.angle] : [])];
      let bestTh = 0;
      let bestGap = -1;
      const samples = 72;
      for (let q = 0; q < samples; q++) {
        const th = (TWO_PI * (q + startAngleDraw)) / samples;
        let gap = Infinity;
        for (const u of used) {
          let d = Math.abs(th - u) % TWO_PI;
          if (d > PI) d = TWO_PI - d;
          gap = Math.min(gap, d);
        }
        if (gap > bestGap + 1e-9) {
          bestGap = gap;
          bestTh = th;
        }
      }
      const edge = Math.max(3, Math.min(Math.max(3, spec.settings.start.rules.waterWithin - 4), startEdgeDraw));
      const lp = lakePoint(bestTh);
      const nx = cosDet(bestTh);
      const ny = sinDet(bestTh);
      const sx = Math.round(lp[0] + nx * (edge + 1.5));
      const sy = Math.round(lp[1] + ny * (edge + 1.5));
      const orientation: Orientation = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? "Cw90" : "Cw270") : ny > 0 ? "Cw0" : "Cw180";
      const start: StartFeature = {
        id: id("start", "start/main"),
        kind: "start",
        origin: "generated",
        role: "start/main",
        locked: false,
        params: { position: [sx, sy], orientation, benchRadius: BENCH_RADIUS[spec.settings.start.area], benchLevel: L + 1, player: 0 },
      };
      const all: Feature[] = [...rivers, ...features, ...valleys, lake, damSite, ...falls, start];
      return { features: all, rivers, lake, start, damSite, outlet, L };
    };
    const roleIds: Record<string, string> = { "setpiece/waterfall/outlet/0": id("setPiece", "setpiece/waterfall/outlet/0") };
    for (let k = 0; k < 3; k++) roleIds[`setpiece/waterfall/inflow/${k}`] = id("setPiece", `setpiece/waterfall/inflow/${k}`);

    const fitted = fitRelief(make, t.range, W, H, seed, { min: -6, max: 6 });
    if (!fitted) throw new Error("Lake Basin: no layout");
    const { lake, start, damSite, outlet } = fitted;
    const layout = fitted.features;
    if (context?.protect) {
      const hit = conflict(context.protect, W, H, fitted.rivers, lake, start);
      if (hit) {
        if (tryN + 1 < MAX_LAYOUT_TRIES) continue;
        throw new PlanConflict(`the lake basin could not keep ${hit} off your features, locks and keep-out areas (${MAX_LAYOUT_TRIES} layouts tried)`);
      }
    }

    // ------------------------------------------------------------------ on the built ground
    const extrasRng = stream(seed, "extras", candidate, attempt);
    const others = context?.features ?? [];
    let ground = groundOf(W, H, seed, [...layout, ...others]);
    const [sx, sy] = start.params.position;
    const zone = { x: sx, y: sy, radius: Math.max(start.params.benchRadius, START_CLEAR_RADIUS) + 1 };
    const lakeMask = polygonMask(lake.params.outline, W, H);
    const band = bandAround(W, H, outlet, damSite);
    const avoidWith = (margin: number) => {
      const a = new Uint8Array(W * H);
      for (let i = 0; i < a.length; i++) {
        const x = i % W;
        const y = (i - x) / W;
        if (lakeMask[i] || band[i] || ground.protect[i] || context?.protect?.[i] || x < 3 || y < 3 || x > W - 4 || y > H - 4) a[i] = 1;
        if (Math.abs(x - zone.x) <= zone.radius + margin && Math.abs(y - zone.y) <= zone.radius + margin) a[i] = 1;
      }
      // a ring of 3 round the lake stays shore
      const near = lakeNear(lakeMask, W, H, 3);
      for (let i = 0; i < a.length; i++) if (near[i]) a[i] = 1;
      return a;
    };

    // the plugged spillway (PLAN §9.6): from the lake, on the side farthest from the start and the
    // rivers' mouths, to lower ground; the lake spills over its plug as over its outlet
    // (a spillway cuts the shore: it goes only where it leaves the land the colony walks on whole)
    const walked = startLand(W, H, seed, [...layout, ...others], lakeMask, sx, sy);
    for (const spill of planLakeSpillways(ground, lake, [...layout, ...others], zone, context?.protect ?? null, id)) {
      const withIt = [...layout, ...others];
      withIt.splice(layout.indexOf(start), 0, spill);
      if (startLand(W, H, seed, withIt, lakeMask, sx, sy) < 0.9 * walked) continue;
      layout.splice(layout.indexOf(start), 0, spill);
      ground = groundOf(W, H, seed, [...layout, ...others]);
      break;
    }

    // badwater first: its outlets join the outlet river below its fall (never at the lake's own
    // level: the canonical pre-fill would spread it into the lake), or run to a map edge; never
    // near the lake or an inflow
    const riversAll = layout.filter((f): f is RiverFeature => f.kind === "river");
    const outStep = outlet.params.bedProfile.steps[0];
    const drains = outStep ? [reachOf(outlet, Math.max(outStep.at + 4, farReach(outlet.params.path, sx, sy, t.badwaterDistance + 12)))] : [];
    // no outlet runs within 4 tiles of the lake: its carve would breach the lake's rim
    const noRoute = lakeNear(lakeMask, W, H, 4);
    for (let i = 0; i < noRoute.length; i++) if (lakeMask[i] || band[i] || context?.protect?.[i]) noRoute[i] = 1;
    const avoid = avoidWith(10);
    for (let i = 0; i < avoid.length; i++) if (noRoute[i] || ground.channel[i]) avoid[i] = 1;
    const bad = placeBadwater({
      rng: extrasRng,
      ground,
      t,
      drains,
      avoid,
      noRoute,
      start: { x: sx, y: sy },
      idOf: (k) => ({ id: id("setPiece", `setpiece/badwaterBasin/${k}`), role: `setpiece/badwaterBasin/${k}` }),
    });
    const pondsAvoid = avoidWith(2);
    let tainted = -1;
    if (bad.length) {
      layout.splice(layout.indexOf(start), 0, ...bad);
      ground = groundOf(W, H, seed, [...layout, ...others]);
      for (const b of bad) {
        const p = b.params.plan as { outlet: number[]; outletTo: string; x: number; y: number };
        for (let yy = p.y - 3; yy <= p.y + 5; yy++) for (let xx = p.x - 3; xx <= p.x + 5; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) pondsAvoid[yy * W + xx] = 1;
        for (let k = 0; k + 1 < p.outlet.length; k += 2)
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) {
              const xx = p.outlet[k] + dx;
              const yy = p.outlet[k + 1] + dy;
              if (xx >= 0 && yy >= 0 && xx < W && yy < H) pondsAvoid[yy * W + xx] = 1;
            }
        if (p.outletTo === outlet.id) tainted = Math.max(tainted, bedAtEnd(outlet));
      }
    }

    // riverside ponds (Lakes and basins): the lake is one natural basin already
    const ponds = placeRiversidePonds({
      rng: extrasRng,
      ground,
      rivers: riversAll,
      count: Math.max(0, t.basins - 1),
      avoid: pondsAvoid,
      floorDepth: hard ? 3 : 2,
      minSill: tainted + 1,
      idOf: (k) => ({ id: id("lake", `lake/pond/${k}`), role: `lake/pond/${k}` }),
    });
    if (ponds.length) layout.splice(layout.indexOf(start), 0, ...ponds);

    // ------------------------------------------------------------------ objects and resources on the settled water
    const resources = objectsAndResources(spec, layout, others, context, candidate, attempt, settleCache, band);
    return [...layout, ...resources];
  }
}

/** Tiles the colony walks on from the start (same level and the derived slopes), off the lake. */
function startLand(W: number, H: number, seed: number, features: readonly Feature[], lake: Uint8Array, sx: number, sy: number): number {
  const b = buildMap({ W, H, seed, features }, { stopBeforeWater: true });
  const links: [number, number][] = [];
  for (const s of b.slopes) {
    const [dx, dy] = slopeHighSide(s.orientation);
    const hx = s.x + dx;
    const hy = s.y + dy;
    if (hx >= 0 && hy >= 0 && hx < W && hy < H) links.push([s.y * W + s.x, hy * W + hx]);
  }
  const labels = walkRegions(b.heights, W, H, null, links);
  const root = labels[sy * W + sx];
  let n = 0;
  for (let i = 0; i < W * H; i++) if (root >= 0 && labels[i] === root && !lake[i]) n++;
  return n;
}

/** Plugged spillways from a lake (PLAN §9.6), best first: each leaves the lake a few tiles beside a
 *  river's mouth (so it cuts the shore next to a cut already there) far from the start, and runs to
 *  the nearest lower ground; rivers above its bed and their banks are kept out of its way (it would
 *  dig them down and drain the lake past its plug). */
function planLakeSpillways(
  g: { W: number; H: number; seed: number; heights: Uint8Array; channel: Uint8Array; protect: Uint8Array },
  lake: LakeFeature,
  features: readonly Feature[],
  zone: { x: number; y: number; radius: number },
  protect: Uint8Array | null,
  id: (kind: Feature["kind"], role: string) => string,
): SetPieceFeature[] {
  const { W, H } = g;
  const L = lake.params.outlet.sill;
  const water = lakeWater(lake, W, H);
  const outline = lake.params.outline;
  // the rivers' mouths on the lake: their path ends in it
  const mouths: Point[] = [];
  for (const f of features) {
    if (f.kind !== "river") continue;
    const p = f.params.path;
    if ("lake" in f.params.exit && f.params.exit.lake === lake.id) mouths.push(p[p.length - 1]);
    if ("lake" in f.params.entry && f.params.entry.lake === lake.id) mouths.push(p[0]);
  }
  // the shore's points 8–16 tiles from their nearest mouth, farthest from the start first
  const points: [number, Point][] = [];
  for (const p of outline) {
    let dm = Infinity;
    for (const m of mouths) dm = Math.min(dm, Math.sqrt((p[0] - m[0]) * (p[0] - m[0]) + (p[1] - m[1]) * (p[1] - m[1])));
    if (dm < 8 || dm > 16) continue;
    points.push([(p[0] - zone.x) * (p[0] - zone.x) + (p[1] - zone.y) * (p[1] - zone.y), p]);
  }
  points.sort((a, b) => b[0] - a[0]);
  // rivers above the spillway's bed, with two tiles of bank, are out of its way
  const keep = protect ? protect.slice() : new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!g.channel[i] || g.heights[i] <= L - 1 || water[i]) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) keep[yy * W + xx] = 1;
        }
    }
  const ctx: PieceContext = { W, H, seed: g.seed, features, heights: g.heights, channel: g.channel, start: zone, locked: keep, protect: g.protect };
  const role = "setpiece/plugSpillway/primary";
  const out: SetPieceFeature[] = [];
  for (const [, p] of points) {
    if (out.length >= 3) break;
    // 12+ tiles from a spillway already found
    const plan0 = (f: SetPieceFeature) => f.params.plan as { outlet: number[] };
    if (out.some((f) => (plan0(f).outlet[0] - p[0]) * (plan0(f).outlet[0] - p[0]) + (plan0(f).outlet[1] - p[1]) * (plan0(f).outlet[1] - p[1]) < 144)) continue;
    const r = planSetPiece("plugSpillway", { lake: lake.id, at: [round(p[0], 2), round(p[1], 2)], width: 3 }, ctx, { id: id("setPiece", role), origin: "generated", role }, true);
    if (!r.ok) continue;
    // a spillway longer than half the map's side is no side channel: leave it out
    const plan = r.feature.params.plan as { outletLevels: number[] };
    if (plan.outletLevels.length <= 0.5 * Math.max(W, H)) out.push(r.feature);
  }
  return out;
}

/** Islands in a sea (PLAN §8, Islands): 6–25 of them (about one per 900 tiles of sea), each a
 *  rounded blob of 100+ tiles, 4+ tiles inside the shore, 4+ apart and clear of the rivers' mouths
 *  by 10, rising 1–3 levels above the sea's level. */
function placeIslands(rng: Rng, outline: Point[], mouths: Point[], W: number, H: number): { outline: Point[]; rise: number }[] {
  const mask = polygonMask(outline, W, H);
  const outside = new Uint8Array(W * H);
  let sea = 0;
  for (let i = 0; i < W * H; i++) {
    outside[i] = mask[i] ? 0 : 1;
    sea += mask[i];
  }
  const inward = distanceFrom(outside, W, H);
  const n = Math.max(6, Math.min(25, Math.round(sea / 900)));
  const side = Math.min(W, H);
  const out: { outline: Point[]; rise: number; x: number; y: number; r: number }[] = [];
  const cands: number[] = [];
  for (let i = 0; i < W * H; i++) if (inward[i] >= 10.5) cands.push(i);
  for (let tries = 0; tries < n * 30 && out.length < n && cands.length; tries++) {
    const r = rng.range(6.5, 6.5 + 0.03 * side);
    const c = cands[rng.int(0, cands.length)];
    const x = c % W;
    const y = (c - x) / W;
    const shape = rng.float();
    const rise = 1 + rng.int(0, 3);
    if (inward[c] < r * 1.15 + 4) continue;
    if (mouths.some(([mx, my]) => (mx - x) * (mx - x) + (my - y) * (my - y) < (r + 10) * (r + 10))) continue;
    if (out.some((o) => (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < (o.r * 1.15 + r * 1.15 + 4) * (o.r * 1.15 + r * 1.15 + 4))) continue;
    const pts: Point[] = [];
    for (let k = 0; k < 10; k++) {
      const a = k / 5;
      const rr = r * (1 + 0.15 * sinDet(2 * a * PI + TWO_PI * shape));
      pts.push([round(x + rr * cosDet(a * PI), 2), round(y + rr * sinDet(a * PI), 2)]);
    }
    out.push({ outline: pts, rise, x, y, r });
  }
  return out.map((o) => ({ outline: o.outline, rise: o.rise }));
}

/** The bed at a river's outlet end (the lowest it has). */
function bedAtEnd(r: RiverFeature): number {
  return r.params.bedProfile.start - r.params.bedProfile.steps.reduce((a, st) => a + st.drop, 0);
}

function pathLen(path: readonly Point[]): number {
  let l = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const dx = path[k + 1][0] - path[k][0];
    const dy = path[k + 1][1] - path[k][1];
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

/** Tiles within `d` (Chebyshev) of the mask, outside it. */
function lakeNear(mask: Uint8Array, W: number, H: number, d: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && !mask[(y + dy) * W + x + dx]) out[(y + dy) * W + x + dx] = 1;
    }
  return out;
}

/** The dam site's band across the outlet valley, with 4 tiles to spare (its ridge seals there). */
function bandAround(W: number, H: number, river: RiverFeature, dam: SetPieceFeature): Uint8Array {
  const out = new Uint8Array(W * H);
  const plan = dam.params.plan as { at: number; thickness: number; wobble: number };
  const path = river.params.path;
  const c = pointAtArc(path, plan.at).p;
  const ax = path[path.length - 1][0] - path[0][0];
  const ay = path[path.length - 1][1] - path[0][1];
  const al = Math.sqrt(ax * ax + ay * ay) || 1;
  const half = plan.thickness / 2 + plan.wobble + 4;
  const field = pathField(path, W, H);
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const y = (i - x) / W;
    const along = ((x - c[0]) * ax + (y - c[1]) * ay) / al;
    if (Math.abs(along) <= half && field.d[i] < 40) out[i] = 1;
  }
  return out;
}

/** What of a drawn layout lands on protected tiles (PLAN §7.0). */
function conflict(protect: Uint8Array, W: number, H: number, rivers: readonly RiverFeature[], lake: LakeFeature, start: StartFeature): string | null {
  const N = W * H;
  for (const r of rivers) {
    const field = pathField(r.params.path, W, H);
    const bank = r.params.width / 2 + 1;
    for (let i = 0; i < N; i++) if (protect[i] && field.d[i] < bank) return "a river";
  }
  const m = polygonMask(lake.params.outline, W, H);
  for (let i = 0; i < N; i++) if (protect[i] && m[i]) return "the lake";
  const [cx, cy] = start.params.position;
  const r = Math.max(start.params.benchRadius, START_CLEAR_RADIUS + 1);
  for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) if (protect[y * W + x]) return "the start";
  return null;
}
