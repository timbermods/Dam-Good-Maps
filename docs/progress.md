# Progress

Overnight run of 2026-09-24: M1 check, then M2, M3 and M4 on branch `dev`. Each milestone is
tagged `m<N>-done` when all of its acceptance criteria pass.

<!-- RUN SUMMARY: written at the end of the run -->

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
   adds B1–B4 (files in `out/m2/`): the first time pre-filled water meets the real game.
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
