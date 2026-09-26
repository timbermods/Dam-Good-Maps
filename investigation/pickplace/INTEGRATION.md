# Pick a place after Live editing — proposals only

**The land is real; the water is designed.** Use AWS Terrarium directly in a browser worker. No proxy is needed for the tested source. Keep the optional fixed-upstream Worker design in [SOURCES.md](SOURCES.md) for a future provider that requires it; nothing is deployed. Google imagery and elevation are never used.

This follows D161: find a place → make a map → watch its weather → adjust it with Live editing → play. Coordinates supply terrain; source placement, resources and height mapping create a game opening. A real river, water mask or hydrography service is not a prerequisite. This remains a separate entry into the shared app, not a set of geographic generator templates.

## Proposed player flow

1. **Pick a place:** click a self-hosted Natural Earth public-domain world outline or paste coordinates. Move a visible area rectangle. The prototype implements decimal coordinates only.
2. Choose size. Default geographic scale to **Choose for me**. Show kilometres across. An optional water intention can favour a cliff or basin; later, a clicked feature can anchor “a river over this cliff into a lake.” The prototype has three categorical intentions, not point targeting or free-text parsing.
3. Sample a cheap terrain preview. Explain real constraints such as little relief, steep ground or uncertain source data. Do not reject a place for lacking native water. Design sources along the land's drainage and simulate them.
4. Quietly try alternate water layouts, scales, sizes and nearby offsets when needed. Keep progress and cancellation immediate. Prefer the chosen area, then the closest passing alternatives. The prototype bounds this to seven configurations, two water designs each, stopping on a pass. Its final size and coordinates are always shown; production should also animate the changed rectangle so recovery is clear.
5. Return the best passing tested map to the existing 3D/Live editing document. Show the actual start walk and sources. If the bounded search cannot pass, show the best attempted map and nearby simulated previews with specific reasons. Those are suggestions, not validated downloads. Do not loop indefinitely or make the player answer diagnostic questions.
6. Inspect Weather, make reversible edits and use the shared **Download .timber** / **Save to Timberborn** flow. Re-settle and validate after edits. Preserve credits and geographic provenance through editing and export.

The first supported geography is ±85°. True worldwide coverage still needs a polar projection/provider. Flat ocean or ice may lack an opening even with sources; source-data seams need detection and a licensed fallback. None of these should be described as “no river.”

The bounded prototype search can still take minutes. Production should stream terrain and head previews immediately, show each search stage, reuse terrain analysis and cached tiles, and keep cancellation instant. The prototype currently shows the cheap prediction as text and the rendered map after search. Independent origin audits can add one simulation per head; evaluate a cheaper proven route check before integration. Downloads still require a passing start and source origins.

The prototype tries other sizes at the original chosen scale, rather than every size/scale pair. It can miss a combination found by requesting another size separately. For production, cheaply screen each alternative size's own scales before selecting its retry. Keep a bounded search and show the tested suggestions when it is exhausted.

## Designed-water seam

Proposed pipeline: fetch elevation → measure terrain → choose scale/mapping → rank drainage routes and source plans → shared heightmap conversion/settle/start selection → shared validation → editable document. Retry only the needed stages and reuse fetched bytes. Keep one water simulator and one authoritative validator.

The prototype's new reusable idea is `designed-water.ts`: a source is where water begins. Eligible origins are exact map-edge river entries or tributary heads below ridges. Never place one mid-river or inside a lake, and never add downstream boosters. Every planned tributary has its own head. Increase head strength for more flow; a future cluster must put sources side by side at the same head. This prototype uses strength changes, not clusters.

Rank eligible heads by the interesting ground downstream: banks, confined valleys, cliffs and basins. Reject heads on another planned water route. Before accepting a multi-head map, simulate the other heads without each one's own flow and check it stays dry. Keep this origin check alongside the shared validator until a shared feature-origin rule exists. It is separate from the temporary D153 adapter. When importing/editing an existing document, its known river/lake masks must veto source sites before ranking. DEM-only morphology cannot establish every real-world water boundary.

Separate physical routing from desired character. Size controls head count and strength; alternate plans choose other heads. Never alter terrain to manufacture a start. An intention is a preference whose achieved result should be shown, not a promise that any cliff feeds a lake. [Algorithm and limits](METHODS.md).

Retain the requested and returned extent, selected source plan, stable source IDs, mapping, source tile hashes and attempts as document provenance. Expose the winning sources as editable features. Future source locks and start locks should participate in the same retry constraints; do not silently move a locked choice. The prototype stops at export and does not implement document/feature integration.

## Avoid duplicating the milestone work

**The milestone run owns D153, D152/no-wall policy and D164.** This investigation changes none of the real validators. Its named `LOCAL D151–D153 adapter` uses core `84b1866`; checked remote dev `bf4e612` still had same-level water. Pin the landed milestone commit and rerun all 150 cases before integration.

| Temporary local code | Remove or replace when the milestone lands |
|---|---|
| `rules.ts: pumpShore` and the D153 verdict, including the dry-path mask | Use the shared walking-to-pumpable-shore analysis for selection and validation. Reconcile this study's conservative dry-path restriction with the shared game walking policy. Move only missing regressions into shared tests; do not create a second D153 implementation. |
| `currentRules` allowlist for old water coverage/body/outflow gates and source requirement | Use the shared real-place D152 profile. Delete local waived-ID policy; retain canonical settling and load failures. |
| `convert.ts` no-wall adaptation | Use the milestone's shared converter. No new rim detector or edge implementation. Keep an integration assertion that heights are unchanged after mapping. |
| `naturalSlopes` | Reuse the shared natural-slope builder when available. The dense prototype placement is not a production slope style. |
| Old `start.wood` living-tree gate | Adopt shared D164 log-yield and grown-tree rules/defaults; no local species/default calculation. Report the resulting rate changes. |
| Copied converter and `adapt.mjs` | Delete when a browser-safe shared heightmap entry point exists. Keep fetch/settings/source-design/search adapters outside it. |
| `hydrology.ts` baseline copy | No longer used by the new water design. Delete in integration; only migrate its stack-safe reduction if another shared caller still needs it. |

Source design and bounded search are the new proposals here. Local validator fixes, slope plumbing and edge handling become unnecessary once the shared equivalents land. Compare local/shared verdicts explicitly rather than assuming the new pass rate transfers.

## Attribution and quality

Keep visible provider credit next to picker and preview, with full notices and licence links on the page. Each map must carry portable notices in its description and `ATTRIBUTION.txt`, and provenance in `pickplace.json`. Keep the complete mosaic notice unless provider-level provenance supports a narrower one. Record resampling, height compression, designed water and added resources as modifications. No provider endorsement is implied. Edited maps and preview images retain attribution.

The cheap score is a terrain-screening heuristic, not a probability or fun score. Low-ground share is not a water mask. Detect constant-zero tiles beside bathymetry and other seams before claiming faithful terrain. A later open water mask may inform presentation, but native water must never be a conversion requirement. Copernicus/3DEP fallback needs its own tested fetch path and required notices before use.

Only the research branch and PR are published. This document proposes integration; it does not deploy a website or proxy, change production code, merge anything, or authorize a release.
