# Give M9 different decisions to generate

These are proposals. They do not change the generator, its checks or PLAN's decisions.
The eight [axes](AXES.md) describe opportunities. Their combinations should be discovered from terrain and flow,
then tested for a feasible opening. They must not become eight fixed map recipes.

## Combinations worth testing

Each row changes an early choice and a later choice. The last column is the witness the prototype must supply
before calling the combination winnable. These are conditional design candidates, not played or certified openings.
The mechanic numbers refer to the sourced [catalogue](CATALOGUE.md).

| Combination | Different opening and later choice | Features that push the axes | Required witness |
|---|---|---|---|
| Little natural reserve; a short accessible closure; broad fertile ground | Store water early, then choose how much fertile ground to flood. | A narrow outlet below a broad, low basin; start above the proposed pool. | Two-level starting intake; construction access from both required sides; measured retained clean water after closure; dry start and enough remaining fertile land. Mechanics 03–06, 15, 25. |
| Large natural reserve; weak local flow; several dry shelves | Begin beside storage, then choose industry access versus new growing land. | Deep basin with a safe shallow intake, low-discharge outlet, separated terraces. | First-cycle supply is pumpable as the surface falls; at least one power route for required production, using V U01's wheel rule or another source; essential resources on existing links. Mechanics 02, 06, 21; V U01/U10/U11. |
| Strong accessible flow; small starting shelf; nearby threatened lowland | Use a compact opening; later choose a flow-side industry site or protected farming. | Confluence beside a safe bench, narrow fertile shelf, badwater on a different drainage path. | Safe initial water/food/log routes; no required badwater crossing; enough buildable work sites; tested storage and bypass projects. Mechanics 01–05, 10, 15. |
| Broad land; little persistent fertile land; remote scrap | Farming expansion and irrigation compete with the first metal frontier. | High dry terraces, lower clean water, modest wet groves, scrap beyond a pass. | Near-start living minima and ripe food; renewable land can be watered without a circular unlock; early project costs fit available stock. Mechanics 15–18, 22; V U03 rates, U04 schedule. |
| Modest wood stock; accessible science on one route; larger forest on another | Choose faster research access or more building stock first. | A relic on one reachable branch, mature groves on another, different route costs. | The smaller stock still funds the pump/food opening; both routes have independent access; relic access does not require its own reward. Mechanics 16–17, 20, 22. |
| Good clean storage; close but separated badwater; distant geothermal | Protect water first, then choose between nearer hazard-side land and a longer safe power route. | Basin divide, separate outlet, dry geothermal field beyond a ridge. | Badtide scenario leaves the protected intake clean; bypass can be built; no field counted as already powered. Mechanics 05–06, 09–10. |
| Similar initial intake for both factions; deep later reserve | Start under the shared rules; later choose deeper intake access or staged pumping/storage works. | Shallow shore on one side of a deep basin, high bank on another; more than one approach. | Both factions pass the opening; legal pump footprints and drawdown volume measured separately; no winner declared from shore-cell counts. Mechanics 06, 25; V U11. |
| Safe stable opening; optional release or clearing project with a distinct reward | Grow safely, then choose whether to drain land, release water or clear a protective barrier. | Side-basin plug or thorn belt, receiving basin, alternate route, resource payoff. | Simulate before/after state; reward remains accessible; start and mandatory supplies survive both choices. Timed cores remain optional, remote and off by default. Mechanics 11–14, 23. |

Reject combinations that spend the same resource twice. A basin cannot be both the only farm and a required flooded reservoir
unless the sequence provides replacement food. A relic beyond an unbuilt staircase cannot pay for that staircase.
These are dependency checks, not assumptions that a named shape is fun.

## Let composition produce these choices

