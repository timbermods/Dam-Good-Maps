# Navigation, ruins and map-editor entities: Timberborn 1.1.2.4 rules

Sources:
- Decompiled assemblies in `investigation/decompiled/Timberborn.*.cs`
- Blueprints in `investigation/raw/blueprints/`
- Map data from 19 official maps in `raw/builtin`, plus 3 dev maps, 9 workshop maps and 2 saves

Analysis scripts are in the session scratchpad (`entities.py`, `context.py`, `neigh.py`, `lines.py`); they are not part of the repo.

Conventions:
- A tile is `(x,y,z)`. `z` is the first air voxel above solid terrain, so an object "on ground at z" has solid terrain at `z-1`.
- "Official" means the 19 non-dev built-in maps.

---

## 1. Navigation: steps, water, obstacles, districts and range

### 1a. Terrain height steps
**Answer:**
- Beavers can't walk up or down any terrain step without help. That includes a 1-voxel step.
- Terrain edges only join two on-ground tiles at the **same z**.
- To cross a 1-level step you need a map `Slope`, or player-built Stairs, platforms and similar.
- Diagonal moves exist. They need the diagonal tile and both orthogonal neighbours to be on ground at the same z, so there's no corner cutting.

**Evidence:**
- `Timberborn.TerrainNavigationSystem.TerrainNavMeshUpdater`
  - `AddTerrainToNavMesh` calls `AddEdgesToNeighbors` for every `OnGround` voxel. `OnGround(c)` means `c` is air and `c.Below()` is solid (`TerrainService.OnGround`).
  - `TilesAreOrthogonallyConnected(c, n)` is `TryGetRelativeHeight(n) <= 0`, where `n` has the same z as `c`. It returns a positive value if `n` is solid, and minus the drop to terrain if `n` is air.
  - `TilesAreDiagonallyConnected` requires `OnGround(n) && OnGround(c+dx) && OnGround(c+dy)`.
- `Timberborn.Navigation.NavMeshSource.UpdateConnectionBetweenNodes` connects two nodes only when **both** directed edges exist, in the same group:
  ```
  if (node.IsConnectedTo(b, out g1, out c1) && node2.IsConnectedTo(a, out g2, out c2) && g1 == g2)
      _navMeshGraph.ConnectNodes(a, b, g1, Math.Max(c1, c2));
  ```
  Only on-ground tiles emit edges. A lower or higher neighbour never sends the reverse edge, so a step is never connected.
- Edge cost: `NavMeshEdge.CreateDefault` gives cost = XY distance, so 1 for orthogonal and 1.414 for diagonal.
- There's no headroom check. A 1-voxel-high cave passage is walkable.
- **Slope** (map object, 1x1x2):
  - Blueprint edges are `(0,0,0)->(0,1,0)`, `(0,0,1)->(0,-1,1)` and `(0,0,0)<->(0,0,1)` at cost 0.4. All are `IsPath:true`, and it has `PathSpec`.
  - It connects ground at z in front (local +y) to ground at z+1 behind (local -y).
  - Data check: 178 of 183 slopes in the built-in maps have exactly that geometry.
  - Slopes count as **road**, so they carry district roads across a step.
  - Official maps have 4 to 23 slopes each; 0 to 5 of them are within 25 tiles of the start.
- Player stairs cost 70 science plus 4 planks and 1 log, so they aren't available on day 1. That's why official maps pre-place Slopes.

**Confidence:** High (code). Movement over slopes and stairs has been seen in-game.

**Implications:**
- Every terrace edge near the start that the colony must cross early needs a `Slope` entity, or a 1-high ramp built from terrain columns.
- Walkability BFS rule for the validator:
  - Orthogonal moves only between on-ground cells at the same z.
  - Diagonal moves only if both orthogonal cells are also on ground at that z.
  - Slope entities add a z to z+1 link.

### 1b. Water
**Answer:** Water never blocks walking, at any depth. The navmesh ignores water entirely.
- Any water in the cell means the beaver is "underwater". Its speed multiplier drops by 0.3, with a minimum.
- The swim animation starts above 0.27 depth.
- Walking in badwater with contamination of 0.05 or more can infect the beaver.

**Evidence:**
- `TerrainNavMeshUpdater` never reads the water map.
- `WalkingSystem.WalkerSpeedManager.GetWalkerSpeedAtCurrentPosition`: `SwimmingPenalty = 0.3` applies when `CellIsUnderwater`, which is `ceil(waterHeight) > z`.
- `SwimmingAnimatorSpec` thresholds are 0.22 and 0.27.
- Beaver base speed is 2.7 (`WalkerSpeedManagerSpec`).
- `BeaverContaminationSystem.ContaminationApplier`: each tick in contaminated water there's a `contamination * 0.01` chance to start a 3-day incubation.

