# The 12 open facts, checked against the game code

The first version of this study listed 12 questions it could not answer from the repository's notes.
Each is now answered from the game's own code and data.

**Game version.** Timberborn 1.1.2.4 (build `52e959e`, Steam build 25096761). The assemblies were decompiled on
2026-09-23 into the main checkout's ignored `investigation/decompiled/`; the installed DLLs have not changed since
2026-09-04, so the decompile matches the install. Blueprint numbers come from the same build's
`investigation/raw/blueprints/`. No decompiled code or game file is copied here: rules are described in our own words,
with the class and member that implements them. Assembly names drop the `Timberborn.` prefix.

**Verdicts.** *Confirmed*: the study's claim holds. *Corrected*: the claim or measure was wrong; the fix is below.
*Answered*: the study left it open and the code settles it. *Still unknown*: only play can settle it.

| ID | Question | Verdict | In one line |
|---|---|---|---|
| U01 | Water wheel output | **Corrected** | Power follows the net flow along the wheel's axis at its blade cells, not falls or total outflow. |
| U02 | Floodgates | Answered | 1-, 2- and 3-level gates, identical for both factions; water below the crest cannot pass. |
| U03 | Crop chains | Answered | Full crop and food tables below; every food meets hunger equally. |
| U04 | Opening schedule | Answered in part; schedule **still unknown** | All rates are known; whether a colony gets there in time is play. |
| U05 | Aquifer drills in hazards | **Confirmed**, two details corrected | Off in every hazard; the cut starts before a drought; no badwater. |
| U06 | Omitted `UnstableCore` component | **Corrected** (blocks notes §6) | The component is required; without it the map crashes on load. |
| U07 | Ruins | **Confirmed** walk-through; rate **corrected** | One scrap per trip for beavers and bots; bonuses only shorten the 1.8 h work. |
| U08 | Blockage top | **Confirmed** | A bank-level crossing without a path. |
| U09 | Survival margin | **Still unknown** (inputs confirmed) | The drink, food, weather and breeding rules are known; the margin is play. |
| U10 | Other faction systems | Answered in part | Wind is global and terrain-blind; Iron Teeth have no wind power. Suitability is a judgement. |
| U11 | Construction access | Answered | Builders reach from any walkable cell around the site within road reach; closures can be built in flowing water. |
| U12 | Caches, blasts, stacked water | Answered | Foreign-good caches are deleted; blasts are spheres of radius + 1; stacked water behaves as the notes say. |

## U01. Water wheels: corrected

**Rule.** Each tick a wheel reads its blade cells (`PowerGeneration.WaterPoweredGenerator.CalculateCoordinates`).
For each blade cell under water (`WaterSystem.ThreadSafeWaterMap.CellIsUnderwater`), it takes the flow vector
(`FlowVectorCalculator.GetFlowVectorAtTop`: right outflow minus left, top minus bottom, from the stored momentum)
and keeps the signed part along the wheel's axis. A cell counts only if that part exceeds 0.15 m³/s
(`WaterPoweredGeneratorSpec.MinRequiredOutflow`). The counted values are summed with their signs and divided by the
number of blade cells, counted or not (`CalculateGeneratedRotation`). Power is `PowerOutput` × |mean|, rounded up
(`UpdateGenerator`, `MechanicalSystem.MechanicalNode.UpdatePowerOutput`).

| Wheel | Faction | Size | Blade cells | `PowerOutput` | Cost, science |
|---|---|---|---|---|---|
| WaterWheel | Folktails | 3×2×3 | 2, side by side across the flow | 270 | 50 logs, 0 |
| CompactWaterWheel | Iron Teeth | 3×1×3 | 1 | 120 | 25 logs, 0 |
| LargeWaterWheel | Iron Teeth | 5×3×5, sunk 2 levels | 2, side by side | 540 | 70 logs + 80 planks, 200 |

