# Timberborn 1.1.2.4 map format (`.timber`): native 1.1 writer notes

Sources: decompiled game assemblies in `investigation/decompiled/Timberborn.*.cs` (game build `1.1.2.4-52e959e-sw`),
blueprints in `investigation/raw/blueprints`, and the map files in `investigation/raw/{builtin,workshop,user,saves}`.
Analysis scripts are throwaway scratch files; every number below was measured from the files.
"Crash" means an unhandled exception during load: the game shows its error screen and the map does not load.
"Loading issue" means `ILoadingIssueService.AddIssue`. The map loads, then a "Loading issues" panel appears after load
with Continue / Exit to menu buttons (`Timberborn.ErrorReportingUI`, `ShowPrimaryUI`).

---------------------------------------------------------------------------------------------------

## 0. Key answers (TL;DR)

* **Nothing in the loader checks the world version.** `version.txt` is read only by `MapVersionValidator` (map
  selection). Every migration is triggered by the shape of the data (missing or old keys), never by the version
  number. A map stamped `1.0.12.3-db72a8c-sw` and one stamped `1.1.2.4-52e959e-sw` load through exactly the same code.
  Write **`1.1.2.4-52e959e-sw`** in both `version.txt` and `world.json.GameVersion`.
* **Vertical size is fixed by a spec, not stored in the map.** `MapSize.Load` reads only `Size`.
  `TerrainSize.z = MapSizeSpec.MaxGameTerrainHeight + 1 = 23` (from blueprint `Configurations/MapSize.blueprint.json`).
  A 1.0-style `MapSize.MapHeight` key is ignored and is dropped on the next save.
  `TerrainMap.Voxels` must have exactly `X*Y*23` entries. Fewer entries crash the load. More layers produce a
  loading issue and get truncated.
* **Only `MapSize` is a hard-required singleton.** Every other map singleton is optional (loads with defaults), but
  once a singleton is present, its keys are required. There is one trap: **omitting `WaterSimulationMigrator` or
  writing `IsMigrated:false` halves every water source's strength and all saved outflows at load.** Always write
  `{"IsMigrated": true}`.
* **1.1 water column token:** `WaterDepth:Contamination:Overflow:Floor:OldWaterDepth` (5 fields). 1.0 used the
  first 4. When the 5th field is missing, `OldWaterDepth = WaterDepth`. An empty column is `"0"`. On load only depth,
  old depth, contamination and overflow are used; `Floor` is recomputed from terrain. `ColumnOutflows` can be all
  `"0"` because flows are recomputed every tick.
* **All-zero water, moisture and contamination arrays are safe.** The prototype map did exactly this, loaded in 1.1
  with no loading issues (Player.log), and the game filled the river, moisture and evaporation data itself (§6.4).
  Nothing pre-simulates on a new game. Water starts wherever the file puts it.
* **A playable map needs exactly one `StartingLocation`** (3x3x5, placed on ground, with an accessible entrance).
  Entity `Id`s must be unique GUIDs; a duplicate crashes the load. Unknown templates are skipped with a loading
  issue. Block objects whose placement is invalid or unsupported are deleted with a loading issue.
* **1.0 to 1.1 differences:** `MapSize.MapHeight` is gone, and water columns gained a 5th field. The singleton set,
  the entity component schema and `map_metadata.json` are unchanged (verified against the 1.0 map
  *Beavers Endgame*).

---------------------------------------------------------------------------------------------------

## 1. Container and load pipeline

* A `.timber` file is a ZIP read by `System.IO.Compression.ZipArchive` (`Timberborn.SaveSystem`, `SaveReader.ReadFromSaveStreamUnsafe`).
  Entries are looked up with `zipArchive.Entries.FirstOrDefault(entry => entry.Name == EntryName)`:
  * The match is exact and case-sensitive. It uses the entry's *file name* only, so a directory prefix would also
    match, and the first match wins. Put all entries at the zip root.
  * Stored (0) and Deflate (8) both work. The game itself writes Deflate with `CompressionLevel.Fastest`
    (`SaveWriter.WriteToSaveStream`, `ZipArchiveMode.Update`). All official maps use Deflate (compress_type 8).
  * Extra entries are ignored.
  * A missing entry returns `default(T)`. The one exception is `version.txt`, which has a fallback (§2).
* User maps are loaded from `<Documents>/Timberborn/Maps/*.timber` (`MapRepository.GetUserMapNames`). The extension
  check is `Path.GetExtension(path) == ".timber"`, which is case-sensitive. The display name is the file name
  without the extension (§4).
* Entries the game writes (`MultiBind<ISaveEntryWriter>`), in the order they appear in official files:
  * `map_metadata.json`
  * `map_thumbnail.jpg`
  * `version.txt`
  * `world.json`
  * `map_overlay.png`: optional and editor-only. It is a PNG overlay for the thumbnail, written only if the author
    set one (`Timberborn.MapThumbnailOverlaySystem`). Don't emit it.
* New game from a map: `MapLoader.Load` → `MapDeserializer.Load` → `WorldSerializer.ReadFromSaveEntryStream`. After
  that, singletons `Load()`, entities are instantiated, `BlockAndTerrainBatchLoader` runs (`BlockObjectBatchLoader.AddToServices`
  + `TerrainPhysicsPostLoader.ValidateAll`), then `PostLoad()` (water, evaporation, `WaterSimulationMigrator`).

## 2. Versioning (Q2)

**Reading.** `VersionSerializer` (`Timberborn.VersioningSerialization`) reads the **first line** of `version.txt`
and passes it to `Version.Create`. If `version.txt` is missing, `BackwardCompatibleRead` reads
`world.json.GameVersion` instead. If that is also missing, it uses `"0"`. An empty `version.txt` crashes: `ReadLine()`
returns null and `Version.Create(null)` throws.

`Version.Create(s)` (`Timberborn.Versioning`) works like this:
* The numeric part is `s.Split('-')[0]`, parsed with `int.Parse` per dot. A string starting with `v` becomes
  `0.0.0.0`.
