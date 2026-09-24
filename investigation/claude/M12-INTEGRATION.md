# M12 integration plan

How roadmap M9 and M12 adopt the Claude groundwork in `investigation/claude/`. It holds:
- the exact text to paste into ROADMAP.md, PLAN.md §20 and EDITOR_PLAN.md §7 and §9;
- M12's deliverables, acceptance and decisions;
- which files move to `src/` and `tests/`;
- the pending decisions, each with a default;
- the changes `src/` needs, which this investigation did not make;
- the workshop slot;
- a message for the milestone session.

Nothing here has been applied. The investigation changed no file outside `investigation/claude/`.
It branched from dev at `a04a313`. On 2026-09-24 it was also run against dev at `5b17375` (M7 in
progress). It typechecks there; 51 of 53 tests and 106 of 120 reference solutions pass, and the
failures come from M7's new map objects and changed maps (section 11).

Numbers from the self-played pilot are labelled as such. The model never ran: there is no API key
in this environment.

---

## 1. What M9 and M12 inherit

| Piece | Where it is now | What it does | Milestone |
|---|---|---|---|
| River courses from the actual flow | `lib/flow.ts` | Each river's course in flow order, read from the settled water surface (else the bed, else the feature). Tributaries, inflows, lakes. Names: "the main river", "the north tributary", "the river from the east edge". | M9 |
| Place resolver | `lib/places.ts` | Compass, feature-relative and flow-relative places, from phrases or structured places, with the reading and assumptions returned. | M9 |
| Judgement words and size words | `lib/words.ts` | 13 judgement words with their setting levers, measured targets and guards; size words and comparatives with measured bases. | M9 (table), M12 (use) |
| Feature measures and guards | `lib/metrics.ts` | A map's metrics, each feature's measures (reservoir, lip width, outlet), guards read from the validator. | M12 |
| Site finder | `lib/sites.ts` | `find_sites`: candidates planned by the real builders, checked with a real build, ranked, with the nearest alternative. | M12 |
| Steps | `lib/steps.ts` | Claude's operation schema (15 step ops) and how each becomes engine operations. | M12 |
| Proposals | `lib/compound.ts` | Ordering, combined checks, interference, guards, dry run and propose. | M12 |
| Intent checks | `lib/intent.ts` | Expectations measured on the combined result. | M12 |
| Report templates | `lib/report.ts` | The app's draft: every fact the report must carry. | M12 |
| Summary and tools | `lib/summary.ts`, `lib/tools.ts` | The feature-level summary and the seven tools with their size limits and argument checks. | M12 |
| Conversation | `lib/conversation.ts` | Handles, aliases, the selection, what was made and accepted. | M12 |
| Harness | `harness/` | `ClaudeBridge` with the Messages API adapter, the loop, the prompts, the suite runner and grader. | M12 |
| Request corpus | `requests.json`, `bin/corpus.ts` | 120 requests with setups, goals, expectations, feasibility, report must-says, pass criteria and reference solutions. | M12 |
| Reference runner | `bin/reference.ts` | Runs every reference solution through `MapSession` with the real validators. | M12 |
| Tests | `tests/places.test.ts`, `tests/words.test.ts` | The resolver on four flow directions, curved, drawn and tributary rivers; every judgement word on three maps. | M9 |

### Files that move

| From `investigation/claude/` | To | Notes |
|---|---|---|
| `lib/view.ts`, `lib/flow.ts` | `src/core/analysis/view.ts`, `src/core/analysis/flow.ts` | Shared with M9's names and premises. |
| `lib/places.ts` | `src/core/places/resolve.ts` | M9. The editor's region tools can use it too. |
| `lib/words.ts` | `src/core/places/words.ts` | M9 builds the table; M12 uses it. |
| `lib/metrics.ts` | `src/core/analysis/features.ts` | `reservoirTiles`, `reservoirIsClean` and the lip measures belong with the builders once they expose them (section 7). |
| `lib/sites.ts`, `lib/steps.ts`, `lib/compound.ts`, `lib/intent.ts`, `lib/report.ts`, `lib/summary.ts`, `lib/tools.ts`, `lib/conversation.ts` | `src/claude/` | EDITOR_PLAN §8's `claude-bridge` module. Headless, no UI. |
| `harness/bridge.ts`, `harness/loop.ts`, `harness/prompts.ts` | `src/platform/claude/` | The bridge is a platform adapter (PLAN §19.9). Route A's adapter joins it. |
| `harness/run-suite.ts` | `tools/claude-suite.ts` | Nightly with a key; `--scripted` in CI. |
| `requests.json`, `bin/corpus.ts` | `tests/claude/requests.json`, `tools/claude-corpus.ts` | The corpus source stays code; the JSON is its output. |
| `bin/reference.ts` | `tests/claude/reference.test.ts` | As a vitest suite, sharded by kind (it takes about 10 minutes in one process). |
| `lib/fixtures.ts`, `lib/synthetic.ts` | `tests/claude/fixtures.ts` | Drop the Lake Basin fallback once the reopen bug is fixed. |
| `tests/places.test.ts`, `tests/words.test.ts` | `tests/unit/places.test.ts`, `tests/unit/words.test.ts` | |
| `bin/cli.ts` | `tools/claude-cli.ts` | For playing requests by hand. |
| `bin/add-workshop-requests.ts` | `tools/claude-workshop-requests.ts` | See section 8. |

