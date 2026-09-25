# Terrain above terrain: report

**What this is.** An investigation into real 3D terrain for Dam Good Maps: caves, overhangs,
tunnels and arches that the generator can create and the editor can edit, not only import. Kyler
decided this is essential. It covers:
- the game's rules, read from its code;
- how official and workshop maps use caves;
- where our code assumes one height per tile;
- prototypes that prove the hard parts;
- a design and a staged plan.

It changes nothing in `src/`. Everything is under `investigation/terrain3d/`.

| File | What it holds |
|---|---|
| [GAME_RULES.md](GAME_RULES.md) | the game's rules for terrain above terrain (step 1) |
| [MAPS.md](MAPS.md) | how the maps use it (step 2) |
| [INVENTORY.md](INVENTORY.md) | every one-height-per-tile assumption in our code (step 3) |
| `proto/`, `results/` | the prototypes and their measured numbers (step 4) |
| [DESIGN.md](DESIGN.md) | the design and the staged plan (step 5) |
| [INTEGRATION.md](INTEGRATION.md) | the proposed ROADMAP and PLAN text, and the conflicts with recorded decisions |

## Results in brief

**The game's rules** (GAME_RULES.md), read from the code of the installed build:
- **Water** lives in each air gap of a tile and moves only sideways, between gaps that overlap.
- **A full cave** keeps its excess water as pressure, up to a cap; water past the cap is lost.
- **Support.** A block over air must be within 3 steps of support in its own layer, and every block
  that rests on a supported block counts as supported. That is why leaning cliffs and corbelled
  arches stand.
- **Walking** has no headroom rule, and only slopes, stairs and platforms join levels.
- **Nothing checks for sky or light.** A pine or oak needs 3 free cells above it, and the start
  needs 5.

**How maps use it** (MAPS.md):
- Every official map has some terrain above terrain, and 29 of the 35 workshop maps saved by 1.0 or
  later do.
- Tunnels are the commonest form, usually carrying water. They are modest in section: 4–5 high,
  under 2–3 levels of rock.
- Hidden springs, pressurised caves, and ruins and relics under roofs are common on 1.0+ maps.

**The stacked water matches the game.**
- **On the 19 official maps:**
  - all 259,954 stored flow entries land on columns of our graph;
  - one day from each map's own water keeps it: wet columns agree at IoU 1.000 on 18 maps and
    0.999 on one, and every pressurised column stays pressurised;
  - the proposed canonical settle reproduces the stored water on 17 of 19 (IoU ≥ 0.99), including
    Hollows, Nomads and Pressure, where today's water scores 0.19, 0.04 and 0.21;
  - the two that don't, Oasis and Spillage, hold aquifer and seep water that no steady state
    shows. Today's water fails them too.
- **On the 33 workshop cave maps saved by 1.0 or later:**
  - all 787,329 stored flow entries land on our columns;
  - one day from each map's own water keeps it: median IoU 1.000, 29 of 33 at 0.99 or more;
  - from empty water: median IoU 0.994 (roofed columns 0.999), better than today's water (0.708)
    on 31 maps and worse on none;
  - the canonical settle: median 0.986. Where it differs, its pre-filled basins hold more water than
    the file, which is D27's pre-fill rule, not the stacked rules (DESIGN §3.2).
- **On our own generated heightfields** it can give today's water bit for bit, and the game's exact
  edge rules move no wet tile.

**The mesher, on this machine's normal GPU** (rough numbers, as asked; the full budgets apply when
it is built):
- builds every cave map up to 256² in 0.09–0.37 s;
- runs at the display's full 165 fps, with and without the cutaway;
- a cutaway takes 5–11 ms to apply, and a dirty chunk remeshes in under 1 ms.