- Power is linear in flow with no cap and no height term. A fall matters only through the flow it makes.
- Flow either way along the axis powers the wheel; sideways flow does not. Opposite flows in two blade cells cancel.
- Contamination and weather are not read. A wheel stops when the flow drops under 0.15, as in drought once sources stop.
- A finished wheel is blocked when water rises above its flood-check cell: base + 2 for the WaterWheel and Compact,
  placement level + 1 for the Large wheel (`FloodableBuildingSpec`, `WaterObjects.BlockableFloodableObject`).
- The WaterWheel needs all six base cells on ground; the Compact needs only its middle cell (blueprint `BlockObjectSpec`).

**What changes.** The old measure summed all four stored outflows, which counts sideways and backward flow and
overstates power. [measure.ts](measure.ts) now reports `peakAxialFlow64` (the net axial flow at a bank cell, with the
0.15 cut-off), `compactWheelHp64` and `waterWheelHp64`. The power axis bins use `peakAxialFlow64`
([AXES.md](AXES.md)). These still do not check that a wheel's full footprint fits.

## U02. Floodgates: answered

| Gate (both factions) | Size | `FloodgateSpec.MaxHeight` | Cost | Science |
|---|---|---|---|---|
| Floodgate | 1×1×3 | 1 | 10 logs + 5 planks | 150 |
| DoubleFloodgate | 1×1×4 | 2 | 20 logs + 10 planks | 250 |
| TripleFloodgate | 1×1×5 | 3 | 30 logs + 15 planks | 500 |

- **Control** (`WaterBuildings.Floodgate`): height 0 to `MaxHeight`, set in 0.05 steps, default `MaxHeight` − 0.35.
  An automation input switches to a second height. Gates synchronise with neighbouring gates by default
  (`FloodgateSynchronizer`).
- **As an obstacle** (`WaterObjects.WaterObstacle.AddToWaterService`): each whole level is a solid block; the fraction
  is a partial obstacle (`WaterSystem.FlowLimiterService`). This applies once the gate is finished.
- **No leak.** Below the crest no new flow enters and old momentum fades within a few substeps; within 0.1 above the
  crest flow is scaled down (`OutflowsUpdateTask.GetOutflow`).
- **Dam**: 1×1×1, 20 logs, no science, a fixed 0.65 crest. **Levee**: 12 logs, 120 science, a full block that also
  stops moisture from above. There is no sluice in 1.1; ThrottlingValve and FillValve are the flow controls.

## U03. Crops and food: answered

Hunger falls 0.8 a day and every food restores 0.3 (`Need.Beaver.Hunger`, `GoodSpec.ConsumptionEffects`): 2.67 food
per beaver per day, 1.07 on Easy. Crops grow only on moist, uncontaminated soil and die if any water covers them
(`Planting.PlantingSoilValidator`, `FloodableNaturalResourceSpec`). Farms reach 20 walking steps.

| Folktails crop | Grow (days) | Yield | Dies dry (days) | To food |
|---|---|---|---|---|
| Carrot | 4 | 3 | 2 | raw |
| Sunflower | 5 | 2 | 3.5 | raw |
| Potato | 6 | 1 | 1 | Grill: 1 → 4 |
| Wheat | 10 | 3 | 0.5 | Gristmill 1 → 1 flour; Bakery 1 → 5 bread |
| Cattail (in 1 level of water) | 8 | 3 | 1 | Gristmill, then Bakery 1 → 4 |
| Spadderdock (in water) | 12 | 3 | 0.3 | Grill 1 → 3 |
| Chestnut tree | 23, then every 8 | 3 | 8 | Grill 1 → 2 |
| Blueberry (both factions) | 12, then every 12 | 3 | 9 | raw |

| Iron Teeth crop | Grow (days) | Yield | Dies dry (days) | To food |
|---|---|---|---|---|
| Kohlrabi | 3 | 2 | 2 | raw |
| Cassava | 5 | 1 | 3 | Fermenter 4 → 10 |
| Soybean | 8 | 2 | 0.25 | Fermenter 6 + 1 oil → 20 |
| Corn | 10 | 2 | 2 | Food Factory 1 → 5 |
| Eggplant | 12 | 3 | 1 | Food Factory 1 + 1 oil → 6 |
| Mangrove (water ≤ 1 on its tile) | 10, then every 10 | 4 fruit | 6 | raw |
| Hydroponic Garden | — | 40 water → 45 mushrooms per 192 worker-hours | — | Fermenter 4 → 16 |

