# Erupt

A working standalone volcano tool, based on dev f770936. All changes stay in this directory.

```sh
npm --prefix investigation/erupt run demo
```

The command installs its own dependencies on first use and prints a free localhost port.
It uses three.js **0.186.0**, matching the repo. Choose a generated 128²/256² map, a study map,
or one of three Real places. Click for a vent; choose Fissure and draw a bent line for a ridge.
Esc cancels the complete event; Undo and Redo restore exact saved results. Right drag orbits.
The notes menu saves/replays runs; [this small run](samples/vent-32.json) exercises portable replay.

## What works

- Mode comes first, followed by Power, Shape, Summit, Flows/Ridges and Try another.
- Whole-level cones, broad shields, summit craters, large calderas and a fissure crater row.
  Heights stay in 0–22; layer 22 remains empty. Edge eruptions clip naturally.
- Immediate cracks and ash, eight rising terrain stages, live runoff, cooling, dead radial trees,
  optional follow/shake, and reduced motion. No audio is needed.
- Objects ride supporting terraces. Sources keep their settings and ride vertically too.
  The start's footprint and buffer stay fixed; vents or fissures through them are refused.
- Overlapping eruptions build on old flanks. New lava records hard occupied levels per tile.
  The reused Carve engine reads that hardness and cuts more slowly or bends around it.
- Erupt creates no water or sources. The final water is exactly the repo's canonical settled result.
- One operation stores terrain, lava, entities, fallen trees and exact water. Replay runs no simulation.

## Captures

These are short sequences from the actual clean 3D demo, using clearly labelled process-study maps.
They are illustrative setups; generated maps and Real places are also tested.

| Scene | Sequence |
|---|---|
| Steep vent, summit crater | ![Steep vent](captures/steep-crater.gif) |
| Broad shield | ![Broad shield](captures/broad-shield.gif) |
| Huge caldera | ![Caldera](captures/huge-caldera.gif) |
| Bent fissure across a valley | ![Fissure](captures/fissure-valley.gif) |
| Flows dam a river into a lake | ![River lake](captures/river-lake.gif) |
| Overlapping volcanic field | ![Volcanic field](captures/volcanic-field.gif) |
| Carve bends around lava | ![Carve and lava](captures/carve-lava.gif) |

[Larger caldera view](captures/hero.png). Settings and paths are in [scenarios.ts](scenarios.ts).
`npm --prefix investigation/erupt run captures` reproduces all seven; browser checks and captures need
Google Chrome. Bulk output, dependencies and build files are ignored.

## Evidence

`npm --prefix investigation/erupt test`, `run typecheck`, `run build` and `run browser` pass.
The tests cover 32 option combinations, fixed seeds, different personalities, bounds, edge clips,
overlap, start refusal, objects, exact JSON replay, real worker cancellation races and canonical water.

On this host in headless Chrome, the generated 256² event first changed terrain in **1.26 s**,
with **8.3 ms p95 frames**, **39.1 ms worst sampled frame**, and **0.5 ms cached-view undo**.
Full completion, including water settling, took **8.5 s**. The frame sample covers the last 600 frames;
these are host-specific measurements, not a hardware guarantee.

The river study's upstream depth rises **0.259 → 4.151 levels** with unchanged emitters.
Carve crosses **18** lava stations with hard rock enabled versus **37** on the identical terrain with
lava hardness removed. Near Yosemite (96²), Geirangerfjord (128²), and Grand Canyon (256²) all load.
Detailed results: [model](captures/checks.json), [worker](captures/worker-checks.json),
[water/rock](captures/water-rock-checks.json), [browser](captures/browser-checks.json).

## Choices and limits

This is a coherent terrain model, not a magma physics solver. Auto uses a peak below Power 32,
a crater below 80, then a caldera. Fissures keep a crater row even with Peak selected, using shallower vents.
Fissure drawing previews the line immediately; the eruption begins on release. New clicks get new recorded
seeds; Try another advances a deterministic seed from the original input land.

Live water retains existing volume on rising cells and runs the repo simulation between stages.
Canonical settling then replaces the preview; a large map can take several more seconds while Esc remains instant.
The demo runs one force session at a time. It has no .timber export, imported cave editing or production editor
integration. Rigid footprints get small supporting terraces. Existing sources survive even at a vent.
Final buildability and full editor validation belong to adoption, described in [INTEGRATION.md](INTEGRATION.md).

## Reuse and steps

1. Reused Craterize's sliced plan, map/operation shape and foundation; added volcanic anatomy and local lava.
2. Adapted its worker, cached view history, clean renderer, particle pools and demo shell. Quake informed
   curved paths and riding footprints. Carve at b14e23f supplies the actual geology comparison engine.
3. Added interaction checks, all seven captures, a portable sample, and the shared four-force proposal.

Production rendering, generation and water modules are imported directly. See [credits](ATTRIBUTION.md).
The task's directory-only rule takes precedence over general instructions to edit living docs or docs/sheets;
all investigation documentation and captures stay here. Nothing is deployed or merged.
