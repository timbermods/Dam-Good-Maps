# Where the repository assumes one height per column

Step 3 of the terrain-3D investigation. Every place in `src/`, `prototype/` and `tools/` that assumes
one terrain height per tile, what each would need for terrain above terrain, and a rough size
(S, M, L). Line numbers are from `dev` at `e2addfc` (2026-09-25). The M9 design's field is from
`investigation/generative` at `a5f189d`.

## The common assumption

Only the file layer is fully 3D. `WorldModel.voxels` (`format/world.ts`) holds z·X·Y voxels, and
footprints and entity z are 3D. Above it, everything works on `heights: Uint8Array`: the first free
layer above each tile's top solid voxel (`surfaceOf`, `world.ts:52`).

Caves and overhangs exist only as a frozen side channel of imported maps:
- the document stores them verbatim (`BaseMap.columns`, `doc/base.ts:24`: one 23-character string per
  column that is not a plain run from z = 0);
- the tools refuse those columns (`lockedColumns`, `doc/ops.ts:375, 527`);
- their water, soil and evaporation are kept from the file (D100, `format/world.ts:175`);
- the 3D view meshes them voxel by voxel without merging (`render3d/mesh.ts:225–242`).

Generated maps never have them: `doc/session.ts:262` keeps `columns` empty in live mode.

## Two bugs found on the way

1. **The support check can be skipped.** `terrain.supported` runs only when some tile has two or
   more floors (`validate/checks.ts:138`; `prototype/validate.py:182`, which tests `floors() <= 1`).
   A run floating over air that reaches down to z = 0 counts one floor. An arch over a channel cut
   to z = 0 would never be checked, and the game would delete its span. The gate must be "any tile
   that is not one plain run from z = 0". The same holds for `terrain.single_floor`'s count
   (`floorsOf`).
2. **Load checks read only the top surface.** `slopes.connect` (`checks.ts:326–328`), `start.flat`
   and `start.entrance` (`checks.ts:356–360`) compare with `surface`. A slope or a start under a
   roof reads as broken. It is harmless today, because nothing generates one. It must be fixed
   before caves are generated.

Neither changes a map shipped today. Both are listed in DESIGN.md §3.

## 1. The build (`src/core/features`, `src/core/gen`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `features/build.ts` | `BaseLayer` (70) and `BuildResult.heights` (104). `terrainStage` (378–439) writes heights only. Base columns are reset and protected (418–424). Every placement stands at `z = heights[i]`: sources (586–629), objects (633), blocks (636), the start (804), slopes (`placeSlopes`, 570), `fileSlopeLinks` (898) and `snapToGround` (938, which skips base columns at 941). Water, moisture and soil run on heights (696, 736–737). `sameModelAsBase` (956) and `dirtyInfo` (966) diff heights. | Runs per tile as the build's terrain. A carve/fill stage after the sculpts. A floor chosen for each placement. Caches and dirty regions that diff runs. | L |
| `features/target.ts` | `BuildTarget.heights`, `protect` and `writable` are per tile (74–176). | Run writes (carve or fill a z range), a per-tile dirty mask, and `protect` per tile and z range. | M |
| `features/raster/terrain.ts` | Landform, lake, river and bench rasterizers set `heights[i]` (17–322). `applySculpt` raise, lower, flatten and terrace (355–400). `integrityAt` fills pits and cuts spikes (412). | Sculpting works on the top run and leaves runs below alone. The integrity pass must know about ceilings: a pit under a roof is a cave, not a pit. | M |
| `features/slopes.ts` | `placeSlopes` (49) builds its regions with `levelRegions(heights)`. | Walk regions per floor, with headroom. Slopes inside caves. | M–L |
| `features/raster/resources.ts` | Bushes, trees and ruins at `z: g.heights[i]` (74, 121, 186). | A floor per placement, moisture per floor, and headroom for trees (DESIGN §3.3). | M |
| `features/objects.ts` | `rasterizeObjects` puts z at the highest height under the footprint (128–129). `fitProblems` checks level ground on heights (183–184). | Floor-aware placement. Natural bridges become possible (D69 deferred them). | S–M |
| `features/edits.ts` | `applySlopeEdits` and `applyEntityEdits` take z from heights (203–247). | A z (or a floor index) in the edit params. | S–M |
| `features/route.ts`, `geometry.ts` | Channels carve and banks raise on heights (route 50, 179, 251). | A guard against roofs over channels. Underground rivers are a new feature kind. | S (L for underground rivers) |
| `features/setpieces/*` | Every builder writes heights. `PlanContext.heights` (`common.ts:19`). `SetPieceBuilder.slopes` reads heights (`index.ts:74`). `gorge.ts:4` puts slot canyons out of scope for lack of roofed water, and `objects.ts:30–34` defers natural bridges. | A voxel `rasterize` for the new pieces (arch, tunnel, cave, overhang, slot canyon). The existing pieces can stay heightfield. | M |
| `features/schema.ts` | Features are 2D outlines with levels (landform height, lake `floorDepth`, `benchLevel`, `bedProfile`). Areas are 2D `Runs`. | Feature kinds with a vertical extent (DESIGN §5). | M |
| `gen/valley.ts`, `lakeBasin.ts`, `water.ts`, `extras.ts`, `resources.ts`, `layout.ts` | All plan on built heights. Walks run on heights (valley 819/840, lakeBasin 573, extras 357, resources 50). `PlanGround.heights` (`water.ts:23`). | These planners go with M9 (m9-design §15). The planners that stay (resources, extras, the settler) need floor-aware ground. | M |
| `gen/pack.ts` | `toWorld` (57–78) uses `voxelsFromHeights` and settled water with one level. | Voxels from runs, and multi-slot water. With caves, today's pack would also fail `file.arrays`. | S–M |
| `spec/mapspec.ts` | No cave or overhang setting. | The setting of DESIGN §5.4. | S |
| `math/grid.ts` | `levelRegions` (49) and `distanceFrom` (12) are 2D. | Floor-graph variants beside them. | S |

