// Markdown tables for REPORT.md from the measured aggregates (measures.json, simplay.json,
// bench.json, the batch records' attempts), so no number is copied by hand.
//
//   npx tsx investigation/generative/tables.ts [--measures measures.json] [--proto proto-128] > .scratch/tables.md

/* eslint-disable @typescript-eslint/no-explicit-any */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { arg, MAPS } from "./lib/paths";

const HERE = join(process.cwd(), "investigation", "generative");
const m = JSON.parse(readFileSync(join(HERE, arg("measures", "measures.json")), "utf8"));
const protoSet = arg("proto", "proto-128");
const THEMES = ["riverValley", "canyon", "highlands", "lakeBasin", "delta", "islands"];
const NAME: Record<string, string> = { riverValley: "River Valley", canyon: "Canyon", highlands: "Highlands", lakeBasin: "Lake Basin", delta: "Delta", islands: "Islands" };
const pc = (v: number) => `${Math.round(v * 1000) / 10}%`;
const f2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
const ok = (b: boolean) => (b ? "pass" : "**fail**");
const P = m.sets[arg("key", protoSet)]?.byTheme ?? {};
const C = m.sets["current-128"]?.byTheme ?? {};
const out: string[] = [];
const row = (cells: (string | number)[]) => out.push(`| ${cells.join(" | ")} |`);

