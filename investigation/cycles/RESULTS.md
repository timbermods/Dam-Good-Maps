# Measured results

204/204 generated maps passed generation. 180 survey maps: seeds 1–30 in each of six themes at 128². Size checks use seeds 1 and 2 in every theme at 96², 128² and 256². Generator 0.6.0; base cfa5990. Weather seed 1729.

## Model checks

Canonical initialization: maximum depth error 0. All source modifiers run each tick. A 17-day temperate continuation changes volume by at most 3.4%; the canonical stopping test allows small ongoing changes. We never pin or overwrite the timeline to make it match.

Drought: 353/408 endpoints meet the 5% stored-volume tolerance (or 1 m³ when the analytic store is at most 1 m³). The largest difference is 2.5% of the initial water. Every failed comparison is below. These are discrepancies, not passing claims under the original stored-volume tolerance. For generated maps we also report a practical tolerance: 0.1 block maximum tile-depth difference (the solver’s dry-ground spill threshold), and 5% of initial volume. This does not relax the three golden-fixture gates. The summary records any failures of this second tolerance.

The analytic view clips water to spill levels immediately, freezes pool membership and uses a fixed evaporation rate per pool. The tick model retains draining water and momentum, changes shoreline area, retains a shallow head at the 0.1 dry-ground spill threshold, and uses 10× evaporation below 0.02 deep. The long-drought failures are often tiny remnants: their percentage error grows as the denominator approaches zero. Large basins also retain the small outlet head that the analytic view clips. A sources-off comparison excludes ramping; weather timelines include it.

