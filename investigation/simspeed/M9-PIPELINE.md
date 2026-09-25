# M9 whole-pipeline benchmark

24/24 Node cases and 24/24 Chromium cases; exactness status: **complete**.

Reference: `investigation/generative` at `a5f189d3e96affec533415090bdb8f09d606c8fd`, prototype `0.7.0-proto.2`. The prototype was absent from the observed dev revision `948f395137a6725d4b726864a47e6966d7f2f09a`, so the branch was used. Its production `src/` matches this investigation's base. The ten prototype modules and `lib/ridge.ts` are copied under `generative/`, changing only relative imports and line endings. [m9-build.json](results/m9-build.json) fingerprints inputs and both bundles. Only the combined core water/drought prototypes are substituted in the optimized bundle.

Coverage: all six themes, seeds 1 and 2, 128² and 256², Normal difficulty, default Variety 70 and maximum 12 attempts. A candidate means one complete `generateProto` call through its successful compressed `.timber`, including failed retries, field/erosion/hydrology, every build/settle, start and hazard planning, objects/resources, validators, storage and dam-wall checks, and writing. No simulation cache is shared between calls. This is not just the first settle or the final attempt. It does not include K=3 selection, UI transport or rendering, which this prototype call does not implement.

Each case warms both bundles with a complete generation, then times three calls per variant, alternating order. Node runs serially with thread CPU and elapsed time; Chromium runs one Web Worker with elapsed time. Comparison and hashing happen after the timed calls. Every run must produce nonempty identical file bytes, exact water/contamination/moisture/soil/heights and settle arrays, identical accepted attempt, genome, features, analysis and validation. Only diagnostic `info.ms` clock readings are excluded from object comparison. SHA-256 and array digests must also match across runtimes. A complete run produces 192 exports per runtime over the 24 distinct maps (two warm-ups and six timed generations each).

`docs/m9-design.md` §13 sets under 3 s for a 128² generation and about 6 s for one 256² candidate, derived from K=3 in ≤20 s. The tables compare the whole accepted-candidate cost to those targets. Native stage timings in the raw rows describe only the last attempt; they are not summed or presented as an all-attempt breakdown. Retry counts are unchanged by optimization. The shared host also runs the tail of the water/cycle proof; observed wall times are not a quiet-machine budget certification. CPU over 6 s already indicates that this patch alone does not remove that case's computational budget problem.

| Size | Node CPU speedup | Node median CPU baseline → combined (s) | Chrome speedup | Chrome median wall baseline → combined (s) | Combined Chrome cases over target |
|---|---:|---:|---:|---:|---:|
| 128² | 1.12× | 1.19 → 1.08 | 1.12× | 1.24 → 0.97 | 1/12 |
| 256² | 1.08× | 6.39 → 6.18 | 1.12× | 5.20 → 4.61 | 3/12 |

Ratios are medians of paired per-case ratios; the absolute-time columns are separate medians and need not divide to the same ratio. “Over target” uses each case's three-run median, not a pass/fail guarantee for every call. Small gains and cases near 6 s need replication: individual trial values show JIT/GC and scheduling variation, and one full warm-up does not guarantee every path is fully optimized. All three raw trials are retained.

| Theme | Size | Seed | Attempts | Node CPU baseline → combined (s) | Node wall baseline → combined (s) | Chrome wall baseline → combined (s) | Combined Chrome / target (>1 is over) |
|---|---:|---:|---:|---:|---:|---:|---:|
| riverValley | 128² | 1 | 1 | 0.94 → 0.97 | 0.96 → 0.97 | 0.92 → 0.80 | 0.27× |
| riverValley | 128² | 2 | 1 | 0.78 → 0.70 | 0.78 → 0.73 | 0.68 → 0.64 | 0.21× |
| canyon | 128² | 1 | 5 | 4.69 → 4.19 | 4.73 → 4.22 | 4.68 → 4.20 | 1.40× |
| canyon | 128² | 2 | 1 | 0.84 → 0.81 | 0.85 → 0.81 | 0.81 → 0.76 | 0.25× |
| highlands | 128² | 1 | 1 | 1.06 → 0.92 | 1.07 → 0.94 | 1.87 → 0.88 | 0.29× |
| highlands | 128² | 2 | 1 | 0.56 → 0.53 | 0.56 → 0.54 | 0.50 → 0.47 | 0.16× |
| lakeBasin | 128² | 1 | 1 | 1.58 → 1.33 | 1.58 → 1.37 | 1.36 → 1.42 | 0.47× |
| lakeBasin | 128² | 2 | 1 | 2.00 → 1.78 | 2.01 → 1.80 | 1.86 → 1.62 | 0.54× |
| islands | 128² | 1 | 1 | 1.69 → 1.44 | 1.68 → 1.43 | 1.49 → 1.30 | 0.43× |
| islands | 128² | 2 | 1 | 1.31 → 1.19 | 1.32 → 1.18 | 1.18 → 1.06 | 0.35× |
| delta | 128² | 1 | 1 | 1.45 → 1.34 | 1.45 → 1.36 | 1.30 → 1.20 | 0.40× |
| delta | 128² | 2 | 1 | 0.86 → 0.73 | 0.85 → 0.76 | 0.87 → 0.76 | 0.25× |
| riverValley | 256² | 1 | 2 | 9.94 → 9.28 | 10.05 → 9.32 | 10.01 → 9.45 | 1.58× |
| riverValley | 256² | 2 | 1 | 4.77 → 4.53 | 4.82 → 4.56 | 4.51 → 4.17 | 0.69× |
| canyon | 256² | 1 | 2 | 10.78 → 10.17 | 10.83 → 10.27 | 10.19 → 9.41 | 1.57× |
| canyon | 256² | 2 | 1 | 4.33 → 4.00 | 4.36 → 4.09 | 4.07 → 3.61 | 0.60× |
| highlands | 256² | 1 | 1 | 5.06 → 4.53 | 5.09 → 4.55 | 4.30 → 3.81 | 0.64× |
| highlands | 256² | 2 | 1 | 3.78 → 3.67 | 3.80 → 3.75 | 3.76 → 3.04 | 0.51× |
| lakeBasin | 256² | 1 | 1 | 5.92 → 6.08 | 6.36 → 6.70 | 5.54 → 4.86 | 0.81× |
| lakeBasin | 256² | 2 | 1 | 6.86 → 6.28 | 7.29 → 6.36 | 4.85 → 4.35 | 0.73× |
| islands | 256² | 1 | 1 | 14.84 → 13.44 | 15.90 → 13.92 | 11.41 → 10.16 | 1.69× |
| islands | 256² | 2 | 1 | 7.41 → 6.67 | 7.45 → 6.67 | 6.22 → 5.46 | 0.91× |
| delta | 256² | 1 | 1 | 7.25 → 6.42 | 7.37 → 6.62 | 5.64 → 5.05 | 0.84× |
| delta | 256² | 2 | 1 | 3.50 → 3.25 | 3.53 → 3.27 | 2.80 → 2.54 | 0.42× |

## Reproduction

Run from this folder after installing its dependencies and generating the core prototypes:

```sh
node bundle-m9.mjs
node m9-bench.mjs
node browser-server.mjs --m9
# Open its loopback URL in Chromium; wait for PASSED, then stop the server.
node summarize-m9.mjs
```

Use `--force` on both runners to replace matching-build cached results. Whole-pipeline wall budgets should be replicated on a quiet host before integration. Fewer settles or retries would be separate generator changes and are not included in these measured gains.
