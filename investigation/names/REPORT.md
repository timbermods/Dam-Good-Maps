# Names and descriptions report

## Scope and decision

This branch adds the M9 naming vocabulary and text rules under investigation/names/ only. It does not change src, tests, tools, the root package files, docs, CI, or configuration.

The output covers the vocabulary, forbidden phrases, name patterns, descriptions, and usage rules. The name itself must point to a measured feature. Selection is deterministic by rule priority and specificity, with a stable rule-id tie-break. PLAN §13 mentions a seeded tie-break; the task says names must never be random, so the fact-based deterministic rule takes precedence.

Descriptions use one or two short sentences: first the visible structure, then its play consequence. They avoid repeating the name as a second fact and use no unsupported claims about power, safety, or water storage.

## Read and used

- CLAUDE.md writing rules: short plain player text, one idea per sentence, say each thing once, and check facts against code.
- PLAN.md §8, §13, and §20: theme premises, feature-grounded templates, the M9 word catalogue, and the maps-created-not-copied principle.
- ROADMAP.md M9: the 24 built-theme premises, the 16 plain-word catalogue patterns, and its example names.
- investigation/WORKSHOP.md: pattern descriptions and referenced map titles. The catalogue is used to identify concepts and collision phrases, never as a map template.
- src/core/features/schema.ts: rivers, lakes and islands, landforms, set pieces, forests, berry patches, ruin fields, map objects, and the start.
- src/core/analysis/metrics.ts: relief, flatness, river shape, flow, basins, lakes, falls, dam potential, start bench, resources, ruins, and threats.
- src/core/analysis/damsites.ts, regions.ts, and walk.ts: measured dam length/volume, connected regions, and start-relative reach.
- src/core/validate/playability.ts: settled water, clean and badwater distances, start reach, contamination, and drought-reserve analysis.

docs/m9-design.md and investigation/mechanics/ do not exist on dev, so no claims depend on them.

## Vocabulary choices

Every lexicon word has a required selector. Direct features gate words such as gorge, mesa, spring, and island. Metrics gate qualities such as high, low, twisting, straight, dry, lush, harsh, gentle, clean, tainted, crowded, and open. The woodland terms require actual tree counts; dam and lodge terms require a dam site or a measured start bench.

Thresholds such as dry at waterShare ≤ 0.08 and livingShare ≤ 0.35, lush at treesPer10k ≥ 1,200 and livingShare ≥ 0.75, and twisting at meander ≥ 0.08 and sinuosity ≥ 1.2 are initial gates. M9 should compare these breakpoints with calibration and hand-checked maps before code integration.

Premise-specific words use exact feature roles, for example premise/oxbow-lake and premise/concentric-rings. A role is valid only when the built geometry meets the premise's actual shape definition. If a builder or analyzer cannot prove that shape, the pattern stays unavailable.

## Forbidden phrases

forbidden.json includes the 19 official map names and nine calibrated Workshop map names in investigation/calibration.json, plus every named Steam map linked in investigation/WORKSHOP.md. It also blocks a curated set of well-known real places. This avoids copying a known title while preserving generic feature words.

The repository does not include an exhaustive list of all Workshop map titles or all real place names. The file records its coverage plainly. Before names ship, extend the title list from the complete catalogue; the rule remains exact-title or full-phrase matching so generic words such as canyon, lake, or falls stay usable.

## Product rules

- Name maps from the strongest supported feature, not from a theme label, seed, or random adjective.
- Use the most specific eligible feature rule first. If its title is forbidden or collides within the candidate batch, try another supported feature.
- Keep descriptions about what the terrain does and where the player must build, cross, store water, or manage a threat.
- Do not reuse workshop layouts as recipes. The catalogue supplies vocabulary and play patterns; the map must still be composed from its own detected features.
- Keep version, seed, and settings metadata outside this short description, as PLAN §13 specifies.