* The version is "experimental" when the 3rd dash-segment starts with `x`. So `…-xsw` is experimental and `…-sw` is
  not.
* `"0"` is a development version and is always fully compatible (the dev maps `_mini`, `_terraintest` and
  `_waterperformancetest` use it).

**Check.** `MapVersionCompatibilityService` (`Timberborn.MapRepositorySystemUI`) builds a
`VersionCompatibilityService(current = Application.version, SoftCap = 0.7.6.0, HardCap = HardCapMapVersion 0.1.1.1)`:
* Forward-compatible:
  * Same branch: `current.IsEqualOrHigherThan(map, depth: 2)`. Only major.minor is compared, so any 1.1.x map is
    fine on any 1.1.x game.
  * Different branch (`-sw` vs `-xsw`): the full 4-part compare is used.
* **Fully compatible** = forward-compatible AND `map >= SoftCapVersion (0.7.6.0)`. The map loads with no dialog.
* **Semi-compatible** = `map >= HardCapMapVersion (0.1.1.1)`:
  * New game: the `MapSelection.SemiCompatibleMapVersion` confirm dialog appears.
  * Map editor: the map opens silently (`MapVersionValidator.ValidateMap`, `acceptSemiCompatibility`).
* Anything else is non-compatible: the `NonCompatibleMapVersion` dialog appears and the map cannot be loaded.
* `HardCapSaveVersion` applies to saves only (`SaveVersionCompatibilityService`).

Examples:
* The official maps are `1.1.2.1-0b9feec-xsw` (experimental). They are forward-compatible with `1.1.2.4-…-sw`
  because 1.1.2.4 ≥ 1.1.2.1 in the full compare.
* The prototype's `1.0.12.3-db72a8c-sw` is fully compatible (same branch, 1.1 ≥ 1.0, and ≥ 0.7.6.0).
* The 0.6 and 0.7.4 workshop maps are below the SoftCap, so a new game on them asks for confirmation.

**Nothing else reads the version.** `SerializedWorld.Version` is not consumed by any loader. A grep for
`IsEqualOrHigherThan` and for `.Version` finds only UI and validation code. The only other difference between a
`1.0.12.3` stamp and a `1.1.2.4` stamp is the version shown in the map editor tooltip.

**Migrations (all key-driven: `[BackwardCompatible(date, Compatibility.Map)]`).** Each row lists what triggers the
migration and what it does.

| Date | Where | Trigger → effect |
|---|---|---|
| 2023-09-22 | `SoilContaminationSimulator.Load` | `SoilContaminationSimulator` missing → reads legacy `SoilPollutionSimulator{PollutionCandidates,PollutionLevels}`, otherwise zeros |
| 2023-11-07 | `WaterMapLoader.Load` | `WaterMapNew` missing → reads legacy `WaterMap{WaterDepths,Outflows}` + `ContaminationMap`/`PollutionMap`, otherwise no water |
| 2024-01-24 | `WaterEvaporationMap.LoadData` | `Levels` missing → 1 |
| 2024-08-29 | `TerrainMap.Load` | `TerrainMap.Heights` (2-D ints, 0.6 heightmap era, e.g. *Beavers Canyons*, *Meander Multiplayer*) → converted to voxels. Any height > 23 crashes |
| 2025-01-31 | `SerializedGoodValueSerializer.GetGoodId` | `"Good":{"Id":"Log"}` → `"Good":"Log"` |
| 2025-02-07 | `PrimitiveTypeSerialization.DeserializeEnum` | enum as `{"Value":"Cw90"}` → `"Cw90"` |
| 2025-02-28 | `WateredNaturalResource.Load` | `DryingProgress` → `DyingProgress` |
| 2025-04-20 | `CoordinatesOffsetter.Load` | old `CoordinatesOffseter{CoordinatesOffset{X,Y}}` ≠ 0 → `Random` offset |
| **2025-07-16** | **`WaterSimulationMigrator`** | **singleton missing or `IsMigrated:false` → every `IWaterSource.SetSpecifiedStrength(0.5 × strength)` and all saved outflows × 0.5 (the 0.7→1.0 water rescale)** |
| 2025-08-20 | `Demolishable.Load` | optional keys |
| 2025-09-25 | `MapMetadataSerializer.Deserialize` | `IsUnconventional` missing → false |
| 2025-09-30 | `UnstableCore.Load` | component `TimeBomb` → `UnstableCore` |
| 2026-04-29 | `WaterColumnPackedListSerializer.Deserialize` | 4-field water column → `OldWaterDepth = WaterDepth` (3-field → `Floor = 0` too) |
| — | `MapSize.Load` | `MapHeight` never read |
| — | `SoilMoisture/ContaminationSimulator` | `Size` missing → 1 |
| — | `TemplateNameMapper` | legacy template names via `TemplateSpec.BackwardCompatibleTemplateNames`: `Barrier`→`Blockage`, `Bramble`→`Thorns`, `Bomb`→`UnstableCore`, `Cactus`→`Succulent`, `Maple`→`Oak`, `ChestnutTree`→`Pine`. The last two apply only when the faction's own template is absent: real template names are registered first, so a Folktails game still gets a real Maple |

For a 1.0-format map the only migration that changes anything is the water-column one. The prototype's water was
all `"0"`, so even that had no effect. Of the old 0.6/0.7 components, `DryObject`, `ContaminatedObject`,
`NaturalResourceModelRandomizer` and `StartingLocationPlayer` are never read (Timber Together reads the last one).
`BlockObjectState`, `WateredNaturalResource`, `LivingWaterNaturalResource` and `ContaminatedNaturalResource` are
still read in 1.1 (checked against the decompiled loaders in M3, PLAN §20 D36).

**Recommendation.** Write `version.txt` = `1.1.2.4-52e959e-sw` + `\r\n`, and `GameVersion` = the same string. This is
exactly what the 1.1.2.4 build writes. Every 1.1.x build on the stable branch accepts it silently.

One edge case: a player on an *experimental* build older than 1.1.2.4 (e.g. `1.1.2.1-…-xsw`) would get the
semi-compatibility dialog, because branches differ and the full compare fails. Writing a lower 1.1 patch number
would avoid that, but since no loader cares, this is cosmetic. Keep it configurable.

