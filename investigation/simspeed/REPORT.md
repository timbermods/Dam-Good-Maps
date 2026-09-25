# Exact simulation speed investigation

This branch contains five independent exact-arithmetic prototypes and their combined version. Production modules are unchanged. [RESULTS.md](RESULTS.md) contains the measured speedups, every theme/size row and profile summaries; [INTEGRATION.md](INTEGRATION.md) gives the proposed production changes and their order. The follow-up adds [M9 whole-pipeline measurements](M9-PIPELINE.md) and [stacked-layer applicability](STACKED-LAYERS.md).

**Acceptance status:** The complete original simulation matrix, exact-cycle supplement and M9 whole-pipeline matrix pass in Node and Chrome 153. [RESULTS.md](RESULTS.md) records the combined completion status. This branch proposes production changes; it does not apply them.

## Findings and recommendations

The full five-change combination measures **1.19× canonical settle, 1.19× warm preview, 1.13× the original weather cycles and 1.10× full generation** by median paired Node CPU ratios. Those correspond to approximately 16%, 16%, 12% and 9% less CPU time, respectively. Generation is a descriptive measurement across the 216 proof maps; short-stage benchmarks use repeated batches. These are modest, useful reductions, not an order-of-magnitude change.

Chrome 153's measured combined elapsed-time ratios are **1.15× canonical settle, 1.16× preview, 1.13× original cycles and 1.09× generation**. Its full standalone table is in RESULTS.md. These browser observations include shared-host scheduling, so they support the direction of the gains without establishing idle-machine latency guarantees.

The **M9 whole pipeline** improves by paired median CPU ratios of **1.12× at 128² and 1.08× at 256²** in Node, and by **1.12× at both sizes** using Chrome elapsed time. At 256², separate medians across the twelve theme/seed cases fall from **6.39 → 6.18 s CPU** in Node and **5.20 → 4.61 s elapsed** in Chrome. The roughly six-second candidate budget is still exceeded by seven Node CPU case medians and three Chrome elapsed case medians. The optimized Chrome cases range from 2.54 to 10.16 s; River Valley and Canyon seed 1 require two attempts, while Islands seed 1 takes 10.16 s even with one attempt. This patch alone does not establish a universal M9 budget pass. Every retry, settle, validator and export is included, with unchanged outputs and attempt counts. [M9-PIPELINE.md](M9-PIPELINE.md) retains all trials and explains shared-host and JIT/GC variation; the ratios and separate absolute medians are different statistics.

For **stacked-layer water**, ordered connectivity caching is the strongest transferable idea. Fixed four-direction unrolling and eight-neighbour saturation require a proven layer-local stencil, and the flat pool drought formula cannot be reused unchanged for caves and ceilings. Redundant-write elimination remains conditional on writing every live flow slot before reading it. The terrain3d branch was still absent at the final branch check, so [STACKED-LAYERS.md](STACKED-LAYERS.md) makes architectural proposals without claiming 3D parity or speedups.

**The newer `investigation/cycles-exact` uses a separate water/soil implementation. These core changes do not speed up its weather ticks.** That branch appeared while this investigation was running. Its additional profile and Node–Chromium checkpoint matrix are in [EXACT-CYCLES.md](EXACT-CYCLES.md). Do not apply the original model's 1.13× result to that newer model.

The exact-model supplement measures median Node CPU totals of 14.10 s at 96², 18.57 s at 128² and 73.02 s at 256² across its six probes. All total 73 days except Islands 256², whose longer source lead-in produces 77 days. Its diagnostic profiles attribute median inclusive elapsed-time shares of 61.9% to `GameWater.tick` and 35.5% to `GameSoil.step`. Those unchanged implementations are the next Weather optimization targets. These attribution figures include instrumentation effects and are not CPU shares or an old/new model speed comparison.