First farms: Folktails EfficientFarmHouse (25 logs, 3 workers), Iron Teeth FarmHouse (20 logs, 2 workers), no science.
The Iron Teeth Fermenter needs 50 hp; the Folktails Grill needs none. Sources: `NaturalResources/*`, `Recipes/*`,
`Buildings/Food/*` blueprints (`Growable`, `Yielder`, `RecipeSpec`, `BuildingSpec`, `WorkplaceSpec`).

## U04. Work, hauling and building: answered in part

- **Hours**: work runs from hour 0 to 16 by default, adjustable 0–24 (`WorkSystem.WorkingHoursManager`,
  `DayNightCycleSpec.ConfiguredDaytimeLengthInHours`). A new game starts at hour 4, so day 1 has 12 work hours
  (`HoursPassedOnNewGame`). Bots ignore working hours.
- **Walking**: 2.7 tiles/s, 1.35 when carrying; paths give no speed bonus; water lowers the speed multiplier by 0.3
  (`WalkingSystem.WalkerSpeedManager`).
- **Carrying**: 14 for a beaver, 20 for a bot (`Carrying.GoodCarrierSpec.BaseLiftingCapacity`): 2 logs or 7 water per trip.
- **Building**: build time is ceil(material units / 20) hours, one builder per site, two builders at the District Center
  by default (`ConstructionSites.ConstructionSiteBuildTimeCalculator`, `ConstructionSiteReservations`).
- **Start**: 9 adults and 4 children; Normal gives 130 berries and no water or logs (`GameStartup.StartingGoodsProvider`, `GameModeSpec`).
- **Pump**: 1 water per 0.33 worker-hours (`Recipe.Water`): 48.5 water per 16-hour day, enough for 23 beavers on Normal.
  The study's "45–50 pump goods per work-day" is **confirmed** as a ceiling.

**Still unknown**: whether the first pump, storage and food are ready in time. That depends on walking distances,
meals and sleep, which only play measures.

## U05. Aquifer drills: confirmed, with two corrections

- The aquifer gives nothing unless a finished drill stands on it (`GameWaterSourceSystem.UndergroundWaterSource`).
- The drill gives 0 in badtide and 0 unless active and powered; otherwise its network's power efficiency, so partial
  power gives partial water (`UndergroundWaterSourceDrill.GetStrengthModifier`, `MechanicalSystem.MechanicalGraph`).
- It is blocked from the start of any hazard to its end (`OnHazardousWeatherStarted` / `OnHazardousWeatherEnded`).
- The ancient drill needs 200 hp, the player drill 400 hp and 400 science.
- **Correction 1**: the aquifer is a `WaterSource`, so the drought ramp applies. Its flow starts falling
  S / 2.67 days *before* a drought (`WaterSourceSystem.DroughtWaterStrengthModifier`), and rises over the same time after.
- **Correction 2**: it emits no badwater in badtide, because its strength is 0 then.

## U06. `UnstableCore` component: corrected

The component is **required**. `Explosions.UnstableCore.Load` falls back to an old `TimeBomb` key and then asks for it
unconditionally; a missing or empty component throws, and the game's error handler stops the load
(`WorldSerialization`, `ErrorReporting.ExceptionListener`). The blocks notes' "optional" row is wrong; the format and
navigation notes are right. The radius is not range-checked on load. The timer component is optional (defaults:
cycle 5, 10.5 days). Official maps always include both.

## U07. Ruins: walk-through confirmed; rate corrected

