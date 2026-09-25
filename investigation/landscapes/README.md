# Real-landscape survey

Start with [REPORT.md](REPORT.md). M9's handoff is [INTEGRATION.md](INTEGRATION.md).

- [Methods and limits](METHODS.md)
- [Comparisons and random-land controls](COMPARISON.md)
- [Landform families](FAMILIES.md)
- [Measurement bench](bench/README.md)
- [Fixture library](library/README.md)
- [Attribution](ATTRIBUTION.md)

## Reproduce

Use Node 24.13 or later. Run these commands from `investigation/landscapes/`. Dependencies and all generated files stay here.

```sh
npm ci --ignore-scripts --cache ./npm-cache
npm test
npm run sample
npm run convert -- --workers 8
node --import ./register.mjs ../../tools/gen.ts --seeds 1-30 --sizes 128 --out .work/default-cli --quiet
node --import ./register.mjs generated.ts
npm run measure
node --import ./register.mjs curate.ts
```

The full matrix runs thousands of canonical water simulations. Allow several hours on a desktop, especially for broad shallow water at 256². `--workers` controls CPU use. Both acquisition and conversion resume from their caches. `--priority` converts the anchor centres at 128² and 60 m per tile first; it changes scheduling, not the final dataset. Do not run a changed conversion or core against old cached rows. The provenance check rejects that combination.

The acquisition command needs internet access. The remaining steps use local data. Do not commit `.cache/`, `.work/`, `node_modules/` or `npm-cache/`.

For the Python cross-check, use Python with NumPy and the unchanged repository prototype:

```sh
python -B oracle.py
node --import ./register.mjs verify.ts
node --import ./register.mjs write-report.ts
```

Python can run in separate shards with `--shard 0 --shards 4`, through shard 3. `-B` keeps Python caches out of the read-only prototype folder. The wrapper compares pass/fail, applicability and advisory status for every check on each library map.

`summarize.ts --partial` writes an interim report under `.work/partial/`. The final summarizer refuses fewer than 16,200 converted records or 180 generator records.

## Data

`data/locations.json` records names, coordinates, family strata and random controls. `patch-manifest.jsonl.gz` and `tile-manifest.jsonl.gz` record acquisition provenance. `quality-flags.json` records exclusions without hiding sampled results.

`converted.jsonl.gz` and `generated.jsonl.gz` hold measurements and checks for each attempt. They contain numbers and signatures, not raw elevation tiles. `targets.json` contains stratified target bands. `summary.json` contains pass rates, failure counts and comparisons. The library is under 10 MB, including previews and its index.

The investigation reads `src/` and `investigation/workshop/lib/`. It changes neither. It never starts Timberborn.