| Candidate | Canonical CPU | Preview CPU | Cycle CPU | Recommendation |
|---|---:|---:|---:|---|
| Interior saturation count | 1.09× | 1.07× | 1.03× | First integration candidate: small, allocation-free change |
| Directional loop expansion | 1.06× | 1.06× | 1.03× | Second candidate; check larger function on browser JITs |
| Neighbour-index table | 1.05× | 1.00× | 1.02× | Optional third candidate; weigh its 1 MiB per 256² simulator |
| Skip redundant flow clearing | 1.00× | 1.00× | 0.99× | Defer: no useful standalone gain |
| Per-pool drought drop | unchanged | unchanged | unchanged | Defer: apparent analytic gain is within control variation |

Only the full five-change combination was measured together. The proposed two- or three-change integration prefixes have **not** been measured as combinations; their gains cannot be obtained by multiplying standalone ratios. The all-five proposal remains available as an exact reference, including the two low-value candidates. Ablation on a quiet target machine should decide whether those two contribute to the combined result.

The combined canonical CPU ratio is above 1 in all 18 measured cases, ranging from 1.09× to 1.30×. Unrolling is also above 1 in all 18, saturation in 15, and topology in 13. Individual small wins and regressions are within the variation seen in unchanged-code controls; these counts describe this run and are not statistical confidence bounds.

For generation and export, canonical settle still runs to exactly the same checkpoint and produces the same water and file bytes. Other generator work limits the full-generation gain. For the editor, the preview call improves, but remeshing, worker communication and rendering were not timed. No full-interaction latency claim follows from this probe.

For a Weather view built on the **original** cycle model, the median 73-day CPU totals across themes are 12.23 → 10.70 s at 96², 16.13 → 14.47 s at 128², and 57.04 → 52.35 s at 256². These are separate medians of absolute times, not the median paired speedup. The paired cycle gains are 1.15×, 1.14× and 1.10× respectively. That same simulation remains a substantial job; slicing, cancellation and progressive day results remain necessary UI integration work. Frame encoding and rendering are excluded. For the newer exact-cycle model, only generation/initialization benefits from this proposal; its independent `GameWater` and `GameSoil` need a separately proved optimization effort.

Lake Basin's seed-1 canonical CPU time falls from 547 → 485 ms at 128² and 2,328 → 1,954 ms at 256²; warm preview falls from 182 → 146 ms and 1,313 → 1,093 ms. Its observed canonical wall times are 547 → 482 ms and 2,315 → 1,965 ms. These particular observations are below the 600/3,000 ms targets, but this shared-host study does not establish idle-machine or across-seed budget compliance. Islands remains the heavier case: combined canonical CPU is 1,125 ms at 128² and 3,187 ms at 256². Every theme/size result, including all wall observations, is in RESULTS.md.

The baseline profiles put the bulk of canonical and preview work inside the water tick. Across the analytic drought profiles, `spillLevels` takes a median 85.7% of instrumented elapsed time; `clusterSaturation` takes 3.2%. The pool-drop arithmetic is therefore a small target. Its apparent 1.04× CPU gain is comparable to the 1.02–1.04× readings for water-only variants that leave drought code unchanged. This is insufficient evidence to recommend that extra allocation. A future exact drought investigation should examine flood/heap overhead while preserving tie order and all arithmetic.

## Scope and choices

