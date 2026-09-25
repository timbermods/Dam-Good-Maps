# Fidelity: every timing, from the game's code

The first model approximated soil, plants and some source timings. This version follows Timberborn
1.1.2.4's own code (build `52e959e`, decompiled from the Steam install; the decompile matches the installed
DLLs). Rules are described in our own words, with the class and member that implements them; no game code is
copied. Assembly names drop the `Timberborn.` prefix.

**How effects were measured.** [fidelity.ts](fidelity.ts) runs the 12 reference maps (the viewer's maps) on three
probes: the first Normal drought, the first badtide and the later Hard drought. Each probe runs with the exact
model, then with one rule group switched back to the first model's approximation, then with the first model
itself (taken from git into an ignored cache). "Effect" is the change the exact rule makes, averaged over the
maps, and its largest value. Raw numbers: [results/fidelity.json](results/fidelity.json) and
[results/fidelity-summary.json](results/fidelity-summary.json).

## What the exact rules change

Per map, exact model minus the first model's rule, mean and (largest). For scale, at the end of the first
badtide a reference map has on average 1,479 badwater tiles, 1,200 contaminated soil tiles, 2,404 moist tiles
and 136 original plants dead.

| Rule group | First Normal drought | First badtide | Later Hard drought |
|---|---|---|---|
| **Water contamination transport** | Moist tiles ±2 (23) | Badwater tiles +242 (+1,069); contaminated soil −518 (−1,132), about −43%; moist tiles −161; dead original plants −18 (−47), −12%. On 3 maps the start now loses clean pumpable water on badtide day 2. | No change |
| Soil moisture, per tick | After recovery, moist tiles −40 (−317) of 5,500 | At its end, moist tiles −102 (−245); no change in deaths | After recovery, −37 (−266) |
| Soil contamination, per tick | No change | Contaminated soil +9 (+26); deaths ±0 | No change |
| Initial state from the file | Volume ±0.1% | Badwater ±8 (95); deaths ±2 (17); volume ±1.8% at most | Volume ±0.1% |
| One-tick lags between tasks | Volume ±0.1% | Contaminated soil +5 (+10) | End volume ±1% |
| Evaporation, dam and source bookkeeping | None | ≤ 2 tiles | End volume ±0.5% |
| Flood delay × U(0.9, 1.1) | None | None | None; no original plant stood in water long enough |
| Calendar: sources slow before the next drought | None | None | End volume −85%: the next cycle has only five temperate days, so the probe's last day includes the next drought's slowdown. The first model never slowed sources after a probe. |
| **The first model, all rules** | Volume ±0.1%; moist −42 after recovery | Badwater +234; contaminated soil −525 (−44%); moist −371; deaths −17 (−60); start water lost on 3 more maps | End volume −85% (calendar); deaths unchanged |

Three more rules had no measurable effect here:

- **A new game starts at 04:00.** The first cycle's outcomes at each day boundary are identical to a start at
  00:00.
- **Weather odds.** The schedules for seed 1729 are identical to the first model's (Easy and Normal 30 cycles,
  Hard 40), because no streak forced a chance of exactly 1 in the probed cycles.
- **Probe lead.** Every reference map's longest source ramp is under a day, so drought probes still start one
  day early.

Loading the file's state matters most on the first day: the generator writes zero flow momentum, so some rivers
hold extra water while flow rebuilds. Across the survey that is up to +4.6% of a map's water on day 1 (Highlands
128² seed 22); the median is 0.03%.

Plant deaths in droughts did not move at all: dry timers run 8–15 days, so a timing change of hours in when
soil dries does not change which plants a drought kills.

## One game tick

`TickSystem.TickableSingletonService.TickAll` runs every 0.6 s of game time (`TickTimeSpec`):

1. It waits for last tick's parallel tasks.
2. It ticks the singletons: the clock (`TimeSystem.DayNightCycle`), the water snapshot other systems read
   (`WaterSystem.ThreadSafeWaterMap`), the source snapshot (`WaterSourceRegistry`), the evaporation buffer swap
   (`SoilMoistureSystem.WaterEvaporationMap`), the soil levels published to plants (`SoilMoistureService`,
   `SoilContaminationSystem.SoilContaminationService`), flood checks (`WaterObjects.WaterObjectService`) and due
   timers (`TimeSystem.TimeTriggerService`).
3. It starts the parallel tasks: water (`WaterSimulator`), soil moisture and soil contamination. All three read
   the water as the last tick left it.

Entity components (water sources, badtide controllers, timed activators) tick in 128 buckets spread over the
tick (`TickableBucketService`). They read the snapshots, so what they change reaches the water next tick.

