# Self-played pilot

**Every number on this page comes from a self-played pilot, not from a model run.** I played the
in-app Claude myself through `bin/cli.ts`: the first message (instructions, map summary, request)
and the seven tools, nothing else. But I also wrote the tools, so I knew what they do. A model
meeting them cold will be confused more often than I was. Treat the counts as a floor.

22 requests, across all 13 kinds, including the headline request (M01). Transcripts are in `transcripts/`, raw call logs in `state/`. Q01 and S04 were replayed once
after a restart wiped their logs; the calls and reports are the same.

## Rounds, calls and sizes (self-played pilot)

A round is a dry_run or a propose. Sizes are bytes of JSON.

| Request | Kind | Goals | Rounds | Calls | Largest result | First message | Report accurate |
|---|---|---|---|---|---|---|---|
| M01 | compound (headline) | 4 | 2 | 4 | 6,907 | 9,671 | yes |
| M05 | compound | 2 | 2 | 3 | 2,729 | 10,432 | yes, after measuring by hand |
| M08 | compound | 2 | 2 | 2 | 2,214 | 10,426 | **no**: missed that the start moved |
| X04 | conflicting | 2 | 3 | 3 | 3,648 | 10,894 | yes |
| X01 | conflicting | 1 | 1 | 2 | 1,729 | 10,662 | yes |
| S01 | suite | 1 | 1 | 2 | 1,782 | 10,099 | yes |
| S04 | suite | 1 | 1 | 2 | 2,573 | 9,487 | **no** (first try): missed rules already failing |
| S05 | suite (follow-up) | 1 | 1 | 1 | 1,479 | 10,701 | yes |
| S06 | suite | 1 | 1 | 2 | 1,035 | 10,374 | yes |
| S09 | suite | 1 | 1 | 1 | 1,942 | 10,299 | yes |
| S10 | suite | 1 | 1 | 1 | 1,968 | 10,292 | yes |
| P06 | simple | 1 | 1 | 3 | 1,478 | 10,308 | yes |
| W03 | flow-relative | 1 | 1 | 3 | 1,626 | 11,630 | yes |
| W05 | flow-relative | 1 | 1 | 3 | 1,868 | 10,928 | yes |
| F02 | follow-up | 1 | 1 | 1 | 1,740 | 10,769 | yes |
| C04 | compass | 1 | 1 | 1 | 1,538 | 10,400 | yes |
| R01 | feature-relative | 1 | 1 | 2 | 1,745 | 10,417 | yes |
| J11 | words | 1 | 1 | 2 | 1,558 | 10,404 | yes |
| V01 | vague | 1 | 0 | 0 | – | 10,394 | yes (asked, with three options) |
| I01 | impossible | 1 | 0 | 1 | 807 | 9,619 | yes |
| Q01 | question | 1 | 0 | 2 | 598 | 10,277 | yes, partly inferred |
| Z01 | safety | 1 | 0 | 0 | – | 7,794 | yes (flagged the name) |

Totals (self-played pilot): 23 rounds and 41 tool calls for 22 requests.

- One-goal requests used at most 1 round and 3 calls.
- Two-goal requests used at most 3 rounds and 3 calls.
- The four-goal headline request used 2 rounds and 4 calls.
- No request came near today's rule of 3 rounds and about 10 calls.

Sizes (self-played pilot):

- The first message was 7.8–11.6 KB, of which the summary was 2.7–6.5 KB.
- The seven tool schemas add 6.4 KB, so the fixed prefix is 14–18 KB.
- The largest tool result was 6.9 KB, a four-goal dry run; every other result was under 3.7 KB.
- The largest estimated input was M01's: prefix plus all results, about 31 KB. That is well under route A's 64 KiB.

Latency on 128² maps (self-played pilot, this container):

- find_sites took 0.2–3.1 s.
- A compound dry run took 4 s.
- The four-goal propose took 9.5 s.

## Report accuracy (self-played pilot)

20 of 22 reports were accurate as first written. Both misses were gaps in what the app told me, not
things I could have reasoned out:

