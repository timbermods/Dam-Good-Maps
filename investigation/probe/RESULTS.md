# DGM Probe: first batch

Run `20260925-2149-batch`, 2026-09-25 (17:44–18:17 local). 42 maps in one launch of Timberborn 1.1.2.4, unattended from
launch to quit: no hang, no crash, no relaunch, 34 minutes. Played with Kyler's installed mods (Harmony, Mod Settings,
Late Game Performance, Performance Log, Hungry Pathing, MixedStorage, Optimized Local Housing, Persistent Work Areas,
The Tipsy Tail, Timber Together); they don't touch water, soil, plants or weather timing (Kyler). His settings, read
from outside the runner before and after, matched his backup but for Unity's own per-launch values.

Screenshots and records stay on the machine that ran it (`Documents\Timberborn\DGMProbe\`, run folder above); the
contact sheet is `sheet\20260925-2149-batch.html`. Tiles are (x east, y north) from the south-west corner; days are
counted from the start of each game.

**Checks:** 198 in all: 171 passed, 6 failed, 20 not measurable, 1 recorded (as the runner decided them; ML-2, judged by eye below, is among the not measurable).

## Findings worth acting on

1. **The M8 editor's export breaks the stored water of imported maps with caves** (M8-1c; also the edited Canyon of
   M8-1b). The game keeps its own rivers, but the file's water is wrong:
   - edited Cozy Secret Valley: 27% of wet tiles within 0.1 of the file after a day, and 70% of the stored water
     gone. At (58, 29) the original stores two columns (0.33 clean on floor 2, 0.31 badwater on floor 14); the
     export stores one column 12.30 deep of badwater from floor 2. River tiles beside the edit, such as (10, 12),
     lost their water (0.33 in the original, none in the export);
   - edited Canyon: 75% of wet tiles within 0.1, 27% of the water gone; at (27, 24) the file stores 5.02 deep, the
     game keeps 0.07. At the start the ground round the district center is under water.
   The unedited originals match their files 100% in the game.
2. **Pre-filled maps kill plants in their first hours** (M2 River Valley). A Pine grove at (105–114, 102–105), about
   10 tiles north of the badwater pit, dies of contaminated soil 0.23–0.29 days after the start. The file's soil is
   clean there; loading the settled water with zero flow momentum sends badwater briefly beyond its settled
   extent. The cycle model predicts the same deaths at the same hours.
3. **A short Normal drought kills plants beside the badwater river** (B3). About 23 plants at (87–123, 73–96) die of
   contaminated soil 0.4–0.6 days after the drought ends, as the returning flow carries badwater onto the banks.
   The model predicts the same wave.
4. **The empty-water file kills more plants than the pre-filled one** (B2): 43 against 11 in the first 2.2 days,
   all of contaminated soil in the east, while the river fills. The water itself matches the pre-filled game within
   a day. The model predicts 40 of them (36 the same plants).
5. **The M7 spillway's own estimate is wrong, not the game** (D5). With the plug gone the lake falls from 9.29 to
   8.85, not to 8, and loses about 1,430 water, not 3,290, then keeps that level. The cycle model predicts 9.28 → 8.85
   and 1,410. The tool's estimate treats the lake as still; the rivers keep feeding it, so the spillway runs about
   0.85 deep. Opening the plug also dries the start's bench: 51 of the 143 plants within 15 tiles of the start are
   flagged dry by 1.5 days later.

## In-game checks

Pending checks of `docs/ingame-log.md`. "Measured part" means the probe decided only what it can measure.

| Check | Result | Numbers |
|---|---|---|
| A1 | passed (measured part) | The map loads from its file, no loading issue. The New game list entry is not seen. |
| A2 | passed | No loading issue; the district center stands on the StartingLocation (37, 31, 10), facing Cw180; 9 adults, 4 children. |
| A3 | not measurable | Walking a beaver up a terrace edge and a slope needs directed beavers. |
| A4 | not measurable | Needs the map editor. |
| A5 | passed | Iron Teeth: the district center fits at (37, 31, 10); 9 adults, 4 children. |
| F2a | passed | The river fills from the west edge and keeps its water: 64.5 in the west reach after 1 and 1.5 days; (1, 79) 0.47 deep. |
| F2b | passed | The gap file's west reach holds 35.9 against 64.5 (−44%); (1, 79) 0.26 against 0.47. River mouths need a source on every channel tile. |
| B1 | passed | The six depth samples within 0.005 of `checks.txt` at the start and after a day; whole-map water 444 → 443; no berry bush near the start dry. |
| B2 | **failed** | The water matches the pre-filled game within a day (100% of wet tiles within 0.1), but 43 plants die against 11 (finding 4). |
| B3 | **failed** | The start's bushes and the four named groves live, but plants beside the river die: the grove on day 0.25 and ~23 after the drought (findings 2, 3). |
| B4 | passed | The start water (42, 38) stays clean (0.0%); all 146 badwater tiles at the end lie within 3 tiles of the file's badwater. |
| C1, C2, C3 | not measurable | A dam, a water wheel, a colony through a drought: need building. |
| F1 | passed (measured part) | All 20 lip tiles wet: 0.030 deep at 2 water/s and 0.120 at 8, as the port says. The look was not seen: the pose looked from upstream (fixed for the next run). |
| C-gorge | passed (measured part) | Water beside the landing: (66, 20) 0.31 deep. The walk and the pump are not measured. |
| M6-1a, M6-1b | passed (measured part) | Both load with no issue, no error. The dams and the stair walk need building. |
| M6-1c | not measurable | Levees need building. |
| D1 | passed | No loading issue; Blockage 3/3, NaturalDam 5/5, Thorns 32/32, relics 2/2, geothermal fields 2/2, mine sites 2/2; all 2,185 objects in place. |
| D2 | passed | Upstream of the weir 0.655 deep (file 0.654, `checks.txt` 0.65); downstream the water stands 0.23 lower and flows over. |
| D3, D4 | not measurable | Beavers walking round thorns, demolitions and placements. |
| D5 | **failed** | See finding 5: the game and the model agree; the M7 estimate is wrong. |
| M8-1a | passed | 100% of 1,175 wet tiles within 0.1 of the file after a day (worst 0.005); the lake (63, 65) 1.509 (1.51); the weir (92, 80) 0.599 (0.60); the lowered ground dry. |
| M8-1b | passed, but the file's water fails | The new lake fills (1.12 deep against the file's 0.95); under roofs 92.5% of 227 tiles within 0.1 of the original Canyon. The stored water of the export is wrong (finding 1). |
| M8-1c | **failed** | The rivers run at the original's level (median difference 0.003 over 2,906 tiles), but the lowered ground holds 0.33 deep where the export stored none, and the export's water is wrong (finding 1). |
| ML-2 | passed, by eye | Grass where our view draws moist ground, cracked earth where it draws dry ground, badwater clearly water in both. Our contaminated ground reads much stronger than the game's (see "Where our 3D view differs"). |
| E1, E2, E3 | not measurable | The editor, a beaver in a ruin column, a drill: not automated. |
| E4 | recorded | A new game on a map with no StartingLocation starts with no district center and no beavers, no loading issue and no error. The camera opens off the map's south-west corner, and the game never declares game over. |

Not in the batch: M12-1, M12-2 and M13-1 (their files come with those milestones).

## Calibration: the cycle model against the game

Three games with forced weather, compared tick for tick with the cycle model (`investigation/cycles-exact`, `a9cdb86`) on
the same file and schedule. The model is on time at every calibration point.

| Point | Game | Model | Early or late |
|---|---|---|---|
| Source slowdown: River Valley 2, (90, 50) | 0.456 deep half a day before the drought, 0.341 as it starts, under 0.05 4.3 h into it | 0.456, 0.339, the same hour | on time (0.0 h) |
| Evaporation: Lake Basin 2, (45, 36), Hard drought | 3.293 a day before, 3.202 as it starts, 2.880 three days in | 3.293, 3.201, 2.880 | on time |
| Badtide front: River Valley 2, (72, 61) | clean before; 50% at 6.7 h in, 61.5% at 12 h, 99.5% after a day | the same hour, 61.7%, 99.5% | on time (0.0 h) |
| Plant timer: River Valley 2, 14-day Hard drought | 478 plants die of dry soil | 472 | All 451 plants the model also saw dry die 0.9–1.1 × their dry days after its soil dried; median death 2.1 h later in the model (per-plant random delays differ by run). BlueberryBush (18, 87): game day 11.24, model 10.17, soil dry from 2.07 (both in its 10.17–11.97 window). |

Day by day, the three maps' water agrees within 0.4%, and their wet, moist and badwater tiles within 1%. The one lag: at the
end of the pre-drought source ramp the model has dried about 1% more tiles than the game (818 against 826 wet tiles
on River Valley 2), a fraction of an hour early; by the next day they are equal. The model also predicts the M2
map's plant deaths (26 of the game's 34 the same plants, on the same days) and the D5 lake level exactly.

## High terrain (Kyler, 2026-09-25)

Three test maps with terrain above the editor's 16, up to 21 (the file's 22 layers with the top one empty):

| Map | Loads | Terrain after the game's physics | Stored water after a day | Objects |
|---|---|---|---|---|
| River Valley 96², every column raised 5 (terrain 7–21) | no issue, no error | all 2,299 tiles above 16 kept; no tile differs | 100% of 851 wet tiles within 0.1 | 1,667/1,667, all 403 above level 16 |
| Canyon 128² raised 5 (rim at 21) | no issue, no error | all 13,756 tiles above 16 kept; no tile differs | 100% of 654 wet tiles within 0.1 | 1,893/1,893, all 1,148 above level 16 |
| Highlands 128² with a level-21 mesa (spring, trees, a bush on top) | no issue, no error | all 361 tiles above 16 kept; no tile differs | 96% of 1,561 wet tiles within 0.1 | 1,979/1,979, all 8 above level 16 |

Terrain up to 21 loads, keeps its shape, and holds its water and objects. The mesa's spring was not pre-filled (our
export keeps an unedited import's water, so the new spring had none): it fills its pit on top and runs down the
stepped sides within the first day, which accounts for the 4% of tiles that differ (the most at (42, 88), 0.17 →
1.33 where the stream gathers).

## M9 prototypes: the start's water through a Normal drought

3 temperate days, then a 3-day drought. The share of the start's water body left, game (model):

| Map | At the drought's start | After a day | At the end | The brief says |
|---|---|---|---|---|
| Canyon 10 (river) | 21.9% (21.5%) | 0% (0%) | 0% | runs dry within a day |
| Canyon 30 (river) | 51.5% (50.8%) | 0% (0%) | 0% | runs dry within a day |
| River Valley 18 (river) | 62.0% (61.4%) | 18.5% (18.5%) | 15.2% | runs dry within a day: the flow stops, pools keep 15–19% |
| Canyon 5 (stream) | 77.2% (82.5%) | 55.4% (55.6%) | 47.3% | shrinks |
| Canyon 8 (lake) | 85.4% (85.1%) | 60.0% (60.0%) | 50.4% | shrinks |
| Delta 12 (lake) | 88.3% (88.1%) | 64.6% (64.6%) | 57.7% | shrinks |
| Islands 29 (lake) | 94.0% (94.0%) | 66.4% (66.4%) | 57.0% | shrinks |
| Highlands 29 (lake) | 77.1% (77.0%) | 31.1% (31.0%) | 7.1% | runs dry |
| Highlands 30 (lake) | 92.7% (92.6%) | 76.7% (76.7%) | 73.0% | keeps most of its water |
| Lake Basin 25 (lake) | 99.8% (99.8%) | 96.9% (96.9%) | 95.2% | keeps most of its water |

Every brief holds; the model is within 0.7% of the start volume on nine maps and 5.3% on Canyon 5's first drought
day. The water already falls before the drought starts: the sources ramp down during the last temperate days.
All ten load with no issue or error, every object in place, terrain and stored water as in the file.

## What the screenshots show

Reviewed: every map's opening overview, all Map look poses side by side with our captures, the high-terrain maps,
the M7 plug and weir, the waterfalls, the M9 prototypes' start and drought shots, the M1–M8 starts and E4.

- **Water where it shouldn't be:** the edited Canyon's start is flooded, with a wide contaminated patch round a dark
  pit at its largest water ("start" and "water" poses, start); the edited Cozy Secret Valley shows a dark lake
  where the original has thin streams ("water" and "overview", start). Both are the export bug of finding 1.
- **Plants:** on M7 after the plug is removed, trees round the start turn the drying tint by day 6 ("start",
  end). On the empty-water M2 file many plants look dry at the start (expected: no moisture is stored).
- **E4:** the game's own opening camera looks off the map's south-west corner at the edge of the terrain block.
- **No broken or odd terrain, no floating or missing objects** in any shot; the high-terrain maps and the mesa
  look as built.
- **Limits of this run's poses:** the whole-map overviews of 256² maps sit beyond the game's zoom range, so its
  distance fog washes them out; the waterfall pose looked from upstream (fixed in the catalog).

## Where our 3D view differs most from the game

At the Map look poses the two frames line up (same target, direction and field of view). The largest differences:

1. **Contaminated ground.** Ours paints a wide, saturated red-orange area; the game shows a faint reddish tint close
   to the badwater (Islands "badwater", Canyon "badwater").
2. **Deep water.** The game draws deep water nearly black-blue (Islands "start", Lake Basin); ours stays bright blue.
3. **Dry ground.** The game's cracked earth is grey-violet; ours is brown.
4. **Waterfalls.** The game shows a dark sheet with foam at the foot; ours shows flat steps with white splash
   textures (Islands and Canyon "falls").
5. **Objects.** Dead trees are thin grey trunks in the game, white spikes in ours; ruins are wooden lattice towers
   in the game, solid dark-red blocks in ours; the game's canopies are much fuller.

## What the game logged

No error and no exception in any of the 42 maps. Four warnings:

- M1 River Valley (Folktails): Late Game Performance notes that BeaverBuddies' save code differs from the one it read.
- M1 River Valley (Iron Teeth): "Too many atlases loaded (3)!" (the game's own, after switching faction).
- M2 empty water and Map look River Valley 256²: Late Game Performance's PlantWater check read one plant a tick
  ahead of the main thread. The B2 deaths do not depend on it: the model, without any mod, predicts them.
