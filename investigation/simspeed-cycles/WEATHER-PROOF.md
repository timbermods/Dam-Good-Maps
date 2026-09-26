# Exact-weather equivalence arguments

The follow-up initially pinned dev at `948f395137a6725d4b726864a47e6966d7f2f09a`. PR #17 was later merged externally, so the authorized fallback moved this work to `investigation/simspeed-cycles`, created from dev `652774175c08b46b40c01536ee3d08a83cbe98d6`. The weather code and all core dependencies are unchanged between these revisions. Rebuilding in the new folder gives the identical bundle fingerprint; completed proof records were preserved byte-for-byte and unfinished cases resumed. The six modules in `weather/reference/` copy that revision's `investigation/cycles/`, changing only imports and line endings. [FIDELITY.md](weather/reference/FIDELITY.md) is copied unchanged. The eighth reference input is the pinned `src/core/format/world.ts`, whose soil reader is required by the exact model. The source audit checks these copies and the complete generator/model dependency graph against the pinned revision.

The target is the reference's generated heightfield model with finite, nonnegative depths and concentrations in [0,1], immutable geometry during a run, and the normal file-loaded initial state. The study does not claim agreement with the game's float32 water arithmetic: the reference uses binary64 water and float32 soil. Roofed water and changing terrain remain rejected by the reference. No game, installed mod or save is accessed.

## Tick order, scheduling and random streams

`model.ts`, `weather.ts`, `measures.ts`, `stretch.ts`, the RNG, and deterministic-math functions are not optimized. The clock and its events, source snapshot, evaporation swap, plant observation of last tick's soil/water, source component updates, soil pass, then two water substeps retain their exact order. Evaporation retains its two-tick-old meaning. Every directional floating-point accumulation retains −y, −x, +y, +x order. The soil's distinct water-neighbour and eight-neighbour orders are also retained.

Weather plans still draw from the reference's seed 1729; plant delays still draw from `hash(seed, plant id, 'survival')` with plant seed 1729. Map seeds 1–30 vary the generated maps. The unchanged schedule and constructor draw code preserves the number and order of draws, including the probability-one no-draw rule. No prototype introduces a random draw or uses wall time to advance simulation time. Checkpoints include the complete plans/clock and every plant's randomized timer state, death time and cause.

## 1. Sparse contamination support (`water-sparse`)

Only the two contamination passes may skip cells. Hydraulics, evaporation, source bookkeeping, active-list construction and its ordering, and wet-list updates remain unchanged.

At the start of contamination mixing, mark every active cell with nonzero contamination, and expand its support by two cardinal edges. Negative zero is explicitly marked too. Mixing can receive contaminated mass from one neighbour only; it cannot make a nonzero mixed buffer outside the first expansion. Diffusion reads those completed mixed buffers and can reach one further edge only. Therefore a cell outside the second expansion has positive-zero old contamination, positive-zero mixed concentration, and only positive-zero mixed neighbours. Its final concentration is positive zero after the reference's operations.

Cells outside that support still have their temporary buffer cleared, and dry cells still have contamination cleared. Their diffusion flags/counts are disposable scratch: each active cell resets them on the next substep. A neighbouring live calculation divides by a neighbour's count only when that neighbour has a greater mixed concentration; a skipped neighbour has zero concentration and cannot satisfy that condition. The reference's clamped mixed buffers are nonnegative. Thus skipping its flags/counts cannot alter a retained calculation. Counts and flags themselves are not claimed identical; all state used by a later tick and every requested result are.

The reference's active-set invariant is important. Starting from its file state, cells outside the active set are dry, have no newly computed flow and cannot supply contaminated water. Source cells are always active. This argument is not a promise for externally corrupted private buffers or arbitrary injected outflows. Future integration should retain the reference path for unsupported input modes rather than broaden the contract silently.

If initial contaminated seeds exceed a quarter of the active set, the prototype runs the complete reference passes. That threshold chooses between equivalent implementations; it changes no physics. Marks/frontier cost eight bytes per tile (512 KiB at 256²). The temporary integer stamp resets before overflow. Connectivity is rebuilt from the current state on every substep; this is not a settled-region approximation.

## 2. Soil descriptor reuse (`soil-cache`)

The reference already has exact dirty-tile tracking. It nevertheless checks a tile twice when it is in both current and previous wet lists, then recalculates its descriptors a third time to remember them.

The first check makes every required `add`/`addC` call. The repeated check would see the same current and remembered values and repeat only stamp-deduplicated additions. Skip that duplicate. After all comparisons for one tile, retain the exact `wet`, `c`, `surf`, `depth`, `give`, `bad` and saturation values already calculated. No other tile's check reads these private descriptors, so publishing them then cannot change another check. Previously wet tiles are checked separately only when now dry; their zero/dry descriptors are retained too.

The initial or `full` pass still initializes descriptors with the reference loops, since it does not run the normal checks. The dirty lists retain the same first-add order. All moisture/candidate calculations still read last tick's arrays, all changed values are collected before publication, and contamination levels advance afterwards. Every `Math.fround`, comparison and arithmetic expression in the actual soil calculations remains unchanged. This adds no per-tile storage.

