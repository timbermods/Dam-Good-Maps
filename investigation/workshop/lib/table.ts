// The measured records as one table: every map's numbers under plain names, with its Workshop
// metadata and catalogue tags. Used by the aggregate, the score and the popularity hints. Local
// data in, local data out: only aggregates of it are committed.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MEASURED, readMeta, ROOT, type WorkshopMeta } from "./paths";

export type SizeClass = "small" | "medium" | "large" | "max";

export interface Row {
  key: string;
  source: "workshop" | "official" | "generated";
  id: string | null;
  title: string;
  author: string | null;
  url: string | null;
  theme?: string;
  format: string;
  era: "pre-1.0" | "1.0+";
  sizeClass: SizeClass;
  /** A side over 256 or an aspect of 4 or more: kept out of the size bands. */
  unusual: boolean;
  W: number;
  H: number;
  area: number;
  recommended?: boolean;
  meta: WorkshopMeta | null;
  tags: string[];
  v: Record<string, number | null>;
  flow: string;
  objects: Record<string, number>;
  raw: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const OFFICIAL_RECOMMENDED = new Set(["Plains", "Lakes", "Waterfalls"]);

/** Every number the study compares, from one measured record. */
export function values(r: any): Record<string, number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = r.metrics;
  const s = r.start;
  const per10k = 1e4 / r.area;
  const clean = r.sources?.WaterSource?.strength ?? 0;
  const bad = r.sources?.BadwaterSource?.strength ?? 0;
  const obj = r.objects ?? {};
  const nat = r.natural;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    heightRange: m.heightRange,
    maxHeight: m.maxHeight,
    cliffShare: m.cliffShare,
    step1Share: m.step1Share,
    flatShare: m.flatShare,
    levels1pct: r.terrain.levels1pct,
    caveShare: r.terrain.caveShare,
    slopesPer10k: r.slopes * per10k,
    waterShare: m.waterShare,
    cleanShare: r.water.cleanShare,
    badwaterShare: r.water.badwaterShare,
    cleanStrengthPer10k: clean * per10k,
    badToClean: clean > 0 ? bad / clean : null,
    inflows: r.water.inflows,
    springs: r.water.springs,
    outflows: r.water.outflows,
    lakes: r.water.lakes,
    lakeShare: r.water.lakeShare,
    ponds: r.water.ponds,
    basins20: m.basins20,
    waterfalls: m.waterfalls,
    waterfallsPer10k: m.waterfalls * per10k,
    maxFallDrop: r.water.maxFallDrop,
    tallFalls: r.water.tallFalls,
    islands100: r.water.islands100,
    moistShare: r.water.moistShare,
    damSitesPer10k: r.dams.per10k,
    bigDamSitesPer10k: r.dams.ratio100per10k,
    bestDamRatio: r.dams.bestRatio,
    storageNearStart: Math.max(r.dams.nearStartBest ?? 0, r.dams.naturalStorage ?? 0),
    treesPer10k: m.treesPer10k,
    livingShare: r.resources.trees ? r.resources.livingTrees / r.resources.trees : null,
    groveMedian: r.resources.groveMedian,
    largestGrove: r.resources.largestGrove,
    bushesPer10k: m.bushesPer10k,
    scrapPer1k: m.scrapPer1k,
    ruinFields: r.resources.ruinFields10,
    thorns: obj.Thorns ?? 0,
    relics: (obj.SmallRelic ?? 0) + (obj.MediumRelic ?? 0) + (obj.LargeRelic ?? 0),
    geothermal: obj.GeothermalField ?? 0,
    mines: obj.UndergroundRuins ?? 0,
    weirs: obj.NaturalDam ?? 0,
    plugs: obj.Blockage ?? 0,
    overhangs: (obj.NaturalOverhang2x1 ?? 0) + (obj.NaturalOverhang3x1 ?? 0) + (obj.NaturalOverhang4x1 ?? 0),
    cores: obj.UnstableCore ?? 0,
    seeps: (obj.WaterSeep ?? 0) + (obj.BadwaterSeep ?? 0),
    drains: obj.BadtideDrain ?? 0,
    aquifers: obj.Aquifer ?? 0,
    // the start (current rules, straight distances)
    startWater: s ? num(s.pumpableWater) : null,
    startReach: s ? s.reach : null,
    startReachShare: s ? s.reachShare : null,
    startTrees20: s ? s.trees20 : null,
    startBushes20: s ? s.bushes20 : null,
    startBadwater: s ? num(s.badwater) : null,
    startRuinsNearest: s ? num(m.ruinsNearest) : null,
    startSlopes25: s ? s.slopesWithin25 : null,
    // the start-rules change: raw quantities
    startWaterNoSlopeWalk: s ? num(s.waterNoSlopeWalk) : null,
    startWaterNoSlopeStraight: s ? num(s.waterNoSlopeStraight) : null,
    startLevelRegion: s ? s.levelRegion : null,
    startLivingTreesWalk20: s ? s.livingTreesWalk20 : null,
    startTreesWalk20: s ? s.treesWalk20 : null,
    startLivingBushesWalk20: s ? s.livingBushesWalk20 : null,
    // naturalness
    longestRun: nat.longestRun,
    runP95: nat.runP95,
    straightShare8: nat.straightShare8,
    meanRun: nat.meanRun,
    ridges: nat.ridges,
    ridgeThicknessCV: num(nat.ridgeThicknessCV),
    ridgeHeightStd: num(nat.ridgeHeightStd),
    uniformRidgeShare: num(nat.uniformRidgeShare),
    basinRimThicknessCV: num(nat.basinRimThicknessCV),
    basinRimHeightStd: num(nat.basinRimHeightStd),
    basinRimThicknessMean: num(nat.basinRimThicknessMean),
    damRimThicknessCV: num(nat.damRimThicknessCV),
    damRimHeightStd: num(nat.damRimHeightStd),
    damRimThicknessMean: num(nat.damRimThicknessMean),
    narrowsThicknessCV: num(nat.narrowsThicknessCV),
    narrowsHeightStd: num(nat.narrowsHeightStd),
    shoreStraightShare8: num(nat.shoreStraightShare8),
    ditchShare: num(nat.ditchShare),
    area: r.area,
    aspect: Math.max(r.W, r.H) / Math.min(r.W, r.H),
  };
}

