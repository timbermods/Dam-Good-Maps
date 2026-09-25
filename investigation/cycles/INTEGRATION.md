# Integration proposals

These are proposals for the milestone run. This branch changes no application code or root plans.

## Preview and editor

Add **Show → Weather**, beside D101's current soil and badwater layers. It opens **Normal**, **Drought** and **Badtide**, a difficulty choice, a day slider and **Play**. Keep the first drought and a later drought easy to compare. Put “Before you build” next to the controls.

Use the map's canonical settle as day zero. Until it is ready, label the preview as provisional. After an edit, cancel the old weather job and show its last image only with a stale notice. Reset the time view when the edited map's new result arrives. Export always uses the ordinary canonical settle, never the selected weather day or its dead plants.

Keep D101's analytic drought as the immediate estimate while daily results arrive. Distinguish its fixed evaporation estimate from the simulated timeline; they are not identical at the end of a long drought. Clicking a summary location should highlight the measured water region. Name regions by features where those features exist, and by coordinates otherwise. Derive upstream and downstream from flow, as D84 requires.

Each legend needs state words as well as colour. Include water depth and contamination on hover. Put a concise summary below the map: what dries, a lake that lasts, when the start loses water access, where badwater reaches, and whether original food survives. Daily arrival times say “by day.” Censored results say “still available at day N.”

Use D100's saved water under roofs unchanged. A weather prediction involving those columns needs an explicit unsupported/approximate notice. Do not imply that the heightfield model predicts roofed badtide drains, tunnel flow, aquifers with player power, or terrain explosions.

## Map card

Show three short facts, for the chosen difficulty and weather seed:

- **First drought:** clean water still reachable, or lost by a measured day.
- **Later drought:** fraction of natural stored water kept, with the drought length.
- **Badtide:** the start's exposure and surviving original berry bushes.

Add “Before you build; no drinking counted.” A dead forest can still supply logs, so do not equate tree deaths with lost starting wood. These numbers do not predict colony survival, pump placement, constructed reservoirs or food regrowth.

## Score and M9 play variety

Use the cycle signature as another independent view of a candidate. Prefer varied consequences and choices: a channel that separates into useful pools; a high lake that stays wet but is hard to reach; storage that survives drought yet catches badwater; separate clean and exposed routes. Reward viable trade-offs only after the ordinary checks pass. Maximizing survival alone would favour large, deep lakes and erase variety.

Compare signatures within a theme and across themes. Retain the terrain/route/first-dam/opening measures from D109: two maps can share drought resilience yet demand different play. The study's eleven-value distance and coarse groups are diagnostics, not replacements for D109's 200-seed measures or Kyler's Fun/Unique ratings. Do not introduce workshop-map similarity as an objective (D108).

Treat stored drought water and badwater proximity as advisory, preserving D85. A new hard rejection for cycle survival would conflict with that decision. Publish individual measures before deciding weights for a combined score. A candidate's worst result across several fixed weather seeds matters more than one lucky first badtide.

## Performance

The measured multi-day runs are too slow for the editor's two-second interaction budget. Do not run the full timeline on the UI thread or before a card first appears.

1. Reuse the existing canonical settle and return its initial view immediately. Return the analytic drought estimate next.
2. Run the native water steps in a cancellable worker, yielding every 16 ticks. Identify work by document revision, difficulty, weather seed and model version. Never publish stale results.
3. Prioritize the first hazard's day 1, its end, badtide day 1, and recovery. Stream complete daily frames; label missing days rather than interpolating an uncomputed contamination front.
4. Cache checkpoints including depth, old depth, outflows, contamination, seep state, soil candidates/levels, source activation clocks and plant timers. Depth alone cannot restart the same transient.
5. Use exact Float64 simulation state. Compress or quantize only display frames. The current gallery uses run-length fields compressed with gzip and lazy-loads one map at a time.
6. For M9, use the cheap analytic retention and route checks to shortlist candidates. Run the full cycle signature on finalists or offline. Measure a cancellation bound, memory, day latency and first-use latency in Chrome before adopting a budget. Node wall times under concurrent load are evidence, not a browser guarantee.

The worker and progressive app path are proposals, not implemented here. The local viewer itself uses precomputed key days and requires no simulation while playing.

Do not promise an exact match between the analytic and simulated drought shorelines. Lake Basin seed 14 leaves 0.104 depth at (21, 79) in the nine-day analytic view, while the tick simulation dries that patch. That misses this study's 0.1-block comparison target. The production decision should retain and explain both views until calibration determines which boundary players should rely on.

## Plan changes to propose

| File | Proposed edit | Decision or conflict |
|---|---|---|
| `PLAN.md` §10 | Add weather schedules, source transitions, daily states, soil timing, plant survival and the measured tolerance table. Keep the canonical settle definition. | D27/D29 remain the file and analytic authorities. Soil timing is still approximate. |
| `PLAN.md` §12 / §14.3 | Add cycle measures to candidate analysis and a small weather card. Choose weights after calibration. | D85 keeps drought storage advisory; D108 forbids copying maps. |
| `PLAN.md` §20 | Record a proposed Weather view extending D101; state that selected days never affect export. Record any accepted transient tolerances. | A change to D101's meaning needs a new decision; this investigation does not make it. D15's deterministic arithmetic is preserved through `expDet`. |
| `EDITOR_PLAN.md` §6 | Add a cancellable weather job after canonical validation, progress, stale-state handling and the unsupported-roof notice. | D99's fast edit preview and D100's preserved columns stay intact. |
| `ROADMAP.md` M9 design | Add cycle signatures to the composition prototype's opening analysis and blind-card evidence. Expand the survey to the required 200 seeds per theme. | D109 still gates M9, M10 and M11 on Kyler's approval. Thirty seeds here do not meet that gate. |
| `ROADMAP.md` refinement | Schedule the short calibration checks, soil/seedling fidelity work, multiple weather seeds and browser performance checks. | D11 allows work to continue with in-game checks pending; do not call them passed. |

## Model work before production

Port the game's spatial soil update, not just equilibrium targets with rate limits. Add delayed-source clock fixtures and a checkpoint round-trip test before importing arbitrary maps. Model plant growth and reproduction before describing vegetation decades later. Keep the current original-plant survival measure available because it answers a different question. Validate the source curve, drying threshold and pump-access wording with the short play test.
