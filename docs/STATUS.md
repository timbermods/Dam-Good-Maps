# Status

One page, rewritten at every step and stop. Updated 2026-09-25, after recording Kyler's answers to
the eight flags (D145). The decisions' full text is in
[PLAN.md §20](../PLAN.md#20-editor-decisions), and the order of work in [ROADMAP.md](../ROADMAP.md).

## Decisions since M8

Every decision Kyler sent since `m8-done`, in the version in force.

- **D107** Beaverome is off M8's approximate-water list; `start.dry` stays as built, and lakeside
  starts are a Refinement item, measured first; 3D-a applies the floor rule only under roofs
  (D145).
- **Refinement: the load checks** keep a load check only where the game really rejects or breaks
  the map; otherwise a warning.
- **D108** Product principle: maps are created, never copied, never a few archetypes with noise.
- **D109** An M9 design step comes before M9 (its gate is D112's).
- **D110** Map look as built from Kyler's reference (dry ground's colour: D135).
- **D111** No built dam walls, anywhere; `water.storage_possible` replaces `water.reservoir`.
- **D112** Kyler approves M9 design version 2 by judgement, from the measures (information), the
  simulated play and ten briefs; the dam-wall check blocks; the permanent measures run after M9.
- **M9a's contact-sheet command** `npm run sheet`: a tool for Kyler's eyes, not a gate.
- **D113** Frame pass after the M9 build, before the 3D stages (`frame-pass-done`).
- **D114** Map look's first fix round (its marks and enlarged objects: D135's information layer).
- **D115** Kyler's one rule: only breakage, Kyler's decided principles and what a player feels
  block; measures and budgets are information; Kyler decides visual work from captures; stop
  only for real decisions or breakage. (It replaces the first note on a lighter process.)
  ROADMAP's Blocking and Information lists stand; the dam-wall check and the support rule always
  block; CI's timing tests become reported numbers (D145).
- **D116** M9a's in-game gate is a DGM Probe batch, not Kyler's play test; 3D-b's too, T7
  included (D145).
- **D117** The probe rule: the Probe may launch Timberborn only after Kyler's yes in chat, every
  batch (CLAUDE.md).
- **D118–D127** Real 3D terrain is essential: P3D-1 to P3D-9 adopted (runs per tile, stacked
  water, the support rule, the floor graph, Verticality, the 3D stages after the Frame pass,
  editing caves, one mesher, the Probe for 3D). I-1: format 3 stores runs from M9a.
- **D128** No approximation: at most 10% of a theme's maps under the workshop's p10 distance.
- **D129** The audit: A1 and A2 into M9a; A3 and A4 onto the Refinement list.
- **D130** The simulation speedups, as proposals, in M9a's build plan, each proved bit for bit.
- **D131** The techniques playbook, as proposals for M9 and the 3D design.
- **D132** Verticality (`vt`) beside Variety, in M9a; above 16 only at 70 and above, locked until
  a probe batch confirms it; 3D-b extends it to 3D forms (D145); vertical and traversable;
  measured in design version 2.
- **D133** The Weather view with live water, after the 3D stages (`weather-view-done`).
- **D134** Keep M12 ready: each step adds tool entries and suite requests, and keeps the suite green.
- **D135** Map look: a clean default look close to the game, and an information layer; Kyler
  approves the appeal from captures.
- **D136** Real places: a gallery of 88 real-terrain maps, right after Map look
  (`real-places-done`).
- **D137** The workshop ratings are dropped; the score is a mild tiebreaker; in-site feedback is
  proposed for M9c. M13's rating form is dropped too; a plain "report a problem" link stays
  (D145).
- **D138** Maps feel authored: one or two intentions per map, under three principles.
- **D139** Claude steers the generator and never hand-builds the map; "describe the map you want"
  in M12. New landforms, water features, dam opportunities and character requests ("harsher")
  steer; precise edits and follow-ups stay operations (D145).
- **D140** M12's model layer is provider-neutral; Claude is the only provider built.
- **D141** A Dam Good Maps MCP server, after M12.
- **D142** The agent guide, after M9a.
- **D143** Variations of this map, in M9c.
- **D144** A contact-sheet image at every map-changing step, in `docs/sheets/`.
- **D145** Kyler's answers to the eight flags, folded into the lines above. Also: M9a, M9b and M9c
  are approved as M9's stages; what goes into each waits for design version 2.