---

## 2. ROADMAP.md

### M9: replace the "Delivers" and "Acceptance" lists with

```markdown
**Delivers:** old PLAN milestone 4, and the words M12 reuses.
- `score.ts` calibrated on the official maps.
- K = 3 candidates with progressive preview (K = 1 at 256² if the M2 benchmark requires it).
- Names and premises built from the features.
- The score on the map card.
- River courses read from the actual flow: each river's path in flow order, from its settled
  water surface (else its bed), with its tributaries, and a name for each ("the main river",
  "the north tributary", "the river from the east edge").
- The place resolver (EDITOR_PLAN §7 "Spatial language"): compass places, places relative to a
  feature, and flow-relative places (upstream, downstream, a stretch of a named river's course,
  a bank), from the flow, never from a compass direction.
- The judgement-word table: each word's setting levers, measured targets and guards (EDITOR_PLAN
  §7 "Judgement words").
- The flow axes of PLAN §7.1 (D67) for the generated layouts.

**Acceptance**
- The official score distribution is documented, and the recommended official maps land in the
  top third.
- Names and premises match the features on 30 hand-checked maps.
- 256² with K = 3 takes ≤ 20 s, or K = 1 is recorded.
- Flow-relative places resolve correctly for rivers flowing in each of the four directions, a
  curved river, a drawn river and a tributary; "upstream" never means "west".
- Every judgement word moves its measured targets on three maps (two River Valley sizes and a
  Canyon), keeps every guard, and says so when its settings are already at their limits or its
  theme is marked weak.
```

### M12: replace the section's body with

```markdown
**Delivers:** E8, with the delivery choices from the M3 spike.
- Its Claude panels are built in the design flow's update mode, from the DESIGN.md and
  MEANING.md the design pass leaves behind.
- The step schema (EDITOR_PLAN §7 "Steps") and how each step becomes operations; a feature-level
  map summary (at most about 16 KB; 3–7 KB measured).
- The tools: `resolve_region`, `find_sites`, `measure`, `list_features`, `limits`, `dry_run`,
  `propose`. Each checks its own arguments and returns at most 32 KB. `find_sites` plans every
  candidate with the real builders and checks it with a real build.
- The size-word resolver on top of PLAN §9.10, and M9's place resolver and judgement words.
- Compound requests: split into goals, the app's step order, every goal checked on the combined
  result, interference between goals detected and named, and the nearest feasible alternative
  offered for every goal not met.
- Intent checks, and the loop's budget: 3 rounds and 10 tool calls for one goal, growing with the
  goals Claude declares, up to 6 rounds and 20 calls.
- The Messages API adapter (bring-your-own-key, prompt caching, configurable model, server-side
  fallbacks) and the suite runner.
- The artifact edition: a single-file build declaring `sample` and `downloads` only, and a `.zip`
  download.
- The Claude request suite (120 requests in 13 kinds) running in Node, with reference solutions.

**Acceptance**
- Malformed or out-of-bounds proposals are rejected cleanly, with the reason.
- An accepted proposal undoes as one edit, like a normal edit.
- Every reference solution passes on its map (96², 128², 256², and 48² for the reductions),
  including the 20-block waterfall with the reported reduction on 48².
- With a key, the request suite passes at least 90% overall and in every kind; every compound
  request's report names every trade-off and every goal not met.
- No request's input passes 64 KiB with the artifact limits on.
- Results stay editable by hand, and follow-ups modify the right feature.
- The artifact edition passes a manual smoke test on the same requests.

**In-game check:** play the map produced by "add a giant waterfall in the north part of the map
that is roughly 20 blocks wide", and the one produced by the headline compound request ("Make
this valley harsher. Put the start upstream, give me a huge dam opportunity halfway down, and
create a dangerous badwater route on the opposite side.").

**Effort:** xhigh.
```

