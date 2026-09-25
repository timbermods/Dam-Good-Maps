# Measure a heightmap

From `investigation/landscapes/`, install this folder's dependencies:

```sh
npm ci --ignore-scripts --cache ./npm-cache
npm run bench -- --input library/EXAMPLE.json.gz
```

Choose a real filename from `library/index.json`. For a prototype:

```sh
npm run bench -- --input .work/prototype.json --metres 60 --family all --cohort named --mode normalised --cap 16
```

Input is JSON or gzip JSON:

```json
{
  "W": 96,
  "H": 96,
  "heights": [0],
  "waterSources": [{"x": 4, "y": 70, "strength": 0.5}]
}
```

Replace `heights` with exactly `W * H` integers from 0 to 22. This shortened example is not a valid map. Index is `y * W + x`; y increases north. Source strength uses the repository's game units. Sources are clean water. Optional `entities` allow full fixture validation; otherwise start and resource checks can fail. `waterSources` is authoritative for clean sources.

The bench settles water with the repository's simulation. It emits JSON with raw measures, generate-profile checks and distances to the selected target stratum. Inputs from 4 to 256 cells per side are measurable. If the dimensions or stratum have no surveyed match, it returns raw measurements with `comparison: null`. An explicit `--reference-size 128` permits comparison across dimensions, with the mismatch labelled in the output; size effects remain.

The default is named regions, 128² where the input is 128², 60 m per tile, relief-normalised, 16 levels. A fixture supplies its own scale and mapping. `--cohort random` uses the random-land control. `--family canyon` narrows the named cohort; inspect `data/targets.json` for all keys.

Library fixtures also carry `referenceHeights`: the original quantised crop before the artificial edge rim. Terrain measures use those heights. Water and validation use playable `heights`. Ordinary prototypes omit that field. Library entities omit UUIDs to save space; the bench reconstructs deterministic IDs in stored order before validation or export.

Read the measurements as separate comparisons. A smaller distance does not prove fun, realism or validity. Water comparisons are withheld when settling fails. Missing values and measures with fewer than five supporting regions remain unscored. Histograms use total variation; mean valley sections use root mean square difference in levels. See [methods](../METHODS.md).

Programmatic use:

```ts
import { measureInput, compare } from './bench/measure.ts';
const { row, v } = measureInput(input);
const comparison = compare(row, targets.strata['named/128/60/normalised/16/all']);
```

The bench reads core code. It neither designs nor changes generator processes.
