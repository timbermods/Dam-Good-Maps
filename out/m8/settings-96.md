20 seeds (1–20) at 96×96, each setting at two values, the rest at the theme's preset.

| Setting | Values | Target (PLAN §5) | Mean at the low value | Mean at the high value | Result |
|---|---|---|---|---|---|
| Relief | 20 → 90 | height range p5–p95 = 7 + 0.08·relief levels | 9.0 | 13.8 | moves: moved 4.8 (at least 3) |
| Highest terrain | 11 → 16 | terrain never above it (the highest tile) | 11 | 16 | moves: every map equals its target |
| Terracing | 10 → 90 | share of height steps that are one level = 0.86 − 0.0059·terracing | 0.675 | 0.425 | moves: moved 0.251 (at least 0.1) |
| Buildable land | tight → generous | flat share 0.40 / 0.52 / 0.60 (tiles whose 8 neighbours share their level) | 0.511 | 0.578 | moves: moved 0.067 (at least 0.03) |
| Buildable land (reach) | tight → generous | land walkable from the start: at least 750 / 1,300 / 2,500 tiles | 2718 | 4193 | moves: moved 1475 (at least 500) |
| Rivers | 0 → 3 | rivers entering on the map edge (0: a spring feeds the river) | 0 | 3 | moves: every map equals its target |
| River style | straight → meandering | meander amplitude: straight ≤ 0.05·H, meandering 0.12–0.2·H (largest distance from the source–outlet line ÷ H) | 0.054 | 0.260 | moves: moved 0.206 (at least 0.08) |
| River style (braided) | meandering → braided | a braided river splits into 2–4 channels across a low plain: rivers leaving by the map edge | 1.0 | 3.1 | moves: moved 2.1 (at least 1) |
| River flow | trickle → lush | total strength of the rivers' sources = 0.6× / 1× / 2× / 4× the size-aware official median | 1.82 | 12.14 | moves: moved 10.32 (at least 5) |
| Drought reserve | scarce → plenty | stored water near the start: the best of the dam site within 40 tiles and the natural water kept through the drought | 849 | 1206 | moves: moved 357 (at least 200) |
| Lakes and basins | none → many | natural basins of 20+ tiles: 0 / 0.5× / 1× / 2× the official median for the size | 0.2 | 3.6 | moves: moved 3.4 (at least 3) |
| Waterfalls | off → many | river bed drops of 2+ levels: 0 / 1–2 / 3–6 | 0.0 | 3.8 | moves: moved 3.8 (at least 2.5) |
| Badwater | off → high | badwater-to-clean strength ratio 0 / 0.3 / 0.65 / 1.2 | 0.00 | 1.20 | moves: moved 1.20 (at least 0.6) |
| Badwater distance | 20 → 50 | least distance from the start to badwater or contaminated soil | 26.9 | 85.0 | moves: moved 58.2 (at least 15) |
| Thorn belts | off → some | 1–3 belts of 13–40 thorns, 20+ tiles from the start: thorns on the map | 0.0 | 27.6 | moves: moved 27.6 (at least 13) |
| Unstable cores | off → on | 1–4 cores, 40+ tiles from the start: cores on the map | 0.0 | 2.9 | moves: moved 2.9 (at least 1) |
| Forest density | 50 → 200 | trees per 10k tiles, size-aware (medium 1,061 at 100%) | 657 | 2616 | moves: moved 1959 (at least 500) |
| Grove size | scattered → bigWoods | median grove 6 / 10 / 20 trees | 5.7 | 21.1 | moves: moved 15.4 (at least 6) |
| Species mix | pine → birch | share of each species among the trees (here: Birch weight 0 vs 100, the rest 0) | 0.000 | 1.000 | moves: moved 1.000 (at least 0.9) |
| Berries near start | 20 → 100 | living berry bushes within 20 tiles of the start | 44 | 103 | moves: moved 59 (at least 30) |
| Berry bushes elsewhere | 50 → 300 | berry bushes per 10k tiles, size-aware (medium 92 at 100%) | 96 | 494 | moves: moved 398 (at least 80) |
| Ruins and scrap | 25 → 300 | scrap per 1k tiles, size-aware (medium 705 at 100%) | 478 | 2400 | moves: moved 1922 (at least 600) |
| Relics | off → some | 0–3 small, 0–2 medium and 0–1 large relics, in their distance bands: relics on the map | 0.0 | 2.2 | moves: moved 2.2 (at least 1) |
| Geothermal fields | off → some | 1–3 fields per map, 30–120 tiles out, on flat dry ground: fields on the map | 0.0 | 1.0 | moves: moved 1.0 (at least 0.9) |
| Mine sites | 0 → 3 | mine sites (UndergroundRuins) on flat ground 60+ tiles out: 0–4 | 0.0 | 3.0 | moves: moved 3.0 (at least 2) |
| Start area | small → large | the start's bench: radius 5 / 6 / 8 (tiles at the start's level within 8) | 89 | 195 | moves: moved 106 (at least 60) |
| Water without stairs | 8 → 20 | tiles' walk on the start's level, without slopes, to a shore touching clean water a pump reaches (D85) | 2.6 | 6.7 | moves: moved 4.1 (at least 1.5) |
| Minimum starting trees | 20 → 120 | living trees within 20 tiles' walk of the start (D85) | 66 | 152 | moves: moved 85 (at least 30) |
| Minimum starting bushes | 10 → 80 | living berry bushes within 20 tiles' walk of the start (D85) | 31 | 96 | moves: moved 65 (at least 30) |
| Start rules: no badwater within | 15 → 50 | least distance from the start to badwater or contaminated soil | 21.8 | 85.0 | moves: moved 63.3 (at least 15) |
| Start rules: no ruins within | 5 → 40 | distance from the start to the nearest ruin column | 21.3 | 47.5 | moves: moved 26.2 (at least 15) |
| Designed for | easy → hard | stored water near the start (Easy needs 86 × the reserve, Hard 1,174 × it at 3 deep) | 857 | 2464 | moves: moved 1607 (at least 300) |
| Theme | riverValley → lakeBasin | water share (target River Valley 0.12, Lake Basin 0.30) | 0.084 | 0.282 | moves: moved 0.198 (at least 0.12) |
