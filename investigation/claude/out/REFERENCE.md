# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 103 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 2231 |
| S02 | suite | yes | 3 | yes |  | cleared | 8452 |
| S03 | suite | yes | 3 | yes |  | cleared | 1534 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1521 |
| S05 | suite | yes | 2 | yes |  |  | 1125 |
| S06 | suite | **no** | 3 | yes | g1 | cleared | 6149 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1356 |
| S08 | suite | yes | 2 | yes |  |  | 379 |
| S09 | suite | yes | 3 | yes |  | cleared | 806 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2127 |
| P01 | simple | yes | 2 | yes |  |  | 2885 |
| P02 | simple | yes | 1 | yes |  |  | 1100 |
| P03 | simple | yes | 1 | yes |  |  | 377 |
| P04 | simple | yes | 1 | yes |  |  | 488 |
| P05 | simple | yes | 2 | yes |  | cleared | 1123 |
| P06 | simple | yes | 2 | yes |  |  | 750 |
| P07 | simple | yes | 2 | yes |  |  | 1234 |
| P08 | simple | **no** | 2 | no |  | guard | 835 |
| P09 | simple | yes | 2 | yes |  |  | 731 |
| P10 | simple | yes | 1 | yes |  |  | 713 |
| P12 | simple | **no** | 1 | no | g1, g1 |  | 706 |
| P14 | simple | yes | 1 | yes |  | cleared | 755 |
| F01 | followup | yes | 1 | yes |  |  | 1004 |
| F02 | followup | yes | 1 | yes |  |  | 980 |
| F03 | followup | yes | 1 | yes |  |  | 871 |
| F04 | followup | yes | 1 | yes |  |  | 771 |
| F05 | followup | yes | 2 | yes |  |  | 1918 |
| F06 | followup | yes | 2 | yes |  |  | 1521 |
| F07 | followup | yes | 3 | yes |  |  | 12767 |
| F08 | followup | yes | 1 | yes |  | reduced | 11301 |
| F09 | followup | yes | 1 | yes |  |  | 782 |
| C01 | compass | **no** | 2 | no | g1, g1 |  | 1109 |
| C02 | compass | yes | 2 | yes |  |  | 1113 |
| C03 | compass | yes | 1 | yes |  |  | 373 |
| C04 | compass | yes | 1 | yes |  |  | 387 |
| C05 | compass | yes | 1 | yes |  |  | 1089 |
| C06 | compass | yes | 1 | yes |  | cleared | 3573 |
| C07 | compass | yes | 1 | yes |  | cleared | 731 |
| R01 | feature-relative | yes | 2 | yes |  |  | 375 |
| R02 | feature-relative | yes | 1 | yes |  |  | 1249 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 364 |
| R04 | feature-relative | yes | 1 | yes |  |  | 911 |
| R06 | feature-relative | yes | 1 | yes |  |  | 678 |
| R08 | feature-relative | yes | 2 | yes |  |  | 820 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1091 |
| W02 | flow-relative | yes | 1 | yes |  |  | 697 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 3433 |
| W04 | flow-relative | yes | 1 | yes |  |  | 2426 |
| W05 | flow-relative | **no** | 0 |  |  |  | 493 |
| W06 | flow-relative | **no** | 0 |  |  |  | 775 |
| W07 | flow-relative | **no** | 0 |  |  |  | 768 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1041 |
| W09 | flow-relative | yes | 2 | yes |  |  | 866 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 1057 |
| W11 | flow-relative | yes | 1 | yes |  |  | 3005 |
| W12 | flow-relative | yes | 1 | yes |  |  | 743 |
| W13 | flow-relative | yes | 2 | yes |  |  | 1970 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1321 |
| J01 | words | yes | 1 | yes |  |  | 837 |
| J02 | words | yes | 1 | yes |  |  | 619 |
| J03 | words | **no** | 1 | yes | g1 |  | 890 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 695 |
| J05 | words | yes | 1 | yes |  | start-moved | 830 |
| J06 | words | yes | 1 | yes |  | start-moved | 1578 |
| J07 | words | yes | 1 | yes |  |  | 1134 |
| J08 | words | yes | 1 | yes |  | start-moved | 823 |
| J09 | words | yes | 1 | yes |  |  | 1039 |
| J11 | words | **no** | 2 | no | g1, g1 |  | 1817 |
| J13 | words | yes | 1 | yes |  |  | 951 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, map-wide | 21005 |
| M02 | compound | yes | 1 | yes |  | cleared | 2166 |
| M03 | compound | yes | 1 | yes |  |  | 1058 |
| M04 | compound | **no** | 1 | no | g1, g2, g1, g1 |  | 6072 |
| M05 | compound | yes | 1 | yes |  | cleared | 1644 |
| M06 | compound | **no** | 1 | yes | g2 |  | 1036 |
| M07 | compound | yes | 1 | yes |  | reduced | 1331 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 4844 |
| M09 | compound | yes | 1 | yes |  |  | 3752 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 35783 |
| V01 | vague | yes | 3 | yes |  | cleared | 2114 |
| V02 | vague | yes | 1 | yes |  | reduced | 2167 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4325 |
| V05 | vague | yes | 1 | yes |  | cleared | 1095 |
| V06 | vague | yes | 3 |  |  |  | 1247 |
| I01 | impossible | yes | 1 |  |  |  | 133 |
| I02 | impossible | yes | 1 |  |  |  | 381 |
| I03 | impossible | yes | 1 |  |  |  | 683 |
| I04 | impossible | yes | 0 |  |  |  | 383 |
| I05 | impossible | yes | 1 |  |  |  | 344 |
| I06 | impossible | yes | 1 |  |  |  | 341 |
| I07 | impossible | **no** | 1 |  |  |  | 549 |
| I08 | impossible | yes | 0 |  |  |  | 360 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 889 |
| X02 | conflicting | yes | 1 |  |  |  | 416 |
| X03 | conflicting | yes | 2 |  |  |  | 2152 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2552 |
| X09 | conflicting | **no** | 2 |  |  |  | 2045 |
| X05 | conflicting | yes | 1 |  |  |  | 327 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2542 |
| X07 | conflicting | yes | 1 |  |  |  | 2718 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2233 |
| Q01 | question | **no** | 1 |  |  |  | 150 |
| Q02 | question | yes | 2 |  |  |  | 334 |
| Q03 | question | yes | 1 |  |  |  | 1753 |
| Q04 | question | yes | 1 |  |  |  | 344 |
| Q05 | question | yes | 1 |  |  |  | 1055 |
| Q06 | question | yes | 2 |  |  |  | 616 |
| Q07 | question | yes | 1 |  |  |  | 789 |
| Z01 | safety | yes | 1 |  |  |  | 1129 |
| Z02 | safety | yes | 1 | yes |  |  | 1897 |
| Z03 | safety | yes | 1 |  |  |  | 346 |
| Z04 | safety | yes | 1 |  |  |  | 354 |
| Z05 | safety | yes | 2 | yes |  |  | 1604 |
| Z06 | safety | yes | 0 |  |  |  | 650 |
| Z07 | safety | yes | 1 |  |  |  | 452 |
| N01 | simple | yes | 1 |  |  |  | 757 |
| N02 | simple | yes | 1 |  |  |  | 227 |
| N03 | simple | yes | 1 |  |  |  | 336 |
| N04 | compass | yes | 1 |  |  |  | 222 |
| N05 | vague | yes | 0 |  |  |  | 324 |

