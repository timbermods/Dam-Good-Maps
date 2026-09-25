# DGM Probe

An automatic in-game test runner for Dam Good Maps. A Timberborn mod plays each map as a new game, fast,
under forced weather, and records what the game does; a runner builds the job, launches the game, watches
it, and compares the records with the project's models.

- [REPORT.md](REPORT.md): what was built, the choices made and why.
- [RESULTS.md](RESULTS.md): the first real batch.
- [INTEGRATION.md](INTEGRATION.md): proposals for the repository and the milestone run.

## Run it

Needs Windows, Timberborn 1.1.2.4 from Steam, the .NET 8 SDK and Node 22 or later.

```sh
npm --prefix investigation/probe ci
npm --prefix investigation/probe test
npm --prefix investigation/probe run batch -- --smoke
```

Every launch needs Kyler's yes. Without `--confirmed-launch`, the batch prints what it would do (the maps,
the checks, the time, and that it launches Timberborn) and a one-time code, and launches nothing. After
the yes, run the same command with `--confirmed-launch <code> --run-id <id>` as printed. A code works
once, and only for the plan it was printed for.

- `--smoke`: one map (the M8 preview) for one game day, a few minutes.
- `--only m2-rv,cal-rv2` or `--group Calibration`: some games (`--job-only` lists them).
- Any `.timber` paths on the command line are added as games of their own, with a Normal drought.
- `--compare-only <run id>`: redo the verdicts and the contact sheet of a finished run.
- `--restore-only`: put the game's settings, logs and saves back after an interrupted run.

A full batch waits until the machine is quiet (no tests, batches, benchmarks or headless browsers of
another session, and a low processor load). `--no-wait` skips the wait.

## What stays on this machine

Everything the game produces stays in `Documents\Timberborn\DGMProbe\`: the job, the heartbeat, `results\`
(one JSON file per map, whole-map snapshots, the game's logs), `shots\` (the screenshots, never committed),
`maps\` (the files played) and `sheet\` (the HTML contact sheet).

## Safety

- The mod does nothing unless the game was started with `-dgmprobe` **and** a job file exists. A normal
  launch never has that argument.
- The runner never launches the game while it is running. Before a launch it records the game's settings
  (the registry key), the Unity logs, the player data and every save file. Only DGM Probe is on during
  the run. Afterwards it puts the settings, logs and player data back exactly, deletes any save the
  probe's games made, and moves any other new file (an error report, say) into the run's folder.
- Graphics and speed changes are made in memory only, during probe runs.

## Remove the mod

1. Close Timberborn.
2. Delete the folder `Documents\Timberborn\Mods\DGMProbe`.
3. Optionally delete `Documents\Timberborn\DGMProbe` (the results and screenshots).

## Files

- `mod/`: the mod (C#, built against the local game install, never published).
- `runner/`: the runner (TypeScript): `batch.ts` (the command), `catalog.ts` (the games and their checks),
  `jobs.ts`, `launch.ts` (Steam launch and watchdog), `compare.ts` (the verdicts), `model.ts` (the cycle
  model), `safety.ts` (snapshot and restore), `mods.ts`, `consent.ts`, `sheet.ts`, `summary.ts`, `test.ts`.