## 2. The water simulation and the canonical settle (`src/core/sim`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `sim/water.ts` | `WaterModel.floor` per tile (38–48). `WaterSim` (55) keeps one column per tile with no ceiling. | Columns per air gap with ceilings, overflow and pressure. The prototype (`proto/stackwater.ts`) does this, bit-identical on heightfields. | L (done in the proto) |
| `sim/model.ts` | `waterModel(surface)` (74): floor = surface. Emitters by (x, y), with z ignored (84–95). A Blockage raises the tile's floor (97–99). `moistureBarrier` is 2D (129). | Emitters and obstacles at their z: `proto/columns.ts` and `proto/loadmap.ts`. | M (done in the proto) |
| `sim/prefill.ts` | `spillLevels` (21) is a 2D priority flood from the edges. `prefill` (60) and `canonicalSettle` (165) build on it. | A flood over a graph of columns, capped by ceilings (DESIGN §2.3). | M–L |
| `sim/preview.ts` | `changedTiles` compares floors (34–40). `warmStart` (69) follows the model. | The same per column. | M |
| `sim/drought.ts` | `droughtStorage` (16) spills per tile. | Storage per column, with sealed pockets that keep their water. | M |
| `sim/moisture.ts` | `moisture(floor, …)` (49) and `clusterSaturation` (9) are 2D, with climb costs against the tile's floor. | Moisture per terrain-run top, the game's rules (DESIGN §2.5). | M–L |
| `sim/contamination.ts` | The same, in `soilContamination` (10). | The same. | M |

## 3. The validators

| File | Assumption | Needs | Size |
|---|---|---|---|
| `validate/checks.ts` | `terrain.max_height` reads the surface (126–129). `terrain.single_floor` (137) fails the design check on any cave. The support gate (138) and the surface-based slope and start checks are the bugs above. The water model runs on the surface (409–414). | `single_floor` retires for generated maps. The support gate fixed. Floor-aware slope and start checks. The stacked water model. | S–M |
| `validate/playability.ts` | `PlayabilityInput.surface` (94). Walk blockers per tile (136–141). Wet and clean water per tile (147–160). Pumpable water `h + D` (409–412). `walkDistance` and `shoreDistance` on h (424–431). Reach from `walkRegions` (467). Ruins reachable only where `h === o.z` (699). `basinLeak` (271), extras and outflow on h. | A walking graph per floor, water per column, the start and pumps on their own floor (DESIGN §3). | L |
| `validate/report.ts` (30) | Only the plumbing of approximate verdicts. | Nothing. | S |
| `prototype/validate.py` | `check_terrain` (166), the support gate (182), `first_column_top` (308), and slopes and start on the surface (315, 336). | Mirror the TypeScript changes. | S–M |
| `prototype/playability.py` | `water_model(m, fps, surface)` (77), `approximate_reason` (260), every check on `h = m.surface()` (291), `dam_sites(h, …)` (446). | The oracle's mirror of the floor graph and the stacked water. | L |

