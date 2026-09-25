// fit-score: refit the interestingness score's target and weights from Kyler's ratings.
//
//   npx tsx investigation/workshop/fit-score.ts
//
// Reads C:\dgm-workshop\ratings.json (the rating page's file: "fun" and "unique", 1–5, per map).
// Until that file exists the default target stands (investigation/workshop/score-params.json) and
// nothing is written. When it exists, writes investigation/workshop/score-fitted.json: the fitted
// targets and weights with fit diagnostics. It never writes a map's own rating. Run it again
// whenever the ratings change; M9 uses score-fitted.json when present, else score-params.json.
//
// The fit:
// - the rating to explain is the mean of fun and unique, per map;
// - weights: non-negative, summing to 1, found by projected gradient descent on the squared error
//   of a + b·score, pulled toward the default weights by a ridge term whose strength is chosen by
//   leave-one-out error (few ratings: the defaults matter);
// - targets (one-level step share, water share): the mean over the maps rated above the median,
//   weighted by how far above, shrunk toward the default by 10 maps' worth.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readGenerated, readTable, spearman, type Row } from "./lib/table";
import { RATINGS, ROOT } from "./lib/paths";
import { COMPONENTS, components, scoreOf, type Component, type ReservoirHelp, type ScoreParams } from "./lib/score";
import { distance, featureVector, scaleFrom, type VarietyInput } from "./lib/variety";

const PARAMS = join(process.cwd(), "investigation", "workshop", "score-params.json");
const FITTED = join(process.cwd(), "investigation", "workshop", "score-fitted.json");

if (!existsSync(RATINGS)) {
  console.log(`No ratings at ${RATINGS} yet: the default target in score-params.json stands. Nothing written.`);
  process.exit(0);
}
const defaults: ScoreParams = JSON.parse(readFileSync(PARAMS, "utf8"));
const file = JSON.parse(readFileSync(RATINGS, "utf8")) as { saved?: string; ratings: Record<string, { fun?: number; unique?: number }> };
const rows = readTable();
const gen = readGenerated();
const byKey = new Map(rows.map((r) => [r.key, r] as const));

// surprise needs the same reference as score.ts: official maps and the current generator
const input = (r: Row): VarietyInput => ({ key: r.key, layout: r.raw.layout, features: featureVector(r.raw) });
const scale = scaleFrom(rows.filter((r) => r.source === "workshop").map(input));
const familiar = [...rows.filter((r) => r.source === "official"), ...gen].map(input);
const surprise = (r: Row) => familiar.reduce((m, b) => (b.key === r.key ? m : Math.min(m, distance(input(r), b, scale))), Infinity);
const obvPath = join(ROOT, "obviousness.json");
const obv: Record<string, ReservoirHelp> = existsSync(obvPath) ? JSON.parse(readFileSync(obvPath, "utf8")) : {};
const obvOf = (r: Row): ReservoirHelp | null => (r.waterReliable ? obv[r.key] ?? null : null);

interface Sample {
  row: Row;
  c: Record<Component, number>;
  y: number;
  fun: number;
  unique: number;
  step1: number;
  water: number;
}
const samples: Sample[] = [];
for (const [key, r] of Object.entries(file.ratings)) {
  const row = byKey.get(key);
  if (!row || !(r.fun && r.unique)) continue;
  samples.push({ row, c: components(row.raw, defaults, surprise(row), obvOf(row)), y: (r.fun + r.unique) / 2, fun: r.fun, unique: r.unique, step1: row.v.step1Share!, water: row.v.waterShare! });
}
if (samples.length < 8) {
  console.log(`Only ${samples.length} maps have both ratings: at least 8 are needed. The default target stands.`);
  process.exit(0);
}

// targets first: the mean over the maps rated above the median, weighted by how far above,
// shrunk toward the default by 10 maps' worth; the components are then recomputed with them
const med = samples.map((d) => d.y).sort((a, b) => a - b)[samples.length >> 1];
const above = samples.filter((d) => d.y > med);
const shrink = (vals: (d: Sample) => number, def: number) => {
  const tw = above.reduce((p, d) => p + (d.y - med), 0);
  if (!tw) return def;
  const fit = above.reduce((p, d) => p + (d.y - med) * vals(d), 0) / tw;
  return Math.round(((above.length * fit + 10 * def) / (above.length + 10)) * 1000) / 1000;
};
const targets = { step1Share: shrink((d) => d.step1, defaults.targets.step1Share), waterShare: shrink((d) => d.water, defaults.targets.waterShare) };
for (const d of samples) d.c = components(d.row.raw, { ...defaults, targets }, surprise(d.row), obvOf(d.row));

