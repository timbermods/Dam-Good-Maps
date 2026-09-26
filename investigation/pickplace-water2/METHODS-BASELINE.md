# Prototype method

Base: dev `84b1866b4e1d444346949a7dd57dc0f3f9f69ac5`. All code and results in this investigation remain under `investigation/pickplace/`. The root packages and production code are read-only dependencies.

## Reproduce

From this directory, with Node 24 and an installed Microsoft Edge:

```text
npm ci
npm run build
npm test
npm run cors
npm run survey
npm run summarize
npm run serve
```

Open `http://127.0.0.1:4178`. `dist/`, browser downloads and `.work/` stay ignored. The server serves static files only: elevation fetches go directly from the browser worker to AWS. `LIMIT` and `SIZES` environment variables can restrict the survey. The complete run uses all 50 places and all three sizes. Do not run two surveys on the same output directory.

`adapt.mjs` records the mechanical changes from the existing landscape converter; its generated `convert.ts` and `hydrology.ts` are committed. Do not rerun it against a newer pipeline without checking the changes. `rules.ts` is an explicitly temporary policy adapter. See the deletion/replacement plan in [INTEGRATION.md](INTEGRATION.md).

## Selection and mapping

The landscape survey found normalised 16-level conversion more readable and more often valid than a fixed 30 metres/level mapping. Its 22-level comparison failed the then-current design gate; it also used artificial edge sealing. Neither its 26.6% pass rate nor its selected library is a fair baseline for this no-wall experiment.

The prototype samples three **64²** previews at 30, 60 and 120 metres per game tile. Each preview covers the entire proposed extent. Robust relief is p98−p02. It measures adjacent slopes, the below-sea-level share and priority-flood drainage accumulation. No water simulation runs at this stage. The screen favours visible relief, potential drainage and land, penalises extreme slopes, and weakly favours 60 m/tile by three score points. It uses no place-name/family labels.

The selected area is sampled at game resolution with a 16-cell halo, bilinear interpolation and pixel-centre alignment. Rows increase northward. Longitudes wrap across the dateline. A local spherical approximation supplies metre spacing; this is not a surveying projection. Source PNG zoom is capped at 14. Tiles are decoded without colour conversion, checked for opaque 256² pixels, and hashed. A 160-tile memory cache plus the browser Cache API avoids repeats. Persistent cache eviction is a production follow-up.

Height mapping compares 8, 12 and 15 levels of relief (plus a base level), all capped by `round(real relief / 3 m)` so centimetres of noise do not become mountains. It preserves minimum and maximum. Normalised linear mapping is the default; a power of 0.8 is also considered when high relief is concentrated in peaks. The selection balances occupied height range, multi-level cliff frequency and existing 3×3 flat sites. Values remain 1–16. No channel, pad, edge wall or rim is carved or raised after mapping.

This is a heuristic, not a fitted optimum. The matrix does not establish that automatic selection beats a fixed 60 m/tile baseline; that needs a paired ablation. Canyons tend to keep dramatic normalised relief; pointed volcanoes can use mild peak compression; plains retain little relief rather than exaggerating noise; fjords trigger low-ground warnings. None of these labels is an algorithm input. A shallow river can disappear after quantisation, and a lake surface contains no lake-bed depth.

## Water and start

The survey's priority-flood drainage and halo entry selection supply up to eight **inferred game sources**. Their real-world positions/discharges are not verified. Nonpositive-elevation source candidates are excluded; this also loses legitimate below-sea-level inland water. Total game flow remains twice the survey's size-calibrated median, distributed by square-root catchment proxy, capped at eight per source. Tuning flow against a known water mask is future work.

The existing canonical water simulation supplies depth, moisture and the four-day settle verdict. A steady flow off the edge is allowed; failing to settle remains a failure. The local D152 profile changes old water-coverage, minimum-water-body and planned-outflow checks to advisory; it does not replace simulation or invent stored water.

Natural Slope objects connect existing one-level steps, with dry approaches. The existing start search examines at most 48 flat 3×3 candidates with a dry ring. It ranks walking access to a shore that has clean water at least 0.3 deep and within a pump's two-level reach. Normal requires at most 20 walking tiles, using actual slope links and the shared object blockers. Resources follow the survey's existing moisture-aware placement. The base validator's other load, design and resource gates remain, including the older living-tree count; D164 awaits shared thresholds.

Both reports are retained: `legacyPassed` and `current.passed` (`LOCAL D151–D153 adapter`). A pass is a conservative prototype check, not a proof of fun, drought survival or in-game correctness. Missing water, excessive water, no flat start, slow settling and scarce resources remain visible. The prototype permits download only for a local pass.

## Predictions and suggestions

The numeric terrain score is not a probability. Below 40 is difficult; 40–64 uncertain; 65+ promising. The reports compare those labels with actual conversion outcomes, including false optimism. Terrain below zero is explicitly called a **sea/low-ground proxy**, not a water mask. Priority flood always routes somewhere: a drainage corridor does not establish a real river, especially on a desert, ice or flat plain.

Suggestions explain a specific cheap measure: increase area for low relief, use a finer scale around cliffs/coasts, or move towards an interior high-accumulation cell. The latter includes calculated distance, direction and coordinates, explicitly labelled inferred drainage. It does not promise the shifted window passes. Production should sample the proposed window before calling it an improvement.

## Matrix and checks

`places.json` is fixed before conversion: the first two anchors from each of the survey's 20 families (40), plus ten controls covering plains, desert, ocean, ice, polar terrain, the dateline and a city. It is a convenience sample for variety, not random Earth coverage. There are 150 independent conversion attempts at 96², 128² and 256². Nearby sizes overlap and are not independent landscapes. Each attempt chooses one scale before conversion; there are no hidden retries or discarded geographic failures.

The runner opens one real browser page, starts a module Worker for each map, and stores every summary and small terrain/water render. A 50 ms page timer records that the main thread continues running. This timer is a coarse responsiveness check, not a frame-rate or mobile performance guarantee. Timings separate preview/settings, detailed fetch (including mapping and halo drainage), conversion and export/reload; later sizes benefit from the shared browser cache. Browser tests ran briefly alongside part of the matrix, so timings are indicative, not isolated benchmark scores.

ZIP exports are read again with the existing reader and load-only export validator. Attribution lives both in the map description and extra files. Invalid experimental files remain in ignored `.work/maps/`; downloadable UI maps must pass. No game was launched. Regression tests cover a slope-only walk to water, a blocked path, contaminated water, one-level slope links, unchanged terrain, 256-cell halo routing, input boundaries, coordinate wrapping, noise amplification, cancellation and download behaviour.

The saved exports contain access dates and request timing provenance, so byte-for-byte ZIP determinism is not claimed. Terrain conversion is deterministic for the same source bytes/settings. A production provenance record should separate stable inputs from timing diagnostics to regain byte-stable exports.

The contact sheet exposed a sharp seam at Taveuni. A follow-up browser test sampled equivalent longitudes (179.99 and −180.01); they differed by less than 0.000002 m. An independent PNG decoder confirmed the upstream zoom-12 tile west of the seam is entirely zero. This is a source-data discontinuity, not evidence of flat land. All three dateline cases remain failed conversions. [Evidence](results/dateline-check.json), reproduced with `node dateline-check.mjs`. Detecting these seams and selecting another open source should precede a worldwide quality claim.
