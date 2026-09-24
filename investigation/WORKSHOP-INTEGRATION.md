# Workshop study: integration plan

How the milestone run builds the workshop study into Dam Good Maps. It follows the roadmap's order:
M7 (running) → the start-rules change at the start of M8 → M8 → Map look → M9 → M10 → M11 →
refinement → design pass → M12 → M13 → Later. The findings are in [WORKSHOP.md](WORKSHOP.md), the numbers
in [workshop.json](workshop.json), and the tools, recipes and parameters in [workshop/](workshop/).
Nothing in `src/` or `tests/` changed on this branch: every change below is for the milestone run to
make.

## Kyler's direction (2026-09-24)

Said during the study; each change below serves at least one.

1. "Workshop maps are FUN because they diverge sharply."
2. "Variety and novelty are important qualities." "I don't want similar looking clones, high entropy
   in the maps generated is a desirable setting."
3. "Verticality is a desirable attribute as well. It presents the opportunity for unique challenges."
4. Reservoirs are not spoon-fed: "the natural terrain of the game should not make reservoir placement
   incredibly obvious, it is up to the user to build and manipulate the terrain to make those
   reservoirs possible."
5. "A water source that is accessible is still a requirement."

What the study measured against these (details in WORKSHOP.md):

| | Workshop | Official | Generator today (128², defaults) |
|---|---|---|---|
| Variety across maps (variety score, workshop = 1.04) | 1.04 | 0.91 | all six themes 0.58; one theme 0.16–0.38 |
| Rivers flowing west to east (of maps whose water leaves the map) | 10% | 0% | 74% |
| Height range, median (levels) | 14 | 13 | 10 |
| Tallest waterfall drop, median | 6.1 | 4.9 | 2.4 |
| Steps in straight runs of 8+ tiles (naturalness) | 3.1% | 6.6% | 13.8% (Canyon 37%) |
| A straight dam of 5 tiles or fewer near the start holds a Normal drought's water | 46% | 36% | 77–100% in the valley themes |

## 1. The changes at a glance

| # | Change | Milestone | Uses from this branch | Depends on | Main risk |
|---|---|---|---|---|---|
| 1 | Calibrate the new start rules (water at the start's level without slopes; living trees and bushes within 20 tiles' walk) | start of M8 | `workshop.json` start numbers; `lib/measures.ts` `startStats` | the start-rules change | thresholds the generator's bench fails (see §3) |
| 2 | Imports with special water (caves, delayed sources, aquifers, seeps) report their water checks as approximate | M8 | `lib/measures.ts` mechanics flags | background validation | a flag that hides a real problem |
| 3 | Naturalness as the yardstick for the generated terrain's look | Map look | `lib/naturalness.ts`, targets in §3 | — | tuning noise into terrain that should stay readable |
| 4 | New premises, at least 3 per built theme, from the proven recipes | M9 | `workshop/recipes/*` | the builders of #11 for three of them | premises that pass alone but crowd each other |
| 5 | Rivers in 8 directions (D67) | M9 | the north–south recipe | a layout frame for the valley planners | set-piece plans that assume west to east |
| 6 | A Variety setting (`vy`), "Surprise me", and a variety target with a no-clones rule | M9 | `lib/variety.ts`, `variety-scale.json` | #4, #5 | variety bought with broken maps (the batch gate stops it) |
| 7 | Reservoir help (`rh`): reservoirs become the player's engineering | M9 | `obviousness.ts` | decision W1 | droughts too hard on Normal |
| 8 | The interestingness score, with its default target and Kyler's fit when present | M9 | `lib/score.ts`, `score-params.json`, `score-fitted.json` | score inputs in core | a score that rewards the wrong thing (the criterion guards it) |
| 9 | Names and descriptions from the catalogue's vocabulary | M9 | `workshop.json` `catalogue` | #4 | names that promise what the map lacks |
| 10 | Settings bands widened | M9 | `workshop/settings-bands.json` | — | larger bands fail more batches |
| 11 | New builders: spiral, cone, mesa field (M9); river fork, multi-outlet lake, switchback river (M11); dam-site spurs (refinement) | M9, M11, refinement | recipes as reference implementations | D47's builder shape | each builder's own checks |
| 12 | Built-in stamps from the catalogue | M11 | recipes | #11 | stamps that only work on River Valley ground |
| 13 | Natural containment | refinement | the spur-narrows prototype, targets | W1 | reservoirs that stop holding |
| 14 | The catalogue as Claude's vocabulary | M12 | `workshop.json` `catalogue` | #11, #12 | requests the builders cannot honour |
| 15 | Ratings: fun and unique | M13 | `fit-score.ts` | — | few ratings |
| 16 | Later: caves, overhangs, tunnels, terrain 17–22, flood challenges | Later | numbers in §3 | water under roofs | — |