/** a + b·s by least squares, and the squared error. */
function affine(s: number[], y: number[]): { a: number; b: number; sse: number } {
  const n = s.length;
  const ms = s.reduce((p, q) => p + q, 0) / n;
  const my = y.reduce((p, q) => p + q, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (s[i] - ms) * (y[i] - my);
    sxx += (s[i] - ms) ** 2;
  }
  const b = sxx ? Math.max(0, sxy / sxx) : 0;
  const a = my - b * ms;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - a - b * s[i]) ** 2;
  return { a, b, sse };
}

/** Project onto the simplex (weights ≥ 0, sum 1). */
function simplex(v: number[]): number[] {
  const u = v.slice().sort((p, q) => q - p);
  let css = 0;
  let theta = 0;
  for (let k = 0; k < u.length; k++) {
    css += u[k];
    const t = (css - 1) / (k + 1);
    if (u[k] - t > 0) theta = t;
  }
  return v.map((x) => Math.max(0, x - theta));
}

function fitWeights(data: Sample[], lambda: number): number[] {
  const w0 = COMPONENTS.map((k) => defaults.weights[k]);
  const tot = w0.reduce((p, q) => p + q, 0);
  let w = w0.map((x) => x / tot);
  const X = data.map((d) => COMPONENTS.map((k) => d.c[k]));
  const y = data.map((d) => d.y);
  for (let it = 0; it < 3000; it++) {
    const s = X.map((row) => row.reduce((p, x, k) => p + x * w[k], 0));
    const { a, b } = affine(s, y);
    const grad = w.map((_, k) => {
      let g = 0;
      for (let i = 0; i < X.length; i++) g += -2 * (y[i] - a - b * s[i]) * b * X[i][k];
      return g / X.length + 2 * lambda * (w[k] - w0[k] / tot);
    });
    w = simplex(w.map((x, k) => x - 0.05 * grad[k]));
  }
  return w;
}

function predict(w: number[], d: Sample): number {
  return COMPONENTS.reduce((p, k, i) => p + w[i] * d.c[k], 0);
}

// leave-one-out error for each ridge strength
const lambdas = [0.03, 0.1, 0.3, 1, 3];
let bestL = 1;
let bestErr = Infinity;
for (const L of lambdas) {
  let err = 0;
  for (let i = 0; i < samples.length; i++) {
    const train = samples.filter((_, j) => j !== i);
    const w = fitWeights(train, L);
    const s = train.map((d) => predict(w, d));
    const { a, b } = affine(s, train.map((d) => d.y));
    err += (samples[i].y - a - b * predict(w, samples[i])) ** 2;
  }
  if (err < bestErr) {
    bestErr = err;
    bestL = L;
  }
}
const w = fitWeights(samples, bestL);
const weights = Object.fromEntries(COMPONENTS.map((k, i) => [k, Math.round(w[i] * 1000) / 1000])) as Record<Component, number>;
const fitted: ScoreParams = { ...defaults, weights, targets };

const before = samples.map((d) => scoreOf(components(d.row.raw, defaults, surprise(d.row), obvOf(d.row)), defaults.weights));
const after = samples.map((d) => scoreOf(d.c, fitted.weights));
const rho = (s: number[], key: "y" | "fun" | "unique") => Math.round(spearman(s, samples.map((d) => d[key])) * 100) / 100;
// M9's criterion with the fitted weights
const official = rows.filter((r) => r.source === "official");
const offScores = official.map((r) => ({ r, s: scoreOf(components(r.raw, fitted, surprise(r), obvOf(r)), fitted.weights) })).sort((a, b) => b.s - a.s);
const cut = Math.ceil(official.length / 3);
const criterion = offScores.filter((x) => x.r.recommended).every((x) => offScores.indexOf(x) < cut);

const out = {
  fittedFrom: { maps: samples.length, ratingsSaved: file.saved ?? null, ridge: bestL, looRmse: Math.round(Math.sqrt(bestErr / samples.length) * 100) / 100 },
  ...fitted,
  diagnostics: {
    spearmanWithRating: { defaultWeights: { mean: rho(before, "y"), fun: rho(before, "fun"), unique: rho(before, "unique") }, fittedWeights: { mean: rho(after, "y"), fun: rho(after, "fun"), unique: rho(after, "unique") } },
    m9Criterion: criterion,
  },
};
writeFileSync(FITTED, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