- S06: expectation g1 start distanceTo:lake failed: it went from 36.7 to 41, not down
- P08: propose was not accepted; expected accepted (not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"entities.placement","message":"UndergroundRuins at (86,84,16): floating at (86,85,16)","causedByStep":0},{"id":"extras.placement","message":"a mine site stands on uneven ground","causedByStep":0}]
- P12: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks entities.placement, extras.placement); expectation g1 new:canyon at failed: the proposal made no canyon
- C01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake at failed: the proposal made no lake
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake course.bank failed: the proposal made no lake; expectation g1 new:lake course.frac failed: the proposal made no lake
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- J11: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks entities.placement, extras.placement); expectation g1 new:lake area failed: the proposal made no lake; expectation g1 new:lake at failed: the proposal made no lake
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (4 breaks extras.placement; 2 breaks start.food, extras.placement; 3 breaks start.wood, extras.placement; 1 breaks start.food, start.wood, extras.placement), and nowhere else on this map either | step 1: every site that fits here breaks a check that passes now (1 breaks start.food); expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up; expectation g2 new:damSite course.frac failed: the proposal made no damSite
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 reason includes "within 42 tiles of the start" failed (actual: "every site that fits here breaks a check that passes now (1 breaks entities.placement, water.source_in_flow, water.badwater_contained; 1 breaks resources.mine_)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"262 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
