// The recipe runner: each premise recipe on 10 seeds at 96² and 128², plus 3 at 256². A run
// generates the base map with the current generator, opens it in a MapSession, applies the recipe
// (up to 3 attempts, each on a fresh base, as the generator's retry loop would), and validates the
// result with the real validators in the `generate` profile. Every result is measured like the
// workshop maps (lib/measures.ts), so its variety and naturalness compare directly.
//
//   npx tsx investigation/workshop/run-recipes.ts [--only spiral,moat] [--seeds 1-10] [--sizes 96,128] [--big 3]
//
// Local output: C:\dgm-workshop\recipes\<recipe>-<size>-<seed>.json (+ .timber and settled water
// for renders); the aggregate goes to C:\dgm-workshop\recipes-aggregate.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blocks } from "../../src/core/validate/report";
import { writeTimber } from "../../src/core/format/timber";
import { lowPriority, ROOT } from "./lib/paths";
import { measureFile } from "./lib/measures";
import { openBase, rng, RecipeFailure, topUpBushes, type Recipe, type RecipeContext } from "./recipes/lib";
import { RECIPES } from "./recipes/index";

lowPriority();
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const only = arg("only", "").split(",").filter(Boolean);
const [s0, s1] = arg("seeds", "1-10").split("-").map(Number);
const sizes = arg("sizes", "96,128").split(",").map(Number);
const big = Number(arg("big", "3"));
const MAX_ATTEMPTS = 3;
const dir = join(ROOT, "recipes");
mkdirSync(dir, { recursive: true });

interface RunResult {
  recipe: string;
  size: number;
  seed: number;
  passed: boolean;
  firstAttempt: boolean;
  attempts: number;
  failed: string[];
  notes: string[];
  ms: number;
}

function runOnce(recipe: Recipe, size: number, seed: number): RunResult {
  const t0 = performance.now();
  const failed: string[] = [];
  const notes: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { session, base } = openBase(recipe.theme, seed, size, recipe.settings);
    const ctx: RecipeContext = { session, base, spec: base.spec, W: size, H: size, rand: rng(seed * 7919 + size * 31 + attempt * 104729), attempt, notes: [] };
    try {
      recipe.apply(ctx);
      topUpBushes(ctx);
    } catch (e) {
      if (!(e instanceof RecipeFailure)) throw e;
      failed.push(`attempt ${attempt + 1}: ${e.message}`);
      continue;
    }
    const file = session.exportFile();
    const { m, v } = measureFile(file, { spec: session.spec, features: session.features, water: { model: session.built.waterModel, settled: session.built.settle } });
    const blocking = v.report.checks.filter((c) => blocks("generate", c)).map((c) => `${c.id} (${c.message})`);
    if (!v.report.passed) {
      failed.push(`attempt ${attempt + 1}: ${blocking.join("; ")}`);
      if (attempt < MAX_ATTEMPTS - 1) continue;
    }
    const key = `${recipe.id}-${size}-${seed}`;
    writeFileSync(join(dir, `${key}.json`), JSON.stringify({ key, source: "generated", recipe: recipe.id, theme: recipe.theme, seed, size, passed: v.report.passed, attempts: attempt + 1, ...m }));
    writeFileSync(join(dir, `${key}.timber`), writeTimber(file));
    const N = m.area;
    const buf = new Float32Array(3 * N);
    buf.set(v.water!.depth, 0);
    buf.set(v.water!.contamination, N);
    buf.set(v.analysis!.moisture, 2 * N);
    writeFileSync(join(dir, `${key}.f32`), new Uint8Array(buf.buffer));
    notes.push(...ctx.notes);
    return { recipe: recipe.id, size, seed, passed: v.report.passed, firstAttempt: v.report.passed && attempt === 0, attempts: attempt + 1, failed, notes, ms: Math.round(performance.now() - t0) };
  }
  return { recipe: recipe.id, size, seed, passed: false, firstAttempt: false, attempts: MAX_ATTEMPTS, failed, notes, ms: Math.round(performance.now() - t0) };
}

const results: RunResult[] = [];
for (const recipe of RECIPES) {
  if (only.length && !only.includes(recipe.id)) continue;
  const plan: [number, number][] = [];
  for (const size of sizes) for (let s = s0; s <= s1; s++) plan.push([size, s]);
  for (let s = s0; s < s0 + big; s++) plan.push([256, s]);
  for (const [size, seed] of plan) {
    const r = runOnce(recipe, size, seed);
    results.push(r);
    console.log(`${recipe.id.padEnd(16)} ${String(size).padStart(3)} seed ${String(seed).padStart(2)}: ${r.passed ? (r.firstAttempt ? "pass" : `pass after ${r.attempts}`) : "FAIL"}  ${r.ms} ms${r.failed.length ? "  | " + r.failed.join(" | ").slice(0, 300) : ""}`);
  }
}

// a partial rerun (--only) replaces those recipes' runs and keeps the others
const runsPath = join(ROOT, "recipes-runs.json");
if (only.length && existsSync(runsPath)) {
  const earlier = (JSON.parse(readFileSync(runsPath, "utf8")) as RunResult[]).filter((r) => !only.includes(r.recipe));
  results.unshift(...earlier);
}
const agg: Record<string, unknown> = {};
for (const recipe of RECIPES) {
  const rs = results.filter((r) => r.recipe === recipe.id);
  if (!rs.length) continue;
  const bySize: Record<string, unknown> = {};
  for (const size of [...new Set(rs.map((r) => r.size))]) {
    const s = rs.filter((r) => r.size === size);
    bySize[size] = { runs: s.length, final: s.filter((r) => r.passed).length, first: s.filter((r) => r.firstAttempt).length };
  }
  const fails = new Map<string, number>();
  for (const r of rs) for (const f of r.failed) for (const id of f.match(/[a-z]+\.[a-z_]+/g) ?? []) fails.set(id, (fails.get(id) ?? 0) + 1);
  agg[recipe.id] = {
    name: recipe.name,
    pattern: recipe.pattern,
    whimsical: recipe.whimsical,
    theme: recipe.theme,
    runs: rs.length,
    finalPass: Math.round((1000 * rs.filter((r) => r.passed).length) / rs.length) / 1000,
    firstPass: Math.round((1000 * rs.filter((r) => r.firstAttempt).length) / rs.length) / 1000,
    bySize,
    failingChecks: Object.fromEntries([...fails].sort((a, b) => b[1] - a[1])),
    medianMs: rs.map((r) => r.ms).sort((a, b) => a - b)[rs.length >> 1],
  };
}
writeFileSync(runsPath, JSON.stringify(results, null, 1));
writeFileSync(join(ROOT, "recipes-aggregate.json"), JSON.stringify(agg, null, 1));
console.log(JSON.stringify(agg, null, 1));
