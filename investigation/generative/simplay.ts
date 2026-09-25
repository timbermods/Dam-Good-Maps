// Simulated play (docs/m9-design.md §17, gate b): the weather-cycle signature of branch
// `investigation/cycles` (PR #10, at 1a8eba2) and the strategy axes of branch
// `investigation/mechanics` (PR #9, at bb394cc), run on prototype and baseline maps. Both branches
// are read only: their modules are extracted with `git show` into .scratch/ext (not committed), with
// their `../../src` imports pointed at this checkout, and loaded from there:
//
//   mkdir -p .scratch/ext/cycles .scratch/ext/mechanics
//   for f in model.ts measures.ts weather.ts; do git show origin/investigation/cycles:investigation/cycles/$f \
//     | sed "s#'../../src/#'../../../src/#g" > .scratch/ext/cycles/$f; done
//   git show origin/investigation/mechanics:investigation/mechanics/measure.ts \
//     | sed "s#'../../src/#'../../../src/#g" > .scratch/ext/mechanics/measure.ts
//
//   npx tsx investigation/generative/simplay.ts --gen proto|current [--seeds 1-30] [--themes …]
//   npx tsx investigation/generative/simplay.ts --summary
//
// The signature is the cycles study's own (its summarize.ts): eleven values from three probes (the
// first Normal drought, a later full-ramp Hard drought, the first Normal badtide), with its distance
// (the mean absolute difference) and its fixed group bins. The axes are the mechanics study's own
// (`measureOpening`) with its fixed bins and joint signature (AXES.md). Nothing in either is tuned
// here.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generate } from "../../src/core/gen/generate";
import { makeSpec, type ThemeId } from "../../src/core/spec/mapspec";
import { arg, lowPriority, mapDir, parseSeeds } from "./lib/paths";
import { generateProto } from "./proto/generate";

const EXT = resolve(arg("ext", join(".scratch", "ext")));
const HERE = join(process.cwd(), "investigation", "generative");
const load = async (p: string) => import(pathToFileURL(join(EXT, p)).href);

/** The mechanics study's fixed bins (AXES.md), chosen by that study before its results. */
const AXIS_BINS: [string, number[]][] = [
  ["storageRatio", [0.25, 1, 3]],
  ["peakCleanFlux64", [0.5, 1, 2]],
  ["flatDry40", [150, 500, 1200]],
  ["fertilityPersistence", [0.25, 0.75]],
  ["badwaterDistance", [15, 30, 60]],
  ["logs20", [80, 160, 320]],
  ["frontierComponents", [1.5, 3.5]],
  ["deepPumpExtraShore", [0.5, 10, 50]],
];

function axesOf(m: any): { values: Record<string, number | null>; bins: (number | null)[]; joint: string } {
  const values: Record<string, number | null> = {};
  const bins: (number | null)[] = [];
  for (const [k, cuts] of AXIS_BINS) {
    const v = m[k];
    const num = typeof v === "number" && Number.isFinite(v) ? v : null;
    values[k] = num;
    bins.push(num === null ? null : cuts.filter((c) => num >= c).length);
  }
  return { values, bins, joint: bins.map((b) => (b === null ? "n" : String(b))).join("") };
}

