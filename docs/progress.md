# Progress

Overnight runs of 2026-09-24 on branch `dev`: run 1 checked M1 and built M2–M4; run 2 builds M5–M11. Each milestone is
tagged `m<N>-done` when all of its acceptance criteria pass.

## Run summary

**Run 1 (M1 check, then M2–M4) finished on 2026-09-24. Every milestone passed.**

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

---

## What Kyler needs to do

Things the run can't do itself. Each has the exact steps.

1. **Turn on GitHub Pages from Actions.** Pages is a repository setting, so the run leaves it to
   you. On <https://github.com/timbermods/dam-good-maps/settings/pages>, under **Build and
   deployment → Source**, choose **GitHub Actions**. Then either merge `dev` into `main` or
   start the workflow by hand: Actions → "Deploy to GitHub Pages" → Run workflow → branch
   `main`. The site appears at <https://timbermods.github.io/dam-good-maps/>. The workflow only
   deploys `main` (D23).
2. **Play the pending in-game checks** when you're ready. See [ingame-log.md](ingame-log.md). M2
   adds B1–B4 (files in `out/m2/`): the first time pre-filled water meets the real game. M5 adds
   C1–C3, F1 and the gorge's stair notch (files in `out/m5/`). M6 adds M6-1a to M6-1c: a Canyon
   and a Lake Basin map, their dam sites and their badwater basins (files in `out/m6/`). M7 adds D1–D5: one Lake Basin map with every 1.0 object;
   demolish the spillway's plug and watch the lake drop (files in `out/m7/`).
3. **Answer the pending decisions** in [decisions-pending.md](decisions-pending.md) when convenient;
   the run went ahead with the defaults listed there.
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
