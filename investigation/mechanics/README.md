# Mechanics investigation

Read [REPORT.md](REPORT.md), then the [verified facts](VERIFIED.md), the [catalogue](CATALOGUE.md), [axes](AXES.md),
[baseline](BASELINE.md) and [M9 proposals](M9-PROPOSALS.md).
[INTEGRATION.md](INTEGRATION.md) lists proposed changes outside this folder.

## Reproduce the baseline

Use `dev` at `cfa5990caeaf462de695caf428280da55fc0f7f5`, Node 24.13 or later.
Install only this folder's dependency:

```text
npm --prefix investigation/mechanics ci --cache investigation/mechanics/.cache --ignore-scripts --no-audit --no-fund
node investigation/mechanics/batch.mjs
node investigation/mechanics/summarize.mjs
node investigation/mechanics/verify.mjs
node --experimental-transform-types --disable-warning=ExperimentalWarning --import ./investigation/mechanics/runtime.mjs ./investigation/mechanics/check-measures.ts
```

On Windows, or if a sandbox blocks Node from launching a child process, run the shell entry point instead:

```powershell
& ./investigation/mechanics/batch.ps1
```

Both entry points execute `tools/gen.ts` for each of six themes, seeds 1–30, 128², Normal defaults.
The CLI lacks a theme argument. `runtime.mjs` adds the theme to its `makeSpec` call in memory and routes its
`generate` import through `observe.ts`. The observer calls the real generator, records its result, and returns it unchanged.
The loader checks both exact source strings before adapting them. It never writes to the CLI or `src/`.

The usual `tsx` child-process launch was blocked in this environment. The measured run used Node's TypeScript
transform and an extension resolver instead. `fflate` 0.8.2 was copied from an already installed investigation
into this folder's ignored dependencies. The root package requests a newer version; the leaf version is pinned
and recorded because compression may affect file hashes. Terrain, simulation and generation code were unchanged.

`results/maps.jsonl` retains each resolved spec, final check values, attempts, failures, map hash and metrics.
`results/summary.json` includes full ranges, clusters and sensitivity. `results/provenance.json` pins sources and runtime.
The CLI logs retain timings and map hashes; timings include the observer and are not a generator benchmark.
The 180 binary maps, intermediate rows and dependencies are ignored, all inside this folder.

The synthetic checks exercise the measurement's handling of mature/dead wood, JSON float wrappers, ripe berries,
missing sites, deep intake candidates and safe routes. `verify.mjs` checks stored data and locally present map hashes.
The standalone tests do not change production checks or claim in-game survival.
