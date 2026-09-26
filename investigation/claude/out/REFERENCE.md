# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 124 of 137 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2102 |
| S02 | suite | yes | 3 | yes |  | cleared | 9640 |
| S03 | suite | yes | 3 | yes |  | cleared | 1828 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1683 |
| S05 | suite | yes | 2 | yes |  |  | 1223 |
| S06 | suite | **no** | 3 | yes | g1 | cleared | 7188 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1535 |
| S08 | suite | yes | 2 | yes |  |  | 423 |
| S09 | suite | yes | 3 | yes |  | cleared | 898 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2653 |
| P01 | simple | yes | 2 | yes |  |  | 5221 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 1476 |
| P03 | simple | yes | 1 | yes |  |  | 443 |
| P04 | simple | yes | 1 | yes |  |  | 594 |
| P05 | simple | yes | 2 | yes |  | cleared | 1228 |
| P06 | simple | yes | 2 | yes |  |  | 853 |
| P07 | simple | yes | 2 | yes |  |  | 1404 |
| P08 | simple | yes | 2 | yes | g1 |  | 1436 |
| P09 | simple | yes | 2 | yes |  |  | 893 |
| P10 | simple | yes | 1 | yes | g1 |  | 1564 |
| P12 | simple | yes | 1 | yes | g1 |  | 840 |
| P14 | simple | yes | 1 | yes |  | cleared | 873 |
| F01 | followup | yes | 1 | yes |  |  | 1135 |
| F02 | followup | yes | 1 | yes |  |  | 1143 |
| F03 | followup | yes | 1 | yes |  |  | 994 |
| F04 | followup | yes | 1 | yes |  |  | 900 |
| F05 | followup | yes | 2 | yes | g1 | cleared | 2194 |
| F06 | followup | yes | 2 | yes |  |  | 1790 |
| F07 | followup | yes | 3 | yes |  |  | 15355 |
| F08 | followup | yes | 1 | yes |  | reduced | 12809 |
| F09 | followup | yes | 1 | yes |  |  | 937 |
| C01 | compass | **no** | 2 | no |  | guard | 1380 |
| C02 | compass | yes | 2 | yes | g1 |  | 1416 |
| C03 | compass | yes | 1 | yes |  |  | 463 |
| C04 | compass | yes | 1 | yes |  |  | 442 |
| C05 | compass | yes | 1 | yes | g1 |  | 1109 |
| C06 | compass | yes | 1 | yes |  | cleared | 4230 |
| C07 | compass | yes | 1 | yes |  | cleared | 863 |
| R01 | feature-relative | yes | 2 | yes |  |  | 467 |
| R02 | feature-relative | yes | 1 | yes |  |  | 1444 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 450 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3748 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 906 |
| R08 | feature-relative | yes | 2 | yes |  |  | 966 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1325 |
| W02 | flow-relative | yes | 1 | yes |  |  | 845 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4181 |
| W04 | flow-relative | yes | 2 | yes |  |  | 12920 |
| W05 | flow-relative | **no** | 0 |  |  |  | 631 |
| W06 | flow-relative | **no** | 0 |  |  |  | 954 |
| W07 | flow-relative | **no** | 0 |  |  |  | 946 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1270 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1030 |
| W10 | flow-relative | yes | 2 | yes |  |  | 3997 |
| W11 | flow-relative | yes | 1 | yes |  |  | 3684 |
| W12 | flow-relative | yes | 1 | yes |  |  | 974 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2374 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1583 |
| J01 | words | yes | 1 | yes |  |  | 1045 |
| J02 | words | yes | 1 | yes |  |  | 668 |
| J03 | words | **no** | 1 | yes | g1 |  | 1077 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 875 |
| J05 | words | yes | 1 | yes |  | start-moved | 982 |
| J06 | words | yes | 1 | yes |  | start-moved | 1894 |
| J07 | words | yes | 1 | yes |  |  | 1379 |
| J08 | words | yes | 1 | yes |  | start-moved | 933 |
| J09 | words | yes | 1 | yes |  |  | 1265 |
| J11 | words | yes | 2 | yes |  |  | 3084 |
| J13 | words | yes | 1 | yes |  |  | 1142 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, map-wide | 25745 |
| M02 | compound | yes | 2 | yes |  | cleared | 4987 |
| M03 | compound | yes | 1 | yes |  |  | 1300 |
| M04 | compound | **no** | 1 | no | g1, g2, g1, g1 |  | 7152 |
| M05 | compound | yes | 1 | yes |  | cleared | 1959 |
| M06 | compound | **no** | 1 | yes | g2 |  | 1249 |
| M07 | compound | yes | 1 | yes |  |  | 1425 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5646 |
| M09 | compound | yes | 1 | yes |  |  | 3779 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 39951 |
| V01 | vague | yes | 3 | yes |  | cleared | 2538 |
| V02 | vague | yes | 1 | yes |  | reduced | 2454 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4914 |
| V05 | vague | yes | 1 | yes |  | cleared | 1279 |
| V06 | vague | yes | 3 |  |  |  | 1451 |
| I01 | impossible | yes | 1 |  |  |  | 138 |
| I02 | impossible | yes | 1 |  |  |  | 436 |
| I03 | impossible | yes | 1 |  |  |  | 710 |
| I04 | impossible | yes | 0 |  |  |  | 391 |
| I05 | impossible | yes | 1 |  |  |  | 434 |
| I06 | impossible | yes | 1 |  |  |  | 373 |
| I07 | impossible | **no** | 1 |  |  |  | 643 |
| I08 | impossible | yes | 0 |  |  |  | 394 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 891 |
| X02 | conflicting | yes | 1 |  |  |  | 450 |
| X03 | conflicting | yes | 2 |  |  |  | 12059 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2128 |
| X09 | conflicting | **no** | 2 |  |  |  | 2142 |
| X05 | conflicting | yes | 1 |  |  |  | 240 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2399 |
| X07 | conflicting | yes | 1 |  |  |  | 3006 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2449 |
| Q01 | question | **no** | 1 |  |  |  | 147 |
| Q02 | question | yes | 2 |  |  |  | 328 |
| Q03 | question | yes | 1 |  |  |  | 1636 |
| Q04 | question | yes | 1 |  |  |  | 302 |
| Q05 | question | yes | 1 |  |  |  | 685 |
| Q06 | question | yes | 2 |  |  |  | 642 |
| Q07 | question | yes | 1 |  |  |  | 873 |
| Z01 | safety | yes | 1 |  |  |  | 1140 |
| Z02 | safety | yes | 1 | yes |  |  | 2072 |
| Z03 | safety | yes | 1 |  |  |  | 411 |
| Z04 | safety | yes | 1 |  |  |  | 423 |
| Z05 | safety | yes | 3 | yes |  |  | 5243 |
| Z06 | safety | yes | 0 |  |  |  | 790 |
| Z07 | safety | yes | 1 |  |  |  | 497 |
| N01 | simple | yes | 1 |  |  |  | 866 |
| N02 | simple | yes | 1 |  |  |  | 272 |
| N03 | simple | yes | 1 |  |  |  | 432 |
| N04 | compass | yes | 1 |  |  |  | 259 |
| N05 | vague | yes | 0 |  |  |  | 421 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1197 |
| B07 | conflicting | yes | 1 |  |  |  | 1121 |
| B02 | simple | yes | 2 | yes | g1 |  | 1475 |
| B03 | simple | yes | 2 | yes | g1 |  | 1193 |
| B04 | impossible | yes | 1 |  |  |  | 515 |
| B05 | simple | yes | 2 | yes | g1 |  | 1854 |
| B06 | simple | yes | 1 | yes | g1 |  | 1475 |
| B08 | compound | yes | 2 | yes | g1 |  | 1777 |
| B09 | simple | yes | 3 | yes | g1 |  | 1233 |
| B10 | simple | yes | 2 | yes | g1 |  | 1316 |
| B12 | simple | yes | 2 | yes | g1 |  | 2001 |
| B13 | simple | yes | 2 | yes | g1 |  | 890 |
| B14 | simple | yes | 2 | yes | g1 |  | 1147 |
| B15 | simple | yes | 2 | yes | g1 |  | 1432 |
| B16 | simple | yes | 2 | yes | g1 |  | 602 |
| B17 | simple | yes | 2 | yes | g1 |  | 576 |
| B11 | simple | yes | 2 | yes | g1 |  | 951 |

- S06: expectation g1 start distanceTo:lake failed: it went from 36.7 to 41, not down
- C01: propose was not accepted; expected accepted (not accepted: it breaks extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"extras.placement","message":"a geothermal field is within 2 tiles of water or in a reservoir site; a small relic is within 2 tiles of water or in a reservoir site; a small relic is within 2 tiles of water or in a reservoir site","causedByStep":1}]
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (4 breaks extras.placement; 2 breaks start.food, extras.placement; 3 breaks start.wood, extras.placement; 1 breaks start.food, start.wood, extras.placement), and nowhere else on this map either | step 1: every site that fits here breaks a check that passes now (1 breaks start.food); expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up; expectation g2 new:damSite course.frac failed: the proposal made no damSite
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 reason includes "within 42 tiles of the start" failed (actual: "every site that fits here breaks a check that passes now (1 breaks entities.placement, water.badwater_contained; 1 breaks resources.mine_site), and nowhere els)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"262 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
