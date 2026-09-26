# Resources like the official maps

**Built** on branch `feature/resources`, from Kyler's four decisions of 2026-09-25 (metal on every
map; tree counts roughly like the official maps; resources in clusters; ruins that look and vary like
the official maps). The orchestrator records the decisions in PLAN §20. Generated maps change:
generator **0.7.0**, and old share links open with the note that the map may differ.

## The official baselines

`tools/official-baselines.ts` measures the official maps (read from the local
`investigation/raw/builtin`) with `src/core/resources/measure.ts` and writes the aggregates only to
[investigation/official-baselines.json](../../investigation/official-baselines.json).

- **Left out:** Nomads and Oasis (Kyler: exceptional maps; a nomad map with cores, few bushes and
  scattered small groves, and a desert map around aquifers with half its bushes stored dead). For
  each rate, a map is also left out when it is a clear outlier against the size trend (Tukey's
  fences on its log ratio): **Beaverome's trees** (0.59× the trend) and **Lakes' bushes** (2.54×).
  The game marks five more maps unconventional (Beaverome, Diorama, Pillars, Pressure, Spillage);
  they stay in, because on these measures they sit within the official spread, apart from the two
  outliers above. 17 of the 19 maps are kept.
- **By size:** the size-class medians (small up to about 100², medium 128², large 192² and 256×150,
  max 256²), joined in ln(area) as the calibration table always has. There are only two or three
  small and medium maps, so the spread among maps of one size is measured on the large and max
  maps (five or six each): each map's rate ÷ its class median, pooled. A size's **typical range** is
  its median × the 25th and 75th percentile factors.

| | small | medium | large | max | typical range (×median) |
|---|---|---|---|---|---|
| Trees per 10k tiles | 1,715 | 1,061 | 544 | 559 | 0.92–1.17 |
| Berry bushes per 10k tiles | 265 | 92 | 40 | 44 | 0.98–1.07 |
| Scrap per 1k tiles (15 a storey) | 840 | 705 | 236 | 235 | 0.75–1.41 |
| Ruin columns per 1k tiles | 16.4 | 14.6 | 5.9 | 5.3 | 0.66–1.18 |
| Groves per map | 8 | 28 | 35 | 66 | 0.88–1.11 |
| Berry patches per map | 2 | 4 | 3 | 6 | 0.79–1.19 |
| Ruin fields per map | 2.5 | 6 | 4.5 | 7.5 | 0.88–1.33 |
| Columns per field | 19 | 32 | 39 | 42 | |
| Mine sites per map | 1 | 2 (2–3) | 3 (2–4) | 3.5 (3–4) | |

- **Trees:** a third alive (per map 25th–75th 0.27–0.43); 70% of pines, 76% of birches and 74% of
  oaks are stored dead, succulents never. Species: pine 47%, birch 27%, oak 21%, succulent 6%.
  Living trees cover 16% of the moist land (0.13–0.19), dead ones 6% of the dry land.
- **Groves** (trees within 2 tiles of each other): 99% of trees stand in one; a median grove of 40
  trees (25th 18, 75th 81), the largest of a map about 212; each grove one species; a tree has 41%
  of its eight neighbours in trees; clearings between groves of 4 tiles (25th 2, 75th 7).
- **Berry patches** (bushes within 2 tiles): 44 bushes (35–58), the largest about 64; a bush has
  63% of its neighbours in bushes; they stand 4 tiles from water; patches are about 29 tiles apart.
- **Ruin fields** (touching columns): 37 columns (28–52); they fill 56% of their box, aspect 1.3
  (up to 2); storeys H1 28%, H2 22%, H3 16%, H4 10%, H5 8%, H6 6%, H7 4%, H8 5% (mean 3.06);
  per field the mean runs from 2.2 to 3.9 storeys (10th–90th); a median field has 5 towers of 6+
  storeys and a tallest column of 7; 11% of fields have no tower; touching columns differ by 1.8
  storeys on average; every field has all five models, A 26% and B–E 18–19% each; turns Cw0 59%,
  Cw90 14%, Cw180 10%, Cw270 17%.
