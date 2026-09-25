# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 120 of 120 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5527 |
| S02 | suite | yes | 3 | yes |  | cleared | 17116 |
| S03 | suite | yes | 3 | yes |  | reduced, cleared | 2554 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 2185 |
| S05 | suite | yes | 2 | yes |  |  | 2967 |
| S06 | suite | yes | 3 | yes |  | cleared | 3357 |
| S07 | suite | yes | 2 | yes |  | reduced, cleared | 2601 |
| S08 | suite | yes | 2 | yes |  |  | 952 |
| S09 | suite | yes | 3 | yes |  |  | 2582 |
| S10 | suite | yes | 2 | yes |  | start-moved, reduced, less-flow | 3021 |
| P01 | simple | yes | 2 | yes |  | cleared | 2986 |
| P02 | simple | yes | 1 | yes |  |  | 1331 |
| P03 | simple | yes | 1 | yes |  |  | 1005 |
| P04 | simple | yes | 1 | yes |  |  | 782 |
| P05 | simple | yes | 2 | yes |  | cleared | 2987 |
| P06 | simple | yes | 2 | yes |  |  | 1801 |
| P07 | simple | yes | 2 | yes |  |  | 3393 |
| P08 | simple | yes | 2 | yes |  |  | 1134 |
| P09 | simple | yes | 2 | yes |  |  | 864 |
| P10 | simple | yes | 1 | yes |  |  | 1728 |
| P12 | simple | yes | 1 | yes |  |  | 1691 |
| P14 | simple | yes | 1 | yes |  | cleared | 1837 |
| F01 | followup | yes | 1 | yes |  |  | 2818 |
| F02 | followup | yes | 1 | yes |  |  | 2817 |
| F03 | followup | yes | 1 | yes |  |  | 2715 |
| F04 | followup | yes | 1 | yes |  |  | 2380 |
| F05 | followup | yes | 2 | yes |  | cleared | 2458 |
| F06 | followup | yes | 2 | yes |  |  | 2183 |
| F07 | followup | yes | 3 | yes |  |  | 19824 |
| F08 | followup | yes | 1 | yes |  | cleared | 12976 |
| F09 | followup | yes | 1 | yes |  |  | 2592 |
| C01 | compass | yes | 2 | yes |  |  | 1980 |
| C02 | compass | yes | 2 | yes |  |  | 1291 |
| C03 | compass | yes | 1 | yes |  |  | 982 |
| C04 | compass | yes | 1 | yes |  |  | 1043 |
| C05 | compass | yes | 1 | yes |  |  | 1304 |
| C06 | compass | yes | 1 | yes |  |  | 8724 |
| C07 | compass | yes | 1 | yes |  | cleared | 1784 |
| R01 | feature-relative | yes | 2 | yes |  | reduced | 988 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1371 |
| R03 | feature-relative | yes | 1 | yes |  | reduced | 983 |
| R04 | feature-relative | yes | 1 | yes |  | cleared | 2960 |
| R06 | feature-relative | yes | 1 | yes |  |  | 1824 |
| R08 | feature-relative | yes | 2 | yes |  |  | 1886 |
| W01 | flow-relative | yes | 2 | yes |  | reduced, cleared | 2249 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1710 |
| W03 | flow-relative | yes | 2 | yes |  | reduced | 5885 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4928 |
| W05 | flow-relative | yes | 2 | yes |  | cleared | 3338 |
| W06 | flow-relative | yes | 2 | yes |  |  | 2396 |
| W07 | flow-relative | yes | 1 | yes |  |  | 2361 |
| W08 | flow-relative | yes | 2 | yes |  |  | 2210 |
| W09 | flow-relative | yes | 2 | yes |  |  | 1845 |
| W10 | flow-relative | yes | 2 | yes |  |  | 2176 |
| W11 | flow-relative | yes | 1 | yes |  | cleared | 10227 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1808 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 4550 |
| W15 | flow-relative | yes | 2 | yes |  |  | 3751 |
| J01 | words | yes | 1 | yes |  |  | 1301 |
| J02 | words | yes | 1 | yes |  |  | 1412 |
| J03 | words | yes | 1 | yes |  |  | 2047 |
| J04 | words | yes | 1 | yes |  | reduced, less-flow | 1106 |
| J05 | words | yes | 1 | yes |  | start-moved | 1595 |
| J06 | words | yes | 1 | yes |  | start-moved | 5257 |
| J07 | words | yes | 1 | yes |  |  | 1197 |
| J08 | words | yes | 1 | yes |  | start-moved | 1574 |
| J09 | words | yes | 1 | yes |  |  | 1237 |
| J11 | words | yes | 2 | yes |  |  | 3707 |
| J13 | words | yes | 1 | yes |  |  | 2221 |
| M01 | compound | yes | 4 | yes |  | reduced, less-flow, start-moved, cleared, map-wide | 23829 |
| M02 | compound | yes | 1 | yes |  | cleared | 3260 |
| M03 | compound | yes | 1 | yes |  |  | 2069 |
| M04 | compound | yes | 1 | yes |  | cleared | 4350 |
| M05 | compound | yes | 1 | yes |  | reduced, cleared | 4200 |
| M06 | compound | yes | 1 | yes |  | cleared | 1779 |
| M07 | compound | yes | 1 | yes |  |  | 2346 |
| M08 | compound | yes | 2 | yes | g2 | start-moved, reduced, less-flow | 7816 |
| M09 | compound | yes | 1 | yes |  |  | 7790 |
| M10 | compound | yes | 1 | yes |  | badwater-poisons-reservoir | 23988 |
| V01 | vague | yes | 3 | yes |  | cleared | 7107 |
| V02 | vague | yes | 1 | yes |  | reduced, cleared | 2235 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 9924 |
| V05 | vague | yes | 1 | yes |  | cleared | 1296 |
| V06 | vague | yes | 3 |  |  |  | 2765 |
| I01 | impossible | yes | 1 |  |  |  | 395 |
| I02 | impossible | yes | 1 |  |  |  | 396 |
| I03 | impossible | yes | 1 |  |  |  | 1977 |
| I04 | impossible | yes | 0 |  |  |  | 429 |
| I05 | impossible | yes | 1 |  |  |  | 376 |
| I06 | impossible | yes | 1 |  |  |  | 359 |
| I07 | impossible | yes | 1 |  |  |  | 159 |
| I08 | impossible | yes | 0 |  |  |  | 390 |
| X01 | conflicting | yes | 2 | yes |  |  | 2659 |
| X02 | conflicting | yes | 1 |  |  |  | 907 |
| X03 | conflicting | yes | 2 |  |  |  | 1995 |
| X04 | conflicting | yes | 1 | yes |  | badwater-poisons-reservoir, cleared | 3916 |
| X09 | conflicting | yes | 2 |  |  |  | 4042 |
| X05 | conflicting | yes | 1 |  |  |  | 811 |
| X06 | conflicting | yes | 1 | yes |  | start-moved, reduced, less-flow | 2822 |
| X07 | conflicting | yes | 1 |  |  |  | 2781 |
| X08 | conflicting | yes | 1 | yes |  | reduced, less-flow | 2529 |
| Q01 | question | yes | 1 |  |  |  | 226 |
| Q02 | question | yes | 2 |  |  |  | 658 |
| Q03 | question | yes | 1 |  |  |  | 4634 |
| Q04 | question | yes | 1 |  |  |  | 682 |
| Q05 | question | yes | 1 |  |  |  | 1283 |
| Q06 | question | yes | 2 |  |  |  | 2060 |
| Q07 | question | yes | 1 |  |  |  | 1108 |
| Z01 | safety | yes | 1 |  |  |  | 962 |
| Z02 | safety | yes | 1 | yes |  |  | 1525 |
| Z03 | safety | yes | 1 |  |  |  | 397 |
| Z04 | safety | yes | 1 |  |  |  | 384 |
| Z05 | safety | yes | 2 | yes |  | cleared | 1567 |
| Z06 | safety | yes | 0 |  |  |  | 668 |
| Z07 | safety | yes | 1 |  |  |  | 614 |
| N01 | simple | yes | 1 |  |  |  | 1748 |
| N02 | simple | yes | 1 |  |  |  | 522 |
| N03 | simple | yes | 1 |  |  |  | 359 |
| N04 | compass | yes | 1 |  |  |  | 551 |
| N05 | vague | yes | 0 |  |  |  | 405 |

