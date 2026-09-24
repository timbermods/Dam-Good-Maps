// The interestingness score prototype (lib/score.ts): derive its default parameters from the
// official and workshop maps and the popularity hints, score every map, and check M9's criterion
// (the recommended official maps in the top third of the official scores).
//
//   npx tsx investigation/workshop/score.ts
//
// Writes investigation/workshop/score-params.json (the default parameters, data the product can
// adopt), and C:\dgm-workshop\score.json (aggregates, copied into investigation/workshop.json) and
// score-local.json (per-map scores, local only).
//
// Default target: the one-level step share and the water share aim at the median of the
// "preferred" maps: the recommended official maps and the workshop maps in the top third of
// popularity for their age. The other components are "more is better" within official ranges.
// Weights start from PLAN §12 (lib/score.ts DEFAULT_WEIGHTS); when the criterion fails, a small
// search moves weight between components, as little as it can, until it holds.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readGenerated, readTable, spearman, stat, type Row } from "./lib/table";
import { ROOT } from "./lib/paths";
import { popularityResiduals } from "./lib/popularity";
import { COMPONENTS, components, DEFAULT_WEIGHTS, scoreOf, type Component, type ScoreParams } from "./lib/score";
import { distance, featureVector, scaleFrom, type VarietyInput } from "./lib/variety";

const rows = readTable();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const gen = readGenerated();

const median = (v: number[]) => {
  const s = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
const pctl = (v: number[], p: number) => {
  const s = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))] : 0;
};

// ---- surprise: distance to the nearest familiar map (official maps and the current generator)
const input = (r: Row): VarietyInput => ({ key: r.key, layout: r.raw.layout, features: featureVector(r.raw) });
const scale = scaleFrom(workshop.map(input));
const familiar = [...official, ...gen].map(input);
function surpriseOf(r: Row): number {
  const a = input(r);
  let best = Infinity;
  for (const b of familiar) if (b.key !== a.key) best = Math.min(best, distance(a, b, scale));
  return best;
}
const surprise = new Map<string, number>();
for (const r of [...workshop, ...official, ...gen]) surprise.set(r.key, surpriseOf(r));

// ---- preferred maps: recommended officials and the most popular third of the workshop for its age
const { resid } = popularityResiduals(rows);
const ranked = [...resid.entries()].sort((a, b) => b[1] - a[1]);
const topThird = new Set(ranked.slice(0, Math.ceil(ranked.length / 3)).map(([k]) => k));
const preferred = [...official.filter((r) => r.recommended), ...workshop.filter((r) => topThird.has(r.key))];