- **Mine sites:** 1–4 a map; the nearest to the start a median 61 tiles out (25th 53).
- **Saplings:** 48% of the official maps' living trees are stored as saplings (the generator stores
  35%). Information only: starting wood stays as D164 decides.

**Against the generator before this step** (0.6.0, 108 maps: every theme, seeds 1–6, at 96², 128²
and 256²): the tree, bush and scrap totals were the size's median on every map (the same count on
every seed); 43% of trees alive and 59% of pines, birches and oaks dead; about twice the official
number of groves, half their size (median 15–20) and 50% fuller (a tree had 60% of its neighbours
in trees); 5–10 berry patches of 24 at 128² (official 4 of 44); ruins as official in amount, their
heights clumped (touching columns differed by 1.4 storeys, official 1.8), every model equally
often and turns at random. The table's medians changed little: trees at max size 500 → 559 per
10k and bushes 38 → 44 (Nomads and Oasis left out), scrap at max 237 → 235, field sizes 21 / 31 /
40 / 41 → 19 / 32 / 39 / 42, and the storey shares by up to 1 point.

## The shared baseline

`src/core/resources/` (product code; Real places and Pick a place call it, the generator too):

- `budget.ts` `resourceBudget(W, H, settings, seed)`: a map's trees, living trees, bushes, scrap and
  mine sites. Each is the median for the size moved within the typical range by the seed (evenly in
  ratio), times its setting. The seed alone moves it, so a map keeps its amounts on every attempt.
  Light: the settings panel shows it.
- `baseline.ts`: the placers.
  - `planGroves`: groves of one species, their size drawn from the official sizes (Grove size moves
    the median: 20 / 40 / 80), grown as a blob about twice the trees' number and thinned from the
    edge, a 2-tile clearing round each; living groves on moist ground (seeded near water), dry
    groves on dry ground (dead pines, birches and oaks, or living succulents), species drawn by what
    is left of each species' share; living trees on at most a quarter of the moist land.
  - `planPatches`: patches of about 44 along the banks (within 8 tiles of water where there is
    room), 14 tiles apart where there is room.
  - `planRuinFields` and `ruinColumns`: fields grown in an ellipse (aspect 1–2) on one level of dry
    ground with 4–10% holes and a one-tile moat; each with a tallness from −1 to 1 that tilts the
    official storey shares (a field averages 2.4 to 3.8 storeys); heights placed by a mildly
    clumped key, so a few towers stand among shorter columns; models and turns in the official
    shares. The planner stops at the scrap asked for, counting each field's exact scrap.
  - `pickMineSite`: flat free 5×5 ground with a level ring, out of flood reach, in its band from the
    start, on ground the colony walks to when the band has any (else on ground that needs stairs).
  - `planBaseline` and `baselineEntities`: everything on one map's ground in the generator's order
    (ruins, bushes and groves near the start, the rest), as entities.
- `plan.ts` `planMapResources(input)`: the whole of it for a map the generator did not plan (see
  below).
- `measure.ts`: the measures, for the official maps and ours alike.

**In the generator** (`gen/resources.ts`): the near-start patches and groves are planned as before
(they are the start requirements', and the start-and-edge-rules branch changes them), now thinned
like the rest where the walk has room; the rest of the budget comes from the baseline. Ruin fields
carry a new optional feature param `layout: { tallness }`; the rasterizer draws their heights, models
and turns with `ruinColumns` from the feature's own stream, so a rebuild gives the same bytes, and
fields without it (old project files, the editor's and Claude's tools) keep the old algorithm. The
ruins on a plateau are a taller field (tallness 0.5), and their scrap counts toward the map's
budget. Mine sites go through `pickMineSite` (`gen/extras.ts`).

### For the Real places round

`src/core/resources/plan.ts` is the one call. After the place's own objects (sources, start, any
slopes) are built and the water settled (resources never move water, so no second settle is
needed):

