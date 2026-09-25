# Measured results

204/204 generated maps passed generation. 180 survey maps: seeds 1–30 in each of six themes at 128². Size checks use seeds 1 and 2 in every theme at 96², 128² and 256². Generator 0.6.0; base cfa5990. Weather seed 1729.

## Model checks

Canonical initialization: maximum depth error 0. Every run loads the water, soil and evaporation state the generated file stores. The model then follows the game tick by tick; [FIDELITY.md](FIDELITY.md) lists every rule. Before the sources start to slow, the first temperate period changes volume by at most 5.1%; the canonical stopping test allows small ongoing changes. Its last day includes the slowdown before the first drought. We never pin or overwrite the timeline to make it match.

Drought: 354/408 endpoints meet the 5% stored-volume tolerance (or 1 m³ when the analytic store is at most 1 m³). The largest difference is 2.5% of the initial water. Every failed comparison is below. These are discrepancies, not passing claims under the original stored-volume tolerance. For generated maps we also report a practical tolerance: 0.1 block maximum tile-depth difference (the solver’s dry-ground spill threshold), and 5% of initial volume. This does not relax the three golden-fixture gates. The summary records any failures of this second tolerance.

The comparison loads each map on the first day of a drought, with every source off, and runs the exact model. The analytic view clips water to spill levels immediately, freezes pool membership and uses a fixed evaporation rate per pool. The tick model retains draining water and momentum, changes shoreline area, retains a shallow head at the 0.1 dry-ground spill threshold, and uses 10× evaporation below 0.02 deep. The long-drought failures are often tiny remnants: their percentage error grows as the denominator approaches zero. Large basins also retain the small outlet head that the analytic view clips. Weather timelines add the source slowdown before each drought.

