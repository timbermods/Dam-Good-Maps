# Weather view: waiting times without changing results

## Two different views must stay distinct

The current study's “73 days” sums **six independent probes**, each loading the exported map at its own calendar date. It is not one game played forward for 73 days. Longer source ramps add lead-in days (the evidence retains those days). Reordering these independent probes is safe because schedules and plant RNGs are local, deterministic instances. It does not make a reset drought probe equivalent to the drought in a continuous journey. Label that UI as a scenario study.

For an actual forecast from a new game, all preceding ticks must run. The separate continuous experiment starts at the reference's 04:00 time and runs 73 calendar boundaries. With weather seed 1729, the first Normal drought ends at boundary 19; three recovery days finish at boundary 22. The first day has 640 ticks; the full run has 55,936 ticks. These runs compare baseline/combined daily arrays, plant state and summaries in Node and Chromium.

## Independent scenario study

Time to the **end of the first Normal drought**, and to the complete first-Normal probe including its three recovery days. “Old order” includes the preceding Normal-weather and Easy probes. Prioritizing the Normal-drought probe computes exactly the same scenarios, then reassembles results in their original display order. The full time is the sum of all original probes. Values are separate medians over available map/seed cases.

| Runtime / size | Baseline, old order: drought end | Combined, old order: drought end | Combined, prioritize Normal: drought end | Combined, prioritize Normal: recovery complete | Baseline → combined full probe set |
|---|---:|---:|---:|---:|---:|
| Node CPU / 128² | 12.41 s | 8.18 s | 0.72 s | 1.73 s | 26.27 s → 18.66 s |
| Node CPU / 256² | 43.22 s | 31.13 s | 2.71 s | 6.84 s | 91.99 s → 70.98 s |
| Chrome elapsed / 128² | 14.54 s | 9.00 s | 0.73 s | 1.77 s | 31.53 s → 21.42 s |
| Chrome elapsed / 256² | 43.17 s | 28.22 s | 2.55 s | 6.71 s | 96.64 s → 67.92 s |

## Continuous 73-day game

All six themes, seed 1, at both sizes. This is an additional measured workload, not a projection from the reset probes. Generation, proof copies/hashing and rendering are excluded; model initialization and every native Measures call are included.

| Runtime / size | Baseline → combined first drought end | Baseline → combined recovery complete | Baseline → combined complete 73-day timeline |
|---|---:|---:|---:|
| Node CPU / 128² | 8.02 s → 5.52 s | 9.37 s → 6.52 s | 28.58 s → 20.37 s |
| Node CPU / 256² | 30.42 s → 20.62 s | 35.58 s → 24.17 s | 111.30 s → 77.30 s |
| Chrome elapsed / 128² | 8.60 s → 7.45 s | 10.17 s → 9.37 s | 34.92 s → 26.25 s |
| Chrome elapsed / 256² | 30.90 s → 20.81 s | 35.95 s → 24.33 s | 115.58 s → 80.33 s |

Every theme, seed 1; medians above should not hide the slow maps:

| Theme | Size | Chrome combined drought end | Chrome combined recovery complete | Chrome full baseline → combined | Node CPU full baseline → combined |
|---|---:|---:|---:|---:|---:|
| riverValley | 128² | 6.06 s | 8.30 s | 25.80 s → 23.69 s | 22.05 s → 14.75 s |
| canyon | 128² | 4.14 s | 4.67 s | 23.05 s → 15.52 s | 14.31 s → 10.55 s |
| highlands | 128² | 8.85 s | 10.43 s | 37.64 s → 28.81 s | 26.81 s → 19.76 s |
| lakeBasin | 128² | 15.86 s | 18.44 s | 108.56 s → 60.94 s | 101.98 s → 49.28 s |
| islands | 128² | 19.70 s | 22.56 s | 127.49 s → 68.98 s | 126.63 s → 63.36 s |
| delta | 128² | 5.54 s | 6.50 s | 32.20 s → 19.46 s | 30.34 s → 20.97 s |
| riverValley | 256² | 15.86 s | 18.33 s | 89.17 s → 57.88 s | 87.89 s → 57.27 s |
| canyon | 256² | 10.72 s | 12.41 s | 47.68 s → 38.58 s | 48.33 s → 35.91 s |
| highlands | 256² | 18.39 s | 21.35 s | 107.85 s → 67.55 s | 99.56 s → 59.58 s |
| lakeBasin | 256² | 31.93 s | 37.01 s | 242.61 s → 116.84 s | 215.41 s → 115.05 s |
| islands | 256² | 41.98 s | 48.28 s | 373.56 s → 155.18 s | 318.08 s → 163.46 s |
| delta | 256² | 23.23 s | 27.32 s | 123.30 s → 93.12 s | 123.03 s → 95.03 s |

The exact-weather proof uses concurrent workers on a shared host. Continuous product runs record their own worker count and can overlap that proof. Browser elapsed values are observed compute waits under that load; Node CPU gives a computational comparison, not a universal latency prediction. They exclude transfer, renderer, storage I/O and cold application/bundle load. A target-device UI benchmark is still needed before promising those waits to players.

## Product changes, separately from physics speedups

