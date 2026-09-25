# Status

One page, rewritten at every step and stop. Updated 2026-09-25, after recording Kyler's decisions
D116–D144. The decisions' full text is in [PLAN.md §20](../PLAN.md#20-editor-decisions), and the
order of work in [ROADMAP.md](../ROADMAP.md).

## Decisions since M8

Every decision Kyler sent since `m8-done`, in the version in force.

- **D107** Beaverome is off M8's approximate-water list; `start.dry` stays as built, and lakeside
  starts are a Refinement item, measured first.
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
- **D116** M9a's in-game gate is a DGM Probe batch, not Kyler's play test.
- **D117** The probe rule: the Probe may launch Timberborn only after Kyler's yes in chat, every
  batch (CLAUDE.md).
- **D118–D127** Real 3D terrain is essential: P3D-1 to P3D-9 adopted (runs per tile, stacked
  water, the support rule, the floor graph, Verticality, the 3D stages after the Frame pass,
  editing caves, one mesher, the Probe for 3D). I-1: format 3 stores runs from M9a.
- **D128** No approximation: at most 10% of a theme's maps under the workshop's p10 distance.
- **D129** The audit: A1 and A2 into M9a; A3 and A4 onto the Refinement list.
- **D130** The simulation speedups, as proposals, in M9a's build plan, each proved bit for bit.
- **D131** The techniques playbook, as proposals for M9 and the 3D design.
- **D132** Verticality (`vt`) beside Variety; above 16 only at high values, after a probe batch;
  vertical and traversable; measured in design version 2.
- **D133** The Weather view with live water, after the 3D stages (`weather-view-done`).
- **D134** Keep M12 ready: each step adds tool entries and suite requests, and keeps the suite green.
- **D135** Map look: a clean default look close to the game, and an information layer; Kyler
  approves the appeal from captures.
- **D136** Real places: a gallery of 88 real-terrain maps, right after Map look
  (`real-places-done`).
- **D137** The workshop ratings are dropped; the score is a mild tiebreaker; in-site feedback is
  proposed for M9c.
- **D138** Maps feel authored: one or two intentions per map, under three principles.
- **D139** Claude steers the generator and never hand-builds the map; "describe the map you want"
  in M12.
- **D140** M12's model layer is provider-neutral; Claude is the only provider built.
- **D141** A Dam Good Maps MCP server, after M12.
- **D142** The agent guide, after M9a.
- **D143** Variations of this map, in M9c.
- **D144** A contact-sheet image at every map-changing step, in `docs/sheets/`.
- **Design version 2** is built on `investigation/generative-v2` (not started).

### Flags

Where a decision needed a reading, or two decisions pull apart. Each has the default the plans
use now.

1. **Verticality's stage.** Kyler's text says "before M9a offers it", so the setting and heights
   above 16 are in M9a, and 3D-b extends Verticality to 3D forms. The terrain design had put both
   in 3D-b. "High Verticality" is read as 70 and above, the design's number.
2. **3D-b's release** still waits for Kyler's own play of two high-verticality maps (T7), as the
   terrain design wrote. M9a's play test became a probe batch. Should T7 become one too?
3. **`start.dry` in 3D-a.** The terrain design's text counts only water at or above the start's
   floor, which would also settle lakeside starts (D107 said to measure first). Default: the
   Refinement item still measures first; 3D-a uses the floor rule only under roofs.
4. **Reading the one rule.** Kept blocking: batches ≥ 98% final (a seed with no map is breakage),
   names that match the map, the place resolver and judgement words' direction. Made information:
   first-attempt rates, no clones, no archetypes, play variety, no approximation, and M12's pass
   rate with a key.
5. **Timing tests in CI** (the 256² settle median, D33; the editor's 2 s re-preview test) still
   fail a build. Changing them is code. Default: they become reported numbers at M9a.
6. **M9's staging** is still headed "Proposed (for Kyler's approval)", though Kyler's decisions
   use M9a–M9c. Treat it as approved?
7. **Which Claude requests steer.** New landforms, water features and dam opportunities steer (the
   giant waterfall and the compound request included, read as Kyler's flagship requests);
   resources, objects, the start, drawn rivers and follow-ups stay operations
   ([M12-INTEGRATION.md §13](../investigation/claude/M12-INTEGRATION.md)). The "waiting for
   capability" mark needs a code change to the corpus, so it lands at M9a.
8. **M13's rating form** stays as feedback only, with no refit. Keep it beside the in-site
   feedback of D137, or drop it?

## Done and released

- **M1–M8** are live: <https://timbermods.github.io/dam-good-maps/> (`m8-done`, live check
  passed).
- **Map look** is built on `dev`, not released. It waits for Kyler's approval of the clean look.
- Merged investigations: workshop (#4), Claude groundwork (#5), cycles (#10, #15), audit (#13), M9
  design version 1 (#14), landscapes (#16), simspeed (#17), techniques (#19), terrain 3D (#20).

## Running

- **Map look's clean-look round**, on branch `look/clean`.
- **PRs #11** (mechanics, verified) **and #12** (map names), being merged into `dev`.
- **PR #18**, the DGM Probe, is a draft. It is merged at a boundary when ready.

## Waiting on Kyler

1. The flags above.
2. Approve Map look's clean look from its captures (then `map-look-done`, then Real places).
3. Kyler's own one-sentence intentions, for design version 2.
4. Approve design version 2 when it's built; approve the feedback proposal (D137).
5. A yes before each probe batch; the first is M9a's.
6. Open decisions: 47 in [decisions-pending.md](decisions-pending.md), each with a default; new:
   #51–#53.
7. Optional: the pending in-game checks ([ingame-log.md](ingame-log.md)), and the M3 spike page
   ([What Kyler needs to do](progress/kyler-todo.md), item 4).

## Where to look next

- [ROADMAP.md](../ROADMAP.md): the order of work, and each step's Blocking and Information lists.
- [PLAN.md §20](../PLAN.md#20-editor-decisions): every decision, D1–D144.
- [decisions-pending.md](decisions-pending.md): open questions with their defaults.
- [m9-design.md](m9-design.md): M9 design version 1.
- [ingame-log.md](ingame-log.md): in-game checks and the planned probe batches.
- [progress/README.md](progress/README.md): the record of each milestone and step, one file each.
- [progress/kyler-todo.md](progress/kyler-todo.md): what Kyler needs to do, with the exact steps.
