# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 108 of 127 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2307 |
| S02 | suite | yes | 3 | yes |  | cleared | 9051 |
| S03 | suite | yes | 3 | yes |  | cleared | 1641 |
| S04 | suite | **no** | 3 | no |  |  | 409 |
| S05 | suite | yes | 2 | yes |  |  | 1428 |
| S06 | suite | yes | 3 | yes |  | cleared | 3964 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1388 |
| S08 | suite | yes | 2 | yes |  |  | 380 |
| S09 | suite | yes | 3 | yes |  |  | 845 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 3079 |
| P01 | simple | yes | 2 | yes |  |  | 3754 |
| P02 | simple | yes | 1 | yes |  | reduced | 1458 |
| P03 | simple | yes | 1 | yes |  |  | 450 |
| P04 | simple | yes | 1 | yes |  |  | 654 |
| P05 | simple | yes | 2 | yes |  | cleared | 1641 |
| P06 | simple | yes | 2 | yes |  |  | 1168 |
| P07 | simple | yes | 2 | yes |  |  | 4118 |
| P08 | simple | **no** | 2 | no |  | guard | 1060 |
| P09 | simple | yes | 2 | yes |  |  | 989 |
| P10 | simple | yes | 1 | yes |  |  | 933 |
| P12 | simple | yes | 1 | yes |  |  | 921 |
| P14 | simple | yes | 1 | yes |  | cleared | 970 |
| F01 | followup | yes | 1 | yes |  |  | 1660 |
| F02 | followup | yes | 1 | yes |  |  | 1670 |
| F03 | followup | yes | 1 | yes |  |  | 1552 |
| F04 | followup | yes | 1 | yes |  |  | 1394 |
| F05 | followup | yes | 2 | yes |  |  | 2554 |
| F06 | followup | yes | 2 | yes |  |  | 2051 |
| F07 | followup | **no** | 0 |  |  |  | 9546 |
| F08 | followup | **no** | 0 |  |  |  | 9558 |
| F09 | followup | yes | 1 | yes |  |  | 1434 |
| C01 | compass | **no** | 2 | no | g1, g1 |  | 1513 |
| C02 | compass | yes | 2 | yes |  | reduced | 1504 |
| C03 | compass | yes | 1 | yes |  |  | 505 |
| C04 | compass | yes | 1 | yes |  |  | 514 |
| C05 | compass | yes | 1 | yes |  |  | 1881 |
| C06 | compass | yes | 1 | yes |  | cleared | 6550 |
| C07 | compass | yes | 1 | yes |  | cleared | 990 |
| R01 | feature-relative | yes | 2 | yes |  |  | 499 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1563 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 489 |
| R04 | feature-relative | yes | 1 | yes |  |  | 1328 |
| R06 | feature-relative | yes | 1 | yes |  |  | 907 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1034 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1736 |
| W02 | flow-relative | yes | 1 | yes |  |  | 858 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4418 |
| W04 | flow-relative | yes | 1 | yes |  |  | 2935 |
| W05 | flow-relative | **no** | 0 |  |  |  | 1137 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1223 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1187 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1895 |
| W09 | flow-relative | **no** | 2 | no | g1, g1 |  | 2165 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 1749 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 4491 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1742 |
| W13 | flow-relative | yes | 2 | yes |  |  | 3151 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1712 |
| J01 | words | yes | 1 | yes |  |  | 1068 |
| J02 | words | yes | 1 | yes |  |  | 765 |
| J03 | words | **no** | 1 | yes | g1 |  | 1086 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 903 |
| J05 | words | yes | 1 | yes |  | start-moved | 1070 |
| J06 | words | yes | 1 | yes |  | start-moved | 2019 |
| J07 | words | yes | 1 | yes |  |  | 1474 |
| J08 | words | yes | 1 | yes |  | start-moved | 1066 |
| J09 | words | yes | 1 | yes |  |  | 1339 |
| J11 | words | yes | 2 | yes |  |  | 1595 |
| J13 | words | yes | 1 | yes |  |  | 998 |
| M01 | compound | **no** | 4 | no | g3, g3 | start-moved, less-flow, cleared, map-wide | 18445 |
| M02 | compound | yes | 1 | yes |  | cleared | 2129 |
| M03 | compound | yes | 1 | yes |  |  | 1126 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 9026 |
| M05 | compound | yes | 1 | yes |  | cleared | 2152 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1279 |
| M07 | compound | yes | 1 | yes |  |  | 1399 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5117 |
| M09 | compound | yes | 1 | yes |  |  | 3761 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 29355 |
| V01 | vague | yes | 3 | yes |  | cleared | 3700 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 3428 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 6716 |
| V05 | vague | yes | 1 | yes |  | cleared | 1923 |
| V06 | vague | yes | 3 |  |  |  | 2028 |
| I01 | impossible | yes | 1 |  |  |  | 211 |
| I02 | impossible | yes | 1 |  |  |  | 564 |
| I03 | impossible | yes | 1 |  |  |  | 1474 |
| I04 | impossible | yes | 0 |  |  |  | 586 |
| I05 | impossible | yes | 1 |  |  |  | 587 |
| I06 | impossible | yes | 1 |  |  |  | 547 |
| I07 | impossible | **no** | 1 |  |  |  | 574 |
| I08 | impossible | yes | 0 |  |  |  | 600 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1260 |
| X02 | conflicting | yes | 1 |  |  |  | 578 |
| X03 | conflicting | yes | 2 |  |  |  | 2833 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2843 |
| X09 | conflicting | **no** | 2 |  |  |  | 3041 |
| X05 | conflicting | yes | 1 |  |  |  | 477 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 3471 |
| X07 | conflicting | yes | 1 |  |  |  | 4375 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 7829 |
| Q01 | question | **no** | 1 |  |  |  | 273 |
| Q02 | question | yes | 2 |  |  |  | 535 |
| Q03 | question | yes | 1 |  |  |  | 2810 |
| Q04 | question | yes | 1 |  |  |  | 2181 |
| Q05 | question | yes | 1 |  |  |  | 1214 |
| Q06 | question | yes | 2 |  |  |  | 1925 |
| Q07 | question | yes | 1 |  |  |  | 1880 |
| Z01 | safety | yes | 1 |  |  |  | 2606 |
| Z02 | safety | yes | 1 | yes |  |  | 3363 |
| Z03 | safety | yes | 1 |  |  |  | 637 |
| Z04 | safety | yes | 1 |  |  |  | 607 |
| Z05 | safety | yes | 2 | yes |  |  | 2567 |
| Z06 | safety | yes | 0 |  |  |  | 1123 |
| Z07 | safety | yes | 1 |  |  |  | 696 |
| N01 | simple | yes | 1 |  |  |  | 1103 |
| N02 | simple | yes | 1 |  |  |  | 264 |
| N03 | simple | yes | 1 |  |  |  | 461 |
| N04 | compass | yes | 1 |  |  |  | 259 |
| N05 | vague | yes | 0 |  |  |  | 423 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1262 |
| B07 | conflicting | yes | 1 |  |  |  | 1207 |
| B02 | simple | yes | 2 | yes | g1 |  | 1571 |
| B03 | simple | yes | 2 | yes | g1 |  | 2084 |
| B04 | impossible | yes | 1 |  |  |  | 552 |
| B05 | followup | yes | 2 | yes |  | reduced, cleared | 3876 |
| B06 | followup | yes | 2 | yes |  | reduced | 1804 |

- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- P08: propose was not accepted; expected accepted (not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"entities.placement","message":"UndergroundRuins at (86,81,16): floating at (86,85,16)","causedByStep":0},{"id":"extras.placement","message":"a mine site stands on uneven ground; a medium relic is within 2 tiles of water or in a reservoir site","causedByStep":0}]
- F07: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement)
- F08: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement)
- C01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake at failed: the proposal made no lake
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W09: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks water.clean_exists, start.water, start.food, start.wood, resources.bushes); expectation g1 the badwater course.bank failed: it is "start's bank", not "opposite bank"
- W10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake course.bank failed: the proposal made no lake; expectation g1 new:lake course.frac failed: the proposal made no lake
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- M01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement); expectation g3 new:damSite reservoir.volume failed: the proposal made no damSite; expectation g3 new:damSite course.frac failed: the proposal made no damSite; expectation g3 new:damSite reservoirClean failed: the proposal made no damSite
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (3 breaks start.food, extras.placement; 2 breaks extras.placement; 3 breaks start.food, start.wood, extras.placement; 2 breaks start.dry, start.food, start.wood, extras.placement), and nowhere else on this map either; expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 ok false  failed (actual: true); check call:0 reason includes "within 42 tiles of the start" failed (actual: undefined)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"138 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
