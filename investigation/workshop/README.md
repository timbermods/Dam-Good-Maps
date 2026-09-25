# Workshop study: tools

The tools behind [WORKSHOP.md](../WORKSHOP.md) and [WORKSHOP-INTEGRATION.md](../WORKSHOP-INTEGRATION.md).
They import from `src/` read-only and change nothing there. Run them from the repository root, one at a
time: each lowers its own priority, so the milestone session's benchmarks keep the CPU.

Local data lives in `C:\dgm-workshop` (set `DGM_WORKSHOP` to move it). It holds other creators' maps,
renders and per-map numbers, so it is never committed. Only tools, recipes, aggregate numbers
(`investigation/workshop.json`) and fitted parameters are.

## Import and measure

```
python investigation/workshop/fetch_meta.py          # Workshop metadata → meta.json (one Steam API call, then pages 10 s apart)
npx tsx investigation/workshop/probe.ts              # version, era, size, templates, skip reasons → probe.json
npx tsx investigation/workshop/measure.ts            # every map → measured\<key>.json and settled\<key>.f32
python investigation/workshop/analyze_py.py          # the first investigation's analyze_maps.py on our settled water
npx tsx investigation/workshop/measure-generated.ts  # the generator's seeds 1–30 per theme at 128², measured the same way
```

`measure.ts` imports each map with the app's importer (`importDocument`), validates it with the app's
validators in the import profile on our canonical settle, and runs the app's `measure()`. It adds
water bodies and flow direction, dam sites over the whole map, the 1.0 objects, caves, the raw
start-rule quantities by walking distance, naturalness, the score inputs and a layout signature.
Saves and maps that need mods (unknown templates, terrain above layer 21, several starts) are skipped
with the reason. `lib/measures.ts` `measureFile` works on any `.timber`, generated or imported, so the
product can measure its own output the same way (`measure-generated.ts` does).

Maps whose water a steady state cannot show (caves on 5%+ of tiles, delayed sources, aquifers or
seeps carrying much of the clean water) are flagged in `mechanics.special`; the table drops their water
numbers, and drops start numbers when the start is flooded or under a roof.

## Variety score

```
npx tsx investigation/workshop/variety.ts [--extra C:\dgm-workshop\recipes]
```

`lib/variety.ts`: two maps' distance is half layout (a 16×16 picture of height rank and water,
compared under the 8 rotations and mirrors, so a rotated copy is not new) and half features (14
size-free numbers), each scaled so a typical pair of workshop maps is 1 apart. A set's variety is
the mean distance over its pairs. The scale the product can reuse is in `variety-scale.json`.

With `--extra`, it also reports what each recipe adds to River Valley's seeds, and V3: the same with a
third term, the Jaccard distance between the maps' pattern sets (the catalogue's tags; a recipe's
pattern), scaled by `patternP0`.

## Naturalness

`lib/naturalness.ts` `naturalness(heights, W, H, depth, damSites, maxFlood)`: the longest straight
run of a height step and the share of steps in runs of 8+; ridges (thin raised bands) and how much
their thickness and crest height vary; the rims round natural basins and dam-site reservoirs, their
thickness and height; the narrows' shoulders; shoreline straightness; ditches. All in tiles and
levels, so any map size compares.

```
npx tsx investigation/workshop/narrows.ts     # the validator's dam site near the start: its shoulders and crests
```

## Reservoir obviousness

```
npx tsx investigation/workshop/obviousness.ts
```

The shortest straight dam within 20 and 40 tiles of the start whose reservoir holds a Normal
drought's need (380 blocks), with the validator's own dam sampling. A 3-tile dam beside the start is a
ready-made reservoir; no such dam means the player engineers one.

## Interestingness score

```
npx tsx investigation/workshop/score.ts        # default parameters → score-params.json; checks M9's criterion
npx tsx investigation/workshop/fit-score.ts    # refit from C:\dgm-workshop\ratings.json → score-fitted.json
```

`lib/score.ts` `components(record, params, surprise, reservoirHelp)` and `scoreOf(components,
weights)`: 12 components, each 0–1, score = 100 × the weighted mean. Parameters are data
(`score-params.json`, or `score-fitted.json` when Kyler's ratings exist). `fit-score` writes nothing
until the ratings file exists, and never writes a map's own rating.

## Recipes

```
npx tsx investigation/workshop/run-recipes.ts [--only moat-island,volcano] [--seeds 1-10] [--sizes 96,128] [--big 3]
npx tsx investigation/workshop/render-folder.ts C:\dgm-workshop\recipes
```

Each recipe in `recipes/` starts from a generated base (the current generator), opens it in a
`MapSession`, and applies the engine's own operations: landforms, lakes and rivers through the
editor's planners (`core/doc/tools.ts`), set pieces through the shared builders, entity and slope
edits. Up to 3 attempts per seed; the result is validated in the `generate` profile and measured like
the workshop maps. `--only` reruns merge into the saved results.

```
npx tsx investigation/workshop/recipe-table.ts      # pass rates, variety gain, naturalness, obviousness (markdown)
python investigation/workshop/sheets.py --recipes   # C:\dgm-workshop\sheets\recipes.png: one map per recipe
```

## Renders, sheets, rating page, aggregate

```
npx tsx investigation/workshop/render.ts            # top-down and 3D renders of every map (local)
python investigation/workshop/sheets.py             # contact sheets for browsing
npx tsx investigation/workshop/catalogue.ts         # pattern counts and credited examples
npx tsx investigation/workshop/settings-bands.ts    # settings-bands.json: density rows and setting proposals
npx tsx investigation/workshop/rating-page.ts       # C:\dgm-workshop\rate\index.html (never published)
npx tsx investigation/workshop/aggregate.ts         # investigation/workshop.json (numbers only)
```

## Rating maps

1. Open `C:\dgm-workshop\rate\index.html` in a browser.
2. Rate each of the 40 maps for **Fun** and **Unique** (1–5); a note is optional. Answers stay in the
   browser as you go.
3. Press **Save ratings.json** and save the file as `C:\dgm-workshop\ratings.json`.
4. Run `npx tsx investigation/workshop/fit-score.ts`, and commit the `score-fitted.json` it writes.
