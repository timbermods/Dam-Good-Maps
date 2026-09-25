# Techniques worth borrowing

Borrow the ideas; generate all geometry ourselves. These are ranked by expected value to Dam Good Maps, not by visual spectacle. The first two have [small experiments](REPORT.md). Neither is ready for production.

M9 already composes landform parts, erodes uplift and follows drainage. Extend that system. Never turn a theme or named trait into a fixed layout. A useful difference changes settlement, storage, danger or expansion.

| Rank | Technique | Answers | Fit |
|---|---|---|---|
| 1 | Independent spatial controls | 1: varied layouts | Genome → uplift |
| 2 | Erode first; snap with protected contours and channels | 2: 16–22 levels; 7: drainage | Erosion → levels → hydrology |
| 3 | Select starts by guarantees and opportunity vectors | 5: reliable and fair starts | Settler; future multiplayer |
| 4 | Carve density, then prove support | 3: caves, arches, overhangs, tunnels | 3D terrain steps |
| 5 | Rare traits with measurable consequences | 6: memorable worlds | Genome; derived names |
| 6 | Connect useful shelves, preserve dramatic cliffs | 4: traversable verticality | Derived slopes; start rules |
| 7 | Keep catchments, spill levels and source budgets | 7: rivers, lakes, falls | Drainage; canonical water settle |
| 8 | Measure the space of possible openings | 1 and 5: different play | Candidate selection and batch tools |

## 1. Independent spatial controls

