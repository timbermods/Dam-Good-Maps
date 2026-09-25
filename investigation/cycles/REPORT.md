# Weather cycles

Work starts from dev `cfa5990caeaf462de695caf428280da55fc0f7f5`. All changes stay in this folder.

## Decisions

- Use the existing water solver at 768 ticks per day, with its two 0.3-second substeps. Do not change its arithmetic.
- Initialize through the canonical settle. A continuing temperate river can still move: the settle is a stopping test, not a frozen equilibrium. Report that drift separately.
- Keep the analytic drought unchanged. Compare a sources-off run from the same canonical water, separately from the weather run's pre-drought ramp.
- Apply soil targets every 16 ticks (1/48 day), with the documented rise and decay rates. The spatial target is the existing equilibrium solver, so short soil transients remain approximate. Check against one-tick updates.
- Follow the original plants. Dry timers reset when moisture returns. Dead trees retain logs; dead bushes lose food. Do not count new seedlings or colony consumption. This measures the untouched map's original resources, not population survival.
- Use weather seed 1729 for comparable maps, and independent plant streams keyed by entity id. This reproduces this model's weather, not the game's random sequence.
- The notes omit the streak formula. Read the local decompilation of `Timberborn.HazardousWeatherSystem.cs` (`HazardousWeatherRandomizer`, `HazardousWeatherHelper`) and `Timberborn.WaterSourceSystem.cs` (badtide controller and drought modifier). Record the formulas in `weather.ts`; do not copy game source into the branch. Badtides replace a drought, rather than following every drought. Full handicap ends at occurrence N+1 under `(n-1)/N`.
- Generated heightfields only. Roofed water, drains, explosions and player construction require another model. Aquifers stay unpowered. Seeps retain the repo's hysteresis without the game's real-time fade.
- The sandbox blocks tsx's esbuild subprocess. `run.cjs` runs the same TypeScript with TypeScript's in-process transpiler. Normal hosts may use `npx tsx`; no root dependencies change.

## Phase 1

All 12 golden fixtures match the canonical settle exactly. The lake, valley and weir drought fixtures differ by 0.73%, 0.36% and 2.70% in volume after nine days, below the existing 5% tolerance. The analytic view drains immediately, uses a fixed wet footprint and shares evaporation over flat pools; the simulation takes time to drain, retains momentum and changes its wet footprint. These explain small depth and volume differences. `results/verification.json` records the numbers.

Generated maps and later phases will add measured results here.
