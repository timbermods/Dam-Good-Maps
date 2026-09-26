# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 125 of 137 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2088 |
| S02 | suite | yes | 3 | yes |  | cleared | 9998 |
| S03 | suite | yes | 3 | yes |  | cleared | 1945 |
| S04 | suite | **no** | 3 | no |  |  | 487 |
| S05 | suite | yes | 2 | yes |  | reduced | 1813 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 3017 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1508 |
| S08 | suite | yes | 2 | yes |  |  | 439 |
| S09 | suite | yes | 3 | yes |  |  | 923 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2601 |
| P01 | simple | yes | 2 | yes |  |  | 5274 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 1467 |
| P03 | simple | yes | 1 | yes |  |  | 451 |
| P04 | simple | yes | 1 | yes |  |  | 587 |
| P05 | simple | yes | 2 | yes |  | cleared | 1270 |
| P06 | simple | yes | 2 | yes |  |  | 868 |
| P07 | simple | yes | 2 | yes |  |  | 1480 |
| P08 | simple | yes | 2 | yes | g1 |  | 1431 |
| P09 | simple | yes | 2 | yes |  |  | 904 |
| P10 | simple | yes | 1 | yes | g1 |  | 1576 |
| P12 | simple | yes | 1 | yes | g1 |  | 982 |
| P14 | simple | yes | 1 | yes |  | cleared | 897 |
| F01 | followup | yes | 1 | yes |  |  | 1755 |
| F02 | followup | yes | 1 | yes |  |  | 1889 |
| F03 | followup | yes | 1 | yes |  |  | 1411 |
| F04 | followup | yes | 1 | yes |  |  | 1208 |
| F05 | followup | yes | 2 | yes | g1 |  | 2312 |
| F06 | followup | yes | 2 | yes |  |  | 1714 |
| F07 | followup | yes | 3 | yes |  |  | 11795 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 8779 |
| F09 | followup | yes | 1 | yes |  |  | 1196 |
| C01 | compass | yes | 2 | yes |  |  | 1127 |
| C02 | compass | yes | 2 | yes | g1 |  | 1495 |
| C03 | compass | yes | 1 | yes |  |  | 455 |
| C04 | compass | yes | 1 | yes |  |  | 420 |
| C05 | compass | yes | 1 | yes | g1 |  | 1111 |
| C06 | compass | yes | 1 | yes |  |  | 4376 |
| C07 | compass | yes | 1 | yes |  | cleared | 863 |
| R01 | feature-relative | yes | 2 | yes |  |  | 462 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1549 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 588 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3936 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 878 |
| R08 | feature-relative | yes | 2 | yes |  |  | 986 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1288 |
| W02 | flow-relative | yes | 1 | yes |  |  | 829 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4287 |
| W04 | flow-relative | yes | 2 | yes |  |  | 13229 |
| W05 | flow-relative | **no** | 0 |  |  |  | 624 |
| W06 | flow-relative | **no** | 0 |  |  |  | 958 |
| W07 | flow-relative | **no** | 0 |  |  |  | 930 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1268 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1411 |
| W10 | flow-relative | yes | 2 | yes |  |  | 4272 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 3704 |
| W12 | flow-relative | yes | 1 | yes |  |  | 903 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2449 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1667 |
| J01 | words | yes | 1 | yes |  |  | 1059 |
| J02 | words | yes | 1 | yes |  |  | 788 |
| J03 | words | **no** | 1 | yes | g1 |  | 1136 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 851 |
| J05 | words | yes | 1 | yes |  | start-moved | 1089 |
| J06 | words | yes | 1 | yes |  | start-moved | 2395 |
| J07 | words | yes | 1 | yes |  |  | 1455 |
| J08 | words | yes | 1 | yes |  | start-moved | 989 |
| J09 | words | yes | 1 | yes |  |  | 1272 |
| J11 | words | yes | 2 | yes |  |  | 4087 |
| J13 | words | yes | 1 | yes |  |  | 1114 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 20023 |
| M02 | compound | yes | 2 | yes |  | cleared | 5858 |
| M03 | compound | yes | 1 | yes |  |  | 1520 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 8423 |
| M05 | compound | yes | 1 | yes |  |  | 2295 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1642 |
| M07 | compound | yes | 1 | yes |  |  | 2001 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 6751 |
| M09 | compound | yes | 1 | yes |  |  | 4813 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 45175 |
| V01 | vague | yes | 3 | yes |  | cleared | 2513 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2995 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 5752 |
| V05 | vague | yes | 1 | yes |  | cleared | 1555 |
| V06 | vague | yes | 3 |  |  |  | 2229 |
| I01 | impossible | yes | 1 |  |  |  | 168 |
| I02 | impossible | yes | 1 |  |  |  | 463 |
| I03 | impossible | yes | 1 |  |  |  | 1232 |
| I04 | impossible | yes | 0 |  |  |  | 480 |
| I05 | impossible | yes | 1 |  |  |  | 507 |
| I06 | impossible | yes | 1 |  |  |  | 480 |
| I07 | impossible | **no** | 1 |  |  |  | 531 |
| I08 | impossible | yes | 0 |  |  |  | 502 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1048 |
| X02 | conflicting | yes | 1 |  |  |  | 508 |
| X03 | conflicting | yes | 2 |  |  |  | 11091 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2514 |
| X09 | conflicting | **no** | 2 |  |  |  | 2448 |
| X05 | conflicting | yes | 1 |  |  |  | 300 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2931 |
| X07 | conflicting | yes | 1 |  |  |  | 3574 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2922 |
| Q01 | question | **no** | 1 |  |  |  | 190 |
| Q02 | question | yes | 2 |  |  |  | 394 |
| Q03 | question | yes | 1 |  |  |  | 2038 |
| Q04 | question | yes | 1 |  |  |  | 380 |
| Q05 | question | yes | 1 |  |  |  | 823 |
| Q06 | question | yes | 2 |  |  |  | 1238 |
| Q07 | question | yes | 1 |  |  |  | 1059 |
| Z01 | safety | yes | 1 |  |  |  | 1400 |
| Z02 | safety | yes | 1 | yes |  |  | 2424 |
| Z03 | safety | yes | 1 |  |  |  | 508 |
| Z04 | safety | yes | 1 |  |  |  | 507 |
| Z05 | safety | yes | 3 | yes |  |  | 6376 |
| Z06 | safety | yes | 0 |  |  |  | 940 |
| Z07 | safety | yes | 1 |  |  |  | 638 |
| N01 | simple | yes | 1 |  |  |  | 991 |
| N02 | simple | yes | 1 |  |  |  | 312 |
| N03 | simple | yes | 1 |  |  |  | 463 |
| N04 | compass | yes | 1 |  |  |  | 303 |
| N05 | vague | yes | 0 |  |  |  | 485 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1424 |
| B07 | conflicting | yes | 1 |  |  |  | 1229 |
| B02 | simple | yes | 2 | yes | g1 |  | 1731 |
| B03 | simple | yes | 2 | yes | g1 |  | 1455 |
| B04 | impossible | yes | 1 |  |  |  | 672 |
| B05 | simple | yes | 2 | yes | g1 |  | 2176 |
| B06 | simple | yes | 1 | yes | g1 |  | 1744 |
| B08 | compound | yes | 2 | yes | g1 |  | 1987 |
| B09 | simple | yes | 2 | yes | g1 |  | 892 |
| B10 | simple | yes | 2 | yes | g1 |  | 1305 |
| B12 | simple | yes | 2 | yes | g1 |  | 2233 |
| B13 | simple | yes | 2 | yes | g1 |  | 939 |
| B14 | simple | yes | 2 | yes | g1 |  | 1219 |
| B15 | simple | yes | 2 | yes | g1 |  | 1468 |
| B16 | simple | yes | 2 | yes | g1 |  | 607 |
| B17 | simple | yes | 2 | yes | g1 |  | 604 |
| B11 | simple | yes | 2 | yes | g1 |  | 983 |

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