| Map | Drought days | Analytic m³ | Simulated m³ | Difference / stored water | Difference / initial water | Max depth difference |
|---|---:|---:|---:|---:|---:|---:|
| delta-128-1 | 25 | 59.854 | 65.065 | 8.7% | 0.4% | 0.045 |
| delta-128-10 | 25 | 50.658 | 53.319 | 5.3% | 0.3% | 0.026 |
| delta-128-11 | 25 | 59.17 | 64.388 | 8.8% | 0.4% | 0.045 |
| delta-128-12 | 25 | 60.378 | 65.054 | 7.7% | 0.4% | 0.037 |
| delta-128-14 | 25 | 70.336 | 74.517 | 5.9% | 0.4% | 0.038 |
| delta-128-15 | 25 | 57.169 | 60.813 | 6.4% | 0.3% | 0.03 |
| delta-128-16 | 25 | 67.548 | 71.083 | 5.2% | 0.3% | 0.028 |
| delta-128-17 | 25 | 48.311 | 51.153 | 5.9% | 0.3% | 0.028 |
| delta-128-18 | 25 | 59.173 | 63.667 | 7.6% | 0.4% | 0.038 |
| delta-128-19 | 25 | 60.909 | 64.216 | 5.4% | 0.3% | 0.033 |
| delta-128-2 | 25 | 47.011 | 49.781 | 5.9% | 0.3% | 0.026 |
| delta-128-20 | 25 | 70.864 | 75.67 | 6.8% | 0.4% | 0.041 |
| delta-128-21 | 25 | 73.211 | 78.621 | 7.4% | 0.4% | 0.036 |
| delta-128-22 | 25 | 72.531 | 77.721 | 7.2% | 0.5% | 0.038 |
| delta-128-23 | 25 | 41.536 | 44.031 | 6.0% | 0.2% | 0.027 |
| delta-128-24 | 25 | 61.745 | 65.287 | 5.7% | 0.4% | 0.029 |
| delta-128-25 | 25 | 45.587 | 49.466 | 8.5% | 0.3% | 0.04 |
| delta-128-27 | 25 | 60.736 | 65.346 | 7.6% | 0.4% | 0.035 |
| delta-128-28 | 25 | 69.692 | 75.582 | 8.5% | 0.5% | 0.043 |
| delta-128-29 | 25 | 54.235 | 58.068 | 7.1% | 0.4% | 0.037 |
| delta-128-3 | 25 | 68.736 | 72.448 | 5.4% | 0.4% | 0.028 |
| delta-128-30 | 25 | 63.766 | 67.394 | 5.7% | 0.4% | 0.028 |
| delta-128-4 | 25 | 61.42 | 64.863 | 5.6% | 0.3% | 0.033 |
| delta-128-5 | 25 | 35.076 | 37.179 | 6.0% | 0.2% | 0.03 |
| delta-128-6 | 25 | 58.183 | 62.204 | 6.9% | 0.4% | 0.035 |
| delta-128-7 | 25 | 63.335 | 69.564 | 9.8% | 0.5% | 0.048 |
| delta-128-9 | 25 | 67.89 | 72.577 | 6.9% | 0.5% | 0.039 |
| delta-256-1 | 25 | 59.282 | 63.171 | 6.6% | 0.1% | 0.039 |
| delta-256-2 | 25 | 307.891 | 327.374 | 6.3% | 0.5% | 0.045 |
| delta-96-1 | 25 | 34.446 | 36.194 | 5.1% | 0.3% | 0.024 |
| delta-96-2 | 25 | 27.034 | 28.835 | 6.7% | 0.3% | 0.022 |
| highlands-128-1 | 25 | 10.672 | 11.401 | 6.8% | 0.1% | 0.029 |
| highlands-128-10 | 25 | 45.58 | 47.863 | 5.0% | 0.3% | 0.027 |
| highlands-128-2 | 9 | 3.281 | 3.574 | 8.9% | 0.1% | 0.027 |
| highlands-128-20 | 25 | 36.154 | 38.556 | 6.6% | 0.3% | 0.031 |
| highlands-128-26 | 25 | 31.828 | 33.793 | 6.2% | 0.2% | 0.032 |
| highlands-128-27 | 25 | 27.401 | 28.982 | 5.8% | 0.2% | 0.032 |
| highlands-128-4 | 25 | 55.552 | 59.216 | 6.6% | 0.3% | 0.034 |
| highlands-128-5 | 25 | 53.206 | 56.246 | 5.7% | 0.4% | 0.036 |
| highlands-256-1 | 25 | 246.941 | 264.175 | 7.0% | 0.5% | 0.051 |
| highlands-256-2 | 25 | 281.516 | 304.291 | 8.1% | 0.7% | 0.05 |
| islands-256-1 | 25 | 19015.198 | 20000.934 | 5.2% | 2.4% | 0.085 |
| islands-256-2 | 25 | 20771.341 | 21931.391 | 5.6% | 2.5% | 0.092 |
| riverValley-128-1 | 25 | 77.984 | 81.929 | 5.1% | 0.5% | 0.037 |
| riverValley-128-13 | 25 | 82.071 | 86.973 | 6.0% | 0.6% | 0.033 |
| riverValley-128-15 | 25 | 69.157 | 73.176 | 5.8% | 0.5% | 0.033 |
| riverValley-128-16 | 25 | 75.967 | 79.831 | 5.1% | 0.5% | 0.034 |
| riverValley-128-17 | 25 | 82.702 | 87.477 | 5.8% | 0.6% | 0.046 |
| riverValley-128-2 | 25 | 91.295 | 96.099 | 5.3% | 0.6% | 0.029 |
| riverValley-128-21 | 25 | 72.436 | 76.217 | 5.2% | 0.5% | 0.03 |
| riverValley-128-3 | 25 | 62.374 | 66.11 | 6.0% | 0.5% | 0.032 |
| riverValley-128-6 | 25 | 62.204 | 65.38 | 5.1% | 0.4% | 0.026 |
| riverValley-128-9 | 25 | 70.244 | 73.816 | 5.1% | 0.5% | 0.036 |
| riverValley-256-1 | 25 | 269.472 | 289.512 | 7.4% | 0.7% | 0.051 |
| riverValley-96-2 | 9 | 3.281 | 3.481 | 6.1% | 0.1% | 0.018 |

The additional combined check (5% of initial volume and 0.1 block at every tile) passes 407/408 endpoints. Maximum tile-depth error across the set is 0.104 blocks. Exceptions follow; they are retained as failures of this target. A local depth mismatch can exist even when total stored volume passes.

| Map | Drought days | Difference / initial water | Max depth difference |
|---|---:|---:|---:|
| lakeBasin-128-14 | 9 | 1.4% | 0.104 |

A direct inspection of Lake Basin 128² seed 14 locates the nine-day depth difference at (21, 79). The analytic pooled surface leaves 0.103987 depth; the tick model dries this tile and its two wet neighbours. The starting depth is 0.663610 and the spill depth is 0.65. Fixed pool evaporation and changing local wet footprints can therefore produce different wet/dry boundaries even with similar total volume. The precise source of this local discrepancy remains a calibration question; it is not hidden by a looser passing label. See [depth evidence](results/depth-outlier.json); reproduce with `node investigation/cycles/run.cjs investigation/cycles/diagnose.ts`.

## Run time

Wall time in Node v24.13.0, AMD Ryzen 7 9800X3D 8-Core Processor. Batches ran concurrently with other work, so these are loaded-machine timings, not an isolated CPU benchmark. Generation, canonical settle and the six scenario timelines are timed separately. The six timelines total 73 simulated days; the direct nine- and 25-day drought comparisons are extra. File compression is outside the scenario timer. The viewer reads precomputed frames.

