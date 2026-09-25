# Weather cycles

The local viewer shows what an untouched map does through drought, badtide and recovery. It includes 12 maps across all six themes. Each has daily views and a continuous 97-day run of a new Normal game. [Open the viewer](README.md).

The study covers 204 generated maps: seeds 1–30 per theme at 128², plus two seeds per theme at 96² and 256². It starts from dev `cfa5990caeaf462de695caf428280da55fc0f7f5`. All changes stay in this folder. No game was launched.

This version follows Timberborn 1.1.2.4's own code for every timing: soil moisture and contamination every tick, the game's contamination transport in water, the plants' dying timers, and the sources' calendar. [FIDELITY.md](FIDELITY.md) names the class behind each rule and measures what it changes. It replaces the first version, which estimated these.

## What exact timings changed

- **Droughts: nothing that matters.** Water kept, wet tiles lost, start access and plant losses match the first model in every theme. The drought comparisons with the analytic view are as before.
- **Badtides: the biggest change.** In the game, water contamination moves by net flows and diffuses between slow, level neighbours; evaporation does not concentrate it. Badwater above 5% therefore reaches more of the water: the median share of clean water reached on badtide day 1 rises from 86% to 100% in River Valley and from 36% to 59% in Lake Basin. Less of it reaches the 0.5 that spoils soil. New contaminated soil after that day falls by 17–93% across themes (River Valley 7.0% of the map to 0.5%; Lake Basin 7.7% to 1.0%). On the 12 reference maps, 11% fewer original plants die in the first badtide.
- **Recovery after badtide** is slower where water is slow. Delta recovered in one day on 29 of 30 maps; now 14 take five days and 12 have not recovered after five. Islands now recovers within five days on 14 maps (none before).
- **Start water in badtide.** On 3 of 12 reference maps (Lake Basin and Islands), the start now loses clean pumpable water on badtide day 2.
- **Soil timing** moves moisture by a few percent (at the end of a badtide, 102 fewer moist tiles of about 2,400) and changes no plant deaths: dry timers run 8–15 days, so a few hours do not change which plants a drought kills.
- **The calendar.** In the Hard schedule the cycle after the later drought has five temperate days, so that probe's last recovery day already includes the next drought's source slowdown.
- **Loading.** The generator writes zero flow momentum. A few rivers hold up to 5% more water on the first day while flow rebuilds (Highlands 128² seed 22: +4.6%); the median change is 0.03%.

Of 180 survey maps, 42 moved to another behaviour group. The median distance from a map's old signature is 0.02.

## What the results say

Canonical initialization matches exactly on all generated maps and all 12 golden fixtures. Every run loads the state the map file stores; before the sources start to slow, the first temperate period changes volume by at most 5.1%.

The three golden drought checks differ by 0.73%, 2.71% and 0.36% in stored volume, within their 5% gate. Some generated long droughts miss that gate, especially where little water remains; the largest difference is 2.5% of initial water. One nine-day comparison misses the tighter 0.1-block depth target: Lake Basin seed 14 leaves 0.104 at (21, 79) in the analytic view, which the exact model dries. [Every failed comparison is listed](RESULTS.md); neither solver was changed to hide it.

Themes differ much more than seeds within a theme. Canyon loses all water in the 25-day drought. River Valley, Highlands and Delta retain small stores or none. Lake Basin and Islands keep about half. Large storage does not guarantee access: the start's shore can leave a pump's reach while the lake still holds water.

Some terrain creates useful choices. River Valley seed 2 loses its main river, while its off-channel pools keep a quarter of their water; in the first badtide those pools pass 5% contamination too. Lake Basin seed 2 keeps 6,417 m³ in its main lake after the long drought, but 61% of that lake's water passes 5% contamination during the first badtide. Highlands seed 8 splits one original water body into six pieces during the source slowdown. These consequences give M9 more to measure than map shape.

Within-theme repetition is still strong. All 30 Canyon seeds share one broad behaviour group, and 27 of 30 Islands seeds share another. Other themes have two to four groups, and close peers remain common. The eleven-value signature is a diagnostic; this 30-seed survey does not satisfy D109's 200-seed gate or replace Kyler's ratings.

Exactness costs 1.67× the first model's CPU time on the same probes: 1.55× in a drought, 2.02× in a badtide. The median simulated day takes 0.28 s of CPU at 128² and 0.96 s at 256². The app needs an immediate analytic estimate, a cancellable worker and streamed key days. [Integration proposals](INTEGRATION.md) cover the Weather view, cards, scoring, plan changes and the cost in detail.

## Choices and limits

- Follow the game's tick: singletons, then entity components, then the parallel water and soil tasks, each reading last tick's water. Where the game's order among singletons is not fixed in the code, events can move by one tick.
- Keep the validated 64-bit water port; the game computes water in 32-bit. Soil is 32-bit, as the game stores it.
- Use weather seed 1729 to compare maps fairly. The game's random sequence cannot be reproduced; weather and plant delays use seeded draws with the game's odds. The seed draws the same weather as before.
- Probes load the map at a date in the schedule; the continuous run starts a new game at 04:00 on day 1.
- Follow original plants only. Dead trees keep their logs; dead bushes lose their berries. Drinking, regrowth and construction are absent. Start-water days describe access potential, not colony survival.
- Support generated heightfields. Roofed water, drains and changing terrain need more work. Aquifers stay dry without a powered drill; no generated map has seeps or timed sources, though both are modelled.
- Keep dependencies local. The in-process TypeScript runner works where tsx's subprocess is blocked. No root dependency or application file changes.

[Spot checks](CALIBRATION.md) lists four short in-game checks of the code reading. None has been run.
