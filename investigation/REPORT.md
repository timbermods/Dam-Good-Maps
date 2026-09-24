# Investigation report

What this machine's Timberborn install, its maps and the game's code say about making maps that
load, play and feel designed. It covers game build **1.1.2.4-52e959e-sw**, investigated on
2026-09-23. Every threshold in the prototype and in [PLAN.md](../PLAN.md) traces back to a number
here.

- Evidence for the game rules is in [notes/](notes/): [format_1_1.md](notes/format_1_1.md),
  [blocks_and_placement.md](notes/blocks_and_placement.md) and [footprints.json](notes/footprints.json),
  [water_and_soil.md](notes/water_and_soil.md), and
  [navigation_ruins_entities.md](notes/navigation_ruins_entities.md).
- The per-map numbers are in [calibration.json](calibration.json), produced by
  [analyze_maps.py](analyze_maps.py).
- The file format itself is in [FORMAT.md](../FORMAT.md).

## 1. What is where

| What | Where | Notes |
|---|---|---|
| Steam library | `C:\Program Files (x86)\Steam` (the only entry in `steamapps\libraryfolders.vdf`) | app 1062090, build id 25096761 |
| Game | `…\steamapps\common\Timberborn` | `StreamingAssets\Version.txt` = `1.1.2.4-52e959e-sw`; `Player.log` agrees |
| Built-in maps | inside `Timberborn_Data\resources.assets`, as `BinaryData` assets under `Resources/Maps` | 19 maps plus 3 dev maps (`_mini`, `_terraintest`, `_waterperformancetest`). They are not loose files in 1.1; [extract_builtin_maps.py](extract_builtin_maps.py) carves the embedded zips out read-only |
| Game code | `Timberborn_Data\Managed\Timberborn.*.dll` (497 assemblies) | decompiled with the already-installed ilspycmd 8.2 by [decompile_all.sh](decompile_all.sh) into `investigation/decompiled/` (not committed) |
| Game data | `StreamingAssets\Modding\Blueprints.zip` | 1,067 blueprint files; [summarize_blueprints.py](summarize_blueprints.py) extracts the map templates into [notes/blueprints_summary.json](notes/blueprints_summary.json) |
| Workshop maps | `steamapps\workshop\content\1062090` | 9 maps among 18 subscribed items (the rest are mods) |
| Your maps | `Documents\Timberborn\Maps` | only `Generator Test - River Valley.timber` from the first prototype |
| Saves | `Documents\Timberborn\Saves` | copied: the 1.1.2.4 save of the generated map (day 1–2) and one 256² co-op save |

Everything used here was copied to `investigation/raw/` (not committed). Nothing in the game install,
Steam folders or `Documents\Timberborn` was changed.

**The first prototype was not on this machine.** `tbmap.py`, `generate_test.py`,
`roundtrip_test.py` and the first `FORMAT.md` were not in the session folder, and a search of the
whole drive found no copy. Only the map it generated survived, in `Documents\Timberborn\Maps`. That
file, the game's save of it, and your description were used to rebuild the prototype in
[prototype/](../prototype/).

The game loaded that generated map with no loading issues (`Player.log`, 22:11). The save shows what
the game did with it: the district center appeared at the StartingLocation, the river filled from
the three sources, and 51 trees on dry soil started dying.

## 2. Format: what changed in 1.1

The full format is in [FORMAT.md](../FORMAT.md). Compared with the 0.7/1.0 maps:

1. `MapSize.MapHeight` is gone. Terrain is always 23 voxel layers, a game constant. 1.1 ignores the
   old key.
2. Water column tokens have a fifth field, `OldWaterDepth`. Four-field tokens still load.
3. Version strings are `1.1.2.x`. **The game never reads the version when loading**; every migration
   is triggered by missing or old keys. The first prototype's 1.0-stamped maps loaded natively for
   that reason.
4. New templates: `Succulent`, reserve stockpiles, `AncientAquiferDrill`. The singleton set, entity
   component shapes, outflow format and metadata are otherwise unchanged from 1.0.

