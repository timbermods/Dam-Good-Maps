# Local viewer check

Checked in the Codex browser on 2026-09-25, at `http://127.0.0.1:4178/viewer/index.html`.

- The page loads local compressed data and draws terrain, water, plants and the start.
- Drought selection offers Easy, Normal, Hard and the later Hard drought.
- The day slider changes the map, water volume, soil area and original plant counts.
- The later Canyon drought shows no remaining water or living starting bushes; the retained logs remain in the description.
- The continuous run reaches cycle 6 recovery at elapsed day 97. Play advances the day and stops at the end.
- The timeline's x-axis uses elapsed days, including recovery. Duplicate phase boundaries do not add slider days.
- The narrow layout stacks the controls and map without clipped text. The legend uses words and symbols as well as colour.
- No browser warnings or errors were reported during these interactions.
- The final 12-map manifest and Islands seed 2 were checked after all continuous runs completed. Its day-25 drought shows 7,853 m³ in the main lake, 50% of that region's starting water, and no water in its river regions.

This checks the local prototype. Browser worker performance and integration with the app remain proposals.
