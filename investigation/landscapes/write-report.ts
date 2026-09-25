import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
const s = JSON.parse(readFileSync("data/summary.json", "utf8"));
const library = JSON.parse(readFileSync("library/index.json", "utf8"));
const notes = JSON.parse(readFileSync("family-notes.json", "utf8"));
const percent = (a: number, b: number) => ((100 * a) / b).toFixed(1) + "%";
const fmt = (n: any) =>
  typeof n === "number" ? Number(n.toFixed(3)).toString() : "not measured";
const families = Object.entries(s.families)
  .map(
    ([f, x]: any) =>
      `| ${f} | ${x.passed} / ${x.converted} (${percent(x.passed, x.converted)}) | ${notes[f][0]} ${notes[f][1]} | ${notes[f][2]} |`,
  )
  .join("\n");
writeFileSync(
  "FAMILIES.md",
  `# Landscape families and play\n\nThese are sampling families, not generator templates. Pass rates count all three 16-level mappings, all nine windows, and all four centres around each named region. They describe this conversion policy, not the fraction of real landscapes that are playable. Nearby windows can miss the named feature.\n\n| Family | Passed / converted | Formation and process families | Play value and limits |\n|---|---|---|---|\n${families}\n\nUse combinations: a caldera with an eroded outlet gorge; a glacial floor below hanging tributaries; a meandering floodplain beside an escarpment; a confluence between plateau remnants. The terrain must supply the start, water route and dam opportunities. Do not paste a member of this library into a generator.\n\nProcess references: [NPS river systems](https://home.nps.gov/subjects/geology/fluvial-landforms.htm), [braided streams](https://www.nps.gov/articles/braided-stream.htm), [volcanic landforms](https://www.nps.gov/subjects/volcanoes/volcanoes-volcanic-landforms.htm), [calderas](https://home.nps.gov/articles/000/calderas.htm), [karst](https://www.nps.gov/subjects/caves/karst-landscapes.htm), and [glaciers](https://www.nps.gov/subjects/glaciers/about.htm). These explain process families. The proposed play value is an interpretation for Timberborn.\n`,
);
const biggest = Object.entries(s.failures16)
  .slice(0, 7)
  .map(([k, v]) => `${k}: ${v}`)
  .join("; ");
const compareKeys = [
  "straightShare8",
  "longestRun",
  "ridgeThicknessCV",
  "branching",
  "sinuosity",
  "junctionAngle",
  "valleyWidth2",
  "lakeShare",
  "fallCount",
  "reservoirVolume",
];
const table = compareKeys
  .map((k) => {
    const c = s.comparison[k];
    return `| ${k} | ${fmt(c.real.p50)} | ${fmt(c.generated.p50)} | ${fmt(c.medianDifference)} |`;
  })
  .join("\n");
const maps = Object.entries(s.mappings)
  .map(
    ([k, v]: any) =>
      `| ${k} | ${v.readabilityProxy} / ${v.n} | ${v.passed} / ${v.n} |`,
  )
  .join("\n");
const verifies = JSON.parse(
  readFileSync("data/library-verification.json", "utf8"),
);
writeFileSync(
  "REPORT.md",
  `# Real landscapes for Dam Good Maps\n\nUse these measurements to set ranges for generative processes. Do not copy the patches into the generator. The [bench](bench/README.md), [families](FAMILIES.md) and [integration proposals](INTEGRATION.md) are the handoff to M9.\n\n## What ran\n\n- 450 centres: 400 around 100 named regions in 20 families, plus 50 seeded random land centres.\n- 4,050 patches: 96², 128² and 256², each at 30, 60 and 120 m per tile.\n- ${s.editorSafe} conversions at 16 levels; ${s.comparison22} at 22 for comparison.\n- ${s.passed16} / ${s.editorSafe} (${percent(s.passed16, s.editorSafe)}) passed the unchanged TypeScript generate-profile validator. ${s.passed22} comparison maps passed.\n- ${s.generated.passed} / ${s.generated.count} current generated maps passed: seeds 1–30 in all six themes at 128². River Valley matched all ${s.generated.defaultCliMatches} files from tools/gen.ts byte for byte.\n\nBase: dev at cfa5990caeaf462de695caf428280da55fc0f7f5. Terrain Tiles was downloaded on 2026-09-25. Raw tiles stay untracked. [Attribution](ATTRIBUTION.md) applies to every fixture and preview.\n\nMain blocking failures, with overlap: ${biggest}. Advisory failures are separate. A pass does not promise adequate drought storage or wide access.\n\n## What changed at game scale\n\n| Mapping | Readability screen | Validator passes |\n|---|---|---|\n${maps}\n\nThe readability screen requires at least five levels and elevation correlation of 0.9. It is not a human judgement of landform identity. Linear mapping keeps a fixed vertical scale but can clip high relief or erase low relief. Normalising preserves more local shape while exaggerating small real differences. Compression preserves ordering but changes slope proportions.\n\n## Real against generated\n\nMedians below compare named regions at 128², 60 m per tile and normalised 16 levels against the 180 generated maps. Real values give each named region one vote. Water bands use only settled conversions. Read the full stratified targets before selecting a range.\n\n| Measure | Real median | Generated median | Generated minus real |\n|---|---|---|---|\n${table}\n\nThese are measurements of shape and simulated water. D8 routing cannot recover splitting rivers; split/rejoin cell shares and enclosed islands are separate water-grid proxies. Shallow braid channels, real lake depths, tides and underground karst drainage remain unresolved.\n\n## Library and limits\n\nThe library contains ${library.count} passing patches from ${new Set(library.items.map((r: any) => r.family)).size} families and distinct regions. Fixtures plus previews occupy ${(library.bytes / 1e6).toFixed(2)} MB. Each stores heights, sources, start, resources, coordinates, mapping, attribution and checks. Open library/gallery.html.\n\nFresh TypeScript settles passed for ${verifies.typescriptFreshSettlePasses} fixtures. Python verification: ${verifies.python}. Timberborn was never launched.\n\nThe sample is exploratory. Named regions were chosen for landform interest. Four nearby centres and several scales overlap. Family labels describe the region, not a verified feature in each window. Random controls exclude latitudes beyond 80 degrees. The start search evaluates at most 48 candidates and adds no slopes. Conversion failures do not prove a landscape cannot work.\n\n## Decisions and handoff\n\nKeep all work and dependencies in this folder. Preserve failures as evidence. Use all three 16-level mappings, with 22 kept separate. Infer sources from drainage, seal the border, and leave interior heights unchanged. Use default Normal start and resource checks. Record rather than waive failed checks.\n\nThe CLI has no theme option, so the other themes use the same generate API. A local loader reads core TypeScript without changing the root package or installing there. Both are tooling choices only.\n\nNo generator process was designed or prototyped here. Changes to PLAN.md and ROADMAP.md are proposals in INTEGRATION.md. Every changed repository file is inside investigation/landscapes/.\n`,
);
console.log("Wrote REPORT.md and FAMILIES.md");
