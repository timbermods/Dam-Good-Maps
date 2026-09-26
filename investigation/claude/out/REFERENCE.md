# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 119 of 131 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 4600 |
| S02 | suite | yes | 3 | yes |  | cleared | 16369 |
| S03 | suite | yes | 3 | yes |  | cleared | 2986 |
| S04 | suite | **no** | 3 | no |  |  | 679 |
| S05 | suite | yes | 2 | yes |  | reduced | 2458 |
| S06 | suite | yes | 3 | yes |  | cleared, start-moved | 4860 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 2296 |
| S08 | suite | yes | 2 | yes |  |  | 607 |
| S09 | suite | yes | 3 | yes |  |  | 1656 |
| S10 | suite | yes | 2 | yes |  | start-moved, less-flow | 4410 |
| P01 | simple | yes | 2 | yes |  |  | 8583 |
| P02 | simple | yes | 1 | yes | g1 | reduced | 2450 |
| P03 | simple | yes | 1 | yes |  |  | 713 |
| P04 | simple | yes | 1 | yes |  |  | 889 |
| P05 | simple | yes | 2 | yes |  | cleared | 1688 |
| P06 | simple | yes | 2 | yes |  |  | 1151 |
| P07 | simple | yes | 2 | yes |  |  | 1990 |
| P08 | simple | yes | 2 | yes | g1 |  | 2243 |
| P09 | simple | yes | 2 | yes |  |  | 1322 |
| P10 | simple | yes | 1 | yes | g1 |  | 1624 |
| P12 | simple | yes | 1 | yes | g1 |  | 933 |
| P14 | simple | yes | 1 | yes |  | cleared | 884 |
| F01 | followup | yes | 1 | yes |  |  | 1657 |
| F02 | followup | yes | 1 | yes |  |  | 1669 |
| F03 | followup | yes | 1 | yes |  |  | 1374 |
| F04 | followup | yes | 1 | yes |  |  | 1281 |
| F05 | followup | yes | 2 | yes |  |  | 2114 |
| F06 | followup | yes | 2 | yes |  |  | 1935 |
| F07 | followup | yes | 3 | yes |  |  | 10683 |
| F08 | followup | yes | 1 | yes |  | reduced, cleared | 8073 |
| F09 | followup | yes | 1 | yes |  |  | 1237 |
| C01 | compass | yes | 2 | yes |  |  | 1062 |
| C02 | compass | yes | 2 | yes | g1 |  | 1368 |
| C03 | compass | yes | 1 | yes |  |  | 440 |
| C04 | compass | yes | 1 | yes |  |  | 418 |
| C05 | compass | yes | 1 | yes | g1 |  | 1013 |
| C06 | compass | yes | 1 | yes |  |  | 3881 |
| C07 | compass | yes | 1 | yes |  | cleared | 822 |
| R01 | feature-relative | yes | 2 | yes |  |  | 417 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1259 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 435 |
| R04 | feature-relative | yes | 2 | yes |  |  | 3597 |
| R06 | feature-relative | yes | 1 | yes | g1 |  | 1048 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1553 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 1431 |
| W02 | flow-relative | yes | 1 | yes |  |  | 847 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 7543 |
| W04 | flow-relative | yes | 2 | yes |  |  | 25183 |
| W05 | flow-relative | **no** | 0 |  |  |  | 937 |
| W06 | flow-relative | **no** | 0 |  |  |  | 1567 |
| W07 | flow-relative | **no** | 0 |  |  |  | 1519 |
| W08 | flow-relative | yes | 2 | yes |  |  | 1760 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1723 |
| W10 | flow-relative | yes | 2 | yes |  |  | 5297 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 4116 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1026 |
| W13 | flow-relative | yes | 2 | yes |  |  | 2804 |
| W15 | flow-relative | yes | 2 | yes |  |  | 1860 |
| J01 | words | yes | 1 | yes |  |  | 1233 |
| J02 | words | yes | 1 | yes |  |  | 850 |
| J03 | words | **no** | 1 | yes | g1 |  | 1252 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 938 |
| J05 | words | yes | 1 | yes |  | start-moved | 1134 |
| J06 | words | yes | 1 | yes |  | start-moved | 2259 |
| J07 | words | yes | 1 | yes |  |  | 1715 |
| J08 | words | yes | 1 | yes |  | start-moved | 1239 |
| J09 | words | yes | 1 | yes |  |  | 1679 |
| J11 | words | yes | 2 | yes |  |  | 5106 |
| J13 | words | yes | 1 | yes |  |  | 1456 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 18276 |
| M02 | compound | yes | 2 | yes |  | cleared | 4309 |
| M03 | compound | yes | 1 | yes |  |  | 1053 |
| M04 | compound | **no** | 1 | no | g1, g1 | reduced, cleared | 5693 |
| M05 | compound | yes | 1 | yes |  |  | 1698 |
| M06 | compound | **no** | 1 | yes | g2 | cleared | 1160 |
| M07 | compound | yes | 1 | yes |  |  | 1492 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, less-flow | 5336 |
| M09 | compound | yes | 1 | yes |  |  | 3387 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 31994 |
| V01 | vague | yes | 3 | yes |  | cleared | 1843 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2097 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 4166 |
| V05 | vague | yes | 1 | yes |  | cleared | 1141 |
| V06 | vague | yes | 3 |  |  |  | 1667 |
| I01 | impossible | yes | 1 |  |  |  | 120 |
| I02 | impossible | yes | 1 |  |  |  | 347 |
| I03 | impossible | yes | 1 |  |  |  | 913 |
| I04 | impossible | yes | 0 |  |  |  | 352 |
| I05 | impossible | yes | 1 |  |  |  | 341 |
| I06 | impossible | yes | 1 |  |  |  | 349 |
| I07 | impossible | **no** | 1 |  |  |  | 389 |
| I08 | impossible | yes | 0 |  |  |  | 341 |
| X01 | conflicting | **no** | 2 | yes | g1 | cleared | 737 |
| X02 | conflicting | yes | 1 |  |  |  | 382 |
| X03 | conflicting | yes | 2 |  |  |  | 7834 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 2255 |
| X09 | conflicting | **no** | 2 |  |  |  | 1745 |
| X05 | conflicting | yes | 1 |  |  |  | 341 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, less-flow | 2028 |
| X07 | conflicting | yes | 1 |  |  |  | 2666 |
| X08 | conflicting | **no** | 1 | no | g1, g1 | less-flow | 2139 |
| Q01 | question | **no** | 1 |  |  |  | 139 |
| Q02 | question | yes | 2 |  |  |  | 289 |
| Q03 | question | yes | 1 |  |  |  | 1506 |
| Q04 | question | yes | 1 |  |  |  | 296 |
| Q05 | question | yes | 1 |  |  |  | 580 |
| Q06 | question | yes | 2 |  |  |  | 919 |
| Q07 | question | yes | 1 |  |  |  | 740 |
| Z01 | safety | yes | 1 |  |  |  | 983 |
| Z02 | safety | yes | 1 | yes |  |  | 1814 |
| Z03 | safety | yes | 1 |  |  |  | 357 |
| Z04 | safety | yes | 1 |  |  |  | 353 |
| Z05 | safety | yes | 3 | yes |  |  | 4465 |
| Z06 | safety | yes | 0 |  |  |  | 661 |
| Z07 | safety | yes | 1 |  |  |  | 441 |
| N01 | simple | yes | 1 |  |  |  | 711 |
| N02 | simple | yes | 1 |  |  |  | 229 |
| N03 | simple | yes | 1 |  |  |  | 364 |
| N04 | compass | yes | 1 |  |  |  | 219 |
| N05 | vague | yes | 0 |  |  |  | 341 |
| B01 | simple | yes | 2 | yes | g1 | reduced, cleared | 1012 |
| B07 | conflicting | yes | 1 |  |  |  | 941 |
| B02 | simple | yes | 2 | yes | g1 |  | 1385 |
| B03 | simple | yes | 2 | yes | g1 |  | 1097 |
| B04 | impossible | yes | 1 |  |  |  | 431 |
| B05 | simple | yes | 2 | yes | g1 |  | 1515 |
| B06 | simple | yes | 1 | yes | g1 |  | 1290 |
| B08 | compound | yes | 2 | yes | g1 |  | 1513 |
| B09 | simple | yes | 2 | yes | g1 |  | 711 |
| B10 | simple | yes | 2 | yes | g1 |  | 984 |
| B11 | simple | yes | 2 | yes | g1 |  | 859 |

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
