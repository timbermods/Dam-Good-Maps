// Aggregate the study into investigation/workshop.json: numbers only, never a map's own data.
//
//   npx tsx investigation/workshop/aggregate.ts
//
// Reads the local per-map records (measure.ts, measure-generated.ts), the Workshop metadata, the
// catalogue tags (C:\dgm-workshop\tags.json) and the results of variety.ts, score.ts and the
// recipe runner when present. Sections:
// - maps: counts by source, era, format and size; the skipped maps with reasons;
// - bands: p10 / median / p90 per size class of every settings-related number, workshop against
//   official (maps of unusual shape are kept out: a side over 256 or an aspect of 4 or more);
// - overall: the same over all maps, with the pre-1.0 and 1.0+ workshop maps apart and the
//   generator by theme;
// - features10: how often the 1.0-only features appear, within the 1.0+ maps only;
// - flow: river directions;
// - popularity: hints (rank correlations with subscribers allowing for age, and with the favourite
//   rate), never proof;
// - catalogue counts and example links, variety, score and recipes from their own tools.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lcg, readGenerated, readTable, spearman, stat, type Row } from "./lib/table";
import { ROOT } from "./lib/paths";

const HERE = join(process.cwd(), "investigation");
const OUT = join(HERE, "workshop.json");
const TODAY = new Date("2026-09-24T00:00:00Z").getTime();

const rows = readTable();
const gen = readGenerated();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const w10 = workshop.filter((r) => r.era === "1.0+");
const wPre = workshop.filter((r) => r.era === "pre-1.0");
const SIZES = ["small", "medium", "large", "max"] as const;

/** The settings-related numbers (PLAN §5), with the setting each informs. */
export const BAND_METRICS: [string, string][] = [
  ["heightRange", "Relief"],
  ["cliffShare", "Relief"],
  ["maxHeight", "Highest terrain"],
  ["step1Share", "Terracing"],
  ["flatShare", "Buildable land"],
  ["startReach", "Buildable land"],
  ["inflows", "Rivers"],
  ["springs", "Rivers"],
  ["cleanStrengthPer10k", "River flow"],
  ["storageNearStart", "Drought reserve"],
  ["basins20", "Lakes and basins"],
  ["lakes", "Lakes and basins"],
  ["waterfalls", "Waterfalls"],
  ["maxFallDrop", "Waterfalls"],
  ["waterShare", "Target water share"],
  ["badToClean", "Badwater"],
  ["badwaterShare", "Badwater"],
  ["startBadwater", "Badwater distance"],
  ["treesPer10k", "Forest density"],
  ["livingShare", "Forest density"],
  ["groveMedian", "Grove size"],
  ["bushesPer10k", "Berry bushes elsewhere"],
  ["scrapPer1k", "Ruins and scrap"],
  ["startWater", "Start: clean pumpable water within"],
  ["startTrees20", "Start: trees within 20"],
  ["startBushes20", "Start: living bushes within 20"],
  ["startRuinsNearest", "Start: no ruins within"],
  ["slopesPer10k", "Slopes"],
  ["islands100", "Islands"],
  ["damSitesPer10k", "Dam sites"],
];

const OTHER_METRICS = [
  "startWaterNoSlopeWalk", "startWaterNoSlopeStraight", "startLevelRegion", "startLivingTreesWalk20", "startTreesWalk20", "startLivingBushesWalk20",
  "longestRun", "runP95", "straightShare8", "meanRun", "ridges", "ridgeThicknessCV", "ridgeHeightStd", "uniformRidgeShare",
  "basinRimThicknessCV", "basinRimHeightStd", "basinRimThicknessMean", "damRimThicknessCV", "damRimHeightStd", "damRimThicknessMean",
  "narrowsThicknessCV", "narrowsHeightStd", "shoreStraightShare8", "ditchShare", "caveShare", "tallFalls", "lakeShare", "moistShare", "bestDamRatio", "levels1pct",
];

const statOf = (set: Row[], k: string) => stat(set.map((r) => r.v[k]));

