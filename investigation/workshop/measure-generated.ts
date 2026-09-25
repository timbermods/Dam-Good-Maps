// Measure the current generator the same way as the workshop maps (lib/measures.ts): seeds 1–30
// of every built theme at 128², Normal, default settings. Results stay local in
// C:\dgm-workshop\generated\<theme>-<size>-<seed>.json, with their settled water for renders.
//
//   npx tsx investigation/workshop/measure-generated.ts [--seeds 1-30] [--size 128] [--themes riverValley,canyon]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "../../src/core/gen/generate";
import { AVAILABLE_THEMES, makeSpec, type ThemeId } from "../../src/core/spec/mapspec";
import { lowPriority, ROOT } from "./lib/paths";
import { measureFile } from "./lib/measures";

lowPriority();
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const [a, b] = arg("seeds", "1-30").split("-").map(Number);
const size = Number(arg("size", "128"));
const themes = arg("themes", AVAILABLE_THEMES.join(",")).split(",") as ThemeId[];
const dir = join(ROOT, "generated");
mkdirSync(dir, { recursive: true });

for (const theme of themes) {
  for (let seed = a; seed <= (b || a); seed++) {
    const t0 = performance.now();
    const r = generate(makeSpec({ seed, theme, size: { x: size, y: size } }));
    const { m, v } = measureFile(r.file, { spec: r.spec, features: r.features, water: { model: r.built.waterModel, settled: r.built.settle } });
    const key = `${theme}-${size}-${seed}`;
    writeFileSync(join(dir, `${key}.json`), JSON.stringify({ key, source: "generated", theme, seed, size, passed: r.report.passed, attempts: r.attempts, ms: Math.round(performance.now() - t0), ...m }));
    const N = m.area;
    const buf = new Float32Array(3 * N);
    buf.set(v.water!.depth, 0);
    buf.set(v.water!.contamination, N);
    buf.set(v.analysis!.moisture, 2 * N);
    writeFileSync(join(dir, `${key}.f32`), new Uint8Array(buf.buffer));
    writeFileSync(join(dir, `${key}.timber`), r.bytes);
    console.log(`${key.padEnd(24)} ${r.report.passed ? "pass" : "FAIL"} ${r.attempts}  run ${m.natural.longestRun}  ridgeCV ${m.natural.ridgeThicknessCV?.toFixed(2)}  flow ${m.water.flow}`);
  }
}
