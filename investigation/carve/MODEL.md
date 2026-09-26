# Model notes

The physical ideas are stream power, finite sediment transport capacity,
gravity-driven bank failure, bend momentum and differential rock resistance.
The coefficients are tuned for readable, whole-level editing, not physical
seconds or measured rock units.

## Reuse and alignment

The runtime directly imports M9 v1's priority flood from
investigation/generative/proto/erode.ts. This identifies basins without drawing
a river path. The repository WaterSim supplies discharge, head and momentum;
its flow chooses the actual channel. The final result comes from canonicalRun.

Read-only reference: investigation/generative-v2 at
c77026b271519290ab6dd9b4a9c29890e822fd2f, specifically
investigation/generative/v2/field.ts, levels.ts, hydro.ts, terrain.ts,
REPORT-v2.md, and docs/m9-design.md. There is no directory named
investigation/generative-v2 in that branch; v2 lives under generative/v2.

The reference uses implicit stream power with exponents m=0.5, n=1.
Its erodeHard scales incision by (1 - 0.85 * hard) and diffusion by
(1 - 0.8 * hard). This prototype uses exactly those resistance factors for
incision and slumping. It replaces drainage area with actual water discharge
and turns fractional work into whole-level cuts. Horizontal beds at surface
levels 4, 8, 12, 16 and 20 have hardness 1; intervening layers have hardness 0.
No random per-tile geology is introduced.

V2's broad weathering and elevation rescaling are not applied to an edited map.
Only water-reached ground and its failing banks change. The source front moves
at most one flowing neighbour per erosion step. Four-way routing matches the
game. M9's pit/spike cleanup can raise or lower a tile; this prototype instead
rejects proposals that would create an isolated extremum, preserving direction.

## Process order

1. Advance the real water simulator four ticks, independent of playback speed.
2. Extend the placed source's reached front through actual outgoing flux.
3. Read discharge Q and outgoing-flux-weighted hydraulic slope S. Incision work
   is proportional to sqrt(Q) * S above a small threshold. Deep basins suppress it.
4. Add local bank weathering above repose (one level wide, three steep, plus one
   at hard beds). Already cut banks propagate retreat to their neighbours.
5. Compare incoming and outgoing momentum. At a turn, the incoming continuation
   wears the bank on the outside. Existing bends therefore grow without a
   noise-driven steering line.
6. Advect up to 85% of each cell's sediment along actual outflow fractions.
   Dry slumped material falls toward a lower neighbour. Export only crosses a
   draining map boundary. Transport capacity increases with discharge and power.
7. When excess load can raise a submerged slow cell by one whole level, deposit.
   No sediment is invented: deposited volume comes out of that cell's load.
8. Reject changes on protected ground, against an established direction, outside
   the map's height range, or creating new single-cell extrema. Apply the batch.
9. Remove plants on changed ground. Sources stay attached to ground; fixed
   objects, the start footprint and the start's supporting ring are protected.

The last step is always a fresh canonical solve from the repository prefill,
not a warm-start approximation. Suspended sediment is diagnostic only and is
not silently deposited at Stop. Exported sediment remains in the ledger.

## Reading

- [Braun and Willett, 2013](https://doi.org/10.1016/j.geomorph.2012.10.008):
  the implicit stream-power method cited by M9.
- [Hergarten, 2020](https://esurf.copernicus.org/articles/8/841/2020/):
  a transport-limited erosion formulation, useful grounding for the distinction
  between incision and sediment capacity.
- [USGS, Meander](https://www.usgs.gov/educational-resources/find-feature-meander):
  outside-bank erosion and inside-bank deposition move bends.
- [USGS, fluvial sediments](https://www.usgs.gov/publications/fluvial-sediments-a-summary-source-transportation-deposition-and-measurement-sediment):
  transport and deposition at slower reaches and reservoir/lake entrances.

These references motivate the model. They do not validate this prototype's
coefficients or its game-scale results.