- **Design version 2** is built on `investigation/generative-v2` (not started).
- D146: a **Map quality checkpoint** after the M9 build: contact sheets, a probe batch (asked first), the measures as information, the weakest patterns; tuning rounds until Kyler says go.
- D147: **Map look 2: high fidelity** after the checkpoint and before the Frame pass: High / Standard / Light quality; High adds a real water shader, soft shadows, AO, finer procedural detail, softened edges, anti-aliasing and richer models; our own art; judged by eye; `map-look-2-done`.
- D148: tests a decision made stale are updated to the current decision, renamed and logged, without asking; never weakened.
- D149: the DGM Probe's integration, adopted as proposals; Kyler decided its two conflicts: results go to `C:\dgm-probe\`, and the probe batch alone is M9a's gate.
- D150: dependency updates: Actions and minor or patch npm updates merged when CI is green; majors held for a deliberate upgrade step (refinement); one weekly Dependabot pull request per ecosystem.
- D151: no edge walls (extends D111); a blocking check.
- D152: maps don't have to hold their water; no walls or rims; the settle check accepts a steady flow off the map.
- D153: start water counts over natural slopes within 12 / 20 / 28 tiles (amends D85).
- D154: contaminated ground is a layer of crack veins over the ground's own look.
- D155–D157: Real places, second round: short descriptions with a credits page, deploy-time files, clean titles, 3D thumbnails, no walls, about 150 places.
- D158: **Live editing**, alongside the M9 design: a triage first, then Cities-style terrain brushes, live shape tools, water that never blocks; tried by Kyler on `/preview/`.
- D159: M11's heightmap import uses the survey's conversion pipeline (drainage rivers, sources, the start rules, the water rules).
- D160: later, after M11: "Pick a place" from a world map or coordinates, open elevation data only, with attribution.
- D161: the north-star journey: a striking place → Pick a place → the Weather view → Live editing → play; each step smooth, no gaps.
- D160 (moved): Pick a place right after Live editing, alongside M9.
- D162: Save to Timberborn, soon: pick the Maps folder once, then save straight into it (Chrome, Edge).
- D163: later, proposed: a companion mod that lists and starts new Dam Good Maps maps from the game's menu.

## Done and released

- **Real places** is live (`real-places-done`, PR #31, live check passed): 85 real-terrain maps.
- **The DGM Probe** (PR #18) is merged; its INTEGRATION.md is adopted as proposals (D149).
- **M1–M8 and Map look** are live: <https://timbermods.github.io/dam-good-maps/> (`m8-done`, live check
  passed).
- **Map look** is live (`map-look-done`, PR #22, live check passed): the clean look Kyler
  approved, with a **Markers** layer off by default.
- Merged investigations: workshop (#4), Claude groundwork (#5), cycles (#10, #15), mechanics,
  verified (#11), names (#12), audit (#13), M9 design version 1 (#14), landscapes (#16), simspeed
  (#17), techniques (#19), terrain 3D (#20).
- Repo improvements (#21): PR checks fail only on breakage, timings are reported, heavy suites
  run nightly, an investigation index with an import guard, Dependabot and CodeQL.

## Running

- **M9 design version 2**, on branch `investigation/generative-v2` (a PR into `dev` when done,
  not merged).
- **The start and edge rules** (D151–D153), on branch `feature/start-edge-rules`.
- **Real places, second round** (D155–D157), on branch `feature/real-places-2`; its rebuild without
  walls and the growth to about 150 places wait for the start and edge rules.
- **Live editing** (D158), on branch `feature/live-editing`: the triage first, then a playable
  version for Kyler on the preview address.
- **Contaminated ground as a layer** (D154), on branch `look/contamination`; Kyler decides from
  captures.
- Dependabot: the GitHub Actions updates (#26–#30) merge when CI is green; the majors (#24, #25)
  wait for the deliberate upgrade step (D150).

## Waiting on Kyler

1. Whether two older look tests should compare the water's body, not its ripple crests, with
   badwater (they pass through an alias today; see `docs/progress/map-look.md`).
2. Kyler's own one-sentence intentions, for design version 2.
3. Approve design version 2 when it's built, with what goes into each M9 stage; approve the
   feedback proposal (D137).
4. A yes before each probe batch; the first is M9a's.
5. Open decisions: 47 in [decisions-pending.md](decisions-pending.md), each with a default; new:
   #51–#53.
6. Optional: the pending in-game checks ([ingame-log.md](ingame-log.md)), and the M3 spike page
   ([What Kyler needs to do](progress/kyler-todo.md), item 4).

## Where to look next

- [ROADMAP.md](../ROADMAP.md): the order of work, and each step's Blocking and Information lists.
- [PLAN.md §20](../PLAN.md#20-editor-decisions): every decision, D1–D145.
- [decisions-pending.md](decisions-pending.md): open questions with their defaults.
- [m9-design.md](m9-design.md): M9 design version 1.
- [ingame-log.md](ingame-log.md): in-game checks and the planned probe batches.
- [progress/README.md](progress/README.md): the record of each milestone and step, one file each.
- [progress/kyler-todo.md](progress/kyler-todo.md): what Kyler needs to do, with the exact steps.