function bands(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, setting] of BAND_METRICS) {
    const per: Record<string, unknown> = { setting };
    for (const s of SIZES) {
      const o = official.filter((r) => r.sizeClass === s && !r.unusual);
      const w = workshop.filter((r) => r.sizeClass === s && !r.unusual);
      per[s] = { official: statOf(o, k), workshop: statOf(w, k) };
    }
    out[k] = per;
  }
  return out;
}

function overall(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const themes = [...new Set(gen.map((g) => g.theme!))].sort();
  for (const k of [...BAND_METRICS.map(([m]) => m), ...OTHER_METRICS]) {
    const g: Record<string, unknown> = {};
    for (const t of themes) g[t] = statOf(gen.filter((r) => r.theme === t), k);
    out[k] = {
      official: statOf(official, k),
      workshop: statOf(workshop, k),
      workshopPre10: statOf(wPre, k),
      workshop10: statOf(w10, k),
      generated128: statOf(gen, k),
      generatedByTheme: g,
    };
  }
  return out;
}

const FEATURES_10 = [
  ["caves", (r: Row) => (r.v.caveShare ?? 0) >= 0.002],
  ["overhangs", (r: Row) => (r.v.overhangs ?? 0) > 0],
  ["relics", (r: Row) => (r.v.relics ?? 0) > 0],
  ["geothermal", (r: Row) => (r.v.geothermal ?? 0) > 0],
  ["mines", (r: Row) => (r.v.mines ?? 0) > 0],
  ["weirs", (r: Row) => (r.v.weirs ?? 0) > 0],
  ["plugs", (r: Row) => (r.v.plugs ?? 0) > 0],
  ["thorns", (r: Row) => (r.v.thorns ?? 0) > 0],
  ["seeps", (r: Row) => (r.v.seeps ?? 0) > 0],
  ["badtideDrains", (r: Row) => (r.v.drains ?? 0) > 0],
  ["aquifers", (r: Row) => (r.v.aquifers ?? 0) > 0],
  ["unstableCores", (r: Row) => (r.v.cores ?? 0) > 0],
] as const;

function features10(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const share = (set: Row[], f: (r: Row) => boolean) => ({ maps: set.filter(f).length, of: set.length, share: set.length ? Math.round((1000 * set.filter(f).length) / set.length) / 1000 : null });
  for (const [name, f] of FEATURES_10) out[name] = { workshop10: share(w10, f), official: share(official, f), workshopPre10ForReference: share(wPre, f) };
  return out;
}

function flows(): Record<string, unknown> {
  const count = (set: Row[]) => {
    const c: Record<string, number> = {};
    for (const r of set) c[r.flow] = (c[r.flow] ?? 0) + 1;
    return c;
  };
  const edgeOnly = (set: Row[]) => set.filter((r) => !["none", "closed", "local"].includes(r.flow));
  const eastShare = (set: Row[]) => {
    const e = edgeOnly(set);
    return e.length ? Math.round((1000 * e.filter((r) => r.flow === "E").length) / e.length) / 1000 : null;
  };
  return {
    note: "Main flow from the strength-weighted centre of the clean sources to the depth-weighted centre of the draining map edge; north is +y. 'closed': no water leaves the map; 'local': source and outlet within 10% of the map's side; 'none': no clean source.",
    official: count(official),
    workshop: count(workshop),
    generated128: count(gen),
    westToEastShareOfFlowingMaps: { official: eastShare(official), workshop: eastShare(workshop), generated128: eastShare(gen) },
  };
}

// --------------------------------------------------------------------------- popularity hints

/** Least squares y = a + b·x. */
function fit(x: number[], y: number[]): [number, number] {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  return [my - b * mx, b];
}