## 4. The analysis (`src/core/analysis`, `prototype/analysis.py`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `analysis/walk.ts` | `walkDistance` (23) and `shoreDistance` (105) move between tiles on the same level of h. | Nodes per (tile, floor) with headroom, slopes matched by z. | M |
| `analysis/regions.ts` | `walkRegions` (7), the same rule. | The same. | M |
| `analysis/damsites.ts` | `damCandidate` (28) and `damSites` (108) flood below the crest on h. | Reservoirs capped by roofs, or dam sites kept to open air (DESIGN §3.6). | M |
| `analysis/metrics.ts` | `measure` (108): height percentiles and steps from the top surface. | Cave measures: roofed share, cave volume, tunnels, arches (the measures of `proto/measure-caves.ts`). | S |
| `analysis/mechanics.ts` | `caveShare` and `startUnderRoof` (57–72) mark water and start checks approximate. | The cave cause goes away once water is stacked. Start under a roof stays a check, now exact. | S |
| `prototype/analysis.py` | `saved_water` keeps only the highest-floor column (40). `priority_flood` (181), `level_regions` (234), `walk_regions` (283), `walk_distance` (322), `shore_distance` (388) and `dam_candidate` (406) all run on h. | Mirror of the floor graph. | M |

## 5. The writer and the readers

| File | Assumption | Needs | Size |
|---|---|---|---|
| `format/world.ts` | `settledSimulationSingletons` (139) writes one slot with `floor` = surface (`SettledState.floor`, 125). `voxelsFromHeights` (81). `emptySimulationSingletons` already takes `levels` (96). `storedWater` (288) already reads every level. | A multi-slot writer: tokens per (tile, slot) in the game's slot order, `Levels` = the most columns, soil and evaporation per slot, and overflow in the token's third field. | M |
| `format/normalize.ts`, `footprints.ts`, `entities.ts`, `timber.ts`, `json.ts` | Already voxel-level or 3D. | Nothing. | — |
| `render/shade.ts` | `shadeTiles` and `thumbnailJpeg` (12, 99) draw top-down from heights. | Right for a thumbnail. An optional cave tint. | S |
| `prototype/tbmap.py` | `set_heightmap` (293). `set_simulation_state` refuses non-simple maps and sets floor to the surface (349–357). `floors`, `water_levels` and `is_simple` exist (307–317). | A multi-slot writer. | M |

## 6. The document and the project file (`src/core/doc`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `doc/base.ts` | Heights plus verbatim columns. In `joinTerrain` (71) the stored column wins, so a height edit on a stored column is silently dropped. | Editable runs for every tile. Runs are the base (DESIGN §1.2). | M |
| `doc/document.ts` | `KeptContent.heights`, one byte per locked tile (44–52), so a lock loses 3D content. `formatVersion: 2` (57). | Kept runs, format 3 with runs (M9 brings format 3 for its field), and migration. | S–M |
| `doc/ops.ts` | `sculpt` takes 2D `cells: Runs` (46) and refuses locked columns (527–530). | Voxel operations (`carve`, `fill`, with a z range or a path), validated and undoable (DESIGN §6). | M |
| `doc/tools.ts` | `planRiver`, `planLake` and `planLandform` read `ctx.heights` (229–283, 439, 497–501). `objectsOnNewGround` compares heights (596–650). `startProblem` tests flatness on heights (865–883). `movePatch` and `moveStartNear` take the bench level from heights (710, 940). | Floor-aware ground for every planner. New planners for tunnels, arches, caves and overhangs. | M |
| `doc/placing.ts` | `waterDepth` takes the deepest stored water per tile, collapsing levels (36–44). Ruin fields keep to one level (291–293). `entityProblem` checks against the top surface (354–370). | Per floor. | M |
| `doc/session.ts` | `columns` empty in live mode (262). `roofedTiles` = every base column (279). `captureKept` keeps heights (633–652). `exportFile` joins built heights with the base columns (≈727). `withSettledWater` (839), `keptLayerOf` (849). | Runs throughout. No roofed exception once water is stacked. | M–L |

