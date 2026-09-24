// Measurements for intent checks, the judgement words and the `measure` tool. Map-level numbers come
// from the analysis the settings batches already use (src/core/analysis/metrics.ts), so a word like
// "harsher" is judged by the same yardstick as the settings. Feature-level numbers are read from the
// built map: a waterfall's lip as PLAN §9.2 measures it, a dam site's reservoir as its builder
// measures it, where a feature lies in flow and compass words.
//
// Guards are read from the validator at HEAD, never hard-coded: every check the `export` profile
// runs is a guard, grouped as the validator groups it (load, playability, design). Start
// requirements are the checks whose id starts with `start.`, whatever they are today.

import { measure as measureMap, type MapMetrics } from "../../../src/core/analysis/metrics";
import type { MapSession } from "../../../src/core/doc/session";
import { planContextOf } from "../../../src/core/doc/tools";
import { pointAtArc } from "../../../src/core/features/geometry";
import { reservoirOf, type DamSitePlan } from "../../../src/core/features/setpieces/damSite";
import { measureLip } from "../../../src/core/features/setpieces/waterfall";
import type { Feature, RiverFeature, SetPieceFeature } from "../../../src/core/features/schema";
import { polygonMask } from "../../../src/core/features/geometry";
import { runsToTiles } from "../../../src/core/math/grid";
import { rulesFor, type Rules } from "../../../src/core/validate/playability";
import type { CheckResult, ValidationReport } from "../../../src/core/validate/report";
import { locate, network } from "./flow";
import { compassWords } from "./places";
import { round1, round2, viewOf, type MapView } from "./view";

export interface Guard {
  id: string;
  class: string;
  ok: boolean;
  applicable: boolean;
  value?: number | string;
  limit?: number | string;
  message: string;
  start: boolean;
}

export interface Measured {
  map: MapMetrics;
  report: ValidationReport;
  guards: Guard[];
  rules: Rules;
  view: MapView;
}

/** Validate in the export profile and measure the whole map. */
export function measureSession(s: MapSession): Measured {
  const v = s.validate();
  const view = viewOf(s);
  const map = measureMap({ features: s.features, built: { ...s.built, start: s.built.start }, report: v.report, analysis: v.analysis });
  return { map, report: v.report, guards: guardsOf(v.report), rules: rulesFor(s.spec, s.meta.designedFor), view };
}

/** Every non-advisory check of the report as a guard. */
export function guardsOf(report: ValidationReport): Guard[] {
  return report.checks
    .filter((c) => !c.advisory)
    .map((c: CheckResult) => ({
      id: c.id,
      class: c.class,
      ok: c.ok,
      applicable: c.applicable !== false,
      ...(c.value !== undefined ? { value: c.value } : {}),
      ...(c.limit !== undefined ? { limit: c.limit } : {}),
      message: c.message,
      start: c.id.startsWith("start."),
    }));
}

/** Guards that pass in `before` and fail in `after`: what an edit broke. */
export function brokenGuards(before: Guard[], after: Guard[]): Guard[] {
  const was = new Map(before.map((g) => [g.id, g.ok]));
  return after.filter((g) => !g.ok && was.get(g.id) !== false);
}

/** The start requirements the validator checks at HEAD, with their limits (never hard-coded). */
export function startRequirements(m: Measured): { id: string; limit?: number | string; value?: number | string; ok: boolean; message: string }[] {
  return m.guards.filter((g) => g.start).map((g) => ({ id: g.id, limit: g.limit, value: g.value, ok: g.ok, message: g.message }));
}

// ------------------------------------------------------------------------------ map metrics

export interface MetricDef {
  label: string;
  unit: string;
  get(m: MapMetrics, x: Measured): number;
}

const inf = (n: number) => (Number.isFinite(n) ? n : 999);