Do not use `"0"` (the dev-version bypass): it shows as version 0 in the editor.

## 3. `world.json` encoding rules

* Top level (`WorldSerializer.DeserializeSave`):
  * `GameVersion` (string) is **required**.
  * `Singletons` (object of objects) is **required**.
  * `Entities` (array) is **required**.
  * `Timestamp` is written as UTC `yyyy-MM-dd HH:mm:ss` but **never read**.
* Parsing uses Newtonsoft `JObject.Parse`. Whitespace, key order and a UTF-8 BOM are all fine. The game writes
  compact UTF-8 without a BOM.
* JSON values map as follows:
  * JSON integer → `int`; JSON float → `float`.
  * Typed reads go through `Convert.ChangeType`, so an int in a float field (e.g. `0` for `0.0`) is fine.
  * Write ints for int fields (`Size.X`, `Amount`, `Levels`, `CyclesUntilCountdownActivation`, `ExplosionRadius`).
  * Write JSON `true`/`false` for booleans.
  * No NaN or Infinity.
* Culture: `ApplicationLifetime` sets `CultureInfo.DefaultThreadCurrentCulture = InvariantCulture`. Use a `.`
  decimal point; exponent forms like `1.401298E-45` parse fine.
* Vector types (`PrimitiveTypeSerialization`):
  * `Vector2Int`/`Vector3Int`: `{"X":int,"Y":int[,"Z":int]}`
  * `Vector2`/`Vector3`: the same keys, with floats
  * `Quaternion`: `{"X","Y","Z","W"}`
  * `Guid`: a string parsed by `Guid.Parse`
  * `Enum`: the name string (`"Cw90"`)
* A missing key in a present object throws `ArgumentOutOfRangeException("Property not found")`, which crashes the
  load. Readers that use `Has`/`GetOrDefault`/`TryGet` are optional; that is noted per field below.
* **PackedList** (`Timberborn.PackedListSystem`, `PackedListSerializer<T>`):
  * The value is `{"Array": "<tokens joined by single spaces>"}`.
  * `Deserialize` does `Split(' ')`. No leading, trailing or double spaces: an empty token crashes
    `int.Parse`/`float.Parse`.
  * Bool lists: tokens are `int.Parse(token) > 0`. Write `0`/`1`; `1.0` would crash.
  * Float lists: `float.Parse`.
  * Number formatting when the game writes (`CommonNumberSerializer`): whole values 0–16 are written as bare
    integers (`"1"`, `"16"`). Everything else uses `float.ToString(InvariantCulture)`, which gives about 7
    significant digits.
* **Map-array index order** (`MapIndexService.Pack`/`Unpack`/`Unpack3D`): packed arrays have no margins and are
  ordered `index = level * X*Y + y * X + x`, where `level` is the z layer for terrain or the column index for
  water, moisture and contamination.
  * Length must be ≥ `X*Y*levels`. Shorter crashes with `IndexOutOfRangeException`. Longer: the extra entries are
    ignored.
  * Internally the game pads each layer with a 1-cell margin, so `Stride = X+2` and `VerticalStride = (X+2)(Y+2)`.
    This only matters for `ColumnOutflows` target indices (§4.6).

## 4. Singletons (Q1)

These are the singletons present in the 1.1 official maps. `ExplosionService{Explosions:[…]}` also appears in maps
that contain UnstableCore (optional, TryGet), and workshop-uploaded maps carry `SteamWorkshopMapDataService`
(editor-only).

| Singleton | Required? | If missing | Assembly / class |
|---|---|---|---|
| `MapSize` | **yes** (`GetSingleton` throws) | crash | MapStateSystem / `MapSize` |
| `TerrainMap` | no | flat terrain, 4 layers (`InitializeHeights`, `NewMapHeight=4`) | TerrainSystem / `TerrainMap` |
| `WaterMapNew` | no | legacy `WaterMap` path; if that is absent too, no water | WaterSystem / `WaterSimulator` |
| `WaterSimulationMigrator` | *semantically yes* | **water sources ×0.5, outflows ×0.5** | WaterSystem / `WaterSimulationMigrator` |
| `WaterEvaporationMap` | no | all modifiers 1 | SoilMoistureSystem / `WaterEvaporationMap` |
| `SoilMoistureSimulator` | no | all moisture 0 | SoilMoistureSystem / `SoilMoistureSimulator` |
| `SoilContaminationSimulator` | no | legacy `SoilPollutionSimulator`, otherwise 0 | SoilContaminationSystem / `SoilContaminationSimulator` |
| `HazardousWeatherHistory` | no | empty history | HazardousWeatherSystem / `HazardousWeatherHistory` |
| `NumberedEntityNamerService` | no | empty | EntityNaming / `NumberedEntityNamerService` |
| `WindService` | no | strength 0, direction 0, change at first tick | WindSystem / `WindService` |
| `MapThumbnailCameraMover` | no (map editor only, `[Context("MapEditor")]`) | default thumbnail camera | MapThumbnailCapturing / `MapThumbnailCameraMover` |

### 4.1 `MapSize`
`{"Size":{"X":W,"Y":H}}`. Only `Size` is read (`MapSize.Load` → `Initialize`):
```csharp
TerrainSize = size.ToVector3Int(_mapSizeSpec.MaxGameTerrainHeight + 1);
TotalSize = TerrainSize + new Vector3Int(0, 0, _mapSizeSpec.MaxHeightAboveTerrain);
```
* `MapSizeSpec` values (from the blueprint): DefaultMapSize 128², MinMapSize 4, MaxMapSize 256,
  MaxMapEditorTerrainHeight 16, **MaxGameTerrainHeight 22**, MaxHeightAboveTerrain 10.
* Result: TerrainSize.z = **23** and TotalSize.z = 33. This is a constant; changing it would take a modded
  blueprint.
* Old 0.7/1.0 files have `"MapHeight":{"X":23,"Y":33}` (TerrainSize.z, TotalSize.z; *Tower of Beaverlon*, made
  with a height mod, has `{90,100}`). 1.1 ignores it, and the game's re-save of the prototype dropped it.
