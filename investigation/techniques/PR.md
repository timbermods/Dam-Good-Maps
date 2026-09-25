## What this adds

A practical, cited map-generation playbook answering seven design questions for Dam Good Maps, with proposals for M9 and future voxel/multiplayer work. All files are under `investigation/techniques/`; production code is unchanged.

## Top five techniques and fit

1. **Independent spatial controls** — M9 genome and uplift; vary regional elevation, relief and ridge/valley bias independently.
2. **Erode before snapping, with protected contours and channels** — M9 erosion, level quantization and hydrology; preserve meaningful structure at 16–22 levels.
3. **Guaranteed starts with opportunity vectors** — settler/start rules, then future multiplayer; require essentials before comparing asymmetric opportunities.
4. **Density carving followed by exact support validation** — 3D terrain steps; caves, arches and tunnels must obey the three-sideways-step support rule.
5. **Rare traits with measurable consequences** — genome and derived names; create unusual decisions without fixed layouts.

## Experiments and validation

- Two prototypes reuse this repository's M9 numerical modules from pinned commit `a5f189d3e96affec533415090bdb8f09d606c8fd`, read from Git into an ignored local cache.
- 72 paired cases: three themes, seeds 1–12, 96², caps 16/22; 18 renders of our generated terrain.
- Adversarial basin/routing/cap/repair checks and fresh-process reproduction pass.
- Spatial-control diversity proxies are mixed. Channel repair removes uphill bed edges but loses falls; only 31/36 proposals at cap 16 and 17/36 at cap 22 meet the cut budget. Rejected proposals remain visible.
- M9 v1 is capped at 16. The 22-level baseline is an explicitly limited experimental extension.
- No gameplay, water-settle, multiplayer-fairness or full M9 acceptance claim. No external game/tool code, data or assets copied. Public explanations are cited with evidence limits.

Checked `git diff --name-only dev...HEAD`: every changed file is inside `investigation/techniques/`.

Leave this PR open and unmerged. No approval, auto-merge, release or deployment is requested.