/** Named map-level metrics (the targets tools/settings-suite.ts measures, plus storage). */
export const MAP_METRICS: Record<string, MetricDef> = {
  heightRange: { label: "height range p5–p95", unit: "levels", get: (m) => m.heightRange },
  cliffShare: { label: "cliff tile share", unit: "share", get: (m) => m.cliffShare },
  step1Share: { label: "one-level share of steps", unit: "share", get: (m) => m.step1Share },
  flatShare: { label: "flat share", unit: "share", get: (m) => m.flatShare },
  reach: { label: "dry land walkable from the start", unit: "tiles", get: (m) => inf(m.reach) },
  cleanStrength: { label: "clean water flow", unit: "blocks/s", get: (m) => m.cleanStrength },
  badwaterStrength: { label: "badwater flow", unit: "blocks/s", get: (m) => m.badwaterStrength },
  badwaterRatio: { label: "badwater to clean water", unit: "ratio", get: (m) => (m.cleanStrength > 0 ? m.badwaterStrength / m.cleanStrength : 0) },
  badwaterDistance: { label: "start to nearest badwater", unit: "tiles", get: (m) => (Number.isFinite(m.badwaterDistance) ? m.badwaterDistance : 200) },
  waterDistance: { label: "start to pumpable clean water", unit: "tiles", get: (m) => inf(m.waterDistance) },
  storedNearStart: { label: "water stored near the start (best dam site or natural pools)", unit: "blocks", get: (m) => Math.max(m.bestDam, m.natural) },
  bestDam: { label: "best dam site within 40 tiles of the start", unit: "blocks", get: (m) => m.bestDam },
  natural: { label: "natural water kept through the drought near the start", unit: "blocks", get: (m) => m.natural },
  damSites: { label: "dam sites near the start", unit: "count", get: (m) => m.damSites },
  basins20: { label: "natural basins of 20+ tiles", unit: "count", get: (m) => m.basins20 },
  waterShare: { label: "wet share of the map", unit: "share", get: (m) => m.waterShare },
  waterfalls: { label: "waterfalls in the settled water", unit: "count", get: (m) => m.waterfalls },
  bedDrops2: { label: "river bed drops of 2+ levels", unit: "count", get: (m) => m.bedDrops2 },
  treesPer10k: { label: "trees per 10k tiles", unit: "per 10k", get: (m) => m.treesPer10k },
  livingShare: { label: "living share of trees", unit: "share", get: (m) => m.livingShare },
  bushesPer10k: { label: "berry bushes per 10k tiles", unit: "per 10k", get: (m) => m.bushesPer10k },
  treesNearStart: { label: "trees within 20 tiles of the start", unit: "count", get: (m) => inf(m.treesNearStart) },
  bushesNearStart: { label: "living bushes within 20 tiles of the start", unit: "count", get: (m) => inf(m.bushesNearStart) },
  scrapPer1k: { label: "scrap per 1k tiles", unit: "per 1k", get: (m) => m.scrapPer1k },
  ruinsNearest: { label: "start to nearest ruin", unit: "tiles", get: (m) => inf(m.ruinsNearest) },
  rivers: { label: "rivers", unit: "count", get: (m) => m.rivers },
  lakes: { label: "lakes", unit: "count", get: (m) => m.lakes },
};

export function mapMetric(x: Measured, name: string): number | null {
  const d = MAP_METRICS[name];
  if (!d) return null;
  return round2(d.get(x.map, x));
}

// -------------------------------------------------------------------------- feature measures

export interface FeatureMeasure {
  id: string;
  kind: string;
  at: [number, number];
  where: string;
  /** Along the valley's river: its name, the fraction from the source, and the bank relative to
   *  the start ("start's bank", "opposite bank", "on the river"). */
  course?: { river: string; frac: number; bank: string };
  distanceToStart?: number;
  [k: string]: unknown;
}

