# Comparison tables

Read [methods](METHODS.md) before adopting targets. These are descriptive bands, not significance tests or global population estimates. The reference is 128² at 60 m per tile, relief-normalised to 16. Generated maps use native default heights. Every table uses the same measurement code for both groups.

## Named regions and generated maps

Bands are p10 / median / p90. Each named region gets one vote; each generated seed gets one vote. Water statistics use settled real conversions only. Missing measures are not zeros. The last column counts generated values outside the real central band; roughly 20% would be expected for another sample from the same continuous distribution, but ties, unequal groups and exploratory selection prevent a formal test here.

| Measure and unit | Real band | Generated band | Real regions / generated maps measured | Generated outside real band |
|---|---|---|---|---|
| branching (junctions / 10000 tiles) | 0.61 / 7.324 / 10.376 | 3.662 / 6.714 / 9.766 | 99 / 180 | 6.7% |
| drainageDensity (channel tiles / tile²) | 0.043 / 0.059 / 0.076 | 0.037 / 0.051 / 0.061 | 99 / 180 | 30.0% |
| sinuosity (path / chord) | 1.057 / 1.207 / 1.333 | 1.074 / 1.157 / 1.249 | 99 / 180 | 2.2% |
| junctionAngle (degrees) | 33.69 / 71.565 / 90 | 75.964 / 93.366 / 119.745 | 99 / 180 | 52.8% |
| segmentLength (tiles) | 17.314 / 21.485 / 30.243 | 15.556 / 25 / 35.042 | 99 / 180 | 32.8% |
| splitTileShare (fraction of flowing wet cells) | 0.393 / 0.554 / 0.65 | 0.339 / 0.511 / 0.672 | 91 / 180 | 33.9% |
| rejoinTileShare (rejoining cells / flowing wet cells) | 0.37 / 0.529 / 0.636 | 0.342 / 0.514 / 0.671 | 91 / 180 | 30.6% |
| enclosedIslands (enclosed dry components >=4 tiles) | 0 / 0 / 5 | 0 / 0 / 4 | 91 / 180 | 3.3% |
| stepLength (tiles) | 1 / 1 / 1 | 1 / 1 / 1 | 99 / 180 | 3.9% |
| valleyWidth1 (tiles between sides +1 level) | 3 / 5 / 7 | 4 / 5 / 7 | 98 / 180 | 5.6% |
| valleyWidth2 (tiles between sides +2 levels) | 5 / 9 / 12 | 3 / 5 / 10 | 89 / 179 | 43.6% |
| narrowingRatio (narrowest / widest sampled valley) | 0.1 / 0.25 / 0.6 | 0.105 / 0.25 / 0.5 | 89 / 179 | 11.7% |
| straightShare8 (fraction of contour edges) | 0.001 / 0.02 / 0.056 | 0.085 / 0.139 / 0.355 | 99 / 180 | 98.3% |
| longestRun (tiles) | 9 / 12 / 16 | 19 / 28 / 39 | 99 / 180 | 98.3% |
| ridgeThicknessCV (coefficient of variation) | 0.306 / 0.353 / 0.458 | 0.255 / 0.323 / 0.348 | 99 / 180 | 38.3% |
| ridgeHeightStd (levels) | 0 / 0 / 0.515 | 0 / 0 / 0 | 99 / 180 | 0.0% |
| basinRimThicknessCV (coefficient of variation) | 0.244 / 0.419 / 0.475 | 0.017 / 0.184 / 0.29 | 76 / 154 | 70.1% |
| lakeShare (fraction of tiles) | 0 / 0.05 / 0.203 | 0 / 0.021 / 0.316 | 91 / 180 | 33.3% |
| lakes (lake components) | 0 / 1 / 2 | 0 / 1 / 3 | 91 / 180 | 18.9% |
| fallCount (connected lips with surface drop >=1) | 0 / 1 / 4 | 0 / 3 / 10 | 91 / 180 | 25.0% |
| fallDrop (levels) | 1 / 1.009 / 1.732 | 1.066 / 1.856 / 3.674 | 85 / 158 | 79.1% |
| fallSpacing (tiles to nearest other fall) | 2.915 / 15.133 / 73.082 | 2.915 / 14.142 / 59.104 | 72 / 133 | 15.8% |
| damSites (sampled sites / 10000 tiles) | 0 / 6.1 / 14.04 | 3.66 / 6.1 / 7.32 | 91 / 180 | 0.0% |
| reservoirVolume (tile³) | 0 / 1264 / 4478 | 826 / 2483 / 13800 | 91 / 180 | 33.3% |
| reservoirEfficiency (tile³ / dam tile) | 0 / 173.3 / 762.7 | 174.4 / 501.8 / 4758 | 91 / 180 | 33.9% |
| damLength (tiles) | 2 / 8 / 13 | 3 / 4 / 11 | 86 / 180 | 5.6% |