export const HINT_FEATURES: [string, (r: Row) => number | null][] = [
  ["map area", (r) => Math.log(r.area)],
  ["relief (height range)", (r) => r.v.heightRange],
  ["cliff share", (r) => r.v.cliffShare],
  ["flat share", (r) => r.v.flatShare],
  ["water share", (r) => r.v.waterShare],
  ["lakes", (r) => r.v.lakes],
  ["islands", (r) => r.v.islands100],
  ["waterfalls per 10k tiles", (r) => r.v.waterfallsPer10k],
  ["tallest fall", (r) => r.v.maxFallDrop],
  ["dam sites per 10k tiles", (r) => r.v.damSitesPer10k],
  ["natural basins", (r) => r.v.basins20],
  ["trees per 10k tiles", (r) => r.v.treesPer10k],
  ["bushes per 10k tiles", (r) => r.v.bushesPer10k],
  ["scrap per 1k tiles", (r) => r.v.scrapPer1k],
  ["badwater share", (r) => r.v.badwaterShare],
  ["cave share", (r) => r.v.caveShare],
  ["walkable land from the start", (r) => r.v.startReach],
  ["pumpable water distance from the start", (r) => r.v.startWater],
  ["straight steps (share in runs of 8+)", (r) => r.v.straightShare8],
  ["ridge thickness variation", (r) => r.v.ridgeThicknessCV],
  ["1.0 object kinds used", (r) => ["relics", "geothermal", "mines", "weirs", "plugs", "thorns", "overhangs", "seeps", "drains"].filter((k) => (r.v[k] ?? 0) > 0).length],
  ["made for 1.0+", (r) => (r.era === "1.0+" ? 1 : 0)],
];

