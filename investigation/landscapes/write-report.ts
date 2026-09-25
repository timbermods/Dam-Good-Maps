import { readFileSync, writeFileSync } from "node:fs";
const s = JSON.parse(readFileSync("data/summary.json", "utf8"));
const library = JSON.parse(readFileSync("library/index.json", "utf8"));
const notes = JSON.parse(readFileSync("family-notes.json", "utf8"));
const verifies = JSON.parse(
  readFileSync("data/library-verification.json", "utf8"),
);
const percent = (a: number, b = 1) => ((100 * a) / b).toFixed(1) + "%";
const fmt = (n: any) =>
  typeof n === "number" ? Number(n.toFixed(3)).toString() : "not measured";
const families = Object.entries(s.families)
  .map(
    ([f, x]: any) =>
      `| ${f} | ${x.passed} / ${x.converted} (${percent(x.passed, x.converted)}) | ${library.items.filter((r: any) => r.family === f).length} | ${notes[f][0]} ${notes[f][1]} | ${notes[f][2]} |`,
  )
  .join("\n");
writeFileSync(
  "FAMILIES.md",
  `# Landscape families and play

These are sampling families, not generator templates. Pass rates count all three 16-level mappings and all nine windows per centre. They describe this conversion policy, not the fraction of real landscapes that are playable. Nearby windows can miss the named feature. Random land is a control cohort.

| Family | Passed / converted | Library | Formation and process families | Play value and limits |
|---|---|---|---|---|
${families}

The badlands row retains the Las Medulas sampling error in its counts. That mining landscape is excluded from natural targets and the library. See [methods](METHODS.md).

Use combinations: a caldera with an eroded outlet gorge; a glacial floor below hanging tributaries; a meandering floodplain beside an escarpment; a confluence between plateau remnants. The terrain must supply the start, water route and dam opportunities. Do not paste a member of this library into a generator.

Process references: [NPS river systems](https://home.nps.gov/subjects/geology/fluvial-landforms.htm), [braided streams](https://www.nps.gov/articles/braided-stream.htm), [volcanic landforms](https://www.nps.gov/subjects/volcanoes/volcanoes-volcanic-landforms.htm), [calderas](https://home.nps.gov/articles/000/calderas.htm), [karst](https://www.nps.gov/subjects/caves/karst-landscapes.htm), and [glaciers](https://www.nps.gov/subjects/glaciers/about.htm). These explain process families. The play value is an interpretation for Timberborn.
`,
);
const biggest = Object.entries(s.failures16)
  .slice(0, 5)
  .map(([k, v]) => `${k}: ${v}`)
  .join("; ");
const measures: Record<string, string> = {
  straightShare8: "Contour edges in straight runs of 8+ (fraction)",
  longestRun: "Longest contour run (tiles)",
  basinRimThicknessCV: "Basin rim thickness variation (CV)",
  ridgeThicknessCV: "Ridge thickness variation (CV)",
  drainageDensity: "Drainage length / area (tile⁻¹)",
  branching: "Drainage junctions / 10,000 tiles",
  sinuosity: "River segment length / chord",
  junctionAngle: "Junction angle (degrees)",
  valleyWidth2: "Valley width at +2 levels (tiles)",
  lakeShare: "Lake area / map area",
  fallDrop: "Wet fall drop (levels)",
  reservoirEfficiency: "Best reservoir volume / dam length (tile²)",
};
const table = Object.entries(measures)
  .map(([k, label]) => {
    const c = s.comparison[k];
    return `| ${label} | ${fmt(c.real.p50)} | ${fmt(c.generated.p50)} | ${c.real.n} |`;
  })
  .join("\n");
const maps = Object.entries(s.mappings)
  .map(
    ([k, v]: any) =>
      `| ${k} | ${v.readabilityProxy} / ${v.n} | ${v.passed} / ${v.n} |`,
  )
  .join("\n");
