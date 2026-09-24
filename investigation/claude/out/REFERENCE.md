# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 120 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5669 |
| S02 | suite | yes | 3 | yes |  | cleared | 17452 |
| S03 | suite | yes | 3 | yes |  | reduced, cleared | 2550 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 2073 |
| S05 | suite | yes | 2 | yes |  |  | 2871 |
| S06 | suite | yes | 3 | yes |  | cleared | 3424 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 2716 |
| S08 | suite | yes | 2 | yes |  |  | 952 |
| S09 | suite | yes | 3 | yes |  |  | 2469 |
| S10 | suite | yes | 2 | yes |  | start-moved, reduced, less-flow | 3033 |
| P01 | simple | yes | 2 | yes |  | cleared | 2829 |
| P02 | simple | yes | 1 | yes |  |  | 1319 |
| P03 | simple | yes | 1 | yes |  |  | 968 |
| P04 | simple | yes | 1 | yes |  |  | 756 |
| P05 | simple | yes | 2 | yes |  | cleared | 2963 |
| P06 | simple | yes | 2 | yes |  |  | 1795 |
| P07 | simple | yes | 2 | yes |  |  | 3258 |
| P08 | simple | yes | 2 | yes |  |  | 1091 |
| P09 | simple | yes | 2 | yes |  |  | 940 |
| P10 | simple | yes | 1 | yes |  |  | 1726 |
| P12 | simple | yes | 1 | yes |  |  | 1701 |
| P14 | simple | yes | 1 | yes |  | cleared | 1836 |
| F01 | followup | yes | 1 | yes |  |  | 2807 |
| F02 | followup | yes | 1 | yes |  |  | 2901 |
| F03 | followup | yes | 1 | yes |  |  | 2698 |
| F04 | followup | yes | 1 | yes |  |  | 2421 |
| F05 | followup | yes | 2 | yes |  | cleared | 2479 |
| F06 | followup | yes | 2 | yes |  |  | 2103 |
| F07 | followup | yes | 3 | yes |  |  | 20137 |
| F08 | followup | yes | 1 | yes |  | cleared | 13024 |
| F09 | followup | yes | 1 | yes |  |  | 2570 |
| C01 | compass | yes | 2 | yes |  |  | 1828 |
| C02 | compass | yes | 2 | yes |  |  | 1314 |
| C03 | compass | yes | 1 | yes |  |  | 965 |
| C04 | compass | yes | 1 | yes |  |  | 888 |
| C05 | compass | yes | 1 | yes |  |  | 1251 |
| C06 | compass | yes | 1 | yes |  |  | 8373 |
| C07 | compass | yes | 1 | yes |  | cleared | 1711 |
| R01 | feature-relative | yes | 2 | yes |  | reduced | 972 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1297 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 908 |
| R04 | feature-relative | yes | 1 | yes |  | cleared | 2833 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1720 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1881 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 2245 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1656 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 6055 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4776 |
| W05 | flow-relative | yes | 2 | yes |  | cleared | 3482 |
| W06 | flow-relative | yes | 2 | yes |  |  | 2463 |
| W07 | flow-relative | yes | 1 | yes |  |  | 2389 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2268 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1823 |
| W10 | flow-relative | yes | 2 | yes |  |  | 2127 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 9893 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1802 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 4616 |
| W15 | flow-relative | yes | 2 | yes |  |  | 3831 |
| J01 | words | yes | 1 | yes |  |  | 1361 |
| J02 | words | yes | 1 | yes |  |  | 1435 |
| J03 | words | yes | 1 | yes |  |  | 2040 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1138 |
| J05 | words | yes | 1 | yes |  | start-moved | 1612 |
| J06 | words | yes | 1 | yes |  | start-moved | 5309 |
| J07 | words | yes | 1 | yes |  |  | 1294 |
| J08 | words | yes | 1 | yes |  | start-moved | 1598 |
| J09 | words | yes | 1 | yes |  |  | 1199 |
| J11 | words | yes | 2 | yes |  |  | 3784 |
| J13 | words | yes | 1 | yes |  |  | 2355 |
| M01 | compound | yes | 4 | yes |  | reduced, less-flow, start-moved, cleared, map-wide | 23898 |
| M02 | compound | yes | 1 | yes |  | cleared | 3142 |
| M03 | compound | yes | 1 | yes |  |  | 2035 |
| M04 | compound | yes | 1 | yes |  | cleared | 4337 |
| M05 | compound | yes | 1 | yes |  | reduced, cleared | 4121 |
| M06 | compound | yes | 1 | yes |  | cleared | 1692 |
| M07 | compound | yes | 1 | yes |  |  | 2295 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, reduced, less-flow | 7264 |
| M09 | compound | yes | 1 | yes |  |  | 7686 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir | 23536 |
| V01 | vague | yes | 3 | yes |  | cleared | 7292 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2387 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 9633 |
| V05 | vague | yes | 1 | yes |  | cleared | 1305 |
| V06 | vague | yes | 3 |  |  |  | 2712 |
| I01 | impossible | yes | 1 |  |  |  | 368 |
| I02 | impossible | yes | 1 |  |  |  | 356 |
| I03 | impossible | yes | 1 |  |  |  | 2019 |
| I04 | impossible | yes | 0 |  |  |  | 361 |
| I05 | impossible | yes | 1 |  |  |  | 356 |
| I06 | impossible | yes | 1 |  |  |  | 386 |
| I07 | impossible | yes | 1 |  |  |  | 153 |
| I08 | impossible | yes | 0 |  |  |  | 349 |
| X01 | conflicting | yes | 2 | yes |  |  | 2600 |
| X02 | conflicting | yes | 1 |  |  |  | 993 |
| X03 | conflicting | yes | 2 |  |  |  | 2024 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3877 |
| X09 | conflicting | yes | 2 |  |  |  | 3982 |
| X05 | conflicting | yes | 1 |  |  |  | 758 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, reduced, less-flow | 2703 |
| X07 | conflicting | yes | 1 |  |  |  | 2740 |
| X08 | conflicting | yes | 1 | yes |  | reduced, less-flow | 2618 |
| Q01 | question | yes | 1 |  |  |  | 216 |
| Q02 | question | yes | 2 |  |  |  | 602 |
| Q03 | question | yes | 1 |  |  |  | 4950 |
| Q04 | question | yes | 1 |  |  |  | 645 |
| Q05 | question | yes | 1 |  |  |  | 1297 |
| Q06 | question | yes | 2 |  |  |  | 1978 |
| Q07 | question | yes | 1 |  |  |  | 1142 |
| Z01 | safety | yes | 1 |  |  |  | 983 |
| Z02 | safety | yes | 1 | yes |  |  | 1570 |
| Z03 | safety | yes | 1 |  |  |  | 373 |
| Z04 | safety | yes | 1 |  |  |  | 372 |
| Z05 | safety | yes | 2 | yes |  | cleared | 1666 |
| Z06 | safety | yes | 0 |  |  |  | 696 |
| Z07 | safety | yes | 1 |  |  |  | 683 |
| N01 | simple | yes | 1 |  |  |  | 1750 |
| N02 | simple | yes | 1 |  |  |  | 518 |
| N03 | simple | yes | 1 |  |  |  | 405 |
| N04 | compass | yes | 1 |  |  |  | 524 |
| N05 | vague | yes | 0 |  |  |  | 390 |