- Base: `dev` at `cfa5990caeaf462de695caf428280da55fc0f7f5`.
- During the run, remote `dev` advanced, most recently observed at `948f395137a6725d4b726864a47e6966d7f2f09a`. A read-only comparison confirms `src/core/sim/` and `detmath.ts` are unchanged there. This branch retains its original base so the measured generator and export oracle stay pinned; its generation claims do not silently extend to newer revisions. No upstream changes were merged or rebased into the study.
- Original cycle reference: `investigation/cycles` at `1a8eba2fc380cc3e46e8b383d4f899ed8bb5ceb8`. The three files in `cycles/` copy that reference, changing only relative import paths and line endings. `investigation/cycles-exact` was absent in the initial and intermediate listings, then appeared at `a9cdb860be859ddd3339800a88b42e9871293597` during the final check. Its six copied modules live separately in `cycles-exact/`; its production `src/` is identical to this study's base. The supplemental matrix preserves the new model's own rules and results, with a separate bundle fingerprint. Both copy sets have provenance records.
- Read `CLAUDE.md`, PLAN sections 2.1, 10, 15 and D15, EDITOR_PLAN sections 6 and 9, all of `src/core/sim/`, and `src/core/math/detmath.ts` before prototyping. The local `docs/decisions-pending.md` item #22 records the Lake Basin overrun and an M7 update reporting it within budget; item #27 and D83 record Islands' overrun. Both themes receive the full current-build measurements here. Historical timings do not establish a pass for this revision or host.
- Six themes with `makeSpec`'s default settings; generation proof uses seeds 1–30 at 128² and seeds 1–3 at both 96² and 256² (216 maps). Performance probes use seed 1 per theme and size. These are sample measurements, not a pass-rate survey.
- The original six weather probes total exactly 73 days. Each probe starts from the same generated canonical water, while its phases run continuously. Weather seed is 1729. The reference's soil update interval stays at 16 ticks. This study preserves that model's outputs; it does not make its soil approximation more accurate.
- Warm-preview probe: lower a 7×7 patch by two terrain levels, centered on the first interior tile with depth greater than 0.3, or the map center if none exists. The same changed model and prior canonical state feed every variant. This measures `previewSettle`, not a complete editor interaction or remesh.
- All dependencies, copied modules, scripts, temporary files and results stay in this folder. The root package, lockfile, tests, CI, configuration and application remain untouched.
- The M9 follow-up uses `investigation/generative` at `a5f189d3e96affec533415090bdb8f09d606c8fd`, because its prototype is absent from the observed `dev`. That branch's production `src/` matches this study's base. Whole accepted candidates use all six themes, seeds 1 and 2, 128²/256², Normal difficulty, Variety 70 and the unchanged 12-attempt cap. Two warm-ups and six timed generations per case compare baseline with the combined water/drought prototype. The roughly 6 s budget is charged for the full call, including retries and export.
- `investigation/terrain3d` was absent when checked for the follow-up. The stacked-layer assessment is explicitly conditional on the future solver's representation and operation order; no 3D speedup or parity result is claimed.

## Prototypes and arithmetic arguments

`prototype.mjs` generates readable copies of the original `water.ts`, and a copy of `drought.ts`. `bundle.mjs` substitutes them only in investigation bundles. The baseline bundles the untouched production files. TypeScript strips types and changes module syntax; there is no minifier, fast-math pass, WASM compiler, new float32 conversion or new transcendental function.

1. **saturation:** replace the eight-neighbour nested loop with eight explicit positivity tests for interior cells. Boundaries keep the original loop. The only regrouped addition counts integers in [0, 9], where every operation is exact. Saturation, polynomial evaporation and all floating-point water operations remain unchanged.
2. **topology:** precompute four neighbour indices per tile in `Int32Array`, preserving directions −y, −x, +y, +x and the −1 edge sentinel. The flow and depth loops read those indices instead of repeatedly computing coordinates, checking bounds and dispatching on direction. No physical value is cached. Adds 16 bytes per tile (144 KiB at 96², 256 KiB at 128², 1 MiB at 256²).
3. **clear:** skip clearing the previous flow buffer for a tile that is still wet. Every currently wet tile overwrites all four entries in flow pass 1 before any flow is read by pass 2, including blocked-direction zeros. Previously wet tiles that became dry still get all four zeros. The active set is still rebuilt every substep, in the same order.
4. **unroll:** expand the four directional iterations of outflow pass 1 into four blocks, in the original order. Each block has a constant direction; its local break is the original loop's continue. All expressions and the subsequent four-term sums remain unchanged. This trades a larger function for less loop and dispatch work.
5. **drought:** after summing evaporation in the original index order, compute `(evap[pool] / area[pool]) * days` once per pool. Reuse that binary64 value for every tile in the pool. Division precedes multiplication exactly as before; the sum and subtraction order are unchanged. Adds eight bytes per pool for the temporary drop array.
6. **combined:** apply all five changes together. No source, seep, stopping condition, priority-flood, contamination, moisture or cycle scheduling rules change.

