# Signature-water method and reproduction

Base: latest fetched dev when this branch was created, `91981517f747fa345b5586b9f036aedb74255b1b`. Work is confined to `investigation/pickplace-water2/`. The previous PR remained open then; its completed `474724a` results were copied as immutable comparison evidence. After #34 merged, the branch was advanced to fetched dev `2f8b4e6`; its shared `src/` and `investigation/landscapes/` files are identical to the recorded study base. No merge was performed by this task. All source, resource and simulator dependencies outside this folder are read-only.

## Run

In this folder, with Node 24 and Microsoft Edge:

```text
npm ci
npm run build
npm test
node test-proxy.mjs
node test-budget.mjs
node cors-worldcover.mjs
npm run survey
npm run summarize
node provenance.mjs
npm run serve
```

Open http://127.0.0.1:4178 . The local server serves the prototype and the fixed WorldCover range proxy. AWS elevation is fetched directly in the browser Worker. Full survey inputs are the unchanged 50 entries in `places.json` at 96², 128² and 256². `IDS`, `LIMIT`, `OFFSET`, `SIZES` and `MPT` permit pilots; the final matrix uses none. Do not run two surveys together. Raw exports and proxy cache stay under ignored `.work/` and `.cache/`. Failed exports are measured but never offered for download.

`results/` is the initial 47/150 study; `results-water/` is the previous 142/150 designed-water study. Their archived documents are BASELINE.md / METHODS-BASELINE.md and BASELINE-WATER.md / METHODS-WATER.md. The active commands write only `results-signature/`. Do not run the old mechanical `adapt.mjs` generator. The copied historical example files are historical, not today's approved downloads; use `examples-signature/`.

`before-water/` contains the exact >0.05-depth wet indices extracted from all 150 previous saved `.timber` exports, including the export hashes, actual frames and prior commit. Reproduction uses these masks rather than PNG colour inference. No prior simulator is rerun under changed code. This avoids accidentally calling a new algorithm the baseline.

## Reference and geometry

Read official ESA WorldCover 2021 v200 GeoTIFF native pixels through a range-restricted same-origin proxy, using GeoTIFF.js 2.1.3 in the browser Worker. The recorded browser CORS test tries three official AWS endpoint forms; each fails direct fetching. The same real browser decodes the dataset through the local handler. No CORS bypass is used. Water is class 80. Native 10 m classified pixels are counted into each geographic game cell using the same spherical local coordinates as elevation, with explicit longitude wrapping and north-up arrays. No-data pixels do not count as land. Reference coverage is recorded; unsupported tiles remain unknown. Mask/range records retain the data version, windows, ETags and SHA-256 byte hashes.

Cells with at least 8% classified water form a four-neighbour graph. Components need four cells and three tile-equivalents of observed water to become planned features. Significant signature targets have at least three tile-equivalents and 3% of the frame's observed water. These declared thresholds avoid turning every noisy pixel into a new lake; they also miss some narrow or fragmented channels. The classifier uses water footprint, interior-cell share, reference-core elevation spread and boundary contact, never place names or survey families. Sea openings accept below-sea-level bathymetry and anchor to mapped zero metres; broad flat bodies become lakes; remaining corridors become rivers. This is a heuristic, not an authoritative lake/river catalogue.

The old monotonic 1–16 mapping is retained, with a gentler 60%-relief alternative. No tall maps are introduced ahead of D172's required probe. Infer one water-bed level for the first two plans and two for the gentler plan, bounded at zero. Only observed-water cells may be lowered; broad bodies share a median mapped surface reference. These are invented beds because a DEM commonly records water surface height. No dry-land cell outside the mask changes after mapping, and no edge is raised. The inherited `edgeChanges: 0` field counts artificial boundary-wall adjustments; it does not claim that water-bed lowering avoids boundary cells. Mixed shoreline cells are a quantisation compromise.

## Source planning and start

Closed lakes use one basin spring, as explicitly requested in this follow-up. Broad open water uses the contiguous boundary openings. A river uses its highest upstream boundary mouth, with other sufficiently high tributary mouths; cells at a mouth are side-by-side head sources. An interior corridor begins from an adjacent dry bank below higher terrain. Its downstream fragments do not receive boosters: drainage propagation suppresses already-fed origins, then counterfactual prefill turns off each whole interior head and removes it if other heads already wet its site. Source footprints remain in the model when off. Prefill is a conservative screen. Before accepting an otherwise passing map, turn each whole interior head off and canonically settle the other heads: they must settle with its site dry (≤0.05). A single independent head has no other flow; boundary openings are origins by definition. This explicit LOCAL canonical audit stays separate from shared D153. Spring-in-own-lake is allowed; spring-in-another-head's-flow is not.

