# Reference solutions: results

Every request's reference solution, run through MapSession with the real validators by `bin/reference.ts`. 101 of 124 pass.

| Id | Kind | Pass | Tool calls | Accepted | Unmet goals | Trade-offs | ms |
|---|---|---|---|---|---|---|---|
| S01 | suite | yes | 3 | yes |  | cleared | 5153 |
| S02 | suite | yes | 3 | yes |  | cleared | 17129 |
| S03 | suite | yes | 3 | yes |  | cleared | 2496 |
| S04 | suite | yes | 3 | yes |  | reduced, cleared | 1977 |
| S05 | suite | yes | 2 | yes |  |  | 3873 |
| S06 | suite | yes | 3 | yes |  |  | 3323 |
| S07 | suite | yes | 2 | yes |  |  | 2551 |
| S08 | suite | yes | 2 | yes |  |  | 1020 |
| S09 | suite | yes | 3 | yes |  |  | 2503 |
| S10 | suite | yes | 2 | yes |  | less-flow | 3139 |
| P01 | simple | yes | 2 | yes |  |  | 2585 |
| P02 | simple | yes | 1 | yes |  |  | 1255 |
| P03 | simple | yes | 1 | yes |  |  | 874 |
| P04 | simple | yes | 1 | yes |  |  | 739 |
| P05 | simple | yes | 2 | yes |  | cleared | 2961 |
| P06 | simple | yes | 2 | yes |  |  | 2493 |
| P07 | simple | yes | 2 | yes |  |  | 4042 |
| P08 | simple | yes | 2 | yes |  |  | 1141 |
| P09 | simple | yes | 2 | yes |  |  | 896 |
| P10 | simple | yes | 1 | yes |  |  | 1769 |
| P11 | simple | yes | 1 | yes |  |  | 721 |
| P12 | simple | yes | 1 | yes |  |  | 1804 |
| P13 | simple | yes | 1 | yes |  | cleared | 1826 |
| P14 | simple | yes | 1 | yes |  | cleared | 1874 |
| P15 | simple | yes | 1 | yes |  |  | 2971 |
| F01 | followup | yes | 1 | yes |  |  | 3716 |
| F02 | followup | yes | 1 | yes |  |  | 3847 |
| F03 | followup | **no** | 1 | yes | g1 |  | 3731 |
| F04 | followup | **no** | 1 | yes | g1 |  | 3260 |
| F05 | followup | yes | 2 | yes |  |  | 2562 |
| F06 | followup | yes | 2 | yes |  |  | 2039 |
| F07 | followup | yes | 3 | yes |  |  | 12251 |
| F08 | followup | yes | 1 | yes |  |  | 8604 |
| F09 | followup | yes | 1 | yes |  |  | 3396 |
| C01 | compass | yes | 2 | yes |  |  | 1751 |
| C02 | compass | yes | 2 | yes |  |  | 1308 |
| C03 | compass | yes | 1 | yes |  |  | 908 |
| C04 | compass | yes | 1 | yes |  |  | 877 |
| C05 | compass | yes | 1 | yes |  |  | 1286 |
| C06 | compass | yes | 1 | yes |  |  | 8238 |
| C07 | compass | yes | 1 | yes |  | cleared | 1619 |
| C08 | compass | yes | 1 | yes |  |  | 1812 |
| R01 | feature-relative | yes | 2 | yes |  |  | 904 |
| R02 | feature-relative | yes | 1 | yes |  | cleared | 1394 |
| R03 | feature-relative | yes | 1 | yes |  |  | 978 |
| R04 | feature-relative | **no** | 1 | no | g1, g1 |  | 1541 |
| R05 | feature-relative | yes | 1 | yes |  |  | 700 |
| R06 | feature-relative | **no** | 1 | no | g1, g1 |  | 1288 |
| R07 | feature-relative | yes | 1 | yes |  | cleared | 1810 |
| R08 | feature-relative | **no** | 2 | no | g1, g1 |  | 868 |
| W01 | flow-relative | **no** | 2 | no | g1, g1 |  | 5243 |
| W02 | flow-relative | yes | 1 | yes |  |  | 1607 |
| W03 | flow-relative | yes | 2 | yes |  |  | 5696 |
| W04 | flow-relative | yes | 1 | yes |  |  | 4987 |
| W05 | flow-relative | yes | 2 | yes |  | cleared | 3333 |
| W06 | flow-relative | yes | 2 | yes |  |  | 2381 |
| W07 | flow-relative | yes | 1 | yes |  |  | 2265 |
| W08 | flow-relative | **no** | 2 | no | g1, g1 |  | 1101 |
| W09 | flow-relative | yes | 2 | yes |  |  | 2547 |
| W10 | flow-relative | yes | 2 | yes |  |  | 2074 |
| W11 | flow-relative | **no** | 0 |  |  |  | 2424 |
| W12 | flow-relative | yes | 1 | yes |  |  | 1241 |
| W13 | flow-relative | yes | 2 | yes |  | badwater-poisons-reservoir | 4555 |
| W14 | flow-relative | yes | 1 | yes |  |  | 1698 |
| W15 | flow-relative | **no** | 2 | no | g1, g1 |  | 3224 |
| J01 | words | yes | 1 | yes |  |  | 1377 |
| J02 | words | yes | 1 | yes |  |  | 1444 |
| J03 | words | **no** | 1 | yes | g1 |  | 2008 |
| J04 | words | yes | 1 | yes |  | less-flow | 1097 |
| J05 | words | yes | 1 | yes |  |  | 1577 |
| J06 | words | **no** | 0 |  |  |  | 85 |
| J07 | words | yes | 1 | yes |  |  | 1218 |
| J08 | words | yes | 1 | yes |  |  | 1627 |
| J09 | words | yes | 1 | yes |  |  | 1223 |
| J10 | words | yes | 2 | yes |  |  | 1826 |
| J11 | words | **no** | 2 | no | g1, g1 |  | 4833 |
| J12 | words | yes | 1 | yes |  |  | 1288 |
| J13 | words | **no** | 1 | yes | g1 |  | 2248 |
| M01 | compound | yes | 4 | yes |  | less-flow, start-moved, cleared, map-wide | 15245 |
| M02 | compound | yes | 1 | yes |  | cleared | 3226 |
| M03 | compound | yes | 1 | yes |  |  | 2013 |
| M04 | compound | **no** | 1 | no | g1, g2, g1, g1 |  | 5279 |
| M05 | compound | yes | 1 | yes |  |  | 4111 |
| M06 | compound | yes | 1 | yes |  | cleared | 1588 |
| M07 | compound | yes | 1 | yes |  |  | 2188 |
| M08 | compound | **no** | 1 | no | g2, g2 | less-flow | 4638 |
| M09 | compound | **no** | 1 | no | g1, g1 |  | 19577 |
| M10 | compound | **no** | 1 | no | g2, g2 | cleared | 72459 |
| V01 | vague | yes | 3 | yes |  | cleared | 5016 |
| V02 | vague | yes | 1 | yes |  | cleared | 2443 |
| V03 | vague | yes | 1 | yes |  | cleared | 2808 |
| V04 | vague | yes | 2 | yes |  | reduced, cleared | 10099 |
| V05 | vague | yes | 1 | yes |  | cleared | 1282 |
| V06 | vague | yes | 3 |  |  |  | 2535 |
| I01 | impossible | yes | 1 |  |  |  | 342 |
| I02 | impossible | yes | 1 |  |  |  | 401 |
| I03 | impossible | yes | 1 |  |  |  | 2818 |
| I04 | impossible | yes | 0 |  |  |  | 410 |
| I05 | impossible | yes | 1 |  |  |  | 361 |
| I06 | impossible | yes | 1 |  |  |  | 358 |
| I07 | impossible | **no** | 1 |  |  |  | 152 |
| I08 | impossible | yes | 0 |  |  |  | 421 |
| X01 | conflicting | **no** | 1 |  |  |  | 2893 |
| X02 | conflicting | yes | 1 |  |  |  | 963 |
| X03 | conflicting | **no** | 2 |  |  |  | 1119 |
| X04 | conflicting | **no** | 1 | yes | g1, g2 | cleared | 1684 |
| X05 | conflicting | **no** | 1 |  |  |  | 920 |
| X06 | conflicting | yes | 1 | yes |  | less-flow | 2788 |
| X07 | conflicting | yes | 1 |  |  |  | 2524 |
| X08 | conflicting | yes | 1 | yes |  | less-flow | 2513 |
| Q01 | question | yes | 1 |  |  |  | 220 |
| Q02 | question | yes | 2 |  |  |  | 606 |
| Q03 | question | yes | 1 |  |  |  | 3049 |
| Q04 | question | yes | 1 |  |  |  | 688 |
| Q05 | question | yes | 1 |  |  |  | 1329 |
| Q06 | question | yes | 2 |  |  |  | 2891 |
| Q07 | question | yes | 1 |  |  |  | 1169 |
| Z01 | safety | yes | 1 |  |  |  | 1020 |
| Z02 | safety | **no** | 1 | no | g1, g1 |  | 1113 |
| Z03 | safety | yes | 1 |  |  |  | 401 |
| Z04 | safety | yes | 1 |  |  |  | 385 |
| Z05 | safety | yes | 2 | yes |  |  | 1885 |
| Z06 | safety | yes | 0 |  |  |  | 672 |
| Z07 | safety | yes | 1 |  |  |  | 609 |

