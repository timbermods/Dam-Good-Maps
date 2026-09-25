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

## 3. How results reach the project's records

- **`docs/ingame-log.md`.** The runner writes a proposed status for every pending check it decides:
  **pass (probe)** or **fail (probe)** with the date, the run id and the numbers, in the log's own words.
  A person applies it (the log stays hand-edited). Checks that need building, walking or the editor stay
  pending until the bot colony (§5) or Kyler plays them.
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

*To be completed from the study of the game's code (placing buildings, workers, survival measures).*

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
  - `-skipModManager` and the `ModEnabled.<source>.<folder>.<id>` settings keys.
- **How to notice.**
  - The build fails at once on a changed signature (the mod compiles against the installed DLLs).
  - `Version.txt` in the game folder is recorded in every result; the runner refuses to launch when it
    differs from the version the mod was checked against, until the smoke run passes on the new version.
  - A smoke run after each game update: one map, a few minutes. Its checks cover the weather forcing
    (the recorded cycle lengths must equal the job's), the records (the file's own water after load) and
    the screenshots.
  - The decompiled code is re-made for the new version (a gitignored folder named for it) and the
    classes above diffed against the old one.
