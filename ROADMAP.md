# Dam Good Maps roadmap

One milestone order for both plans: the generator website ([PLAN.md](PLAN.md)) and the map editor
with Claude integration ([EDITOR_PLAN.md](EDITOR_PLAN.md)). It came out of the plan audit of
2026-09-23 ([AUDIT.md](AUDIT.md)). Where either plan's own milestone list orders things
differently, this file wins.

**How the order was chosen**
- **Shared foundations first, built once.** These are the map spec, parametric features,
  set-piece builders, stable ids, validation, format I/O, determinism and the build pipeline, all
  defined in [PLAN.md §19](PLAN.md#19-shared-foundations-with-the-editor). The 3D renderer, the
  set pieces and validation were each planned twice (once in each plan). Each is now one milestone
  that serves both halves.
- **Editor-ready from the first milestone.** M1 already generates maps *from* parametric features
  and offers them as a project file, so the editor, when it arrives, opens maps whose rivers,
  plateaus and ruin fields are grabbable. No generator code is retrofitted later.
- **Every milestone ends with its acceptance criteria met and its tests green.** Milestones marked
  **in-game check** stop until Kyler has played the listed files (checklist in PLAN.md §18). The
  game is the final judge.
- **Effort** is the recommended Claude effort level for building the milestone: **xhigh** for
  architecture-setting or algorithm-heavy work, **high** for the rest.

## Overview

| # | Milestone | From | In-game check | Effort |
|---|---|---|---|---|
| M1 | Shared core and end-to-end slice | PLAN §2–4, §5.1, §7, §11.1–11.2, §14.1, §14.4, §19 · EDITOR §11 | yes (A, F2) | xhigh |
| M2 | Water, playability and validation profiles | PLAN §10, §11.3–11.6, §14.2–14.3, §19.5, §19.7 | yes (B) | xhigh |
| M3 | Map document and operations engine (headless), delivery spike | EDITOR §3, §7 (spike), E1 · PLAN §19.4, §19.6 | no | xhigh |
| M4 | Shared 3D view and editor shell | EDITOR §4, §8, E2 · PLAN §14.2 (3D) | no | high |
| M5 | Set pieces, land and water tools, slopes, fixes | PLAN §7.3, §7.5, §9.1–9.3, §9.5, §9.9–9.10, §19.3 · EDITOR §3, §4, §6, E3 | yes (C, F1, edited maps) | xhigh |
| M6 | Full settings, sharing, themes I | PLAN §5, §6, §8 (Canyon, Lake Basin), §9.5, §14.5 | yes (short) | high |
| M7 | Resources, map objects, themes II | PLAN §5.7, §8 (Highlands, Delta, Islands), §9.4, §9.6–9.8 · EDITOR §4, E4 | yes (D) | high |
| M8 | Water preview and background validation in the editor | EDITOR §6, E5 · PLAN §10, §19.7 | yes (preview vs game, F3, F4) | xhigh |
| M9 | Interestingness, names, candidates | PLAN §7.9, §12, §13 | no | high |
| M10 | Sculpting, naturalize, symmetry | EDITOR §5, E6 | no | high |
| M11 | Stamps, heightmap import, regenerate area, locks | EDITOR §3 (conflict rules), §5, E7 | no | high |
| M12 | Claude integration | EDITOR §7, §9 (Claude suite), E8 · PLAN §19.9 | yes (the waterfall request) | xhigh |
| M13 | Usability, design pass, ratings, versioned deploys | EDITOR §9, E9 · PLAN §2.3, §14, §15, old milestone 6 | yes (full journey) | high |
| Later | See the end of this file | PLAN §5.7, old milestone 7 · EDITOR §10 Later | per item | — |

**Release points** (suggested):
- after M2: a public generator beta (River Valley, validated water);
- after M6–M7: all themes;
- after M8: the editor;
- after M12: Claude.

M9 depends only on M2 and can run alongside M8. M10 and M11 can swap places.

---

## M1. Shared core and end-to-end slice

The smallest slice that goes settings → generate → preview → download of a valid map, built on the
shared core, so its maps are editor-ready.

**Delivers**
- Vite + TypeScript + Preact app shell, GitHub Pages deploy from Actions. Data (footprints,
  calibration) is bundled, not fetched, and workers can be inlined, so the artifact build (M12)
  stays possible.
- `core/spec`: `MapSpec` v1 schema, defaults and URL codec for seed, size preset, difficulty and
  theme (River Valley only) (PLAN §19.1).
- `core/features`: the feature schema v1 (PLAN §19.2) for `river` (with bed profile), `lake`
  (planned basins), `landform` (valley floor, terrace bands, highlands), `setPiece`, `forest`,
  `berryPatch`, `ruinField` and `start`.
  - `setPiece` covers the dam site and the on-river waterfall, in the generation context only,
    as the prototype builds them.
  - Rasterizers and the build pipeline steps 1–5, 7–9, 11–12 and 14 (PLAN §19.8).
  - Stable ids (§19.4) and per-feature RNG streams (§19.7).
- River Valley ported from the prototype as a *feature planner*: it emits the feature list, then
  builds with the shared pipeline.
  - No water simulation yet. Sources are placed with sealed mouths (PLAN §7.6), and water is left
    as zeros in the file.
  - Moisture for tree placement comes from the exact moisture rule applied to the planned water
    (a priority-flood estimate), which M2 replaces with the simulation.
- `core/format`:
  - writer and reader (1.1 native writer; reader for 1.0/1.1 voxel maps);
  - C#-style floats, fflate with fixed mtimes, footprints, jpeg-js thumbnail.
- Validation modules with classes and profiles in place: the load class (PLAN §11.1–11.2) and
  the design class (`terrain.max_height`, `terrain.single_floor`), in the `generate` profile
  (§19.5).
- 2D preview (terrain, start, entities, feature outlines with hover labels).
- Download of the `.timber` and of the project file (`.damgoodmaps.json`: spec, features and built
  base).
- `prototype/calibrated.py` aligned with PLAN §5.2 and §5.6 (§4, decision D9).

**Acceptance**
- 50 seeds × 3 sizes pass the Python `validate.py` load checks and `roundtrip_test.py`.
- Identical sha256 in Node and Chromium for 10 seeds.
- Rebuilding from the downloaded project file reproduces the `.timber` byte for byte.
- Removing one ruin field from a document and rebuilding leaves every other feature and entity id
  unchanged.
- 128² generates in < 3 s.
- The contract tests of PLAN §15 that apply (schema, feature round trip, build equality) are
  green.

**In-game check:** A (PLAN §18): load, start, walk test, open in the in-game editor, an Iron
Teeth start. Add F2: sealed river mouth.

**Effort:** xhigh.

---

## M2. Water, playability and validation profiles

**Delivers**
- `sim/*`: the exact single-layer water port with golden vectors from the Python prototype.
  - Exact active list, recomputed per substep.
  - The deterministic priority-flood and analytic river pre-fill for the canonical settle.
  - The canonical settle for files (PLAN §19.7).
- Moisture and soil contamination at steady state; pre-filled water, moisture and contamination
  in the file; vegetation placed from simulated moisture.
- All playability checks (PLAN §11.3–11.4), plus the new advisory `plants.drought` check.
- The full check-result shape: class, severity, where, fix.
- The `export` and `import` profiles.
- The TypeScript validator handles every emitter and blocker by its footprint (PLAN §11.5).
- The retry loop; the map card with the validation report; water, moisture and reach layers.
- The water benchmark that fixes the budget in PLAN §10 (target ≤ 3 s for the canonical settle at 256²).

**Acceptance**
- Golden vectors pass, and the game's own save is reproduced within 0.001.
- The Python and TypeScript validators agree check by check on 50 generated maps and on all 19
  official maps (import profile).
- Batch of 100 seeds at 128² Normal: final pass ≥ 98%, first attempt ≥ 60%.
- The 256² settle time is measured, and the budget is recorded in PLAN §10 and "Editor
  decisions".

**In-game check:** B (PLAN §18): pre-filled water, tree survival, the empty-water A/B file.

**Effort:** xhigh.

---

## M3. Map document and operations engine (headless), delivery spike

**Delivers**
- `core/doc`: `MapDocument` (EDITOR §3), operations with undo data, undo and redo with
  snapshots, orphan detection.
- Incremental rebuild over dirty regions, checked against a full rebuild.
- Project files that store the generator version and the built base (PLAN §19.6).
- Regeneration with constraints: user features, locks and keep-out regions go into the
  generator's planner (PLAN §7.0), and the conflict rules apply.
- Import of any map, with normalization (PLAN §19.6):
  - 0.6 `Heights`, 0.7, 1.0 and 1.1;
  - `WaterSimulationMigrator` halving;
  - 4-field water;
  - truncation of maps with more than 23 layers;
  - preservation of unknown components;
  - flags for faction-only plants.
- **Delivery spike** (EDITOR §7). A published test artifact checks:
  - a blob Web Worker;
  - reading a local `.timber` from a file input;
  - `downloads.save` of a `.zip`;
  - `sample` with tools on the quick and default tiers, with latency;
  - who can open it on Kyler's plan.

  A test page checks a direct browser call to the Messages API with CORS. The results go to
  "Editor decisions" (D8, D10).

**Acceptance**
- The E1 property tests pass on generated maps of every size preset:
  - random operations, then export, re-import and compare;
  - undo all;
  - incremental equals full.
- Every voxel-format investigation map imports and re-exports its normalized world byte for byte.
- The two 0.6 maps import.
- Generate, add a user feature, change a setting, regenerate: the user feature survives and
  nothing is silently dropped.
- The spike report answers each open question with evidence.

**In-game check:** no. Import normalization is checked in game at M8 (F3).

**Effort:** xhigh.

---

## M4. Shared 3D view and editor shell

**Delivers**
- `render3d`, used by the generator preview (its 3D toggle, from old PLAN milestone 6) and by
  the editor:
  - chunked 32×32 meshing with dirty-chunk remesh;
  - a voxel mesher only for multi-run columns;
  - instanced trees, bushes and ruins;
  - water surfaces;
  - heightfield picking.
- The editor shell:
  - "Refine this map" / "Back to settings";
  - import of any `.timber`;
  - orbit and top-down views;
  - hover readout;
  - feature selection with move and delete handles;
  - the four tabs;
  - history panel;
  - export from every screen (`export` profile);
  - autosave through the storage adapter.

**Acceptance**
- Every investigation map imports, renders and exports unchanged.
- The 3D view builds in < 1.5 s at 256² and orbits at 60 fps on a mid-range laptop.
- Generate → refine → back to settings → regenerate → refine keeps user edits.

**In-game check:** no.

**Effort:** high.

---

## M5. Set pieces, land and water tools, slopes, fixes

Set pieces are built once here and used by the generator (River Valley premises) and the editor
alike. This takes the set-piece half of old PLAN milestone 3 and all of E3.

**Delivers**
- The shared set-piece builders (PLAN §19.3), each with `limits`, `plan` and `rasterize`, and
  reports of every reduction:
  - waterfall, in on-river and standalone modes, with the header pool;
  - dam site;
  - gorge;
  - terraced cliffs;
  - badwater basin.

  The ranges are those of PLAN §9.10.
- The generator's River Valley premises switch to these builders.
- Editor tools:
  - landforms with edge styles;
  - rivers with sealed mouths, bed profiles and flow presets;
  - lakes by basin and outlet sill;
  - set pieces with handles;
  - the start with footprint and entrance preview;
  - the dam-site layer.
- Slopes derived automatically after every terrain change, with pin and remove overrides (moved
  here from E4).
- Instant validation on dirty regions, with one-click fixes.

**Acceptance**
- Feature property tests pass; drawn rivers always drain and keep their water.
- Set-piece range tests pass:
  - a 20-wide waterfall fits on 96², 128² and 256²;
  - on 48² it is reduced to 19, with a report;
  - drops above 15 are reduced;
  - lip width is measured as defined in PLAN §9.2.
- Generator batches for River Valley stay ≥ 98% final pass with the new builders.

**In-game check:** C and F1 (PLAN §18). Export three edited maps and play them:
- a 20-wide standalone waterfall at S = 2 and at S = 8, to judge visibility and whether a water
  wheel turns;
- a dam site: build the dam and check the basin fills without leaking;
- a gorge with a stair notch.

**Effort:** xhigh.

---

## M6. Full settings, sharing, themes I

**Delivers**
- The full settings panel (PLAN §5), with reference bands and the feasibility guards: drought
  reserve against map size (§5.3), and waterfall and set-piece limits.
- The URL codec for the full `MapSpec`, and share links (spec only, decision D7).
- Canyon and Lake Basin as feature planners; the badwater settings (§5.4), placing the badwater
  basin builder from M5 (§9.5).

**Acceptance**
- Each setting moves its measured target in batch runs (a test per setting).
- Share links reproduce byte-identical files.
- Batch per theme ≥ 98% final pass.

**In-game check:** short. One Canyon and one Lake Basin map load, and their dam site holds.

**Effort:** high.

---

## M7. Resources, map objects, themes II

This combines old PLAN milestone 5 and E4.

**Delivers**
- Editor resources: forests, berry patches and ruin fields as areas, with a survival preview.
- Editor map objects:
  - mine sites (UndergroundRuins), relics and geothermal fields;
  - thorn belts, weirs (NaturalDam) and plugs (Blockage), and the plugged spillway;
  - the badwater toggle with its warnings.
- Advanced mode: individual entity placement with footprint preview, and numeric fields,
  including delayed sources.
- Generator: Highlands, Delta and Islands; the second district; obstacles with payoff; NaturalDam
  weirs; plugged spillways; thorn belts; relics; geothermal fields; mine sites.

**Acceptance**
- Resource areas respect moisture reach and the calibrated clustering.
- Invalid placements are previewed and refused.
- Every new object passes the placement emulation.
- Batch per theme ≥ 98%.

**In-game check:** D (PLAN §18). The objects load with no loading issues, and demolishing a
spillway plug releases the water.

**Effort:** high.

---

## M8. Water preview and background validation in the editor

**Delivers**
- The worker simulation with warm-start re-settling after edits.
- Detection of roofed water: the file's water is kept there, with a "preview approximate"
  overlay.
- Background full validation, debounced and cancellable.
- Export rules for errors and warnings; the canonical settle on export, with progress.
- Moisture and badwater overlays; the analytic drought view.

**Acceptance**
- Validation parity between editor and generator.
- A local edit re-previews in ≤ 2 s at 256².
- The export of an unedited generated map equals the generator's own file byte for byte.

**In-game check:** compare the preview with the game on three edited maps, including one
imported official map with roofed water (F4) and one pre-1.0 workshop map (F3). Record the
differences in "Editor decisions".

**Effort:** xhigh.

---

## M9. Interestingness, names, candidates

**Delivers:** old PLAN milestone 4.
- `score.ts` calibrated on the official maps.
- K = 3 candidates with progressive preview (K = 1 at 256² if the M2 benchmark requires it).
- Names and premises built from the features.
- The score on the map card.

**Acceptance**
- The official score distribution is documented, and the recommended official maps land in the
  top third.
- Names and premises match the features on 30 hand-checked maps.
- 256² with K = 3 takes ≤ 20 s, or K = 1 is recorded.

**In-game check:** no.

**Effort:** high.

---

## M10. Sculpting, naturalize, symmetry

**Delivers:** E6.
- Advanced sculpt brushes and the naturalize brush.
- Symmetry across all tools:
  - mirror on any map, rotation-4 on square maps;
  - entity orientation remapping;
  - one start kept.

**Acceptance**
- The performance budgets of EDITOR §9 are met.
- Caves and overhangs in imported maps survive edits elsewhere, and terrain support is re-checked.
- Symmetric edits stay exactly symmetric, entities included.

**In-game check:** no.

**Effort:** high.

---

## M11. Stamps, heightmap import, regenerate area, locks

**Delivers:** E7.
- The built-in stamp library, and user stamps with export and import (the entity transform rules
  of EDITOR §5).
- Heightmap import scaled to 0–16.
- Regenerate an area, with constraints.
- Locks and the conflict rules.

**Acceptance**
- Hand edits survive regeneration per the conflict rules.
- Stamps round-trip through export and import.
- A rotated or mirrored stamp passes the load checks.

**In-game check:** no.

**Effort:** high.

---

## M12. Claude integration

**Delivers:** E8, with the delivery choices from the M3 spike.
- The operation schema and a feature-level map summary (at most about 16 KB).
- The tools: `resolve_region`, `find_sites`, `measure`, `list_features`, `limits`, `dry_run`,
  `propose`.
- The size-word resolver on top of PLAN §9.10.
- Intent checks, and the loop capped at 3 rounds.
- The Messages API adapter (bring-your-own-key, strict tools, prompt caching, configurable model).
- The artifact edition: a single-file build declaring `sample` and `downloads` only, and a `.zip`
  download.
- The Claude request suite running in Node.

**Acceptance**
- Malformed or out-of-bounds proposals are rejected cleanly.
- Accepted proposals undo like normal edits.
- The request suite passes on 96², 128² and 256² maps, including the 20-block waterfall (with the
  reported reduction on 48²).
- Results stay editable by hand, and follow-ups modify the right feature.
- The artifact edition passes a manual smoke test on the same requests.

**In-game check:** play the map produced by "add a giant waterfall in the north part of the map
that is roughly 20 blocks wide".

**Effort:** xhigh.

---

## M13. Usability, design pass, ratings, versioned deploys

**Delivers**
- E9: the usability tasks, onboarding hints, shortcuts reference, help page, accessibility pass
  and final performance pass.
- The rest of old PLAN milestone 6:
  - the Impeccable design pass with the timbermods design system;
  - the ratings flow and `tools/ratings.ts`;
  - install help, including the extract step of the artifact edition;
  - mobile layout;
  - versioned deploys at `/v/<version>/`.

**Acceptance**
- Every usability task is done in under 2 minutes by a first-time user, and the full journey in
  under 10.
- Lighthouse performance is ≥ 90 on desktop.
- A rating issue is created from the page with every field filled.
- An old-version link reproduces its file.

**In-game check:** yes, the full journey of EDITOR §9 task 7: generate, refine, ask Claude,
export, load in Timberborn.

**Effort:** high.

---

## Later

Each item stays behind a feature flag until its own in-game check passes:
- caves and tunnels, with stacked-column water and voxel-level editing tools;
- NaturalOverhang bridges;
- seeps and an arid theme;
- aquifers;
- badtide drains;
- unstable cores out of Advanced;
- terrain 17–22, if PLAN §18 E1 allows it;
- "make editable" detection for imported maps;
- share links that carry small edit lists;
- a shared online stamp gallery;
- tablet and touch support.
