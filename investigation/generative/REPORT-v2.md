# M9 design step, version 2: the prototype's numbers

The numbers behind [docs/m9-design.md](../../docs/m9-design.md) (design version 2). Every measure is
information for Kyler's judgement (D115); what blocks is breakage, Kyler's decided principles (no
built dam walls, nothing stamped) and what a player feels (no stalls, a first result quickly).

**The sets.** All at 128² and Normal unless named, measured by the same batch code
(`v2/batch.ts`: the workshop study's record, relief and verticality, the cheap cycle signature and
the strategy axes on every map):

| Set | What it is | Seeds |
|---|---|---|
| `v2-128` | design version 2 at Variety 70 and each theme's default Verticality | 1–200 per theme |
| `v2-128-vt85` | version 2 at Verticality 85 (high), heights within 16 (the lock on) | 1–100 |
| `unlocked-v2.json` | Verticality 85 behind the probe lock (heights up to 22): the land before the build, since the product's build caps terrain at 16 | 1–100 |
| `v2-128-i-snaking`, `v2-128-i-crater`, `v2-128-i-cliff` | each of Kyler's three new intentions drawn on every map (a steering test) | 1–30 |
| `v2-128-v100` | version 2 at Variety 100 (Surprise me's setting) | 1–100 |
| `v2-128-dreq`, `v2-128-doff` | the drought-aware start required, and off (the default prefers it) | 1–100 |
| `v2-96`, `v2-192`, `v2-256` | version 2 at other sizes | 1–30 |
| `v1-128` | design version 1 (byte for byte version 1's batch) | 1–200 |
| `cur-128` | the current generator (`m8-done`, 0.6.0; byte for byte version 1's baseline) | 1–200 |

**Machine and conditions.** Kyler's machine (AMD Ryzen 7 9800X3D, 8 cores, 16 threads; Node 24;
the installed Chrome), shared with other agents' jobs at full load throughout: every time is
inflated. Workshop maps and their per-map numbers stay local (`C:\dgm-workshop`); only aggregates are
here. `fit-score` and `ratings.json` are not used (D137).

## Summary: every measure against its target

The first rows block (D115); the rest are information. The targets come from design §10, the workshop and
the official maps.

| Measure | Target | Version 2 | Version 1 | Current (m8-done) |
|---|---|---|---|---|
| No built dam walls (blocks) | none | **0 of 4,672 maps** in every set, size and Verticality (2,399 of them also rechecked from their files) | 0 of 1,200 | 765 of 1,200 |
| Batches (blocks) | ≥ 98% final per theme and size | **100% final** in every theme at 96², 128², 192² and 256², and at Variety 100; **99%** for Canyon at Verticality 85 (one seed) | 100% | 100% |
| Same bytes from a seed; both validators (blocks) | always; 0 disagreements | **40 of 40** maps give the same bytes twice and in a fresh process; **0 disagreements** in 1,720 checks | 58 of 58; 0 | – |
| A first result quickly, no stall (blocks) | quickly | the page never waits (the product generates in a worker); one map at a time, the first look at 0.15 s (128²) and 0.6 s (256²), the whole map 1.4 s and 5.1 s (Node); a slow tail under load (5% over 10 s at 128², §12) | – | – |
| First attempt | 60% (a target) | 53.5–76% by theme (Canyon lowest) | 62.5–90.5% | 96–100% |
| M1 no clones | nearest ≥ 0.25, median ≥ 0.40 | 0.36–0.45 / 0.48–0.52: **6 of 6** | 0.33–0.38 / 0.42–0.48: 6 of 6 | 0.04–0.16 / 0.06–0.22: 0 of 6 |
| M2a whole-map archetypes | no cluster over 15% | 6–14.5%: **6 of 6** | 11.5–68%: 1 of 6 | 100% |
| M2b river networks | no cluster over 15%; many shapes | 7–12.5%, 96–135 shapes | 8–20%, 108–137 shapes | 42.5–100%, 4–25 shapes |
| M2c relief | no cluster over 15% | 2.5–4.5%, 20–39 shapes | 2–5%, 12–49 shapes | 9–29.5%, 6–14 shapes |
| M3 openings | no cluster over 15%; the spread | 1.5–2%, spread 0.76–0.92 | 2–7.5%, 0.68–0.84 | 21.5–64.5%, 0.34–0.57 |
| M3c cycle (cheap signature, 200 per theme) | play differs | 31–36 groups, the largest 16–35% | 15–32 groups, 20.5–62.5% | 1–3 groups, 60.5–100% |
| M3d strategy axes | play differs | 185–196 joint signatures of 200, the largest 1–1.5% | 149–190, 1–3.5% | 22–48, 7–22% |
| M4 no approximation (D128) | at most 10% below the workshop's p10 | River Valley 8.5%, Canyon 0.5%, Highlands 3.5%, Lake Basin 12.5%, Delta 12.5%, Islands 15%: 3 of 6 | 2–20%: 3 of 6 | 0–2.5%: 6 of 6 |
| M5 good natural dam within 40 tiles | comparable to official (36%; workshop 46%): 26–56% | 64% (49.5–76.5% by theme; 2 of 6 in the band) | 48% (27–73.5%) | 60% (0–100%) |
| M7 storage possible | a guard | 100% | 100% | 99–100% |
| Relief range | official 13, workshop 14 | **13** (12–14 by theme) | 8 | 10 |
| Levels in use | 16, 16 | 15 | 11 | 10 |
| Tallest fall (levels) | official 3.9, workshop 5.7 | 5.1 | 3 | 2 |
| Flat share / cliff share | 0.52 / 0.16 official; 0.44 / 0.11 workshop | 0.41 / 0.15 | 0.56 / 0.06 | 0.68 / 0.11 |
| Reach on foot | 9% official, 7% workshop | 15% | 40% | 35% |
| Above 16 | none by default; behind the lock only at 70+ | none by default; at Verticality 85 behind the lock, 8.7% of the land on every map (the land before the build) | – | – |
| Naturalness: steps in straight runs of 8+ / longest run | official 0.07 / 18 | 0.04 / 15 | 0.04 / 14 | 0.14 / 28 |
| Landscape bench, relief group | lower is closer to real terrain | 0.52 | 0.60 | 0.66 |
| Intentions | outcomes that emerge; some maps none | Kyler's four emerge on 70% (under a cliff), 68% (the snaking river), 24% (the crater) and 19.5% (the waterfall into a round lake) of their draws; the other seven 21–91%; "safe water uphill" left the set | – | – |
| Start water through the first Normal drought | a proposal (#54) | 42% (off: 38.5%; required: 100%, first attempts 47%, final 98.8%) | 29% | 33% |

## 1. The prototype

`investigation/generative/v2/` (no `src/` change), on top of version 1's modules:

| File | What it does |
|---|---|
| `genome.ts` | the genome and the six themes' priors, Verticality, the variation index |
| `field.ts` | uplift (tilt, regional field, noise, parts), caprock, erosion with hardness, weathering |
| `levels.ts` | levels (hypsometry, benches), natural ramps |
| `hydro.ts` | version 1's hydrology with hanging valleys, knickpoints and spring lakes |
| `start.ts` | the settler: reach, moist land by walk, drought-aware water, the intentions' preferences |
| `hazards.ts` | version 1's badwater hollow |
| `intentions.ts` | the set (eleven, four of them Kyler's), the draw, the nudges, the settler's preferences, the checks |
| `generate.ts` | the pipeline: the field once, one settle, re-plans, the intention checks and re-steer |
| `terrain.ts` | the runs model and format 3's `TerrainData` |
| `cycle.ts` | the cheap cycle signature |
| `narrows.ts`, `narrows-check.ts` | the natural-narrows builder and its trial |
| `vertical.ts`, `refs.ts`, `unlocked.ts` | relief and vertical reach, the official and workshop yardstick, and the land behind the probe lock |
| `batch.ts`, `measures.ts`, `archetypes.ts`, `tables.ts` | the batches, the measures, the cluster drivers, these tables |
| `simplay.ts` | the exact cycle model on a sample, and the cheap signature against it |
| `landscapes.ts` | the landscape bench |
| `names.ts`, `card.ts`, `export.ts`, `render.ts`, `sheet.ts` | names, the "how it plays" card, the ten briefs, renders, contact sheets |
| `bench.ts`, `check.ts`, `variations.ts` | speed, determinism and parity, Variations |

## 2. Batch pass rates

A map passes when the real validators pass in the `generate` profile, `water.storage_possible`
holds and the dam-wall check finds no wall; up to 12 attempts, planning again on the same field
before a new genome (design §13).

### Pass rates (first attempt / final, maps)

| Set | River Valley | Canyon | Highlands | Lake Basin | Delta | Islands |
| --- | --- | --- | --- | --- | --- | --- |
| v2-96 | 60% / 100% (30) | 43.3% / 100% (30) | 66.7% / 100% (30) | 70% / 100% (30) | 76.7% / 100% (30) | 60% / 100% (30) |
| v2-128 | 69% / 100% (200) | 53.5% / 100% (200) | 71% / 100% (200) | 73% / 100% (200) | 76% / 100% (200) | 68.5% / 100% (200) |
| v2-192 | 73.3% / 100% (30) | 63.3% / 100% (30) | 70% / 100% (30) | 70% / 100% (30) | 73.3% / 100% (30) | 66.7% / 100% (30) |
| v2-256 | 73.3% / 100% (30) | 56.7% / 100% (30) | 80% / 100% (30) | 73.3% / 100% (30) | 76.7% / 100% (30) | 73.3% / 100% (30) |
| v2-128-vt85 | 62% / 100% (100) | 44% / 99% (100) | 60% / 100% (100) | 58% / 100% (100) | 69% / 100% (100) | 49% / 100% (100) |
| v2-128-v100 | 65% / 100% (100) | 52% / 100% (100) | 77% / 100% (100) | 73% / 100% (100) | 81% / 100% (100) | 73% / 100% (100) |
| v2-128-dreq | 46% / 100% (100) | 33% / 94% (100) | 52% / 100% (100) | 51% / 99% (100) | 53% / 100% (100) | 46% / 100% (100) |
| v2-128-doff | 70% / 100% (100) | 56% / 100% (100) | 75% / 100% (100) | 72% / 100% (100) | 73% / 100% (100) | 68% / 100% (100) |
| v1-128 | 87% / 100% (200) | 62.5% / 100% (200) | 86% / 100% (200) | 75% / 100% (200) | 90.5% / 100% (200) | 89.5% / 100% (200) |
| cur-128 | 99.5% / 100% (200) | 100% / 100% (200) | 96% / 100% (200) | 100% / 100% (200) | 99% / 100% (200) | 100% / 100% (200) |

Every seed gives a map at every size and setting but one: Canyon seed 45 at Verticality 85, after
12 attempts (99% final for that theme and set; the blocking rule is 98%). First attempts are lower
than version 1's. The settler asks for more (reach, moist land by walk, drought-aware water), and
the land is taller and cliffier. Most failed attempts are planned again on the same field: 87% of
maps finish on their first genome. Canyon and Verticality 85 are lowest: a failed attempt there
mostly has no storage near the start, or no place for a start on joined ground. The reasons are in
[measures-v2.json](measures-v2.json) (`failedAttempts`). Requiring the drought-aware start
(`v2-128-dreq`) is §5's subject.

## 3. The measures

Version 1's definitions (design §10), unchanged; the workshop's scales and cuts are aggregates in
[measures-v2.json](measures-v2.json).

### 3.1 No clones

### M1 no clones (nearest other seed; min / median)

| Theme | v2 | v1 | current |
| --- | --- | --- | --- |
| River Valley | 0.417 / 0.507 | 0.326 / 0.441 | 0.109 / 0.161 |
| Canyon | 0.361 / 0.482 | 0.328 / 0.451 | 0.035 / 0.06 |
| Highlands | 0.4 / 0.498 | 0.355 / 0.468 | 0.137 / 0.207 |
| Lake Basin | 0.45 / 0.521 | 0.377 / 0.475 | 0.107 / 0.161 |
| Delta | 0.414 / 0.489 | 0.335 / 0.416 | 0.088 / 0.154 |
| Islands | 0.44 / 0.506 | 0.354 / 0.451 | 0.16 / 0.216 |

### 3.2 No archetypes

### M2 no archetypes: largest cluster's share (clusters)

| Theme | Whole maps v2 | v1 | current | Rivers v2 | v1 | Relief v2 | v1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| River Valley | 6% (72) | 46.5% (30) | 100% (1) | 7% (81) | 8% (58) | 3% (137) | 2.5% (129) |
| Canyon | 11% (55) | 26% (34) | 100% (1) | 12.5% (60) | 8% (60) | 2.5% (144) | 2% (153) |
| Highlands | 10% (61) | 29% (36) | 100% (1) | 11% (63) | 20% (61) | 2.5% (133) | 2% (151) |
| Lake Basin | 8% (85) | 11.5% (36) | 100% (1) | 11% (62) | 8% (62) | 4% (119) | 3.5% (122) |
| Delta | 14.5% (59) | 68% (19) | 100% (1) | 7.5% (71) | 11% (61) | 4.5% (116) | 5% (97) |
| Islands | 8.5% (74) | 55.5% (30) | 100% (1) | 9% (66) | 8.5% (47) | 3.5% (115) | 4.5% (84) |

What drove version 1's clusters, and what version 2 changed (task b). A cluster's maps are close
when both halves of the variety distance are small. In version 1 the layout half was the driver:
the largest clusters were maps shaped like one tilted plane (planarity: the share of a map's 16×16
height picture a plane explains), and under the distance's rotations and mirrors every tilted plane
looks alike. They also shared no islands, low water and lake shares, and a narrow relief. Version 2
weakened the regional tilt, added a regional field of several highs and lows, made escarpments die
out along their length, and drew water, islands and relief wider. Its largest clusters are less
planar than version 1's (0.20–0.35 against 0.26–0.57; the workshop's typical map 0.22), though still
a little more planar than the rest in four themes. What they share now is mostly structural (no
caves, rarely islands) and a low water share. Canyon's water prior was drawn wider in the second run
(more lakes, spring lakes and river islands), which brought its cluster from 19.5% to 11%.

### M2a drivers of the largest whole-map cluster (v2 against v1)

| Theme | Set | Layout half / feature half (workshop pair 0.51 / 0.53) | Planarity: cluster / rest (workshop 0.22) | Features its maps agree on most (ratio to a workshop pair) |
| --- | --- | --- | --- | --- |
| River Valley | v1-128 | 0.34 / 0.216 | 0.492 / 0.3 | caveShare 0, islands 0.044, waterShare 0.156, lakeShare 0.188 |
| River Valley | v2-128 | 0.353 / 0.198 | 0.352 / 0.2 | caveShare 0, islands 0.211, bushesPer10k 0.279, waterShare 0.284 |
| Canyon | v1-128 | 0.327 / 0.231 | 0.459 / 0.336 | caveShare 0, islands 0.052, waterShare 0.14, lakeShare 0.16 |
| Canyon | v2-128 | 0.366 / 0.2 | 0.21 / 0.223 | caveShare 0, islands 0.063, waterShare 0.126, lakeShare 0.17 |
| Highlands | v1-128 | 0.349 / 0.212 | 0.432 / 0.25 | caveShare 0, islands 0.024, lakeShare 0.177, waterShare 0.178 |
| Highlands | v2-128 | 0.369 / 0.191 | 0.294 / 0.176 | caveShare 0, islands 0.069, lakeShare 0.171, waterShare 0.173 |
| Lake Basin | v1-128 | 0.361 / 0.193 | 0.287 / 0.188 | islands 0, caveShare 0, cliffShare 0.124, lakeShare 0.181 |
| Lake Basin | v2-128 | 0.413 / 0.149 | 0.258 / 0.179 | caveShare 0, islands 0.087, cliffShare 0.184, step1Share 0.19 |
| Delta | v1-128 | 0.343 / 0.213 | 0.567 / 0.35 | caveShare 0, islands 0.04, cliffShare 0.165, waterShare 0.199 |
| Delta | v2-128 | 0.369 / 0.187 | 0.195 / 0.237 | caveShare 0, islands 0.092, waterShare 0.154, lakeShare 0.168 |
| Islands | v1-128 | 0.356 / 0.202 | 0.262 / 0.199 | caveShare 0, cliffShare 0.161, step1Share 0.247, relief 0.308 |
| Islands | v2-128 | 0.392 / 0.171 | 0.294 / 0.215 | islands 0, caveShare 0, relief 0.183, damSitesPer10k 0.219 |

### 3.3 Play variety: openings, the cycle signature and the axes

### M3 openings; M3c cheap cycle; M3d strategy axes

| Theme | Openings: largest, spread (v2 / v1 / current) | Cycle groups, largest (v2 / v1 / current) | Axes: joint signatures, largest (v2 / v1 / current) |
| --- | --- | --- | --- |
| River Valley | 1.5%, 0.893 / 2.5%, 0.827 / 21.5%, 0.554 | 35, 20% / 22, 48% / 2, 97.5% | 196, 1.5% / 177, 2% / 48, 7% |
| Canyon | 1.5%, 0.92 / 5.5%, 0.788 / 55%, 0.376 | 31, 35% / 20, 51% / 2, 99.5% | 185, 1% / 162, 3.5% / 23, 22% |
| Highlands | 2%, 0.918 / 2%, 0.839 / 21.5%, 0.565 | 33, 18.5% / 30, 30% / 3, 60.5% | 195, 1% / 190, 1% / 44, 9% |
| Lake Basin | 1.5%, 0.807 / 3%, 0.769 / 64.5%, 0.354 | 36, 18% / 32, 20.5% / 2, 97.5% | 192, 1.5% / 189, 1.5% / 22, 21% |
| Delta | 2%, 0.774 / 4%, 0.735 / 52.5%, 0.347 | 34, 29.5% / 15, 62.5% / 2, 68% | 193, 1% / 149, 3.5% / 33, 15% |
| Islands | 2%, 0.758 / 7.5%, 0.684 / 48.5%, 0.343 | 34, 16% / 24, 28.5% / 1, 100% | 196, 1% / 174, 2.5% / 31, 10.5% |

### 3.4 No approximation

### M4 no approximation (share of a theme's maps closer to a workshop map than the workshop's p10, 0.591)

| Theme | v2 | v1 | current | v2's close pairs: layout half / feature half (all maps' nearest pairs) | Features that make v2's close pairs close (ratio to all nearest pairs) |
| --- | --- | --- | --- | --- | --- |
| River Valley | 8.5% (17) | 20% (40) | 0% (0) | 0.382 / 0.185 (0.406 / 0.266) | islands 0.257, step1Share 0.381, scrapPer1k 0.469, cliffShare 0.493, flatShare 0.58 |
| Canyon | 0.5% (1) | 9% (18) | 2.5% (5) | 0.39 / 0.174 (0.416 / 0.351) | islands 0, caveShare 0, cliffShare 0.005, waterfalls 0.064, flatShare 0.111 |
| Highlands | 3.5% (7) | 15.5% (31) | 0% (0) | 0.374 / 0.207 (0.428 / 0.281) | step1Share 0.22, scrapPer1k 0.45, relief 0.465, flatShare 0.58, waterfalls 0.658 |
| Lake Basin | 12.5% (25) | 4% (8) | 0% (0) | 0.392 / 0.176 (0.424 / 0.226) | islands 0.432, relief 0.582, step1Share 0.606, cliffShare 0.662, damSitesPer10k 0.679 |
| Delta | 12.5% (25) | 16.5% (33) | 2.5% (5) | 0.373 / 0.187 (0.399 / 0.238) | basins 0.64, scrapPer1k 0.69, step1Share 0.696, bushesPer10k 0.701, damSitesPer10k 0.802 |
| Islands | 15% (30) | 2% (4) | 0% (0) | 0.379 / 0.187 (0.415 / 0.233) | islands 0.166, scrapPer1k 0.645, step1Share 0.693, waterfalls 0.755, cliffShare 0.761 |

**Which features make the close pairs close** (task c). A close pair is a generated map and its
nearest workshop map. Each ratio compares the pair's difference on one feature with the typical
nearest pair's; a low ratio means the feature is what makes them close. No workshop map is used in
generation, and per-map workshop numbers stay local.
- **River Valley** (8.5%): islands (0.26: neither has one), one-level steps (0.38), scrap (0.47),
  cliffs (0.49) and flat land (0.58). The layout half is a little smaller than usual (0.38 against
  0.41).
- **Highlands** (3.5%): one-level steps (0.22), scrap (0.45), relief (0.47), flat land (0.58) and
  falls (0.66).
- **Delta** (12.5%): no single feature stands out: basins (0.64), scrap (0.69), one-level steps
  (0.70), bushes (0.70) and dam sites (0.80). Delta's gentle, bushy lowland with few basins sits
  near the workshop's middle on many features at once.
- **Islands** (15%) and **Lake Basin** (12.5%) are close on islands, one-level steps, cliffs, relief
  and scrap. Drawing water over the workshop's range (task b) moved them toward its median of 0.27.

Version 1 against version 2: River Valley 20% → 8.5%, Highlands 15.5% → 3.5%, Delta 16.5% →
12.5%, Canyon 9% → 0.5%. Lake Basin (4% → 12.5%) and Islands (2% → 15%) went the other way.

### 3.5 Relief and verticality

### Relief and verticality (medians; p10–p90 in brackets)

| Measure | Official | Workshop | v2 default | v2 Verticality 85 (≤ 16) | v2 Verticality 85 unlocked (the land before the build) | v2 Variety 100 | v1 | current |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| range | 13 (10–15) | 14 (8–18) | 13 (11–14) | 13 (12–15) | 16 (14–18) | 13 (10–14) | 8 (6–12) | 10 (10–13) |
| levels | 16 (12–17) | 16 (9–17) | 15 (9–17) | 13 (7–16) | 15 (7–19) | 14 (8–17) | 11 (8–14) | 10 (8–14) |
| maxHeight | 16 (16–16) | 16 (16–22) | 15 (14–16) | 16 (14–16) | 19 (18–20) | 16 (13–16) | 15 (12–16) | 16 (16–16) |
| above16 | 0% (0%–0%) | 0% (0%–22.6%) | 0% (0%–0%) | 0% (0%–0%) | 8.7% (3.6%–16.2%) | 0% (0%–0%) | 0% (0%–0%) | 0% (0%–0%) |
| tallestFall | 3.94 (0.97–6.96) | 5.74 (1.99–10.87) | 5.11 (2.01–9.7) | 5.98 (2.96–10.01) | – | 4.99 (1.83–9.15) | 3 (1–6.94) | 1.98 (0.95–5) |
| flatShare | 52% (34.3%–59.3%) | 44% (25.1%–57%) | 41.1% (29.1%–56%) | 51% (37.8%–62.8%) | 47.4% (33.6%–59.7%) | 45.2% (32.7%–60.5%) | 56.1% (44.3%–66.8%) | 68.1% (58.7%–76.5%) |
| cliffShare | 15.8% (8.6%–18.1%) | 10.9% (4.6%–20.9%) | 15% (7.8%–30%) | 22.3% (15.7%–30.5%) | 25.7% (18.3%–35.6%) | 17% (7.5%–29.9%) | 5.8% (3.1%–15.3%) | 10.7% (6%–14.7%) |
| onFoot | 8.6% (3.2%–26.2%) | 7% (1.9%–16.6%) | 15% (2.8%–38.8%) | 11.8% (2.6%–40.6%) | – | 16.2% (3%–46.4%) | 40.1% (5.7%–76.6%) | 34.6% (14.4%–65.7%) |
| stairsOnly | 91.4% (73.8%–96.8%) | 93% (83.3%–97.4%) | 85% (61%–97.2%) | 88.2% (59%–97.4%) | – | 83.8% (52.9%–96.9%) | 59.8% (23.3%–94.2%) | 65.4% (34.3%–85.6%) |
| oneStep | 43.6% (3.1%–87.4%) | 17.2% (4.7%–47.2%) | 65.3% (6.4%–96.6%) | 32% (2.5%–76.6%) | – | 55.4% (4%–95.8%) | 44.9% (4%–94.4%) | 28% (5%–44.8%) |

### Relief by theme (v2 default: range, levels, tallest fall, flat, cliff; median)

| Theme | Range | Levels | Tallest fall | Flat | Cliff | On foot | At Verticality 85: range, fall, cliff, on foot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| River Valley | 13 | 15 | 5 | 39.8% | 15% | 14% | 14, 6.07, 22.1%, 11.9% |
| Canyon | 14 | 9 | 5.17 | 49.5% | 26.9% | 13.4% | 14, 6.12, 25.5%, 13.1% |
| Highlands | 13 | 15 | 6 | 44.4% | 23.8% | 10% | 13, 6.77, 24.7%, 13.4% |
| Lake Basin | 12 | 15 | 5.01 | 36.2% | 12.3% | 15.2% | 13, 5.72, 22.4%, 10.9% |
| Delta | 12 | 15 | 5 | 40.2% | 8.4% | 20.7% | 13, 5.08, 17.6%, 11% |
| Islands | 12 | 15 | 5.18 | 36% | 11.8% | 15.2% | 13, 5.14, 20.7%, 10.9% |

**At the default** the relief reaches the official median (13) and is one level short of the
workshop's (14); the themes sit at 12–14. The highest ground is 15 at the median (14–16). The
tallest fall (5.1 levels) sits between the official and workshop medians (3.9 and 5.7), and so does
the cliff share. The flat share is a little below the workshop's (0.41 against 0.44). Canyon uses
fewer levels (9) because its benches are 2–4 levels tall. More land is reached on foot than on
official or workshop maps (15% against 9% and 7%): those maps leave nearly all their land to
stairs.

**At Verticality 85** with the lock on, the relief stays within 16. The land turns to cliffs (22%
against 15%) and benches (13 levels in use), with taller falls (6.0) and less land on foot (12%).
**Behind the lock** (heights up to 22; `unlocked-v2.json`), every map goes above 16: the highest
ground is 19 (18–20), 8.7% of the land is above 16 (3.6–16%), and the relief is 16 (14–18). These
are measured on the land before the build. The product's build clips terrain at 16 (`MAX_TERRAIN`,
`integrityAt`); M9a lifts that for Verticality 70+ once the probe batch confirms such maps load.
**At Variety 100** (Surprise me), 17% of maps jumped to Verticality 70+ (103 of 600), as D132 asks
("now and then").

### 3.6 Naturalness and shape

### Naturalness and shape (medians)

| Set | Steps in straight runs of 8+ | Longest straight run | Ridge height std | Basin rim thickness CV | Water share | Lake share | Maps with an island | Waterfalls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Official | 0.07 | 18 | – | – | 15.2% | – | – | 4 |
| Workshop | 0.03 | 17 | – | – | 26.5% | – | – | 6 |
| v2 (theme median) | 0.04 | 15 | 0.29 | 0.37 | 12.2% | 9.1% | 6.9% | 4 |
| v1 (theme median) | 0.04 | 14 | 0 | 0.31 | 10.2% | 7.6% | 10.1% | 1 |
| current (theme median) | 0.14 | 28 | 0 | 0.18 | 8.3% | 2.5% | 16.8% | 2 |

### 3.7 Flow directions

### Flow directions (v2: share of maps whose water leaves toward each side)

- River Valley: E 14%, NE 13.5%, N 13%, S 13%, SW 12.5%, SE 12%, W 9%, NW 9%, local 4%
- Canyon: S 14.5%, E 13%, N 12%, NW 12%, SW 12%, SE 11.5%, W 11%, NE 10.5%, local 2.5%, closed 1%
- Highlands: E 16.5%, NE 13.5%, N 13.5%, S 12.5%, W 11%, SE 11%, SW 10.5%, NW 8.5%, local 3%
- Lake Basin: SE 15.5%, E 15%, NE 13%, N 12%, NW 11.5%, W 11%, SW 9%, S 8.5%, local 4.5%
- Delta: E 16%, NE 14%, NW 12.5%, S 11%, W 11%, N 10.5%, SE 8.5%, local 8.5%, SW 8%
- Islands: S 14.5%, NE 14%, E 12.5%, W 12%, N 11.5%, SE 10.5%, NW 9.5%, SW 8.5%, local 7%

### 3.8 Natural dam sites, dam walls and storage

### M5–M7: good natural dam site within 40 tiles (workshop 46.3%, official 36.4%); dam walls; storage possible

| Theme | M5 v2 | v1 | current | M6 walls v2 | v1 | current | M7 v2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| River Valley | 67% | 41.5% | 78% | 0 of 200 | 0 of 200 | 198 of 200 | 100% |
| Canyon | 49.5% | 33% | 100% | 0 of 200 | 0 of 200 | 170 of 200 | 100% |
| Highlands | 67.5% | 55% | 83% | 0 of 200 | 0 of 200 | 197 of 200 | 100% |
| Lake Basin | 76.5% | 57.5% | 2.5% | 0 of 200 | 0 of 200 | 0 of 200 | 100% |
| Delta | 50% | 27% | 96.5% | 0 of 200 | 0 of 200 | 200 of 200 | 100% |
| Islands | 71.5% | 73.5% | 0% | 0 of 200 | 0 of 200 | 0 of 200 | 100% |

## 4. Intentions

### Intentions (v2-128; maps with none / one / two: 293 / 614 / 293)

| Intention | Drawn | Emerged | Re-steered | Dropped | Drop rate | Within: M1 min / median | Within: M2a largest (clusters) | On the sheet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The start sits under a cliff, with water below (Kyler's own) | 135 | 94 | 1 | 40 | 29.6% | 0.441 / 0.517 | 10.5% (46) | canyon-2, highlands-2, riverValley-9 |
| A signature landmark stands out: a spire, a mesa, a peak or a tall waterfall | 128 | 117 | 0 | 11 | 8.6% | 0.38 / 0.527 | 6% (52) | canyon-3, riverValley-7, highlands-8 |
| The best farmland lies past the gorge | 90 | 18 | 1 | 71 | 78.9% | 0.524 / 0.612 | 10.5% (17) | delta-3, islands-8, riverValley-12 |
| A waterfall shields the start: its cliff stands between the start and the nearest threat | 100 | 27 | 2 | 71 | 71% | 0.458 / 0.55 | 17.2% (17) | highlands-6, lakeBasin-15 |
| A hidden valley up the cliffs, reached only by stairs, holds riches | 68 | 35 | 0 | 33 | 48.5% | 0.474 / 0.573 | 8.6% (22) | riverValley-8, canyon-9 |
| A lake high on the heights spills over a fall | 105 | 60 | 0 | 45 | 42.9% | 0.438 / 0.535 | 13.3% (29) | islands-4, lakeBasin-17, highlands-30 |
| Two rivers meet by the start | 96 | 21 | 2 | 73 | 76% | 0.465 / 0.573 | 13% (16) | canyon-10, delta-27 |
| The start looks out from high ground over the land below | 113 | 26 | 1 | 86 | 76.1% | 0.486 / 0.591 | 7.4% (20) | islands-22 |
| A snaking river winds down a hill, dropping a level at its bends (Kyler's own) | 142 | 97 | 0 | 45 | 31.7% | 0.439 / 0.52 | 10.3% (45) | highlands-1, delta-2, lakeBasin-11 |
| A large crater gathers two or more rivers into its lake, which leaves through a gap in the rim (Kyler's own) | 105 | 25 | 0 | 80 | 76.2% | 0.468 / 0.579 | 20% (17) | lakeBasin-9, highlands-12 |
| A waterfall plunges off a cliff into a large, roughly round lake (Kyler's own) | 118 | 23 | 0 | 95 | 80.5% | 0.492 / 0.567 | 13% (16) | canyon-1, islands-1, highlands-4 |

### Kyler's three new intentions on every map (seeds 1–30 of every theme, each drawn alone)

| Intention | Maps | Emerged | Re-steered | Dropped | Drop rate | By theme (emerged) | Within: M1 min / median | Within: M2a largest (clusters) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A snaking river winds down a hill, dropping a level at its bends (Kyler's own) | 180 | 119 | 0 | 61 | 33.9% | Canyon 18, Delta 18, Highlands 23, Islands 15, Lake Basin 19, River Valley 26 | 0.43 / 0.529 | 6.7% (51) |
| A large crater gathers two or more rivers into its lake, which leaves through a gap in the rim (Kyler's own) | 180 | 51 | 0 | 129 | 71.7% | Canyon 5, Delta 7, Highlands 12, Islands 11, Lake Basin 7, River Valley 9 | 0.49 / 0.553 | 5.9% (32) |
| A waterfall plunges off a cliff into a large, roughly round lake (Kyler's own) | 180 | 30 | 0 | 150 | 83.3% | Canyon 2, Delta 4, Highlands 5, Islands 6, Lake Basin 7, River Valley 6 | 0.47 / 0.534 | 23.3% (17) |

**Kyler's four.**
- **"The start sits under a cliff, with water below"** emerges on 70% of its draws (94, and one
  re-steered, of 135). On the sheet: Canyon 2, Highlands 2, River Valley 9; in the briefs: 1.
- **"A snaking river going down a hill"** emerges on 68% (97 of 142), in every theme. A course
  turns three times or more, back and forth, while its bed drops 3–15 levels (7 at the median).
  On the sheet: Highlands 1, Delta 2, Lake Basin 11; in the briefs: 2.
- **"A large crater where multiple rivers converge"** emerges on 24% (25 of 105), most often in Lake
  Basin. Of the 80 drops, 31 had a closed crater lake that one river or none entered, 12 had a
  second way out, 23 had a rim open on too many sides, and 14 had no large lake. On the sheet: Lake
  Basin 9, Highlands 12; in the briefs: 3.
- **"A cliffside with a waterfall into a large circular lake"** emerges on 19.5% (23 of 118). Of the
  95 drops, 32 had a round lake with no fall of 3+ levels into it, 32 had no large lake, 18 had a
  fall into a lake that was not round, and 13 had neither. On the sheet: Canyon 1, Islands 1,
  Highlands 4; in the briefs: 4.

**Drawn on every map** (the steering test: each of the three new ones drawn alone on seeds 1–30 of
every theme, 180 maps each):
- **The snaking river** emerges on 66% (119), in every theme. No clones within it (the nearest pair
  0.43 apart), and the largest cluster holds 6.7% (51 clusters).
- **The crater** emerges on 28% (51), in every theme. No clones (0.49), and the largest cluster
  holds 5.9% (32 clusters).
- **The waterfall into a round lake** emerges on 17% (30). No clones (0.47), but the largest cluster
  holds 23% (7 of 30). Those seven are tilted-plane maps (planarity 0.34 against 0.21 for the rest)
  with no islands and little water. The nudge's tall scarp makes one big step across the map. The
  fix is for M9b: a shorter, tapered scarp, or caprock alone, then measure again.

**The others.** A landmark (91%), a high lake (57%) and a hidden valley (51%) come from the land;
they are common because the relief is high. A waterfall shield (29%), the long view (24%), meeting
waters (24%) and farmland past the gorge (21%) need the start to find a rare place. They stay: each
emerges on one draw in three to five, and M9b's steering is the next lever.

**"The only safe water is uphill"** left the set: in version 2's first run it emerged on 4 of 86
draws, because uphill lakes that keep their water through a drought are too rare in this land.

**Within each intention** of the default draw, no two maps are clones (the nearest pair 0.38 or more
apart). The largest cluster holds 6–13% for most. It holds 17% for the waterfall shield and 20% for
the crater, but on only 29 and 25 maps; the crater's forced set (51 maps) shows 5.9%.

## 5. Drought-aware start water

### Drought-aware start water (the start keeps pumpable water through the first Normal drought, analytic)

| Set | Share of maps | First attempt | Final |
| --- | --- | --- | --- |
| v2-128 | 41.9% | 68.5% | 100% |
| v2-128-dreq | 100% | 46.8% | 98.8% |
| v2-128-doff | 38.5% | 69% | 100% |
| v1-128 | 29.2% | 81.8% | 100% |
| cur-128 | 33.4% | 99.1% | 100% |

The start keeps pumpable water through the first Normal drought (the analytic drought over 3 days)
on 42% of maps when the settler prefers it (the default). With the preference off it is 38.5%;
version 1 had 29% and the current generator 33%.

The preference moves only a few maps (×1.25 up, ×0.8 down): most places a start can go have water
that does not last, since every source stops in a drought. Requiring it (`v2-128-dreq`) gets 100% of
maps, at a cost:
- first attempts fall from 68.5% to 47%;
- finals fall to 98.8%: Canyon 94% and Lake Basin 99% miss seeds.

Hence #54's default: prefer on Normal and Hard, require on Easy only. On Easy the preference could
be stronger instead (weights of ×2), which M9a can measure.

## 6. Simulated play

### The exact cycle model (seeds 1–15 per theme at 128², weather seed 1729)

| Theme | Groups, largest (v2 / v1 / current) | Nearest-peer median (v2 / v1 / current) | Water kept through the Hard drought, range (v2) | Start keeps water through the first Normal drought (v2) |
| --- | --- | --- | --- | --- |
| River Valley | 9, 20% / 4, 46.7% / 2, 80% | 0.072 / 0.032 / 0.016 | 0%–66.4% | 46.7% |
| Canyon | 9, 26.7% / 5, 46.7% / 1, 100% | 0.076 / 0.034 / 0 | 0%–48% | 40% |
| Highlands | 9, 26.7% / 7, 26.7% / 4, 46.7% | 0.078 / 0.085 / 0.024 | 0%–59.5% | 53.3% |
| Lake Basin | 12, 13.3% / 9, 26.7% / 4, 46.7% | 0.104 / 0.096 / 0.019 | 0%–52.1% | 40% |
| Delta | 11, 13.3% / 7, 40% / 3, 60% | 0.099 / 0.056 / 0.021 | 0%–44.5% | 33.3% |
| Islands | 10, 26.7% / 11, 26.7% / 2, 86.7% | 0.069 / 0.092 / 0.015 | 0%–61.1% | 66.7% |

The cheap signature against the exact model (90 maps of v2): long retention r = 0.999, short retention r = 0.997, start days r = 0.992, running share against badwater exposure r = 0.425; the retention bin agrees on 100%, the start-days bin on 63.3%, the first-drought verdict on 100%.

The exact model (the cycles study's, unchanged) played the same 15 seeds of every theme. Version 2
splits into more cycle groups than version 1 in five themes of six (Islands has one fewer). Its
largest group is smaller in four themes and equal in two (Highlands, Islands). Its nearest-peer
distance is the larger in four (in Highlands and Islands version 1's is a little larger). The
water's year differs more from map to map, and the current generator's maps fall into one to four
groups. The water kept through the late Hard drought ranges, by theme, from none to between 45% and
66% of the map's clean water. With weather seed 1729, the start keeps pumpable water through the first
Normal drought on 33% (Delta) to 67% (Islands) of these maps.

The cheap signature (design §11) is what the generator can afford on every candidate. It stands in
for the exact model on retention and the first drought: r 0.997–0.999, and both the retention bin
and the first-drought verdict agree on every map. Start days agree by value (r 0.99) but less by bin
(63%), because days near a bin's edge fall either side. Its badwater proxy is weak (r 0.43), so
exposure stays the exact model's.

## 7. Speed

### Speed in the batches (all six themes, loaded machine; the set's name gives its size; ms)

| Set | Whole map: median (p90) | First look | First settled water | Settles per map: median (p90) |
| --- | --- | --- | --- | --- |
| v2-128 | 2151 (7005) | 247 (4646) | 1597 (6395) | 1 (2) |
| v2-96 | 1188 (4266) | 148 (2995) | 866 (4061) | 1 (2) |
| v2-192 | 4637 (13307) | 563 (7965) | 3528 (12462) | 1 (2) |
| v2-256 | 8980 (22962) | 1135 (14961) | 6819 (20921) | 1 (1) |
| v1-128 | 2551 (5726) | – | – | – |
| cur-128 | 1628 (3403) | – | – | – |

### Speed bench (AMD Ryzen 7 9800X3D 8-Core Processor × 16, Node v24.13.0; seeds 1, 2 of every theme, one map at a time; ms)

| Where | Size | Generator | Median | Max | Node CPU median | First attempt | First look median (max) | First water median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| node | 128 | proto2 | 1444 | 2700 | 1703 | 75% | 154 (1982) | 966 |
| node | 128 | proto | 1088 | 4113 | 1156 | 92% | – | – |
| node | 128 | current | 688 | 1633 | 751 | 100% | – | – |
| node | 256 | proto2 | 5102 | 10277 | 5328 | 83% | 598 (4651) | 3718 |
| node | 256 | proto | 5837 | 12594 | 6188 | 83% | – | – |
| node | 256 | current | 2754 | 4799 | 3031 | 100% | – | – |
| chrome | 128 | proto2 | 1374 | 3169 | – | 75% | 156 (2432) | 996 |
| chrome | 128 | proto | 1013 | 4743 | – | 92% | – | – |
| chrome | 128 | current | 715 | 1731 | – | 100% | – | – |
| chrome | 256 | proto2 | 5440 | 9902 | – | 83% | 551 (4379) | 3851 |
| chrome | 256 | proto | 5862 | 12047 | – | 83% | – | – |
| chrome | 256 | current | 2827 | 4699 | – | 100% | – | – |

The product generates in its worker (`worker/generator.worker.ts`), so the page never stalls; what a
player waits for is the first look. One map at a time (the bench, with other agents' jobs still
running):
- **At 128²** version 2 takes 1.4 s in Node and 1.4 s in Chrome at the median (version 1
  1.1 and 1.0 s, the current generator 0.7 and 0.7 s). The first look comes
  at 0.15 s.
- **At 256²** it takes 5.1 s in Node and 5.4 s in Chrome (version 1 5.8 and 5.9
  s, the current generator 2.8 and 2.8 s). The first look comes at 0.6 s.
- When the first attempt fails (a quarter to a third of maps), the kept map's land comes later: at
  worst 2.4 s at 128² and 4.7 s at 256² in the bench. The page shows the first
  attempt's land at once and replaces it with a short notice (PLAN §2.2).
- In the batches (eight maps at once on a loaded machine) the median is 2.2 s and the p90 7.0 s at
  128², and the median 9.0 s at 256² (PLAN's target is 8 s). The slow tail is maps that need many
  attempts: 65 of 1,200 took over 10 s at 128² (the slowest 52 s, 8 attempts), and 12 of 180 over 30 s at
  256² (the slowest 47 s, 5 attempts). The page stays live and shows each attempt's land, but that is a long wait for
  the checked map (§12).

## 8. The natural narrows, Variations and the runs model

**The natural narrows** (`narrows-check.ts`, `narrows-v2.json`) were tried at 96 places: two on the
main river of 8 maps of each theme.
- The spurs fit at 75 places and raised ground at 72.
- The dam-wall check flags none, and no first draw read as a wall.
- The spurs vary in level (a standard deviation of 0.6 of a level) and in thickness along their
  length (a coefficient of variation of 0.46), where the refinement note asks for variation.
- A dam holding a Normal drought's water (380 blocks) got shorter near the place at 10 of 72. At
  most places the valley upstream holds too little for any short dam, before or after: the spurs
  give the shape, and the valley decides the reservoir.

**Variations** (`variations.ts`, `variations-v2.json`) made 30 families of a map and four siblings.
No pair of the 300 is a clone (the closest 0.35 apart, the median 0.58). Every sibling keeps the
map's intentions (120 of 120). Siblings sit as far apart as the theme's maps do, so a variation is a
new map with the same settings and intentions.

**The runs model** (`terrain.ts`, checked by `check.ts`) was tried on 40 maps. The terrain as runs
gives byte for byte the voxels of today's writer, field and base round-trip exactly, and a generated
map's `runs` lists are empty. Format 3's terrain takes 6.5 KB gzipped at 128² and 19.8 KB at 256².

## 9. The landscape bench

### The landscape bench (named/128/60/normalised/16/all, 99 real regions; seeds 1–30 per theme)

| Group (median distance from the real median; lower is closer) | v2 | v1 | current |
| --- | --- | --- | --- |
| network | 0.668 | 0.619 | 0.834 |
| water | 1.668 | 1.135 | 1.146 |
| relief | 0.522 | 0.597 | 0.663 |
| naturalness | 0.848 | 0.818 | 2.983 |
| heightHistogram (total variation) | 0.233 | 0.416 | 0.542 |
| slopeHistogram (total variation) | 0.058 | 0.089 | 0.138 |

| Measure | Real p10 / median / p90 | v2 median (outside the real 80%) | v1 | current |
| --- | --- | --- | --- | --- |
| branching (network) | 0.61 / 7.324 / 10.376 | 8.545 (13.9%) | 7.324 (7.8%) | 6.714 (6.7%) |
| drainageDensity (network) | 0.043 / 0.059 / 0.076 | 0.053 (5%) | 0.054 (5%) | 0.051 (30%) |
| sinuosity (network) | 1.057 / 1.207 / 1.333 | 1.259 (18.3%) | 1.263 (23.9%) | 1.157 (2.2%) |
| junctionAngle (network) | 33.69 / 71.565 / 90 | 90 (46.7%) | 90 (36.1%) | 93.366 (52.8%) |
| segmentLength (network) | 17.314 / 21.485 / 30.243 | 20.485 (19.4%) | 22.799 (16.7%) | 25 (32.8%) |
| splitTileShare (water) | 0.393 / 0.554 / 0.65 | 0.57 (12.2%) | 0.583 (22.8%) | 0.511 (33.9%) |
| rejoinTileShare (water) | 0.37 / 0.529 / 0.636 | 0.561 (13.3%) | 0.577 (23.3%) | 0.514 (30.6%) |
| enclosedIslands (water) | 0 / 0 / 5 | 1 (1.7%) | 0 (0%) | 0 (3.3%) |
| stepLength (relief) | 1 / 1 / 1 | 1 (0%) | 1 (0%) | 1 (3.9%) |
| valleyWidth1 (relief) | 3 / 5 / 7 | 5 (7.2%) | 5 (21.7%) | 5 (5.6%) |
| valleyWidth2 (relief) | 5 / 9 / 12 | 8 (5.6%) | 9 (17.2%) | 5 (43.6%) |
| narrowingRatio (relief) | 0.1 / 0.25 / 0.6 | 0.118 (45.6%) | 0.188 (32.2%) | 0.25 (11.7%) |
| straightShare8 (naturalness) | 0.001 / 0.02 / 0.056 | 0.03 (8.3%) | 0.035 (13.3%) | 0.139 (98.3%) |
| longestRun (naturalness) | 9 / 12 / 16 | 14 (20%) | 14 (23.9%) | 28 (98.3%) |
| ridgeThicknessCV (naturalness) | 0.306 / 0.353 / 0.458 | 0.357 (1.7%) | 0.338 (6.1%) | 0.323 (38.3%) |
| ridgeHeightStd (naturalness) | 0 / 0 / 0.515 | 0.253 (8.3%) | 0 (0.6%) | 0 (0%) |
| basinRimThicknessCV (naturalness) | 0.244 / 0.419 / 0.475 | 0.374 (30.7%) | 0.298 (44.1%) | 0.184 (70.1%) |
| lakeShare (water) | 0 / 0.05 / 0.203 | 0.096 (4.4%) | 0.068 (8.3%) | 0.021 (33.3%) |
| lakes (water) | 0 / 1 / 2 | 2 (43.3%) | 2 (24.4%) | 1 (18.9%) |
| fallCount (water) | 0 / 1 / 4 | 7 (76.7%) | 3 (29.4%) | 3 (25%) |
| fallDrop (water) | 1 / 1.009 / 1.732 | 2.07 (78.8%) | 1.851 (59%) | 1.856 (79.1%) |
| fallSpacing (water) | 2.915 / 15.133 / 73.082 | 10.101 (2.8%) | 10.977 (12.6%) | 14.142 (15.8%) |
| damSites (water) | 0 / 6.1 / 14.04 | 12.21 (40%) | 8.54 (16.7%) | 6.1 (0%) |
| reservoirVolume (water) | 0 / 1264 / 4478 | 2558 (23.9%) | 1809 (13.3%) | 2483 (33.3%) |
| reservoirEfficiency (water) | 0 / 173.3 / 762.7 | 737.5 (50%) | 361 (33.3%) | 501.8 (33.9%) |
| damLength (water) | 2 / 8 / 13 | 5 (3.4%) | 4 (6.7%) | 4 (5.6%) |

Version 2 is the closest of the three to real terrain on relief and on the height and slope
histograms. It keeps version 1's naturalness; the current generator's straight contours put it far
off. It is further on water:
- more falls: a median of 7 a map against the real 1;
- taller falls: 2.1 levels against 1.0;
- more dam sites, and shorter ones.

That is what Timberborn maps and Kyler ask for: real terrain at 60 m a tile is gentle (steps of 2+
levels on 1.2% of edges). Junction angles stay wider than real (90° against 72°), as in version 1:
D8 channels meet square. The bench describes; it never gates (its README).

## 10. Determinism, exactness and parity

- **Exact arithmetic** (D15): the source audit of `v2/`'s output paths finds nothing but + − × ÷,
  square root, floor, round, abs, min and max. The output paths are the genome, field, levels,
  hydrology, settler, hazards, intentions, generate, terrain, narrows and cycle. The new intention
  checks use no trigonometry: bends are measured with dot and cross products.
- **Same seed, same bytes**: 40 of 40 maps give the same bytes twice in one process and again in a fresh process: seeds
  1–3 of every theme at 128², the ten brief maps, and seed 1 of every theme at 96² and 256².
- **Both validators**: every map above is written with its project file and checked in the
  `generate` profile. The Python oracle and the TypeScript validator re-read the files: 0 disagreements in 1,720 checks compared (774, 430 and 516), and both pass all 40 maps.
- **No dam walls** on any of them, and **the runs model** is exact on every one (§8).

## 11. Briefs, renders and sheets

- **Ten briefs** ([briefs/v2/](briefs/v2/), 01–10):
  - six themes at their default Verticality, 01–06. Kyler's four intentions are 01 (a start under a
    cliff with water below), 02 (a snaking river), 03 (a crater gathering two rivers) and 04 (a
    waterfall into a round lake);
  - three at Verticality 85 within 16, 07–09;
  - one with no intention, 10.

  Each brief has its terrain, the "how it plays" card, and the exact model's cycle timeline (the
  worst of weather seeds 1729, 7 and 99). It also has the verified axes and the difficulty positions
  it suits, its intentions (emerged or dropped, each named) and a name from the names study.
- **The maps** ([out/v2/](out/v2/), with a README): each passes both validators in the `generate`
  profile, has no dam wall and comes back byte for byte from its seed.
- **Renders** ([renders/v2/](renders/v2/)): the app's own 3D view in the released clean look, at
  1600×900. One is from the default camera (the game's angle over the whole map) and one from
  above, drawn in the installed Chrome.
- **Contact sheets**:
  - the committed record, [docs/sheets/design-v2.png](../../docs/sheets/design-v2.png): seeds 1–30 of
    every theme at 128², top-down and labelled (276 KB);
  - a local page, `C:\dgm-workshop\generative\v2\sheet.html`, with version 1, version 2 and
    Verticality 85 side by side (not committed).

## 12. What is short, and what would fix it

Plainly, against the targets:
1. **No approximation is over 10% in three themes**: Lake Basin 12.5%, Delta 12.5% and Islands 15%.
   More water moved Lake Basin and Islands toward the workshop's middle. A fix would draw their water
   share and one-level steps further from the workshop's median (more sea, more cliffs round the
   lakes) or put islands in lakes more often. This is information (D128); see #59.
2. **A good natural dam near the start is above the official band** in four themes (64% over all;
   the band is 26–56%): lake outlets are short dams. If Kyler wants it lower, lakes' outlets widen.
3. **Relief is one level short of the workshop's median** (13 against 14) and uses 15 levels against
   16; Canyon uses 9. Taller tops or more equalization would close it, at the cost of more cliffs.
4. **First attempts** are 53.5–76% (version 1: 62.5–90.5%) because the settler asks for more.
   Finals are 100% but for one Canyon seed at Verticality 85; the time cost is in §7.
5. **Two of Kyler's intentions emerge on a quarter or a fifth of their draws** (the crater 24%, the
   waterfall into a round lake 19.5%). The waterfall's maps also cluster on the forced set (23% of
   30). Three others emerge on a quarter or less, and one left the set.
6. **Above 16 was not built** here: the product's build clips at 16, so the unlocked maps were
   measured before the build. M9a lifts the cap for Verticality 70+ once the probe batch passes.
7. **A slow tail**: maps needing five or more attempts take far longer (§7). A fix would be a time
   budget in M9a (after about 3 s, draw a new genome rather than plan again, and run candidates in
   parallel workers), plus the simulation speedups (D130).
8. **The cheap cycle signature's badwater proxy is weak** (r = 0.43 with the exact exposure), so the
   exact model keeps that part.
9. **The drought-aware preference is weak** (42% against 38.5% with it off); requiring it costs
   finals in Canyon (#54).
10. **Not built**:
    - player and Claude controls for intentions (they wait, D138);
    - tuning how close Variations stay;
    - difficulty positions as a candidate preference (M9b);
    - the Weather view (its own step);
    - the fourteen candidate intentions (for Kyler to pick, #61).

## 13. Reproducing it

Local data goes to `C:\dgm-workshop\generative\` (`DGM_GENERATIVE` moves it).

```sh
npx tsx investigation/generative/v2/batch.ts --set v2-128 --seeds 1-200 --jobs 8
npx tsx investigation/generative/v2/batch.ts --set v2-128-vt85 --vt 85 --seeds 1-100 --jobs 8
npx tsx investigation/generative/v2/unlocked.ts --seeds 1-100
npx tsx investigation/generative/v2/batch.ts --set v2-128-i-snaking --intentions snaking-river --seeds 1-30 --jobs 8 --no-files   # and -i-crater, -i-cliff
npx tsx investigation/generative/v2/batch.ts --set v2-128-v100 --variety 100 --seeds 1-100 --jobs 8
npx tsx investigation/generative/v2/batch.ts --set v2-128-dreq --drought require --seeds 1-100 --jobs 8 --no-files
npx tsx investigation/generative/v2/batch.ts --set v2-128-doff --drought off --seeds 1-100 --jobs 8 --no-files
npx tsx investigation/generative/v2/batch.ts --set v2-96 --size 96 --seeds 1-30 --jobs 6    # and v2-192, v2-256
npx tsx investigation/generative/v2/batch.ts --set v1-128 --gen proto --seeds 1-200 --jobs 8
npx tsx investigation/generative/v2/batch.ts --set cur-128 --gen current --seeds 1-200 --jobs 8
npx tsx investigation/generative/sidecars.ts --dir v2-128          # openings and dam walls, per set
npx tsx investigation/generative/v2/refs.ts
npx tsx investigation/generative/v2/measures.ts --fresh --sets v2-128,v1-128,cur-128,v2-128-vt85,v2-128-v100,v2-128-i-snaking,v2-128-i-crater,v2-128-i-cliff
npx tsx investigation/generative/v2/measures.ts --sets v2-96,v2-192,v2-256,v2-128-dreq,v2-128-doff --light v2-96,v2-192,v2-256,v2-128-dreq,v2-128-doff
npx tsx investigation/generative/v2/simplay.ts --gen proto2 --seeds 1-15 --jobs 4
npx tsx investigation/generative/v2/simplay.ts --gen proto --seeds 1-15 --jobs 4
npx tsx investigation/generative/v2/simplay.ts --summary
npx tsx investigation/generative/v2/landscapes.ts --seeds 1-30
npx tsx investigation/generative/v2/narrows-check.ts --maps 8
npx tsx investigation/generative/v2/variations.ts --seeds 1-5
npx tsx investigation/generative/v2/bench.ts --sizes 128,256 --seeds 1-2
npx tsx investigation/generative/v2/export.ts
npx tsx investigation/generative/v2/render.ts
npx tsx investigation/generative/v2/sheet.ts
npx tsx investigation/generative/v2/check.ts --seeds 1-3 --sizes 128
npx tsx investigation/generative/v2/check.ts --maps <the ten brief maps> --sizes 128
```
