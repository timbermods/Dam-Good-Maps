# Exact-weather optimization results

Pinned reference: dev `948f395137a6725d4b726864a47e6966d7f2f09a`; its weather and core dependency trees are unchanged at the new branch base `652774175c08b46b40c01536ee3d08a83cbe98d6`. **Acceptance: complete** (204/204 Node maps, 204/204 Chromium maps, 18/18 full-duration profiles). The continuous-product experiment has 12/12 Node and 12/12 browser cases.

These results concern `GameWater` and `GameSoil`, separate from the earlier core-port investigation. Each map executes all six reference probes, normally 73 days in total. Longer source ramps retain their extra lead-in days. This is not a continuous 73-day game history; that is measured separately in [WEATHER-PRODUCT.md](WEATHER-PRODUCT.md).

| Size | Prototype | Node CPU paired speedup | Chromium elapsed paired speedup |
|---|---|---:|---:|
| 96² | water-sparse | 1.10× | 1.10× |
| 96² | soil-cache | 1.08× | 1.06× |
| 96² | soil-saturation | 1.02× | 1.00× |
| 96² | water-wasm | 1.27× | 1.27× |
| 96² | combined | 1.48× | 1.36× |
| 128² | water-sparse | 1.12× | 1.14× |
| 128² | soil-cache | 1.06× | 1.06× |
| 128² | soil-saturation | 1.01× | 1.00× |
| 128² | water-wasm | 1.23× | 1.25× |
| 128² | combined | 1.44× | 1.52× |
| 256² | water-sparse | 1.14× | 1.15× |
| 256² | soil-cache | 1.06× | 1.07× |
| 256² | soil-saturation | 0.99× | 0.97× |
| 256² | water-wasm | 1.21× | 1.18× |
| 256² | combined | 1.40× | 1.33× |

| Size | Node CPU baseline → combined (s) | Chromium elapsed baseline → combined (s) |
|---|---:|---:|
| 96² | 16.33 → 11.84 | 19.11 → 14.27 |
| 128² | 26.27 → 18.66 | 31.53 → 21.42 |
| 256² | 91.99 → 70.98 | 96.64 → 67.92 |

Ratios are medians of per-map paired ratios; absolute columns are separate medians. Node uses thread CPU time. Chromium has elapsed time only. Independent proof cases run with four workers per runtime and overlap on this shared host; the diagnostic profiler also overlaps. These elapsed values include host scheduling and memory contention and are not idle-machine latency guarantees. All variants generate their own identical input, warm both drought/badtide branches, and rotate order by seed and probe. Constructor and Measures costs are included; proof snapshot copies, comparisons and SHA-256 are excluded. WASM module compilation occurs before timing; model memory allocation is included.

Each map/variant has one timed execution per probe; medians aggregate distinct map seeds rather than repeated trials of one input. Snapshot copying is subtracted, but its allocations may induce later garbage collection inside a timed interval. Small ratios near 1.00× need a quiet-host replication before an integration decision.

## Every theme and size (seed 1)

| Theme | Size | Days | Node CPU baseline → combined (s) | Chromium elapsed baseline → combined (s) |
|---|---:|---:|---:|---:|
| riverValley | 96² | 73 | 11.15 → 7.73 | 13.23 → 9.30 |
| canyon | 96² | 73 | 6.89 → 5.34 | 7.86 → 6.07 |
| highlands | 96² | 73 | 19.27 → 14.88 | 23.14 → 18.34 |
| lakeBasin | 96² | 73 | 52.69 → 27.31 | 57.47 → 59.94 |
| islands | 96² | 73 | 67.38 → 33.97 | 73.34 → 40.18 |
| delta | 96² | 73 | 13.39 → 8.81 | 15.08 → 10.20 |
| riverValley | 128² | 73 | 16.91 → 11.86 | 18.47 → 13.23 |
| canyon | 128² | 73 | 11.28 → 9.26 | 12.78 → 10.55 |
| highlands | 128² | 73 | 21.97 → 17.47 | 30.17 → 26.66 |
| lakeBasin | 128² | 73 | 96.70 → 49.19 | 100.91 → 53.15 |
| islands | 128² | 73 | 120.20 → 63.83 | 123.20 → 66.22 |
| delta | 128² | 73 | 27.06 → 18.82 | 50.62 → 28.02 |
| riverValley | 256² | 73 | 75.97 → 55.87 | 79.14 → 61.19 |
| canyon | 256² | 73 | 41.19 → 34.95 | 45.66 → 38.51 |
| highlands | 256² | 73 | 90.11 → 62.56 | 96.07 → 70.28 |
| lakeBasin | 256² | 73 | 215.91 → 119.83 | 208.07 → 126.82 |
| islands | 256² | 77 | 355.24 → 185.59 | 341.92 → 149.16 |
| delta | 256² | 73 | 96.02 → 73.17 | 106.58 → 91.09 |