## 7. The editor's tools and planners (`src/editor`, `src/worker`, `src/ui`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `editor/Editor.tsx` | `Mirror` (72–78) and `applyView` (219–224) handle heights only. Every gesture uses `hit.x`/`hit.y` (492–545, 555–565, 916–919). `slopeAt` compares neighbour heights (436–449). `showTile` (596) and handles (627, 679–683) use `heightAt`. The start preview's bench is `heights[i]` (648). `mirrorOf` (1082). | z-aware hits, a cutaway control, and voxel mirroring. | M–L |
| `editor/tools.ts` | No brush. Land tools are outlines with one height 1–16 (176–177, 294). `featureFromRect` sets a plateau from the maximum height (319–345). `paintOverlay` writes RGBA per tile (374–391). | The new tools of DESIGN §6: carve and fill, tunnel, arch, overhang and cave. Overlays per voxel face. | L (new) |
| `editor/features.ts` | `TileContext.heights` (262–273). `entitiesByTile` ignores z (275–284). `describeTile` says "height N" (316–341). `checkStartAt` (527–653) uses `heights[i] !== z` (557) and `heights + depth` (606), with the 2D walks. `movePatch` (430). | Per floor. | M |
| `editor/panels.tsx` | Height selects (282–291, 297–307, 506–520, 574–587). "Water under roofs" is the only cave-aware UI (134–172). | A z range for the new tools. The roofed-water layer retires. | S–M |
| `worker/session.ts` | `ViewUpdate` carries heights (87–94), and `viewUpdate` diffs heights (288–305), so columns are never resent after open. `waterOf` (203–234) and `soilOf` (239–252) special-case `roofedTiles`. `damSiteLayer` builds its surface from `heights + water` (1003). | Run deltas in updates. General cave water. | M |
| `worker/api.ts:44–73, 140`, `generator.worker.ts:13` | `GenerateResponse` has heights, no columns. | Runs in the response and the transfer list. | S |
| `ui/Preview3D.tsx:12–22` | `viewOfResponse` hard-codes `columns: emptyColumns()`. | Runs from the response. | S |
| `ui/previewModel.ts:36`, `Preview2D.tsx:22–40` | One shaded pixel per tile. `describeTile` says "level N" (135). | A cave tint or a slice level. | S–M |
| `ui/View3D.tsx` | The height-colour toggle. | Hosts the cutaway control. | S |

## 8. The 3D view (`src/render3d`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `mesh.ts` | `meshChunk` (108–244): tops are greedy rectangles over heights, and walls run from the neighbour's height to this tile's. Multi-run columns get one quad per exposed voxel face, unmerged (225–242, `solid()`). `changedRect` (264–280) and `dirtyChunks` (252–261) diff heights. | One run mesher for every tile, with undersides and greedy merging per face plane (`proto/mesher.ts`). Dirty tracking by run diff. | L |
| `model.ts` | `MapView` = heights plus sparse `columns` (53–64, 141–146). `WaterView` already allows several columns per tile (34–44). `surfaceWater` keeps the highest-floor one and puts the rest in `lower` (116–139). `waterFromDepth` sets floor = heights (90–104). | Runs as the terrain view, with heights derived from them. | M |
| `pick.ts` | `pickHeightfield` (22–83) is a 2D DDA against heights; multi-run columns are hit at their surface. `TileHit` has no z. `pickPlane` (86–95). | A 3D voxel DDA returning (x, y, z, face), respecting the cutaway. | M |
| `waterMesh.ts` | `meshWaterChunk` (73–176): one surface quad per tile. Curtains, foam and corner blending compare neighbours' heights. Cave water (`lower`) gets a top quad only (166–172). Any cave water remeshes every chunk (203–206). | Neighbour tests per water column against the adjacent run at that level. | M–L |
| `light.ts` | `skyVisibility` (36–60) is a horizon scan over heights. `shadowTops`/`shadowMap` (87–124) are 2D. `tileData` (151–162) is an RGBA texture per tile. `waterByte` (133–139) drops cave water. | Occlusion per vertex or per voxel (baked in the mesher), and shadows that know about roofs. | L |
| `materials.ts` (terrain shader 354–548) | Every lookup goes through a W×H `tileTex`. A floor below `h0 − 0.5` counts as "under an overhang" with fixed shade (487–494). Undersides are a flat mortar colour (495–497). Walls take their foot AO from the neighbour's surface (498–528). Overlay, hatch and hover tint every face in the column (532–543). `sunLit` samples the 2D shadow map (286–294). | Per-vertex data from the mesher (AO, soil of the run top), per-voxel overlay and hover, and a cutaway clip uniform. | L |
| `renderer.ts` | `setMap` (258–300) and `updateTerrain(heights)` (407–426) take heights. Columns are never updated after an edit. Each edit redoes the full sky and shadow bake. `pick`, `heightAt`, `tileToClient`, `resetView` are per tile (521–655). | Run diffs, 3D picking, and a cutaway control. | M |
| `entities3d.ts` (413–460) | Objects already stand at their own z. Ruin ivy reads soil per tile (448). | Soil per run top. | S |

## 9. Tools (`tools/`)

