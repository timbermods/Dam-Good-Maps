# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 105 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5965 |
| S02 | suite | yes | 3 | yes |  | cleared | 30163 |
| S03 | suite | yes | 3 | yes |  | cleared | 9455 |
| S04 | suite | **no** | 3 | no |  |  | 2061 |
| S05 | suite | yes | 2 | yes |  | reduced | 8108 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 15408 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 10077 |
| S08 | suite | yes | 2 | yes |  |  | 1741 |
| S09 | suite | yes | 3 | yes |  |  | 2834 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 7412 |
| P01 | simple | yes | 2 | yes |  |  | 8971 |
| P02 | simple | yes | 1 | yes |  |  | 3771 |
| P03 | simple | yes | 1 | yes |  |  | 1111 |
| P04 | simple | yes | 1 | yes |  |  | 1757 |
| P05 | simple | yes | 2 | yes |  | cleared | 4414 |
| P06 | simple | yes | 2 | yes |  |  | 2665 |
| P07 | simple | yes | 2 | yes |  |  | 3968 |
| P08 | simple | **no** | 2 | no |  | guard | 2763 |
| P09 | simple | yes | 2 | yes |  |  | 2203 |
| P10 | simple | yes | 1 | yes |  |  | 3015 |
| P12 | simple | yes | 1 | yes |  |  | 3558 |
| P14 | simple | yes | 1 | yes |  | cleared | 3738 |
| F01 | followup | yes | 1 | yes |  |  | 3716 |
| F02 | followup | yes | 1 | yes |  |  | 3767 |
| F03 | followup | yes | 1 | yes |  |  | 3393 |
| F04 | followup | yes | 1 | yes |  |  | 3588 |
| F05 | followup | yes | 2 | yes |  |  | 6539 |
| F06 | followup | yes | 2 | yes |  |  | 6136 |
| F07 | followup | yes | 3 | yes |  |  | 28871 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 24017 |
| F09 | followup | yes | 1 | yes |  |  | 2790 |
| C01 | compass | **no** | 2 | no | g1, g1 |  | 2852 |
| C02 | compass | yes | 2 | yes |  |  | 2853 |
| C03 | compass | yes | 1 | yes |  |  | 864 |
| C04 | compass | yes | 1 | yes |  |  | 957 |
| C05 | compass | yes | 1 | yes |  |  | 2549 |
| C06 | compass | yes | 1 | yes |  |  | 8324 |
| C07 | compass | yes | 1 | yes |  | cleared | 1666 |
| R01 | feature-relative | yes | 2 | yes |  |  | 902 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 2862 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 954 |
| R04 | feature-relative | yes | 1 | yes |  |  | 2549 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1696 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1904 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 2682 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1577 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 8202 |
| W04 | flow-relative | yes | 1 | yes |  |  | 6020 |
| W05 | flow-relative | **no** | 0 |  |  |  | 1299 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1851 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1997 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2404 |
| W09 | flow-relative | yes | 2 | yes |  |  | 2643 |
| W10 | flow-relative | **no** | 2 | no | g1, g1 |  | 2625 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 7133 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1810 |
| W13 | flow-relative | yes | 2 | yes |  |  | 4622 |
| W15 | flow-relative | yes | 2 | yes |  |  | 3158 |
| J01 | words | yes | 1 | yes |  |  | 2310 |
| J02 | words | yes | 1 | yes |  |  | 1456 |
| J03 | words | **no** | 1 | yes | g1 |  | 2146 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1789 |
| J05 | words | yes | 1 | yes |  | start-moved | 2155 |
| J06 | words | yes | 1 | yes |  | start-moved | 4082 |
| J07 | words | yes | 1 | yes |  |  | 3096 |
| J08 | words | yes | 1 | yes |  | start-moved | 2366 |
| J09 | words | yes | 1 | yes |  |  | 8670 |
| J11 | words | yes | 2 | yes |  |  | 3421 |
| J13 | words | yes | 1 | yes |  |  | 2354 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 35140 |
| M02 | compound | yes | 1 | yes |  | cleared | 5335 |
| M03 | compound | yes | 1 | yes |  |  | 2600 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 21218 |
| M05 | compound | yes | 1 | yes |  |  | 4413 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 4681 |
| M07 | compound | yes | 1 | yes |  |  | 3792 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 13495 |
| M09 | compound | yes | 1 | yes |  |  | 7502 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 94654 |
| V01 | vague | yes | 3 | yes |  | cleared | 4409 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 5213 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 9840 |
| V05 | vague | yes | 1 | yes |  | cleared | 2863 |
| V06 | vague | yes | 3 |  |  |  | 3090 |
| I01 | impossible | yes | 1 |  |  |  | 323 |
| I02 | impossible | yes | 1 |  |  |  | 926 |
| I03 | impossible | yes | 1 |  |  |  | 2339 |
| I04 | impossible | yes | 0 |  |  |  | 870 |
| I05 | impossible | yes | 1 |  |  |  | 833 |
| I06 | impossible | yes | 1 |  |  |  | 841 |
| I07 | impossible | **no** | 1 |  |  |  | 954 |
| I08 | impossible | yes | 0 |  |  |  | 829 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 1854 |
| X02 | conflicting | yes | 1 |  |  |  | 833 |
| X03 | conflicting | yes | 2 |  |  |  | 5017 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 5900 |
| X09 | conflicting | **no** | 2 |  |  |  | 10467 |
| X05 | conflicting | yes | 1 |  |  |  | 823 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 8341 |
| X07 | conflicting | yes | 1 |  |  |  | 11128 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 5594 |
| Q01 | question | **no** | 1 |  |  |  | 329 |
| Q02 | question | yes | 2 |  |  |  | 775 |
| Q03 | question | yes | 1 |  |  |  | 3722 |
| Q04 | question | yes | 1 |  |  |  | 851 |
| Q05 | question | yes | 1 |  |  |  | 1502 |
| Q06 | question | yes | 2 |  |  |  | 2274 |
| Q07 | question | yes | 1 |  |  |  | 1834 |
| Z01 | safety | yes | 1 |  |  |  | 2467 |
| Z02 | safety | yes | 1 | yes |  |  | 4415 |
| Z03 | safety | yes | 1 |  |  |  | 1146 |
| Z04 | safety | yes | 1 |  |  |  | 883 |
| Z05 | safety | yes | 2 | yes |  |  | 7875 |
| Z06 | safety | yes | 0 |  |  |  | 1520 |
| Z07 | safety | yes | 1 |  |  |  | 1056 |
| N01 | simple | yes | 1 |  |  |  | 2002 |
| N02 | simple | yes | 1 |  |  |  | 580 |
| N03 | simple | yes | 1 |  |  |  | 924 |
| N04 | compass | yes | 1 |  |  |  | 2310 |
| N05 | vague | yes | 0 |  |  |  | 908 |

- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- P08: propose was not accepted; expected accepted (not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)); guards broken: [{"id":"entities.placement","message":"UndergroundRuins at (86,81,16): floating at (86,85,16)","causedByStep":0},{"id":"extras.placement","message":"a mine site stands on uneven ground; a medium relic is within 2 tiles of water or in a reservoir site","causedByStep":0}]
- C01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake at failed: the proposal made no lake
- W05: setup: setup edit "draw a creek from the east edge into the river" failed: not accepted: it breaks extras.placement, which passed before (guards are never traded away)
- W06: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W07: setup: setup edit "draw a creek from the north edge into the river" failed: not accepted: it breaks entities.placement, extras.placement, which passed before (guards are never traded away)
- W10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks extras.placement); expectation g1 new:lake course.bank failed: the proposal made no lake; expectation g1 new:lake course.frac failed: the proposal made no lake
- J03: expectation g1 map badwaterDistance failed: it is 22.4, under 30
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (8 breaks extras.placement; 1 breaks start.wood, extras.placement; 1 breaks start.food, start.wood, extras.placement), and nowhere else on this map either; expectation g1 start course.frac failed: it went from 0.34 to 0.34, not up
- M06: expectation g2 map badwaterDistance failed: it is 22.6, under 30
- I07: check call:0 ok false  failed (actual: true); check call:0 reason includes "within 42 tiles of the start" failed (actual: undefined)
- X01: expectation g1 new:badwaterBasin distanceToStart failed: it is 27.9, under 40
- X09: check call:0 sites.0.measured.reservoirClean false  failed (actual: true)
- X08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 1518 blocks; expectation g1 new:damSite reservoir.volume failed: the proposal made no damSite
- Q01: check call:0 failing includes "start.water" failed (actual: "[{\"id\":\"start.reach\",\"message\":\"252 dry tiles are walkable from the start through slopes (the target is 1300; official p10 1,007)\",\"advisory\":true},{)
