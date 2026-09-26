# DGM Probe: integration proposals

Proposals only. Nothing here changes the plans, the milestone run or the checks until Kyler decides.

## 1. Where the probe lives

- **`tools/probe/`** for the runner and **`mod/probe/`** for the mod, both on `dev`. The runner reuses
  `src/core` (the file reader, the generator, the importer), as the other tools do, and its commands join
  `package.json` (`npm run probe`, `npm run probe:smoke`).
- **The cycle model moves to `src/core/sim/cycles/`** when Weather integration lands (the cycles study's
  own INTEGRATION.md). Until then the probe keeps taking it from `investigation/cycles-exact` at a fixed
  commit, into an ignored cache.
- **Outputs stay local.** Results, screenshots and the contact sheet stay in
  `Documents\Timberborn\DGMProbe\`. A run's `summary.md` (numbers only, no game images) may be committed
  as the milestone's record, in `out/<milestone>/probe.md`.
- **The mod is never published** and never ships with the site. It is built on the machine that runs it.

## 2. The milestone run

- **After every milestone that changes maps** (the generator, the editor's export, validation that
  decides what a file holds), the run ends with a probe batch of that milestone's check files, the Map
  look maps and the calibration games. It runs after the automated gate passes, before the tag.
- **Consent stays per launch.** The run prepares the batch, prints the plan and its one-time code, and
  asks Kyler; it launches only after his yes. While it waits, it carries on with everything that does
  not need the game.
- **A failed probe check blocks the tag** the way a failed test does, unless Kyler waives it: it becomes
  an issue and, if it changes a rule, a PLAN §20 decision.
- **M9a's in-game gate.** D112 asks for Kyler's play test of two maps before any public release. The probe
  goes first: every M9a design map through a Normal drought and a badtide, with its brief's claims checked
  against the game (the start's water, how long it lasts). Kyler then plays the two maps the probe picks as
  the most different from the model, or any he chooses.
- **Machine etiquette.** A full batch waits until no heavy process of another session runs, as it does
  now, and reports its time in the summary.
- **Where launches run.** A Code-tab session cannot switch the game's mods (its shell sees a private copy of
  the registry), so a milestone run launches with the installed mods (`--keep-mods`) and checks the settings
  from outside afterwards. A batch of the unmodified game runs from Kyler's own terminal.

## 3. How results reach the project's records

- **`docs/ingame-log.md`.** The runner writes a proposed status for every pending check it decides:
  **pass (probe)** or **fail (probe)** with the date, the run id and the numbers, in the log's own words.
  A person applies it (the log stays hand-edited). Checks that need building, walking or the editor stay
  pending until the bot colony (§5) or Kyler plays them.
- **From the first batch** (RESULTS.md), the proposed statuses: A1, A2, A5, B1, B4, F2a, F2b, D1, D2, M8-1a pass;
  B2, B3, D5, M8-1c fail, each with its cause; F1, C-gorge, M6-1a and M6-1b pass in their measured parts; E4 is
  recorded. The failures become issues: the M8 export of imported caves, the load transient that kills plants, the
  bank deaths after a drought, the M7 spillway estimate.
- **Map-level checks as permanent tests.** The generic checks (loads cleanly, every object in place,
  stored water holds within 0.1, terrain kept) run on each milestone's files. Their thresholds become
  part of PLAN §15 once a few runs agree.
- **The cycle model's calibration.** Each run's calibration games compare the game and the model on the
  same forced weather, tick for tick. The per-rule findings (early or late, by how much) go into
  `investigation/cycles/CALIBRATION.md` (or its successor next to the model) as measured spot checks, with
  the run id. A difference beyond a tick or two points at one rule (FIDELITY.md's table), and the model
  is fixed there, then the next run confirms it.

## 4. Screenshots as Map look's reference

- **Our own maps in the real game, at the 3D view's poses.** The probe reproduces each Map look capture's
  camera exactly (target, direction, 40° field of view, 980 × 733), so the game's image and ours line up
  pixel for pixel. The contact sheet shows them side by side.
- **They stay local.** Game screenshots are never committed or shipped (the rule of ML-1). Map look reads
  them from the local folder when tuning colours, water and light; a review records its findings in words
  and numbers (docs/map-look), not images.
- **A standing reference set.** After each Map look change, a probe run of the seven Map look maps gives a
  fresh game-side set for the same poses, so drift in either shows at once.

## 5. Later: a scripted bot colony

A probe stage that builds a small colony itself and measures whether a map is survivable on each
difficulty. What the decompiled code shows it would take:

- **Placing buildings as the player's tool does.** `ConstructionFactory.CreateAsUnfinished` places a
  construction site; blueprints come from `TemplateNameMapper` by name (`Path`, `WaterPump.Folktails`,
  `DeepWaterPump.IronTeeth`, `SmallTank.*`, `SmallPile.*`, `GathererFlag.*`, `LumberjackFlag.*`,
  `Lodge.Folktails`, `Barrack.IronTeeth`). Validity comes from the tool's own `PreviewPlacer`
  (`GetBuildableCoordinates`); its warnings (a blocked pump pipe, an unreachable entrance) are not enforced,
  so the bot checks them itself. Placing happens in `UpdateSingleton`, as the player's does.
- **Builders build.** The district center is the builder hub; sites finish when their materials, build
  hours and validators are done. `ConstructionSite.FinishNow` exists but creates the materials from nothing,
  so an instantly built colony overstates survival (the start has no logs, and no water on Normal and
  Hard). Instant building would only be a separate "capacity" figure.
- **What the bot must do that players do without thinking.**
  - A continuous chain of `Path` tiles from the district center to every entrance: without it a building
    gets no builders, no workers, and nobody eats or drinks from it (`DistrictBuilding`).
  - Mark trees for the lumberjack (`TreeCuttingArea.AddCoordinates`); gatherers take any bush in range.
  - Tell each new tank or warehouse its good (`SingleGoodAllower.Allow`).
  - Stay on the district center's level (terrain navigation joins same-height tiles only) and within a
    flag's 20 walking tiles.
  - Use only buildings with no science cost: code placement skips the science lock.
- **Workers and homes are automatic** (`DistrictWorkplaceAssigner`, `DwellerHomeAssigner`); the bot sets
  priorities (`WorkplacePriority`, `BuilderPrioritizable`) so the pump comes first.
- **Measures.** Population (`PopulationService`), deaths with their cause (at `PreMortalDiedEvent`, the
  beaver's Thirst or Hunger need at its minimum, else old age), water and food stock
  (`ResourceCountingService`), the first water pumped, and `GameOverEvent`, per day and per hazard.
- **Difficulty.** On Normal and Hard the colony starts with food for about 3–4 days and no water, and 13
  beavers drink about 28 water a day: a pump must work within about 5 days. Easy starts with 250 water and
  eats and drinks at 0.4.
- **Where it stops measuring the map.** A Normal drought of about 7 days needs about 190 stored water
  (7 small tanks, about 105 logs); a full Hard drought needs 400–800. Past the first two or three Hard
  cycles a science-free bot measures itself, not the map. Maps with no pump site on the start's level, or no
  trees and bushes in reach, are reported as "no bot layout", apart from "not survivable".
- **Randomness.** The game's generator is never seeded: each map needs a few runs.
- **Minimal plan.** Survey the start's level; choose and validate a pump site whose pipe tip is under
  water; lay paths; place the lumberjack flag (with marked trees) and the gatherer flag; place the pump at
  top priority; add a log pile, tanks and homes; let the builders build; record daily until N hazards or
  game over.

## 6. When the game updates

- **What breaks.** The mod is built against the installed game's assemblies and reads two private fields
  (`PanelStack._stack`, `CameraService._cameraServiceSpec`). It relies on:
  - `GameSceneLoader.StartNewGame`, `NewGameConfiguration`, `MapFileReference.FromDisk`, the
    `GameModeSpec` record and its weather fields;
  - the order in `GameCycleService.StartNextCycle` (the cycle-ended event before the next cycle is drawn);
  - `TemperateWeatherDurationService.Initialize`, `DroughtWeather.Initialize`, `BadtideWeather.Initialize`;
  - `SpeedManager` speeds up to 99 (the developers' x99);
  - `Autosaver.Suspend`, `MainMenuSceneLoader.OpenMainMenu`, `GameQuitter.Quit`;
  - `IThreadSafeWaterMap`, `IThreadSafeColumnTerrainMap`, the soil services and their index layout;
  - `-skipModManager` and the `ModEnabled.<source>.<folder>.<id>` settings keys;
  - with the bot colony, also `ConstructionFactory`, `TemplateNameMapper`, `PreviewPlacer`,
    `TreeCuttingArea`, `SingleGoodAllower`, `WaterInputPipeCoordinates` and `DistrictBuilding`.
- **How to notice.**
  - The build fails at once on a changed signature (the mod compiles against the installed DLLs).
  - `Version.txt` in the game folder is recorded in every result; the runner refuses to launch when it
    differs from the version the mod was checked against, until the smoke run passes on the new version.
  - A smoke run after each game update: one map, a few minutes. Its checks cover the weather forcing
    (the recorded cycle lengths must equal the job's), the records (the file's own water after load) and
    the screenshots.
  - The decompiled code is re-made for the new version (a gitignored folder named for it) and the
    classes above diffed against the old one.
