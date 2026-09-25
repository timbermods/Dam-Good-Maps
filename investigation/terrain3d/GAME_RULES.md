# How Timberborn handles terrain above terrain

Step 1 of the terrain-3D investigation: the game's rules for caves, tunnels, overhangs and arches,
read from the decompiled code of Timberborn 1.1.2.4 (build `52e959e`). The installed game's
`Version.txt` reads `1.1.2.4-52e959e-sw`; the DLLs are dated 2026-09-04 and the decompiled folder
2026-09-23, so the decompiled code matches.

The rules are described in our own words, citing class and member names. Nothing here is copied
code. Where a rule corrects `investigation/notes/`, the correction is marked **Correction**.

Confidence is high throughout (read directly from code). The stacked-water rules are also
confirmed against the water stored in real maps (§3.8). What still needs the game is in §8.

## 1. Terrain: storage and change

**Storage.**
- `TerrainMap` holds one solid/air flag per voxel: 23 layers, index z·X·Y + y·X + x (FORMAT.md §4.2).
- `ColumnTerrainMap` turns each tile into solid runs [floor, ceiling). Here "ceiling" means the
  run's top, the walking surface, not a cave roof.
- Run 0 always starts at z = 0. When the bottom voxel is air, run 0 is empty (floor 0, ceiling 0),
  so every run that does not touch the bottom is run 1 or higher (`LoadColumns`).
- `ITerrainService.Underground(c)` means solid. `OnGround(c)` means c is air and the voxel below is
  solid.
- `CeilingRetriever.GetCeilingAtOrBelowHeight` returns the highest run top at or below a height.
  Only soil moisture and soil contamination use it.

**Height limits.**

| Where | Limit | Member |
|---|---|---|
| Map editor tools | tops at 16 | `MapSize.MaxMapEditorTerrainHeight` (`BrushHeightPanel`, relative brush, sculpting `z < 16`) |
| The game | tops at 22 | `TerrainService.SetTerrain`; player terrain blocks need z < 22 (`TopTerrainLevelValidationConstraint`) |
| The file | layer 22 must stay empty | more than 22 layers are truncated on load (FORMAT.md §4.3) |

So a map can hold terrain in layers 0–21 (surface up to 22). The official maps top out at 16; 19 of
130 workshop maps go higher (ROADMAP, Later).

**The map editor can make caves.**
- `AbsoluteTerrainHeightBrushTool` and `RelativeTerrainHeightBrushTool` move the top of the run at
  the clicked level. They can raise or lower a cave floor, but they cannot make a roof.
- `SculptingTerrainBrushTool` adds or removes single voxels, at most 100 per drag
  (`AreaPickersSpec.SculptingMaxBlocks`):
  - adding goes on the clicked face, side faces included, which makes overhangs; it keeps only the
    voxels that pass the support rule (`GetValidTerrainToAdd`);
  - removing takes the clicked voxel, which carves caves and tunnels; the support cascade then runs.
- Level slicing (`MaxVisibleLevel`) lets the tools reach inside caves.
- `TerrainUndoSystem` records each vertical change per tile, so voxel edits undo exactly.

**Terrain changes during play.** Players can reshape terrain:
- Dynamite (depth 1–3) removes voxels straight down from below the charge and stops at any object
  (`CalculateEffectiveDepth`). It chain-triggers neighbouring charges and cores.
- `Tunnel` (2,000 science) removes the one voxel at its position (`Tunnel.Explode`) and leaves a
  finished `Platform` in the hole to hold the roof (`TunnelSpec.TunnelSupportTemplateName`). The
  game's own tunnels are therefore 1 high.
- `UnstableCore` explodes a sphere of radius `ExplosionRadius + 1`, one ring per tick
  (`ExplosionOutcomeGatherer`).
- `DirtExcavator` strips voxels from the top of a 5×5 area.
- `TerrainBlock` (an `UnfinishedGround` stackable, `MatterBelow Any`, attachable to a terrain side)
  raises terrain on finish (`GroundRaisingService`), so players can build overhangs up to 3 long.