The prototype now writes the native 1.1 format:
- `1.1.2.4-52e959e-sw` in `version.txt` and `GameVersion`;
- no `MapHeight`, no editor camera;
- settled water in 5-field tokens, plus soil moisture and contamination, as official maps ship;
- deterministic Ids and zip entry dates.

**Round trip.** 34 voxel-format files round-trip: 19 official, 3 dev, 7 workshop, your map, 2 saves
and the 2 newly generated maps. Each re-serializes to byte-identical `world.json`, and a written
copy reads back identical with a terrain edit surviving. The two 0.6 heightmap maps are read for
statistics but are not voxel-format.

## 3. Game rules

Short answers. Each links to the notes with the code references and data checks.

### Footprints, Orientation and Flipped ([notes](notes/blocks_and_placement.md#1-footprints-and-the-orientationflip-transform))
- `Coordinates` is where blueprint block (0,0,0) lands, not the minimum corner.
- Each occupied cell = `Coordinates + R(F(local))`, with R Cw0 `(x,y)`, Cw90 `(y,−x)`, Cw180 `(−x,−y)`,
  Cw270 `(−y,x)`.
- F mirrors x inside the width, but only for flippable templates: Blockage, NaturalDam, Thorns,
  relics, UnstableCore, WaterSource, the seeps and reserves.
- An emulation of the game's load validation with this rule rejects **0 of 58,388** official objects.
  The "min corner" reading rejects 82, a reversed rotation 76.
- Every template's blocks are in [footprints.json](notes/footprints.json).

**StartingLocation**:
- It is a 3×3×5 block that needs a flat 3×3 with 5 free layers.
- A new game puts the faction's district center at the same Coordinates and Orientation, with 9 adults
  and 4 children.
- The door faces Cw0 −y, Cw90 −x, Cw180 +y, Cw270 +x. The entrance tile must be free ground at the
  same level, or no beavers spawn.
- Only one StartingLocation survives a load. Anything overlapping it deletes it.

### Slopes ([notes](notes/blocks_and_placement.md#4-slope-direction-and-height-step))
- A Slope at Z = z stands on level z and climbs to z+1.
- The high side is Cw0 south (y−1), Cw90 west, Cw180 north, Cw270 east.
- 183 of 183 official slopes have ground at z+1 on the high side, and 178 have ground at z on the low
  side. The others are chained slopes plus one oddity in Hollows.
- The game never checks the direction, so the generator must.

### Walking ([notes](notes/navigation_ruins_entities.md#1-navigation-steps-water-obstacles-districts-and-range))
- **Beavers cannot cross even a 1-voxel step** without a Slope or stairs. The terrain navmesh only
  joins tiles at the same height; diagonal moves need all four tiles level.
- Player stairs cost 70 science, which is why every official map pre-places slopes (4–23 per map,
  a median of 2 within 25 tiles of the start).
- Water never blocks walking; beavers slow down in it.
- Trees, bushes and ruins are walk-through. Thorns, Blockage, NaturalDam, relics, cores, geothermal
  fields and underground ruins block.
- There is no district radius. Lumberjacks, gatherers and scavengers work within 20 steps of their
  building, and builders within 10 tiles of a road.

### Water ([notes](notes/water_and_soil.md))
- **Sources:** WaterSource is 1×1 and BadwaterSource 3×3, emitting on all 9 tiles.
  - `SpecifiedStrength` is blocks of water per second: 1.0 ≈ 460 per game day, capped at 8 per tile.
  - Every source stops during drought, after a ramp. During badtide clean sources emit badwater.
  - Official strengths are mostly 0.5 for clean sources and 1.5 for badwater.
- **The simulation:** water moves between neighbouring columns by head difference with momentum.
  Surfaces end up almost flat, so rivers are chains of level pools joined by falls.
  - Evaporation is small: 0.054 per day on water at least 3 wide.
  - **Map edges drain**, except the edge next to a source cell, which is a wall. That is how
    official rivers enter on the border.
