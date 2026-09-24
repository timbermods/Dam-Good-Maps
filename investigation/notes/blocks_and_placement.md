# Blocks, footprints and placement rules (Timberborn 1.1.2.4)

Sources: decompiled assemblies in `investigation/decompiled/`, blueprints in `investigation/raw/blueprints/`, and maps in `raw/builtin` (19 official 1.1 maps + 3 dev maps), `raw/workshop` (9 player maps, 0.6 to 1.0), `raw/saves` (2 saves from 1.1.2.4) and `raw/user` (1 generator map).
Verification scripts emulate the game's load-time block validation. They ran from the session scratchpad and are not saved in the repo.
The machine-readable version is `notes/footprints.json`.

Grid convention (`Timberborn.Coordinates` `CoordinateSystem.GridToWorld`): grid x is east, grid y is north and grid z is up. Unity world is (x, z, y).

---

## 1. Footprints and the Orientation/Flip transform

### Answer
- `BlockObject.Coordinates` in world.json is the **pre-rotation origin**: blueprint block (0,0,0) lands on it. It is **not** the minimum corner of the rotated footprint.
- Saved `Coordinates.Z` = `Coordinates.z + BaseZ`. `BaseZ` = 0 for every map template.
- Transform for every blueprint block, entrance, cutout tile, water-source tile and water obstacle:

  ```
  world = Coordinates + R(F(local))
  F(x,y,z) = (Size.x-1-x, y, z)   only if Flipped AND blueprint Flippable, else identity
  R: Cw0 (x,y) | Cw90 (y,-x) | Cw180 (-x,-y) | Cw270 (-y,x)      (z unchanged)
  ```

  Cw90 turns local +x (east) into -y (south), which is clockwise seen from above.
- Rotated bounding box for an Sx by Sy footprint with Coordinates (X,Y):

  | Orientation | x range | y range | Coordinates for a desired min corner (Mx,My) |
  |---|---|---|---|
  | Cw0 | X .. X+Sx-1 | Y .. Y+Sy-1 | (Mx, My) |
  | Cw90 | X .. X+Sy-1 | Y-Sx+1 .. Y | (Mx, My+Sx-1) |
  | Cw180 | X-Sx+1 .. X | Y-Sy+1 .. Y | (Mx+Sx-1, My+Sy-1) |
  | Cw270 | X-Sy+1 .. X | Y .. Y+Sx-1 | (Mx+Sy-1, My) |

- Flip mirrors inside the unrotated width (x becomes Sx-1-x), so it never changes a full rectangular footprint's cells. It only matters for the asymmetric LargeRelic z1 layer and for entrances.
  - Flippable templates: Blockage, NaturalDam, Thorns, SmallRelic, MediumRelic, LargeRelic, UnstableCore, WaterSource, WaterSeep, BadwaterSeep, ReservePile, ReserveTank, ReserveWarehouse.
  - For every other template `Flipped` is ignored on load (`FlipMode = Flippable && Flipped`).
- Entrances:
  - The spec coordinate (StartingLocation, DistrictCenter and Reserve* all use (1,-1,0), just outside the footprint) is transformed like a block.
  - The door faces `Orientation.Transform(Down)`: Cw0 -y, Cw90 -x, Cw180 +y, Cw270 +x.
  - Doorstep (inside the footprint) = entrance minus the facing offset. Flip moves the entrance tile but not its facing.
- Blueprint `Blocks` order is `index = (z*Size.y + y)*Size.x + x`: z-major, then y, then x.

Per-template occupied cells are listed in `footprints.json` (`tiles_cw0`, full `blocks`, `footprint2d_by_orientation`). Summary (G = Ground, GS = GroundOrStackable, A = Any; FBCPM = Floor|Bottom|Corners|Path|Middle, no Top):