The model runs the same order. The order among ordinary singletons comes from the dependency container and
is not fixed in one place in the code; the model assumes clock, snapshots, soil, floods, timers. A different
order moves an event by at most one tick (0.0013 day).

## The rules

| Rule | Game class and member | What the game does | First model | Now |
|---|---|---|---|---|
| Tick and substeps | `TickTimeSpec`, `WaterSimulationTaskStarter.Simulate` | 0.6 s ticks; two water substeps of 0.3 s. | Same | Same |
| Calendar | `DayNightCycle.Load`/`ProgressTimeBy`, `GameCycleService.StartNextDay` | A new game starts at 04:00 on day 1. A cycle day starts at tick 0 of each day. | Phases in whole days from 00:00 | The game's calendar; the continuous run starts at 04:00 |
| Hazard start and end | `WeatherService.OnCycleDayStarted`/`OnCycleEndedEvent` | A hazard starts on cycle day temperate + 1 and ends when its cycle does. | Same, in phase time | Same, on the clock |
| Weather odds | `HazardousWeatherRandomizer`, `RandomNumberGenerator.CheckProbability` | Badtide chance from the streak rule; a chance of 1 draws no number. | Always drew | Draws only when the game does |
| Hazard length | `DroughtWeather`/`BadtideWeather.GetDurationAtCycle` | Uniform in [h·min, h·max], rounded away from zero, at least 1. | Same | Same |
| Drought ramp | `DroughtWaterStrengthModifier.GetTemperateWeatherModifier` | Flow falls over S/2.67 days before a drought by 1 − x(0.85x + 0.15), and rises the same way after it, on the cycle-day clock. | Same curve; probes began 1 day before the drought | Same curve; drought probes start ceil(longest ramp) days before |
| Badtide contamination | `BadtideWaterSourceContaminationController.GetCurrentContamination` | 0.5 + 0.5·sech(17(t − 0.5)) in the first and last half day, 1 between; reset when the badtide ends. | Same curve, same tick | Same curve, reaching the water one tick later |
| Source snapshot | `WaterSourceRegistry.Tick`, `ThreadSafeWaterSource` | The water reads strength and contamination as the sources last set them. | Same tick | One tick later |
| Timed sources | `TimedComponentActivator` | Off until D days after cycle N starts, then on for good. | Also switched off again in cycle N's hazard | On for good (none on generated maps) |
| Seeps | `WaterDepthStrengthModifier.GetStrengthModifier` | Off above 0.8 deep at the anchor, on below 0.72, fading in at 0.5 per second of Unity frame time. Starts disabled. | Instant on and off | Fade included, 60 frames a second at speed 1 (none on generated maps) |
| Aquifers | `UndergroundWaterSource`, `UndergroundWaterSourceDrill` | Nothing without a finished, powered drill. | Off | Off |
| Water flow and depth | `OutflowsUpdateTask`, `WaterParametersUpdateTask` | Unchanged from the validated port. | Port | Same port |
| Evaporation | `WaterParametersUpdateTask.ProcessWaterDepthChanges` | Every column evaporates, a dry one receiving water at the fast rate. | Only wet columns | Every column |
| Evaporation modifier | `WaterEvaporationMap` (`BufferedArray`), `WaterEvaporationCalculationTask` | From the soil pass's cluster saturation, swapped in a tick later: two ticks old when used. | From the current water | Two ticks old |
| Dam crest | `FlowLimitCalculator.GetHeightLimit` | Searches from the higher of the two floors; flow from higher ground into a dam tile is not limited. | Limited whenever the target had a dam | The game's search |
| Map edge | `OutflowsUpdateTask.GetOutflow` | The open edge column counts as dry ground at floor 0 for the spill threshold. | Threshold skipped at the edge | Applied |
| Source tiles' previous depth | `UpdateWaterSourcesTask`, `WaterDepthSetter.SetWaterDepth` | Every source, running or not, resets its tiles' previous depth (used by the dam rule). | Unchanged | Reset |
| Water contamination | `SimulateContaminationTask`, `UpdateContaminationTask` | After the depth update, a tile mixes in the net stored flow from each neighbour; its own water keeps its share (evaporation does not concentrate it). Neighbours exchanging under 0.125 m³/s at surfaces within 0.1 diffuse at 0.45. | Gross flows, concentrated by evaporation, no diffusion | The game's transport |
| Cluster saturation | `WateredNeighborsCountingTask`, `ClusterSaturationCalculationTask` | 1 + wet 8-neighbours, raised to a 4-neighbour's count − 1, capped at 8. | Same | Same, from the snapshot |
| Soil moisture | `MoistureCalculationTask.CalculateMoistureForCell` | Each tick: exactly 2·sat on clean water. Otherwise, from 4-neighbour water its range less 6 per level up, and from 8-neighbours last tick's value less 1 (1.414 diagonally) and 6 per level up. Rising toward the water's value is capped at +3.996 a tick; taking a neighbour's value is not. Everything decays 0.75 a tick. The result is scaled by the tile's own water's (1 − contamination); under 0.01 it is 0. | Steady-state target every 16 ticks, moved at +4 and −0.75 a tick | The game's rule every tick, 32-bit |
| Soil contamination | `ContaminationCandidatesCountingTask`, `ContaminationsUpdateTask` | Each tick: a candidate 2(c − 0.5) from 4-neighbour water with c ≥ 0.5, less 5/7 per level up; from 8-neighbours, last tick's candidate less 1/7 (√2/7) and 5/7 per level up. Rising toward the water's value is capped at +0.0396 a tick; taking a neighbour's is not; decay is 0.0198. The level follows the candidate at +0.021 or −0.006 a tick and is 0 under 0.001. | Steady-state target every 16 ticks, same rates | The game's rule every tick, 32-bit |
| Soil seen by plants | `SoilMoistureService.Tick`, `SoilContaminationService.Tick`, `DryObject`, `ContaminatedObject` | Plants see last tick's soil. | Checked every 16 ticks | Every tick, one tick late |
| Dry (and wet) dying | `WateredNaturalResource`, `AridNaturalResource`, `TimeSystem.TimeTrigger` | A timer of DaysToDieDry × U(0.9, 1.1), drawn once per plant, runs while the soil is dry and resets when it is moist. Succulents use DaysToDieWet while moist. | Same delays, counted in 16-tick steps | Counted on the game clock each tick |
| Flooding | `LivingWaterObject`, `WaterObjectService.Tick`, `LivingWaterNaturalResource` | Any water on a land plant's tile starts DaysToDie × U(0.9, 1.1). | Exactly DaysToDie | With the random factor |
| Contaminated soil | `ContaminatedNaturalResource` | Contaminated soil starts U(0.2, 0.3) days. | Same | Same |
| Death | `LivingNaturalResource.Die`, `GatherableYieldGrower.RemoveYield`, `DeadCuttableYieldRemover` | All timers stop. Trees keep their logs; bushes lose their berries; succulents lose their water. Only the map editor revives plants. | Same | Same |
| Initial state | `WaterSimulator.PostLoad`, generator `settledSimulationSingletons` | The game loads the file: seven-digit values read as floats, momentum zero. | Full-precision settle state and momentum | The file's state |