- **The trap:** without `WaterSimulationMigrator {IsMigrated:true}`, every source runs at half
  strength.
- **Port check:** a Python port of the rules (`prototype/watersim.py`, single layer) was run from an
  empty map for 975 ticks.
  - It reproduces the game's own save of the generated map to **0.001 depth**, with the same 469
    wet tiles and the same 2,603 moist tiles.
  - It matches Diorama exactly, and Waterfalls at 0.98 overlap.
  - It does not handle water under roofs (tunnels, caves, overhangs).
- **Water at map edges:** covered under the simulation above: edges drain, except next to a source.

### Moisture and plants ([notes](notes/water_and_soil.md#q3-soil-moisture-timberbornsoilmoisturesystem))
- **Reach:** moisture spreads up to **16 tiles** from clean water at least 3 wide at bank level.
  A 1-wide stream reaches 6 tiles.
  - **Every level of bank above the water surface costs 6 tiles**, so a riverbed one level below the
    banks keeps the full 16.
  - Badwater (contamination ≥ 0.53) gives no moisture.
- **Replica check:** a steady-state moisture replica is tile-exact on 9 official maps and at least
  99.4% on 9 more.
- **What plants need:** trees and bushes need moisture above 0, no water on their tile and clean soil.
  - On dry soil they die after DaysToDieDry: Birch 11, Pine 13, Oak 15, blueberry 9 days.
  - Succulents need dry soil.
- **Dead trees on maps:** the map editor kills dry trees instantly, which is why about **two thirds of
  official trees are stored dead**. Dead trees keep their logs.
- **Allowed species:** only Pine, Birch, Oak, Succulent and BlueberryBush exist for both factions and
  in the editor.
- **Badwater soil:** contaminated soil reaches 7 tiles from water that is at least half badwater, and
  kills plants in about 0.25 days.

### Ruins ([notes](notes/navigation_ruins_entities.md#2-ruins))
- `RuinColumnH{n}` yields 15·n scrap: 15 to 120. All 4,964 official ruins match.
- `RuinModels.VariantId` is A–E. An unknown value gets a random variant; **a missing component crashes
  the load**. Official variants are roughly uniform.
- Orientation only rotates the model.
- Scavenging carries 1 scrap per trip, and a column needs an 8-neighbour at its own level.
- UndergroundRuins (5×5) is the site for the Mine: 4,000 science, infinite scrap. Official maps have 1–4.

### Validation on load ([notes](notes/blocks_and_placement.md#6-validation-on-load))
- **Deleted, with a "Loading issues" panel:** unknown templates, and objects that are out of bounds,
  overlapping, floating or inside terrain.
- **The whole load fails:** a duplicate Id, an invalid enum string, fewer than 23 terrain layers, or a
  missing required component (`RuinModels`, `WaterSource`, the seeps' `WaterDepthStrengthModifier`,
  `UnstableCore`, `FixedStockpile`).
- **Unsupported terrain:** voxels more than 3 tiles sideways from support are deleted.
- **Map editor:** a missing StartingLocation only gets an alert.

### The 1.0+ map entities ([notes](notes/navigation_ruins_entities.md), [water notes](notes/water_and_soil.md#q6-10-water-entities))

| Entity | What it does | Official use |
|---|---|---|
| Thorns | blocks walking and building; blocks moisture and contamination on its tile; 10 h to clear, ~65% injury chance on Normal | 8/19 maps, belts across corridors |
| NaturalDam | holds water 0.65 above its base, like the player dam; not walkable; demolishing releases the water | 6 maps, lines across 1-deep channels |
| Blockage | full 1-high water plug; walkable on top at bank level; demolish to open a channel | 15 maps, lines across notches |
| NaturalOverhang2x1/3x1/4x1 | natural slab; paired as bridges over narrow 1-deep channels, top walkable and pathable | 8 maps |
| UnstableCore | cannot be removed; explodes about 10.5 days after cycle N, removing terrain and objects within radius+1 and chaining to other cores | Nomads, Pressure, Spillage |
| GeothermalField | site for a 400 hp engine with no workers; stops if flooded | 7 maps, 1–7 each |
| WaterSeep / BadwaterSeep | 2×2 sources that switch off under 0.8 of water | 7 maps |
| Aquifer + AncientAquiferDrill | water only while a powered drill stands on it, and (per code) only in temperate weather | Oasis, Pillars |
| BadtideDrain | a spout in a cliff notch that emits badwater only during badtide | 7 maps |
| Relics (small/medium/large) | 200 / 800 / 3,000 science when demolished | 9 maps |
| UndergroundRuins | Mine site | all 19 maps |

