# Proposals only

No production code, schema or milestone is changed here. The [playbook](PLAYBOOK.md) ranks the ideas. The [report](REPORT.md) distinguishes working checks from unproven gameplay claims.

## Proposed order

1. Add diagnostic masks and paired measurements to the M9 investigation.
2. Trial independent controls, one at a time, against the same genomes.
3. Protect drainage and route-critical contours within the existing quantizer.
4. Improve start selection using settled opportunities and bounded repairs.
5. Add dry voxel passages, then rare traits that can use them.
6. Investigate multiple fair starts separately from native export.

The proposal targets the M9 design at `a5f189d3e96affec533415090bdb8f09d606c8fd`. Its prototype is on `investigation/generative`, not this checkout's `dev`. Paths below identify possible future edit sites, not changes included here.

## Genome and process boundaries

| Future site | Proposed change | Output and invariant |
|---|---|---|
| `proto/genome.ts` | Add optional control amplitudes, wavelengths and named random streams | Theme remains a distribution; no fixed layout selector |
| `proto/field.ts` | Use broad elevation/relief/ridge-bias fields to modulate uplift and part probabilities | Original parts stay independently positioned; no input map |
| `proto/erode.ts` | Trial spatial hardness and retain drainage diagnostics | Continuous heights plus receiver, accumulation and spill arrays |
| `proto/levels.ts` | Accept cap and protected masks; trial selective cleanup | Integer heights 0–16, or 0–22 for high Verticality; no voxel at z=22 |
| `proto/hydro.ts` | Reconcile selected channels, basin sills and quantized levels | Explicit active sources, connected channels, lake outlets and falls |
| `proto/start.ts` | Evaluate diverse valid sites using settled water and actual walks | D85 essentials always pass; preference cannot buy off a failure |
| Future 3D terrain stage | Carve, validate support, then derive accessible surfaces | Valid voxels before objects and water-column state |
| Derived feature/name stage | Detect trait outcomes and name only realized ones | Names describe the generated map |

M9 v1's `MAX_LEVEL` is fixed at 16. The requested 22-level high-Verticality behavior is an extension here. Retain editor-safe 16 as the normal cap; communicate the editor limit if a future product offers 22. Do not stretch an already quantized map in production: that creates artificial missing levels. Our stretched comparator merely exposes that risk.

## Independent controls: a narrow trial

Use three separate streams: `terrain/regional`, `terrain/relief`, `terrain/ridge-bias`. The prototype uses an original simple blend, not Minecraft's curves. Keep the control called “erosion proxy” distinct from physical incision strength.

Try each field alone, then combinations. Compare with M9 on identical theme, seed, size, Variety, cap and attempt. Preserve the original field when amplitudes are zero. Keep wavelengths in tiles, and vary part density independently of map area. Clamp local relief before it consumes all available height; do not normalize every seed into an identical height histogram.

Advance only if M9's opening and structure measures improve without reducing first-attempt playability or exceeding generation budgets. The experiment's River Valley proxy spread got worse; the current blend is not a default candidate. Terrain-only proxies cannot choose the winning coefficients.

## Contours and water: preserve decisions before detail

Propose this sequence:

```text
continuous uplift → incision/diffusion → candidate drainage and basin records
→ choose active sources/catchments → protect channels, sills and useful shelves
→ quantize nonprotected terrain → bounded contour cleanup
→ M9 channel/lake reconciliation → derive slopes → objects/resources
→ canonical settle → validate start, water, support and opening
```

Protected masks should encode reasons, not just booleans: `channel`, `lake-sill`, `route-landing`, `locked-edit`. A river can cut its own mask; cleanup cannot. Locked edits win. When masks conflict, reject or re-plan the local feature and record the reason.

Our experiment tried non-rising channel repair on a four-neighbour receiver tree. It is insufficient for natural lakes: breaching every hollow can erase both storage and falls. Preserve retained lake sills and water surfaces instead of forcing every lake-bed cell downhill. Use M9's existing `planHydro` as the next host, rather than replacing it with the diagnostic tree.

For a cut, record maximum depth, volume, changed area and changed spill levels. The experiment's limits were depth ≤3 and volume ≤8% of tile count in voxel units. They are experimental rejection limits, not calibrated product settings. Rejected proposals must not become exported maps. Also check natural dam opportunities and waterfall retention; zero uphill edges alone is too weak.

Keep actual flow separate from drainage area. M9 should assign source entities to plausible edge inflows and springs, then size channels for that flow. Validate lakes at their outlet sill and retain multiple water slots for any later roofed channel. Run drought and badtide scenarios after steady-state checks. Do not infer stored water from a blue render overlay.

## 3D terrain contract

After surface hydrology, initially allow **dry** caves only. Reject a void intersecting active water, a spring/source's claimed column, an aquifer, geothermal field, UndergroundRuins, start clearance, a protected route or an editor lock. Source and ruin objects with `OccupyAllBelow` need their whole lower column reserved, not only their base footprint.