---

## 3. PLAN.md §20: new decisions

Number these after M7's own decisions land (M7 already cites D71). Rows in the table's format:

```markdown
| D-a | Claude proposes **steps**, not raw operations: 15 step ops (`changeSettings`, `addSetPiece`, `changeSetPiece`, `changeFeature`, `addRiver`, `addLake`, `addLandform`, `addResource`, `removeResources`, `moveFeature`, `moveStart`, `deleteFeature`, `setRiverBadwater`, `sculpt`, `undoLast`), each with places and sizes in words or numbers. The app expands each step into the engine's operations with the same planners the editor's tools use. At most 12 steps and 30% of the map per proposal. | EDITOR_PLAN §7 says Claude proposes "operations from section 3". Raw operations carry tile lists and plan records Claude cannot produce reliably, and would bypass the planners' checks. Steps keep every number the app's. | M12 |
| D-b | The app orders a proposal's steps: settings, deletions, the start, moves and changes, rivers, lakes and landforms, dam sites and gorges, falls and cliffs, badwater, sculpts, resources. It says so when the order differs from Claude's. | A settings change regenerates the map, so anything placed before it is placed on the old map; the start and the sites decide where hazards may go. | M12 |
| D-c | Guards: every check that passes before a proposal, and every start rule the validator applies, must pass after it. A proposal that breaks one is refused, naming the step that broke it. Rules that already failed are reported, not guarded. | EDITOR_PLAN §7 "Ambiguity" and "never make a map worse" (D3, decisions-pending #8). Read from the validator at HEAD, so the start rules can change without touching the guards. | M12 |
| D-d | A goal that cannot be met gets the nearest feasible alternative, **offered, not built**. The app builds it only when it is within the goal's tolerance (a builder's reduction from 20 to 19 wide is built and reported). | Silently substituting a different map for the one asked for is the failure the suite most needs to catch. | M12 |
| D-e | The loop's budget grows with the goals Claude declares in its first `dry_run` or `propose`: 3 rounds and 10 calls for one goal; +3 calls per further goal and +1 round per two; at most 6 rounds and 20 calls. It never shrinks. Every tool result carries the budget left. | EDITOR_PLAN §7's cap of 3 rounds and about 10 calls was set for one-goal requests. The ceiling is route A's: a 17 KB prefix and six compound dry runs of about 7 KB fit in 64 KiB. Proposed from a self-played pilot (investigation/claude/pilot/PILOT.md); re-measured by the suite. | M12 |
| D-f | Judgement words ("harsher", "lush", "dangerous", …) change the map's settings, which regenerate the whole map; the player's own features stay. A word used about part of the map ("make this valley harsher") is applied map-wide and reported as map-wide, until regenerate-area (M11) can apply it to a region. | Settings are map-wide today; a regional word needs regenerateRegion. | M12; revisit with M11 |
| D-g | A settings change that moves the generated start is reported as a trade-off with the new position. | A regenerated map places its start again (18 tiles in one pilot request), and every distance to the start changes with it. | M12 |
| D-h | Size words follow the validator's numbers: a dam site's sizes are multiples of the drought need `water.reservoir` uses (tiny 0.5×, small 1×, medium 1.5×, large 2.5×, huge 4×); a giant waterfall is 30–40% of the side along its lip; a number means ±max(3, 15%). | One need everywhere: the summary, `limits`, `find_sites` and the check all show the same number. | M12 |
```

---

## 4. EDITOR_PLAN.md §7

### "Spatial language": replace the paragraph's list with

