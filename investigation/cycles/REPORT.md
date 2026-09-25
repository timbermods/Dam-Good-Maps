# Weather cycles

The local viewer shows what an untouched map does through drought, badtide and recovery. It includes 12 maps across all six themes. Each has daily views and a continuous 97-day run through five Normal cycles. [Open the viewer](README.md).

The study covers 204 generated maps: seeds 1–30 per theme at 128², plus two seeds per theme at 96² and 256². It starts from dev `cfa5990caeaf462de695caf428280da55fc0f7f5`. All changes stay in this folder. No game was launched.

## What the results say

Canonical initialization matches exactly on all generated maps and all 12 golden fixtures. A continuing 17-day temperate run can move by 3.4% in volume. The canonical stopping test is not a frozen equilibrium.

The three golden drought checks differ by 0.36%, 0.73% and 2.70% in stored volume, within their 5% gate. Some generated long droughts miss that gate, especially where little water remains. Maximum difference is 2.5% of initial water. One nine-day comparison also misses the tighter 0.1-block depth target: Lake Basin seed 14 has a 0.104-block discrepancy. The analytic view leaves a shallow patch that the tick model dries. [Every failed comparison is listed](RESULTS.md); neither solver was changed to conceal it.

Themes differ much more than many seeds within a theme. Canyon loses all water in the 25-day drought. River Valley, Highlands and Delta retain small stores or none. Lake Basin and Islands keep about half. Large storage does not guarantee access: the start's shore can leave a pump's reach while the lake still holds water.

Some terrain creates useful choices. River Valley seed 2 loses its main river, while its off-channel pools keep water. Those pools also stay mostly clean during the first badtide. Lake Basin seed 2 keeps 6,416 m³ in its main lake after the long drought, but part of that lake becomes contaminated during badtide. Highlands seed 8 splits one original water body into seven pieces during the source slowdown. These consequences give M9 more to measure than map shape.

Within-theme repetition is still strong. All 30 Canyon seeds share one broad behavior group. Other themes have more groups, but close peers remain common. The eleven-value signature is a diagnostic; this 30-seed survey does not satisfy D109's 200-seed gate or replace Kyler's ratings.

The six probes total 73 simulated days. Their median wall times are 9.32 s at 96², 12.79 s at 128² and 69.23 s at 256². The slowest 256² run took 762.28 s under concurrent load. The app needs an immediate analytic estimate, a cancellable worker and streamed key days. [Integration proposals](INTEGRATION.md) cover the Weather view, cards, scoring and plan changes.

## Choices and limits

- Keep the native water arithmetic: 768 ticks per day, two substeps per tick. Compare sources-off droughts separately from weather ramps.
- Use weather seed 1729 to compare maps fairly. Probes start from the same settled map; the continuous runs preserve earlier damage. The model's seed does not reproduce the game's random sequence.
- Follow the documented handicap and source curves. The local decompiled research supplies the omitted streak formula. Badtides replace droughts; full handicap ends at occurrence N+1. No game source is copied here.
- Update soil targets every 16 ticks to reduce cost. Spatial targets are equilibrium estimates with finite rise and decay. One-tick updates change two plant deaths in the checked badtide. Soil timing needs calibration.
- Follow original plants, with seeded death timers. Dead trees keep potential logs; dead bushes lose food. Drinking, regrowth and construction are absent. Start-water days describe access potential, not colony survival.
- Support generated heightfields. Roofed water, drains and changing terrain need more work. Aquifers remain unpowered; seeps use the repo's hysteresis without the game's fade.
- Keep dependencies local. The in-process TypeScript runner works where tsx's subprocess is blocked. No root dependency or application file changes.

[Calibration](CALIBRATION.md) gives four observations for one evening. These checks remain pending. The prototype is ready to inspect; production soil fidelity and browser performance are still proposals.