### Limits
- **Map size:** 4–256 per axis; non-square sizes are fine.
- **Height:** terrain up to 16 in the editor (every official map tops out at exactly 16), 22 in game.
  Objects must stay below z = 33.
- **First days:** on Normal the colony starts with 130 food (about 3.75 days) and **no water**.
  Thirst deaths begin around day 5.7, so a water pump must run almost at once. The Folktails pump
  reaches 2 levels down.

## 4. Design statistics

The 19 official maps are the playability baseline; the 9 workshop maps show what players build.
Sizes are grouped as small (up to about 100×100; the official ones are 50×50 and 100×50), medium
(128²), large (192², 151×251) and max (256×150, 256²). Distances are in tiles from the centre of the
start. Values are official medians unless stated.

### Ruin fields

| | official | workshop |
|---|---|---|
| Columns per map | 239 (47–483) | 350 |
| Scrap per 1,000 tiles | 281 (p10 152, p90 724) | 705 |
| Fields of 10+ touching columns per map | 6 (2–14) | 8 (3–19) |
| Columns per field (median field) | 38 | 26 |
| Largest field per map | 58 (28–132) | 54 |
| Share of columns inside fields | **97%** | 86% |
| Field fill of its bounding box | 0.56 (0.48–0.70), about 10% interior holes | 0.42 |
| Spacing between field centres | 58 | 10 |
| Nearest field to the start | 45 (p10 22) | 25 |
| Terrain under a field | one level (median height spread 0), never raised on a plateau (median 0, p90 about +1) | |

- **Height mix** (official, 4,954 columns): H1 28%, H2 22%, H3 17%, H4 10%, H5 8%, H6 5%, H7 4%, H8 4%.
  Counts fall from H1 to H8, as your quick check found.
- **Tall columns toward the middle is only a weak tendency.** Mean height is 3.05 in the inner third
  of a field, 2.91 in the middle and 2.68 in the outer. The height-vs-radius Spearman correlation per
  field has an official median of −0.06 (p10 −0.39); the workshop median is −0.18.
- **The stronger pattern is clumping.** Blocks of 8s and runs of 5s sit together, like the remains of
  single buildings.

**By size**:

| | small | medium | large | max |
|---|---|---|---|---|
| Scrap per 1k tiles | 840 | 705 | 236 | 237 |
| Fields per map | 2.5 | 6 | 4.5 | 8.5 |
| Field size | 21 | 31 | 40 | 41 |

Total scrap grows much more slowly than area: 128² maps carry about 11,500, 256² maps about 15,500.

### Forests and berries

| | official | workshop |
|---|---|---|
| Trees per 10k tiles | 606 (402–1,196) | 1,126 |
| Share alive | 0.33 | 0.39 |
| Groves (clusters of 5+) | 89 per map; median grove 10 trees; largest 180 | 71; 9; 144 |
| Species in a grove | **one** (every official grove of 20+ is single-species) | 0.81 dominant |
| Species mix (all trees) | Pine 47%, Birch 27%, Oak 20%, Succulent 6% | |
| Living trees: distance to water | median 6.7, p90 32 | 3.4 |
| Bushes per 10k tiles | 44 (17–148) | 228 |
| Berry patch size | 38 | 7 |
| Bushes: distance to water | 4.8 | 3 |

