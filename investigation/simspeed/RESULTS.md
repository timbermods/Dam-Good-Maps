# Measured results

216/216 maps; 18/18 cycle workload sets; 18/18 batched stage sets; 72/72 profiles. See [machine information](results/node/environment.json) and [complete summary](results/summary.json).

**Cross-runtime acceptance: complete. Chromium: passed.**

Supplemental exact-cycle reference: **complete**. Its independent water/soil code is profiled separately in [EXACT-CYCLES.md](EXACT-CYCLES.md); the original-model cycle speedups below do not apply to it.

M9 whole-pipeline supplement: **complete**, reported in [M9-PIPELINE.md](M9-PIPELINE.md). Stacked-layer applicability is assessed separately in [STACKED-LAYERS.md](STACKED-LAYERS.md).

Ratios are medians of paired baseline/variant measurements across maps (greater than 1 is faster). Thread CPU time is the primary computational comparison. The matrix used up to three workers, running variants sequentially within a map. The busy host caused large scheduling gaps even in serial probes: wall ratios are retained observations, not reliable idle-machine speedups or budget evidence. Generation checks are descriptive. A dash marks unchanged workload code; its raw measurements are retained as controls. The water-only prototypes do not change analytic drought, which uses separate flood and saturation functions. Small differences require replication.

| Prototype | Canonical CPU / wall | Preview CPU / wall | Drought CPU / wall | 73-day cycle CPU / wall | Generation CPU / wall |
|---|---:|---:|---:|---:|---:|
| saturation | 1.09× / 1.08× | 1.07× / 1.06× | — | 1.03× / 1.04× | 1.04× / 1.08× |
| topology | 1.05× / 1.06× | 1.00× / 1.03× | — | 1.02× / 1.03× | 1.02× / 1.07× |
| clear | 1.00× / 1.00× | 1.00× / 1.01× | — | 0.99× / 1.00× | 1.03× / 1.05× |
| unroll | 1.06× / 1.07× | 1.06× / 1.06× | — | 1.03× / 1.08× | 1.06× / 1.08× |
| drought | — | — | 1.04× / 1.03× | — | 1.02× / 1.06× |
| combined | 1.19× / 1.20× | 1.19× / 1.21× | 1.04× / 1.03× | 1.13× / 1.11× | 1.10× / 1.15× |

## Every theme and size: thread CPU time

Short stages are medians of three repetitions; cycles are one complete six-probe run per variant. Canonical includes prefill; preview includes warm-start preparation. CPU time excludes descheduling and background V8 threads, so it is not a user-visible latency promise.