| Map | Drought days | Analytic m³ | Simulated m³ | Difference / stored water | Difference / initial water | Max depth difference |
|---|---:|---:|---:|---:|---:|---:|
| delta-128-1 | 25 | 59.854 | 65.044 | 8.7% | 0.4% | 0.045 |
| delta-128-10 | 25 | 50.658 | 53.32 | 5.3% | 0.3% | 0.026 |
| delta-128-11 | 25 | 59.17 | 64.382 | 8.8% | 0.4% | 0.045 |
| delta-128-12 | 25 | 60.378 | 65.054 | 7.7% | 0.4% | 0.037 |
| delta-128-14 | 25 | 70.336 | 74.207 | 5.5% | 0.3% | 0.033 |
| delta-128-15 | 25 | 57.169 | 60.829 | 6.4% | 0.3% | 0.03 |
| delta-128-16 | 25 | 67.548 | 71.083 | 5.2% | 0.3% | 0.028 |
| delta-128-17 | 25 | 48.311 | 51.15 | 5.9% | 0.3% | 0.028 |
| delta-128-18 | 25 | 59.173 | 63.668 | 7.6% | 0.4% | 0.038 |
| delta-128-19 | 25 | 60.909 | 64.31 | 5.6% | 0.3% | 0.034 |
| delta-128-2 | 25 | 47.011 | 49.774 | 5.9% | 0.3% | 0.026 |
| delta-128-20 | 25 | 70.864 | 75.636 | 6.7% | 0.4% | 0.041 |
| delta-128-21 | 25 | 73.211 | 78.632 | 7.4% | 0.4% | 0.036 |
| delta-128-22 | 25 | 72.531 | 77.695 | 7.1% | 0.5% | 0.037 |
| delta-128-23 | 25 | 41.536 | 44.03 | 6.0% | 0.2% | 0.027 |
| delta-128-24 | 25 | 61.745 | 65.276 | 5.7% | 0.4% | 0.029 |
| delta-128-25 | 25 | 45.587 | 49.461 | 8.5% | 0.3% | 0.04 |
| delta-128-27 | 25 | 60.736 | 65.332 | 7.6% | 0.4% | 0.035 |
| delta-128-28 | 25 | 69.692 | 75.503 | 8.3% | 0.5% | 0.043 |
| delta-128-29 | 25 | 54.235 | 58.06 | 7.1% | 0.4% | 0.037 |
| delta-128-3 | 25 | 68.736 | 72.435 | 5.4% | 0.4% | 0.028 |
| delta-128-30 | 25 | 63.766 | 67.387 | 5.7% | 0.4% | 0.028 |
| delta-128-4 | 25 | 61.42 | 64.777 | 5.5% | 0.3% | 0.031 |
| delta-128-5 | 25 | 35.076 | 37.183 | 6.0% | 0.2% | 0.03 |
| delta-128-6 | 25 | 58.183 | 62.204 | 6.9% | 0.4% | 0.035 |
| delta-128-7 | 25 | 63.335 | 69.565 | 9.8% | 0.5% | 0.048 |
| delta-128-9 | 25 | 67.89 | 72.548 | 6.9% | 0.4% | 0.038 |
| delta-256-1 | 25 | 59.282 | 63.151 | 6.5% | 0.1% | 0.039 |
| delta-256-2 | 25 | 307.891 | 327.357 | 6.3% | 0.5% | 0.045 |
| delta-96-1 | 25 | 34.446 | 36.196 | 5.1% | 0.3% | 0.024 |
| delta-96-2 | 25 | 27.034 | 28.831 | 6.6% | 0.3% | 0.022 |
| highlands-128-1 | 25 | 10.672 | 11.344 | 6.3% | 0.1% | 0.027 |
| highlands-128-10 | 25 | 45.58 | 47.866 | 5.0% | 0.3% | 0.027 |
| highlands-128-2 | 9 | 3.281 | 3.578 | 9.1% | 0.1% | 0.027 |
| highlands-128-20 | 25 | 36.154 | 38.556 | 6.6% | 0.3% | 0.031 |
| highlands-128-26 | 25 | 31.828 | 33.796 | 6.2% | 0.2% | 0.032 |
| highlands-128-27 | 25 | 27.401 | 28.891 | 5.4% | 0.2% | 0.03 |
| highlands-128-4 | 25 | 55.552 | 59.217 | 6.6% | 0.3% | 0.034 |
| highlands-128-5 | 25 | 53.206 | 56.11 | 5.5% | 0.3% | 0.033 |
| highlands-256-1 | 25 | 246.941 | 264.118 | 7.0% | 0.5% | 0.051 |
| highlands-256-2 | 25 | 281.516 | 304.284 | 8.1% | 0.7% | 0.05 |
| islands-256-1 | 25 | 19015.198 | 20000.956 | 5.2% | 2.4% | 0.085 |
| islands-256-2 | 25 | 20771.341 | 21931.375 | 5.6% | 2.5% | 0.092 |
| riverValley-128-13 | 25 | 82.071 | 86.967 | 6.0% | 0.6% | 0.033 |
| riverValley-128-15 | 25 | 69.157 | 73.175 | 5.8% | 0.5% | 0.033 |
| riverValley-128-16 | 25 | 75.967 | 79.836 | 5.1% | 0.5% | 0.035 |
| riverValley-128-17 | 25 | 82.702 | 87.452 | 5.7% | 0.6% | 0.045 |
| riverValley-128-2 | 25 | 91.295 | 96.104 | 5.3% | 0.6% | 0.029 |
| riverValley-128-21 | 25 | 72.436 | 76.212 | 5.2% | 0.5% | 0.03 |
| riverValley-128-3 | 25 | 62.374 | 66.091 | 6.0% | 0.5% | 0.031 |
| riverValley-128-6 | 25 | 62.204 | 65.383 | 5.1% | 0.4% | 0.026 |
| riverValley-128-9 | 25 | 70.244 | 73.791 | 5.0% | 0.5% | 0.036 |
| riverValley-256-1 | 25 | 269.472 | 289.498 | 7.4% | 0.7% | 0.051 |
| riverValley-96-2 | 9 | 3.281 | 3.483 | 6.1% | 0.1% | 0.018 |

The additional combined check (5% of initial volume and 0.1 block at every tile) passes 407/408 endpoints. Maximum tile-depth error across the set is 0.104 blocks. Exceptions follow; they are retained as failures of this target. A local depth mismatch can exist even when total stored volume passes.

| Map | Drought days | Difference / initial water | Max depth difference |
|---|---:|---:|---:|
| lakeBasin-128-14 | 9 | 1.4% | 0.104 |

The largest tile difference is at lakeBasin-128-14 after 9 days. Inspect it with `node investigation/cycles/run.cjs investigation/cycles/diagnose.ts`, which writes [depth evidence](results/depth-outlier.json). A local depth mismatch between the two views is a known limit of the analytic estimate; neither solver is changed to hide it.

## Run time

Node v24.13.0, AMD Ryzen 7 9800X3D 8-Core Processor. Another session's builds and benchmarks shared the machine, so wall times are loaded-machine timings. CPU time of the batch process is steadier and is the fairer cost. Generation, canonical settle and the six scenario timelines are timed separately. The six timelines total about 75 simulated days; the direct drought comparisons are extra. File compression is outside the scenario timer. The viewer reads precomputed frames. [INTEGRATION.md](INTEGRATION.md) compares the cost with the first model.

