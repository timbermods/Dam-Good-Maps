# Carry-over to the terrain3d prototype

The branch now exists. This assessment reads `investigation/terrain3d` at **72d2aa2e88d91f1bfce1ba6fe70de4536a1922e3**, including its design, game-rule notes, column representation and `StackSim`. Sources are recorded in `results/weather/terrain3d-reference.json`. No stacked simulation, game or save is run by this follow-up. None of the present speedup factors is a 3D measurement.

## What the available solver does

[`StackSim`](https://github.com/timbermods/dam-good-maps/blob/72d2aa2e88d91f1bfce1ba6fe70de4536a1922e3/investigation/terrain3d/proto/stackwater.ts) stores depth, old depth, contamination and overflow per air-gap column, using slot-major ids `slot * N + tile`. It already caches candidate edges in `eStart`, `eTarget`, `eDir` and `eRev`, ordered by direction and then neighbour slot. Momentum is per edge.

Water transfers sideways between overlapping columns of adjacent tiles. There is **no direct vertical transfer through a roof within one tile**; elevations connect through overlapping gaps in adjacent tiles. Overflow supplies pressure and is capped. A cave can retain the same visible depth while overflow and momentum change, so unchanged depth cannot justify freezing it.

The `port`/`game` mode names concern hydraulic rules. The source explicitly states that **both modes use the older volume-weighted contamination mix, without the exact weather model's diffusion**. `run()` calculates evaporation before each pair of water substeps, unlike the exact weather model's delayed soil/evaporation publication. The design describes per-run soil but supplies no validated dynamic layered `GameSoil` in the inspected prototype. Its heightfield parity tests target the earlier core water port, not this exact `CycleModel`.

A layered exact-weather reference must first establish its own transport, soil, source and publication rules. The terrain3d design's proposed version bump and approximate wet/depth comparison are outside this task's bit-identity constraint; this investigation does not adopt them.

## Which techniques carry over

| Candidate | Transfer and required changes |
|---|---|
| Soil descriptor reuse | **The principle transfers; the descriptor set does not.** A run top can read own water, a filled cave below its roof, selected topmost neighbouring water, and overlapping soil runs. Include the actual column/run selections, roof thickness and full-to-ceiling predicates in the remembered inputs. Moisture and contamination use different neighbour-water selectors. Finish comparisons with old descriptors before retaining new values, and preserve dirty-list/publication order. No layered dynamic-soil speedup is measured. |
| Conservative contamination support | **The graph argument transfers; this radius-two kernel is not a drop-in change.** The current stacked prototype mixes across edges once and has no diffusion. A future exact layered model with one-edge mixing then one-edge diffusion needs two expansions along actual column connections, covering contributing reverse edges and source rules. Re-derive reach if phases change. Preserve signed zero, scratch-buffer invariants and dense fallback. Do not invent vertical edges or substitute XY distance for column connectivity. |
| Incremental saturation | **Invalidation transfers; the flat stencil does not.** `neighbourWet()` counts a neighbouring tile once when an eligible overlapping column is wet, with its slot-0 shortcut. It does not count every wet layer separately. `bestWn()` selects counts from overlapping wet columns. Build reverse dependencies for these selectors: one changed wet column can affect several layers in eight neighbouring tiles; changed counts/wet states can affect several layers in four neighbouring tiles. Finish all affected counts before saturation reads. Preserve the chosen reference's evaporation precision and timing. |
| Scalar WASM and shared views | **The technique transfers; the tested kernel does not.** Reuse the existing ordered edges. A new kernel needs ceilings, overflow/pressure, height/direction limits, variable edge ranges and reverse indices. Preserve direction-then-slot sums, source order and overflow clamping expressions. Size memory by column capacity and edge count, keep views stable, and retain strict compiler gates. The current four-neighbour kernel lacks these inputs and rules. |
| Background work, streaming and caching | **These transfer without changing physics.** The complete input key must include runs/column topology, floors/ceilings, objects/limiters, initial overflow/momentum, soil-run mapping, mode and model version. Start from the accepted map's state, copy selected layers for display and cancel obsolete revisions. Independent scenarios can use separate workers; dependent days of one history cannot. Display frames still lack complete resumable state. |

The [terrain3d rules](https://github.com/timbermods/dam-good-maps/blob/72d2aa2e88d91f1bfce1ba6fe70de4536a1922e3/investigation/terrain3d/GAME_RULES.md) give cave water the same evaporation treatment as open water: **there is no sky/shelter term**. Do not invent a roof-exposure input. Roof geometry matters through column overlap and the specified per-run soil rules.

## Memory and integration order

Support tracking costs eight bytes per represented water cell; saturation tracking costs ten per represented soil cell. Their counts differ from XY tile count and each other. `StackSim` currently allocates padded slot-major arrays of capacity `L * N`, including unused slots. Compact storage could save memory but must retain stable column identities, slot order and accumulation order. Edge storage scales with overlapping column pairs, which may exceed four edges per column.

Establish an exact layered-weather reference and checkpoints including overflow and per-edge momentum first. Then evaluate strict WASM over its ordered edges and descriptor reuse over complete per-run inputs. Evaluate zero-support transport and saturation invalidation once their dependency sets are explicit. Keep product scheduling/cache work separate.

A heightfield fast path needs proof for the local columns **and neighbours**, ceilings, overflow, limiters and arithmetic rules. One open column at the origin is insufficient if a neighbour has several slots. The branch's proposed core-port fast path does not automatically qualify for exact weather.

Future parity cases should include cave/surface pools at the same XY, pressurised passages, different roof thicknesses, one column adjoining several slots, slot-0 saturation selection, cave-floor sources, limited outlets, open boundaries and topology edits. These are integration gates, not 3D results claimed by this study.
