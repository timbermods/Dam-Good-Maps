# Real landscapes for Dam Good Maps

Work in progress. Base: dev at cfa5990caeaf462de695caf428280da55fc0f7f5.

## Decisions

- Keep the survey, dependencies, cache and results in this folder.
- Use 400 named centres across 20 families, plus 50 seeded random land centres.
- Cross 96, 128 and 256 tiles with 30, 60 and 120 metres per tile.
- Compare linear, compressed and relief-normalised heights at 16 levels. Use relief-normalised 22 levels as a comparison only.
- Keep every attempted conversion, including failures. A failed patch still informs terrain statistics.
- Use the unchanged TypeScript simulation and generate-profile validator. Record advisory failures separately.
- Find starts on existing level ground. Do not flatten a start pad or stamp rivers into the terrain.
- Sources describe inferred drainage, not observed discharge. The DEM cannot establish springs or river water levels.
- Treat real terrain as process evidence and test fixtures. Never use it as a generator template.
- tools/gen.ts only exposes the default theme. Run it for the default baseline, and call the same generate API for the other themes.

Results, limitations and run instructions will follow each phase.