These are local equivalence arguments under the existing simulator contract (fixed dimensions, its own wet lists, finite map depths and source values). Empirical parity covers generated maps and adversarial boundary cases; it is not an exhaustive proof over malformed inputs or external mutation of the simulator's private data.

## Verification method

`verify.mjs` runs the full generator independently for every variant. It requires successful generation, compares every byte of each `.timber`, records its SHA-256, and compares the generated depth, contamination, moisture, soil contamination, heights, settle data and validation report. Empty exports cannot pass.

The same map is then independently canonically settled in 128-tick slices and warm-started in 64-tick slices. At every checkpoint the harness compares raw bytes of depth, contamination, previous depth, all four momentum values per tile and saturation, plus exact volume and stopping ticks. Analytic drought arrays are compared at 0, 1, 9 and 25 days. Byte comparisons detect signed-zero differences; no rounding or tolerance is used between implementations.

`golden.mjs` compares all variants on the 12 checked-in Python fixtures (50, 200 and 975 ticks, canonical settle and drought) and six narrow/boundary grids for 256 ticks each. The extra grids exercise dry/wet transitions, dam height 0.65, source walls, seep hysteresis, source scaling and contamination changes. Python-reference tolerance follows the repository test; variant comparisons are exact bytes.

`bench.mjs` additionally compares every daily state and phase boundary of all six weather probes, including water state, moisture, soil contamination, candidate contamination and serialized plant timers/deaths. It runs the reference `Measures` sampling schedule and compares metrics, first-dry/first-bad arrays and first water loss. `browser.mjs` or the loopback `browser-server.mjs` runner executes the same suite in Chromium, compares each variant's bytes within Chromium, then compares checkpoint and file SHA-256 records with Node. Cross-runtime array equality uses SHA-256 of every raw array; it does not transmit rounded depth summaries. The cycle reference's display metrics retain their existing rounding; they are checked separately from the raw arrays.

Each runtime's original-model proof contains 1,512 complete exports (216 maps × seven implementations), 1,296 exact export comparisons, 3,038 canonical/warm checkpoints, 864 analytic drought arrays and 1,692 cycle checkpoints per implementation. The cycle matrix executes 9,198 simulated days across all variants in each runtime. Every recorded file hash and checkpoint digest agrees between Node and Chrome. Twelve historical `.timber` hashes from the pinned cycle study also match, independently checking the investigation bundler against previous output. The [bundle fingerprint](results/build.json) is `8087039090477fad7181436702980d513161270779c6cdf69bbf87492ae44726`.

The separate late-arriving exact-model matrix passes in both Node and Chrome: 18 cases, 1,696 matching checkpoints and 1,318 simulated days per runtime. It has 18 additional six-day profiles and its own [fingerprint](results/exact-build.json). This is cross-runtime parity for unchanged `GameWater`/`GameSoil`, not a claim that the core prototypes alter or accelerate that model.

The M9 supplement passes all 24 theme/size/seed cases in both runtimes, producing 192 complete exports per runtime across warm-ups and three timed calls per variant. Each optimized export matches every baseline byte; water, contamination, moisture, soil, heights, settle state, generator decisions and accepted attempt match exactly. All recorded file hashes and array digests also agree between Node and Chrome. Its separate [fingerprint](results/m9-build.json) pins the generator copy and both simulation bundles.

The final audit rechecks all three source manifests and ten bundle hashes, all twenty copied reference modules, TypeScript and JavaScript syntax, and the unapplied patch's applicability. The raw Git whitespace check reports only retained end-of-file blank lines in the three original cycle copies and blank context lines inside the patch artifact. Those measured copies and patch syntax are intentionally preserved; all other changed files pass the whitespace check.

