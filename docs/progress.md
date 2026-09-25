# Progress

Overnight runs of 2026-09-24 on branch `dev`: run 1 checked M1 and built M2–M4; run 2 builds M5–M11. Each milestone is
tagged `m<N>-done` when all of its acceptance criteria pass.

## Run summary

**Run 2 (M5–M11) stopped at M8 on 2026-09-25. One M8 acceptance criterion is not met as
written.** M5, M6 and M7 passed; M6 and M7 are live.

| Milestone | Tag | Released | Result |
|---|---|---|---|
| M5 Set pieces, land and water tools, slopes, fixes | `m5-done` | inside the M6 release | All criteria pass |
| M6 Full settings, sharing, themes I | `m6-done` | PR #2, live 2026-09-24 | All criteria pass |
| M7 Resources, map objects, themes II | `m7-done` | PR #7, live 2026-09-25 | All criteria pass (includes the Lake Basin project-file fix) |
| M8 Water preview and background validation, with the start requirements | not tagged | not released | Built; one criterion not met (below) |
| Map look, M9, M10, M11 | — | — | Not started |

Before each tag the run re-checked the milestone itself: typecheck, every unit, contract and
browser test, and the full oracle (0 disagreements between the two validators on 50 generated
and 19 official maps). After each release, the live check passed: the site's download equals
`tools/gen.ts` byte for byte.

- **Where it stopped, and why.** M8's acceptance says Hollows, Pressure, Oasis, Nomads and
  Beaverome report their water checks as approximate. Four do. Beaverome has none of the causes
  (no caves, delayed sources, aquifers or seeps, and no roof over the start), and the settle
  matches its own water within 1%. The workshop study listed it because its start fails
  `start.dry` (its lake stands 0.7 below the start), not because of its water. Flagging it would
  need a reason that isn't true, so the run stopped, as the gate rule says. Everything else in M8
  passes:
  - the three start requirements (D85), in both validators;
  - every generated start reaches water on its own level;
  - batches are 100% final in every theme, with higher first-attempt rates than M7;
  - a 2-second re-preview at 256²;
  - byte-identical unedited exports;
  - editable generated outlines;
  - no floating objects;
  - 338 tests and 52 browser tests.

  M8 is on `dev` at `e6d8720`, and CI is green. It's not tagged or released, so the site stays
  at M7.
