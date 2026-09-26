# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 125 of 138 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2105 |
| S02 | suite | yes | 3 | yes |  | cleared | 9510 |
| S03 | suite | yes | 3 | yes |  | cleared | 1786 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1609 |
| S05 | suite | yes | 2 | yes |  |  | 1265 |
| S06 | suite | **no** | 3 | no |  |  | 6524 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1598 |
| S08 | suite | yes | 2 | yes |  |  | 472 |
| S09 | suite | yes | 3 | yes |  | cleared | 918 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2553 |
| P01 | simple | yes | 2 | yes |  |  | 5063 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 1542 |
| P03 | simple | yes | 1 | yes |  |  | 474 |
| P04 | simple | yes | 1 | yes |  |  | 550 |
| P05 | simple | yes | 2 | yes |  | cleared | 1287 |
| P06 | simple | yes | 2 | yes |  |  | 903 |
| P07 | simple | yes | 2 | yes |  |  | 1559 |
| P08 | simple | yes | 2 | yes | g1 |  | 1421 |
| P09 | simple | yes | 2 | yes |  |  | 881 |
| P10 | simple | yes | 1 | yes | g1 |  | 1470 |
| P12 | simple | yes | 1 | yes | g1 |  | 882 |
| P14 | simple | yes | 1 | yes |  | cleared | 879 |
| F01 | followup | yes | 1 | yes |  |  | 1117 |
| F02 | followup | yes | 1 | yes |  |  | 1145 |
| F03 | followup | yes | 1 | yes |  |  | 1004 |
| F04 | followup | yes | 1 | yes |  |  | 858 |
| F05 | followup | yes | 2 | yes | g1 | cleared | 2209 |
| F06 | followup | yes | 2 | yes |  |  | 1784 |
| F07 | followup | yes | 3 | yes |  |  | 15386 |
| F08 | followup | yes | 1 | yes |  | reduced | 12853 |
| F09 | followup | yes | 1 | yes |  |  | 910 |
| C01 | compass | **no** | 2 | no |  | guard | 1375 |
| C02 | compass | yes | 2 | yes | g1 |  | 1499 |
| C03 | compass | yes | 1 | yes |  |  | 407 |
| C04 | compass | yes | 1 | yes |  |  | 432 |
| C05 | compass | yes | 1 | yes | g1 |  | 1130 |
| C06 | compass | yes | 1 | yes |  | cleared | 4374 |
| C07 | compass | yes | 1 | yes |  | cleared | 907 |
| R01 | feature-relative | yes | 2 | yes |  |  | 447 |
| R02 | feature-relative | yes | 1 | yes |  |  | 1497 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 439 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3870 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 868 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1023 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1326 |
| W02 | flow-relative | yes | 1 | yes |  |  | 843 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4141 |
| W04 | flow-relative | yes | 2 | yes |  |  | 12771 |
| W05 | flow-relative | **no** | 0 |  |  |  | 559 |
| W06 | flow-relative | **no** | 0 |  |  |  | 971 |
| W07 | flow-relative | **no** | 0 |  |  |  | 971 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1305 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1041 |
| W10 | flow-relative | yes | 2 | yes |  |  | 3968 |
| W11 | flow-relative | yes | 1 | yes |  |  | 3536 |
| W12 | flow-relative | yes | 1 | yes |  |  | 959 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2353 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1621 |
| J01 | words | yes | 1 | yes |  |  | 1012 |
| J02 | words | yes | 1 | yes |  |  | 679 |
| J03 | words | **no** | 1 | yes | g1 |  | 1037 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 874 |
| J05 | words | yes | 1 | yes |  | start-moved | 967 |
| J06 | words | yes | 1 | yes |  | start-moved | 1836 |
| J07 | words | yes | 1 | yes |  |  | 1372 |
| J08 | words | yes | 1 | yes |  | start-moved | 1033 |
| J09 | words | yes | 1 | yes |  |  | 1224 |
| J11 | words | yes | 2 | yes |  |  | 3084 |
| J13 | words | yes | 1 | yes |  |  | 1139 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, map-wide | 25422 |
| M02 | compound | yes | 2 | yes |  | cleared | 5093 |
| M03 | compound | yes | 1 | yes |  |  | 1323 |
| M04 | compound | **no** | 1 | no | g1, g2, g1, g1 |  | 7328 |
| M05 | compound | yes | 1 | yes |  | cleared | 1969 |
| M06 | compound | **no** | 1 | yes | g2 |  | 1236 |
| M07 | compound | yes | 1 | yes |  |  | 1466 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5860 |
| M09 | compound | yes | 1 | yes |  |  | 3701 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 40661 |
| V01 | vague | yes | 3 | yes |  | cleared | 2632 |
| V02 | vague | yes | 1 | yes |  | reduced | 2475 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4959 |
| V05 | vague | yes | 1 | yes |  | cleared | 1336 |
| V06 | vague | yes | 3 |  |  |  | 1427 |
| I01 | impossible | yes | 1 |  |  |  | 125 |
| I02 | impossible | yes | 1 |  |  |  | 385 |
| I03 | impossible | yes | 1 |  |  |  | 673 |
| I04 | impossible | yes | 0 |  |  |  | 427 |
| I05 | impossible | yes | 1 |  |  |  | 362 |
| I06 | impossible | yes | 1 |  |  |  | 408 |
| I07 | impossible | **no** | 1 |  |  |  | 647 |
| I08 | impossible | yes | 0 |  |  |  | 415 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 868 |
| X02 | conflicting | yes | 1 |  |  |  | 414 |
| X03 | conflicting | yes | 2 |  |  |  | 11898 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2077 |
| X09 | conflicting | **no** | 2 |  |  |  | 2155 |
| X05 | conflicting | yes | 1 |  |  |  | 255 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2450 |
| X07 | conflicting | yes | 1 |  |  |  | 3036 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2501 |
| Q01 | question | **no** | 1 |  |  |  | 148 |
| Q02 | question | yes | 2 |  |  |  | 339 |
| Q03 | question | yes | 1 |  |  |  | 1820 |
| Q04 | question | yes | 1 |  |  |  | 338 |
| Q05 | question | yes | 1 |  |  |  | 672 |
| Q06 | question | yes | 2 |  |  |  | 716 |
| Q07 | question | yes | 1 |  |  |  | 842 |
| Z01 | safety | yes | 1 |  |  |  | 1166 |
| Z02 | safety | yes | 1 | yes |  |  | 2113 |
| Z03 | safety | yes | 1 |  |  |  | 429 |
| Z04 | safety | yes | 1 |  |  |  | 438 |
| Z05 | safety | yes | 3 | yes |  |  | 5275 |
| Z06 | safety | yes | 0 |  |  |  | 800 |
| Z07 | safety | yes | 1 |  |  |  | 558 |
| N01 | simple | yes | 1 |  |  |  | 905 |
| N02 | simple | yes | 1 |  |  |  | 286 |
| N03 | simple | yes | 1 |  |  |  | 398 |
| N04 | compass | yes | 1 |  |  |  | 250 |
| N05 | vague | yes | 0 |  |  |  | 416 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1175 |
| B07 | conflicting | yes | 1 |  |  |  | 1094 |
| B02 | simple | yes | 2 | yes | g1 |  | 1514 |
| B03 | simple | yes | 2 | yes | g1 |  | 1255 |
| B04 | impossible | yes | 1 |  |  |  | 516 |
| B05 | simple | yes | 2 | yes | g1 |  | 1769 |
| B06 | simple | yes | 1 | yes | g1 |  | 1457 |
| B08 | compound | yes | 2 | yes | g1 |  | 1738 |
| B09 | simple | yes | 3 | yes | g1 |  | 1231 |
| B10 | simple | yes | 2 | yes | g1 |  | 1392 |
| B12 | simple | yes | 2 | yes | g1 |  | 2107 |
| B13 | simple | yes | 2 | yes | g1 |  | 906 |
| B14 | simple | yes | 2 | yes | g1 |  | 1267 |
| B15 | simple | yes | 2 | yes | g1 |  | 1469 |
| B16 | simple | yes | 2 | yes | g1 |  | 590 |
| B17 | simple | yes | 2 | yes | g1 |  | 631 |
| B18 | simple | yes | 1 | yes | g1 |  | 603 |
| B11 | simple | yes | 2 | yes | g1 |  | 942 |

- S06: propose was not accepted; expected accepted (step 0: moveStart needs to (a tile or a place) or facing)
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