## Full-duration diagnostic profiles

Profiles run every tick of all six probes for each theme/size. Per-pass instrumentation preserves expressions but changes timing and JIT behaviour. Shares below are medians of instrumented elapsed time, not CPU attribution or speedup measurements. Initial six-day profiles are retained separately.

| Phase | Median share |
|---|---:|
| water.mix | 18.3% |
| water.outflows | 16.1% |
| water.depth | 12.3% |
| soil.dirty | 11.6% |
| soil.wet-count-saturation | 10.0% |
| water.clear-active | 7.1% |
| water.diffusion | 6.3% |
| soil.evaporation | 4.7% |
| soil.moisture | 2.8% |
| soil.remember | 2.2% |
| water.sources-finish | 1.5% |
| soil.candidates | 0.6% |
| soil.publish-levels | 0.4% |

| Theme | Size | Days | Instrumented total (s) | Water passes (s / share) | Soil passes (s / share) |
|---|---:|---:|---:|---:|---:|
| riverValley | 96² | 73 | 11.60 | 6.69 / 57.7% | 4.16 / 35.9% |
| canyon | 96² | 73 | 7.24 | 4.05 / 56.0% | 2.73 / 37.7% |
| highlands | 96² | 73 | 21.40 | 11.30 / 52.8% | 9.52 / 44.5% |
| lakeBasin | 96² | 73 | 63.88 | 45.22 / 70.8% | 17.59 / 27.5% |
| islands | 96² | 73 | 70.97 | 51.89 / 73.1% | 18.12 / 25.5% |
| delta | 96² | 73 | 13.52 | 8.39 / 62.1% | 4.44 / 32.9% |
| riverValley | 128² | 73 | 17.55 | 10.42 / 59.4% | 6.19 / 35.3% |
| canyon | 128² | 73 | 9.84 | 5.35 / 54.4% | 3.82 / 38.8% |
| highlands | 128² | 73 | 20.53 | 10.77 / 52.4% | 9.00 / 43.8% |
| lakeBasin | 128² | 73 | 89.08 | 63.97 / 71.8% | 24.05 / 27.0% |
| islands | 128² | 73 | 132.49 | 97.36 / 73.5% | 33.74 / 25.5% |
| delta | 128² | 73 | 24.98 | 15.91 / 63.7% | 8.06 / 32.3% |
| riverValley | 256² | 73 | 73.87 | 45.39 / 61.4% | 26.15 / 35.4% |
| canyon | 256² | 73 | 38.09 | 21.92 / 57.5% | 14.86 / 39.0% |
| highlands | 256² | 73 | 87.38 | 56.34 / 64.5% | 28.58 / 32.7% |
| lakeBasin | 256² | 73 | 196.07 | 138.06 / 70.4% | 55.19 / 28.1% |
| islands | 256² | 77 | 380.99 | 282.19 / 74.1% | 93.30 / 24.5% |
| delta | 256² | 73 | 95.29 | 58.50 / 61.4% | 33.93 / 35.6% |

These are the sums of the named passes inside each method; small driver/dispatch gaps remain outside those timers. They do not replace the uninstrumented baseline/candidate timings above. The compact [performance CSV](results/weather/performance.csv) retains every map/variant total, and the [input SHA index](results/weather/map-hashes.csv) identifies every proved export.

## Exactness coverage

All six themes, seeds 1–30 at 128², seeds 1–3 at 256² and seed 1 at 96²: 204 maps × six implementations per runtime. Every generated input export must be nonempty and byte-identical across variants; its SHA also matches the previous independent map proof. All native daily/phase-boundary snapshots are compared byte-for-byte within each runtime, including both water/soil arrays and hidden state that feeds later ticks. Every reference digest and summary agrees across Node and Chromium. Calendar, plant/source state, death times and timers, evaporation buffers, momentum and Measures first-event arrays are included. No tolerance or altered stopping schedule is allowed. See [WEATHER-PROOF.md](WEATHER-PROOF.md) for the local equivalence arguments and limits.

Current evidence contains 17964 checkpoints and 14904 simulated days per implementation in Node. Native total-day distribution by map: `{"73":201,"77":3}`. Raw cases and per-probe progress timings are in `results/weather/{node,chromium}/`; source/bundle hashes are in `results/weather/build.json`. The 12 narrow-grid/dependency cases each compare 512 ticks/steps in both runtimes, including signed zero, source transitions and changing wet masks.
