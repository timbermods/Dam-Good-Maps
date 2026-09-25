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
branch `investigation/mechanics`. Neither PR was finished when this version was written (checked
2026-09-25: no PR for either branch), so both slots are empty in version 1 and are follow-ups for
version 2 (§17).

**Permanent checks.** §16 proposes M1–M6 as checks that run on every milestone after M9, and how
M4 runs without committing workshop maps.
