# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 112 of 131 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 4477 |
| S02 | suite | yes | 3 | yes |  | cleared | 11552 |
| S03 | suite | yes | 3 | yes |  | cleared | 1639 |
| S04 | suite | **no** | 3 | no |  |  | 402 |
| S05 | suite | yes | 2 | yes |  |  | 1360 |
| S06 | suite | yes | 3 | yes |  | cleared | 3821 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 1388 |
| S08 | suite | yes | 2 | yes |  |  | 438 |
| S09 | suite | yes | 3 | yes |  |  | 860 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 2441 |
| P01 | simple | yes | 2 | yes |  |  | 5219 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 1048 |
| P03 | simple | yes | 1 | yes |  |  | 421 |
| P04 | simple | yes | 1 | yes |  |  | 572 |
| P05 | simple | yes | 2 | yes |  | cleared | 1469 |
| P06 | simple | yes | 2 | yes |  |  | 1146 |
| P07 | simple | yes | 2 | yes |  |  | 1643 |
| P08 | simple | yes | 2 | yes | g1 |  | 1737 |
| P09 | simple | yes | 2 | yes |  |  | 842 |
| P10 | simple | **no** | 1 | no | g1 | guard | 1510 |
| P12 | simple | yes | 1 | yes | g1 |  | 940 |
| P14 | simple | yes | 1 | yes |  | cleared | 961 |
| F01 | followup | yes | 1 | yes |  |  | 1775 |
| F02 | followup | yes | 1 | yes |  |  | 1598 |
| F03 | followup | yes | 1 | yes |  |  | 1292 |
| F04 | followup | yes | 1 | yes |  |  | 1230 |
| F05 | followup | yes | 2 | yes |  |  | 2139 |
| F06 | followup | yes | 2 | yes |  |  | 1648 |
| F07 | followup | **no** | 0 |  |  |  | 7622 |
| F08 | followup | **no** | 0 |  |  |  | 7805 |
| F09 | followup | yes | 1 | yes |  |  | 1160 |
| C01 | compass | yes | 2 | yes |  |  | 1134 |
| C02 | compass | yes | 2 | yes | g1 |  | 1156 |
| C03 | compass | yes | 1 | yes |  |  | 420 |
| C04 | compass | yes | 1 | yes |  |  | 408 |
| C05 | compass | yes | 1 | yes | g1 |  | 719 |
| C06 | compass | yes | 1 | yes |  | cleared | 4097 |
| C07 | compass | yes | 1 | yes |  | cleared | 808 |
| R01 | feature-relative | yes | 2 | yes |  |  | 388 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1295 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 362 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3335 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 763 |
| R08 | feature-relative | yes | 2 | yes |  |  | 857 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1379 |
| W02 | flow-relative | yes | 1 | yes |  |  | 736 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 3628 |
| W04 | flow-relative | yes | 1 | yes |  |  | 2693 |
| W05 | flow-relative | **no** | 0 |  |  |  | 545 |
| W06 | flow-relative | **no** | 0 |  |  |  | 836 |
| W07 | flow-relative | **no** | 0 |  |  |  | 781 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1125 |
| W09 | flow-relative | **no** | 2 | no | g1, g1 |  | 1223 |
| W10 | flow-relative | **no** | 2 | no |  | guard | 1337 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 3647 |
| W12 | flow-relative | yes | 1 | yes |  |  | 866 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2166 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1442 |
| J01 | words | yes | 1 | yes |  |  | 944 |
| J02 | words | yes | 1 | yes |  |  | 664 |
| J03 | words | **no** | 1 | yes | g1 |  | 933 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 751 |
| J05 | words | yes | 1 | yes |  | start-moved | 1045 |
| J06 | words | yes | 1 | yes |  | start-moved | 1700 |
| J07 | words | yes | 1 | yes |  |  | 1387 |
| J08 | words | yes | 1 | yes |  | start-moved | 940 |
| J09 | words | yes | 1 | yes |  |  | 1099 |
| J11 | words | yes | 2 | yes |  |  | 3526 |
| J13 | words | yes | 1 | yes |  |  | 1187 |
| M01 | compound | **no** | 4 | no | g3, g3 | start-moved, less-flow, cleared, map-wide | 19567 |
| M02 | compound | yes | 1 | yes |  | cleared | 1646 |
| M03 | compound | yes | 1 | yes |  |  | 1358 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 8019 |
| M05 | compound | yes | 1 | yes |  | cleared | 1732 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1179 |
| M07 | compound | yes | 1 | yes |  | reduced | 1414 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5026 |
| M09 | compound | yes | 1 | yes |  |  | 3355 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 26667 |
| V01 | vague | yes | 3 | yes |  | cleared | 2557 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2316 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4427 |
| V05 | vague | yes | 1 | yes |  | cleared | 1245 |
| V06 | vague | yes | 3 |  |  |  | 1840 |
| I01 | impossible | yes | 1 |  |  |  | 127 |
| I02 | impossible | yes | 1 |  |  |  | 414 |
| I03 | impossible | yes | 1 |  |  |  | 1053 |
| I04 | impossible | yes | 0 |  |  |  | 429 |
| I05 | impossible | yes | 1 |  |  |  | 389 |
| I06 | impossible | yes | 1 |  |  |  | 391 |
| I07 | impossible | **no** | 1 |  |  |  | 421 |
| I08 | impossible | yes | 0 |  |  |  | 410 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 835 |
| X02 | conflicting | yes | 1 |  |  |  | 425 |
| X03 | conflicting | yes | 2 |  |  |  | 8904 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 1957 |
| X09 | conflicting | **no** | 2 |  |  |  | 2088 |
| X05 | conflicting | yes | 1 |  |  |  | 424 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2625 |
| X07 | conflicting | yes | 1 |  |  |  | 2604 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2234 |
| Q01 | question | **no** | 1 |  |  |  | 154 |
| Q02 | question | yes | 2 |  |  |  | 289 |
| Q03 | question | yes | 1 |  |  |  | 1565 |
| Q04 | question | yes | 1 |  |  |  | 336 |
| Q05 | question | yes | 1 |  |  |  | 676 |
| Q06 | question | yes | 2 |  |  |  | 1021 |
| Q07 | question | yes | 1 |  |  |  | 691 |
| Z01 | safety | yes | 1 |  |  |  | 1142 |
| Z02 | safety | yes | 1 | yes |  |  | 2100 |
| Z03 | safety | yes | 1 |  |  |  | 420 |
| Z04 | safety | yes | 1 |  |  |  | 388 |
| Z05 | safety | yes | 2 | yes |  |  | 1672 |
| Z06 | safety | yes | 0 |  |  |  | 732 |
| Z07 | safety | yes | 1 |  |  |  | 506 |
| N01 | simple | yes | 1 |  |  |  | 939 |
| N02 | simple | yes | 1 |  |  |  | 269 |
| N03 | simple | yes | 1 |  |  |  | 387 |
| N04 | compass | yes | 1 |  |  |  | 258 |
| N05 | vague | yes | 0 |  |  |  | 389 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1186 |
| B07 | conflicting | yes | 1 |  |  |  | 936 |
| B02 | simple | yes | 2 | yes | g1 |  | 1398 |
| B03 | simple | yes | 2 | yes | g1 |  | 1160 |
| B04 | impossible | yes | 1 |  |  |  | 505 |
| B05 | simple | **no** | 2 | no | g1 | guard | 1783 |
| B06 | simple | yes | 1 | yes | g1 |  | 1421 |
| B08 | compound | yes | 2 | yes | g1 |  | 1756 |
| B09 | simple | yes | 2 | yes | g1 |  | 789 |
| B10 | simple | yes | 2 | yes | g1 |  | 1049 |
| B11 | simple | yes | 2 | yes | g1 |  | 844 |

- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- P10: propose was not accepted; expected accepted (not accepted: it breaks extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"extras.placement","message":"a geothermal field is within 2 tiles of water or in a reservoir site; a geothermal field is within 2 tiles of water or in a reservoir site; a medium relic is within 2 tiles of water or in a reservoir site; a small relic is within 2 tiles of water or in a reservoir site","causedByStep":0}]
- F07: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement)
- F08: setup: setup edit "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and create a dangerous badwater route on the opposite side." failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement)
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W09: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks water.clean_exists, start.water, start.food, start.wood, resources.bushes); expectation g1 the badwater course.bank failed: it is "start's bank", not "opposite bank"
- W10: propose was not accepted; expected accepted (not accepted: it breaks extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"extras.placement","message":"a medium relic is within 2 tiles of water or in a reservoir site","causedByStep":1}]
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- M01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: every site that fits here breaks a check that passes now (6 breaks extras.placement; 1 breaks start.food, extras.placement; 2 breaks start.food; 1 breaks start.food, start.wood, extras.placement); expectation g3 new:damSite reservoir.volume failed: the proposal made no damSite; expectation g3 new:damSite course.frac failed: the proposal made no damSite; expectation g3 new:damSite reservoirClean failed: the proposal made no damSite
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (3 breaks start.food, extras.placement; 2 breaks extras.placement; 3 breaks start.food, start.wood, extras.placement; 2 breaks start.dry, start.food, start.wood, extras.placement), and nowhere else on this map either; expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 ok false  failed (actual: true); check call:0 reason includes "within 42 tiles of the start" failed (actual: undefined)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"138 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
- B05: propose was not accepted; expected accepted (not accepted: it breaks ruins.access, which passed before (guards are never traded away)); guards broken: [{"id":"ruins.access","message":"1 ruin columns have no neighbour at their level for a scavenger to stand on","causedByStep":0}]