River total flow is max(1.5, 1.2 × inlet-cell count); lake/open-water flow is max(0.05, 0.00012 × feature-cell count). A second design doubles head flow. These game settings approximate evaporation and channel capacity, not measured discharges. If no usable observed feature exists, select the longest candidate drainage route from the former structural-head planner and give it size-scaled flow. There is no missing-native-river rejection.

For speed, a multi-source walk computes the exact union of prefill's non-increasing spill-surface routes. If no other head can reach an origin, its prefill depth is exactly zero and the repeated full prefill screen is skipped. Reachable origins still use the original prefill check, and final canonical audits are unchanged. The regression suite compares this wet set with exact prefill on 30 random terrains including off-source footprints. All reported final cases use this optimized version; earlier pilots remain ignored.

Canonical shared simulation runs before the start is selected. Flood-fill actual wet components touching the signature target, so a shifted simulated shoreline still belongs to that feature. Screen existing flat start pads by a reverse shore walk first, then moist land; verify the actual path with the exported natural slopes and the local pump rule. This fixes the former shortlist's preference for incidental ponds. No pad is flattened. Resource placement retains the inherited rules, so water-rich cases can fail global resource checks even with a good opening.

Try 60, 120, 240 and 30 m/tile in that order at the same requested centre and size. Each has up to three designs: ordinary inflow, stronger inflow, gentler mapping/deeper bed. Stop on a result with local playability and signature presence. A mask from the initial frame guards against deleting its observed features by tightening the crop. On exhaustion, prefer signature present, then playable, then more target coverage and fewer failures. Return an honest preview and reasons, not a downloadable failed map. Scale alternatives remain previews; size/offset recovery is intentionally deferred until it can preserve feature identity.

## Metrics and evidence

Wet means simulated depth >0.05. Native-water recall is the fraction of classified-water area that remains wet, weighted by each cell's native-water fraction. Precision is native-water overlap divided by all simulated wet cells; low precision exposes extra game flooding. A significant reference component is present at 70% wet coverage. Report each component and the all-components verdict, alongside the local pass. This is not a river-connectivity or delta-branch topology proof, nor a calibrated fun score.

Every request has three comparisons: old water against its own reference; new water projected into that **same old extent**; and new water against its returned extent. Projection uses geographic cell centres and nearest game cell, wrapping the dateline; outside the new crop is dry/lost. Changing scale/centre cannot erase water from the fixed denominator. Reference coverage below 95%, or fewer than three observed tile-equivalents, gives n/a rather than 0% or 100%. Native-water absence does not count as perfect preservation. The run also reports deliberately designed drainage targets separately when there is no observed signature. Threshold sensitivity and sub-tile channel continuity remain limitations.

Raw `*-reference.json` files retain both reference arrays and the new wet indices, so measurements can be recalculated. Previous `.timber` wet masks and hashes are in `before-water/`. Comparison PNGs show the unchanged previous preview, new preview, and new frame's independent classified-water mask; labels disclose scale/size. They include every place named in the follow-up plus examples of canyons and lake districts.

Timings are worker conversion times, including terrain/reference reads, plans, starts, simulation and export/reload. Survey-only baseline-reference measurement happens afterwards and is excluded from completed conversions. Browser tile cache and the local proxy's disk range cache are shared across requests. Report medians, p90 and maxima; paired added time includes different cache/network conditions. The final matrix runs serially, but other desktop workloads are uncontrolled, so these are indicative desktop timings, not a production SLA. No game was launched, and no game saves/settings/mods were touched.

After Milford's 256² request took 842.6 seconds, the benchmark gained a tested 15-minute deadline for each worker request, including separate reference-only measurement requests. Its existing Cancel handler terminates an overrun; a timeout is a failed request with unknown water preservation, not a guessed result. Error timings use elapsed request time, including any comparison work before the error, and timeout durations are lower bounds on completion time. The browser was restarted with `RESUME=1`: 77 completed results were retained (all below the deadline), and one in-flight request, Lauterbrunnen 256², was discarded and restarted. Generation stayed at `signature-water-v4`; only benchmark supervision changed. The discarded partial execution is not included in that case's reported time. `results-signature/resume-note.json` records this interruption. Resume loads completed case files and does not selectively rerun failures.

The old Terrain Tiles limitations remain, including the independently verified zero-tile seam near Taveuni (`results/dateline-check.json`). Water preservation does not repair faulty elevation. The reference lookup currently uses the frame's corner tiles. That covers this survey's frames, but a very wide frame near the 85° latitude limit can cross an intermediate 3° tile column; full intersected-tile enumeration is needed before general release. Missing coverage remains unknown. The elevation mosaic and 2021 water classification also have different dates and effective resolutions. This is an openly attributed game interpretation, not a hydrological reconstruction.
