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
import { distance, FEATURE_NAMES, featureVector, nearest, scaleFrom, setVariety, type Scale, type VarietyInput } from "./lib/variety";
import { RECIPES } from "./recipes/index";

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
  // no clones: each theme's seeds against each other, next to the workshop's own nearest peers
  for (const t of themes) {
    const set = gen.filter((g) => g.theme === t).map(toInput);
    const nn = nearest(set, set, scale).sort((p, q) => p - q);
    (byTheme[t] as Record<string, unknown>).nearestSeedMedian = r3(med(nn));
    (byTheme[t] as Record<string, unknown>).nearestSeedMin = r3(nn[0]);
  }
  const wsSorted = wsNN.slice().sort((p, q) => p - q);
  out.generated128 = {
    maps: G.length,
    variety: r3(all),
    shareOfWorkshop: r3(all / wv),
    byTheme,
    nearestWorkshopMedian: r3(med(genNN)),
    workshopNearestPeerMedian: r3(med(wsNN)),
    workshopNearestPeerP10: r3(wsSorted[Math.floor(0.1 * (wsSorted.length - 1))]),
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
  // variety is a mean over pairs, so adding maps does not raise it by itself: a recipe's gain is
  // what its maps (at 128²) add to its base theme's 30 seeds, River Valley for every recipe here
  const rv = gen.filter((g) => g.theme === "riverValley").map(toInput);
  const rvVariety = setVariety(rv, scale);
  const mix: VarietyInput[] = [...rv];
  for (const [name, set] of Object.entries(extra)) {
    const R = set.filter((r) => r.W === 128).map(toInput);
    const all = set.map(toInput);
    mix.push(...R);
    const withR = setVariety([...rv, ...R], scale);
    res[name] = {
      maps: all.length,
      themeVarietyWith: r3(withR),
      themeGain: r3(withR - rvVariety),
      ownVariety: r3(setVariety(all, scale)),
      // novelty: each recipe map's distance to its nearest generated map (any theme)
      nearestGeneratedMedian: r3(med(nearest(all, G, scale))),
    };
  }
  const mixed = setVariety(mix, scale);
  // with landmarks counted: a third term, the Jaccard distance between the maps' pattern sets (the
  // catalogue's tags for workshop maps; the recipe's pattern for recipe maps; none for today's
  // seeds). The generator knows the premise and landmarks it built, so it can count them exactly.
  const tagsOf = new Map<string, string[]>();
  for (const r of workshop) tagsOf.set(r.key, r.tags);
  for (const r of gen) tagsOf.set(r.key, []);
  for (const [name, set] of Object.entries(extra)) for (const r of set) tagsOf.set(r.key, [RECIPES.find((x) => x.id === name)?.pattern ?? name]);
  const jac = (a: string[], b: string[]) => {
    if (!a.length && !b.length) return 0;
    const u = new Set([...a, ...b]);
    return 1 - a.filter((x) => b.includes(x)).length / u.size;
  };
  const wsJ: number[] = [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) wsJ.push(jac(tagsOf.get(W[i].key)!, tagsOf.get(W[j].key)!));
  const P0 = med(wsJ) || 1;
  const v3 = (set: VarietyInput[]) => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const two = distance(set[i], set[j], scale);
      sum += (2 * two + jac(tagsOf.get(set[i].key) ?? [], tagsOf.get(set[j].key) ?? []) / P0) / 3;
      n++;
    }
    return n ? sum / n : 0;
  };
  const w3 = v3(W);
  out.withLandmarks = {
    note: "V3 = (L/L0 + F/F0 + P/P0) / 3, P the Jaccard distance between pattern sets",
    P0: r3(P0),
    workshop: r3(w3),
    riverValleyAlone: r3(v3(rv)),
    riverValleyAloneShareOfWorkshop: r3(v3(rv) / w3),
    riverValleyWithPremises: r3(v3(mix)),
    riverValleyWithPremisesShareOfWorkshop: r3(v3(mix) / w3),
  };
  out.premiseMix = {
    note: "River Valley's 30 seeds with every recipe's 128² maps mixed in: the theme with its eleven recipes as premises",
    maps: mix.length,
    riverValleyAlone: r3(rvVariety),
    riverValleyAloneShareOfWorkshop: r3(rvVariety / wv),
    withPremises: r3(mixed),
    withPremisesShareOfWorkshop: r3(mixed / wv),
  };
  out.recipes = res;
}
const P0out = (out.withLandmarks as { P0?: number } | undefined)?.P0 ?? null;
const scaleOut = { patternP0: P0out, features: FEATURE_NAMES, spread: scale.spread.map((v) => Math.round(v * 1e5) / 1e5), L0: r3(scale.L0), F0: r3(scale.F0), workshopVariety: r3(wv), maps: W.length };
writeFileSync(join(ROOT, "variety.json"), JSON.stringify({ ...out, scale: scaleOut }, null, 1));
writeFileSync(join(process.cwd(), "investigation", "workshop", "variety-scale.json"), JSON.stringify(scaleOut, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
if (!existsSync(join(ROOT, "generated"))) console.log("(no generated maps yet: run measure-generated.ts)");
