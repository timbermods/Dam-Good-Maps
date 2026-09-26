# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 120 of 132 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2228 |
| S02 | suite | yes | 3 | yes |  | cleared | 9069 |
| S03 | suite | yes | 3 | yes |  | cleared | 2189 |
| S04 | suite | **no** | 3 | no |  |  | 519 |
| S05 | suite | yes | 2 | yes |  | reduced | 1714 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 3100 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1665 |
| S08 | suite | yes | 2 | yes |  |  | 471 |
| S09 | suite | yes | 3 | yes |  |  | 1037 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2847 |
| P01 | simple | yes | 2 | yes |  |  | 5589 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 1310 |
| P03 | simple | yes | 1 | yes |  |  | 394 |
| P04 | simple | yes | 1 | yes |  |  | 481 |
| P05 | simple | yes | 2 | yes |  | cleared | 1094 |
| P06 | simple | yes | 2 | yes |  |  | 748 |
| P07 | simple | yes | 2 | yes |  |  | 1235 |
| P08 | simple | yes | 2 | yes | g1 |  | 1240 |
| P09 | simple | yes | 2 | yes |  |  | 718 |
| P10 | simple | yes | 1 | yes | g1 |  | 1263 |
| P12 | simple | yes | 1 | yes | g1 |  | 741 |
| P14 | simple | yes | 1 | yes |  | cleared | 756 |
| F01 | followup | yes | 1 | yes |  |  | 1303 |
| F02 | followup | yes | 1 | yes |  |  | 1377 |
| F03 | followup | yes | 1 | yes |  |  | 1197 |
| F04 | followup | yes | 1 | yes |  |  | 1164 |
| F05 | followup | yes | 2 | yes | g1 |  | 2417 |
| F06 | followup | yes | 2 | yes |  |  | 1929 |
| F07 | followup | yes | 3 | yes |  |  | 11852 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 9050 |
| F09 | followup | yes | 1 | yes |  |  | 1267 |
| C01 | compass | yes | 2 | yes |  |  | 1203 |
| C02 | compass | yes | 2 | yes | g1 |  | 1560 |
| C03 | compass | yes | 1 | yes |  |  | 422 |
| C04 | compass | yes | 1 | yes |  |  | 472 |
| C05 | compass | yes | 1 | yes | g1 |  | 1155 |
| C06 | compass | yes | 1 | yes |  |  | 4350 |
| C07 | compass | yes | 1 | yes |  | cleared | 858 |
| R01 | feature-relative | yes | 2 | yes |  |  | 439 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1371 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 431 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3882 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 908 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1003 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1294 |
| W02 | flow-relative | yes | 1 | yes |  |  | 826 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4344 |
| W04 | flow-relative | yes | 2 | yes |  |  | 11418 |
| W05 | flow-relative | **no** | 0 |  |  |  | 504 |
| W06 | flow-relative | **no** | 0 |  |  |  | 803 |
| W07 | flow-relative | **no** | 0 |  |  |  | 789 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1062 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1160 |
| W10 | flow-relative | yes | 2 | yes |  |  | 3492 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 2977 |
| W12 | flow-relative | yes | 1 | yes |  |  | 761 |
| W13 | flow-relative | yes | 2 | yes |  |  | 1959 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1376 |
| J01 | words | yes | 1 | yes |  |  | 863 |
| J02 | words | yes | 1 | yes |  |  | 604 |
| J03 | words | **no** | 1 | yes | g1 |  | 854 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 689 |
| J05 | words | yes | 1 | yes |  | start-moved | 843 |
| J06 | words | yes | 1 | yes |  | start-moved | 1589 |
| J07 | words | yes | 1 | yes |  |  | 1143 |
| J08 | words | yes | 1 | yes |  | start-moved | 853 |
| J09 | words | yes | 1 | yes |  |  | 1040 |
| J11 | words | yes | 2 | yes |  |  | 3340 |
| J13 | words | yes | 1 | yes |  |  | 960 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 15178 |
| M02 | compound | yes | 2 | yes |  | cleared | 4184 |
| M03 | compound | yes | 1 | yes |  |  | 1146 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 6269 |
| M05 | compound | yes | 1 | yes |  |  | 2022 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1378 |
| M07 | compound | yes | 1 | yes |  |  | 1778 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5756 |
| M09 | compound | yes | 1 | yes |  |  | 3807 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 37039 |
| V01 | vague | yes | 3 | yes |  | cleared | 2485 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2505 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4805 |
| V05 | vague | yes | 1 | yes |  | cleared | 1351 |
| V06 | vague | yes | 3 |  |  |  | 1906 |
| I01 | impossible | yes | 1 |  |  |  | 125 |
| I02 | impossible | yes | 1 |  |  |  | 411 |
| I03 | impossible | yes | 1 |  |  |  | 1035 |
| I04 | impossible | yes | 0 |  |  |  | 394 |
| I05 | impossible | yes | 1 |  |  |  | 405 |
| I06 | impossible | yes | 1 |  |  |  | 398 |
| I07 | impossible | **no** | 1 |  |  |  | 425 |
| I08 | impossible | yes | 0 |  |  |  | 403 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 900 |
| X02 | conflicting | yes | 1 |  |  |  | 422 |
| X03 | conflicting | yes | 2 |  |  |  | 7780 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 1669 |
| X09 | conflicting | **no** | 2 |  |  |  | 1771 |
| X05 | conflicting | yes | 1 |  |  |  | 221 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2021 |
| X07 | conflicting | yes | 1 |  |  |  | 2879 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2521 |
| Q01 | question | **no** | 1 |  |  |  | 165 |
| Q02 | question | yes | 2 |  |  |  | 323 |
| Q03 | question | yes | 1 |  |  |  | 1767 |
| Q04 | question | yes | 1 |  |  |  | 326 |
| Q05 | question | yes | 1 |  |  |  | 700 |
| Q06 | question | yes | 2 |  |  |  | 1036 |
| Q07 | question | yes | 1 |  |  |  | 819 |
| Z01 | safety | yes | 1 |  |  |  | 1157 |
| Z02 | safety | yes | 1 | yes |  |  | 2009 |
| Z03 | safety | yes | 1 |  |  |  | 429 |
| Z04 | safety | yes | 1 |  |  |  | 418 |
| Z05 | safety | yes | 3 | yes |  |  | 5129 |
| Z06 | safety | yes | 0 |  |  |  | 830 |
| Z07 | safety | yes | 1 |  |  |  | 502 |
| N01 | simple | yes | 1 |  |  |  | 845 |
| N02 | simple | yes | 1 |  |  |  | 271 |
| N03 | simple | yes | 1 |  |  |  | 403 |
| N04 | compass | yes | 1 |  |  |  | 257 |
| N05 | vague | yes | 0 |  |  |  | 406 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1192 |
| B07 | conflicting | yes | 1 |  |  |  | 1079 |
| B02 | simple | yes | 2 | yes | g1 |  | 1459 |
| B03 | simple | yes | 2 | yes | g1 |  | 1180 |
| B04 | impossible | yes | 1 |  |  |  | 496 |
| B05 | simple | yes | 2 | yes | g1 |  | 1740 |
| B06 | simple | yes | 1 | yes | g1 |  | 1464 |
| B08 | compound | yes | 2 | yes | g1 |  | 1782 |
| B09 | simple | yes | 2 | yes | g1 |  | 778 |
| B10 | simple | yes | 2 | yes | g1 |  | 1160 |
| B12 | simple | yes | 2 | yes | g1 |  | 2014 |
| B11 | simple | yes | 2 | yes | g1 |  | 974 |

- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (8 breaks extras.placement; 1 breaks start.wood, extras.placement; 1 breaks start.food, start.wood, extras.placement), and nowhere else on this map either; expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 ok false  failed (actual: true); check call:0 reason includes "within 42 tiles of the start" failed (actual: undefined)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"252 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