| Size | Maps | Generation median, s | Settle median / max, s | Timelines median / max, s | Per-day median, s |
|---|---:|---:|---:|---:|---:|
| 96² | 12 | 0.45 | 0.11 / 0.49 | 9.32 / 30.79 | 0.128 |
| 128² | 12 | 0.88 | 0.26 / 1.37 | 12.79 / 54.34 | 0.175 |
| 256² | 12 | 3.33 | 1.34 / 10.77 | 69.23 / 762.28 | 0.948 |

## Cycle signature

Eleven quantities describe each map: water kept after the first Normal drought and a full-ramp Hard drought, plus clean water kept in the original water regions after that long drought; how long the start keeps pumpable clean water; wet tiles lost; the largest number of fragments from one original water body; new badwater exposure; new contaminated soil; original trees and bushes lost; and recovery time after badtide. Stored water and plant losses are fractions of their original totals. Start access is capped at 26 days (26 means it remained available throughout the 25-day hazard), fragments at 20, recovery at six days (six means not recovered within five). Soil exposure is a fraction of all map tiles. Other entries are clamped to 0–1 only for distance.

Distance is the mean absolute difference over these eleven normalized values. A nearest-peer median close to zero means two seeds behave almost alike. This is a diagnostic, not M9's separate variety scale or an acceptance threshold.

The group key uses fixed bins: long-drought retention at 5/25/50/75%; new badwater exposure at 25/50/75%; start-water duration at 1/7/14/26 days. A large group means many maps share that broad opening. These bins do not establish perceptual equivalence.

| Theme | n | Water kept after 25 days | New badwater reach after 1 day | Start water, days | Largest group | Groups | Nearest-peer median |
|---|---:|---:|---:|---:|---:|---:|---:|
| River Valley | 30 | 5.8%–12.0% | 81.7%–90.4% | 0.0–1.0 | 73.3% | 2 | 0.0123 |
| Canyon | 30 | 0.0%–0.0% | 100.0%–100.0% | 0.0–0.0 | 100.0% | 1 | 0.0000 |
| Highlands | 30 | 0.0%–12.0% | 85.4%–100.0% | 0.0–1.0 | 50.0% | 4 | 0.0213 |
| Lake Basin | 30 | 48.8%–50.7% | 29.1%–45.3% | 20.0–20.0 | 66.7% | 2 | 0.0162 |
| Delta | 30 | 0.0%–6.9% | 92.0%–100.0% | 0.0–1.0 | 66.7% | 4 | 0.0093 |
| Islands | 30 | 48.3%–49.2% | 45.4%–58.0% | 19.0–20.0 | 63.3% | 2 | 0.0096 |

The gallery adds a continuous 97-day run through the first five Normal cycles and five recovery days. Original plant deaths persist. The survey uses isolated probes to compare terrain under the same weather; it does not claim that late-cycle vegetation would still match a fresh map.

## Definitions and limits

Water is deeper than 0.05; pumpable water is at least 0.3 deep, below 5% contamination, within two levels of the start's shore and within the map's own walking limit. Start walks reuse the repo's same-level and slope rules. The original walking network is fixed: this is water access potential, not a beaver pathfinding or consumption forecast.

Regions are fixed connected patches of the initial water, split into below-spill storage and river reaches. Their coordinates name the centroid, not an authored landmark. New water outside those patches is counted separately. Splits count connected descendants, including one-tile pools, at daily snapshots. First-dry and first-bad days are daily upper bounds; a missing event is right-censored at the run's end.

Recovery means at least 95% of initial water and moist area, and badwater area no more than the initial area plus 1% of initial wet tiles. It does not mean every tile is back to its original condition. Dead original plants never revive; surviving mature trees retain potential logs even when dead. New seedlings, growth/yield amounts and player pumping are outside this study.

Soil is an equilibrium spatial target with finite temporal rates, sampled every 16 ticks. On the 96² seed-1 badtide, one-tick and 16-tick updates give identical final soil and moisture, but differ by two plant deaths at day 1. This is an uncertainty check, not a comparison with the real game. Calibration remains necessary.

Machine-readable evidence: [summary](results/summary.json), [signatures](results/signatures.json), [all daily timelines](results/timelines.json.gz), and [golden checks](results/verification.json). Timelines contain regions, daily measures, first-arrival maps and plant deaths. Gallery frames are display-quantized; measurements use Float64 values.