| Theme | Size | Canonical baseline → combined CPU ms | Preview baseline → combined CPU ms | Drought baseline → combined CPU ms | 73 days baseline → combined CPU s |
|---|---:|---:|---:|---:|---:|
| riverValley | 96² | 82.6 → 71.4 | 62.5 → 50.8 | 0.9 → 0.9 | 9.29 → 8.19 |
| canyon | 96² | 53.8 → 43.4 | 29.5 → 23.4 | 1.0 → 0.9 | 6.41 → 5.66 |
| highlands | 96² | 152.3 → 117.3 | 58.6 → 43.0 | 1.0 → 0.9 | 13.44 → 11.88 |
| lakeBasin | 96² | 336.0 → 273.5 | 109.4 → 84.2 | 0.9 → 1.0 | 31.59 → 27.11 |
| islands | 96² | 469.0 → 375.0 | 182.3 → 161.3 | 1.0 → 0.9 | 39.31 → 33.01 |
| delta | 96² | 117.3 → 101.8 | 53.9 → 45.5 | 0.9 → 0.9 | 11.02 → 9.52 |
| riverValley | 128² | 140.8 → 109.3 | 96.8 → 81.2 | 1.5 → 1.6 | 14.90 → 12.80 |
| canyon | 128² | 78.1 → 60.3 | 46.9 → 40.4 | 1.6 → 1.5 | 8.86 → 8.31 |
| highlands | 128² | 320.5 → 289.0 | 156.3 → 132.8 | 1.6 → 1.5 | 14.94 → 13.28 |
| lakeBasin | 128² | 547.0 → 485.0 | 182.0 → 145.7 | 1.6 → 1.5 | 52.75 → 44.56 |
| islands | 128² | 1328.0 → 1125.0 | 469.0 → 407.0 | 1.7 → 1.7 | 67.17 → 58.28 |
| delta | 128² | 289.5 → 226.5 | 140.8 → 105.5 | 1.6 → 1.6 | 17.33 → 15.65 |
| riverValley | 256² | 797.0 → 734.0 | 430.0 → 359.0 | 6.2 → 5.8 | 52.46 → 48.08 |
| canyon | 256² | 406.5 → 344.0 | 258.0 → 234.5 | 5.8 → 5.8 | 31.18 → 27.95 |
| highlands | 256² | 1188.0 → 969.0 | 469.0 → 421.0 | 6.0 → 5.9 | 61.63 → 56.63 |
| lakeBasin | 256² | 2328.0 → 1954.0 | 1313.0 → 1093.0 | 5.9 → 5.5 | 104.97 → 90.19 |
| islands | 256² | 3595.0 → 3187.0 | 1296.0 → 1125.0 | 4.9 → 4.7 | 138.30 → 122.09 |
| delta | 256² | 1344.0 → 1203.0 | 531.5 → 422.0 | 5.8 → 5.6 | 45.78 → 42.00 |

## Observed wall time under contention

These observations do not establish budget compliance. 96² has no stated canonical budget; PLAN targets 600 ms at 128² and 3,000 ms at 256². The editor water-preview target is 2,000 ms after a local edit at 256². This probe measures that call, including warm-start preparation, but excludes the rest of the editor interaction.

| Theme | Size | Canonical baseline → combined ms | Preview baseline → combined ms | Drought baseline → combined ms | 73 days baseline → combined s |
|---|---:|---:|---:|---:|---:|
| riverValley | 96² | 88.0 → 72.2 | 62.6 → 49.5 | 0.9 → 0.9 | 14.33 → 14.13 |
| canyon | 96² | 54.2 → 44.8 | 29.5 → 23.6 | 0.9 → 0.9 | 10.28 → 9.87 |
| highlands | 96² | 151.7 → 116.3 | 61.6 → 44.7 | 1.0 → 1.0 | 21.95 → 19.93 |
| lakeBasin | 96² | 339.5 → 270.3 | 109.4 → 85.8 | 0.9 → 1.0 | 54.42 → 46.91 |
| islands | 96² | 469.2 → 390.7 | 179.5 → 159.9 | 1.0 → 0.9 | 59.22 → 51.16 |
| delta | 96² | 115.3 → 100.0 | 55.2 → 45.7 | 0.9 → 0.9 | 18.31 → 17.26 |
| riverValley | 128² | 143.6 → 109.3 | 98.5 → 78.4 | 1.5 → 1.6 | 25.66 → 20.69 |
| canyon | 128² | 78.0 → 65.0 | 49.3 → 40.1 | 1.6 → 1.5 | 16.54 → 14.95 |
| highlands | 128² | 329.3 → 289.0 | 159.6 → 133.2 | 1.6 → 1.6 | 23.86 → 21.25 |
| lakeBasin | 128² | 546.9 → 482.3 | 183.1 → 152.8 | 1.6 → 1.5 | 73.04 → 66.24 |
| islands | 128² | 1344.3 → 1114.4 | 471.9 → 414.4 | 1.7 → 1.7 | 103.69 → 95.38 |
| delta | 128² | 293.1 → 225.7 | 138.7 → 107.3 | 1.6 → 1.6 | 26.90 → 23.15 |
| riverValley | 256² | 799.0 → 726.1 | 428.1 → 358.9 | 6.1 → 5.9 | 83.94 → 79.35 |
| canyon | 256² | 411.2 → 356.2 | 261.8 → 232.1 | 5.7 → 5.7 | 46.78 → 38.98 |
| highlands | 256² | 1204.1 → 979.0 | 458.3 → 411.7 | 6.2 → 6.1 | 94.01 → 81.76 |
| lakeBasin | 256² | 2315.2 → 1964.7 | 1321.0 → 1090.6 | 6.0 → 5.5 | 125.06 → 107.02 |
| islands | 256² | 3602.2 → 3221.6 | 1291.5 → 1127.1 | 4.9 → 4.8 | 165.71 → 123.49 |
| delta | 256² | 1349.1 → 1188.6 | 529.8 → 426.2 | 5.8 → 5.6 | 46.03 → 42.46 |

