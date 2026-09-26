# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 104 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5016 |
| S02 | suite | yes | 3 | yes |  | cleared | 18917 |
| S03 | suite | yes | 3 | yes |  | cleared | 3439 |
| S04 | suite | **no** | 3 | no |  |  | 2984 |
| S05 | suite | yes | 2 | yes |  |  | 2136 |
| S06 | suite | **no** | 3 | yes | g1 |  | 14941 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 3977 |
| S08 | suite | yes | 2 | yes |  |  | 957 |
| S09 | suite | yes | 3 | yes |  | cleared | 2146 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 5656 |
| P01 | simple | yes | 2 | yes |  |  | 5696 |
| P02 | simple | yes | 1 | yes |  |  | 2512 |
| P03 | simple | yes | 1 | yes |  |  | 767 |
| P04 | simple | yes | 1 | yes |  |  | 1067 |
| P05 | simple | yes | 2 | yes |  | cleared | 2429 |
| P06 | simple | yes | 2 | yes |  |  | 1814 |
| P07 | simple | yes | 2 | yes |  |  | 2755 |
| P08 | simple | **no** | 2 | no |  | guard | 1646 |
| P09 | simple | yes | 2 | yes |  |  | 1437 |
| P10 | simple | yes | 1 | yes |  |  | 1481 |
| P12 | simple | **no** | 1 | no | g1, g1 |  | 1510 |
| P14 | simple | yes | 1 | yes |  | cleared | 1591 |
| F01 | followup | yes | 1 | yes |  |  | 2289 |
| F02 | followup | yes | 1 | yes |  |  | 2385 |
| F03 | followup | yes | 1 | yes |  |  | 2144 |
| F04 | followup | yes | 1 | yes |  |  | 1987 |
| F05 | followup | yes | 2 | yes |  |  | 4785 |
| F06 | followup | yes | 2 | yes |  |  | 3265 |
| F07 | followup | yes | 3 | yes |  |  | 25751 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 20877 |
| F09 | followup | yes | 1 | yes |  |  | 1998 |
| C01 | compass | yes | 2 | yes |  |  | 2249 |
| C02 | compass | yes | 2 | yes |  |  | 2871 |
| C03 | compass | yes | 1 | yes |  |  | 841 |
| C04 | compass | yes | 1 | yes |  |  | 1490 |
| C05 | compass | yes | 1 | yes |  |  | 2654 |
| C06 | compass | yes | 1 | yes |  |  | 8158 |
| C07 | compass | yes | 1 | yes |  | cleared | 1810 |
| R01 | feature-relative | yes | 2 | yes |  |  | 867 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 2715 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 907 |
| R04 | feature-relative | yes | 1 | yes |  | cleared | 2391 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1604 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1834 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 3075 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1776 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 7470 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4585 |
| W05 | flow-relative | **no** | 0 |  |  |  | 1094 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1746 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1824 |
| W08 | flow-relative | yes | 2 | yes |  |  | 3169 |
| W09 | flow-relative | yes | 2 | yes |  |  | 2286 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 2692 |
| W11 | flow-relative | yes | 1 | yes |  |  | 7410 |
| W12 | flow-relative | yes | 1 | yes |  |  | 5273 |
| W13 | flow-relative | yes | 2 | yes |  |  | 7389 |
| W15 | flow-relative | yes | 2 | yes |  |  | 3214 |
| J01 | words | yes | 1 | yes |  |  | 2680 |
| J02 | words | yes | 1 | yes |  |  | 1867 |
| J03 | words | **no** | 1 | yes | g1 |  | 2324 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1928 |
| J05 | words | yes | 1 | yes |  | start-moved | 2314 |
| J06 | words | yes | 1 | yes |  | start-moved | 4592 |
| J07 | words | yes | 1 | yes |  |  | 4470 |
| J08 | words | yes | 1 | yes |  | start-moved | 1946 |
| J09 | words | yes | 1 | yes |  |  | 3897 |
| J11 | words | **no** | 2 | no | g1, g1 |  | 5301 |
| J13 | words | yes | 1 | yes |  |  | 3549 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 44411 |
| M02 | compound | yes | 1 | yes |  | cleared | 4745 |
| M03 | compound | yes | 1 | yes |  |  | 2376 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 19435 |
| M05 | compound | yes | 1 | yes |  |  | 4494 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 4785 |
| M07 | compound | yes | 1 | yes |  |  | 4322 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 11818 |
| M09 | compound | yes | 1 | yes |  |  | 6901 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 39758 |
| V01 | vague | yes | 3 | yes |  | cleared | 3631 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 5113 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 8948 |
| V05 | vague | yes | 1 | yes |  | cleared | 2287 |
| V06 | vague | yes | 3 |  |  |  | 2480 |
| I01 | impossible | yes | 1 |  |  |  | 130 |
| I02 | impossible | yes | 1 |  |  |  | 692 |
| I03 | impossible | yes | 1 |  |  |  | 1211 |
| I04 | impossible | yes | 0 |  |  |  | 761 |
| I05 | impossible | yes | 1 |  |  |  | 798 |
| I06 | impossible | yes | 1 |  |  |  | 728 |
| I07 | impossible | **no** | 1 |  |  |  | 514 |
| I08 | impossible | yes | 0 |  |  |  | 711 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1654 |
| X02 | conflicting | yes | 1 |  |  |  | 751 |
| X03 | conflicting | yes | 2 |  |  |  | 3423 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3090 |
| X09 | conflicting | **no** | 2 |  |  |  | 3380 |
| X05 | conflicting | yes | 1 |  |  |  | 586 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 3863 |
| X07 | conflicting | yes | 1 |  |  |  | 5094 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 4066 |
| Q01 | question | yes | 1 |  |  |  | 187 |
| Q02 | question | yes | 2 |  |  |  | 475 |
| Q03 | question | yes | 1 |  |  |  | 2872 |
| Q04 | question | yes | 1 |  |  |  | 644 |
| Q05 | question | yes | 1 |  |  |  | 1145 |
| Q06 | question | yes | 2 |  |  |  | 1149 |
| Q07 | question | yes | 1 |  |  |  | 1368 |
| Z01 | safety | yes | 1 |  |  |  | 2065 |
| Z02 | safety | yes | 1 | yes |  |  | 3648 |
| Z03 | safety | yes | 1 |  |  |  | 699 |
| Z04 | safety | yes | 1 |  |  |  | 658 |
| Z05 | safety | yes | 2 | yes |  |  | 3351 |
| Z06 | safety | yes | 0 |  |  |  | 1384 |
| Z07 | safety | yes | 1 |  |  |  | 867 |
| N01 | simple | yes | 1 |  |  |  | 1315 |
| N02 | simple | yes | 1 |  |  |  | 423 |
| N03 | simple | yes | 1 |  |  |  | 667 |
| N04 | compass | yes | 1 |  |  |  | 435 |
| N05 | vague | yes | 0 |  |  |  | 706 |

- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- S06: expectation g1 start distanceTo:lake failed: it went from 36.7 to 41, not down
- P08: propose was not accepted; expected accepted (not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"entities.placement","message":"UndergroundRuins at (86,84,16): floating at (86,85,16)","causedByStep":0},{"id":"extras.placement","message":"a mine site stands on uneven ground","causedByStep":0}]
- P12: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks entities.placement, extras.placement); expectation g1 new:canyon at failed: the proposal made no canyon
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake course.bank failed: the proposal made no lake; expectation g1 new:lake course.frac failed: the proposal made no lake
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- J11: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks entities.placement, extras.placement); expectation g1 new:lake area failed: the proposal made no lake; expectation g1 new:lake at failed: the proposal made no lake
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (5 breaks extras.placement; 1 breaks start.food, extras.placement; 1 breaks start.food, start.wood, extras.placement; 3 breaks start.dry, start.food, start.wood, extras.placement), and nowhere else on this map either; expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 ok false  failed (actual: true); check call:0 reason includes "within 42 tiles of the start" failed (actual: undefined)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
