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

import type { Orientation } from "../format/footprints";
import { buildMap, START_CLEAR_RADIUS, type SettleCache } from "../features/build";
import { featureId } from "../features/ids";
import { pathField, pointAtArc, polygonMask, round } from "../features/geometry";
import { planSetPiece, type PlanContext as PieceContext } from "../features/setpieces";
import type { BedStep, Feature, LakeFeature, LandformFeature, Point, RiverFeature, SetPieceFeature, StartFeature } from "../features/schema";
import { cosDet, PI, sinDet, TWO_PI } from "../math/detmath";
import { stream } from "../math/rng";
import type { MapSpec } from "../spec/mapspec";
import { bandsFor, drawBands, fitRelief, layoutTargets } from "./layout";
import { planResources } from "./resources";
import { farReach, MAX_LAYOUT_TRIES, PlanConflict, riverWidth, type PlanContext } from "./valley";
import { groundOf, placeBadwater, placeRiversidePonds, reachOf } from "./water";

/** Layout parameters (PLAN §8: a typed table). */
export const LAKE_BASIN = {
  /** The lake's share of the map (PLAN §6: target water share 0.30 with the rivers). */
  lakeShare: [0.18, 0.24] as [number, number],
  /** The shore bench round the lake, in tiles, by buildable land. */
  shore: { tight: 11, normal: 14, generous: 18 },
  /** Outline points round the lake and its rings. */
  points: 32,
};

const BENCH_RADIUS = { small: 5, normal: 6, large: 8 } as const;

export function planLakeBasin(spec: MapSpec, attempt: number, candidate = 0, settleCache?: SettleCache, context?: PlanContext): Feature[] {
  const W = spec.size.x;
  const H = spec.size.y;
  const seed = spec.seed;
  const t = layoutTargets(spec);
  const rng = stream(seed, "layout", candidate, attempt);
  const id = (kind: Feature["kind"], role: string) => featureId(seed, kind, role);
  const hard = spec.designedFor === "hard";
  // the lake keeps its water below the outlet's sill through a drought: deeper for more reserve,
  // and 4 deep on Hard (30 days evaporate 1.6)
  const floorDepth = hard ? 4 : t.reserve >= 3 ? 3 : 2;

  for (let tryN = 0; ; tryN++) {
    // ------------------------------------------------------------------ the lake's shape
    // on maps larger than 128² the lake's share shrinks with the side (the official Lakes map, 256²,
    // is 14% water): a lake fills by its outlet's head over its whole area, and a vast one would
    // not settle within the canonical settle's 4 days
    const r = Math.min(1, 16384 / (W * H));
    const share = rng.range(LAKE_BASIN.lakeShare[0], LAKE_BASIN.lakeShare[1]) * Math.sqrt(r) * Math.sqrt(Math.sqrt(r)); // × r^0.75
    const aspect = rng.range(0.8, 1.25);
    const rMean = Math.sqrt((share * W * H) / PI);
    const rx = Math.min(0.34 * W, rMean * Math.sqrt(aspect));
    const ry = Math.min(0.34 * H, rMean / Math.sqrt(aspect));
    const cx = W * rng.range(0.42, 0.48);
    const cy = H * rng.range(0.46, 0.54);
    const ph1 = rng.float() * TWO_PI;
    const ph2 = rng.float() * TWO_PI;
    const a1 = rng.range(0.04, 0.1);
    const a2 = rng.range(0.03, 0.07);
    /** The lake's radius factor at angle θ (a smooth wobble, no trigonometry beyond detmath). */
    const wob = (th: number) => 1 + a1 * sinDet(2 * th + ph1) + a2 * sinDet(3 * th + ph2);
    const ring = (grow: number): Point[] => {
      const out: Point[] = [];
      const n = LAKE_BASIN.points;
      for (let k = 0; k < n; k++) {
        const th = (TWO_PI * k) / n;
        const f = wob(th);
        out.push([round(cx + (rx * f + grow) * cosDet(th), 2), round(cy + (ry * f + grow) * sinDet(th), 2)]);
      }
      return out;
    };
    const lakeOutline = ring(0);
    const shore = LAKE_BASIN.shore[spec.settings.terrain.buildableLand];
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
    const outW = riverWidth(t.flow, W);
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

    const make = (shift: number) => {
      // levels: the lake floor sits `range` below the highest terrain; the lake's level L is its
      // outlet's sill, and the shore one above it
      const L = Math.max(floorDepth + 1, Math.min(t.top - 4, t.top - t.range + floorDepth + shift));
      const lift = t.top - (L + 1);
      const bands = bandsFor(draws, lift, room);
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
          inflow: inflows ? { rivers: rivers.slice(1).map((r) => r.id) } : { spring: round(t.flow, 2) },
          planned: false,
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
      const used = [outAngle, ...inflowAngles];
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

    // ------------------------------------------------------------------ resources on the settled water
    const base = buildMap({ W, H, seed, features: [...layout, ...others], locked: context?.locked }, { stopBeforeResources: true, settleCache });
    const resources = planResources(spec, base, candidate, attempt, context ? { protect: context.protect, lockedMask: context.locked?.mask ?? null } : undefined);
    return [...layout, ...resources];
  }
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