/** Measure one feature on the built map. */
export function measureFeature(s: MapSession, f: Feature): FeatureMeasure {
  const v = viewOf(s);
  const at = anchorOf(v, f);
  const out: FeatureMeasure = { id: f.id, kind: f.kind === "setPiece" ? f.params.kind : f.kind, at, where: compassWords(v, at[0], at[1]) };
  const net = network(v);
  const l = locate(net, v.W, at[0], at[1]);
  if (l) {
    let bank = "on the river";
    if (l.d >= l.course.width / 2) {
      const st = v.start ? locate(net, v.W, v.start.x, v.start.y, l.course) : null;
      bank = st ? (st.side === l.side ? "start's bank" : "opposite bank") : l.side > 0 ? "left bank" : "right bank";
    }
    out.course = { river: l.course.name, frac: round2(l.frac), bank };
  }
  if (v.start) out.distanceToStart = round1(Math.hypot(at[0] - v.start.x, at[1] - v.start.y));
  if (f.kind === "setPiece") Object.assign(out, measurePiece(s, v, f));
  if (f.kind === "lake") {
    const m = polygonMask(f.params.outline, v.W, v.H);
    let n = 0;
    let wet = 0;
    for (let i = 0; i < m.length; i++)
      if (m[i]) {
        n++;
        if (v.water[i] > 0.05) wet++;
      }
    Object.assign(out, { area: n, wetTiles: wet, level: f.params.outlet.sill, floorDepth: f.params.floorDepth, planned: f.params.planned });
  }
  if (f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField") {
    const own = v.entities.filter((e) => e.owner === f.id);
    const area = runsToTiles(f.params.area, v.W).length;
    if (f.kind === "ruinField") Object.assign(out, { area, columns: own.length, scrap: own.reduce((a, e) => a + 15 * Number(e.template.slice(11) || 0), 0) });
    else if (f.kind === "forest") Object.assign(out, { area, trees: own.length, living: own.filter((e) => !(e.components.LivingNaturalResource as { IsDead?: boolean } | undefined)?.IsDead).length });
    else Object.assign(out, { area, bushes: own.length });
  }
  if (f.kind === "river") {
    const c = net.byId.get(f.id);
    if (c) {
      Object.assign(out, { name: c.name, flows: c.heading, length: Math.round(c.length), width: c.width, flow: c.flow, badwater: c.badwater, from: c.source.edge ?? c.source.kind });
      if (c.outlet.kind === "river" && c.outlet.river) {
        const t = net.byId.get(c.outlet.river);
        if (t) out.joins = { river: t.name, frac: round2((c.outlet.joinsAt ?? 0) / t.length) };
      }
      // a river's own place on the flow is its middle, on itself
      out.course = { river: c.name, frac: 0.5, bank: "on the river" };
    }
  }
  if (f.kind === "landform" && f.params.outline) {
    const m = polygonMask(f.params.outline, v.W, v.H);
    let n = 0;
    for (let i = 0; i < m.length; i++) n += m[i];
    Object.assign(out, { area: n, height: f.params.height, edgeStyle: f.params.edgeStyle, landform: f.params.kind });
  }
  if (f.kind === "start") Object.assign(out, { level: v.start?.z, facing: f.params.orientation });
  return out;
}

