// The variety score over the workshop maps, the official maps and the current generator
// (lib/variety.ts). Writes C:\dgm-workshop\variety.json (aggregates only; the aggregate step copies
// it into investigation/workshop.json) and investigation/workshop/variety-scale.json, the
// normalisation the product can reuse as it is.
//
//   npx tsx investigation/workshop/variety.ts [--extra <folder of measured recipe maps>]

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readGenerated, readTable, rowOf, type Row } from "./lib/table";
import { ROOT } from "./lib/paths";
import { FEATURE_NAMES, featureVector, nearest, scaleFrom, setVariety, type Scale, type VarietyInput } from "./lib/variety";

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function toInput(r: Row): VarietyInput {
  return { key: r.key, layout: r.raw.layout, features: featureVector(r.raw) };
}

function med(v: number[]): number {
  const s = v.slice().sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
}

const rows = readTable();
const workshop = rows.filter((r) => r.source === "workshop");
const official = rows.filter((r) => r.source === "official");
const gen = readGenerated();
const W = workshop.map(toInput);
const O = official.map(toInput);
const G = gen.map(toInput);

const scale: Scale = scaleFrom(W);
const wv = setVariety(W, scale);
const out: Record<string, unknown> = {
  method: "V(A,B) = 0.5·L/L0 + 0.5·F/F0: L the layout distance under the 8 rotations and mirrors, F the feature distance over 14 size-free numbers; a set's variety is the mean V over its pairs (lib/variety.ts).",
  workshop: { maps: W.length, variety: r3(wv) },
  official: { maps: O.length, variety: r3(setVariety(O, scale)), shareOfWorkshop: r3(setVariety(O, scale) / wv) },
};
if (G.length) {
  const themes = [...new Set(gen.map((g) => g.theme!))].sort();
  const all = setVariety(G, scale);
  const byTheme: Record<string, unknown> = {};
  for (const t of themes) {
    const set = gen.filter((g) => g.theme === t).map(toInput);
    const v = setVariety(set, scale);
    byTheme[t] = { maps: set.length, variety: r3(v), shareOfWorkshop: r3(v / wv) };
  }
  // how new each generated map is against the workshop, and each workshop map against its peers
  const genNN = nearest(G, W, scale);
  const wsNN = nearest(W, W, scale);
  out.generated128 = {
    maps: G.length,
    variety: r3(all),
    shareOfWorkshop: r3(all / wv),
    byTheme,
    nearestWorkshopMedian: r3(med(genNN)),
    workshopNearestPeerMedian: r3(med(wsNN)),
  };
}
// recipe maps, when given: what they add to the generator's variety
const ei = process.argv.indexOf("--extra");
if (ei >= 0) {
  const dir = process.argv[ei + 1];
  const extra: Record<string, Row[]> = {};
  for (const n of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(join(dir, n), "utf8"));
    if (!r.layout) continue;
    (extra[r.recipe ?? "extra"] ??= []).push(rowOf(r, null, []));
  }
  const res: Record<string, unknown> = {};
  const base = setVariety(G, scale);
  for (const [name, set] of Object.entries(extra)) {
    const R = set.map(toInput);
    // the gain: variety of the generator's maps with this recipe's maps added, against the same
    // number of maps without them (so set size does not count)
    const withR = setVariety([...G, ...R], scale);
    const nn = nearest(R, G, scale);
    res[name] = { maps: R.length, varietyWith: r3(withR), gain: r3(withR - base), ownVariety: r3(setVariety(R, scale)), nearestGeneratedMedian: r3(med(nn)) };
  }
  out.recipes = res;
}
const scaleOut = { features: FEATURE_NAMES, spread: scale.spread.map((v) => Math.round(v * 1e5) / 1e5), L0: r3(scale.L0), F0: r3(scale.F0), workshopVariety: r3(wv), maps: W.length };
writeFileSync(join(ROOT, "variety.json"), JSON.stringify({ ...out, scale: scaleOut }, null, 1));
writeFileSync(join(process.cwd(), "investigation", "workshop", "variety-scale.json"), JSON.stringify(scaleOut, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
if (!existsSync(join(ROOT, "generated"))) console.log("(no generated maps yet: run measure-generated.ts)");