| Change | Effect on a player's wait | Why results do not change |
|---|---|---|
| Show a loading/progress state immediately; use a worker | The page can respond while the measured computation continues. The first static map can render before any weather step. | Simulation remains isolated with the same inputs and clock. No main-thread tick loop. |
| Prioritize independent Normal-drought key days | Uses the priority columns above instead of waiting for the Normal-weather and Easy probes. Full probe-set compute is unchanged apart from scheduling overhead. | Only the order of independent model instances changes; each tick and each Measures sample remains intact. |
| Stream a continuous journey as days finish | First drought end and recovery arrive at the measured continuous times above; full 73-day completion still takes the full time. | Earlier days are simulated and measured, even if the UI only highlights key days. Do not load directly into the drought to skip its history. |
| Cache a completed timeline | A resident cache hit avoids all simulation. First-frame copy/parse cost is measured below, followed by transfer/paint. A disk/IndexedDB hit adds unmeasured I/O. A miss pays the normal cost. | Retain exact typed-array bytes and lossless metadata under a complete model/input/configuration key. |
| Start after the selected map finishes generating | With B seconds of useful background computation completed, remaining wait is approximately max(0, T − B), for each key-day/full-timeline T above. A 10 s useful head start subtracts up to 10 s; it is not a faster simulation. | Continue the same job; do not restart at a different calendar date or use warm-preview water. Other work can reduce the useful head start. |
| Yield/check cancellation between roughly 8 ms tick batches | Keeps worker commands responsive; adds scheduling overhead. If a yield costs h ms, an approximate full-compute multiplier is 1 + h/8. One tick, GC or scheduling can exceed the target. | Stop only between complete ticks. Wall time never advances weather, plant timers or seep frameSeconds. |

Never skip required daily/phase Measures calls to obtain a key day sooner: first-dry/bad/water-lost summaries depend on that sampling schedule. Transfer copied snapshot arrays, not the live model's arrays or WASM memory. Use revision tokens to discard stale results after edits. Background work should begin for the selected/accepted map, not every discarded M9 candidate. Keep an unchanged-JS fallback for devices where WASM startup or memory is unsuitable.

### Example: ten seconds of useful background work

These estimates subtract 10 s from each observed combined Chromium milestone, floored at zero. They assume that the background job makes the same progress per second; other generation/render work can reduce that progress. Zero means the computed result is already available, before transfer/render.

| View / size | Remaining wait for drought end | Remaining wait for recovery | Remaining wait for full result |
|---|---:|---:|---:|
| Prioritized independent scenarios / 128² | 0.00 s | 0.00 s | 11.42 s |
| Continuous 73-day history / 128² | 0.00 s | 0.00 s | 16.25 s |
| Prioritized independent scenarios / 256² | 0.00 s | 0.00 s | 57.92 s |
| Continuous 73-day history / 256² | 10.81 s | 14.33 s | 70.33 s |

With a fully resident completed-timeline cache, every cached day is already available without simulation. The measured cache operation below copies one selected display frame on demand; it does not copy or render the entire timeline.

### Optional parallel independent probes

Two workers could run independent scenarios concurrently, giving the first-Normal probe priority. The ideal full-result floor is max(total work / 2, longest probe). A simple list schedule starts that probe first, then schedules remaining probes longest-first. The following estimates reuse the measured per-probe durations and assume that two concurrent jobs retain those rates; worker startup, extra memory, CPU sharing and cache contention can invalidate that assumption. This controller has not been benchmarked, and these are not additional measured speedups. A single continuous history cannot parallelize its dependent days this way.

| Size | Combined serial probe set | Ideal two-worker floor | Ideal priority list schedule |
|---|---:|---:|---:|
| 128² | 21.42 s | 10.71 s | 10.98 s |
| 256² | 67.92 s | 33.96 s | 35.47 s |

Each worker must own its model, random streams, WASM instance and output buffers. Keep the native ticks and Measures calls within each probe, restore the original result ordering, and cap concurrency according to the device and timeline memory budget. The same independence argument carries over to stacked-layer scenarios; their memory cost may lower the useful worker count.

## Cache and scheduling micro-measurements

| Runtime / size | Key-frame bytes including metadata | Resident copy + parse | Mean self-message yield | 8 ms batch estimated overhead | Uncompressed timeline arrays |
|---|---:|---:|---:|---:|---:|
| node / 128² | 1369634 | 1.250 ms | 0.004 ms | 0.05% | 30.4 MiB |
| node / 256² | 3386269 | 2.266 ms | 0.003 ms | 0.04% | 121.5 MiB |
| chromium / 128² | 1369634 | 1.275 ms | 0.004 ms | 0.05% | 30.4 MiB |
| chromium / 256² | 3386269 | 2.450 ms | 0.005 ms | 0.07% | 121.5 MiB |

Copy/parse timings use an already-resident exact drought-end frame and parse its outer metadata object. Plants/clock/metrics remain their exact serialized strings at this stage; decoding those for rendering is additional work. This is not a storage benchmark. Self-message yields use 200 MessageChannel tasks in the executing worker; the batching percentages are estimates, not an implemented sliced-timeline benchmark. Cache-hit estimates assume the complete key is already available; key construction/hash and cache lookup are not benchmarked. For a cache-hit first paint, add the measured resident cost to actual transfer/render work; a provisional UI budget of 16–50 ms for transfer/paint would make that a tens-of-milliseconds interaction only when those assumptions hold. Slow storage or a heavy renderer can exceed it. Timeline-array memory excludes per-day plant/clock/summary metadata, which adds substantial storage; the key-frame column includes that frame’s metadata. Cache no more than a bounded number of maps and consider lossless compression/selected-frame retention; float64 water must not be downcast.

A cache key must cover more than the map's seed: exact map bytes, full simulation/analysis inputs used by CycleModel and Measures (including unrounded built water used for initial regions), terrain and entities, difficulty and full weather plan/seed, plant seed, frameSeconds, options, model/kernel version and sampling/summary policy. The current Measures constructor reads generator state beyond the rounded export, so `.timber` SHA alone is not a complete key for this API. Hash a canonical lossless encoding. Cache output timelines; resuming a live model from a display frame is not proved and would require its complete hidden state.