- **By size**, per 10k tiles:

  | | small | medium | large | max |
  |---|---|---|---|---|
  | Trees | 1,715 | 1,061 | 534 | 500 |
  | Bushes | 265 | 92 | 40 | 38 |

- **Living trees stand on moist soil and dead ones on dry soil** (the editor enforces it). Groves
  near rivers are alive, and the dry benches carry dead stands that still yield logs.

### Water and badwater sources

| | official | workshop |
|---|---|---|
| Clean sources per map | 8 (2–35) | 11 |
| Strength each | mostly 0.5 (105 of 170); 0.25–1.5 | 1 |
| Total clean strength per 10k tiles | 1.2 (p90 4.6) | 6.7 |
| Sources on the map edge | 34% | 82% |
| Badwater sources per map | 4 (0–9) | 2 |
| Badwater : clean strength | **0.65** (0.18–2.2) | 0.55 |
| Badwater sources on the edge | 0% (all inland, on mid-height ground) | |
| Map under water (saved) | 12% (7–40%) | 18% |
| Map under badwater | 6% (up to 38% on Pillars) | 4% |

- **By size**, clean strength per 10k tiles: small 8.5, medium 1.5, large 1.0, max 1.1.
- Official maps are stingier with clean water than players, and carry a lot of badwater.

### The start

| | official median | p10 | p90 |
|---|---|---|---|
| Clean water (depth ≥ 0.1) | 13.3 | 5.0 | 22.1 |
| Clean water a pump at the start level can reach (surface 0–2 below) | 13.8 | 4.4 | 22.2 (3 hard maps have none) |
| Nearest water source | 67 | 24 | 118 |
| Nearest badwater | 30.5 | 12 | 54 |
| Nearest tree / living tree | 7.2 / 11.3 | 4.2 / 6.7 | 14.4 / 20.5 |
| Trees within 20 | 117 | 47 | 172 |
| Nearest berry bush | 13.7 | 6.0 | 18.7 |
| Bushes within 20 | 47 | 6 | 80 |
| Nearest ruin column | 45 | 22 | 71 |
| Scrap within 40 | **0** | 0 | 2,040 |
| Same-level region at the start | 914 | 431 | 1,711 |
| Walkable through map slopes | 1,296 | 1,007 | 4,523 |
| Slopes within 25 | 2 | 1 | 4 |

- Starts are central, not at the edge.
- The start zone is wood and berries; scrap starts 30–70 tiles out.

### Resources by distance from the start (official medians of each map's share)

| Ring (tiles) | 0–16 | 16–32 | 32–64 | 64–128 | 128+ |
|---|---|---|---|---|---|
| Living trees | 5% | 22% | 25% | 38% | 10% |
| Berry bushes | 7% | 35% | 12% | 23% | 0% |
| Scrap | 0% | 0% | 13% | 43% | 10% |
| Clean source strength | 0% | 0% | 0% | 40% | 0% |
| Badwater sources | 0% | 0% | 9% | 50% | 0% |
| Flat land | 3% | 6% | 18% | 43% | 23% |

Survival basics sit near the start, growth resources mid-distance, and scrap and sources at the
frontier. This is the pacing you proposed, and the official maps already follow it.

### Terrain

| | official | workshop |
|---|---|---|
| Height range (p5–p95) | 13 levels (9–15) | 15 |
| Highest terrain | **16 on every map** (the editor limit) | 16 (mods up to 88) |
| Levels covering 1%+ of the map | 16 (12–17) | 16 |
| Flat share (all 8 neighbours level) | 0.52 (0.36–0.60) | 0.47 |
| Tiles at a cliff (step ≥ 2) | 16% | 12% |
| Steps that are 1 level | 62% (27–86%) | 80% |
| Plateaus (raised tables with a rim that drops) | 18 per map (small 3, max 24) | 6 |
| Slopes per 10k tiles | 2.4 (small maps 18) | 8 |
| Overhang or cave columns | 1% (up to 13%, Pillars) | 30% |