Represent proposed voids with a sparse skeleton of connected passage segments plus wider chambers. Carve irregular boundaries around it. A depth mask controls location and size; it is an artistic control, not a copy of Terraria layers. Generate arch openings by letting a short tunnel meet two cliff faces. Generate shallow overhangs by recessing a lower cliff band. Inspect supported surfaces above and below each carve.

Implement the support predicate directly from FORMAT and the repository's placement notes:

```text
supported = solid cells at z=0, plus separately validated stackable-object support
for z from 0 through 21:
    seeds at this layer = already supported roots or solid cells above supported solids
    breadth-first search sideways through solid face-neighbours, distance at most 3
    only these reached solids may seed the next layer, where distance resets to 0
reject unsupported solids, or undo/shrink this carve and recompute
```

For the first implementation, use terrain support only; do not depend on placing natural bridge objects to rescue a carve. If later allowed, validate object support without circular dependencies. Support cannot travel down from a floating roof. Voxel support does not prove a tunnel is passable: separately find floor/air surfaces, check character and building clearances, and connect mouths through walkable surfaces.

Required adversarial cases for that future work: a 3-tile cantilever passes and 4-tile cantilever fails; a floating slab fails; a roof supported from both banks passes only where each cell is reachable; a rising shoulder resets distance each layer; a diagonal-only contact fails; removing a pier invalidates dependent roof cells; a voxel at z=22 fails the export contract. These checks are proposed, not executed by this branch.

## Traversable height

Build a graph over walkable surfaces, not height differences. Each node includes `(x,y,floorZ)` so caves do not collapse into their roofs. Equal-height face neighbours can connect when free; a one-level transition requires a placed, correctly oriented Slope with clearance. Check slope footprints and adjoining landings using FORMAT's orientation rules.

First connect the start to its essential resources. For expansion, prefer two distinct destinations with different costs or rewards. Path search should price terrain cuts, slope count, detour and feature damage. A corridor may zigzag across shelves while leaving adjacent cliffs untouched. Bound its repairs and recompute water after any cut. Keep the water-without-stairs walk strictly same-level even when slopes connect other resources.

At 22 levels, increase relief only where enough shelf area remains. Validate reachable land, route bottlenecks and future construction space. “All terrain is reachable” is neither necessary nor desirable: an upper ruin can be a later objective. “All necessities are reachable now” is required.

## Reliable starts and future fair groups

Use two passes. First, reject invalid geometry and missing essentials. Second, rank the survivors by genome preferences and opportunity vectors. Recount living Pine/Birch/Oak and BlueberryBush after the canonical settle: dead or flooded resources cannot satisfy a count. Pumpable clean water must meet the actual configured D85 threshold, not the prototype's geometry-only pad count.

Cache walk regions and water-body analysis. Retain several spatially distinct candidate starts. Apply bounded resource redistribution or a small local leveling repair only when necessary; log its area and effect on opening signatures. Never build a storage ridge. If valid starts disappear, return a deterministic failed candidate and retry. Do not export a “best available” invalid start. A bounded retry budget can guarantee validity of outputs, not guarantee every arbitrary setting returns a map.

For P players and C candidates, compute a vector per site:

```text
same-level clean-water walk; drought water retained; feasible storage work;
reachable fertile/buildable area; accessible log yield and berries;
threat arrival/exposure; number/cost of expansion routes; distance to shared rewards
```

Hard-filter every player's essentials before searching combinations. Enforce non-overlapping opening resource claims and useful path separation, not Euclidean distance alone. Minimize the maximum normalized deficit, then per-axis spread. Proposed first experiment: no more than 20% spread in fertile area and accessible log yield, and no more than 5 tiles' water-walk difference; keep drought survival and contamination as absolute constraints. These numbers need multiplayer play tests, not silent promotion to product rules.

Also simulate upstream/downstream externalities: one player's dam or diversion can deprive another. Shared catchments may need independent initial water access or explicit cooperative-mode rules. Symmetric resources do not make shared water fair. Native single-player `.timber` export retains one start until a multiplayer format/mod contract exists.

## Traits and acceptance

Store a trait's identity, parameter draws and version in the resolved generation record. Start with zero or one trait and fixed named streams, so retries of a cave do not reroll the whole map. Record requested, realized and rejected trait frequencies by theme and size. Incompatible traits are excluded before sampling; failed realization leaves a recorded failure, not a misleading name.

Keep M9's existing gate: 200 seeds per theme at 128² for variety measures; size/difficulty batches, both validators, deterministic reproduction, ≥98% final pass rate and budgets. Add paired field ablations, trait-conditioned openings and before/after repair distributions. Use rotations/reflections when judging geometry. Run weather-cycle and verified mechanics measures before claiming different play. This study neither passes that gate nor substitutes for Kyler's in-game tests.