## 2. The support rule

**On load** (`TerrainPhysicsPostLoader.ValidateAll`, in both the game and the map editor):
- A queue starts at z = 0 on every tile with distance 0.
- A solid voxel reached with distance d is valid (`ValidateTerrain`). The voxel above it is queued
  with distance 0. If d < 3 (`TerrainPhysicsValidator.MaxSupportDistance`), its four sideways
  neighbours in the same layer are queued with d + 1.
- Support passes only through solid voxels, and through stackable block objects
  (`ValidateBlockObjects`: a finished stackable's top counts as ground, and `UnfinishedGround`
  blocks pass support sideways). It never passes downward.
- Every voxel in run 1 or higher that was not reached is deleted with a loading issue
  (`GetTerrainToUnset`, `RemoveTerrain`). Objects whose ground is gone are deleted too
  (`RemoveBlockObjects`). The pass repeats until nothing changes.

**In play** (`TerrainPhysicsValidator.BuildDistanceField`, run by `TerrainPhysicsUpdater` after every
removal) is the same rule, stated from the other side:
- a voxel is a seed when the voxel below is solid or holds a finished stackable block;
- validity spreads through 4-connected solid voxels in the same layer, up to 3 steps;
- the cascade then destroys the voxels that became invalid (re-checking the voxel above and the
  four corners), the `Underground` objects inside them, and the foundations standing on them.

`TerrainPhysicsDeletionBlocker` stops a player from demolishing a stackable that holds terrain up.

**What the rule allows:**

| Shape | Limit |
|---|---|
| A cantilever (a ledge sticking out of a wall) | 3 tiles per layer |
| A flat roof one voxel thick between two walls | spans at most 6 air tiles |
| A thicker roof | the same 6: its bottom layer decides the span |
| A corbelled (stepped) overhang or arch | each layer may reach 3 tiles beyond the layer below it, so a gap closes by 6 per layer |
| A leaning cliff | leans out by up to 3 tiles per level, with no limit on total lean |
| A hanging column (a stalactite with nothing below) | never supported |
| A run floating over air that reaches down to z = 0 | never supported by itself; needs a sideways chain of 3 or fewer to supported voxels in each layer |

The corbel rule is what makes tall overhangs and big arches possible.
- An arch over a gap of G tiles needs ⌈G/6⌉ layers of corbelling (G = 18 closes in 3 layers).
- An overhanging cliff 10 levels tall can lean out 30 tiles at its top.

`proto/support-tests.ts` checks these limits against a port of the rule (`proto/support.ts`), shape
by shape up to the full height. All 38 shapes behave as the table says (`results/support.json`).

**Correction** (blocks_and_placement.md §5, format_1_1.md §4.2): "the first solid run of each cell
is always kept" holds only for the run that starts at z = 0. Support resets to 0 on every voxel that
stands on a supported voxel, so "3 tiles" means 3 in one layer, not 3 in total.

**Our validator.** `unsupportedVoxels` (`src/core/validate/checks.ts`) and `terrain_unsupported`
(`prototype/validate.py`) implement this rule, but they only run when a tile has two or more floors
(INVENTORY.md, bug 1).

## 3. Water in stacked layers

### 3.1 Columns

Every tile starts as one open column [0, 34): 34 is the total height 33 plus 1
(`WaterSimulator._maxColumnHeight`). Then, in `CreateColumns`, every solid voxel is added as a
**full obstacle**, bottom to top:
- an obstacle at a column's floor raises the floor;
- an obstacle at its top lowers the ceiling;
- an obstacle inside a column splits it in two;
- an obstacle filling a whole 1-high column removes it.

Map objects then add their own obstacles (the blueprints' `WaterObstacleSpec` and
`FinishableHorizontalWaterObstacleSpec`, applied by `WaterObstacle.AddToWaterService` and
`HorizontalWaterObstacle`):

