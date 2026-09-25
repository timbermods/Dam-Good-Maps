# Facts to check

There are **12 unresolved questions**. Each ID counts once, even when several catalogue entries use it.
The notes are the only game evidence used here. Code-derived rules remain labelled where the notes request an in-game check.
Kyler can check these against the decompiled game first; behaviour that needs play remains his check.

| ID | Unverified question | Evidence boundary and why it matters |
|---|---|---|
| U01 | How do each faction's water wheels convert local flow into power? What footprint, intake, direction, depth and saturation rules apply? | Water notes Q2 describe flow, not wheel output. PLAN §9.2 calls falls power spots. No wheel blueprint is in `blueprints_summary.json`. A fall or fast channel cannot yet be sold as a measured horsepower promise. |
| U02 | What are the exact floodgate heights, costs, unlocks, leakage and control rules for each faction? | Water notes Q2 and navigation notes §6 establish partial obstacles and the 0.65 player dam; they do not establish a floodgate construction schedule. |
| U03 | Which crop chains, yields, growing times and building costs turn measured fertile land into food for each faction? | Water notes Q3–Q4 support soil and listed plants. They do not establish a complete farming or food production model. |
| U04 | What work hours, hauling and construction sequence make the first pump, storage and food buildings ready in time? | Navigation notes §11 explicitly assume work hours. The quoted 45–50 pump goods per work-day is an estimate, not a validated schedule. |
| U05 | Do aquifer drills stop throughout both hazardous weather types exactly as the notes derive? | Water notes Q6 flag this for checking. Until confirmed, count zero aquifer supply for survival in drought and badtide. |
| U06 | Which `UnstableCore` component omission behaviour is correct? | Blocks notes §6 list it as optional, but format notes §6.1 and navigation notes §8 say it is required. Always include it; do not rely on an omission default. |
| U07 | Do ruins remain walk-through, and does the reported scrap collection rate hold with bots and bonuses? | Navigation notes §1c, §2 and “Needs in-game check” flag these. Count scrap stock, not time to collect it. |
| U08 | Does the Blockage top work as the notes' bank-level, non-road crossing in all relevant placements? | Navigation notes §5 and its check list flag this. The current analysis blocks the footprint and does not model that top route. |
| U09 | What survival margin remains through repeated droughts and badtides, including refill, population growth and industry? | Water notes Q7 provide weather and consumption rules, not a played colony schedule. This study's static measures cannot certify a complete run. |
| U10 | How do wind, other power sources, housing, breeding, bots and wellbeing change faction suitability? | The allowed sources do not supply a complete model. Format notes §4 describe saved wind state, not terrain-dependent wind yield. Do not infer these from a faction stereotype. |
| U11 | What does full construction access require for a wheel, floodgate, platform and each proposed reservoir project? | Blocks notes cover map templates; navigation notes cover walking and road spill. A clear shore cell does not prove the full building footprint, connection or build order fits. |
| U12 | What do optional caches, explosions and roofed water do in the remaining edge cases? | Navigation notes' check list asks about foreign goods, excess cache capacity and explosion reach; format notes §9 asks about stacked water and vanilla behaviour. Keep these out of certified openings until checked. |

The evidence also has small summary inconsistencies. Water notes Q7 give badtides from cycles 6/5/4;
navigation §11 says “after cycle 5/4/3”, which is compatible. Use the explicit first-cycle form.
Format §6.3's timer shorthand is less precise than water Q1 and navigation §8; use the latter.
The full per-source check lists remain in the notes. This list is limited to the claims this study needs.
