# After Map look (2): Kyler's decisions

Recorded on 2026-09-25 (PLAN §20; decisions-pending #38 and #50 closed, #51–#53 new). The one-line
list of every decision since M8 is in [STATUS.md](../STATUS.md).

- D116: M9a's in-game gate is a DGM Probe batch, not Kyler's play test (amends D112 (3)).
- D117: the probe rule. The Probe may launch Timberborn only after Kyler's yes in chat, every batch
  (CLAUDE.md's standing rule; #50 decided).
- D118: real 3D terrain is essential; the terrain design's P3D-1 to P3D-9 are Kyler's decisions
  (D119–D127), with the 3D stages 3D-a, 3D-b and 3D-c after the Frame pass and before M10; I-1 puts
  runs in M9a's format 3.
- D128: the no-approximation measure allows 10% of a theme's maps under the workshop's p10 distance.
- D129: the audit's A1 and A2 go into M9a, A3 and A4 onto the Refinement list.
- D130: the simulation speedups join M9a's build plan as proposals, each proved bit for bit.
- D131: the techniques playbook as proposals; its conflicts are #51–#53.
- D132: Verticality beside Variety; above 16 only at high values, after a probe batch (#38 decided).
- D133: the Weather view with live water, after the 3D stages (`weather-view-done`).
- D134: keep M12 ready: each step before M12 adds tool entries and suite requests, and re-runs the
  suite.
- D135: Map look's clean default look and information layer; Kyler approves the appeal from
  captures.
- D136: Real places, a gallery of 88 real-terrain maps, right after Map look (`real-places-done`).
- D137: the workshop ratings are dropped; the score is a mild tiebreaker; in-site feedback proposed.
- D115, final version: Kyler's one rule, applied to every step's acceptance in ROADMAP.
- D138: maps feel authored: one or two intentions per map in design version 2.
- D139: Claude steers the generator and never hand-builds the map (a product principle);
  "describe the map you want" in M12; the Claude suite's requests sorted in M12-INTEGRATION.md §13.
- D140: M12's model layer is provider-neutral.
- D141: an MCP server after M12.
- D142: the agent guide after M9a.
- D143: Variations of this map, in M9c.
- D144: a contact-sheet image at every map-changing step (CLAUDE.md).
- D145: Kyler's answers to STATUS.md's eight flags: Verticality in M9a (above 16 locked until a
  probe batch), 3D-b's gate a probe batch, `start.dry` measured first, the one rule's lists stand,
  CI timing tests reported, M9a–M9c approved, character requests steer, M13's rating form dropped.
- Design version 2 is built on `investigation/generative-v2` (not started).

### Repo improvements (PR #21, merged 2026-09-25)

- The PR checks fail only on breakage; the software-rendered orbit check watches 8 s in CI (the assertion is unchanged).
- Timing budgets are reported in the job summaries and uploaded as artifacts, not asserted (Kyler's one rule, D145).
- The heavy vitest suites, the full oracle and the 100-seed batches run nightly (`.github/workflows/nightly.yml`); a failure opens or updates a `nightly` issue. PR checks take about 6 minutes instead of about 12.5.
- `investigation/README.md` indexes every investigation, with its status, PR and where its adopted pieces live; `tests/unit/boundaries.test.ts` keeps `src/` from importing any of them.
- Dependabot (weekly npm and GitHub Actions updates, into `dev`) and CodeQL code scanning are added; both start on their schedules once these files reach `main` with the next release.

- Kyler's roadmap decisions: a Map quality checkpoint after the M9 build (D146) and Map look 2: high fidelity before the Frame pass (D147, `map-look-2-done`).
- PR #18 (the DGM Probe) merged into `dev`; its INTEGRATION.md adopted as proposals (D149); two conflicts logged as pending #54 (where results go) and #55 (a manual play after the probe), with the recorded decisions as defaults.
- Kyler's dependency rule (D150): Actions and minor or patch npm updates merged when CI is green; majors (TypeScript 7.0 #24, @types/node 26 #25) held for the deliberate upgrade step (refinement, item 10); Dependabot regrouped into one weekly pull request per ecosystem. CodeQL flagged `live-check.yml`'s privileged `workflow_run` checkout; the live check is now called by `deploy.yml` with the commit it deployed.