**Source idea.** Minecraft 1.18 separates terrain shape from biome identity. Kniberg's explanation uses continentalness, erosion and peaks/valleys as interacting controls. “Erosion” here is a noise parameter, not simulated sediment transport. [Developer explanation](https://www.youtube.com/watch?v=CSa5O6knuwI), [Mojang's 1.18 overview](https://www.minecraft.net/en-us/article/caves---cliffs-part-ii-the-features).

**What and why.** Several slow fields control different properties. A high region can be smooth or rugged; a valley can cross several geological regions. Their combinations yield more arrangements than choosing a valley, island or canyon template.

**DGM fit.** Add independent spatial fields for regional elevation, local relief and ridge/valley bias to the genome. Sample their lengths and strengths separately. Let them steer M9's existing parts and erosion strength. Keep themes as priors. On larger maps, keep local feature sizes in tiles and increase part counts. Continentalness means broad elevation bias here; DGM need not acquire oceans or Minecraft biomes.

**Cost.** A few noise evaluations per tile, O(N) memory/time for a fixed octave count. Calibration is the larger cost: correlated fields can still produce the same opening. [Prototype 1](proto/techniques.mjs) had mixed results; more parameters alone did not improve every theme.

## 2. Erode first; snap with protected contours and channels

**Source idea.** Gaea exposes hydraulic erosion and adjustable terrace spacing. World Machine exposes hardness, wear, flow and deposition masks, plus strata. These controls separate geological structure from surface detail. [Gaea erosion](https://docs.gaea.app/reference/nodes/simulate/erosion), [terraces](https://docs.gaea.app/reference/nodes/surface/terraces), [World Machine erosion](https://help.world-machine.com/topic/device-erosion/), [strata](https://help.world-machine.com/topic/device-strata/).

**What and why.** Erosion works in continuous heights. Quantization comes later. Broad valleys and coherent contours survive losing vertical precision; sub-voxel scratches do not. Uneven bench spacing and locally broken edges avoid a uniform layer-cake look.

**DGM fit.** Keep M9's floating-point incision. Use broad hardness fields to retain cliffs beside softer gullies. Before snapping, identify river corridors, spill sills and useful shelves. Give them protected masks. Apply small, spatially smooth contour offsets elsewhere. Merge tiny level islands without deleting protected channels. At high Verticality, use a real 22-level quantizer, not an expansion of already-rounded 16-level terrain.

**Cost.** Erosion O(I N log N) with I priority-flood passes; cleanup O(N) per pass. Retained masks cost O(N). Avoid expensive physical sediment simulation initially. Gaea also cautions that parallel erosion can lose determinism.

**Experiment result.** Our replacement quantizer plus channel repair eliminated uphill candidate edges but lost falls and rejected 19/36 high-cap cases. Preserve M9's existing quantizer and hydrology while investigating protected masks; do not adopt this replacement wholesale. [Evidence](REPORT.md).

## 3. Select starts by guarantees and opportunity vectors

**Source idea.** Factorio reserves starting opportunities: its 0.17 terrain generator supplies starting land and water. Civilization IV's map-script author documents guaranteed nearby strategic resources and roughly equivalent player regions. [Factorio FFF 282](https://www.factorio.com/blog/post/fff-282), [Sirian's map-script guide](https://civfanatics.com/civ4/map-scripts-guide/).

**What and why.** Guarantee essentials first, then vary the opportunities. A resource-rich start behind a cliff is not equivalent to an accessible one. Fairness concerns what players can do, not equal tile counts.

**DGM fit.** Search settled terrain for valid starts. Keep D85's settings: at Normal, a same-level walk of at most 20 tiles to clean pumpable water, 40 living trees and 30 living bushes within 20 tiles' walk. Check the 3×3 footprint, five free layers and entrance separately. Rank eligible candidates by different preferences: lake edge, lower valley, confluence, sheltered shelf. Re-plan resources locally before rerolling the genome; bound terrain repairs and never create a dam ridge.

For **future multiplayer**, select all starts jointly. Compare clean-water access, drought storage work, reachable fertile land, log yield, expansion routes and threat exposure. Minimize the worst player's shortfall, then bound disparities on each axis. Do not compensate missing water with extra scrap. Terrain can remain asymmetric. Civilization's Mirror/Hub scripts are useful contrasts, but their fixed geometry conflicts with DGM's principle.

**Cost.** Cached walk regions O(N); C candidate evaluations up to O(CN). Pair selection is O(C²); larger groups need a bounded search. Repeated water simulations dominate. Multiplayer is a proposal: the current native export still expects exactly one StartingLocation.

## 4. Carve density, then prove support

**Source idea.** Minecraft combines density fields and cave carvers; its developer tools inspect those layers separately. Terraria's Underground/Cavern distinction suggests controlling void character by depth. These games do not supply Timberborn's support guarantee. [Mojang developer Q&A](https://www.minecraft.net/en-us/article/caves---cliffs-update--part-ii-dev-q-a), [Terraria layer documentation](https://terraria.wiki.gg/wiki/Terraria_Layers).

**What and why.** A heightfield has one surface per column. A 3D solid/air field can leave a roof, cut an arch through a ridge or connect two mouths. A connected tunnel skeleton gives more reliable passages than thresholding noise alone.

**DGM fit.** Extrude the snapped field into 23 voxel layers; keep layer 22 empty. Propose narrow tunnels along rock faces and wider chambers only under thick terrain. Use separate depth masks for shallow passages and deeper chambers, not Terraria-sized stacked worlds. Perturb the void boundaries coherently. Protect starts, water infrastructure, foundations and reserved routes.

After carving, validate support from z=0: upward movement through solid voxels resets support distance; each sideways face-connected step costs one; stop after three. Iterate after repairs. A three-tile cantilever can survive; an arbitrarily wide flat roof cannot. An arch can instead have thicker rising shoulders. Check air connectivity and clearance separately. [Exact DGM rule](../../FORMAT.md), [support evidence](../notes/blocks_and_placement.md).

**Cost.** O(23N) for density and support passes, plus repair retries. Prefer rejecting a bad carve over adding conspicuous pillars everywhere. Roofed water needs multi-column water validation; start with dry caves. No density function bypasses the support rule.

## 5. Rare traits with measurable consequences

**Source idea.** Oxygen Not Included's Launch Upgrade added world traits and asteroid variation to change early and midgame strategy. No Man's Sky's Worlds update shows how unusual terrain can create memorable places. RimWorld's design frames procedural variation around stories. [Klei developer log](https://forums.kleientertainment.com/forums/topic/108000-launch-upgrade-now-open-for-testing-346893/), [Hello Games](https://www.nomanssky.com/worlds-part-I-update/), [Tynan Sylvester's talk](https://www.gdcvault.com/play/1024232/-RimWorld).

**What and why.** One rare, legible exception is easier to remember than everywhere being unusual. Its name promises a decision the player can discover.

**DGM fit.** These are original proposals, not imported trait definitions:

| Trait | Process change | Player consequence |
|---|---|---|
| Hanging Orchard | Weight a spring-fed mesa and a sheltered shelf | Fertile high ground; climb before expansion |
| Stone Lace | Increase dry tunnel proposals in one rocky district | Alternate routes through supported arches |
| Staircase Country | Preserve several natural shelves along a catchment | Several storage and power elevations |
| Borrowed River | Prefer a clean branch threatened by another catchment | A diversion decision after a safe opening |

Sample zero or one trait initially; propose 15% total occurrence at Variety 70. This is our starting hypothesis, not an ONI rate. Give traits prerequisites, exclusions and an edit budget. Name them only after the promised feature survives validation. Every trait must work across several themes and must leave the rest of the genome free.

**Cost.** Sampling is cheap; conditional generation and extra validation are not. Measure accepted occurrence as well as requested occurrence, or rejection will quietly erase rare traits.

## 6. Connect useful shelves, preserve dramatic cliffs

**Source idea.** Dwarf Fortress's developer discusses trading sheer elevation transitions for more frequent changes between levels. Valheim couples a procedural world to differentiated biomes; borrow the pacing lesson of distinct destinations. Neither establishes a DGM route algorithm. [Bay 12 development log](https://bay12games.com/dwarves/dev_2008.html), [Iron Gate FAQ](https://www.valheimgame.com/faq/).

**What and why.** Dramatic relief and useful routes are separate controls. Flattening the whole map to make it walkable removes its character.

**DGM fit.** Find flat shelves after snapping. Build a graph of same-level ground and legal Slope transitions. Link the start to essential resources first; then expose two useful outward choices where the land permits. Route switchbacks along contours, with level landing tiles between climbs and enough air clearance. Protect steep cliffs outside these corridors. Upper ruins can deliberately require later stairs. A one-level difference alone is never walkable in Timberborn.

**Cost.** Connected regions O(N); weighted path search O(N log N) per selected link. Clearance checks become O(23N) in caves. Limit cuts per corridor and reject routes that would spoil a landmark or block water. High Verticality should spend its extra levels on height contrast while retaining broad working shelves.

## 7. Keep catchments, spill levels and source budgets

**Source idea.** Dwarf Fortress couples erosion and river elevations. Priority-Flood establishes drainage over depressions; Procedural Riverscapes derives river form from slope, drainage area and stream power. [Bay 12](https://www.bay12games.com/dwarves/dev_2007.html), [Barnes et al.](https://arxiv.org/abs/1511.04463), [Peytavie et al.](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Peytavie-Computer_Graphics_Forum-2019-Procedural_Riverscapes.pdf).

**What and why.** Catchments explain why streams join. Spill sills explain lake levels. Bed drops explain falls. Rivers drawn independently of these structures tend to run uphill or ignore nearby low ground.

**DGM fit.** Retain M9's drainage tree, accumulation, hollow spill levels and lake budgets through snapping. Use four-neighbour routes for actual water; diagonal geomorphic routes need raster connections. Retain some fed hollows as lakes; breach only selected outlets within a cut budget. Width should respond to explicit source flow, not rainfall accumulation alone: Timberborn receives water from entities. Detect waterfalls where an active channel drops, then validate header pools, plunge pools and downstream capacity with the canonical settle. No raised banks or manufactured dam walls.

**Cost.** Priority-Flood O(N log N), accumulation O(N), water settle substantially more. A drainage tree cannot branch into a delta by itself: add and validate distributaries explicitly. A non-rising bed is not proof of running water, safe lakes or drought survival.

## 8. Measure the space of possible openings

**Source idea.** PCG research uses expressive-range analysis to expose missing regions of an output space. Metric choice matters. Minecraft's developers used multinoise, density and carver overlays to diagnose generation. [Expressive-range research](https://arxiv.org/abs/2304.02366), [Mojang's tools](https://www.minecraft.net/en-us/article/caves---cliffs-update--part-ii-dev-q-a).

**What and why.** A hundred unique images can conceal one repeated strategy. Measure water access, storage work and expansion, not just seed hashes.

**DGM fit.** Keep M9's M1–M8 tests. Add paired ablations of each field and trait. Compare opening distributions before and after start repairs. Use the cycles and verified mechanics investigations for drought, badtide and strategy measures. Pick among valid candidates to cover underrepresented openings, without reading another map as a template.

**Cost.** Candidate generation multiplies cost by K; pairwise comparisons can be O(B²) for batch size B. Use cheap diagnostics before expensive simulation. Our 72-case terrain experiment is an early filter, not evidence that M9's play-variety gate passes.

Source scope and access limits are in [SOURCES.md](SOURCES.md). Concrete next steps are proposals in [INTEGRATION.md](INTEGRATION.md).