## Timing method

Short stages use one warm-up plus three timed batches per theme/size, rotating variant order between batches. A baseline calibration selects enough repeated calls for roughly 500 ms of thread CPU time per batch; all variants use the same call counts, recorded in each row. Timings are divided by call count. Each variant first runs its full generator and receives its own generated model. The final Node timing refresh explicitly checks those input hashes against the map proof; Chromium's independent map proof covers the same generator inputs. This gives the implementations comparable initialization and type feedback. Chromium uses elapsed time for calibration because it has no thread CPU counter.

Two timing problems were corrected before the final table: single calls were too short for Windows CPU accounting, and an early batched pass had warmed only the baseline generator. Unchanged drought-code controls exposed that second bias. Those superseded rows are preserved in `results/timing-controls-before-refresh.json`; the final table requires the corrected `batched-500ms-v3` method for all 18 sets. `stages.mjs` refreshes only timing and retains the completed cycle proof.

Each cycle probe is measured once per variant; the six probes sum to 73 simulated days. Reported cycle totals include construction and the reference's daily/phase-boundary `Measures.sample` calls, but exclude generation, frame encoding, serialization, file I/O and the investigation's array copies, comparisons and hashes. Each bundle receives its own independently generated map, since the entity format's `F32` wrappers use class identity. Simulation-only timings are retained separately in the JSON.

Node benchmarks record wall time and the executing worker's thread CPU time. Both the independent map proof and the final matrix use up to three workers, with variants run sequentially within each map. A shared integer job counter distributes independent maps; it does not parallelize a simulation. A proof run with a long worker tail was resumed using this queue, retaining completed matching-build results. Earlier serial generation/profile records use process CPU time. Thread accounting excludes other workers and background V8 threads. Windows CPU accounting is coarse, particularly for millisecond drought calls; small CPU differences are not conclusive.

Other work runs on this shared machine, and wall/CPU gaps were very large even with one worker. The final matrix therefore uses up to three computational workers, with thread CPU ratios as the primary computational comparison. Wall times are contention-affected observations, not credible idle-machine speedups or budget passes. Run `MATRIX_WORKERS=1` with `--force` on a quiet host for a serial wall-time replication. Once only the final cycle case remained, two free worker slots ran the drought-profile refinement and the initial timing refresh. The corrected final timing refresh runs with three workers after all cycles finish. Each timing record retains its worker count; completed cycle evidence is preserved.

The later exact-cycle supplement overlaps the original Chromium matrix. Each separate runner uses three workers, so the combined background load can be higher than three. This does not affect exactness comparisons; it reinforces why browser elapsed-time observations are not quiet-host performance guarantees. The main Node timing matrix finished before this supplement began.

`profile.mjs` separately profiles the baseline for all themes and sizes: canonical settle, warm preview, thirty analytic drought calls, and the first day of each weather probe. This is a six-day representative cycle profile; the separate benchmark executes all 73 days. The full matrix uses method wrappers with wall-clock self/inclusive time and call counts, plus workload CPU time (process time for initial serial records, thread time for the remaining worker records). It instruments the water tick, flow, active-list, evaporation and neighbour-count methods and the cycle tick/life update; it deliberately avoids a timer on each tile's `satAt` call. Work outside timed entrypoints is reported as a remainder; inner code without its own wrapper remains in its parent's self time. No function attribution is guessed. Timers and wrappers affect JIT/dispatch cost, and wall times include host descheduling: use these profiles to locate work, never as speedups.

Initial V8 sampling at 1 ms, followed by a 5 ms attempt, stalled or added substantial overhead on this host. Partial samples are retained in `results/v8-diagnostics/`; `profile-v8.mjs` retains that optional sampler. They are not counted toward the complete matrix. The full instrumented profiles and the performance benchmarks run in separate processes, so wrappers never affect the speedup measurements.

