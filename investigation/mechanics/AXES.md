# Strategy axes and measurement contract

An axis is a family of related measurements, not a quality score. More is not always better.
The baseline uses `measure.ts` and the repo's analysis. All quantities describe the accepted map.
Failed attempts and final failures are retained, rather than silently selecting nicer seeds.

## Eight axes

| Axis | Opposing opportunities | Baseline fields and units | Needed before a stronger claim |
|---|---|---|---|
| Storage work | Water already held ↔ water that needs engineering | `storageRatio`: clean water retained after 9 drought days within 40 chamfer tiles / 201.4 m³ (50 × 0.424 × 9.5). `shortestAdequateDam`: fewest tiles among sampled dam sites meeting the map's reserve target, within 40 chamfer tiles; null means none found. | Retention is an upper bound: no pumping, intake access, consumption or badtide protection. Dam volume is a hypothetical crest, not a built dam. Verify project access and usable storage by faction. |
| Power location | Flow beside accessible land ↔ power away from the opening | `peakAxialFlow64`: largest net stored outflow along one axis at a wet tile beside safe dry ground within 64 walk units, m³/s, counted only above the wheels' 0.15 cut-off. `compactWheelHp64` = ceil(120 × that); `waterWheelHp64`: the best Folktails two-cell pair on one bed level, ceil(270 × \|mean\|) (V U01). Also `waterfalls`, `geothermal64`, `nearestGeothermal`. `peakCleanFlux64`, the old four-outflow sum, is kept only for comparison: it overstates power. | The hp values assume a legal wheel fits there; footprint, bed level, clear height and flood clearance are not checked. Settled flow is temperate flow; wheels stop in drought. A geothermal field needs construction; do not credit 400 operating hp at map start. |
| Land and height | Broad connected ground ↔ small shelves joined by links | `flatDry40`: clean dry ground reached without slopes within 40 walk units. `linkedDry40`: same with slopes; `flatAccessShare` is their ratio. Also global `heightRange` and `flatShare`. | Includes land that needs clearing and single cells unsuitable for buildings. Add buildable footprints and costed new connections; high relief alone is not difficult access. |
| Fertile land | Persistent nearby growing land ↔ irrigation and land competition | `fertile20`: safe reachable, clean, dry moist tiles within 20 walk units. `fertileEmpty20` excludes all object footprints. `fertilityPersistence`: fraction of `fertile20` still moist using analytic nine-day retained water. | Does not simulate consumption, planting, harvests, new irrigation or soil recovery. No crop capacity or food guarantee: V U03 gives the yields, but the food schedule and margin are play (U04, U09). |
| Threat exposure | Close badwater/routes at risk ↔ a sheltered opening | `badwaterDistance`: existing minimum chamfer distance to badwater or contaminated soil. `safeLost40`: otherwise reachable clean dry tiles no longer reached within 40 after excluding contaminated water. | No current threat is not no future badtide. Add time-to-impact, safe travel weights, diversion and reservoir contamination scenarios. |
| Resource timing | Large accessible stock ↔ a need to expand and renew | `logs20`: mature Pine/Birch/Oak log stock within 20 safe walk units, including `deadLogs20`. `readyBerries20`: mature living bushes with explicit ripe progress, goods. `scrap40`, `science64`, `mines64`. Also validator living trees and bushes. | Resource stock is not hourly delivery. Distances are from the start, not a placed work building; every scrap is its own round trip (V U07), and build/haul schedules are play (U04). |
| Expansion choice | One outgoing region ↔ several routes with different rewards | `frontierComponents`: connected clean dry regions of ≥64 tiles remaining after removing the inner 20 safe-walk area; only tiles within 64 remain. `frontierSectors`: eight sectors with ≥64 land tiles, ≥300 scrap, any relic, field or mine approach. `directions` stores the separate rewards. | These are proxies. Ring cuts may split one route; two sectors may share a choke. Add region adjacency, minimal route cuts, new-link costs and reward types before promising independent choices. |
| Faction opportunity | Similar shallow intake access ↔ more deep intake options | `pumpShore2` and `pumpShore6`: safe clean dry shore tiles within 40 walk units adjoining clean water ≥0.3 deep whose surface is at most 2/6 below shore. `deepPumpExtraShore` is their difference. | Counts candidate shore cells, not legal pump buildings or usable volume. The opening still passes the two-level rule. No holistic faction winner. V U01/U03/U10 list the wheel, food and wind differences; how they add up is play. |