const straight = s.comparison.straightShare8;
const rims = s.comparison.basinRimThicknessCV;
const width = s.comparison.valleyWidth2;
const namedLibraryFamilies = new Set(
  library.items
    .filter((r: any) => r.family !== "random")
    .map((r: any) => r.family),
).size;
writeFileSync(
  "REPORT.md",
  `# Real landscapes for Dam Good Maps

Use these measurements to set ranges for generative processes. The [bench](bench/README.md), [families](FAMILIES.md) and [integration proposals](INTEGRATION.md) are the handoff to M9. The patches are references, never generator templates.

## What ran

- 450 centres: 400 around 100 named regions in 20 families, plus 50 seeded random land centres.
- 4,050 patches: 96², 128² and 256², each at 30, 60 and 120 m per tile.
- ${s.editorSafe} conversions at 16 levels; ${s.comparison22} at 22 for comparison.
- ${s.passed16} / ${s.editorSafe} (${percent(s.passed16, s.editorSafe)}) passed the unchanged TypeScript generate-profile validator. ${s.passed22} comparison maps passed.
- ${s.generated.passed} / ${s.generated.count} generated maps passed: seeds 1–30 in all six themes at 128². River Valley matched all ${s.generated.defaultCliMatches} tools/gen.ts exports byte for byte.

Base: dev at cfa5990caeaf462de695caf428280da55fc0f7f5. Terrain Tiles was downloaded on 2026-09-25. Raw tiles remain untracked. [Attribution](ATTRIBUTION.md) applies to every fixture and preview.

Main blocking failures, with overlap: ${biggest}. Advisories remain separate. Passing does not promise adequate drought storage or wide access.

## What survives quantisation

| Mapping | Readability screen | Validator passes |
|---|---|---|
${maps}

The screen requires five occupied levels and elevation correlation of 0.9. It is not a judgement of landform identity. Linear mapping can clip high relief or erase low relief. Normalising preserves local shape but exaggerates small elevation differences. Compression changes slope proportions.

## Real against generated

The clearest geometric difference is straight contours. Generated maps have a median ${percent(straight.generated.p50)} of contour edges in runs of eight or more tiles, against ${percent(straight.real.p50)} for real terrain. ${percent(straight.generatedOutsideRealCentral80)} of generated maps lie outside the real p10–p90 band.

Generated basin rims vary less in thickness: median CV ${fmt(rims.generated.p50)}, against ${fmt(rims.real.p50)}. Valleys at two levels above the drainage floor are narrower: ${fmt(width.generated.p50)} tiles against ${fmt(width.real.p50)}. These suggest more variation in contours, rims and valley sections. They do not prescribe a process or prove better play.

Medians below compare named regions at 128², 60 m per tile and normalised 16 levels against 180 generated maps. Each real region gets one vote. Water measures use settled conversions only. The generated maps use their native default height range. Check adjacent scales and mappings before adopting a range.

| Measure | Real median | Generated median | Real regions measured |
|---|---|---|---|
${table}

On the repository's published variety calibration, the complete real anchor set scores ${fmt(s.variety.referenceVariety)}, its ${s.variety.settledReferenceCount} settled members ${fmt(s.variety.settledReferenceVariety)}, and all generated maps ${fmt(s.variety.generatedVariety)}. Per-theme results and signatures remain in the data. This measures conversions, including planted resources. It is not a fun score.

D8 routing cannot recover distributaries. Water-grid split shares and enclosed islands are separate proxies. Shallow braid channels, lake depths, tides and underground karst drainage remain unresolved.

## Library and limits

The library contains ${library.count} passing patches from distinct regions, spanning ${namedLibraryFamilies} named families plus ${library.items.filter((r: any) => r.family === "random").length} random controls. All library files total ${(verifies.bytes / 1e6).toFixed(2)} MB, including previews and metadata. Open [the gallery](library/gallery.html).

Fresh TypeScript settles passed for ${verifies.typescriptFreshSettlePasses} fixtures. Python verification: ${verifies.python}. Timberborn was never launched.

The sample is exploratory. Named regions were chosen for interest; nearby centres and scales overlap. Labels describe regions, not verified features in every window. Las Medulas is a mining landscape, so its records remain visible but its region is excluded from natural targets and the library. Random controls exclude latitudes beyond 80 degrees.

## Decisions and handoff

Preserve failures. Keep 22-level comparisons separate. Infer sources from drainage, seal borders and leave interior heights unchanged. Use Normal start and resource checks without waivers. Search up to 48 start sites; add no slopes. Failure does not prove no workable start exists.

The CLI has no theme switch, so other themes use the same generate API. A local loader reads core TypeScript without changing root dependencies. Variety uses the existing workshop calibration because fitting nearly constant planted-resource totals would distort distances.

No generator process was designed or prototyped here. PLAN.md and ROADMAP.md changes are proposals in INTEGRATION.md. Every changed repository file is inside investigation/landscapes/.
`,
);
console.log("Wrote REPORT.md and FAMILIES.md");
