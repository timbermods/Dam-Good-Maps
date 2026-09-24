# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 123 of 125 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5307 |
| S02 | suite | yes | 3 | yes |  | cleared | 17201 |
| S03 | suite | yes | 3 | yes |  | cleared | 2641 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1980 |
| S05 | suite | yes | 2 | yes |  |  | 3856 |
| S06 | suite | yes | 3 | yes |  |  | 3397 |
| S07 | suite | yes | 2 | yes |  |  | 2549 |
| S08 | suite | yes | 2 | yes |  |  | 1149 |
| S09 | suite | yes | 3 | yes |  |  | 2028 |
| S10 | suite | yes | 2 | yes |  | less-flow | 3144 |
| P01 | simple | yes | 2 | yes |  |  | 2820 |
| P02 | simple | yes | 1 | yes |  |  | 1326 |
| P03 | simple | yes | 1 | yes |  |  | 952 |
| P04 | simple | yes | 1 | yes |  |  | 859 |
| P05 | simple | yes | 2 | yes |  | cleared | 3032 |
| P06 | simple | yes | 2 | yes |  |  | 2647 |
| P07 | simple | yes | 2 | yes |  |  | 3364 |
| P08 | simple | yes | 2 | yes |  |  | 1133 |
| P09 | simple | yes | 2 | yes |  |  | 1002 |
| P10 | simple | yes | 1 | yes |  |  | 1690 |
| P11 | simple | yes | 1 | yes |  |  | 784 |
| P12 | simple | yes | 1 | yes |  |  | 1664 |
| P13 | simple | yes | 1 | yes |  | cleared | 1882 |
| P14 | simple | **no** | 1 | no | g1, g1 |  | 4848 |
| P15 | simple | yes | 1 | yes |  |  | 2929 |
| F01 | followup | yes | 1 | yes |  |  | 3681 |
| F02 | followup | yes | 1 | yes |  |  | 3714 |
| F03 | followup | yes | 1 | yes |  |  | 3624 |
| F04 | followup | yes | 1 | yes |  |  | 3352 |
| F05 | followup | yes | 2 | yes |  |  | 2593 |
| F06 | followup | yes | 2 | yes |  |  | 2079 |
| F07 | followup | yes | 3 | yes |  |  | 22592 |
| F08 | followup | yes | 1 | yes |  |  | 13470 |
| F09 | followup | yes | 1 | yes |  |  | 3342 |
| C01 | compass | yes | 2 | yes |  |  | 1911 |
| C02 | compass | yes | 2 | yes |  |  | 1288 |
| C03 | compass | yes | 1 | yes |  |  | 925 |
| C04 | compass | yes | 1 | yes |  |  | 917 |
| C05 | compass | yes | 1 | yes |  |  | 1254 |
| C06 | compass | yes | 1 | yes |  |  | 8585 |
| C07 | compass | yes | 1 | yes |  | cleared | 1668 |
| C08 | compass | yes | 1 | yes |  |  | 2266 |
| R01 | feature-relative | yes | 2 | yes |  |  | 945 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1344 |
| R03 | feature-relative | yes | 1 | yes |  |  | 1006 |
| R04 | feature-relative | yes | 1 | yes |  |  | 2881 |
| R05 | feature-relative | yes | 1 | yes |  |  | 739 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1670 |
| R07 | feature-relative | yes | 1 | yes |  | cleared | 1625 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1834 |
| W01 | flow-relative | yes | 2 | yes |  |  | 2117 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1662 |
| W03 | flow-relative | yes | 2 | yes |  |  | 5908 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4619 |
| W05 | flow-relative | yes | 2 | yes |  | cleared | 3293 |
| W06 | flow-relative | yes | 2 | yes |  |  | 2349 |
| W07 | flow-relative | yes | 1 | yes |  |  | 2392 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2109 |
| W09 | flow-relative | **no** | 2 | no |  |  | 4220 |
| W10 | flow-relative | yes | 2 | yes |  |  | 2186 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 10161 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1272 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 4556 |
| W14 | flow-relative | yes | 1 | yes |  |  | 1476 |
| W15 | flow-relative | yes | 2 | yes |  |  | 3987 |
| J01 | words | yes | 1 | yes |  |  | 1318 |
| J02 | words | yes | 1 | yes |  |  | 1478 |
| J03 | words | yes | 1 | yes |  |  | 2108 |
| J04 | words | yes | 1 | yes |  | less-flow | 1140 |
| J05 | words | yes | 1 | yes |  |  | 1600 |
| J06 | words | yes | 1 | yes |  |  | 5233 |
| J07 | words | yes | 1 | yes |  |  | 1212 |
| J08 | words | yes | 1 | yes |  |  | 1594 |
| J09 | words | yes | 1 | yes |  |  | 1205 |
| J10 | words | yes | 2 | yes |  |  | 2023 |
| J11 | words | yes | 2 | yes |  |  | 3795 |
| J12 | words | yes | 1 | yes |  |  | 1276 |
| J13 | words | yes | 1 | yes |  |  | 2355 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 23493 |
| M02 | compound | yes | 1 | yes |  | cleared | 3270 |
| M03 | compound | yes | 1 | yes |  |  | 2002 |
| M04 | compound | yes | 1 | yes |  |  | 4305 |
| M05 | compound | yes | 1 | yes |  |  | 4215 |
| M06 | compound | yes | 1 | yes |  | cleared | 1719 |
| M07 | compound | yes | 1 | yes |  |  | 2198 |
| M08 | compound | yes | 2 | yes | g2 | less-flow | 7430 |
| M09 | compound | yes | 1 | yes |  |  | 7762 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 23658 |
| V01 | vague | yes | 3 | yes |  | cleared | 4942 |
| V02 | vague | yes | 1 | yes |  | cleared | 2302 |
| V03 | vague | yes | 1 | yes |  | cleared | 2775 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 10030 |
| V05 | vague | yes | 1 | yes |  | cleared | 1293 |
| V06 | vague | yes | 3 |  |  |  | 2705 |
| I01 | impossible | yes | 1 |  |  |  | 364 |
| I02 | impossible | yes | 1 |  |  |  | 369 |
| I03 | impossible | yes | 1 |  |  |  | 2822 |
| I04 | impossible | yes | 0 |  |  |  | 380 |
| I05 | impossible | yes | 1 |  |  |  | 393 |
| I06 | impossible | yes | 1 |  |  |  | 363 |
| I07 | impossible | yes | 1 |  |  |  | 162 |
| I08 | impossible | yes | 0 |  |  |  | 368 |
| X01 | conflicting | yes | 2 | yes |  |  | 2561 |
| X02 | conflicting | yes | 1 |  |  |  | 923 |
| X03 | conflicting | yes | 2 |  |  |  | 2062 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3778 |
| X09 | conflicting | yes | 2 |  |  |  | 4617 |
| X05 | conflicting | yes | 1 |  |  |  | 804 |
| X06 | conflicting | yes | 1 | yes |  | less-flow | 2721 |
| X07 | conflicting | yes | 1 |  |  |  | 2732 |
| X08 | conflicting | yes | 1 | yes |  | less-flow | 2500 |
| Q01 | question | yes | 1 |  |  |  | 212 |
| Q02 | question | yes | 2 |  |  |  | 671 |
| Q03 | question | yes | 1 |  |  |  | 4526 |
| Q04 | question | yes | 1 |  |  |  | 611 |
| Q05 | question | yes | 1 |  |  |  | 1293 |
| Q06 | question | yes | 2 |  |  |  | 2817 |
| Q07 | question | yes | 1 |  |  |  | 1099 |
| Z01 | safety | yes | 1 |  |  |  | 974 |
| Z02 | safety | yes | 1 | yes |  |  | 1531 |
| Z03 | safety | yes | 1 |  |  |  | 370 |
| Z04 | safety | yes | 1 |  |  |  | 383 |
| Z05 | safety | yes | 2 | yes |  |  | 1644 |
| Z06 | safety | yes | 0 |  |  |  | 742 |
| Z07 | safety | yes | 1 |  |  |  | 595 |

- P14: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (2 breaks start.badwater); expectation g1 new:badwaterBasin distanceToStart failed: the proposal made no badwaterBasin
- W09: propose was not accepted; expected accepted (step 0: moveFeature needs by or to)
