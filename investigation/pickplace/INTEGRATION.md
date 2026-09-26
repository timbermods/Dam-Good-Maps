# Pick a place after Live editing — proposals only

Use AWS Terrarium tiles directly from a browser worker. No proxy is needed in the measured browser. Keep Copernicus and regional 3DEP behind a future source interface, not in the first delivery. [Source comparison](SOURCES.md).

This follows PLAN's north-star journey (D161): find a place → make a map → inspect weather → adjust it with Live editing → play. Real coordinates supply a starting landscape; generated water sources, resources and height compression make it a game interpretation, not a replica. This is a separate entry point from procedural generation, consistent with D108 and D159. Do not convert the generator into a collection of geographic templates.

## Player flow

1. **Pick a place** opens a simple world outline, a coordinate field and an area rectangle. Paste decimal coordinates, or click and drag. Start with a self-hosted Natural Earth public-domain outline; no Google tiles, imagery or APIs. The prototype implements coordinates, not this map picker.
2. Choose **Map size** (96, 128 or 256). Keep **Choose for me** for geographic scale. Show kilometres across and the changing rectangle. An advanced control can select metres per tile. A 128-tile map and a 128-km area are different things.
3. Show the cheap terrain preview and plain concerns while the worker samples. Make suggestions clickable: larger area, finer scale, or a measured nearby drainage location. Label drainage as inferred until independently verified. Do not promise that the predicted point contains a river.
4. Convert in the background. Show progress immediately; cancel or move the area at once. A request ID discards stale results. Limit tile concurrency and reuse cached tiles. An unavailable source produces an inline retry, never invented elevations.
5. Open the map in the existing 3D view and Live editing. Show the actual starting walk, water and resources, plus all failed checks. Offer Weather view when it exists. Do not call a terrain score a playability guarantee.
6. **Download .timber** or the shared **Save to Timberborn** flow. Use the canonical settle and shared validator again after editing. Prototype downloads are available only for its passing local checks; production export should follow the existing app's chosen warning/blocking policy.

The first production scope should say “most land between 85°S and 85°N”. “Any spot on Earth” needs a geographic/polar DEM path and reliable water masks. Open ocean and ice are meaningful negative results, not successful game maps. DMS parsing, geocoding, mobile memory budgets, Firefox/Safari workers and lost-network recovery need explicit follow-up tests.

## Shared code and the milestone run

**The milestone run owns the real D153 validators and no-wall rule. Do not build them twice.** This investigation is based on `84b1866b4e1d444346949a7dd57dc0f3f9f69ac5`. Its local verdict is visibly named `LOCAL D151–D153 adapter`; the unmodified base-validator result is kept alongside it. These are study results, not changes to the app's validators.

| Local investigation code | After the milestone lands on dev |
| --- | --- |
| `rules.ts: pumpShore`, D153 replacement in `currentRules` | Delete the replacement verdict. Call the shared walking-to-pumpable-shore analysis for both start selection and validation. Retain the synthetic slope regression as a shared test only if the milestone does not already cover it. |
| `currentRules` water amount/body-size/outflow policy | Delete once the shared real-place profile implements D152. Use that profile; no per-feature allowlist of waived validator IDs in production. Keep canonical settling and load failures visible. |
| `convert.ts` no-wall adaptation (`edgeChanges = 0`) | Reuse the updated landscape/shared converter. Do not add a second edge rule or rim detector. Keep an integration assertion that conversion preserves the supplied heights. |
| `rules.ts: naturalSlopes` | Replace with the shared slope builder if exposed by the milestone; ensure it uses existing one-level steps and the actual exported slope links. This prototype's dense, deterministic placement is not a proposed production slope style. |
| Existing base `start.wood` tree-count check | Adopt D164's shared log-yield defaults when implemented. Do not create another default-species calculation here. Re-run the matrix; these results retain the old 40-living-tree Normal gate. |
| `hydrology.ts` browser stack fix | Move the reduction into the shared halo routine if still needed; delete the copy. No change to the drainage algorithm is needed. |
| `adapt.mjs` and copied `convert.ts` | Remove once the browser-safe shared conversion entry point is available. Keep source sampling, settings and the UI adapter separate from conversion. |

Before integration, pin the milestone commit and rerun the same 150 cases against it. Compare every local/shared verdict and explain differences, rather than assuming the rates transfer. The browser/Node adapter contains no second water simulator: it already imports canonical settle, moisture, entity builders, JPEG rendering, ZIP I/O and load validation from `src/core`.

Proposed production seam: `fetchElevation(area, resolution, signal)` → `analysePlace(coarseGrid)` → `chooseMapping(grid)` → shared heightmap conversion → existing editable document. The document should retain coordinates, extent, source tile identifiers/hashes, mapping parameters and credits as project provenance. Map conversion and future heightmap import should share this path (D159).

## Quality and attribution

Treat the prediction as a screening aid. A DEM cannot confirm a real river; coastal low ground can also be a dry polder. The next improvement should combine an independently licensed open water mask/hydrography source with elevation, then validate its own CORS, provenance and redistribution requirements. Do not silently add OpenStreetMap or any other data before that evaluation.

Add source-quality checks before simulation: constant-zero tiles beside deep bathymetry, abrupt provider seams and missing coverage need an inline warning and another source or location. The dateline control exposed a real upstream zero-tile seam; it is not fixed by wrapping coordinates correctly. A desert conversion can also pass after adding inferred game water: never label that water as a verified real river.

Keep the provider credit visible beside the geographic picker and preview. The page must contain the full provider notices and licence links, not just an “AWS” logo. Every `.timber` needs its own portable notices: this prototype embeds them in the map description and `ATTRIBUTION.txt`, with provenance in `pickplace.json`. The embedded description remains readable even if the game ignores extra ZIP entries. The prototype favours complete notices over D155's shorter description; shorten only after per-provider review establishes what can safely live on a linked credits page.

Published previews and downloadable maps need the same attribution. Copernicus's specific modified-data wording and disclaimer would be required if that source is added. Cache tile bytes with their source identity, never lose credits when a player edits, and record changes as modified data with no provider endorsement.

No website, Worker, main/dev change, release, tag or integration is proposed for automatic publication by this investigation. Only its research branch and one open PR are in scope.
