# Pick a place: signature-water investigation

Plan the lake, fjord, coast or river first; put the start on its connected shore afterwards. Open Terrain Tiles elevation and ESA WorldCover water classification feed an isolated browser Worker. No game is launched and no production code is changed.

- [REPORT.md](REPORT.md): measured outcomes and comparisons.
- [MEASUREMENTS.md](MEASUREMENTS.md): all 50 places × 3 requested sizes, with water preservation beside playability.
- [INTEGRATION.md](INTEGRATION.md): proposals and the local code the milestone supersedes.
- [METHODS.md](METHODS.md): algorithm, limits and reproduction.
- [SOURCES.md](SOURCES.md), [ATTRIBUTION.md](ATTRIBUTION.md): data, browser access and portable notices.
- [Current examples](examples-signature/), [all current previews](results-signature/gallery.html).

Run `npm ci`, `npm run build`, then `npm run serve` here. Open http://127.0.0.1:4178 . The server includes a restricted local byte-range proxy for the water classification. That proxy is not deployed. `npm test`, `npm run survey` and `npm run summarize` reproduce the study.

The copied `results/`, `results-water/`, `examples/` and `examples-water/` are historical comparison evidence from the earlier investigations. The current outputs are `results-signature/` and `examples-signature/`. Every download requires both local playability and signature checks; these checks are not an in-game play test.