| Template | Size (x,y,z) | Occupied cells / notes |
|---|---|---|
| StartingLocation | 3,3,5 | z0 9 x GS:B,T,C,P,M (no Floor); z1-4 all A:All. Overridable. Entrance (1,-1) |
| Slope | 1,1,2 | z0 GS:F,B,T,P,M; z1 **Air**:F,B,P |
| WaterSource | 1,1,1 | G:All + OAB; water (0,0) |
| BadwaterSource | 3,3,1 | 9 x G:FBCPM + OAB; water on all 9 tiles; cutout (1,1) |
| RuinColumnH1..H8 | 1,1,h | z0 GS:All; z1..h-1 A:All |
| UndergroundRuins | 5,5,1 | 25 x G:FBCPM + OAB; cutout all 25 |
| Blockage, NaturalDam | 1,1,1 | GS:All |
| Thorns | 1,1,1 | G:FBCPM |
| NaturalOverhangNx1 | 1,N,1 | y0 GS:All:stackable; middle tiles A:All:stackable; last tile of 3x1/4x1 A:Top:stackable (tip) |
| UnstableCore | 2,2,1 | 4 x G:All |
| BadtideDrain | 1,3,1 | y0,y1 G:All:stackable + OAB; y2 A:Middle (spout); water (0,1), flows toward local +y |
| GeothermalField | 3,3,1 | 9 x G:FBCPM + OAB; cutout (1,1) |
| WaterSeep, BadwaterSeep | 2,2,1 | 4 x G:FBCPM + OAB; water and cutout on all 4 |
| Aquifer | 3,3,1 | plus shape (1,0),(0,1),(1,1),(2,1),(1,2) G:FBCPM + OAB; corners unoccupied; water and cutout (1,1) |
| SmallRelic / MediumRelic | 2,1,1 / 3,2,1 | G:FBCPM |
| LargeRelic | 3,3,2 | z0 9 x G:All; z1 (0,0),(1,0),(0,1) All, (1,1) FBCPM, rest none |
| ReservePile / Tank / Warehouse | 2,2,2 / 2,2,3 / 2,2,1 | z0 GS:All, upper layers A:All; entrance (1,-1) |
| AncientAquiferDrill | 3,3,5 | z0 plus shape G:**Top only**; tower A:All at (1,0) and (1,1) for z1-3, and at (1,1) for z4 |
| Pine, Oak, Maple, ChestnutTree | 1,1,3 | z0 G:All, z1 A:All, z2 A:FBCPM |
| Birch, Mangrove, Succulent | 1,1,2 | z0 G:All, z1 A:FBCPM |
| BlueberryBush, Dandelion, CoffeeBush | 1,1,1 | G:FBCPM |

### Evidence
- `Timberborn.BlockSystem`:
  - `BlockObjectSpec.GetBlocks(Placement)` and `Blocks.Transform`: `placement.Orientation.Transform(placement.FlipMode.Transform(coordinates, Size.x)) + placement.Coordinates`.
  - `BlockObjectSpec.BlockSpecFromCoordinates`: `(z*Size.y + y)*Size.x + x`.
  - `BlockObject.Save/Load`: saved Coordinates include `+BaseZ`; `Orientation` absent means Cw0; `FlipMode = Flippable && Flipped`.
  - `PositionedEntrance.From`: `direction = Orientation.Transform(Down)`, `Doorstep = Coordinates - Direction2D.ToOffset()`.
- `Timberborn.Coordinates`: `OrientationExtensions.Transform(Vector3Int)` gives Cw90 `(y,-x)`, Cw180 `(-x,-y)`, Cw270 `(-y,x)`. `FlipMode.Transform` gives `(width - x - 1, y, z)`.
- **Data check.** A Python emulation of the load pipeline was run on every map. It covers `BlockValidator` (fits in map, occupation overlap, block above, OccupyAllBelow, in terrain, MatterBelow) plus `UndergroundTerrainValidator`, `ContinuousTerrainConstraintValidator`, `TerrainLevelValidator`, `UnderstructureConstraintValidator` and the `BlockObjectBatchLoader` ordering.
  - With the formula above there were **0 failures among 58,388 BlockObjects in the 22 built-in maps**, 0 among the 43,223 in 8 workshop maps, and 0 in the 2 saves and the user map.
  - The only failures were in "Tower of Beaverlon" (90 voxel layers). The game truncates its terrain, so those failures are expected (see Q5).
  - Built-in multi-tile samples: BadtideDrain 61 (Cw0 12, Cw90 13, Cw180 11, Cw270 25), UnstableCore 23, MediumRelic 13, SmallRelic 10, NaturalOverhang 2x1/3x1/4x1 4/15/2, WaterSeep 20, BadwaterSeep 6, UndergroundRuins 57, StartingLocation 21, Aquifer 11, GeothermalField 26, BadwaterSource 84, LargeRelic 2, AncientAquiferDrill 2, ReserveWarehouse 4.
  - Every one sits on ground, is terrain-free and overlaps nothing.
  - **Alternative hypotheses fail.** "Coordinates = min corner of the rotated footprint" gives 82 built-in failures (BadtideDrain 36/61, NaturalOverhang3x1 8/15, UndergroundRuins 6/57, UnstableCore 5/23, BadwaterSource 5/84, AncientAquiferDrill 2/2, StartingLocation 1/21, and others). "Reversed rotation direction" gives 76 failures (BadtideDrain 38/61, NaturalOverhang4x1 2/2, and others).
  - **Direct proof in Oasis.** AncientAquiferDrill (75,223,2) Cw0 sits over Aquifer (75,225,2) Cw90, and drill (133,107,6) Cw180 sits over Aquifer (131,105,6) Cw0. Each pair has the same 3x3 cells but different Coordinates, exactly as the formula predicts.
  - **Entrances.** All 21 built-in StartingLocations and 4 ReserveWarehouses (3 of them flipped) have their predicted entrance tile at ground level and free of objects.
  - **Flip limits.** Flip could not be discriminated by data, because both flip hypotheses give valid entrances for those 4 warehouses and rectangular footprints are flip-invariant. Flip is taken from code.
