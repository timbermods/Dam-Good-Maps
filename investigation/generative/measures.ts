// The measures of docs/m9-design.md §10 over every generated set in <ROOT>\maps (the prototype and
// the baseline, by size), beside the workshop and official maps, the current M9 plan (River Valley
// with the workshop study's recipes as premises) and the batch pass rates. Writes the aggregates to
// investigation/generative/measures.json (no per-map workshop numbers) and prints the tables.
//
//   npx tsx investigation/generative/sidecars.ts --workshop       (once)
//   npx tsx investigation/generative/sidecars.ts --dir <set>      (per set)
//   npx tsx investigation/generative/measures.ts [--sets proto-128,current-128]

/* eslint-disable @typescript-eslint/no-explicit-any */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readGenerated, readTable, type Row } from "../workshop/lib/table";
import { distance, featureVector, type Scale, type VarietyInput } from "../workshop/lib/variety";
import { components, scoreOf, type ScoreParams } from "../workshop/lib/score";
import { scaledDistance, scaleOf, upgma, type VecScale } from "./lib/cluster";
import { OPENING_KEYS } from "./lib/opening";
import { arg, MAPS, ROOT, WORKSHOP } from "./lib/paths";
import { reliefCode, reliefVector, riverCode, riverVector } from "./lib/structure";

const HERE = join(process.cwd(), "investigation", "generative");
const vs = JSON.parse(readFileSync(join(process.cwd(), "investigation", "workshop", "variety-scale.json"), "utf8"));
const vScale: Scale = { spread: vs.spread, L0: vs.L0, F0: vs.F0 };
const params: ScoreParams = JSON.parse(readFileSync(join(process.cwd(), "investigation", "workshop", "score-params.json"), "utf8"));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pct = (v: number[], p: number) => {
  const s = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] : NaN;
};
const med = (v: number[]) => pct(v, 0.5);
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

const input = (key: string, r: any): VarietyInput => ({ key, layout: r.layout, features: featureVector(r) });

// ---------------------------------------------------------------------------------- the workshop

const rows = readTable();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const W = workshop.map((r) => input(r.key, r.raw));
// the workshop's own nearest peers on V: the cut for archetypes and the floor for approximation
const wsNN = W.map((a) => W.reduce((m, b) => (a.key === b.key ? m : Math.min(m, distance(a, b, vScale))), Infinity));
const vCut = pct(wsNN, 0.1);
const riverScale: VecScale = scaleOf(workshop.map((r) => riverVector(r.raw)));
const reliefScale: VecScale = scaleOf(workshop.map((r) => reliefVector(r.raw)));
const wsSide: Record<string, any> = existsSync(join(ROOT, "workshop-sidecars.json")) ? JSON.parse(readFileSync(join(ROOT, "workshop-sidecars.json"), "utf8")) : {};
const openRef: number[][] = [];
const openRefKeys: string[] = [];
for (const r of [...workshop, ...official]) {
  const s = wsSide[r.key];
  if (!r.startMeasurable || !s?.opening) continue;
  openRef.push(OPENING_KEYS.map((k) => s.opening.v[k]));
  openRefKeys.push(r.key);
}
const openScale: VecScale | null = openRef.length >= 10 ? scaleOf(openRef) : null;
// the familiar maps for the score's surprise (as investigation/workshop/score.ts): the official maps
// and the current generator's seeds 1–30 at 128² from the workshop study
const familiar = [...official.map((r) => input(r.key, r.raw)), ...readGenerated(join(WORKSHOP, "generated")).map((r: Row) => input(`g:${r.key}`, r.raw))];

function natDamRate(keys: string[]): number {
  const v = keys.map((k) => wsSide[k]?.opening).filter(Boolean);
  return v.length ? v.filter((o: any) => o.shortest40 !== null && o.shortest40 <= 5).length / v.length : NaN;
}

// ------------------------------------------------------------------------------ generated sets

interface MapRec {
  key: string;
  theme: string;
  rec: any;
  x: any;
}

function loadSet(dir: string): { maps: MapRec[]; attempts: Record<string, { n: number; first: number; final: number }> } {
  const maps: MapRec[] = [];
  const attempts: Record<string, { n: number; first: number; final: number }> = {};
  for (const f of readdirSync(dir).filter((n) => /^[a-zA-Z]+-\d+\.json$/.test(n))) {
    const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const t = (attempts[rec.theme] ??= { n: 0, first: 0, final: 0 });
    t.n++;
    if (rec.passed) {
      t.final++;
      if (rec.attempts === 1) t.first++;
    }
    if (!rec.passed || !rec.layout) continue;
    const xp = join(dir, f.replace(/\.json$/, ".x.json"));
    maps.push({ key: rec.key, theme: rec.theme, rec, x: existsSync(xp) ? JSON.parse(readFileSync(xp, "utf8")) : null });
  }
  maps.sort((a, b) => a.theme.localeCompare(b.theme) || a.rec.seed - b.rec.seed);
  return { maps, attempts };
}

