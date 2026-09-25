# M9 design, version 1: a generator that invents

**Status: design version 1, for review.** Kyler approves version 2, not this one (§17). This
version is the M9 design step of ROADMAP M9 (PLAN §20, D108, D109) with Kyler's later additions:
the no-dam-ridge decision (2026-09-25), the staged build, the document model, budgets, pass rates,
playable maps, and the new approval gate. The prototype is in
[investigation/generative/](../investigation/generative/); every number is in its
[REPORT.md](../investigation/generative/REPORT.md).

## Contents

1. [The design in five lines](#1-the-design-in-five-lines)
2. [The principle and what it rules out](#2-the-principle-and-what-it-rules-out)
3. [Composition: the parts](#3-composition-the-parts)
4. [Emergence: the processes](#4-emergence-the-processes)
5. [Inspiration beyond maps](#5-inspiration-beyond-maps)
6. [Hazards and landmarks](#6-hazards-and-landmarks)
7. [The start and the guards](#7-the-start-and-the-guards)
8. [No dam ridge](#8-no-dam-ridge)
9. [What M9 keeps: directions, Variety, no clones, the score, names](#9-what-m9-keeps)
10. [Measures](#10-measures)
11. [Large maps (#21)](#11-large-maps-21)
12. [The document model and the editor](#12-the-document-model-and-the-editor)
13. [Budgets](#13-budgets)
14. [Batch pass rates](#14-batch-pass-rates)
15. [Cost: planners, version, risks](#15-cost-planners-version-risks)
16. [Staging](#16-staging)
17. [The approval gate and version 2](#17-the-approval-gate-and-version-2)

---

## 1. The design in five lines

1. A map is drawn from a **genome**: continuous parameters for landform parts, processes, water,
   hazards and resources, sampled from a theme's prior. A theme weights the parts; it is not a layout.
2. **Processes** turn the genome into land: an uplift field of parts over warped noise, stream-power
   erosion, and snapping to the game's 16 levels.
3. **Water finds its own way.** Rivers follow the land's drainage from edge inflows and springs.
   Lakes, falls, pools, confluences, splits and deltas appear where the land makes them.
4. **Everything else is found, not built.** The start, dam sites, badwater hollows, ruins,
   relics and the frontier are read from that land by the rules a player would use. No dam ridge,
   no stamped layout.
5. **The product's own pipeline** builds, validates and scores every map. The guards don't change:
   D85's start requirements, both validators, determinism, the budgets and batches ≥ 98%.

## 2. The principle and what it rules out

PLAN, Product principles (D108): maps are created, not copied. Two maps must play differently: a
different place to settle, a different first dam, a different way through the first drought,
different threats, different paths outward, and something to discover.

What the current generator does that the principle rules out, and what replaces it:

| Today (m8-done) | Why it fails the principle | This design |
|---|---|---|
| One planner layout per theme: a valley along an axis with terrace bands, a dam-site ridge, falls on bed steps (D19, D25, D59, D63, D64, D70, D73, D74) | Every River Valley map is the same valley with noise: 30 seeds reach 15–36% of the workshop's variety; nearest seeds 0.06–0.26 apart | Parts and processes; the layout emerges (§3, §4) |
| A dam-site ridge on every map (D25) | A stamped, spoon-fed dam (Kyler's no-dam-ridge decision) | Dam sites are found where valleys narrow (§8) |
| Premises as planner variants with a stamped landmark (ROADMAP M9) | Landmarks on the same base add at most 0.02 to a theme's variety | At most a few recipes: a forced part inside the same system (§3) |
| Rivers drawn as polylines, then terrain built round them | The river decides the land | The land decides the river (§4) |
| Badwater in a 7×7 box with a straight ditch (D51, D57) | Engineered | A hollow found on high ground, draining by its own winding ditch (§6) |

## 3. Composition: the parts

A genome (`proto/genome.ts`) holds every number one map is made from:

| Group | Parameters (all continuous unless noted) |
|---|---|
| Frame | base level, relief (levels), regional slope: strength and one of the 8 flow directions (linear), or a slope toward a basin whose outlet leaves toward the flow direction (radial) |
| Noise | amplitude, cell size, octaves, domain warp (amplitude, cell), ridged share |
| Parts | a list of landform parts, each with an anchor, size, height, turn, a second size and an edge softness |
| Processes | erosion iterations, incision strength, diffusion; terrace bench height (1–3 levels), terraced share, contour waviness |
| Water | edge inflows, springs, total flow (× the size-aware official median), the largest lake share, chances to split round an island and to fan into a delta, extra incision (canyons) and cleared floor width |
| Hazards | badwater (none, a hollow on high ground, a poisoned stream), its strength, thorn belts |
| Resources | forest density, berry bushes, ruins (within the settings' ranges), grove size |
| Settler | weights for what kind of place the start looks for first |

**The parts** (`proto/field.ts`) each add to an uplift field in levels, and combine by summing
(parts that lift a table to a level combine by maximum). Their parameters are continuous, their
outlines are pushed around by noise, and any part can land anywhere, so combinations nobody
authored appear: a caldera on an escarpment, a mesa field crossed by a canyon river, a lake chain
in a trough between two ridges.

| Part | What it makes |
|---|---|
| ridge, trough | a bent band up or down: ranges, parallel ridges, valleys that capture rivers |
| basin | a lobed hollow (and a rim): lakes, seas, dry bowls |
| caldera | a ring rim, a sunken floor, sometimes an island cone: crater lakes |
| mesa, plateau | a flat-topped table with steep, noise-lobed sides: benches, sky islands, hanging lakes |
| mesa field | 2–15 small tables of different heights: pillars, ruins on tops |
| escarpment | a long wobbling cliff line: an upper and a lower world, falls where rivers cross it |
| cone | a peak with an optional crater: volcanoes |
| knolls | hills and knolls everywhere, as many per tile on every map size (#21) |
| spiral | a ramp winding up a peak (whimsical, rare) |

**Themes are priors.** Each of the six themes weights the parts and sets the ranges (River Valley:
ridges, plateaus and knolls, moderate erosion; Canyon: mesas, escarpments, deep incision and
benches of 2–3 levels; Highlands: plateaus, cones, springs; Lake Basin: basins and calderas under a
radial slope; Delta: low relief, strong flow, splits and deltas; Islands: a sea gathered by a
radial slope, with hills and cones standing in it). None of them fixes a layout.

**Variety** (`vy`, 0–100, default 70) widens every range: at 0 each draw stays in the middle third
of the theme's range, at 70 it spans the range, at 100 half as wide again on each side; from 60
the part weights flatten toward uniform, and from 85 every part and recipe is open to every theme.
**Surprise me** draws a theme and sets Variety to 100.

**Recipes** (the named premises) become at most a few forced parts inside this system, drawn
sometimes (8–12% of a theme's maps at Variety 70): *island in a river* (the split), *great scarp*
(a strong escarpment), *mesa field*, *badwater volcano* (a cone with badwater in a hollow),
*hanging lake* (a tall mesa and a spring), *caldera*, *chain of lakes* (three basins), *volcano
island*. A recipe never fixes the rest of the map, and the measures do not count it (§10).

## 4. Emergence: the processes

1. **Uplift** (`proto/field.ts`). The regional slope, domain-warped fractal value noise (the
   product's integer-hash noise, exact arithmetic) and the parts.
2. **Erosion** (`proto/erode.ts`). A priority flood from the map edge gives every tile a receiver
   and a spill level; drainage area accumulates down the receivers; implicit stream-power incision
   (Braun and Willett 2013, m = 0.5, n = 1: only + − × ÷ and a square root) cuts valleys where
   much water gathers, and a little diffusion softens slopes. 4–30 iterations, by the genome.
3. **Levels** (`proto/levels.ts`). The field's p2–p98 spread is stretched over the genome's relief
   above its base and snapped to whole levels, with slightly wavy contour edges, benches of 2–3
   levels in the terraced share, tiny regions merged and single-tile pits and spikes removed (the
   build's own integrity rule).
4. **Rivers from the drainage** (`proto/hydro.ts`). Edge inflows start at low points of the
   upstream edges, springs on high ground with a long way down; each follows the eroded field's
   receivers (a little routing noise lets it wander where the land is flat) until a map edge or a
   river already traced (a confluence). Its channel is cut below the lowest ground round it, the
   bed never rising downstream; canyon rivers cut deeper and clear a floor. Where the bed drops two
   levels or more, the water falls; below a drop it scours a pool a level deeper (standing water
   deep enough to pump). A river may split round an island or fan into more mouths near its outlet.
5. **Lakes where the land holds water.** Where a river's path crosses a closed hollow of the
   levels, the hollow is a lake at the level of the rim where the water leaves. A lake bigger than
   the genome's water budget has its outlet cut down until it fits; the cut is a gorge. Every other
   closed hollow is filled to its rim, because a dry hollow below a source would be pre-filled by the
   canonical settle and then only evaporate (the water would never settle).
6. **Dam sites, falls and lakes are found, never stamped.** A dam site is wherever a straight dam
   across a channel would hold water: a valley narrowing between spurs, a gorge a river cut
   through a rim, a basin's outlet. The validators' own dam sampling finds them (§8).

**How this meets the refinement note "containment should look natural"** (ROADMAP, Refinement
phase; decisions-pending #29, #40). Nothing is stamped, so none of its targets needs a special
shape: there is no straight dam ridge (the dam-wall check finds none, §10), no square badwater box
and no straight ditch (the hollow is a lobed pit and the ditch winds by noise), no bullseye lake
(basins are lobed by noise and eroded), no squared narrows (narrows are where valleys pinch), and
no raised banks (channels are cut down, never walled up). The whole-map naturalness numbers
(straight step runs, the longest run, ridge variation) are measured on every batch map and
reported in REPORT.md beside the official and workshop medians.

## 5. Inspiration beyond maps

**Real landforms, and the process or part that makes each:**

| Landform | How the prototype makes it |
|---|---|
| Canyon, gorge | incision of 2–5 extra levels with a cleared floor; a lake's outlet cut down through its rim |
| Mesa, butte, pillars | mesa and mesa-field parts: tables with steep, lobed sides |
| Escarpment, great scarp | the escarpment part; rivers crossing it fall |
| Caldera, crater lake | the caldera part (ring rim, sunken floor, island cone) filled by the rivers it catches |
| Volcano | the cone part with a crater (the badwater volcano recipe puts badwater in it) |
| Lake chain | basins along a river's path, each at its own outlet level |
| Braided river, river island | the split (a second arm round an island) |
| Delta, alluvial fan | a river fanning into 2–3 mouths near its outlet across low ground |
| Plunge pools, pools and riffles | a pool scoured below each drop |
| Badlands | strong incision with little diffusion over ridged noise |
| Terraces | benches of 2–3 levels in the terraced share; 1-level contours elsewhere |
| Fjord, sea | a radial slope into a basin under the water budget (Islands) |

Not yet made, and how the system would: oxbows and big meanders (a meander process that lets a
channel cut its own bends over flat land, then a cut-off leaving a lake), karst (sinks that swallow
a stream and springs that return it, which needs roofed water, so later), hairpin canyons (the M11
switchback builder's rule inside the drainage), a hub of channels (a basin with several outlets,
M11's lake outlets).

**Timberborn's mechanics as sources of decisions.** The map is read the way a player reads it, and
the measures ask what each map asks of the player:
- *Droughts*: whether the start's water keeps flowing (a river fed by an inflow), shrinks to pools,
  or dries; where a dam or levees would store the need (M3, M7).
- *Badtides*: badwater hollows drain into rivers below the start's water, so a badtide turns part of
  the river; a poisoned stream from an edge makes a whole branch unusable.
- *Water physics*: sealed mouths, lakes at their outlet sill, falls where beds drop, pools that keep
  standing water, thin sheets avoided (every river is cut below its banks).
- *Dams and floodgates*: natural narrows, gorges and basin outlets are the dam sites (§8).
- *Vertical building*: benches, mesas and escarpments give flat land at many levels; falls give
  power spots.
- *Contamination*: badwater's soil contamination keeps plants off its banks; the settler keeps the
  start's water clean.

**Play design.** Trade-offs (the best land is not also the easiest to water: the score's trade-off
component), risk and reward (relics and ruins beyond thorns or on tables that need stairs; a
richer valley below the badwater), pacing (resources by distance from the start, the score's
pacing component), frontiers (what lies beyond 40 tiles: M3's last group), surprise (the score's
novelty component, and the parts nobody combined before).

**Playful forms that still read as landscapes**: the spiral ramp, sky islands (tall mesas with a
spring on top: a hanging lake whose water falls off the edge), crater islands, pillars. They are
rare parts, weighted up by Variety.

## 6. Hazards and landmarks

- **Badwater in a hollow** (`proto/hazards.ts`): a pit dug two levels into high ground, its outline
  lobed by noise round the 3×3 source, draining by its own ditch that winds down the slope to a
  river below the start's water (or to a map edge). The ditch is never routed within the badwater
  distance of the start, and its water must never pass the start's water on its way out (checked on
  the drainage, then proved by the settle). The containment rule is the product's
  `water.badwater_contained`: with the ditch blocked, the water rising in the pit cannot leave its
  rim. The prototype expresses the pit through the badwater-basin set piece's plan (source, floor,
  outlet), so both validators prove it; M9 gives the plan the pit's own outline.
- **A poisoned stream from an edge** (a badwater river's sealed mouth) is in the genome but not yet
  built by the prototype; its maps fall back to a hollow.
- **Thorn belts, relics, geothermal fields, mine sites** come from the product's own planner
  (`gen/extras.ts`) on the built ground, in their distance bands.
- **Ruins** from the product's resource planner (`gen/resources.ts`): on dry flat ground away from the
  start, often on tables the derived slopes do not reach, so they need stairs: an obstacle with a
  payoff that the land made.
- **Landmarks** are parts (calderas, cones, mesas, scarps) and what water does with them (falls
  off a scarp, a lake in a crater, a river round an island).

## 7. The start and the guards

**The settler** (`proto/start.ts`) reads the land with water, as a player would:
- hard limits, never traded (D85): a shore of clean pumpable water on the start's own level within
  the water rule's walk (checked with 5 tiles to spare), the 3×3 and its ring dry, the door onto
  level ground facing the water, moist land for 40 trees and 30 bushes within reach;
- among the places that qualify, the genome's preferences (a lake shore, a river bank, a
  confluence, below a fall, a high bench, a spring's stream) and the seed choose among the best
  few, kept 20 tiles apart, so starts differ as much as the land does;
- if no place qualifies as the land stands, a 5×5 within a level is levelled (as a player levels a
  spot); as a last resort a pad and a 3-wide path are levelled to the nearest deep water, as
  today's bench runs to the bank (D97).

**Every guard stays**, and the prototype proves each on every batch map:
- both validators in the `generate` profile, unchanged (parity on a sample, §14);
- D85's three start requirements, which reject a map;
- `water.storage_possible` (below) in place of `water.reservoir`;
- determinism: exact arithmetic (D15: + − × ÷, square root, floor, round, abs, min, max; the
  deterministic sine for oriented parts; integer-hash noise), iteration in index order, heaps that
  break ties by index; the same seed gives the same bytes in one process and in a fresh one;
- batches ≥ 98% per theme and size (§14), and the budgets (§13).

**`water.storage_possible`** (`proto/storage.ts`, the workshop study's W1 rule): (1) the start's
water is running, fed by clean sources of at least need ÷ (2 × 460) blocks per second; (2) storage
is possible within 40 tiles: a straight dam holds need × reserve, or natural pools keep it through
the drought, or a dam and levees can (water raised by 1–3 levels, never above the start's level,
floods ground within 60 tiles and off the edge that holds it, with a levee line at most a quarter
of that ground's perimeter). The study's per-help clauses (at None, no short dam may exist) are not
applied: under Kyler's decision a natural narrows is an opportunity the land offers, not a gift to
remove (§8).

## 8. No dam ridge

**Kyler's no-dam-ridge decision (2026-09-25)**, verbatim: "The dam-site ridge goes away completely.
No official map has a wall built across a valley. It's a stamped, spoon-fed dam, and it's awful."
It supersedes D25, D30 and D58 and everything built on the ridge, and settles pending #31 (W1).

**In this design:**
- **The generator never builds a dam-site ridge**, in any theme, at any difficulty or setting, and
  never adds terrain to make a dam site. The prototype has no `damSite` feature at all.
- **Dam opportunities exist only where the land makes them**: a valley narrowing between hillside
  spurs, a gorge a river cut through a rim, a lake's outlet, a canyon's pinch. The validators'
  dam sampling finds them; the opening description names the nearest good one.
- **`water.storage_possible` replaces `water.reservoir`** (§7). Accessible clean water stays a hard
  start requirement (D85's water without stairs).
- **Measured** (M5): how often a good natural dam site (a dam of 5 tiles or fewer that holds a
  Normal drought's need) lies within 40 tiles of the start, beside the workshop's 46% and the
  official maps' 36%.
- **Checked** (M6): the dam-wall check fails on a straight wall across a valley with a gap for the
  river. It flags the current generator's River Valley, Canyon, Highlands and Delta ridges, none of
  the 19 official maps, and none of the prototype's maps (REPORT.md). It misses the current Lake
  Basin and Islands ridges, which are 2–4-tile stubs beside a wide outlet; M9 closes that gap with
  a contract test on every planned feature list (no `damSite` ridge plan, and no set piece that
  raises ground across a channel), beside the terrain check that catches a wall made any other way.

**Reservoir help: worth keeping only as steering, and not in M9.** With no ridge, "Ready" is gone,
and "None" as the study defined it (no short natural dam allowed) would reject exactly the
narrows the land offers. What remains useful is steering on Easy: among the K candidates, prefer
one whose land offers a natural narrows within 40 tiles of the start. That is one line in the
candidate ranking (§9), not a setting. Recommendation: no Reservoir help setting; Easy prefers a
natural narrows near the start among its candidates; Normal and Hard don't steer. If Kyler wants a
control later, it is a three-way preference (none, prefer, strongly prefer) that only reorders
candidates, and never builds or removes terrain.

**The editor's Dam site tool.** Proposal: keep the tool, rebuilt as a natural narrows: two
hillside spurs of uneven thickness and height closing in on the river, each falling 1–3 levels
from root to tip in gentle or terraced steps, the two different (the refinement phase's spurs mode,
now the only mode). It stays a player's edit: the generator never calls it. The alternative,
removing the tool, loses a common request ("give me a place to dam here"); the spurs keep the
request honest because they look like land, and the wall check guards them (a spur pair must not
read as a wall).

**What replaces the ridge-based rules and premises:**

| Built on the ridge | Replaced by |
|---|---|
| D25 (a straight ridge square to the valley), D49's dam site, D30 (`water.reservoir` near the start) | natural dam sites found by the dam sampling; `water.storage_possible` |
| D58 and Hard's 3-deep layout (a 4-level cascade above the basin, crest 4, the start below the gorge) | Hard's rule moves into `water.storage_possible`: on Hard the storage must hold need × reserve at a mean depth of 3 or more (dam crests 1–4, or levees raising 3–4 levels); the generator draws Hard maps from candidates whose land allows it and never builds a gorge for it |
| River Valley's Gorge-dammed basin, Canyon's Narrows, Lake Basin's Rising lake (its outlet ridge), Delta's head gorge | gone as premises; a gorge, a narrows or a lake outlet appears when the processes make one, and names and descriptions say so when it does |
| PLAN §12's dam value and the reservoir-help clause in descriptions | the 12-component score's *engineering* (full marks when storage takes real work); descriptions name the nearest natural dam site, or say "no easy dam: the river is yours to tame" |

**The refinement note's dam-site item** ("Dam sites: a narrows between hillsides, not a straight
ridge") no longer asks the generator for anything: there is no generated dam site to reshape. It
becomes: (1) the editor's Dam site tool builds spurs only; (2) the dam-wall check runs on every
batch and in CI (§16). The `damSite` spurs mode's batches (River Valley, Canyon, Highlands ≥ 98%)
become the tool's own tests.

## 9. What M9 keeps

- **8 flow directions.** Each genome draws its flow direction from the 8 (a regional slope toward
  that side, or a radial slope whose outlet leaves that way); the rivers then find their own path.
  The layout is native in every direction: nothing is planned west to east and turned.
- **Variety and Surprise me** (§3), as the M9 plan has them; the share link carries the resolved
  spec (seed, theme, Variety, settings), so a map reproduces.
- **No clones.** K candidates (seeds' candidate streams 0, 1, 2) are ranked by the score; among
  those within 5 points of the best, the one farthest from the theme's reference signatures wins
  (PLAN §7.9), unchanged. The measures (M1, M2) show the space is wide enough for this to matter.
- **The score** (`investigation/workshop/lib/score.ts`, 12 components; `score-params.json`, or
  `score-fitted.json` once Kyler's ratings exist) ranks candidates. Its *surprise* compares with the
  official maps and the current generator, and its *engineering* rewards storage that takes work.
- **Names and descriptions** come from what the map has, now read from the land: the processes
  report their landmarks (a caldera lake, a great scarp, a river island, a delta, a mesa field, a
  chain of lakes, falls), the settler reports the start's place, and the opening (M3) gives the
  "how it plays" sentences. The catalogue's plain words (PLAN §13) stay the vocabulary.
- **The place resolver and judgement words** (D84) read rivers from the actual flow already; the
  prototype's rivers are features with their paths in flow order (source first), so
  `investigation/claude/lib/flow.ts` reads them unchanged.

## 10. Measures

Written before any of them was run on the prototype, and committed with the code that computes them
(`investigation/generative/lib/`, `sidecars.ts`, `measures.ts`). Each is run on 200 seeds per theme
at 128², Normal, for the prototype and, as the baseline, for the current generator at `m8-done`
(0.6.0) with each theme's default settings. No threshold below was changed after a result was
seen; where a check needed adjusting, the adjustment and its reason are listed with it.

**Shared scales.** Every distance is measured on a scale read from the 130 workshop maps, so a
typical pair of workshop maps is 1 apart, and every cut is the workshop's own p10 nearest-peer
distance on that scale: two maps belong together only when they are closer than 90% of workshop
maps are to anything. The scales and cuts are aggregates of the workshop maps and are committed in
`investigation/generative/measures.json`; the maps and their per-map numbers stay local.

**Clustering.** Average-linkage (UPGMA) agglomerative clustering, cut at a fixed height: clusters
merge while the mean distance between their members is below the cut (`lib/cluster.ts`). It does
not chain as single linkage does, needs no cluster count, and its cut comes from the workshop.

| # | Measure | How it is computed | Target |
|---|---|---|---|
| M1 | No clones | The variety distance V (`investigation/workshop/lib/variety.ts`, scale in `variety-scale.json`: half the layout distance under the 8 rotations and mirrors, half the RMS of 14 size-free features, each divided by its workshop spread). For every map, the distance to the nearest other seed of its theme. | every map ≥ 0.25, median ≥ 0.40 |
| M2a | No archetypes: whole maps | UPGMA on V within each theme, cut at the workshop's p10 nearest-peer V (0.591, `variety.json`). | no cluster over 15% of a theme's maps |
| M2b | No archetypes: river networks | A vector of 11 numbers per map (`lib/structure.ts` `riverVector`: inflows, springs, outflows, water bodies, lakes, ponds, falls per 10k tiles as log(1 + n); the main course's sinuosity and length over the diagonal; the lake share; islands), each divided by its workshop spread (p10–p90 ÷ 2.56); distance the RMS over the median workshop pair; UPGMA cut at the workshop's p10 nearest-peer distance. Also the number of distinct coarse codes (`riverCode`: inflows, springs, outflows, lakes, falls and islands in buckets). Flow direction is left out: a network turned round is the same shape. | report the counts; no cluster over 15% |
| M2c | No archetypes: relief | The same with 9 numbers (`reliefVector`: height range, levels covering 1%, plateaus per 10k, cliff share, one-level share, flat share, basins per 10k, ridges per 10k, gorge tiles) and `reliefCode`. | report the counts; no cluster over 15% |
| M3 | Play variety: openings | An opening vector of 18 numbers per map (`lib/opening.ts`), read from the map's own file and settled water with the validators' analysis: the start's water (walk to it, the size of the body it drinks from, the clean flow feeding it, how much of that body is 1+ deep, how much of its water the Normal drought leaves), the nearest good dam site (distance and length), the nearest threat (badwater distance, whether badwater reaches the start's own water, thorns), land to expand into (walkable land within 30 tiles' walk, open directions, moist share, levels within 40), and what lies further out (share of scrap beyond 40 tiles, relics, geothermal fields and mine sites, other water bodies, falls). Scaled on the workshop and official maps whose start can be measured; distance and cut as M2b. Spread: the mean pairwise opening distance per theme, beside the workshop's. Two slots wait: the weather-cycle signature (`investigation/cycles`) and the strategy axes (`investigation/mechanics`) join the vector when their PRs land (§17). | no opening cluster over 15%; report the spread |
| M4 | No approximation | For every generated map, the V distance to its nearest workshop map. | every map at least the workshop's p10 nearest-peer V (0.591) |
| M5 | A good natural dam site near the start | The workshop study's obviousness measure: the validator's dam sampling (straight dams across clean water, crests 1–3, `analysis/damsites.ts`), and whether a dam of 5 tiles or fewer within 40 tiles of the start holds a Normal drought's need with the Normal reserve (380 blocks). Workshop maps 46%, official maps 36%. | "comparable to the official maps": between 26% and 56% (the official rate less 10 points to the workshop rate plus 10) |
| M6 | No built dam walls | The wall check (`lib/ridge.ts`, below). | zero maps flagged, every theme |
| M7 | Storage possible | `water.storage_possible` (`proto/storage.ts`): the workshop study's rule, which replaces `water.reservoir` (§8). | the prototype applies it as a guard; the baseline is measured |
| M8 | Batch pass rates | First attempt and final (12 attempts) in the real validators' `generate` profile plus M7, per theme. | final ≥ 98% per theme and size |

**The wall check** (`lib/ridge.ts`). A built dam wall is a straight band of rock across a valley,
with a gap where the river runs through it: D25's ridge. The check looks from every water tile
along 8 line orientations and flags a wall when, on both sides of the gap, 6 or more points follow
that stand 2–6 levels above the ground 4–7 tiles out on both faces, with a vertical face (a drop of
2+ levels in one step) on each side, 2–8 tiles thick, with a flat crest (its levels span at most 1),
the same floor on both faces (within 1 level), an even thickness (within 3 tiles), and dry floor
beside it on at least one face for three quarters of its points. It was written from D25's
geometry, then adjusted three times on the 19 official maps and seeds 1–12 of each baseline theme,
before it was run on any full set or on the prototype:
1. the face test also looks at the probe point itself (a line that grazed the band's edge missed
   River Valley seed 11's wall: a bug, not a threshold);
2. the floor beside the wall must be dry on at least one face (Hollows' and Pressure's hits were
   natural divides between two bodies of water, and Beaverome's a crater rim over its own lake);
3. the faces must be vertical (one step of 2+ levels) and the band at most 6 levels high (D25's
   crest stands 2–6 above the floodplain; Pressure's hit was a gentle 1-level bank).
Frozen after that: it flags seeds 1–12 of River Valley, Canyon, Highlands and Delta 12 of 12, and
none of the 19 official maps. It does not flag Lake Basin's and Islands' dam sites (0 of 12 each):
there the ridge is a stub of 2–4 tiles on each side of a wide outlet, too short to tell from
natural ground (a run of 3 caught 4 of 12 of them but also 4 official maps). §8 says how M9 closes
that gap.

**The weather-cycle slot and the strategy axes.** M3 reserves two parts of the opening vector: the
map's behaviour through the weather cycle (droughts and badtides), from the cycle simulator on
branch `investigation/cycles`, and its position on the strategy axes, from the mechanics catalogue on
branch `investigation/mechanics`. Both PRs were finished while this version was being written (PR #10
at 1a8eba2 and PR #9 at bb394cc, both open, 2026-09-25). Both are used read-only
(`investigation/generative/simplay.ts` loads their modules from a local extract; nothing of theirs is
merged or copied into this branch):
- **M3c, the cycle signature**: the cycles study's eleven values (water kept after the first Normal
  drought and a later Hard drought, clean water kept, days the start keeps pumpable water, wet tiles
  lost, fragments, new badwater exposure, new contaminated soil, trees and bushes lost, recovery
  after badtide), with its own distance (the mean absolute difference) and its own fixed group bins;
- **M3d, the strategy axes**: the mechanics study's eight axes (storage work, power location, land
  and height, fertile land, threat exposure, resource timing, expansion choice, faction opportunity)
  through its `measureOpening`, with its own fixed bins and joint signature (its AXES.md).
Each simulation takes 15–30 s a map, so both run on seeds 1–30 of each theme, the two studies' own
baseline size, not on 200; neither study's bins are tuned here. They are reported beside M3 as
supplementary evidence of play variety, not merged into its workshop-scaled distance, because no
workshop map has a cycle signature or axes to scale them on. Version 2 decides how they join the
opening vector (§17).

**Permanent checks.** §16 proposes M1–M6 as checks that run on every milestone after M9, and how
M4 runs without committing workshop maps.

## 11. Large maps (#21)

Kyler (decisions-pending #21): large maps should feel as varied as official maps, about 18 plateaus
each plus hills and knolls, not flatter as they grow. Today the generator gets flatter with size
(flat share about 0.63–0.68 at 128², 0.73–0.76 at 192²), because it spreads the same terrace
bands over more tiles.

The design keeps detail per tile, not per map: noise cells, part sizes, knolls and hollows are in
tiles, and the number of parts and knolls grows with the area (`genome.ts`: parts × √(area ÷ 128²),
knolls × area ÷ 128²). A 256² map therefore holds four times the knolls of a 128² map and about
twice the large parts, at the same local roughness. REPORT.md measures plateaus (the score's
count: level regions of max(40, area ÷ 1000)+ tiles falling away on 90% of their rim), the flat
share and the height range by size for the prototype and the baseline, beside the official
medians by size class (small 4, medium 7, large 26, max 27 plateaus).

## 12. The document model and the editor

The generator and the editor are one app (PLAN §19). Emergent terrain must keep every editor
capability working. The design: **a base terrain layer plus features read back out of it.**

**The base terrain layer (the field).** The processes (uplift, erosion, levels) produce a height
field. The document stores it, as it stores an imported map's base today: run-length levels in the
project file (about 5–15 KB gzipped at 128², 20–40 KB at 256²). Build step 1 (PLAN §19.8) starts
from the field instead of the flat fill of level 2. The field is data, not a process re-run on
every rebuild, so rebuilds stay fast and exact.

**Features read back.** Everything the player grabs today stays a feature, found in the field
instead of planned before it:
- *rivers*: the traced paths in flow order (source first), with width, the bed profile, and two new
  parameters for what the processes cut: `pools` (bed dips below drops) and `floor` (a cleared
  floor beside the channel, canyons). The river's rasterizer cuts exactly what the prototype cut;
  moving or reshaping a river re-cuts it, as today;
- *lakes*: a natural lake is a lake feature whose basin is an area of tiles (runs) instead of a
  polygon, with its outlet sill; `natural: true` means the field holds its basin, so the rasterizer
  neither digs nor rims it. The water level is still the sill (drag the sill to raise the lake);
- *badwater basins*: the set piece with the pit's own outline and its ditch;
- *the start, forests, berry patches, ruin fields, map objects*: exactly as today;
- *landmarks* (a caldera, a mesa, a scarp) are named in `derived` (PLAN §7.10) for names, labels
  and Claude's places. They are not separate features: they are part of the field. Reshaping one
  is a sculpt, a regenerate-area or, from M11, a stamp of the field region.

**Every existing capability** (EDITOR_PLAN §3–§6, progress M3–M8):

| Capability | With a field |
|---|---|
| Features and their handles | Rivers, lakes, set pieces, resources, objects and the start keep their handles and inspectors; rivers and lakes gain the new parameters above |
| Dirty-region incremental rebuilds equal full rebuilds | The field is constant input to step 1, like an import's base; the property test runs unchanged and adds generated fields |
| Orphans | Unchanged: ids are hashed from seed, kind and role (§19.4); read-back features get roles from what they are (`river/inflow/0`, `lake/natural/2`, `setpiece/badwaterBasin/0`) |
| Undo and redo | Unchanged: they run over the operation log; a regeneration or a `specPatch` stores the previous generation (field included) as its undo data |
| Autosave | Unchanged; the document grows by the field |
| Import | Unchanged: an import has a base and no field |
| Export | Unchanged: build, canonical settle, `export` profile |
| "Generate, keeping my edits" | The spec is re-resolved and the processes run again with the player's features, locks and keep-out regions as constraints (§7.0): protected tiles are walls to the drainage (rivers route round them), the settler, hollows, pits and objects keep off them; sculpt edits and entity edits replay on the new build; edits whose targets are gone are orphaned, never dropped |
| Locks and conflict rules (M11) | The processes run on the whole map, then locked tiles take the kept surface (the `LockedLayer`); the drainage treats locked tiles as fixed ground, so a river either keeps its locked stretch or routes round it; derived slopes join the seams |
| Regenerate area (M11) | The processes run again with a seed variant; everything outside the area is kept as a lock |
| Stamps (M11) | A stamp can copy a field region with its features |
| M12's Claude operations | The planners Claude uses (`core/doc/tools.ts`: rivers, lakes, landforms, set pieces, objects, resources) plan on the built map as today. New: a `specPatch` on Variety or a recipe ("more mesas", "a caldera in the north") regenerates; the place resolver reads the read-back rivers in flow order |
| Validation (instant and background) | Unchanged; the dam-wall check joins the design checks in the `generate` profile |

**What changes in the formats:**
- `MapSpec` gains `variety` (0–100) and, optionally, `recipe`; the genome itself is not stored in
  the spec: it is a pure function of (seed, theme, size, Variety, settings, generator version).
- The project file (`MapDocument`) becomes format 3: it adds `field` (the generated base terrain)
  beside `base` (the built map, D37). Format 1 and 2 files open as today: their features rebuild on
  their stored base, and the app offers "rebuild with the current generator" (§19.7).
- The feature schema gains the river's `pools`, `floor` and `incise`, the lake's `area` and
  `natural`, and the badwater basin's `pit` outline. Old feature lists stay valid.
- `.timber` files do not change format.

**Old project files and share links.** A project file opens exactly from its stored base whatever
the generator version (PLAN §19.7, D37); "rebuild with the current generator" re-runs the spec on
the new generator and flags orphaned edits. A share link carries the generator version (§14.5):
until versioned deploys (M13), a 0.6.0 link opened by the M9 app makes a different map, and the page
says so; from M13 the link opens `/v/0.6.0/` and reproduces its map exactly.

## 13. Budgets

The budgets: a whole generation of 128² in under 3 s; 256² within its budget (K = 3 in ≤ 20 s, so a
candidate in about 6 s, PLAN §7.9 and ROADMAP M9); the canonical settle ≤ 0.6 s at 128² and ≤ 3 s at
256² (PLAN §10, D33). The prototype's arithmetic is exact (D15; the source audit in `check.ts`
finds no transcendental function, random number or clock on an output path).

Measured on Kyler's machine (REPORT.md §6 has every number): see the table there, per theme and
size, in Node and in Chrome, one candidate each, for the prototype and the current generator.

How the full generator meets them:
- **The field once.** The processes run once per candidate (≈ 0.1–0.3 s at 128²); every rebuild uses
  the stored field.
- **Fewer settles.** The prototype settles two to four times per attempt (the land, then again after
  the badwater hollow, then the final build; the cache saves repeats). The real generator plans the
  hollow on the first settle's drainage and settles once more at most.
- **Fewer attempts.** Every retry is a whole new map. Raising the first-attempt rate (§14) is the
  biggest saving at the tail.
- **K candidates in parallel workers** (PLAN §2: independent workers, no shared memory), each
  candidate a pure function of its stream.
- **Water budget.** Big lakes and seas settle slowest (as Lake Basin today, D68). The water
  budget per genome caps lake area; seas above 30% of the map are Variety 85+ only until the settle
  meets 3 s at 256² with them.

## 14. Batch pass rates

Reported for 200 seeds per theme at 128² and fewer at 96², 192² and 256² (REPORT.md §3), first
attempt and final (12 attempts), in the real validators' `generate` profile plus
`water.storage_possible`. A retry draws a new genome (a new map from the same seed, as today).

How the build reaches ≥ 98% final with a first attempt ≥ 60% (the premise gate of ROADMAP M9):
- the settler's fallbacks (§7) already turn most "no start" attempts into maps;
- the remaining first-attempt failures in the prototype, by kind: storage (no dam, pool or levee
  line within reach), a slow settle (a big shallow lake), too few living trees or bushes within
  20 tiles' walk (a rugged start), and a missing start in narrow canyons. Each has a planner fix:
  steer the settler toward land with storage (it already reads the drainage), cap shallow lake
  area, count reachable moist land with the derived slopes, and let a canyon floor widen where the
  settler needs it;
- a map that fails validation after its settle is re-planned from the same genome before a new
  genome is drawn (cheaper, and it keeps the seed's character).

## 15. Cost: planners, version, risks

**What stays** (unchanged or nearly): the build pipeline (`features/build.ts`), derived slopes,
the water model and canonical settle, moisture and contamination, both validators and the Python
oracle, the writer and pack, the resource planner (`gen/resources.ts`), the map objects' planner
(`gen/extras.ts`), the second district, the badwater basin builder (with a pit outline), the
analysis (dam sites, walks, drought), the score, the editor's tools and builders.

**What goes from the generator** (the editor keeps its tools): the valley planner (`gen/valley.ts`,
River Valley, Canyon, Highlands, Delta) and the Lake Basin planner (`gen/lakeBasin.ts`, Lake Basin,
Islands), the terrace bands and relief fit (`gen/layout.ts`), riverside ponds and the badwater box
placement (`gen/water.ts`), and the dam-site ridge everywhere (Kyler's decision). The on-river
waterfall set piece stops being planned (falls emerge) but stays an editor tool.

**New code** (from the prototype): the genome and priors, the field (uplift, erosion, levels), the
hydrology (drainage rivers, lakes, pools, splits, deltas), the settler, hazards from the land,
`water.storage_possible` in both validators, the dam-wall check in both validators, the read-back
of features, and the measures as tools and CI checks. About 1,800 lines in the prototype, perhaps
3,000–4,000 with tests and the Python side.

**Generator version:** 0.6.0 → **0.7.0** with M9a. Every map changes, so every share link from
0.6.0 makes a different map until versioned deploys (M13); the release notes say so.

**Risks:**
- *Pass rates at the tail* (big seas, narrow canyons): the prototype's final rates are in REPORT.md;
  the fixes in §14 are planner work, not new processes.
- *Settle time with big lakes* at 256²: the water budget caps lakes; measured in §13.
- *Look*: erosion on 16 levels makes softer land than hand-made maps; the terrace and mesa parts and
  the contour waviness carry the look. Kyler's play test of M9a is the judge.
- *The dam-wall check* is a heuristic: it could flag a natural ridge a river cuts through (none of
  the official or prototype maps so far) or miss a short stamped stub (it misses today's Lake Basin
  outlet stubs, so a contract test on feature lists guards generated maps).
- *Parity with the Python oracle*: the validators do not change for the field; `water.storage_possible`
  and the dam-wall check are new checks in both.
- *Editor regeneration with constraints*: rivers routed round protected tiles can take long detours;
  the property tests need generated fields.
- *In-game behaviour* is unchecked: water at pools and deltas, badwater hollows in badtide. The ten
  playable maps in `investigation/generative/out/` are for that.

## 16. Staging

Proposed to Kyler as three stages, each with its own deliverables, acceptance and release (tags
`m9a-done`, `m9b-done`, `m9c-done`, released like milestones). The text is in ROADMAP.md, M9,
"Proposed staging (for Kyler's approval)".

- **M9a, terrain and water from processes.** The field and the hydrology in `src/core`; features
  read back; no dam ridge anywhere; `water.storage_possible` and the dam-wall check in both
  validators; the document model (format 3); the six themes as priors at default Variety; K = 1.
  Acceptance includes **zero built dam walls on every theme, size, difficulty and setting**, the
  batches, determinism, parity and budgets. **M9a must pass Kyler's play test of at least two of its
  maps before it's released publicly, and before any public beta.**
- **M9b, composition and variety.** Recipes, Variety and Surprise me, the 8 flow directions checked
  (all appear, none over 25%), river-network variety (splits, deltas, meanders and oxbows), no
  clones with K candidates and reference signatures, the measures M1–M6 as permanent checks, and
  the weather-cycle and strategy-axes parts of the openings (design version 2).
- **M9c, score, names and candidates.** The score fitted to Kyler's ratings, K = 3 with progressive
  preview, names and descriptions from the read-back features and the "how it plays" card, the place
  resolver and judgement words (D84), the settings bands.

**Permanent checks** (to run on every milestone after M9, so no later milestone brings archetypes
back): no built dam walls (the terrain check and the feature-list contract test), no clones (M1),
no archetypes (M2), play variety within its targets (M3), no approximation of workshop maps (M4).
Proposed in ROADMAP.md as part of M9's acceptance.

**How "no approximation of workshop maps" runs**, given that workshop maps and their per-map
numbers are never committed and CI does not have them:
1. **A local check in each milestone's full check** (recommended). The full check already runs on
   Kyler's machine; it reads `C:\dgm-workshop` and fails the milestone when a generated map comes
   closer to a workshop map than the workshop's p10 nearest-peer distance. Only the threshold
   (0.591) and the result are committed.
2. CI with a committed threshold and a non-reversible digest: not safe. Any digest that still lets
   CI measure the distance to each workshop map reveals each map's coarse layout and numbers, which
   is the per-map data the rule keeps local.
3. Kyler stores the workshop signatures as a secret with `gh secret set` (his to create; never
   pasted in chat): it works in CI for pushes to the repository, but the signatures (about 100 KB)
   exceed a secret's 48 KB unless an encrypted file is committed with its key as the secret, and an
   encrypted copy in the repository is still a copy. Possible if Kyler wants CI to run it, not
   recommended.
The other checks need no workshop maps in CI: their scales and cuts are aggregates, committed in
`measures.json`. M6 runs on every push (20 seeds per theme); M1–M3 on 200 seeds per theme are a
nightly and pre-tag job (about an hour of CPU).

## 17. The approval gate and version 2

**The gate** (Kyler, 2026-09-25; it supersedes step 4 of the design step). The design is approved
when:
- **a. the objective measures pass**: no built dam walls, no clones, no archetypes, play variety
  within its targets, natural dam sites near the start at a rate comparable to the official maps,
  and the batch pass rates (§10, §14; results in REPORT.md);
- **b. simulated play** shows that prototypes play differently: each prototype's weather-cycle
  behaviour (`investigation/cycles`) and its position on the strategy axes
  (`investigation/mechanics`), once those investigations are ready;
- **c. a one-page brief for each of 10 prototype maps**: its terrain, a "how it plays" card, its
  cycle timeline and its position on the strategy axes (`investigation/generative/briefs/`).
Kyler approves the direction from the briefs and the measures. The ten maps are also exported as
`.timber` files (`investigation/generative/out/`) in case Kyler wants to play one. The blind rating
page is optional and decides nothing.

**Simulated play (1b).** Both investigations it needs finished during this version, so version 1
runs them on the prototype and the baseline (seeds 1–30 per theme, M3c and M3d; REPORT.md §4): the
cycle simulator gives each map its behaviour through the first Normal drought, a later Hard drought
and the first badtide (when the start's water stops, what the land keeps, where badwater reaches,
how fast it recovers), and the mechanics axes place it on storage work, power, land, fertile land,
threats, resources, expansion and faction opportunity. The briefs carry each map's cycle timeline
and its axes. Version 2 widens this to 200 seeds and several weather seeds.

**Design version 2** folds in the three Codex investigations, read-only:
- `investigation/cycles` (PR #10, finished during version 1): version 1 already reports its cycle
  signature for prototype and baseline (M3c) and shows each brief's cycle timeline from its model.
  Version 2 decides how the signature joins the opening vector and its clustering (a workshop-free
  scale, or signatures for the official maps), runs it on 200 seeds, and adds several weather seeds
  (its INTEGRATION.md: the worst of several matters more than one lucky badtide);
- `investigation/mechanics` (PR #9, finished during version 1): version 1 reports its axes (M3d) and
  puts each brief map on them. Version 2 adds its proposals (independent storage, fertile land,
  threats and outgoing rewards; a graph of feasible actions) to the genome and the settler, and
  writes the "how it plays" cards from its axes;
- `investigation/landscapes`: no branch or PR when version 1 was finished (2026-09-25). A version-2
  input wherever it fits the parts and processes (§3–§5).
Version 2 brings new prototypes, measures and briefs; Kyler approves version 2.
