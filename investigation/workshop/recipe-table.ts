// The recipes' results as markdown tables for the report and the integration plan: pass rates by
// size, what each adds to the generator's variety and how novel its maps are, their naturalness and
// verticality, and how obvious their reservoir is.
//
//   npx tsx investigation/workshop/recipe-table.ts     (after run-recipes.ts, variety.ts --extra and obviousness.ts)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rowOf, readGenerated, stat } from "./lib/table";
import { ROOT } from "./lib/paths";
import { RECIPES } from "./recipes/index";

const agg = JSON.parse(readFileSync(join(ROOT, "recipes-aggregate.json"), "utf8"));
const variety = existsSync(join(ROOT, "variety.json")) ? JSON.parse(readFileSync(join(ROOT, "variety.json"), "utf8")) : {};
const obv = existsSync(join(ROOT, "obviousness.json")) ? JSON.parse(readFileSync(join(ROOT, "obviousness.json"), "utf8")) : {};
const dir = join(ROOT, "recipes");
const recs = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
const pct = (x: number) => `${Math.round(100 * x)}%`;
const gen = readGenerated().filter((r) => r.theme === "riverValley");
const med = (v: (number | null)[]) => stat(v, 3).median;

console.log("| Recipe | Pattern | ✦ | 96² | 128² | 256² | Final | First try | Variety gain | Novelty |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const r of RECIPES) {
  const a = agg[r.id];
  if (!a) continue;
  const s = (z: number) => (a.bySize[z] ? `${a.bySize[z].final}/${a.bySize[z].runs}` : "–");
  const v = variety.recipes?.[r.id];
  console.log(`| ${a.name} | ${r.pattern} | ${r.whimsical ? "✦" : ""} | ${s(96)} | ${s(128)} | ${s(256)} | ${pct(a.finalPass)} | ${pct(a.firstPass)} | ${v ? `+${v.gain.toFixed(3)}` : "–"} | ${v ? v.nearestGeneratedMedian.toFixed(2) : "–"} |`);
}
console.log("");
console.log("| Recipe | Straight steps (8+) | Ridge crest std | Height range | Tallest fall | Holding dam ≤ 5 tiles near the start |");
console.log("|---|---|---|---|---|---|");
const rvRow = (label: string, rows: ReturnType<typeof rowOf>[], obvKeys: string[]) => {
  const short = obvKeys.map((k) => obv[k]).filter(Boolean);
  const shortShare = short.length ? short.filter((o: { bestShortDam: number }) => o.bestShortDam >= 380).length / short.length : null;
  console.log(`| ${label} | ${med(rows.map((x) => x.v.straightShare8))} | ${med(rows.map((x) => x.v.ridgeHeightStd))} | ${med(rows.map((x) => x.v.heightRange))} | ${med(rows.map((x) => x.v.maxFallDrop))} | ${shortShare === null ? "–" : pct(shortShare)} |`);
};
rvRow("River Valley base (seeds 1–30, 128²)", gen, Object.keys(obv).filter((k) => k.startsWith("generated:riverValley-")));
for (const r of RECIPES) {
  const rows = recs.filter((x) => x.recipe === r.id && x.passed).map((x) => rowOf(x, null, []));
  if (!rows.length) continue;
  rvRow(r.name, rows, Object.keys(obv).filter((k) => k.startsWith(`recipes:${r.id}-`)));
}
console.log("");
console.log("Failing checks per recipe:");
for (const r of RECIPES) if (agg[r.id]) console.log(`- ${agg[r.id].name}: ${JSON.stringify(agg[r.id].failingChecks)}`);
// the narrows: naturalness of the dam narrows and whether the reservoir holds
const nar = recs.filter((x) => x.recipe === "spur-narrows");
if (nar.length) {
  const rows = nar.map((x) => rowOf(x, null, []));
  const held = nar.filter((x) => x.checks?.["water.reservoir"]?.ok).length;
  console.log("");
  console.log(`Narrows: ${nar.length} maps, water.reservoir held on ${held}; narrows thickness CV ${med(rows.map((x) => x.v.narrowsThicknessCV))}, height std ${med(rows.map((x) => x.v.narrowsHeightStd))}, dam rim CV ${med(rows.map((x) => x.v.damRimThicknessCV))}, ridge crest std ${med(rows.map((x) => x.v.ridgeHeightStd))}, ridge CV ${med(rows.map((x) => x.v.ridgeThicknessCV))}`);
  console.log(`Base River Valley: narrows thickness CV ${med(gen.map((x) => x.v.narrowsThicknessCV))}, height std ${med(gen.map((x) => x.v.narrowsHeightStd))}, dam rim CV ${med(gen.map((x) => x.v.damRimThicknessCV))}, ridge crest std ${med(gen.map((x) => x.v.ridgeHeightStd))}`);
}
