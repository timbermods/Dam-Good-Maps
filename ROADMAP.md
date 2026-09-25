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
- **Every milestone ends with its acceptance criteria met and its tests green.**
- **In-game checks are deferred** (PLAN §20, D11). Kyler is skipping them for now. A milestone
  marked **in-game check** does not stop or wait: it lists the checks it would have needed in
  [docs/ingame-log.md](docs/ingame-log.md) as *pending*, with the files to play, and relies on the
  automated validation and tests. The game stays the final judge once the checks are played.
- **Effort** is the recommended Claude effort level for building the milestone: **xhigh** for
  architecture-setting or algorithm-heavy work, **high** for the rest.

## Overview

| # | Milestone | From | In-game check (logged as pending, D11) | Effort |
|---|---|---|---|---|
| M1 | Shared core and end-to-end slice | PLAN §2–4, §5.1, §7, §11.1–11.2, §14.1, §14.4, §19 · EDITOR §11 | yes (A, F2) | xhigh |
| M2 | Water, playability and validation profiles | PLAN §10, §11.3–11.6, §14.2–14.3, §19.5, §19.7 | yes (B) | xhigh |
| M3 | Map document and operations engine (headless), delivery spike | EDITOR §3, §7 (spike), E1 · PLAN §19.4, §19.6 | no | xhigh |
| M4 | Shared 3D view and editor shell | EDITOR §4, §8, E2 · PLAN §14.2 (3D) | no | high |
| M5 | Set pieces, land and water tools, slopes, fixes | PLAN §7.3, §7.5, §9.1–9.3, §9.5, §9.9–9.10, §19.3 · EDITOR §3, §4, §6, E3 | yes (C, F1, edited maps) | xhigh |
| M6 | Full settings, sharing, themes I | PLAN §5, §6, §8 (Canyon, Lake Basin), §9.5, §14.5 | yes (short) | high |
| M7 | Resources, map objects, themes II | PLAN §5.7, §8 (Highlands, Delta, Islands), §9.4, §9.6–9.8 · EDITOR §4, E4 | yes (D) | high |
| M8 | Water preview and background validation in the editor; start requirements first | EDITOR §6, E5 · PLAN §5.6, §10, §11.4, §19.7 | yes (preview vs game, F3, F4) | xhigh |
| Look | Map look, after M8, before M9 | Kyler's plan (PLAN §20, D86) · EDITOR §8 · PLAN §14.2 (3D) | no (Kyler's reference screenshot) | high |
| M9 | Interestingness, names, candidates, premises and variety | PLAN §7.1, §7.9, §8, §12, §13 · the workshop study (D87) · EDITOR §7 words (D84) | no | xhigh |
| M10 | Sculpting, naturalize, symmetry | EDITOR §5, E6 | no | high |
| M11 | Stamps, heightmap import, regenerate area, locks | EDITOR §3 (conflict rules), §5, E7 | no | high |
| Refine | Refinement phase, after M11, before the design pass | Kyler's refinement notes · decisions-pending #2, #12, #13, #21, #29 | short (a dam at a new narrows holds) | xhigh |
| Design | Design pass, after M11 and the refinement phase | the impeccable-app-flow skill (timbermods/.github, `claude-skills/`) · old milestone 6 | no | high |
| M12 | Claude integration | EDITOR §7, §9 (Claude suite), E8 · PLAN §19.9 · the Claude groundwork (D88) · the workshop study (D87) | yes (the waterfall and compound requests) | xhigh |
| M13 | Usability, ratings, versioned deploys | EDITOR §9, E9 · PLAN §2.3, §14, §15, old milestone 6 | yes (full journey) | high |
| Later | See the end of this file | PLAN §5.7, old milestone 7 · EDITOR §10 Later | per item | — |

**Release points** (suggested):
- after M2: a public generator beta (River Valley, validated water);
- after M6–M7: all themes;
- after M8: the editor, with the new start requirements;
- Map look: inside the M9 release, or tagged `map-look-done` and released like a milestone;
- the refinement phase and the design pass: tagged `design-done`;
- after M12: Claude.

M9 depends only on M2 and can run alongside M8. M10 and M11 can swap places.

**Investigations adopted after M7.** Their items are built in the milestones below, each marked
with its source:
- **The workshop study** (PLAN §20, D87): [investigation/WORKSHOP-INTEGRATION.md](investigation/WORKSHOP-INTEGRATION.md),
  with the findings in [WORKSHOP.md](investigation/WORKSHOP.md), the numbers in
  [workshop.json](investigation/workshop.json) and the tools, recipes and parameters in
  [investigation/workshop/](investigation/workshop/). Port only what a milestone needs, into
  `src/` or `tools/`, with tests: `lib/measures.ts` (mechanics flags, start quantities, score
  inputs), `lib/naturalness.ts`, `lib/variety.ts`, `lib/score.ts` and `obviousness.ts`. The recipes
  are reference implementations for the premises, builders and stamps, not code to ship as they
  are. Other creators' maps, renders and per-map numbers stay in `C:\dgm-workshop`; never commit
  them. Its decisions W1–W8 are decisions-pending #31–#38 (Kyler decided W4, #34, in D85),
  and its conflicts with recorded decisions #39 (decided by Kyler in D85) and #40.
- **The Claude groundwork** (PLAN §20, D88–D96):
  [investigation/claude/M12-INTEGRATION.md](investigation/claude/M12-INTEGRATION.md), with the
  report in [REPORT.md](investigation/claude/REPORT.md) and the self-played pilot in
  [pilot/PILOT.md](investigation/claude/pilot/PILOT.md). M9 builds its vocabularies (places and
  words) and M12 the rest; each milestone below lists the files that move into `src/` and
  `tests/`. Its numbers come from a self-played pilot, not from a model: re-measure them with the
  real suite before fixing them in the plan. Its pending decisions P3–P7 are decisions-pending
  #41–#45 (P1 is settled by D84, P2 is #28), and its conflicts with recorded decisions #42, #46
  and #47.

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
Teeth start. Add F2: sealed river mouth. Deferred (D11): logged as pending in
[docs/ingame-log.md](docs/ingame-log.md) with the files to play.

**Effort:** xhigh.

**Status:** done, 2026-09-24, on branch `m1-core`. Every acceptance criterion passes:
- the Python oracle: 150/150 maps;
- Node = Chromium on 10 seeds;
- the project rebuild and the id stability tests;
- 128² in 85 ms median;
- the contract tests.

The deviations are PLAN §20 D15–D23. In-game checks A1–A5 and F2 are pending.

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

**Status:** done, 2026-09-24, on branch `dev` (generator 0.2.0). Every acceptance criterion passes:
- golden vectors: the port matches the Python reference bit for bit on 12 fixtures, and 975 ticks
  from empty reproduce the game's own save within 0.001 (0.00096, the same 470 wet tiles);
- validator parity: 0 disagreements on 50 generated maps and on all 19 official maps;
- batch at 128² Normal: 96% on the first attempt, 100% final (100 seeds);
- the canonical settle: a median of 0.39 s at 256² and 0.07 s at 128²; the budget (≤ 3 s at 256²,
  ≤ 0.6 s at 128²) is in PLAN §10 and D33.

