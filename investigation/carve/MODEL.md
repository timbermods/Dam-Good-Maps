# Force model notes

This is an exaggerated editing tool motivated by fluvial processes, not a
calibrated landscape forecast. It replaces the earlier passive erosion model.

A continuous head moves 1.35 tiles every two steps. Its heading favors inertia,
downhill look-ahead and material it can overcome; Aim adds curved destination
guidance. Low Power pays more energy for rising hard ground. A finite travel
budget and explicit lake/edge/destination/resistance endings bound a run.
The brush follows a non-increasing floor, revealing cuts locally. Power sets
its width and depth. Trailing bank work makes a gorge or wider stepped terrace.

Whole-level work accumulates fractionally. Hardness scales channel work by
1 - 0.85h and bank work by 1 - 0.8h, matching the M9 v2 field.ts coefficients.
The default geology is four-level horizontal beds, offset by a deterministic
hash of the input heightfield. An optional map rockLayers array overrides it.
Coherent beds, bank targets and rejection of new isolated extrema keep the
surface ordered. The terrain can change only in its first chosen direction
during a run.

The carried debris budget counts every excavated block. At the receiving end,
a widening fan fills untouched adjacent ground by whole levels, leaving its
central channel open. Deposits cannot be recut in the same run. Fine load
that does not form terrain stays diagnostic; it exits only at a map edge.
This is a lumped transport model, not a sediment concentration solver or a
complete alluvial meander/oxbow model.

The head and muddy ribbon preview the force. WaterSim advances existing water
as the floor changes. The final retained source is a real Timberborn source;
canonicalRun chooses the final water from terrain and sources alone. Closed
basins fill. A dry canyon omits the new source. Exact history stores results,
so future changes to this algorithm cannot change replay.

M9 v2 was read only at c77026b271519290ab6dd9b4a9c29890e822fd2f:
field.ts, levels.ts, hydro.ts, terrain.ts and REPORT-v2.md under
investigation/generative/v2/, plus docs/m9-design.md. We share resistance and
landform principles, not its complete offline stream-power solver.

Background:
- [Braun and Willett, 2013](https://doi.org/10.1016/j.geomorph.2012.10.008), the stream-power method cited by M9.
- [Hergarten, 2020](https://esurf.copernicus.org/articles/8/841/2020/), transport-limited erosion.
- [USGS meanders](https://www.usgs.gov/educational-resources/find-feature-meander), bend erosion and deposition.
- [USGS fluvial sediments](https://www.usgs.gov/publications/fluvial-sediments-a-summary-source-transportation-deposition-and-measurement-sediment), sediment transport and deposition.

These sources motivate the processes; they do not validate this prototype's
coefficients or game-scale outcomes.
