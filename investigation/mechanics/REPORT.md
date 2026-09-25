# Mechanics that change a map's play

This investigation is an input to M9. It changes no generator or validator code.

Base: `dev` at `cfa5990caeaf462de695caf428280da55fc0f7f5`, generator 0.6.0.
Game evidence: the repository's notes for Timberborn 1.1.2.4, then the decompiled game itself for the 12 open facts
([VERIFIED.md](VERIFIED.md)). No game was launched.

## Decisions made for this study

- Use Normal defaults for the requested baseline: six themes, seeds 1–30, 128². Keep retries and failures.
- Separate measured opportunities from proven strategies. A water volume is not a survival proof.
- Keep faction comparisons narrow. Pump reach, plants, barriers and mine recipes have evidence; a general faction score does not.
- Treat workshop maps as evidence of range, never a target shape or recipe to copy (PLAN §20 D108).
- Compare M9 coverage against ROADMAP's design brief. Neither `docs/m9-design.md` nor `investigation/generative/` exists at the base commit.
- Keep the current start requirements and advisory checks as they are (D85, D104, D107). Propose new checks separately.

## Catalogue

[CATALOGUE.md](CATALOGUE.md) covers 25 mechanics or groups of related mechanics.
Each entry separates the sourced rule, the design inference, the limit and the measure.
[VERIFIED.md](VERIFIED.md) answers the 12 questions the first pass left open, from the game code. Wheel power (U01),
the core component (U06) and scrap trips (U07) were corrected; the aquifer (U05) and blockage (U08) rules confirmed.
The opening schedule, survival margin and faction suitability still need play.

## Baseline: different themes, repeated decisions

[BASELINE.md](BASELINE.md) measures eight [axes](AXES.md): storage work, power location, land/height,
fertile land, threats, resource timing, expansion choice and faction opportunity.

All 180 maps passed generation; 179 passed first time. Highlands seed 3 retried `start.water` once.
Four maps missed the advisory reservoir target. Those passes are not proofs of colony survival.

- Every map's nearest badwater or spoiled soil lies 15.4–24.2 tiles away: one threat-distance band.
- Valley-theme same-level dry land clusters around 116–121 tiles (theme medians). Lake Basin has 910; Islands 638.
- Canyon has no clean retained water within 40 tiles after the analytic nine-day drought. Lake Basin and Islands
  retain median 16.18 and 13.78 times the study's drinking reference. This excludes pumping and consumption.
- Fertile-land persistence has median zero in all four valley themes, 0.69 in Lake Basin and 0.81 in Islands.
- Only 21 of 180 maps offer extra shore cells under the six-level intake proxy. That does not prove a pump fits.
- Power follows the game's wheel rule now. Theme medians of the best bank-side axial flow are 1.02–1.75 m³/s, only
  1–8% below the old four-outflow sum, because settled rivers flow one way. That is 123–211 hp for an Iron Teeth
  compact wheel and 256–437 hp for a Folktails wheel, where one fits. Three Lake Basin maps have no usable flow.
- Log stock and outgoing regions vary more. Yet the largest joint diagnostic bin holds 20–30% of Canyon,
  Lake Basin, Delta and Islands seeds. Median nearest-peer bin distance is zero in every theme.

The bins are coarse and threshold-sensitive. They show repetition in opportunities, not identical strategies.
Pooling themes hides the clustering. Do not compare this metric numerically with the workshop study's variety score.

The reader's tests, all 180 data/hash checks, and a byte-for-byte CLI adapter check passed.
The usual child-process launcher was blocked; Node's TypeScript transform ran the unchanged core instead.
The leaf dependency and source hashes are recorded in `results/provenance.json`.

## M9 handoff

Generate combinations of opportunities, then check their dependencies. Vary reserve, fertile land, threats and expansion rewards
separately. Detect actual routes and storage projects before writing “how it plays” cards. A named landmark alone is not enough.

[M9-PROPOSALS.md](M9-PROPOSALS.md) gives eight candidate openings, target spreads and difficulty witnesses.
[INTEGRATION.md](INTEGRATION.md) maps them to PLAN/ROADMAP and flags decision conflicts.
Keep D85's advisory policy, the current nearby dam site, deferred roofed-water features and D109's approval gate.
Wheel output now follows the game's rule, but only where a wheel fits. Economic timing and full-cycle survival remain
unverified; do not promise them from these proxies.