The deviations are PLAN §20 D24–D34. In-game checks B1–B4 are pending.

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

**Status:** done, 2026-09-24, on branch `dev` (the generator stays 0.2.0). Every acceptance
criterion passes:
- the E1 property tests on 96², 128², 192² and 256², covering all 12 kinds of edit:
  - the incremental rebuild equals a full rebuild after every step, undo and redo included;
  - export, re-import and export again gives the same bytes;
  - undoing everything gives back the generator's own file;
- all 30 voxel-format investigation maps re-export their normalized world byte for byte, and the
  two 0.6 maps import;
- regeneration keeps the player's features and flags every edit that no longer applies, with
  its reason;
- the spike report answers the open questions with evidence.

Two spike questions need Kyler's own run of the published page: `sample`'s latency with tools,
and who can open the artifact. The deviations are PLAN §20 D35–D41, and D8 and D10 are updated.

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

**Status:** done, 2026-09-24, on branch `dev` (the generator stays 0.2.0). Every acceptance
criterion passes:
- all 32 investigation maps open through the page, draw in the 3D view and export unchanged,
  byte for byte;
- the 3D view builds a 256² map in at most 445 ms and orbits at the display's rate, with 0 of
  46,631 frames longer than 1/60 s. This machine is a high-end desktop, not a mid-range laptop, so
  the budget was judged on its integrated GPU with the CPU slowed 4× on a laptop-sized screen
  (D46);
- generate → refine → back to settings → regenerate → refine keeps the player's edits, tested
  through the page.

The deviations are PLAN §20 D42–D46.

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

**Status:** done, 2026-09-24, on branch `dev` (generator 0.3.0). Every acceptance criterion
passes:
- the feature property tests pass on all four size presets with the new tools among the random
  edits, and rivers drawn in random directions on 96², 128² and 256² maps all drain, carry water
  along their whole course and keep their mouths sealed;
- a 20-wide waterfall keeps all 20 lip tiles wet on 96², 128² and 256², 0.03 deep at 2 water/s;
  on 48² it is reduced to 19, with a report; drops above 15 are reduced to 15; the lip width is
  measured as PLAN §9.2 defines it;
- River Valley's batches stay at 100% final with the builders: 100 seeds each at 96², 128², 192²
  and 256².

The in-game checks C and F1 are skipped for now (D11): the files are in `out/m5/`, and the checks
are pending in [docs/ingame-log.md](docs/ingame-log.md). The deviations are PLAN §20 D47–D56.

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

**Status:** done, 2026-09-24, on branch `dev` (generator 0.4.0). Every acceptance criterion
passes:
- each of the 27 settings experiments moves its measured target (`tests/contract/settings.test.ts`,
  and `tools/settings-batch.ts` on 20 seeds at 96² and 10 at 128²); at 192² all but Buildable
  land's flat share do (it moves 0.029, walkable land moves 15,606 tiles);
- share links reproduce the same bytes in Node and through the page in Chromium, in all three
  themes;
- 100 seeds per theme at 96², 128², 192² and 256² pass 100% final (River Valley, Canyon, Lake
  Basin); Easy and Hard at 128² pass 100% too.

The in-game check is skipped for now (D11): the files are in `out/m6/`, and checks M6-1a to M6-1c
are pending in [docs/ingame-log.md](docs/ingame-log.md). The deviations are PLAN §20 D57–D68.

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

**Status:** done, 2026-09-24, on branch `dev` (generator 0.5.0). Every acceptance criterion
passes:
- resource areas: a drawn forest plants trees only where its preview showed them alive (moist,
  clean soil), bushes only on moist ground, and ruin areas become fields of one level, 10+ columns,
  in the official shape (`tests/contract/objects.test.ts`, `tests/e2e/objects.spec.ts`);
- invalid placements: the footprint under the pointer is red with the game's reason, and the same
  rule refuses the click, the tools and `placeEntity` (contract and browser tests);
- placement emulation: `entities.placement` and `extras.placement` pass on every generated map of
  the six themes and on the editor's objects; the oracle shows 0 disagreements between the TS and
  Python validators on 50 generated and 19 official maps;
- 100 seeds per theme at 96², 128², 192² and 256² pass 100% final (River Valley, Canyon,
  Highlands, Lake Basin, Delta, Islands); Easy and Hard at 128² pass 100% too.

The in-game check is skipped for now (D11): the file is in `out/m7/`, and checks D1–D5 are pending
in [docs/ingame-log.md](docs/ingame-log.md). The deviations are PLAN §20 D69–D83.

---

## M8. Water preview and background validation in the editor

**Start requirements, built first** (Kyler, 2026-09-24, amended the same day; PLAN §5.6, §11.4,
§20 D85). Released with `m8-done`.

Three start requirements, with thresholds by difficulty (Easy / Normal / Hard). They replace the
start rules as reasons to reject a map:
1. **Water without stairs.** Clean pumpable water (depth ≥ 0.3, contamination < 0.05, as now)
   touches a shore tile at the start's own level, and that shore tile is within 12 / 20 / 28
   tiles' walk of the start without any slope: the same level all the way. Rivers, lakes and ponds
   all count. A pump on that shore must reach the water surface (0–2 levels below), as now, so
   the colony can actually drink it.
2. **Starting trees:** at least 60 / 40 / 20 living trees within 20 tiles' walk of the start
   (slopes allowed), counted across any number of groves.
3. **Starting bushes:** at least 40 / 30 / 20 living berry bushes within 20 tiles' walk of the
   start (slopes allowed), counted across any number of patches.

"Living" means the plant survives at steady state, as now.

- **The thresholds are player settings,** with these defaults for each difficulty: the existing
  water-distance start rule (`sw`, 4–40), and the Advanced start rules controls for trees and
  living bushes within 20, renamed **Minimum starting trees** (`st`, 0–400) and **Minimum
  starting bushes** (`sb`, 0–200). They keep their ranges and share-link keys, so old links still
  decode. Changing **Designed for** resets them to that difficulty's defaults (D66, as before).
  Imported maps, which have no settings, use their difficulty's defaults (Normal unless the
  document says otherwise).
- **The generator never aims below a minimum.** Any target that sits lower rises to it: Easy's
  Berries near start target goes from 20 to 40.
- **The start reaches water on its own level.** The workshop study found none on 82 of 180
  generated maps at 128²: the bench stands one level above the floodplain, 6–10 tiles from the
  channel (D26), and its level region is the bench alone (median 113 tiles; official starts stand
  on level land of median 980 tiles that reaches the water). Move the bench to the bank, or the
  start onto the floodplain (D26 changes). Batches stay ≥ 98% per theme with the new rules.
- **Everything else:** the other start rules stop rejecting maps: the badwater and ruin
  distances, stored drought water near the start (`water.reservoir`, including Hard's 3-deep
  rule) and walkable land from the start (`start.reach`). They stay as settings and generation
  targets: the generator still aims for them, their controls and share-link keys keep working,
  and the map card shows an advisory warning when a map misses one.
