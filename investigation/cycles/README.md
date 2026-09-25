# Watch the weather

From the repository root, run:

```sh
node investigation/cycles/serve.mjs
```

Open **http://127.0.0.1:4178**. Choose a map → **Normal**, **Drought** or **Badtide** → move the day slider or press **Play**.

The 12 maps cover all six themes. Each has daily pictures of normal weather, first droughts on Easy, Normal and Hard, a first badtide, and a later Hard drought. **First five cycles** follows a new game from its first hour through its first badtide. The other stretches load the same map at a date in the weather schedule, for comparison. Recovery follows each hazard.

Move over the map to read a tile. Open **Lakes, pools and river reaches** to see how much each place keeps. Brown crosses are dead original plants; dead trees still leave logs. The start marker shows the district center.

This is what an untouched map does, following the game's own rules ([FIDELITY.md](FIDELITY.md)). It does not subtract drinking water or add new seedlings. Daily event times mean “by this day.”

The page runs locally. It needs no build, account or network connection. A current browser with `DecompressionStream` is required. The server binds only to `127.0.0.1`.

## Reproduce the study

Use Node 22 or later. Install only this folder's dependencies:

```sh
npm --prefix investigation/cycles ci --ignore-scripts
npm --prefix investigation/cycles test
npm --prefix investigation/cycles run typecheck
node investigation/cycles/run.cjs investigation/cycles/fidelity.ts
node investigation/cycles/run.cjs investigation/cycles/fidelity-report.ts
npm --prefix investigation/cycles run batch -- --sizes 96,128,256 --seeds 1,2
npm --prefix investigation/cycles run batch -- --study survey --sizes 128 --seeds 1-30
node investigation/cycles/run.cjs investigation/cycles/journey.ts
node investigation/cycles/run.cjs investigation/cycles/summarize.ts
node investigation/cycles/run.cjs investigation/cycles/calibrate.ts
node investigation/cycles/run.cjs investigation/cycles/diagnose.ts
npm --prefix investigation/cycles run verify-data
```

The batch resumes from completed map records. Add `--force` after changing the model. Run the gallery before journeys; it supplies their display files. Keep the base revision fixed when reproducing hashes. A new generator version can change the maps. `fidelity.ts` reads the first model from git (commit `1a8eba2`) into the ignored `.cache/`.

`batch.ts` uses `generate(makeSpec(...))`, the same path as `tools/gen.ts`. The existing CLI only accepts its default theme, so this wrapper adds the six-theme loop. Generated `.timber` files are ignored; regenerate the named seeds for the spot checks. No game files are inputs.

For the spot checks, this two-map command generates the files without rerunning any timelines:

```sh
npm --prefix investigation/cycles run batch -- --maps-only --themes riverValley,lakeBasin --sizes 128 --seeds 2
```

Standard checkouts with root dependencies installed can run the TypeScript entry points with `npx tsx`. `run.cjs` is an in-process fallback for hosts that block esbuild's subprocess. It resolves this folder's own dependencies for the read-only `src/` imports.

## Files

- [Report](REPORT.md): conclusions and choices.
- [Fidelity](FIDELITY.md): every rule and timing, the game class behind it, and what it changes.
- [Measured results](RESULTS.md): timings, parity, signatures and definitions.
- [Spot checks](CALIBRATION.md): four short in-game checks.
- [Integration proposals](INTEGRATION.md): preview, editor, cards, M9 and cost.
- `model.ts`, `weather.ts`, `game-water.ts`, `game-soil.ts`: the model. `stretch.ts`: the probes and the continuous run.
- `results/timelines.json.gz`: all daily measures, fixed water regions, dry/bad arrival maps and original plant deaths. The run-length pairs are `[count, value]`; arrival values are days × 48, with −1 meaning not observed.
- `results/fidelity.json`, `results/fidelity-summary.json`: each rule's measured effect on the 12 reference maps, and the cost.
- `viewer/data/`: daily display fields and plant states for the 12 maps. Depth is rounded to 0.001; measurements retain full precision until their report rounding.
- `results/journeys/`: continuous-run daily measures. Their corresponding pictures are in the viewer files.

Every study file stays under `investigation/cycles/`. Nothing in the main application, generator or its tests is changed.
