# Claude groundwork for M12: report

Players ask for things like "Make this valley harsher. Put the start upstream, give me a huge dam
opportunity halfway down, and create a dangerous badwater route on the opposite side." This work
turns such requests into bounded steps that the engine checks. For each goal it says whether the
goal can be done, and what gave way.

Everything is under `investigation/claude/`; nothing in `src/` or `tests/` changed. There was no
API key, so the model never ran. The pilot was played by hand through the tools, and its numbers
are labelled as self-played pilot throughout.

## What was built

- **A request corpus** (`requests.json`): 120 requests in 13 kinds, each with its map, goals,
  expectations, feasibility, what the report must say, pass criteria and a reference solution.
- **The place resolver** (`lib/places.ts`, `lib/flow.ts`):
  - compass places, places relative to features, and flow-relative places;
  - flow is read from each river's settled water, never from a compass direction;
  - tested on rivers flowing in all four directions, curved, drawn and tributary rivers.
- **The judgement-word table** (`lib/words.ts`):
  - 13 words, each with its settings, measured targets and guards;
  - every word tested on three maps;
  - also size words and comparatives.
- **The seven tools** (`lib/tools.ts`):
  - schemas are 0.6–1.6 KB each, results are capped at 32 KB, and the summary is 3–7 KB;
  - every tool checks its own arguments;
  - `find_sites` plans candidates with the real builders and checks each with a real build;
  - it returns the nearest alternative when nothing fits.
- **Compound handling** (`lib/compound.ts`):
  - the app orders the steps and checks every goal on the combined result;
  - guards come from the validator;
  - interference between goals is detected and named in the report draft.
- **The harness** (`harness/`):
  - a Messages API bridge, the append-only loop, the prompts and the suite runner with its grader;
  - it fits route A: no system prompt, 64 KiB input, 32 KB results;
  - ready to run with a key; `--scripted` replays the reference solutions without one.
- **A CLI** (`bin/cli.ts`) that shows only the summary and the tools, for the pilot.

## Results

- **Reference solutions:** 120 of 120 pass through `MapSession` with the real validators
  (`out/REFERENCE.md`).
- **Tests:** 53 of 53 pass (the resolver and the words).
- **Scripted harness:** see "Harness" below.
- **Against dev:** see "Checked against dev" below.

### Requests by kind

"Feasible" means today's steps can do it all. "Partly" means some of it, with the rest offered.
"Not expressible" means no step exists for it yet.

| Kind | Requests | Feasible | Partly | Not feasible | Not expressible today |
|---|---|---|---|---|---|
| suite (EDITOR_PLAN §9, word for word) | 10 | 9 | 1 | 0 | 0 |
| simple | 15 | 12 | 3 | 0 | 3 |
| follow-ups | 9 | 8 | 1 | 0 | 0 |
| compass | 8 | 7 | 1 | 0 | 1 |
| feature-relative | 6 | 6 | 0 | 0 | 0 |
| flow-relative | 14 | 14 | 0 | 0 | 0 |
| size and judgement words | 11 | 11 | 0 | 0 | 0 |
| compound (with the headline request) | 10 | 8 | 2 | 0 | 0 |
| vague | 6 | 4 | 2 | 0 | 1 |
| impossible | 8 | 0 | 2 | 6 | 3 |
| conflicting | 9 | 0 | 8 | 1 | 1 |
| questions | 7 | 7 | 0 | 0 | 0 |
| safety | 7 | 4 | 2 | 1 | 0 |
| **All** | **120** | **90** | **22** | **8** | **9** |

With today's operations:
- 90 requests can be done in full.
- 15 more can be done in part, with the rest offered as an alternative.
- 7 are partly feasible but need an operation that does not exist; they get an offer instead.
- 8 cannot be done at all.

### Missing operations and builders

What the nine requests that cannot be expressed need:

| Needs | Requests | Status |
|---|---|---|
| Map objects: thorn belts, relics (and mine sites, geothermal fields, weirs) | N01, N02 | Built on dev during this work (M7); needs an `addMapObject` step |
| The plugged-spillway builder | N03 | Built on dev (M7); needs `addSetPiece plugSpillway` |
| The river badwater switch | X05 | Stored and ignored at the branch point; dev builds it for rivers from an edge; needs the step |
| Regenerate an area | N04, and regional judgement words | M11 |
| Symmetry | N05 | M10 |
| Flow axes for generated layouts | I05 | M9 (D67: every theme flows west to east) |
| Caves | I08 | Non-goal |
| Several colonies | I04 | Not scheduled (D5) |

Obstacles with a payoff and second district sites are also built on dev now, and need step
wrappers.

## Self-played pilot

22 requests across all 13 kinds, played through the CLI only (`pilot/PILOT.md`). Self-played pilot
numbers:

- **Rounds and calls:** 23 rounds and 41 tool calls in all.
  - One-goal requests used at most 1 round and 3 calls.
  - Compound requests used at most 3 rounds and 4 calls.
  - None came near 3 rounds and 10 calls.
- **Sizes:**
  - The first message was 7.8–11.6 KB, with a fixed prefix of 14–18 KB including the schemas.
  - The largest result was 6.9 KB (a four-goal dry run).
  - No input came near 64 KiB.
- **Report accuracy:** 20 of 22 reports were accurate as first written. Both misses were facts the
  app did not give:
  - a map that already failed three start rules (S04);
  - a start that the regenerated map moved (M08).
  Both are now reported.
- **Unclear answers:**
  - 21 were found, among them raw ids in results, a phrase parser that read "the north tributary"
    as "north", two different drought needs, and interference the app missed (a gorge shrinking a
    reservoir, a badwater channel running through one).
  - 19 are fixed (one by explaining it, with a pending decision); 2 are open ("along the edge"
    builds one clump; imports show no rivers).
- **Proposed budget:**
  - 3 rounds and 10 calls for one goal, +3 calls per further goal and +1 round per two, at most
    6 rounds and 20 calls.
  - The ceiling comes from route A's 64 KiB, not from the pilot.

## Harness

- The scripted harness replays every reference solution through the real loop and grader, with
  the artifact limits on.
- Largest input: 37 KiB (M01).

## Top M12 risks

1. **The model is unmeasured.** There was no key. The pilot was played by the tools' author, who
   knew what every field means. Real pass rates, rounds and report accuracy are unknown until the
   suite runs with a key.
2. **Interference the app cannot see yet.** The pilot found five kinds it missed in 22 requests,
   all fixed. More are likely: the checks model outlets, reservoirs, flow, the start and cleared
   resources, and nothing else.
3. **Route A's 64 KiB input.** The fixed prefix is 14–18 KB and a compound dry run is about 7 KB.
   A six-round compound conversation reaches about 60 KB. Keep results small, or trim old results.
4. **`find_sites` at 256².** About 3.7 s for a dam site. A three-goal compound request takes about
   24 s, mostly checking candidates with real builds. On route A that blocks the page.
5. **Regeneration side effects.** Judgement words regenerate the whole map. They are map-wide even
   when the player says "this valley", and the generated start can move. Both are now reported,
   but a regional version needs M11.
6. **Engine gaps worked around here** (M12-INTEGRATION.md section 8):
   - a proposal is several undo entries;
   - a site's shape depends on its feature id;
   - builders do not return their reservoir or lip tiles;
   - Lake Basin documents fail to reopen (seeds 2 and 3 at 128², still on dev).

## Where to look

- [M12-INTEGRATION.md](M12-INTEGRATION.md): exact text for the roadmap and plans, file moves,
  pending decisions with defaults, src changes, and a message for the milestone session.
- [pilot/PILOT.md](pilot/PILOT.md): the pilot.
- [out/REFERENCE.md](out/REFERENCE.md): every reference solution's result.
- [README.md](README.md): what each file is, and the commands.
