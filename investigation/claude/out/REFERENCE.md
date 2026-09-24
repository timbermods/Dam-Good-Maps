# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 107 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | **no** | 3 | no |  |  | 6897 |
| S02 | suite | yes | 3 | yes |  | cleared | 18336 |
| S03 | suite | yes | 3 | yes |  | reduced, cleared | 2734 |
| S04 | suite | **no** | 3 | no |  |  | 1997 |
| S05 | suite | **no** | 0 |  |  |  | 5487 |
| S06 | suite | yes | 3 | yes |  | cleared | 3325 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 2687 |
| S08 | suite | yes | 2 | yes |  |  | 1027 |
| S09 | suite | yes | 3 | yes |  |  | 2704 |
| S10 | suite | yes | 2 | yes |  | reduced, less-flow | 3303 |
| P01 | simple | yes | 2 | yes |  | cleared | 2989 |
| P02 | simple | yes | 1 | yes |  |  | 1288 |
| P03 | simple | yes | 1 | yes |  |  | 997 |
| P04 | simple | yes | 1 | yes |  |  | 783 |
| P05 | simple | yes | 2 | yes |  | cleared | 3003 |
| P06 | simple | yes | 2 | yes |  |  | 1730 |
| P07 | simple | yes | 2 | yes |  |  | 3374 |
| P08 | simple | yes | 2 | yes |  |  | 1234 |
| P09 | simple | yes | 2 | yes |  |  | 936 |
| P10 | simple | yes | 1 | yes |  |  | 1887 |
| P12 | simple | yes | 1 | yes |  |  | 1773 |
| P14 | simple | yes | 1 | yes |  | cleared | 1978 |
| F01 | followup | **no** | 0 |  |  |  | 5438 |
| F02 | followup | **no** | 0 |  |  |  | 5421 |
| F03 | followup | **no** | 0 |  |  |  | 5308 |
| F04 | followup | **no** | 0 |  |  |  | 5165 |
| F05 | followup | yes | 2 | yes |  | cleared | 2536 |
| F06 | followup | yes | 2 | yes |  |  | 2216 |
| F07 | followup | yes | 3 | yes |  |  | 20426 |
| F08 | followup | yes | 1 | yes |  | cleared | 12861 |
| F09 | followup | **no** | 0 |  |  |  | 5368 |
| C01 | compass | yes | 2 | yes |  |  | 1871 |
| C02 | compass | yes | 2 | yes |  |  | 1316 |
| C03 | compass | yes | 1 | yes |  |  | 972 |
| C04 | compass | yes | 1 | yes |  |  | 902 |
| C05 | compass | yes | 1 | yes |  |  | 1301 |
| C06 | compass | yes | 1 | yes |  |  | 8343 |
| C07 | compass | yes | 1 | yes |  | cleared | 1691 |
| R01 | feature-relative | yes | 2 | yes |  | reduced | 918 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1329 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 917 |
| R04 | feature-relative | yes | 1 | yes |  | cleared | 2952 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1723 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1800 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 2181 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1742 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 5852 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4702 |
| W05 | flow-relative | yes | 2 | yes |  | cleared | 3526 |
| W06 | flow-relative | yes | 2 | yes |  |  | 2547 |
| W07 | flow-relative | yes | 1 | yes |  |  | 2526 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2307 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1807 |
| W10 | flow-relative | yes | 2 | yes |  |  | 2230 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 10603 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1996 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 4652 |
| W15 | flow-relative | yes | 2 | yes |  |  | 4154 |
| J01 | words | yes | 1 | yes |  |  | 1452 |
| J02 | words | yes | 1 | yes |  |  | 1508 |
| J03 | words | yes | 1 | yes |  |  | 2076 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1149 |
| J05 | words | yes | 1 | yes |  |  | 1666 |
| J06 | words | yes | 1 | yes |  |  | 5504 |
| J07 | words | yes | 1 | yes |  |  | 1224 |
| J08 | words | yes | 1 | yes |  |  | 1707 |
| J09 | words | yes | 1 | yes |  |  | 1227 |
| J11 | words | yes | 2 | yes |  |  | 3705 |
| J13 | words | yes | 1 | yes |  |  | 2245 |
| M01 | compound | yes | 4 | yes |  | reduced, less-flow, start-moved, cleared, map-wide | 23921 |
| M02 | compound | yes | 1 | yes |  | cleared | 3476 |
| M03 | compound | yes | 1 | yes |  |  | 2276 |
| M04 | compound | yes | 1 | yes |  | cleared | 4578 |
| M05 | compound | yes | 1 | yes |  | reduced, cleared | 4580 |
| M06 | compound | yes | 1 | yes |  | cleared | 1819 |
| M07 | compound | yes | 1 | yes |  |  | 2376 |
| M08 | compound | **no** | 2 | yes | g2 | reduced, less-flow | 7642 |
| M09 | compound | yes | 1 | yes |  |  | 7851 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir | 23820 |
| V01 | vague | **no** | 3 | no |  |  | 4291 |
| V02 | vague | **no** | 1 | no | g1, g1 | cleared | 2331 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 9795 |
| V05 | vague | yes | 1 | yes |  | cleared | 1312 |
| V06 | vague | yes | 3 |  |  |  | 3282 |
| I01 | impossible | yes | 1 |  |  |  | 352 |
| I02 | impossible | yes | 1 |  |  |  | 350 |
| I03 | impossible | **no** | 0 |  |  |  | 5245 |
| I04 | impossible | yes | 0 |  |  |  | 357 |
| I05 | impossible | yes | 1 |  |  |  | 364 |
| I06 | impossible | yes | 1 |  |  |  | 394 |
| I07 | impossible | yes | 1 |  |  |  | 156 |
| I08 | impossible | yes | 0 |  |  |  | 365 |
| X01 | conflicting | yes | 2 | yes |  |  | 2720 |
| X02 | conflicting | yes | 1 |  |  |  | 1046 |
| X03 | conflicting | yes | 2 |  |  |  | 2170 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3871 |
| X09 | conflicting | yes | 2 |  |  |  | 3939 |
| X05 | conflicting | yes | 1 |  |  |  | 767 |
| X06 | conflicting | yes | 1 | yes |  | reduced, less-flow | 2679 |
| X07 | conflicting | yes | 1 |  |  |  | 2801 |
| X08 | conflicting | yes | 1 | yes |  | reduced, less-flow | 2460 |
| Q01 | question | yes | 1 |  |  |  | 225 |
| Q02 | question | yes | 2 |  |  |  | 716 |
| Q03 | question | yes | 1 |  |  |  | 4691 |
| Q04 | question | yes | 1 |  |  |  | 590 |
| Q05 | question | yes | 1 |  |  |  | 1341 |
| Q06 | question | **no** | 0 |  |  |  | 5216 |
| Q07 | question | yes | 1 |  |  |  | 1097 |
| Z01 | safety | yes | 1 |  |  |  | 1002 |
| Z02 | safety | yes | 1 | yes |  |  | 1548 |
| Z03 | safety | yes | 1 |  |  |  | 362 |
| Z04 | safety | yes | 1 |  |  |  | 363 |
| Z05 | safety | yes | 2 | yes |  | cleared | 1628 |
| Z06 | safety | yes | 0 |  |  |  | 659 |
| Z07 | safety | yes | 1 |  |  |  | 624 |
| N01 | simple | yes | 1 |  |  |  | 1759 |
| N02 | simple | yes | 1 |  |  |  | 592 |
| N03 | simple | yes | 1 |  |  |  | 355 |
| N04 | compass | yes | 1 |  |  |  | 492 |
| N05 | vague | yes | 0 |  |  |  | 413 |

- S01: propose was not accepted; expected accepted (step 0: each step is an object with an op); check call:1 ok true  failed (actual: false)
- S04: propose was not accepted; expected accepted (step 0: each step is an object with an op); check propose steps.0.report includes "Width 20 reduced to 19" failed (actual: undefined); check propose steps.0.report includes "reduced to 1.15" failed (actual: undefined)
- S05: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- F01: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- F02: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- F03: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- F04: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- F09: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- M08: check call:0 steps.1.errors includes "reservoir of at least 759" failed (actual: "[\"nothing here reaches the reservoir of at least 633 blocks\"]")
- V01: propose was not accepted; expected accepted (step 0: each step is an object with an op)
- V02: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks start.food); expectation g1 new:gorge wallHeight failed: the proposal made no gorge
- I03: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
- Q06: setup: setup edit "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" failed: not accepted: some steps could not be done (see steps); every site that fits here breaks a check that passes now (3 breaks start.food)
