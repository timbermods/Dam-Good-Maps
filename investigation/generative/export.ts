// The ten playable prototype maps (docs/m9-design.md §17): picked from the 128² batch for variety,
// not score, regenerated from their seeds (the bytes must equal the batch's), checked, and written
// with small renders and a one-page brief each:
//   investigation/generative/out/<name>.timber and README.md
//   investigation/generative/renders/<nn>-top.jpg, <nn>-3d.jpg
//   investigation/generative/briefs/<nn>.md
//
// The pick: one map per theme first, then four more from any theme, each the map farthest (the mean
// of its variety distance V and its opening distance, both on the workshop's scales) from the maps
// already picked; the first is River Valley's most typical map (the one nearest the others on
// average), so the set spans the batch without starting from an oddity. Only maps with no dam wall
// and a measured opening take part.
//
//   npx tsx investigation/generative/export.ts [--count 10]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import encodeJpeg from "../../src/core/format/vendor/jpeg-encoder.js";
import { mapObjects } from "../../src/core/sim/model";
import { THEME_NAMES, type ThemeId } from "../../src/core/spec/mapspec";
import { isometric, topDown, type Picture } from "../workshop/lib/render";
import { distance, featureVector, type Scale } from "../workshop/lib/variety";
import { card } from "./lib/card";
import { scaledDistance, type VecScale } from "./lib/cluster";
import { OPENING_KEYS, type Opening } from "./lib/opening";
import { arg, mapDir } from "./lib/paths";
import { DIR_NAMES } from "./proto/num";
import { generateProto, PROTO_VERSION } from "./proto/generate";

/* eslint-disable @typescript-eslint/no-explicit-any */

const HERE = join(process.cwd(), "investigation", "generative");
const count = Number(arg("count", "10"));
const dir = mapDir("proto", 128);
const measures = JSON.parse(readFileSync(join(HERE, "measures.json"), "utf8"));
const vs = JSON.parse(readFileSync(join(process.cwd(), "investigation", "workshop", "variety-scale.json"), "utf8"));
const vScale: Scale = { spread: vs.spread, L0: vs.L0, F0: vs.F0 };
const oScale: VecScale = { spread: measures.workshop.opening.spread, d0: measures.workshop.opening.d0, nnP10: 0, nnMedian: 0 };

interface Cand {
  key: string;
  theme: ThemeId;
  seed: number;
  rec: any;
  opening: Opening;
}
const cands: Cand[] = [];
for (const f of readdirSync(dir).filter((n) => /^[a-zA-Z]+-\d+\.json$/.test(n))) {
  const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const xp = join(dir, f.replace(/\.json$/, ".x.json"));
  if (!rec.passed || !existsSync(xp)) continue;
  const x = JSON.parse(readFileSync(xp, "utf8"));
  if (!x.opening || x.walls?.length) continue;
  cands.push({ key: rec.key, theme: rec.theme, seed: rec.seed, rec, opening: x.opening });
}
cands.sort((a, b) => a.theme.localeCompare(b.theme) || a.seed - b.seed);
const inp = (c: Cand) => ({ key: c.key, layout: c.rec.layout, features: featureVector(c.rec) });
const ov = (c: Cand) => OPENING_KEYS.map((k) => c.opening.v[k]);
const dist = (a: Cand, b: Cand) => 0.5 * distance(inp(a), inp(b), vScale) + 0.5 * scaledDistance(ov(a), ov(b), oScale);