- Context around the objects (terrain level relative to the object z, built-in):
  - StartingLocation: 3x3 plus ring are flat in 21/21.
  - BadtideDrain: local y=-1 is a wall at least 2 high (61/61); the spout tile y2 is over a drop of at least 1 (61/61).
  - NaturalOverhang: the anchor is usually backed by terrain one level higher at local y=-1.

### Confidence
- High for the transform, rotation and origin semantics (code plus a 0-failure data check with discriminating alternatives).
- Medium-high for flip (code only).

### Implications
- A generator must compute occupied cells with `Coordinates + R(F(local))`.
- To place a rotated object by its min corner, use the table above to derive Coordinates.
- Write `Orientation` only when it is not Cw0, and `Flipped: true` only for flippable templates.

---

## 2. Block semantics and placement requirements

### Answer
- **MatterBelow** (enum Ground=0, GroundOrStackable=1, Air=2, Any=3, Stackable=4), from `MatterBelowValidator`:
  - Ground: voxel z-1 solid and voxel z air (`AtGroundLevel`). z-1 < 0 counts as solid. An UnfinishedGround stackable below also counts, but no map object has one.
  - GroundOrStackable: Ground, or a block of another object at z-1 whose `Stackable` is BlockObject or UnfinishedGround. Among map objects only NaturalOverhang* and the BadtideDrain body are stackable.
  - Air (only Slope's upper block): voxel z and z-1 both air, and no non-overridable object occupying `Top` at z-1.
  - Any: no requirement. Stackable: a stackable block below (unused by map templates).
  - Only Ground, GroundOrStackable and Stackable blocks count as "foundation" blocks.
- **Occupations** are flags: Floor 1, Bottom 2, Top 4, Corners 8, Path 16, Middle 32, All -1.
  - Two objects can share a cell only if their flags at that cell are disjoint (`WorldBlock.NonOverridableBlockOccupations`, `BlockValidator.BlockConflictsWithExistingObject`).
  - Overridable objects are ignored for the conflict test. StartingLocation is the only overridable map template.
  - A block with `Top` may not sit directly under a cell whose bottom object's block is MatterBelow Air, i.e. a Slope's upper cell (`BlockConflictsWithBlockAbove`).
- **Every occupied block** must satisfy all of these (`FitsInMap`, `BlockConflictsWithTerrain`, `TerrainLevelValidator`):
  - inside map XY;
  - z < 33 (`MapSize.TotalSize.z`);
  - not inside terrain, unless the block is Underground/OptionallyUnderground. No map template uses `Underground`; only the virtual OAB blocks are OptionallyUnderground.
- **OccupyAllBelow (OAB)**:
  - Adds a virtual `All` block in every cell below the block down to z=0. These may be inside terrain but must be inside map XY.
  - Placement fails if any non-overridable object exists anywhere below (`BlockConflictsWithBlocksBelow`), and afterwards nothing can be placed underneath.
  - Used by: WaterSource, BadwaterSource, WaterSeep, BadwaterSeep, Aquifer, BadtideDrain (y0,y1), GeothermalField, UndergroundRuins.
- **ContinuousTerrainConstraintSpec** (`Timberborn.TerrainLevelValidation` `ContinuousTerrainConstraint.IsNotOnFirstColumnOfTerrain`):
  - Every foundation tile's z must be at most the ceiling of the **first (lowest) terrain column**, i.e. the contiguous solid run starting at z=0.
  - Combined with Ground, this means the object must stand on the lowest column's top surface: not on an overhang or floating terrain, and not inside a cave's upper layer.
  - All Ground blocks of such templates must be OAB, otherwise Awake throws.
  - Used by: WaterSource, BadwaterSource, WaterSeep, BadwaterSeep, Aquifer, BadtideDrain, GeothermalField, UndergroundRuins.
- **UnderstructureConstraintSpec** (AncientAquiferDrill, `UnderstructureNames=["Aquifer"]`):
  - Every foundation block whose occupation is exactly Top/Corners (the drill's plus-shaped z0 blocks) must be in the same cell as a block of one single Aquifer entity (`UnderstructureFinder.FindStrict`).
  - The drill's Top fits beside the Aquifer's FBCPM. In practice the drill must cover exactly an Aquifer's 3x3; any orientation works.
  - If the Aquifer is missing, the drill is invalid on load. `UnderstructureConstraint.PostInitializeEntity` also deletes it.
- **BlockObjectTerrainCutoutSpec**: purely visual. It does **not** remove voxels.
  - `TerrainService.SetCutout` increments a separate `_cutoutMap` at the object cell (object z = the air cell above the ground).
  - The cutout map is read only by the terrain renderer (`TerrainSystemRendering`, which hides the top face in that cell) and by selection picking (`WasCutoutHit`).
  - `Underground()`/`IsTerrainVoxel` ignore cutouts, so the ground under a seep stays solid.
- Other load validators (`IBlockObjectValidator`):
  - `NoTerrainRemoverBelowValidator`: Ground blocks may not stand on tunnel or dynamite cells.
  - `TerrainPhysicsBlockObjectValidator`: only objects with `TerrainPhysicsBlockObjectValidatorSpec`; none of the map templates have it.
  - `StartingBuildingPlacementValidator`: only applies to objects with `StartingLocationSpec` and a `BuildingSpec`, so it is a no-op for the map StartingLocation.
  - `DistrictPreviewsValidator`: previews only.

Overlap in practice: every map template occupies Bottom (or All) in its base cell, so **trees, bushes, ruins, slopes, relics, Thorns, sources and StartingLocation are mutually exclusive per cell.** The legal exceptions are:
- AncientAquiferDrill (Top) over Aquifer (FBCPM). This is required.
- NaturalOverhang3x1/4x1 tip (Top only) sharing a cell with a bush, Thorns, relic, tree crown (FBCPM), Slope upper (FBP) or BadtideDrain spout (Middle). Data has 1 case: Oak crown plus overhang tip.
- BadtideDrain spout (Middle only) sharing with a Slope upper (F,B,P) or a tip.
- Stacking (not overlap): GroundOrStackable objects (ruins, slopes, Blockage, NaturalDam, overhangs, StartingLocation, Reserve*) may stand on top of NaturalOverhang/BadtideDrain bodies. Maps contain 441 Blockages on overhangs and 38 overhangs on overhangs.

Anything placed over a StartingLocation deletes it (`OverridenBlockObjectService`). On load the StartingLocation is lost whichever order the two load in: if the SL comes first, the other object overrides it; if the other object comes first, the SL is invalid.

"Valid ground" for trees and bushes (MatterBelow Ground):
- Any solid voxel below plus an empty cell. There are no soil types.
- The map-editor spawner (`NaturalResourceSpawner` into `SpawnValidationService.CanSpawnIgnoringConstraints`) checks only `OnGround`, `BlocksValid` and "no object at cell".
- Moisture matters only for survival and natural spreading:
  - `WateredNaturalResourceSpec.DaysToDieDry`: 6-15 days.
  - Flooding kills (`FloodableNaturalResourceSpec` MaxWaterHeight 0).
  - Mangrove wants water height 1.
  - Succulent is arid and dies when wet.
  - In-game reproduction (`CanSpawn`) requires moist soil, a tile that is not a field, and no contamination.
- **Only Pine, Birch, Oak, Succulent and BlueberryBush are in the "Common" template collection.** Maple, ChestnutTree and Dandelion are Folktails-only; Mangrove and CoffeeBush are IronTeeth-only (`TemplateCollection.NaturalResources.*`).
  - The MapEditor context loads only "Common" (`CommonTemplateCollectionIdProvider`; `FactionTemplateCollectionIdProvider` is Game-only).
  - A map containing faction trees fails to instantiate them for the other faction and in the editor.
  - The built-in maps use only the 5 common ones.

### Evidence
- `Timberborn.BlockSystem`: `Block`, `BlockSpec`, `MatterBelow`, `BlockOccupations`, `BlockStackable`, `BlockValidator.BlockValid` (checks in the order listed above), `MatterBelowValidator.Validate`, `Blocks.GetBottomBlocks` (OAB, `Block.FullFrom`), `WorldBlock`, `OverridenBlockObjectService`, `BlockObjectTerrainCutout`.
- `Timberborn.TerrainSystem` `TerrainService.Underground/SetCutout/CellIsCutout`.
- `Timberborn.TerrainLevelValidation`; `Timberborn.UnderstructureSystem`.
- `Timberborn.NaturalResources` `SpawnValidationService`.
- `Timberborn.TemplateCollectionSystem`, `Timberborn.GameFactionSystem`.
- Data: the emulation above found 0 violations. Cells shared by 2 objects in all maps: only AncientAquiferDrill+Aquifer (10 cells) and Oak+NaturalOverhang4x1 tip (1).

### Confidence
- High for the validation rules.
- Medium for the "visual only" cutout description (code paths are clear; appearance is not checked in game).

### Implications for a validator
Per object:
1. Transform the blocks.
2. Check each occupied block: in bounds, z<33, air cell, flags disjoint from other objects' flags.
3. Check MatterBelow for each foundation block.
4. Check OAB columns are empty of objects.
5. Check ContinuousTerrain (z equals the first-column height) for water sources, seeps, aquifer, drain, geothermal and underground ruins.
6. Check the drill matches an Aquifer.
7. Check that nothing touches the StartingLocation.

Use only the 5 common natural resources.

---

## 3. StartingLocation and new-game start

### Answer
- **At new game** (`Timberborn.GameStartup` `GameStarter` into `StartingBuildingInitializer.Initialize`):
  1. If a StartingLocation exists, its `Placement` (Coordinates, Orientation, Flip) is taken. `StartingBuildingSpawner` creates the faction's `StartingBuildingId` (`Faction.Folktails` gives `DistrictCenter.Folktails`, `Faction.IronTeeth` gives `DistrictCenter.IronTeeth`) as a finished building at exactly that placement.
  2. The camera is set: horizontal angle = orientation angle + 35 degrees, zoom = z * 0.1.
  3. All StartingLocations are deleted and a notification is shown.
  4. The settlement-name prompt appears.
  5. `GameInitializer.SpawnBeavers` spawns `GameModeSpec.StartingAdults` (9) and `StartingChildren` (4) at the DC's `Accessible.UnblockedSingleAccess`, which is the doorstep tile center.
  6. `StartingGoodsProvider` puts Berries = StartingFood (Easy 300 / Normal 130 / Hard 90) and Water = StartingWater (250 / 0 / 0) into the DC inventory.
  7. No other buildings are created.
- **Save evidence.** Plains SL (131,138,3) Cw180 matches the saved DC in `rc6-test` at (131,138,3) Cw180. The user map SL (40,28,6) Cw270 matches the DC at (40,28,6) Cw270 in `generated-river-valley`. Beavers spawn at grid (130.5,138.5) and (40.5,29.5), which are exactly the predicted doorstep tiles.
- **Placement requirements** (from the blueprint and `BlockValidator`):
  - All 9 base cells at z must be ground level (voxel z-1 solid, z air) or stand on a stackable object, so the 3x3 must be flat.
  - The 45 cells z..z+4 must be terrain-free and free of any other object.
  - The top block must be at z+4 < 33.
- **Entrance tile.** It must be walkable ground at level z and free, and the doorstep must connect to it. Otherwise:
  - `BlockableEntranceBuilding/BlockedAccessible.IsBlocked` makes `UnblockedSingleAccess` null;
  - `GameInitializer.SpawnBeavers` then **spawns no beavers**.
  - Entrance tile and facing per orientation:

    | Orientation | Entrance tile (outside) | Facing | Doorstep (inside) |
    |---|---|---|---|
    | Cw0 | (X+1, Y-1) | -y | (X+1, Y) |
    | Cw90 | (X-1, Y-1) | -x | (X, Y-1) |
    | Cw180 | (X-1, Y+1) | +y | (X-1, Y) |
    | Cw270 | (X+1, Y+1) | +x | (X, Y+1) |

  - Built-in maps: 21/21 have a flat 3x3, the ring is almost always flat, and the entrance tile is at ground level and free.
- **Only one StartingLocation.**
  - `StartingLocationService.OnBlockObjectSet` deletes all other StartingLocations whenever one is added to the block service. This includes during load, which runs in `BlockObjectBatchLoader` order: z ascending, then highest base occupation, then file order. So the **last processed (highest z, then later in file) survives**, silently.
  - `GetStartingLocation()` throws if the count is not 1.
  - There is **no multiplayer / `StartingLocationPlayer`** in 1.1 code (grep finds nothing). That component in the 0.6 "Meander Multiplayer" map is ignored; its 3 SLs load as 1 (the z=5 one).
- **Missing or invalid start.**
  - An invalid SL is deleted on load with a loading issue ("Can't validate loaded BlockObject ... Deleting it."), which is the same as a missing one.
  - With no SL, `InitialPlacement` is null: no DC and no beavers are placed.
  - The settlement prompt's "Relocate" button (the manual placement tool) is shown only if `GameWonderCompletionService.IsWonderCompletedWithAnyFaction()`.
  - So for most players the game starts with nothing.
  - The map editor only shows a "MapEditor.NoStartingLocation" alert and does not block saving.

### Evidence
- `Timberborn.StartingLocationSystem` (`StartingLocationService`).
- `Timberborn.GameStartup` (`StartingBuildingInitializer`, `StartingBuildingSpawner`, `GameInitializer`, `StartingGoodsProvider`, `StartingBuildingPlacementValidator`).
- `Timberborn.SettlementNameSystemUI`, `Timberborn.BuildingsReachability`, `Timberborn.Buildings` (`BlockedAccessible`), `Timberborn.Navigation` (`Accessible.UnblockedSingleAccess`).
- Blueprints: `Factions/Faction.*.blueprint.json`, `NewGameModes/GameMode.*.blueprint.json`, `MapEditor/StartingLocation/StartingLocation.blueprint.json`, `Buildings/DistrictManagement/DistrictCenter/*`.

### Confidence
- High for placement mapping and requirements.
- Medium for the entrance/navmesh consequence (code-derived; not observed in game).

### Implications
- Generate exactly one StartingLocation on a flat 3x3 with 5 layers of clearance, no objects inside, and an entrance tile at the same level.
- Keep a free, walkable approach of 2 or more tiles in front of the entrance.
- Never place anything overlapping it.

---

## 4. Slope direction and height step

### Answer
- A Slope at Coordinates z has its base block on ground whose top voxel is z-1 (MatterBelow GroundOrStackable). Its upper block (z+1) must be air.
- It connects **level z (low side) to level z+1 (high side**, where the neighbour's top solid voxel is z).
- The high side is local -y rotated:

  | Orientation | High side (ground level z+1) | Low side (ground level z) |
  |---|---|---|
  | Cw0 | (x, y-1) south | (x, y+1) north |
  | Cw90 | (x-1, y) west | (x+1, y) east |
  | Cw180 | (x, y+1) north | (x, y-1) south |
  | Cw270 | (x+1, y) east | (x-1, y) west |

- Game validation does not check the neighbours. The rule is a pathing convention; a misoriented slope is a dead end.

### Evidence
- Blueprint `MapEditor/Objects/Slope/Slope.blueprint.json` `BlockObjectNavMeshSettingsSpec.AddedEdges`:
  - (0,0,0) to (0,1,0): the low exit at +y on level z.
  - (0,0,1) to (0,-1,1): the high exit at -y on level z+1.
  - (0,0,0) to (0,0,1): vertical, two-way.
- `Timberborn.PathSystem` `StraightStairsHeightProvider.TryGetHeight`: `pathHeight = z + (-1*local.y + 1)`. That gives height z+1 at the local y=0 (south) edge and z at the local y=1 edge.
- **Data, built-in (183 slopes)**:
  - The high side has ground at z+1 in **183/183**.
  - The low side has ground at z in **178/183**.
  - 5 exceptions have the low side at z-1. 4 of them are chained slopes: the low neighbour holds another Slope at z-1 whose upper block fills (neighbour, z). The remaining case is Hollows (165,45,8) Cw270 with a bare 1-level drop.
  - By orientation: Cw0 36+1 exception, Cw90 45, Cw180 53+2, Cw270 44+2.
- **Workshop/saves/user (274 slopes, excluding Tower of Beaverlon)**:
  - 209 match exactly and 30 more are "high ok, low at z-1" (mostly chains).
  - The rest are cave, overhang or map-top cases in old player maps; for example, Lost Underground has slopes facing walls at least 2 high.

### Confidence
High.

### Implications
- Place a Slope on the low tile at a 1-voxel step, oriented so local -y points up the step.
- For multi-level ramps, chain slopes; each next slope sits one level higher and one tile toward the high side.

---

## 5. Map size and height limits

### Answer
- **Map size** (`Configurations/MapSize.blueprint.json` `MapSizeSpec`): DefaultMapSize 128x128, MinMapSize 4, MaxMapSize 256.
  - The new-map dialog (`Timberborn.MapRepositorySystemUI` `TryParseSize`) enforces 4..256 per axis. Non-square sizes are allowed (official 100x50 and 256x150; workshop 151x251 and 83x83).
  - Load does not re-check the size.
- **Height**: `MaxGameTerrainHeight` 22, `MaxMapEditorTerrainHeight` 16, `MaxHeightAboveTerrain` 10.
  - `MapSize.Initialize`: `TerrainSize.z = 22+1 = 23` voxel layers (which is why all 1.1 maps have 23), and `TotalSize.z = 23+10 = 33`.
  - Map editor brushes clamp terrain to column height 16 (voxels 0..15); see `MapEditorBrushesUI` `MaxMapEditorTerrainHeight`. **All official maps top out at exactly 16.**
  - In-game `TerrainService.SetTerrain` clamps to voxel z at most 21, i.e. column height 22. Workshop maps Beavers Endgame and Lost Valley reach 22.
  - No map has layer 22 solid. That layer is kept free so objects can stand on height-22 terrain.
- **MapHeight {X,Y}** in pre-1.1 maps: X = terrain voxel layers and Y = X + MaxHeightAboveTerrain, i.e. the old per-map TerrainSize.z and TotalSize.z. 1.0 maps store {23,33}; the 90-layer "Tower of Beaverlon" stores {90,100}.
  - In 1.1, `MapSize.Save` writes only `Size` and `Load` reads only `Size`. MapHeight is ignored and heights always come from `MapSizeSpec`.
- **Voxel data on load** (`TerrainMap.Load/GetTerrainData`):
  - The array must have at least X*Y*23 entries. `Unpack3D` reads 23 layers and would index out of range on a shorter array.
  - If it has more than 23 layers, it is truncated to **22** layers (layer 22 is dropped too), with the loading issue "Terrain data height exceeds map size, truncating to fit."
  - Legacy `Heights` arrays with a value above 23 throw ("Loaded map has heights exceeding map size").
  - A missing TerrainMap singleton gives a flat 4-layer terrain (`NewMapHeight`).
- **Minimum terrain**: z=0 does not need to be solid. `TerrainMap.IsTerrainVoxel` returns true for z<0, so a cell with voxel 0 empty is ground at level 0.
  - Official maps have many z=0 air columns: Pillars 14,057; Pressure 4,841.
  - Objects can sit at Z=0: 1,486 Thorns, 20 WaterSources, UndergroundRuins and trees in the built-in maps.
- **Max buildable height**: occupied blocks need z < `TotalSize.z` = 33 (`BlockValidator.FitsInMap`, `TerrainLevelValidator`); the visible level limit is 32.
- **Terrain support** (`Timberborn.TerrainPhysics` `TerrainPhysicsPostLoader`, `MaxSupportDistance` = 3):
  - A solid voxel survives load only if it is reachable from z=0 by moving up (which resets the distance) or sideways through solid voxels, with at most 3 consecutive sideways steps since the last upward step. The top of a stackable object block also counts as support.
  - Unsupported voxels are deleted with a loading issue, and objects on them follow; this repeats until stable.
  - Data: 0 unsupported voxels in the built-in maps. The only 12 flagged voxels (Pillars, Beavertopia, Cozy Secret Valley) all rest on NaturalOverhang blocks, which are supported.

### Confidence
High.

### Implications
- Emit exactly 23 voxel layers and keep terrain at column height 16 or less for editor parity (22 or less at most). Keep layer 22 empty.
- Overhangs may extend at most 3 tiles horizontally per layer from supported terrain.
- Keep map sizes in 4..256.
- MapHeight can be omitted.

---

## 6. Validation on load

The pipeline is `WorldEntitiesLoader`, then `EntitiesLoader.LoadAndInitialize`: Load, BatchLoad, PreInitialize, Initialize, PostInitialize. Loading issues are collected by `LoadingIssueService` (also written with `Debug.LogWarning`). After load they appear in an overlay (`LoadingIssuePanel`) offering "Continue playing" or "Exit to menu".

| Trigger | What happens | Where |
|---|---|---|
| Unknown template name (includes faction-only trees for the other faction, and in the editor) | Entity skipped; loading issue "Failed to instantiate '<name>'" | `WorldEntitiesLoader.TryInstantiateEntity` (TemplateMappingException) |
| Template not usable with current feature toggles | Skipped; LogWarning only | same |
| Invalid block placement: out of map XY, z>=33, inside terrain, overlapping a non-overridable object (the later one in load order loses), MatterBelow not met (floating), OAB column occupied, not on first terrain column, drill without Aquifer | Entity deleted; loading issue "Can't validate loaded BlockObject X at (c). It's not backward compatible. Deleting it." | `BlockObject.AddToServiceAfterLoad`, via `BlockObjectBatchLoader` (order: z, then highest z0 occupation, then file order) |
| Second or later StartingLocation | Earlier-processed ones deleted silently | `StartingLocationService.OnBlockObjectSet` |
| Object overlapping a StartingLocation (intersecting occupation) | The StartingLocation is always the one lost: overridden if it loaded first, invalid if it loaded second | `OverridenBlockObjectService` / `BlockValidator` |
| Terrain not supported (floating more than 3 tiles sideways) | Voxel deleted with issue "Loaded terrain at ... is not supported by terrain physics"; then objects whose foundation fails MatterBelow are deleted with a similar issue; repeated to a fixpoint | `TerrainPhysicsPostLoader.ValidateAll` |
| Voxel array with more than 23 layers | Truncated to 22 layers with an issue | `TerrainMap.GetTerrainData` |
| Voxel array with fewer than 23 layers, or Heights above 23 | Exception, load fails | `MapIndexService.Unpack3D`, `TerrainMap.BackwardCompatibleLoad` |
| Invalid enum string (e.g. Orientation "cw90", "Cw45") | `Enum.Parse` throws, wrapped as ArgumentException "Exception while deserializing"; load fails. Numeric strings parse to possibly undefined values that throw later in `Orientation.Transform`. Legacy `{"Value":"Cw90"}` is accepted | `PrimitiveTypeSerialization.DeserializeEnum` |
| Missing `BlockObject` component | Coordinates default to (0,0,0) and Cw0; then validated like any object | `BlockObject.Load` (TryGetComponent) |
| Missing `BlockObjectState` | Treated as Finished | `BlockObjectState.Load` |
| Missing required component read with `GetComponent`: `RuinModels` (ruins), `WaterSource` (all water sources, seeps, aquifer, drain), `WaterDepthStrengthModifier` (seeps) | `ArgumentOutOfRangeException` "Component X wasn't found in entity"; load fails | `SerializedEntity.GetComponent` |
| Missing optional components: `Growable` (fully grown), `LivingNaturalResource` (alive), `Yielder:*` (spec default; a mismatched good is ignored), `TimeActivatedComponent` / `UnstableCore` (spec defaults), `CoordinatesOffsetter` | Defaults used | various `Load` methods with TryGetComponent |
| Unknown extra components (e.g. `StartingLocationPlayer`, mod components) | Ignored | components read only their own keys |
| Objects in water | No check; floodable trees and bushes die over time in game | none |
| `Flipped` on a non-flippable template | Ignored | `BlockObject.Load` |
| Placing an invalid object at runtime (`AddToService`, e.g. DC creation at start) | `InvalidOperationException` "Cannot place BlockObject" | `BlockObject.AddToService` |

### Confidence
- High for code paths.
- Medium for the user-visible result of exceptions: the crash dialog vs. returning to the menu is not verified.

### Implications
Two classes of problem:
- Silent drops. Emulate `BlockValidator` and terrain support in the generator and treat any drop as a bug.
- Hard failures. Write exact template names, exactly 23 voxel layers, enum strings in the exact case, and the required components copied from official maps: Ruins `RuinModels{VariantId}` plus `Yielder:Ruin`; water objects `WaterSource{SpecifiedStrength,CurrentStrength}` plus `TimeActivatedComponent`, and seeps also `WaterDepthStrengthModifier`.

---

## Needs in-game check
- New game on a map with no or invalid StartingLocation and no wonder unlocked. Is it an empty colony with no beavers, a game-over, or something else?
- Whether beavers fail to spawn when the DC entrance tile is blocked or at a different level. Also whether trees, bushes or ruins on the entrance tile block the navmesh: natural resources and ruins have no `BlockObjectNavMeshAdder`, so they are probably walk-through.
- The user-visible behaviour of load exceptions (invalid enum, missing `RuinModels` or `WaterSource`, short voxel array): crash reporter or return to menu.
- The visual effect of terrain cutouts (seeps, underground ruins, sources): confirm no gameplay effect on water or nav.
- Loading a map larger than 256 on either axis, and a map with voxel layer 22 solid.
- Which StartingLocation survives when several exist at equal z, i.e. file-order dependence (code says the later one).
- Faction-only trees (Maple, Chestnut, Mangrove, Coffee, Dandelion) in a map: confirm the loading-issue path for the other faction and for the map editor.
- The Slope tool in the editor: confirm it neither auto-orients nor validates the high side, so the generator must.
