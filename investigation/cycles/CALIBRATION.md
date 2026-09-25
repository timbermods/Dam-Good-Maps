# One evening in game

Use **River Valley, seed 2, 128²** and **Lake Basin, seed 2, 128²**, both generated with the Normal map settings on base cfa5990. Generate their files with the two-map command in [README](README.md); filenames are in `generated/`. Use the viewer's tile readout to find the points below. North is up; coordinates are zero-based (x, y). Leave the land and water untouched. Do not build pumps or dams.

Record the actual weather duration and start each hazard's clock at zero. The model's weather seed does not reproduce Timberborn's random sequence. Compare the same number of days; if the game ends a hazard early, record that and use an earlier common day. Pause for each reading.

| Watch | Point and predicted result | Write down |
|---|---|---|
| River drying | River Valley (90, 50): 0.457 deep initially, below 0.05 by drought day 1. The first Normal probe lasts 2 days. | Last wet time, first dry time, and whether the adjoining reach separates into pools. |
| Lake evaporation | Lake Basin (45, 36): 3.281 initially, 2.827 by drought day 4, including the source slowdown before it. Use a drought lasting at least four days. | Depth before the source slowdown, at hazard start, and on day 4. This separates drainage from evaporation. |
| Badtide front | River Valley (127, 48) is newly contaminated by the end of badtide day 1 (model fraction 51.9%). | When the front reaches this tile, and whether nearby bushes start dying before the day ends. |
| Recovery and food | On that River Valley badtide, 41 original bushes near the start remain alive at day 1. Let temperate weather return for five days. | When the river is visibly clean, when the banks turn green, and which original bushes remain dead. Do not count new seedlings as revival. |

Also note when the start's existing shore becomes too shallow for a two-level pump intake, without building one. In the viewer this means at least 0.3 water depth, below 5% contamination, and the surface within two levels of the start's bank. A colour change alone cannot verify that threshold.

Screenshots at the four readings and a few times/depths are enough. Tune source ramps first if drying is early or late; then evaporation, contamination travel, soil recovery and plant timers. These checks are pending. No in-game check was run by this investigation.
