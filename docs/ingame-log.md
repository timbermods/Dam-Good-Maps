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

Checks C1–C3 and F1 of PLAN §18. Play three exported, edited maps:
- a 20-wide standalone waterfall at S = 2 and at S = 8;
- a dam site;
- a gorge with a stair notch.

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| C1 | Build a dam or levees across the gorge at the dam-site marker. | The basin fills to about the crest without leaking round the ridge ends. | set by M5 | pending |
| C2 | Place a water wheel at a generated waterfall. | It turns. | set by M5 | pending |
| C3 | Play to the first drought on Normal, using the stored water. | The colony survives. | set by M5 | pending |
| F1 | Look at the two 20-wide standalone falls, S = 2 and S = 8, and put a water wheel below each. | Record whether the thin one reads as a waterfall and whether each wheel turns. The answer sets the waterfall flow policy (PLAN §9.2). | set by M5 | pending |

## M6: full settings, sharing, themes I

| Check | What to do | What should happen | File | Status |
|---|---|---|---|---|
| M6-1 | Load one Canyon and one Lake Basin map, and dam their dam sites. | Both load, and each dam site holds. | set by M6 | pending |

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