The first method profile left analytic drought entirely in the remainder: it calls the separate `spillLevels` and `clusterSaturation` functions, not `WaterSim`. The refined profiler wraps those module exports and `droughtStorage` in a diagnostic-only copy of the baseline bundle. No numerical expression changes, and each instrumented generated file must match the already-proved baseline SHA-256 before profiling. Its bundle hash is recorded. Existing water/cycle method profiles remain valid; every drought profile is refreshed with the function breakdown. The seven proof/performance bundles remain untouched.

## Chromium execution

The Windows execution environment rejects Playwright launch with `spawn EPERM`. Direct launches of installed Chrome and the official Chrome Headless Shell 145.0.7632.6 fail creating a Mojo communication channel with `Access is denied (0x5)`. Initial browser-surface requests also timed out. These unsuccessful attempts are retained in `results/chromium-blocker.json`; they are not parity evidence.

The browser surface subsequently became available. `browser-server.mjs` serves an investigation-only page on loopback, opened in the existing Chrome 153 browser. It first requires the golden digests to match Node, then runs three module Web Workers over the same 216 maps and 18 stage/cycle cases. A worker cannot save a pass: the Node controller validates returned results against the existing Node records before writing them. `summarize.mjs` independently rechecks all saved cross-runtime hashes. Browser performance uses elapsed time and the same three-batch method, without CPU counters; its ratios are reported separately because the host is shared.

## Reproduction

Run from `investigation/simspeed/` with Node 24:

```sh
npm ci --ignore-scripts --cache .work/npm-cache
node prototype.mjs
node bundle.mjs
node typecheck.mjs
node verify.mjs
node profile.mjs
node bench.mjs
node stages.mjs
node browser.mjs
node summarize.mjs
```

If launching a browser process is unavailable, replace `node browser.mjs` with `node browser-server.mjs`, open its printed loopback URL in Chromium, and leave the tab open until it displays **PASSED**. Then stop the server and run `node summarize.mjs`. This alternative was used for the checked-in Chrome run. `--force` reruns all browser records; otherwise matching-build records resume. It exposes no public service and never touches a saved game or installed mod.

Run the independent late-arriving exact-cycle supplement using the commands in [EXACT-CYCLES.md](EXACT-CYCLES.md), including `node bundle-exact.mjs`, `node exact-bench.mjs`, `node browser-server.mjs --exact`, and `node summarize-exact.mjs`. It does not replace the original seven-implementation proof.

For the follow-up, run `node bundle-m9.mjs`, `node m9-bench.mjs`, `node browser-server.mjs --m9` and `node summarize-m9.mjs`, as described in [M9-PIPELINE.md](M9-PIPELINE.md). Run `node summarize.mjs` after both supplements to refresh the overall acceptance status. Each M9 runtime is serial; the browser queue waits for its matching Node oracle record before dispatching a case.

Install Chromium with `npx playwright install chromium` on a host that permits subprocesses; set `PLAYWRIGHT_BROWSERS_PATH` to this folder's `.work/browsers` for both installation and execution. `CHROMIUM_PATH` can instead select an existing Chromium executable; `CDP_URL` can select a separately launched test browser. Existing successful per-map results are resumable only when their bundle fingerprint matches; use `--force` to regenerate them. Set `VERIFY_WORKERS=1` for a serial proof run. `.work/` is ignored. The browser runner requires matching Node result records first. The supplied commands require Node 24.13 or later for thread CPU accounting.

## Deferred approaches

Do not freeze a region merely because canonical settle passed: that threshold allows ongoing movement, and the cycle study measured continued drift. A safe regional cache would need to preserve momentum, evaporation, sources, seeps, contamination, and every neighbour dependency; no such proof is supplied here. Once-per-tick active lists, changed time steps, float32, tolerance equality, reordered sums and fused multiply-add are excluded. WASM is deferred until a JavaScript profile justifies the extra port and cross-engine proof effort.
