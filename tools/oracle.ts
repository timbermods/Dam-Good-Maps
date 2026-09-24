// The Python oracle (ROADMAP M1 acceptance): generate maps with the TypeScript core, then check
// every file with the independent Python implementation.
//
//   npx tsx tools/oracle.ts --seeds 1-50 --sizes 96,128,256 [--out .scratch/oracle] [--report file.md]
//
// Each map must pass `prototype/validate.py --load-only` (the load class: format, entity placement
// emulation, terrain support, slopes, start) and `prototype/roundtrip_test.py` (read → write → read
// byte for byte, plus a terrain edit). Exits non-zero on any failure.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "../src/core/gen/generate";
import { fileName } from "../src/core/gen/pack";
import { makeSpec, type Difficulty } from "../src/core/spec/mapspec";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function parseSeeds(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) for (let k = Number(m[1]); k <= Number(m[2]); k++) out.push(k);
    else out.push(Number(part));
  }
  return out;
}

const seeds = parseSeeds(arg("seeds", "1-50"));
const sizes = arg("sizes", "96,128,256").split(",").map(Number);
const outDir = arg("out", ".scratch/oracle");
const difficulty = arg("difficulty", "normal") as Difficulty;
const report = arg("report", "");
const python = process.env.PYTHON ?? "python";

function py(script: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(python, [script, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.error) throw r.error;
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

rmSync(outDir, { recursive: true, force: true });
const lines: string[] = [];
const log = (s: string) => {
  lines.push(s);
  console.log(s);
};

let genFail = 0;
let loadFail = 0;
let rtFail = 0;
let total = 0;
const times: Record<number, number[]> = {};
for (const size of sizes) {
  const dir = join(outDir, String(size));
  mkdirSync(dir, { recursive: true });
  const paths: string[] = [];
  times[size] = [];
  for (const seed of seeds) {
    total++;
    const spec = makeSpec({ seed, size: { x: size, y: size }, designedFor: difficulty });
    const t0 = performance.now();
    const r = generate(spec);
    times[size].push(performance.now() - t0);
    if (!r.report.passed) {
      genFail++;
      log(`GEN FAIL  ${size} seed ${seed}: ${r.report.checks.filter((c) => !c.ok).map((c) => c.id).join(", ")}`);
      continue;
    }
    const p = join(dir, fileName(r.spec));
    writeFileSync(p, r.bytes);
    paths.push(p);
  }

  const v = py("prototype/validate.py", ["--load-only", "--quiet", ...paths]);
  const passLines = v.out.split(/\r?\n/).filter((l) => l.startsWith("PASS"));
  for (const l of v.out.split(/\r?\n/).filter((l) => l.startsWith("FAIL") || /Error|Traceback/.test(l))) log(`LOAD ${l}`);
  if (passLines.length !== paths.length || v.code !== 0) loadFail += paths.length - passLines.length || 1;

  const rt = py("prototype/roundtrip_test.py", paths);
  const okLines = rt.out.split(/\r?\n/).filter((l) => l.startsWith("OK"));
  for (const l of rt.out.split(/\r?\n/).filter((l) => /^(FAIL|SKIP)/.test(l) || /Error|Traceback/.test(l))) log(`ROUNDTRIP ${l}`);
  if (okLines.length !== paths.length || rt.code !== 0) rtFail += paths.length - okLines.length || 1;

  const t = times[size].slice().sort((a, b) => a - b);
  log(
    `${size}×${size}: ${paths.length}/${seeds.length} generated, ${passLines.length} pass validate.py --load-only, ` +
      `${okLines.length} round-trip OK; generate median ${Math.round(t[t.length >> 1])} ms, max ${Math.round(t[t.length - 1])} ms`,
  );
}

const ok = genFail === 0 && loadFail === 0 && rtFail === 0;
log(`${ok ? "PASS" : "FAIL"}: ${total} maps (${seeds.length} seeds × ${sizes.length} sizes), ${genFail} generation failures, ${loadFail} load failures, ${rtFail} round-trip failures`);
if (report) writeFileSync(report, lines.join("\n") + "\n");
process.exit(ok ? 0 : 1);
