# Adoption proposal for Live editing

Nothing here changes the production editor, generator, operation schema or
project format. Keep the following as proposals until the prototype is accepted.

## Operation and history

Adopt a versioned result operation, such as the prototype's carveResult v1.
Its inputs are diagnostic: wall mode, layer setting, source strength, step count
and stop reason. Its authoritative output is sorted [tile, before, after]
whole-level terrain triples, the before/after entity state, and exact water
depth/contamination snapshots. Canonical convergence and tick count are retained.

The demo keeps each source placement separate and each carving run as one
operation. During a run, live patches are transient. Stop and auto-stop both
finish the canonical solve and then append one result. Undo and redo assign
stored values; neither dispatches erosion. A downloaded run includes its base
map, making replay independent of the selected map and of later algorithm changes.
The worker tests replay the portable bundle after loading a different map.

For production, replace full entity lists with ID-keyed insert/remove/update
patches, including removed vegetation's complete payload and its original
ordering. Keep immutable payloads so undo can reuse records. This prototype
already freezes stored entity records and copies their array on application.
Store water as binary Float64 arrays in the project archive rather than large
JSON number arrays. Rebuild moisture from stored water off-thread, or cache it
in the operation when instant overlay restoration matters.

Validate version, dimensions, sorted unique indices, whole-height bounds,
expected old values, entity identity and finite water values. Add the production
schema and migration together. Preserve existing cave/overhang columns and
lock them to carving until the 3D terrain work defines editable runs. The demo
accepts heightfields only. Never regenerate a result on project load.

## Worker and responsiveness

Keep CarveRun pure: one step has fixed work and no clock, random call or frame
rate input. A displayed second is ten steps. Speed changes only the rate at
which steps are requested. Duration/Stop stores the number actually acknowledged.
This resolves the otherwise ambiguous meaning of “same duration” on different PCs.

The demo permits one outstanding step. Pause withholds requests. Stop waits for
that step and commits exactly that prefix. Geometry is built in the worker,
one 32-square chunk between event-loop yields, and transferred. The page uploads
at most two chunks and targets a 3 ms upload budget per frame. It never invokes
terrain meshing, erosion, generation or water settling on the UI thread.

A water tick and an erosion step remain indivisible CPU work; they are not
guaranteed to complete in 3 ms. The budget applies to uploads, not to GPU time.
Generated 256-square maps can take tens of seconds to load in the worker.
Report observed CPU numbers from captures/checks.json; do not substitute those
for rendered fps or painting latency. The demo includes fps and p95 frame time.
Its geometry is shared with the clean renderer; its lighting is deliberately
simpler and does not reproduce all soil/shadow shaders.

For production, give all messages document revision and run ID. Reject stale
patches after a newer brush edit; restart or stop carving explicitly around that
edit. This standalone serial demo disables conflicting edits during a run.
Do not graft its “busy” flag onto painting. Keep brush overlays and picking
immediate, queue water work, and update entity instances by per-tile index.
Cache the pre-run and post-run render chunks for an immediate visual undo;
the prototype's exact data undo is followed by bounded asynchronous remeshing.

Keep water solving and meshing interruptible between slices. canonicalRun
advance(4) is already slice invariant. Preserve its settled=false result when
the cap is hit and expose that status quietly. Do not claim convergence or
export a warm preview as canonical.

## M9 reuse now

Direct imports from dev:

- generative/proto/erode.ts: deterministic priority flood / basin spill levels.
- core/sim: WaterSim, waterModel, canonicalRun and the repo's source/obstacle rules.
- render3d: chunk meshers, waterfall curtains, object models and clean palette.
- generative/proto/generate.ts: actual demo seeds.
- core/places/place.ts: existing Real places decoding and entities.

Aligned with M9 v2 read-only at c77026b271519290ab6dd9b4a9c29890e822fd2f:

- field.ts erodeHard: sqrt(flow/area), linear slope, 0.85 incision resistance
  and 0.8 diffusion/weathering resistance.
- weather: high soft ground retreats toward lower neighbours; hardness delays it.
- levels.ts: integral surfaces, coherent benches, no isolated pits or spikes.
- hydro.ts: drainage decides routes; falls, hanging valleys, pools and retreating
  knickpoints arise from drops.
- terrain.ts: format 3 columns/runs must survive future adoption.

The live editor deliberately does not call v2's complete uplift, erosion,
weathering or level-normalization pipeline on a player's map. That would
reshape untouched ground and could reverse visible edits. Fractional work,
source-local activation, sediment, sign locks and stored result patches are new.

## Once PR 32 merges

This branch must stay based on dev; do not merge the investigation just to gain
its modules. After the design lands and M9a promotes the actual processes:

1. Move drainage, hardness and local weathering coefficients into a shared
   core erosion module. Replace the investigation import with that stable API.
2. Replace fixed horizontal beds with a shared geology field. Persist a compact
   layer stack (top/bottom levels, hardness, optional deterministic regional
   tilt/patch field) as generation metadata. Query hardness at the current
   cut level, so an exposed soft bed or hard lip agrees in both modes.
3. Feed that geology into v2 erodeHard and weather. Its current caprock field
   is a 2D upper-stratum mask; the proposal extends it through elevation, rather
   than assigning unrelated geology when the editor opens.
4. Generate the same benchmark maps through the promoted v2 generator and
   repeat captures and CPU checks. Do not promise identical maps to v1.
5. Keep v2's offline elevation rescaling/bench phase offline. The live process
   must never re-normalize the edited map or override a locked tile direction.
6. Retain all saved v1 result operations as literal patches; no erosion-code
   migration is required for them.

## Acceptance and boundaries

Try 128 and 256 maps on the user's PC while orbiting, zooming and using the real
editor's brushes after integration. Check pause/stop latency, memory, upload
time, fps/p95, long-run valley shape, source near a start, multiple sources,
existing badwater, and final canonical parity. Captures demonstrate trends;
they are not a substitute for that acceptance.

The no-reversal rule prevents normal sediment re-entrainment and oxbow cutoffs
inside a run. A later run may choose another direction. The model produces
slow-water shelves/delta platforms but is not a calibrated floodplain model.
Retain these limits in product wording until improved.

Glacier style is deferred. A future model should carry an ice-flux field and
erode a broad sliding bed, with cirque headwall retreat and sea-level troughs.
Simply increasing river width would not demonstrate a glacial process.
