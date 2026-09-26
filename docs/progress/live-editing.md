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
| 2 | A hill smaller and flatter than asked, dug into the slope | Stand on the ground; say the level reached | Fixed (3); live shape tools next: rounded outlines, the result growing as you drag |
| 3 | Draw, then confirm, then **Place**: a form, not a tool | Brushes paint directly; shape tools place on release | Brushes done; shape tools next |
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

### Tests changed to the new flow (D148)

- `tests/e2e/preview.spec.ts` timed one answer that held the edit and its water; it now reports the
  edit's answer and its water settled.
- `tests/e2e/tools.spec.ts` read the new river's water right after **Place**; it now waits for the
  water to flow in, and closes the river's inspector first (it lies over the tile now that the
  legend sits beside the map).
- `tests/e2e/look-readable.spec.ts` named every meaning of the legend; it now names the meanings the
  map has, and checks that water mixed with badwater is listed exactly when the map has some.

## Try it

- `npm run try` builds this branch and serves it at a local address (it prints it).
- The preview address: `.github/workflows/deploy.yml` builds a branch under `/preview/` when run
  with `preview_ref` (or the variable `DGM_PREVIEW_REF`); once that change is on `main`, running the
  deploy with `preview_ref=feature/live-editing` publishes it at
  https://timbermods.github.io/dam-good-maps/preview/.

## Next

The live shape tools (the result growing as you drag, placed on release, then handles to move,
resize and change height, limits shown live), the water option's polish, objects following the
ground while painting, the Claude tool entries (D134), the remaining proposed fixes above.
