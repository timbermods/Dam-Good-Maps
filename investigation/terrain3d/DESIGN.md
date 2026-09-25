# Terrain above terrain: the design and the staged plan

**Status:** a design proposal for Kyler's review (2026-09-25). Nothing here changes `src/`. The
evidence is in this folder:
- [GAME_RULES.md](GAME_RULES.md): the game's rules, step 1;
- [MAPS.md](MAPS.md): how official and workshop maps use caves, step 2;
- [INVENTORY.md](INVENTORY.md): every one-height-per-column assumption in the repository, step 3;
- `proto/` and `results/`: the prototypes and their numbers, step 4;
- [REPORT.md](REPORT.md): a summary, and every decision with its reason.

[INTEGRATION.md](INTEGRATION.md) holds the proposed ROADMAP and PLAN text.

## Contents

1. [The design in ten lines](#1-the-design-in-ten-lines)
2. [The terrain model](#2-the-terrain-model)
3. [Water](#3-water)
4. [The checks](#4-the-checks)
5. [The generator](#5-the-generator)
6. [The editor](#6-the-editor)
7. [The 3D view](#7-the-3d-view)
8. [Verification in the game](#8-verification-in-the-game)
9. [The staged plan](#9-the-staged-plan)
10. [Risks](#10-risks)
11. [What this changes in recorded decisions](#11-what-this-changes-in-recorded-decisions)

---

## 1. The design in ten lines

1. **Terrain is a list of solid runs per tile**, the game's own form (`ColumnTerrainMap`). A
   heightfield tile is one run from z = 0, so today's maps are the simple case, not a special one.
2. **Water is simulated per air gap**, with the game's stacked-column rules: sideways flow between
   overlapping gaps, pressure (overflow × 8), the overflow cap, and roofs.
   - It reproduces the water the official cave maps store.
   - On heightfields it can run bit-identical to today's water. The game's own edge rules, which 3D-a
     adopts, move no wet tile there.
3. **The canonical settle keeps its shape.** The pre-fill becomes a priority flood over the graph
   of air gaps (identical to today's on heightfields), then the same settle test counted over
   columns.
4. **The support rule is part of the build.** Carvers keep it by construction, and a final pass
   applies it exactly as the game does on load. A file never holds a voxel the game would delete.
5. **Walking is a floor graph.** Every air cell on solid ground is a node, joined at the same level
   and by slopes. Every check that walks uses it. Each map reports how beavers reach each level,
   and which heights need player-built stairs.
6. **3D forms are found, not stamped.** Processes read the land for their places: tunnels where two
   valleys share a level behind a thin ridge, arches in thin fins, sky bridges where a gorge
   narrows between matching rims, ledges and cliff paths on tall faces, undercuts and leaning faces,
   caves and underground rivers where water can run through rock.
7. **Verticality is a setting.** At ordinary values 3D forms are occasional and modest, within 16
   levels. At high values the map uses the game's full 22 levels, with overhanging cliffs, arches,
   sky bridges, cliffside caves and ledges, multi-level valleys, and water running through
   mountains.
8. **The editor edits voxels safely**: carve and fill brushes, and tunnel, arch, cave, ledge and
   overhang tools, all previewing what the support rule would drop. It has 3D picking, a level-slice
   cutaway, and undo, locks and regeneration that keep 3D edits.
9. **One mesher for every tile**: greedy faces per plane in 32×32 chunks, undersides included. Light
   comes from a small 3D sky-light texture, and the cutaway is a level slice like the game's.
   - On this machine it builds any 256² cave map in 0.1–0.4 s, at the display's full frame rate
     with or without the cutaway.
   - The full budgets are measured when it is built (§7.4).
10. **Three stages after the M9 build and the Frame pass, before M10**:
    - 3D-a: model, water and checks, invisible to players;
    - 3D-b: generation and Verticality;
    - 3D-c: editor and view.
    Each is released like a milestone, and 3D-b and 3D-c are verified in the game with the DGM Probe.

## 2. The terrain model

### 2.1 Runs per tile

**The canonical form** is, per tile, the ordered list of solid runs [floor, ceiling), bottom to top.
It is exactly the game's `ColumnTerrainMap`, with run 0 starting at z = 0 and empty when the bottom
voxel is air (GAME_RULES §1).
- A heightfield tile is one run [0, h).
- A cave tile has two or more runs.
- An arch's span is a run over air.

**In memory** each tile's 23 layers are one `Uint32` bitmask: 256 KB at 256². Runs, the surface,
air gaps and the water columns derive from it with bit operations:
- the surface is the highest set bit + 1;
- a heightfield tile is `mask === (1 << h) − 1`;
- the runs are the set-bit intervals.

This one array replaces today's pair of `heights` and frozen `columns` (INVENTORY §1, §6). `heights`
stays as a derived view, so heightfield code paths stay as fast as today.

**Why runs.** The alternatives were rejected:
- **A full voxel array** holds the same information but makes every heightfield operation walk 23
  cells.
- **A density field or signed distances** (marching cubes) cannot say exactly which voxels exist,
  and the game's rules are voxel rules.

Runs are what the game itself stores, they give the water columns directly (the air gaps plus
obstacles), and they make the support rule and the floor graph cheap.

**Operations** (`core/terrain/runs.ts`, new):
- `solid(x, y, z)`, `set`, `clear`;
- `carve(box | path × profile)`, `fill(...)`;
- `surface(i)`, `runs(i)`, `gaps(i)`;
- `isPlain(i)`: one run from z = 0.

Every edit reports its dirty tiles and the z range it touched.

### 2.2 The document and the project file: cave-ready from format 3

M9 brings project file format 3, with `field`: the generated base terrain as run-length levels
(m9-design §12). The proposal is to make format 3 cave-ready from day one, so the 3D stages need no
format change of their own:

```ts
interface TerrainData {                  // used by BaseMap.terrain and MapDocument.field
  heights: string;                       // base64, one byte per tile: the surface (as today)
  runs: [tile: number, runs: number[]][];// tiles that are not one plain run from z = 0:
                                         // [floor0, ceil0, floor1, ceil1, …], bottom to top
}
```

- **`runs` replaces `BaseMap.columns`**, today's 23-character strings. It covers every tile that is
  not plain, in index order. A generated map without 3D forms has an empty list, so M9's files stay
  as small as its design measured (2.3–6.5 KB gzipped).
- **The measured cost of 3D.** The prototype's high-verticality 256² map has 921 tiles with runs,
  3.0 KB gzipped beside 2.4 KB of heights. Its ordinary map has 65, 0.2 KB.
- **`KeptContent`** (locks, `doc/document.ts`) keeps runs too, not only heights, so a lock keeps a
  cave.
- **Format 1 and 2 files** open as today. Their `columns` convert to `runs` on read (the same
  voxels).
- **Edit operations** gain `carve` and `fill` (§6.4). Undo is the log, as today.

The one M9 change this asks for: format 3's `field` and `base` use `TerrainData` (heights plus
runs), not heights alone. It costs nothing for heightfield maps and saves format 4 later
(INTEGRATION.md, proposal I-1).

### 2.3 The build

The pipeline (PLAN §19.8) keeps its steps, with two additions and one generalisation:

| Step | Change |
|---|---|
| 1–4 base, landforms, set pieces, rivers and lakes | unchanged; they write the surface, which sets the top run |
| **4b. 3D forms** (new) | the carving features (§5.2) rasterize, in document order: tunnels, caves, arches, sky bridges, ledges, overhangs, underground rivers |
| 5–6 benches and pads, sculpt edits | sculpts act on the top run; `carve` and `fill` edits act on voxels |
| **7. Integrity** | adds **the support rule pass**: the game's load-time rule (GAME_RULES §2) is applied and whatever it would delete is deleted, then reported. The carvers keep the rule by construction, so the pass normally drops nothing (measured: 0 voxels on every prototype map); it is the safety net for combinations and hand edits |
| 8 slopes | derived on the floor graph (§4.2): a slope wherever a walkable region meets another one level higher, inside caves and on ledges too |
| 9–13 sources, objects, water, resources, start, entity edits | every placement takes a **floor**: the run top it stands on. The default is the top surface (today's behaviour); features in caves name their floor |
| 14 validation | the checks of §4 |

**Incremental rebuilds.** Dirty regions become (tiles, z range). The property test "incremental =
full" extends to random carve and fill edits.

## 3. Water

### 3.1 The stacked-column simulation

`proto/stackwater.ts` ports the game's rules (GAME_RULES §3):
- **Columns** are the air gaps of each tile, split further by the map objects' obstacles: full
  obstacles, horizontal roofs, partial obstacles and direction limiters.
- **Flow** happens between columns of 4-neighbour tiles whose ranges overlap. A flow stops at the
  first neighbour column whose floor is at or above the origin's surface.
- **Pressure.** A column filled to its ceiling keeps the excess as overflow. It counts 8× in the
  head, and its share of a head difference is divided by 8.
- **The overflow cap** is (34 − ceiling)/8, and water past it is destroyed.
- **Evaporation** uses each column's own cluster saturation, from neighbour columns whose air gaps
  overlap it.
- **Sources** emit into the column that holds their z.

**The edges** are precomputed: for each column, the neighbour columns it can ever reach, in the
game's order. Stored momentum is kept per edge, which is how the game keys it (per target column).

**Heightfield parity.** The port has two modes:
- **"port"**: a tile with one open column does exactly the operations of today's `sim/water.ts`, in
  the same order. On all six themes (two seeds each, generated at 128², 1,536 ticks) the two give
  the same bits, and the 3D pre-fill equals today's (`proto/parity.ts`, `results/parity.json`).
- **"game"**: follows the game's code in five places where today's port simplified:
  1. evaporation on a dry column that receives water;
  2. the spill threshold toward the map's padding;
  3. partial obstacles looked up over the game's height range;
  4. the source step's old depth;
  5. direction limiters.

**Which mode.** Measured both ways:
- **On our generated heightfields**, game mode changes no wet tile. Volumes move by at most 0.02%
  and depths by at most 0.033 (`results/mode-game-vs-today.json`).
- **On the official cave maps it is closer to the game.** One day from each map's own water, game
  mode keeps it exactly (IoU 1.000 on 18 of 19), and port mode drifts on 5. Hollows' canonical
  settle is 1.000 against 0.993. Pillars' volume is 4% off the stored water in game mode, and 4% the
  other way in port mode.

**Decision:** 3D-a adopts game mode, with the oracle and a generator version bump. Every generated
map's water changes only in its last digits, and the water is the game's own on the maps where it
matters. Keeping "port" only to keep bytes would buy nothing before versioned deploys (M13), and M9
already changes every map. The parity test stays as a regression band: 0 wet tiles differ from
the old port on the batch, and depths are within 0.05.

**Speed.** The stacked port costs a median 1.64× today's CPU on heightfields (1.4–2.4× over the 12
parity maps at 128²). The cause is its general loops: edge lists instead of 4 fixed neighbours.
- 3D-a keeps today's loop for tiles with one open column and uses the stacked loop only for the
  rest. That brings heightfield maps back to today's cost and keeps the settle budget (≤ 3 s at
  256², D33).
- The prototype's carved 256² maps settle in 0.5 s (ordinary) and 1.1 s (high verticality) of CPU
  with the general loops.
- **Large water maps will be slow.** On the official maps with the most water the canonical settle
  takes 7–17 s of CPU at 192–256², against 4–10 s for today's heightfield settle:
  - ThousandIslands 16.6 s, Beaverome 12.3 s, Pressure 11.1 s, Terraces 7.7 s;
  - the stacked loop costs 1.6–2.5× per tick.

  Imports like these already exceed the 3 s generation budget today. The fast path and the 3D
  pre-fill are the remedies. The pre-fill already makes cave maps faster than today where caves
  decide the water: Hollows 1.5 s against 10.5 s, and Nomads 0.3 s against 9.6 s. 3D-a measures
  the fast path on these maps.

### 3.2 How well it matches the game

**On the 19 official maps** (all have some terrain above terrain; `proto/compare-water.ts`, game
mode), a column is wet when deeper than 0.05, and IoU is the wet columns in both over those wet in
either.

1. **The column graph is the game's.** The files store 259,954 flow-momentum entries, each naming
   its target column. Every one lands on an edge of our graph.
2. **One game day from each map's own water and momentum**, the water stays where the file has
   it:
   - IoU 1.000 on 18 maps, 0.999 on HelixMountain;
   - the largest depth change is 0.06 (evaporation on unfed pools);
   - every pressurised column stays pressurised: Pressure's 4,610, Hollows' 23, HelixMountain's 11.

   If our rules were not the game's, a stored steady state would drift.
3. **The proposed canonical settle** (3D pre-fill, then the settle test) reproduces the stored
   water on 17 of 19 maps: IoU ≥ 0.99, mean depth error ≤ 0.018, and 13 maps at 1.000. Some maps
   with today's heightfield settle for comparison:

   | Map | Stacked (canonical) | Heightfield today |
   |---|---|---|
   | Nomads | 1.000 | 0.036 |
   | Hollows | 1.000 | 0.189 |
   | Pressure | 1.000 | 0.208 |
   | Terraces | 1.000 | 0.565 |
   | Craters | 1.000 | 0.606 |
   | Cliffside | 1.000 | 0.643 |
   | Canyon | 0.998 | 0.819 |

   The details:
   - Meander's roofed columns are at 0.833: 3 columns under a natural overhang slab, below a line
     of weirs, where water is trapped during the fill.
   - The four maps D98 marks approximate: Hollows, Pressure and Nomads now match, so the cave cause
     retires. Oasis does not (below).
4. **Two maps don't match: Oasis (0.21) and Spillage (0.59).** Their stored water comes from
   aquifers and seeps, which a steady state with every running source on can't show. Today's
   heightfield settle fails them the same way (0.036, 0.576), and D98 already marks Oasis
   approximate.

**On the local workshop maps** (read only; aggregates only), from empty water, settled up to 6 game
days:
- **Saved by 1.0 or later**, 33 maps with water columns under roofs or objects:
  - median IoU 0.994, roofed columns 0.999;
  - 24 of 33 at 0.95 or more;
  - today's heightfield: median 0.708;
  - the stacked water is better on 31 maps and worse on none.
- **Saved before 1.0**, 92 maps: median 0.982, better on 75 and worse on 3. Their stored water was
  made by an older simulation, at double source strength.
- **The weakest matches** are maps still filling after 6 days, and maps whose water comes from
  badtide drains, delayed badwater, aquifers or seeps. On the one settled 1.0+ map that differs
  with none of these, both models drain the same open lake by about a level a day. Its file does
  not hold a steady state of its sources, and roofs are not the cause.

**The 1.0+ workshop maps with their own momentum** (33 maps):
- **The rules.** All 787,329 stored flow entries land on columns of our graph. One day from each
  map's own water keeps it: median IoU 1.000 (roofed 1.000), and 29 of 33 at 0.99 or more.
  Pressurised columns stay pressurised: 14,119 stored, 14,189 after the day.
- **The proposed canonical settle** gives median 0.986 (roofed 0.991), with 15 of 33 at 0.99 or
  more. Its median is below the from-empty start's (0.994), and 19 settle within 6 days.
- **Why it can hold more water than the file.** On 11 maps the canonical water is more than the
  file's. The pre-fill starts every basin on a water path full to its sill, as D27 does today, and
  some files hold those basins lower. On 9 of the 11, one of the two runs had not settled in 6 days,
  so the files are likely snapshots of basins still filling or draining.
- **A refinement item, for today's pre-fill too:** start a depression full only when the flow into
  it clearly exceeds what its surface evaporates.


`results/water-official.json` holds the per-map numbers for the official maps, and
`results/water-workshop.json` the workshop aggregates.

### 3.3 The canonical settle

The shape of D27 stays: a deterministic start computed from the document, then the exact simulation
until the §11.3 test passes. `proto/prefill3d.ts` ports it to the column graph:

1. **Spill levels.** The priority flood runs over columns, starting from the columns of edge tiles
   that drain into the padding. A column is reached through overlapping neighbour columns. A level
   above a column's ceiling means the column is full, with overflow (level − ceiling)/8 up to the
   cap.
2. **Water paths.** From every running emitter, water walks to overlapping columns whose spill level
   is not higher. Every column on a path below its spill level starts full. The others start at
   min(1, 0.3·Q/w), with w the shorter of the x and y runs of such columns.
3. **The settle test** counts columns: at most 0.5% of the map's tiles' worth of columns may still
   move by more than 0.005. On a heightfield that is today's test.

On heightfields the pre-fill gives exactly today's numbers (`proto/parity.ts` compares both). On
the prototype's carved maps the settle passes after 768–1,280 ticks from the pre-fill. On the
official cave maps it passes after 512–3,456 ticks where it settles. It ran to the 6-day limit used
here on Oasis, Spillage, Pillars and HelixMountain, whose seeps and aquifers keep moving. From the 3D
pre-fill, Hollows settles in 896 ticks, against 2,944 from empty.

**Sealed caves.** A cave with no opening and no source stays empty. A source inside a sealed cave
fills it, pressurises it, and then loses its water past the cap. The game does the same, and a
check warns about it (§4.5).

### 3.4 Soil moisture and contamination per run

The game computes both per terrain run top, each run's own slot (GAME_RULES §6). The steady-state
propagation of `sim/moisture.ts` and `sim/contamination.ts` generalises:
- **Nodes** are run tops.
- **Sources** are:
  - own clean water (2·sat);
  - a cave below that is full to its ceiling (range − 6·(roof thickness − 1));
  - neighbour water, the topmost wet column at or below the top;
  - spread from 8-neighbour runs whose ranges overlap (1 or 1.414, plus 6 per level up).

The heightfield replica matched the stored moisture exactly on 18 of 19 official maps (notes Q3).

**3D-a's acceptance:** the run version matches every stored slot of the official cave maps to the
same standard. Nothing in this investigation checked moisture per run yet; that is a risk (§10).

### 3.5 Both validators and the Python oracle

- **The validators** (`validate/checks.ts`, `validate/playability.ts`) take the stacked water and
  moisture instead of the heightfield ones. Every water check (§11.3) counts wet columns; "a water
  tile" becomes "a tile with a wet column at the level that matters" (the start's level for
  `start.water`, any level for `water.no_flood`).
- **The Python oracle** (`prototype/watersim.py`) gets the same port, bit for bit, as today's pair.
  - Irregular columns are a poor fit for numpy's grids. The port vectorises over edges instead: per
    substep, flows per edge in arrays, then sums per column with `np.add.at` in edge order, which is
    the order the TypeScript loop adds them.
  - The golden fixtures gain voxel maps with caves: the carving prototype's maps, Hollows, and a
    pressure case.
- **Determinism** (D15) is unchanged: the stacked rules add only + − × ÷ and min/max (the ×8 and ÷8
  of pressure).
- **Edge case.** The approximate-water verdicts of D98 lose their cave cause, because caves are
  simulated now. Delayed sources and aquifers keep theirs.

## 4. The checks

### 4.1 The support rule

- **`terrain.supported`** runs on every map, not only maps with two floors. The gate
  `floors > 1` misses runs floating over air down to z = 0: INVENTORY bug 1. A generated arch over
  a channel cut to z = 0 would never be checked.
- **The build's rule pass** makes generated maps pass by construction (§2.3). In `generate` the
  check must pass with 0 voxels dropped, so a carver that relies on the net is caught.
- **The instant checks** (EDITOR_PLAN §6) show what an edit would make fall, before it is applied
  (§6.1).
- **`proto/support-tests.ts` checks the rule on tall shapes up to the full height.** All 38 cases
  behave as predicted:
  - cantilevers up to 3 stand and 4 fall;
  - flat roofs span up to 6;
  - corbelled sky bridges stand over gorges up to 40 wide with the deck at 22, and fail with steps
    of 4;
  - cliffs 20 tall leaning 1–3 per level stand (up to 36 tiles out at the top), and 4 per level
    falls;
  - an undercut along a whole face stands at 3 deep and loses its edge at 4 (a notch holds deeper);
  - window arches up to 25 wide and 15 high stand;
  - hanging and floating rock falls.

### 4.2 Walking and reach

`proto/walk3d.ts` is the floor graph of GAME_RULES §4:
- **Nodes** are air cells on solid ground, in every layer, with no headroom rule.
- **Edges:**
  - the 4 neighbours at the same z;
  - diagonals when both orthogonal cells are nodes;
  - a slope from its front at z to its high side at z + 1. It needs air in its own two cells and a
    walkable front.
- **The checks that use it:** `start.water` (the shore on the start's own level), `start.wood`,
  `start.food`, `start.reach`, `ruins.access`, `extras.placement` and the dam sites. They replace
  `walk.ts`, `regions.ts` and the heightfield `walkRegions` (INVENTORY §4).
- **Natural ramps.** Derived slopes join every walkable region to its neighbours one level up.
- **Levels that need stairs.** A region separated from the start's network only by steps of two or
  more levels is reachable only with player stairs (70 science) or platforms. A new information
  check, `walk.levels`, lists for each map:
  - the levels the start reaches without stairs, and how (ramps, tunnels, ledges, bridges);
  - the heights that need stairs, and what lies there.

  These heights are allowed and useful: they are rewards and frontiers. In `generate` a planned
  reward must not sit on ground that nothing reaches even with stairs (a sealed pocket).

### 4.3 Placement under roofs

`entities.placement` already checks every occupied cell against the voxels (INVENTORY §3). What
changes:
- **Plants need clearance:** 3 air cells for pine and oak, 2 for birch and succulent, 1 for bushes
  (GAME_RULES §5). The resource planners place them only where it fits. The game drops a tree
  that doesn't fit on load, which becomes a load check.
- **Water objects, geothermal fields and mine sites** stand on the top of run 0 (the lowest run).
  A cave floor with rock under it is allowed; a ledge or an arch top is not.
- **Pumps can't draw through a roof.** `start.water` counts only water a pump on the shore tile
  can reach down its own column: 2 (or 4, 6) levels, with no terrain in between.
- **`slopes.connect`, `start.flat` and `start.entrance`** read the floor at the object's z, not the
  top surface. That is INVENTORY bug 2.

### 4.4 The start, with roofs

The three start requirements of D85 stay as they are, computed on the floor graph and the stacked
water.
- **The start's 3×3 needs 5 free layers**, so a roof at z + 5 or higher. "A start under a cliff" is
  allowed when that holds, and the requirements hold.
- **`start.dry`** counts wet columns at or above the start's floor within Chebyshev 2. A pool in a
  cave below the start no longer counts, which settles decisions-pending #48's question for caves.
- **Cave starts** (the start's tiles under a roof) are a Verticality option (§5.4), never the
  default.

### 4.5 New and retired checks

| Id | Class | Rule |
|---|---|---|
| `terrain.single_floor` | retired for generated maps | It becomes the measure "3D share" in `derived` |
| `terrain.dropped` | load (generate) | the build's rule pass dropped 0 voxels |
| `terrain.max_height` | design | ≤ 16, or ≤ 22 when Verticality allows it (§5.4, D4) |
| `plants.clearance` | load | every plant's blocks fit under the terrain above it |
| `water.sealed_source` | playability, warning | no running source in a sealed air space |
| `walk.levels` | information | the levels reached without stairs and the heights that need them (§4.2) |
| `caves.headroom` | design | generated tunnels and caves are at least 2 high; caves meant for resources or a start are at least 3 or 5 |

## 5. The generator

### 5.1 The principle

Maps are created, not copied (D108). 3D forms come from processes that read the land for where each
form belongs, and carve it with operators that keep the game's rules. There is never a stamped
set of caves. The M9 surface processes stay as designed: uplift, erosion, levels, hydrology. The 3D
processes run after them, on the field and its drainage.

### 5.2 Processes, and where each finds its place

Each process is a **site finder** (it reads the surface, the drainage and the walking regions) plus
a **carver** built from rule-keeping operators (`proto/carve3d.ts`).

| Form | Where it is found | How it is carved | Keeps the rule because |
|---|---|---|---|
| **Tunnel** | Two walkable regions on one level are separated by a ridge at least 4 higher, and the walk round is long or impossible. It prefers routes that open land near the start. | a gallery 2 wide and 2–3 high, wiggling | galleries are at most 6 wide |
| **Arch through a fin** | A thin ridge (a fin) between two floors at one level. Weathering opens a window. | an opening whose top narrows by 1, 2 and 3 per layer to a crown at most 5 wide | the lintel reaches at most 3 from each side |
| **Sky bridge** | A gorge narrows to 40 or less between rims at one height. | a deck 1–3 wide, corbelled from each row's own walls, rounder near the crown | each layer reaches at most 3 beyond the one below |
| **Cliff path and ledges** | A tall face (6+ levels) over walkable ground. | a ledge cut 2 deep and 3 high, rising one level every 3 tiles, joined by derived slopes | a 2-deep cut is a 2-long cantilever |
| **Cliffside cave** | Off a ledge or a cliff foot, into rock at least 4 thick. | a chamber 3 wide, branching from the middle of a ledge step | chambers are at most 6 wide, or keep pillars |
| **Undercut shelter** | A river bend's outer bank against a cliff, or a cliff foot. | up to 3 deep along the face; deeper only as notches | 3 deep along a face; notches held by the rock at their sides |
| **Overhanging cliff** | A tall face over lower land (multi-level valleys). | the face leans out by 0–1 per level in its upper part, varied along the face | at most 3 per layer |
| **Spring cave** | A spring's site at a cliff foot. The spring moves inside a cave, and its stream leaves by the mouth. | a gallery with a pool at the back, below the mouth's floor | galleries |
| **Underground river** | A basin whose natural outlet would cross a ridge, above a lower valley. The water sinks into the rock and returns on a cliff face (karst). | a gallery from the basin's rim, its bed falling one level every 2 tiles, out of the face as a spout | galleries |
| **Collapse (a sinkhole)** | A cave roof wider than the rule allows. | the rule pass itself: carve, let the rule drop the unsupported roof (a cenote) | it is the rule |

**The prototype** (`proto/gen3d.ts`) runs these finders on a multi-level landscape (a valley, a
terrace, a massif to 22, a ridge, a gorge, a high basin) at 128² and 256²:
- **Support:** every form carved, 0 voxels for the rule pass to drop.
- **Walking:** every carved place reached from the start without stairs, except the ridge top,
  which holds a ruin as a stairs-only reward. The gorge cuts the massif in two, and the sky bridge
  (9 and 17 tiles across, 10 levels above the gorge floor) is the only way between the halves:
  without it, the far half is unreachable.
- **Water:** settles in 768–1,280 ticks from the 3D pre-fill:
  - the spring cave's pool fills 1.05 deep;
  - the underground river runs out of the cliff face;
  - the water leaving the map is 95–98% of the sources' strength (the rest evaporates).

Details are in REPORT.md and `results/carve-*.json`.

**Where the prototype falls short of the design:** its landscape is scripted, not M9's field. The
finders are generic, but only one landscape exercised them. 3D-b runs them on M9's fields, for 200
seeds per theme, and measures what they find.

### 5.3 Water through mountains

**Underground rivers are river features with underground segments.** The hydrology plans the path.
The carver cuts the gallery with the bed never rising, and the settle proves the flow (the prototype
measured it at the spout).

**A start never depends on water it can only reach through a roof.** Pumps can't pump through one
(§4.3). A cave river is a resource beyond the start: power at its spout, moist cave floors, a
hidden reservoir.

### 5.4 Verticality

**A new setting, Verticality (`vt`, 0–100, default 20),** controls how much the map stacks:

| Verticality | Relief | 3D forms per map (at 128²; more on larger maps) | Examples |
|---|---|---|---|
| 0 | as today | none | a pure heightfield |
| 1–39 (ordinary; default 20) | within 16 levels | 0–2, small: a tunnel, an undercut, a spring cave | the prototype's ordinary maps: a tunnel through the ridge and a spring cave, 27 roofed wet columns |
| 40–69 | within 16 | 2–5: plus ledges, a cliff path, an arch, overhangs up to 3 | — |
| 70–100 (high) | up to 22 levels | 5–12: all of the table in §5.2, sky bridges up to 40 wide, leaning faces, multi-level valleys, water through mountains | the prototype's high maps: 8 forms, relief 3–22 |

- **Cave starts** (the start under a roof) are allowed only from 70 up, and only when the start
  requirements hold.
- **Relief above 16** is allowed only from 70 up, and only once the Probe has played terrain in
  layers 17–21 (PLAN §18 E1). That conflicts with D4 as written (§11).
- **"Surprise me"** (M9) may draw high Verticality.
- **Themes carry a default.** Canyon and Highlands lean higher (35–45), Lake Basin and Delta lower
  (10).

### 5.5 Traversal: how beavers reach each level

A generated map must be traversable. For each map, `walk.levels` (§4.2) states how every level is
reached.

**The joiners that ship with the map:**
- **natural ramps:** derived slopes on one-level steps (terrace edges, a gorge floor climbing one
  level every 2 tiles, ledge steps);
- **tunnels**, joining floors at one level through a ridge;
- **arches** at ground level, which do the same;
- **ledges and cliff paths** up tall faces;
- **sky bridges**, joining rims at one height.

**Heights that need stairs are rewards.** They are allowed and planned, never accidental: ridge
tops, mesa tops and peaks above a cliff of 2 or more with no ramp.
- They hold what makes the climb worth it: relics, ruins, a geothermal field, a spring's head.
- Sealed pockets stay empty.

**The prototype.**
- **High verticality:** it reaches 79% of all walkable cells without stairs, from the valley:
  - the side valley, through the tunnel and the arch;
  - the terrace, up the gorge's ramp;
  - the massif top at 20, up a cliff path of ten ledge steps;
  - the massif's far half, over the sky bridge at 20 (the only way across);
  - the cliffside cave, which holds a relic.

  What needs stairs: the ridge top at 16, which holds a ruin, and the southern hills, two levels
  above the side valley.
- **Ordinary:** it reaches 45% without stairs. The massif and ridge are stairs-only heights, as
  on today's maps.

### 5.6 Measures

The M9 measures (clones, archetypes, variety) gain 3D inputs: the roofed share, and the counts of
tunnels, arches, bridges, cliff paths, caves and underground rivers (`proto/measure-caves.ts`
classifies these spaces). 3D-b's batch reports them per theme and Verticality band. The same
checks stay against archetypes: no two maps may repeat a cave layout.

## 6. The editor

### 6.1 Tools

All tools are new, in the Land group, with plain names. Each previews in the view before it
applies. What would fall shows in red and is refused or confirmed, as the game's own sculpting keeps
only supported voxels (`GetValidTerrainToAdd`).

| Tool | Gesture | Parameters |
|---|---|---|
| **Carve** | brush on a face | size 1–5, depth; removes voxels, including into a cliff side |
| **Fill** | brush on a face | adds voxels on the clicked face's side, never more than 3 out per layer |
| **Tunnel** | click two points on one level | width 1–3 (default 2), height 1–4 (default 2); routed straight through rock; derived slopes at the ends if levels differ |
| **Arch** | click a fin, or two rims | span, height; the tool corbels it |
| **Cave** | drag an area on a face or floor | height; pillars kept to the span rule |
| **Ledge path** | click a face's foot and its top | rise per step (2–4 tiles); slopes derived |
| **Overhang** | drag along a face | lean per level (0–3) over a level range |

Each tool writes a feature (§6.4), not raw voxels, except Carve and Fill, which are voxel edits.
Claude uses the same features (§6.5).

### 6.2 3D selection and picking

- **Picking** is a voxel DDA against the runs, returning (x, y, z, face). It replaces the heightfield
  DDA (`render3d/pick.ts`, INVENTORY §8) and respects the cutaway.
- **Selections** are boxes (a tile area and a z range). The overlay and hover become per face, not
  per tile (INVENTORY §8, `materials.ts`).
- **Handles** of 3D features: tunnel ends and bends, bridge ends, ledge path ends, arch span.

### 6.3 The cutaway

- **A level slice**, as the game's: hide everything above a level, cap the cut ground, and hide water
  above the cut. A slider sits beside the view's toolbar, and a key cuts at the level under the
  cursor.
- **In the prototype** the cut is a shader discard plus a cap mesh rebuilt for the level. Its cost is
  in §7.4.
- The tools work at the cut: a Carve at the cut level digs the floor plan of a cave.

### 6.4 Undo, regeneration, locks

**Operations.**
- `carve {box | path, profile}` and `fill {…}` are voxel edits in the log, as `sculpt` is today.
- `addFeature` gains the kinds `tunnel`, `arch`, `skyBridge`, `cave`, `ledgePath`, `overhang` and
  `undergroundRiver`, each with params and a stored plan (§19.3's builder shape: `plan`, `check`,
  `rasterize`, `footprint` as tiles plus a z range).

**Undo** runs over the log, as today.

**Generate, keeping my edits.** 3D forms the generator made are features, re-planned on the new land
like rivers.
- The player's carve and fill edits replay after step 4b.
- An edit whose ground has gone becomes an orphan and is shown, never dropped. For example, a
  tunnel whose ridge moved.

**Locks** become 3D regions: tiles plus a z range. Whole columns remain the default. A locked region
keeps its runs, and the rule pass never drops voxels in a lock. A lock that would fall is refused
when it is set.

**Imports.** Their caves become editable (D40's refusal goes). An unedited import still exports
byte for byte. An edited one is re-settled with stacked water everywhere (D100's roofed exception
goes).

### 6.5 Claude

Claude never edits voxels (EDITOR_PLAN §7). It proposes features (a tunnel from here to there, an
arch in that fin, a cliff path up the north face), and the planners check them and reduce them to
what fits. The place vocabulary gains 3D places:
- the cave under the north cliff;
- the upper valley;
- the ledge path;
- the bridge.

`walk.levels` answers "how do beavers get up there?"

## 7. The 3D view

### 7.1 Meshing

`proto/mesher.ts` meshes every tile alike:
- **Faces:** a solid voxel gets a face toward each air neighbour, with undersides included and the
  map's border walled.
- **Greedy merging** happens per face plane and direction in each 32×32 chunk, so a heightfield's
  flat tops and long walls stay a few quads, and cave ceilings merge the same way.
- **One path.** It replaces today's split between heightfield tops and walls and per-voxel faces for
  cave columns (INVENTORY §8, `mesh.ts:225–242`, which does not merge).
- **Dirty chunks** come from run diffs.

### 7.2 Lighting

**Sky light** is a 3D texture of W × H × 24 bytes (1.5 MB at 256²):
- 255 under open sky;
- falling by 32 per step through air from the nearest sky-lit cell, never below 48;
- 0 in solid.

The fragment shader samples it half a cell in front of each face, with trilinear filtering. That
darkens cave interiors, corners and the underside of overhangs without baking anything into the
mesh, so merging stays maximal. An edit refreshes the texture region with `texSubImage3D`.

**What 3D-c adds, measured again:**
- The sun's shadow becomes a second channel: sun visibility per cell, marched along the sun
  direction.
- Map look's ground colours move per run top, as layers of a texture array like the game's
  `TerrainMaterialMap`.

### 7.3 Water

- One quad per wet column at its surface, cave columns included.
- Curtains are tested per column against the neighbour's run at that level (INVENTORY §8,
  `waterMesh.ts`).
- The cutaway hides water above the cut.

### 7.4 Rough numbers, and what may be slow later

**Rough numbers on this machine's normal GPU.** As Kyler asked for the prototype (2026-09-25), the
product's full budgets (PLAN §14.2, D46: a build under 1.5 s at 256² and 60 fps, on the integrated
GPU with the CPU slowed 4×) apply when 3D-c is built. `proto/bench-mesher.ts` measured:
- installed Chrome, headed, 1600×900, on the RTX 4080 SUPER;
- each map's build: mesh, sky light, upload and the first frame;
- an 8-second orbit without, then with, the cutaway at level 10.

| Map | Size | Build (ms) | Triangles | fps | fps, cut at 10 | Cut (ms) |
|---|---|---|---|---|---|---|
| prototype, high verticality | 256² | 122 | 14,234 | 165 | 165 | 7 |
| prototype, ordinary | 256² | 110 | 10,102 | 165 | 165 | 8 |
| Hollows | 192² | 88 | 40,846 | 165 | 165 | 5 |
| Pressure | 256² | 128 | 66,542 | 165 | 165 | 6 |
| Nomads | 256² | 111 | 29,944 | 165 | 165 | 7 |
| Lakes | 256² | 136 | 57,286 | 165 | 165 | 5 |
| HelixMountain | 256² | 123 | 74,132 | 165 | 164 | 8 |
| Oasis | 256² | 173 | 35,114 | 164 | 163 | 7 |
| 7 workshop cave maps (median; worst) | 255–256² | 159; 374 | 163,990; 225,590 | 165; 165 | 165; 164 | — |
| an oversize workshop map | 399² | 353 | 456,922 | 165 | 165 | 8 |

- **Frame rate.** The display runs at 165 Hz, so every rate here is the display's cap. The 95th
  percentile frame took 6.2 ms everywhere, with and without the cutaway.
- **Build time.** Builds take 88–374 ms at 256², where the product's budget allows 1,500 on a
  slower setup. The mesh takes most of it, and the sky light 10–72 ms.

`results/mesher-bench.json` has the numbers, and `results/timings.json` the CPU cost of the pieces
an edit would redo:
- one chunk remeshes in 0.5–0.8 ms (EDITOR_PLAN §9 allows 5);
- the whole-map support check takes 13–18 ms at 256², and a local one round an edit 0.04 ms;
- the sky light takes 6 ms at 256²;
- a cutaway cap takes 0.3 ms.

**What may be slow later:**
1. **Settling large water maps** (§3.1): 7–17 s of CPU on the official maps with the most water,
   1.6–2.5× today's per tick. The fast path for one-column tiles is 3D-a's first job.
2. **The full look.** The prototype's shader samples one 3D texture. Map look adds moisture per run
   top (a texture array per level), sun visibility in 3D and entities, so the fragment cost grows.
   The product's view does all this on heightfields at 100 fps on the integrated GPU (D46). Caves
   add undersides and inner walls, most of them hidden behind the surface, so 3D-c should measure
   overdraw on the cave-heaviest maps.
3. **Sun visibility per cell** (§7.2). Marching the sun direction through 1.5 M cells is far
   heavier than the sky light's walk under roofs. It must be incremental per edit, or be baked
   into chunks.
4. **The floor graph after every edit.** Regions and derived slopes over every layer are a
   whole-map walk today. At high Verticality they must be recomputed only round the edit.
5. **Triangle counts on cave-heavy imports.** The mesher merges well: the heaviest 256² workshop
   map here is 225,590 triangles with its water. The product's current mesher makes 160,008 terrain
   quads for the heaviest map in its own benchmark. Per-vertex data (if lighting moves into
   vertices) would break merges and multiply these counts.

## 8. Verification in the game

**The DGM Probe** (branch `investigation/probe`) plays a map as a new game at speed 99, under forced
weather, and records:
- every water column of sampled tiles;
- whole-map snapshots;
- soil;
- plant deaths;
- screenshots at our 3D view's poses.

Every launch needs Kyler's one-time consent code.

**Its records already hold stacked water** (`Recorder.WaterColumns`: floor, depth and contamination
for each column of a tile), so cave water compares directly with the stacked port.

**Probe jobs for terrain above terrain.** 3D-a writes these test maps, and 3D-b and 3D-c run them.
Each is small, deterministic and made by the prototype's operators:

| Job | Map | Checks |
|---|---|---|
| T1 support | cantilevers 3 and 4 long; a flat roof over 6 and 7; a corbelled bridge; a leaning face; an undercut along a face 3 and 4 deep | the loading-issues panel lists exactly the voxels the rule predicts; nothing else is deleted |
| T2 walking | 1-high and 2-high tunnels; a slope with a roof at z + 2; a ledge path | beavers use each (the Probe's walk sampling); districts reach through them |
| T3 cave water | a spring cave with a pool; a sealed cave with a source; a U-shaped passage full of water (a siphon); a tunnel to the map edge; the prototype's underground river | the recorded columns after 1 and 3 days against the stacked port: wet columns and depths per column, pressure where the port has it |
| T4 soil | a full cave under roofs 1, 2 and 3 thick; a tunnel stream | moisture per run top against §3.4's port |
| T5 plants and objects | pines under roofs 2 and 3 above; a start with a roof at z + 5; a pump on a ledge over a pool; a pump over a roofed pool | what loads, grows and pumps |
| T6 heights | the prototype's high-verticality map at 256² (relief 3–22); terrain in layers 17–21 | it loads, renders, plays, and the camera works (PLAN §18 E1) |
| T7 play | two generated high-verticality maps | a Normal game through the first drought, like the M9a play test |

- **Pass** means the load issues, water and soil agree as each row says.
- **Tolerances** are those of the Probe's existing water comparisons.
- **Any disagreement** is recorded in `docs/ingame-log.md`, and the port changes before the stage
  releases.

## 9. The staged plan

**Placement:** after the M9 build (M9a–M9c) and the Frame pass, before M10.
- **Why after the Frame pass.** It needs only M9, is short, and is scheduled right after it
  (D113). 3D is three stages and would delay it.
- **Why before M10 and M11.**
  - Their tools (sculpt brushes, naturalize, symmetry, stamps, regenerate area, locks) must work
    on runs.
  - Building them heightfield-only and retrofitting would redo their core.
  - M10's acceptance already asks that caves in imports survive edits.
- **One request to M9, before it ships format 3:** format 3's terrain as heights plus runs (§2.2).
  It costs nothing now and saves a format change later.

### 3D-a. Terrain model, water and checks (invisible to players)

**Delivers**
1. Runs per tile in `core/terrain` (§2.1). `BuildTarget`, `BuildResult`, the document's base and
   field, and kept content use them, and `heights` is derived. Formats 1–2 convert on read.
2. The stacked water (§3.1), with a fast path for one-column tiles. The 3D pre-fill and the
   canonical settle (§3.3). The multi-slot writer: `Levels`, slots, overflow, soil and evaporation
   per slot.
3. Moisture and contamination per run top (§3.4).
4. The Python oracle's stacked water and moisture, bit-identical, with voxel golden fixtures.
5. The checks of §4:
   - the support rule on every map, and the rule pass in the build;
   - the floor graph in both validators;
   - clearance and first-run placement;
   - floor-aware slope and start checks;
   - `walk.levels`, `terrain.dropped`, `water.sealed_source`, `plants.clearance`;
   - `terrain.single_floor` retired for generated maps.
6. Imports:
   - roofed water is simulated, which retires D100's exception;
   - the approximate-water cave cause goes (D98);
   - caves stay locked to the tools until 3D-c.
7. The Probe's test maps T1–T6 written (not played).

**Acceptance**
- Every generated map of every theme is identical to the previous release except its water's last
  digits: no wet tile differs, and depths are within 0.05 (the full batch; the generator version is
  bumped for game mode, §3.1).
- Parity:
  - the TypeScript and Python water and moisture agree bit for bit, on heightfields and on the voxel
    fixtures;
  - "port" mode still matches today's water bit for bit.
- Official cave maps: the canonical settle matches each map's own water at least as well as
  §3.2's measurements; the moisture per run matches the stored slots on at least 18 of 19.
- Budgets:
  - the canonical settle ≤ 3 s at 256² on generated maps (D33), and no slower than today's on the
    official maps;
  - the instant checks within EDITOR_PLAN §9's 50 ms at 256², with the support rule included (D56
    measured about 25 ms without it);
  - generation times unchanged.
- The two bugs of INVENTORY are fixed and tested.

**Risks:** moisture per run is not yet validated; the oracle's speed with edge vectors; the settle
budget on imports with large caves.

**Effort:** xhigh. **In-game check:** none (the maps for T1–T6 are written).

### 3D-b. Generation and Verticality

**Delivers**
1. The Verticality setting (`vt`), with themes' defaults, in the spec, the share links and the
   panel (§5.4).
2. The 3D processes of §5.2, run on M9's fields and drainage, each as a feature kind with a builder
   (§19.3 shape).
3. Traversal: derived slopes on the floor graph, and rewards planned on stairs-only heights (§5.5).
4. Underground rivers in the hydrology (§5.3).
5. Relief to 22 at high Verticality, only after T6 passes.
6. The 3D measures in the batch and the M9 measure suite (§5.6).
7. The Probe played: T1–T4 and T6, then T7 before release.

**Acceptance**
- Batches ≥ 98% per theme and size at Verticality 20 and 80. The first attempt is ≥ 60%.
- The rule pass drops 0 voxels on every batch map. Every generated map passes `walk.levels`:
  - every planned place is reached, or marked as a reward;
  - no sealed pockets hold anything.
- At Verticality 20, a map has at most 2 small 3D forms (at 128²) and its relief stays within 16.
- At Verticality 80, the median map has ≥ 5 forms of ≥ 3 kinds.
- The M9 measures stay within their targets, with the 3D inputs.
- Determinism and budgets hold: a whole generation ≤ 3 s at 128² with Verticality 80.
- Probe T1–T4 and T6 agree. T7: Kyler plays two high-verticality maps before the public release,
  like M9a.

**Risks:** pass rates with starts near cliffs; the settle time on maps with large caves; terrain
17–22 in the game; the look of carved forms on real fields.

**Effort:** xhigh. **In-game check:** yes (T1–T4, T6, T7).

### 3D-c. The editor and the view

**Delivers**
1. The mesher (§7.1) replaces `mesh.ts`. Sky light and sun visibility in 3D (§7.2). Water per
   column (§7.3). Map look per run top.
2. 3D picking, selections and handles (§6.2), and the cutaway (§6.3).
3. The tools of §6.1, with previews of what would fall.
4. Undo, generate-keeping-edits, 3D locks and imports editable (§6.4).
5. Claude's feature kinds and 3D places (§6.5; the words land with M12).
6. The Probe played: T5, and T2 with edited maps.

**Acceptance**
- `bench:3d` passes with 3D maps added, worst case in configuration 3: build < 1.5 s at 256², and
  ≥ 60 fps with and without the cutaway.
- A feature edit committed (rasterize, remesh, re-light) in ≤ 100 ms at 256², and a dirty-chunk
  remesh ≤ 5 ms (EDITOR_PLAN §9).
- Every tool's result passes the support rule with 0 drops, or is refused with its reason.
- Undo restores the exact runs. Incremental equals full after random carve and fill edits.
- An unedited import still exports byte for byte. An edited cave map exports with stacked water.
- The usability tasks gain "dig a tunnel between two valleys" and "cut away to see a cave": under
  2 minutes, without help.

**Risks:** 3D editing is hard to make simple; lighting and Map look per run; the fps with the full
look on big cave maps.

**Effort:** xhigh. **In-game check:** yes (T5, T2 on edited maps).

## 10. Risks

1. **Moisture and contamination per run have not been checked against data yet.** Water was;
   moisture is ported from the code (GAME_RULES §6) but not replicated. If they don't match, trees
   in caves live or die wrongly. 3D-a's acceptance makes this its gate.
2. **Terrain above 16 is untested in the game** (D4, PLAN §18 E1). The Probe's own high-terrain maps
   (to 21) are built but, at this writing, not yet played. High Verticality's relief waits for T6.
3. **The Python oracle.** Porting irregular columns bit for bit in numpy is the hardest code of
   3D-a. Its speed matters for CI (50 maps × 3 sizes).
4. **Pass rates and budgets at high Verticality.** Starts near cliffs, caves that slow the settle,
   and more walking checks. The prototype's settles took 768–1,280 ticks, but on one landscape.
5. **Editing in 3D is harder than editing heights.** The cutaway, previews of what falls and
   feature tools (not free voxel painting) keep it plain. The usability tasks are the judge.
6. **Scope.** Three xhigh stages, before M10. The benefit: 83% of 1.0+ workshop maps use caves, and
   "caves and tunnels" is the most common workshop pattern (46 maps, WORKSHOP.md).
7. **The workshop's water.** It matches worse than the official maps' (§3.2) where maps were saved
   before 1.0, while filling, or with delayed sources. The comparison separates these causes; none
   points at the stacked rules. The Probe's T3 is the final word.

## 11. What this changes in recorded decisions

Proposed changes, for Kyler. INTEGRATION.md has the exact text.

| Decision | Conflict | Proposal |
|---|---|---|
| D4: terrain ≤ 16 in generated maps and tools | High Verticality uses up to 22 | Keep 16 as the default and the limit below Verticality 70. Allow 17–22 from 70, only after the Probe's T6 passes (E1). Tools stay ≤ 16 unless the map's Verticality allows more. |
| D28: roofs not modelled; `terrain.single_floor` | stacked water models roofs | Superseded in 3D-a; `single_floor` becomes a measure |
| D40: sculpt tools refuse cave columns; features leave them unchanged | the tools edit caves | Superseded in 3D-c; until then D40 stands |
| D45: 3D view picks cave columns by their surface; the voxel mesher only for cave columns | one mesher, 3D picking | Superseded in 3D-c |
| D98: caves as a cause of approximate water | caves are simulated | The cave cause retires in 3D-a; the others stay |
| D100: roofed tiles keep the file's water | all water simulated | Superseded in 3D-a, except that an unedited import still exports byte for byte |
| PLAN §5.7: caves, NaturalOverhang bridges and BadtideDrains left out | 3D-b generates caves; bridges and drains become possible | Caves and tunnels: Verticality (3D-b). NaturalOverhang bridges: Later → 3D-b (stacked water validates them). BadtideDrains: Later → 3D-b (a drain's notch is terrain above terrain) |
| EDITOR_PLAN §2 non-goal: voxel-level cave editing | 3D-c builds it | The non-goal is lifted |
| m9-design §12: the field is a height field in format 3 | caves need runs | Format 3's `field` and `base` use heights plus runs (§2.2). The M9 field itself stays a surface. |
| D108: created, not copied | none | The 3D processes are site-finding processes (§5.2), not stamps |
| D111: no built dam walls | a sky bridge adds terrain across a gorge | No conflict in intent: a bridge leaves the gorge open beneath it (at least 4 levels of air above the gorge floor, by its finder), so it holds no water. The dam-wall check must not count bridges: 3D-b adds a test. |
| D11: in-game checks deferred | 3D-b and 3D-c ask for Probe runs | A request: the Probe makes them cheap. Each launch still needs Kyler's code. |