## Chromium elapsed-time measurements

216/216 map cases and 18/18 stage/cycle cases; see [browser environment](results/chromium/environment.json). Three independent Web Workers run the same suite. These are elapsed-time ratios on a shared host, without thread CPU counters; they are not idle-machine latency guarantees. A dash identifies unchanged workload code.

| Prototype | Canonical | Preview | Drought | 73-day cycle | Generation |
|---|---:|---:|---:|---:|---:|
| saturation | 1.07× | 1.10× | — | 1.05× | 1.05× |
| topology | 1.01× | 1.03× | — | 1.01× | 1.02× |
| clear | 1.02× | 1.02× | — | 1.01× | 1.00× |
| unroll | 1.04× | 1.07× | — | 1.04× | 1.03× |
| drought | — | — | 1.02× | — | 1.00× |
| combined | 1.15× | 1.16× | 1.02× | 1.13× | 1.09× |

| Theme | Size | Canonical baseline → combined ms | Preview baseline → combined ms | Drought baseline → combined ms | 73 days baseline → combined s |
|---|---:|---:|---:|---:|---:|
| riverValley | 96² | 97.6 → 69.3 | 68.5 → 54.2 | 1.0 → 1.0 | 8.16 → 7.10 |
| canyon | 96² | 59.0 → 44.3 | 31.4 → 24.3 | 1.0 → 1.0 | 5.29 → 4.65 |
| highlands | 96² | 161.9 → 116.2 | 65.5 → 50.2 | 1.0 → 0.9 | 10.86 → 9.69 |
| lakeBasin | 96² | 361.5 → 296.3 | 120.3 → 104.7 | 1.0 → 1.0 | 26.87 → 21.64 |
| islands | 96² | 533.9 → 451.6 | 216.2 → 187.8 | 1.0 → 1.0 | 32.54 → 27.11 |
| delta | 96² | 118.0 → 105.2 | 56.6 → 46.3 | 1.0 → 0.9 | 8.80 → 7.87 |
| riverValley | 128² | 145.7 → 122.1 | 101.3 → 86.3 | 1.6 → 1.6 | 11.32 → 10.01 |
| canyon | 128² | 68.8 → 61.1 | 44.6 → 39.2 | 1.5 → 1.4 | 7.03 → 6.50 |
| highlands | 128² | 291.8 → 271.4 | 144.4 → 130.1 | 1.6 → 1.5 | 11.28 → 10.81 |
| lakeBasin | 128² | 498.6 → 456.6 | 172.6 → 150.0 | 1.5 → 1.6 | 45.18 → 38.69 |
| islands | 128² | 1153.7 → 1060.1 | 423.9 → 391.3 | 1.6 → 1.5 | 58.92 → 51.56 |
| delta | 128² | 299.1 → 256.1 | 142.2 → 120.1 | 1.7 → 1.6 | 14.80 → 14.20 |
| riverValley | 256² | 944.1 → 812.1 | 488.4 → 417.4 | 6.1 → 6.0 | 43.26 → 40.05 |
| canyon | 256² | 487.7 → 428.8 | 316.1 → 253.4 | 5.7 → 5.9 | 25.23 → 22.31 |
| highlands | 256² | 1193.0 → 1008.1 | 477.9 → 412.2 | 5.7 → 5.5 | 46.92 → 43.19 |
| lakeBasin | 256² | 2170.4 → 2073.8 | 1256.7 → 1113.9 | 5.4 → 5.3 | 90.13 → 80.32 |
| islands | 256² | 4527.3 → 4116.0 | 1730.6 → 1500.5 | 5.5 → 5.7 | 147.47 → 121.51 |
| delta | 256² | 1300.0 → 1206.5 | 507.2 → 459.1 | 5.4 → 5.4 | 44.39 → 41.32 |

