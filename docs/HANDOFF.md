# Handoff: the milestone session, paused 2026-09-26

**Read this first if you're the new milestone session.** You start with no memory of the last one. This page says what's in
flight, what to do next, and how things are run here. Then read `CLAUDE.md`, `docs/STATUS.md`, `EDITOR_PLAN.md` (before any
editor work), `PLAN.md` §20 (every decision, D1–D217) and `ROADMAP.md`. Kyler (he/him) owns the project and decides
everything; his usage resets on 2026-09-29, and he paused all work until then.

## 1. The queued order of work

1. **Finish M9a** (§3), then its 15-map DGM Probe batch **with Kyler's yes** (§7), then tag `m9a-done` and release.
2. **Live editing:** its two changes (D212), then release `live-editing-done`. The README's editor section is rewritten in
   that release PR.
3. **The forces:** merge #47 (Carve), #51 (Craterize) and #50 (Erupt) into `dev` at that boundary; build the three buttons on
   one shared forces core (D216). Quake (#52) stays held (§6).
4. **Waterfalls (#53):** the D215 fixes, then release `look-waterfalls-done`.
5. **Real places, second round (#35):** D214, Kyler's drops, and badwater (after M9a lands), then `real-places-2-done`.
6. Then M9b, M9c and the rest of `ROADMAP.md`.

M9a comes first whenever work competes for the machine (D210).

## 2. Work in flight

| Work | Branch | PR | Worktree | Last commit | State |
|---|---|---|---|---|---|
| M9a, the new generator | `feature/m9a` | #56 (draft, WIP) | `C:\Users\Kyler\code\DamGoodMaps-m9a` | 12beeb3 (WIP) | paused mid-build |
| Live editing | `feature/live-editing` | none yet | `C:\Users\Kyler\code\DamGoodMaps-live` | b4d7c27 (WIP; last green 59f826c) | four D184 pushes done; Carve port WIP |
| Badwater on every map (D200) | `feature/badwater-source` | #54 | `C:\Users\Kyler\code\DamGoodMaps-resources` | 5b1f3d6 | done; **held**, M9a took it in (D213) |
| Waterfalls (D201) | `look/waterfalls` | #53 | `.claude\worktrees\agent-ae1b9f4667671d0e8` | b00b2fc | done; needs D215 fixes |
| Real places, round 2 | `feature/real-places-2` | #35 | `C:\Users\Kyler\code\DamGoodMaps-places` | a59c051 | 150 places rebuilt; needs D214 and badwater |
| Carve (Codex) | `investigation/carve` | #47 | none (Codex's branch) | 6b9d4e6 | ready (D216); merge at the next boundary |
| Craterize (Codex) | `investigation/craterize` | #51 | none | 2f4963c | ready (D216) |
| Erupt (Codex) | `investigation/erupt` | #50 | none | 89c6842 | ready (D216) |
| Quake (Codex) | `investigation/quake` | #52 | none | 4e8115a | **held**: Codex's Slide round running (§6) |

`dev` is at the handoff commit (see `git log`); `main` is at 8995cee (`look-badwater-done`). Worktrees that are finished and can
be removed when convenient: `DamGoodMaps-rules` (#44 merged), `DamGoodMaps-v2` (#32 merged), `DamGoodMaps-probe`
(`chore/probe-tall`, merged), `DamGoodMaps-generative`, and the `.claude\worktrees\agent-*` ones for merged branches
(`look/mine-site`, `chore/docs-sweep`, `look/badwater-blend`). Never delete an investigation worktree someone else owns
(`investigation/probe`, `terrain3d`, `cycles-exact`, `workshop`).

## 3. M9a in detail

**Spec:** `ROADMAP.md`, "M9. …", the block "Design version 2 is approved" and "M9a: terrain and water from processes";
`docs/m9-design.md` (§18 the staging); PLAN §20 D209–D211; the prototype in `investigation/generative/v2/` (port it; `src/`
must never import `investigation/`). Progress log: `docs/progress/m9a.md` (its top says what's WIP).

**Last pushed commit: 12beeb3** ("WIP: settings move their targets again on the M9a generator (heavy-tests still red)"), on
`feature/m9a`, PR #56 (draft). No M9a processes are left running.

**Done** (per its reports): the generator from design version 2's processes (genome and "Any", field, hydrology, settler,
badwater hollows, features read back, nothing stamped); "Any" (Surprise me) as the app default with a Verticality slider
(above 16 unlocked, D172); no ruler-straight rivers (a blocking straightness measure against real terrain and the official
maps, reported by the batch tool); project format 3 (runs + a stored field); `water.storage_possible` as information (#67)
and `terrain.dam_wall` in both validators; A1 and A2; generator 0.7.0; the natural narrows as an internal operation for M12
(#63); badwater merged in from #54 (D200, D213); seas' outlets sized to their flow (Islands 256² from ~67 s to ~15 s a map);
M12 tool entries (generate, landmarks, reach, placeNarrows); first batches 100% final (128², 20 seeds, all seven options).
Its probe group is prepared: `investigation/probe` catalogue group `M9a`, 15 maps, about 93 minutes
(`npm --prefix investigation/probe run batch -- --job-only --group M9a` previews it).

**Left** (its own estimates, machine time, one at a time):
1. **Settings and reshape tests green, 2–3 h.** Already passing at 12beeb3: Relief, Buildable land, Rivers (exact count),
   River style Straight and Braided, Lakes, Badwater distance, the no-badwater start rule, Water without stairs,
   Verticality (its experiment runs 10 → 90); Designed for's experiment moved to badwater distance under the stale-test rule
   (logged). Still failing on CI's seeds 1–4 at 96²: Drought reserve (1189 → 624, needs +200; passed on 8 seeds), Badwater
   off → high (0.55, needs 0.6), Berries near start (+28, needs +30), Designed for's new target (+6.5, needs +10); and two
   reshape tests (Lake Basin seed 13 leaves an object floating; River Valley seed 13's lake over a relic no longer plans).
   Then apply D211: Theme's Lake Basin water share becomes information until M9b; Start area becomes a preference ("prefer a
   roomy / tight start"), the map card shows the actual bench size, and its experiment becomes information.
2. **Re-seed the quick tests, 1–1.5 h:** `badwater.test` (Any seed 21's badwater is 10.5 tiles from the start, target 15),
   `objects.test` (the second-district and rise seeds), `validate.test` (`water.badwater_contained`), and re-pin
   `LIVE_SHA` in `look-mine-ruins.test`. CI is red until 1 and 2 are done; neither WIP push has been through CI yet (the last
   run, on eaa77a1, was green apart from heavy-tests).
3. **Full batches, 3–4 h:** six themes plus "Any" at 96², 128², 192² and 256², ≥ 98% final each (blocking), with the
   straightness stats.
4. **Contact sheet and "Any" measures, ~1 h:** `docs/sheets/m9a.png` (D144, with "Any").
5. **Claude suite re-tune, 4–6 h:** back to at least 103 of 120 (it was 81 after the maps changed). Re-tune fixtures or
   re-express character requests as steering (D139, D187); never weaken a pass criterion; P01, F05, M02 and Z05 may recover
   once Live editing merges (its export profile skips `water.source_in_flow` for hand-placed sources, D184).
6. **Docs, browser tests, final CI, 2–3 h:** the e2e determinism timeout and the Islands 256² preview timeout.
7. **The probe batch** from the frozen generator (rebuild its maps first), about 1½ hours in the game, **only after Kyler's
   yes in chat** (§7). Then tag `m9a-done` and release (§8).

**Next concrete step:** in `C:\Users\Kyler\code\DamGoodMaps-m9a`, run `npx tsx .scratch/settings-run.ts "" 1-4 96` (the last
results are in `.scratch/settings-ci.txt`); give Drought reserve `minSeeds: 8` or a stronger lean; find why the Badwater and
Berries experiments dropped; look at Designed for's seed 2 (its hard map keeps badwater 63 tiles off).

**M9a gotchas:** its helper scripts are in its `.scratch/` (`settings-run.ts` runs settings experiments by name, seed range
and size; `one.ts` and `one2.ts` generate one map and print its checks; `sealevel.ts` traces a sea's level; `thumb.ts` prints
a coarse map; `run-batches.sh` runs batches with `SIZES` and `SEEDS`); batch results are in `.scratch/batch/`; the last CI
heavy-test failure log is `.scratch/heavy-fail.log`. The settler now weighs the settings in the intentions' preference and
picks among starts within 70% of the best score, so seed-specific tests move. A background run started as
`cmd > file; cat file` shows nothing until it ends: read the file itself.

## 4. Live editing in detail

Spec: `EDITOR_PLAN.md` Part 1 (the vision), `ROADMAP.md` "Live editing", PLAN §20 D158, D179–D207, D212. Progress log:
`docs/progress/live-editing.md`. The preview at <https://timbermods.github.io/dam-good-maps/preview/> shows push 4
(59f826c): the top bar and brush kit, Flatten (D204), the left shelf with ghosts, Remove, the view buttons and the game's
layers (D207), the header with Save to Timberborn and the quiet dot, the minimap and camera bookmarks.

**Before `live-editing-done`** (D212): (1) sources move from the top bar to the left shelf as two items right after Start,
"Water source" and "Badwater source"; selecting a placed source still shows its strength; (2) clear water only under or
right around the brush, only while it's over tiles that already have water; on dry land the water stays normal; clear
water still reads as water (a faint blue tint, ripples, a soft bright shoreline, not pale grey glass); T toggles it for the
whole map. Defaults confirmed: R/F zoom gone, juice sounds on but quiet with an off switch, layers on Alt+middle-click and
Alt+click. Then Kyler's look, then the release (§8).

**The forces (D216), after the release boundary:** merge #47, #51 and #50 into `dev`; build Carve, Craterize and Erupt on
one shared forces core, a visually distinct group on the top bar, each options row starting with its mode switch. Carve keeps
its full set (D199, including Codex's varied bends and oxbow lakes; an unfed oxbow evaporating is correct game physics).
Erupt's plume billows bigger and darker at high power. Quake's slot stays hidden. The Carve port had started (WIP, see the
commit below).

**The Carve port, WIP at b4d7c27** (pushed, marked WIP, CI not yet seen green; 59f826c is the last green commit and is on
the preview). Its note is at the top of `docs/progress/live-editing.md`.
- **Done:** the shared forces core (`src/core/forces/`: `force.ts`, `drainage.ts`); Carve's run ported from #47 (`carve/`:
  `character.ts`, `course.ts`, `oxbow.ts`, `run.ts`, checked step for step against the prototype with
  `.scratch/carve-equiv.ts`); the `carve` operation (stored literally, one undo step, Try another path via `replaces`);
  the worker's `carveStart/Advance/Stop/Cancel/Again`; the page (the Carve button next to Source on key 7, `CarveRow.tsx`
  with the mode switch first, `carveDriver.ts` paced by the water speed, Pause/Stop/Revert, the surge effects in
  `render3d/effects.ts`, the follow camera); Claude's `carve` step with requests B19–B21 (3/3 pass); tests
  (`tests/contract/carve.test.ts`, `tests/unit/carveDriver.test.ts`, `tests/e2e/carve.spec.ts`).
- **Important:** its merge of #47 (e5435b0) came **before** Codex pushed the two touches. #47 is now at **6b9d4e6** ("varied
  bends and oxbow lakes"). So: `git merge --no-ff origin/investigation/carve`, re-port `character.ts`, `course.ts`,
  `oxbow.ts` and `run.ts` (keep `liveWater()` and the stored `model`), re-run `.scratch/carve-equiv.ts`, add #47's tests for
  the touches (about 2–3 h).
- **Left:** check CI on b4d7c27 (`gh run list --branch feature/live-editing`) and fix any fallout (1–2 h); the full quick
  and e2e suites; EDITOR_PLAN §5's Carve bullet and the progress log (the `brushKit.spec` change under D148, the carve keys 7,
  Space, Esc/Ctrl+Z) (1 h); the full Claude reference re-run (125/138 before; 13 fail on `dev` too) (0.5 h); then the D212
  changes, Kyler's look on the preview, and the release. Craterize (#51) and Erupt (#50) then plug into the same forces core.
- **Gotchas:** e2e example `DGM_E2E_PORT=4791 npx playwright test tests/e2e/carve.spec.ts --workers=1`;
  `.scratch/pw-gpu.config.ts` (real GPU, effects on) and `.scratch/pw-soft.config.ts` (SwiftShader, effects off); e2e clicks
  must land on the canvas (with Aim picked the options row wraps over the map; `carve.spec` checks `elementFromPoint`); the
  Claude harness's `@anthropic-ai/sdk` typecheck errors are older and harmless (the SDK isn't installed).

## 5. Merged, released, held and waiting

- **Live on `main`:** M1–M8, Map look, Real places (first round), contaminated ground, mine sites and ruins, the start and edge
  rules, Save to Timberborn, the badwater blend (tags `m8-done` … `look-badwater-done`).
- **Merged into `dev`, not yet released:** resources like the official maps (#43, generator 0.6.2), Pick a place's
  signature water (#45), Map look 2's investigation (#38), the docs sweep and retired-terms guard (#46), design version 2
  (#32). They ship with the next release.
- **Held:** #54 (goes in with M9a, D213); #52 Quake (Codex's Slide round); #47, #51, #50 wait only for the next boundary.
- **Waiting on Kyler:** his picks of places to drop (§6); his look at each release candidate; #66.

## 6. Open questions and running tasks

- **Real places (#35):** Kyler sends the places to drop from `C:\dgm-workshop\places\sheet.html` (local). Apply D214 first:
  no sources at 8× the official strength (25 maps had them); keep strengths near the official range and move the start
  closer to water instead (as Pick a place's designed water does); drop any place that still can't work; replace the eleven
  "Centre" suffixes (and "Mahabaleshwar East, Western Ghats") with a real feature or direction ("North Rim", "Upper Valley").
  Then the badwater stage (`planMapResources` with `badwater`), once M9a is on `dev`; re-render and `npm run places -- --check`.
- **Waterfalls (#53):** D215: remove the V-shaped gap (one continuous sheet at L-shaped lips), more whitewater and splash at
  the landing; then release without another review unless it looks off. Known, older issue: where a Blockage raises the
  water floor, the 3D view draws water at ground level (a phantom small fall).
- **Codex's Quake Slide round** on `investigation/quake` (#52): hold #52. When Kyler says it's ready, merge it at the next
  boundary and build the Quake button on the forces core; if Slide can't be made dramatic, Quake becomes Lift only (D216).
- **Pending decisions:** `docs/decisions-pending.md` (#66, the candidate intentions: Kyler, later). All others are decided.
- **Held Dependabot majors:** #24 (TypeScript 7.0), #25 (@types/node 26), for the refinement phase (D150).

## 7. How things are run here

- **Pings** (when something waits on Kyler, and he isn't asleep): run
  `& "C:\Users\Kyler\code\DamGoodMaps\.scratch\notify.ps1" -Title "Dam Good Maps: <THING> IS READY FOR REVIEW" -Body "<where>"`
  in PowerShell, and start the chat message with an unmissable line such as "🔔🔔 … IS READY FOR YOUR REVIEW 🔔🔔". When he
  says he's going to bed: no pings, park decisions, and leave a morning summary at the top of `docs/STATUS.md`.
- **Tests:** `npm run typecheck`, `npm run test:quick` (CI's PR checks), `npm run test:heavy` (nightly), `npx playwright test`
  (the installed Chrome, channel "chrome"; never `npx playwright install`; give each e2e run its own free port),
  `npm run oracle` (the Python validator, 0 disagreements), `npm run batch` (`tools/batch.ts`, ≥ 98% final blocks),
  `npm run places -- --check`, `npx tsx investigation/claude/bin/reference.ts` (the Claude suite, D134).
- **The preview:** `gh workflow run deploy.yml --ref main -f preview_ref=feature/live-editing`, then check
  <https://timbermods.github.io/dam-good-maps/preview/> (noindex). A normal deploy of `main` drops `/preview/`, so republish
  it after every release.
- **Releases** (CLAUDE.md, "Deploying"): tag a green `dev` commit (annotated tags; names in CLAUDE.md), push the tag and a
  `release/<name>` branch at it, open a PR into `main`, wait for its checks, merge **as a merge commit**, watch the push deploy
  (build, deploy, `live-check / live`), republish the preview, record it in `docs/STATUS.md` and the progress log.
  `.scratch/release-badwater.sh` is a worked example. If the live check fails, revert the release merge on `main`.
- **Investigation PRs** (Codex's and others): merge at the next boundary as a merge commit once green, adopt their
  INTEGRATION.md as proposals; anything that conflicts with a decision becomes a pending decision with a default. Hold any PR
  Kyler says Codex is still working on.
- **DGM Probe** (`investigation/probe`): the only way Claude may launch Timberborn, and **only after Kyler's yes in chat for
  that batch, every time** (CLAUDE.md, D117). Ask in one message: how many maps, which checks, how long, and that it launches
  Timberborn. Steam running, Timberborn closed, the machine quiet (the runner waits for it). Kyler plays with his installed
  mods (`--keep-mods`). Make a settings backup first (`--backup-settings`); pass it as `--reference <backup .reg>`. Running
  without `--confirmed-launch` prints the plan and a one-time code; after Kyler's yes, rerun with `--confirmed-launch <code>`.
  Results go to `C:\dgm-probe\` (never Documents). The runner restores his settings, logs and player data, moves anything the
  games created out of `Documents\Timberborn`, and stops with exit code 6 if anything new is left (`leftovers.json`). Example:
  `npm --prefix investigation/probe run batch -- --only <ids> --keep-mods --run-id <id> --confirmed-launch <code> --reference C:/dgm-probe/settings-backup/<stamp>/Timberborn-settings.reg`.
- **Decisions:** Kyler's decisions go into `PLAN.md` §20 (the next is D218), and into the living docs in the same change
  (D188: EDITOR_PLAN, PLAN, ROADMAP, CLAUDE.md, STATUS). The next pending number is #69.
- **Agent definitions** for D210 are in `.claude/agents/`: `m9a-build` (Opus 5.5, xhigh), `m9-build` (Opus 5.5, high),
  `routine` (Sonnet 5, medium). A session only loads them at its start.

## 8. This machine, and lessons from the last session

- Windows with Git Bash: use `MSYS_NO_PATHCONV=1` where paths get mangled; the Store Python can't read
  `%LOCALAPPDATA%\Temp`, so helper scripts live in `.scratch/`; bash heredocs with apostrophes break the tool wrapper, so
  write scripts to files; foreground `sleep` chains are blocked (use background commands or until-loops).
- Off-limits: Kyler's `Documents` folder (it holds secrets; never read it); his saves, settings and mods except through the
  probe runner; `C:\dgm-reference\` (his in-game screenshots: look, never copy, crop or commit); `C:\dgm-workshop\` (other
  creators' maps and local review pages: never commit); the decompiled game code in `investigation/decompiled/` and the
  official maps in `investigation/raw/` (gitignored; for answers only, never copied).
- **Shared machine:** agents stop only processes whose command line names their own worktree (one cleanup once killed another
  agent's batches); every e2e run needs its own free port (Playwright's `reuseExistingServer` silently tested another agent's
  build once). M9a first (D210).
- **Subagents:** if Kyler stops one, it can't be resumed: start a new one in the same worktree and tell it the exact state
  (running processes, last commit, what's left). Some hand back before their CI finishes; check the PR yourself.
- **Merges between steps that change generated maps** conflict on the generator version and the pinned seed-4242 sha
  (`tests/contract/look-mine-ruins.test.ts`); re-pin per D148 and bump the version (0.7.0 is M9a's).
- **The Claude suite** drifts whenever the generator changes; re-tune in the step that moves the maps (D134).
- **Repository size** (D195): investigations commit reports, code, small samples and a few captures; bulk results stay in a
  gitignored `local/` folder or a GitHub Release. #45 added about 98 MB before the rule; history isn't rewritten.
- **Retired terms** (`tools/retired-terms.json`, D188): CI fails if a retired name or retired interface text reappears in the
  living docs or `src/`; `pendingRemoval` is empty now.
- **The review rule:** no blind reviews; Kyler judges visual work from before/after captures (with greyscale and
  colour-blindness sheets). Only breakage, his decided principles and what a player feels block (D115, D145).
- **Where to look:** `docs/STATUS.md` (the current state and the morning summary), `docs/progress/` (one log per step),
  `docs/README.md` (which docs are living), `docs/CHAT-HANDOFF.md` (how Kyler's planning chat works).
