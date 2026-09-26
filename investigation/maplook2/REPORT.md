# Map look 2: water and shadows

Work starts from dev `692dd72`. Only this directory changes. This is an isolated prototype, not an application setting or a release.

Run from the repository root: `npm --prefix investigation/maplook2 run demo` (Node 22+, installs this folder's locked dependencies on first run). Open http://127.0.0.1:4197.

## Decisions

- Standard imports today's renderer and materials. A demo-only Vite transform disables automatic Light selection so software captures compare Standard with High. No source file is edited.
- High changes only water and sun shadows. Terrain patterns, soil/contamination, models, sky, grading and resolution remain the baseline. Existing contact darkening stays; no new AO pass.
- Three.js is pinned to the repository's 0.186.0. Dependencies belong to this directory.
- Generated maps use the repository generator in a worker; Real places use its library/build path; M9 files use its importer. No game assets or game captures are read or copied.
- The original checkout has unrelated edits. Work uses a separate worktree from dev and the explicitly authorized branch.

## Steps

1. Read CLAUDE.md, PLAN §20 (D114, D147, D154), the clean-look notes/captures and src/render3d. Set up the isolated runner.
2. Built the worker-backed map picker, synced comparison, separate effect toggles, actual frame counters and inspection readout. Added procedural absorption/Fresnel water and a 2048² depth shadow pass over the real terrain/object meshes. TypeScript and the build pass. Initial SwiftShader images exposed self-shadow stripes; receiver-plane PCF correction removed them. Full map/capture checks follow.