**Confidence:** High.

**Implication:** Rivers aren't barriers for reachability checks. Badwater crossings on early routes are a hazard to avoid near the start.

### 1c. What blocks walking
The rule: an object blocks the tiles it occupies if and only if the template has `BlockObjectNavMeshAdderSpec` and a block whose `Occupations` includes `Bottom`. `NavMeshObjectUpdater.Update` then adds walls around those tiles. Objects without a navmesh adder don't touch the navmesh at all.

| Object | Walk through? | Notes |
|---|---|---|
| Trees, bushes, crops (all `NaturalResources`) | **Yes** | No `BlockObjectNavMeshAdderSpec`. They still block building on the tile. |
| RuinColumnH1..H8 | **Yes** | No navmesh adder. `RuinsNavigation` only adds `BlockObjectAccessible`. Needs in-game check. |
| Thorns | No | Adder, plus `Floor, Bottom, Corners, Path, Middle` |
| Blockage | No | Occupations `All`. The **top is walkable at z+1** (see §5). |
| NaturalDam | No | Occupations `All`. No floor on top. |
| NaturalOverhang | No underneath | Walkable on top (see §7) |
| Relics, UnstableCore, GeothermalField, UndergroundRuins | No | Adder plus `Bottom` |
| StartingLocation | n/a | Replaced by the District Center at game start |

**Confidence:** High for the code path. Walking through ruins is worth one in-game glance.

### 1d. Roads vs bare terrain; district range
There are two graphs:
- The **terrain graph** holds every edge. Beavers physically walk on it.
- The **road graph** holds only `IsPath` edges: Path, Slope, district-center `PathSpec` and so on.
- Road and terrain edges both cost 1. There's no speed bonus for walking on a path.

Evidence: `NavMeshUpdater.EnqueueRegularChange` puts every change in the terrain source, and only `IsRoad` or block changes in the road source.

**District:** there is **no radius**. A district is every road node connected to its District Center. `DistrictRoadFlowFieldGenerator.FillFlowFieldUpToDistance` has no distance cap and stops only at `DistrictObstacle` crossings.
- The only distance rule is cosmetic: a red "large distance" warning when a building's road distance is over 70 (`NavigationDistance.LargeDistrictThreshold`; `DistanceToDistrictDescriber`).

**Road spill** is the terrain reachable from district roads:
- `RoadSpillFlowFieldGenerator` uses `DistrictTerrain = 10`.
- It runs BFS over *cheap* (orthogonal, cost 1) terrain edges from every district road node.
- A tile qualifies if its Chebyshev distance to its root road node is under 10, and it takes under 20 steps.
- Builders can reach anything in road spill: construction (`ReachableConstructionSite`) and demolition (`ReachableDemolishable.IsReachable` calls `IsOnInstantDistrictRoadSpill`). That covers Thorns, Blockage, NaturalDam, relics and Slopes.

**Resource buildings** (lumberjack, gatherer, forester, farmhouse, scavenger):
- They get `BuildingWithTerrainRange` / `BuildingTerrainRange`, which calls `GetTerrainNodesInRange(access, ResourceBuildings = 20)`.
- `TerrainFlowFieldGenerator` counts **steps**: each edge counts 1, including diagonals, up to 20. Real path cost is tracked separately.
- So a yielder must be within 20 walkable moves of the flag or building's access tile.

**Buildings themselves** must have their entrance on a district road. `UnconnectedBuildingStatus` and the `UnconnectedBuildingBlockerSpec` users rely on the `DistrictBuilding` road assignment.

**Confidence:** High.

**Implications for the validator:**
- (a) There must be a connected walkable area around the start where paths can be laid.
- (b) Early resources (bushes, trees, water-pump sites) should be within about 20 walk steps of plausible flag positions. Official maps put them within about 20 Chebyshev tiles of the start (see §11).
- (c) Anything that must be demolished early (Thorns, Blockage) should be within 10 tiles of buildable path.
- (d) Nothing limits how far roads reach, so large maps are fine.

---

## 2. Ruins

### RuinColumnH1..H8 (`RuinSpec`)
- **Yield:** `ScrapMetal = 15 x height`, so H1=15, H2=30, H3=45, H4=60, H5=75, H6=90, H7=105, H8=120.
  - `RemovalTimeInHours 1.8` and `ResourceGroup "Ruin"` for all heights.
  - Data: all 4,964 built-in ruin entities (4,954 official plus 10 in `_mini`) have `Yielder:Ruin.Yield = {ScrapMetal, 15*H}`. The workshop and save maps match too.