## 3. Incremental saturation (`soil-saturation`)

The wet predicate is the same `D[i] > 0`. A wet-neighbour count can change only for a cell whose own wet bit or one of its eight neighbours changed. Recompute those cells with the original count loop. The count is an integer in [0,9]; no floating-point accumulation is rearranged.

Saturation can change only for a cell whose own count or one of its four cardinal neighbours' counts changed. Finish every affected count before reading any count for saturation. Use the original per-tile comparison order and cap. Dry cells retain zero. All other counts and saturation values are exactly their previous values because their complete inputs are unchanged.

The ascending wet-list scan is retained, as are all evaporation writes. In particular, the two alternating evaporation buffers are not treated as though both contain last tick's value. Two byte marker arrays and two Int32 work lists cost ten bytes per tile (640 KiB at 256²). The markers clear as work is consumed. This candidate can lose time on changing wet boundaries; correctness does not establish a speed benefit.

## 4. Scalar WebAssembly water (`water-wasm`)

[weather-wasm.mjs](weather-wasm.mjs) extracts the reference's outflow, depth/momentum, mixing and diffusion expressions into [kernel.ts](weather/kernel.ts). The changes are explicit scalar types, integer indices/addresses and typed loads/stores. Water, intermediate arithmetic and all four-direction sums remain binary64. Sources, wet/active ordering and the two-substep driver stay in JavaScript. The original JS substep is retained for the historical bookkeeping/contamination switches.

Each simulator owns one instance and one allocated block. Typed views alias its linear memory, so no per-tick JS/WASM state copy occurs. Allocation and initial byte-preserving copies happen in the constructor and are timed. Allocation completes before views are made; kernels never grow memory or allocate. Floors and dam heights are copied under the model's immutable-geometry contract. Discard the instance when discarding the model.

This prototype is not a memory reduction: most views replace the original allocations, but it copies floor/dam arrays that the JS reference shares with the model. Those extra two float64 arrays cost up to 1 MiB at 256², in addition to linear-memory page rounding. Initial JS arrays also remain temporarily until garbage collection. Combined support/saturation work adds a further 1.125 MiB at 256². Production allocation directly into WASM memory could reduce the transient copies, but that would be a subsequent integration change requiring its own checks.

Compiler arithmetic needs explicit handling. AssemblyScript 0.28.20 changes Binaryen's global fast-math setting. The first attempt detected that setting and was rejected before use. The retained build emits at optimization level zero, then explicitly sets Binaryen fast math to **false** before its level-three optimization. The flag is asserted afterwards. [compiler.json](results/weather/compiler.json) records options and the binary SHA; [kernel.wat](weather/kernel.wat) retains the final scalar instruction tree. The build rejects float32, SIMD and relaxed-SIMD instructions. There are no fused multiply-add instructions, regrouped sums or approximate transcendental functions in the kernel. The explicit float64 division in `1 / count` prevents accidental integer division.

The compiler API and runtime choices follow the [AssemblyScript compiler documentation](https://www.assemblyscript.org/compiler.html) and [stub-runtime documentation](https://www.assemblyscript.org/runtime.html). Fast-math policy is additionally enforced by the local Binaryen API calls and the emitted-code inspection, rather than assumed from a default. These settings, source arguments and raw-byte tests are all required; “WASM is deterministic” alone would not prove equivalence to the JS reference.

## Combined and evidence

The combined variant uses all four changes: WASM hydraulics and contamination, the conservative contamination support, soil descriptor reuse and incremental saturation. Individual candidates are measured separately. No product scheduling or cache changes are included in these speedup ratios.

The main matrix independently generates 204 maps in each of six bundles: all six themes with seeds 1–30 at 128², seeds 1–3 at 256² and seed 1 at 96². Every input export is nonempty and byte-identical, and its SHA matches the preceding independent generator proof. Every native day boundary and phase boundary compares raw typed-array bytes within the runtime, including signed zero. Node and Chromium compare SHA-256 of those same raw arrays, not rounded depths. Checkpoints include depths, contamination, old depths, momentum, flow buffers, mixed buffers, both evaporation buffers, soil moisture/contamination/candidates, saturation/counts and soil input descriptors, plus clock, sources, plants and every Measures summary/first event.

Summary and plant code is unchanged and consumes identical arrays in identical order. The record compares its serialized objects as well; equality is not inferred from a few headline statistics. Six Node 96² smoke cases additionally compare every tick of the first 160 ticks of all six probes. Twelve boundary/dependency cases compare 512 water ticks or soil steps each, including narrow maps, dams, source strength/contamination transitions, negative zero, barriers, full recomputation and local/wholesale wet-mask changes. The separate continuous-game experiment compares every daily/phase snapshot over 73 calendar days at both 128² and 256².

This is a local equivalence argument plus broad empirical proof, not exhaustive enumeration of malformed states, arbitrary mutation of private arrays, every JS engine or all IEEE NaN payloads. Node and Chromium are the requested acceptance engines. Firefox/WebKit and production integration checks remain subsequent gates for an actual implementation.
