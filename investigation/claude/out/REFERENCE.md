# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 99 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2325 |
| S02 | suite | yes | 3 | yes |  |  | 10904 |
| S03 | suite | yes | 3 | yes |  | cleared | 1911 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1682 |
| S05 | suite | yes | 2 | yes |  |  | 1456 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 3506 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1391 |
| S08 | suite | yes | 2 | yes |  |  | 486 |
| S09 | suite | **no** | 3 | no |  |  | 1364 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 3062 |
| P01 | simple | yes | 2 | yes |  |  | 3742 |
| P02 | simple | yes | 1 | yes |  |  | 1273 |
| P03 | simple | yes | 1 | yes |  |  | 445 |
| P04 | simple | yes | 1 | yes |  |  | 586 |
| P05 | simple | yes | 2 | yes |  | cleared | 2559 |
| P06 | simple | yes | 2 | yes |  |  | 916 |
| P07 | simple | yes | 2 | yes |  |  | 1597 |
| P08 | simple | **no** | 2 | no |  | guard | 1049 |
| P09 | simple | **no** | 2 | no |  | guard | 848 |
| P10 | simple | yes | 1 | yes |  |  | 920 |
| P12 | simple | yes | 1 | yes |  |  | 874 |
| P14 | simple | yes | 1 | yes |  | cleared | 917 |
| F01 | followup | yes | 1 | yes |  |  | 1356 |
| F02 | followup | yes | 1 | yes |  |  | 1330 |
| F03 | followup | yes | 1 | yes |  |  | 1166 |
| F04 | followup | yes | 1 | yes |  |  | 1035 |
| F05 | followup | yes | 2 | yes |  |  | 2364 |
| F06 | followup | yes | 2 | yes |  |  | 1940 |
| F07 | followup | **no** | 0 |  |  |  | 17152 |
| F08 | followup | **no** | 0 |  |  |  | 16947 |
| F09 | followup | yes | 1 | yes |  |  | 1050 |
| C01 | compass | **no** | 2 | no | g1, g1 |  | 1152 |
| C02 | compass | yes | 2 | yes |  |  | 1250 |
| C03 | compass | yes | 1 | yes |  |  | 399 |
| C04 | compass | yes | 1 | yes |  |  | 404 |
| C05 | compass | yes | 1 | yes |  |  | 1097 |
| C06 | compass | yes | 1 | yes |  |  | 4374 |
| C07 | compass | yes | 1 | yes |  | cleared | 912 |
| R01 | feature-relative | yes | 2 | yes |  |  | 480 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1408 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 496 |
| R04 | feature-relative | yes | 1 | yes |  |  | 1827 |
| R06 | feature-relative | yes | 1 | yes |  |  | 894 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1053 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1113 |
| W02 | flow-relative | yes | 1 | yes |  |  | 899 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 4140 |
| W04 | flow-relative | yes | 1 | yes |  |  | 2913 |
| W05 | flow-relative | **no** | 0 |  |  |  | 670 |
| W06 | flow-relative | **no** | 0 |  |  |  | 928 |
| W07 | flow-relative | **no** | 0 |  |  |  | 949 |
| W08 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 1221 |
| W09 | flow-relative | **no** | 2 | no | g1, g1 |  | 1474 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 1215 |
| W11 | flow-relative | yes | 1 | yes |  |  | 3529 |
| W12 | flow-relative | yes | 1 | yes |  |  | 990 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 2528 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1798 |
| J01 | words | yes | 1 | yes |  |  | 988 |
| J02 | words | yes | 1 | yes |  |  | 718 |
| J03 | words | **no** | 1 | yes | g1 |  | 1041 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 810 |
| J05 | words | yes | 1 | yes |  | start-moved | 998 |
| J06 | words | yes | 1 | yes |  | start-moved | 1877 |
| J07 | words | yes | 1 | yes |  |  | 1363 |
| J08 | words | yes | 1 | yes |  | start-moved | 1064 |
| J09 | words | yes | 1 | yes |  |  | 1238 |
| J11 | words | yes | 2 | yes |  |  | 1665 |
| J13 | words | yes | 1 | yes |  |  | 1174 |
| M01 | compound | **no** | 4 | no | g3, g4, g3, g3 | less-flow, map-wide | 35506 |
| M02 | compound | yes | 1 | yes |  | cleared | 2921 |
| M03 | compound | yes | 1 | yes |  |  | 1244 |
| M04 | compound | **no** | 1 | no | g1, g2, g1, g1 |  | 3740 |
| M05 | compound | yes | 1 | yes |  | cleared | 2180 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1296 |
| M07 | compound | yes | 1 | yes |  |  | 1583 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 6152 |
| M09 | compound | yes | 1 | yes |  |  | 4406 |
| M10 | compound | yes | 1 | yes |  |  | 13445 |
| V01 | vague | yes | 3 | yes |  | cleared | 2301 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2492 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 5471 |
| V05 | vague | yes | 1 | yes |  | reduced, cleared | 1303 |
| V06 | vague | yes | 3 |  |  |  | 1330 |
| I01 | impossible | yes | 1 |  |  |  | 135 |
| I02 | impossible | yes | 1 |  |  |  | 351 |
| I03 | impossible | yes | 1 |  |  |  | 789 |
| I04 | impossible | yes | 0 |  |  |  | 370 |
| I05 | impossible | yes | 1 |  |  |  | 388 |
| I06 | impossible | yes | 1 |  |  |  | 351 |
| I07 | impossible | **no** | 1 |  |  |  | 915 |
| I08 | impossible | yes | 0 |  |  |  | 459 |
| X01 | conflicting | **no** | 2 | no |  |  | 1029 |
| X02 | conflicting | yes | 1 |  |  |  | 438 |
| X03 | conflicting | yes | 2 |  |  |  | 2578 |
| X04 | conflicting | **no** | 1 | no | g2, g2 | badwater-poisons-reservoir, cleared | 6867 |
| X09 | conflicting | **no** | 2 |  |  |  | 2267 |
| X05 | conflicting | yes | 1 |  |  |  | 394 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2901 |
| X07 | conflicting | yes | 1 |  |  |  | 3103 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 3579 |
| Q01 | question | **no** | 1 |  |  |  | 165 |
| Q02 | question | yes | 2 |  |  |  | 362 |
| Q03 | question | yes | 1 |  |  |  | 1779 |
| Q04 | question | yes | 1 |  |  |  | 334 |
| Q05 | question | yes | 1 |  |  |  | 666 |
| Q06 | question | yes | 2 |  |  |  | 824 |
| Q07 | question | yes | 1 |  |  |  | 1040 |
| Z01 | safety | yes | 1 |  |  |  | 1171 |
| Z02 | safety | yes | 1 | yes |  |  | 2103 |
| Z03 | safety | yes | 1 |  |  |  | 407 |
| Z04 | safety | yes | 1 |  |  |  | 439 |
| Z05 | safety | yes | 2 | yes |  |  | 2044 |
| Z06 | safety | yes | 0 |  |  |  | 763 |
| Z07 | safety | yes | 1 |  |  |  | 513 |
| N01 | simple | yes | 1 |  |  |  | 918 |
| N02 | simple | yes | 1 |  |  |  | 268 |
| N03 | simple | yes | 1 |  |  |  | 414 |
| N04 | compass | yes | 1 |  |  |  | 287 |
| N05 | vague | yes | 0 |  |  |  | 426 |