function sizeClassOf(area: number): SizeClass {
  if (area <= 12_000) return "small";
  if (area <= 20_000) return "medium";
  if (area <= 45_000) return "large";
  return "max";
}

export function readTags(): Record<string, string[]> {
  const p = join(ROOT, "tags.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

/** Every measured workshop and official map. */
export function readTable(): Row[] {
  const meta = readMeta();
  const tags = readTags();
  const rows: Row[] = [];
  for (const name of readdirSync(MEASURED).filter((n) => n.endsWith(".json")).sort()) {
    const r = JSON.parse(readFileSync(join(MEASURED, name), "utf8"));
    rows.push(rowOf(r, r.id ? meta[r.id] ?? null : null, tags[r.key] ?? []));
  }
  return rows;
}

/** Generated maps measured by measure-generated.ts (or a recipe run), from a folder. */
export function readGenerated(dir = join(ROOT, "generated")): Row[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => rowOf(JSON.parse(readFileSync(join(dir, n), "utf8")), null, []));
}

export function rowOf(r: any, meta: WorkshopMeta | null, tags: string[]): Row { // eslint-disable-line @typescript-eslint/no-explicit-any
  const name = r.source === "official" ? String(r.file).replace(/\.timber$/, "") : r.source === "generated" ? r.key : meta?.title ?? String(r.file).replace(/\.timber$/, "");
  const aspect = Math.max(r.W, r.H) / Math.min(r.W, r.H);
  return {
    key: r.key,
    source: r.source,
    id: r.id ?? null,
    title: name,
    author: meta?.author ?? null,
    url: meta?.url ?? null,
    theme: r.theme,
    format: r.format ?? "generated",
    era: r.era ?? "1.0+",
    sizeClass: sizeClassOf(r.area),
    unusual: r.W > 256 || r.H > 256 || aspect >= 4,
    W: r.W,
    H: r.H,
    area: r.area,
    recommended: r.source === "official" ? OFFICIAL_RECOMMENDED.has(name) : undefined,
    meta,
    tags,
    v: values(r),
    flow: r.water.flow,
    objects: r.objects,
    raw: r,
  };
}

// --------------------------------------------------------------------------------- statistics

export interface Stat {
  n: number;
  p10: number | null;
  median: number | null;
  p90: number | null;
}

/** Percentile with linear interpolation (numpy's default). */
export function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const pos = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

export function stat(vals: (number | null | undefined)[], digits = 3): Stat {
  const v = vals.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  const r = (x: number | null) => (x === null ? null : Math.round(x * 10 ** digits) / 10 ** digits);
  return { n: v.length, p10: r(pct(v, 10)), median: r(pct(v, 50)), p90: r(pct(v, 90)) };
}

/** Spearman's rank correlation. */
export function spearman(a: number[], b: number[]): number {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length).fill(0);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** A small deterministic generator for bootstraps (sfc32-style mixing is not needed here). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