- **Carry per trip:** ScrapMetal has `Weight 11` and a beaver's `BaseLiftingCapacity` is 14. `CarryAmountCalculator` gives `max(14/11, 1) = 1` scrap per trip, with 1.8 h removal time. Scavenging is slow, so a big ruin lasts a long time.
- **Shrinking:** `Ruin.UpdateHeight` computes `perLevel = ceil(specYield / H)`. When `ceil(yield / perLevel) != H`, `RuinReplacer.Shrink` swaps in H-1 and keeps the VariantId.
- **Loaded yield:** `Yielder.Load` accepts any amount of the right good. Writing a partial or over-full yield is possible but leads to odd shrink behaviour, so always write `15*H`. If the component is missing, the yield defaults to full.
- **VariantId:** `Configurations/RuinModelFactory.blueprint.json` defines `RuinModelVariants` with ids **A, B, C, D, E**.
  - Each variant asset contains meshes for every height; `IsOfHeight` matches the mesh name by digit.
  - `RuinModelFactory.CreateModels(variantId)` does `SingleOrDefault(id match) ?? random variant`. An **unknown or empty VariantId becomes a random A–E**, and that choice is saved on the next save.
  - The `RuinModels` component itself is read with non-Try `entityLoader.GetComponent(...)`. **Always write `"RuinModels":{"VariantId":"A".."E"}`**; a missing component probably throws on load.
  - Built-in distribution is roughly uniform, with A a little favoured (A 1,243; B 951; C 935; D 923; E 912).
- **Orientation:** ruins are 1x1 and `Flippable:false`, so `Orientation` only rotates the model (Cw0/90/180/270).
  - Official: Cw0 64%, and about 12% each for the rest. Ruins don't use `BlockObjectRandomizablePlacementSpec`.
- **DryObject / BlockObjectState:**
  - `DryObject` is a decorator added to every Ruin in `RuinsConfigurator`. It is **not persisted**: it isn't an `IPersistentEntity`, and its state is recomputed at init from soil moisture at the base (`SoilMoistureService.SoilIsMoist`). It only switches between the wet-ivy and dry model (`RuinModelUpdater`). Contamination also forces the dry model.
  - `BlockObjectState` is saved only when *not* finished. A missing component means Finished (`BlockObjectState.Load`).
  - Old workshop maps (0.6.x) carry `BlockObjectState{Finished:true}`, `DryObject{IsDry}` and `ContaminatedObject`. 1.1 ignores them.
  - **Don't write them.**
- **Stacking:**
  - Block 0 is `MatterBelow GroundOrStackable`; the rest are `Any`. Occupations are `All` and `Stackable:None`.
  - So a ruin can stand on terrain or on a *stackable* object (NaturalOverhang top, levee/dam top, platforms). It can't stand on another ruin, and nothing can go on top of it.
  - Official data: 100% of ruins are directly on terrain. About 1.7% are over a cave, meaning there's air below the ground column.
- **Water:** ruins have no `WaterObstacleSpec`, so water flows through them. They don't block walking either (§1c).
- **Access for scavenging:**
  - Ruins get `BlockObjectAccessible` without `HighBlockObjectAccessesAdder`, so accesses exist only at the ruin's base z.
  - `BlockObjectAccessGenerator` checks 8-neighbours that are on the navmesh at that z.
  - **A ruin needs at least one 8-neighbour on ground at the same z.** Data: 4,961 of 4,964 built-in ruins satisfy this.
- **Official placement pattern:**
  - Clusters ("ruin towns") of 20–130 columns, 2–28 clusters per map, very few singletons.
  - 2.5k–24k scrap per map.
  - The nearest ruin to the start is typically 30–77 tiles away (6–21 on the tiny maps).
  - Height mix: H1 28%, H2 22%, H3 17%, H4 10%, H5 8%, H6 5%, H7 4%, H8 4%.

### UndergroundRuins (5x5x1)
- **What it is:** not a yielder. It has no Yielder, no Demolishable and no science reward. It's the required *understructure* for the scrap mine: Folktails `Mine` and IronTeeth `EfficientMine` both have `UnderstructureConstraintSpec: ["UndergroundRuins"]`.
  - Mine: 5x5x3, 10 workers, costs 250 Log + 350 Gear + 200 TreatedPlank and **4,000 science**. Recipe: 1 TreatedPlank to 5 ScrapMetal per 18 h.
  - EfficientMine adds a 1 TreatedPlank + 2 Extract to 10 scrap recipe.
  - So it's an **infinite late-game scrap source**. There's no excavation.
- **Placement:**
  - All 25 blocks are `MatterBelow Ground` with `OccupyAllBelow` and `Floor,Bottom,Corners,Path,Middle`. That blocks walking and building over the 5x5.
  - `ContinuousTerrainConstraintSpec` rejects placement if any foundation column's *first* terrain ceiling is below z, so there must be no cave or overhang under it (`ContinuousTerrainConstraint.IsNotOnFirstColumnOfTerrain`).
  - `BlockObjectTerrainCutoutSpec` covers all 25 tiles. `TerrainCutout` is **visual only**: it hides the terrain top face so the sunken model shows (`UndergroundModelDepth 2`).
