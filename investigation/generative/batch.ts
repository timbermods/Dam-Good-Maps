// Generate a batch of maps with one generator, measure each the way the workshop study measures
// every map (investigation/workshop/lib/measures.ts), and keep the map, its settled water and its
// record locally for the measures, the score, the renders and the rating page.
//
//   npx tsx investigation/generative/batch.ts --gen current|proto --themes riverValley,canyon
//        [--seeds 1-200] [--size 128] [--difficulty normal] [--no-files]
//
// `current` is the generator in src/ (m8-done, 0.6.0): the baseline. `proto` is the prototype in
// investigation/generative/proto/. Records land in <ROOT>\maps\<gen>-<size>\<theme>-<seed>.json,
// with the .timber and the settled water (.f32: depth, contamination, moisture) beside them.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate as generateCurrent, type GenerateResult } from "../../src/core/gen/generate";
import { blocks } from "../../src/core/validate/report";
import { AVAILABLE_THEMES, makeSpec, type Difficulty, type ThemeId } from "../../src/core/spec/mapspec";
import { measureFile } from "../workshop/lib/measures";
import { arg, lowPriority, mapDir, parseSeeds } from "./lib/paths";

export type Generator = (theme: ThemeId, seed: number, size: number, difficulty: Difficulty) => GenerateResult & { recipe?: string | null; genome?: unknown; storage?: unknown; info?: unknown };

export async function generatorOf(name: string): Promise<Generator> {
  if (name === "current") return (theme, seed, size, difficulty) => generateCurrent(makeSpec({ seed, theme, size: { x: size, y: size }, designedFor: difficulty }));
  if (name === "proto") {
    const m = await import("./proto/generate");
    return (theme, seed, size, difficulty) => m.generateProto(theme, seed, size, difficulty);
  }
  throw new Error(`unknown generator ${name}`);
}

async function main(): Promise<void> {
  lowPriority();
  const gen = arg("gen", "current");
  const size = Number(arg("size", "128"));
  const seeds = parseSeeds(arg("seeds", "1-200"));
  const themes = arg("themes", AVAILABLE_THEMES.join(",")).split(",") as ThemeId[];
  const difficulty = arg("difficulty", "normal") as Difficulty;
  const files = !process.argv.includes("--no-files");
  const dir = mapDir(gen === "current" ? "current" : gen, size) + (difficulty === "normal" ? "" : `-${difficulty}`);
  mkdirSync(dir, { recursive: true });
  const run = await generatorOf(gen);
  for (const theme of themes) {
    let pass = 0;
    let first = 0;
    for (const seed of seeds) {
      const t0 = performance.now();
      const r = run(theme, seed, size, difficulty);
      const ms = Math.round(performance.now() - t0);
      const key = `${theme}-${seed}`;
      const failed = r.report.checks.filter((c) => blocks("generate", c)).map((c) => c.id);
      const ok = r.report.passed && (!r.storage || (r.storage as { ok: boolean }).ok);
      if (ok) pass++;
      if (ok && r.attempts === 1) first++;
      const storage = r.storage ? { ok: (r.storage as { ok: boolean }).ok, value: (r.storage as { value?: unknown }).value ?? null, message: (r.storage as { message: string }).message } : null;
      const info = r.info as { start?: unknown; badwater?: unknown; hydro?: unknown; stage?: unknown; ms?: unknown } | undefined;
      const passed = r.report.passed && (!storage || storage.ok);
      const base = { key, gen, theme, seed, size, difficulty, passed, attempts: r.attempts, failures: r.failures, failed, ms, recipe: r.recipe ?? null, genome: r.genome ?? null, storage, info: info ? { start: info.start, badwater: info.badwater, hydro: info.hydro, stage: info.stage, ms: info.ms } : null };
      if (!passed) {
        writeFileSync(join(dir, `${key}.json`), JSON.stringify(base));
        console.log(`${gen} ${size} ${key.padEnd(18)} FAIL ${r.attempts} ${failed.join(",")}`);
        continue;
      }
      const { m, v } = measureFile(r.file, { spec: r.spec, features: r.features, water: { model: r.built.waterModel, settled: r.built.settle } });
      writeFileSync(join(dir, `${key}.json`), JSON.stringify({ ...base, ...m }));
      if (files) {
        const N = m.area;
        const buf = new Float32Array(3 * N);
        buf.set(v.water!.depth, 0);
        buf.set(v.water!.contamination, N);
        buf.set(v.analysis!.moisture, 2 * N);
        writeFileSync(join(dir, `${key}.f32`), new Uint8Array(buf.buffer));
        writeFileSync(join(dir, `${key}.timber`), r.bytes);
        writeFileSync(join(dir, `${key}.features.json`), JSON.stringify({ spec: r.spec, features: r.features }));
      }
      console.log(`${gen} ${size} ${key.padEnd(18)} pass ${r.attempts} ${ms} ms  flow ${m.water.flow}  plateaus ${m.score.plateaus}`);
      void failed;
    }
    console.log(`SUMMARY ${gen} ${size} ${difficulty} ${theme}: ${pass}/${seeds.length} final, ${first}/${seeds.length} first attempt`);
  }
}

if (process.argv[1] && /batch\.ts$/.test(process.argv[1])) void main();
