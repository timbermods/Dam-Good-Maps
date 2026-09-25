# Proposals for M9 and M11

## M9 design

Read [REPORT.md](REPORT.md), then [METHODS.md](METHODS.md). Use `data/targets.json` to choose ranges for processes. Select a size, scale, mapping and landscape family explicitly. Check the random-land cohort alongside the named examples. Preserve the measured spread instead of aiming every map at a median.

Run the [bench](bench/README.md) on each prototype in `investigation/generative/`. Compare network, relief, water and naturalness separately. Inspect failures and previews. Keep the existing validators, variety checks, opening diversity, performance budgets and Kyler's blind ratings as separate gates.

Match border conventions. Supply terrain before an added artificial wall as `referenceHeights`, while retaining playable `heights` for water and validation. Report both when border geometry is part of the design. The edge-sensitivity table shows that sealing changes straight runs enough to reverse the longest-run comparison.

Use [FAMILIES.md](FAMILIES.md) to connect process ideas to play. The listed processes are geological explanations, not generator implementations. In particular, branch-and-merge behaviour needs evidence beyond a single-receiver DEM drainage graph.

Use the library for regression tests and to understand quantisation failure. Do not read its height arrays inside a generator. Do not choose the closest real patch as a seed, layout, stencil or generation objective. The bench compares aggregate measures, not map identity.

## Proposed PLAN.md changes

- Product principles and §20 D108: add this survey as process evidence. State that both real patches and workshop maps remain outside the generator's template inputs.
- §5.2 and §7.4: link stratified relief, slope and level-step distributions. Keep the 16-level cap. Do not replace player settings with raw metre units.
- §7.2 and §7.6: require reporting drainage branching and bends. Keep sealed entries, actual outlet sills and canonical settling. Call inferred springs and discharge game choices.
- §9: use valley sections, falling-water statistics and the existing dam-site search as evidence for where terrain offers play. Measure water surfaces from the simulation floor; a Blockage can raise it above the terrain array. Do not place one required landmark in every map.
- §11: retain every hard check. Record advisory drought and access failures in batch reports. Do not turn survey proximity into a validator.
- §20: record any adopted target ranges and their chosen strata, after the M9 design decision. No decision is made by this branch.

## Proposed ROADMAP.md changes

- M9 design: add a bench report for every prototype batch, including named and random reference cohorts, failed conversions and missing measurements.
- Refinement: compare straight runs, ridge thickness and rim variation with the real-terrain bands as another reference. Keep official-map and workshop evidence visible. Naturalness remains one measure, not a substitute for play variety.
- M11: consider an explicit “real place” heightmap import. Show coordinates, scale, vertical mapping, source inference, modifications and attribution. Revalidate after import and edits. The fixture library is optional input for that importer, not for automatic generation.

## Decisions that need care

**D108 and D109:** a real-place import is different from the generator's promise to create new maps. It needs an explicit product decision and must stay in the import flow. This proposal does not approve M9, M10 or M11.

**D4, D35 and the height cap:** the 22-level cases are comparisons only. None enters the curated library or the default bench target.

**D85, D97 and D104:** water still needs same-level access. Trees and bushes must survive and be within 20 tiles' walk. No threshold is relaxed to improve the survey's pass rate.

**D27 and D107:** the canonical settle and dry start ring remain unchanged. Failed settling is excluded from water targets, and the Beaverome start-ring question is not resolved here.

**D15:** these analysis scripts use logarithms, geographic projection and statistics. They are offline tools. Copying their arithmetic into generation would require the generator's deterministic arithmetic rules.

Every item above is a proposal. This branch changes no file outside `investigation/landscapes/`.