- **Badwater distance defaults become 30 / 15 / 8** (the workshop study's W4, decided by Kyler),
  as generation targets with an advisory warning; they never reject a map. The range widens from
  12–60 to 8–60 (the Hazards setting `bd` and the start rule `sx`), so Hard's 8 fits and old
  links still decode.
- **Unchanged:** the load checks the game needs (the start's footprint on flat ground, a free
  entrance, exactly one start), and the water checks that aren't about the start (settling,
  outflow, badwater containment).
- **Build rules:**
  - Change both validators together (TypeScript and the Python oracle), with 0 disagreements.
  - A unit test for each requirement: water reachable only by a slope fails; water beyond the
    walking distance fails; only badwater fails; trees or bushes below the minimum, or too far
    away, fail; changing any of the three settings moves the result.
  - The three settings have a measured target in `tools/settings-suite.ts`, like the M6 settings
    (the water distance's experiment measures the walk on the start's level).
  - The editor's start indicators and its green or red footprint follow the three requirements,
    using the map's settings. The map card lists them.
  - This changes which attempt wins and where the start stands: bump the generator version and
    note that old share links change.
  - Report batch pass rates per theme at the defaults; first-attempt rates should rise.

Its acceptance:
- Both validators apply the three requirements and the advisory targets, with 0 disagreements on
  the full oracle (50 generated and 19 official maps).
- The unit tests above pass, and the three settings move their measured targets.
- Every accepted map's start reaches water on its own level, and batches per theme are ≥ 98%
  final at the defaults (100 seeds at 96², 128², 192² and 256²), with the first-attempt rates per
  theme reported beside M7's.
- The editor's start indicators, its footprint and the map card follow the requirements (a
  browser test).