const ringMedian = (key: "trees" | "bushes" | "scrap") => {
  const sets = official.map((r) => r.raw.score.rings[key]).filter((x): x is number[] => !!x);
  const out = [0, 1, 2, 3, 4].map((k) => median(sets.map((s) => s[k])));
  const tot = out.reduce((a, b) => a + b, 0) || 1;
  return out.map((v) => Math.round((v / tot) * 1000) / 1000);
};
const plateausBy = (sc: "small" | "medium" | "large" | "max") => {
  const set = official.filter((r) => r.sizeClass === sc);
  return set.length ? median(set.map((r) => r.raw.score.plateaus)) : median(official.map((r) => r.raw.score.plateaus));
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const params: ScoreParams = {
  version: 1,
  weights: { ...DEFAULT_WEIGHTS },
  targets: {
    step1Share: r3(median(preferred.map((r) => r.v.step1Share!))),
    waterShare: r3(median(preferred.map((r) => r.v.waterShare!))),
  },
  bands: {
    step1Share: 0.35,
    waterShare: r3(Math.max(0.1, (pctl(workshop.map((r) => r.v.waterShare!), 90) - pctl(workshop.map((r) => r.v.waterShare!), 10)) / 2)),
  },
  norms: {
    damLog: [r3(Math.log10(65)), r3(Math.log10(4479))],
    levels1pct: [12, 17],
    regions: [pctl(official.map((r) => r.raw.score.regions), 10), pctl(official.map((r) => r.raw.score.regions), 90)],
    sinuosity: [1, 1.6],
    courseLength: [0.5, 1.5],
    plateausBySize: { small: plateausBy("small"), medium: plateausBy("medium"), large: plateausBy("large"), max: plateausBy("max") },
    rings: { trees: ringMedian("trees"), bushes: ringMedian("bushes"), scrap: ringMedian("scrap") },
    surprise: [r3(pctl(workshop.map((r) => surprise.get(r.key)!), 10)), r3(pctl(workshop.map((r) => surprise.get(r.key)!), 90))],
    straight: [r3(pctl(workshop.map((r) => r.v.straightShare8!), 10)), r3(pctl(workshop.map((r) => r.v.straightShare8!), 90))],
    ridgeCV: [r3(gen.length ? median(gen.map((r) => r.v.ridgeThicknessCV ?? 0)) : 0.1), r3(median(workshop.map((r) => r.v.ridgeThicknessCV ?? 0)))],
  },
};

const comps = new Map<string, Record<Component, number>>();
for (const r of [...workshop, ...official, ...gen]) comps.set(r.key, components(r.raw, params, surprise.get(r.key) ?? null));

function officialRanks(w: Record<Component, number>): { name: string; score: number; rank: number }[] {
  return official
    .map((r) => ({ name: r.title, score: scoreOf(comps.get(r.key)!, w) }))
    .sort((a, b) => b.score - a.score)
    .map((x, k) => ({ ...x, rank: k + 1 }));
}
const recommended = official.filter((r) => r.recommended).map((r) => r.title);
const topCut = Math.ceil(official.length / 3);
const holds = (w: Record<Component, number>) => officialRanks(w).filter((x) => recommended.includes(x.name)).every((x) => x.rank <= topCut);

// the search: move 0.02 of weight from one component to another, keeping the change that most
// raises the worst recommended map's rank, until the criterion holds (at most 60 moves)
let w = { ...params.weights };
const worst = (ww: Record<Component, number>) => Math.max(...officialRanks(ww).filter((x) => recommended.includes(x.name)).map((x) => x.rank));
const gap = (ww: Record<Component, number>) => {
  const rk = officialRanks(ww);
  const cutScore = rk[topCut - 1].score;
  return rk.filter((x) => recommended.includes(x.name)).reduce((s, x) => s + Math.max(0, cutScore - x.score), 0);
};
const moves: string[] = [];
for (let it = 0; it < 60 && !holds(w); it++) {
  let best: { w: Record<Component, number>; key: [number, number]; label: string } | null = null;
  for (const from of COMPONENTS) {
    if (w[from] < 0.021) continue;
    for (const to of COMPONENTS) {
      if (to === from) continue;
      const c = { ...w, [from]: r3(w[from] - 0.02), [to]: r3(w[to] + 0.02) };
      const key: [number, number] = [worst(c), gap(c)];
      if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { w: c, key, label: `${from} → ${to}` };
    }
  }
  if (!best) break;
  w = best.w;
  moves.push(best.label);
}
params.weights = w;
const criterion = holds(w);

writeFileSync(join(process.cwd(), "investigation", "workshop", "score-params.json"), JSON.stringify(params, null, 1) + "\n");

// ---- scores and aggregates
const scoreMap = new Map<string, number>();
for (const [k, c] of comps) scoreMap.set(k, scoreOf(c, w));
const statScores = (set: Row[]) => stat(set.map((r) => scoreMap.get(r.key)!), 1);
const themes = [...new Set(gen.map((g) => g.theme!))].sort();
const byTheme: Record<string, unknown> = {};
for (const t of themes) byTheme[t] = statScores(gen.filter((g) => g.theme === t));
const compStats: Record<string, unknown> = {};
for (const k of COMPONENTS) {
  compStats[k] = {
    official: stat(official.map((r) => comps.get(r.key)![k])),
    workshop: stat(workshop.map((r) => comps.get(r.key)![k])),
    generated128: stat(gen.map((r) => comps.get(r.key)![k])),
  };
}
// sanity: does the score follow popularity at all? (a hint, not a goal)
const withPop = workshop.filter((r) => resid.has(r.key));
const rho = withPop.length ? spearman(withPop.map((r) => scoreMap.get(r.key)!), withPop.map((r) => resid.get(r.key)!)) : null;
const out = {
  method: "lib/score.ts: 11 components, each 0–1; score = 100 × weighted mean. Parameters in investigation/workshop/score-params.json.",
  criterion: { rule: "the recommended official maps (Plains, Lakes, Waterfalls) in the top third of the 19 official scores", holds: criterion, weightMoves: moves, officialRanks: officialRanks(w).map((x) => ({ ...x, score: Math.round(x.score * 10) / 10 })) },
  defaultTarget: { preferredMaps: preferred.length, step1Share: params.targets.step1Share, waterShare: params.targets.waterShare, scoreMedianOfPreferred: Math.round(median(preferred.map((r) => scoreMap.get(r.key)!)) * 10) / 10 },
  scores: { official: statScores(official), workshop: statScores(workshop), generated128: statScores(gen), generatedByTheme: byTheme },
  components: compStats,
  popularityHint: { spearmanScoreVsPopularityForAge: rho === null ? null : Math.round(rho * 100) / 100, maps: withPop.length },
};
writeFileSync(join(ROOT, "score.json"), JSON.stringify(out, null, 1));
writeFileSync(join(ROOT, "score-local.json"), JSON.stringify(Object.fromEntries([...scoreMap].map(([k, v]) => [k, { score: Math.round(v * 10) / 10, components: comps.get(k), surprise: surprise.get(k) }])), null, 1));
console.log(JSON.stringify(out, null, 1));