## Workload profiles

Each profile reports method call counts, wall-clock self/inclusive time and total workload CPU time. The table names the largest self-time components; uninstrumented work is explicitly a remainder. Timers, wrapper dispatch and host scheduling affect these values, so they are attribution diagnostics, not speedup measurements. The cycle profile covers the first day of each of six probes; the uninstrumented benchmark covers all 73 days.

| Workload | Largest self-time components |
|---|---|
| canyon-128-canonical | WaterSim.substep 108 ms; WaterSim.computeWn 22 ms; WaterSim.buildActive 14 ms |
| canyon-128-cycle-sample | WaterSim.substep 909 ms; CycleModel.updateLife 888 ms; uninstrumented remainder 155 ms |
| canyon-128-drought | spillLevels 30 ms; droughtStorage 3 ms; clusterSaturation 1 ms |
| canyon-128-preview | WaterSim.substep 75 ms; uninstrumented remainder 13 ms; WaterSim.computeWn 7 ms |
| canyon-256-canonical | WaterSim.substep 530 ms; WaterSim.computeWn 68 ms; WaterSim.buildActive 59 ms |
| canyon-256-cycle-sample | WaterSim.substep 2828 ms; CycleModel.updateLife 2437 ms; WaterSim.computeWn 379 ms |
| canyon-256-drought | spillLevels 148 ms; droughtStorage 16 ms; clusterSaturation 4 ms |
| canyon-256-preview | WaterSim.substep 369 ms; WaterSim.computeWn 49 ms; WaterSim.buildActive 48 ms |
| canyon-96-canonical | WaterSim.substep 1263 ms; WaterSim.updateEvapMod 162 ms; WaterSim.buildActive 131 ms |
| canyon-96-cycle-sample | WaterSim.substep 7010 ms; CycleModel.updateLife 6311 ms; WaterSim.computeWn 1183 ms |
| canyon-96-drought | spillLevels 19 ms; droughtStorage 2 ms; clusterSaturation 1 ms |
| canyon-96-preview | WaterSim.substep 537 ms; WaterSim.updateEvapMod 111 ms; uninstrumented remainder 63 ms |
| delta-128-canonical | WaterSim.substep 479 ms; WaterSim.computeWn 54 ms; WaterSim.buildActive 42 ms |
| delta-128-cycle-sample | WaterSim.substep 1610 ms; CycleModel.updateLife 1040 ms; WaterSim.computeWn 213 ms |
| delta-128-drought | spillLevels 31 ms; droughtStorage 4 ms; clusterSaturation 1 ms |
| delta-128-preview | WaterSim.substep 218 ms; WaterSim.computeWn 33 ms; WaterSim.buildActive 21 ms |
| delta-256-canonical | WaterSim.substep 1838 ms; WaterSim.buildActive 719 ms; WaterSim.computeWn 265 ms |
| delta-256-cycle-sample | WaterSim.substep 4901 ms; CycleModel.updateLife 2860 ms; WaterSim.buildActive 2027 ms |
| delta-256-drought | spillLevels 152 ms; droughtStorage 23 ms; clusterSaturation 6 ms |
| delta-256-preview | WaterSim.substep 493 ms; WaterSim.buildActive 202 ms; WaterSim.computeWn 66 ms |
| delta-96-canonical | WaterSim.substep 160 ms; WaterSim.computeWn 18 ms; WaterSim.buildActive 13 ms |
| delta-96-cycle-sample | WaterSim.substep 1066 ms; CycleModel.updateLife 665 ms; WaterSim.computeWn 152 ms |
| delta-96-drought | spillLevels 18 ms; droughtStorage 2 ms; clusterSaturation 1 ms |
| delta-96-preview | WaterSim.substep 56 ms; WaterSim.computeWn 8 ms; WaterSim.buildActive 6 ms |
| highlands-128-canonical | WaterSim.substep 542 ms; WaterSim.computeWn 80 ms; WaterSim.buildActive 59 ms |
| highlands-128-cycle-sample | WaterSim.substep 1521 ms; CycleModel.updateLife 1249 ms; WaterSim.computeWn 205 ms |
| highlands-128-drought | spillLevels 41 ms; droughtStorage 5 ms; clusterSaturation 1 ms |
| highlands-128-preview | WaterSim.substep 260 ms; WaterSim.computeWn 33 ms; WaterSim.buildActive 25 ms |
| highlands-256-canonical | WaterSim.substep 1952 ms; uninstrumented remainder 359 ms; WaterSim.buildActive 246 ms |
| highlands-256-cycle-sample | WaterSim.substep 5750 ms; CycleModel.updateLife 3538 ms; WaterSim.computeWn 762 ms |
| highlands-256-drought | spillLevels 162 ms; droughtStorage 20 ms; clusterSaturation 6 ms |
| highlands-256-preview | WaterSim.substep 589 ms; WaterSim.computeWn 80 ms; uninstrumented remainder 74 ms |
| highlands-96-canonical | WaterSim.substep 3147 ms; WaterSim.computeWn 473 ms; WaterSim.buildActive 193 ms |
| highlands-96-cycle-sample | WaterSim.substep 15560 ms; CycleModel.updateLife 7765 ms; WaterSim.computeWn 2327 ms |
| highlands-96-drought | spillLevels 22 ms; droughtStorage 3 ms; clusterSaturation 1 ms |
| highlands-96-preview | WaterSim.substep 1058 ms; WaterSim.buildActive 145 ms; WaterSim.updateEvapMod 124 ms |
| islands-128-canonical | WaterSim.substep 1940 ms; WaterSim.computeWn 250 ms; WaterSim.buildActive 238 ms |
| islands-128-cycle-sample | WaterSim.substep 6986 ms; CycleModel.updateLife 1781 ms; WaterSim.computeWn 965 ms |
| islands-128-drought | spillLevels 37 ms; droughtStorage 7 ms; clusterSaturation 3 ms |
| islands-128-preview | WaterSim.substep 759 ms; WaterSim.computeWn 104 ms; WaterSim.buildActive 71 ms |
| islands-256-canonical | WaterSim.substep 7375 ms; WaterSim.computeWn 1003 ms; WaterSim.buildActive 840 ms |
| islands-256-cycle-sample | WaterSim.substep 14586 ms; CycleModel.updateLife 4195 ms; WaterSim.computeWn 1928 ms |
| islands-256-drought | spillLevels 157 ms; droughtStorage 27 ms; clusterSaturation 10 ms |
| islands-256-preview | WaterSim.substep 2785 ms; WaterSim.computeWn 387 ms; WaterSim.buildActive 333 ms |
| islands-96-canonical | WaterSim.substep 934 ms; WaterSim.computeWn 93 ms; WaterSim.buildActive 85 ms |
| islands-96-cycle-sample | WaterSim.substep 3678 ms; CycleModel.updateLife 1037 ms; WaterSim.computeWn 503 ms |
| islands-96-drought | spillLevels 18 ms; droughtStorage 3 ms; clusterSaturation 1 ms |
| islands-96-preview | WaterSim.substep 353 ms; WaterSim.computeWn 60 ms; WaterSim.buildActive 36 ms |
| lakeBasin-128-canonical | WaterSim.substep 858 ms; WaterSim.computeWn 103 ms; WaterSim.buildActive 98 ms |
| lakeBasin-128-cycle-sample | WaterSim.substep 4675 ms; CycleModel.updateLife 1499 ms; WaterSim.computeWn 638 ms |
| lakeBasin-128-drought | spillLevels 34 ms; droughtStorage 6 ms; clusterSaturation 2 ms |
| lakeBasin-128-preview | WaterSim.substep 338 ms; WaterSim.computeWn 41 ms; WaterSim.buildActive 33 ms |
| lakeBasin-256-canonical | WaterSim.substep 3934 ms; WaterSim.computeWn 590 ms; WaterSim.buildActive 440 ms |
| lakeBasin-256-cycle-sample | WaterSim.substep 12249 ms; CycleModel.updateLife 4016 ms; WaterSim.computeWn 1676 ms |
| lakeBasin-256-drought | spillLevels 141 ms; droughtStorage 18 ms; clusterSaturation 7 ms |
| lakeBasin-256-preview | WaterSim.substep 1868 ms; WaterSim.computeWn 247 ms; WaterSim.buildActive 220 ms |
| lakeBasin-96-canonical | WaterSim.substep 11182 ms; WaterSim.computeWn 2191 ms; WaterSim.buildActive 1235 ms |
| lakeBasin-96-cycle-sample | WaterSim.substep 51879 ms; CycleModel.updateLife 11897 ms; WaterSim.computeWn 7629 ms |
| lakeBasin-96-drought | spillLevels 17 ms; droughtStorage 3 ms; clusterSaturation 1 ms |
| lakeBasin-96-preview | WaterSim.substep 9599 ms; WaterSim.computeWn 1615 ms; WaterSim.updateEvapMod 1266 ms |
| riverValley-128-canonical | WaterSim.substep 208 ms; WaterSim.computeWn 22 ms; WaterSim.buildActive 21 ms |
| riverValley-128-cycle-sample | WaterSim.substep 1239 ms; CycleModel.updateLife 1194 ms; WaterSim.computeWn 173 ms |
| riverValley-128-drought | spillLevels 31 ms; droughtStorage 4 ms; clusterSaturation 1 ms |
| riverValley-128-preview | WaterSim.substep 125 ms; WaterSim.computeWn 19 ms; WaterSim.buildActive 13 ms |
| riverValley-256-canonical | WaterSim.substep 1066 ms; WaterSim.computeWn 159 ms; WaterSim.buildActive 113 ms |
| riverValley-256-cycle-sample | WaterSim.substep 5193 ms; CycleModel.updateLife 3810 ms; WaterSim.computeWn 740 ms |
| riverValley-256-drought | spillLevels 139 ms; droughtStorage 17 ms; clusterSaturation 6 ms |
| riverValley-256-preview | WaterSim.substep 579 ms; WaterSim.computeWn 76 ms; WaterSim.buildActive 54 ms |
| riverValley-96-canonical | WaterSim.substep 1331 ms; WaterSim.computeWn 105 ms; uninstrumented remainder 103 ms |
| riverValley-96-cycle-sample | WaterSim.substep 13279 ms; CycleModel.updateLife 10074 ms; WaterSim.computeWn 1901 ms |
| riverValley-96-drought | spillLevels 21 ms; droughtStorage 3 ms; clusterSaturation 1 ms |
| riverValley-96-preview | WaterSim.substep 1394 ms; WaterSim.computeWn 296 ms; WaterSim.updateEvapMod 97 ms |

## Proof coverage

1512 complete nonempty exports were generated, giving 1296 exact byte comparisons against baseline. There are 3038 canonical/warm snapshots, 864 analytic drought arrays and 1692 cycle snapshots per implementation. Each snapshot is checked across all variants before a result is saved. Full array bytes are compared in Node; checkpoint SHA-256s and per-seed file hashes are retained.

The 12 Python golden fixtures and six boundary grids are recorded in [golden.json](results/node/golden.json). [Type checking](results/typecheck.json) covers copied TypeScript modules. [build.json](results/build.json) fingerprints every bundle and input module. Chromium independently generated the same 1,512 exports and passed the same byte comparisons and checkpoint suite; all 216 file-hash sets, 3,038 canonical/warm snapshots, 864 analytic arrays, 1,692 cycle snapshots and golden digests match Node exactly.