- **Mine entrance:** local (2,-1,0), the middle of one side. The mine can be rotated, so one side needs a flat, walkable, path-connectable front tile.
- **Data:** in 19/19 official maps, 1–4 per map (57 total), all flat and all on the first terrain column. 24–173 tiles from the start (median 89). 11 of 57 have water on them.

**Confidence:** High.

**Implications:**
- Generator: place ruins only on terrain, with an accessible neighbour at the same z.
- Write `RuinModels.VariantId` from A–E, the yield as `15*H`, and optionally a random Orientation.
- UndergroundRuins: exact 5x5 flat footprint, no cave below, 2–4 per map, far from the start.

---

## 3. Relics
| | Size | SciencePoints | Demolish time |
|---|---|---|---|
| SmallRelic | 2x1x1 | **200** | 2 h |
| MediumRelic | 3x2x1 | **800** | 4 h |
| LargeRelic | 3x3x2 | **3000** | 8 h |

- **Reward:** `DemolishableScienceReward.DeleteEntity` adds points only if `DemolishingProgress >= 1`, i.e. when a builder completes demolition. No goods are dropped.
- **Access:** `DemolishableFromTopSpec` gives accesses on neighbouring tiles at levels from the base up to the object's height (`HighBlockObjectAccessesAdder`). It must be in district road spill to be reachable.
- **Placement:** every ground-layer block is `MatterBelow Ground`, so relics must sit directly on flat terrain. They block walking.
- **Data (official):**
  - Small: 10 total in 6 maps, max 3 per map, 13–67 tiles from start.
  - Medium: 13 total in 8 maps, 21–140 tiles.
  - Large: 2 total, 141–172 tiles.
  - All flat.

**Confidence:** High.

**Implication:** Relics are a science bonus scaled by distance. Small ones can be moderately near, large ones remote. Require a flat footprint.

---

## 4. Thorns (`SoilBarrierSpec`)
- **Spec:** `BlockAboveMoisture:false, BlockFullMoisture:true, BlockContamination:true`. That's the same as IronTeeth's IrrigationBarrier.
  - `SoilBarrier` registers the ground coordinate.
  - `SoilMoistureSimulator.CalculateMoistureForCell` returns 0 for full-barrier cells.
  - `SoilContaminationSimulator.GetContaminationCandidate` returns 0 for contamination-barrier cells.
  - So the thorn tile is always dry and clean, and it **cuts moisture and contamination spread** through that soil tile.
- **Walking/building:** blocks walking (§1c) and blocks building. The occupations cover all but Top.
- **Removal:** demolished by builders. `DemolishTimeInHours 10`, no goods cost or reward.
  - `DemolishableEffectsSpec`: Injury -1, probability High. For the `DemolisherNeedApplier` group, High = 0.1, checked **every hour** of demolition (`CheckIntervalInDays = 1/24`), times the game mode's `InjuryChance` (Easy 0.3, Normal/Hard 1.0).
  - On Normal that's about a 65% chance of at least one injury per thorn tile.
  - Must be in road spill.
- **Placement:** `MatterBelow Ground` (terrain only). The editor randomizes orientation and flip (visual only, §12).
- **Data:**
  - 8 of 19 maps. Most have a single blotchy belt of 13–40 tiles (fill 30–70% of its bounding box), placed as a barrier across a corridor or plateau.
  - Pillars has 1,473 thorns in 198 patches inside a shallow flooded plain.
  - Spillage and Craters put patches on wet ground.
  - Nearest to start: 4–56 tiles.

**Confidence:** High.

**Implications:**
- Use Thorns as soft walls: a costly, injury-prone clearing job.
- Keep them out of the starting farmland: they zero moisture on their tiles.
- Don't enclose the start with them.

---

## 5. Blockage
- **What it is:** a 1x1x1 rock plug. Old template name `Barrier`.
  - `FinishableWaterObstacleSpec Height 1.0` makes it a full water obstacle, like a player Levee.
  - Occupations `All`, `Stackable:None`: blocks walking, and you can't build on it.
  - Nav settings add **one-way edges from `(0,0,1)` to the four `(±1,0,1)` neighbours**. With terrain's reverse edges, the **top is walkable** when a neighbour is on ground at z+1, and between adjacent blockages. It is not a road (`IsPath:false`).
  - Demolishable in 4 h, from the top. No reward.
  - Randomized orientation and flip in the editor.