async function run(): Promise<void> {
  lowPriority();
  const { CycleModel } = await load("cycles/model.ts");
  const { Measures } = await load("cycles/measures.ts");
  const { schedule } = await load("cycles/weather.ts");
  const { measureOpening } = await load("mechanics/measure.ts");
  const gen = arg("gen", "proto");
  const seeds = parseSeeds(arg("seeds", "1-30"));
  const themes = arg("themes", "riverValley,canyon,highlands,lakeBasin,delta,islands").split(",") as ThemeId[];
  const dir = mapDir(gen, 128);
  mkdirSync(dir, { recursive: true });
  const weatherSeed = 1729;
  // the cycles study's probes (its batch.ts `cases`), the three its signature reads
  const first = schedule("normal", weatherSeed).find((p: any) => p.weather === "drought");
  const bad = schedule("normal", weatherSeed).find((p: any) => p.weather === "badtide");
  const later = schedule("hard", weatherSeed, 40).find((p: any) => p.weather === "drought" && p.occurrence === 13);
  const probes = [
    { id: "first-normal", phases: [{ weather: "normal", days: 1, cycle: 1, occurrence: 1, next: "drought" }, first, { weather: "normal", days: 3, cycle: 2, occurrence: 2, previous: "drought" }] },
    { id: "first-badtide", phases: [bad, { weather: "normal", days: 5, cycle: bad.cycle + 1, occurrence: bad.cycle + 1, previous: "badtide" }] },
    { id: "late-hard", phases: [{ weather: "normal", days: 1, cycle: later.cycle, occurrence: later.cycle, next: "drought" }, later, { weather: "normal", days: 5, cycle: later.cycle + 1, occurrence: later.cycle + 1, previous: "drought" }] },
  ];
  for (const theme of themes)
    for (const seed of seeds) {
      const out = join(dir, `${theme}-${seed}.sim.json`);
      if (existsSync(out) && !process.argv.includes("--force")) continue;
      const t0 = performance.now();
      const r: any = gen === "proto" ? generateProto(theme, seed, 128) : generate(makeSpec({ seed, theme, size: { x: 128, y: 128 } }));
      if (!r.report.passed || (r.storage && !r.storage.ok)) continue;
      const axes = axesOf(measureOpening(r));
      const scen: Record<string, any> = {};
      let baseline: any = null;
      for (const p of probes) {
        const model = new CycleModel(r.built);
        const measure = new Measures(model, r.spec.settings.start.rules.waterWithin);
        baseline = measure.sample(0);
        let elapsed = 0;
        const days: any[] = [];
        for (const phase of p.phases) {
          model.run(phase, (day: number) => {
            days.push({ ...measure.sample(elapsed + day), phase: phase.weather });
          });
          elapsed += phase.days;
        }
        const hazard = days.filter((x) => x.phase !== "normal").at(-1);
        const recovery = hazard ? days.filter((x) => x.day >= hazard.day && x.phase === "normal") : [];
        const back = recovery.find((x) => x.volume >= baseline.volume * 0.95 && x.badTiles <= baseline.badTiles + Math.max(1, baseline.wetTiles * 0.01) && x.moistTiles >= baseline.moistTiles * 0.95);
        scen[p.id] = { hazard, days, firstWaterLost: measure.firstWaterLost, recoveryDays: back ? back.day - hazard.day : null };
      }
      // the cycles study's signature (its summarize.ts), on these probes
      const s = scen["first-normal"].hazard;
      const d = scen["late-hard"].hazard;
      const b = scen["first-badtide"].hazard;
      const clean = (day: any) => day.regionCleanVolume.reduce((a: number, v: number) => a + v, 0);
      const startDays = scen["late-hard"].firstWaterLost === null ? 26 : Math.max(0, scen["late-hard"].firstWaterLost - 1);
      const values = {
        shortRetention: s.volume / baseline.volume,
        longRetention: d.volume / baseline.volume,
        cleanLongRetention: clean(d) / Math.max(1, clean(baseline)),
        startDays,
        driedShare: d.driedTiles / Math.max(1, baseline.wetTiles),
        fragments: Math.max(...scen["late-hard"].days.map((x: any) => x.maxFragments)),
        badwaterExposure: Math.max(0, b.badTiles - baseline.badTiles) / Math.max(1, baseline.wetTiles - baseline.badTiles),
        soilExposure: Math.max(0, b.soilTiles - baseline.soilTiles) / (128 * 128),
        treesLost: d.plants.treesLost / Math.max(1, d.plants.originalTrees),
        bushesLost: d.plants.bushesLost / Math.max(1, d.plants.originalBushes),
        badRecovery: scen["first-badtide"].recoveryDays ?? 6,
      };
      const vector = [values.shortRetention, values.longRetention, values.cleanLongRetention, startDays / 26, values.driedShare, Math.min(1, values.fragments / 20), values.badwaterExposure, values.soilExposure, values.treesLost, values.bushesLost, values.badRecovery / 6].map((x) => Math.min(1, Math.max(0, x)));
      const bin = (v: number, cuts: number[]) => cuts.filter((c) => v >= c).length;
      const group = [bin(values.longRetention, [0.05, 0.25, 0.5, 0.75]), bin(values.badwaterExposure, [0.25, 0.5, 0.75]), bin(startDays, [1, 7, 14, 26])].join("/");
      // a short timeline for the briefs: the start's water and badwater, day by day
      const timeline = Object.fromEntries(
        Object.entries(scen).map(([id, v]: [string, any]) => [id, { firstWaterLost: v.firstWaterLost, recoveryDays: v.recoveryDays, days: v.days.map((x: any) => ({ day: x.day, phase: x.phase, kept: Math.round((x.volume / baseline.volume) * 1000) / 1000, bad: x.badTiles, pump: x.pumpTiles ?? null })) }]),
      );
      writeFileSync(out, JSON.stringify({ key: `${theme}-${seed}`, theme, seed, gen, cycle: { values, vector, group }, axes, timeline }));
      console.log(`${gen} ${theme}-${seed}: ${Math.round(performance.now() - t0)} ms, cycle group ${group}, axes ${axes.joint}`);
    }
}

