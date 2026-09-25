// The prototype's guards, beside the batches (docs/m9-design.md §7, §14):
// 1. determinism: the same seed gives the same bytes, twice in one process and once more in a
//    fresh one; and an audit of the prototype's source for anything that is not exact arithmetic
//    (D15: no sin, cos, exp, log, pow, atan2, hypot, random or clock on output paths);
// 2. validator parity: sample maps are written with their project file, validated by the Python
//    oracle (prototype/validate.py) and by the TypeScript validator re-reading the files, as
//    tools/oracle.ts does, and every verdict must agree.
//
//   npx tsx investigation/generative/check.ts [--seeds 1-5] [--themes …] [--sizes 128,256]
//   npx tsx investigation/generative/check.ts --one <theme> <seed> <size>   (prints a sha256)

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "fflate";
import { encodeProject, toDocument } from "../../src/core/doc/document";
import { readTimber } from "../../src/core/format/timber";
import { AVAILABLE_THEMES, type ThemeId } from "../../src/core/spec/mapspec";
import { validateMap } from "../../src/core/validate/checks";
import type { CheckResult } from "../../src/core/validate/report";
import { arg, lowPriority, parseSeeds } from "./lib/paths";
import { generateProto } from "./proto/generate";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

if (process.argv.includes("--audit")) {
  // (the audit alone, below)
}
if (process.argv.includes("--one")) {
  const i = process.argv.indexOf("--one");
  const r = generateProto(process.argv[i + 1] as ThemeId, Number(process.argv[i + 2]), Number(process.argv[i + 3]));
  console.log(sha(r.bytes));
  process.exit(0);
}

lowPriority();
const seeds = parseSeeds(arg("seeds", "1-5"));
const themes = arg("themes", AVAILABLE_THEMES.join(",")).split(",") as ThemeId[];
const sizes = arg("sizes", "128").split(",").map(Number);
const out = arg("out", ".scratch/parity");
const python = process.env.PYTHON ?? "python";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// ---- 0. the source audit
const banned = /Math\.(sin|cos|tan|exp|log|log2|log10|pow|atan|atan2|hypot|cbrt|random)\b|Date\.now|new Date\(|[\w)\]]\s*\*\*\s*[\w(]/;
const auditHits: string[] = [];
for (const f of readdirSync(join("investigation", "generative", "proto"))) {
  const text = readFileSync(join("investigation", "generative", "proto", f), "utf8").split("\n");
  text.forEach((line, k) => {
    const code = /^\s*(\/\*\*|\*)/.test(line) ? "" : line.replace(/\/\/.*$/, "");
    if (banned.test(code)) auditHits.push(`${f}:${k + 1}: ${line.trim()}`);
  });
}
console.log(`source audit: ${auditHits.length ? auditHits.join("; ") : "only + − × ÷, sqrt, floor, round, abs, min and max on output paths"}`);

// ---- 1. determinism and the files for parity
let same = 0;
let total = 0;
const paths: string[] = [];
const hashes: { theme: string; seed: number; size: number; sha: string; ms: number }[] = [];
for (const size of sizes)
  for (const theme of themes)
    for (const seed of seeds) {
      const t0 = performance.now();
      const a = generateProto(theme, seed, size);
      const ms = Math.round(performance.now() - t0);
      const b = generateProto(theme, seed, size);
      total++;
      const ha = sha(a.bytes);
      const fresh = spawnSync(process.execPath, [...process.execArgv, process.argv[1], "--one", theme, String(seed), String(size)], { encoding: "utf8" }).stdout.trim().split(/\r?\n/).pop();
      const ok = a.bytes.length > 0 && ha === sha(b.bytes) && ha === fresh;
      if (ok) same++;
      hashes.push({ theme, seed, size, sha: ha, ms });
      console.log(`${theme} ${seed} ${size}: ${ok ? "same bytes" : "DIFFERENT"} ${ha.slice(0, 12)} (${ms} ms, ${a.attempts} attempt${a.attempts > 1 ? "s" : ""})`);
      if (!a.bytes.length) continue;
      const p = join(out, `${theme}-${seed}-${size}.timber`);
      writeFileSync(p, a.bytes);
      writeFileSync(p.replace(/\.timber$/, ".damgoodmaps.json"), encodeProject(toDocument(a.spec, a.features, a.built, a.file)));
      paths.push(p);
    }
console.log(`determinism: ${same}/${total} maps give the same bytes twice in one process and in a fresh one`);

// ---- 2. parity with the Python oracle
type Verdict = "pass" | "fail" | "na" | "approx";
interface PyCheck {
  id: string;
  ok: boolean;
  na: boolean;
  approx?: string;
  detail: string;
  value: unknown;
}
const tsVerdict = (c: CheckResult): Verdict => (c.applicable === false ? "na" : c.approximate ? "approx" : c.ok ? "pass" : "fail");
const pyVerdict = (c: PyCheck): Verdict => (c.na ? "na" : c.approx ? "approx" : c.ok ? "pass" : "fail");
const r = spawnSync(python, ["prototype/validate.py", "--json", ...paths], { encoding: "utf8", maxBuffer: 256 << 20 });
const py = new Map<string, PyCheck[]>();
for (const line of `${r.stdout ?? ""}`.split(/\r?\n/)) {
  if (!line.startsWith("{")) continue;
  const j = JSON.parse(line) as { path: string; checks: PyCheck[] };
  py.set(j.path, j.checks);
}
let disagree = 0;
let compared = 0;
let pyPass = 0;
let tsPass = 0;
for (const p of paths) {
  const doc = JSON.parse(new TextDecoder().decode(gunzipSync(new Uint8Array(readFileSync(p.replace(/\.timber$/, ".damgoodmaps.json"))))));
  const v = validateMap(readTimber(new Uint8Array(readFileSync(p))), { profile: "generate", spec: doc.spec, features: doc.features });
  if (v.report.passed) tsPass++;
  const pc = py.get(p);
  if (!pc) {
    console.log(`no Python report for ${p}`);
    disagree++;
    continue;
  }
  if (pc.every((c) => c.ok || c.na || c.approx || (c as unknown as { advisory?: boolean }).advisory)) pyPass++;
  const a = new Map(v.report.checks.map((c) => [c.id, c]));
  const b = new Map(pc.map((c) => [c.id, c]));
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    compared++;
    const x = a.get(id);
    const y = b.get(id);
    if (!x || !y || tsVerdict(x) !== pyVerdict(y)) {
      disagree++;
      console.log(`PARITY ${p}: ${id} TypeScript ${x ? tsVerdict(x) : "missing"} vs Python ${y ? pyVerdict(y) : "missing"}`);
    }
  }
}
for (const l of `${r.stderr ?? ""}`.split(/\r?\n/).filter((l) => /Error|Traceback/.test(l))) console.log(`PYTHON ${l}`);
console.log(`parity: ${paths.length} maps, ${compared} checks compared, ${disagree} disagreements; generate profile passed: TypeScript ${tsPass}/${paths.length}`);
writeFileSync(join(out, "check.json"), JSON.stringify({ audit: auditHits, determinism: { same, total, hashes }, parity: { maps: paths.length, compared, disagree, tsPass } }, null, 1));
process.exit(same === total && disagree === 0 && auditHits.length === 0 ? 0 : 1);