## 2. Decisions this plan needs

Where the plan changes something PLAN §20 already decided, it is proposed here as a pending decision
with a default, in the shape of `docs/decisions-pending.md`. The milestone session copies these rows
into that file when it adopts the plan, numbered after its own.

| # | Milestone | Question | Default | Why | Conflicts with |
|---|---|---|---|---|---|
| W1 | M9 | Should the map hand the player a reservoir? Today every generated map has a dam site near the start (a ridge with a 3–5 tile gap) and `water.reservoir` requires it. | No, by default. A new setting, Reservoir help (`rh`): **None** (default on Normal and Hard), **Some** (default on Easy), **Ready** (today's dam site). Accessible clean water stays a hard rule (`start.water`). Drought reserve keeps meaning how much storage the map must make possible, not how much it hands over. `water.reservoir` becomes `water.storage_possible` (below). | Kyler's direction 4 and 5. Measured: a dam of 5 tiles or fewer within 40 tiles holds a Normal drought's water on 46% of workshop maps and 36% of official maps, against 77% (River Valley), 97% (Delta) and 100% (Canyon) today. A dam of any length within 20 tiles holds it on 16% of workshop maps, against 60% of River Valley maps. | D25, D30, D58; PLAN §5.3 (Drought reserve), §8 (every River Valley premise lists a dam site), §9.1, §11.3 `water.reservoir`, §12 (dam value) |
| W2 | M9 | How varied should maps be by default? | A Variety setting (`vy`, 0–100), default **70** ("Varied"); 0 gives each theme's classic premise with its default settings, 100 draws from every premise and landmark with wide bands. "Surprise me" picks a theme at Variety 100. | Kyler's direction 1 and 2. One theme's 30 seeds reach 15–36% of the workshop's variety today. | PLAN §7.1 (one premise rolled per theme); none in §20 |
| W3 | M9 | `water.no_flood` caps the water share at 0.35 (0.55 for Islands and Lake Basin). Keep it? | The cap follows the premise: 0.35 by default, up to 0.70 for water premises (moat, archipelago, lone island, lake world), which declare their water budget. | Workshop water share: median 0.27, p90 0.67 on the 81 maps our settle can show; 28% of them are above 0.35, 9% above 0.70. | PLAN §6, §11.3 |
| W4 | start of M8 | Badwater distance defaults: Easy 40, Normal 30, Hard 15. | Easy 30, Normal 15, Hard 8. | Official maps: nearest badwater to the start median 14.8, p25 10. Generated: 36 (every map keeps 30 plus the basin's 14-tile margin). Badwater close by is a challenge, not a flaw. | PLAN §5.4, §5.6; D62 places basins from this setting |
| W5 | M9 | PLAN §12's score rewards a big reservoir behind a short dam (dam value, weight 0.20). | Replaced by `engineering` (full marks when storage takes real work), with `vertical`, `surprise` (novelty), `natural` and `water` added. Weights in `score-params.json`, refit from Kyler's ratings when present. | Directions 2–4. With the default parameters the recommended official maps rank 3rd, 6th and 7th of 19 (M9's criterion holds). | PLAN §12 |
| W6 | M8 | Imports whose water our steady state cannot show (5 of 19 official maps: Hollows, Pressure, Oasis, Nomads, Beaverome). | Their water and start checks report "approximate" (not fail) when the map has caves on 5%+ of tiles, delayed sources, aquifers or seeps carrying much of its clean water, or a start under a roof. | The canonical settle floods their starts (Hollows 9 deep, Nomads 7, Oasis 2.8) because it runs every running source to steady state and pre-fills whole basins; in the game, tunnels, timed sources and drills change that. The other 14 match their stored water closely (median difference 0.1% of the map). | D28, D43; pending #3 and #9 |
| W7 | M9 | Relief, terracing and flatness defaults. | River Valley relief 50 → 70; terracing defaults 25–35; a Rugged level below Tight (flat share 0.30); Smooth terracing reaches 0.92 one-level steps. | Generated maps are flatter (flat share 0.69) and lower (height range 10) than official (0.52, 13) and workshop maps (0.44, 14); workshop steps are gentler (81% one-level). | D59; pending #21 |
| W8 | Later | Terrain above 16. | Keep D4. | 19 of 130 workshop maps go above 16 (none of the official maps); the in-game editor stops at 16. Listed under Later with its numbers. | D4 (no change) |

`water.storage_possible` (W1), for the `generate` profile, in both validators:
- clean running water reaches within the start's water rule (as `start.water`), with enough flow to
  fill the colony's drought need in 2 game days (flow ≥ need ÷ (2 × 460) blocks/s);
- by Reservoir help: **Ready**, a straight dam of at most 5 tiles within 20 tiles of the start holds
  the need × the drought reserve (today's rule, tightened); **Some**, no such dam within 20 tiles, and
  one of 6–12 tiles within 40 holds it; **None**, no straight dam of 12 tiles or fewer within 40 tiles
  holds it, and the need can be held by levees on ground the colony reaches (a flood fill of the start's
  water at crest + 1 stays within 60 tiles, off the map edge, and needs a levee line of at most
  0.25 × its perimeter). The dam sampling is today's (`analysis/damsites.ts`); `obviousness.ts` measures
  the same quantities.

## 3. Milestone by milestone

### M7 (running)

No change inside M7: it is running its acceptance batches as this plan is written. Adopt this plan at
its boundary.

### The start-rules change (start of M8)

The new rules count water at the start's own level without slopes, and living trees and living
bushes within 20 tiles' walk. `lib/measures.ts` measures exactly these (walking distance: moves on one
level, diagonals when both neighbours are level, slopes as links; trees and bushes on or beside that
land). Starts were measured where they can be (dry after the settle, on the top surface, water our
settle can show): 11 official, 67 workshop, 180 generated maps.

| Quantity at the start | Official p10 / median / p90 | Workshop | Generated (128²) |
|---|---|---|---|
| Pumpable clean water, straight distance | 5.4 / 13 / 20.4 | 5.4 / 15.5 / 44.1 | 5.2 / 7.1 / 9.1 |
| Water at the start's level, no slopes, walking distance | 5.4 / 13 / 20.4 (none on 2 of 11) | 3.4 / 10.9 / 28.1 (none on 33 of 67) | 5.2 / 7 / 10 (none on 82 of 180) |
| Land at the start's level (no slopes), tiles | 484 / 980 / 1,701 | 92 / 643 / 3,523 | 113 / 113 / 1,742 |
| Living trees within 20 tiles' walk | 4 / 112 / 144 | 0 / 46 / 128 | 23 / 67 / 134 |
| Living bushes within 20 tiles' walk | 23 / 57 / 79 | 0 / 44 / 128 | 14 / 46 / 56 |
| Trees within 20, straight, dead included (today's rule) | 88 / 144 / 172 | 39 / 128 / 233 | 94 / 147 / 229 |

Proposed thresholds (validation minimums near the official p25; generation targets stay higher):

| Rule | Easy | Normal | Hard |
|---|---|---|---|
| Clean pumpable water at the start's level, no slopes, walking distance | 12 | 20 | 28 |
| Living trees within 20 tiles' walk | 60 | 20 | 10 |
| Living bushes within 20 tiles' walk | 40 | 25 | 15 |

The generator's bench is an island: on 82 of 180 maps the start's own level holds no water, because
the bench stands one level above the floodplain and 6–10 tiles from the channel (D26), and its level
region is the bench alone (113 tiles). Official starts stand on large level land (median 980 tiles)
that reaches the water. The start-rules change needs the bench to run to the bank, or the start to
stand on the floodplain; Reservoir help (W1) then decides whether that bank is also a ready dam site.

Text for PLAN §5.6 (start and difficulty table), replacing the three rows it changes:

> | Clean pumpable water at the start's level, without slopes (walking) | 12 | 20 | 28 | Official median 13, p90 20.4 (workshop study). The water's surface is 0–2 levels below the start and borders the land the colony walks to from the start without slopes. |
> | Living trees within 20 tiles' walk | 60 | 20 | 10 | Official p25 16, median 112 (workshop study). |
> | Living bushes within 20 tiles' walk | 40 | 25 | 15 | Official p10 23, median 57 (workshop study). |

and the badwater row per W4: `| No badwater within | 30 | 15 | 8 | Official median 14.8, p25 10 (workshop study). |`

Acceptance to add: *the official maps whose starts can be measured pass the Normal start rules at
the official p25 or better (at least 8 of 11); batches per theme ≥ 98% final with the new rules.*

Risk: the batches drop until the bench reaches the water. Data: `workshop.json` `overall.start*`.

### M8. Water preview and background validation

Add to **Delivers**:

> - Maps whose water a steady state cannot show are recognised on import (`analysis/mechanics.ts`):
>   caves on 5% or more of tiles, delayed sources, aquifers or seeps carrying a quarter or more of the
>   clean water (seeps half of the running water), or a start under a roof. Their water and start checks
>   report "approximate" with the reason, in both validators, and the preview shows the file's water
>   there (the roofed-water rule already does this for caves).

Add to **Acceptance**:

> - Hollows, Pressure, Oasis, Nomads and Beaverome report their water checks as approximate with a
>   reason; the other 14 official maps are unchanged.

Decision W6. Uses: the rule as written in `investigation/workshop/lib/measures.ts` (`mechanics`) and
`lib/table.ts` (`waterReliable`). Risk: a map flagged approximate hides a real flood; the reason is
shown, and the import's own problems never block (D43).

### Map look (after M8)

If Map look covers how generated terrain looks, it takes the naturalness metric as its yardstick
(`lib/naturalness.ts`), measured on seeds 1–30 per theme at 128²:

| Measure | Official median | Workshop median | Generated today | Target |
|---|---|---|---|---|
| Steps in straight runs of 8+ | 0.066 | 0.031 | 0.138 (Canyon 0.373, Delta 0.134, Lake Basin 0.151) | ≤ 0.066 in every theme |
| Longest straight step run | 18 | 17 | 27 (Delta 33.5) | ≤ 25 (official p90) |
| Shoreline in straight runs of 8+ | 0.123 | 0.064 | 0.224 (Canyon 0.462) | ≤ 0.12 |
| Ridge crest height variation (std, levels) | 0 (p90 0.46) | 0.40 | 0 in every theme | ≥ 0.25 |

The containment part (dam narrows, basin rims) stays in the refinement phase, below.

### M9. Interestingness, names, candidates

M9 grows from "the score" to "maps that diverge". Add to **Delivers**:

> - **Premises.** At least three per built theme, drawn from the workshop study's recipes
>   (investigation/workshop/recipes/) and the catalogue, each a planner variant that lays its landmark
>   out first and the rest around it:
>
>   | Theme | Premises (existing in bold) |
>   |---|---|
>   | River Valley | **Gorge-dammed basin**; Island in a moat; Oxbow bend; Twin falls; Spiral mountain or quarry |
>   | Canyon | **Narrows**; Rim settlement (§8); Hanging lake on a mesa; Mesa field |
>   | Highlands | Staircase (§8); Twin plateaus (§8); Badwater volcano; Spiral mountain |
>   | Lake Basin | **Rising lake**; Crater lakes (§8); Caldera with an island; Heart lake (rare) |
>   | Delta | Many mouths (§8); Salt marsh (§8); Oxbow delta |
>   | Islands | Archipelago (§8); Atoll (§8); Volcano island; Heart islands (rare) |
>
>   Rare premises (marked) are drawn only at Variety 60 and above.
> - **River directions.** The valley themes (River Valley, Canyon, Highlands, Delta) and Lake Basin's
>   outlet draw their flow axis from 8 directions (§7.1). The planners lay out in a west-to-east frame
>   and the feature list is turned by one of the 8 symmetries of the square (paths, outlines, set-piece
>   plans and orientations), or plans natively; the north–south recipe builds a valley, its dam site and
>   its falls along a north–south river with today's builders.
> - **Variety** (`vy`, 0–100, default 70; decision W2) and "Surprise me". Variety sets: how the
>   premise is drawn (0: the theme's first; higher: all of the theme's, then the rare ones at 60+, then
>   one catalogue landmark from another theme's list at 85+); how far the settings' targets wander
>   within the workshop's p10–p90 bands (settings-bands.json), as a share of Variety; and the flow
>   axis (always drawn at 30+). "Surprise me" draws a theme and sets Variety to 100; the share link
>   carries the resolved spec, so the map reproduces.
> - **No clones.** The K candidates (§7.9) are ranked by score, and among those within 5 points of the
>   best the one farthest (variety score, `variety-scale.json`) from the theme's reference maps wins.
>   The reference maps are seeds 1–30 of the theme at default settings, stored as 16×16 signatures and
>   feature vectors (about 4 KB per theme).
> - **Reservoir help** (`rh`: none / some / ready; decision W1) and `water.storage_possible`, which
>   replaces `water.reservoir` in both validators.
> - **The score** (`score/score.ts`), ported from `investigation/workshop/lib/score.ts`: 12 components
>   (engineering, height variety, landmarks, river character, resource pacing, regions, trade-off,
>   frontier, surprise, verticality, naturalness, water), each 0–1. Parameters come from
>   `data/score-params.json`, a copy of `investigation/workshop/score-fitted.json` when it exists, else
>   of `score-params.json` (decision W5). The inputs the score needs from a built map (plateaus,
>   gorges, the main watercourse through the settled water, resource rings, regions, trade-off,
>   frontier, dam sites near the start) move into `analysis/` from `lib/measures.ts` `scoreInputs`.
> - **Names and descriptions** use the catalogue's vocabulary (below).
> - **Settings bands** from `investigation/workshop/settings-bands.json` (§4 below).

Add to **Acceptance**:

> - Each premise passes a batch of 100 seeds at 96², 128², 192² and 256² at ≥ 98% final (first
>   attempt ≥ 60%), in the `generate` profile.
> - Every built theme has at least 3 premises.
> - In 100 seeds of each valley theme, all 8 flow directions appear and none exceeds 25%.
> - Variety (investigation/workshop/lib/variety.ts, scale in variety-scale.json), seeds 1–30 at 128²,
>   default settings: each theme's set variety ≥ 0.60 of the workshop's (today 0.15–0.36); all themes
>   together ≥ 0.90 (today 0.56); at Variety 100 each theme ≥ 0.80. No two seeds of a theme are closer
>   than the workshop maps' p10 distance to their nearest peer.
> - The score: the recommended official maps land in the top third (it holds with the default
>   parameters: 3rd, 6th, 7th of 19); the generated median at default settings reaches the official
>   median (today 40 against 52).
> - Reservoir help: the obviousness measure (`investigation/workshop/obviousness.ts`) matches each
>   level on ≥ 98% of maps; Normal with Reservoir help None passes its batches at ≥ 98%.
> - Names and premises match the features on 30 hand-checked maps, 10 of them at Variety 100.

Names and descriptions: the catalogue's plain words for what a map has, keyed by the detected
feature or the premise (§13's templates grow with these): *island in a moat*, *crater lake*, *caldera*,
*spiral mountain*, *spiral quarry*, *volcano*, *hanging lake*, *mesa field*, *twin falls*,
*oxbow lake*, *chain of lakes*, *great scarp*, *hub of channels*, *archipelago*, *branching rifts*,
*concentric rings*. Examples: "Moat Isle", "Caldera Rest", "Spiral Quarry", "Twin Falls", "Mesa
Reach". Descriptions add a trade-off clause when Reservoir help is None: "No ready reservoir:
the river is yours to tame."

Depends on: builders #11 for the spiral, the volcano's cone and the mesa field (the recipes build them
from landforms today, laboriously); the layout frame for directions. Risk: variety bought with broken
maps; the per-premise batch gate is the guard.

### New builders (M9, M11, refinement)

Each in D47's shape: `request` (hard bounds), `limits(ctx)`, `plan`, `check`, `rasterize`,
`footprint`, and `slopes`, `clears`, `area` where it has them. The recipes are reference
implementations built from today's operations.

| Builder | Milestone | Request | Limits | Checks | Acceptance |
|---|---|---|---|---|---|
| `spiral` (landform kind or set piece) | M9 | at, radius 8–48, turns 0.75–3, levels 3–12, direction up / down, ramp width 3–12 | levels ≤ 16 − ground (up) or ground − 1 (down); radius ≤ 40% of the shorter side | a slope at every step (`slopes.connect`); terrain 0–16 | 100 plans on 96², 128², 256²: every step walkable from the foot of the ramp |
| `cone` (landform edge style) | M9 | outline, height, crater radius and depth, spill direction | height ≤ 16; crater depth ≤ height − 2 | a crater with water has an outlet (`water.outflow`) | the volcano premises pass their batches |
| `mesaField` (set piece) | M9 | at, radius 10–40, count 3–15, rise 2–6, ruins on 0–3 tops | mesas 2+ tiles apart; tops of 12+ tiles for ruins | the payoff needs one player stair (§9.4's rule) | as obstaclePayoff's range tests |
| `damSite` spurs mode | refinement | river, at, crest 1–3, gap 3–12, help ready / some | gap ≥ channel + 2 | the reservoir holds need × reserve behind a dam of `gap` tiles (ready) or 6–12 (some); naturalness targets below | River Valley, Canyon, Highlands batches ≥ 98% with it |
| `riverFork` | M11 | river, from, to (arc), island width 6–40 | arms 2+ tiles apart; both arms ≥ 3 wide | both arms carry ≥ 30% of the flow; the island stays dry | property test: 100 forks on random rivers settle and keep both arms wet |
| lake `outlets` (2–4) | M11 | lake, outlets [{at, to}] | outlets 8+ tiles apart, all at the sill | every outlet carries water; no outlet drains back into the lake | 50 hub lakes settle with every spoke wet |
| river `switchback` | M11 | a river path with hairpins | a wall ≥ 3 tiles thick and ≥ 2 levels above the lower reach between reaches | reaches at different levels do not leak into each other | the property test of D53 with hairpins allowed |
| sealed `sea` (Islands variant) | M9 | the sea's outline to the map edge | the edge sealed by a rim or sources along it | `water.outflow`, `water.settles`; water share ≤ the premise's budget (W3) | the Lone island premise passes its batches |

### M10. Sculpting, naturalize, symmetry

Add to **Acceptance**:

> - The naturalize brush, on a generated map's terrain, brings the steps in straight runs of 8+ at or
>   below the official median (0.066) and ridge crest variation to 0.25 or more
>   (investigation/workshop/lib/naturalness.ts), without breaking `slopes.connect` or a set piece's
>   protected tiles.

Symmetry serves the catalogue's symmetric layouts (6 workshop maps).

### M11. Stamps, heightmap import, regenerate area, locks

Add to **Delivers**:

> - The built-in stamp library, from the workshop catalogue's best patterns: island in a moat, crater
>   lake with an island, spiral mountain and spiral quarry, heart-shaped lake (and other outlines: star,
>   crescent), badwater volcano, hanging lake on a mesa, mesa field, twin waterfalls, oxbow lake, and
>   dam narrows between two spurs; plus EDITOR_PLAN §5's waterfall basin, gorge dam site, terraced cliff,
>   ruin district and island lake. Each stamp is a feature group (landforms, lakes, set pieces,
>   resources) with its own slopes; the recipes in investigation/workshop/recipes/ are their reference.
> - The water builders `riverFork`, lake `outlets` and river `switchback` (builder table above).

Add to **Acceptance**:

> - Each built-in stamp, placed rotated and mirrored at 20 random free spots on 96², 128² and 256² maps
>   of every theme, passes the load checks every time and leaves the map passing the `generate`
>   profile at ≥ 90%.

Heightmap import also serves the catalogue's real-geography maps (4 workshop maps).

### Refinement: natural containment

The refinement note asks containment (dam narrows, basin rims, lake shores, ditches) to look natural.
Targets, from the official and workshop maps (`workshop.json` `overall`):

| Measure | Official median | Workshop median | Generated today | Target |
|---|---|---|---|---|
| Ridge thickness variation along a ridge (CV) | 0.30 | 0.36 | 0.32 | ≥ 0.30 |
| Ridge crest height variation (std, levels) | 0 (p90 0.46) | 0.40 | 0 | ≥ 0.25 |
| Basin rim thickness variation (CV) | 0.25 | 0.31 | 0.18 | ≥ 0.25 |
| Dam-site reservoir rim thickness variation (CV) | 0.38 | 0.37 | 0.34 | ≥ 0.35 |
| Narrows shoulders: thickness variation (CV) | 0.45 | 0.43 | 0.42 | ≥ 0.40 |
| Narrows shoulders: height variation (std) | 0.31 | 0.22 | 0 (River Valley, Highlands, Delta) | ≥ 0.2 |
| Shoreline in straight runs of 8+ | 0.12 | 0.06 | 0.22 | ≤ 0.12 |
| Water in 1–2-tile ditches (share of water) | 0.021 | 0.053 | 0.009 | report only |

<!-- NARROWS -->

### Design pass

The panel gains Variety and Reservoir help, and a "Surprise me" button beside Generate; the map card
names the premise and its landmark. Copy uses the catalogue's words (M9's list).

### M12. Claude integration

The catalogue is Claude's vocabulary: each pattern a player might ask for maps to a builder, a stamp or
a feature. Add to the Claude request suite (EDITOR §9):

> - "Add a spiral mountain in the north" → `spiral` up; "dig a spiral quarry" → `spiral` down.
> - "Put an island in a moat near the east edge" → a lake with an island (stamp).
> - "Make the lake heart-shaped" → the lake's outline replaced, its level kept.
> - "Add a volcano that spills badwater, far from the start" → `cone` with a crater and a badwater
>   basin; the badwater distance rule decides "far".
> - "Twin waterfalls on the south cliffs" → two standalone falls, the same facing, side by side.
> - "A hanging lake on a mesa that pours into the river" → a mesa landform, a lake on it, its outlet
>   routed down.
> - "A field of mesas with ruins on top" → `mesaField` with ruins on 2 tops.
> - "Split the river round a big island" → `riverFork`.
> - "Make the dam site less obvious" → the dam site's spurs mode with help `some`, or removed with
>   Reservoir help None.
> - "Make this map more surprising" → a `specPatch` raising Variety, with the premise drawn again.

Acceptance: each request passes the suite on 96², 128² and 256² maps (intent checks measure the
landmark: its extent, levels, the slopes joining a spiral's steps, the fork's two wet arms).

### M13. Usability, ratings, versioned deploys

The rating form asks two questions, as the study's rating page does: fun (1–5) and unique (1–5), with
an optional note. `tools/ratings.ts` writes them in the shape `fit-score.ts` reads
(`{ratings: {<key>: {fun, unique, note}}}`), so the same fit refits the score's target and weights from
players' ratings.

### Later

- **Caves, overhangs and tunnels.** Within the 1.0+ workshop maps (35): some cave or overhang columns
  on 29 (83%), 5% or more of the map on 13 (37%), NaturalOverhang objects on 31 (89%). Official: some
  on 15 of 19, 5%+ on 2. Across all workshop maps, 46 of 130 are built around caves (cave starts,
  tunnels, underground rivers, sky islands). They would add cave starts, hidden water, tunnels through
  ridges and true floating islands; they need water under roofs and voxel tools first.
- **Terrain 17–22.** 19 of 130 workshop maps (7 of 35 1.0+ maps) reach above 16; no official map does.
- **Flood challenges.** 4 workshop maps start flooded or in a badwater sea; they need a challenge
  profile that relaxes `start.dry` and `water.no_flood` with a warning.
- **1.0 objects are common in the workshop.** Within 1.0+ maps: relics 91%, geothermal 86%, plugs 94%,
  thorns 74%, seeps 74%, weirs 69%, aquifers 66%, unstable cores 63%, badtide drains 60% (official:
  47%, 37%, 79%, 42%, 42%, 32%, 11%, 16%, 37%). Seeps, aquifers and badtide drains are on the Later
  list today.

## 4. Settings: the bands to widen

Data ready for the calibration table: `investigation/workshop/settings-bands.json`. New `DENSITY`
rows (arrays are small, medium, large, max, as `SIZE_ANCHORS`):

| Row | Values | Use |
|---|---|---|
| `workshop_trees_per_10k` | see file | the top of Forest density (300% = about the workshop p90) |
| `workshop_bushes_per_10k` | see file | the top of Berry bushes elsewhere |
| `workshop_water_strength_per_10k` | 8.8, 4.9, 3.5, 3.2 | River flow's Lush reaches it |
| `waterfalls_per_map_workshop` | 5, 6, 7, 9.5 | Many and Cascading |
| `springs_per_map_workshop` | 2, 3, 4, 8 | the new Springs setting |
| `lakes_per_map_workshop` | 2, 3, 5, 10 | Lakes and basins at Many |

Setting changes (each with its evidence in the file):

| Setting (PLAN §5) | Today | Proposed |
|---|---|---|
| Terracing | one-level share 0.86–0.27 | 0.92–0.27; theme defaults 25–35 (W7) |
| Buildable land | Tight, Normal, Generous | add Rugged: flat share 0.30, walkable land 500 (W7) |
| Relief | River Valley 50 | 70, and similar +15–20 elsewhere (W7) |
| Springs (new, `sg`) | — | None / Few (1–3) / Many (4–10) inland springs feeding streams |
| Waterfalls | Off, Few 1–2, Many 3–6 | Many 3–10; Cascading (new code `c`) 10–20; typical drop 3–7 |
| Target water share, `water.no_flood` | cap 0.35 (0.55) | the premise's budget, up to 0.70 (W3) |
| Forest density | 50–200% | 50–300% |
| Berry bushes elsewhere | 50–300% | 50–500%, default 150% |
| Badwater distance | 40 / 30 / 15 | 30 / 15 / 8 (W4) |
| Variety (new, `vy`) | — | 0–100, default 70 (W2) |
| Reservoir help (new, `rh`) | — | none / some / ready (W1) |
| Flow direction (new, advanced, `fx`) | — | any (default) or one of 8 |

## 5. Recipes: what they proved

<!-- RECIPES -->

## 6. Kyler's ratings

`investigation/workshop/fit-score.ts` reads `C:\dgm-workshop\ratings.json` (the local rating page's
file) and writes `investigation/workshop/score-fitted.json`: the fitted targets and weights, never a
map's own rating. Until the file exists, the default target in `score-params.json` stands. **M9 uses
`score-fitted.json` whenever it is present, and re-runs the fit whenever the ratings file changes**
(the fit takes seconds; commit the new `score-fitted.json` with the change that uses it).

## 7. Message for the milestone session

<!-- MESSAGE -->
