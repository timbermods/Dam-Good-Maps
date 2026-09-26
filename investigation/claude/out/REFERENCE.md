# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 123 of 135 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2356 |
| S02 | suite | yes | 3 | yes |  | cleared | 11824 |
| S03 | suite | yes | 3 | yes |  | cleared | 2037 |
| S04 | suite | **no** | 3 | no |  |  | 519 |
| S05 | suite | yes | 2 | yes |  | reduced | 1749 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 3608 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 2165 |
| S08 | suite | yes | 2 | yes |  |  | 606 |
| S09 | suite | yes | 3 | yes |  |  | 1194 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 3366 |
| P01 | simple | yes | 2 | yes |  |  | 7392 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 2073 |
| P03 | simple | yes | 1 | yes |  |  | 604 |
| P04 | simple | yes | 1 | yes |  |  | 812 |
| P05 | simple | yes | 2 | yes |  | cleared | 1794 |
| P06 | simple | yes | 2 | yes |  |  | 1259 |
| P07 | simple | yes | 2 | yes |  |  | 1978 |
| P08 | simple | yes | 2 | yes | g1 |  | 2396 |
| P09 | simple | yes | 2 | yes |  |  | 1397 |
| P10 | simple | yes | 1 | yes | g1 |  | 2359 |
| P12 | simple | yes | 1 | yes | g1 |  | 1738 |
| P14 | simple | yes | 1 | yes |  | cleared | 2524 |
| F01 | followup | yes | 1 | yes |  |  | 2754 |
| F02 | followup | yes | 1 | yes |  |  | 2245 |
| F03 | followup | yes | 1 | yes |  |  | 1681 |
| F04 | followup | yes | 1 | yes |  |  | 1524 |
| F05 | followup | yes | 2 | yes | g1 |  | 2690 |
| F06 | followup | yes | 2 | yes |  |  | 2215 |
| F07 | followup | yes | 3 | yes |  |  | 14191 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 10641 |
| F09 | followup | yes | 1 | yes |  |  | 1520 |
| C01 | compass | yes | 2 | yes |  |  | 1404 |
| C02 | compass | yes | 2 | yes | g1 |  | 1868 |
| C03 | compass | yes | 1 | yes |  |  | 515 |
| C04 | compass | yes | 1 | yes |  |  | 509 |
| C05 | compass | yes | 1 | yes | g1 |  | 1348 |
| C06 | compass | yes | 1 | yes |  |  | 5046 |
| C07 | compass | yes | 1 | yes |  | cleared | 1049 |
| R01 | feature-relative | yes | 2 | yes |  |  | 501 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1645 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 486 |
| R04 | feature-relative | yes | 2 | yes |  |  | 4375 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 1015 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1083 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1370 |
| W02 | flow-relative | yes | 1 | yes |  |  | 898 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4590 |
| W04 | flow-relative | yes | 2 | yes |  |  | 13858 |
| W05 | flow-relative | **no** | 0 |  |  |  | 661 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1023 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1090 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1352 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1497 |
| W10 | flow-relative | yes | 2 | yes |  |  | 4700 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 4663 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1165 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2913 |
| W15 | flow-relative | yes | 2 | yes |  |  | 2013 |
| J01 | words | yes | 1 | yes |  |  | 1283 |
| J02 | words | yes | 1 | yes |  |  | 839 |
| J03 | words | **no** | 1 | yes | g1 |  | 1227 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 887 |
| J05 | words | yes | 1 | yes |  | start-moved | 1106 |
| J06 | words | yes | 1 | yes |  | start-moved | 2117 |
| J07 | words | yes | 1 | yes |  |  | 1495 |
| J08 | words | yes | 1 | yes |  | start-moved | 1110 |
| J09 | words | yes | 1 | yes |  |  | 1280 |
| J11 | words | yes | 2 | yes |  |  | 4451 |
| J13 | words | yes | 1 | yes |  |  | 1226 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 19169 |
| M02 | compound | yes | 2 | yes |  | cleared | 5500 |
| M03 | compound | yes | 1 | yes |  |  | 1305 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 7243 |
| M05 | compound | yes | 1 | yes |  |  | 2223 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1529 |
| M07 | compound | yes | 1 | yes |  |  | 1917 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 6308 |
| M09 | compound | yes | 1 | yes |  |  | 4211 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 41611 |
| V01 | vague | yes | 3 | yes |  | cleared | 2582 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2996 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 5853 |
| V05 | vague | yes | 1 | yes |  | cleared | 1649 |
| V06 | vague | yes | 3 |  |  |  | 2282 |
| I01 | impossible | yes | 1 |  |  |  | 162 |
| I02 | impossible | yes | 1 |  |  |  | 501 |
| I03 | impossible | yes | 1 |  |  |  | 1305 |
| I04 | impossible | yes | 0 |  |  |  | 497 |
| I05 | impossible | yes | 1 |  |  |  | 544 |
| I06 | impossible | yes | 1 |  |  |  | 495 |
| I07 | impossible | **no** | 1 |  |  |  | 526 |
| I08 | impossible | yes | 0 |  |  |  | 532 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1110 |
| X02 | conflicting | yes | 1 |  |  |  | 509 |
| X03 | conflicting | yes | 2 |  |  |  | 11225 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2421 |
| X09 | conflicting | **no** | 2 |  |  |  | 2508 |
| X05 | conflicting | yes | 1 |  |  |  | 306 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2776 |
| X07 | conflicting | yes | 1 |  |  |  | 3662 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2865 |
| Q01 | question | **no** | 1 |  |  |  | 200 |
| Q02 | question | yes | 2 |  |  |  | 387 |
| Q03 | question | yes | 1 |  |  |  | 1975 |
| Q04 | question | yes | 1 |  |  |  | 369 |
| Q05 | question | yes | 1 |  |  |  | 782 |
| Q06 | question | yes | 2 |  |  |  | 1259 |
| Q07 | question | yes | 1 |  |  |  | 960 |
| Z01 | safety | yes | 1 |  |  |  | 1312 |
| Z02 | safety | yes | 1 | yes |  |  | 2431 |
| Z03 | safety | yes | 1 |  |  |  | 502 |
| Z04 | safety | yes | 1 |  |  |  | 516 |
| Z05 | safety | yes | 3 | yes |  |  | 6145 |
| Z06 | safety | yes | 0 |  |  |  | 934 |
| Z07 | safety | yes | 1 |  |  |  | 612 |
| N01 | simple | yes | 1 |  |  |  | 944 |
| N02 | simple | yes | 1 |  |  |  | 312 |
| N03 | simple | yes | 1 |  |  |  | 453 |
| N04 | compass | yes | 1 |  |  |  | 284 |
| N05 | vague | yes | 0 |  |  |  | 415 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1250 |
| B07 | conflicting | yes | 1 |  |  |  | 1151 |
| B02 | simple | yes | 2 | yes | g1 |  | 1569 |
| B03 | simple | yes | 2 | yes | g1 |  | 1359 |
| B04 | impossible | yes | 1 |  |  |  | 584 |
| B05 | simple | yes | 2 | yes | g1 |  | 2001 |
| B06 | simple | yes | 1 | yes | g1 |  | 1796 |
| B08 | compound | yes | 2 | yes | g1 |  | 2006 |
| B09 | simple | yes | 2 | yes | g1 |  | 866 |
| B10 | simple | yes | 2 | yes | g1 |  | 1267 |
| B12 | simple | yes | 2 | yes | g1 |  | 2176 |
| B13 | simple | yes | 2 | yes | g1 |  | 986 |
| B14 | simple | yes | 2 | yes | g1 |  | 1281 |
| B15 | simple | yes | 2 | yes | g1 |  | 1621 |
| B11 | simple | yes | 2 | yes | g1 |  | 1035 |

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