* Min/max map size is enforced only by the New Map dialog. Official maps go up to 256×256 and include non-square
  sizes (256×150, 100×50, 151×251 workshop).
* Keep `Width`/`Height` in metadata equal to `Size`.

### 4.2 `TerrainMap`
`{"Voxels":{"Array":"0/1 × X*Y*23"}}` using the index `z*X*Y + y*X + x`. Load path
(`TerrainMap.Load` → `GetTerrainData` → `MapIndexService.Unpack3D`):
* If `Heights` is present, the legacy 2-D int heightmap is used (`y*X+x`); any height > 23 throws.
* `GetTerrainData` behaviour:
  * If `len / (X*Y) <= 23`, the array is used as-is. `Unpack3D` then reads all 23 layers, so **fewer than 23 layers
    crashes**.
  * If there are more layers: the loading issue "Terrain data height exceeds map size, truncating" is raised and
    only `X*Y*MaxGameTerrainHeight` = 22 layers are copied. That is a game bug: layer 22 is dropped too.
* `TerrainPhysicsPostLoader.ValidateAll` then runs:
  * The first (lowest) solid run of each cell is always kept.
  * Every voxel in a higher run (an overhang) must be within 3 horizontal steps (`TerrainPhysicsValidator.MaxSupportDistance=3`)
    of supported terrain, otherwise it is deleted with a loading issue.
  * Block objects not supported by terrain or stackables are deleted too.
* Observations from the official maps:
  * Max terrain height is 16 in all 19 maps (the map editor limit). The game allows heights up to 23.
  * **Height 0 is allowed**: an empty column. Border cells with height 0 are how official maps drain rivers off
    the edge (e.g. Plains has 367 empty cells, including runs along its y=0 edge).
  * Official maps have up to 4 solid runs per cell (Hollows).
* An object placed on terrain uses `Z` = terrain top, i.e. the first empty voxel. All 50k+ official block objects
  satisfy "voxel at z-1 solid, voxel at z empty"; the only exception is 1 Aquifer.

### 4.3 `WaterMapNew` (`WaterSimulator.Save`/`PostLoad`)
`{"Levels":L,"WaterColumns":{"Array":…X*Y*L},"ColumnOutflows":{"Array":…X*Y*L}}`

* **`Levels`** is the number of water-column layers stored: the maximum number of water columns in any cell, and
  never less than 1 (`Save`: `num = max(columnCounts), min 1`).
  * A cell has one water column per air gap above a floor (terrain or a water obstacle). Column 0 is the lowest.
  * Official maps store 2 (most), 3 or 4. The prototype and the game's re-save of it store 1. `_terraintest` stores 1.
* **On load** (`PostLoad`), the column structure is rebuilt from terrain and block obstacles first
  (`CreateColumns` + `Update`). Then, for each existing column `i` of each cell, and only when that index is in
  range (`num2 < array.Length`), the following are copied:
  ```csharp
  reference.WaterDepth = reference2.WaterDepth;
  reference.OldWaterDepth = reference2.OldWaterDepth;
  reference.Contamination = reference2.Contamination;
  reference.Overflow = reference2.Overflow;
  span2[num2] = array2[num2];          // outflows
  ```
  * The saved `Floor` is **not** used.
  * Columns that exist in the game but not in the file stay 0.
  * If `WaterMapNew` is present, `Levels`, `WaterColumns` and `ColumnOutflows` are all required.
* **Water column token** (`WaterColumnPackedListSerializer`):
  * `"0"` = empty column, i.e. depth, contamination and overflow all 0. That is exactly what the writer emits in
    that case.
  * Otherwise, 1.1: `WaterDepth:Contamination:Overflow:Floor:OldWaterDepth`.

    | # | Field | Meaning |
    |---|---|---|
    | 1 | `WaterDepth` | Water height above the column floor, in blocks (float). The surface is at `Floor + WaterDepth` |
    | 2 | `Contamination` | Badwater fraction, 0..1 (official lake values are ≈ 0.99999) |
    | 3 | `Overflow` | Extra pressurised water when the column is full up to its ceiling (`WaterDepthSetter`: depth is clamped to `Ceiling-Floor` and the excess goes to Overflow). 0 for open-sky water |
    | 4 | `Floor` | Byte, the column floor z. Written for information only, ignored on load, but keep it correct (= terrain top) |
    | 5 | `OldWaterDepth` | Previous tick's depth, used only for hard-dam flow smoothing. Write it equal to `WaterDepth` |

  * 1.0: the first 4 fields. When migrated, `OldWaterDepth = WaterDepth`. Very old files had 3 fields (Floor = 0).
* **`ColumnOutflows` token** (`ColumnOutflowsPackedListSerializer`):
  * `"0"` means none. Otherwise it is `Bottom:Left:Top:Right[:extra…]`, and each part is `"0"` or
    `"<targetIndex3D>|<flow>"`.
  * `targetIndex3D` uses the padded index: `(y+1)*(X+2) + (x+1) + level*(X+2)*(Y+2)` of the neighbour. Bottom is
    y−1, Left x−1, Top y+1, Right x+1. Edge cells point into the margin; that is how water leaves the map.
  * Flows are recomputed every tick from the columns. **Write all `"0"`.** The prototype did this, and the game
    produced its own flows (§6.4).

### 4.4 `WaterSimulationMigrator`
`{"IsMigrated": true}`. Meaning: water strengths and outflows are already on the post-July-2025 (1.0) scale.
* If the singleton is missing or false, the migrator collects every `IWaterSource` via `BlockObjectSetEvent` during
  load, halves `SpecifiedStrength` in `PostLoad`, scales all loaded outflows by 0.5, and then saves `true`.
* The 0.7.x workshop maps lack this singleton. All 1.0 and 1.1 maps have `true`.
* **Always write `true`**, otherwise every generated source runs at half strength.