Sources for game interpretations: [CATALOGUE.md](CATALOGUE.md), especially 01–10, 15–22 and 25.
The baseline's thresholds below are analysis choices, not game rules, except the wheels' 0.15 cut-off.

## Shared definitions and caveats

- Use the canonical settled water returned by generation. Wet land exclusion uses depth >0.05; clean water uses contamination <0.05.
- Safe walking excludes water deeper than 0.05 with contamination ≥0.05. Dry contaminated soil is excluded from fertile/usable land, but is not a walking obstacle.
- Walking uses `analysis/walk.ts`: same level, no corner-cutting, diagonals cost √2, slopes cost 1. The limit is raised to 128 for later objectives. A 20-unit radius is not the game's building-centred 20-move resource search (N §1d).
- Block footprints use `footprintTiles`. The base analysis blocks Blockage rather than modelling its walkable top, which V U08 confirms. It does not model roofs, player buildings or newly built roads.
- Objective access is a safe four-neighbour at the object's base level, plus one distance unit. This is a conservative approach proxy, not proof of a valid entrance or road spill. Ruins allow eight neighbours in the notes, and relics may have higher access.
- `naturalStorage` from the existing validator includes retained water without a clean filter; this study adds `cleanRetained40`. Both use chamfer proximity, not pump access.
- Fertile area includes cleared potential; the separate empty count shows immediate free cells. Moisture after drought uses current water concentration; it does not model a badtide.
- Null distance means no qualifying site within the search limit. Null is never silently zero. Missing dam candidates mean “not found by this sampler”, not “impossible”.

## Spread and clustering

Report each theme separately and all 180 together. Use min, p10, median, p90, max with linear quantile interpolation;
list null counts, retries, blocking failures and advisory misses. Thirty seeds is a baseline, not D109's 200-seed acceptance.

Use these fixed physical bins to expose repeated openings. They are chosen before reading batch results:

| Field | Internal bin boundaries (left closed, upper open) |
|---|---|
| `storageRatio` | 0.25, 1, 3 |
| `peakAxialFlow64` | 0.5, 1, 2 m³/s (replaces the old `peakCleanFlux64` bins in measurement version 3) |
| `flatDry40` | 150, 500, 1,200 tiles |
| `fertilityPersistence` | 0.25, 0.75 |
| `badwaterDistance` | 15, 30, 60 tiles |
| `logs20` | 80, 160, 320 logs |
| `frontierComponents` | 1.5, 3.5 regions |
| `deepPumpExtraShore` | 0.5, 10, 50 shore tiles |

A joint signature is the eight bin IDs. Report the largest identical-signature share, the largest marginal
bin on every axis, and pairwise distance: mean absolute difference of bin IDs divided by each axis's maximum
bin ID. Null is a separate state: equal nulls have zero distance, null versus a number has distance one.
Report nearest-peer distances too. Equal bins do not mean byte clones or identical play.

Sensitivity uses boundaries ×0.8 and ×1.2, including the region boundaries; this deliberately tests the
classification's fragility. Keep the baseline bins fixed across future runs; do not fit per-theme quantiles.
Absolute compass rotation is absent from this signature so rotating a map cannot earn play variety alone.

The future M9 metric should replace these proxies with a graph of feasible actions and their consequences:
first intake, first storage project, persistent farm land, first threat, and distinct outgoing rewards.
Keep an explicit “unknown” state wherever access or timing is not verified. Use D109's ≤15% opening-cluster
ceiling only after defining and testing that richer clustering rule; the diagnostic bins here do not certify it.