- **What you need to do next:**
  1. Decide #48 (Beaverome). The simplest fix is to take Beaverome off M8's list, since its
     water is shown correctly. Then `m8-done` can be tagged and released, and the run can
     resume.
  2. Resume the run from M8: Map look, M9 (with #21's variety target), M10 and M11. The
     river-pond crossing task and the fit-score step wait with it, as you asked.
  3. Say what "the load checks" in your refinement notes means. It's on the Refinement list,
     marked "details to confirm".
  4. Play the pending in-game checks, and run the M3 spike page. See "What Kyler needs to do".
- **Pending decisions:** 46 are open in [decisions-pending.md](decisions-pending.md). #34 and #39
  are decided. The run went ahead with each default.
  - M2–M4: #1–#10
  - M5: #11–#14
  - M6: #15–#22 (#21: large maps flatter than official maps, now an M9 target)
  - M7: #23–#27
  - M8: #30, #36, #47, #48
  - Map look: #40
  - M9, from the workshop study: #31–#33, #35, #37
  - Refinement: #29
  - M12: #28, #41–#46
  - Later: #38
- **Also done in this run:**
  - Pages is on. `main` gets tagged releases as merge commits, and a live check runs daily and
    after each deploy (PRs #2, #3 and #6).
  - The impeccable-app-flow skill was added to timbermods/.github (#30, merged) and installed
    locally.
  - The design pass is now its own roadmap step before M12.
  - `main` was merged into `dev` once.
  - The workshop study (PR #4) and the Claude groundwork (PR #5) were merged and their plans
    adopted (D87–D96).
  - Your plan updates were recorded: D84 (M12 compound requests), D85 (start requirements, as
    amended), D86 (Map look), and the Refinement phase with the natural-containment note.
  - Fixed: a number-field race in the editor, and Lake Basin and Islands project files not
    reopening.

### Run 1 (M1 check, then M2–M4), 2026-09-24: every milestone passed

| Milestone | Tag | Result |
|---|---|---|
| M1 Shared core and end-to-end slice | `m1-done` | All criteria pass |
| M2 Water, playability and validation profiles | `m2-done` | All criteria pass |
| M3 Map document and operations engine, delivery spike | `m3-done` | All criteria pass; spike questions 4–5 need you (below) |
| M4 Shared 3D view and editor shell | `m4-done` | All criteria pass |

Before tagging each milestone, the run re-checked it: typecheck, all unit and contract tests, all
browser tests, and the full oracle. The oracle is 150 maps, with 0 disagreements between the
Python and TypeScript validators on 50 generated and 19 official maps. CI is green on `dev`.

- **Where it stopped:** after M4, as planned. No criterion failed. The queued second run
  (M5–M11) continues on `dev`.
- **What you need to do:** see "What Kyler needs to do" at the end of this file.
  1. Turn on Pages from Actions.
  2. Play the pending in-game checks: A and F2 (`out/m1/`), and B (`out/m2/`).
  3. Run the M3 spike page signed in. The live `sample` call and public sharing need your
     account and consent.
  4. Answer the pending decisions.
- **Pending decisions:** 10, in [decisions-pending.md](decisions-pending.md). The run went ahead
  with each default.
  1. Hard's 3-deep reservoir rule is deferred to M6.
  2. The advisory `plants.drought` warns on every River Valley map.
  3. Imports get approximate survival checks.
  4. The badwater sits far east.
  5. Multi-colony export follows the vanilla rule (superseded by #8).
  6. What a lock keeps.
  7. Imports are stamped 1.1.2.4.
  8. An import's own problems never block its export.
  9. Import water checks wait for M8.
  10. Autosave keeps one map.
- **Note:** another session added `CLAUDE.md` (the writing rule and "never launch Timberborn")
  to `main` in PR #1. `dev` does not include it, and doesn't touch that file either, so merging
  `dev` into `main` brings both together without conflict. The run followed both rules.

## M1: shared core and end-to-end slice (tag `m1-done`)

**Built** (branch `m1-core`, from `main` at b6f2e21):
- **Project.** Vite 8, TypeScript 5.9, Preact, a Comlink worker, fflate, Vitest and Playwright.
  The site builds to `dist/` with base `/dam-good-maps/`.
- **Deterministic core** (`src/core/math`):
  - sfc32/splitmix32 RNG streams and murmur3 hashing, for feature ids and entity GUIDs;
  - `sin`, `exp` and `ln` from basic operations (D15);
  - integer-hash value noise, and grid helpers.
- **Format** (`src/core/format`):
  - a C#-compatible float formatter and JSON parser;
  - `world.json` encode and decode (voxels, the legacy 0.6 `Heights`, the 1.1 singletons with
    `WaterSimulationMigrator`);
  - a `.timber` reader and writer with fixed zip mtimes;
  - the footprint transform for every map template;
  - entity builders;
  - the vendored jpeg-js thumbnail (D20).
- **Spec** (`src/core/spec`): MapSpec v1, its JSON Schema, defaults and presets, and the URL
  codec. `colonies` is reserved for Timber Together (D5).
- **Features** (`src/core/features`):
  - the feature schema v1: river, lake, landform, setPiece (damSite, on-river waterfall), forest,
    berryPatch, ruinField, start (with `player`);
  - stable ids;
  - the build pipeline, steps 1–5, 7–9, 11–12 and 14;
  - derived slopes;
  - sealed-mouth sources;
  - moisture from planned water (a priority flood).
- **River Valley** (`src/core/gen/riverValley.ts`): the prototype's layout, ported as a feature
  planner. Ruin fields, berry patches and groves are placed with the calibrated size-aware
  densities.
- **Validation** (`src/core/validate`): the load class (file, terrain, entities with the
  placement emulation, slopes, start) and the design checks `terrain.max_height` and
  `terrain.single_floor`, in the `generate` profile.
- **Project file** (`.damgoodmaps.json`, gzip): the spec, the features and the built base.
  Rebuilding from it reproduces the `.timber`.
- **Website:**
  - settings (seed, size, theme, designed-for);
  - a 2D preview with layers, feature outlines and hover labels;
  - a map card with the validation report;
  - downloads of the `.timber` and of the project file;
  - install help;
  - the spec in the URL hash.
- **Tools:**
  - `tools/gen.ts` (batch generation);
  - `tools/oracle.ts` (the Python oracle);
  - `tools/bench.ts`;
  - `tools/ingame-files.ts` (writes the in-game check files);
  - `prototype/calibrated.py` aligned (D9).
- **CI** (`.github/workflows/ci.yml`, every push) and the **Pages deploy**
  (`.github/workflows/deploy.yml`, from `main`).

**Acceptance:**

| Criterion | Result |
|---|---|
| 50 seeds × 3 sizes pass `validate.py` load checks and `roundtrip_test.py` | **pass**: 150/150 maps (96², 128², 256²), 0 load failures, 0 round-trip failures (`npm run oracle`) |
| Identical sha256 in Node and Chromium for 10 seeds | **pass**: 10 seeds over 96², 128² and 256², through the page's worker (`tests/e2e/determinism.spec.ts`, local Chrome) |
| Rebuilding from the downloaded project file reproduces the `.timber` byte for byte | **pass**: `tests/contract/features.test.ts` (3 maps) |
| Removing one ruin field leaves every other feature and entity id unchanged | **pass**: `tests/contract/features.test.ts` |
| 128² generates in < 3 s | **pass**: 85 ms median, 131 ms max, Node (`npm run bench`); about 250 ms in the browser |
| The PLAN §15 contract tests that apply are green | **pass**: 66 unit and contract tests (schema vs Ajv, feature round trip, build equality, determinism) |

**Deviations** (the plan is updated to match): PLAN §20 D15–D23.
- D15: the deterministic sine is a Taylor polynomial through x¹⁷, not a 7th-order minimax fit.
- D16: an eval-free runtime schema checker; Ajv runs in the tests only.
- D17: entity `localIndex` is the tile index.
- D18: the project file's base holds heights only in M1.
- D19: River Valley is the prototype layout (a west-to-east river, no badwater or map objects
  yet).
- D20: jpeg-js is vendored.
- D21: slopes use the prototype's reach rule. M2 revisits it with §7.5.
- D22: Playwright uses the local Chrome, and CI runs a 5-seed oracle subset.
- D23: Pages deploys from `main` only.

**Look at:**
- The in-game checks A1–A5 and F2 are pending ([ingame-log.md](ingame-log.md)). The files are
  in `out/m1/`.
- Pages is not enabled yet. See "What Kyler needs to do" below.

## M2: water, playability and validation profiles

**Built** (branch `dev`, generator 0.2.0):
- **Water simulation** (`src/core/sim`):
  - `water.ts`: the game's single-layer water rules, ported from `prototype/watersim.py`
    operation for operation. Each substep updates an exact active list (the wet tiles, their
    neighbours and the source tiles), rebuilt every substep. It matches the Python bit for bit.
  - `prefill.ts`: the canonical settle (D27). A priority-flood pre-fill fills the basins, an
    open-channel pre-fill of 0.3·Q/w fills the rivers, then the simulation runs until the §11.3
    settle test passes. It is computed from the terrain and the sources alone.
  - `model.ts`: emitters and obstacles from map objects by their footprints (D28).
  - `contamination.ts`: soil contamination.
  - `drought.ts`: the analytic drought, evaporated per pool (D29).
  - `moisture.ts`: now runs on the simulated water, with Thorns as barriers.
- **Golden vectors:**
  - `tools/export-fixtures.py` writes `tests/golden/water.json.gz`: 12 small terrains, including
    a sealed mouth and a gap, a waterfall, a lake with a sill, a flat plain, badwater mixing, a
    weir, a seep, terraces, a confluence and evaporation;
  - `tests/unit/water.test.ts` also runs the game's own save (local only) and the drought
    comparison.
- **Build step 10:**
  - the canonical settle, then moisture and soil contamination;
  - trees and bushes are placed on the simulated moisture;
  - files ship pre-filled with water, moisture, contamination and evaporation modifiers;
  - a copy with empty water for the A/B check.
- **River Valley changes** that settled water exposed (D24–D26):
  - the badwater source, in a pit with a ditch to the river, below the falls;
  - a dam-site ridge square to the valley axis, sealed into high ground, on the gentlest
    stretch;
  - a plunge gorge below each bed step;
  - a channel that widens with flow on large maps;
  - a start bench that never fills the channel;
  - the start 6–10 tiles from the channel edge, within reach of the dam site;
  - the valley and the basin kept off the map edges.
- **Validation** (`src/core/validate`):
  - every playability check of §11.3–11.4, plus the advisory `plants.drought`;
  - the full result shape (class, severity, where, fix, advisory, applicable) in `report.ts`;
  - the `generate`, `export` and `import` profiles;
  - `validateMap` validates any file, settling its water itself;
  - `analysis/regions.ts` and `analysis/damsites.ts`.
- **Python oracle** (`prototype/`):
  - `playability.py` and `validate.py` implement the same checks with the same rules, including
    the three §11.5 fixes;
  - `tools/oracle.ts` compares both validators check by check on generated maps and on the
    official maps.
- **Website:**
  - preview layers: water (badwater brown), moist soil, contaminated soil, land walkable from
    the start, and the best dam site;
  - hover shows depth, moisture and reach;
  - the map card shows the water facts and the report grouped as §11.6 says;
  - a "Without pre-filled water" download.
- **Tools:**
  - `tools/batch.ts`: pass rates;
  - `tools/bench.ts --water`: the settle time;
  - `tools/ingame-files.ts --milestone m2`: the files in `out/m2/`.
- **CI** now also checks validator parity on 5 maps, the 256² settle time and the 100-seed pass
  rates on every push.

**Acceptance:**

| Criterion | Result |
|---|---|
| Golden vectors pass | **pass**: 12 fixtures, depth and contamination within 1e-6 of the Python after 50, 200 and 975 ticks (bit for bit in practice), the moist/dry mask exact, and the pre-fill, canonical settle and drought storage equal (`tests/unit/water.test.ts`) |
| The game's own save is reproduced within 0.001 | **pass**: 975 ticks from empty give a largest depth difference of 0.00096, with the same 470 wet tiles (local-only test; the save is not committed) |
| The Python and TypeScript validators agree check by check on 50 generated maps and all 19 official maps (import profile) | **pass**: 0 disagreements. The 50 generated maps (seeds 1–50, cycling 96², 128² and 256²) compared 2,200 checks; the 19 official maps compared 44 checks each (`npm run oracle`, about 12 minutes) |
| Batch of 100 seeds at 128² Normal: final ≥ 98%, first attempt ≥ 60% | **pass**: 96% on the first attempt, 100% final, a mean of 1.04 attempts and a median of 211 ms per map (`npm run batch`) |
| The 256² settle time is measured, and the budget is recorded in PLAN §10 and "Editor decisions" | **pass**: the canonical settle takes a median 0.39 s at 256² (max 0.51 s, 1,152–1,408 ticks) and 0.07 s at 128² in Node (`npm run bench:water`). A whole 256² generation takes a median 0.95 s in Chrome. The budget, ≤ 3 s at 256² and ≤ 0.6 s at 128², is in PLAN §10 and D33; K = 3 stays |

Also green:
- the M1 oracle on 50 seeds × 3 sizes (150 maps pass `validate.py --load-only` and the round
  trip);
- Node = Chromium on 10 seeds, now with settled water;
- 96² at 97% and 256² at 100% on the first attempt (30 and 20 seeds);
- 104 unit and contract tests, and 4 browser tests;
- generation of a 128² map takes a median 182 ms (`npm run bench`).

**Deviations** (the plan is updated to match): PLAN §20 D24–D34.
- D24: River Valley's badwater is the prototype's marsh, as a `badwaterBasin` set piece in a
  `marsh` mode: a source in a pit with a ditch to the river. `water.badwater_contained` waits for
  the §9.5 basin (M5).
- D25: the dam-site ridge is square to the valley axis and sealed into high ground, and the gorge
  goes on the gentlest stretch.
- D26: the River Valley layout fixes listed above.
- D27: the canonical settle and its settle test (counted exactly, sums in index order), run by
  both validators.
- D28: the water model of map objects. Caves and overhangs are simulated on the top surface.
- D29: the analytic drought evaporates each pool by its own saturation.
- D30: `water.reservoir` uses the drought reserve (1.5× at Normal); the dam-site sampling and
  flood limits; Hard's 3-deep rule waits for M6.
- D31: "not applicable" results, severity per profile, and fix operations.
- D32: generator 0.2.0.
- D33: the water budget.
- D34: the M1 slope rule stays until M5.

**Look at:**
- The in-game checks B1–B4 are pending ([ingame-log.md](ingame-log.md)); the files are in
  `out/m2/`. B1 and B2 are the first test of pre-filled water in the game (PLAN §17's top risk).
- Four defaults are waiting for you in [decisions-pending.md](decisions-pending.md):
  - Hard's reservoir depth;
  - `plants.drought` on every Normal map;
  - playability on official maps with caves;
  - where the badwater goes.
- The official maps fail several playability rules in the `import` profile, the same way in both
  validators. For example, most have badwater closer than 30 tiles to the start or plants
  standing on dry soil. That is expected: imports never block, and those rules are ours for
  generated maps.

## M3: map document and operations engine, delivery spike

**Built** (branch `dev`; the generator stays 0.2.0 and its maps are byte-identical):
- **The build pipeline in stages** (`src/core/features/build.ts`, `target.ts`, `raster/`,
  `edits.ts`):
  - One pipeline builds generated maps, edited maps and imported maps. Its input can carry an
    imported base, sculpt edits, slope pins and removals, entity edits, and what locks kept.
  - `rebuild(prev, input)` is the incremental path. It rasterizes terrain only inside the dirty
    region (D38), and reuses slopes, the water settle, moisture and each resource feature when
    their inputs are unchanged.
  - Entity edits run in two passes, so a deleted source or a placed Blockage changes the water.
  - The sculpt brushes: raise, lower, flatten, terrace and smooth.
- **Import** (`src/core/format/normalize.ts`, `src/core/doc/base.ts`, D36):
  - Any `.timber` normalizes once: 0.6 heightmaps, 0.7, 1.0 and 1.1.
  - Pre-1.0 maps get the `WaterSimulationMigrator` halving; 4-field water tokens gain their fifth
    field; maps over 23 layers are truncated with a warning.
  - Old key shapes are migrated the way the game migrates them. Components 1.1 never reads are
    dropped, unknown ones are kept, and `StartingLocationPlayer` is kept.
  - Faction-only plants are flagged with a one-click fix. Saves are refused.
  - Every change is listed for the player.
- **The map document** (`src/core/doc/document.ts`, D37). A document is a generation (spec,
  planned features, what locks kept, the stored base) plus an edit log.
  - The base stores the whole map, so a document opens exactly after the generator changes.
  - Project files are format 2. M1 and M2 files still open.
- **The operations engine** (`src/core/doc/ops.ts`, `ops.schema.json`, D35). Every EDITOR_PLAN §3
  operation, in the `{op, params}` envelope the validation fixes also use.
  - Invalid operations are rejected with reasons.
  - Operations apply with undo data and replay on a new generation.
  - Operations whose target is gone are orphaned: kept and reported.
- **The session** (`src/core/doc/session.ts`), the API the editor will run in its worker:
  - `apply`, and `applyAll` for a fix or a proposal as one undo step;
  - `undo` and `redo` with built-map snapshots, `history`, `orphans`;
  - `regenerate` around the player's features, locks and keep-out regions (D39);
  - `rebuildWithCurrentGenerator`;
  - `exportTimber`, `validate` and `project`.
- **Planner constraints** (`src/core/gen/riverValley.ts`, PLAN §7.0). River Valley draws its
  layout again until it keeps off protected tiles, and places no marsh or resources there.
- **Validation:**
  - `entities.placement` and `entities.templates` name their entities and offer a
    `deleteEntities` fix;
  - `file.arrays` checks each packed array against its own size field, in both validators (D36).
- **The delivery spike** ([docs/spike-m3.md](spike-m3.md)):
  - the artifact test page, published privately at
    <https://claude.ai/artifact/Dkm1eoXZ6KvPwjBBc6JiRp> (`spike/artifact`, `npm run build:spike`);
  - the Messages API CORS page (`spike/cors`);
  - the local checks (`npm run spike:check`, results in `out/spike/checks.json`);
  - a CI test of the page (`tests/e2e/spike.spec.ts`).
- **Tests** (`tests/contract/`):
  - `properties` (E1), `ops`, `document`, `regenerate` and `import` (local maps only);
  - `tests/unit/normalize.test.ts` (hand-made old-format maps, so the rules run in CI).

**Acceptance:**

| Criterion | Result |
|---|---|
| The E1 property tests pass on generated maps of every size preset: random operations, then export, re-import and compare; undo all; incremental equals full | **pass**: `tests/contract/properties.test.ts` runs on 96², 128², 192² and 256² (seeds 301–304). Each preset gets 40, 32, 20 and 16 random operations, then one of each log operation the draw missed, so all 12 kinds apply on every preset. After every step the incremental rebuild equals a full rebuild (heights, water, moisture, soil contamination, every entity's JSON, orphans, notes), including after random runs of undo and redo. The export re-imports with nothing to normalize and exports the same bytes; the load checks agree; the project file reopens to the same map. Undoing everything gives the generator's own file byte for byte. A longer stress run found no difference either: 8 seeds × 80 operations at 96², 4 × 60 at 128² and 2 × 40 at 192² |
| Every voxel-format investigation map imports and re-exports its normalized world byte for byte | **pass**: all 30 (19 official, 3 dev, 7 workshop, 1 user map; `tests/contract/import.test.ts`, local only). Each exports its normalized world.json byte for byte, with its original thumbnail. Re-imported, it needs no normalization and exports the same bytes. The 19 official maps change only their version stamp. The two saves among the investigation files are refused with a message, as §19.6 says |
| The two 0.6 maps import | **pass**: Beavers Canyons and Meander Multiplayer. Their heightmaps become voxels, with 13 migrations listed for Meander Multiplayer. They export 23 layers, pass the structural load checks, and re-import unchanged. Meander Multiplayer keeps its 3 starts and their `StartingLocationPlayer` |
| Generate, add a user feature, change a setting, regenerate: the user feature survives and nothing is silently dropped | **pass**: `tests/contract/regenerate.test.ts`, 128², seed 21. A user plateau, a user forest and a Claude berry patch are added, next to edits of generated features. Then the map is regenerated twice: with new settings (forest density 150, ruins 200, a strong river), and with a new seed. All three features survive unchanged and built: the plateau stands at 15, and all 135 forest tiles carry trees. The new river, basin and generated resources keep off them. Every edit stays in the log and either applies or is flagged with its reason. Undo restores the previous generation. Also tested: locks keep their area, keep-out regions stay empty, and a regeneration that cannot avoid the player's features is refused without changing anything |
| The spike report answers each open question with evidence | **pass, with two questions that need Kyler** ([docs/spike-m3.md](spike-m3.md)). Answered with evidence: blob workers (the whole core runs in one under the artifact's policy, byte-identical to Node); opening a local `.timber` (generated, official, 0.7 and 0.6 maps); `.zip` versus `.timber` downloads (the platform's allowlist; the `.zip` holds the map byte for byte); Messages API CORS (works with the header, blocked without). Needs Kyler: `sample`'s real latency with tools on the quick and default tiers (a call spends his plan and asks his consent), and who can open the artifact, including by public link (sharing is his; the private page needs his sign-in). The steps are below |

Also green:
- the full oracle (`npm run oracle`): 150 maps pass `validate.py --load-only` and the round
  trip. Validator parity on 50 generated maps (2,200 checks) and on the 19 official maps shows 0
  disagreements, with the new `file.arrays` rule in both validators;
- generated maps are unchanged: seed 4242 at 128² keeps the sha256 `a713596b…` that
  [out/m2/checks.txt](../out/m2/checks.txt) lists;
- Node = Chromium on 10 seeds, the 100-seed batch at 128² and the timing gates, in CI;
- 179 unit and contract tests and 5 browser tests, including the spike page's blob worker under
  the artifact CSP.

Timings at 256², in Node:

| Operation | Time |
|---|---|
| A forest's density changes (no terrain or water change) | 3 ms |
| A tree is deleted | 3 ms |
| An undo | 2 ms |
| A 14×10 terrain raise (the canonical settle runs again) | 0.78 s |
| A full build | 0.81 s |
| A regeneration with a settings change | 3.0 s |

The project file is 238 KB, against 205 KB for the `.timber`.

**Deviations** (the plan is updated to match): PLAN §20 D35–D41, and D8 and D10 updated with the
spike's results.
- D35: one `{op, params}` envelope for operations and fixes, and what waits for later milestones.
- D36: import normalization in detail. FORMAT.md §7 had four live components listed as obsolete.
- D37: the document is a generation plus a log; the base stores the whole map; format-2 project
  files. D37 replaces D18.
- D38: entity edits in two passes; how the incremental rebuild finds its region.
- D39: regeneration around protected tiles; what locks keep.
- D40: the rules for editing imported maps.
- D41: the artifact edition's build.

**Look at:**
- **The spike needs your run** (below): `sample` with tools on two tiers, the save dialog, and
  sharing. Paste the page's results into [docs/spike-m3.md](spike-m3.md).
- Three new defaults in [decisions-pending.md](decisions-pending.md):
  - multi-colony imports and the export gate;
  - what a lock keeps;
  - the version stamp on imports.
- A terrain edit re-runs the canonical settle (0.4–0.8 s at 256²), because a rebuild must
  re-settle when terrain changes. M8 adds the warm-started preview for the editor.
- The dam site's band can be wide on maps whose valley axis is tilted. An edit that touches the
  band rebuilds the band's whole rectangle. That is correct, only slower (the E1 tests cover
  it).

## M4: shared 3D view and editor shell

**Built** (branch `dev`; the generator stays 0.2.0 and its maps are byte-identical):
- **The 3D renderer** (`src/render3d`, three.js 0.186, D45), one for the generator's preview and
  the editor:
  - terrain in 32×32 chunks: top faces merged into rectangles of one height, walls merged along
    their edge, and a voxel mesher only for columns with caves or overhangs;
  - after an edit, only the chunks within one tile of the changed terrain are remeshed, and only
    the water chunks whose water changed;
  - water as translucent surfaces, with curtains where water falls to lower water or ground; an
    unedited import (or one with caves) shows the water its file stores, every level;
  - objects as instanced meshes: trees, bushes, ruin columns, slopes, sources and the start, and
    boxes on the footprint blocks of every other template;
  - heightfield picking, an orbit camera and a top-down view (north up), a per-tile overlay for
    selections and previews, rendering only when something changes, and an orbit benchmark.
- **The generator page** gets a **2D / 3D** switch (the 3D view loads on demand), **Refine this
  map**, **Open a map** for any `.timber` or project file, and, for an edited map, **Export**
  through the export check. While the map has edits, **Generate, keeping my edits** regenerates
  around them, and **Discard edits** starts over (D44).
- **The editor** (`src/editor`, loaded on demand, EDITOR_PLAN §4):
  - the map fills the screen in the 3D view: **Orbit**, **Top-down** and **Reset view**, a compass,
    and a hover readout in plain words ("Plateau, height 12, pine forest");
  - the four tabs, **Land**, **Water**, **Resources** and **Start**, each listing its features
    (the player's own first);
  - rectangle tools: **Plateau**, **Forest**, **Berry patch**, **Ruin field** (D42);
  - select a feature by clicking it or from its tab; an inspector with a few plain controls;
    move and delete handles (drag the move handle, or focus it and use the arrow keys);
  - **Undo**, **Redo** and a **History** panel to jump back and forth;
  - a health pill and **Export .timber** in the export profile (D43); **Save project**, **Open**,
    drop a file on the page;
  - the import notices, with their one-click fixes for faction-only plants.
- **The worker** (`src/worker/session.ts`): the open document, sending only what changed (terrain
  heights with their rectangle, water, objects) as compact typed arrays.
- **Autosave** (`src/platform`, D44): IndexedDB through the storage adapter, 1.2 s after each
  change. A reload in the editor opens the map again; the settings page offers to continue it.
- **Core:** the session gives an import's stored water to the 3D view, the original map's checks
  for the export gate, notes confirmed warnings in the map's description, and returns the
  regeneration's analysis for the map card.
- **Tests and tools:**
  - `tests/e2e/editor.spec.ts` (the M4 journey), `tests/e2e/maps.spec.ts` (every investigation
    map, local only), `tests/e2e/render3d.spec.ts`;
  - `tests/unit/render3d.test.ts` (meshing, water, picking), `tests/unit/editor.test.ts`,
    `tests/contract/editor.test.ts` (the worker's side of the journey in Node);
  - `tools/bench3d.ts` (`npm run bench:3d`), with results in
    [out/m4/bench3d.json](../out/m4/bench3d.json).
- **New npm dependencies:** `three` 0.186.0 and, for development, `@types/three` 0.186.0.

**Acceptance:**

| Criterion | Result |
|---|---|
| Every investigation map imports, renders and exports unchanged | **pass**: all 32 (30 voxel-format maps and the two 0.6 maps; `tests/e2e/maps.spec.ts`, local only, 53 s for the whole browser suite). Each opens through the page's file input and draws in the 3D view: every chunk meshed, 3,798 to 582,976 triangles, all objects instanced, no page errors (screenshots in `.scratch/renders`, never committed). Each exports from the editor with no edits and nothing to confirm; the download equals Node's export byte for byte, and for the 30 voxel-format maps its world.json is the normalized world with the original thumbnail (M3's rule). 30 of the maps have problems of their own as they are: 12 fail a load check (unconnected slopes, a start on uneven ground, Meander Multiplayer's three starts) and 27 warn about caves or overhangs. The export check lists these apart; they neither block the export nor go into the description (D43) |
| The 3D view builds in < 1.5 s at 256² and orbits at 60 fps on a mid-range laptop | **pass** (`npm run bench:3d`, headed Chrome 153, 15 maps at 256²: 3 generated and 12 official and workshop maps, up to 582,976 triangles). This machine is **not** a mid-range laptop: an AMD Ryzen 7 9800X3D (8 cores, 16 threads), 62 GB, an NVIDIA GeForce RTX 4080 SUPER and the CPU's integrated AMD Radeon Graphics (2 compute units), Windows 11 Home, a 3440×1440 display at 164 Hz. So the budget is judged on the integrated GPU, which is weaker than a mid-range laptop's, and also with the CPU slowed 4× on a 1080p laptop screen at 150% (D46). **Build:** worst 445 ms (Beavertopia, 582,976 triangles, integrated GPU with the CPU 4× slower), median 211 ms in that setup; worst 133 ms on the RTX 4080. **Orbit:** every map ran at the display's rate in every setup (129 fps; Chrome paced the display at 127–130 Hz), with 0 of 46,631 frames longer than 1/60 s; the GPU needed at most 4.3 ms per frame (median) and 5.1 ms (95th percentile). CI renders in software: the same 256² build took 376 ms there (`tests/e2e/render3d.spec.ts`, bound 3 s) |
| Generate → refine → back to settings → regenerate → refine keeps user edits | **pass**: `tests/e2e/editor.spec.ts` through the page, locally and in CI. Generate 96² (seed 4242), **Refine this map**, draw a forest and a plateau, move the start two tiles with its handle's arrow keys, undo and redo, export. **Back to settings**: the card shows the edited map. Set **Designed for** to Hard and **Generate, keeping my edits**, then export from the settings page. **Refine this map** again: both features are unchanged, the plateau stands at its height, the forest has trees, the start is where it was moved, the history reads "Add forest, Add landform, Move start, Change settings and regenerate", nothing is orphaned. A reload in the editor reopens the map with its three edits from the autosave |

Also green:
- the full oracle (`npm run oracle`): 150 maps pass `validate.py --load-only` and the round
  trip, and validator parity on 50 generated maps and the 19 official maps shows 0 disagreements;
- generated maps are unchanged: seed 4242 at 128² keeps the sha256 `a713596b…` of
  [out/m2/checks.txt](../out/m2/checks.txt);
- Node = Chromium on 10 seeds, the 100-seed batch at 128² and the timing gates, in CI;
- 203 unit and contract tests, and 41 browser tests locally (8 in CI, where the investigation maps
  are absent);
- an unedited generated map exports the generator's own file byte for byte from the editor's
  worker (`tests/contract/editor.test.ts`).

Page weight: the generator page's script is 51 KB (20 KB gzipped) and loads nothing of the 3D
view until **3D** or **Refine this map** is clicked; the 3D chunk is 572 KB (145 KB gzipped),
mostly three.js.

**Deviations** (the plan is updated to match): PLAN §20 D42–D46.
- D42: the editor's tools in M4: rectangle tools for a plateau and the three resource areas; which
  features the move handle moves, and how.
- D43: the export check: an imported map's own problems are listed but never block; imported maps
  get the load and design checks until M8; confirmed warnings go into the description.
- D44: one open map, "Generate, keeping my edits", autosave in IndexedDB.
- D45: how `render3d` draws.
- D46: how the 3D budget is measured, on a machine that is not a laptop.

**Look at:**
- Three new defaults in [decisions-pending.md](decisions-pending.md) (#8–#10): imported maps' own
  problems at export (this also settles #5: a multi-colony import now exports with all its
  starts), water and colony checks on imported maps waiting for M8, and an autosave of one map.
- Try it: `npm run dev`, generate, click **Refine this map**. The drawing tools are rectangles
  for now; M5 brings the land and water tools, M7 the resource tools.
- A terrain edit (a plateau, a moved river or start) re-runs the canonical water settle: 0.4–0.8 s
  at 256², shown as "Working…". M8 brings the warm-started preview.
- The fps numbers are capped by the display (about 129 Hz here), so they show the budget is met,
  not how far above it the view could go; the GPU time per frame shows the headroom.

## M5: set pieces, land and water tools, slopes, fixes

**Built** (branch `dev`, generator 0.3.0):
- **The set-piece builders** (`src/core/features/setpieces/`, PLAN §19.3, D47). One builder per
  kind, shared by the generator, the editor and later Claude:
  - each has hard bounds (`request`, a JSON Schema), `limits` for the map and the place, `plan`,
    `check`, `rasterize` and `footprint`, and its own springs, slopes and cleared tiles;
  - a plan reduces what the map can't take and says so in its report, for example "Width 20
    reduced to 19, the largest this map allows". The stored plan is built as it is, never planned
    again;
  - **waterfall** (D48): on a river, a bed step; standalone, a lip over a plunge pool, fed by
    springs in a header pool, with an outflow channel routed to an edge, a river or a lake
    (`src/core/features/route.ts`);
  - **dam site** (D49): the D25 ridge, planned from a river, a place and a crest. On an existing
    map it measures the reservoir a dam across its gap would hold;
  - **gorge** with a stair notch, **terraced cliffs**, and the **badwater basin** in River
    Valley's marsh mode and in its basin mode (D51).
- **Features and rasterizers:** landform edge styles (gentle, terraced, cliff) stepped from a
  stored base; lakes with a rim, a floor and a routed outlet; river banks and a gorge's narrows
  (D53, D54).
- **Slopes by §7.5** (`src/core/features/slopes.ts`, D52): the 40-tile core, targets, one slope
  for each region of 400+ tiles beyond it, 12 tiles apart. On an edited import, the ground the
  edits changed is a target.
- **River Valley** plans its dam site, its falls and its marsh with the builders (D50). The new
  slopes change every generated map, so the generator is 0.3.0: seed 4242 at 128² is now sha256
  `529d67de…`.
- **The planners behind the tools** (`src/core/doc/tools.ts`): `planRiver`, `planLake`,
  `planLandform` and `planPiece`, and `moveEdit` and `deleteEdit`, which plan a moved river, lake or
  set piece again at its new place. Each returns the operations, a label and a report. The worker
  runs them (`planTool`, `applyTool`, `moveFeature`, `deleteFeature`, `moveStartTo`, `damSites`).
- **The editor's tools** (EDITOR_PLAN §4, D55):
  - **Land**: **Hill**, **Plateau**, **Ridge**, **Canyon**, **Valley** and **Island** (drag a
    rectangle or click the corners, then pick the height and the edges), **Terraced cliffs**, and
    **Slope** (click a step to add one, a slope to remove it);
  - **Water**: **River** (click from the source to the outlet), **Lake**, **Waterfall**, **Dam
    site**, **Gorge**, **Badwater spring**, and **Show dam sites** (the 12 best);
  - every gesture is planned in the worker and shown with its report; **Place** applies it as one
    step, and a tab change puts the tool away;
  - the inspector plans a river, a lake, a landform or a set piece again with new values;
  - while the start moves, its footprint shows green or red, with the water, trees and berries in
    reach. An imported map's start moves with a handle of its own.
- **Instant validation** (D56): after every edit, the worker runs the load and design checks on
  the whole map (about 25 ms at 256²) and marks the problems in the region the edit touched. The
  problems an edit made show at once, with one-click fixes: move the start to the nearest good
  spot, and remove the slopes that join nothing.
- **Tests:**
  - `tests/contract/setpieces.test.ts`: the range tests, 17 tests;
  - `tests/contract/rivers.test.ts`: the drawn-river property test;
  - `tests/contract/properties.test.ts` now draws tool edits among its random operations
    (`randomToolEdit` in `tests/contract/randomOps.ts`): rivers, lakes, landforms, standalone and
    on-river falls, dam sites, gorges, terraced cliffs, badwater basins, moves and deletes;
  - `tests/e2e/tools.spec.ts`: the land and water tools, the inspector, the start's indicators and
    an instant fix, through the page.
- **In-game files:** `npx tsx tools/ingame-files.ts --milestone m5` writes four edited maps to
  `out/m5/`, with PNGs and `checks.txt` (below).
- **New npm dependencies:** none.

**Acceptance:**

| Criterion | Result |
|---|---|
| Feature property tests pass; drawn rivers always drain and keep their water | **pass**. `tests/contract/properties.test.ts` runs on 96², 128², 192² and 256² with tool edits among the random operations. After every step the incremental rebuild equals a full rebuild; export, re-import and undo-all hold as in M3. `tests/contract/rivers.test.ts` draws 8, 6 and 3 random rivers on 96², 128² and 256², from map edges and inland springs, to edges, other rivers and a lake. Each one drains (`water.outflow`), settles, has water along its whole course and keeps its mouth sealed, and the incremental rebuild equals a full one. Longer stress runs found no failure: 6 seeds × 8 rivers at 96² and at 128², 3 seeds × 5 rivers at 256², and 12 seeds × 70 random operations |
| A 20-wide waterfall fits on 96², 128² and 256² | **pass** (`tests/contract/setpieces.test.ts`, seeds 3, 4 and 5). The builder keeps width 20, drop 6 and 2 water/s with no reduction. After the canonical settle, 20 of 20 lip tiles carry water on each map: 0.0299 deep (0.3·S/W = 0.030), with a surface drop of 5.72, 5.80 and 5.71. Each map settles, the fall's water drains (its outflow reaches the river at 96², the map edge at 128² and 256²), and the edit makes no load problem |
| On 48² it is reduced to 19, with a report | **pass** (seed 1): planned 19 wide, with the report "Width 20 reduced to 19, the largest this map allows (40% of the map side along the lip)". The flow is reduced to the map's whole budget, 1.15 water/s, and the report says that too. 19 of 19 lip tiles carry water, 0.018 deep. The published limits follow §9.10: widths 19, 38, 51, 76 and 102 at 48², 96², 128², 192² and 256², and flow budgets 1.15, 3.03, 3.6, 4.42 and 7.21 |
| Drops above 15 are reduced | **pass**: a standalone fall asked to drop 16, 18 or 22 is planned at 15, with the report "Drop 16 reduced to 15, the largest the game's terrain allows". It builds with its lip at level 15 and a surface drop above 14. A drop above the hard bound (22) is rejected. An on-river fall asked to drop 16 is reduced to what its river's bed allows downstream, and says so |
| Lip width is measured as defined in PLAN §9.2 | **pass**: `measureLip` counts the lip tiles with water deeper than 0.001 and a drop of 1.5 or more to the tile below, and the test counts them again by hand (12 of 12). A 20-wide lip measures 20, 0.03 deep at 2 water/s and 0.12 at 8 (within 10%); a lip with no water under it measures 0 |
| River Valley batches stay ≥ 98% final pass with the new builders | **pass** (`npm run batch`, 100 seeds each, generator 0.3.0): 100% final at every size. First attempt: 97% at 96² (mean 1.03 attempts, median 156 ms a map), 97% at 128² (1.03, 245 ms), 99% at 192² (1.01, 550 ms), 99% at 256² (1.01, 1,212 ms) |
| In-game check C and F1 | **skipped for now (D11)**. The files are in `out/m5/`, and the checks are listed as pending in [ingame-log.md](ingame-log.md) with their exact coordinates: two 20-wide waterfalls (2 and 8 water/s), a dam site, and a gorge with a stair notch |

Also green:
- the full oracle (`npm run oracle`): 150 maps pass `validate.py --load-only` and the round trip,
  and validator parity on 50 generated maps (2,200 checks) and the 19 official maps shows 0
  disagreements. No check changed its rule, so the Python validator needed no change;
- Node = Chromium on 10 seeds, with generator 0.3.0;
- 225 unit and contract tests, and 43 browser tests locally (the investigation maps are absent in
  CI);
- the M1–M4 criteria: every investigation map imports, renders and exports unchanged, and the
  generate → refine → regenerate journey keeps the player's edits;
- with the §7.5 slopes, the fewest tiles walkable from the start on seeds 1–10 are 6,659 (1,300
  needed).

Page weight: the editor's own script is 16 KB and its panels 27 KB (6 KB and 9 KB gzipped); the
3D chunk is still 572 KB (143 KB gzipped); the worker is 275 KB (94 KB gzipped).

**Deviations** (the plan is updated to match): PLAN §20 D47–D56, and D34, D35 and D40 updated.
- D47: the builders' interface as built; a plan takes no random stream.
- D48: the waterfall as built. On-river falls keep their river's width: the 1–3-tile narrows wait
  for in-game check C2.
- D49: the dam site, gorge and terraced cliffs as built. The dam site keeps the D25 ridge, not the
  gorge builder.
- D50: River Valley on the builders; one premise until M9; generator 0.3.0.
- D51: the badwater basin mode is built, but `water.badwater_contained` stays not applicable: a
  source never stops, so a blocked basin only holds its badwater until it fills.
- D52: slopes by §7.5, with targets on landforms and on an import's changed ground.
- D53: the rules for drawn rivers, each from a case where water pooled, spilled or never settled.
- D54: lakes and landforms as drawn.
- D55: the editor's tools.
- D56: instant validation.

**Look at:**
- The in-game checks C1–C3, F1 and the gorge's stair notch are pending
  ([ingame-log.md](ingame-log.md)). The files are in `out/m5/`. F1 sets the waterfall flow policy
  (D6): does a 2 water/s sheet read as a waterfall, and does a wheel turn at 2 and at 8?
- Four new defaults in [decisions-pending.md](decisions-pending.md) (#11–#14):
  - what `water.badwater_contained` should check, since a source never stops;
  - whether River Valley's falls should narrow above the drop;
  - a drawn river that crosses another goes under it and takes its water;
  - River Valley keeps one premise until M9.
- Try it: `npm run dev`, generate, click **Refine this map**, and draw a river or a lake. A river
  drawn across another takes that river's water from there on; the preview's report says so.
- A drawn river ends at a map edge, in a river or in a lake. The planner refuses loops, hairpin
  turns, a course through the start's area, and a mouth near another river's mouth. The report
  says why.
- Every terrain edit still re-runs the water settle (0.4–0.8 s at 256², "Working…"). M8 brings the
  warm-started preview.

## M6: full settings, sharing, themes I

**Built** (branch `dev`, generator 0.4.0):
- **The settings move the map** (`src/core/gen/layout.ts`, D59). Every setting of PLAN §5 that
  M6 can build turns into a layout target:
  - relief sets how far the land rises above the lowest reach, and the built terrain is measured
    and shifted until its height range is within one level of `7 + 0.08·relief`;
  - terracing sets how many terrace rises are one level, highest terrain caps the land;
  - buildable land sets the valley floor's width, how jagged the terrace edges are, and where the
    cliffs go (Tight: at the valley floor's edge; Generous: above every one-level rise);
  - rivers, river style and flow set the rivers (D60); lakes and basins digs riverside ponds
    (D61); waterfalls sets the falls on the river; the drought reserve sizes the dam site's basin;
  - badwater and badwater distance place badwater basins (D62); forests, groves, species, berries,
    ruins, the start area and the five start rules set the resources.
- **Canyon and Lake Basin** as feature planners (`src/core/gen/valley.ts`, shared with River
  Valley, and `src/core/gen/lakeBasin.ts`; D63, D64). Canyon: a river in a canyon 4–6 levels deep,
  its dam site in a narrows, a stair of slopes up the wall beside the start. Lake Basin: a lake in
  the middle, rings of terraces, inflows from the edges and a dam site on the outlet. Each theme
  builds one premise until M9.
- **Badwater from the settings** (`src/core/gen/water.ts`, D62): the badwater basin builder of M5
  now places every theme's badwater, in basins of 1–3 water/s about the badwater distance + 14 tiles
  from the start. River Valley's marsh is gone.
- **Two pending rules built, in both validators** (TS and Python):
  - `water.badwater_contained` (decisions-pending #11, D57): with the outlet channel blocked, the
    water rising from each source cannot leave its basin or reach a map edge below the rim;
  - Hard's 3-deep reservoir (decisions-pending #1, D58): on Hard a dam site counts only when its
    reservoir is at least 3 deep on average. The Hard generator makes maps that pass.
- **The URL codec and share links** (`src/core/spec/codec.ts`, D65). A link carries the spec only
  (D7): the seed, theme, size, difficulty and every setting that differs from the theme's preset,
  plus the archetype, premise, set pieces, constraints and colonies (D5) when set. A value the page
  cannot use is reported and the preset's value kept. On the page: **Copy link** and **Copy seed +
  settings**.
- **The settings panel** (`src/ui/SettingsPanel.tsx`, `src/ui/settingsModel.ts`, D66): the theme
  strip (Highlands, Delta and Islands say **Coming later**), Basics, Terrain, Water, Hazards,
  Resources, Advanced start rules, the map size's limits and **Reset to the theme's settings**.
  Each control shows its band from the official maps. Guards: a drought reserve too big for the map
  is disabled with the reason, Hard with a Scarce reserve warns (D13), Many waterfalls says how many
  fit. Settings whose objects come in M7 are not offered yet.
- **The map card** shows how many badwater sources there are.
- **Tools:** `tools/settings-batch.ts` (each setting at two values, the mean of its measured target;
  the per-setting experiments live in `tools/settings-suite.ts`); `tools/batch.ts --theme --set`;
  `tools/oracle.ts --themes` (the generated maps cycle through the three themes); `tools/bench.ts
  --theme`; `tools/ingame-files.ts --milestone m6`.
- **Tests:** `tests/contract/settings.test.ts` (27 experiments, one per setting); share links in
  `tests/contract/share.test.ts` (Node) and `tests/e2e/share.spec.ts` (Chromium); the codec in
  `tests/contract/spec.test.ts` (200 random specs round-trip, bad values reported); a rim cut
  through a badwater basin fails `water.badwater_contained` (`tests/contract/validate.test.ts`).
- **In-game files:** `out/m6/`: `Canyon (4242).timber` and `Lake Basin (4242).timber`, with PNGs
  and `checks.txt` (below). Seed 4242 at 128² is now sha256 `d99fa422…` (River Valley), `e483708e…`
  (Canyon) and `58f763b0…` (Lake Basin).
- **New npm dependencies:** none.

**Acceptance:**

| Criterion | Result |
|---|---|
| Each setting moves its measured target in batch runs (a test per setting) | **pass**. `tests/contract/settings.test.ts` runs 27 experiments (seeds 1–4, 96²); `tools/settings-batch.ts` ran them on 20 seeds at 96² ([out/m6/settings-96.md](../out/m6/settings-96.md)), 10 at 128² ([settings-128.md](../out/m6/settings-128.md)) and 6 at 192² ([settings-192.md](../out/m6/settings-192.md)). At 96², low value → high value, mean of the target: Relief 20 → 90: height range 9.0 → 13.8 levels. Highest terrain 11 → 16: the highest tile 11 → 16 on every map. Terracing 10 → 90: one-level share of steps 0.680 → 0.438. Buildable land Tight → Generous: flat share 0.517 → 0.585, and land walkable from the start 2,951 → 4,641 tiles. Rivers 0 → 3: rivers entering on the edge 0 → 3 on every map. River style Straight → Meandering: meander 0.054 → 0.258 of the side. River flow Trickle → Lush: 1.82 → 12.14 water/s. Drought reserve Scarce → Plenty: water stored near the start 789 → 1,231. Lakes and basins None → Many: basins of 20+ tiles 0.3 → 4.0. Waterfalls Off → Many: bed drops of 2+ 0 → 3.8. Badwater Off → High: badwater ÷ clean 0 → 1.20. Badwater distance 20 → 50: the nearest badwater 36.5 → 85.1 tiles. Forest density 50 → 200: trees per 10k tiles 657 → 2,615. Grove size Scattered → Big woods: median grove 6.3 → 22.9. Species mix all Pine → all Birch: Birch share 0 → 1. Berries near start 20 → 100: bushes within 20 of the start 69 → 109. Berry bushes elsewhere 50 → 300: per 10k tiles 92 → 502. Ruins and scrap 25 → 300: scrap per 1k tiles 157 → 2,059. Start area Small → Large: the start's bench 82 → 194 tiles. Start rules: clean water within 8 → 20: 3.5 → 7.2 tiles; trees within 20: 20 → 120: 133 → 231 trees; living bushes within 20: 10 → 80: 51 → 102; no badwater within 15 → 50: 21.6 → 85.1 tiles; no ruins within 5 → 40: 22.9 → 48.0 tiles. Designed for Easy → Hard: water stored near the start 885 → 2,459. Theme River Valley → Lake Basin: water share 0.083 → 0.274. All 27 move at 96² and at 128². At 192² all but one move: Buildable land's flat share moves 0.029 against the 0.03 the batch asks (its walkable land moves 5,361 → 20,967) |
| Share links reproduce byte-identical files | **pass**. Node (`tests/contract/share.test.ts`): three links far from the presets (River Valley 96² with relief 80, many falls and lakes, a species mix; Canyon 128² Easy with badwater distance 45; Lake Basin 96 × 112 with 3 rivers and a large start area) decode to the same spec and the same sha256. Chromium (`tests/e2e/share.spec.ts`): opening each link generates the same sha256 as Node; the page's own **Copy link** gives the same fragment, and opening that in a fresh page gives the same bytes again. A setting changed in the panel appears in the link (`&wf=m`) |
| Batch per theme ≥ 98% final pass | **pass**. 100 seeds each, Normal, final / first attempt: River Valley 96² 100% / 92%, 128² 100% / 96%, 192² 100% / 94%, 256² 100% / 100%. Canyon 96² 100% / 98%, 128² 100% / 96%, 192² 100% / 87%, 256² 100% / 96%. Lake Basin 96² 100% / 99%, 128² 100% / 100%, 192² 100% / 100%, 256² 100% / 100%. Easy and Hard, 30 seeds at 128²: 100% final in every theme (first attempt 93–100%). Tight and Generous buildable land, 30 seeds: 100% final in every theme at 96² and 128², and in River Valley at 192² and 256² |
| In-game check (one Canyon and one Lake Basin map load; their dam site holds) | **skipped for now (D11)**. The files are in `out/m6/`, and checks M6-1a to M6-1c are pending in [ingame-log.md](ingame-log.md) with exact coordinates: the Canyon dam's 4 gap tiles and its stair, the Lake Basin dam's 5 gap tiles, and each badwater basin's outlet |

Also green:
- the full oracle (`npm run oracle`): 150 maps of the three themes pass `validate.py --load-only`
  and the round trip, and validator parity on 50 generated maps (2,200 checks) and the 19 official
  maps shows 0 disagreements. A Hard run (15 seeds at 96² and 128²) also shows 0 disagreements;
- 259 unit and contract tests, and 46 browser tests locally (Node = Chromium on 10 seeds);
- generation at 128² (River Valley): median 354 ms, max 409 ms (budget 3 s); the canonical settle
  at 256²: River Valley 946 ms, Canyon 454 ms (budget 3 s).

Page weight: the page's own script is 83 KB (30 KB gzipped) with the settings panel; the worker is
303 KB (104 KB gzipped); the 3D chunk is still 572 KB (145 KB gzipped).

**Deviations** (the plan is updated to match): PLAN §20 D57–D68, and D19, D24, D30 and D51
updated.
- D57: `water.badwater_contained` proves the outlet is the basin's only way out below its rim, not
  how long a levee holds.
- D58: Hard's 3-deep rule, and the Hard layout that passes it.
- D59: how the settings move the layout; generator 0.4.0. Flat share runs above its targets on
  bigger maps.
- D60: Rivers counts rivers entering on the edge; tributaries add a quarter of the main flow each.
- D61: Lakes and basins makes riverside ponds; a new calibration row, `basins_ge20`.
- D62: badwater basins placed from the settings, replacing River Valley's marsh.
- D63, D64: Canyon and Lake Basin as built (the terraced cliffs builder's new stair).
- D65, D66: the codec and the panel as built.
- D67: every theme still flows west to east (Lake Basin's outlet runs east).
- D68: Lake Basin's settle is over the §10 budget (1.15 s at 128², 3.0 s at 256²).

**Look at:**
- The in-game checks M6-1a to M6-1c are pending ([ingame-log.md](ingame-log.md)); the files are in
  `out/m6/`.
- Eight new defaults in [decisions-pending.md](decisions-pending.md) (#15–#22), and #1, #4 and #11
  updated: what Rivers and Lakes and basins make, the two badwater distances, Canyon's one-level
  rims, how big Lake Basin's lake is, the M7 settings left out of the panel, the targets that move
  less than their formulas, and Lake Basin's settle time.
- Try it: `npm run dev`, pick **Canyon** or **Lake Basin**, open **Water** or **Hazards**, change a
  setting and click **Generate**. **Copy link** gives a link that opens the same map.
- Bigger maps are flatter than the official ones at every Buildable land setting (0.73–0.76 flat at
  192² against 0.40–0.60). More small landforms (M9) would close it.
- A drawn river (the editor's **River** tool) is refused where it would cross a riverside pond. The
  tools test draws on a map without ponds (`&lk=0`); the planner could route round ponds or merge
  with them.
- `out/m5/` was made with generator 0.3.0. Remaking it now gives different maps; test the
  committed files.

Deployed: m6-done, 2026-09-24, live check passed (PR #2; live download = `tools/gen.ts`, sha256 `d99fa422…`).

## M7: resources, map objects, themes II

**Built** (branch `dev`, generator 0.5.0):
- **Map objects as features** (`src/core/features/objects.ts`, D69): mine sites (UndergroundRuins),
  small, medium and large relics, geothermal fields, unstable cores, and the lines: thorn belts,
  weirs (NaturalDam) and plugs (Blockage). They stand at build step 9, before the water settle, and
  one placement rule serves the generator, the editor's tools and the footprint preview.
- **Themes II** (`src/core/gen/valley.ts`, `src/core/gen/lakeBasin.ts`):
  - Highlands (D73): plateaus with cliffs all round on the terraces, and a stream from a spring on
    the highest that falls to the river;
  - Delta (D74): the river ends in a head pool, and 2–4 channels fan out across a low plain to the
    east edge. **Braided** builds the same delta in River Valley and Highlands;
  - Islands (D70): a sea of 40–48% of the map with 6–25 islands and two outlets.
- **The generator's objects and set pieces** (`src/core/gen/extras.ts`, the set-piece builders in
  `src/core/features/setpieces/`):
  - mine sites, relics, geothermal fields and thorn belts from the settings, each in its distance
    band (D75), and unstable cores under Advanced;
  - the plugged spillway (D71), on nearly every Lake Basin and Islands map;
  - NaturalDam weirs where their river's water stays in the channel (D72);
  - ruins on a plateau that one flight of stairs reaches (D76);
  - the second district's site on maps of 128² and up where one fits (D77), with a grove and
    berries round it.
- **`extras.placement`** in both validators (TS and Python, D75): level, dry ground outside flood
  reach, and the generated objects in their bands.
- **The editor's resources** (D78): forests, berry patches and ruin fields drawn as areas, with a
  preview of where plants live, where trees would stand dead and what stays bare. Ruin areas become
  fields of the calibrated shape.
- **The editor's map objects** (D79): **Mine site**, **Relic** and **Geothermal field** (Resources),
  **Thorn belt** (Land), **Weir**, **Plug** and **Plugged spillway** (Water). Every object shows its
  footprint under the pointer, green or red with the reason, and a click where it can't stand is
  refused. A river turns to badwater from its inspector, with its warnings first (D80).
- **Advanced mode** (D79): **Unstable core** and **Object** (any common object by hand); a click on
  the map opens the objects on that tile, to move, turn or delete them, set a water source's
  strength, or make it turn on in a later cycle (**Turns on later**).
- **Entity edits are held to the game's loader rules:** `placeEntity` and `moveEntity` refuse an
  object the game would delete on load (`src/core/doc/placing.ts`).
- **The settings panel** (D81): the three new themes, **Braided**, **Thorn belts**, **Unstable
  cores** (Advanced), **Relics**, **Geothermal fields** and **Mine sites**, each with its band.
- **Tools:** `tools/settings-suite.ts` has 33 experiments (six new: River style braided, Thorn belts,
  Unstable cores, Relics, Geothermal fields, Mine sites); `tools/oracle.ts` covers the six themes by
  default; `tools/ingame-files.ts --milestone m7`; `src/core/analysis/metrics.ts` counts the new
  objects for the experiments.
- **CI** runs three jobs side by side: the tests, the Python oracle (18 seeds, the six themes at
  96², 128² and 256²), and generation (the timings and the six themes' batches at 128², one process
  each).
- **Tests:** `tests/contract/objects.test.ts` (20 tests: placing, previews and refusals, weirs,
  plugs, thorn belts, resource areas, spillways, badwater rivers, the generator's objects and set
  pieces in all six themes); `tests/e2e/objects.spec.ts` (3 tests through the page: a forest's
  preview, an object red where the game would delete it and refused there, a weir, a badwater
  river's warnings, and a delayed water source in advanced mode).
- **In-game files:** `out/m7/`: `Lake Basin (4242) D objects.timber`, its PNG and `checks.txt`
  (below).
- **New npm dependencies:** none.

**Acceptance:**

| Criterion | Result |
|---|---|
| Resource areas respect moisture reach and the calibrated clustering | **pass**. `tests/contract/objects.test.ts` on a River Valley map: a forest drawn across the valley plants trees only where its preview showed green (the placed trees are exactly the preview's alive tiles, each on soil with moisture > 0), and with **Only where trees live** off, dead trees on dry ground; berry bushes only on moist ground; a ruin area becomes fields of one level, 10+ columns each, 80%+ of them in touching blobs, filling 30–95% of their box; `plants.survive`, `ruins.fields` and `ruins.access` pass after the edits. The generator's resources pass `plants.survive` and `ruins.fields` on every batch map. In the page (`tests/e2e/objects.spec.ts`), a forest's preview shows its green tiles and leaves the river bare |
| Invalid placements are previewed and refused | **pass**. One rule gives the preview and the refusal. A geothermal field over a river: `footprintCheck` shows its 9 tiles red with the reason, and planning the click is refused with the same reason; a Blockage on a slope gets the loader's reason, and `placeEntity` refuses what the loader would delete ("it can't stand there: …"; `moveEntity` too); objects on uneven ground, in rivers or at the start are refused. In the page: a medium relic over the river shows 6 red tiles and **Can't go here**, a click there shows the reason with no **Place** button and the history stays empty; on level dry ground it turns green and is placed with no problems |
| Every new object passes the placement emulation | **pass**. `entities.placement` (the loader's rules, in TS and Python) and `extras.placement` pass on every accepted generated map: the six themes at 96² with every map object on (contract test), and the 2,760 batch maps below. The full oracle: 150 maps of the six themes pass `validate.py --load-only` and the round trip, with 0 disagreements between the validators on 50 generated and 19 official maps. Objects placed in the editor pass too: each single kind, a weir, a plug, a thorn belt, an object by hand and a badwater river (contract tests), and the in-game file's 46 objects |
| Batch per theme ≥ 98% final | **pass**. 100 seeds each, Normal, final / first attempt at 96², 128², 192², 256²: River Valley 100% / 92%, 94%, 93%, 100%. Canyon 100% / 97%, 96%, 87%, 96%. Highlands 100% / 87%, 94%, 94%, 91%. Lake Basin 100% / 96%, 100%, 100%, 100%. Delta 100% / 100%, 99%, 100%, 99%. Islands 100% / 90%, 99%, 100%, 69%. Easy and Hard, 30 seeds at 128²: 100% final in every theme; first attempt 90–100%, but Islands on Hard 80% and Delta on Hard 57% (its preset reserve is Scarce, the combination D13 warns about; the batch tool's 60% first-attempt gate is for Normal) |
| In-game check D (the objects load; demolishing a spillway's plug releases its water) | **skipped for now (D11)**. The file is in `out/m7/`, and checks D1–D5 are pending in [ingame-log.md](ingame-log.md) with exact coordinates: the plug's 3 Blockage tiles, the weir's 5 NaturalDam tiles, the thorn belt, the relics, the geothermal fields and the mine sites, and the lake's expected drop (about one level, about 3,290 water) |

Also green:
- the full oracle (`npm run oracle`): 150 maps of the six themes pass `validate.py --load-only` and
  the round trip, and validator parity on 50 generated maps and the 19 official maps shows 0
  disagreements;
- 286 unit and contract tests, and 49 browser tests locally, run twice (Node = Chromium on 10
  seeds);
- generation at 128², median / max of 10 seeds: River Valley 482 / 842 ms, Canyon 253 / 387,
  Highlands 838 / 1,222, Lake Basin 696 / 862, Delta 636 / 726, Islands 1,348 / 1,506 (budget
  3 s). The canonical settle at 256², median: River Valley 653 ms, Canyon 312, Highlands 1,083,
  Lake Basin 1,689, Delta 1,565, Islands 3,689 (budget 3 s; D83).

Page weight: the page's own script is 85 KB (31 KB gzipped); the worker is 358 KB (122 KB gzipped);
the editor's chunks are 127 KB (42 KB gzipped); the 3D chunk is 560 KB (143 KB gzipped).

**Deviations** (the plan is updated to match): PLAN §20 D69–D83, and D66 updated (by D81).
- D69: map objects are features placed at build step 9, before the water settle, by one rule.
- D70, D73, D74: Islands, Highlands and Delta as built. Highlands' start is in the valley, not on
  a plateau.
- D71: the plugged spillway's plug is every channel tile beside the lake; its release is an
  estimate, not a second settle.
- D72: weirs go where their river's water stays in the channel, so they are rare in River Valley.
- D75: `extras.placement` as built; the distance bands shrink on maps under 128².
- D76: ruins on a plateau; the ridge worth tunnelling waits for M9.
- D77: the second district's site only where one fits, and without a dam site of its own.
- D78–D80: the editor's resources, objects, advanced mode and badwater toggle as built.
- D81: the settings panel; D82: generator 0.5.0; D83: Islands' settle is over the §10 budget
  (0.92 s at 128², 3.7 s at 256²).

**Look at:**
- The in-game checks D1–D5 are pending ([ingame-log.md](ingame-log.md)); the file is in `out/m7/`.
- Five new defaults in [decisions-pending.md](decisions-pending.md) (#23–#27), and #20 and #22
  updated: where weirs go, Highlands' start, the second district where none fits, the spillway's
  estimate and Islands' settle time. Lake Basin's settle is now within the budget (#22).
- Try it: `npm run dev`, pick **Highlands**, **Delta** or **Islands** and click **Generate**. Then
  **Refine this map**, open **Resources**, pick **Relic** and move the pointer over the map: the
  footprint is green where the game keeps it and red where it would delete it. Tick **Advanced**,
  click a water source, and tick **Turns on later**.
- Weirs are rare on generated River Valley maps (one river, no tributary at its preset); the
  **Weir** tool places one on any river.
- Islands at 256² passes on the first attempt 69% of the time: most retries are `start.badwater`
  (contaminated soil within 30 tiles of the start). Delta on Hard passes on the first attempt 57%
  of the time (`water.reservoir`). Both reach 100% final.
- `out/m6/` was made with generator 0.4.0. Remaking it now gives different maps; test the
  committed files.
- Fixed after M7: Lake Basin and Islands project files reopen (point bounds widened to one map side
  past each edge, −256…512; bytes unchanged; project round trip in every batch).

Deployed: m7-done, 2026-09-25, live check passed (PR #7; live download = `tools/gen.ts`, sha256 `7d976a77…`).

## After M7: plan updates and merges

On `dev` after `m7-done`. Plans only: no code, tests or tools changed.

- **`main` merged into `dev`** (eb8bac8): CLAUDE.md with the writing and deploying rules, the
  noindex deploy step and the live check.
- **PR #4 merged** (`investigation/workshop`): the study of 130 Steam Workshop maps
  ([WORKSHOP.md](../investigation/WORKSHOP.md)), and its integration plan
  ([WORKSHOP-INTEGRATION.md](../investigation/WORKSHOP-INTEGRATION.md)) adopted into ROADMAP and
  PLAN (D87), each item in the milestone it names. Kyler decided W4 (#34, badwater distances
  30 / 15 / 8) and the start thresholds (#39) in the amended Part A (D85). The other seven W
  decisions wait for Kyler (#31–#33, #35–#38): W1 Reservoir help (#31) and part of W7 (#37) keep
  the recorded decisions until Kyler answers, and #40 logs where the study conflicts with Map look.
- **PR #5 merged** (`investigation/claude`): the Claude groundwork for M12
  ([REPORT.md](../investigation/claude/REPORT.md)), and its integration plan
  ([M12-INTEGRATION.md](../investigation/claude/M12-INTEGRATION.md)) adopted into ROADMAP, PLAN
  and EDITOR_PLAN (D88–D96), merged with Kyler's M12 update: the vocabularies in M9, the rest in
  M12. P3, P5, P6 and P7 wait for Kyler (#41, #43–#45); P1 is settled by D84, and P2 is #28. #42,
  #46 and #47 log where it conflicts with D84 and D87.
- **M12 plan update** (Kyler, D84): compound requests, flow-relative places and a judgement-word
  table (both built in M9), and new suite requests; the loop's budget waits for Kyler (#28).
- **Refinement note** (Kyler): containment should look natural. A new Refinement phase in
  ROADMAP (after M11, before the design pass) lists it with Kyler's other notes: #2, #12, #13,
  #21, the river-pond crossing fix and the load checks. Its targets wait for Kyler (#29).
- **Part A, start requirements** (Kyler, D85; built at the start of M8, released with `m8-done`):
  three requirements that reject a map (clean water on the start's own level reached without
  stairs; **Minimum starting trees** and **Minimum starting bushes** within 20 tiles' walk); the
  other start rules become generation targets with advisory warnings. Also at the start of M8:
  editing generated outlines that leave the map (#30).
- **Part A amended** (Kyler, D85): thresholds by difficulty, as player settings that Designed for
  resets: water within 12 / 20 / 28 tiles' walk on the start's level, living trees 60 / 40 / 20,
  living bushes 40 / 30 / 20; badwater distances 30 / 15 / 8 as targets (W4); the start must reach
  water on its own level (D26's bench changes), with batches ≥ 98% per theme.
- **Part B, Map look** (Kyler, D86): a new step after M8, before M9. The 3D view moves closer to
  the game's look, its ground coloured by moisture; no map file changes. Released with M9 or as
  `map-look-done`.
- **New pending decisions:** #28–#47 (20 rows). #34 (W4) and #39 (the start thresholds) are
  already decided by Kyler (D85); the rest wait for Kyler, each with the default the plans follow.
  #31, #37 (in part), #40, #42, #46 and #47 are conflicts where the recorded decision stays.

## M8: water preview and background validation (with the start requirements)

**Built** (branch `dev`, generator 0.6.0):
- **The start requirements** (Kyler's Part A, D85; as built D97, D104), in both validators (TS and
  Python):
  - **Water without stairs:** a shore tile on the start's own level, reached without a slope,
    next to clean water a pump reaches (0.3 deep or more, contamination under 0.05, surface 0–2
    below the start), within 12 / 20 / 28 tiles' walk (Easy / Normal / Hard);
  - **Minimum starting trees** and **Minimum starting bushes:** 60 / 40 / 20 living Pine, Birch and
    Oak, and 40 / 30 / 20 living blueberry bushes, within 20 tiles' walk (slopes allowed);
  - walking distance (`src/core/analysis/walk.ts`, `prototype/analysis.py`): orthogonal steps 1,
    diagonals √2 only where both neighbours are level, slopes as links, from the start's 3 × 3;
  - the badwater and ruin distances, the walkable land (`start.reach`) and the stored drought water
    (`water.reservoir`) are targets now: advisory warnings that never reject a map.
    `start.reach_water` is folded into `start.water`. `start.dry` still rejects.
  - the settings panel names them **Water without stairs (tiles)**, **Minimum starting trees** and
    **Minimum starting bushes**; **Designed for** resets them; the Badwater distance range is
    8–60 and its defaults are 30 / 15 / 8. The map card lists the three under **Start
    requirements**.
- **The generator reaches them** (D97): the start's bench runs to the bank, a strip about 3 tiles
  wide from the start to the river at the bench's level (`StartParams.bank`, `bankFor`); where the
  drawn place has none, the start moves along the valley, up to 16 tiles, to one that has. Groves
  and berry patches near the start grow within its 20 tiles' walk first, and share scarce land by
  their minimums. Generator 0.6.0 (D106): every map changes, and old share links open with the
  note that the map may differ.
- **Approximate water on imports** (`src/core/analysis/mechanics.ts`, the workshop study's W6, D98):
  a cause (caves on 5%+ of tiles, sources that turn on later or aquifers with a quarter of the clean
  water, seeps with half the running water, a start under a roof) plus evidence that the settle
  disagrees with the map's own water makes the water and start checks "approximate", with the
  reason, in both validators. They pass, keep their numbers and say why; the oracle compares them
  as their own verdict.
- **Generated outlines past the map** (decisions-pending #30, D103): a generated landform's or
  lake's outline may reach one map side past each edge, and can be changed, moved and locked.
  Outlines the player draws stay on the map's tiles.
- **The editor's water preview** (`src/core/sim/preview.ts`, D99): after an edit that moves water,
  the rebuild warm-starts from the previous settled water, keeps it away from the edit, pre-fills
  round the edit and runs the exact simulation until it stops moving (one game day at most).
  Moisture and the plants on it follow.
- **Background validation** (`src/worker/session.ts`, D99): 0.7 s after the last edit the worker
  runs the canonical settle in slices of 16 ticks (`SettleRun`, the same bytes as the one-go
  settle), puts it in place of the preview's water and runs every check. A newer edit cancels it.
  The pill shows **Settling water** with its progress. Imported maps get the water and colony
  checks too (decisions-pending #9); an unedited import is settled once.
- **Export** settles canonically first, with progress in the dialog: a file never gets the
  preview's water. Problems stop it, warnings are listed and need a confirm, and approximate
  checks say why.
- **Water under roofs** (D100): on an imported map with caves or overhangs, the columns under
  roofs keep the file's own water (every slot) in the view and the export; the rest is settled. A
  notice says so when the map opens.
- **Show** (D101) in every tab: **Soil moisture**, **Badwater**, **Drought** (the analytic drought
  of PLAN §10: the water kept and the water that dries up, with the totals) and, on imports,
  **Water under roofs**, each with a legend.
- **The start's indicators** (D105): while the start moves, the page runs the validator's walks on
  the ground as it would be; the footprint is green only where the district center fits and all
  three requirements hold, with the map's own settings. The other targets show as warnings.
- **Objects on reshaped ground** (D102, the workshop study's recipes): set pieces, lakes, landforms,
  rivers and moves clear the objects on uneven or flooded ground or move them to the new ground,
  and the report says which and why.
- **Tools:** `tools/bench-preview.ts` (`npm run bench:preview`: five local edits per theme at
  256², the preview's time and its distance from the canonical settle);
  `tools/ingame-files.ts --milestone m8`; `tools/oracle.ts` compares approximate verdicts;
  `tools/settings-suite.ts` measures the three requirements (the water experiment measures the
  walk on the start's level).
- **Tests:** `tests/contract/start.test.ts` (10: each requirement, each setting moving its result,
  slopes, badwater, pump reach, dead trees, trees across a slope), `tests/contract/mechanics.test.ts`
  (4: the approximate rule, and the official maps it flags, local only),
  `tests/contract/parity.test.ts` (4: the editor's verdicts equal the generator's validator on the
  exported file; slices equal the one-go settle), `tests/contract/reshape.test.ts` (4: the
  property test below), an outline test in `tests/contract/projects.test.ts`, a roofed-water test
  in `tests/contract/import.test.ts`; `tests/e2e/start.spec.ts` (the map card and the start's
  indicators and footprint) and `tests/e2e/preview.spec.ts` (a local edit's preview time in
  Chrome at 256², Islands and Lake Basin).
- **In-game files:** `out/m8/`: `River Valley (4242) M8 preview.timber`, its PNG and `checks.txt`;
  the edited Canyon (F4) and Cozy Secret Valley (F3) are written to `out/m8/local/` from local
  copies, never committed.
- **New npm dependencies:** none.

**Acceptance:**

| Criterion | Result |
|---|---|
| Start requirements: both validators apply the three requirements and the advisory targets, with 0 disagreements on the full oracle | **pass**. `npm run oracle`: 150 maps of the six themes pass `validate.py --load-only` and the round trip; parity on 50 generated maps (2,150 checks) and the 19 official maps shows 0 disagreements. Hollows, Nomads, Oasis and Pressure report 12 approximate checks each, in both validators |
| Start requirements: the unit tests pass, and the three settings move their measured targets | **pass**. `tests/contract/start.test.ts` (10 tests): water reached only by a slope fails; water beyond the walk fails; only badwater fails; water too shallow or out of a pump's reach fails; trees or bushes below the minimum, too far away, dead or on soil that kills them fail; trees across a slope count; each of the three settings moves the result. `tools/settings-batch.ts`, 20 seeds at 96² ([out/m8/settings-96.md](../out/m8/settings-96.md)): Water without stairs 8 → 20: the walk 2.6 → 6.7 tiles; Minimum starting trees 20 → 120: 66 → 152 trees; Minimum starting bushes 10 → 80: 31 → 96 bushes. All 33 experiments move |
| Start requirements: every accepted map's start reaches water on its own level; batches ≥ 98% final per theme at the defaults, first-attempt rates beside M7's | **pass**. `start.water` rejects, so all 2,400 accepted maps reach water on the start's level. 100 seeds each, Normal: 100% final at every size in every theme. First attempt at 96², 128², 192², 256² (M7 in brackets): River Valley 98%, 99%, 100%, 100% (92, 94, 93, 100). Canyon 100% at every size (97, 96, 87, 96). Highlands 96%, 98%, 95%, 94% (87, 94, 94, 91). Lake Basin 100% at every size (96, 100, 100, 100). Delta 100%, 99%, 100%, 99% (100, 99, 100, 99). Islands 100%, 100%, 100%, 98% (90, 99, 100, 69). Easy and Hard, 30 seeds at 128²: 100% final in every theme; first attempt 87–100% (Highlands Easy 87%, Highlands Hard 93%, Canyon Hard 97%, the rest 100%; M7 had Delta Hard at 57%) |
| Start requirements: the editor's start indicators, its footprint and the map card follow the requirements (a browser test) | **pass**. `tests/e2e/start.spec.ts`: the map card lists the three with the validator's numbers and Normal's limits; **Minimum starting trees** 25 moves the card's limit; in the editor the indicators show the three with the map's settings, agree with the validator at the start's own place (the same water walk, at least its living trees and bushes) and say **The district center fits here**; walked away from the river, the footprint turns red with **Fits, but misses a start requirement** and the missed requirement marked |
| Start requirements: how many of the 11 official starts the study could measure meet the three at Normal | **5 of 11**: Canyon, Craters, Lakes, MountainRange and ThousandIslands. 8 of the 11 meet each requirement on its own (D104) |
| Outlines past the map: a generated ring that leaves the map can be edited and locked, and an unedited map's bytes don't change | **pass**. `tests/contract/projects.test.ts`: on a 96² Lake Basin map a terrace ring past the edge is locked (the export's sha256 is unchanged), a region lock is set at the map's edge, the ring is lowered one level and moved with its outline still past the edge; undoing it all gives the generator's bytes. An outline the player draws past the edge is refused ("leaves the map"); one to the tiles' outer edge (−0.5) is accepted (D103) |
| Validation parity between editor and generator | **pass**. `tests/contract/parity.test.ts` on River Valley 96², Lake Basin 128² and Islands 96²: after edits previewed with warm-started water (ground lowered beside water, a lake with its spring, a forest removed), the editor's verdicts equal the generator's validator on the exported file, check by check, and its water and bytes equal a full build. In the worker, the background check equals the one-go export check, and a newer edit drops a running check |
| A local edit re-previews in ≤ 2 s at 256² | **pass**. `npm run bench:preview` (Node, seed 1, five edits in each of the six themes): River Valley at most 0.66 s, Canyon 0.39 s, Highlands 0.81 s, Lake Basin 1.46 s, Delta 0.93 s, Islands 1.76 s (its weir). In Chrome (`tests/e2e/preview.spec.ts`, two runs): Islands 1.53–1.66 s, Lake Basin 1.41–1.51 s. The preview's water is within 0.19 deep of the canonical settle on every tile; the canonical settle follows in the background in 0.45–5.4 s |
| The export of an unedited generated map equals the generator's own file byte for byte | **pass**. `tests/contract/editor.test.ts` (the worker's export of an unedited map), `tests/contract/parity.test.ts`, the project round trip in every batch (2,400 maps rebuild the same `.timber`), and `tests/e2e/share.spec.ts` (a share link opens the same bytes in every theme) |
| Hollows, Pressure, Oasis, Nomads and Beaverome report their water checks as approximate with a reason; the other 14 official maps are unchanged | **not met as written: 4 of 5.** Hollows, Pressure, Oasis and Nomads report every water check and the start's checks as approximate, with the reason, in both validators (`tests/contract/mechanics.test.ts`, the oracle), and the other 14 have no approximate check. **Beaverome is not approximate.** It has none of the causes (no caves, no timed sources, aquifers or seeps, its start not under a roof), and our settle matches its own water within 1% of the map, exactly round the start. It fails `start.dry` because its lake stands 0.7 below the start within two tiles, which is how the map was made. The study listed it because its start could not be measured (the study's `startMeasurable` needs `start.dry` to pass), not because its water could not be shown. Tried: the causes alone (flags Spillage, Pillars and HelixMountain, whose water our settle shows within 7%, and still misses Beaverome); causes plus evidence (built, D98). Flagging Beaverome would need a reason that is not true of its water. Kyler's call: decisions-pending #48 |
| A property test places standalone waterfalls, lakes and landforms beside every kind of map object on generated maps: no object is left floating | **pass**. `tests/contract/reshape.test.ts`: on River Valley, Lake Basin and Highlands maps, each of the nine object kinds beside a waterfall, a lake and a landform at random offsets (15+ edits per map, some moving or clearing objects): no object fails the loader's rules or its ground, and the report says which objects moved or were cleared (D102) |
| In-game check (the preview against the game on three edited maps, including F4 and F3) | **skipped for now (D11)**. `out/m8/` has the River Valley map with a lake, lowered ground and a weir; the edited Canyon (F4, roofed water) and Cozy Secret Valley (F3, pre-1.0) are written locally to `out/m8/local/`. Checks M8-1a to M8-1c are pending in [ingame-log.md](ingame-log.md) |

Also green:
- the full oracle (above), in 22.7 minutes locally;
- 338 unit and contract tests, and 52 browser tests locally, run twice (Node = Chromium on 10
  seeds; every investigation map imports, renders and exports unchanged);
- generation at 128², median / max of 10 seeds: River Valley 607 / 1,165 ms, Canyon 213 / 289,
  Highlands 1,009 / 1,990, Lake Basin 892 / 1,011, Delta 712 / 923, Islands 1,783 / 1,908 (budget
  3 s). The canonical settle at 256², median: River Valley 844 ms, Canyon 430, Highlands 1,446,
  Lake Basin 2,349, Delta 2,239, Islands 5,159 (budget 3 s; D83). The settle code is no slower
  than M7's on the same maps (Islands 5.2 s against 5.4 s). Local times vary with the machine's
  state: on CI the River Valley settle is 1.06 s now, and was 1.40 s at M7's last run.

Page weight: the page's own script is 94 KB (32 KB gzipped); the worker is 376 KB (128 KB gzipped);
the editor's chunks are 136 KB (45 KB gzipped); the 3D chunk is unchanged at 560 KB (143 KB
gzipped).

Tests whose expectations changed because Kyler changed the rules (D85); none was deleted:
- `tests/contract/features.test.ts`: a generated map may warn on `start.badwater`, `start.reach`,
  `start.ruins_clear`, `plants.drought` and `water.reservoir` (only `plants.drought` before): D85
  made the other four targets.
- `tests/contract/validate.test.ts`: `start.reach_water` left the list of checks: D85's water
  requirement folds it into `start.water`.
- `tests/contract/editor.test.ts`: an import's colony checks now run (`playability` true, and its
  export is awaited and byte-equal), decisions-pending #9 as M8 built it.
- `tests/unit/editor.test.ts`: a moved start's patch includes `bank: null` where no river is near
  (D97: the bench runs to the bank).
- `tests/e2e/tools.spec.ts`: the indicators' text is the three requirements (**Starting trees**,
  **Fits, but misses a start requirement**).
- `tests/contract/objects.test.ts`: generator 0.6.0 moved the start, so the every-object map is
  seed 13 (was 11), and the second-district sample is Lake Basin 3 and River Valley 2 (were 1 and
  1): maps where the objects and the site still fit. The checks are the same.

**Deviations** (the plan is updated to match): PLAN §20 D97–D106; D26 and D40 changed.
- D97: the start's bench runs to the bank (D26 changes), and near-start plants grow within the
  walk first.
- D98: the approximate rule needs evidence as well as a cause; Beaverome is not flagged (#48).
- D99: the preview's settle stops on a tolerance, one game day at most; the canonical settle runs
  in slices in the background and before export.
- D100: water under roofs keeps the file's water (D40 changes).
- D101: the layers are one **Show** menu.
- D102: objects on reshaped ground move or are cleared (#47's default).
- D103: player outlines reach the tiles' outer edge (−0.5); generated ones a map side past it.
- D104: the requirements' details: the walk to the shore tile; Pine, Birch and Oak as trees.
- D105: the start's indicators count plants that are not dead; the validator judges living.
- D106: generator 0.6.0; 0.5.0 share links open with the note that the map may differ.

**Look at:**
- Beaverome: M8's acceptance lists it as approximate, and it is not (above). Decide
  [decisions-pending #48](decisions-pending.md): keep `start.dry` as it is, or count only water on
  or above the start's level.
- The in-game checks M8-1a to M8-1c are pending ([ingame-log.md](ingame-log.md)). The Canyon and
  Cozy Secret Valley files come from your own copies: run
  `npx tsx tools/ingame-files.ts --milestone m8` and look in `out/m8/local/`.
- Try it: `npm run dev`, generate a map and read **Start requirements** on the map card. Then
  **Refine this map** and lower some ground beside the river: the water moves within a second or
  two, and the pill shows **Settling water** before **Ready to play**. Pick **Show → Drought**.
  Drag the start away from the river and watch its footprint turn red.
- Every generated map changed with 0.6.0. `out/m6/` and `out/m7/` were made with older
  generators: test the committed files.
- The preview is approximate by design: after a weir on a Delta map it differs from the exact
  settle by at most 0.1 deep (594 tiles wet in one and dry in the other) until the background
  check replaces it, about 2 s later.
- Islands' canonical settle at 256² is still over the 3 s budget (5.2 s median here, D83). The
  editor runs it in the background, and waits for it only on export.

Deployed: m8-done, 2026-09-25, live check passed (PR #8; live download = `tools/gen.ts`, sha256 `5118b6a6…`).

## After M8: Kyler's decisions and the M9 design step

- Kyler decided #48 (PLAN §20 D107): Beaverome is off M8's approximate-water list; M8's acceptance names four maps; `start.dry` stays as built.
- Refinement list: the load checks are defined (keep a load check only where the game rejects or breaks the map), and `start.dry` for lakeside starts is added, to be measured first.
- Product principle recorded (PLAN, Product principles; D108): maps are created, not copied. An M9 design step comes before M9 (D109).

## Map look

**Built** (branch `dev`; no map file changes, so the generator stays 0.6.0). The 3D view looks
much closer to Timberborn, and every map meaning stays readable (PLAN §20 D86, D110). The first
independent review failed on ten findings; the fix round below (D114) answers them. Kyler's ten
in-game reference screenshots arrived during the step (ML-1, kept on Kyler's machine only) and
set the ground, walls, water, light and models:
- **Ground by soil** (`src/render3d/palette.ts`, `materials.ts`): moist ground a vivid
  yellow-green grass whose edge bleeds onto the earth in patches; dry ground cracked earth, warm
  grey-brown, violet in shadow (Kyler's correction to Delivers 1: not sandy); contaminated
  ground rusty red-brown with glowing cracks; a dark bed under water. Soil blends between tiles
  of one height, never over a cliff, and each tile's middle shows its own soil. **Height
  colours** switches the tops back to the height ramp; the browser remembers the choice.
- **Walls:** dark charcoal-green cobbles, with a groove and a change of shade at every level so
  levels can be counted, and a lip of the top's ground.
- **Light, baked when the mesh is built** (`src/render3d/light.ts`): sky visibility per tile,
  and soft sun shadows from two sweeps (the sun 6° higher and lower), cast by the ground, trees,
  ruins and the start. The shader adds contact shadows at the foot of walls, a blue-grey haze far
  off and a warm grade. The same map always bakes the same bytes.
- **Water:** teal to navy by depth, see-through near the shore; ripples, pale streaks and small
  glints that move at up to 30 frames a second (still for reduced motion, in software rendering,
  and when the view is hidden); a foam line on shores; falls drawn down the cliff to the lower
  water, with white water down them and below. Badwater is murky red-brown with slow glowing
  veins, and blends into clean water where they meet.
- **Models**, our own (`src/render3d/entities3d.ts`): pine, birch, oak and succulent, dead ones
  bare and pale; berry bushes dark green with blue flowers; ruins as rusty scaffold storeys with
  beige panels, one per level, with ivy on moist ground; a timber lodge with a banner for the
  district center, its door toward the entrance; badwater sources a brown swirl in a pit; mine
  sites a square pit in an orange frame; slopes with two chevrons pointing uphill.
- **Camera:** the default is the game's angle, 30° east of north and 70° down (the game's camera
  settings), over the whole map (decisions-pending #49).
- **No image files:** the patterns (noise, cracks, cobbles) are drawn once by a shader into a
  small tiling texture when the view starts.
- **Software rendering:** where the browser draws WebGL in software (CI's SwiftShader, a machine
  without a GPU), the view drops multisampling, the patterns, the shadows and the soil's
  blending, uses models of a few triangles (dead trees still bare), and the water holds still.
  It then draws faster than before Map look: 36 frames a second in SwiftShader here, against 22.
  The full look had halved CI's software frame rate, and `render3d.spec.ts`'s orbit failed once
  (4 frames in 1.5 s); this fixed it.
- **The page:** a legend on the 3D view says what each colour means; the hover text names the
  soil (moist, dry, contaminated); the generator's 3D preview marks the best dam site, as the 2D
  preview does. The worker sends the soil with the water, so the ground follows both of an edit's
  water updates (M8). Imported maps show the soil their file stores.
- **Tools:** `tools/capture-look.ts` (the captures, their greyscale and colour-blind versions,
  and [map-look/captures.md](map-look/captures.md)); `npm run bench:3d` takes `--configs`,
  `--maps`, `--seeds` and `--out`, and keeps covered windows drawing.
- **Tests:**
  - `tests/unit/look.test.ts` (17): the soil colours and their order in greyscale, the legend,
    wall bands, baked light and its determinism, water foam flags, models by species and dead
    state, the light models, a file's soil, the hover text;
  - `tests/contract/look.test.ts` (2): the soil comes with the map and with both water updates,
    and an import shows its own soil;
  - `tests/e2e/look.spec.ts` (2): the legend, **Height colours** and its memory, the hover text,
    the game's camera, the worker's soil in the editor, still water for reduced motion.
- **New npm dependencies:** none.

**Acceptance:**

| Criterion | Result |
|---|---|
| Before and after captures of the same maps from the same camera angles | **pass**. Seed 4242 in all six themes at 128², River Valley 4242 at 256², and Beavertopia: 4 poses each (overview; the start; the badwater, where it meets clean water on maps that have that; the tallest waterfall, from downstream; Delta has no fall), plus the page's own view from its default camera. The before captures come from `m8-done` (cfa5990) through a worktree, with the same tool and poses. 28 before and 28 after for our maps in [map-look/](map-look/) (Beavertopia's 8 stay in `.scratch/map-look/`, never committed) |
| Greyscale and colour-blind versions of the after captures | **pass**. 84 for our maps (greyscale, protanopia, deuteranopia, tritanopia of every pose but the falls; Machado, Oliveira and Fernandes 2009 at full severity, in linear RGB), and 12 for Beavertopia, locally |
| A reviewer can tell each meaning apart in the after captures | **for the independent reviewer**. [map-look/captures.md](map-look/captures.md) lists every capture and, for each, up to three tiles of each meaning with their positions in the image: water, badwater, badwater meeting clean water, moist, dry and contaminated ground, contaminated beside moist ground, living and dead trees, the start, slopes and the way they rise, dam sites. The colours are chosen so the meanings also differ in brightness and pattern: moist grass is the lightest ground, dry earth darker with dark cracks, contaminated earth darkest with light cracks, and badwater darker than clean water of the same depth (a unit test checks the order) |
| Build under 1.5 s at 256² | **pass**. `npm run bench:3d` in D46's three setups, 15 maps at 256² (3 generated, 12 official and workshop): worst 482 ms (Beavertopia, 795,730 triangles, on the integrated Radeon with the CPU 4× slower on a 1080p laptop screen at 150%), median 324 ms in that setup; on the RTX 4080, median 112 ms and worst 265 ms. M4 had 445 ms worst. Results: [out/map-look/bench3d.json](../out/map-look/bench3d.json) |
| 60 fps on the integrated GPU with the CPU slowed 4×, including Beavertopia | **pass**. Every map orbits at 111 fps or more in every setup (the display ran at 127–129 Hz). With the CPU 4× slower on the Radeon, the slowest is Beavertopia at 111 fps, and 14 of 15,222 frames took longer than 1/60 s (15 of 45,924 in all three setups; M4 had none). The Radeon needs at most 8.23 ms per frame (median; 9.01 ms at the 95th percentile), for Beavertopia, against 4.3 ms before Map look. A first run while other agents' batches kept the CPU at 100% passed too (worst build 828 ms, slowest orbit 86 fps) |
| The 3D chunk stays lazy-loaded; its size | **pass**. `View3D` is loaded only by **3D** or the editor, as before: 560.26 KB (143.46 KB gzipped) before, 588.27 KB (153.13 KB gzipped) after. The page's own script is unchanged (93.89 KB) |
| Every existing test passes unchanged | **pass**. No existing test was changed. Typecheck passes; the 357 unit and contract tests pass (28 files, 185 s); the 54 browser tests pass, twice in a row; CI passes (below). Earlier, while other agents kept the CPU at 100%, six heavy tests hit vitest's 120 s timeout and `tests/e2e/preview.spec.ts` went over its 2 s local budget for an edit; the same browser test on `m8-done` went over it under that load too, and the worker's time for the same Islands edit was equal before and after (1.85 and 1.87 s against 1.86 and 1.76 s). On the quieter machine every one passes |
| No map file changes: every sha256 equal | **pass**. No generation, validation or format output code changed (`src/core`: only a new reader of a file's soil and a session method that calls it). The golden water hashes, Node = Chromium (`determinism.spec.ts`), share links (`share.spec.ts`), every investigation map exporting unchanged (`maps.spec.ts`) and the oracle's generated maps pass |
| The 2D preview keeps its height colours | **pass**. `src/core/render/shade.ts` is unchanged |

Also green:
- CI (run 36131877903, on the last code change): typecheck, 345 unit and contract tests (12
  local-only skipped), the build, 21 browser tests (Node = Chromium on 10 seeds, share links),
  the oracle on 18 seeds, the generation times and pass rates. In CI's software rendering the 3D view now draws 8 frames a
  second, against 5 before Map look.
- The full oracle (`npm run oracle`): 150 maps of the six themes pass `validate.py --load-only`
  and the round trip; parity on 50 generated and 19 official maps shows 0 disagreements.

Page weight: the 3D chunk grows by 28 KB (10 KB gzipped): the shaders, the models and the baking.

**Deviations** (the plan is updated to match): PLAN §20 D110.
- D110: Map look as built, with Kyler's correction from his reference (dry ground is cracked
  earth, not sandy; ROADMAP Delivers 1 changed to his wording). Beyond D86's list: ruins are
  rusty scaffolds (Kyler's reference) rather than scrap heaps; the tile grid is gone; the
  patterns are drawn by a shader into a texture once; a lighter look where the browser draws
  in software; the 3D preview marks the best dam site; the default camera frames the whole map
  (#49).

**Look at:**
- Try it: `npm run dev`, generate a map and click **3D**. The legend is at the bottom right;
  **Height colours** switches the ground. **Refine this map** shows the same look in the editor.
- Compare it with the game on the same map: in-game check ML-2 is pending in
  [ingame-log.md](ingame-log.md).
- The default camera shows the whole map at the game's angle (#49). The game starts close on the
  district center.
- Other agents' batches kept this machine's CPU at 100% for most of the step. The final
  benchmark and test runs were made once it was quieter.

### Review fix round (PLAN §20 D114)

The first independent review of the captures failed on ten findings, so Map look was not tagged.
The fix round, on `dev` after the orchestrator's b879dfa, answers each; a fresh reviewer judges the
new captures. Where readability and Kyler's reference conflict, readability wins (D114).
1. **Dead trees** could not be seen from afar, and ruins looked like bare trees. Dead trees are
   now ashen: a nearly white trunk, a bleached body of bare wood and spiky branches poking out of
   it. From afar they grow, to at least 16 pixels per unit, up to 4 times. Ruins are solid rusty
   storeys with dark posts and a dark rim.
2. **Dam sites** faded on moist ground in protanopia and in greyscale, and shared orange with
   other objects. An overlay tile with alpha 255 is now hatched light yellow and near-black, with a
   dark rim just outside; from afar it is solid light with the rim. The editor's dam sites and the
   preview's best dam site use it. The legend names mine sites and geothermal fields.
3. **Beavertopia's contamination:** the view was right and the listing wrong. The file keeps soil
   for each column of a tile, and the tool took the highest value of any slot. At (96, 165),
   slot 0 is a badwater tunnel under the top (floor 5, contamination 1.0); the top, at 11, is
   dry. The listing now reads what the view draws. The pinkish zone was badwater's foam over
   badwater cascading down terraces; badwater now keeps only a thin shore line. The flat dark
   tiles were floors under overhangs (slabs with water on top), drawn with the top's under-water
   colour; they now show the top's soil in shade. The red-brown object came from a listing that
   pointed at the tree's foot; examples now point at the tree's crown.
4. **Slopes:** pale arrows rimmed dark, which grow from afar (to 30 pixels per unit, up to
   5 times) and rise over the ramp. The legend says they point uphill.
5. **Badwater:** near-black red, well darker than clean water at any depth and than contaminated
   ground. It keeps the ripples and reflections of water, with slow glowing bubbles. Water mixed
   with badwater is streaked with it, the streaks covering about the bad share. Ripples calm
   down from afar, so far water no longer shimmers.
6. **Moist and dry in greyscale:** moist grass lighter, dry earth darker; shadows keep about four
   fifths of the light (about half before), and the haze is lighter.
7. **The start:** pale walls, a dark roof and a pale deck, growing from afar (up to 3 times).
8. **Levels:** lighter grey-green walls in faint cobbles, every other level darker, a pale ledge
   and a dark groove at each level, each at least a pixel wide. Falls are a see-through veil.
9. **Legend:** every meaning, with small pictures, in two columns, and a note that dead trees,
   slope arrows and the start are drawn larger from afar. Its seven ground, water and wall
   swatches differ in greyscale by at least 8 L*: badwater 19, contaminated 33, dry 43, walls 51,
   water 65, moist 73, dead trees 94. It lets clicks through to the map, and the editor starts it
   closed.
10. **Positions:** the listing reads the renderer's own state. Each example is the visible point,
   checked by picking, with no object on the tiles in front of it.

Also: birch crowns are darker, so living trees stay dark against the grass. Objects are lit a
little more. Where the browser draws in software (the light look), a dead tree is a pale trunk, a
bleached body and one branch, nothing grows from afar, and a dam site is plain yellow, so the light
look stays light: 77,164 triangles for the render test's 256² map (62,008 before the fix round),
and a frame in SwiftShader on this machine takes 26 ms (25 ms before).

**Acceptance, after the fix round:**
- **Captures:** 28 after captures of our maps and 108 greyscale and colour-blind versions (the
  falls now have them too), plus Beavertopia's 4 and 16, locally. Every pose's camera is the
  before run's, checked equal.
- **Budgets** (`npm run bench:3d`, D46's three setups, 15 maps at 256²; results in
  [out/map-look/bench3d.json](../out/map-look/bench3d.json)): **pass**.
  - Build: worst 529 ms (the run's first map, on the integrated Radeon with the CPU 4× slower),
    median 342 ms in that setup. On the RTX 4080: median 113 ms.
  - Orbit: every map at 100 fps or more in every setup. The slowest is Beavertopia on the Radeon
    with the CPU 4× slower (834,319 triangles; 795,730 before). 60 of 46,158 frames took longer
    than 1/60 s in all three setups (15 before).
  - GPU: the Radeon needs 9.23 ms per frame for Beavertopia (median; 10.07 ms at the 95th
    percentile), against 8.23 ms before the fix round. An A/B on this machine puts the fix
    round's cost at about 1 ms (8.21 against 9.22 ms).
- **Chunk:** `View3D` stays lazy-loaded: 596.71 KB (155.71 KB gzipped), against 588.27 KB
  (153.13 KB) after the first round and 560.26 KB (143.46 KB) before Map look. The page's own
  script is 93.92 KB (93.89 KB before).
- **Tests:** no existing test changed. Typecheck passes. The 363 unit and contract tests pass
  (29 files, 173 s), with `tests/unit/look-readable.test.ts` new (6: the order of lightness, the
  dam sites' hatch and its marks, minimum sizes, ashen dead trees, the legend). The 55 browser
  tests pass twice in a row, with `tests/e2e/look-readable.spec.ts` new (the legend's lines, the
  hatched best dam site). The larger legend first covered the map where three browser tests drag
  and click in the editor; it now lets clicks through, and the editor starts it closed.
- **No map file changes:** no generation, validation or format code changed, and every sha256
  stays equal.
- **CI:** green on the last code change (run 36156488581): typecheck, 351 unit and contract tests
  (12 local-only skipped), the build, 22 browser tests, the oracle and the generation checks. In
  CI's software rendering the render test's orbit draws 6 frames a second (8 and 9 after the first
  round, 4 and 5 on the fix round's first two commits; the test needs more than 5 frames in
  1.5 s).

**Look at:** where readability won over Kyler's reference: lighter walls, lighter shadows, solid
ruins, near-black badwater, and dead trees, slope arrows and the start drawn larger from afar
(`npm run dev`, generate a map, **3D**).

### Map look: independent reviews (not tagged yet)

- **First review: FAIL.** Dead trees, dam sites on moist ground (protanopia, greyscale), water vs
  badwater in greyscale, Beavertopia's listed contamination, slopes in overviews, tall-cliff level
  bands, the legend, and `captures.md` positions. The fix round addressed all ten findings (D114).
- **Second review, fresh reviewer: FAIL, narrowly** (2026-09-25). The core meanings read in all
  five variants (colour, greyscale, protanopia, deuteranopia, tritanopia), and every after capture
  is easier to read than its before. What fails:
  1. badwater meeting clean water is in no capture (`captures.md` marks it "not in view" for every
     pose);
  2. partly bad water at a low share (24–25%) can't be told from clean water in the Beavertopia
     overview (ΔE 4, no lightness difference; identical in greyscale), and 39–55% tiles in the
     River Valley 256² overview look plain blue at the listed points;
  3. slopes: the three listed slopes in the Beavertopia overview are 2–4 px specks with no arrow;
     two close-up slopes are slivers with no readable direction (River Valley 128² start (59,58),
     Highlands badwater (50,86)); arrows facing the camera flatten into a thin V, and some sit
     under dam-site markers;
  4. at 18 listed tall-cliff positions no wall is visible (under water, facing away, behind a
     waterfall); Lake Basin start and Islands falls show no countable tall cliff.
  Also noted: clean water and dry ground have almost the same lightness in greyscale (gap 0–3);
  dam-site markers and dead-tree clusters cover water and slope arrows in overviews; the Lake
  Basin overview's badwater fall reads as a dark tower; waterfalls render as a patchwork; the
  legend's "drawn larger from afar" note leaves out dam sites; several `captures.md` examples sit
  under dam-site markers or beside the thing they name. CI's software-rendered orbit test now
  has a thin margin (5–6 fps against more than 5 frames in 1.5 s) and failed once on PRs #11 and
  #12.
- Kyler's rule: one more fix round on these reasons, then a fresh blind review; if that fails
  too, stop and report.
- **Third fix round** (PLAN §20 D115, 2026-09-25). Kyler then chose a lighter process: no more
  blind reviews (he judges the look from the captures), and the 3D benchmark is information only.
  1. badwater meeting clean water has its own **meets** pose (River Valley 4242 at 256², where
     badwater flows into the river, and Beavertopia), and `captures.md` lists the meeting in it;
  2. water partly bad shows its own tile's share, murkier than clean water all over and streaked
     as densely as it is bad (never all of it): at 24–25% it is 7 or more L* darker than clean
     water at the listed points, in every variant;
  3. a slope's arrow is level and floats just above the slope, pointing uphill, so it reads from
     any angle and above dam sites' markers; from afar it grows up to 6 times (in Beavertopia's
     overview the arrows are about 15–20 px long); the listed positions now fall on the arrows
     (the tool had put them up to 0.7 of a level too high);
  4. `captures.md` lists only dry tall cliffs that face the camera, that the view shows first,
     with at least 6 px a level, and says where a pose has none; every map has a **cliff** pose
     at its tallest dry cliff (3 to 15 levels, 23–43 px a level).

  Also: clean water is lighter (8 or more L* above dry ground at every listed point, 13 at the
  median); dead trees grow at most 2.5 times and a dam site's rim is thinner; falls are a
  see-through veil with no sky patches, and white water only where they come down; badwater
  shows flow streaks; ruins are grey-brown metal; the legend says dam sites are drawn wider; no
  example sits under a dam site's marker, under the start as drawn, or in the far haze.
  CI's margin: the light look now bakes all of a model's objects into one mesh, drawn once. A
  256² frame in SwiftShader here takes 10 ms, against 30 ms before this round and 47 ms at
  `m8-done`. CI's software-rendered orbit: 12 frames a second (run 36177455299), against 5–6 before
  this round and 5 at `m8-done`; the test needs more than 5 frames in 1.5 s.
  Captures: 42 before and after pairs (with `meets` and `cliff`, their befores made on `m8-done`'s
  code): 36 after captures of our maps (with the editor's own view) and 140 greyscale and
  colour-blind versions, and Beavertopia's 6 and 24 locally. The benchmark, for information
  (`npm run bench:3d`, three setups, 15 maps): worst build 626 ms (Beavertopia, integrated GPU,
  CPU 4× slower; median 360 ms there), slowest orbit 100 fps; 67 of 56,330 frames over 1/60 s.
  `View3D` is 598.17 KB (156.24 KB gzipped). No existing test changed; typecheck passes; the 368
  unit and contract tests pass (30 files, with `tests/unit/look-water-slopes.test.ts` new). The
  browser tests: 54 of 55 pass in each full run; `tests/e2e/preview.spec.ts`'s Islands edit goes
  over its 2 s local budget (2.1–2.4 s) while other agents keep this machine busy, for the second
  round's code too (the same full run on it: 2.3 s), and passes run alone (1.5–1.8 s, both).

## After Map look: Kyler's decisions

- No built dam walls (PLAN §20 D111): the dam-site ridge goes away from M9a on; `water.storage_possible` replaces `water.reservoir`; supersedes D25, D30, D58; settles #31.
- The M9 design's gate is the objective measures, simulated play and ten one-page briefs; Kyler approves design version 2; M9a needs Kyler's play test of two maps before any public release; permanent checks after M9 (D112).
- A Frame pass step after the M9 build and before M10, released as `frame-pass-done` (D113; CLAUDE.md's Deploying rules).

---

## What Kyler needs to do

Things the run can't do itself. Each has the exact steps.

1. **Decide #48** (Beaverome's start) in [decisions-pending.md](decisions-pending.md). It is the
   one M8 acceptance item not met as written, and the run waits on it. (GitHub Pages is on since
   2026-09-24: <https://timbermods.github.io/dam-good-maps/>, deployed from `main`.)
2. **Play the pending in-game checks** when you're ready. See [ingame-log.md](ingame-log.md). M2
   adds B1–B4 (files in `out/m2/`): the first time pre-filled water meets the real game. M5 adds
   C1–C3, F1 and the gorge's stair notch (files in `out/m5/`). M6 adds M6-1a to M6-1c: a Canyon
   and a Lake Basin map, their dam sites and their badwater basins (files in `out/m6/`). M7 adds D1–D5: one Lake Basin map with every 1.0 object;
   demolish the spillway's plug and watch the lake drop (files in `out/m7/`). M8 adds M8-1a to
   M8-1c: compare the editor's water with the game on three edited maps (a River Valley map in
   `out/m8/`; Canyon and Cozy Secret Valley made from your own copies with
   `npx tsx tools/ingame-files.ts --milestone m8`, in `out/m8/local/`).
3. **Answer the pending decisions** in [decisions-pending.md](decisions-pending.md) when convenient;
   the run went ahead with the defaults listed there. #48 (Beaverome's start) decides the one M8
   acceptance item that is not met as written.
4. **Run the delivery spike page** (M3). It needs your claude.ai account and your consent, so the
   run leaves it to you. It takes about ten minutes.
   1. Open <https://claude.ai/artifact/Dkm1eoXZ6KvPwjBBc6JiRp> while signed in to claude.ai.
   2. **Check 1** runs by itself. Wait for the **Blob worker** chip to turn green (**Passed**).
   3. **Check 2:** click **Choose a .timber** and pick any map from `Documents\Timberborn\Maps`.
      Also try a map from a workshop folder if you like. The **Open a .timber** chip should turn
      green, and the box below it should describe the map.
   4. **Check 3:** click **Save the .zip**. Claude asks you to confirm the save: accept it.
      `River Valley (4242).zip` should appear in your downloads, with `River Valley (4242).timber`
      inside. Then click **Try a bare .timber** and note the message under the buttons. The
      expected answer is `rejected_extension`.
   5. **Check 4:** click **Ask on the quick tier**. The first time, Claude asks whether this
      artifact may use Claude on your plan: allow it. Wait until the chip turns green or red.
      Then click **Ask on the default tier** and wait again; that one can take a minute or two.
   6. Click **Copy results**. Paste the JSON into [docs/spike-m3.md](spike-m3.md), in the
      "Kyler's run" section. Fill in that table too: first-text and total times, the number of
      tool calls, and whether each answer was right.
   7. **Sharing.** Open the page's **Share** menu and note every option it offers. If it says a
      public link is unavailable, copy the reason it gives.
      - If someone else is on your plan or in your organization, share the page with them. Ask
        them to open it and wait for check 1. Record whether it opened for them.
      - If **Anyone with the link** is offered, turn it on. Open the link in a private browser
        window where you are not signed in, and record what you see: a sign-in wall, or the
        page with check 1 running. Turn public sharing off again afterwards if you prefer.
   8. Record the sharing results in the same table (rows 5a–5c). If anything fails, the
      page's box for that check says why.