- **Removal:** builders demolish it. Deletion calls `WaterObstacle.RemoveFromWaterService`, so water flows through the opened channel.
- **Data** (418 official, 15/19 maps):
  - 82 of 113 connected groups are 1-wide straight lines of 2–9 tiles. The rest are 2-wide blobs.
  - Typical geometry: a line crossing a **1-deep notch or channel**. The line ends touch terrain walls whose top is exactly z+1, the open sides are at z, and water often sits on one side.
  - So it acts as a plug flush with the banks. It holds water back and doubles as a walkable (non-path) causeway.
  - Pressure uses it to seal water-filled tunnel mouths: roofed, with walls 3–16 high and water level 1.0 behind.
  - All sit directly on terrain.

**Confidence:** High.

**Implications:**
- Use Blockage to plug 1-deep spillways and channels, and to create "blast/dig later" water events.
- Validator: blockage tops are walkable only at bank level, and can't carry roads.

---

## 6. NaturalDam
- **Spec:** 1x1x1, `FinishableWaterObstacleSpec Height 0.65`.
  - `WaterObstacle.AddToWaterService` sets a *partial* obstacle of 0.65 at the base voxel.
  - It **holds water up to base z + 0.65** and overflows above that. That's identical to the player `Dam` (0.65).
  - Occupations `All`, no nav floor: it blocks walking and is **not walkable on top**, unlike the player Dam, which has `GenerateFloorsOnStackable`.
  - Demolishable in 4 h. Deleting it removes the obstacle and releases water.
  - Randomized orientation and flip.
- **Data** (40 official, 6 maps):
  - Short lines of 3–4, plus two 6–8-tile L or blob shapes, spanning a channel wall to wall.
  - The channel is mostly 1 deep: wall top is z+1 (or z+2 or z+3).
  - Observed water: upstream 0.6–0.65 above the base, downstream about 0.15 (Spillage, Lakes).
  - One Pressure line sits roofed in a tunnel.

**Confidence:** High.

**Implication:** Use NaturalDam for "pre-built" 0.65 m reservoirs across 1-deep channels, as a line across the channel's full width. It's a walking barrier, so the banks must provide the crossing.

---

## 7. NaturalOverhang2x1 / 3x1 / 4x1
- **What:** a natural cantilever slab. Footprint is 1 x N x 1 along local +y.
  - Block 0 is `MatterBelow GroundOrStackable`: the base sits on the floor. Blocks 1..N-1 are `Any` and may hang over air or water.
  - Occupations: `All` on the base; the tip block is `Top` only for 3x1 and 4x1.
  - `Stackable: BlockObject` and `GenerateFloorsOnStackable` make the **top at z+1 walkable, and paths can be built on it**. `PathModelTypeEnforcerSpec: Ground` is a visual detail.
  - Water: a full 1.0 obstacle on the base tile only, plus `FinishableHorizontalWaterObstacleSpec` at z+1 over every tile (a horizontal barrier at the slab level).
  - Demolishable in 4 h. `Flippable:false`, `Layout: SideLine`.
  - It's the free natural counterpart of the player Overhang2x1–6x1 path pieces (350–3,000 science).
- **Data** (21 official, 8 maps). Two uses:
  - **(a) Natural bridges.** Two overhangs face each other across a 1-deep channel 5–6 wide.
    - Each base touches a bank wall of height z+1, and the tips meet in the middle.
    - Pairs: 3+3, 2+3 or 3+2 (Hollows x2, Oasis, Pressure x2, Canyon, Meander, Spillage).
    - Water, about 0.2–0.66 deep, flows under the cantilevered tiles.
    - The top joins both banks at z+1 into a walkable, path-capable bridge.
  - **(b) Cave ledges** (Pillars): 4x1, 2x1 and 3x1 side by side, sticking out of a cliff wall under a terrain roof over a 10–13-deep void. Decorative or partial platforms.

**Confidence:** High (geometry from data, rules from code).

**Implication:** To generate a crossing over a narrow 1-deep river, place two facing overhangs whose lengths sum to the channel width. Base tile against each bank; bank top = z+1.

---

## 8. UnstableCore (old names `Bomb` / `TimeBomb`)
- **Spec (2x2x1):**
  - `MatterBelow Ground` on all 4 blocks, Occupations `All` (blocks walking).
  - **Not demolishable**: there's no `DemolishableSpec`, so players can't remove it. Debug tools can.
  - `UnstableCoreSpec`: Min 0, Max 5, Default 5, InnerRadius 1.0.
  - `TimedComponentActivatorSpec`: `CyclesUntilCountdownActivation 5`, `DaysUntilActivation 10.5`, `IsOptionallyActivable:false`.