const picked: Cand[] = [];
const rv = cands.filter((c) => c.theme === "riverValley");
let first = rv[0];
let bestMean = Infinity;
for (const c of rv) {
  let s = 0;
  for (const d of rv) if (d !== c) s += dist(c, d);
  if (s < bestMean) {
    bestMean = s;
    first = c;
  }
}
picked.push(first);
const order: ThemeId[] = ["canyon", "highlands", "lakeBasin", "delta", "islands"];
while (picked.length < count) {
  const pool = picked.length <= order.length ? cands.filter((c) => c.theme === order[picked.length - 1]) : cands;
  let best: Cand | null = null;
  let bd = -1;
  for (const c of pool) {
    if (picked.includes(c)) continue;
    const d = Math.min(...picked.map((p) => dist(c, p)));
    if (d > bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) break;
  picked.push(best);
}

const outDir = join(HERE, "out");
const renderDir = join(HERE, "renders");
const briefDir = join(HERE, "briefs");
for (const d of [outDir, renderDir, briefDir]) mkdirSync(d, { recursive: true });
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const jpg = (p: Picture, q = 82) => {
  const rgba = new Uint8Array(p.w * p.h * 4);
  for (let i = 0; i < p.w * p.h; i++) {
    rgba[i * 4] = p.rgb[i * 3];
    rgba[i * 4 + 1] = p.rgb[i * 3 + 1];
    rgba[i * 4 + 2] = p.rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return encodeJpeg({ data: rgba, width: p.w, height: p.h }, q).data;
};

const readme: string[] = [];
const index: unknown[] = [];
picked.forEach((c, k) => {
  const nn = String(k + 1).padStart(2, "0");
  const r = generateProto(c.theme, c.seed, 128);
  const batch = new Uint8Array(readFileSync(join(dir, `${c.key}.timber`)));
  const same = sha(r.bytes) === sha(batch);
  const name = `Proto ${THEME_NAMES[c.theme]} ${c.seed}`;
  writeFileSync(join(outDir, `${name}.timber`), r.bytes);
  const b = r.built;
  const objs = mapObjects(r.file.world);
  writeFileSync(join(renderDir, `${nn}-top.jpg`), jpg(topDown(b.heights, b.W, b.H, b.water, b.contamination, objs, 384)));
  writeFileSync(join(renderDir, `${nn}-3d.jpg`), jpg(isometric(b.heights, b.W, b.H, b.water, b.contamination, objs, 640)));
  const lines = card(c.opening);
  const g = r.genome;
  const info = r.info;
  const m = c.rec;
  const parts = [...new Set(g.parts.map((p) => p.kind))].filter((p) => p !== "knolls");
  readme.push(`| ${k + 1} | [${name}.timber](${encodeURI(name)}.timber) | ${THEME_NAMES[c.theme]} | ${c.seed} | ${lines.slice(0, 3).join(" ")} |`);
  index.push({ n: k + 1, name, theme: c.theme, seed: c.seed, sha256: sha(r.bytes), sameAsBatch: same, passed: r.report.passed && r.storage.ok, attempts: r.attempts });
  const brief = `# ${k + 1}. ${name}

${THEME_NAMES[c.theme]}, 128², Normal, seed ${c.seed}, prototype ${PROTO_VERSION}. File:
[out/${name}.timber](../out/${encodeURI(name)}.timber).

![Top-down, north up](../renders/${nn}-top.jpg) ![3D, from the south-east](../renders/${nn}-3d.jpg)

## Terrain

- **Land:** ${parts.length ? parts.join(", ") : "rolling ground"} over ${g.tiltKind === "radial" ? "a bowl draining toward the " + DIR_NAMES[g.flowDir] : "land falling toward the " + DIR_NAMES[g.flowDir]}; ${m.metrics.heightRange} levels of relief, ${Math.round(m.metrics.flatShare * 100)}% flat, ${m.score.plateaus} plateaus.
- **Water:** ${info.hydro.rivers} river${info.hydro.rivers === 1 ? "" : "s"} (${m.water.inflows} from the map edge, ${m.water.springs} from springs), ${m.water.lakes} lake${m.water.lakes === 1 ? "" : "s"}, ${m.metrics.waterfalls} fall${m.metrics.waterfalls === 1 ? "" : "s"} (tallest ${m.water.maxFallDrop} levels)${info.hydro.splits ? ", a river island" : ""}${info.hydro.deltas ? ", a delta" : ""}; water covers ${Math.round(m.metrics.waterShare * 100)}% of the map.
- **Start:** ${info.start?.kind ?? "?"}; **badwater:** ${info.badwater === "pit" ? "a hollow on high ground" : "none"}${g.recipe ? `; **recipe:** ${g.recipe}` : ""}.

## How it plays

${lines.map((l) => `- ${l}`).join("\n")}

## Cycle timeline

*Waiting for the weather-cycle simulator (branch \`investigation/cycles\`, no finished PR on
2026-09-25).* It will show, cycle by cycle, when the start's water stops, what the colony can store
and when badwater arrives. Until then, from the analysis: in a Normal drought (9 days) the start's
water keeps ${Math.round(c.opening.v.droughtKeep * 100)}% of its volume; ${c.opening.shortest40 !== null ? `a straight dam of ${c.opening.shortest40} tiles within 40 tiles holds 380 blocks` : "no straight dam within 40 tiles holds 380 blocks"}.

## Strategy axes

*Waiting for the mechanics catalogue (branch \`investigation/mechanics\`, no finished PR on
2026-09-25).* This map's position on its strategy axes goes here.
`;
  writeFileSync(join(briefDir, `${nn}.md`), brief);
  console.log(`${nn} ${name}: ${same ? "same bytes as the batch" : "DIFFERENT BYTES"}, ${r.report.passed && r.storage.ok ? "passes" : "FAILS"}`);
});
writeFileSync(
  join(outDir, "README.md"),
  `# Ten prototype maps to play

Maps from the M9 design prototype (${PROTO_VERSION}), 128², designed for Normal. They are our own maps.
Each passes the product's checks and comes back byte for byte from its seed.

**To play one:** copy its \`.timber\` file to \`Documents\\Timberborn\\Maps\`, then pick it under
**New game**.

| # | File | Theme | Seed | How it plays |
|---|---|---|---|---|
${readme.join("\n")}

How they were picked: River Valley's most typical map first, then one map from each other theme and
four more from any theme, each the map least like the ones already picked (half its shape and
numbers, half its opening). Not by score. A one-page brief for each is in [../briefs](../briefs).
`,
);
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 1) + "\n");
