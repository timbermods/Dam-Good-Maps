# Live editing

**Built** on branch `feature/live-editing` (from `dev` at 761a1d2). Kyler's spec is in the brief;
Kyler judges it by trying it. No generated map changes: the generator stays 0.6.0, and every
generated sha256 is what it was (the determinism and byte tests pass unchanged).

## Phase 1: triage (Kyler, 2026-09-25)

I drove the editor as a first-time player in the installed Chrome (Playwright, channel "chrome",
headed, this machine's GPU): a generated 256² River Valley map and a 256² real place (Near
Bardenas Reales, **Refine**), placing and changing rivers, lakes, landforms and the start, undo
and redo, **Generate, keeping my edits**, and export. Times are from that drive.

### Fixed

1. **Placing waited on the water.** An edit re-settled the water before it answered: **Place**
   showed "Working…" for 3.5 s on a generated 256² map and 5.2–8.2 s on the real place, then
   "Settling water". On an imported map the first edit ran a whole canonical settle (11.7 s in
   Node), because the file's own water was never kept as a starting point. Now an edit answers at
   once with the last settled water carried over to its new ground; the worker settles it again in
   slices and sends it to the page as it flows (D133's live water), then puts it in place; the
   canonical settle follows. Imports warm-start from their own water. **Place** on the real place:
   206 ms; on the generated map: 188 ms.
2. **Checks blocked the editor's worker.** The full check (110–430 ms in Node, more in Chrome) ran
   in the same worker as the edits: planning a hill waited 3.1 s after the map opened. The checks
   now run in a worker of their own, on a replica of the open map that follows the editor's worker
   by its log. Plans answer in 0–40 ms.
3. **"Level 16" came out 12–13, as a flat sandy slab.** Root causes, all three at once:
   - a gentle edge climbs one level every 3 tiles in from the outline, starting at the lowest
     ground round it; a 17–21-tile hill tops out 3–4 levels above that, and the plan said
     "Level 16" regardless (a limit applied silently);
   - the landform *set* the ground to its levels, so on sloping ground it cut down everything
     higher than its steps: a pit with walls round a flat floor;
   - the selected feature was tinted sandy yellow all over, hiding its steps.

   Now drawn landforms stand on the ground (a hill only raises it, a canyon only lowers it; a new
   `onGround` parameter, so generated maps are unchanged); the plan says the level it reaches when
   the outline is too small ("reaches level 10 here, not 16: … level 16 needs it about 55 tiles
   across"), with the build's spike rule counted; the selection is an outline.
4. **Generate, keeping my edits, after moving the start** took 64 s in Chrome at 256² and ended
   with "No layout passed every check after 13 attempts; try another seed". The moved start failed
   the start checks on every new layout, so all 12 retries ran. Now, when the generator's own map
   passes and only the edits fail, one more layout is tried, then that map is kept and the page
   names the edits' problems (10 s in Node).
5. **The legend** covered half the map, and vanished when folded (Kyler). It is now a slim panel
   beside the map that folds to a strip, lists only what is on the map, points to those things on
   the map when a line is clicked (Esc or a click on the map clears it; keyboard and screen
   readers work), and holds **Height colours** and **Markers**.
6. **Which map is which** (Kyler): the generator's page showed "You are editing Near Bardenas
   Reales" over a River Valley preview. Now the banner says "You're editing Near Bardenas Reales.
   The map below is a new one, made from these settings." with **Back to editing**, and a caption
   above the preview names the map it shows ("New map from these settings: …", "Your map: …, with
   your 3 edits"). Labelling beat hiding the preview: the page is still for making a new map.
7. A drawn river joining the main river was refused ("below that river's bed"): its last reach
   now meets the other river at that river's bed.
8. Player messages showed the plans' section numbers ("(PLAN §5.3)"): stripped.
9. The tool hint over the map's north edge swallowed clicks there: it lets clicks through, and
   sits below the map.

### Confusing spots, ranked, with a proposed fix

| # | Spot | Proposed fix | Status |
|---|---|---|---|
| 1 | Nothing seems to happen after **Place** (the water) | Answer at once, water flows in after | Fixed (1, 2) |
| 2 | A hill smaller and flatter than asked, dug into the slope | Stand on the ground; say the level reached | Fixed (3, and the live shape tools) |
| 3 | Draw, then confirm, then **Place**: a form, not a tool | Brushes paint directly; shape tools place on release | Fixed for brushes and shapes; set pieces next |
| 4 | Regenerating with a moved start: a minute, then "try another seed" | Stop retrying what only the edits break; name the edits' problems | Fixed (4) |
| 5 | The legend over half the map | A slim panel beside it | Fixed (5) |
| 6 | "You are editing X" over another map's preview | Say which map is which | Fixed (6) |
| 7 | A river must end at an edge, a river or a lake, said only after the double-click | Show where it may end while drawing; finish on a valid end without the double-click | Proposed |
| 8 | "Checking…", "Settling water 29%": what for? | "Water flowing…", then the result; the pill's detail on click | Partly (the live water says so) |
| 9 | A start dropped on red still moves there (problems show after) | A drop on red springs back and says why | Proposed |
| 10 | "Its outlet drains to the lake": which lake? | Name it by where it is | Proposed |
| 11 | Opening a real place takes 12–13 s (its file is built in the browser) | Serve the prebuilt files (D155) | For Real places, second round |
| 12 | The inspector covers the map's east side on a laptop screen, beside the legend | Dock it in the side panel (the design pass) | Proposed |

## Live editing: the terrain brushes (the playable version)

- **Raise, lower, flatten, smooth, naturalize**, painted straight onto the map. One operation per
  stroke (`brush` in `src/core/doc/ops.ts` and its schema): the brush, its size and strength,
  flatten's level, naturalize's seed, `layer: "top"` (runs below come with the 3D stages), and its
  dabs in quarter tiles. All integer arithmetic: the same dabs give the same levels everywhere.
- **Whole levels, natural edges.** Each tile moves a level the first time the brush's middle
  passes over it (so a click or a quick sweep always shows), and a level for each level of pressure
  it gathers while the brush is held. The change a stroke makes never differs by more than one
  level between neighbours: a brush never makes a cliff of its own. Smooth moves tiles toward
  their neighbours' mean; naturalize wears cliffs into slopes and breaks straight edges.
- **The page paints the build's result, byte for byte.** It keeps the terrain the build's last
  steps start from (before the integrity pass, the protected and channel tiles, an import's
  surface and caves) and runs the same stroke code and integrity pass on it, dab by dab
  (`strokePreview.ts`). On release the stroke goes to the worker, which replays it; the page
  checks that the worker's map is the one it painted.
- **Only what changed is redrawn**: the 32×32 chunks under the change, the sky and tile data round
  it, and the sun's shadows south-east of it (the same bytes as baking the whole map, tested).
- **Controls**: left-drag paints; right- or middle-drag and the wheel move the camera; Shift
  inverts raise and lower; Ctrl+click picks flatten's level; [ and ] size; Alt+wheel strength;
  1–5 pick a brush; Ctrl+Z / Ctrl+Y; Esc cancels a stroke in progress, then puts the brush away.
  With a brush out the left button never turns the camera: a drag that starts off the map paints
  from where it reaches the map, and a drag of events sent all at once by a script paints too.
  Pressing a brush's number again keeps it out.
- **The brush bar**: five icon buttons with their shortcuts in the tooltip and label, size,
  strength, flatten's level, and **Hold water while painting** (for very large maps). A one-line
  first-use hint, dismissable. The brush under the cursor is a soft disc as strong as its falloff,
  ringed at its edge; flatten shows its level as a plane.
- **Undo and redo of strokes show at once**: the page keeps each stroke's terrain before and
  after, and puts it back in the same event as the key; the worker follows.
- **History labels**: "Raise, 1014 tiles".

### What a player feels (256², River Valley seed 1; `npm run bench:brush`)

| | RTX 4080 SUPER, 165 Hz | AMD Radeon integrated, CPU 4× slower, laptop screen |
|---|---|---|
| pointer event → frame showing the change, p50 / p95 / max | 4.5 / 7.2 / 8.3 ms | 11.1 / 13.8 / 18.1 ms |
| time between frames while painting, p50 / p99 / max | 6.1 / 6.3 / 9.5 ms | 6.1 / 12 / 42.5 ms |
| main-thread long tasks while painting | none | none |
| after release: the worker has the stroke | 162 ms | 260 ms (tasks of 125 and 54 ms as its answer lands) |
| undo: the ground back on screen | 8 ms | 63 ms |
| strokes whose painted map differed from the worker's | 0 | 0 |

## Live editing: the shape tools

*Superseded by D182 and D184 (push 1, below): the shape tools and their handles are gone; the brushes shape the land.*

- **Hills, plateaus, ridges, canyons, valleys, islands, lakes, forests, berry patches and ruin
  fields** show their real result while they are dragged: the worker plans the shape with the
  tools' own planners and builds its terrain with the build's own steps (`previewShape`), round
  what changes only, and the page redraws those tiles. Letting go places it as one step; there is
  no **Place**. Rounded shapes (hills, islands, ridges, canyons, valleys, lakes) are ellipses in
  the dragged rectangle, so their steps run as natural contours; plateaus and resource areas keep
  the rectangle.
- **Limits show while dragging**, beside the pointer: "Hill: reaches level 10 here, not 16". A
  shape the tool refuses says why in red ("it would cover the start's area") and places nothing.
- **Esc** while dragging puts the ground back as it was; nothing is placed.
- **A placed landform's handles**: move (the ground follows as it is dragged), a corner handle on
  each corner (resize), and a height handle beside move and delete ("↕ 10"; drag up or down, or the
  arrow keys). Each shows its result live, with the level it reaches ("Hill: reaches level 10
  here, not 12"), is placed on release as one step ("Resize hill", "Change hill height to 12"), and
  Esc puts it back.
- **Rivers and outlines drawn by clicks** are placed on the last click; what the tool did shows in
  the editor's message ("River: a sealed mouth on the north edge feeds it"), which lets clicks
  through and gives way to the next preview.
- **Trees, bushes and ruins stand on the ground as it is painted or dragged**, then take the
  places the worker's map gives them.
- Set pieces (waterfalls, dam sites, …) and objects keep their preview and **Place** for now.

## Claude's tools (M12 stays ready, D134)

*Partly superseded by push 1 (above): `resizeFeature`, landform changes and `addRiver`'s `live`
and `natural` are gone; `addRiver` and `addLake` are setup-only.*

In `investigation/claude/`, the shape of its tools:

- **`brush`** `{tool: raise|lower|flatten|smooth|naturalize, where, amount 1–8, level 0–16,
  passes 1–8}`: the editor's own brushes over a place ("raise this area by 2", "flatten here to
  level 8", "smooth this ridge"). It makes the same `brush` operation a player's stroke makes, so
  it shows in the history, undoes and replays like one. Each stroke presses once on each tile of
  the place with the smallest brush; raise, lower and flatten stroke once per level over the place
  worn in a tile each time, which is exactly one wide stroke's result: the edge slopes a level a
  tile, no cliffs. Its report is measured on the build's own terrain: "raises 63 tiles: 35 by 2,
  28 by 1 (its edge slopes …)"; "flattens 74 of 105 tiles to level 8; the other 31 slope toward
  it …"; "the place is too narrow to rise 3 anywhere: its middle moves 2"; "N tiles stop at level
  16, the editor's limit". The proposal's checks see what the brush does to the water and what
  grows on it, like any step: raising the ground where the start's berries grow dries them out,
  and the app refuses it (start.food). Refusals: more than 30% of the map; ground already at 16 (raise), 0
  (lower), already the level (flatten) or already smooth; a place entirely over an import's caves.
- **`resizeFeature`** `{target, factor 0.5–2}`: the corner handles. A drawn landform keeps its
  base, as a move does, and says the level it reaches at the new size; a drawn lake is planned
  again. Refusals: generated lakes and river landforms, smaller than 2 by 2, covering the start.
- **`changeFeature`** on a landform's height now says the level it reaches, as the height handle
  does ("reaches level 11 here, not 16").
- The **`limits`** tool answers `brush`; the harness prompt describes both steps.
- **`addSource`** `{kind: water|badwater, at | where, strength, fillHollow}`: the source tools; a
  badwater source goes where its 3×3 fits; `fillHollow` puts a spring at the lowest point of the
  hollow there ("fills the hollow to level 11, about 32 tiles, then spills over its rim"), after
  the brushes that dug it. **`addRiver`** takes `live: true` (the river tool's rules: a branch from
  water, an end on dry ground) and `natural`.
- Water requests (B08–B11): dig a pond and fill it, a strong source in the northwest corner, a
  badwater source in the southeast corner, a straight canal from the river to the south edge.
- Seven new requests in the corpus (B01–B07): raise the ground west of the start by 2, flatten
  around a tile to level 8, smooth the high ground in the north, the whole north half by 3
  (refused: the 30% limit), make the hill bigger, make the hill as tall as it can go (says the
  level it reaches), raise the ground north of the start by 2 (refused: the start's berries and
  trees there would die; the offer is the ground to its west).
- Reference solutions (`bin/reference.ts`): 112 of 131 pass. All 11 new ones pass; 101 of the 120
  older ones pass, the same 101 as on dev at 761a1d2 (the other 19 are setups tuned on the M7 maps,
  M12-INTEGRATION §11).

## Water, part 1 (D179, D180, D183)

*Superseded by D184 (push 1, below), except the sources: the river tool and its rules, Natural or exact, its width, depth and strength controls, the lake click and the words beside the pointer are gone. Flatten keeps its level.*

- **Rivers drawn freehand.** Drag from the source to where its water goes: the channel carves in
  under the pointer (the worker plans it with the river planner and builds the whole map with it,
  springs included, about 30 ms at 256² in Node), and its water flows in behind, a draft of its own
  on the draft's ground, while the pointer moves. Letting go places it as one step; Esc puts the
  ground and the water back. Clicking its bends and double-clicking works too, the draft running
  to the pointer.
- **Its rules.** It starts at a spring where it is drawn from dry land, at a sealed mouth from the
  map edge, and as a **branch** (no source of its own, its bed at that water's bed) from existing
  water. It ends in a river (a tributary, its bed never below that river's anywhere, crossing lower
  ground on its banks), in a lake, at the map edge, or on dry ground, where its water fills the
  hollow there into a lake or runs on downhill. Its bed never climbs: higher ground is cut through
  at the bed's level, lower ground steps it down (a fall).
- **Beside the pointer** (D183): "3 wide, 1 deep · joins the river · cutting 6 levels deep here";
  "fills a lake here up to level 7"; "a branch of the water it leaves".
- **Its controls**: Strength (blocks of water a second, 0.5–64, on the brushes' slider), Width
  (as its flow needs, or 2–9; [ and ] while drawing), Depth (1–4), and **Natural** (gentle
  meanders, the default, remembered) or exact (as drawn, for canals).
- **Water and badwater sources**: click where water starts; it spreads at once. Their strength is
  set before, and changed on any source by clicking it: the water answers each step of the slider,
  and one adjustment is one undo step. Past the official maps' strength, a note says so; nothing is
  blocked.
- **Lakes by their hollow**: hovering says what a click fills ("Lake: fills to level 7 here, about
  80 tiles"); a click puts a spring at the hollow's lowest point, and the lake fills and spills over
  its rim.
- **Flatten's level beside the pointer** ("level 7"); with Ctrl, the level a click would pick, and
  on water its bed ("riverbed: level 6"), so a channel flattened to it lets the water in.

## Water, part 2: the water's journey (D179 (2), D180 (8, 9, 10), D181 (2))

- **After every edit the water plays its journey** over a few seconds: the worker settles it as
  fast as it can and sends a frame every 4 ticks of the game at first (where the water moves
  most), every 12 later, every 48 as it settles; the page plays them twenty a second, a new
  channel filling, the water creeping downstream and spreading into basins. The brushes never wait
  for it: frames only change the water shown.
- **It ends exactly at the map's water.** The quick settle's last frame can differ from the exact
  settle (which drains the thin sheets it leaves): the journey eases into the exact water over 16
  frames, and that water is the worker's and the export's (tested).
- **Time controls** over the map's lower right: **Pause**, speed **1× / 2× / 4×**, **Skip** to the
  latest water, **Replay** the last change's journey, **Follow** (the camera drifts to where the
  water rises most), **Drought** and **Badtide**. A drought: every source stops for the map's
  drought (4, 9 or 30 days by its difficulty), the rivers drain in the first day, the pools
  evaporate. A badtide (3, 8 or 30 days): the clean sources give badwater along the game's curve
  (0.5 + 0.5·sech(17(t − 0.5)) over the first and last half day, 1 between), it spreads through
  the water, and the soil shows the poisoned ground each day. Then the sources run as the map has
  them and the water comes back, ending at the map's water and soil. The map never changes. The
  rules are ported, with their sources, from the cycles investigation (checked against the game)
  into `src/core/sim/weather.ts`, for the Weather view to extend.
- **The land comes alive with the water**: when the water settles, the soil's colours move to the
  new moisture over about two seconds, the tiles by the water first.
- **Local first**: the worker settles in slices of 10 ms between the tools' requests, so the tools
  never wait; the water nearest the edit moves first by its nature, and the first frames show it.

Not yet: BadtideDrains running during a badtide (the water model keeps no strength for them while
they are off; none on generated maps), water sounds (D181 (4)), lakes by painting a shore, handles
on a placed river.

## D184, push 1: smart Lower, Source, and the old tools removed (D182, D184)

- **Removed.** The landform tools and their handles (hill, plateau, ridge, canyon, valley,
  island), the lake tool, the forest, berry patch and ruin field areas, the river tool with its
  rules, Natural or exact, its width, depth and strength controls, the lake click, and the words
  beside the pointer except Flatten's level. The generator's features stay its plan: selected, one
  says "The generator's ground. Shape it with the brushes." and has no Delete. Trees and bushes come
  back on the left shelf (push 3).
- **Saved projects with drawn landforms** open with their land exactly as it was: the landforms
  become plain terrain, one step in the history, "Turn the drawn landforms into terrain" (flatten
  edits, a level at a time). If the land would not come out identical, nothing changes (tested).
- **Smart Lower.** A Lower stroke that starts in or beside water carves a bed that keeps flowing
  downhill. Its bed starts at the lowest ground round the first dab (the water's bed) and never
  rises: over lower ground it drops a level below it; higher ground is cut straight down under the
  brush's middle. The ring glows soft blue where a stroke would do this. The operation records
  `channel: true`, so it replays the same, page and worker alike.
- **Source.** **Water** → **Source**, clean or bad, with its strength; a click places it, a bad
  source's 3 × 3 round the click. Over a source, Alt+scroll steps its strength up or down: the new
  strength shows beside the pointer ("4 water/s"; past the official maps' 8, "stronger than any
  official map"), the water answers, and one adjustment is one undo step. Drag a source to move it:
  its footprint follows the pointer, the drop is one step ("Move a water source"), Esc puts it back.
  A click selects it. With a brush out, strokes paint over sources.
- **Flatten** says "level N" beside the pointer; with Ctrl, the level under it, on water the bed.
- **The brush kit's options, in the operation** (push 2 adds their toggles): square brushes,
  precise (hard edges, one level per tile per stroke), and a pen's pressure per dab. Tested.
- **The journey keeps time on slow machines.** The player's clock runs on time, not on frames:
  on a slow software renderer (CI's) it skips frames to keep pace, and still ends at the settled
  water. This was the waterFlow mismatch in CI since 3226de4.
- **The time controls** moved to the map's top edge, out of the painting area.
- **A source goes anywhere** (following D184): `water.source_in_flow` (D171, from the start and
  edge rules) does not apply in the editor's export profile, in both validators (TypeScript and
  `prototype/validate.py --profile export`). It still blocks a generated map and is information on
  an import. `tests/contract/sources.test.ts` expected a warning in export; it now expects the
  check not to apply there (D148), and a new case drops a source in a river and exports with no
  new issue. The oracle keeps 0 disagreements.

### Claude's tools (M12 stays ready)

- `addRiver` and `addLake` are no longer offered; a step that asks for one is told how rivers and
  lakes are made now. Corpus setups still use them, as documents from before D184 hold them.
- `brush` takes a `path` (2–24 points, `size` its width, 1–9): one stroke, a dab on each tile. A
  Lower path that starts in or beside water, or beside a source, is smart Lower. Its report: "carves
  a bed 2 tiles wide from the source at (60, 95) along 56 tiles, from level 9 down to level 4, never
  rising: the water follows it"; where it runs into water or off the map edge; how deep it cuts.
- A brush patch (`size`) sits near the place's middle, clear of the start's own area, of the water
  (Lower) and of relics, geothermal fields and mine sites, on the spot with the fewest objects.
- `addSource` with `fillHollow` fills the hollow nearest the place's middle (9 tiles or more, off
  the start), its spring on a free tile of the floor. It is measured as `new:lake` (its area and
  level), or `new:source`.
- `find_sites` kind `lake` digs each candidate on a copy of the ground (2 levels, deeper on slopes,
  up to 6) and measures the hollow; its `step` digs it and its `then` puts the spring in. Both are
  checked with a real build.
- `limits` for `lake` and `river` say how to make them.
- Requests rewritten: P01, P08, C01, R04, W04, W10, J11, M02, M07, Z04, Z05, B11. Most lakes use
  `find_sites`' ready steps (checked with a real build); C01 digs by place. J11 asks for a large
  lake, not a huge one: a huge dug lake finds no dry ground in that map's south third clear of the
  river, the relics and the mine sites. M07 changes the settings first, so its lake is given a
  place, "far from the start": near the start a pond drowns the trees and berries the start needs.
- Reference solutions (`bin/reference.ts`), after merging dev at 481d890: 119 of 131 pass. All 11
  requests this branch added pass; 108 of the 120 older ones pass: dev's 105, plus P08, C01 and
  W10, which fail on dev and pass with their new solutions. The other 12 (S04, W05–W07, J03, M04,
  M06, I07, X01, X08, X09, Q01) fail on dev too: setups and targets tuned on older maps.

## D196–D198: water is never an object, seeing underwater, the game's controls, water on a stroke

- **Water is never an object.** Clicking water picks nothing, the lists show no river or lake, and
  there is no river panel or selection. The generator's rivers, lakes and landforms stay its plan
  (a click never picks them). A river's flow is its sources': a click on any source, the map's edge
  inflows included, selects it, with its strength and **Water: Clean or Badwater** (one step,
  "Make a source badwater"); **Delete** removes it ("Remove a water source") and its water recedes.
- **Sources are always findable.** Each source wells up through the water: rings spreading from it
  and a few bubbles, on the water over it, even deep down. With **Source** picked, or **Markers**
  on, every source shows a marker with its strength (sources side by side, a river's mouth, are one
  marker: "4 sources, 3 water/s"); near the pointer, the nearby ones do. Over water, the sources it
  comes from glow and their markers stand out (upstream through the water, never a tributary that
  joins below).
- **Seeing underwater.** Any tool picked makes the water see-through, so the bed, the ledges and the
  sources show; with none picked it looks as usual, and **T** or **Clear water** (a view button)
  toggle it. Badwater stays plain in it: its own colour, half see-through, with diagonal stripes.
- **The readout over water:** "Water 0.4 deep, bed level 6", and "30% badwater" when it is mixed.
  The generator's rivers and landforms are no longer named in the editor's readout.
- **The game's controls.** Alt+scroll cuts the world into layers from the top down ("Layer 7: the
  world above it is cut away"; the cut tops hatched, water and objects above it hidden); Alt+click
  picks a tile's layer, again shows it all. Strength moved to Shift+scroll, for the brushes and a
  hovered source, with the strength beside the pointer while it changes (and the size, with [ ]).
- **Water on a stroke (D197).** While a stroke is painted, the page sends its ground to the worker
  every frame it changes; the worker runs the water on it at once and sends a frame as soon as the
  water has answered. On 256² River Valley (Chrome, this machine), the water in a new channel moves
  **25–36 ms after its ground changes**, about two frames at 60 Hz; before, it moved 80–95 ms after
  the release, and not at all while painting. On release the stroke's operation carries that water
  into the journey; Esc drops it. The simulation steps only wet tiles and their neighbours
  (0.7–1.6 ms a tick on 256²), so the water nearest the edit moves first. The brush bar's **Hold water while painting** is gone with it.
- **The water's speed (D197):** Slower, **Normal** (the default, three times the slowest), Faster,
  Instant (the latest water there is), in the time controls. It replaces 1×/2×/4×.
- **The smart Lower ring (D198)** is a clear water-blue, half as thick again, and every ring has a
  thin dark outline; the faint blue fill stays. `tests/unit/brush-ring.test.ts` checks it in
  greyscale and in protanopia, deuteranopia and tritanopia (Machado et al.): on every water and
  ground colour the ring or its outline has a contrast of 3 or more, the ring on its outline 4.5.
  The blue is in the shared water palette (`WATER_UI.ring`, `WATER_UI.ringEdge`,
  `waterPalette.ts`), apart from the water's own colours.
- **Claude (D196):** `setRiverBadwater`, and changing, moving or deleting a river or a lake, are
  refused with the advice; a new step, `changeSource {river | at | where, strength | flow}`, sets a
  river's sources (its mouth) or any sources. F05 (make this lake deeper) lowers the lake's bed with
  the brush; X05 and Z04 check the new refusals; B12 (the main river at 4 blocks/s) is new.
  Reference solutions: 120 of 132 (the 12 failing ones fail on dev too).
- Tests (D148): `editor.spec` deleted the river from the Water list (refused: the valley builds on
  it); a river is never listed or picked now, so it checks that a click on the river picks nothing
  and Delete then removes nothing. `brush.spec` and `waterTools.spec` set strength with Shift+wheel, not Alt;
  `tools.spec` reads "Water 0.4 deep" (case-insensitive now); the unit test of the index's picks
  expects no river or landform picked (`allAt` still lists them). New: `waterView.spec` (every
  point above, and water in a stroke's channel before the button comes up), unit tests of the
  readout, the source markers and the feeding search.
- **The journey always ends at the map's water.** A background check that started as an edit went
  in came back after the page had moved to that edit, and the page dropped it, with the exact
  settle's water the worker had already put in place (it sends each view once): the page kept the
  quick settle's water. On a slow machine (CI, and here with the CPU slowed six times) the water on
  screen then stayed a little off the map's. The page now always shows the water a check put in
  place (only its report waits for the page), takes a version at once, and a settle with no water
  of its own ends at the map's water, not at the frame on screen.
- Shortcuts that could clash: Shift inverts Raise and Lower while painting (D158), so a Shift-click
  straight line would clash with it (the straight lines stay a toggle); the Select tool's Alt to
  subtract (D184) meets Alt+click's layer pick, so Select will subtract with Alt+drag only.

## The camera keys (D180)

Timberborn's own keys: WASD and the arrows move, Q and E turn, Shift is faster, the wheel zooms.
Held, they move the camera every frame (the keys' state, not their repeats), easing in over about
0.12 s and gliding to a stop over about 0.18 s, at a screen's height in about 1.4 s whatever the
zoom. They work anywhere on the page but in a text field or a list, and never with Ctrl, Alt or
Cmd. Nothing else in the editor uses those keys: the brushes take 1–5, [ and ], Esc, Delete and
Ctrl+Z / Ctrl+Y; a focused handle keeps its arrow keys.

## A stroke right after the editor opens

Reported lost twice on a fresh load (a drag within about 3 s of **Refine this map**). Not
reproduced: 16 tries in Chrome at 128², locally and on the published preview, at full speed and 6×
slower, with the drag 0.3–3 s after the brush bar appeared, all kept their stroke. Two things could
look like a lost stroke, both changed: **Undo** waited for the worker's answer (now a painted stroke
enables it at once), and the brushes could be picked before the map could be painted (now they wait,
"The map is still loading").

## Tests

- `tests/contract/brush.test.ts`: a stroke gives the same levels however its dabs are handed in;
  a click always shows; a brush never makes a cliff; on River Valley and Islands 96², what the page
  paints equals what the operation builds, byte for byte, for ten strokes of every brush, and the
  log replays to the same file through a full build and the project file; random strokes undone
  and redone at random equal full builds, and undoing all gives back the generated file byte for
  byte; a stroke survives **Generate, keeping my edits** and the project file.
- `tests/contract/live-water.test.ts`: an edit shows the last settled water at once and the export
  is still the canonical file; undo back to the settled map takes its water; the stale-water rules;
  the worker's session answers, then settles; the checks' replica equals the map it follows after
  edits, undo and redo; an import's first edit starts from its own water; drawn landforms never dig
  and say the level they reach; regenerating with a moved start stops early and names the edits'
  problems.
- `tests/unit/legend.test.ts`, `tests/unit/render3d.test.ts` (the light redone round a change
  equals a whole bake).
- `tests/e2e/brush.spec.ts`: painting in the page (the ground rises before the button comes up),
  the history label, the worker's map equal to the painted one, undo and redo at once, Shift, Esc
  mid-stroke leaving no trace, Ctrl+click, [ ], Alt+wheel, and the strokes after a reload.
- `tests/e2e/legend.spec.ts`: the legend beside the map, only what the map has, the highlight by
  mouse and keyboard, the strip; which map is which on the generator's page.
- `tests/e2e/waterTools.spec.ts` (D184): the ring is blue over the river and not over dry ground;
  a stroke from the river carves a bed no higher than the river's and the water flows into it; a Source
  click places a clean source whose water spreads; Alt+scroll over it makes it 4 water/s as one
  undo step; a drag moves it (one step), Esc mid-drag puts it back; a bad source's 3 × 3 round the
  click; Flatten with Ctrl over the river says the bed's level and nothing else.
- `tests/contract/brush.test.ts`, the brush kit and smart Lower: precise at size 1 moves one tile
  one level however long it is held; square reaches the corners; light pen pressure is slower and
  replays the same; a smart Lower bed never rises and replays the same, whole or in pieces, and
  through a session and the project file equals what the page paints.
- `tests/contract/bake.test.ts`: a project with drawn landforms opens with the same land, as one
  undoable step, and the landforms gone.
- `tests/unit/hollow.test.ts`: a hollow fills to its lowest rim; on a slope, water runs on.
- `tests/e2e/waterFlow.spec.ts`: a source's water grows over several frames; Pause holds it; it
  ends at the worker's water; Replay starts over and Skip returns to the end; a drought drains the
  map and a badtide turns its water to badwater, each coming back to the map's water.
- `tests/unit/weather.test.ts`: the hazard lengths by difficulty (a drought's matching the
  reservoir sizes) and the badtide's curve.
- `tests/e2e/camera.spec.ts`: held keys move the view in many small steps and glide to a stop;
  Shift is faster; Q turns; nothing moves while a field has the focus.
- `tests/e2e/liveShapes.spec.ts` (removed in push 1, with the shape tools): a hill rose while it
  was dragged; its handles; a hill over the start refused.

### Tests changed to the new flow (D148)

- `tests/e2e/preview.spec.ts` timed one answer that held the edit and its water; it now reports the
  edit's answer and its water settled.
- `tests/e2e/tools.spec.ts` read the new river's water right after **Place**; it now waits for the
  water to flow in, and closes the river's inspector first (it lies over the tile now that the
  legend sits beside the map).
- `tests/e2e/look-readable.spec.ts` named every meaning of the legend; it now names the meanings the
  map has, and checks that water mixed with badwater is listed exactly when the map has some.
- `tests/e2e/tools.spec.ts` placed a drawn river with **Place**; the last click places it now, and
  the test reads the river's report in the editor's message.
- `tests/e2e/editor.spec.ts` placed its forest and plateau with **Place**; letting go of the drag
  places them now.
- `tests/e2e/objects.spec.ts` read the forest's live and dead tiles from the preview before
  **Place**; it reads them from the shape while it is dragged, then lets go.
- `tests/e2e/look-outline.spec.ts` (from dev) hid the legend to keep its swatch out of the map's
  pictures; the legend sits beside the map now, and holds **Markers**, so it stays.
- `tests/contract/randomOps.ts`: the random operations include brush strokes (half of the draws
  that were sculpts), because `properties.test.ts` checks that every kind of log operation is
  exercised.
- Push 1 (D182, D184), for tools that are gone:
  - `tests/e2e/liveShapes.spec.ts` is removed: the shape tools and their handles are gone.
  - `tests/contract/drawn-rivers.test.ts` is removed with the river tool's rules; its hollow test
    moved to `tests/unit/hollow.test.ts` (Claude's `fillHollow` still uses it).
  - `tests/e2e/waterTools.spec.ts` is rewritten for smart Lower and Source.
  - `tests/e2e/editor.spec.ts` placed a river with the River tool as the player's second edit; it
    places a water source now, and checks it survives regenerating and a reload.
  - `tests/e2e/objects.spec.ts` dragged a forest area; that tool is gone (trees come from the
    shelf in push 3), so the test is removed.
  - `tests/unit/editor.test.ts` made plateau, forest, berry and ruin features from a dragged
    rectangle; those tools are gone, so that case is removed. A generated landform's move is
    refused with "shape it with the brushes".
  - `tests/e2e/tools.spec.ts` drew a river from the north edge and read its water; it places a
    water source beside the edge and reads its water now.
  - `tests/e2e/waterFlow.spec.ts` picked **Water source**; the tool is **Source** now.

## Try it

- `npm run try` builds this branch and serves it at a local address (it prints it).
- The preview address: `.github/workflows/deploy.yml` builds a branch under `/preview/` when run
  with `preview_ref` (or the variable `DGM_PREVIEW_REF`); once that change is on `main`, running the
  deploy with `preview_ref=feature/live-editing` publishes it at
  https://timbermods.github.io/dam-good-maps/preview/.

## Next

D184's pushes 2–4: the top bar and its options row (square, precise, straight lines, level lines,
Flatten "in steps", Smooth "make walkable", pen pressure, Select); the left shelf with live ghosts,
and Remove; the view buttons and overlays, the header and its menu, the quiet dot, the start's
reach and the first-run hints. Then "Let the water carve", from the carve investigation.