## How the port was checked

- **Water.** With the first model's rule groups switched back on, the game-order water step matches the
  repository's validated port to within 2 × 10⁻¹⁴ on all 11 golden fixtures without seeps, over 300 ticks. The only
  difference is the order in which the game adds each direction's flows. The three golden drought checks stay
  within 5% (0.73%, 2.71%, 0.36%).
- **Soil.** The soil pass recomputes only tiles whose inputs changed. On a 96² badtide day (in `test.ts`), and on a
  128² Lake Basin badtide, River Valley drought and Islands badtide, it equals a full recomputation of every tile,
  tick for tick, and so do the plant deaths.
- **Calendar and weather.** `test.ts` checks the 640-tick first day, the order of hazard events, the ramp values,
  the badtide curve, the streak rule and the timers' pause and reset.

## Random draws

The game draws with Unity's generator (`Common.RandomNumberGenerator`). Its sequence cannot be reproduced, so the
model draws with a seeded generator and the game's odds: weather from seed 1729, plant delays per plant from
`hash(seed, plant id)`. Changing either seed changes which days and plants are hit, not the rules.

## Limits

- **Arithmetic.** The game computes water in 32-bit floats; the model keeps the validated 64-bit port. The port
  reproduced a game save to 0.001 m after 975 ticks. Soil is 32-bit, as the game stores it.
- **Singleton order.** Assumed as above; at most one tick either way.
- **Seep fade.** It depends on the player's frame rate and game speed: 1.2 × fps / speed game seconds to full. No
  generated map has seeps.
- **Heightfields only.** Roofed water, drains and explosions stay outside this study.

## Measures, not game rules

Some study measures are thresholds of its own. A game pump draws from the lowest air cell its pipe reaches (two
levels for the WaterPump, `WaterInputPipeCoordinates`, `WaterInputPipeSpec.MaxDepth`) whenever that cell holds
any water, and its clean output scales by (1 − contamination). The study's "pumpable" water keeps its margins:
at least 0.3 deep and below 5% contamination. "Wet" means deeper than 0.05. These define the reports; they are
not the model's physics.