### 4.5 `WaterEvaporationMap`
`{"Levels":L,"EvaporationModifiers":{"Array": X*Y*L floats}}`
* `Load` fills every modifier with **1**.
* `LoadData` (`PostLoad`, via `WaterEvaporationMapHelper`) overwrites existing water columns with the file values.
  `Levels` is optional (default 1); if the singleton is present, `EvaporationModifiers` is required.
* The values are recomputed by the soil-moisture simulation every tick (cluster saturation → 1.16, 1.5585, 2.076…).
* **Write all `1`** with `Levels` equal to the water `Levels`. That is exactly the game's own default.

### 4.6 `SoilMoistureSimulator`
`{"Size":S,"MoistureLevels":{"Array": X*Y*S floats}}`
* `S` is the terrain `MaxColumnCount`, i.e. the maximum number of solid terrain runs in a cell. This counter only
  ever grows during editing, so `_mini` stores 3 with 2 actual runs.
* The loader reads `min(Size, currentMaxColumnCount)` levels. `Size` is optional (default 1); `MoistureLevels` is
  required if the singleton is present.
* Values range 0..16: 16 at the water edge, falling about 0.9 per tile. The prototype's re-save after about 1.3
  in-game days showed moisture 9.35 at 1 tile from water, 5.9 at 5 tiles and 0.6 at 11 tiles.
* **Writing all `0` is safe** (§6).

### 4.7 `SoilContaminationSimulator`
`{"Size":S,"ContaminationCandidates":{…},"ContaminationLevels":{…}}`
* Same shape and `Size` meaning as moisture (terrain column layers, *not* water `Levels`, although the two are equal
  in every observed map).
* Values are 0..1. Levels equalise toward the candidates, which come from contaminated water.
* **Write all `0`.**
* **Size vs water `Levels`:** moisture and contamination are indexed by *terrain* column, while water and
  evaporation are indexed by *water* column. For a pure heightmap both are 1.

### 4.8 Small singletons
* **`HazardousWeatherHistory`**: `{"HistoryData":[{"HazardousWeatherId":"DroughtWeather","Duration":1},…]}`. This is
  the history of past hazardous seasons, used for streaks and weather randomisation. `HistoryData` is optional
  (`Has`). Maps: `[]`.
* **`NumberedEntityNamerService`**: `{"NextNumbers":[{"Group":str,"NextNumber":int}]}`. These are counters for
  auto-names like "District 1". `NextNumbers` is required if the singleton is present. Maps: `[]`.
* **`WindService`**: `{"WindStrength":f,"WindDirection":{"X":f,"Y":f},"NextWindChangeTime":f}` (the last one in
  days). All 3 keys are required if present. With 0s the wind re-randomises on the first tick
  (`PartialDayNumber >= 0`). Maps: all `0.0`.
* **`MapThumbnailCameraMover`**: `{"CurrentConfiguration":{"Position":{X,Y,Z},"Rotation":{X,Y,Z,W},"ShadowDistance":150.0}}`.
  This is the map editor's thumbnail camera. It is dropped when a game starts (not bound in the Game context).
  Omit it (the editor then uses `ThumbnailCameraDefaultPositionProvider`), or write a *normalized* quaternion; the
  prototype's rotation is not unit length.

## 5. Other zip entries (Q3)

### `map_metadata.json` (`MapMetadataSerializer`)
`{"Width":int,"Height":int,"MapNameLocKey":str,"MapDescriptionLocKey":str,"MapDescription":str,"IsRecommended":bool,"IsUnconventional":bool,"IsDev":bool}`
* All keys are required except `IsUnconventional` (defaults to false; missing in 0.6/0.7 maps).
* If the file is missing or malformed:
  * Menus use `ReadFromMapFile` (the "safe" read, which catches the exception and returns null). The map still
    lists, but without a size or description.
  * **The map editor uses `ReadFromMapFileUnsafe`** (`MapMetadataPanel.GetMapMetadata`), so a *malformed* file
    throws there. Always write all 8 keys.
* Extra keys are ignored, e.g. `"MaxPlayers":3` in *Meander Multiplayer*, which comes from the BeaverBuddies mod.
* Display for custom maps:
  * `UserMapItemFactory` and `SteamWorkshopMapItemFactory` use **the file name** (without `.timber`) as the name.
  * The description comes from `MapDescription`.
  * The size label comes from `Width×Height`.
  * `MapNameLocKey`, `MapDescriptionLocKey`, `IsRecommended`, `IsUnconventional` and `IsDev` are used only for
    built-in resource maps (`OfficialMapItemFactory`). They are hard-coded to false for user maps.
* Write: `MapNameLocKey:""`, `MapDescriptionLocKey:""`, `IsRecommended:false`, `IsUnconventional:false`,
  `IsDev:false`.

### `map_thumbnail.jpg`
* `MapThumbnailSaveEntryReader` → `ThumbnailSerializer` → `Texture2D.LoadImage`. LoadImage accepts JPEG or PNG
  bytes and resizes the texture to the image, so any size works.
* The game writes 960×540 baseline JPEG at quality 95 (`MapThumbnailConfiguration`). All 32 map thumbnails
  observed (22 built-in, 9 workshop, 1 prototype) are 960×540 baseline.
* If it is missing: `default(T)`, so a null texture and a blank thumbnail. There is no crash.
* Write 960×540 (16:9) baseline JPEG.

### `version.txt`
One line with the version string. The game writes it with `StreamWriter.WriteLine`, so it ends in CRLF.

## 6. Entities (Q4)

### 6.1 General rules (`WorldSerializer.DeserializeEntity`, `WorldEntitiesLoader`, `EntitiesLoader`)
* `{"Id":guid,"Template":str,"Components":{name:{…}}}`.
  * `Id` is required and parsed with `Guid.Parse`. Write lowercase `D` format, as the game does.
  * **Ids must be unique.** `EntityRegistry.AddEntity` does `Dictionary.Add`, so a duplicate throws and the load
    crashes.
  * The Id also seeds the tree `CoordinatesOffsetter` random offset.
  * `Template` is used; the old key `TemplateName` is accepted.
  * `Components` is required (it may be `{}`).
