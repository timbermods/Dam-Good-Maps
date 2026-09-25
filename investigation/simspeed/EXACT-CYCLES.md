# Late-arriving exact cycle reference

18/18 Node cases and 18/18 Chromium cases; cross-runtime status: **complete**.

Reference `investigation/cycles-exact` at `a9cdb860be859ddd3339800a88b42e9871293597` appeared during the investigation. Its six copied modules preserve all expressions; only relative imports and line endings change. They have a separate [bundle fingerprint](results/exact-build.json), so the original cycle proof is not replaced.

**The core prototypes do not change this model's weather stepping work.** It uses its own `GameWater` and `GameSoil`, including a precomputed neighbour table and dirty soil dependencies. After generation, the harness replaces core `WaterSim.run`, `substep` and `computeWn` with throwing guards. Every weather case completes without calling them. The five prototypes alter only core water/drought code; identical generated inputs feed an unchanged exact-cycle transition function. No measured variant speedup is assigned to this unchanged hot path. Generation and canonical initialization can still benefit.

The new reference intentionally has different contamination, soil, calendar and loading rules from the first model. This study does not compare the two models for byte equality, switch the old model to those rules, or port the optimizations into GameWater. Such a port requires its own arithmetic proof and benchmarks. “Exact” identifies the branch and its rules; this is parity against that reference, not validation against a running game. No game was launched.

Each case executes the reference's six probes and exact `runStretch` callback schedule. They total 73 days except Islands 256²: its longer source ramp makes the lead-in two days, giving 77 days. The schedule is preserved, not shortened to match the old model. Generation must match the formal core baseline export hash. Every daily/phase-boundary snapshot retains raw-array SHA-256 for depth, contamination, previous depth, momentum, both evaporation buffers, moisture, soil contamination, candidates, saturation and first-event arrays, plus plant/source state, clock and metrics. Node and Chromium records must match exactly. The original core-variant proof separately checks all seven implementations; no new exact-cycle optimization is claimed here.

Timings include construction and Measures calls. Snapshot copies and digest calculation are excluded. Node uses three workers and thread CPU accounting; Chrome uses three Web Workers and elapsed time. These supplemental runs overlap the original Chromium matrix on the shared host. They are diagnostic costs, not quiet-host budget measurements or controlled old/new model ratios. Separate wrapped profiles run one day from each probe (six days per case), after the uninstrumented full run.

| Theme | Size | Days | Node CPU (s) | Node wall (s) | Chromium wall (s) |
|---|---:|---:|---:|---:|---:|
| riverValley | 96² | 73 | 9.21 | 9.20 | 10.03 |
| canyon | 96² | 73 | 5.41 | 5.45 | 6.32 |
| highlands | 96² | 73 | 17.24 | 17.41 | 17.90 |
| lakeBasin | 96² | 73 | 44.52 | 44.81 | 44.33 |
| islands | 96² | 73 | 53.02 | 53.44 | 54.32 |
| delta | 96² | 73 | 10.97 | 11.16 | 11.31 |
| riverValley | 128² | 73 | 14.28 | 14.33 | 14.32 |
| canyon | 128² | 73 | 8.72 | 8.70 | 8.85 |
| highlands | 128² | 73 | 16.87 | 17.04 | 16.29 |
| lakeBasin | 128² | 73 | 75.09 | 75.77 | 83.06 |
| islands | 128² | 73 | 93.20 | 94.02 | 106.98 |
| delta | 128² | 73 | 20.28 | 20.55 | 21.62 |
| riverValley | 256² | 73 | 57.22 | 57.56 | 64.28 |
| canyon | 256² | 73 | 30.90 | 31.08 | 34.01 |
| highlands | 256² | 73 | 69.01 | 69.59 | 75.22 |
| lakeBasin | 256² | 73 | 153.71 | 154.88 | 172.50 |
| islands | 256² | 77 | 264.65 | 266.51 | 290.06 |
| delta | 256² | 73 | 77.03 | 77.61 | 82.68 |

## Diagnostic profiles

Instrumented self times; wrappers and host scheduling affect these figures. Median inclusive shares are GameWater.tick 61.9%, GameSoil.step 35.5%, CycleModel.plantsTick 1.6%. These are diagnostic elapsed-time shares, not CPU shares.

| Case | Largest self-time components |
|---|---|
| riverValley-96-1 | GameWater.substep 736 ms; GameSoil.step 589 ms; GameWater.buildActive 73 ms |
| canyon-96-1 | GameWater.substep 484 ms; GameSoil.step 393 ms; GameWater.buildActive 45 ms |
| highlands-96-1 | GameWater.substep 1491 ms; GameSoil.step 1482 ms; GameWater.buildActive 144 ms |
| lakeBasin-96-1 | GameWater.substep 2804 ms; GameSoil.step 1325 ms; GameWater.buildActive 248 ms |
| islands-96-1 | GameWater.substep 3296 ms; GameSoil.step 1448 ms; GameWater.buildActive 303 ms |
| delta-96-1 | GameWater.substep 1161 ms; GameSoil.step 720 ms; GameWater.buildActive 112 ms |
| riverValley-128-1 | GameWater.substep 1052 ms; GameSoil.step 814 ms; GameWater.buildActive 108 ms |
| canyon-128-1 | GameWater.substep 693 ms; GameSoil.step 530 ms; GameWater.buildActive 64 ms |
| highlands-128-1 | GameSoil.step 1505 ms; GameWater.substep 1358 ms; GameWater.buildActive 135 ms |
| lakeBasin-128-1 | GameWater.substep 4832 ms; GameSoil.step 2043 ms; GameWater.buildActive 416 ms |
| islands-128-1 | GameWater.substep 6067 ms; GameSoil.step 2411 ms; GameWater.buildActive 556 ms |
| delta-128-1 | GameWater.substep 2446 ms; GameSoil.step 1459 ms; GameWater.buildActive 229 ms |
| riverValley-256-1 | GameWater.substep 4585 ms; GameSoil.step 2967 ms; GameWater.buildActive 456 ms |
| canyon-256-1 | GameWater.substep 2646 ms; GameSoil.step 1883 ms; GameWater.buildActive 237 ms |
| highlands-256-1 | GameWater.substep 6469 ms; GameSoil.step 4021 ms; GameWater.buildActive 619 ms |
| lakeBasin-256-1 | GameWater.substep 10980 ms; GameSoil.step 4962 ms; GameWater.buildActive 977 ms |
| islands-256-1 | GameWater.substep 16483 ms; GameSoil.step 6229 ms; GameWater.buildActive 1485 ms |
| delta-256-1 | GameWater.substep 8632 ms; GameSoil.step 5332 ms; GameWater.buildActive 741 ms |

## Reproduction

After completing the main Node map proof, run from this folder:

```sh
node bundle-exact.mjs
node exact-bench.mjs
node browser-server.mjs --exact
# Open its loopback URL in Chromium; wait for PASSED, then stop the server.
node summarize-exact.mjs
```