- Ruin columns add nothing to the navigation mesh, so beavers walk through them; they still block paths and buildings.
- Scrap is 15 per column level, 1.8 hours of work per unit (`Ruins.RuinSpec`, blueprint `Yielder`).
- **Correction**: a trip carries max(1, floor(capacity / 11)) scrap (`Carrying.CarryAmountCalculator`, scrap weight 11). That is
  **one scrap per trip** for beavers (14) and bots (20), with no carrying bonus for scavengers. Bonuses only shorten the
  1.8 hours (`ReservableSystem.WorkAtReservableExecutor`). Bots work 24 hours. One scrap overburdens a beaver (−50% speed).

## U08. Blockage top: confirmed

The Blockage is a one-level full water obstacle. Its navigation settings add one-way, non-path edges from its top to
its four neighbours, and bank cells at that level connect to it, so beavers cross at bank level without a path.
Adjacent blockages chain. Nothing can be built on it. Demolition takes 4 hours of one builder, not shortened by
bonuses (`DemolishableSpec`, `Demolishing.Demolishable.ProgressDemolition`).

## U09. Survival margin: still unknown

The inputs are confirmed: 2.12 water (0.424 m³) and 2.67 food per beaver per day on Normal and Hard, ×0.4 on Easy
(`GameFactionSystem.NeedModificationService`); death after 5.7 days without water or 5.0 without food; weather durations and odds per
mode (`GameModeSpec`); Folktails breed by chance in homes and Iron Teeth by pods; bots neither eat nor drink.
Whether a colony keeps its margin through repeated hazards depends on building, population and industry: play.

## U10. Other faction systems: answered in part

| | Folktails | Iron Teeth |
|---|---|---|
| Wind | WindTurbine 150 hp, LargeWindTurbine 300 hp | none |
| Water wheels | WaterWheel 270 hp | CompactWaterWheel 120 hp, LargeWaterWheel 540 hp |
| Other power | PowerWheel 50 hp | LargePowerWheel 300 hp, SteamEngine 400 hp |
| Pump reach | 2 (4 with the Large pump) | 6 |
| Housing | Lodges, 1–9 | Rowhouses and barracks, 5–16 |
| Breeding | chance on entering a home | breeding pods, food and water per child |

Wind is one global value, re-rolled every 5–12 hours; height, terrain and obstruction play no part
(`WindSystem.WindService`, `WindPoweredGenerator`). Geothermal engines give 400 hp to both factions. A map can
therefore favour Folktails only through water, not through wind. Which faction a map "suits" stays a judgement.

## U11. Construction access: answered

- Builders stand on any walkable cell in the ring around the footprint's base level
  (`BuildingsNavigation.ConstructionSiteAccessible`), which must lie in the district's road spill: walkable ground within
  9 tiles in x and y of a road and fewer than 20 steps (`Navigation.RoadSpillFlowFieldGenerator`).
- Wheels, gates, dams, levees and platforms have no entrance and need no road to work.
- Nothing checks water when placing, and walking ignores depth, so closures can be built in flowing water. Each tile
  becomes an obstacle only when finished, so water flows through the gaps until the last tile closes.
- A platform costs 6 planks and 100 science; dam and levee tops are walkable.

## U12. Caches, blasts and stacked water: answered

- **Caches**: a stockpile whose fixed good is not in the faction's list is deleted at start, with no refund
  (`GameStockpiles.FixedStockpileRemover`). Stock over capacity is kept, not clamped (`InventorySystem.Inventory.LoadFromNamedComponent`).
- **Blasts**: a sphere of radius `ExplosionRadius` + 1 around the core's shared corner, spreading one ring per tick.
  It removes terrain, deletes every block object including the District Center, kills every character in range and
  sets off neighbouring cores (`ExplosionOutcomeGatherer`, `ExplosionService`). It does not touch water directly;
  removed terrain and obstacles reopen water space.
- **Stacked water**: confirmed. Columns split at terrain and obstacles; water moves only sideways; full columns store
  pressure (×8 head, capped at (34 − ceiling)/8, the rest deleted). Removing a separator merges columns at once.

## What still needs play

- U04: the real opening schedule. U09: the survival margin. U10: whether a faction suits a map.
- Not traced: whether beavers can walk on a floodgate top, and how two stacked dams share a cell.