out.push("### M1 no clones (nearest other seed of the theme, variety scale)\n");
row(["Theme", "Prototype min", "Prototype median", "Pass", "Baseline min", "Baseline median", "Pass"]);
row(["---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES) row([NAME[t], f2(P[t].M1.nearestMin), f2(P[t].M1.nearestMedian), ok(P[t].M1.pass), f2(C[t].M1.nearestMin), f2(C[t].M1.nearestMedian), ok(C[t].M1.pass)]);

out.push("\n### M2 no archetypes (largest cluster's share of the theme; clusters; distinct coarse codes)\n");
row(["Theme", "Whole maps: prototype", "baseline", "River networks: prototype", "baseline", "Relief: prototype", "baseline"]);
row(["---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES)
  row([
    NAME[t],
    `${pc(P[t].M2a.largestShare)} (${P[t].M2a.clusters})`,
    `${pc(C[t].M2a.largestShare)} (${C[t].M2a.clusters})`,
    `${pc(P[t].M2b.largestShare)} (${P[t].M2b.clusters}; ${P[t].M2b.codes} codes)`,
    `${pc(C[t].M2b.largestShare)} (${C[t].M2b.clusters}; ${C[t].M2b.codes} codes)`,
    `${pc(P[t].M2c.largestShare)} (${P[t].M2c.clusters}; ${P[t].M2c.codes} codes)`,
    `${pc(C[t].M2c.largestShare)} (${C[t].M2c.clusters}; ${C[t].M2c.codes} codes)`,
  ]);

out.push("\n### M3 openings (largest cluster's share; clusters; spread = mean pairwise opening distance, workshop pair = 1)\n");
row(["Theme", "Prototype largest", "clusters", "spread", "Baseline largest", "clusters", "spread"]);
row(["---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES) row([NAME[t], pc(P[t].M3.largestShare), P[t].M3.clusters, f2(P[t].M3.spread), pc(C[t].M3.largestShare), C[t].M3.clusters, f2(C[t].M3.spread)]);

out.push("\n### M4 no approximation (distance to the nearest workshop map; floor " + f2(m.workshop.vNearestP10) + ")\n");
row(["Theme", "Prototype min", "p10", "median", "maps below", "Baseline min", "p10", "median", "maps below"]);
row(["---", "---", "---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES) row([NAME[t], f2(P[t].M4.nearestMin), f2(P[t].M4.nearestP10), f2(P[t].M4.nearestMedian), P[t].M4.below, f2(C[t].M4.nearestMin), f2(C[t].M4.nearestP10), f2(C[t].M4.nearestMedian), C[t].M4.below]);

out.push(`\n### M5 a good natural dam site within 40 tiles of the start (a dam of ≤ 5 tiles holds 380 blocks); workshop ${pc(m.workshop.goodNaturalDam.workshop)}, official ${pc(m.workshop.goodNaturalDam.official)}\n`);
row(["Theme", "Prototype ≤ 5 tiles", "≤ 12 tiles", "any length", "Baseline ≤ 5 tiles", "≤ 12 tiles", "any length"]);
row(["---", "---", "---", "---", "---", "---", "---"]);
let pp = 0;
let cc = 0;
for (const t of THEMES) {
  pp += P[t].M5.goodNaturalDam;
  cc += C[t].M5.goodNaturalDam;
  row([NAME[t], pc(P[t].M5.goodNaturalDam), pc(P[t].M5.within12), pc(P[t].M5.anyLength), pc(C[t].M5.goodNaturalDam), pc(C[t].M5.within12), pc(C[t].M5.anyLength)]);
}
row(["All six", pc(pp / 6), "", "", pc(cc / 6), "", ""]);

out.push("\n### M6 dam walls, M7 storage possible, score (median, p10–p90)\n");
row(["Theme", "Prototype walls", "Baseline walls", "Prototype storage", "Baseline storage", "Prototype score", "Baseline score"]);
row(["---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES)
  row([NAME[t], `${P[t].M6.flagged} of ${P[t].M6.maps}`, `${C[t].M6.flagged} of ${C[t].M6.maps}`, pc(P[t].M7.pass), pc(C[t].M7.pass), `${Math.round(P[t].score.median)} (${Math.round(P[t].score.p10)}–${Math.round(P[t].score.p90)})`, `${Math.round(C[t].score.median)} (${Math.round(C[t].score.p10)}–${Math.round(C[t].score.p90)})`]);

out.push("\n### Shape medians (prototype / baseline)\n");
row(["Theme", "Height range", "Flat share", "Water share", "Falls", "Tallest fall", "Plateaus", "Steps in straight runs of 8+", "Longest straight run"]);
row(["---", "---", "---", "---", "---", "---", "---", "---", "---"]);
for (const t of THEMES) {
  const a = P[t].shape;
  const b = C[t].shape;
  row([NAME[t], `${a.heightRangeMedian} / ${b.heightRangeMedian}`, `${f2(a.flatShareMedian)} / ${f2(b.flatShareMedian)}`, `${f2(a.waterShareMedian)} / ${f2(b.waterShareMedian)}`, `${a.waterfallsMedian} / ${b.waterfallsMedian}`, `${f2(a.maxFallMedian)} / ${f2(b.maxFallMedian)}`, `${a.plateausMedian} / ${b.plateausMedian}`, `${f2(a.straightShare8Median)} / ${f2(b.straightShare8Median)}`, `${a.longestRunMedian} / ${b.longestRunMedian}`]);
}
out.push("\n### Flow directions (prototype, share of maps whose water leaves toward each side)\n");
for (const t of THEMES) {
  const fl = P[t].shape.flows as Record<string, number>;
  const n = Object.values(fl).reduce((a, b) => a + b, 0);
  out.push(`- ${NAME[t]}: ${Object.entries(fl).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v / n)}`).join(", ")}`);
}

// pass rates by size, from the batch records
out.push("\n### Batch pass rates (first attempt / final, 12 attempts)\n");
const sets = existsSync(MAPS) ? readdirSync(MAPS).sort() : [];
row(["Set", ...THEMES.map((t) => NAME[t])]);
row(["---", ...THEMES.map(() => "---")]);
for (const s of sets) {
  const recs = readdirSync(join(MAPS, s)).filter((n) => /^[a-zA-Z]+-\d+\.json$/.test(n)).map((n) => JSON.parse(readFileSync(join(MAPS, s, n), "utf8")));
  row([
    s,
    ...THEMES.map((t) => {
      const r = recs.filter((x) => x.theme === t);
      if (!r.length) return "–";
      const fin = r.filter((x) => x.passed).length;
      const first = r.filter((x) => x.passed && x.attempts === 1).length;
      return `${pc(first / r.length)} / ${pc(fin / r.length)} (${r.length})`;
    }),
  ]);
}
// shape by size
out.push("\n### Plateaus, flat share and height range by size (medians; prototype / baseline)\n");
row(["Size", ...THEMES.map((t) => NAME[t])]);
row(["---", ...THEMES.map(() => "---")]);
for (const z of [96, 128, 192, 256]) {
  const get = (set: string) => {
    const dir = join(MAPS, set);
    if (!existsSync(dir)) return null;
    return readdirSync(dir).filter((n) => /^[a-zA-Z]+-\d+\.json$/.test(n)).map((n) => JSON.parse(readFileSync(join(dir, n), "utf8"))).filter((x) => x.passed && x.score);
  };
  const pr = get(protoSet.replace("128", String(z)));
  const cu = get(`current-${z}`);
  const med = (v: number[]) => v.slice().sort((a, b) => a - b)[v.length >> 1];
  row([
    `${z}²`,
    ...THEMES.map((t) => {
      const a = pr?.filter((x) => x.theme === t && x.seed <= 30) ?? [];
      const b = cu?.filter((x) => x.theme === t && x.seed <= 30) ?? [];
      const s = (r: any[]) => (r.length ? `${med(r.map((x) => x.score.plateaus))} pl, ${f2(med(r.map((x) => x.metrics.flatShare)))} flat, ${med(r.map((x) => x.metrics.heightRange))} lv` : "–");
      return `${s(a)} / ${s(b)}`;
    }),
  ]);
}
if (m.m9Plan) {
  const q = m.m9Plan;
  out.push(`\n### The current M9 plan: River Valley with the study's recipes as premises (${q.maps} maps: 200 seeds and ${q.recipeMaps} recipe maps)\n`);
  out.push(`- M1: nearest other map min ${f2(q.M1.nearestMin)}, median ${f2(q.M1.nearestMedian)} (${ok(q.M1.pass)}); M2 whole maps: largest cluster ${pc(q.M2a.largestShare)} (${q.M2a.clusters} cluster${q.M2a.clusters === 1 ? "" : "s"}); M3 openings: largest ${q.M3 ? pc(q.M3.largestShare) : "–"}, spread ${q.M3 ? f2(q.M3.spread) : "–"}; M4: min ${f2(q.M4.nearestMin)} (${ok(q.M4.pass)}); M5: ${pc(q.M5.goodNaturalDam)}; M6: ${q.M6.flagged} of ${q.M6.maps} flagged.`);
}
const sim = existsSync(join(HERE, "simplay.json")) ? JSON.parse(readFileSync(join(HERE, "simplay.json"), "utf8")) : null;
if (sim) {
  out.push("\n### Simulated play: cycle signature and strategy axes (seeds 1–30 per theme)\n");
  row(["Theme", "Cycle: nearest-peer median (proto / base)", "largest group", "groups", "Water kept after the Hard drought (proto)", "(base)", "Axes: nearest-peer median", "largest joint signature", "signatures"]);
  row(["---", "---", "---", "---", "---", "---", "---", "---", "---"]);
  for (const t of THEMES) {
    const a = sim.proto?.[t];
    const b = sim.current?.[t];
    if (!a || !b) continue;
    row([NAME[t], `${a.cycle.nearestPeerMedian} / ${b.cycle.nearestPeerMedian}`, `${pc(a.cycle.largestGroupShare)} / ${pc(b.cycle.largestGroupShare)}`, `${a.cycle.groups} / ${b.cycle.groups}`, `${pc(a.cycle.longRetention[0])}–${pc(a.cycle.longRetention[1])}`, `${pc(b.cycle.longRetention[0])}–${pc(b.cycle.longRetention[1])}`, `${a.axes.nearestPeerMedian} / ${b.axes.nearestPeerMedian}`, `${pc(a.axes.largestJointShare)} / ${pc(b.axes.largestJointShare)}`, `${a.axes.jointSignatures} / ${b.axes.jointSignatures}`]);
  }
}
const bench = existsSync(join(HERE, "bench.json")) ? JSON.parse(readFileSync(join(HERE, "bench.json"), "utf8")) : null;
if (bench) {
  out.push(`\n### Budgets: one candidate, medians (max) of seeds ${bench.seeds.join(", ")}; ${bench.machine}, Node ${bench.node}\n`);
  row(["Where", "Size", "Theme", "Prototype wall", "Prototype CPU", "Current wall", "Current CPU"]);
  row(["---", "---", "---", "---", "---", "---", "---"]);
  for (const where of ["node", "chrome"])
    for (const z of [128, 256])
      for (const t of THEMES) {
        const p = bench.summary.find((x: any) => x.where === where && x.size === z && x.theme === t && x.gen === "proto");
        const c = bench.summary.find((x: any) => x.where === where && x.size === z && x.theme === t && x.gen === "current");
        if (!p || !c) continue;
        row([where, `${z}²`, NAME[t], `${(p.medianMs / 1000).toFixed(1)} s (${(p.maxMs / 1000).toFixed(1)})`, `${(p.medianCpuMs / 1000).toFixed(1)} s (${(p.maxCpuMs / 1000).toFixed(1)})`, `${(c.medianMs / 1000).toFixed(1)} s`, `${(c.medianCpuMs / 1000).toFixed(1)} s`]);
      }
}
console.log(out.join("\n"));
