// Generation budgets (docs/m9-design.md §13): the prototype against the current generator, one
// candidate each, in Node and in Chrome. Chrome runs the same TypeScript bundled with esbuild into
// a page (the harness of tests/e2e/water.spec.ts: Playwright with the installed Chrome, channel
// "chrome"); nothing is published or served. Both wall time and CPU time are recorded (Node:
// process.cpuUsage; Chrome: the renderer's TaskDuration from the DevTools protocol), because the
// machine is shared with other long jobs: CPU time is the closer measure of an idle machine.
//
//   npx tsx investigation/generative/bench.ts [--sizes 128,256] [--seeds 1-5] [--themes riverValley,islands] [--no-chrome]

import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cpus } from "node:os";
import { generate } from "../../src/core/gen/generate";
import { makeSpec, type ThemeId } from "../../src/core/spec/mapspec";
import { arg, parseSeeds } from "./lib/paths";
import { generateProto } from "./proto/generate";

const sizes = arg("sizes", "128,256").split(",").map(Number);
const seeds = parseSeeds(arg("seeds", "1-5"));
const themes = arg("themes", "riverValley,canyon,highlands,lakeBasin,delta,islands").split(",") as ThemeId[];
const med = (v: number[]) => v.slice().sort((a, b) => a - b)[v.length >> 1];
const max = (v: number[]) => Math.max(...v);

interface Row {
  where: string;
  gen: string;
  size: number;
  theme: string;
  ms: number[];
  cpu: number[];
  attempts: number[];
}
const cpuNow = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};
const rows: Row[] = [];

// ---- Node
for (const size of sizes)
  for (const theme of themes) {
    const p: Row = { where: "node", gen: "proto", size, theme, ms: [], cpu: [], attempts: [] };
    const c: Row = { where: "node", gen: "current", size, theme, ms: [], cpu: [], attempts: [] };
    for (const seed of seeds) {
      let t0 = performance.now();
      let c0 = cpuNow();
      const r = generateProto(theme, seed, size);
      p.ms.push(Math.round(performance.now() - t0));
      p.cpu.push(Math.round(cpuNow() - c0));
      p.attempts.push(r.attempts);
      t0 = performance.now();
      c0 = cpuNow();
      const g = generate(makeSpec({ seed, theme, size: { x: size, y: size } }));
      c.ms.push(Math.round(performance.now() - t0));
      c.cpu.push(Math.round(cpuNow() - c0));
      c.attempts.push(g.attempts);
    }
    rows.push(p, c);
    console.log(`node ${size} ${theme}: proto median ${med(p.ms)} ms wall, ${med(p.cpu)} ms cpu (max ${max(p.cpu)}); current ${med(c.ms)} ms wall, ${med(c.cpu)} ms cpu`);
  }

// ---- Chrome
if (!process.argv.includes("--no-chrome")) {
  const entry = join(process.cwd(), ".scratch", "bench-entry.ts");
  writeFileSync(
    entry,
    `import { generateProto } from "../investigation/generative/proto/generate";
import { generate } from "../src/core/gen/generate";
import { makeSpec } from "../src/core/spec/mapspec";
(globalThis as any).bench = (gen: string, theme: any, seed: number, size: number) => {
  const t0 = performance.now();
  const r = gen === "proto" ? generateProto(theme, seed, size) : generate(makeSpec({ seed, theme, size: { x: size, y: size } }));
  return { ms: Math.round(performance.now() - t0), attempts: r.attempts, passed: r.report.passed };
};
`,
  );
  const out = await build({ entryPoints: [entry], bundle: true, format: "iife", platform: "browser", write: false, target: "es2022", logLevel: "error" });
  const code = out.outputFiles[0].text;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><title>bench</title>");
  await page.addScriptTag({ content: code });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const taskMs = async () => {
    const m = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
    return 1000 * (m.metrics.find((x) => x.name === "TaskDuration")?.value ?? 0);
  };
  for (const size of sizes)
    for (const theme of themes)
      for (const gen of ["proto", "current"]) {
        const r: Row = { where: "chrome", gen, size, theme, ms: [], cpu: [], attempts: [] };
        for (const seed of seeds) {
          const k0 = await taskMs();
          const x = await page.evaluate(([g, t, s, z]) => (globalThis as unknown as { bench: (a: string, b: string, c: number, d: number) => { ms: number; attempts: number } }).bench(g as string, t as string, s as number, z as number), [gen, theme, seed, size] as const);
          r.ms.push(x.ms);
          r.cpu.push(Math.round((await taskMs()) - k0));
          r.attempts.push(x.attempts);
        }
        rows.push(r);
        console.log(`chrome ${size} ${theme} ${gen}: median ${med(r.ms)} ms wall, ${med(r.cpu)} ms task time (max ${max(r.cpu)})`);
      }
  await browser.close();
}

const summary = rows.map((r) => ({ where: r.where, gen: r.gen, size: r.size, theme: r.theme, medianMs: med(r.ms), maxMs: max(r.ms), medianCpuMs: med(r.cpu), maxCpuMs: max(r.cpu), attempts: r.attempts }));
writeFileSync(join(process.cwd(), "investigation", "generative", "bench.json"), JSON.stringify({ machine: `${cpus()[0]?.model} × ${cpus().length}`, node: process.version, seeds, summary }, null, 1));
console.log(JSON.stringify({ machine: `${cpus()[0]?.model} × ${cpus().length}` }));