What looks likely to be slow later:
- settling large water maps (7–17 s of CPU on the official maps with the most water, 1.6–2.5×
  today's per tick);
- the full Map look shader, sun shadows in 3D, and the walking graph after every edit (DESIGN
  §7.4).

**The carving prototype**, on a multi-level landscape at 128² and 256²:
- **It found and carved** a tunnel joining two valleys, a spring cave with a pool, a cliff path of
  ledges up a 10-level face, a cave off the path, an underground river from a high basin out of a
  cliff face, an overhanging cliff leaning 8 tiles, a sky bridge 10 levels above a gorge, and a
  tall arch.
- **The support rule dropped nothing.** The support tests on tall shapes (cantilevers, roofs,
  bridges over gorges up to 40 wide at level 22, cliffs leaning up to 36 tiles) all behave as the
  rule predicts.
- **Walking.** Every place is reached without stairs, and the sky bridge is the only way across
  its gorge. The ridge top needs stairs and holds a ruin as a reward.
- **Water:**
  - it settles in 768–1,280 ticks;
  - the cave pool fills 1.05 deep and the underground river runs out of the cliff;
  - today's heightfield water on the same maps agrees on only 32–76% of wet tiles at high
    verticality (95–97% at ordinary).

**The plan** (DESIGN.md §9): three stages after the M9 build and the Frame pass, before M10.
- **3D-a:** the terrain model, water and checks, with nothing visible to players.
- **3D-b:** generation and a Verticality setting, modest by default and up to the full 22 levels
  when high.
- **3D-c:** the editor tools and the 3D view.

The DGM Probe verifies cave water, support and heights in the game (DESIGN §8).

**The biggest risks** (DESIGN §10):
- moisture per run is ported but not yet checked against data;
- terrain above 16 is unplayed in the game;
- the Python oracle's stacked port;
- pass rates and settle time at high Verticality;
- keeping 3D editing simple.

## Decisions made, and why

Kyler asked for open choices to be decided and recorded. Each is a proposal in INTEGRATION.md.

1. **Terrain is stored as solid runs per tile, the game's own form.** It is not a full voxel array
   or a density field.
   - A heightfield is the simple case.
   - The water columns fall out of the runs directly.
   - The support rule and the walking graph are cheap on runs.
2. **The stacked water follows the game's code exactly ("game" mode), with a version bump.**
   - It can also run today's simplified arithmetic ("port" mode, bit-identical on heightfields,
     proved).
   - The game's five edge rules move no wet tile on our generated maps: volumes by at most 0.02%,
     depths by at most 0.033.
   - They are closer to the game on the official cave maps: one day from the stored water keeps
     18 of 19 maps exactly, against 14 in port mode.
   - Byte-identity buys nothing before versioned deploys, and M9 changes every map anyway.
3. **The canonical settle keeps its shape.** Its pre-fill becomes a priority flood over air gaps,
   identical to today's on heightfields. Changing the settle's shape would reopen D27 for no gain.
4. **The build applies the game's support rule itself.** A map never holds a voxel the game would
   delete. Carvers keep the rule by construction, so the pass is a safety net: it dropped 0 voxels
   on every prototype map, but it caught three real bugs during the prototype's development.
5. **Walking uses the game's rules exactly: no headroom check.** Generated tunnels are still 2 high
   or more, for looks and room. The start needs 5 free layers and trees 3, from their blueprints.
6. **Heights that need player-built stairs are allowed**, and planned as rewards: a ruin, a relic.
   A map says how every level is reached. This follows Kyler's request that everything stays
   traversable.
7. **Verticality is a 0–100 setting, default 20.** At ordinary values the 3D forms are occasional
   and small, within 16 levels. From 70 up, the map may use the full 22 levels, but only after the
   Probe has played terrain above 16. That conflicts with D4 as written, so it is flagged.
8. **The 3D forms are found by processes that read the land**, never stamped (D108): tunnels
   where two valleys share a level, bridges where a gorge narrows between matching rims, cliff
   paths on tall faces, water through a ridge from a basin.
9. **The three stages come after the M9 build and the Frame pass, before M10.**
   - The Frame pass is short and scheduled right after M9 (D113).
   - M10's and M11's tools must be built on runs, not retrofitted.
   - One small request to M9: format 3 stores heights plus runs, so no format change is needed
     later.
10. **One mesher for every tile**, greedy per face plane, with a 3D sky-light texture for cave
    light. It replaces today's split mesher and keeps merging maximal.
11. **The cutaway is a level slice**, as the game's own map editor does it. It is familiar to
    Timberborn players and cheap: a shader discard plus a cap.
12. **The Python oracle vectorises over flow edges.** It adds per column in the TypeScript loop's
    order, so the two stay bit for bit.

## What Kyler decides

The proposals P3D-1 to P3D-9 in INTEGRATION.md, above all:
- the placement of the three stages;
- the Verticality setting, and relief above 16 (D4);
- the request to M9 about format 3;
- Probe runs for 3D-b and 3D-c (D11).

## Method notes

- **Maps.** Official and workshop maps were read from their local folders and never committed.
  Only aggregates of workshop numbers are committed. The official maps' own numbers are committed.
- **The machine.** It is shared with a milestone run and the Probe session. Heavy runs went one
  at a time, and CPU times are given where timing matters.
- **The game.** It was never launched. The decompiled code matches the installed build
  (1.1.2.4-52e959e-sw). No decompiled code is committed; the rules are described in our own words.
- **Scope changes during the work.**
  - Kyler added Verticality (up to 22 levels, traversal, the support rule on tall shapes).
  - Kyler asked for the mesher to be measured on the normal GPU only; the full budgets apply when
    it is built.
  - The canonical-settle comparison on workshop maps covers the 33 saved by 1.0 or later. Older
    maps were saved under older water rules, and are compared from empty water only.
