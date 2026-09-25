# How the survey works

## Sample

`anchors.csv` names 100 regions in 20 landscape families. Each region contributes four centres: the anchor, 6 km east, 6 km north, and 6 km southwest on each axis. These are 400 sampling locations, not 400 independent landscapes. A family is a sampling stratum. A nearby window may miss its named feature.

Another 50 centres come from seeded rejection sampling against Natural Earth's 110m land mask. Longitude and sine of latitude are uniform, between 80° south and 80° north. This excludes polar terrain beyond that range. The mask is coarse; small islands and detailed coasts are underrepresented.

Every centre has nine windows: 96², 128² and 256² cells, crossed with 30, 60 and 120 m per cell. Ground spans range from 2.88 to 30.72 km. Four neighbouring windows and several scales often overlap. Never treat the 4,050 patches as independent observations.

One sampling error is retained openly: [Las Medulas is a Roman mining landscape](https://whc.unesco.org/en/list/803). Its four centres remain in the conversion records and overall pass counts, but `data/quality-flags.json` excludes that region from natural targets and the library. Targets therefore use 99 named regions. The badlands target has four, so the bench marks it as insufficient evidence. Other windows may also contain roads, farms, dams or modified channels; no claim of pristine terrain is made.

The crop includes a 32-cell halo on every side. The halo supports drainage entry detection; it does not recover the entire upstream watershed.

## Elevation

Terrarium pixels decode to `(R * 256 + G + B / 256) - 32768` metres. The downloader checks dimensions and opacity. It stores SHA-256 hashes for source tiles and sampled arrays.

Zoom is the finest required ground resolution, capped at 14. Bilinear interpolation uses pixel centres and crosses tile seams. A local spherical approximation spaces northing and easting; longitude uses the centre's latitude. This is appropriate for reconnaissance windows, not survey-grade distance measurement. Y increases north in all game arrays.

Source pixel spacing is recorded per patch. Pixel spacing does not establish the resolution or vertical accuracy of the underlying source DEM. Terrain Tiles combines regional datasets. Water surfaces may be flattened, and bathymetry may be missing or coarse. No real discharge, spring inventory, river depth or vegetation survey is inferred from those pixels.

Raw PNGs and floating-point crops remain in `.cache/`, which Git ignores. The committed manifests contain hashes and metadata, not raw tiles.

## Vertical mappings

Let `u = (height - minimum) / (maximum - minimum)` within the central crop.

| Mapping | Unrounded game height |
|---|---|
| Linear | `(height - minimum) / 30`, clipped to 16 |
| Compressed | `16 * log(1 + 4u) / log(5)` |
| Relief-normalised | `16u` |
| Height comparison | `22u` |

All mappings round to whole levels. Constant crops become zero. Every crop gets all four conversions: 16,200 attempts. The 22-level case remains a design-limit failure where it exceeds 16.

Readability is a screening proxy: at least five occupied levels and correlation at least 0.9 between relative elevation and quantised height. This detects lost relief and heavy clipping. It does not prove that a named landform remains recognisable. The library's previews provide the human check. RMSE, occupied levels, correlation and saturation share are retained for every mapping.

## Water and starts

Priority-flood routing uses eight neighbours. A strictly earlier flood rank resolves flat ties, so the receiver graph has no cycles. Each cell contributes one unit to accumulation. Filling affects routing elevations only; it never fills the exported terrain. This follows the [priority-flood approach](https://arxiv.org/abs/1511.04463).

Channels begin at `max(32, 1% of central crop cells)` contributing cells. Sources come from channels entering the central crop or reaching that threshold inside it. Up to eight strongest candidates are retained. Edge entries move at most three receiver steps inward where possible. Their origin and contributing area are recorded. They are inferred entries and channel heads, not verified springs.

Total source strength is the repository's size-aware clean-flow median multiplied by two. It is divided in proportion to square-root contributing area, capped at eight per source. This is a game conversion setting, not physical discharge.

Drainage-selected exits and their neighbouring edge cells retain their elevations. Other border cells rise to the height cap to seal incoming mouths. The interior stays unchanged. No channel is carved and no start pad is flattened. Raised edge-cell counts are recorded. Terrain targets use the original quantised crop, excluding that artificial rim. Water statistics use the sealed conversion.

The unchanged `canonicalSettle` supplies water and moisture. The unchanged generate-profile validator checks the assembled map. An explicit empty feature list keeps `water.outflow` active. No planned lakes or badwater basins are invented to waive checks.

Start search finds existing flat 3×3 sites with a dry five-by-five ring and a same-level entrance. It keeps the moistest candidate in each 8×8 block, then evaluates up to 48 candidates using the repository's walking rules. It prefers same-level water within 20 steps, then room for resources. This is a bounded best-site search, not proof that a failing terrain has no possible start.

Near the selected start, eligible moist cells receive up to 48 bushes and 60 living trees. Remaining living plants use moist, clean, dry-footed soil. Dead trees fill dry ground. Clumped ruins use existing flat dry ground. Totals follow the repository's default size-aware densities. No slopes are added; some terrain could pass with more elaborate slope placement. The resulting pass rate measures this conversion policy.

The batch uses a common valid JPEG while checking assembled files. Curated fixtures get terrain-specific previews and a fresh file thumbnail. File bytes are not used as terrain measurements.

## Measurements

The repository supplies naturalness, layout signatures, feature vectors, lakes, reservoir candidates and playability checks. Its dam finder samples clean water with crest heights 1–3. Counts describe that search, not every physically possible dam. A good dam must still be judged against drought need and access.

Additional measurements use the same code for real and generated heightmaps:

- D8 junctions, heads, channel length, length per area, segment sinuosity and junction angles. Angles use the two largest upstream arms traced up to four cells. Sinuosity ignores segments shorter than five cells.
- Height and four-neighbour step histograms; straight contour-run lengths after quantisation.
- Up to roughly 64 valley sections, perpendicular to the local receiver direction, extending 12 cells each way. Widths at one and two levels exclude sections whose banks lie outside the window. The narrowing ratio is the smallest divided by largest measured two-level width.
- Connected wet lips with surface drops of at least one level, their drops, and nearest-fall distance. This distance is Euclidean, not downstream spacing. A multi-cell fall may contribute several drop edges.
- Significant simulated flow directions: outgoing edges above 0.005 and 15% of local outflow. Split and rejoin cell shares describe the water grid. Enclosed dry components of four or more cells describe water loops.

D8 cannot split. Its branch statistics are drainage-tree proxies, not a measurement of distributary river networks. Flow shares and enclosed islands cannot distinguish a braided river from lake islands. The DEM's loss of shallow channel detail is especially serious for deltas, fans, coasts and braids. [USGS documents why DEM hydrography needs conditioning](https://www.usgs.gov/ngp-standards-and-specifications/elevation-derived-hydrography-data-acquisition-specifications-15). Do not tune braid count from these proxies alone.

`tools/gen.ts` produces seeds 1–30 at 128² for River Valley. Its bytes are compared with the same core API call. Because the CLI has no theme switch, `generated.ts` uses that API for all six themes, with defaults and Normal difficulty.

## Targets and uncertainty

Targets remain separate by cohort, family, size, metres per tile, mapping and height cap. Within a stratum, each region contributes the median of its available measurements. The target band is p10, median and p90 across those regions. Quantiles select sorted index `floor((n - 1) * p)` without interpolation. Histogram bins use region medians, then means, and are renormalised. Family strata have five named regions each, except the four retained badlands regions.

Terrain targets include passing and failing conversions. Water-feature targets include only simulations that settled. Nulls stay null. The 22-level comparison is separate. These are exploratory bands from a convenience sample, not confidence intervals for world geography. Compare adjacent scales and both named and random cohorts before adopting a range.

The bench reports distance to those bands, per measurement and group. It reports missing evidence for fewer than five measured regions. Histogram distance is total variation. Group distance is the mean absolute median deviation, divided by a robust spread and capped at ten per measure. It is descriptive, not a fun score or acceptance gate.

Variety uses the repository's layout and feature formulas and its published `investigation/workshop/variety-scale.json` calibration. The real set has one anchor per named region at 128², 60 m per tile and 16 normalised levels. Results retain the full set and the settled subset separately. Features include placed resources and simulated water, so this is variety of the conversions, not untouched geography. Fitting a new calibration to nearly constant planted-resource totals would inflate distances; the published calibration avoids that problem. No workshop heightmap is used.

No terrain was checked in Timberborn. Family labels, DEM uncertainty, source inference, edge treatment, start search and resource placement all limit the results.