```ts
const rules = DIFFICULTY_RULES.normal;
const r = planMapResources({
  W, H, heights, water: settle.depth, moisture, soilContamination: soil,
  entities: base,                          // the place's sources, start and slopes
  start: startCentreOf(startObject),       // resources/measure.ts: the 3×3's centre tile
  settings: defaultSettings("riverValley", "normal", { x: W, y: H }).resources,
  seed: hash32("real-place", place.id),
  nearStart: { trees: Math.ceil(1.2 * rules.treesWithin20), bushes: Math.max(rules.berriesTarget, Math.ceil(1.15 * rules.bushesWithin20)) },
  ruinsClear: rules.ruinsWithin + 7,
  owner: `real-place:${place.id}`,
});
entities.push(...r.entities);             // trees, bushes, ruin columns, mine sites
```

- It places at least one mine site whenever any flat dry 5×5 ground exists: in the generator's band
  first (60+ tiles, scaled below 128²), then down to half of it.
- It is a pure function of the ground, settings and seed: a place can store only its terrain, water
  and start and compute its resources when its `.timber` is built, the same bytes everywhere.
- After D164 (starting wood) merges, `nearStart.trees` is the wood minimum over the logs a tree
  gives (the start-and-edge-rules branch's `logsPerTree`).
- The places tests expect today's places to lack a mine site (`PLACES_LACK_MINE_SITES` in
  `tests/contract/placesCommon.ts`); the rebuild turns it to `false`.
- A scratch build of Yosemite Valley through it passes every check but the two advisory ones it
  already had (walkable land and drought water for the bushes), with one mine site.

## Settings

- **Mine sites** is 1–4, keeping the size defaults (1 / 2 / 3 / 3). Old share links with `ms=0`
  decode to 1 with no problem reported; project files saved with 0 open asking for 1
  (`upgradeMineSites`). The spec schema's minimum is 1.
- **Forest density**, **Berry bushes elsewhere** and **Ruins and scrap** multiply the baseline. The
  panel says how many this map gets and the official range for its size ("About 1,812 trees, in
  groves with clearings. Official maps this size: 1,600–2,000."). **Grove size**: "Official groves:
  most about 40 trees." **Mine sites**: "Where the late scrap mine can be built. Every map has at
  least one. Official maps: 1–4."
- `tools/settings-suite.ts`: the Forest density, Grove size, Berry bushes, Ruins and Mine sites
  experiments name their new targets; Mine sites compares 1 and 3.

## Checks

- **`resources.mine_site`** (new, both validators, in the oracle's parity): at least one mine site.
  It blocks generation, warns on export and is reported on import (a playability check).
- **`resources.trees`, `resources.bushes`, `resources.scrap`** are information now (advisory): a
  warning under half the official median at the map's settings, and the message says whether the
  amount is within the official typical range. The batch tool reports how many accepted maps sit in
  the range.
- The start requirements are unchanged and still block.

## Results

(filled in below)

## Tests

- New `tests/contract/resources.test.ts`: the calibration table is the measured baseline; budgets
  scale with size, stay in the typical range and differ by seed; mine sites 1–4 and old links;
  groves (one species, apart, as full as the official ones, alive on moist and dead on dry
  ground); patches beside water; ruin heights (the official storey shares at tallness 0, towers in
  nearly every field, neighbours differing as officially, every model); ruin fields holding the
  scrap asked for, on one level, never touching; `pickMineSite` (in band, reachable first);
  every generated map has a mine site and a map without one fails `resources.mine_site` in each
  profile as it should; a project file with 0 mine sites opens with 1; generated maps carry the
  official amounts.
- Updated per D148 (they still passed or no longer meant what their names say, after Kyler's
  decisions):
  - `tests/unit/math.test.ts`: the max class's scrap median is 235 (measured without Nomads and Oasis).
  - `tests/contract/validate.test.ts`: `resources.mine_site` is in the check list; "not applicable on
    a map without map objects" now takes the objects out of a generated map's plan, since a map can
    no longer ask for no mine site.
  - `tests/contract/features.test.ts`: the advisory list gains the three resource amounts.
  - `tests/contract/spec.test.ts`: random specs draw 1–4 mine sites.
  - `tests/contract/places.test.ts`, `placesCommon.ts`: every place passes every check but the
    missing mine site, which both validators flag, until Real places 2 rebuilds them.
