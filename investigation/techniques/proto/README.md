# Two terrain experiments

Run from the repository root with Git and Node 24.13.0 (the tested version). No npm installation is needed.

```sh
git fetch origin a5f189d3e96affec533415090bdb8f09d606c8fd
node investigation/techniques/proto/check.mjs
node investigation/techniques/proto/run.mjs
node investigation/techniques/proto/run.mjs --verify
```

`m9.mjs` reads this repository's pinned M9 modules with `git show`, strips TypeScript using Node, and writes their runtime dependencies under `investigation/techniques/.cache/`. It never checks out that branch or changes source files. Fetch is needed only once if the object is absent. Node's type-stripping API emits an experimental warning on the tested runtime.

`techniques.mjs` contains both original experiments:

1. `spatialControls`: independent regional-height, relief and ridge/valley fields applied to M9 uplift, followed by the unchanged M9 erosion.
2. `constrainedLevels`: coherent contour offsets, protected-channel cleanup and bounded downstream cuts. Rejected proposals remain in the diagnostics and gallery, explicitly marked.

The fixed batch is 3 themes × 12 seeds × 2 caps = 72 cases, each with four outputs: baseline, spatial, before repair and proposed constrained result. Cap 16 uses M9's quantizer. The cap-22 baseline stretches M9's integer output; the new quantizer uses continuous heights. The contrast is deliberately limited, not an apples-to-apples production benchmark at 22.

`out/results.json` stores every case and summary. Its SHA-256 covers terrain buffers and example PNGs. `--verify` regenerates them in a fresh process and compares the full deterministic JSON, without overwriting results. Timings are separately stored because they vary between runs. `check.mjs` adds basin, flat-routing, level-cap and excessive-repair fixtures.

`render.mjs` is our small asset-free isometric renderer. Open [the gallery](../out/gallery.html) for paired maps; Markdown previews are in [REPORT](../REPORT.md). Blue is candidate drainage, **not simulated water**. Terrain colors show height, **not soil moisture**. No slopes, starts, plants or caves are placed; these are research heightfields, not playable `.timber` exports.
