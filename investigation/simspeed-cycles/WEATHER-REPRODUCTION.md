# Reproducing the exact-weather follow-up

Run from `investigation/simspeed-cycles/` with Node 24.13 or later. The private package owns all dependencies; no root installation or config changes are needed. The committed reference copies pin current dev at `948f395137a6725d4b726864a47e6966d7f2f09a`.

```sh
npm ci --ignore-scripts --cache .work/npm-cache
node weather-wasm.mjs
node weather-prototype.mjs
node weather-build.mjs
powershell -NoProfile -File weather-audit.ps1
node typecheck.mjs
node weather-boundaries.mjs
node weather-run.mjs --smoke
node weather-profile.mjs
node weather-profile.mjs --full
node weather-run.mjs
node weather-browser-server.mjs
```

Open the printed loopback URL in Chromium and leave it open until **PASSED**. The page first checks the boundary/dependency proof against Node, then runs the whole six-implementation matrix. It waits for matching Node records before dispatching a browser case. The Node controller independently validates every returned digest before saving it. Stop the server after completion. Direct browser spawning is unavailable in this execution environment; the existing Chrome browser runs the localhost page in four Web Workers.

The continuous-product experiment is separate:

```sh
node weather-product-run.mjs
node weather-browser-server.mjs --product
# Open this server's loopback URL; wait for PASSED and then stop it.
node weather-product-report.mjs
node weather-summarize.mjs
node weather-report.mjs
```

`WEATHER_WORKERS` selects 1–8 Node proof/product workers (default 4). `MATRIX_WORKERS` selects 1–3 diagnostic-profile workers (default 3). The checked-in full-duration profiles and continuous Node run use one worker each; proof runs use four per runtime. The product browser uses one worker. Environment records describe overlap; a quiet-host latency replication should run these stages sequentially with one worker. Windows CPU accounting is coarse; long probe totals are the computational comparison, not individual near-zero tick timings.

`--force` replaces cached matching-build records. Otherwise completed records are reused only if the complete bundle fingerprint matches. The `--pilot` proof option restricts work to the six 96² maps; the earlier JavaScript-only pilot is preserved separately in `results/weather/pilot-before-wasm/` and is not counted as final proof. `.work/`, dependencies and unfinished `.partial` files are ignored. Browser results cannot pass unless they match the Node reference records for the same inputs and build.

The generators rewrite only prototypes and artifacts in this investigation. `weather/kernel.ts` is AssemblyScript, compiled by the pinned compiler; the normal TypeScript check deliberately covers the JS adapters and model modules instead. `kernel.wat`, the encoded binary and `results/weather/compiler.json` record the strict scalar build. The source audit extracts the pinned Git revision only under `.work/`, compares all copied modules and generator dependencies, verifies frozen source/bundle hashes, and reassembles the retained WAT to check its binary SHA. The final report generator refuses an incomplete matrix. Do not turn on fast math, change precision, change the reference, or update expected hashes to work around a failed comparison.

The prior investigation is already on dev and supplies the historical export SHA oracle at `../simspeed/results/node/maps/`. The follow-up branch base is `652774175c08b46b40c01536ee3d08a83cbe98d6`; the pinned weather/source graph is identical there. No previous-study file is edited.

The unapplied `weather/proposed-weather.patch` contains four blank context lines with the leading space required by unified-diff syntax. Git's outer whitespace check flags those literal artifact lines; preserve them. All other investigation files pass the whitespace check, and `weather-propose.ps1` verifies the patch with `git apply --check` against isolated reference copies.
