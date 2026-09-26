# M9a: terrain and water from processes

**Built** on branch `feature/m9a` from `dev` at f04674d, after Kyler approved design version 2
(PLAN §20 D209). The generator grows every map from the processes of design version 2 (the genome,
the field, the hydrology, the settler) instead of planning stamped features. Generated maps change:
generator **0.7.0**; share links made with 0.6.x open with the note that the map may differ.

## What was built

### The generator (src/core/land, src/core/gen)

- **The genome and the themes as priors** (`land/genome.ts`, `land/intentions.ts`): design version
  2's genome, ported slice by slice and checked against the prototype on 2,880 genomes (identical).
  **Any** (Surprise me) is a theme of its own: its prior is the union of the six themes' ranges, the
  mean of their chances and all their lists; a chosen theme only leans the ranges (D208, D209). The
  settings lean the genome (`leanGenome`).
- **The field** (`land/field.ts`, `land/levels.ts`, `land/drainage.ts`): uplift, caprock, erosion
  with hardness, weathering, levels with hypsometry and benches, small regions merged, pits and
  spikes cleaned, dry hollows filled, the edges relaxed (no edge walls, D151), natural ramps. The
  field is identical to the prototype's on 24 fields. One fix: a ramp path too short for its drop
  used to take every round of the ramp planner on the same component (the prototype's too); it is
  now left to stairs, and the next component gets its turn.
- **The hydrology** (`land/hydro.ts`): rivers from the drainage (edge inflows, springs, spring
  lakes), valley troughs, lakes at their sills, profiles with knickpoints and pools, splits,
  deltas, hanging valleys. With M9a's meanders off it is identical to the prototype's on 24 maps.
- **No ruler-straight rivers** (D209; `analysis/straight.ts`): rivers meander (a quasi-periodic
  course whose wavelength and amplitude vary along it, kept inside its valley) and their width
  varies. The measure: the longest bank run within 0.75 tiles of a straight line, and the longest
  stretch where both banks run parallel (a canal), on the settled water, three tiles in from the map
  edge. The limits are the largest seen on real terrain (the landscape survey) and the official maps
  (`investigation/m9a/straight-reference.json`: a run of 44 tiles, a canal of 34.3). A map with a
  channel straighter than that is planned again.
- **The settler** (`gen/settler.ts`): the start by reach, moist land by walk and water it can drink
  through the first drought (#59's default: Easy requires it, Normal and Hard prefer it), on the
  water the hydrology planned, then checked on the one settle.
- **Badwater on every map** (`land/hazards.ts`, D200): a hollow with a ditch down to a river or the
  edge, kept away from where the start will be, planned before the one settle; none with No
  badwater.
- **Features read back from the field** (`gen/readback.ts`): the rivers (the main one as
  `river/main`), the natural lakes (their outline and outlet), the badwater hollows, and ruins on a
  rise. The field `contains` them: the build marks their channels and leaves their ground.
- **Objects and resources**: the map objects as before; a second district's site where the land
  has one (D77); a pre-built weir on half the maps where a channel takes one (D72, `gen/weir.ts`);
  ruins on a rise the land already holds, one flight of stairs up (PLAN §9.4, nothing raised,
  `riseSpots`); the resources through the shared baseline (D167–D170).
- **Intentions** (`gen/intentions.ts`): checked on the finished map, a start intention re-steered
  once (D138).
- **Water that settles and sources that start rivers.** The batches found three ways the processes'
  water failed the checks, each fixed at its cause:
  - a sea rose for days: a basin starts full to its spill level (the canonical settle), then its
    water rises until its outlet passes the flow coming in, a whole level where the outlet is a
    river's width. Over a sea's area that took past the settle's four days (Islands 256² seed 1: 6,144
    ticks). A sea's way out to the map edge is now as wide as its water needs, 1.6 tiles per block a
    second of flow, on the water's own route (`widenOutlets`): that sea rises a third of a level and
    settles after 2,432 ticks. Islands at 256²: first attempts 1 in 8 before, 5 in 12 now; a map in
    about 15 s instead of 67. A broad basin whose spill level is a wide flat also gets a winding
    outlet a level below it (`carveOutlets`);
  - a lake the land no longer led its river into (the land changed after the hydrology found it)
    filled only by seeping over a bank, for days: such a lake is filled as the dry hollows are. A
    river's mouth on the map edge holds its sources and is not an outlet when this is judged (it
    once took a whole sea for unreached);
  - after the one settle, a spring-fed river whose spring another source's water reaches leaves the
    map (its valley stays, dry), and a badwater hollow that is reached is planned again (D171).
  Water still changing after the settle's four days fails the attempt at once and the next attempt
  draws a new genome (it is the field's), and a source inside a flow fails before the objects.
  Tried and dropped (no better in 20-seed batches): raising a lake's shore where a river ran beside
  it, and keeping a river's bed at the lake's outlet level along its shore.
- **Badwater like the official maps** (merged from `feature/badwater-source`, D200): as many
  hollows as the official budget's sources for the size, each as strong; the start is kept beyond
  the badwater distance from their water and soil where it can be, and hollows that still reach
  within it are planned again from the start as it is.
- **Progress while a map is made**: the page shows the stage of the attempt under way and a first
  look at its land before the water is settled.
- **Nothing is stamped**: no dam-site ridge, no landform, no terrace ring, no plateau. The old
  planners are gone (their exports that other branches use are kept, see below).

### The document (project format 3)

- Terrain as heights plus solid runs (`terrain/runs.ts`; I-1, D119): `BaseMap.runs` replaces
  `BaseMap.columns`. Formats 1 and 2 open (their columns become runs).
- The generated field is stored (`MapDocument.field`: heights, runs, the features it contains, its
  ramps, its top). The build takes it as step 1. A read-back feature the player changes is built as
  it now says; locking or renaming it leaves it the field's.

### The checks

- `water.storage_possible` replaces `water.reservoir`: running flow and the storage a dam, a natural
  basin or a levee can hold near the start. Information the generator prefers, never a guard (#67).
- `terrain.dam_wall` blocks: no built ridge that is a dam in all but name (D115's principle).
- Both in the Python validator too (`prototype/storage.py`), with parity.
- **A1**: the Python validator requires `WaterSimulationMigrator.IsMigrated`; the oracle checks an
  unmigrated copy of a map in both validators.
- **A2**: the ZIP entry times are written from the timestamp's own fields; a DST-gap timestamp gives
  the same bytes in every time zone (`tests/contract/timezones.test.ts`).
- **The simulation speedups** (D130): the interior saturation count and the outflow directions,
  each proved bit for bit (every sha256, exact depths, Node and Chromium).

### The app

- Any is the default theme and first in the strip; Verticality has its slider (from 70 the land may
  rise above 16).
- The map's description says what the map is, its badwater choice ("No badwater sources; badtides
  still come", D200) and, above 16, that the game's map editor edits only up to 16 (D172). Any's
  maps are named "Dam Good Map" in the game's list.

## Results

(Filled in as the batches run; see the sections below.)

## Tests updated because a decision changed what they tested

The stale-tests rule (CLAUDE.md): each still passed or failed for a reason that no longer applies.

- `projects.test.ts`: "Lake Basin seed 1 at 96² has a terrace ring past the old bounds" now checks
  that a generated map's features reaching past the edge (its rivers' mouths) reopen; "a Lake Basin
  terrace ring past the edge: locked, changed and moved" now uses a natural lake along the edge (the
  generator plans no terrace rings, D108).
- `objects.test.ts`: "ruins on a plateau" became "ruins on a rise … the rise is the land's own"
  (nothing is raised); the generated weir, second district, plugged spillway (a natural lake), river
  made badwater and every-object tests moved to seeds that have what they test at 0.7.0; the weir
  test counts only the water beside its own river.
- `features.test.ts`: the set pieces are the hollows, rises and district sites the land holds, and
  the field contains the rivers, natural lakes, hollows and rises.
- `setpieces.test.ts`: the on-river fall uses a river whose bed has room below it (main rivers often
  cut to level 0), the 20-wide fall at 128² a seed whose fall water settles within 4 days.
- `document.test.ts`: format 3, and the format-1 stand-in is a map without natural ramps.
- `look-mine-ruins.test.ts`: the live check's pinned sha256 for 0.7.0.

## API changes (for the Live editing merge)

- `planFeatures` is gone; `MapSession.regenerate` calls `generate(spec, { context })` and refuses
  only when planning failed ("no layout fits").
- `BaseMap.columns` became `BaseMap.runs` (`runsOfColumns` converts); `BaseTerrain.columns` stays.
- `toDocument(…, field?)` and `generatedDocument(r)`; `MapDocument.field?`, `KeptContent.solid?`.
- `BuildInput.field?` (a `GeneratedField`); `ResourceGround.channel?`.
- `GenerateResult` adds `field`, `intentions`, `info`, `timings`.
- The check `water.reservoir` is now `water.storage_possible`; `terrain.dam_wall` is new.
- Removed with the old planners: `planValley`, `planLakeBasin`, `planRiverValley`, `gen/water.ts`,
  `obstacleSpots`. Kept for their users: `gen/layout.ts` (`layoutTargets`, feature/live-editing's
  features test), `startWalkable` in `gen/valley.ts` (the design prototypes), `PlanConflict` in
  `gen/riverValley.ts` (feature/live-editing's session.ts).

## Parked for Kyler

(See the final section of the PR.)