* Template resolution (`TemplateNameMapper`):
  * Real names come first, then `BackwardCompatibleTemplateNames`.
  * An unknown name gives a loading issue ("PrefabNotFound") and the entity is skipped.
  * A template disabled by feature toggles is skipped with only a log warning.
* Only templates from **Common collections** exist in every game:
  * NaturalResources.Common: `Pine`, `Birch`, `Oak`, `Succulent`, `BlueberryBush`.
  * MapEditor.Common: `Blockage`, `GeothermalField`, `Large/Medium/SmallRelic`, `NaturalDam`,
    `NaturalOverhang2x1/3x1/4x1`, `ReservePile/Tank/Warehouse`, `Slope`, `Thorns`, `UnstableCore`,
    `RuinColumnH1..H8`, `UndergroundRuins`, `StartingLocation`, `AncientAquiferDrill`, `Aquifer`, `BadtideDrain`,
    `BadwaterSeep`, `BadwaterSource`, `WaterSeep`, `WaterSource`.
  * Faction crops and trees (`Maple`, `ChestnutTree`, `Carrot`, `Dandelion`, …) exist only for their own faction.
* Components: each `IPersistentEntity.Load` asks for the keys it needs. **Unknown or extra components are
  ignored.** A missing component is a default for `TryGetComponent` readers and a **crash** for `GetComponent`
  readers.
* Map-relevant hard requirements (crash if missing):
  * `RuinModels` (`Timberborn.Ruins`, `RuinModels.Load`).
  * `WaterSource` with both keys (`WaterSourceSystem`, `WaterSource.Load`).
  * `WaterDepthStrengthModifier` on Water/BadwaterSeep.
  * `UnstableCore` (or the legacy `TimeBomb`).
  * `FixedStockpile` on Reserve* objects.
* Placement (`BlockObject.AddToServiceAfterLoad`): objects that fail `IsValid()` are deleted with the loading
  issue "Can't validate loaded … Deleting it". Causes include overlap, missing ground, out of bounds, and
  `ContinuousTerrainConstraint` (water sources and geothermal objects must sit on the *first* terrain column).
  Terrain physics then deletes unsupported objects (§4.2).

### 6.2 `BlockObject` (`Timberborn.BlockSystem`, `BlockObject.Save`/`Load`)
`{"Coordinates":{"X":x,"Y":y,"Z":z},"Orientation":"Cw90","Flipped":true}`
* `Coordinates` are ints; the file stores `Coordinates + BaseZ`, and `BaseZ` = 0 for all map objects.
* `Orientation` ∈ `Cw0|Cw90|Cw180|Cw270`. It defaults to `Cw0`, and the game omits it when `Cw0`.
* `Flipped` is honoured only if the spec is `Flippable` (Blockage, Thorns, NaturalDam, WaterSource, the seeps,
  relics, UnstableCore, Reserve*). The game writes it only when true.
* The component is effectively required: without it the object sits at the origin and most likely fails validation.
* **Footprint transform** (`BlockObjectSpec` blocks → `Blocks.Transform`): world cell = `rot(flip(local)) + Coordinates`, where
  ```
  flip(x,y)  = (sizeX-1-x, y)            when Flipped
  Cw0:(x,y)  Cw90:(y,-x)  Cw180:(-x,-y)  Cw270:(-y,x)
  ```
  So `Coordinates` is local block (0,0) *after rotation*, and rotated footprints extend into negative offsets.
  Example: `StartingLocation` Cw270 at (40,28) covers x 38..40, y 28..30. Its entrance at local (1,−1) maps to
  (41,29).
* Matter below, by template:
  * Trees, bushes, Thorns, relics, UndergroundRuins, WaterSource, the seeps, BadwaterSource, UnstableCore,
    GeothermalField: `Ground`.
  * Ruins, Blockage, NaturalDam, Slope, StartingLocation, Reserve*: `GroundOrStackable`.

### 6.3 Per-template components
Default means what the loader uses when the component is absent.

| Template | Components (✱ = required) | Notes |
|---|---|---|
| Pine / Birch / Oak / Succulent / BlueberryBush | `BlockObject`✱ | trees are 1×1; see the rows below for the optional components |
| trees | `CoordinatesOffsetter{Random:true}` | optional; absent = tile-centred. The offset is deterministic from the Id. Old `CoordinatesOffseter` is migrated |
| trees | `Growable{GrowthProgress:f}` | optional; absent = fully grown (1.0). The game writes it only when < 1 (sapling) |
| trees | `LivingNaturalResource{IsDead:true}` | optional; absent = alive. Official maps: about 2/3 of Pine/Oak/Birch are dead, marking dry scenery, and dead trees still yield logs |
| trees | `Yielder:Cuttable{Yield:{Good:"Log",Amount:n}}` | optional; absent = spec yield (Pine 2, Birch 1, Oak 8, Succulent `Water` 2). Ignored if the good ≠ spec good |
| Pine, BlueberryBush | `Yielder:Gatherable{Yield:{Good:"PineResin"/"Berries",Amount:n}}` | optional; absent = spec yield (resin 2, berries 3). Official pines mostly have 0 |
| Pine, BlueberryBush | `GatherableYieldGrower{GrowthProgress:f}` | optional regrowth timer (resin 7 d, berries 12 d). The game adds it once growing starts |
| trees | `WateredNaturalResource{DyingProgress:f}` | optional; the game adds it when a tree is on dry soil (death after 9–15 days) |
| Succulent | `DeadCuttableYieldRemover{IsBlocked:false}` | optional |
| RuinColumnH1..H8 | `BlockObject`✱, **`RuinModels{VariantId:"A".."E"}`✱**, `Yielder:Ruin{Yield:{Good:"ScrapMetal",Amount:15×H}}` | an unknown VariantId gets a random variant. Yielder absent = spec yield |
| WaterSource / BadwaterSource / BadtideDrain / Aquifer | `BlockObject`✱, **`WaterSource{SpecifiedStrength:f,CurrentStrength:f}`✱**, `TimeActivatedComponent{IsEnabled,CyclesUntilCountdownActivation:int,DaysUntilActivation:f,DaysPassed:f}` | see the notes below the table |
| WaterSeep / BadwaterSeep | as WaterSource + **`WaterDepthStrengthModifier{CurrentModifier:f}`✱** | |
| UnstableCore | `BlockObject`✱, `TimeActivatedComponent`, **`UnstableCore{ExplosionRadius:int}`✱** | TimeActivated is non-optional: `IsEnabled` is forced true at init |
| ReservePile/Tank/Warehouse | `BlockObject`✱, **`FixedStockpile{FixedGoodId}`✱**, `SingleGoodAllower`, `Inventory:Stockpile`, `Inventory:ConstructionSite`, `StockpileVisualizers` | copy an official example (Nomads) |
| StartingLocation, Blockage, Slope, Thorns, NaturalDam, NaturalOverhang*, relics, UndergroundRuins, GeothermalField, AncientAquiferDrill | `BlockObject`✱ only | |

