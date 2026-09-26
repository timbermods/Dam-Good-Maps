# CLAUDE.md

Dam Good Maps: a map generator for Timberborn. The README says what the repository holds.

## Standing rules

- Claude never launches or drives Timberborn, with one exception: the DGM Probe runner may launch it for an
  automated probe batch, but only after asking Kyler explicitly and getting Kyler's yes in chat, every time (PLAN
  §20, D117).
  - Before each batch, ask in one message: how many maps, which checks, roughly how long it will take, and that it
    will launch Timberborn. Wait for the yes. Never treat an earlier yes as covering a new batch.
  - Once Kyler says yes, the batch runs unattended to the end.
  - Never while Timberborn is already running; never touching Kyler's saves, settings or other mods (probe games
    never autosave into Kyler's folders, and any file they create is removed afterwards); and only when no other
    heavy work is running on this machine.
  - While waiting for the yes, carry on with any work that doesn't need the batch.
- Never touch installed mods or saves otherwise. The maintainer (Kyler) tests in game himself.
- At every milestone or step that changes generated maps, commit one small contact-sheet image to
  `docs/sheets/<step>.png`: seeds 1–30 of every built theme at 128², top-down, each labelled with its seed and
  theme; our own generated maps only; under 1 MB (PLAN §20, D144). Design version 2's prototypes get one too.
- When a test still passes but no longer checks what its name says, because a decision of Kyler's changed the
  thing it tested, update it to check the current decision, rename it if needed, and note it in the progress
  log. No need to ask first. Never weaken a test to make it pass.
- Dependency updates: merge GitHub Actions updates and minor or patch npm updates when CI is green (CI's byte
  checks catch anything that changes a map). Hold major upgrades (TypeScript 7.0, @types/node 26, and any future
  major) for a deliberate upgrade step at a quiet time, such as the refinement phase, with the full nightly suite;
  never mid-milestone. Dependabot groups its updates into one weekly pull request per ecosystem.

## Writing README and website text

Kyler, 2026-09-24: "simplicity and elegance is effective and desirable." Every change to the README, the website
text and the player docs follows these rules. Plans, audits and design documents are working documents, not player
text.

- **Write for a Timberborn player** who wants to make and play a map. Developer detail goes in the plans or a
  developer doc; link to it rather than repeating it.
- **Short.** One idea per sentence, most under about 20 words. A paragraph or FAQ answer is one to three sentences,
  a troubleshooting answer a few numbered steps.
- **Lead with the action.** Paths and steps as arrow chains; on-screen labels in bold, exactly as they appear.
- **Say each thing once**, where a player would look for it; link to it elsewhere.
- **Plain words.** No internals (class names, ids, formats) unless the player needs them to act.
- **Cut** filler, repeated caveats, edge cases a player won't meet, and history ("since …", "no longer", older
  builds). Describe the tool as it is now.
- **Check every fact against the code** before writing it; plans and changelogs lag.
- **Keep, briefly:** credits, the unofficial line, the status, and safety facts.
- **Reread as a new player before publishing.** Every step works as written, and nothing is said twice.

## Deploying

- Work happens on `dev`. The site is GitHub Pages, deployed from `main`: https://timbermods.github.io/dam-good-maps/
- A release merges a tag into `main`, never dev's tip, and always as a merge commit. After a milestone is tagged
  `mN-done` and its full check passed, merge that tag into `main` through a PR.
- After every deploy, the live check (`.github/workflows/live-check.yml`) must pass. It runs after each deploy and
  daily; `gh workflow run live-check.yml --ref main` runs it by hand. If it fails, revert the release merge on
  `main`, confirm the old site is back, and report.
- The site stays noindex and unannounced until launch. Launch needs versioned deploys (M13) and Kyler's go-ahead;
  then set the repository variable `DGM_PUBLIC` to `true`.
- Steps outside the milestones are released the same way:
  - the design pass (after M11 and the refinement phase, before M12) is tagged `design-done` once Kyler has
    approved and merged it on `dev`;
  - Map look (after M8, before M9) is tagged `map-look-done` once Kyler approves the look, or ships inside the M9
    release;
  - Real places (right after Map look) is tagged `real-places-done`;
  - Live editing is tagged `live-editing-done` once Kyler says it feels right; its preview is built from its
    branch into `/preview/` (noindex) by the deploy workflow;
  - Save to Timberborn is tagged `save-to-timberborn-done`, and Pick a place `pick-a-place-done`;
  - the start and edge rules are tagged `start-edge-rules-done`; the Real places second round
    `real-places-2-done`; contaminated ground as a layer `look-contamination-done`, once Kyler approves it;
  - Map look 2 (after the Map quality checkpoint, before the Frame pass) is tagged `map-look-2-done`;
  - the Frame pass (after Map look 2, before the 3D stages) is tagged `frame-pass-done`;
  - the 3D terrain stages (after the Frame pass, before M10) are tagged `3d-a-done`, `3d-b-done` and `3d-c-done`;
  - the Weather view (after the 3D stages, before M10) is tagged `weather-view-done`.
- When dev changes `deploy.yml`, keep its noindex step.
- The deploy workflow can publish a branch at `/preview/` (noindex): run it by hand with `preview_ref=<branch>`
  (Live editing's preview, refreshed after every iteration). Small changes to the deploy workflow itself are
  released as their own tag, like `preview-workflow-done`.
- Tokens and secrets are Kyler's to create and store with `gh secret set`. Never ask Kyler to paste one into chat.
- Kyler has said Claude may merge tagged releases into `main` and manage the Pages setting.