## Sensitivity to edge sealing

The main terrain reference uses the original quantised crop. The conversion then raises its border, except at selected outlets. Generated maps retain their native designed edges. This is a material difference in treatment. The same naturalness measurements on the sealed real conversions give the medians below. Sealing raises straight-run measures sharply; the longest-run comparison reverses. The remaining differences do not isolate interior generation processes.

| Measure | Real before sealing | Real after sealing | Generated native map | Generated outside sealed real p10–p90 |
|---|---|---|---|---|
| straightShare8 | 0.02 | 0.094 | 0.139 | 21.7% |
| longestRun | 12 | 124 | 28 | 100.0% |
| ridgeThicknessCV | 0.353 | 0.353 | 0.323 | 34.4% |
| ridgeHeightStd | 0 | 0 | 0 | 0.0% |
| basinRimThicknessCV | 0.419 | 0.382 | 0.184 | 59.1% |

For process tuning, supply the prototype's terrain before an added artificial border as the bench's referenceHeights. Keep playable heights for water and validation. If borders are part of the process being studied, report both conventions explicitly.

## Generated themes

Variety uses the unchanged published workshop calibration. These figures include placed resources and simulated water. Themes should be compared with relevant terrain strata as well as the broad reference above.

| Theme | Passed | Variety | Straight contour fraction, median | Valley width +2, median tiles | Lake share, median |
|---|---|---|---|---|---|
| canyon | 30 / 30 | 0.15 | 0.366 | 4 | 0.007 |
| delta | 30 / 30 | 0.323 | 0.119 | 7 | 0.072 |
| highlands | 30 / 30 | 0.368 | 0.095 | 5 | 0 |
| islands | 30 / 30 | 0.379 | 0.14 | 9 | 0.319 |
| lakeBasin | 30 / 30 | 0.296 | 0.144 | 3 | 0.242 |
| riverValley | 30 / 30 | 0.308 | 0.116 | 5 | 0.007 |

## Named selection and random-land controls

The cohorts stay separate. This table shows how choosing interesting named terrain changes the reference. Random controls have no assigned process family. Both cohorts use the same mapping, scale, source policy, edge treatment and measurement code.

| Measure and unit | Named median | Random median | Named / random regions measured |
|---|---|---|---|
| branching (junctions / 10000 tiles) | 7.324 | 9.155 | 99 / 50 |
| drainageDensity (channel tiles / tile²) | 0.059 | 0.063 | 99 / 50 |
| sinuosity (path / chord) | 1.207 | 1.287 | 99 / 50 |
| junctionAngle (degrees) | 71.565 | 81.87 | 99 / 48 |
| segmentLength (tiles) | 21.485 | 24.657 | 99 / 50 |
| splitTileShare (fraction of flowing wet cells) | 0.554 | 0.551 | 91 / 20 |
| rejoinTileShare (rejoining cells / flowing wet cells) | 0.529 | 0.51 | 91 / 20 |
| enclosedIslands (enclosed dry components >=4 tiles) | 0 | 0 | 91 / 20 |
| stepLength (tiles) | 1 | 1 | 99 / 50 |
| valleyWidth1 (tiles between sides +1 level) | 5 | 4 | 98 / 47 |
| valleyWidth2 (tiles between sides +2 levels) | 9 | 10 | 89 / 44 |
| narrowingRatio (narrowest / widest sampled valley) | 0.25 | 0.263 | 89 / 44 |
| straightShare8 (fraction of contour edges) | 0.02 | 0.017 | 99 / 50 |
| longestRun (tiles) | 12 | 12 | 99 / 50 |
| ridgeThicknessCV (coefficient of variation) | 0.353 | 0.395 | 99 / 49 |
| ridgeHeightStd (levels) | 0 | 0.263 | 99 / 49 |
| basinRimThicknessCV (coefficient of variation) | 0.419 | 0.451 | 76 / 24 |
| lakeShare (fraction of tiles) | 0.05 | 0.023 | 91 / 20 |
| lakes (lake components) | 1 | 1 | 91 / 20 |
| fallCount (connected lips with surface drop >=1) | 1 | 1 | 91 / 20 |
| fallDrop (levels) | 1.009 | 1.008 | 85 / 14 |
| fallSpacing (tiles to nearest other fall) | 15.133 | 10.5 | 72 / 9 |
| damSites (sampled sites / 10000 tiles) | 6.1 | 7.93 | 91 / 20 |
| reservoirVolume (tile³) | 1264 | 1396 | 91 / 20 |
| reservoirEfficiency (tile³ / dam tile) | 173.3 | 126.5 | 91 / 20 |
| damLength (tiles) | 8 | 11 | 86 / 19 |

All sizes, scales, mappings and families remain in data/targets.json. Scalar support counts vary because some features are absent or water did not settle. Histograms and mean transverse valley profiles are stored with their own support counts. Do not interpret low support as agreement.
