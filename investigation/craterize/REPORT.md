# Craterize

A separate impact tool. Work in progress; validation and captures follow.

## Decisions

- Based on dev `18a38d9` (D202). The outer checkout has unrelated untracked work, so this branch uses an isolated checkout under `.work/`.
- All authored files, dependencies, reports and captures stay here. Root living documents and contact sheets remain untouched under the explicit task scope; integration changes are proposals only.
- Carve source read at `investigation/carve` (`3594f9c`): reuse its worker epochs, integer results, exact operation snapshots, dirty chunks, clean shaders, fixed effects pools and horizontal hard layers. No PR review was performed.
- Power sets energy and default diameter. A manual diameter redistributes that energy into broad shallow or narrow deep impacts. Auto centre follows diameter.
- Geology stays fixed through successive impacts and personality changes. Try another replaces the last impact from its original ground; cancelling restores the kept version.
- Existing water continues from its stored depth through the repository WaterSim. No source or prefilling is introduced by an impact.
- Height limit is 22, with layer 22 empty. Start footprint and entrance margin remain untouched even when ejecta reaches them.

## Progress

1. Read the requested plans, format, simulation and Carve source. Created the isolated dev-based branch and standalone package.
2. Built the deterministic impact model and exact result format. Seventeen model checks pass. In the river study, ejecta raises the sill from level 5 to 9; unchanged sources raise upstream water from 0.26 to 2.52 levels after 768 simulation ticks.
3. Added the clean 3D demo, sliced worker, fixed effects pool, immediate view restoration, saved replay and browser checks. Ten worker lifecycle checks and eleven browser checks pass. The river study now includes an upstream floodplain; its 777 newly flooded tiles settle after 2,176 ticks. The earlier narrow-channel measurement above remains as the first model-step result.
