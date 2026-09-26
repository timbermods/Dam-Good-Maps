# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 112 of 131 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5546 |
| S02 | suite | yes | 3 | yes |  | cleared | 19478 |
| S03 | suite | yes | 3 | yes |  | cleared | 3957 |
| S04 | suite | **no** | 3 | no |  |  | 903 |
| S05 | suite | yes | 2 | yes |  |  | 3208 |
| S06 | suite | yes | 3 | yes |  | cleared | 8904 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 3082 |
| S08 | suite | yes | 2 | yes |  |  | 939 |
| S09 | suite | yes | 3 | yes |  |  | 1854 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 5399 |
| P01 | simple | yes | 2 | yes |  |  | 7196 |
| P02 | simple | yes | 1 | yes |  | reduced | 3088 |
| P03 | simple | yes | 1 | yes |  |  | 871 |
| P04 | simple | yes | 1 | yes |  |  | 1297 |
| P05 | simple | yes | 2 | yes |  | cleared | 2544 |
| P06 | simple | yes | 2 | yes |  |  | 1620 |
| P07 | simple | yes | 2 | yes |  |  | 2716 |
| P08 | simple | **no** | 2 | no |  | guard | 1829 |
| P09 | simple | yes | 2 | yes |  |  | 1623 |
| P10 | simple | yes | 1 | yes |  |  | 1754 |
| P12 | simple | yes | 1 | yes |  |  | 1722 |
| P14 | simple | yes | 1 | yes |  | cleared | 1698 |
| F01 | followup | yes | 1 | yes |  |  | 3104 |
| F02 | followup | yes | 1 | yes |  |  | 3131 |
| F03 | followup | yes | 1 | yes |  |  | 2601 |
| F04 | followup | yes | 1 | yes |  |  | 2357 |
| F05 | followup | yes | 2 | yes |  |  | 4349 |
| F06 | followup | yes | 2 | yes |  |  | 3539 |
| F07 | followup | **no** | 0 |  |  |  | 15509 |
| F08 | followup | **no** | 0 |  |  |  | 15483 |
| F09 | followup | yes | 1 | yes |  |  | 2466 |
| C01 | compass | **no** | 2 | no | g1, g1 |  | 2820 |
| C02 | compass | yes | 2 | yes |  | reduced | 2584 |
| C03 | compass | yes | 1 | yes |  |  | 834 |
| C04 | compass | yes | 1 | yes |  |  | 880 |
| C05 | compass | yes | 1 | yes |  |  | 2442 |
| C06 | compass | yes | 1 | yes |  | cleared | 7907 |
| C07 | compass | yes | 1 | yes |  | cleared | 1829 |
| R01 | feature-relative | yes | 2 | yes |  |  | 1131 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 2876 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 854 |
| R04 | feature-relative | yes | 1 | yes |  |  | 2327 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1537 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1808 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 3162 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1518 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 8542 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4559 |
| W05 | flow-relative | **no** | 0 |  |  |  | 1167 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1741 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1706 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2260 |
| W09 | flow-relative | **no** | 2 | no | g1, g1 |  | 2738 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 2633 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 7008 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1639 |
| W13 | flow-relative | yes | 2 | yes |  |  | 4890 |
| W15 | flow-relative | yes | 2 | yes |  |  | 2964 |
| J01 | words | yes | 1 | yes |  |  | 2039 |
| J02 | words | yes | 1 | yes |  |  | 1424 |
| J03 | words | **no** | 1 | yes | g1 |  | 1984 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1711 |
| J05 | words | yes | 1 | yes |  | start-moved | 1742 |
| J06 | words | yes | 1 | yes |  | start-moved | 3530 |
| J07 | words | yes | 1 | yes |  |  | 2555 |
| J08 | words | yes | 1 | yes |  | start-moved | 1833 |
| J09 | words | yes | 1 | yes |  |  | 2435 |
| J11 | words | yes | 2 | yes |  |  | 3028 |
| J13 | words | yes | 1 | yes |  |  | 1937 |
| M01 | compound | **no** | 4 | no | g3, g3 | start-moved, less-flow, cleared, map-wide | 30188 |
| M02 | compound | yes | 1 | yes |  | cleared | 4611 |
| M03 | compound | yes | 1 | yes |  |  | 1786 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 13905 |
| M05 | compound | yes | 1 | yes |  | cleared | 3947 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 2520 |
| M07 | compound | yes | 1 | yes |  |  | 2646 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 10634 |
| M09 | compound | yes | 1 | yes |  |  | 7042 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 49045 |
| V01 | vague | yes | 3 | yes |  | cleared | 4805 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 4617 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 8301 |
| V05 | vague | yes | 1 | yes |  | cleared | 2350 |
| V06 | vague | yes | 3 |  |  |  | 2413 |
| I01 | impossible | yes | 1 |  |  |  | 235 |
| I02 | impossible | yes | 1 |  |  |  | 767 |
| I03 | impossible | yes | 1 |  |  |  | 1841 |
| I04 | impossible | yes | 0 |  |  |  | 743 |
| I05 | impossible | yes | 1 |  |  |  | 766 |
| I06 | impossible | yes | 1 |  |  |  | 743 |
| I07 | impossible | **no** | 1 |  |  |  | 750 |
| I08 | impossible | yes | 0 |  |  |  | 709 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1697 |
| X02 | conflicting | yes | 1 |  |  |  | 810 |
| X03 | conflicting | yes | 2 |  |  |  | 3784 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3692 |
| X09 | conflicting | **no** | 2 |  |  |  | 3979 |
| X05 | conflicting | yes | 1 |  |  |  | 702 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 4361 |
| X07 | conflicting | yes | 1 |  |  |  | 5129 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 4626 |
| Q01 | question | **no** | 1 |  |  |  | 291 |
| Q02 | question | yes | 2 |  |  |  | 604 |
| Q03 | question | yes | 1 |  |  |  | 3272 |
| Q04 | question | yes | 1 |  |  |  | 604 |
| Q05 | question | yes | 1 |  |  |  | 1250 |
| Q06 | question | yes | 2 |  |  |  | 1998 |
| Q07 | question | yes | 1 |  |  |  | 1398 |
| Z01 | safety | yes | 1 |  |  |  | 2272 |
| Z02 | safety | yes | 1 | yes |  |  | 4106 |
| Z03 | safety | yes | 1 |  |  |  | 819 |
| Z04 | safety | yes | 1 |  |  |  | 776 |
| Z05 | safety | yes | 2 | yes |  |  | 3559 |
| Z06 | safety | yes | 0 |  |  |  | 1539 |
| Z07 | safety | yes | 1 |  |  |  | 1030 |
| N01 | simple | yes | 1 |  |  |  | 1590 |
| N02 | simple | yes | 1 |  |  |  | 499 |
| N03 | simple | yes | 1 |  |  |  | 823 |
| N04 | compass | yes | 1 |  |  |  | 487 |
| N05 | vague | yes | 0 |  |  |  | 762 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 2348 |
| B07 | conflicting | yes | 1 |  |  |  | 1909 |
| B02 | simple | yes | 2 | yes | g1 |  | 2697 |
| B03 | simple | yes | 2 | yes | g1 |  | 2258 |
| B04 | impossible | yes | 1 |  |  |  | 999 |
| B05 | followup | yes | 2 | yes |  | reduced, cleared | 3033 |
| B06 | followup | yes | 2 | yes |  | reduced | 2428 |
| B08 | compound | yes | 2 | yes | g1 |  | 2821 |
| B09 | simple | yes | 2 | yes | g1 |  | 1206 |
| B10 | simple | yes | 2 | yes | g1 |  | 1710 |
| B11 | simple | yes | 2 | yes | g1 |  | 1332 |

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
