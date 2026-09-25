# CLAUDE.md

Dam Good Maps: a map generator for Timberborn. The README says what the repository holds.

## Standing rules

- Never launch or drive Timberborn, and never touch installed mods or saves. The maintainer (Kyler) tests in game
  himself.

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
- Two steps outside the milestones are released the same way:
  - the design pass (after M11 and the refinement phase, before M12) is tagged `design-done` once Kyler has
    approved and merged it on `dev`;
  - Map look (after M8, before M9) is tagged `map-look-done`, or ships inside the M9 release.
- When dev changes `deploy.yml`, keep its noindex step.
- Tokens and secrets are Kyler's to create and store with `gh secret set`. Never ask Kyler to paste one into chat.
- Kyler has said Claude may merge tagged releases into `main` and manage the Pages setting.