- **Timer** (`ActivatorSystem.TimedComponentActivator`):
  - On cycle N, day 1, the countdown "activates" (UI warning).
  - From then on, every new day adds 1 to `DaysPassed`. The cycle can roll over.
  - It explodes when `DaysPassed + dayProgress >= DaysUntilActivation`, so about midday of day 11 counting from cycle N day 1.
- **Explosion** (`ExplosionService`, `ExplosionOutcomeGatherer`):
  - Sphere radius `R = ExplosionRadius + 1.0`, centred on the grounded centre of the 2x2. It covers every voxel whose centre is within R, expanding one radius ring per tick.
  - It **removes terrain voxels** (`UnsetTerrain`) and deletes every block object in those voxels.
  - It also deletes objects resting on removed terrain, and runs terrain physics to collapse unsupported terrain and objects above.
  - It kills characters in the affected tiles (`CharacterExploder`).
  - **Chain reaction:** a core whose 4-neighbour tiles get hit also explodes.
  - There's no contamination or badwater effect.
  - In the map editor it is blocked (`UnstableCoreExplosionBlocker`).
- **world.json fields:**
  ```
  "TimeActivatedComponent": {"IsEnabled": true, "CyclesUntilCountdownActivation": N, "DaysUntilActivation": D, "DaysPassed": 0.0},
  "UnstableCore": {"ExplosionRadius": 0..5}
  ```
  - `UnstableCore` is read with non-Try `GetComponent`. It falls back to `TimeBomb`, then **throws**. **Always write it.**
  - `TimeActivatedComponent` is optional (Try) and falls back to the spec defaults.
  - `SetRadius` enforces 0–5.
- **Official usage** (23 cores in Nomads, Pressure and Spillage):
  - `CyclesUntilCountdownActivation` 3–19, always `DaysUntilActivation 10.5`, radius 1–5 (mostly 2–3).
  - 31–143 tiles from the start.
  - Nomads pairs them with ReserveWarehouses full of Explosives.
  - Workshop "Beavers Endgame" uses days 9–90 and radius 0–5.

**Confidence:** High.

**Implications:**
- The generator can use cores as timed terrain-removal events, e.g. breaching a wall into a reservoir.
- Keep them at least about 30 tiles from the start with N ≥ 3.
- Clamp the radius to 0–5.
- Remember the chain reaction when two cores are within R+1 of each other.

---

## 9. GeothermalField (3x3x1)
- **What:** an understructure for the **GeothermalEngine** (Folktails and IronTeeth).
  - The engine costs 50 Log + 30 Plank and 160 science. It's 3x3x2, `UnderstructureConstraintSpec: ["GeothermalField"]`.
  - `MechanicalNodeSpec PowerOutput **400**`, **no workers, no fuel**.
- **Flooding:** both field and engine have `WaterObjectSpec` at the centre tile plus `BlockableFloodableObjectSpec`. A flooded centre blocks the object: smoke off, engine stopped (`WaterObjects.BlockableFloodableObject`).
- **Other effects:** there's no heat, wellbeing or other mechanic in code.
- **Placement:**
  - `MatterBelow Ground` with `OccupyAllBelow` on all 9 blocks; blocks walking.
  - `ContinuousTerrainConstraintSpec`: no cave below.
  - Cutout on the centre tile (visual only).
  - The config is just `BlockObject` coordinates and orientation; no other components.
- **Data** (26 official, 7 maps, 0–7 per map): 13–123 tiles from start (median 59). All flat, on the first terrain column, never under water.

**Confidence:** High.

**Implication:** A free power bonus. Place it on flat, dry ground that won't flood, 1–7 per map.

---

## 10. ReserveWarehouse / ReservePile / ReserveTank (fixed stockpiles)
- **Blueprints:** `BuildingSpec PlaceFinished:true`, cost 10 ScrapMetal, `FixedStockpileSpec`, `UnconnectedBuildingBlockerSpec`.
  | | Size | Good type | MaxCapacity | Entrance |
  |---|---|---|---|---|
  | Warehouse | 2x2x1 | Box | 200 | (1,-1,0) |
  | Pile | 2x2x2 | Pileable | 160 | (1,-1,0) |
  | Tank | 2x2x3 | Liquid | 300 | (1,-1,0) |
- **world.json:** copy the Nomads example:
  ```
  "FixedStockpile":{"FixedGoodId":"Explosives"}, "SingleGoodAllower":{"AllowedGood":"Explosives"},
  "Inventory:Stockpile":{"Storage":{"Goods":[{"Good":"Explosives","Amount":40}]}},
  "StockpileVisualizers":{"CurrentGood":"Explosives"},
  "Inventory:ConstructionSite":{"Storage":{"Goods":[{"Good":"ScrapMetal","Amount":10}]}}
  ```
  - `FixedStockpile` is read non-Try, so it's **required**.