function popularity(): Record<string, unknown> {
  const withMeta = workshop.filter((r) => r.meta && (r.meta as any).lifetime_subscribers && r.meta.posted); // eslint-disable-line @typescript-eslint/no-explicit-any
  const age = withMeta.map((r) => Math.max(30, (TODAY - new Date(r.meta!.posted! + "T00:00:00Z").getTime()) / 864e5));
  const subs = withMeta.map((r) => Math.log((r.meta as any).lifetime_subscribers as number)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [a, b] = fit(age.map(Math.log), subs);
  const resid = subs.map((s, i) => s - (a + b * Math.log(age[i])));
  // the favourite rate: favourites per lifetime subscriber, much less tied to age
  const fav = withMeta.map((r) => Math.log((((r.meta as any).lifetime_favourites ?? r.meta!.favourites ?? 0) + 1) / ((r.meta as any).lifetime_subscribers as number))); // eslint-disable-line @typescript-eslint/no-explicit-any
  // authors with several maps: take each author's own mean out (within-author hints)
  const byAuthor = new Map<string, number[]>();
  withMeta.forEach((r, i) => {
    const k = String((r.meta as any).creator_steamid ?? r.key); // eslint-disable-line @typescript-eslint/no-explicit-any
    (byAuthor.get(k) ?? byAuthor.set(k, []).get(k)!).push(i);
  });
  const within = resid.slice();
  for (const idx of byAuthor.values()) {
    if (idx.length < 3) continue;
    const m = idx.reduce((s, i) => s + resid[i], 0) / idx.length;
    for (const i of idx) within[i] = resid[i] - m;
  }
  const rnd = lcg(20260924);
  const hint = (vals: (number | null)[], y: number[]) => {
    const ok = vals.map((v, i) => [v, y[i]] as const).filter(([v]) => typeof v === "number" && Number.isFinite(v)) as [number, number][];
    if (ok.length < 20) return null;
    const rho = spearman(ok.map((p) => p[0]), ok.map((p) => p[1]));
    const boots: number[] = [];
    for (let k = 0; k < 400; k++) {
      const s = ok.map(() => ok[Math.floor(rnd() * ok.length)]);
      boots.push(spearman(s.map((p) => p[0]), s.map((p) => p[1])));
    }
    boots.sort((p, q) => p - q);
    return { rho: Math.round(rho * 100) / 100, ci90: [Math.round(boots[20] * 100) / 100, Math.round(boots[379] * 100) / 100], n: ok.length };
  };
  const out: Record<string, unknown> = {};
  for (const [name, f] of HINT_FEATURES) {
    const vals = withMeta.map(f);
    out[name] = { subscribersForAge: hint(vals, resid), withinAuthor: hint(vals, within), favouriteRate: hint(vals, fav) };
  }
  // catalogue tags as features
  const tagNames = [...new Set(workshop.flatMap((r) => r.tags))].sort();
  const tags: Record<string, unknown> = {};
  for (const t of tagNames) {
    const vals = withMeta.map((r) => (r.tags.includes(t) ? 1 : 0));
    const n = vals.reduce((s: number, v) => s + v, 0);
    if (n < 5) continue;
    tags[t] = { maps: n, subscribersForAge: hint(vals, resid), favouriteRate: hint(vals, fav) };
  }
  const authors = [...byAuthor.values()].map((v) => v.length).sort((p, q) => q - p);
  return {
    note: "Hints, never proof: Spearman rank correlations over workshop maps. 'subscribersForAge' is log lifetime subscribers after a fit on log age; 'withinAuthor' takes each prolific author's (3+ maps) own mean out; 'favouriteRate' is log favourites per lifetime subscriber. ci90 is a bootstrap interval; one that spans 0 is noise.",
    maps: withMeta.length,
    ageFit: { intercept: Math.round(a * 100) / 100, slopePerLogDay: Math.round(b * 100) / 100 },
    authors: { distinct: byAuthor.size, largestShares: authors.slice(0, 3) },
    features: out,
    catalogueTags: tags,
  };
}

function maps(): Record<string, unknown> {
  const skippedPath = join(ROOT, "skipped.json");
  const probe = existsSync(join(ROOT, "probe.json")) ? JSON.parse(readFileSync(join(ROOT, "probe.json"), "utf8")) : [];
  const skipped = probe.filter((p: { skip: string | null }) => p.skip).map((p: { key: string; file: string; skip: string; size: number[] }) => ({ title: p.file.replace(/\.timber$/, ""), size: p.size.join("×"), reason: p.skip }));
  if (existsSync(skippedPath)) {
    for (const s of JSON.parse(readFileSync(skippedPath, "utf8")) as { file: string; reason: string }[]) {
      if (!skipped.some((k: { title: string }) => k.title === s.file.replace(/\.timber$/, ""))) skipped.push({ title: s.file.replace(/\.timber$/, ""), size: "", reason: s.reason });
    }
  }
  const count = (set: Row[], f: (r: Row) => string) => {
    const c: Record<string, number> = {};
    for (const r of set) c[f(r)] = (c[f(r)] ?? 0) + 1;
    return c;
  };
  return {
    workshopItemsWithMaps: workshop.length + skipped.length,
    workshopUsed: workshop.length,
    officialUsed: official.length,
    skipped,
    workshopByEra: count(workshop, (r) => r.era),
    workshopByFormat: count(workshop, (r) => r.format),
    workshopBySize: count(workshop, (r) => (r.unusual ? "unusual shape" : r.sizeClass)),
    officialBySize: count(official, (r) => r.sizeClass),
    workshopSizes: {
      area: stat(workshop.map((r) => r.area), 0),
      unusual: workshop.filter((r) => r.unusual).map((r) => `${r.W}×${r.H}`),
      square: workshop.filter((r) => r.W === r.H).length,
    },
    generated: { maps: gen.length, themes: [...new Set(gen.map((g) => g.theme))].sort(), size: "128×128", seeds: "1–30", passed: gen.filter((g) => g.raw.passed).length },
  };
}

function optional(name: string): unknown {
  const p = join(ROOT, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

const out = {
  generated: "2026-09-24",
  game: "Timberborn 1.1.2.4; maps read with the app's importer and validated with its validators on our canonical settle",
  method: {
    sizeClasses: "small ≤ 12k tiles, medium ≤ 20k, large ≤ 45k, max above (investigation/analyze_maps.py)",
    unusualShapes: "a side over 256 or an aspect of 4 or more: counted, kept out of the size bands",
    water: "every number about water comes from our canonical settle of each map's own sources (PLAN §10), never from the water a file stores; wet = depth ≥ 0.1, badwater = contamination ≥ 0.3",
    features10: "caves, overhangs, relics, geothermal fields, mine sites, weirs, plugs and thorns are compared within the 1.0+ maps only",
    generated: "seeds 1–30 of every built theme at 128², Normal, default settings, measured with the same code",
  },
  maps: maps(),
  bands: bands(),
  overall: overall(),
  features10: features10(),
  flow: flows(),
  popularity: popularity(),
  catalogue: optional("catalogue-aggregate.json"),
  variety: optional("variety.json"),
  score: optional("score.json"),
  recipes: optional("recipes-aggregate.json"),
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${OUT}: ${workshop.length} workshop, ${official.length} official, ${gen.length} generated`);