### Design features

| | official median (range) |
|---|---|
| Natural basins holding water without a dam (20+ tiles) | 12 per map (0–25) |
| Dam sites (a straight dam that holds a reservoir with no leak) per 10k tiles | 11 (0–32) |
| Best dam site: reservoir volume per dam tile | 470 (65–7,574) |
| Waterfalls (water surface drop ≥ 1.5 between neighbours) | 4 per map (0–41) |
| Highest waterfall drop | 4.8 (up to 12.8) |
| Islands of 100+ tiles | on 6 maps (ThousandIslands 25, Pillars 28) |
| Water bodies | 2 per map (most maps are one connected river system) |

## 5. What this means for the generator

These numbers replace the guessed thresholds. The first prototype's own guesses were lost with its
source, so they cannot be listed side by side. The calibrated values are in
[prototype/calibrated.py](../prototype/calibrated.py), and PLAN.md carries the same table. The
biggest shifts from the assumptions in your brief are:

1. **Slopes are mandatory.** With 62% of steps being 1 level and no free way to climb them, a map
   without slopes strands the colony on its first terrace.
2. **Water flow is not drought forgiveness.** Every source stops in drought. What carries a colony
   through is stored water: natural basins and dam sites.
   - Normal (up to 9-day droughts, 50 beavers) needs about 250 blocks within reach.
   - Hard (up to 30 days) needs deep reservoirs, because evaporation takes 1.6 over 30 days.
3. **Clean water must be within pump reach on day one.** Normal gives no starting water, and a pump
   reaches 2 levels down.
4. **Forests follow moisture.** A tree is alive only within 16 tiles of clean water at bank level
   (6 tiles fewer per level of bank). Dry land carries dead stands, as in official maps.
5. **Density depends on size.** Small maps are packed 3–4× denser than 256² maps.
6. **Ruins are few big fields of touching columns on flat ground, far from the start**, with clumped
   heights and only a mild inward lean.
7. **Maps are 23 layers with terrain up to 16.** A waterfall drop is therefore at most about 12–14
   levels, and official falls average under 5.

## 6. Prototype results

| Check | Result |
|---|---|
| Round trip | 36 files, 0 failures (34 byte-identical, 2 pre-0.7 heightmap maps skipped) |
| Water port vs the game's save of a generated map | depth within 0.001; wet and moist tiles identical |
| Determinism | same seed gives a byte-identical `.timber` (`prototype/determinism_test.py`) |
| Test map `out/Dam Good Maps - River Valley 4242.timber` | passes all 38 checks on the first attempt: 6 sources × 0.5, clean water 5 tiles from the start, 5 ruin fields (6,960 scrap), 1,212 trees, 148 berry bushes, 27 slopes, a dam site near the start holding 1,187 against 253 needed |
| Batch, 96² Normal, 16 seeds | 88% pass on the first attempt, 100% within 6 attempts (mean 1.19), 4.2 s per seed in Python |
| Batch, 128² Normal, 8 seeds | 62% first attempt, 100% within 6 (mean 1.62), 10.7 s per seed; remaining failures are mostly the reservoir check (no leak-free dam site within 40 tiles) |

## 7. Method and caveats

- **Distances:** chamfer distances (1 and √2), so they can run up to about 8% above true Euclidean.
  "Touching" means Chebyshev distance 1.
- **Saved state:** water, moisture and badwater come from the official maps' saved state, which was
  simulated to near steady state before shipping.
- **Two 0.6 workshop maps** (Beavers Canyons, Meander Multiplayer) are included through their
  heightmaps; their saved water is 0.6-era.
- **Small samples:** two official maps are small and three medium, so their per-size rates are
  indicative.
- **Workshop sample:** nine subscribed maps is a sample of what one player enjoys, not the whole
  workshop.
- **Untested in game:** nothing here was tested in the game. The "Needs in-game check" lists at the
  end of each notes file collect what should be confirmed; PLAN.md merges them into one checklist.