function measurePiece(s: MapSession, v: MapView, f: SetPieceFeature): Record<string, unknown> {
  const p = f.params.plan;
  switch (f.params.kind) {
    case "waterfall": {
      if (p.mode === "standalone") {
        const lip = measureLip(f, v.W, v.heights, v.water);
        return { mode: "standalone", plannedWidth: p.width, lipWidth: lip?.width ?? 0, lipDepth: round2(lip?.depth ?? 0), drop: p.drop, surfaceDrop: round1(lip?.drop ?? 0), flow: p.flow, facing: p.facing, outflowTo: p.outflowTo };
      }
      return { mode: "on-river", river: p.river, drop: p.drop, arc: p.at };
    }
    case "damSite": {
      const river = v.features.find((g): g is RiverFeature => g.kind === "river" && g.id === p.river);
      if (!river) return { crest: p.crest };
      const ctx = planContextOf(s);
      const held = reservoirOf(p as unknown as DamSitePlan, river, ctx, f.id);
      // is the water at the dam clean? contamination on the channel next to the ridge
      const c = pointAtArc(river.params.path, Number(p.at)).p;
      let bad = 0;
      let n = 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = Math.round(c[0]) + dx;
          const y = Math.round(c[1]) + dy;
          if (x < 0 || y < 0 || x >= v.W || y >= v.H) continue;
          const i = y * v.W + x;
          if (v.water[i] > 0.05) {
            n++;
            if (v.contamination[i] >= 0.05) bad++;
          }
        }
      const fillSeconds = held && river.params.flow > 0 ? held.volume / river.params.flow : null;
      return {
        crest: p.crest,
        river: p.river,
        arc: p.at,
        reservoir: held ? { volume: Math.round(held.volume), area: held.area, damLength: held.length } : null,
        reservoirClean: n ? bad === 0 : true,
        ...(fillSeconds !== null ? { fillMinutes: round1(fillSeconds / 60) } : {}),
      };
    }
    case "badwaterBasin": {
      if (p.mode !== "basin") return { mode: p.mode, strength: p.strength };
      const tiles = p.outlet as number[];
      const end: [number, number] | null = Array.isArray(tiles) && tiles.length >= 2 ? [tiles[tiles.length - 2], tiles[tiles.length - 1]] : null;
      let joins: Record<string, unknown> = { to: p.outletTo };
      if (end && typeof p.outletTo === "string" && p.outletTo !== "edge") {
        const net = network(v);
        const c = net.byId.get(p.outletTo);
        if (c) {
          const l = locate(net, v.W, end[0], end[1], c);
          if (l) joins = { to: p.outletTo, river: c.name, atArc: round1(l.s), frac: round2(l.frac) };
        }
      }
      return { mode: "basin", strength: p.strength, outletWidth: p.outletWidth, routeLength: Math.round((p.outletLevels as number[]).length), outlet: joins };
    }
    case "gorge":
      return { river: p.river, from: p.from, to: p.to, width: p.width, wallHeight: p.wallHeight };
    case "terracedCliffs":
      return { bands: p.bands, depth: p.depth, width: p.width, facing: p.facing, base: p.base, top: Number(p.base) + Number(p.bands) };
    default:
      return {};
  }
}

export function anchorOf(v: MapView, f: Feature): [number, number] {
  const r = (a: readonly number[]): [number, number] => [Math.round(a[0]), Math.round(a[1])];
  if (f.kind === "start") return r(f.params.position);
  if (f.kind === "lake") {
    const o = f.params.outline;
    return r([o.reduce((a, p) => a + p[0], 0) / o.length, o.reduce((a, p) => a + p[1], 0) / o.length]);
  }
  if (f.kind === "setPiece") {
    const p = f.params.plan;
    if (Array.isArray(p.lip)) return r(p.lip as number[]);
    if (Array.isArray(p.at)) return r(p.at as number[]);
    if (typeof p.x === "number") return [Number(p.x) + 1, Number(p.y) + 1];
    const river = v.features.find((g): g is RiverFeature => g.kind === "river" && g.id === p.river);
    const s = typeof p.at === "number" ? Number(p.at) : (Number(p.from) + Number(p.to)) / 2;
    if (river && Number.isFinite(s)) return r(pointAtArc(river.params.path, s).p);
  }
  if (f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField") {
    const t = runsToTiles(f.params.area, v.W);
    if (t.length) return [Math.round(t.reduce((a, i) => a + (i % v.W), 0) / t.length), Math.round(t.reduce((a, i) => a + Math.floor(i / v.W), 0) / t.length)];
  }
  if (f.kind === "landform" && f.params.outline) {
    const o = f.params.outline;
    return r([o.reduce((a, p) => a + p[0], 0) / o.length, o.reduce((a, p) => a + p[1], 0) / o.length]);
  }
  if (f.kind === "river") {
    const c = network(v).byId.get(f.id);
    if (c) return r(pointAtArc(c.path, c.length / 2).p);
  }
  return [v.W >> 1, v.H >> 1];
}
