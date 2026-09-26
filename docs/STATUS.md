# Status

One page, rewritten at every step and stop. Updated 2026-09-25, after the tall-maps probe batch and
the Live editing preview. The decisions' full text is in
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
- **Design version 2** is being built on `investigation/generative-v2` (PR #32).
- D146: a **Map quality checkpoint** after the M9 build: contact sheets, a probe batch (asked first), the measures as information, the weakest patterns; tuning rounds until Kyler says go.
- D147: **Map look 2: water and shadows** before the Frame pass: a High mode with a proper water shader and soft sun shadows only; today's textures stay; AO, grading, richer textures and models later, optional.
- D148: tests a decision made stale are updated to the current decision, renamed and logged, without asking; never weakened.
- D149: the DGM Probe's integration, adopted as proposals; Kyler decided its two conflicts: results go to `C:\dgm-probe\`, and the probe batch alone is M9a's gate.
- D150: dependency updates: Actions and minor or patch npm updates merged when CI is green; majors held for a deliberate upgrade step (refinement); one weekly Dependabot pull request per ecosystem.
- D151: no edge walls (extends D111); a blocking check.
- D152: maps don't have to hold their water; no walls or rims; the settle check accepts a steady flow off the map.
- D153: start water counts over natural slopes within 12 / 20 / 28 tiles (amends D85).
- D154: contaminated ground is a layer of crack veins over the ground's own look.
- D155–D157: Real places, second round: short descriptions with a credits page, deploy-time files, clean titles, 3D thumbnails, no walls, about 150 places.
- D158: **Live editing**, alongside the M9 design: a triage first, then Cities-style terrain brushes and water that never blocks; tried by Kyler on `/preview/` (its shape tools removed by D182).
- D159: M11's heightmap import uses the survey's conversion pipeline (drainage rivers, sources, the start rules, the water rules).
- D160: later, after M11: "Pick a place" from a world map or coordinates, open elevation data only, with attribution.
- D161: the north-star journey: a striking place → Pick a place → the Weather view → Live editing → play; each step smooth, no gaps.
- D160/D175: Pick a place, the full experience (explore a 3D world map, frame a square with a live block preview, one click to build), right after M11 and before the refinement phase.
- D162: Save to Timberborn, soon: pick the Maps folder once, then save straight into it (Chrome, Edge).
- D163: later, proposed: a companion mod that lists and starts new Dam Good Maps maps from the game's menu.
- D164: starting wood: the start counts logs by species (oak 8, pine 2 plus resin, birch 1), not trees; "Minimum starting wood"; species as a generator lever.
- D165: Kyler's four intentions (start under a cliff with water below; a snaking river down a hill; a crater where rivers converge; a cliff waterfall into a large round lake), plus 10–15 candidates for him to pick.
- D166: Pick a place: real land, designed water; it never fails for lack of water, meets the start rules, and quietly tries other sizes, scales and offsets; #34 held until its designed-water follow-up is finished and green, then merged and adopted with this change.
- D167–D170: resources like the official maps: a mine site on every map (Mine sites 1–4), tree counts and living/dead share by size, groves and berry patches in clusters, ruins that vary; one shared baseline for the generator, Real places and Pick a place.
- D171: water sources start rivers: only at heads (edge inflows, springs), clustered for more flow, never inside an existing flow; a check flags any that are.
- D172: tall maps (up to 22): allowed in both validators once a probe batch confirms; a standard/tall option for Real places and Pick a place, dramatic places tall by default.
- D173: #33's exact-weather speedups and scheduling, adopted as Weather view proposals.
- D174: Real places review: 3D thumbnails with a crisp 2D top-down (two layouts to pick from), tighter framing, the survey patches may be re-downloaded, credits confirmed, three titles changed.
- D176: design timing: new interface uses the existing shared styles and components until the Frame pass; after it, the design records; M12 and M13 get the finish review, no second full design pass.
- D172 (1) confirmed: the tall-maps probe batch passed, so both validators allow heights up to 22 (built in the start and edge rules).
- D177: in the Standard look, badwater blends smoothly into clean water by contamination (toward #4B3C37), a soft gradient over several tiles, distinct in greyscale; consistent with #38's High look.
- D178: mine sites and ruins get models of our own: a sunken pit with a rusty frame and corner scaffolding; ruined scaffold towers with braces, panels and ivy on moist ground.
- D179: **Live editing is how you edit a map**, the editor's core principle: every tool live, water flowing visibly after every edit, brush shapes and a precise mode, one Select tool; no plan-confirm-place flow remains (its water tools, plant painting and object dragging became D184's smart Lower, Source and left shelf).
- #56: a failed Pick a place map is never shown; nearby choices that passed, or what to try.
- D180: Live editing additions: a smooth native camera (WASD, Q/E, Shift), Remove (first named Demolish), water-aware Ctrl-click sampling, player-set source strength, "let the water carve", water time controls with a "drought" button, and local-first water that always ends at the game's settled result (its drawn-river rules and natural or exact rivers removed by D184).
- D181: more for water: carving forms valleys (downcutting, slumping terraces, floodplains, deltas; steep or wide walls), moisture and grass spreading live from new water, a "badtide" button, optional water sounds of our own.
- D182: **the brush kit is the core of the editor**: the landform objects and their handles removed, no presets; terraces and ramps (now Flatten and Smooth options, D184), pen pressure and level lines; future tools brush-first (symmetry mirrors strokes, stamps are painted, carving is a brush).
- D183: live dimensions: a selection's size in tiles, a straight stroke's length, the level while flattening (D184 removed the other cursor readouts).
- D184: **the editor's design principles**: the land is the interface; a top bar (Raise, Lower, Flatten, Smooth, Naturalize | Source | Remove) with a small options row; water from smart Lower and Source, everything else emerging from the land; a left shelf of object icons with live ghosts; view buttons with overlays; a header with Save to Timberborn and one menu; a quiet status dot; drawn rivers and lakes removed; plain scroll zooms and Alt+scroll sets strength (#58).
- D185–D187: the editor is desktop-first; the editor's Drought and Badtide buttons show each event, and the Weather view is the separate full-cycle timeline; Claude is a summoned chat box.
- D188: docs are part of done: living docs updated in the same PR, a drift check at each milestone boundary, a CI guard for retired terms, and a docs index (`docs/README.md`). EDITOR_PLAN.md now opens with the editor's vision.
- D189: design version 2's scope is frozen; anything new goes into the M9a, M9b or M9c builds.

## Done and released

- **The preview workflow** is live (`preview-workflow-done`, PR #39, live check passed):
  <https://timbermods.github.io/dam-good-maps/preview/> shows Live editing (noindex).
- **Real places** is live (`real-places-done`, PR #31, live check passed): 85 real-terrain maps.
- **#34** (Pick a place, designed water) is merged; its proposals are adopted for Pick a place (D166).
- **#33** (exact-weather speedups) is merged; its proposals are adopted (D173).
- **The DGM Probe** (PR #18) is merged; its INTEGRATION.md is adopted as proposals (D149).
- **Contaminated ground as a layer** is live (`look-contamination-done`, PR #36, live check passed).
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
- **The start and edge rules** (D151–D153, and D172 (1)'s height limit of 22), on branch
  `feature/start-edge-rules`.
- **Resources like the official maps** (D167–D170): PR #43, approved by Kyler; merged after the start
  and edge rules, then the Real places are rebuilt through its planner.
- **The Claude suite's setups** (D134): 101 of 120 reference solutions pass on `dev`; the 19 failures are
  setups tuned on M7's maps that later generator changes moved (M12-INTEGRATION §11). They are re-tuned
  once the start and edge rules and the resources step land, since both change generated maps again.
- **Real places, second round** (D155–D157), on branch `feature/real-places-2`; its rebuild without
  walls and the growth to about 150 places wait for the start and edge rules.
- **Live editing** (D158, D179–D184), on branch `feature/live-editing`: the camera (approved) and
  water part 1 are on the preview address; next water per D184 (smart Lower, Source, part 2's paced
  water), then the rest of D184's design in pushes.
- **The docs sweep** (D188), on branch `chore/docs-sweep`: the living docs checked against the
  editor vision, and CI's retired-terms guard. What the Live editing work must keep, and the
  editor text it still has to change: [progress/docs-sweep.md](progress/docs-sweep.md).
- **Map look fixes**, each judged by Kyler from captures: badwater blending (D177) on
  `look/badwater-blend`; mine sites and ruins (D178) on `look/mine-site`.
- Dependabot: the Actions updates merge when CI is green; the majors (#24, #25) wait for the
  deliberate upgrade step (D150).
- Queued for the next boundary, each merged once green: **Save to Timberborn** (PR #40, finished and
  reviewed; it becomes the editor's primary button), `investigation/pickplace-water2` and #38 (Map
  look 2), when their PRs are open.

## Waiting on Kyler

1. Try each Live editing push on <https://timbermods.github.io/dam-good-maps/preview/>; it is
   released when it feels right.
2. Approve design version 2 when it's built, with what goes into each M9 stage; approve the
   feedback proposal (D137).
3. The Map look fixes: #41 again, with #38's approved badwater in the shared water palette (D177).
   Mine sites and ruins (#42, D178) are approved; they're released after one ivy change.
4. A yes before each probe batch; the next is M9a's.
5. Open decisions: 47 in [decisions-pending.md](decisions-pending.md), each with a default; new:
   #51–#53.
6. Optional: the pending in-game checks ([ingame-log.md](ingame-log.md)), the M3 spike page
   ([What Kyler needs to do](progress/kyler-todo.md), item 4).

## Where to look next

- [ROADMAP.md](../ROADMAP.md): the order of work, and each step's Blocking and Information lists.
- [PLAN.md §20](../PLAN.md#20-editor-decisions): every decision, D1–D189.
- [decisions-pending.md](decisions-pending.md): open questions with their defaults.
- [m9-design.md](m9-design.md): M9 design version 1.
- [ingame-log.md](ingame-log.md): in-game checks and the planned probe batches.
- [progress/README.md](progress/README.md): the record of each milestone and step, one file each.
- [progress/kyler-todo.md](progress/kyler-todo.md): what Kyler needs to do, with the exact steps.