- **Behaviour:**
  - `FixedStockpileRemover` **deletes the stockpile at game start if the good doesn't exist for the chosen faction.**
  - Use Common goods:
    - Box: Berries, Explosives, Fireworks, Gear, PineResin (plus BotChassis/Head/Limb).
    - Pileable: Log, Plank, MetalBlock, ScrapMetal, Dirt, TreatedPlank. TreatedPlank exists in both factions' collections.
    - Liquid: Water, Badwater, Extract.
  - Faction-only goods such as Bread or Carrot vanish for the other faction.
  - It can't be deleted while non-empty (`FixedStockpileDeletionBlocker`).
  - It's unusable until connected to a district (`UnconnectedBuildingBlocker`, `UnreachableFixedStockpileStatus`).
- **Official usage:** only Nomads, with 4 warehouses of Explosives (40/80), 59–109 tiles from start.

**Confidence:** High for code. The exact capacity-overflow behaviour isn't checked, so keep Amount ≤ MaxCapacity.

**Implication:** Good for "cache" rewards. Use Common goods only, and put the entrance tile on walkable ground.

---

## 11. Starting conditions and early survival budget
**GameModeSpec** (`NewGameModes/*.json`):
| | Easy | Normal (default) | Hard |
|---|---|---|---|
| Adults + children | 9 + 4 | 9 + 4 | 9 + 4 |
| Food / Water consumption multiplier | 0.4 / 0.4 | 1.0 / 1.0 | 1.0 / 1.0 |
| Starting food (Berries) / water | 300 / 250 | 130 / **0** | 90 / **0** |
| Temperate days | 16–19 | 13–17 | 5–8 |
| Drought days (handicap mult, cycles) | 2–4 (x0.25, 8) | 5–9 (x0.38, 5) | 15–30 (x0.2, 12) |
| 1st-cycle drought (after handicap) | 1 | 2–3 | 3–6 |
| Badtide | after cycle 5, 40%, 1–3 d | after cycle 4, 40%, 4–8 d | after cycle 3, 40%, 15–30 d |
| InjuryChance / DemolishableRecoveryRate | 0.3 / 0.9 | 1.0 / 0.75 | 1.0 / 0.75 |

Evidence for the table:
- `HazardousWeatherHelper.GetHandicapMultiplier` is `lerp(mult, 1, (cycle-1)/cycles)`.
- The duration is rounded and at least 1.
- The goods go into the District Center: `GameStartup.StartingGoodsProvider` gives `Berries = StartingFood` and `Water = StartingWater`.

**Needs:**
- Hunger `DailyDelta -0.8`, Thirst `-0.7`.
- Both have `StartingValue 1`, `Min -3`, and are lethal at the minimum (`MortalSystem`).
- Berries give 0.3 Hunger each, Water 0.33 Thirst each.
- Beavers eat 1 unit per consumption (`InventoryNeedBehavior.ConsumeGood`).
- `NeedModificationService` multiplies the Hunger and Nutrition-group deltas, and Thirst, by the mode multiplier.
- Children have the same needs (`CharacterType Beaver`).

Per-colony budget (13 beavers):
| | Berries/day | Food stock lasts | Water/day | Water stock lasts | Buffer after stock (need 1 to -3) |
|---|---|---|---|---|---|
| Easy | 13.9 | **~21.6 d** | 11.0 | **~22.7 d** | +12.5 d food, +14.3 d water |
| Normal | 34.7 | **~3.75 d** | 27.6 | **0 d** | thirst reaches 0 after 1.4 d, **deaths ~5.7 d** |
| Hard | 34.7 | **~2.6 d** | 27.6 | **0 d** | same as Normal |

Supply rates:
- **Water pump:** 12 logs, 0 science, 1 worker, 1 water per 0.33 h. That's roughly 45–50 per work-day, enough for about 20 beavers.
  - The input column is local (0,2) of the 2x3 footprint.
  - The pipe reaches down `MaxDepth` voxels below the base: Folktails WaterPump **2**, IronTeeth DeepWaterPump **6** (`WaterBuildings.WaterInput.GetZCoordinateLimitedByDepth`).
- **Blueberry bush:** 3 berries per 12-day regrowth, so 0.25 berries/day each. Sustaining 13 beavers on bushes alone would take about 140 bushes; farms take over.
  - Editor-spawned mature bushes start with random yield growth 1–99% (`NaturalResourceSpawner`).
  - Official saves store `GatherableYieldGrower.GrowthProgress`; 1.0 means ready now.