Notes on water sources:
* Strength is capped at `8 × tiles` (`WaterStrengthSpec.MaxWaterSourceStrength`). `CurrentStrength` is recomputed
  every tick as Specified × modifiers.
* Official values run 0.25–1.0; the prototype used 1.0.
* `TimeActivatedComponent` is optional; absent = spec (`IsOptionallyActivable` true for these templates).
* `IsEnabled:false` means the source is active from the start. `IsEnabled:true` means it is inactive until cycle
  ≥ N and N days have passed.

### 6.4 The prototype map vs the game's 1.1 re-save

This compares `raw/user/Generator Test - River Valley.timber` with `raw/saves/generated-river-valley-day1-2.timber`
(Folktails, Easy, about day 1.3). Caveat: the save was written while mods were active (LateGamePerformance
background save, BeaverBuddies singletons, HungryPathing, …).

* The `StartingLocation` was removed. A `DistrictCenter.Folktails` was placed at the *same* Coordinates and
  Orientation (40,28,6, Cw270), and 10 `BeaverAdult` + 3 `BeaverChild` were added (Easy: 9 adults + 4 children; one
  child grew up).
* 161 of 183 Pines gained `GatherableYieldGrower{GrowthProgress≈0.15}`: resin regrowing from Amount 0.
* 51 trees (10 Birch, 19 Oak, 22 Pine) gained `WateredNaturalResource{DyingProgress≈0.09–0.11}`. Every one sits on a
  cell with moisture 0. All 528 non-dying trees sit on moisture > 0 (mean 4.7).
* 5 new saplings (3 Birch, 2 Pine) with `Growable` appeared through reproduction.
* No other component changed on any existing entity: Ids, BlockObject, Yielders and RuinModels were all identical.
* Terrain voxels: byte-identical. `MapSize.MapHeight` was dropped. `MapThumbnailCameraMover` was dropped
  (editor-only).
* Water: all `"0"` became 470 wet cells (max depth 0.56) with 5-field tokens and computed outflows, from 3 sources
  at 1.0. Moisture: 2603 cells > 0. Evaporation modifiers: computed. Contamination stayed 0 (no badwater).
* Added singletons:
  * Game state: FactionService, DayNightCycle, weather, science, and so on.
  * `MapNameService{"Name":"Generator Test - River Valley","IsResource":false}`.
  * `HazardousWeatherHistory` gained its first entry.
  * `WindService` was randomised.
* Player.log shows no loading-issue warnings for this load.

## 7. New game: requirements and what the game computes (Q5)

* **Exactly one `StartingLocation`.** `StartingBuildingInitializer.Initialize`
  (`Timberborn.GameStartup`) takes its placement, spawns the faction's starting building (`FactionSpec.StartingBuildingId`)
  there with starting goods, then deletes all StartingLocations.
  * Zero: no district center is placed. The Relocate button only exists after completing a Wonder, so the map is
    effectively unplayable, and the map editor shows a "no starting location" alert.
  * More than one: `StartingLocationService.OnBlockObjectSet` deletes the *others* whenever one is set, so only one
    survives. `GetStartingLocation()` throws if more than one remains.
  * It must be a valid 3×3×5 `GroundOrStackable` placement, and its entrance cell (local (1,−1)) must be
    accessible (`StartingBuildingPlacementValidator`, `BlockableEntranceBuilding.IsEntranceInaccessible`).
* Nothing else is required. Water sources, trees and ruins are content; they are not checked.
* The game does **no** pre-simulation or settling when a new game starts. A grep for prewarm/settling code finds
  nothing, and `SimulationController` only resets on demand. Every simulation continues from the file state:
  * **Water** continues from the saved columns. Zero columns mean rivers fill from the sources over hours or days;
    basins without a source stay empty and pre-filled lakes slowly evaporate.
  * **Moisture** follows the water within hours. In the re-save it reached about 11 tiles from water in about 1.3
    days.
  * **Evaporation modifiers** are recomputed every tick.
  * **Soil contamination** spreads from contaminated water.
  * Consequences of starting at zero:
    * Trees on dry soil start their `DaysToDieDry` timer (Birch 11, Pine 13, Oak 15, Blueberry 9 days) and die
      unless water or moisture arrives first.
    * Succulents do the reverse: they die after 8 days *wet*.
    * Flooded trees die after `FloodableNaturalResourceSpec.DaysToDie` days.
* So yes: **all-zero moisture and contamination plus all-`"0"` water columns and outflows are safe**. This is
  proven by the prototype. Two trade-offs:
  * The map is visually dry at first.
  * Living trees more than about 10 tiles from permanent water will die. Either place living trees near water and
    mark distant ones dead (as official maps do), or pre-fill water.

## 8. Native 1.1 map writer spec (Q6)

**Zip** `<Name>.timber` (Deflate, entries at the root, UTF-8 without a BOM). The name the player sees is `<Name>`.

