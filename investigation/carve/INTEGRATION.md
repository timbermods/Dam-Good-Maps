# Live editing adoption proposal

This investigation changes no production editor, generator, schema or format.

## Transaction and exact history

Adopt carveResult v1 as a stored-result operation. Diagnostic inputs are mode,
origin/end tile, Power, Defy gravity, walls, dry/keep river, layer setting,
acknowledged step count and end reason. Authoritative output is:

- sorted [tile, before, after] whole-level terrain triples;
- complete before/after entity payloads, including the new source and objects removed;
- exact before/after Float64 water depth and contamination;
- canonical convergence flag and tick count.

Source creation belongs to the carve itself. Starting a run captures the base
before adding water. Stop retains its acknowledged prefix, then canonicalRun
settles it and one operation commits. Automatic completion does the same.
Esc or Undo restores the base and discards the transaction. Cancellation is
still available during the final solve. The demo worker uses an epoch checked
between slices, so stale chunks cannot reappear after cancellation.

Replay only assigns stored data. It never calls carving, RNG, geology or water.
Existing v1 result files continue to replay even with obsolete diagnostic settings.
The portable demo file includes its base map. In production use ID-keyed
entity patches with original ordering, binary terrain/water arrays in the
project archive, and a document/run revision on every message. Validate entity
identity and project schema at import; the demo's local file validation is
deliberately narrower than a production archive reader.

Cache the pre-run and final render chunks alongside data. The demo keeps the
latest pair so active cancel and the latest undo/redo restore visibly in one
frame; older history can remesh from its exact data. Production should retain
or page the needed chunk versions for its full undo policy. Derived soil,
checks and overlays should share those revisions.

## Force, water and consequences

CarveRun is an intentional fluvial force, not an extension of the game's
non-eroding water. Unleash combines inertia, downhill look-ahead and resistance.
Aim adds destination guidance with coherent lateral acceleration. Power sets
channel radius, depth, penetration, work rate and finite travel budget. Low
force may run out or turn away; high force opens a route through ridges.
Defy gravity lowers the path ahead to a non-increasing grade.

The front reveals whole-level cuts, then the trailing bank targets mature into
steep walls or wider terraces. Horizontal hard layers delay work and make
benches. Proposal rejection prevents new isolated one-tile extrema. Fixed tile
signs prevent oscillating cut/fill. Debris accumulates at the moving front and
builds a coherent receiving fan/delta outside its open central channel.

The live force ribbon is a visual preview. Existing water also advances in
WaterSim as terrain changes, so drainage is visible. Completion always replaces
the preview with canonicalRun from terrain and real sources. Preserve and show
settled=false if its existing limit is hit. A retained source may fill a closed
endpoint basin into a lake. Never fake a permanently downhill water surface.
Power maps to a real source strength from 0.5 to the repo's maximum 8.
Dry canyon adds no source; existing water sources remain unless carved away.

Protect only the start's footprint plus support margin. Remove other objects
when any supporting footprint tile changes. The demo reuses checkStartAt and
walkRegions for immediate resource status and start reach, using Normal
difficulty thresholds because standalone map inputs have no live project rules.
Production must pass the document's actual rules and complete validator report.
Failures are visible consequences, never carve vetoes. The live status is a
preview until canonical water and soil are ready.

## Worker and rendering

One outstanding model step; pause withholds requests and speed changes their
presentation rate. Ten acknowledged steps mean one carve second on every PC.
Stop stores the acknowledged count. The front may receive 50% extra display
time at breakthroughs/falls when Follow is on; this changes no model state.

The worker builds one 32² chunk between yields; canonical water advances two
ticks between yields. Checks, moisture, sky and shadow baking run off-thread
with yields between stages. These stages and a model step are indivisible;
measure them at 256² rather than treating the upload budget as a hard deadline.
The main thread uploads at most two chunks with a 3 ms scheduling target.
Use captures/checks.json for CPU evidence, never as rendered frame-rate evidence.

The demo directly uses the editor's clean terrainMaterial, waterMaterial,
objectMaterial, drawPatterns, tileData, shadowMap, meshers and entity models.
A fixed pool of 96 whitewater instances and 48 debris/dust instances accompanies
a short muddy ribbon. Reduced-motion settings turn off the effects, water
animation, follow camera and dramatic timing. No model decisions depend on VFX.

For Live editing, retain immediate camera, cursor and brush previews. Put
painting ahead of water work; resolve terrain conflicts by document/run
revision instead of copying the standalone demo's busy/disabled controls.
Index entities and dirty geometry by footprint/chunk. Validate painting
responsiveness, memory and 256² FPS on the user's hardware after integration.

## M9 alignment and PR #32

Read-only source: investigation/generative-v2 at
c77026b271519290ab6dd9b4a9c29890e822fd2f. V2 files live under
investigation/generative/v2/, not an investigation/generative-v2 directory.
No commits from that branch were merged or cherry-picked.

The new force aligns with v2 field.ts resistance: incision is multiplied by
(1 - 0.85 * hardness), bank retreat by (1 - 0.8 * hardness). Its whole-level
benches and rejection of isolated extrema align with levels.ts. Falls and
knickpoints align with hydro.ts's landform goals. Its driven front, grade,
debris budget, sign locks and transaction lifecycle are new. It does not claim
to reuse v2's complete implicit stream-power solver or uplift/weather pipeline.

Direct reuse from dev: M9's generateProto for seeds; places decoding; waterModel,
WaterSim and canonicalRun; clean rendering; editor start checks and walking.
The former passive model's direct drainage import has been removed; the final
water solve already contains the repo's deterministic priority flood.

After PR #32 merges and those processes are promoted:

1. Extract a shared geology query and resistance constants into core. Persist
   the generator's layer stack as map metadata so carving exposes the same rock.
2. Feed level-dependent geology into v2 erodeHard and weather. Its current
   caprock mask is two-dimensional; extend it through elevation for common
   hard lips, canyon benches and tilted regional beds.
3. Use the promoted M9 generator for the same capture seeds and rerun outcomes;
   do not promise identical v1/v2 maps.
4. Keep offline elevation rescaling and bidirectional cleanup out of live runs.
   Preserve v2 format-3 columns/caves until a voxel-aware carve can edit them;
   today's prototype accepts heightfields only.
5. Keep all stored result operations literal. Merging M9 requires no historical
   erosion replay or migration of already-carved terrain.

These are proposals only. Hardware visual acceptance and real editor painting
are still required before adopting the worker and rendering schedule.
