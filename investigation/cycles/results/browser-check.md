# Local viewer check

## Exact-model pass

The viewer was not reopened in a browser for this pass. Its code changed only in a few sentences of text, and its
data format is unchanged. `verify-data.ts` checks every regenerated viewer file: complete days, valid run-length
fields, frames matching the measured timelines, and dead plants that never revive.

## First pass

Checked in the Codex browser on 2026-09-25, at `http://127.0.0.1:4178/viewer/index.html`, with the first model's data.

- The page loads local compressed data and draws terrain, water, plants and the start.
- Drought selection offers Easy, Normal, Hard and the later Hard drought.
- The day slider changes the map, water volume, soil area and original plant counts.
- The continuous run reaches cycle 6 recovery at elapsed day 97. Play advances the day and stops at the end.
- The timeline's x-axis uses elapsed days, including recovery. Duplicate phase boundaries do not add slider days.
- The narrow layout stacks the controls and map without clipped text. The legend uses words and symbols as well as colour.
- No browser warnings or errors were reported during these interactions.

This checks the local prototype. Browser worker performance and integration with the app remain proposals.