function summary(): void {
  const res: Record<string, unknown> = {};
  const nnMedian = (vs: number[][], dist: (a: number[], b: number[]) => number) => {
    const nn = vs.map((a, i) => vs.reduce((m, b, j) => (i === j ? m : Math.min(m, dist(a, b))), Infinity)).sort((a, b) => a - b);
    return nn.length ? Math.round(nn[nn.length >> 1] * 10000) / 10000 : null;
  };
  const cycleDist = (a: number[], b: number[]) => a.reduce((s, v, k) => s + Math.abs(v - b[k]), 0) / a.length;
  const maxBin = AXIS_BINS.map(([, c]) => c.length);
  const axisDist = (a: number[], b: number[]) => a.reduce((s, v, k) => s + (v === -1 || b[k] === -1 ? (v === b[k] ? 0 : 1) : Math.abs(v - b[k]) / maxBin[k]), 0) / a.length;
  for (const gen of ["proto", "current"]) {
    const dir = mapDir(gen, 128);
    if (!existsSync(dir)) continue;
    const all = readdirSync(dir).filter((n) => n.endsWith(".sim.json")).map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")));
    const byTheme: Record<string, unknown> = {};
    for (const theme of [...new Set(all.map((x) => x.theme))].sort()) {
      const set = all.filter((x) => x.theme === theme);
      const groups = new Map<string, number>();
      for (const x of set) groups.set(x.cycle.group, (groups.get(x.cycle.group) ?? 0) + 1);
      const joints = new Map<string, number>();
      for (const x of set) joints.set(x.axes.joint, (joints.get(x.axes.joint) ?? 0) + 1);
      const q = (k: string) => set.map((x) => x.cycle.values[k]).sort((a: number, b: number) => a - b);
      const span = (v: number[]) => [Math.round(v[0] * 1000) / 1000, Math.round(v[v.length - 1] * 1000) / 1000];
      byTheme[theme] = {
        maps: set.length,
        cycle: {
          longRetention: span(q("longRetention")),
          startDays: span(q("startDays")),
          badwaterExposure: span(q("badwaterExposure")),
          groups: groups.size,
          largestGroupShare: Math.round((Math.max(...groups.values()) / set.length) * 1000) / 1000,
          nearestPeerMedian: nnMedian(set.map((x) => x.cycle.vector), cycleDist),
        },
        axes: {
          jointSignatures: joints.size,
          largestJointShare: Math.round((Math.max(...joints.values()) / set.length) * 1000) / 1000,
          nearestPeerMedian: nnMedian(set.map((x) => x.axes.bins.map((b: number | null) => (b === null ? -1 : b))), axisDist),
        },
      };
    }
    res[gen] = byTheme;
  }
  writeFileSync(join(HERE, "simplay.json"), JSON.stringify({ note: "cycles: investigation/cycles at 1a8eba2 (signature and bins of its summarize.ts); axes: investigation/mechanics at bb394cc (measureOpening, AXES.md bins); seeds 1–30 per theme at 128², Normal", ...res }, null, 1) + "\n");
  console.log(JSON.stringify(res, null, 1));
}

if (process.argv.includes("--summary")) summary();
else void run();
