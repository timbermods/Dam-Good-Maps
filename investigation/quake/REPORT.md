# Quake

A force that tears the land along a drawn fault. Prototype in progress.

## Decisions and progress

1. Based on dev `08039c5` (D203). An isolated checkout under `.work/` preserves unrelated local work. All authored changes and captures stay in `investigation/quake/`; living-document changes remain proposals under the explicit scope.
2. Read the editor vision, PLAN principles and decisions, FORMAT, and repository simulation. Read Carve source at `b14e23f` and Craterize's available local implementation based on `62a8b97`; Craterize was still being built, with no remote branch at the start of this task. No PR review was performed.
3. Reuse Carve's demo shell, chunk meshing, clean shaders, worker cancellation epochs, rendering cache and canonical settling. Reuse Craterize's frozen geology, fallen-object state and literal-result operation envelope. Quake adds fault geometry and block transport.
4. Power controls displacement and reach; length comes from the stroke. A click on either side starts movement. The selected side rises in Lift and moves along the stroke in Slide. The other side drops or slips oppositely. Natural tilt is part of the seed.
5. Water remains water: the event creates no emitter and introduces no prefill. Existing water rides the moving land and flows under WaterSim; final water is canonicalRun's exact result. Source-free ponds can therefore drain during canonical settlement, as in the repository.

6. Model milestone: deterministic sliced planning; whole-level Lift and Slide; stepped benches, coherent tilt and sag pockets; rigid object transport and start apron; no added water. Fourteen model checks pass, including two-fault rifts/ridges, exact JSON undo/replay, live lake spill and canonical waterfall water. A long lifted block now continues to the map edge: the first test exposed an artificial upstream dam when displacement faded too early, and that was fixed. 256² planning measured about 42 ms (Lift) / 117 ms (Slide) in Node, sliced by four rows in the worker.

7. Demo milestone: drag or click/Shift-click; choose a side directly on the land; live crack/dust/shaking with reduced-motion support; optional camera follow/shake; instant cached undo and exact replay; actual generated seeds and three Real places. Worker scheduling now mixes MessageChannel yields with periodic timer yields so Windows timer floors do not slow the rupture or starve cancellation. Browser measurement on this machine, 256² river study: first changed geometry 207 ms, full rupture 1.31 s. Actual worker checks pass.