- S09: propose was not accepted; expected accepted (step 0: moveFeature needs by or to)
- P08: propose was not accepted; expected accepted (not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"entities.placement","message":"UndergroundRuins at (86,84,16): floating at (86,85,16)","causedByStep":0},{"id":"extras.placement","message":"a mine site stands on uneven ground","causedByStep":0}]
- P09: propose was not accepted; expected accepted (not accepted: it breaks resources.badwater_source, which passed before (guards are never traded away)); guards broken: [{"id":"resources.badwater_source","message":"no badwater source: every map needs at least one, the late game's lasting badwater, unless it is set to No badwater","causedByStep":0}]
- F07: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); nothing here reaches the reservoir of at least 1012 blocks; every site that fits here breaks a check that passes now (1 breaks entities.placement, water.source_in_flow, water.badwater_contained; 1 breaks start.water; 1 breaks start.water, start.food; 1 breaks extras.placement)
- F08: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); nothing here reaches the reservoir of at least 1012 blocks; every site that fits here breaks a check that passes now (1 breaks entities.placement, water.source_in_flow, water.badwater_contained; 1 breaks start.water; 1 breaks start.water, start.food; 1 breaks extras.placement)
- C01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake at failed: the proposal made no lake
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W09: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks start.water, start.food); expectation g1 the badwater course.bank failed: it is "start's bank", not "opposite bank"
- W10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake course.bank failed: the proposal made no lake; expectation g1 new:lake course.frac failed: the proposal made no lake
- J03: expectation g1 map badwaterDistance failed: it is 18.8, under 30
- M01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 2: nothing here reaches the reservoir of at least 1012 blocks | step 3: every site that fits here breaks a check that passes now (1 breaks entities.placement, water.source_in_flow, water.badwater_contained; 1 breaks start.water; 1 breaks start.water, start.food; 1 breaks extras.placement); expectation g3 new:damSite reservoir.volume failed: the proposal made no damSite; expectation g3 new:damSite course.frac failed: the proposal made no damSite; expectation g3 new:damSite reservoirClean failed: the proposal made no damSite; expectation g4 new:badwaterBasin course.bank failed: the proposal made no badwaterBasin; expectation g4 new:badwaterBasin strength failed: the proposal made no badwaterBasin
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: no spot here meets the start rules (261 spots: 186 too far from pumpable clean water (20 tiles), 0 with too little wood (80 logs), 0 with too few berry bushes (30), 36 too near badwater (15), 39 not level, dry and clear); mostly: water | step 1: every site that fits here breaks a check that passes now (1 breaks start.food); expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up; expectation g2 new:damSite course.frac failed: the proposal made no damSite
- M06: expectation g2 map badwaterDistance failed: it is 23, under 30
- I07: check call:0 reason includes "within 42 tiles of the start" failed (actual: "every site that fits here breaks a check that passes now (2 breaks resources.mine_site; 1 breaks entities.placement, water.source_in_flow, water.badwater_conta)
- X01: propose was not accepted; expected accepted (step 0: each step is an object with an op); check call:0 ok true  failed (actual: false)
- X04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: every site that fits here breaks a check that passes now (2 breaks extras.placement), and nowhere else on this map either; expectation g2 new:badwaterBasin course.frac failed: the proposal made no badwaterBasin
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"262 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
