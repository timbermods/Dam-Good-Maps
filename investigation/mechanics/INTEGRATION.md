# Integration proposals

Nothing outside `investigation/mechanics/` is changed. Kyler and the milestone run decide adoption and merging.
The M9 design file was absent at the pinned `dev` commit. Reconcile this handoff with that design when it lands.

## Add to the M9 design

Use [AXES.md](AXES.md) as the initial measurement contract and [BASELINE.md](BASELINE.md) as the comparison.
The most useful separation is between water arriving, water retained, water reachable by an intake, and water protected from badtide.
Also separate visible resources, reachable stock and supply that can renew.

For composition, give each part an access/supply/event contract. Discover closure sites and frontiers from the resulting terrain.
Vary storage, fertile land, local flow, hazards and rewards independently where feasible. Keep the eight candidate combinations
in [M9-PROPOSALS.md](M9-PROPOSALS.md) as test cases, never a closed recipe list.

For play variety, measure the final map's feasible opening actions and their consequences. Use a shared graph of intake,
storage, farming, threats and outgoing rewards. Compare within themes as well as across them. Keep the current fixed-bin results
as diagnostics; they are too coarse to certify D109's ≤15% opening-cluster gate. Missing access or timing stays “unknown”.

For “how it plays” cards, say what the analysis actually established:

- Where the first water is, how far the shore is by walking, and whether its nearby natural supply persists through drought.
- The nearest measured closure opportunity, with line length, held volume and a construction-access caveat when needed.
- The first threat and a measured safe route; distinguish current badwater from future seasonal contamination.
- Two expansion choices when they exist, with distinct rewards and route costs.
- A specific faction opportunity only when supported, such as extra deep intake candidates. Never a general faction rating.

Keep player text short and omit analysis identifiers. Example forms, filled only from a map's measured values:

> Clean water is six tiles away. Nearby pools drain in drought; a five-tile closure offers storage.
> Farmland lies below the start. Science and wood lie along different routes.

These are wording examples, not claims about a generated seed. Do not show the second sentence about routes unless the graph
finds distinct routes. Do not say “power rich” from waterfall height, “survives Hard” from stored volume, or “no threat” from today's water.
The blind 40-map page remains local and keeps recipe labels hidden, as D109 requires.

## Proposed PLAN changes

| Section | Proposed text or addition | Decision status |
|---|---|---|
| Product principles / §7 / §12 | Judge play variety through opportunities and feasible action sequences, separately from appearance and intrinsic quality. Show within-theme distributions and repeated openings. | Supports D108/D109. No workshop imitation or new fixed archetypes. |
| §5 settings | State which settings influence each axis, what physics couples them, and what the generator may vary. Keep requested settings as constraints; do not silently change a count to fill a distribution. | Preserve D66/D81/D85 and share-link keys. New settings need their own decision. |
| §5.7 special entities | Replace “adds little” for aquifers with the evidenced power-for-temperate-water opportunity, still deferred. Record seeps, drains, caches and roofed systems as future mechanics with missing witnesses. | Prose proposal only; does not schedule deferred features or remove D28 limits. |
| §9 set pieces | Add supply, build access, inundation and before/after checks. Reward a choice between viable projects, not an object count. | The existing nearby dam site remains pending #31. |
| §10 water | Document gross stored volume, retained clean volume and intake-accessible usable volume separately. Add a research scenario contract for drawdown, refill and badtide isolation. | No replacement of the canonical settle or D29 analytic drought. Recalibrating budgets is a separate proposal. |
| §11 checks | Keep current blocking/advisory policy. Add research results for first-cycle work, food, intake fit, safe routes and event consequences, explicitly unknown until their inputs are verified. | Making reserve/distance/reach scenario checks blocking would conflict with D85/D13. |
| §13 / §14.3 | Generate names from detected features and cards from measured choices. Include a warning when claimed construction access or survival is unverified. | Supports D84/D88/D109; avoid repeating developer details in player copy. |
| §18 / §20 | Link the 12 unresolved questions; distinguish source contradictions from missing evidence. Record any adopted policy change with its own decision. | Do not silently settle current pending decisions. |

## Proposed ROADMAP changes

Add this baseline and the eight axes to M9's design inputs. Ask the prototype to report marginal spreads, joint opening groups,
nearest peers, threshold sensitivity and examples from the largest groups. Preserve the 200 seeds per theme, 3+ prototype themes,
30+ seeds per theme, 40 blind cards and Kyler's Unique-rating gate already required by D109.

U01–U08, U11 and U12 are now answered from the game code ([VERIFIED.md](VERIFIED.md)). Gates built on the opening schedule
or survival margin (U04, U09) stay provisional until played.
Add scenarios for both factions and every difficulty to the prototype's evidence. Keep ≥98% final batch pass per theme and size,
both validators, deterministic generation, share links and performance budgets. This 180-map Normal baseline does not replace them.

Schedule the missing action/access and event analysis separately from shape generators. Keep caves, roofed water and special sources
in their existing Later scope unless Kyler moves them. M9/M10/M11 still wait for the approved design.

## Conflicts and boundaries

| Proposal or tempting shortcut | PLAN §20 boundary | Treatment |
|---|---|---|
| No convenient nearby dam; reservoirs entirely earned | D25, D30, D58, D85; pending #31 | Proposed experiment only. Keep the current site and advisory reserve policy. |
| Reject every low-reserve, close-threat or small-reach map | D3, D13, D85 | Conflicts. Research checks may explain a risk; changing rejection policy needs a decision. |
| Replace the fixed bench relation with any feasible start | D97 | Worth exploring for variety, but an explicit departure from the recorded bench-to-bank construction. The shared opening requirements remain. |
| Fix `start.dry` so lower lakeside water passes | D107 | Not part of this work. Keep the current check until the scheduled Refinement comparison. |
| Use exact water/access scores under bridges, caves or drains | D28, D98, D100; §5.7 | Unsupported by this model. Defer or report unknown; never turn “approximate” into proof. |
| Increase height above 16 or add multiple vanilla starts | D4, D5 | Excluded. The axes do not require either. |
| Treat the eight examples as archetypes or fit to workshop shapes | D108, D109 (superseding the older premise-only plan) | Excluded. Generate combinations and judge intrinsically. |
| Broaden core hazards into mandatory early threats | D81 and §5.4 | Excluded. Cores remain optional, off by default and within existing placement rules. |
| Reuse this exploratory math inside deterministic generation unchanged | D15, D106, §19.7 | Needs production review: the sector helper uses `Math.atan2`; replace or isolate nondeterministic math, version changed maps and test share-link parity. No production code is changed here. |
| Change the colony-water formula | D29, D30, D58, D85 | Proposal only. Resolve consumption, evaporation and usable-depth semantics first. |

## The 12 open facts

[VERIFIED.md](VERIFIED.md) answers all 12 from the decompiled game (1.1.2.4):
U01 wheel output (corrected); U02 floodgates; U03 crop economies; U04 work and hauling (rates only);
U05 aquifer weather shutdown (confirmed); U06 core component (required, corrected); U07 ruins (rate corrected);
U08 blockage top (confirmed); U09 survival (still unknown); U10 other faction systems (in part);
U11 construction access; U12 cache, blast and stacked-water edge cases.

Three remain for play: the opening schedule (U04), the survival margin (U09) and faction suitability (U10).
Keep those labelled unverified in any adopted design. Nothing here was checked by launching the game.