- F03: expectation g1 map waterfalls failed: it went from 2 to 2, not down
- F04: expectation g1 map waterfalls failed: it went from 2 to 2, not down
- R04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: no lake fits in this place (409 tiles searched at 0 spots); expectation g1 new:lake distanceToStart failed: the proposal made no lake
- R06: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every spot here would bury water: rivers and lakes are in the way; expectation g1 new:hill distanceTo:lake failed: the proposal made no hill
- R08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: it would cover the start's area: place it farther from the start; expectation g1 new:damSite at failed: the proposal made no damSite
- W01: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (3 breaks start.food); expectation g1 new:damSite course.frac failed: the proposal made no damSite
- W08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: no dam across the river here holds water (it reaches a map edge or walks round the dam); expectation g1 new:damSite course.frac failed: the proposal made no damSite
- W11: setup: the project file is damaged: /4/params/outline/15/0 must be >= -1
- W15: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks start.reach, start.food; 1 breaks start.reach); expectation g1 new:waterfall course.frac failed: the proposal made no waterfall
- J03: expectation g1 map badwaterDistance failed: it went from 31 to 31, not down
- J06: setup: the project file is damaged: /4/params/outline/15/0 must be >= -1
- J11: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (1 breaks start.water); expectation g1 new:lake area failed: the proposal made no lake; expectation g1 new:lake at failed: the proposal made no lake
- J13: expectation g1 map basins20 failed: it went from 3 to 3, not up
- M04: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: no spot here meets the start rules (262 spots: 197 too far from pumpable clean water (16 tiles), 0 with too few trees (50), 0 with too few berry bushes (40), 29 too near badwater (30), 36 not level, dry and clear); mostly: water | step 1: every site that fits here breaks a check that passes now (3 breaks start.food); expectation g1 start course.frac failed: it went from 0.47 to 0.47, not up; expectation g2 new:damSite course.frac failed: the proposal made no damSite
- M08: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: nothing here reaches the reservoir of at least 759 blocks; expectation g2 new:damSite reservoir.volume failed: the proposal made no damSite; expectation g2 new:damSite distanceToStart failed: the proposal made no damSite
- M09: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: every site that fits here breaks a check that passes now (2 breaks start.food; 1 breaks water.settles, start.food); expectation g1 new:waterfall course.river failed: it is "the south tributary", not "the north tributary"
- M10: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 1: every site that fits here breaks a check that passes now (4 breaks start.water, start.badwater, water.reservoir); expectation g2 new:damSite reservoir.volume failed: the proposal made no damSite; expectation g2 new:damSite course.frac failed: the proposal made no damSite
- I07: check call:0 reason includes "too near" failed (actual: "every spot here is within 42 tiles of the start (the start rule keeps badwater 30 tiles away, and its soil spreads about 7 more), and nowhere else on this map )
- X01: check call:0 ok false  failed (actual: true); check call:0 alternative exists  failed (actual: undefined)
- X03: check call:1 ok true  failed (actual: false)
- X04: propose was accepted; expected not accepted; expectation g1 new:damSite course.frac failed: the proposal made no damSite
- X05: check call:0 guardsBroken includes "start.water" failed (actual: "[]")
- Z02: propose was not accepted; expected accepted (not accepted: some steps could not be done (see steps)): step 0: there is no start on this map; expectation g1 new:lake distanceToStart failed: the proposal made no lake