function clusterStats(n: number, d: (i: number, j: number) => number, cut: number) {
  const cl = upgma(n, d, cut);
  return { clusters: cl.length, largest: cl[0]?.length ?? 0, largestShare: r3((cl[0]?.length ?? 0) / Math.max(1, n)), singletons: cl.filter((c) => c.length === 1).length };
}

function measureMaps(maps: MapRec[]) {
  const n = maps.length;
  const V = maps.map((m) => input(m.key, m.rec));
  const nn = V.map((a, i) => V.reduce((best, b, j) => (i === j ? best : Math.min(best, distance(a, b, vScale))), Infinity));
  const vd = (i: number, j: number) => distance(V[i], V[j], vScale);
  const rv = maps.map((m) => riverVector(m.rec));
  const lv = maps.map((m) => reliefVector(m.rec));
  const withOpen = maps.filter((m) => m.x?.opening);
  const ov = withOpen.map((m) => OPENING_KEYS.map((k) => m.x.opening.v[k]));
  const toWorkshop = V.map((a) => W.reduce((best, b) => Math.min(best, distance(a, b, vScale)), Infinity));
  let openPairs = 0;
  let openSum = 0;
  if (openScale)
    for (let i = 0; i < ov.length; i++)
      for (let j = i + 1; j < ov.length; j++) {
        openSum += scaledDistance(ov[i], ov[j], openScale);
        openPairs++;
      }
  const cat = (f: (o: any) => string) => {
    const c: Record<string, number> = {};
    for (const m of withOpen) {
      const k = f(m.x.opening.facts);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };
  const withX = maps.filter((m) => m.x);
  const s40 = withX.map((m) => m.x.opening?.shortest40 ?? null);
  const storage = withX.filter((m) => m.x.storage);
  // the score (lib/score.ts, score-params.json): surprise against the familiar maps, engineering from
  // the obviousness of the start's reservoir
  const scores = maps.map((m) => {
    const a = input(m.key, m.rec);
    let sur = Infinity;
    for (const b of familiar) sur = Math.min(sur, distance(a, b, vScale));
    const o = m.x?.opening;
    const obv = o ? { shortestHolding20: o.shortest20, shortestHolding40: o.shortest40 } : null;
    return scoreOf(components(m.rec, params, sur, obv), params.weights);
  });
  return {
    maps: n,
    M1: { nearestMin: r3(Math.min(...nn)), nearestMedian: r3(med(nn)), nearestP10: r3(pct(nn, 0.1)), below025: nn.filter((x) => x < 0.25).length, pass: Math.min(...nn) >= 0.25 && med(nn) >= 0.4 },
    M2a: { ...clusterStats(n, vd, vCut), pass: false },
    M2b: { ...clusterStats(n, (i, j) => scaledDistance(rv[i], rv[j], riverScale), riverScale.nnP10), codes: new Set(maps.map((m) => riverCode(m.rec))).size },
    M2c: { ...clusterStats(n, (i, j) => scaledDistance(lv[i], lv[j], reliefScale), reliefScale.nnP10), codes: new Set(maps.map((m) => reliefCode(m.rec))).size },
    M3: openScale
      ? {
          maps: ov.length,
          ...clusterStats(ov.length, (i, j) => scaledDistance(ov[i], ov[j], openScale), openScale.nnP10),
          spread: r3(openSum / Math.max(1, openPairs)),
          water: cat((f) => f.waterKind),
          drought: cat((f) => f.drought),
          threat: cat((f) => (f.threat ? `${f.threat.kind}${f.threat.upstream ? " (reaches the start's water)" : ""}` : "none near")),
          openDirections: cat((f) => String(f.openTo.length)),
          land: cat((f) => f.land),
        }
      : null,
    M4: { nearestMin: r3(Math.min(...toWorkshop)), nearestP10: r3(pct(toWorkshop, 0.1)), nearestMedian: r3(med(toWorkshop)), below: toWorkshop.filter((x) => x < vCut).length, pass: Math.min(...toWorkshop) >= vCut },
    M5: withX.length ? { maps: withX.length, goodNaturalDam: r3(s40.filter((s) => s !== null && s <= 5).length / withX.length), within12: r3(s40.filter((s) => s !== null && s <= 12).length / withX.length), anyLength: r3(s40.filter((s) => s !== null).length / withX.length) } : null,
    M6: withX.length ? { maps: withX.length, flagged: withX.filter((m) => m.x.walls?.length).length } : null,
    M7: storage.length ? { maps: storage.length, pass: r3(storage.filter((m) => m.x.storage.ok).length / storage.length) } : null,
    score: { median: r3(med(scores)), p10: r3(pct(scores, 0.1)), p90: r3(pct(scores, 0.9)) },
    shape: {
      plateausMedian: med(maps.map((m) => m.rec.score.plateaus)),
      flatShareMedian: r3(med(maps.map((m) => m.rec.metrics.flatShare))),
      heightRangeMedian: med(maps.map((m) => m.rec.metrics.heightRange)),
      waterShareMedian: r3(med(maps.map((m) => m.rec.metrics.waterShare))),
      waterfallsMedian: med(maps.map((m) => m.rec.metrics.waterfalls)),
      maxFallMedian: r3(med(maps.map((m) => m.rec.water.maxFallDrop))),
      straightShare8Median: r3(med(maps.map((m) => m.rec.natural.straightShare8))),
      longestRunMedian: med(maps.map((m) => m.rec.natural.longestRun)),
      flows: (() => {
        const c: Record<string, number> = {};
        for (const m of maps) c[m.rec.water.flow] = (c[m.rec.water.flow] ?? 0) + 1;
        return c;
      })(),
    },
  };
}

const out: any = {
  method: "docs/m9-design.md §10. V: investigation/workshop/lib/variety.ts with variety-scale.json. Clusters: UPGMA cut at the workshop's p10 nearest-peer distance on each measure's own scale.",
  workshop: {
    maps: W.length,
    vNearestP10: r3(vCut),
    vNearestMedian: r3(med(wsNN)),
    river: { d0: r3(riverScale.d0), cut: r3(riverScale.nnP10), spread: riverScale.spread.map(r3) },
    relief: { d0: r3(reliefScale.d0), cut: r3(reliefScale.nnP10), spread: reliefScale.spread.map(r3) },
    opening: openScale ? { maps: openRef.length, d0: r3(openScale.d0), cut: r3(openScale.nnP10), spread: openScale.spread.map(r3), keys: OPENING_KEYS } : null,
    goodNaturalDam: { workshop: r3(natDamRate(workshop.map((r) => r.key).filter((k) => wsSide[k]?.opening))), official: r3(natDamRate(official.map((r) => r.key).filter((k) => wsSide[k]?.opening))) },
    walls: {
      official: official.filter((r) => wsSide[r.key]?.walls?.length).length,
      officialMaps: official.filter((r) => wsSide[r.key]).length,
      workshop: workshop.filter((r) => wsSide[r.key]?.walls?.length).length,
      workshopMaps: workshop.filter((r) => wsSide[r.key]).length,
    },
  },
  sets: {} as Record<string, unknown>,
};
// the workshop's own clusters on each measure, for reference
out.workshop.M2a = clusterStats(W.length, (i, j) => distance(W[i], W[j], vScale), vCut);
if (openScale) out.workshop.M3 = { ...clusterStats(openRef.length, (i, j) => scaledDistance(openRef[i], openRef[j], openScale), openScale.nnP10) };

const sets = arg("sets", existsSync(MAPS) ? readdirSync(MAPS).join(",") : "").split(",").filter(Boolean);
for (const s of sets) {
  const dir = join(MAPS, s);
  if (!existsSync(dir)) continue;
  const { maps, attempts } = loadSet(dir);
  const themes = [...new Set(maps.map((m) => m.theme))].sort();
  const byTheme: Record<string, unknown> = {};
  for (const t of themes) {
    const m = measureMaps(maps.filter((x) => x.theme === t));
    (m.M2a as any).pass = m.M2a.largestShare <= 0.15;
    byTheme[t] = { attempts: attempts[t], ...m };
  }
  out.sets[s] = { byTheme, all: measureMaps(maps) };
  console.log(`measured ${s}: ${maps.length} maps`);
}
// the current M9 plan: River Valley with the study's recipes mixed in as premises (128² only)
const recDir = join(WORKSHOP, "recipes");
if (existsSync(join(MAPS, "current-128")) && existsSync(recDir)) {
  const rv = loadSet(join(MAPS, "current-128")).maps.filter((m) => m.theme === "riverValley");
  const recipes: MapRec[] = readdirSync(recDir)
    .filter((n) => /-128-\d+\.json$/.test(n))
    .map((n) => {
      const rec = JSON.parse(readFileSync(join(recDir, n), "utf8"));
      const xp = join(recDir, n.replace(/\.json$/, ".x.json"));
      return { key: rec.key, theme: "riverValley", rec, x: existsSync(xp) ? JSON.parse(readFileSync(xp, "utf8")) : null };
    })
    .filter((m) => m.rec.passed !== false && m.rec.layout);
  const m = measureMaps([...rv, ...recipes]);
  (m.M2a as any).pass = m.M2a.largestShare <= 0.15;
  out.m9Plan = { note: "River Valley seeds 1–200 at 128² (m8-done) with the workshop study's 11 recipes' 128² maps mixed in as premises", recipeMaps: recipes.length, ...m };
}
writeFileSync(join(HERE, "measures.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