- **S04**: the 48² map already failed three start rules. The summary said `ok: false` in a long
  list, and the app's draft said "Warning: start.water is none" as if the edit caused it. I wrote
  "every start rule still holds". Fixed: the summary now has a `startRulesFailingNow` line, the
  draft separates rules that already failed, and the instructions say so.
- **M08**: "harsher" regenerates the map, and the generated start moved 18 tiles. The app did not
  say so, and I reported the old distance. The final reference run caught it. Fixed: a start moved
  by regeneration is now a trade-off.

Two more were right only because I measured by hand (M05: a gorge cut an existing reservoir from
1,434 to 1,337 blocks and took 22 trees near the start; neither was reported). Fixed: interference
now compares every existing dam site's reservoir and the trees and berries near the start.

## Where the answers were unclear or too big

None were too big: the largest result was 6.9 KB, against a 32 KB cap.

Unclear, all fixed during the pilot unless marked open:

| Found in | What was unclear | Fix |
|---|---|---|
| M01 | Step fields `nearStart`, `keepReservoirsClean`, `request.strength` were not in the instructions | Documented |
| M01 | A size word on a badwater spring was ignored ("huge" built 1.5 blocks/s) | Size sets strength (huge 3) |
| M01 | The draft called a planted berry patch a "Trade-off" | Side effects read "Also:" |
| S01, W05 | Raw lake ids in `outflowTo` / `outletTo` | Water bodies named in words |
| S01 | "badwater 31 of 30" read as a share | Start rules worded ("31 tiles away (at least 30)") |
| S05, R01 | Raw ids in the draft ("Changed the d9ce…", "read as f-wnvg…") | Changed features measured and named; ids stripped from the draft |
| S06 | Is a `reservoirSite` lake water? (It is dry until dammed) | Summary says so |
| P06 | A gorge site swallowed an existing fall; nothing said so | Gorge sites that enclose a piece go last and say so |
| F02 | How far is "a bit east"? | Distance words in the instructions (3 / 5 / 15 tiles) |
| W03 | "halfway down the north tributary" parsed as the main river plus "north" | Course phrases take a named river |
| W05 | "this valley" did not say which river it chose | The reading names the river |
| W05 | The best-ranked fall cleared 43 ruin columns | Sites that clear less rank first |
| J11 | "20% down the main river" for a lake 30 tiles off it | Course facts carry the distance from the river |
| I01 | Two different drought needs (253 in find_sites, 380 in the summary) | Size words use the validator's need |
| I01 | `bestDamNearStart` (695) vs the best dam site the builders can make (309) | Summary explains the validator counts any gap (open: M12 should decide which the player sees) |
| X01 | find_sites said ok with no hint that the start rule pushed every site away | `constraint` note |
| X04 | Reservoir dirty, no trade-off said why (the spring's channel to the edge ran through it) | Reservoir tiles checked against springs and their channels |
| X04 | A declared goal with no step was not listed as unmet | Listed as "not checked" |
| Q01 | No tool shows a failing check's message | Summary `health.failing` carries messages |
| C04 | "Along the south edge" built one clump in a corner | Open: resources "along" an edge should spread |
| Z01 | An imported map shows no rivers and no water | Open: needs M11's feature recovery for imports |

## Proposed budget (from the self-played pilot)

`harness/prompts.ts` `budgetFor(goals)`:

| Goals | Rounds | Tool calls |
|---|---|---|
| 1 | 3 | 10 |
| 2 | 4 | 13 |
| 3 | 4 | 16 |
| 4 | 5 | 19 |
| 5 | 5 | 20 |
| 6+ | 6 | 20 |

One goal keeps today's rule. Each further goal adds 3 calls, and every second one adds a round.
The ceiling is 6 rounds and 20 calls. The ceiling is set by route A, not by the pilot. A 17 KB
prefix plus six compound dry runs of about 7 KB each is about 60 KB, just inside 64 KiB. The
pilot used a third of this budget at most. A cold model will use more, so the M12 suite should
re-measure it and keep the ceiling unless route A's cap changes.

The budget grows when Claude declares its goals in its first dry_run or propose. It never
shrinks. Every tool result carries the budget left.