**Official calibration** (Chebyshev from start centre):
- Blueberry bushes within 20 tiles: 3–128, median about 50, about 55% ready.
- Trees within 20 tiles: 63–277.
- Nearest clean water with depth ≥ 0.3 and contamination < 0.05: 1–17 tiles (median about 11). Its surface is 0.2–1.7 below the start z, within Folktails pump reach.
  - Outliers are the deliberately hard maps: Nomads 71, HelixMountain 35 (above start), Waterfalls 36 (-4.6).
- Ruins within 20 tiles: 0 in 17 of 19 maps.

**Implications for "resources near start" rules (Normal):**
- Clean pumpable water within about 12 tiles (hard cap about 20) and at most 2 voxels below the start plateau. Deaths begin about 5.7 days without it.
- At least 40–60 bushes within 20 tiles, at least half with `GrowthProgress 1.0`. Food runs out in about 4 days.
- At least 100 trees within 20 tiles.
- Keep Thorns, cores and ruin towns out of the 20-tile start zone.

**Confidence:** High for the numbers. Work hours per day are assumed, not read.

---

## 12. Map-editor tools relevant to generation
- **`MapEditorPlacementRandomizing.BlockObjectPlacementRandomizer`:**
  - Applies only to templates with `BlockObjectRandomizablePlacementSpec`: Blockage, NaturalDam, Thorns, WaterSource and DevWaterSource.
  - When placed (not loaded) and the toggle is on, it picks a random `Orientation` (0–3) and a 50% `Flipped`. It saves nothing extra; the `BlockObject` Orientation and Flipped fields are what's written.
- **Trees and bushes:**
  - The forest brush uses `NaturalResourceFactory.SpawnIgnoringConstraintsAndRandomizePosition`, which adds `CoordinatesOffsetterInit`.
  - It's saved as `"CoordinatesOffsetter":{"Random":true}`. The actual ±0.25-tile offset is derived deterministically from the EntityId (`IFakeRandomNumberGenerator`, seed 208621589).
  - Official data: 100% of 50k+ trees and bushes have it, and none have an Orientation.
  - `NaturalResourceModelRandomizer` scale and rotation also come from the EntityId and are **not saved**. Example for Pine: height x0.8–1.0, width x0.9–1.1, rotation 0–360.
  - So a generator should write `CoordinatesOffsetter.Random=true`, give each entity a unique Id, and skip Orientation.
- **Forest brush density** (`NaturalResourceSpawningBrushTool` plus `Brushes.BrushProbabilityMap`):
  - Each tile gets a fixed uniform random value per session. A tile spawns if `value <= Density` (0–1, default 1) and is empty.
  - The species is chosen uniformly from the enabled set.
  - Mature spawns get growth 1.0 and a gatherable yield grown 1–99% (`RandomizeYieldGrowth`). Seedlings get growth 0–0.8.
  - Result: white-noise coverage at fraction Density.
- **Save-time enforcement:** none. `MapPersistenceController.ForceSaveAs` just saves.
  - A missing StartingLocation only shows an alert (`MapEditorUI.NoStartingLocationAlertFragment`).
  - Placing a second StartingLocation deletes the first (`StartingLocationService.DeleteOtherStartingLocations`).
- **At game start:** `StartingBuildingInitializer` puts the faction District Center at the StartingLocation's exact `Placement`, including orientation.
  - The DC is 3x3x5 with its entrance at local (1,-1,0), like the StartingLocation.
  - With **0** StartingLocations nothing is placed automatically. With **more than 1**, `GetStartingLocation` throws.
  - **Write exactly one**, on a flat 3x3 with a walkable, path-connectable entrance tile.
- **Map metadata:** `map_metadata.json` holds `Width, Height, MapNameLocKey, MapDescriptionLocKey, MapDescription, IsRecommended, IsUnconventional, IsDev`.

**Confidence:** High.

---

## Needs in-game check
1. Beavers visibly walk *through* RuinColumn tiles (no navmesh object), the same way they walk through trees.
2. A 1-voxel terrain step with no Slope or stairs is impassable in both directions. Slope connectivity already matches the data, 178/183.
3. Blockage top: beavers walk onto it only from bank tiles at z+1, and a path can't be built on it.
4. A world.json ruin without a `RuinModels` component, or with an empty VariantId: crash or random variant? The code suggests an empty VariantId gives a random variant and a missing component throws.
5. A world.json UnstableCore without the `UnstableCore` component: expected load exception.
6. ReserveWarehouse with a faction-foreign good is deleted at start. Also check Amount > MaxCapacity behaviour.
7. NaturalDam holds water at 0.65 and releases it on demolition; Blockage demolition floods the channel.
8. Actual scavenge rate. Code says 1 scrap per trip because ScrapMetal weighs 11 against capacity 14; check bots and bonuses.
9. Water-pump effective daily output (work hours per day) for the calibration in §11.
10. Explosion reach vs objects: is the District Center destroyed if inside R, and do `INonStackPickable` items survive?
