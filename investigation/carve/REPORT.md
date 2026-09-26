# Let the water carve

Prototype in progress. From the repository root:

    npm --prefix investigation/carve run demo

The launcher installs this folder's locked dependencies on first use. Node 22+.
Only this folder changes. The production editor and generator are untouched.

## Decisions

- Started from origin/dev at 5bc0e79, in an isolated checkout because the user's checkout contains staged work.
- Follow EDITOR_PLAN's source-first, direct-on-land interaction. No drawn rivers or landform tools.
- Reuse the repo's WaterSim and canonicalRun. Read M9's drainage, stream-power and whole-level cleanup.
- Read investigation/generative-v2 from its remote branch only; keep this branch based on dev.
- Whole-level changes use accumulated fractional work. A tile's first change locks its sign for that run.
  This deliberately limits natural channel recutting through new deposits, in exchange for no terrain flicker.
- Duration means an integer count of erosion steps (10 per displayed second), not CPU/wall time.
  Pause and display speed do not alter the mathematical sequence.
- Protect the start footprint and a supporting margin, and fixed non-plant objects. Remove plants when their ground changes.
- Keep all investigation docs and captures here, overriding CLAUDE's shared-doc/contact-sheet locations as requested.
- Final water means the repository's canonical result, including its explicit non-convergence flag at its four-day cap.
  Do not claim the game was launched or that an unconverged solve is settled.
- GPU frame rate is for the user's PC. CPU tests and software captures are not GPU performance evidence.

## Steps

1. Read contracts and isolate branch; scaffold local tooling.
2. Implement erosion, sediment, immutable direction, operation and worker.
3. Build source placement demo with generated and Real places maps.
4. Test invariants and scenarios, capture results, write adoption proposals.
5. Check path scope, push only investigation/carve, open one PR to dev; never merge.