```markdown
**Spatial language.** The app, not Claude, resolves places and sizes, so results are consistent.
The resolver returns the area, how it read the words, and every assumption it made.
- Compass places use the editor's compass (north is up). "The north part" is the northern third;
  "north edge", "center", "northeast corner" each have a defined area. Non-square maps use the
  same fractions of each side.
- Places relative to features: "near the start" (20 tiles), "close to" (12), "next to" (8), "far
  from" (40 or more), "closer to the lake" (nearer than now by at least 3), "between the lake and
  the start", "along the river".
- Places along the flow, read from each river's actual flow, never from a compass direction:
  "upstream" and "downstream" of a feature (the upper or lower third when bare; "just" upstream is
  within max(12, 15% of the river)); a stretch of a named river's course ("halfway down the north
  tributary" is 40–60% of its length, "near the mouth" 75–100%); "the opposite bank" and "the
  start's bank"; "this valley" (the selected feature's river). A reference to a kind ("the lake")
  picks the one this conversation made, then the player's own, then the nearest to the start, and
  says so.
- Sizes are in blocks, matching what users see on the map grid. "Giant", "small", "a bit wider"
  map to defined ranges relative to the map's size and to the achievable ranges the builders
  publish (`PLAN.md` §9.10), documented in the schema. A giant waterfall is 30–40% of the side
  along its lip; "roughly 20" is 20 ±3; a bit wider is +25%; a huge dam site holds 4× the drought
  need the validator uses.
```

### New paragraph after "Spatial language"

```markdown
**Judgement words.** Words that judge the whole map ("harsher", "easier", "lush", "barren",
"wetter", "dangerous", "safer", "rugged", "flatter", "richer", "poorer", "roomier", "cramped",
with their aliases, and "a bit" or "much" of each) have a table: the settings each moves, the
measured targets that must move with them, and the guards. A word backs a setting off when the
full step would break a guard, and says when its settings are already at their limits. Words
without a measurable meaning ("more interesting", "nicer") are answered with concrete options.
```

### "Loop": replace with

```markdown
**Loop.** Request → queries → proposal with expectations → the app applies it to a preview,
validates and measures → revise if anything fails → the user sees the result with a short
plain-language report. Each round is a paid request on the user's plan or key, which is why the
cap matters. A round is a `dry_run` or a `propose`. A request with one goal gets 3 rounds and 10
tool calls; each further goal Claude declares adds 3 calls, and every second one a round, up to
6 rounds and 20 calls (PLAN §20, D-e). The report says what was built, with measured numbers, and
anything that differs from the request, for example: "Added a waterfall in the north, 20 blocks
wide with a 9-block drop, fed by four new springs (2 blocks/s: a thin sheet; a full
official-looking fall needs about 8 blocks/s, twice this map's river flow). It drains into the
existing river. Cleared 34 trees."
```

### New paragraph after "Loop"

```markdown
**Compound requests.** "Make this valley harsher. Put the start upstream, give me a huge dam
opportunity halfway down, and create a dangerous badwater route on the opposite side." Claude
splits a request into goals, one per thing asked, and proposes them together:
- The app applies the steps in its own order (PLAN §20, D-b), each on the map the previous ones
  left, and checks every goal's expectations on the combined result.
- It detects interference between goals and names it: badwater that would reach a reservoir
  (through its outlet, its channel, or the reservoir rising over it), a weaker river filling
  reservoirs more slowly, a new piece shrinking an existing reservoir, a regenerated map moving
  the start, a builder's reduction, what a step cleared, and settings being map-wide.
- Guards hold for the whole proposal (PLAN §20, D-c): a step that breaks one is named.
- Every goal not met gets its reason and the nearest feasible alternative, offered and not built
  (D-d). The report names every trade-off and every goal not met.
```

### New paragraph "Steps", after "Query tools"

```markdown
**Steps.** Claude proposes steps, not raw operations (PLAN §20, D-a). A step names what to build
and where in words or numbers ("addSetPiece damSite halfway down, size huge"), or takes a site
`find_sites` returned ready to use. The app expands it with the editor's own planners, so a step
fails with the planner's reason, never with a broken map.
```

### "Other uses": add at the end

```markdown
A question gets an answer, not a proposal: the summary carries each failing check's message.
```

---

## 5. EDITOR_PLAN.md §9: the Claude request suite

Replace the "Claude request suite" item with:

```markdown
- **Claude request suite:** 120 requests (`tests/claude/requests.json`), each with its map, its
  goals and their expectations, whether it is feasible, what the report must say, and a
  reference solution. The kinds: the requests below word for word, simple, follow-ups, compass,
  feature-relative, flow-relative, judgement and size words, compound, vague, impossible,
  conflicting, questions and safety. Maps: generated maps of 48², 96², 128² and 256², rivers
  drawn in each direction, tributaries, imports.
  - The reference solutions run in CI through `MapSession` with the real validators; every one
    must pass.
  - With a key, the suite runs nightly through the Messages API adapter, with the same prompts
    and tools the artifact edition uses and the artifact's limits on (64 KiB input, 32 KB
    results).
  - A request passes when the result validates, every feasible goal's expectations hold on the
    final map (measured by the app, never by Claude's own expectations), no guard broke, and the
    report names every trade-off and every goal not met, with the nearest alternative offered.
    An optional judge model checks the report against the request's must-say list.
  - Include at least:
    - "add a giant waterfall in the north part of the map that is roughly 20 blocks wide", on
      128² and 256²; on 96² it must fit, and on 48² it must report the reduction to 19;
    - "make it wider";
    - "move the start closer to the lake";
    - "add a dam site near the start";
    - "put more ruins on the eastern plateau";
    - "keep badwater in the south";
    - "make the map harder";
    - "Make this valley harsher. Put the start upstream, give me a huge dam opportunity halfway
      down, and create a dangerous badwater route on the opposite side."
  - The artifact edition gets a manual smoke test on the same requests.
```

---

## 6. M12 deliverables, acceptance and decisions

The ROADMAP text in section 2 is the source. In short:

**Deliverables:** the step schema and expansion; the summary; the seven tools; compound handling
(order, combined checks, interference, alternatives, report drafts); the budget; the Messages API
adapter and the artifact adapter; the prompts; the suite runner and grader; the corpus and its
reference runner.

**Acceptance:** section 2. The two new measurable gates are the suite's pass rate with a key (90%
overall and in every kind) and the 64 KiB input ceiling with the artifact limits on.

**Decisions:** D-a to D-h in section 3.

**Prompts.** `harness/prompts.ts` holds one pack for both routes:
- The instructions travel in the first user message, because route A has no system prompt.
- Next comes the map summary in a `<map_summary>` block. It is the cached prefix on route B, and
  the map's own text inside it is labelled as data.
- Last comes the request in a `<player_request>` block, with the selection if there is one.
- The fixed prefix, tool schemas included, is 14–18 KB (self-played pilot).

