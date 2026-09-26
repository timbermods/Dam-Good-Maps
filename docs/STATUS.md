# Status

One page, rewritten at every step and stop. Updated 2026-09-25, after the tall-maps probe batch and
the Live editing preview. The decisions' full text is in
[PLAN.md §20](../PLAN.md#20-editor-decisions), and the order of work in [ROADMAP.md](../ROADMAP.md).

## Morning summary, 2026-09-26

Most important first. Nothing below was released without your approval.

### 1. Design version 2: approved by you overnight, and M9a is being built

- Merged: PR #32 (f04674d). Your conditions and decisions are D209 and D210.
- The review material stays on `dev`:
  - [docs/m9-design.md](m9-design.md): §0 changes, §6 intentions, §17 risks, §18 the M9a–c split, §19 your decisions;
  - `investigation/generative/REPORT-v2.md`;
  - one contact sheet per theme in `docs/sheets/design-v2/`, plus `docs/sheets/design-v2.png`;
  - the ten briefs in `investigation/generative/briefs/v2/`, with their renders in `investigation/generative/renders/v2/`.
- **M9a** is running on `feature/m9a` ([PR #56](https://github.com/timbermods/dam-good-maps/pull/56), work in progress),
  first on the machine. Its first slice is in: the generator from the processes, "Any" by default with a
  Verticality slider, the straight-river check, format 3, generator 0.7.0, and 100% final on its first
  128² batches, "Any" included. Its in-game gate batch is prepared (15 maps, about 1½ hours) and waits for
  your yes.
  - It includes "Any" as the default, no ruler-straight rivers, badwater on every map, and every rule since version 2.
  - Its agent definitions (M9a on Opus at xhigh, M9b and M9c at high, routine work on Sonnet at medium) are in `.claude/agents/`. They load from the next session, so tonight's M9a agent runs on Opus 5.5 at this session's effort.

### 2. Waiting on you

1. **Try Live editing:** <https://timbermods.github.io/dam-good-maps/preview/> → **Refine this map**. All four D184 pushes are there (59f826c):
   - the top bar and brush kit, and Flatten (D204);
   - the left shelf with live ghosts;
   - **Remove**;
   - the view buttons with the game's layers (D207);
   - the header with **Save to Timberborn** and the quiet dot;
   - the minimap and camera bookmarks.

   Say when it feels right, and it releases as `live-editing-done`. Three defaults to confirm or flip:
   - the camera's old R/F zoom is gone, so F can resize the brush and R can turn objects;
   - juice sounds are on by default, quiet, with a volume and an off switch;
   - picking a layer takes the game's Alt+middle-click, and Alt+click is kept too.
2. **Waterfalls (D201):** [PR #53](https://github.com/timbermods/dam-good-maps/pull/53), captures in `docs/look/waterfalls/` on its branch. Judge:
   - how far falls reach, how white they are, and how strong the splash is;
   - L-shaped lips make a V with a gap.

   Approving releases it as `look-waterfalls-done`.
3. **Real places, second round:** [PR #35](https://github.com/timbermods/dam-good-maps/pull/35).
   - 150 places, rebuilt without walls. Only badwater is still to come; it's added once #54 merges.
   - Say which places should go: `C:\dgm-workshop\places\sheet.html`, where all 150 are numbered, with a before/after for the walls in `walls.html`.
   - Check the second-map titles: eleven end in "Centre", and one reads "Mahabaleshwar East, Western Ghats".
   - 25 maps needed 8× the official water strength.
4. **Badwater on every map (D200):** [PR #54](https://github.com/timbermods/dam-good-maps/pull/54), generator
   0.6.3, finished. It adds a "No badwater" option, and the batches finish 100% (2,760 maps). Every
   official map has lasting badwater: 18 have a badwater source, and Spillage has seeps. Your calls:
   - **The contact sheet** `docs/sheets/badwater-source.png` (on its branch): most maps now get 2 sources
     at 128² and 3–4 at 192² and 256². Its badwater streams run ruler-straight with right-angle turns,
     from today's generator: exactly what D209 fixes in M9a. **My default:** merge #54 into `dev` (Real
     places and M9a use its placement module), but release it only with M9a, so players never see
     those straight streams.
   - **Claude's "remove the badwater spring"** (P09) on a map with one source left: set the map to "No
     badwater", or refuse? It refuses for now.
5. **The forces prototypes are held until you say each is ready:**
   - Carve [#47](https://github.com/timbermods/dam-good-maps/pull/47) (one more Codex round: Wander, Width, variation, Try another path);
   - Erupt [#50](https://github.com/timbermods/dam-good-maps/pull/50);
   - Craterize [#51](https://github.com/timbermods/dam-good-maps/pull/51);
   - Quake [#52](https://github.com/timbermods/dam-good-maps/pull/52).
6. **The docs sweep's two readings of your decisions** (#46, merged):
   - whether 3D carving gets its own Carve and Fill buttons, or makes Lower and Raise smarter;
   - how M12's Claude steps map onto the new editor (ROADMAP M12, "The model").
7. **Pending #66:** your pick of the candidate intentions.

### 3. Released, merged and finished overnight

- **Released** (each live check passed):
  - `look-mine-ruins-done`, `start-edge-rules-done` and `save-to-timberborn-done` (PR #48);
  - `look-badwater-done` (PR #49).
- **Merged into `dev`:**
  - #40 Save to Timberborn;
  - #41 the badwater blend;
  - #42 mine sites and ruins;
  - #43 resources (generator 0.6.2; 2,760 maps, 100% final);
  - #44 the start and edge rules;
  - #45 Pick a place's signature water;
  - #38 Map look 2's investigation;
  - #46 the docs sweep and the retired-terms guard;
  - #32 design version 2.
- **Live editing:** pushes 1–4 are on the preview, with your D193–D207.
- **Recorded:** decisions D192–D210, and the repository size rule for investigations (D195).
- **Probe batches:** none ran. The machine was never quiet: M9a and the batches ran all night. M9a's in-game gate batch will be ready later and needs your yes (the usual rule applies again today).

### 4. What failed or got stuck, and what I did

- **Two agents stopped by accident** (design version 2 and resources): replaced in their own worktrees, and no work was lost.
- **The resources agent handed back early once:** it was resumed and finished.
- **A leftover Hill message on the preview:** removed. The retired-terms guard now also catches retired interface text, with a test.
- **The water on screen could lag the map's water on slow machines:** fixed in Live editing.
- **Not addressed:** where a Blockage raises the water floor, the 3D view draws the water at ground level, so a small fall shows there that the simulation doesn't have. This is older than tonight's work.
- **The Claude reference suite:** 13 failures on `dev` come from generator changes moving their setups; the re-tune is scheduled after the generator steps.

### 5. Still running

- M9a (`feature/m9a`).
- The badwater step's final checks (#54).
- The Real places rebuild's badwater stage, after #54 merges.

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
- D180: Live editing additions: a smooth native camera (WASD, Q/E, Shift), Remove (first named Demolish), water-aware Ctrl-click sampling, player-set source strength, "let the water carve" (Carve since D194), water time controls with a "drought" button, and local-first water that always ends at the game's settled result (its drawn-river rules and natural or exact rivers removed by D184).
- D181: more for water: carving forms valleys (downcutting, slumping terraces, floodplains, deltas; steep or wide walls), moisture and grass spreading live from new water, a "badtide" button, optional water sounds of our own.
- D182: **the brush kit is the core of the editor**: the landform objects and their handles removed, no presets; terraces and ramps (now Flatten and Smooth options, D184), pen pressure and level lines; future tools brush-first (symmetry mirrors strokes, stamps are painted, carving is a brush).
- D183: live dimensions: a selection's size in tiles, a straight stroke's length, the level while flattening (D184 removed the other cursor readouts).
- D184: **the editor's design principles**: the land is the interface; a top bar (Raise, Lower, Flatten, Smooth, Naturalize | Source | Remove) with a small options row; water from smart Lower and Source, everything else emerging from the land; a left shelf of object icons with live ghosts; view buttons with overlays; a header with Save to Timberborn and one menu; a quiet status dot; drawn rivers and lakes removed; plain scroll zooms (strength on Shift+scroll since D196).
- D185–D187: the editor is desktop-first; the editor's Drought and Badtide buttons show each event, and the Weather view is the separate full-cycle timeline; Claude is a summoned chat box.
- D188: docs are part of done: living docs updated in the same PR, a drift check at each milestone boundary, a CI guard for retired terms, and a docs index (`docs/README.md`). EDITOR_PLAN.md now opens with the editor's vision.
- D189: design version 2's scope is frozen; anything new goes into the M9a, M9b or M9c builds.
- D190: #51–#53 decided (the defaults): world traits are candidate intentions; wet caves allowed in 3D-b; the no-clone distance picks candidates, the score breaks near ties.
- D191: Save to Timberborn never overwrites; a same-named map is saved as "Name (2)" with a quiet note.
- D192: Pick a place's signature water (#45) with ESA WorldCover, credited like the elevation data; hard cases offered with nearby alternatives.
- D193: hold to dig: in precise mode, holding Lower or Raise keeps working a level at a time, with an optional stop level.
- D194: Carve becomes a force of nature with its own top-bar button next to Source; PR #47 held until Kyler says it's ready.
- D195: investigations commit reports, code, small samples and a few captures; large generated results stay out of git (a gitignored `local/` folder or a GitHub Release), with how to regenerate them.
- D196: water is never an object (no river selection or panel; flow and clean or bad belong to sources); sources always findable; clear water while a tool is picked or with T; Alt+scroll slices layers and Shift+scroll sets strength, as in the game (replaces #58); water in the hover readout.
- D197: water near an edit moves within a frame or two; a speed control (slower, normal, faster, instant), brisk by default; the final water is always the game's settled result.
- D199: Carve's full feature set (Unleash and Aim, Defy gravity, Power, Width, Wander, variation, Try another path, Steep or Wide walls, Keep river or Dry canyon, a following camera with effects, Stop and instant undo), kept whole when #47 lands.
- D200: at least one permanent badwater source on every map (generated, Real places, Pick a place), placed naturally at the per-difficulty distance, counts and strengths like the official maps. A "No badwater" option makes a peaceful map (badtides still happen).
- D201: waterfalls with shape and volume in the Standard look (an arcing translucent ribbon, foam at the lip, whitewater below, cascades as small falls); mist and spray in Map look 2's High mode.
- D202: Craterize, a giant-impact tool with its own button next to Carve; its prototype (`investigation/craterize`) is held until Kyler says it's ready.
- D203: Quake (a fault line: Lift or Slide, Power, Sheer or Stepped scarp) joins Carve and Craterize in a visually distinct forces group on the top bar; all three share one forces core; its prototype is held until Kyler says it's ready.
- D204: Flatten from the stroke's start, cut and fill, Cliff or Ramped edges, a "start fits here" hint, objects ride the ground; and the principle "tools read intent".
- D205: drag to resize the brush (hold F), juice with optional quiet sounds, a minimap (on at 256²), camera bookmarks (Ctrl+Shift+1–9, Shift+1–9); a build time-lapse near M13.
- D206: Erupt (a volcano: Vent or Fissure, Power, Steep or Broad, a summit, flows) joins the forces; every force's options row starts with its mode switch; all four share one forces core; its prototype is held until Kyler says it's ready.
- D207: visible layers identical to Timberborn: a compact layer widget, slicing, the layer pick, tools acting on the visible land; Esc never resets the slice.
- D208 (for M9b): themes become optional leanings; the default is "Any" (Surprise me), combining landforms, water and intentions freely; measured for coherence, playability and no archetype clusters.
- D209: design version 2 approved; M9a builds it with "Any" as the default and no ruler-straight rivers; M9b fixes Islands' sameness and raises Kyler's crater and waterfall-lake intentions; pending #59–#68 decided (#66 later).
- D210: M9a on Opus 5.5 at xhigh, M9b and M9c at high, routine work on Sonnet 5 at medium; M9a first when work competes.

## Done and released

- **Resources like the official maps** (#43, D167–D170, generator 0.6.2) are merged into `dev`; they ship with
  the next release.
- **Merged investigations:** #45 (Pick a place's signature water, D192) and #38 (Map look 2), adopted as
  proposals for their steps.
- **Save to Timberborn** is live (`save-to-timberborn-done`, #40, D162, D191).
- **Mine sites and ruins** are live (`look-mine-ruins-done`, #42, D178).
- **Badwater blending** is live (`look-badwater-done`, #41, D177): tainted water turns warm red-brown through
  the game's mixing grey, never purple; one shared water palette.
- **The start and edge rules** are live (`start-edge-rules-done`, #44, released in PR #48, live check passed):
  no edge walls, start water over natural slopes, starting wood in logs, sources start rivers, heights up to 22.
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

- **M9a**, the generator from design version 2 (D209: "Any" as the default, no ruler-straight rivers,
  every rule since version 2), on branch `feature/m9a`; first on the machine (D210).
- **M9 design version 2**, on branch `investigation/generative-v2` (a PR into `dev` when done,
  not merged).
- **Badwater on every map** (D200), on branch `feature/badwater-source`.
- **Real places, second round**: the rebuild through the resources planner, without walls, about 150
  places, on `feature/real-places-2` (PR #35).
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
  `look/badwater-blend` (#41, approved: the warm-midpoint blend is in, ready to release as
  `look-badwater-done`);
  mine sites and ruins (D178) on `look/mine-site`.
- Dependabot: the Actions updates merge when CI is green; the majors (#24, #25) wait for the
  deliberate upgrade step (D150).
- **Held:** `investigation/craterize` (Craterize, D202) and `investigation/quake` (Quake, D203) and
  `investigation/erupt` (Erupt, D206) when their PRs open, until Kyler says each is ready.
- **Held:** #47 (`investigation/carve`, Carve as a force of nature, D194). Kyler loves it; one more Codex
  round (Wander, Width separate from Power, variation within each carve, "Try another path"), then
  merged when he says it's ready.

## Waiting on Kyler

1. Try each Live editing push on <https://timbermods.github.io/dam-good-maps/preview/>; it is
   released when it feels right.
2. Approve design version 2 when it's built, with what goes into each M9 stage; approve the
   feedback proposal (D137).
3. A yes before each probe batch; the next is M9a's.
4. Open decisions: 47 in [decisions-pending.md](decisions-pending.md), each with a default.
5. Optional: the pending in-game checks ([ingame-log.md](ingame-log.md)), the M3 spike page
   ([What Kyler needs to do](progress/kyler-todo.md), item 4).

## Where to look next

- [ROADMAP.md](../ROADMAP.md): the order of work, and each step's Blocking and Information lists.
- [PLAN.md §20](../PLAN.md#20-editor-decisions): every decision, D1–D197.
- [decisions-pending.md](decisions-pending.md): open questions with their defaults.
- [m9-design.md](m9-design.md): M9 design version 1.
- [ingame-log.md](ingame-log.md): in-game checks and the planned probe batches.
- [progress/README.md](progress/README.md): the record of each milestone and step, one file each.
- [progress/kyler-todo.md](progress/kyler-todo.md): what Kyler needs to do, with the exact steps.