| Size | Maps | Generation median, s | Settle median / max, s | Timelines median / max, s | Per-day median, s (wall) | Per-day median, s (CPU) |
|---|---:|---:|---:|---:|---:|---:|
| 96² | 12 | 0.45 | 0.14 / 0.59 | 13.67 / 59.48 | 0.187 | 0.185 |
| 128² | 12 | 0.88 | 0.29 / 1.40 | 20.77 / 107.01 | 0.285 | 0.282 |
| 256² | 12 | 3.04 | 1.34 / 3.65 | 71.25 / 207.69 | 0.976 | 0.960 |

## Cycle signature

Eleven quantities describe each map: water kept after the first Normal drought and a full-ramp Hard drought, plus clean water kept in the original water regions after that long drought; how long the start keeps pumpable clean water; wet tiles lost; the largest number of fragments from one original water body; new badwater exposure; new contaminated soil; original trees and bushes lost; and recovery time after badtide. Stored water and plant losses are fractions of their original totals. Start access is capped at 26 days (26 means it remained available throughout the 25-day hazard), fragments at 20, recovery at six days (six means not recovered within five). Soil exposure is a fraction of all map tiles. Other entries are clamped to 0–1 only for distance.

Distance is the mean absolute difference over these eleven normalized values. A nearest-peer median close to zero means two seeds behave almost alike. This is a diagnostic, not M9's separate variety scale or an acceptance threshold.

The group key uses fixed bins: long-drought retention at 5/25/50/75%; new badwater exposure at 25/50/75%; start-water duration at 1/7/14/26 days. A large group means many maps share that broad opening. These bins do not establish perceptual equivalence.

| Theme | n | Water kept after 25 days | New badwater reach after 1 day | Start water, days | Largest group | Groups | Nearest-peer median |
|---|---:|---:|---:|---:|---:|---:|---:|
| River Valley | 30 | 5.8%–12.0% | 95.7%–100.0% | 0.0–1.0 | 76.7% | 2 | 0.0124 |
| Canyon | 30 | 0.0%–0.0% | 98.2%–100.0% | 0.0–0.0 | 100.0% | 1 | 0.0000 |
| Highlands | 30 | 0.0%–12.0% | 87.6%–100.2% | 0.0–1.0 | 50.0% | 4 | 0.0176 |
| Lake Basin | 30 | 48.8%–50.7% | 48.3%–74.3% | 20.0–20.0 | 60.0% | 4 | 0.0178 |
| Delta | 30 | 0.0%–6.9% | 96.4%–100.0% | 0.0–1.0 | 66.7% | 4 | 0.0163 |
| Islands | 30 | 48.3%–49.2% | 48.3%–61.6% | 19.0–20.0 | 90.0% | 2 | 0.0124 |

The gallery adds a continuous run of a new Normal game: from 04:00 on day 1, through the first five cycles and five recovery days, 97 calendar days. Original plant deaths persist. The survey uses isolated probes to compare terrain under the same weather; it does not claim that late-cycle vegetation would still match a fresh map.

## Definitions and limits

Water is deeper than 0.05; pumpable water is at least 0.3 deep, below 5% contamination, within two levels of the start's shore and within the map's own walking limit. Start walks reuse the repo's same-level and slope rules. The original walking network is fixed: this is water access potential, not a beaver pathfinding or consumption forecast. The 0.3 and 5% thresholds are the study's margins: a game pump draws any water within its reach and scales its clean output by (1 − contamination) ([FIDELITY.md](FIDELITY.md)).

Regions are fixed connected patches of the initial water, split into below-spill storage and river reaches. Their coordinates name the centroid, not an authored landmark. New water outside those patches is counted separately. Splits count connected descendants, including one-tile pools, at daily snapshots. First-dry and first-bad days are daily upper bounds; a missing event is right-censored at the run's end.

Recovery means at least 95% of initial water and moist area, and badwater area no more than the initial area plus 1% of initial wet tiles. It does not mean every tile is back to its original condition. Dead original plants never revive; original trees retain potential logs after dying. New seedlings, growth/yield amounts and player pumping are outside this study.

Soil moisture and contamination follow the game's per-tick rules, and plants die by the game's timers ([FIDELITY.md](FIDELITY.md)). The soil pass recomputes only tiles whose inputs changed; the tests show it equals a full recomputation tile for tile. The game's random draws cannot be reproduced: plant delays and weather use seeded draws with the game's odds.

Machine-readable evidence: [summary](results/summary.json), [signatures](results/signatures.json), [all daily timelines](results/timelines.json.gz), and [golden checks](results/verification.json). Timelines contain regions, daily measures, first-arrival maps and plant deaths. Gallery frames are display-quantized; measurements use full precision (64-bit water; 32-bit soil, as the game stores it).