**Harness.** `harness/bridge.ts` sets the Messages API request:
- the model, configurable, defaulting to `claude-opus-5-5` (D8);
- adaptive thinking, with effort set explicitly;
- `tool_choice` auto;
- prompt caching on the last tool and the summary block;
- server-side fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`);
- the stop reasons refusal, `max_tokens` and `pause_turn` handled.

`harness/loop.ts` is append-only. It measures the input every turn and stops at 64 KiB when run
with the artifact limits. `harness/run-suite.ts --scripted` replays the reference solutions
through the same loop and grader, so CI covers the harness without a key.

---

## 7. Pending decisions, with defaults

Where this plan conflicts with a recorded decision, the default below applies until Kyler says
otherwise. For `docs/decisions-pending.md`, numbered after #22:

| # | Question | Default | Why |
|---|---|---|---|
| P1 | EDITOR_PLAN §7 has Claude "pick a sensible interpretation, do it". The suite wants the nearest alternative offered, never silently built. Which wins when a goal cannot be met as asked? | Build what is within the goal's tolerance; offer anything beyond it (D-d). | A silent substitute is the worst failure a player can meet; a reduction within tolerance is still what was asked. |
| P2 | The loop's cap: 3 rounds and about 10 calls (EDITOR_PLAN §7), or scaled with the goals? | Scaled, 3/10 for one goal up to 6/20 (D-e). | Compound requests need more rounds; route A's 64 KiB sets the ceiling. |
| P3 | Claude proposes raw operations (EDITOR_PLAN §7) or steps? | Steps (D-a). | Section 4 "Steps". |
| P4 | A request that would break a start rule: ask first (EDITOR_PLAN §7 "Ambiguity") or refuse with an offer? | Build the nearest version that keeps the rule, say how it was bent (X01: "just upstream" became 46 tiles away), and offer; ask only when no version keeps it. | One round saved, and the player sees a real option. |
| P5 | "Make this valley harsher": a regional judgement word. | Map-wide, reported as map-wide (D-f). | Needs regenerateRegion (M11). |
| P6 | A judgement word regenerates the map and moves the generated start. Keep the start where it was? | Report it (D-g); do not pin it. | Pinning the generated start changes the generator's contract (the start follows the layout); M12 can revisit once regenerate keeps constraints. |
| P7 | The summary's `stored.bestDamNearStart` is the validator's best gap to dam anywhere near the start; `find_sites` offers dam sites the builders can make (smaller on small maps). Which does the player hear about? | Both, labelled: "the map can store N" (validator) and "the best dam site I can build holds M". | They answer different questions, and the validator's is what `water.reservoir` checks. |

---

## 8. Changes `src/` needs

The investigation made none of these. Each worked around the gap under `investigation/claude/`.

1. **One undo for a whole proposal.** A proposal of a settings change plus steps is several
   history entries today: `specPatch` alone, then each `applyAll`. `MapSession` needs a grouped
   entry (begin/end, or `applyAll` accepting a `specPatch` first) so "accepted proposals undo like
   normal edits" holds. The investigation counts undo steps per proposal (`undoSteps`).
2. **Stable preview ids.** A feature's id seeds its build (a dam site's ridge wobble), so a site
   checked with one id can differ when built with another. The investigation hints the next id to
   the verifier (`hintIds`). The engine could take an explicit id in `planPiece` previews, or seed
   the wobble from the request instead.
3. **Builders expose what they measure.** The dam site's reservoir tiles, the waterfall's lip,
   the badwater basin's footprint and outlet tiles. The investigation re-derives them
   (`reservoirTiles` floods from the crest; `measureLip`). Returning them from `plan` would make
   interference exact and cheaper.
4. **The Lake Basin reopen bug.** A generated Lake Basin document fails `checkDocument` on
   reopen: `/4/params/outline/15/0 must be >= -1` (seeds 2 and 3 at 128², still on dev at
   `5b17375`). The ring's outline goes off the map. Clamp the outline, or allow −1.5. Fixtures fall
   back to regenerating.
5. **The river badwater switch.** On the branch point, `RiverParams.badwater` is stored and
   ignored, so `setRiverBadwater` is refused. Dev (`30bf647`) builds badwater rivers that enter
   from a map edge. M12's step should then allow it for edge rivers and refuse it, with the
   reason, for rivers that start inland.
6. **Step support for M7's new pieces and objects.** Dev has the builders and features; the step
   layer needs thin wrappers (section 9).
7. **Flow axes (D67).** Every theme flows west to east today. The resolver never assumes it, and
   the tests draw rivers in every direction. M9's flow axes need no change here.
8. **`regenerateRegion` (M11)** for regional judgement words (P5).
9. **Map objects in the way (dev, M7).** Generated maps on dev carry mine sites, relics,
   geothermal fields, thorn belts, weirs and plugs. A drawn river or a set piece can undercut or
   flood one ("UndergroundRuins at (91,82,16): floating"), and the guards refuse the proposal, as
   they should. The planners should keep off map objects' footprints, as they keep off the start:
   `planRiver` should route round them, and each builder's `plan` should refuse a site on one with
   the reason. `find_sites` already tries sites near map objects last.
10. **Performance at 256².** `find_sites` for a dam site takes about 3.7 s at 256², and the
   compound reference M10 (three goals at 256²) about 24 s, most of it verifying candidates with
   real builds. A cached settle per candidate or a cheaper pre-filter is needed before the
   artifact route, where each call blocks the page.

## 9. Requests today's operations cannot express

Nine requests in the corpus are marked `expressible: false`. Each carries what it needs:

| Request | Needs | On dev now |
|---|---|---|
| I04 (a second colony) | Multi-colony starts (Timber Together, D5) | Not scheduled |
| I05 (a river flowing north) | Flow axes for generated layouts (D67, M9), or a step that reroutes a generated river | M9 |
| I08 (a cave) | Voxel-level caves (EDITOR_PLAN §2 non-goal) | No |
| X05 (make the main river badwater) | The river badwater switch in the build | Built for edge rivers (`30bf647`); needs the step (item 5) |
| N01 (thorn belts) | Map objects (M7) | Built (`fff2ce0`); needs an `addMapObject` step |
| N02 (a relic) | Map objects with their distance bands (M7) | Built; needs an `addMapObject` step |
| N03 (a plugged spillway) | The `plugSpillway` builder | Built (`412344c`); needs `addSetPiece plugSpillway` with a lake target |
| N04 (regenerate the east third) | `regenerateRegion` (M11) | M11 |
| N05 (make the map symmetric) | Symmetry (M10) | M10 |

The step wrappers dev now allows:
- `addMapObject {kind: mineSite|relicSmall|relicMedium|relicLarge|geothermal|thornBelt|weir|plug|bridge|unstableCore, where, size}`: a site finder per kind, with M7's placement emulation as the check.
- `addSetPiece` for `plugSpillway {lake}`, `obstaclePayoff {where, rise 2–4, payoff: ruins|relic}` and `secondDistrict {where}`, with `find_sites` kinds for each.

## 10. The workshop slot

The task asked for the workshop investigation's landform catalogue. No PR from
`investigation/workshop` existed on 2026-09-24. `requests.json` holds a marked slot:
`workshopSlot: {status: "empty: …", fill: "npx tsx investigation/claude/bin/add-workshop-requests.ts <catalogue.json>", kind: "workshop"}`.

The script takes the catalogue as a JSON list of patterns, each `{name, description}` with
optional `kind`, `size`, `where`, `buildable` and `needs`. It appends one request per pattern
("add a spiral mountain"), with a goal that a new feature of the pattern's kind lands in the named
place. Patterns today's steps cannot build are marked `expressible: false` with what they need.
`bin/corpus.ts` keeps workshop requests when it rewrites the corpus. After filling it, run
`bin/reference.ts --kind workshop`.

---

## 11. Checked against dev

On 2026-09-24, `investigation/claude/` was copied into a worktree of dev at `5b17375` (M7 in
progress) and run there. Nothing was committed to dev.

- **Typecheck:** clean.
- **Tests:** 51 of 53 pass. The two failures are the drawn-creek fixtures: the north and east
  creeks now cross a generated mine site, and the guards refuse the edit
  (`entities.placement`: "UndergroundRuins at (91,82,16): floating").
- **Reference solutions:** 106 of 120 pass. M7 changed every generated map, and the corpus's
  setups were tuned on the maps at the branch point. The 14 failures:

| Why | Requests |
|---|---|
| A drawn creek or a chosen site undercuts or covers a new map object (`entities.placement`, `extras.placement`) | P08, C01, W05, W06, W07, X04, M04 |
| The regenerated map is different: the sites the setup relied on now break `start.reach` or no longer exist | S03, S04, M02, V02 |
| The headline request's "start upstream": all 10 checked upstream spots on the harsher dev map break `water.reservoir` | M01, and F07 and F08, which use M01 as their setup |

What M12 should do:
- Re-tune the setups (seeds and drawn points) once M7 has landed.
- Make the planners keep off map objects (section 8, item 9).
- Give the start search a pre-filter for `water.reservoir`, as it has for water, trees and
  berries: it checks only 10 candidates with a real build.

None of the failures is the resolver or the tools misreading a request.

---

## 12. Message for the milestone session

Paste this into the session that runs M9 or M12:

```text
Before starting M9 or M12, read investigation/claude/M12-INTEGRATION.md on the
investigation/claude branch (PR into dev, not merged). It holds exact text for ROADMAP M9 and M12,
PLAN §20 (decisions D-a to D-h, to be numbered after M7's), and EDITOR_PLAN §7 and §9, plus the
files to move into src/ and tests/.

M9: move lib/view.ts, lib/flow.ts, lib/places.ts and lib/words.ts into src/core (section 1),
with tests/places.test.ts and tests/words.test.ts. Keep the rule that "upstream" is read from
each river's flow, never from a compass direction; the tests draw rivers in all four directions.

Against dev at 5b17375 (M7 in progress), 106 of 120 reference solutions pass; the rest need
their setups re-tuned for M7's maps and objects (section 11).

M12: move the rest (lib/*, harness/*) as section 1 says, and make the src/ changes in section 8
first: one undo entry per proposal, stable preview ids, builders that return their reservoir
and lip tiles, the Lake Basin reopen fix, and the river badwater step for edge rivers. Add the
M7 step wrappers in section 9. Then run tests/claude/reference.test.ts (all 120 must pass) and
tools/claude-suite.ts --scripted in CI; with a key, the nightly suite must pass 90% overall and
in every kind with --artifact-limits on.

Open decisions (section 7, P1–P7) have defaults; follow them unless Kyler has answered. Numbers
in pilot/PILOT.md come from a self-played pilot, not from a model: re-measure the budget with
the real suite before fixing it in the plan.
```