1. Draw continuous terrain and water parameters: catchments, cuts, tributary shares, basin floors, bank heights and links.
2. Detect what the resulting map offers. Record accessible intake sites, closure candidates, fertile regions and route cuts.
3. Place a safe start and mandatory resources under the existing rules. Preserve varied relations to the detected opportunities.
4. Attach optional rewards to distinct routes, with a visible cost and at least one reason to choose each.
5. Settle again after each meaningful terrain/water change. Measure the final raster, not the requested parameter value.
6. Search feasible action sequences. Report unknown dependencies rather than filling them with optimistic estimates.
7. Choose candidates for intrinsic quality and underrepresented openings, subject to the current guards.

A component should expose a small contract: occupied terrain, supply it needs, supply it offers, access routes,
event state, and areas that must remain safe. Composition can then reject a conflicting pair before an expensive simulation.
Use independent draws for flow, reserve, fertile-land persistence, frontier reward and route cost where physics permits.
Strong flow must not automatically mean generous reserve; tall relief must not automatically mean inaccessible food.

## Proposed spreads

These are targets for experiments, not new release gates. Use fixed units across runs and report values before and after retries.
Keep theme identity through broad tendencies, not locked combinations. Test on D109's 200 seeds per theme at 128²,
then use the existing batch sizes and difficulty matrix for feasibility.

| Axis | Initial target for the prototype | Constraint |
|---|---|---|
| Storage work | At least 20% with `storageRatio` <0.25 and 20% ≥1 in each theme; report closure lengths 1–5, 6–10, >10/not found separately. | No removal of the nearby planned site until decision #31. Low reserve remains labelled with its advisory warning. These fractions may prove infeasible for a theme; report it. |
| Power location | At least two `peakAxialFlow64` bands each ≥20%; vary accessible geothermal opportunity separately, including “none within 64”. | Claim wheel hp only from V U01's rule at a place where a wheel fits, and never for drought. Changing field counts beyond current settings requires a proposal, not silent variation. |
| Land and height | At least 20% with flat accessible area <150 and 20% ≥500, while linked reach and opening resources still pass their applicable checks. | Start footprint and same-level water remain intact; small land must not mean no legal work sites. |
| Fertile land | At least 20% below 0.25 persistence and 20% above 0.75; report empty fertile area and clearing work too. | Low persistence needs an explicit irrigation/storage plan and food timing; do not certify it from moisture alone. |
| Threat exposure | Keep at least two bands among <15, 15–30, 30–60, ≥60; each represented band should hold ≥20%. | Difficulty/user distance targets and D85 warnings remain. Near danger must have safe early routes and later counterplay. |
| Resource timing | Use at least two log-stock bands each ≥20%; vary accessible science/scrap and the live/dead split independently. | Never reduce living tree/bush minima or count dead logs toward them. Mature stock and ripe food have separate fields. |
| Expansion choice | Seek one, two-to-three and four-plus measured regions across a theme; at least two ranges ≥20%. | Verify distinct routes and reward types. Do not earn variety from compass rotation, ring fragmentation or several sectors of one field. |
| Faction opportunity | Include both zero and positive extra deep-pump shore options; aim ≥20% of each in the pooled sample. | Both factions retain the two-level opening. This is an optional-opportunity distribution, not a faction-strength target. |

For the joint opening graph, retain D109's largest-cluster ceiling of 15%. Also report minimum/median nearest-peer distance,
cluster examples and sensitivity to reasonable thresholds. Do not impose that ceiling on each marginal axis: a theme may
share a low-flow tendency while varying storage, threats and expansion. Do not require every Cartesian product of bins.
Some products conflict physically or economically. Show which combinations are absent and why.

## Winnability checks by difficulty

Current requirements come from [PLAN §5.6/§11.4](../../PLAN.md) and D85/D104. They remain unchanged:

| Check or evidence | Easy | Normal | Hard |
|---|---|---|---|
| Same-level clean pumpable shore, maximum walk | 12 | 20 | 28 |
| Living trees / living bushes within 20 walk units | 60 / 40 | 40 / 30 | 20 / 20 |
| Current reserve sizing, before reserve multiplier | 4 days / 40 beavers / 86 m³ | 9 days / 50 beavers / 253 m³ | 30 days / 50 beavers / 1,174 m³; hypothetical dam mean depth ≥3 |
| Current badwater-distance target, advisory | 30 | 15 | 8 |
| First drought range from N §11 | 1 day | 2–3 days | 3–6 days |
| First possible badtide from W Q7 | cycle 6 | cycle 5 | cycle 4 |

