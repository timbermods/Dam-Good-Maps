# Real landscapes for Dam Good Maps

Use these measurements to set ranges for generative processes. The [bench](bench/README.md), [families](FAMILIES.md) and [integration proposals](INTEGRATION.md) are the handoff to M9. The patches are references, never generator templates.

## What ran

- 450 centres: 400 around 100 named regions in 20 families, plus 50 seeded random land centres.
- 4,050 patches: 96², 128² and 256², each at 30, 60 and 120 m per tile.
- 12150 conversions at 16 levels; 4050 at 22 for comparison.
- 3232 / 12150 (26.6%) passed the unchanged TypeScript generate-profile validator. 0 comparison maps passed.
- 180 / 180 generated maps passed: seeds 1–30 in all six themes at 128². River Valley matched all 30 tools/gen.ts exports byte for byte.

Base: dev at cfa5990caeaf462de695caf428280da55fc0f7f5. Terrain Tiles was downloaded on 2026-09-25. Raw tiles remain untracked. [Attribution](ATTRIBUTION.md) applies to every fixture and preview.

Main blocking failures, with overlap: water still moving after four game days: 4790; pumpable clean water too far from the start: 3215; too much of the map under water: 2507; too little scrap: 1498; source water does not reach an outlet: 1136. Advisories remain separate. Passing does not promise adequate drought storage or wide access.

## What survives quantisation

| Mapping | Readability screen | Validator passes |
|---|---|---|
| linear-16 | 2114 / 4050 | 908 / 4050 |
| compressed-16 | 3940 / 4050 | 1119 / 4050 |
| normalised-16 | 3950 / 4050 | 1205 / 4050 |
| normalised-22 | 3979 / 4050 | 0 / 4050 |

The screen requires five occupied levels and elevation correlation of 0.9. It is not a judgement of landform identity. Linear mapping can clip high relief or erase low relief. Normalising preserves local shape but exaggerates small elevation differences. Compression changes slope proportions.

## Real against generated

Straight contours show a large, edge-sensitive difference. Generated maps have a median 13.9% of contour edges in runs of eight or more tiles, against 2.0% for real terrain. 98.3% of generated maps lie outside the real p10–p90 band.

Sealing the real patches raises their median straight share to 9.4%. Edge treatment explains part of the gap. Longest-run comparisons even reverse after sealing. Use a consistent border convention when tuning; these figures do not isolate the generator's interior processes.

Generated basin rims vary less in thickness: median CV 0.184, against 0.419. Valleys at two levels above the drainage floor are narrower: 5 tiles against 9. These suggest investigating rim and valley variation. They do not prescribe a process or prove better play.

These figures compare named regions at 128², 60 m per tile and normalised 16 levels against 180 generated maps. Each real region gets one vote. [Comparison tables](COMPARISON.md) give all 26 measures, their bands, support counts and random-land controls.

Water measures use settled conversions only. Real conversions use twice the calibrated total flow, shared between up to eight inferred sources. This supplies split entries but makes water figures policy-dependent. Generated maps use their native default height range. Check adjacent scales and mappings before adopting a range.

On the repository's published variety calibration, the complete real anchor set scores 0.853, its 60 settled members 0.818, and all generated maps 0.584. Per-theme results and signatures remain in the data. This measures conversions, including planted resources. It is not a fun score.

D8 routing cannot recover distributaries. Water-grid split shares and enclosed islands are separate proxies. Shallow braid channels, lake depths, tides and underground karst drainage remain unresolved.

## Library and limits

The library contains 88 passing patches from distinct regions, spanning 20 named families plus 3 random controls. All library files total 4.47 MB, including previews and metadata. Open [the gallery](library/gallery.html).

The saved selection was frozen once every named family had eligible patches. This let library checks run alongside the remaining survey. It is a curated example set. Targets and pass rates use all completed conversions.

Fresh TypeScript settles passed for 88 fixtures. Python verification: 88 fresh settles passed; zero verdict disagreements. Timberborn was never launched.

The sample is exploratory. Named regions were chosen for interest; nearby centres and scales overlap. Labels describe regions, not verified features in every window. Las Medulas is a mining landscape, so its records remain visible but its region is excluded from natural targets and the library. Random controls exclude latitudes beyond 80 degrees.

## Decisions and handoff

Preserve failures. Keep 22-level comparisons separate. Infer sources from drainage, seal borders and leave interior heights unchanged. Use Normal start and resource checks without waivers. Real patches use the generic 35% water-coverage cap; generated island and lake-basin themes allow 55%. A geographic family is not a planned theme. Bound the start search to 48 sites to keep the matrix tractable; add no slopes. Failure does not prove no workable start exists.

The CLI has no theme switch, so other themes use the same generate API. A local loader reads core TypeScript without changing root dependencies. Variety uses the existing workshop calibration because fitting nearly constant planted-resource totals would distort distances.

No generator process was designed or prototyped here. PLAN.md and ROADMAP.md changes are proposals in INTEGRATION.md. Every changed repository file is inside investigation/landscapes/.