1. `version.txt`: `1.1.2.4-52e959e-sw\r\n`
2. `world.json` (compact JSON):
```json
{"GameVersion":"1.1.2.4-52e959e-sw","Timestamp":"2026-09-24 12:00:00",
 "Singletons":{
  "MapSize":{"Size":{"X":W,"Y":H}},
  "TerrainMap":{"Voxels":{"Array":"<W*H*23 tokens 0|1, index z*W*H+y*W+x>"}},
  "HazardousWeatherHistory":{"HistoryData":[]},
  "WaterEvaporationMap":{"Levels":L,"EvaporationModifiers":{"Array":"<W*H*L × '1'>"}},
  "WaterSimulationMigrator":{"IsMigrated":true},
  "WaterMapNew":{"Levels":L,"WaterColumns":{"Array":"<W*H*L tokens>"},"ColumnOutflows":{"Array":"<W*H*L × '0'>"}},
  "SoilMoistureSimulator":{"Size":S,"MoistureLevels":{"Array":"<W*H*S × '0'>"}},
  "SoilContaminationSimulator":{"Size":S,"ContaminationCandidates":{"Array":"<W*H*S × '0'>"},"ContaminationLevels":{"Array":"<W*H*S × '0'>"}},
  "NumberedEntityNamerService":{"NextNumbers":[]},
  "WindService":{"WindStrength":0.0,"WindDirection":{"X":0.0,"Y":0.0},"NextWindChangeTime":0.0}},
 "Entities":[ … ]}
```
   * `L` = `S` = 1 for a plain heightmap (≤ 1 solid run per cell). With overhangs or caves, set both to the max
     number of solid runs in any cell and fill the arrays level-major (column 0 = lowest).
   * Keep terrain height ≤ 16 (the official and editor limit; §9). Height 0 at borders is allowed and makes an
     outlet.
   * Do **not** write `MapSize.MapHeight`.
   * `MapThumbnailCameraMover` is optional. Omit it, or write a normalized rotation with `ShadowDistance:150.0`.
   * **WaterColumns:**
     * Minimal and proven: every token `"0"`.
     * Optional pre-fill for lakes and rivers: `"{d}:{c}:0:{floor}:{d}"`, where `d` = surface − terrain top > 0,
       `c` = 0 (or 1 for badwater pools), `floor` = terrain top z, OldWaterDepth = d, Overflow 0. Keep connected
       water surfaces level; the simulation will settle the rest.
     * Outflows stay `"0"` either way.
3. `map_metadata.json`: `{"Width":W,"Height":H,"MapNameLocKey":"","MapDescriptionLocKey":"","MapDescription":"…","IsRecommended":false,"IsUnconventional":false,"IsDev":false}`
4. `map_thumbnail.jpg`: 960×540 baseline JPEG.

**Entities:**
* Unique uuid4 Ids (lowercase `D` format).
* Common templates only.
* Every object:
  * sits at `Z` = terrain top, on terrain as its spec requires;
  * stays within bounds after the footprint transform;
  * does not overlap anything.
* Water sources and GeothermalField must be on the first terrain column.
* Minimal recommended component sets:
  * Tree: `BlockObject` + `CoordinatesOffsetter{Random:true}` + `Yielder:Cuttable` (spec amount) +
    [`Yielder:Gatherable` Amount 0 for Pine] + optional `Growable{GrowthProgress<1}` / `LivingNaturalResource{IsDead:true}`.
  * BlueberryBush: `BlockObject` + `CoordinatesOffsetter` + `Yielder:Gatherable{Berries,3}` + `GatherableYieldGrower{GrowthProgress:1.0}`.
    This mirrors the official "ripe" bushes (1920 of them) and the prototype.
  * Ruin: `BlockObject` + `RuinModels{VariantId}` + `Yielder:Ruin{ScrapMetal,15×H}`.
  * WaterSource: `BlockObject` + `WaterSource{s,s}` + `TimeActivatedComponent{false,5,10.0,0.0}`.
  * StartingLocation ×1: `BlockObject` (+Orientation).

**1.0-era vs 1.1 format differences:**
1. Version strings: `1.0.x` / `1.1.2.x`.
2. `MapSize.MapHeight` (`{X:23,Y:33}`) existed in 1.0 (and some 0.7 files). It is not written or read in 1.1.
3. Water column tokens gained the 5th field `OldWaterDepth` (migration date 2026-04-29).
4. Unchanged, verified against *Beavers Endgame* (`1.0.12.3`):
   * the singleton set (MapSize, TerrainMap, MapThumbnailCameraMover, HazardousWeatherHistory, WaterEvaporationMap,
     WaterSimulationMigrator, WaterMapNew, SoilMoistureSimulator, SoilContaminationSimulator,
     NumberedEntityNamerService, WindService);
   * `ColumnOutflows` format;
   * the entity component schema (same components, same property shapes);
   * `map_metadata.json` (already had `IsUnconventional`);
   * the thumbnail;
   * voxel order and 23 layers.
5. Pre-1.0 (0.6/0.7) data is migrated by key (§2), not by version.

## 9. Needs in-game check

1. A map written with `1.1.2.4-52e959e-sw` and *no* `MapHeight` loads exactly like the prototype, both for a new
   game and in the map editor. Expected: yes, since the loader never reads either.
2. Pre-filled water tokens, i.e. whether `d:0:0:floor:d` lakes keep their level and rivers settle without a surge.
   Also measure how fast lakes without a source evaporate.
3. Terrain heights 17–23: do the new game and the map editor accept them, and can the editor still edit them?
   Official maps never exceed 16. Also test the new-game camera and building headroom (10 above).
4. Behaviour with 0 or ≥ 2 `StartingLocation`s in vanilla. The log line "Deleting other starting locations" came
   from a mod.
5. A thumbnail that is missing or not 960×540 (PNG or odd size) in the map selection UI.
6. `Levels`/`Size` > 1 with generated overhangs or caves: terrain-physics support (≤ 3 tiles) and whether the water
   and moisture arrays line up.
7. The semi-compatibility dialog for a player on an experimental (`-xsw`) build older than the written version.
8. That the game's re-save matches vanilla behaviour: the observed save was written by the LateGamePerformance
   background saver while BeaverBuddies, HungryPathing and MixedStorage were active.
9. An IronTeeth new game on a generated map: the starting building (`DistrictCenter.IronTeeth`) fits the same
   3×3×5 StartingLocation.