The reserve values are current repo targets, not exact water budgets. `reservoirNeeded` applies 0.424 consumption even to Easy;
W Q7 gives Easy 0.170. The retained-water path has already subtracted evaporation, whereas a hypothetical dam volume has not.
This study does not alter either rule. A future scenario budget should use each mode's consumption and avoid subtracting
evaporation twice. Treat any resulting threshold change as a D29/D30/D58/D85 proposal.

Proposed research checks, to run for each candidate combination and both factions:

- **Opening witness:** legal pump footprint, road connection, accessible logs and ripe food, followed by a feasible work sequence.
  Use the shortest temperate window and longest first drought in the notes. Use V U03/U04/U11's rates; the resulting schedule stays “unverified” until played.
- **Sustained water:** connected clean usable volume above the intake limit, consumption, evaporation, refill and isolation from badtides.
  Include the worst mature drought and badtide lengths from W Q7, not only cycle one. Report population and industry assumptions.
- **Food and wood:** persistent or irrigable growing land and a harvest/renewal schedule. Subtract reservoir inundation and barrier losses.
- **Safe routes:** essentials remain accessible before any new construction; optional projects have build access and a non-circular unlock path.
- **Event consequences:** measure flooding and route/resource loss after plug removal, thorn clearing, source activation and permitted blasts.
- **Two-faction ledger:** same shared opening, separate later pump, barrier, plant and mine opportunities. No foreign map templates or cache goods.
- **Production guards:** existing load/design/playability checks, both validator verdicts, ≥98% final pass per theme and size,
  first-attempt rate, determinism, performance budgets and reproducible share links remain D109's gates.

New scenario failures should initially be research findings and card caveats. Making them hard generation failures would change
D85 where advisory reserve, distance or reach targets are involved. Kyler must decide that policy; this branch does not.
No static baseline or 180-map pass rate proves a full colony survives every difficulty (U09).

## What the M9 brief covers, and what it still needs

At the pinned commit the design file and prototype directory are absent. This is a comparison with
[ROADMAP, M9 design step items 1–4](../../ROADMAP.md), not a claim about another agent's unpublished work.

| Composable part | Covered by the design brief | Missing contract or measurement to add |
|---|---|---|
| River networks | Sources, confluences, splits, loops, direction, drainage-led routing. | Accessible local discharge; source reliability by weather; alternative cut/bypass costs. Network shape must change actions, not just bearings. |
| Relief | Multi-scale plateaus, basins, ridges, mesas, scarps and terraces; emergent dam sites and falls. | Flat and linked building space near the start; route bottlenecks; closure volume versus inundated food; cost to unlock a shelf. |
| Water systems | Lakes, falls, marshes and springs. | Pump-accessible clean storage; seep/aquifer timing; drawdown, refill, isolated reserve and hazard contamination. Keep unsupported roofed systems deferred. |
| Hazards | Hazards as composable parts; drought/badtide and contamination as inspirations. | Time-to-impact, safe bypasses, exposure along routes, event-before/after checks and avoidable versus mandatory risks. |
| Landmarks | Landmarks, discovery, playful forms and measured cards. | Each reward's access cost, useful timing and opportunity lost elsewhere. A geothermal field behind an impassable cliff is not early power. |
| Cross-part play | Opening descriptions, ≤15% opening clusters, blind cards and Kyler's ratings. | A shared action/dependency graph, separate faction opportunities, independent axis sampling and explicit unknowns. |

Existing core code supplies much of the geometry, moisture, walk and storage data. It does not supply a colony economy,
wheel placement/output model, full badtide scenario or construction planner. Those are the main evidence gaps, not more landmark names.
