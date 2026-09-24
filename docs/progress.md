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
