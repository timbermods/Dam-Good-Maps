# Terrain 3D: proposed text for ROADMAP.md and PLAN.md

**Proposals only.** Nothing here is applied. Kyler decides each item. The design is
[DESIGN.md](DESIGN.md), and the reasons for each choice are in [REPORT.md](REPORT.md).

- **Proposed decisions** are numbered P3D-1 to P3D-9. When adopted, they take the next free numbers
  in PLAN §20 (D115 onward at this writing). Another session adds decisions on `dev`, so the numbers
  are assigned on merge.
- **Conflicts with recorded decisions** are marked **⚠ conflict** and listed together in §3.

## 1. ROADMAP.md

### I-1. M9: format 3's terrain holds runs (a request before M9 ships format 3)

In the M9 section, under the build stage that brings project format 3, add:

> - Format 3's terrain (the document's `field` and `base`) is heights plus runs: the surface per
>   tile, and the solid runs of every tile that is not one plain run from z = 0
>   (investigation/terrain3d/DESIGN.md §2.2). It replaces `BaseMap.columns`. Generated maps without
>   3D forms store an empty list, so format 3 needs no change when terrain above terrain arrives.

### I-2. Overview table: three rows after the Frame pass

Insert after the row `| M9 | …` (and the Frame pass's row, if one is added):

> | 3D-a | Terrain above terrain: model, water and checks (after the Frame pass, before M10) | investigation/terrain3d/DESIGN.md §2–4, §9 · PLAN §10, §11, §19.6, §19.8 | no (the Probe's test maps are written) | xhigh |
> | 3D-b | Terrain above terrain: generation and Verticality | DESIGN.md §5 · PLAN §5.9 | yes (the Probe: T1–T4, T6, T7) | xhigh |
> | 3D-c | Terrain above terrain: the editor and the view | DESIGN.md §6–7 · EDITOR §4–6, §8 | yes (the Probe: T5, T2 on edited maps) | xhigh |

And to the paragraph after the table:

> The 3D stages follow the M9 build and the Frame pass. M10 and M11 follow 3D-c, so their tools are
> built on runs from the start.

### I-3. Release points

Add after the Frame pass's line:

> - 3D-a: no visible change (tagged `3d-a-done`); 3D-b: Verticality (tagged `3d-b-done`, after
>   Kyler's play test of two high-verticality maps); 3D-c: 3D editing (tagged `3d-c-done`).

### I-4. A new section after "Frame pass", before "M10"

> ## Terrain above terrain (3D-a, 3D-b, 3D-c)
>
> After the Frame pass and before M10 (Kyler, 2026-09-25: caves are essential; 83% of the 1.0+
> workshop maps use them). The design is `investigation/terrain3d/DESIGN.md`, with the game's rules
> in `GAME_RULES.md`, the maps' use of caves in `MAPS.md`, and the repository's heightfield
> assumptions in `INVENTORY.md`. Each stage is released like a milestone.
>
> **Why this order.** M10's and M11's tools (brushes, naturalize, symmetry, stamps, regenerate
> area, locks) must work on runs. Building them on heights and retrofitting would redo their core.
>
> ### 3D-a. Terrain model, water and checks
>
> **Delivers**
> 1. Runs per tile (`core/terrain`) as the build's, the document's and the kept content's terrain,
>    with `heights` derived. Formats 1 and 2 convert on read.
> 2. Stacked-column water with the game's rules (air gaps, overlap flow, pressure ×8, the overflow
>    cap, roofs, and the five edge rules today's port simplified), with a fast path for one-column
>    tiles; the 3D pre-fill and the canonical settle; the multi-slot writer.
> 3. Soil moisture and contamination per run top.
> 4. The Python oracle's stacked water and moisture, bit-identical, with voxel golden fixtures.
> 5. Checks:
>    - the support rule on every map, and the build's rule pass;
>    - the floor graph in both validators;
>    - plant clearance and first-run placement;
>    - floor-aware slope and start checks;
>    - `walk.levels`, `terrain.dropped`, `water.sealed_source`;
>    - `terrain.single_floor` retired for generated maps.
> 6. Imports: roofed water simulated (D100's exception retires); the cave cause of approximate
>    water retires (D98). Caves stay locked to the tools until 3D-c.
> 7. The Probe's test maps T1–T6 (DESIGN.md §8), written, not played.
>
> **Acceptance**
> - Every generated map is identical to the previous release except its water's last digits: no
>   wet tile differs, and depths are within 0.05 (the full batch; the generator version is bumped).
> - TypeScript and Python agree bit for bit on water and moisture, on heightfields and on the voxel
>   fixtures.
> - On the official cave maps, the canonical settle matches each map's own water at least as well
>   as the investigation measured, and moisture per run matches the stored slots on at least 18 of
>   19.
> - Budgets: the settle ≤ 3 s at 256² on generated maps (D33), and no slower than today's on the
>   official maps; the instant checks ≤ 50 ms at 256² with the support rule (EDITOR_PLAN §9);
>   generation times unchanged.
> - The support check's gate and the surface-only slope and start checks are fixed and tested.
>
> **In-game check:** none. **Effort:** xhigh.
>
> ### 3D-b. Generation and Verticality
>
> **Delivers**
> 1. The Verticality setting (`vt`, 0–100, default 20; themes carry their own defaults), in the
>    spec, share links and the panel (PLAN §5.9).
> 2. The 3D processes (DESIGN.md §5.2), run on M9's fields and drainage, each a feature kind with a
>    builder:
>    - tunnels between valleys on one level;
>    - arches in fins;
>    - sky bridges over gorges;
>    - cliff paths of ledges;
>    - cliffside caves;
>    - undercut shelters;
>    - overhanging cliffs;
>    - spring caves;
>    - underground rivers;
>    - collapses.
> 3. Traversal: derived slopes on the floor graph, and rewards planned on stairs-only heights.
> 4. Relief to 22 at Verticality 70 and above, once the Probe's T6 passes.
> 5. NaturalOverhang bridges and badtide drains in cliff notches (from Later).
> 6. The 3D measures in the batch and the M9 measure suite.
>
> **Acceptance**
> - Batches ≥ 98% per theme and size at Verticality 20 and 80, with first attempts ≥ 60%.
> - The rule pass drops 0 voxels on every batch map, and every map passes `walk.levels`.
> - At Verticality 20: at most 2 small 3D forms at 128², relief within 16.
> - At 80: the median map has ≥ 5 forms of ≥ 3 kinds.
> - The M9 measures stay within their targets, with the 3D inputs.
> - Determinism and budgets hold: a whole 128² generation ≤ 3 s at Verticality 80.
> - The Probe: T1–T4 and T6 agree with the model. Kyler plays two high-verticality maps (T7) before
>   the public release.
>
> **In-game check:** yes (the Probe). **Effort:** xhigh.
>
> ### 3D-c. The editor and the view
>
> **Delivers**
> 1. One mesher for every tile (greedy faces per plane, undersides), sky light and sun visibility in
>    3D, water per column, and Map look per run top.
> 2. 3D picking, selections and handles, and a level-slice cutaway.
> 3. Tools: Carve, Fill, Tunnel, Arch, Cave, Ledge path and Overhang, each previewing what the
>    support rule would drop.
> 4. Undo, generate-keeping-edits and 3D locks. Imported caves become editable (D40 retires).
> 5. Claude's 3D feature kinds and places (the words land with M12).
>
> **Acceptance**
> - `bench:3d` with 3D maps, in its budget configuration: a build < 1.5 s at 256², ≥ 60 fps with and
>   without the cutaway.
> - A feature edit committed (rasterize, remesh, re-light) ≤ 100 ms at 256²; a dirty-chunk remesh
>   ≤ 5 ms (EDITOR_PLAN §9).
> - Every tool's result drops 0 voxels, or is refused with its reason. Undo restores the exact runs.
>   An incremental build equals a full build after random carve and fill edits.
> - Unedited imports export byte for byte.
> - Usability: "dig a tunnel between two valleys" and "cut away to see a cave" in under 2 minutes
>   without help.
>
> **In-game check:** yes (the Probe: T5, and T2 on edited maps). **Effort:** xhigh.

### I-5. M10 and M11

In M10's Acceptance, replace:

> - Caves and overhangs in imported maps survive edits elsewhere, and terrain support is re-checked.

with:

> - The brushes, naturalize and symmetry work on runs: caves, overhangs and arches survive edits
>   elsewhere, are mirrored exactly by symmetry, and the build's rule pass drops 0 voxels after any
>   brush.

In M11's Delivers, add:

> - Locks, stamps and regenerate-area on 3D regions (tiles and a z range); stamps carry runs.

### I-6. Later

Remove these items, now in the 3D stages:
- caves and tunnels, with stacked-column water and voxel-level editing tools;
- NaturalOverhang bridges;
- badtide drains;
- terrain 17–22, if PLAN §18 E1 allows it.

Replace the paragraph "**Caves, overhangs and tunnels.** …" with:

> - **Caves, overhangs and tunnels** moved into 3D-a–3D-c (investigation/terrain3d). Within the 35
>   workshop maps made for 1.0 or later, 29 (83%) have cave or overhang columns; 46 of all 130 are
>   built round caves.

Replace "**Terrain 17–22.** …" with:

> - **Terrain 17–22**: 3D-b, at high Verticality, once the Probe plays it (T6).

## 2. PLAN.md

### I-7. §5.7, the table of 1.0+ features

Replace these rows:

> | NaturalOverhang bridges | 3D-b: over channels, now that stacked water validates water under a slab | The water under the slab is simulated per column (investigation/terrain3d). |
> | BadtideDrain | 3D-b: in cliff notches at high Verticality | A drain's notch is terrain above terrain, and its water is simulated per column. It runs only in badtide. |
> | Caves and terrain overhangs | 3D-a–3D-c: the Verticality setting (§5.9) | Stacked water, the support rule and the floor graph make them valid and playable (investigation/terrain3d/DESIGN.md). |

### I-8. A new §5.9, Verticality

> ### 5.9 Verticality (3D-b)
>
> **Verticality** (`vt`, 0–100, default 20) sets how much the map stacks: terrain above terrain
> found in the land by processes (DESIGN.md §5.2).
>
> | Value | Relief | 3D forms (at 128²) |
> |---|---|---|
> | 0 | as today | none |
> | 1–39 | within 16 | 0–2 small forms: a tunnel, an undercut, a spring cave |
> | 40–69 | within 16 | 2–5, plus ledges, a cliff path, an arch, overhangs up to 3 |
> | 70–100 | up to 22 (after §18 E1) | 5–12: overhanging cliffs, arches, sky bridges, cliffside caves and ledges, multi-level valleys, water through mountains |
>
> - Cave starts are allowed only from 70.
> - Every level has a way up without stairs (ramps, tunnels, ledges, bridges), except the planned
>   rewards, which need player stairs.
> - Theme defaults: Canyon 40, Highlands 45, River Valley 20, Lake Basin 10, Delta 10, Islands 20.

### I-9. §7, the generation pipeline

After the paragraph "**Features first.** …", add:

> **3D forms** (3D-b) are planned after the surface, from the surface and its drainage: tunnels,
> arches, sky bridges, ledges, caves, overhangs and underground rivers are features like the rest.
> The build carves them at step 4b (§19.8).

### I-10. §10, water simulation

Replace the bullet "What it does not model: water under roofs …" with:

> - Water under roofs (3D-a): `sim/water.ts` simulates every air gap of a tile, split by terrain
>   and the objects' obstacles, with the game's stacked-column rules: sideways flow between
>   overlapping gaps, pressure (overflow × 8), the overflow cap of (34 − ceiling)/8, and roofs.
>   - On heightfields it moves no wet tile; depths change by at most 0.033.
>   - On the official cave maps it matches their stored water: wet columns agree at IoU ≥ 0.99 on
>     17 of 19. The other two, Oasis and Spillage, hold aquifer and seep water that no steady state
>     shows.
>   - The pre-fill is a priority flood over the graph of gaps, identical to the old one on
>     heightfields.

Add to "**The canonical settle**" step 2:

> Checks count columns (air gaps): at most 0.5% of the map's tiles' worth may still move.

### I-11. §11, validation

In the paragraph "**design**", replace "`terrain.max_height` (16) and `terrain.single_floor`" with:

> `terrain.max_height` (16, or 22 at Verticality 70 and above) and `caves.headroom`

In §11.2's table, replace the rows `terrain.max_height`, `terrain.supported` and
`terrain.single_floor` with:

> | `terrain.max_height` | surface ≤ 16, or ≤ 22 at Verticality 70 and above (§5.9) |
> | `terrain.supported` | every map: no voxel the game's load rule would delete (every run not starting at z = 0 is checked) |
> | `terrain.dropped` | generate: the build's support rule pass dropped 0 voxels |
> | `plants.clearance` | every plant's blocks fit under the terrain above it (3 cells for pine and oak, 2 for birch and succulent, 1 for bushes) |

In the rows `slopes.connect`, `start.flat` and `start.entrance`, replace "ground at z" and "the start
level" with "the floor at the object's z".

In §11.4, `start.dry`:

> No wet column at or above the start's floor within Chebyshev 2 after settling.

Add rows:

> | `walk.levels` | information: the levels the start reaches without stairs and how; the heights that need stairs, and what lies there. In `generate`, nothing planned stands in a pocket no stairs reach. | — |
> | `water.sealed_source` | warning: no running source in a sealed air space (it fills, pressurises and loses water past the cap) | advisory |

### I-12. §18, the in-game checklist

In E, replace item 1 with:

> 1. Terrain above 16: can the game and the editor load and play it? The DGM Probe's T6
>    (investigation/terrain3d/DESIGN.md §8) answers it before 3D-b ships relief above 16.

### I-13. §19, shared foundations

**§19.2 feature table.** Add a row:

> | `carve` kinds (3D-b): `tunnel`, `arch`, `skyBridge`, `cave`, `ledgePath`, `overhang`, `undergroundRiver` | a path or area plus a z range; width, height, profile; ends and floors | Built only by their builders, which keep the support rule by construction; the build's rule pass drops 0 voxels. Floors are run tops. |

**§19.6 project file.** Replace "the surface heights, the multi-run columns verbatim, and world.json's
exact text without its terrain array (D37)" with:

> the terrain as heights plus runs (every tile that is not one plain run from z = 0, as its solid runs;
> format 3), and world.json's exact text without its terrain array (D37)

**§19.8 build order.** After step 4, insert:

> 4b. 3D forms: tunnels, caves, arches, sky bridges, ledges, overhangs and underground rivers, in
>     document order (3D-b);

and replace step 7 with:

> 7. integrity pass: remove pits and spikes, keep beds non-increasing downstream, and apply the
>    game's support rule (delete what the game would delete on load, and report it);

and add to step 9:

> every placement stands on a floor (a run top), by default the top surface.

### I-14. §20, proposed decisions

| # | Decision | Why | Status |
|---|---|---|---|
| P3D-1 | **Terrain is runs per tile** (the game's `ColumnTerrainMap` form), kept in memory as a 23-bit mask per tile, with `heights` derived. Format 3's `field` and `base` store heights plus runs (DESIGN.md §2). | It is what the game stores; the water columns and the support rule derive directly; heightfields are the simple case. | Proposed |
| P3D-2 | **Stacked-column water** replaces the heightfield model: the game's rules on air gaps, including the five edge rules today's port simplified ("game" mode), with the oracle and a generator version bump. The 3D pre-fill keeps D27's shape. | It reproduces the official cave maps' stored water (17 of 19 at IoU ≥ 0.99; the other two are aquifer and seep maps). On generated heightfields it moves no wet tile, and depths by at most 0.033. | Proposed; **⚠ supersedes D28, D98's cave cause, D100** |
| P3D-3 | **The build applies the support rule** at its integrity step, and generated maps must drop 0 voxels. | A file never holds a voxel the game deletes; carvers keep the rule, and the pass is the net. | Proposed |
| P3D-4 | **The floor graph for walking** in every check that walks. The heights that need stairs are listed and planned as rewards. | The game's walking has no headroom rule and joins levels only by slopes and stairs. | Proposed |
| P3D-5 | **Verticality** (`vt`, default 20) sets how much the map stacks. 3D forms are found by processes, never stamped. Relief above 16 only from 70, after the Probe's T6. | Kyler: crazy verticality as an option, modest by default. | Proposed; **⚠ amends D4** |
| P3D-6 | **The 3D stages come after the Frame pass and before M10** (3D-a model, water and checks; 3D-b generation; 3D-c editor and view). | M10's and M11's tools must be built on runs. | Proposed |
| P3D-7 | **Editing caves**: Carve, Fill and feature tools with previews of what falls; 3D locks; imported caves editable. | 3D editing that never produces a map the game changes on load. | Proposed; **⚠ supersedes D40 (in 3D-c)**, lifts EDITOR_PLAN §2's non-goal |
| P3D-8 | **One mesher for every tile** (greedy per plane, undersides), 3D sky light, and a level-slice cutaway. | It meets the budgets (DESIGN §7.4) and replaces the split of D45. | Proposed; **⚠ supersedes D45's cave rule (in 3D-c)** |
| P3D-9 | **The Probe verifies 3D** (DESIGN §8: T1–T7) in 3D-b and 3D-c. | The model matches stored water; the game is the judge of pressure, moisture, clearance and heights above 16. | Proposed; **⚠ an exception to D11** for these stages |

## 3. Conflicts with PLAN §20, together

| Decision | What conflicts | Proposal |
|---|---|---|
| **D4** (terrain ≤ 16 in generated maps and tools) | High Verticality uses up to 22 | Keep 16 as the default, and the limit below Verticality 70. Allow 17–22 from 70, only after the Probe's T6 (E1). Tools follow the map's Verticality. |
| **D11** (in-game checks deferred) | 3D-b and 3D-c ask for Probe runs | An exception for these stages. The Probe makes them cheap, and every launch still needs Kyler's consent code. |
| **D28** (roofs not modelled; `terrain.single_floor`) | stacked water models roofs | Superseded in 3D-a. `single_floor` becomes a measure. |
| **D40** (tools refuse cave columns) | the tools edit caves | Superseded in 3D-c; it stands until then. |
| **D45** (the 3D view picks cave columns by their surface; voxel mesher for cave columns only) | one mesher, 3D picking | Superseded in 3D-c. |
| **D98** (approximate water: caves as a cause) | caves are simulated | The cave cause retires in 3D-a; the others stay. |
| **D100** (roofed tiles keep the file's water) | all water simulated | Superseded in 3D-a, except that an unedited import still exports byte for byte. |
| **D111** (no built dam walls) | a sky bridge adds terrain across a gorge | No conflict in intent: a bridge leaves the gorge open beneath it and holds no water. 3D-b adds a test so the dam-wall check never counts a bridge. |
| **D108** (created, not copied) | none | The 3D forms are found by processes (DESIGN §5.2). Measures include them. |
| **D113** (Frame pass after M9, before M10) | none | The 3D stages come after it. |
| **m9-design §12** (the field is a height field in format 3) | caves need runs in the format | Format 3 holds heights plus runs (I-1). The M9 field stays a surface. |