| File | Assumption | Needs | Size |
|---|---|---|---|
| `bench3d.ts` | Terrain-agnostic. Its maps are generated River Valley seeds and every 256² local investigation map. | Generated 3D maps, and the cave maps. | S |
| `capture-look.ts` | `READ_VIEW_JS` reads heights and top water (143–166). Example points at `heights` (228–232). Poses at mean height (351–352). | Poses that frame a cave or an arch. | S–M |
| `ingame-files.ts` | `shadeTiles` PNGs (99). Edits avoid roofed tiles (676–684, 702–714). Samples print `heights + water` (728). | Cave test maps for the Probe (DESIGN §8). | S |
| `export-fixtures.py` | Water golden vectors are 2D numpy heightfields (36–60). | Voxel fixtures with caves. | M |
| `settings-suite.ts` | Height range, max height, step share and flat share from core metrics (35–85). | Cave measures. | S |
| `oracle.ts`, `batch.ts`, `bench.ts`, `bench-preview.ts`, `gen.ts`, `build-spike.ts`, `spike-check.ts`, `png.ts`, `export-footprints.ts` | No assumption of their own. | Cave-bearing generated maps to exercise them. | — |

## 10. Other prototype modules

| File | Assumption | Needs | Size |
|---|---|---|---|
| `prototype/watersim.py` | No roofs, by its docstring. `WaterSim` (49), `spill_levels` (202), `prefill` (232), `canonical_settle` (309), `moisture` (321), `contamination` (380) and `drought_storage` (438) take a 2D floor. It is the bit-for-bit oracle. | A stacked port, mirroring `proto/stackwater.ts` (DESIGN §2.4). | L |
| `terrain.py`, `generate.py`, `ruins.py`, `vegetation.py`, `preview.py` | Heights only (`shape_terrain` 80, `set_heightmap` 144, `connect_levels` 158, `place_fields` 85, `place_forests` 41, `place_bushes` 100, `shaded` 25). | Only the oracle parts need 3D. The prototype generator stays a heightfield reference. | S |

## 11. The M9 design's field (`investigation/generative`, `docs/m9-design.md` §12)

| Where | Assumption | Needs | Size |
|---|---|---|---|
| m9-design §12 (437–482) | The field is "a height field", stored as run-length levels in format 3's `field` (2.3–6.5 KB gzipped). Build step 1 starts from it. Locks keep "the kept surface" (472). Stamps copy a "field region" (474). Landmarks are reshaped by sculpt (458). | A field of runs per tile (DESIGN §1.2): the same run-length idea, one level deeper. Locks, stamps and regenerate-area on 3D regions. | M (design) |
| `proto/field.ts:34–73` `upliftField` | `Float64Array(W·H)` of float levels from parts and noise. | Stays: the surface. 3D forms come from carving processes after it (DESIGN §5). | — |
| `proto/erode.ts` | `drainage` (30–75) is a priority flood over 2D h. `erode` (77–107) is stream-power incision and diffusion per tile. | Stays a surface process. Karst and caves are separate processes that read its drainage. | M |
| `proto/levels.ts` | `snapLevels` (21–57): a Uint8 level per tile. `mergeSmallRegions`, `cleanPitsAndSpikes` and `fillDryHollows` (60–170). | 3D cleanup after carving: roof thickness, support, floating voxels. | M–L |
| `proto/hydro.ts:191–553` `planHydro` | Lakes from `filled − h` (303). `carve` lowers `h[i]` (403–420). Water classes per tile. | Unchanged for surface water. Underground rivers are their own process (DESIGN §5.3). | M |
| `proto/hazards.ts`, `start.ts`, `storage.ts` | The pit mask per tile, with `hh[j] = floor` (125–175). `shoreWalkFrom` level equality (31–75). `leveeStorage` floods over h (95). | The settler and storage on the floor graph. | M |
| `proto/generate.ts:55–59` `sculptsOf` | The field reaches the build as one `flatten` sculpt per level. | Runs reach the build directly (DESIGN §1.3). | S |

## The hardest changes

1. **Stacked water in two languages**: `sim/water.ts` and the `watersim.py` oracle, bit for bit.
   Done in TypeScript by `proto/stackwater.ts`. It is bit-identical to today's port on heightfields,
   and it reproduces the stored water of the official cave maps (REPORT.md).
2. **The settle and soil on a 3D graph**: the pre-fill, drought storage, and moisture and
   contamination per run top.
3. **The build's representation, from heights to runs**, with every `z = heights[i]` placement
   given a floor.
4. **Walking and playability per floor**: walk, regions, slopes and playability, and their
   Python mirror.
5. **The view**: one run mesher for every tile, lighting per vertex, a cutaway, and 3D picking.