| Object | Adds |
|---|---|
| Blockage | a full obstacle at its cell |
| NaturalDam | a partial obstacle (height limit) 0.65 at its cell (a height below 1 becomes a partial obstacle) |
| NaturalOverhang2x1–4x1 | a full obstacle at the base, and a horizontal obstacle at z + 1 over every tile |
| BadtideDrain | a full obstacle at the back (0, 0), horizontal obstacles at (0, 1) at z and z + 1, and a direction limiter at the emitter (0, 1, z) |

- A horizontal obstacle at z splits the column there with zero thickness: the lower column's
  ceiling and the upper column's floor are both z. It does nothing if z is already a floor.
- The cantilevered cells of a NaturalOverhang are not obstacles. Water fills the slab's own cells
  under the plane at z + 1.
- The obstacles are added when the object reaches its finished state. The drain's limiter is added
  at initialisation and never removed.

**Correction** (water_and_soil.md Q6): the drain also adds a horizontal obstacle at its own z
(the emitter's floor plane), which pins the emitter column's floor where the limiter is keyed.

### 3.2 Flow

Water never moves up or down within a tile. It moves sideways between columns of 4-neighbour tiles
(`OutflowsUpdateTask.Outflow`):
- For each wet column, in the direction order −y, −x, +y, +x and the neighbour's slot order:
  - skip a neighbour column whose ceiling is at or below this column's floor;
  - stop at the first whose floor is at or above this column's water surface.
- So water in a cave flows into every neighbouring gap it overlaps. A deep lake beside a tile with
  a slab flows both under and over the slab.
- Water gets from a roof top down into a cave only sideways: into a neighbouring tile whose gap
  reaches down (a shaft or an opening), never through the roof of its own tile.

**The flow formula** (`GetOutflow`): the new flow is 0.999 × the stored momentum toward that target
column, plus 2.25·dt × the head difference. The head of a column is its floor + depth, plus 8 ×
overflow.
- The part of the difference that is pressure counts only 1/8. That is the origin's overflow head,
  or the part of the difference above the target's ceiling.
- The spill threshold (−0.1 onto a dry target with the same floor) applies to the map's padding too.
- Partial obstacles are looked up from max(origin floor, target floor) to the origin's ceiled
  surface (`FlowLimitCalculator.GetHeightLimit`).
- Direction limiters: a limited column accepts inflow only in its direction, and gives outflow
  only along its axis (`CanInflowInDirection`, `CanOutflowInDirection`).
- Outflows beyond what the column holds (depth + overflow) are scaled down.

**The depth update** (`WaterParametersUpdateTask`): net flow minus evaporation, times dt, through
`WaterDepthSetter`. The stored momentum per target column is max(0, f − 0.8 × the reverse flow).

### 3.3 Pressure, overflow and roofs

- A column filled to its ceiling keeps the excess as `Overflow` (`WaterDepthSetter.SetWaterDepth`).
- Overflow is capped at (34 − ceiling)/8 (`WaterOverflowCalculator.ClampOverflow`). **Water beyond
  the cap is destroyed.** A sealed cave with a source inside fills, pressurises, and then loses
  whatever its source adds.
- Pressure carries head through full passages. A cave column next to an open lake whose surface is
  2 above the cave's roof holds 2/8 = 0.25 of overflow. Full passages can siphon water up to the
  head of the water behind them, damped by the factor 8.
- Every official map with a cave full of water stores these pressures. Hollows stores 23
  pressurised columns, and our port reproduces them (§3.8).

### 3.4 Sources, the edge and evaporation

**Sources.**
- A source adds dt·S/N to the column that contains its z (`UpdateWaterSourcesTask`). A source in a
  sealed cave builds pressure; seeps stop above 0.8 deep, so a full 1-high cave silences them.
- `WaterMapBoundary` fills the padding beside every emitting cell (`FullyBlockCell`), even for
  emitters that are off.
- Placement (`ContinuousTerrainConstraint.IsNotOnFirstColumnOfTerrain`) applies to water sources,
  seeps, badwater sources, drains, aquifers, geothermal fields and underground ruins. They must
  stand on the top of run 0, the run that reaches down to z = 0.
  - Allowed: a cave floor with solid rock under it, whatever the roof.
  - Refused: roof tops, arch tops, ledges, and the floor of a cave that has another cave under it.

**The map edge.** The padding is an open column that is never updated, so it drains every gap that
touches the edge. A cave that opens onto the map edge drains out of the map.

**Evaporation** is per column. The cluster saturation (`WateredNeighborsCountingTask`,
`ClusterSaturationCalculationTask`) counts neighbour tiles with a wet column whose air gap overlaps
this column's gap:
- It compares air gaps, not water surfaces. An open column overlaps almost everything above its
  floor.
- Quirk: if the neighbour's slot-0 floor is at or above this column's floor, only slot 0 is tested.
- The modifier follows the saturation as on the surface. Cave water evaporates like open water:
  nothing in the game models shelter from the sky.

### 3.5 Saving and loading

- Water is stored per slot: index slot·X·Y + y·X + x, where slot is the k-th column from the
  bottom.
- On load the columns are rebuilt from terrain and objects first. Then depth, old depth,
  contamination, overflow and momentum are copied by slot (`WaterSimulator.PostLoad`).
- A writer must put cave water in the right slot and write `Levels` = the most columns in any tile.
- Momentum (`ColumnOutflows`) targets are padded 3D indices of the neighbour column. All 259,954
  stored targets on the 19 official maps land on columns of our graph (`proto/stackwater.ts`
  `setMomentum` drops none).

### 3.6 Badtide drains

- A drain sits in a 1-high notch in a cliff. Its emitter column is 1 high, between its floor plane
  and its roof plane, and its back cell is solid.
- It runs only in badtide (`HazardousWeatherWaterSource`), at contamination 1.
- Its limiter lets water out forward only, and lets nothing flow back in.
- Its outlet (0, 2) is open air over a drop. All 61 official drains sit this way (notes Q6).

A generator with caves can make the notch, which is terrain above terrain. That is what PLAN §5.7
said was missing.

### 3.7 Water rendering

For information only; it is not a rule:
- The game draws water per 16×16 chunk and per slot (`WaterMesh`), from per-slot texture arrays of
  depth, floor, ceiling, flow and contamination.
- A compute pass links edges, skirts and waterfalls (`WaterColumnPostprocessor`).

### 3.8 Confirmation against real maps

`proto/stackwater.ts` ports these rules, and the official maps confirm them:
- One game day from each map's own stored water and momentum keeps the water in place: the same wet
  columns on 18 of 19 maps (0.999 on the last), and every pressurised column pressurised.
- From a computed start it reproduces the stored water on 17 of 19. The other two hold aquifer and
  seep water that no steady state shows.
- On heightfield maps it can run bit for bit like today's port.

DESIGN.md §3.2 and `results/water-official.json` have the numbers.

## 4. Walking

- **Every air voxel on solid ground is a walking node**, in every layer
  (`TerrainNavMeshUpdater.AddTerrainToNavMesh`). Cave floors, tunnel floors, ledges, arch tops and
  bridge tops are ordinary ground.
- **No headroom check.** `TilesAreOrthogonallyConnected` tests only the neighbour's voxel at the
  same z. Nothing reads the voxel above a walking tile, and the game's own `Tunnel` digs 1-high
  passages. A 1-high tunnel is walkable.
- **Terrain never joins levels.**
  - Two tiles connect only at the same z. `NavMeshSource.UpdateConnectionBetweenNodes` needs both
    directed edges, so a step of one level is never walkable.
  - Diagonal moves need the diagonal tile and both orthogonal tiles on ground at the same z
    (`TilesAreDiagonallyConnected`).
  - Roofs change neither rule.
- **What joins levels:**

  | Joiner | Size and cost | Rises |
  |---|---|---|
  | `Slope` (map object) | 1×1×2, free on the map | 1 |
  | `Stairs` | 1×1×2, 70 science | 1 |
  | `SpiralStairs` | 1×1×2, 350 science | 1 |
  | `Platform`, `DoublePlatform`, `TriplePlatform` | player-built | 1, 2 or 3, as a new floor on top (`GenerateFloorsOnStackable`) |
  | `Tunnel` | 2,000 science | cuts through a wall, same level |

- **A Slope needs only its own two cells to be air**, at z and z + 1
  (`BlockValidator.BlockConflictsWithTerrain`).
  - The high side needs air at z + 1.
  - A roof at z + 2 over the slope or its high side is fine, so slopes work inside caves and under
    ledges.
  - A slope whose high side is solid still places, because nothing validates neighbours. It is a
    dead end.
- **Floors on objects.** A floor generated on a stackable (a platform, or an overhang's top) is
  blocked when the cell above it is terrain. The top of a NaturalOverhang is walkable only with
  air above it.
- **Accesses.** Construction and demolition reach an object only from levels without terrain in
  the way (`BlockObjectAccessGenerator`, `NoTerrainInTheWay`). Under a roof, objects are worked on
  from their own level. Road spill and district range ignore roofs, and districts have no radius.

**Correction** (navigation_ruins_entities.md §1a, §1c):
- slopes need no headroom beyond their own two cells;
- NaturalOverhang blocks walking underneath only at its base and middle cells, while the 3×1/4×1
  tip (`Top`-only) can be walked under;
- "walkable on top" needs air above.

## 5. What may be placed or grow under a roof

**Objects.** `BlockValidator.BlockValid` tests only an object's occupied cells against terrain. No
validator looks for terrain above an object: not TerrainLevel, UndergroundTerrain, ContinuousTerrain,
NoTerrainRemoverBelow, TerrainPhysics, Understructure or StartingBuildingPlacement. Anything fits
under a roof if its occupied cells are air.

| Object | Air it needs above its floor | Other rule |
|---|---|---|
| StartingLocation (3×3×5) | z … z + 4 on all 9 tiles (all 45 blocks occupied): **the roof at z + 5 or higher** | the District Center that replaces it occupies 21 of those cells, so it always fits |
| Pine, Oak (and Maple, Chestnut) | 3 | — |
| Birch, Succulent (and Mangrove) | 2 | — |
| Blueberry bush | 1 | — |
| Ruins, relics, thorns | their block height | — |
| Water sources, seeps, drains, aquifers, geothermal fields, underground ruins | — | on the top of run 0 (§3.4) |
| Slope | z and z + 1 | — |
| WaterPump (2×3×3, BaseZ 1) | floor and floor + 1 | its lip must overhang a drop; a roof at floor + 2 is fine |

- A map file with a tree under a roof lower than its blocks loses the tree on load.
- Plants have no stunted state, because their blocks never change as they grow.

**Plants.**
- Nothing checks sky, sunlight or light. `Growable` pauses only when the plant is dying.
  Reproduction (`NaturalResourceReproducer`) spreads to the 4 orthogonal neighbours at the same z.
  Spawning (`SpawnValidationService.CanSpawn`) needs moist soil, clean soil and the blueprint's
  blocks to fit.
- A moist cave floor with a roof 3 or more above can hold a forest.
- `Illuminator` and the sky system are visual only.

**Pumps.** A pump's pipe scans down from floor − 1 to floor − MaxDepth in the input tile's own
column (`WaterInputPipeCoordinates.GetZCoordinateLimitedByDepth`). It stops above the first terrain
voxel, or above an occupying object, and never passes through terrain. It draws from the water
column holding that cell.

| Pump | MaxDepth |
|---|---|
| WaterPump | 2 |
| BadwaterPump | 2 |
| LargeWaterPump | 4 |
| MechanicalPump | 5 |
| DeepWaterPump, DeepBadwaterPump | 6 |
| DeepMechanicalPump | 8 |

A beaver can pump from a cave pool from the cave's own floor, or from a ledge above open water. It
cannot pump through a roof.

**Correction** (blocks_and_placement.md §2): "valid ground for trees: any solid voxel plus an
empty cell" is wrong. The whole blueprint must fit: 3 air cells for pine and oak, 2 for birch and
succulent, 1 for bushes.

## 6. Moisture and contamination with terrain above terrain

**Moisture** is stored per terrain run: slot j, index j·X·Y + tile. Every run top has a value: cave
floors, roof tops, ledge tops (`MoistureCalculationTask`, `SoilMoistureSimulator.Save`). A plant
reads the run whose top is its base z.

For a run top at height z (`CalculateMoistureForCell`):
1. **Own water.** If the water column whose floor is z holds clean water, the value is 2·sat. The
   saturation is that column's own: a 1-wide tunnel stream gives about sat 3, a range of 6.
2. **Water in a cave below the run.** The value is range − 6·(roof thickness − 1), and it applies
   only when the column directly under the run is **filled to its ceiling**. A roof 1, 2 or 3 thick
   gets 16, 10 or 4 at sat 8, and a partly filled cave gives nothing through its roof.
3. **Neighbouring water.** From each 4-neighbour, only the topmost wet column with its floor at or
   below z counts. Its ceiled surface must be above the run's floor, and each level from that
   surface up to z costs 6.
4. **Spread.** From the 8-neighbour runs whose [floor, ceiling] overlaps this run, both ends
   inclusive. The cost is 1 or 1.414, plus 6 per level up; downhill is free. A wet surface beside a
   cave mouth moistens the cave floor. A cave floor never feeds the roof top unless their runs
   overlap.

**Correction** (water_and_soil.md Q3):
- rule 2 is about the run above the water, not "a tile under a full water column";
- rule 3 takes only the topmost wet column, which can hide cave water below a higher pool.

**Soil contamination** has the same slot layout and a similar pattern
(`GetContaminationFromWaterBelow`):
- Through a roof over a full cave: 2(c − 0.5) − (5/7)(thickness − 1). Pure badwater reaches roofs
  up to 2 thick.
- There is no own-tile water term.
- Direct water uses the topmost column with contamination above 0.
- Spread gives no credit for water depth.

## 7. Other differences for terrain above terrain

- **Rendering** (`TerrainMeshManager`): the game meshes terrain as a dual grid of authored pieces,
  marching-cubes style.
  - Each lattice corner reads 2 bits per surrounding cell, giving the states Lower, Equal (a top),
    Overhang (an underside) and Higher.
  - 256 combinations map to prefabs in 4 rotations, in chunks of 16×16×8, with no LOD.
  - Per-top material data are texture arrays with one layer per z (`TerrainMaterialMap`).
  - `TerrainLayerSliceUpdater` draws the cut layer when the view is sliced.
  - This informs our mesher (DESIGN §7). We draw our own geometry and use none of the game's assets.
- **Ceilings are not a gameplay concept.** "Ceiling" in the column API means a run's top. No
  mechanic tests for sky above a tile: not walking, growth, evaporation or needs.
- **Stackables hold terrain.** A NaturalOverhang, a platform or a drain body supports terrain
  placed on it (§2).

## 8. Still to check in the game (for the Probe)

Each needs a small test map from DESIGN §8:
1. Beavers walk a 1-high and a 2-high tunnel. A Slope with a roof at z + 2 works.
2. A generated cantilever 4 long is deleted at load; 3 long stays. A corbelled arch stands.
3. Water behaves as §3 says:
   - a sealed cave with a source builds pressure and loses water past the cap;
   - a full passage siphons;
   - cave water drains through a tunnel to the map edge.
4. Moisture on a cave floor, and on roof tops 1, 2 and 3 thick over a full cave.
5. A pine under a roof 3 above loads and grows. One under a roof 2 above is removed.
6. A pump on a ledge draws from a pool below it, and not through a roof.
7. Terrain in layers 17–21 loads, renders and plays (PLAN §18 E1).
