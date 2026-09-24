# In-game log

The in-game checks of [PLAN.md §18](../PLAN.md#18-in-game-checklist), by milestone. **They are
deferred (PLAN §20, D11).** Kyler is skipping in-game checks for now, so milestones list here the
checks they would have needed, marked *pending*, with the files to play. Nothing waits for them:
the automated validation and tests (PLAN §15) carry each milestone's gate until the checks are
played.

When you play one, change its status to **pass** or **fail**, and add the date and what you saw.
A failure becomes an issue and, if it changes a rule, a PLAN §20 decision.

**Installing a map:** copy the `.timber` file to `Documents\Timberborn\Maps`, then start
Timberborn. The map is listed under New game.

**Coordinates:** x runs west to east, y runs south to north, and (0, 0) is the south-west corner.
Each preview PNG is drawn north up at 5 pixels per tile, with a dotted white grid every 16 tiles.

## M1: shared core and end-to-end slice

The files are in [out/m1/](../out/m1/), made with generator 0.1.0 (tag `m1-done`). Remake them
from that tag with `npx tsx tools/ingame-files.ts`: the bytes are deterministic, and
[out/m1/checks.txt](../out/m1/checks.txt) lists their sha256, the start, every slope and every
source. (Generator 0.2.0 changes every map; `--milestone m1` writes the same set with it.)

- **`River Valley (4242).timber`:** 128 × 128, seed 4242, Normal, generator 0.1.0.
- **`River Valley (4242).png`:** a preview of that map:
  - start: white 3 × 3 square, with the door tile in red;
  - slopes: orange, with the tile on their high side in brown;
  - river-mouth sources: blue, on the west edge.
- **`River Valley (4242) F2 source gap.timber`:** the same map with the middle river-mouth source
  (0, 79) removed.
- **`River Valley (4242) F2 source gap.png`:** a preview of the gap file, with the gap tile in
  magenta.

The water in these files is zero (PLAN §7.6; M2 adds pre-settled water), so the river fills from
its sources during the first minutes of play.

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| A1 | Copy the file to `Documents\Timberborn\Maps` and open New game. | The map is listed as "River Valley", with its thumbnail and description. | `River Valley (4242).timber` | pending |
| A2 | Start Folktails on Normal. | There is no "Loading issues" panel. The district center stands on the white square of the PNG, at StartingLocation (37, 31), with its door facing north towards the river (door tile (36, 32)). 9 adults and 4 children spawn. | `River Valley (4242).timber` and `.png` | pending |
| A3 | Walk test: send a beaver up a 1-level terrace edge with no slope, then up and down a generated slope. The slope at (36, 37), 6 tiles north of the start, leads down towards the river. | The beaver can't step up the edge without a slope. It climbs each slope both ways. | `River Valley (4242).timber` | pending |
| A4 | Open the map in the in-game map editor. Raise and lower some terrain, then save. | The map opens without errors, the edits work, and the map saves and reopens. | `River Valley (4242).timber` | pending |
| A5 | Start Iron Teeth once. | The district center fits on the start, and the beavers spawn. | `River Valley (4242).timber` | pending |
| F2a | Play the unmodified map for about a day. Watch the west edge where the river enters (sources at (0, 77)–(0, 81)). | The river fills and keeps its water. Nothing drains back off the west edge. | `River Valley (4242).timber` | pending |
| F2b | Play the gap file for about a day at the same spot. | Water drains back off the edge through the gap at (0, 79). Compared with F2a, the river is lower or stops downstream. This confirms that river mouths must be sealed with a source on every channel tile. | `River Valley (4242) F2 source gap.timber` | pending |

**Automated stand-ins used meanwhile (all green at M1):**
- the `generate` validation profile: load and design classes, including placement emulation, start
  entrance, slopes and terrain support;
- the Python oracle, [`tools/oracle.ts`](../tools/oracle.ts): 50 seeds × 3 sizes pass
  `prototype/validate.py --load-only` and `prototype/roundtrip_test.py`;
- byte-identical output in Node and Chromium (`tests/e2e/determinism.spec.ts`).

## M2: water, playability and validation profiles

Checks B1–B4 of PLAN §18: pre-filled water, tree survival, the A/B file with empty water, and
badwater staying downstream. The files are in [out/m2/](../out/m2/), made with generator 0.2.0.
Remake them with `npx tsx tools/ingame-files.ts --milestone m2`; [out/m2/checks.txt](../out/m2/checks.txt)
lists their sha256 and every coordinate below.

- **`River Valley (4242).timber`:** 128 × 128, seed 4242, Normal. Water, soil moisture and soil
  contamination are pre-filled with the canonical settle (PLAN §19.7), as official maps ship.
- **`River Valley (4242) (empty water).timber`:** the same map with no water, moisture or
  contamination in the file. The website offers it as "Without pre-filled water".
- **`River Valley (4242).png`:** north up, 5 pixels per tile, grid every 16 tiles:
  - water blue, badwater brown;
  - start white, door red;
  - living trees green, dead trees grey-brown;
  - living berry bushes within 20 tiles of the start purple;
  - the badwater source (3 × 3) and its ditch magenta;
  - the best dam site orange;
  - the river depth samples and the nearest pumpable water cyan.

What the files should show (from `checks.txt`):
- The start: StartingLocation at (47, 30), door (46, 31). The nearest pumpable clean water is
  (42, 38), 0.49 deep, 9.2 tiles away.
- River depths after the settle, west to east:
  - (2, 78) 0.49;
  - (32, 45) 0.42;
  - (58, 53) 0.46;
  - (83, 64) 0.42;
  - (109, 89) 0.75, badwater 81%;
  - (125, 67) 0.68, badwater 40%.
- 77 living berry bushes within 20 tiles of the start, for example (37, 33)–(40, 33).
- Living groves: 139 Pine around (34, 27), 70 Birch around (58, 63), 64 Pine around (22, 86)
  and 49 Oak around (71, 64). Dead stands: 98 Pine around (56, 121), 53 Pine around (120, 2),
  32 Oak around (10, 115) and 31 Birch around (72, 2).
- The badwater source at (107, 93)–(109, 95), strength 2.34, in a pit whose 2-tile ditch runs
  into the river near the east edge. The nearest badwater or contaminated soil is 81 tiles from
  the start.
- The map has no natural lake (the basin behind the gorge stays dry until the player dams it), so
  B1's "lake levels" means the river's pools between the falls.

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| B1 | Start Folktails on Normal with the pre-filled file and watch the first day. Compare the river with the PNG and the depth samples. | The river runs from the first tick, with no surge from the sources and no drain toward the edges. The pools between the cascade, the gorge and the falls keep their level through the day. The depths at the sample tiles are close to the listed values. No berry bush within 20 tiles of the start is flagged dry. | `River Valley (4242).timber`, `.png` | pending |
| B2 | Start the `(empty water)` file the same way. | The river fills from the west edge within about a day and then looks like the pre-filled file. The same trees and bushes survive (a dry timer that starts before the water arrives resets). | `River Valley (4242) (empty water).timber` | pending |
| B3 | Play either file for 15 days. | The living groves listed above are alive, and so are the berry bushes near the start. The dead stands are still dead and can be cut for logs. The first drought, if it comes in these days, is short and nothing near the river dies. | `River Valley (4242).timber` | pending |
| B4 | Watch the badwater source at (107, 93) and the river below it. | The badwater stays in its pit, the ditch and the river downstream of it, and leaves off the east edge. The water at the start (42, 38) stays clean. | `River Valley (4242).timber` | pending |

**Automated stand-ins used meanwhile (all green at M2):**
- the water port against the game's own save: 975 ticks from empty reproduce its water within
  0.001, with the same 470 wet tiles (`tests/unit/water.test.ts`, local only);
- the golden fixtures against the Python reference, bit for bit after 50, 200 and 975 ticks;
- the `generate` profile, now with every playability check (PLAN §11.3–11.4);
- the Python oracle: both validators agree check by check on 50 generated maps and the 19 official
  maps (`npm run oracle`).

## M5: set pieces, land and water tools, slopes, fixes

Checks C1–C3 and F1 of PLAN §18, on maps edited with the M5 tools. The files are in
[out/m5/](../out/m5/), made with generator 0.3.0 from River Valley seed 4242 at 128 × 128. Remake
them with `npx tsx tools/ingame-files.ts --milestone m5` at commit 180d914 (tag m5-done): every
edit is planned by the editor's own code with fixed ids, so the bytes reproduce. From generator
0.4.0 (M6) the tool makes different maps, so test the committed files. [out/m5/checks.txt](../out/m5/checks.txt) lists their
sha256 and every coordinate below.

- **`River Valley (4242) F1 waterfall S2.timber`:** a standalone waterfall 20 tiles wide, falling
  north, fed by 2 water/s (4 springs of 0.5 in its header pool).
- **`River Valley (4242) F1 waterfall S8.timber`:** the same fall fed by 8 water/s (16 springs),
  the exact flow set by hand: more than the map's whole Normal flow of 3.6.
- **`River Valley (4242) C1 dam site.timber`:** a dam site added on the river's lower reach.
- **`River Valley (4242) gorge stairs.timber`:** a tributary drawn from the south edge into the
  main river, with a gorge where it cuts through high ground and a stair notch down to the water.
- **One PNG per map** (north up, 5 pixels per tile, grid every 16 tiles): water blue, start white
  with its door red; the waterfall's lip magenta, its springs blue and its outflow cyan; the dam
  line orange; the notch's slopes orange with their high side brown.

What the files should show (from `checks.txt`):
- The start: StartingLocation at (47, 30), door (46, 31), on every map.
- The waterfall's lip runs from (55, 118) to (74, 118) at level 15, over a plunge pool at level 9
  (rows y 119–122). The port wets all 20 lip tiles: 0.030 deep at 2 water/s and 0.120 deep at 8.
  Its outflow runs 5 tiles north to the map edge; a water wheel fits on it at (75, 123).
- The dam site's gap is the 10 tiles (83, 63)–(83, 72), on a river bed at level 8. A dam 2 high
  there should hold about 2,900 water over about 2,270 tiles; the colony needs about 380 through
  the first Normal drought.
- The generated river's own falls are at (40, 39) and (88, 76), each a drop of 2.
- The gorge runs from about (66, 14) to (66, 26). Its notch climbs west from a landing beside the
  water at (65, 20)–(64, 20), with slopes at (64, 20), (63, 20) and (62, 20), to the ground at
  (61, 20), level 13.

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| C1 | Build a dam 2 high (or levees) on the 10 gap tiles (83, 63)–(83, 72) of the dam site's ridge. Watch the basin fill over a few days. | The basin upstream fills to about level 10 and stays there. No water leaks round the ridge's ends. | `River Valley (4242) C1 dam site.timber`, `.png` | pending |
| C2 | Place a water wheel just below one of the generated river's falls, at (40, 39) or (88, 76). | It turns. | any of the four files | pending |
| C3 | Play the dam-site map on Normal to the first drought, drinking from the dammed basin. | The colony survives the drought on the stored water. | `River Valley (4242) C1 dam site.timber` | pending |
| F1 | Look at the waterfall in both files. Put a water wheel on its outflow, at (75, 123). | Record whether the 2 water/s sheet reads as a waterfall, and whether each wheel turns. The answer sets the waterfall flow policy (PLAN §9.2, D6). | `River Valley (4242) F1 waterfall S2.timber` and `S8.timber` | pending |
| C-gorge | Send a beaver down the gorge's stair notch, from the ground west of the gorge at (61, 20) to the landing by the water at (65, 20), and back. Build a water pump on the landing. | The beaver walks down and up the slopes. The pump reaches the water. | `River Valley (4242) gorge stairs.timber`, `.png` | pending |

**Automated stand-ins used meanwhile (all green at M5):**
- the set-piece range tests (`tests/contract/setpieces.test.ts`): a 20-wide fall keeps all 20 lip
  tiles wet at 96², 128² and 256², is reduced to 19 on 48², and drops above 15 are reduced;
- the drawn-river property test (`tests/contract/rivers.test.ts`): rivers drawn in random
  directions drain, carry water along their whole course, and keep their mouths sealed;
- the `export` profile on every file above: no load problem, no warning;
- the Python oracle: both validators agree on 50 generated maps and the 19 official maps.

## M6: full settings, sharing, themes I

Check M6-1: the two new themes load, and their dam sites hold. The files are in
[out/m6/](../out/m6/), made with generator 0.4.0, seed 4242 at 128 × 128, designed for Normal,
every setting at its theme's preset. Remake them with
`npx tsx tools/ingame-files.ts --milestone m6`; [out/m6/checks.txt](../out/m6/checks.txt) lists
their sha256 and every coordinate below. The same maps open on the website from a link:
`#s=4242&t=canyon&z=128&d=n` and `#s=4242&t=lakeBasin&z=128&d=n`.

- **`Canyon (4242).timber`:** a river in a canyon 4–6 levels deep, a dam site in a narrows, and a
  stair of slopes up the canyon wall beside the start.
- **`Lake Basin (4242).timber`:** a lake in the middle, rings of terraces round it, and a dam site on
  the lake's outlet to the east.
- **One PNG per map** (north up, 5 pixels per tile, grid every 16 tiles): water blue, badwater
  brown, start white with its door red, the dam line orange, the stair's slopes orange, badwater
  sources magenta.

What the files should show (from `checks.txt`):
- Canyon: StartingLocation at (42, 54), level 8, door (41, 55). The dam site's gap is the 4 tiles
  (66, 61)–(66, 64), on a river bed at level 6. A dam 2 high there should hold about 844 water over
  685 tiles; the colony needs about 380 through the first Normal drought. The stair's six slopes
  are at (48, 47) to (53, 47), levels 7 to 12, climbing east. The badwater source is at (82, 43),
  in a basin whose outlet joins the river below the dam site.
- Lake Basin: StartingLocation at (68, 97), level 10, door (69, 96), on the shore bench. The lake
  stands at about level 9. The dam site's gap is the 5 tiles (113, 59)–(113, 63) on the outlet. A
  dam 1 high there should raise the lake to about level 10: about 13,500 water over 3,622 tiles;
  the colony needs about 759 (this theme's reserve is Plenty). The badwater source is at (26, 104),
  in a basin whose outlet runs to the west edge.

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| M6-1a | Load the Canyon map. Build a dam 2 high (or 2 levees stacked) on the 4 gap tiles (66, 61)–(66, 64). Watch the canyon floor fill over a few days. Send a beaver up the stair at (48, 47)–(53, 47) to the rim and back. | The map loads with no issues. The floor behind the dam fills to about level 8 and stays there; no water leaks round the ridge. The beaver walks up and down the stair. | `Canyon (4242).timber`, `.png` | pending |
| M6-1b | Load the Lake Basin map. Build a dam 1 high (or one levee) on the 5 gap tiles (113, 59)–(113, 63). Watch the lake for a few days. | The map loads with no issues. The lake rises about one level to level 10 and stays there; no water leaks round the ridge; the start's bench at level 10 stays dry. | `Lake Basin (4242).timber`, `.png` | pending |
| M6-1c | Block the badwater basin's outlet, 3 tiles wide, with levees where its channel leaves the basin: Canyon (87, 46)–(87, 48), the channel running east; Lake Basin (26, 101)–(28, 101), the channel running south. | No badwater leaves the basin until it fills to its rim (a source never stops, so it spills over the rim later). | `Canyon (4242).timber`, `Lake Basin (4242).timber` | pending |

**Automated stand-ins used meanwhile (all green at M6):**
- the batches: 100 seeds per theme at 96², 128², 192² and 256² pass the generate profile (every
  playability check, including `water.reservoir` on the dam site and `water.badwater_contained`);
- the share-link tests: links open the same bytes in Node and in Chromium;
- the Python oracle: both validators agree on 50 generated maps of the three themes and the 19
  official maps.

## M7: resources, map objects, themes II

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| D | Load a map with NaturalDam, Blockage, Thorns, relics, a geothermal field and a mine site, then demolish the spillway plug. | There are no loading issues, and the plug releases the water as its card says. | set by M7 | pending |

## M8: water preview and background validation in the editor

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| M8-1 | Compare the editor's water preview with the game on three edited maps. | Water matches the preview. Record the differences in PLAN §20. | set by M8 | pending |
| F3 | Re-export a pre-1.0 workshop map that has no `WaterSimulationMigrator` (the importer halves its strengths). | Its rivers run at the same level as the original's in game. | set by M8 | pending |
| F4 | Edit an imported map with roofed water (Canyon or Terraces) away from the tunnels, then export it. | The tunnels keep flowing as in the original. | set by M8 | pending |

## M12: Claude integration

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| M12-1 | Play the map produced by "add a giant waterfall in the north part of the map that is roughly 20 blocks wide". | The waterfall is there, about 20 wide, in the north, and it flows. | set by M12 | pending |

## M13: usability, design pass, ratings, versioned deploys

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| M13-1 | The full journey of EDITOR_PLAN §9 task 7: generate, refine, ask Claude, export, load in Timberborn. | The exported map loads and plays as edited. | set by M13 | pending |

## Any time: open questions from the investigation (PLAN §18 E)

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| E1 | Load a map with terrain above 16 in the editor. | Record whether the editor loads and edits it. | any map with terrain 17–22 | pending |
| E2 | Walk a beaver into a ruin column. | Beavers walk through ruin columns, as the code says. | `River Valley (4242).timber`: the website preview of seed 4242 outlines its ruin fields | pending |
| E3 | Run an aquifer with a powered drill during a drought. | Record whether it yields water. | any map with an aquifer | pending |
| E4 | Start a new game on a map with no StartingLocation. | Record what happens, for the error message. | needs a hand-made file | pending |
