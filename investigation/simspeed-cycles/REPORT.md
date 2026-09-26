# Exact weather-cycle speed investigation

**Complete: 204 maps in Node and Chromium, six implementations, all 18 full-duration profiles, and 12 additional continuous-timeline cases per runtime. No mismatches.** The follow-up optimizes current dev's own `GameWater` and `GameSoil`; it does not substitute the earlier approximate cycle model. Production and reference modules remain unchanged.

The full four-change combination gives median paired exact-weather speedups of **1.44× / 1.40× in Node CPU** and **1.52× / 1.33× in Chromium elapsed time** at 128² / 256². Separate Chromium medians for the full native probe set fall from **31.53 → 21.42 s** and **96.64 → 67.92 s**. The reference normally totals 73 days across six independently loaded probes; longer source ramps keep their extra days.

| Prototype | 128² Node CPU / Chromium elapsed speedup | 256² Node CPU / Chromium elapsed speedup |
|---|---:|---:|
| water-sparse | 1.12× / 1.14× | 1.14× / 1.15× |
| soil-cache | 1.06× / 1.06× | 1.06× / 1.07× |
| soil-saturation | 1.01× / 1.00× | 0.99× / 0.97× |
| water-wasm | 1.23× / 1.25× | 1.21× / 1.18× |
| combined | 1.44× / 1.52× | 1.40× / 1.33× |

Start integration with soil descriptor reuse, then evaluate the strict scalar WASM water kernel and conservative contamination support. Treat saturation caching as optional: its standalone result varies with changing wet boundaries, and it adds memory. Only the complete four-change combination has been measured together; do not assign its speedup to a smaller subset or multiply individual ratios. [INTEGRATION.md](INTEGRATION.md) specifies the changes in order and includes an unapplied combined patch. [WEATHER-PROOF.md](WEATHER-PROOF.md) gives the dependency and arithmetic arguments.

The first-drought wait depends on which Weather view is built. The additional continuous experiment starts at the reference new game's 04:00 and reaches 73 calendar-day boundaries (55,936 ticks); the reset probes retain their own full-day starts.

| Chromium observed compute wait | 128² combined | 256² combined |
|---|---:|---:|
| Independent Normal probe prioritized: drought end | 0.73 s | 2.55 s |
| Independent Normal probe: all three recovery days ready | 1.77 s | 6.71 s |
| Complete independent probe set | 21.42 s | 67.92 s |
| Continuous new game: first drought end (boundary 19) | 7.45 s | 20.81 s |
| Continuous new game: recovery complete (boundary 22) | 9.37 s | 24.33 s |
| Continuous new game: full 73-day timeline | 26.25 s | 80.33 s |

Theme variation is substantial. Across the six seed-1 continuous cases at each size, the combined Chromium wait ranges are 128²: 4.14–19.70 s to first drought end and 15.52–68.98 s to completion; 256²: 10.72–41.98 s to first drought end and 38.58–155.18 s to completion. The per-theme table in WEATHER-PRODUCT.md retains these slower cases.

These are observed worker compute times on a shared Ryzen 7 9800X3D host, not target-device UI guarantees. Four proof workers per runtime overlap; the one-worker continuous runs also overlap the proof. Constructors and required Measures calls are included; generation, proof copies/hashing, module startup, transfer and rendering are excluded. Absolute values are separate medians; speedups are medians of paired ratios. [WEATHER-RESULTS.md](WEATHER-RESULTS.md) retains every theme/size, all standalone results and diagnostic profiles.

The product proposals **do not change simulated results**: stream completed key days, prioritize independent probes, keep a lossless timeline cache under a complete content/configuration/version hash, and start a cancellable worker after the selected map is generated. A continuous journey still executes every earlier tick and daily measurement. A useful B-second background head start reduces remaining wait to approximately max(0, T − B); a resident cache hit replaces compute with measured copy/parse plus transfer/paint. Eight-millisecond tick batches keep cancellation responsive, with separately estimated scheduling overhead. [WEATHER-PRODUCT.md](WEATHER-PRODUCT.md) supplies baseline/combined waits, cache memory/copy costs, measured message scheduling and the limits of those estimates.

Proof uses all six themes, seeds 1–30 at 128², seeds 1–3 at 256² and seed 1 at 96². Each runtime independently generates **1,224 exports**, compares every byte against baseline, and matches the historical SHA oracle. Per implementation, **17,964 daily/phase checkpoints across 14,904 simulated days** compare water depth/contamination, soil moisture/contamination, every plant/timer/death, sources, clock, summaries and hidden state feeding later ticks. Node and Chromium reference digests agree. Tick-order/RNG code is unchanged. Additional every-tick smoke, narrow-grid/dependency and continuous-journey checks pass. No tolerance or expected-hash update accepts a mismatch.

The source audit pins dev `948f395137a6725d4b726864a47e6966d7f2f09a`, verifies all 82 input hashes and seven bundle hashes, and checks that the retained WAT assembles to the tested binary. The compiler disables fast math explicitly; scalar float64 water expressions and all float32 soil roundings retain their order. The tested build is `3d4ee86c350c609c17b8149b824d6e9c054abbea8fb8d2aaa29f8416c88e9710`. [WEATHER-REPRODUCTION.md](WEATHER-REPRODUCTION.md) gives commands and workload definitions. This is evidence for the supported immutable heightfield model, not arbitrary private-state mutation or unimplemented roofed water.

For stacked layers, descriptor reuse and strict WASM arithmetic remain useful techniques; contamination support must expand along the actual compartment graph. The literal four-edge water kernel and eight/four-neighbour saturation stencil cannot be reused unchanged. Cache/background/streaming work largely carries over with complete layered-geometry keys and larger memory budgets. [STACKED-LAYERS.md](STACKED-LAYERS.md) assesses the now-available terrain3d prototype and the conditions for each proposal.

## Scope and source revisions

PR #17 was merged externally during this follow-up, at 2026-09-25 19:38:03 UTC. Following the requested fallback, this work moved to branch `investigation/simspeed-cycles`, created from dev `652774175c08b46b40c01536ee3d08a83cbe98d6`, and this folder alone. No merge was performed by this investigation. The exact-weather and core dependency source trees are unchanged between the initially pinned dev and that new base; the rebuilt bundles retain the identical fingerprint, so completed proof records remain valid. The branch/source record is in `results/weather/branch-provenance.json`.

The final remote check at 2026-09-26T00:53:02.2559596Z found dev `ee2cd064ff6c0306591d973137de4048292eff0e`; its exact-weather tree and every tested core dependency still match the pinned reference. Two newly added core places modules are outside that dependency graph. Unrelated upstream changes do not alter this experiment. The terrain3d assessment remains pinned to `72d2aa2e88d91f1bfce1ba6fe70de4536a1922e3`.

The [earlier core/M9 study](../simspeed/REPORT.md) remains separate and unchanged. The present weather prototypes do not optimize generation or the core editor simulator. They target the independent exact-weather implementations and propose integration without applying it. No source, test, root dependency, CI or configuration file is changed. The new PR is to remain open and unmerged.