From the workshop study (D87):
- The data behind the requirements: `workshop.json` `overall.start*`, measured by
  `lib/measures.ts` (`startStats`: walking distance on one level, diagonals when both neighbours
  are level, slopes as links). Kyler took the study's water distances (12 / 20 / 28) and set their
  own tree and bush thresholds; the study proposed 60 / 20 / 10 and 40 / 25 / 15
  (decisions-pending #39, decided).
- Report how many of the 11 official starts the study could measure meet the three requirements
  at Normal.

**Also first: editing generated outlines that leave the map** (decisions-pending #30). Generated
features' outlines may run up to one map side past each edge (the schema's bound since the Lake
Basin reopen fix); they are clipped to the map when rasterized, and the editor can change and
lock them. Today `featureGeometryProblems` (`src/core/doc/ops.ts`) refuses them ("the landform's
outline leaves the map"), so a Lake Basin terrace ring or a highlands landform that reaches past
the edge can't be edited or locked. Outlines the player draws stay inside the map. Acceptance: such
a ring can be edited and locked, and an unedited map's bytes don't change.

**Delivers**
- The worker simulation with warm-start re-settling after edits.
- Detection of roofed water: the file's water is kept there, with a "preview approximate"
  overlay.
- Background full validation, debounced and cancellable.
- Export rules for errors and warnings; the canonical settle on export, with progress.
- Moisture and badwater overlays; the analytic drought view.
- From the workshop study (D87):
  - Maps whose water a steady state cannot show are recognised on import
    (`analysis/mechanics.ts`): caves on 5% or more of tiles, delayed sources, aquifers or seeps
    carrying a quarter or more of the clean water (seeps half of the running water), or a start
    under a roof. Their water and start checks report "approximate" with the reason, in both
    validators, and the preview shows the file's water there (the roofed-water rule already does
    this for caves). Decisions-pending #36 (W6); the rule as written in
    `investigation/workshop/lib/measures.ts` (`mechanics`) and `lib/table.ts` (`waterReliable`).
  - Set pieces and lakes that reshape the ground clear the map objects standing on it, as they
    clear trees, ruins and bushes (`clears`), or the objects move to the new ground and are
    checked again (EDITOR_PLAN §3). The recipes found it: a standalone waterfall or a lake drawn
    beside a relic, a geothermal field or a mine site left the object floating
    (`entities.placement`, `extras.placement`) in 16 attempts over 46 runs of the twin-falls and
    oxbow recipes.

**Acceptance**
- Validation parity between editor and generator.
- A local edit re-previews in ≤ 2 s at 256².
- The export of an unedited generated map equals the generator's own file byte for byte.
- Hollows, Pressure, Oasis and Nomads report their water checks as approximate with a reason; the
  other 15 official maps are unchanged. (Kyler took Beaverome off the list on 2026-09-25, PLAN §20
  D107: its water is modelled correctly and none of the causes applies.)
- A property test places standalone waterfalls, lakes and landforms beside every kind of map
  object on generated maps: no object is left floating.

**In-game check:** compare the preview with the game on three edited maps, including one
imported official map with roofed water (F4) and one pre-1.0 workshop map (F3). Record the
differences in "Editor decisions".

**Effort:** xhigh.

**Status:** done, 2026-09-25, on branch `dev` (generator 0.6.0). Every acceptance criterion passes,
the approximate-water item as amended by Kyler (D107):
- start requirements: both validators apply them, with 0 disagreements on the full oracle (50
  generated and 19 official maps); the unit tests pass and the three settings move their targets;
  every accepted map's start reaches water on its own level, and 100 seeds per theme at 96², 128²,
  192² and 256² pass 100% final, 94–100% on the first attempt; the browser test passes; 5 of the
  11 measurable official starts meet all three at Normal;
- a generated ring past the map edge is edited and locked, and the unedited map's bytes stay;
- validation parity: the editor's verdicts after a warm-started preview equal the generator's
  validator on the exported file;
- a local edit re-previews in at most 1.76 s at 256² (Node, six themes) and 1.66 s in Chrome;
- the export of an unedited generated map equals the generator's file byte for byte;
- the property test leaves no object floating;
- Hollows, Pressure, Oasis and Nomads report approximate water, with the reason, and the other 15
  official maps are unchanged. Beaverome was on the list as first written; Kyler took it off
  (D107, decisions-pending #48).

The in-game check is skipped for now (D11): the River Valley file is in `out/m8/`, and checks
M8-1a to M8-1c are pending in [docs/ingame-log.md](docs/ingame-log.md). The deviations are PLAN §20
D97–D106.

---

## Map look

After M8 and before M9 (Kyler, 2026-09-24; PLAN §20, D86). The 3D view should look much closer to
Timberborn in game, while every map meaning stays readable. It changes no map files:
`src/core/render/shade.ts` (the 2D preview and the thumbnail) stays exactly as it is, and every
sha256 stays equal.

**Why:** Kyler's screenshot of the current 3D view is hard to read. The ground is coloured by
height, while the game colours it by moisture. There are no shadows or ambient occlusion. Water is
flat: badwater in its open ditch looks like a brown dirt ramp. Ruins are grey pillars, and the
district center is a small box.

**Delivers**
1. Ground tops coloured by moisture as in game: moist ground green; dry ground cracked earth, a warm
   grey-brown with a faint violet cast in shadow and visible cracks, not sandy (Kyler's correction
   from his in-game reference screenshots, D110); contaminated soil with its own look. A toggle
   switches back to height colours. This changes the 3D view's colour meaning from height to
   moisture (approved by Kyler, D86).
2. Height shown on the block walls: layered bands per level, so levels can be counted.
3. Baked ambient occlusion and soft sun shadows, computed when the mesh is built.
4. Warmer colour grading and light depth haze.
5. Water: colour and opacity by depth; a gently moving surface; foam on waterfalls and at
   shorelines; badwater as dark murky water, clearly water and clearly not clean.
6. Models: trees by species (pine, birch with white trunks, oak, succulent), with dead trees
   clearly dead; berry bushes; scrap-heap ruins instead of pillars; a recognisable district
   center of our own design.
7. A default camera angle closer to the game's.

**Rules**
- None of the game's models, textures or art. Everything is our own, and any textures are
  generated in the shader, so the artifact edition needs no image files.
- The M4 budgets hold (`npm run bench:3d`): build under 1.5 s at 256², and 60 fps on the
  integrated GPU with the CPU slowed 4×, including Beavertopia (D46).
- Every map meaning stays readable, and is checked in greyscale and under colour-blindness
  simulation: water and badwater, moist and dry and contaminated ground, living and dead trees,
  the start, slopes and their direction, dam sites.
- The 2D preview keeps its height colours, and the 3D view's legend and hover text say what the
  colours mean.
- The 3D chunk stays lazy-loaded, and its size is reported.

**Acceptance**
- Before and after captures of the same maps (seed 4242 in every theme, one 256² map and
  Beavertopia) from the same camera angles.
- A reviewer can tell each meaning above apart in the after captures.
- The budgets pass, and every existing test passes unchanged.

**Reference:** Kyler's in-game screenshots ([docs/ingame-log.md](docs/ingame-log.md), ML-1) arrived
on 2026-09-25 and tuned the colours, lighting, water and models. They stay on Kyler's machine:
never ship game screenshots.

**Not in this step:** the workshop study's naturalness targets for generated terrain (straight
steps, shorelines, ridge crests). Map look changes no map file, so they go to the refinement phase
(decisions-pending #40).

**In-game check:** no; the reference screenshot is Kyler's.

**Effort:** high.

**Release:** inside the M9 release, or tagged `map-look-done` and released like a milestone
(CLAUDE.md, Deploying).

---

## M9. Interestingness, names, candidates, premises and variety

**M9 design step first** (Kyler, 2026-09-25; PLAN §20 D108, D109). M9 is not built as written
below until Kyler approves a design that meets the product principle (PLAN, Product principles):
Dam Good Maps creates maps, never approximations of existing ones and never a few archetypes with
a little noise, and two maps must play differently, not only look different.

1. **`docs/m9-design.md`: a generator that invents.**
   - Composition: parts with continuous parameters that combine by rules, so combinations nobody
     authored appear: the river network (count, sources, confluences, splits, loops, direction),
     relief at several scales (plateaus, basins, ridges, mesas, escarpments, terraces), the water
     systems along it (lakes, falls, marshes, springs), hazards and landmarks.
   - Emergence: macro terrain from deterministic processes (for example warped noise, uplift and
     erosion, snapped to game levels), rivers from the terrain's drainage, and dam sites, falls and
     lakes found where the terrain makes them, not stamped. Say how this meets the naturalness
     refinement note.
   - Inspiration beyond maps: real geomorphology (canyons, deltas, calderas, oxbows, karst,
     fjords, badlands, mesas, braided rivers, alluvial fans, and more); Timberborn's mechanics as
     sources of decisions (droughts and badtides, water physics, dams and floodgates, vertical
     building, contamination); play design (trade-offs, risk and reward, pacing, frontiers,
     surprise); playful, whimsical forms that still read as landscapes.
   - The named premises below become at most a few recipes inside this system, never the space
     itself. Interest is judged intrinsically (the score's components, play variety and Kyler's
     ratings), never by similarity to workshop maps. The workshop's bands are a sanity range for
     playability; Variety may go beyond them where the checks pass.
   - Keep M9's good parts: 8 flow directions, the Variety setting and Surprise me, no clones, the
     score and names. Keep every guard: batches ≥ 98% per theme and size, determinism (exact
     arithmetic, D15), both validators, the budgets, share links that reproduce.
   - Say what it costs: which planners stay, the generator version, and the risks.
2. **Measures against archetypes**, on 200 seeds per theme at 128²:
   - no clones: every map's nearest other seed ≥ 0.25 away, median ≥ 0.40 (variety scale);
   - no archetypes: cluster the maps' signatures and feature vectors; no cluster holds more than
     15% of a theme's maps, and the river networks and relief structures show many distinct
     shapes (report the counts);
   - play variety: describe each map's opening from the analysis (where the start's water is and
     how it behaves in a drought, the nearest good dam site, the nearest threat, the directions
     and kinds of land to expand into, what lies hidden further out); no cluster of openings holds
     more than 15%; report the spread;
   - no approximation: no generated map is closer to any workshop map than the workshop's p10
     nearest-peer distance.
3. **A prototype** under `investigation/generative/`, with no `src/` changes: at least 3 themes,
   30+ seeds each at 128². Report renders, the measures above, the score and batch pass rates,
   compared with the current M9 plan.
4. **Kyler's judgement is the final gate.** A blind local rating page (never published) with 40
   prototype maps: mixed themes and seeds, no labels, no hint of the recipe or process, and beside
   each map's renders a short plain "how it plays" card from its opening description. Kyler rates
   Fun and Unique from 1 to 5. The design is approved only when his Unique median for these maps
   is at least his Unique median for the workshop maps (`C:\dgm-workshop\ratings.json`).

M9, M10 and M11 wait for that approval.


**Delivers:** old PLAN milestone 4.
- `score.ts` calibrated on the official maps.
- K = 3 candidates with progressive preview (K = 1 at 256² if the M2 benchmark requires it).
- Names and premises built from the features.
- The score on the map card.
- The words M12 reuses, built here because names and descriptions need them too (D84, D88):
  - river courses read from the actual flow: each river's path in flow order, from its settled
    water surface (else its bed), with its tributaries, and a name for each ("the main river",
    "the north tributary", "the river from the east edge");
  - the place resolver (EDITOR_PLAN §7 "Spatial language"): compass places, places relative to a
    feature, and flow-relative places (upstream and downstream, a position along a river's course
    from its source, the start's bank and the opposite bank, "this valley"), always read from the
    river's actual flow, never from a compass direction; it returns the area, its reading and its
    assumptions;
  - the judgement-word table (EDITOR_PLAN §7 "Judgement words"): each word's levers, measured
    targets, direction, size and guards. The groundwork's `lib/words.ts` checks only a target's
    direction; M9 adds D84's sizes.
  - From the Claude groundwork, these files move: `investigation/claude/lib/view.ts` and
    `lib/flow.ts` → `src/core/analysis/view.ts` and `flow.ts` (shared with names and premises);
    `lib/places.ts` → `src/core/places/resolve.ts` (the editor's region tools can use it too);
    `lib/words.ts` → `src/core/places/words.ts`; `tests/places.test.ts` and `tests/words.test.ts`
    → `tests/unit/`.

From the workshop study (D87), M9 grows from "the score" to "maps that diverge":
- **Premises.** At least three per built theme, drawn from the study's recipes
  (`investigation/workshop/recipes/`) and the catalogue, each a planner variant that lays its
  landmark out first and the rest around it (PLAN §8):

  | Theme | Premises (existing in bold) |
  |---|---|
  | River Valley | **Gorge-dammed basin**; Island in a moat; Oxbow bend; Twin falls; Spiral mountain or quarry |
  | Canyon | **Narrows**; Rim settlement (PLAN §8); Hanging lake on a mesa; Mesa field |
  | Highlands | **Staircase**; Twin plateaus (PLAN §8); Badwater volcano; Spiral mountain |
  | Lake Basin | **Rising lake**; Crater lakes (PLAN §8); Caldera with an island; Heart lake (rare) |
  | Delta | **Many mouths**; Salt marsh (PLAN §8); Oxbow delta |
  | Islands | **Archipelago**; Atoll (PLAN §8); Volcano island; Heart islands (rare) |

  Rare premises are drawn only at Variety 60 and above.
- **River directions** (D67). The valley themes (River Valley, Canyon, Highlands, Delta) and Lake
  Basin's outlet draw their flow axis from 8 directions (PLAN §7.1). The planners lay out in a
  west-to-east frame and the feature list is turned by one of the 8 symmetries of the square
  (paths, outlines, set-piece plans and orientations), or they plan natively. The north–south
  recipe builds a valley, its dam site and its falls along a north–south river with today's
  builders.
- **Variety** (`vy`, 0–100, default 70; decisions-pending #32, W2) and **Surprise me**. Variety
  sets how the premise is drawn (0: the theme's first; higher: all of the theme's, then the rare
  ones at 60+, then one catalogue landmark from another theme's list at 85+), how far the
  settings' targets wander within the workshop's p10–p90 bands (`settings-bands.json`) as a share
  of Variety, and the flow axis (always drawn at 30+). Surprise me draws a theme and sets Variety
  to 100; the share link carries the resolved spec, so the map reproduces.
- **No clones.** The K candidates (PLAN §7.9) are ranked by score, and among those within 5
  points of the best, the one farthest (variety score, `variety-scale.json`) from the theme's
  reference maps wins. The reference maps are seeds 1–30 of the theme at default settings, stored
  as 16×16 signatures and feature vectors (about 4 KB per theme).
- **The score** (`score/score.ts`), ported from `investigation/workshop/lib/score.ts`: 12
  components (engineering, height variety, landmarks, river character, resource pacing, regions,
  trade-off, frontier, surprise, verticality, naturalness, water), each 0–1 (decisions-pending
  #35, W5; PLAN §12). Its parameters are `data/score-params.json`: a copy of
  `investigation/workshop/score-fitted.json` when it exists, else of `score-params.json`. Re-run
  `npx tsx investigation/workshop/fit-score.ts` whenever `C:\dgm-workshop\ratings.json` changes,
  and commit the new `score-fitted.json` with the change that uses it. The score's inputs from a
  built map (plateaus, gorges, the main watercourse through the settled water, resource rings,
  regions, trade-off, frontier, dam sites near the start) move into `analysis/` from
  `lib/measures.ts` (`scoreInputs`), and the naturalness metric from `lib/naturalness.ts` (the
  refinement phase extends it).
- **Names and descriptions** from the catalogue's plain words, keyed by the detected feature or
  the premise (PLAN §13): *island in a moat*, *crater lake*, *caldera*, *spiral mountain*,
  *spiral quarry*, *volcano*, *hanging lake*, *mesa field*, *twin falls*, *oxbow lake*, *chain of
  lakes*, *great scarp*, *hub of channels*, *archipelago*, *branching rifts*, *concentric rings*.
  Examples: "Moat Isle", "Caldera Rest", "Spiral Quarry", "Twin Falls", "Mesa Reach".
- **Settings bands** (PLAN §5.8): the new calibration rows and settings from
  `investigation/workshop/settings-bands.json`, the premise's water budget for `water.no_flood`
  (decisions-pending #33, W3), and the relief and terracing presets (#37, W7 in part).
- **New builders** (PLAN §9.11): `spiral`, `cone`, `mesaField` and the sealed `sea`.
- **Not built unless Kyler chooses it:** Reservoir help (`rh`) and `water.storage_possible`
  (decisions-pending #31, W1). They conflict with D25, D30, D58 and D85, so the dam site near the
  start stays, and `water.reservoir` stays a generation target with an advisory warning. If Kyler
  adopts them, M9 builds them as WORKSHOP-INTEGRATION.md §2 says, and descriptions add a trade-off
  clause at Reservoir help None: "No ready reservoir: the river is yours to tame."

Why both variety targets below: a landmark on an unchanged River Valley base adds at most 0.02 to
the theme's V2 (the north–south valley, a new skeleton, 0.075); counted as landmarks, the eleven
recipes lift V3 from 0.20 to 0.53. Maps diverge when the premise changes the skeleton too (the
flow axis, where the valley runs, the relief, the water budget). Risk: variety bought with broken
maps; the per-premise batch gate is the guard.

**Acceptance**
- The official score distribution is documented, and the recommended official maps land in the
  top third (with the study's default parameters they rank 3rd, 6th and 7th of 19).
- Names and premises match the features on 30 hand-checked maps, 10 of them at Variety 100.
- 256² with K = 3 takes ≤ 20 s, or K = 1 is recorded.
- The place resolver is tested on rivers flowing in every direction (the four edge directions
  and the diagonal flow axes), a curved river, a drawn river and a tributary, so "upstream" is
  never read as "west".
- Every judgement word moves its measured targets by its size on three maps (two River Valley
  sizes and a Canyon), keeps every guard, and says so when its settings are already at their
  limits or its theme is marked weak.
- From the workshop study:
  - each premise passes a batch of 100 seeds at 96², 128², 192² and 256² at ≥ 98% final (first
    attempt ≥ 60%), in the `generate` profile, and every built theme has at least 3 premises;
  - in 100 seeds of each valley theme, all 8 flow directions appear and none exceeds 25%;
  - variety (`lib/variety.ts`, scale in `variety-scale.json`), seeds 1–30 at 128², default
    settings, as shares of the workshop's: the shape and numbers alone (V2) each theme ≥ 0.45
    (today 0.15–0.36), all themes together ≥ 0.80 (today 0.56); with landmarks counted (V3,
    `patternP0` in the scale file) each theme ≥ 0.60 at default Variety and ≥ 0.80 at Variety 100
    (River Valley today 0.20);
  - no clones: within a theme, every seed's nearest other seed is ≥ 0.25 away and the median
    ≥ 0.40 (today 0.06–0.19 and 0.08–0.26; workshop maps sit 0.59 (p10) and 0.67 (median) from
    their nearest peer);
  - the generated median score at default settings reaches the official median (today 40 against
    52);
  - each new builder meets its acceptance (PLAN §9.11);
  - only if Kyler adopts Reservoir help (#31): the obviousness measure
    (`investigation/workshop/obviousness.ts`) matches each level on ≥ 98% of maps, and Normal with
    Reservoir help None passes its batches at ≥ 98%.

**In-game check:** no.

**Effort:** xhigh (was high: the premises and the 8-direction layout frame set architecture).

---

## M10. Sculpting, naturalize, symmetry

**Delivers:** E6.
- Advanced sculpt brushes and the naturalize brush.
- Symmetry across all tools:
  - mirror on any map, rotation-4 on square maps;
  - entity orientation remapping;
  - one start kept.

Symmetry also serves the workshop catalogue's symmetric layouts (6 workshop maps).

**Acceptance**
- The performance budgets of EDITOR §9 are met.
- Caves and overhangs in imported maps survive edits elsewhere, and terrain support is re-checked.
- Symmetric edits stay exactly symmetric, entities included.
- From the workshop study (D87): the naturalize brush, on a generated map's terrain, brings the
  steps in straight runs of 8+ at or below the official median (0.066) and ridge crest variation
  to 0.25 or more (the naturalness metric M9 ports), without breaking `slopes.connect` or a set
  piece's protected tiles.

**In-game check:** no.

**Effort:** high.

---

## M11. Stamps, heightmap import, regenerate area, locks

**Delivers:** E7.
- The built-in stamp library, and user stamps with export and import (the entity transform rules
  of EDITOR §5).
- Heightmap import scaled to 0–16. It also serves the workshop catalogue's real-geography maps (4
  workshop maps).
- Regenerate an area, with constraints.
- Locks and the conflict rules.
- From the workshop study (D87):
  - The built-in stamp library draws on the catalogue's best patterns: island in a moat, crater
    lake with an island, spiral mountain and spiral quarry, heart-shaped lake (and other
    outlines: star, crescent), badwater volcano, hanging lake on a mesa, mesa field, twin
    waterfalls, oxbow lake, and dam narrows between two spurs; plus EDITOR §5's waterfall basin,
    gorge dam site, terraced cliff, ruin district and island lake. Each stamp is a feature group
    (landforms, lakes, set pieces, resources) with its own slopes; the recipes in
    `investigation/workshop/recipes/` are their reference.
  - The water builders `riverFork`, lake `outlets` and river `switchback` (PLAN §9.11).

**Acceptance**
- Hand edits survive regeneration per the conflict rules.
- Stamps round-trip through export and import.
- A rotated or mirrored stamp passes the load checks.
- From the workshop study: each built-in stamp, placed rotated and mirrored at 20 random free
  spots on 96², 128² and 256² maps of every theme, passes the load checks every time and leaves
  the map passing the `generate` profile at ≥ 90%; each new builder meets its acceptance (PLAN
  §9.11).

**In-game check:** no.

**Effort:** high.

---

## Refinement phase

After M11 and before the design pass. It works through Kyler's refinement notes: things to
improve once every tool exists. Each note is its own item, with its own tests.

**Kyler's notes**
1. Pending decision [#2](docs/decisions-pending.md): `plants.drought` warns on every River Valley
   map, because the berry bushes near the start grow on water that drains in a drought.
2. Pending decision [#12](docs/decisions-pending.md): narrow a generated fall's channel to 1–3
   tiles above the drop, for water wheels.
3. Pending decision [#13](docs/decisions-pending.md): a river drawn across another river.
4. Pending decision [#21](docs/decisions-pending.md): the measured targets that move less than
   their formulas (flat share, one-level share, cliff share).
5. The river-pond crossing fix (a queued task): the editor's **River** tool refuses a drawn river
   that crosses a riverside pond, so `tests/e2e/tools.spec.ts` draws on a map without ponds
   (`&lk=0`).
6. The load checks (Kyler, 2026-09-25): the validators' load-class checks that real maps fail
   even though the game loads them. 12 of the 32 investigation maps fail one (unconnected slopes,
   a start on uneven ground, Meander Multiplayer's three starts; decisions-pending
   [#8](docs/decisions-pending.md)). Keep a load check only where the decompiled game really
   rejects or breaks the map; otherwise make it a warning. Change both validators together.
7. Containment should look natural (below; decisions-pending [#29](docs/decisions-pending.md)).
8. `start.dry` and lakeside starts (Kyler, 2026-09-25; PLAN §20 D107): should `start.dry` count
   only water standing at or above the start's ground, so a lakeside start like Beaverome's
   passes? Measure how many official, workshop and generated starts it changes before deciding.

**Containment should look natural** (Kyler's note, 2026-09-24)

What Kyler measured (River Valley, seed 4242, 128², Normal):
- The dam site (D25) is a straight terrain wall with a gap. At y = 40 the valley floor is 7, and
  the ridge rises to 11, 5 tiles thick (x 60–64), with floor on both sides. Its plan: thickness 5,
  halfSpan 128, topLevel 11, crest 2, wobble 1.25. It runs straight across the whole valley,
  square to the river, until it meets high ground.
- The badwater basin is a square 7 × 7 box with a two-level rim. Its outlet ditch runs straight:
  x = 94 from y = 50 to y = 76.
- Lake Basin is a bullseye: an elliptical lake with evenly spaced ring terraces, and a straight
  walled outlet corridor.
- Canyon's dam site is a squared-off narrows.
- Drawn rivers in the editor raise their banks (D53), which can read as levees on sloped ground.

Keep what the water physics requires: sealed edge mouths; a lake's level set by its outlet sill;
a rim on every badwater basin (`water.badwater_contained`); reservoirs that meet high ground at
both ends. Change only the shapes.

**Delivers**
1. Measure first. A naturalness metric in the batch tools: the longest straight run of a height
   step, and how much a ridge's or rim's thickness and height vary along its length. Measure it
   on the 19 official maps and on generated maps, and set the targets from the official maps.
2. Dam sites: a narrows between hillsides (two spurs closing in), with uneven thickness and
   height. Not a straight ridge across the valley.
3. Badwater basins: an irregular pit and a winding ditch, still passing
   `water.badwater_contained`.
4. Lake Basin: uneven terraces, not even rings; an outlet that isn't a straight corridor.
5. Canyon's narrows: a rock-like outline, not rectangles.
6. The editor's drawn-river banks: blend them into the ground beside them.
7. Notes 1–6 above, each closed with Kyler's answer (or its default) and a test.

**Rules**
- Every check keeps passing, including the reservoir rules and Hard's 3-deep rule.
- Batches stay at 98% or better.
- The Python oracle changes with the TypeScript, with 0 disagreements.
- This changes every map, so bump the generator version and note that old share links change
  (versioned deploys come in M13).

**Related work:** M9's interestingness score can use the same naturalness metric. M10's naturalize
brush is the editor version; consider sharing its smoothing with the generator.

**From the workshop study** (D87). Step 1 extends the naturalness metric M9 ports
(`investigation/workshop/lib/naturalness.ts`). The study already measured these on the official
and workshop maps (`workshop.json` `overall`; seeds 1–30 per theme at 128²); step 1 measures them
again with the batch tools and records the final targets:

| Measure | Official median | Workshop median | Generated today | Starting target |
|---|---|---|---|---|
| Steps in straight runs of 8+ (whole map) | 0.066 | 0.031 | 0.138 (Canyon 0.373) | ≤ 0.066 in every theme (#40) |
| Longest straight step run (whole map) | 18 | 17 | 27 (Delta 33.5) | ≤ 25, the official p90 (#40) |
| Ridge thickness variation along a ridge (CV) | 0.30 | 0.36 | 0.32 | ≥ 0.30 |
| Ridge crest height variation (std, levels) | 0 (p90 0.46) | 0.40 | 0 | ≥ 0.25 |
| Basin rim thickness variation (CV) | 0.25 | 0.31 | 0.18 | ≥ 0.25 |
| Dam-site reservoir rim thickness variation (CV) | 0.38 | 0.37 | 0.34 | ≥ 0.35 |
| Narrows shoulders: thickness variation (CV) | 0.45 | 0.43 | 0.42 | ≥ 0.40 |
| Narrows shoulders: height variation (std, levels) | 0.31 | 0.22 | 0 (River Valley, Highlands, Delta) | ≥ 0.2 |
| Shoreline in straight runs of 8+ | 0.12 | 0.06 | 0.22 (Canyon 0.46) | ≤ 0.12 |
| Water in 1–2-tile ditches (share of water) | 0.021 | 0.053 | 0.009 | report only |

The whole-map rows came from Map look, which changes no map file (decisions-pending #40). The shapes
this phase changes meet them; whole-map targets beyond those shapes (every terrace edge) wait for
Kyler.

**The dam site's spurs mode** (a `damSite` builder mode, PLAN §9.11) is how step 2 builds a narrows
between hillsides. The study's prototype (`investigation/workshop/recipes/narrows.ts`) replaces the
dam site with two tapered, bent spurs, each with a gentle apron, a cliff core and a cliff crown, of
different heights. Over 23 maps: the reservoir still holds on 22 (the miss: a 96² valley too
shallow for spurs that size, so the builder's limits must scale with the ground); a dam of 5 tiles
or fewer holds a Normal drought's water on 35% of maps (today 77%); the shoulders vary in
thickness (CV 0.37), but each crown is flat, so the crest heights within 12 tiles vary less than
today (std 0.45 against 1.56). Stepped crowns fix that: each spur falls 1–3 levels from root to
tip, in gentle or terraced steps, and the two spurs differ.

**Acceptance**
- The naturalness metric is reported for the 19 official maps and for the generated maps of every
  theme, and the targets set from the official maps are recorded in PLAN §20.
- The generated dam sites, badwater basins, Lake Basin terraces and outlet, Canyon narrows and the
  editor's drawn-river banks meet those targets.
- Every check passes on every batch map, the reservoir rules and Hard's 3-deep rule included;
  batches per theme ≥ 98% final; the oracle shows 0 disagreements.
- The spurs mode: River Valley, Canyon and Highlands batches ≥ 98% with it; shoulder height std
  ≥ 0.25 and crest height std within 12 tiles ≥ 1 (official medians 0.47 and 1.75).

**In-game check:** short, logged as pending (D11): build a dam at a new narrows and check that
the basin fills without leaking round the spurs.

**Effort:** xhigh.

**Release:** CLAUDE.md names no tag for this phase. It reaches `main` with the design pass
(`design-done`), which follows it.

---

## Design pass

After M11 and the refinement phase, and before M12. It is the Impeccable design pass with the
timbermods design system, moved here from M13. It follows the impeccable-app-flow skill
(timbermods/.github, `claude-skills/impeccable-app-flow/`) and leaves a DESIGN.md and a
MEANING.md behind.

From the workshop study (D87): the panel gains Variety and a **Surprise me** button beside
Generate (and Reservoir help, if Kyler adopts it: decisions-pending #31); the map card names the
premise and its landmark. Copy uses the catalogue's words (M9's list).

---

## M12. Claude integration

**Delivers:** E8, with the delivery choices from the M3 spike, built on the Claude groundwork
(D88; `investigation/claude/`).
- Its Claude panels are built in the design flow's update mode, from the DESIGN.md and
  MEANING.md the design pass leaves behind.
- The step schema (EDITOR_PLAN §7 "Steps", D89) and how each step becomes operations; a
  feature-level map summary (at most about 16 KB; 3–7 KB measured).
- The tools: `resolve_region`, `find_sites`, `measure`, `list_features`, `limits`, `dry_run`,
  `propose`. Each checks its own arguments and returns at most 32 KB. `find_sites` plans every
  candidate with the real builders and checks it with a real build.
- The size-word resolver on top of PLAN §9.10 (D96), and M9's place resolver and judgement words.
- Compound requests (EDITOR_PLAN §7, D84): goals with their own expectations; settings and
  regeneration before placements, in the app's step order (D90); every goal checked on the
  combined preview; interference between goals detected and named; guards held for the whole
  proposal (D91); the nearest feasible alternative offered for every goal not met, never
  substituted (D92).
- Intent checks, and the loop's budget: 3 rounds and 10 tool calls for one goal, growing with the
  goals Claude declares, up to 6 rounds and 20 calls (D93; decisions-pending #28).
- The Messages API adapter (bring-your-own-key, strict tools, prompt caching, configurable model,
  server-side fallbacks) and the suite runner.
- The artifact edition: a single-file build declaring `sample` and `downloads` only, and a `.zip`
  download.
- The Claude request suite (120 requests in 13 kinds) running in Node, with reference solutions
  (EDITOR_PLAN §9).
- From the workshop study (D87): the catalogue is Claude's vocabulary. Each pattern a player might
  ask for maps to a builder, a stamp or a feature, and the suite (EDITOR §9) gains these requests:
  - "Add a spiral mountain in the north" → `spiral` up; "dig a spiral quarry" → `spiral` down.
  - "Put an island in a moat near the east edge" → a lake with an island (stamp).
  - "Make the lake heart-shaped" → the lake's outline replaced, its level kept.
  - "Add a volcano that spills badwater, far from the start" → `cone` with a crater and a badwater
    basin; the badwater distance rule decides "far".
  - "Twin waterfalls on the south cliffs" → two standalone falls, the same facing, side by side.
  - "A hanging lake on a mesa that pours into the river" → a mesa landform, a lake on it, its
    outlet routed down.
  - "A field of mesas with ruins on top" → `mesaField` with ruins on 2 tops.
  - "Split the river round a big island" → `riverFork`.
  - "Make the dam site less obvious" → the dam site's spurs mode (refinement phase); with
    Reservoir help, if Kyler adopts it (decisions-pending #31), help `some`, or no dam site at
    None.
  - "Make this map more surprising" → a `specPatch` raising Variety, with the premise drawn again.

**From the Claude groundwork** (M12-INTEGRATION.md §1, §6, §8–§11). Build items:
- **Files that move** (the rest go in M9):
  - `lib/metrics.ts` → `src/core/analysis/features.ts` (`reservoirTiles`, `reservoirIsClean` and
    the lip measures move to the builders once they return them);
  - `lib/sites.ts`, `lib/steps.ts`, `lib/compound.ts`, `lib/intent.ts`, `lib/report.ts`,
    `lib/summary.ts`, `lib/tools.ts`, `lib/conversation.ts` → `src/claude/` (EDITOR §8's
    `claude-bridge`: headless, no UI);
  - `harness/bridge.ts`, `harness/loop.ts`, `harness/prompts.ts` → `src/platform/claude/` (a
    platform adapter, PLAN §19.9; route A's adapter joins it);
  - `harness/run-suite.ts` → `tools/claude-suite.ts` (nightly with a key; `--scripted` in CI);
  - `requests.json` and `bin/corpus.ts` → `tests/claude/requests.json` and
    `tools/claude-corpus.ts` (the corpus source stays code; the JSON is its output);
  - `bin/reference.ts` → `tests/claude/reference.test.ts` (a vitest suite, sharded by kind: it
    takes about 10 minutes in one process);
  - `lib/fixtures.ts` and `lib/synthetic.ts` → `tests/claude/fixtures.ts` (drop the Lake Basin
    fallback: the reopen bug was fixed after M7);
  - `bin/cli.ts` → `tools/claude-cli.ts` (for playing requests by hand);
    `bin/add-workshop-requests.ts` → `tools/claude-workshop-requests.ts`.
- **`src/` changes, made first** (§8):
  1. One undo entry for a whole proposal: `MapSession` gets a grouped entry (begin and end, or
     `applyAll` taking a `specPatch` first), so an accepted proposal undoes as one edit.
  2. Stable preview ids: a feature's id seeds its build (a dam site's ridge wobble), so
     `planPiece` previews take an explicit id, or the wobble is seeded from the request.
  3. Builders return what they measure: the dam site's reservoir tiles, the waterfall's lip, the
     badwater basin's footprint and outlet tiles.
  4. The Lake Basin reopen bug: fixed after M7 (9256161).
  5. The river badwater step: allowed for rivers that enter at a map edge (D80 builds them),
     refused with the reason for rivers that start inland.
  6. Step wrappers for M7's pieces and objects (§9): `addMapObject {kind, where, size}` for mine
     sites, relics, geothermal fields, thorn belts, weirs, plugs and unstable cores, with a site
     finder per kind and M7's placement emulation as the check; `addSetPiece` for `plugSpillway
     {lake}`, `obstaclePayoff {where, rise 2–4, payoff}` and `secondDistrict {where}`, with
     `find_sites` kinds for each.
  7. Flow axes: nothing here; the resolver never assumes west to east, and M9 builds them.
  8. `regenerateRegion` (M11) for regional judgement words (D94; decisions-pending #43).
  9. Map objects in the way: the planners and `find_sites` try sites off map objects first; a
     piece that lands on one moves or clears it and lists it in the report (M8's rule, D87;
     decisions-pending #47).
  10. Performance at 256²: `find_sites` for a dam site takes about 3.7 s, and a three-goal
      compound reference about 24 s, mostly verifying candidates with real builds. A cached
      settle per candidate or a cheaper pre-filter comes before the artifact route, where each
      call blocks the page.
- **Re-tune the corpus** for M7's maps and objects. Against dev at 5b17375, 106 of 120 reference
  solutions passed; the 14 failures were new map objects in a creek's or a site's way (P08, C01,
  W05, W06, W07, X04, M04), regenerated maps whose sites changed (S03, S04, M02, V02), and the
  headline request's "start upstream" breaking `water.reservoir` on the harsher map (M01, and F07
  and F08, which use it). Give the start search a pre-filter for `water.reservoir`, as it has for
  water, trees and berries (since D85 it is a target with an advisory warning, and still a guard
  when it passed before the proposal, D91). None of the failures was the resolver or the tools
  misreading a request.
- **The workshop slot:** fill `requests.json`'s `workshopSlot` from the workshop catalogue
  (`investigation/workshop.json` `catalogue`) with `tools/claude-workshop-requests.ts`, then run
  the reference solutions of kind `workshop`.
- **Prompts and harness** (§6): one prompt pack for both routes. The instructions travel in the
  first user message (route A has no system prompt), then the map summary in a `<map_summary>`
  block (the cached prefix on route B; the map's own text in it is labelled as data), then the
  request in a `<player_request>` block with the selection. The Messages API request sets the
  model (configurable, default `claude-opus-5-5`, D8), adaptive thinking with its effort set,
  `tool_choice` auto, prompt caching on the last tool and the summary block, and server-side
  fallbacks, and handles the stop reasons refusal, `max_tokens` and `pause_turn`. The loop is
  append-only, measures its input every turn, and stops at 64 KiB with the artifact limits on.
  `tools/claude-suite.ts --scripted` replays the reference solutions through the same loop and
  grader, so CI covers the harness without a key.

**Acceptance**
- Malformed or out-of-bounds proposals are rejected cleanly, with the reason.
- An accepted proposal undoes as one edit, like a normal edit.
- Every reference solution passes on its map (96², 128², 256², and 48² for the reductions),
  including the 20-block waterfall with the reported reduction on 48².
- With a key, the request suite passes at least 90% overall and in every kind, with the artifact
  limits on; every compound request's report names every trade-off and every goal not met.
- The compound, impossible and conflicting requests of the suite (EDITOR_PLAN §9) pass.
- No request's input passes 64 KiB with the artifact limits on.
- Results stay editable by hand, and follow-ups modify the right feature.
- The artifact edition passes a manual smoke test on the same requests.
- Each of the workshop study's requests passes the suite on 96², 128² and 256² maps; the intent
  checks measure the landmark (its extent, its levels, the slopes joining a spiral's steps, the
  fork's two wet arms).

**In-game check:** play the map produced by "add a giant waterfall in the north part of the map
that is roughly 20 blocks wide", and the one produced by the compound request ("Make this valley
harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a
dangerous badwater route on the opposite side.").

**Effort:** xhigh.

---

## M13. Usability, ratings, versioned deploys

**Delivers**
- E9: the usability tasks, onboarding hints, shortcuts reference, help page, accessibility pass
  and final performance pass.
- The rest of old PLAN milestone 6 (its design pass is now the Design pass step, before M12):
  - the ratings flow and `tools/ratings.ts`;
  - install help, including the extract step of the artifact edition;
  - mobile layout;
  - versioned deploys at `/v/<version>/`.
- From the workshop study (D87): the rating form asks two questions, as the study's rating page
  does: fun (1–5) and unique (1–5), with an optional note (PLAN §2.3). `tools/ratings.ts` writes
  them in the shape `investigation/workshop/fit-score.ts` reads (`{ratings: {<key>: {fun, unique,
  note}}}`), so the same fit refits the score's target and weights from players' ratings.

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
- tablet and touch support;
- flood challenges: 4 workshop maps start flooded or in a badwater sea; they need a challenge
  profile that relaxes `start.dry` and `water.no_flood`, with a warning.

The workshop study's numbers for these (D87):
- **Caves, overhangs and tunnels.** Within the 35 workshop maps made for 1.0 or later: some cave
  or overhang columns on 29 (83%), 5% or more of the map on 13 (37%), NaturalOverhang objects on
  31 (89%); official maps: some on 15 of 19, 5%+ on 2. Across all 130 workshop maps, 46 are built
  round caves (cave starts, tunnels, underground rivers, sky islands). They need water under roofs
  and voxel tools first.
- **Terrain 17–22.** 19 of 130 workshop maps (7 of the 35) reach above 16; no official map does.
  D4 stays (decisions-pending #38, W8).
- **1.0 objects are common in the workshop.** Within the 35: relics 91%, geothermal 86%, plugs
  94%, thorns 74%, seeps 74%, weirs 69%, aquifers 66%, unstable cores 63%, badtide drains 60%
  (official: 47%, 37%, 79%, 42%, 42%, 32%, 11%, 16%, 37%).
