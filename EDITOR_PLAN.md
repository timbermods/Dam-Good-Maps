# Dam Good Maps: Map Editor and Claude Integration, Build Plan

This plan adds an in-browser map editor to Dam Good Maps, plus Claude-driven editing. It builds on the generator website described in `PLAN.md`. All of it lives in the **Dam Good Maps** repository in the **timbermods** GitHub organization, alongside `PLAN.md`, `FORMAT.md` and the investigation results.

**The goal: a web editor that is superior to Timberborn's in-game editor by being easier to use and simpler, while offering more creative power.** Players should be able to shape a great map in minutes without learning a complicated tool, and advanced users should find tools the in-game editor doesn't have. When simplicity and power conflict, simplicity wins by default and power moves into an advanced mode.

**The whole product in one line: generate → refine → play.**

1. **Generate.** The player picks settings and parameters and generates a map (covered by `PLAN.md`).
2. **Refine.** One click on "Refine this map" opens it in the editor, where the player reshapes it by hand and by asking Claude, e.g. "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" (covered by this plan).
3. **Play.** Export a validated `.timber` file, drop it into Timberborn's Maps folder, and play.

These steps must feel like one app, not separate tools. Moving between them never loses work: going back to the settings and regenerating keeps the player's own features and edits, and export is available from every screen. Judge every decision by how smoothly a player gets from settings to playing a map they're happy with.

## 0. Before writing any code

**Prerequisites.** The core site from `PLAN.md` works end to end: settings, generation, validation, preview and `.timber` download. The generator takes a documented JSON map spec, and validation runs as reusable modules. If either is missing, stop and tell me.

**This plan was written before the investigation ran.** An audit reconciles it with the findings and with `PLAN.md`, producing `AUDIT.md` and a merged `ROADMAP.md`. Where `ROADMAP.md` orders the work differently from section 10, follow `ROADMAP.md`. Section 11 defines what the generator must provide for the editor; both plans must honour it.

**Reconcile first.** Read `PLAN.md`, `FORMAT.md`, `investigation/REPORT.md` and `investigation/calibration.json`, plus the current codebase. Where this plan conflicts with the investigation's findings (footprints, slope rules, moisture reach, water behaviour, limits) or with the architecture as actually built, the findings and the built code win. Record every deviation and decision in a new "Editor decisions" section at the end of `PLAN.md` before starting milestone E1. Ask me about anything that changes the scope of a milestone.

**Working rules.**
- Build one milestone at a time. Each ends with its acceptance criteria met, tests passing, and a short summary of what changed.
- Stop at milestones marked **IN-GAME CHECK** and wait for my results before continuing.
- The editor must never be able to export a file that breaks the game. Playability problems warn; file-correctness problems block.
- Everything works without Claude. Claude features are an add-on.

## 1. Product principles

These guide every design decision. When a choice isn't covered elsewhere, decide by these, and note the decision in "Editor decisions."

1. **Edit features, not blocks.** The main way to edit is by working with things players think in: a river, a lake, a hill, a plateau, a canyon, a waterfall, a forest, a ruin field, the start. Each is an object with handles that can be moved, reshaped, resized or deleted at any time, like shapes in a drawing program. Block-level sculpting exists, but as a secondary tool.
2. **Valid by default.** Tools produce playable results without the user having to know the rules: rivers always flow downhill to an outlet, slopes get the right orientation automatically, the start clears its own footprint, forests grow only where they'll survive unless the user overrides it. When something does go wrong, the issue comes with a one-click fix ("move the start to the nearest valid spot," "open an outlet for this lake").
3. **See it before you commit.** Every tool previews its result live, including its effect on water, before the click that applies it.
4. **Nothing is scary.** Unlimited undo, a visible history, autosave, and non-destructive edits. Trying something should never risk losing work.
5. **Few concepts, plain language.** The interface is organized around four ideas: Land, Water, Resources and Start. No jargon: "flow: gentle / steady / strong," not "SpecifiedStrength 1.5"; "height," not "voxel layer." Exact numbers appear in advanced mode.
6. **Start from something good.** Users begin from a generated map, a template or an imported map, never a blank grid unless they ask for one.
7. **Simple mode first, advanced mode on request.** Simple mode shows feature tools, resources, the start and export. Advanced mode adds sculpting brushes, individual entity placement, numeric fields, locks and technical overlays.
8. **It must feel instant.** Interactions respond within a frame; slower work (water, full validation) happens in the background and never blocks editing.

## 2. Goals and non-goals

**Goals**
- Open any generated map, or any imported `.timber` file, in an editor in the browser.
- Feature-based editing as the primary workflow (section 1, principle 1).
- Creative tools the in-game editor lacks: parametric features, stamps, symmetry, a naturalize (erosion) brush, heightmap import, regenerate an area, and Claude editing.
- Live validation with one-click fixes, and a water preview.
- Non-destructive editing with undo and redo, saved as a project file.

**Non-goals for this plan**
- Voxel-level cave and overhang editing. Imported caves and overhangs must be preserved and exported unchanged, but the tools edit surface height only. Design the data model so voxel editing can be added later.
- Real-time collaborative editing, accounts, or server-side storage.
- Matching the game's exact visuals. The game's assets can't be included, so the editor uses its own clear, stylized look. The game remains the reference for final appearance and exact water behaviour.

## 3. Data model

This is the most important part to get right. Everything else builds on it.

**Map document**

```
MapDocument {
  formatVersion
  spec          // MapSpec from PLAN.md (settings, seed, archetype, set pieces, constraints), or null for imported maps
  base          // generated from spec, or parsed from an imported file; never mutated
  features      // editable feature objects (below)
  edits         // ordered list of edit operations
  locks         // regions protected from regeneration
  meta          // name, premise, timestamps, app version
}
```

**Features are first-class, parametric objects.** Each feature stores its parameters, not its final blocks:

- `River { path (control points), width, depth, flow, meander }`
- `Lake { outline, waterLevel, outlet }`
- `Waterfall { lip (position and facing), width, drop, flow, plungePool, outflow }` (a set piece, see below)
- `Landform { kind: hill | plateau | ridge | canyon | valley | island, outline, height, edgeStyle: gentle | terraced | cliff }`
- `Forest { area, density, speciesMix }`, `BerryPatch { area, density }`
- `RuinField { area, density, scrapTarget }` (placement follows the calibrated clustering)
- `Start { position, orientation }`
- `StampInstance { stampId, position, rotation, mirror }`
- `SymmetryRule { mode: mirror-x | mirror-y | rotate-2 | rotate-4, center }`

**Set-piece features build everything they need to work.** A `Waterfall` creates its own cliff, the channel and sources above it, the plunge pool below and an outflow that drains to an edge or an existing river. A `DamSite` creates a basin with a narrow outlet, a `Gorge` a narrow channel between high walls. One operation therefore produces a complete, working piece, which is what makes single requests like "add a waterfall here" reliable for both the tools and Claude. Each set piece:
- takes its size parameters in blocks and keeps them within the map's limits (e.g. the maximum drop is bounded by the terrain height limit), reporting any value it had to reduce;
- sizes its water sources so the flow suits its size (a 20-block-wide waterfall needs far more flow than a 3-block one) while keeping downstream channels able to carry it;
- clears or relocates what it overlaps (trees, ruins, bushes), never moves the start or touches locked regions, and lists everything it changed.

Generated maps expose their rivers, landforms, ruin fields and set pieces as features from the start, so users can immediately grab and reshape what the generator made. Imported maps start with no features (just the terrain); users add new features on top.

**Building the final map:** base terrain → features rasterized in a defined order (landforms, then water features, then resources, then the start) → sculpt and entity edits applied on top. Every step is deterministic, so the same document always produces a byte-identical `.timber` file. Changing a feature's parameter rebuilds only the area it affects.

**Edit operations** are small, serializable commands with undo data:

- Feature operations: `AddFeature`, `UpdateFeature { id, patch }`, `DeleteFeature`, `ReorderFeature`
- `Sculpt { mode: raise | lower | flatten | terrace | smooth | naturalize, cells, params }`
- `PlaceEntity`, `MoveEntity`, `DeleteEntity`, `SetEntityProps` (advanced mode)
- `RegenerateRegion { area, seedVariant, layers }`, `SetLock`
- `SpecPatch { patch }` (used by Claude and by "change a setting and regenerate")

Operations validate their inputs and reject invalid ones instead of clamping silently.

**Stable identity.** Features and generated entities get deterministic IDs derived from the seed, their kind and their generation order, so edits referencing them survive regeneration where possible. When a referenced object disappears, the edit is flagged as orphaned and shown to the user, never silently dropped.

**Conflict rules**
- Regeneration never touches locked regions or user-created features.
- Changing settings and regenerating the whole map rebuilds the generated features but keeps the player's own features, Claude's accepted changes and sculpt edits, re-snapping them to the new terrain and flagging any that no longer fit.
- `RegenerateRegion` replaces generated content in its area but keeps sculpt edits and user-placed entities, unless the user chooses to replace them.
- When terrain changes under an entity, the entity snaps to the new ground if placement stays valid; otherwise it's flagged with a fix option.

**Working representation.** Surface heights and entities in typed arrays, a voxel override layer preserving imported caves and overhangs, and dirty-region tracking so rendering, validation and water preview update only what changed.

**Persistence**
- Project file download and upload (`.damgoodmaps.json`, compressed): spec, features, edits, locks, meta; for imported maps, the original file's data.
- Autosave in the browser, guarded against storage failures; recover the last session on reload.
- `.timber` export. Re-importing a `.timber` file bakes everything into a new imported map.

**Undo and redo** run over the operation list, with periodic snapshots so undo stays fast on 256×256 maps. The history is visible as a list the user can step back through.

## 4. Editor interface

**Main view: 3D.** The map is edited directly in a 3D view with an easy orbit camera, which is how players already think about Timberborn maps. A top-down map view is one click away for precise layout work, and every tool works in both. Hovering shows what's under the cursor in plain language ("Plateau, height 12, pine forest"). A compass is always visible: north is the top of the top-down view (+Y), and these directions are the same ones Claude uses.

**Layout.** The map fills the screen. Four tabs along the side: **Land, Water, Resources, Start.** A small inspector appears next to the selected feature with a few plain controls. A status pill shows map health ("Ready to play," or "2 warnings") and opens the issue list with fix buttons. Undo, redo, history and export are always visible.

**Tools in simple mode**
- *Land:* draw a hill, plateau, ridge, canyon, valley or island by sketching its outline; pick height and edge style. Drag handles to reshape. A naturalize brush makes terrain look eroded and natural.
- *Water:* draw a river by clicking points from source to outlet (it carves its own channel and always flows downhill); draw a lake and set its level; place a waterfall on a height step; mark a dam site. Flow is gentle / steady / strong. Badwater is a toggle on a river or source.
- *Resources:* paint forests, berry patches and ruin fields as areas with a density slider. Forests show where they'll survive.
- *Start:* drag the start; the footprint preview shows green or red, and nearby water, wood and food distances appear as simple indicators.
- *Everywhere:* symmetry toggle, stamps panel, "regenerate this area," and "Ask Claude" when available.

**Advanced mode adds:** raise, lower, flatten, terrace and smooth brushes with size and strength; placing, moving and deleting individual entities; exact numeric values; locks; technical overlays (height contours, moisture reach, badwater spread, reachable area from the start, dam site quality).

**Overlays** can be toggled in both modes, with the most useful ones (water preview, start reach) in simple mode.

## 5. Creative features

- **Parametric features** (section 3): everything the user draws stays editable.
- **Stamps:** a built-in library of set pieces (waterfall basin, gorge dam site, terraced cliff, ruin district, island lake), each placeable, rotatable and mirrorable. Users can save any selection as their own stamp and export or import stamp files. A shared online gallery is out of scope (it needs a server) but the stamp format should allow one later.
- **Symmetry:** mirror or rotational symmetry for fair multiplayer maps. Every tool respects it live.
- **Naturalize brush:** a simple erosion simulation that softens artificial-looking terrain while respecting terrace steps where the user wants them.
- **Heightmap import:** create or modify terrain from a grayscale image, with scaling to the map's height limits.
- **Regenerate an area:** rerun the generator in a region with a new seed variant, choosing which layers (terrain, water, resources).
- **Claude editing:** section 7.

## 6. Live validation, fixes and water preview

- Reuse the generator's validation modules unchanged. There must be one source of truth for what "valid" means.
- **Instant checks** after every edit, on the dirty region: footprints, ground support, overlaps, start area, limits.
- **Background checks** in a web worker, debounced and cancelled when a newer edit arrives: water simulation, reachability, resource totals, moisture reach, interestingness scores.
- Issues have a severity, a location and a plain-language explanation; clicking one flies the camera to it.
  - **Error:** the file would be invalid or could break the game. Export is blocked until fixed.
  - **Warning:** a playability problem (flooded start, no water nearby). Export is allowed after a clear confirmation, and the warning is noted in the map description.
- **One-click fixes** wherever a sensible fix exists: move the start to the nearest valid spot, add an outlet to a lake, pull trees back into moisture reach, remove overlapping entities. Each fix is a normal edit operation, previewed and undoable.
- The water preview shows settled water from the simplified simulation, with a short note on where it may differ from the game, based on the investigation.

## 7. Claude integration

Claude lets users fine-tune a map in plain language, for example: "add a giant waterfall in the north part of the map that is roughly 20 blocks wide," "make it a bit wider," "move the start closer to the lake," or "put more ruins on the eastern plateau." Requests like these must work reliably, with results that match what was asked.

**Principle.** Claude never edits terrain or voxels directly. It proposes operations from section 3, mostly adding and updating features and set pieces, as JSON that matches a published schema. The app validates the operations, applies them to a preview copy, runs validation, and shows a before/after comparison for the user to accept or reject. Accepted operations join the normal edit list and undo like any other edit. Because features are parametric, anything Claude builds stays editable by hand.

**Spatial language.** The app, not Claude, resolves places and sizes, so results are consistent:
- Directions use the editor's compass. "The north part" means the northern third by default; "north edge," "center," "northeast corner," "near the start," "along the river" and "between the lake and the start" each have a defined meaning in a region resolver.
- Sizes are in blocks, matching what users see on the map grid. "Giant," "small," "a bit wider" map to defined ranges relative to the map's size and limits, documented in the schema.

**Query tools.** Claude can ask the app questions before proposing anything, through a request/response protocol that works with plain text completions (no special API features required):
- resolve a region ("north third") to an area, and list what's in it;
- find candidate locations (e.g. "a cliff site at least 20 blocks wide in the north third, away from the start");
- measure distances, heights and widths; list features with their parameters;
- dry-run a proposal and get back the validation report and measurements.

**Intent checks.** Every proposal includes the measurable expectations behind the request, e.g. `{feature: waterfall, width: 20 ±3, location: north third}`. After applying the proposal to the preview copy, the app measures the actual result (the width of the falling water in the water preview, where the feature ended up) and compares. A mismatch goes back to Claude to revise, just like a validation failure.

**Loop.** Request → queries → proposal with expectations → the app applies it to a preview, validates and measures → revise if anything fails, up to a small number of rounds → the user sees the result with a short plain-language report. The report says what was built and anything that differs from the request, for example: "Added a waterfall in the north, 20 blocks wide with an 8-block drop (the map's height limit didn't allow more). It drains into the existing river. Cleared 34 trees."

**Follow-ups.** The conversation keeps track of what Claude created, so "make it wider," "move it a bit east" or "undo the waterfall" refer to the right feature. Users can also select a feature on the map and ask about it ("make this lake deeper").

**Ambiguity.** For normal requests Claude picks a sensible interpretation, does it, and states its assumptions in the report. It asks a question first only when interpretations would lead to very different maps, or when the request conflicts with a lock or would break playability (for example, a waterfall that would flood the start).

**Other uses.** "Explain this map," "why does this fail validation," and "suggest improvements" (answered with proposed operations the user can apply).

**Safety.** Treat Claude's output as untrusted input: schema validation, bounds checks, a cap on operation count and area per proposal, and no code execution.

**Delivery.** Evaluate and recommend in "Editor decisions":
- publishing Dam Good Maps as a Claude AI-powered artifact, where Claude calls count against the user's own Claude plan;
- optional bring-your-own-API-key support on the standalone site.

Check Anthropic's current documentation for published artifacts (file size limit, allowed script hosts, how a page calls Claude, storage options) before designing around them, and plan how one codebase builds both versions. The standalone site must work fully without Claude.

## 8. Architecture

- **Module boundaries:** `core` (format I/O, map document, features and rasterization, operations engine), `generator` and `validation` (existing), `editor-ui`, `render-3d`, `render-2d`, `sim-worker` (water preview and background validation), `stamps`, `claude-bridge` (summary builder, schema, proposal loop).
- The operations engine and feature rasterization are headless and fully testable without the UI.
- Determinism: the same document always produces a byte-identical `.timber` file.
- 3D rendering: chunked meshing with remeshing of dirty chunks only; picking against terrain and features for direct manipulation.
- Keep worker messages small: send dirty regions and compact arrays, not whole documents.
- Hosting: a static site on GitHub Pages under the timbermods organization, built from the Dam Good Maps repository. Keep the build able to produce the Claude artifact version from the same code (section 7).

## 9. Testing

- **Unit:** every operation and feature type applies and undoes correctly; features rasterize deterministically; operations serialize losslessly; orphaned edits are detected.
- **Property tests:** random operation sequences, then export, re-import and compare; undoing everything returns the exact starting map; rivers drawn in random directions always flow downhill to an outlet.
- **Validation parity:** the editor's validation gives identical results to the generator's for the same map.
- **Import:** every built-in and workshop map from the investigation imports, renders and validates, and exports unchanged when there are no edits.
- **Performance budgets on 256×256:** tool feedback within one frame (16 ms), instant checks under 50 ms, dirty-chunk remesh under 50 ms, water preview under 2 s in the worker. Adjust in "Editor decisions" if measurements show these are unrealistic, with reasons.
- **End to end** (e.g. Playwright): generate, edit features, export, re-import, compare.
- **Claude request suite:** a fixed set of requests, each with measurable expectations, run against several generated maps of different sizes. Include at least: "add a giant waterfall in the north part of the map that is roughly 20 blocks wide," "make it wider," "move the start closer to the lake," "add a dam site near the start," "put more ruins on the eastern plateau," "keep badwater in the south," and "make the map harder." A request passes when the result validates, meets its expectations, and the report accurately describes what changed.
- **Usability tasks,** timed, run by me or testers who haven't seen the editor, each with a target of under 2 minutes and no help:
  1. Add a river from the north edge that passes near the start.
  2. Add a lake that can be dammed, near the start.
  3. Move the start onto a plateau and make it playable.
  4. Add a ruin field on a hill.
  5. Make the map symmetric for two players.
  6. Export the map and fix any warnings first.
  7. The full journey: generate a map from settings, refine it with at least one manual edit and one Claude request, export it and load it in Timberborn, in under 10 minutes.
- **In-game checklist** for the IN-GAME CHECK milestones: the map loads, water settles as the preview showed, the district center places, beavers survive the first drought, and edited features behave as intended.

## 10. Milestones

Each milestone is complete when its acceptance criteria pass and its tests are green.

**E1. Map document, features and operations engine (headless).**
Features with parameters and deterministic rasterization; operations; undo and redo; project files; stable IDs; orphan detection. Generated maps expose their rivers, landforms and ruin fields as features.
*Accept:* determinism, round-trip and undo property tests pass on generated maps of every size preset.

**E2. Editor shell with 3D and top-down views, connected to the generator.**
"Refine this map" on the generator page opens the map in the editor, and "Back to settings" returns without losing work; import of any `.timber` file; orbit camera and top-down view; hover readout; selection of features; the four-tab layout; history panel; export from every screen.
*Accept:* every investigation map imports and exports unchanged; smooth on 256×256; generate → refine → back to settings → regenerate → refine keeps user edits.

**E3. Land and water features, start, instant validation with fixes.**
Draw and reshape landforms, rivers, lakes, and the set pieces (waterfall, dam site, gorge) with handles; move the start with footprint preview; issue list with one-click fixes.
*Accept:* feature property tests pass; drawn rivers always drain. **IN-GAME CHECK:** export three edited maps and play them.

**E4. Resources and entities.**
Forest, berry and ruin field areas; badwater; slopes placed automatically from height steps; advanced mode with individual entity placement and numeric values.
*Accept:* resource areas respect moisture reach and calibrated clustering; invalid placements are previewed and refused.

**E5. Water preview and background validation.**
Worker-based simulation and full validation; export rules for errors and warnings.
*Accept:* validation parity tests pass. **IN-GAME CHECK:** compare the preview with the game on three edited maps; record differences in "Editor decisions."

**E6. Sculpting, naturalize and symmetry.**
Advanced sculpt brushes; the naturalize brush; symmetry across all tools.
*Accept:* performance budgets met; caves and overhangs in imported maps survive edits elsewhere; symmetric edits stay exactly symmetric.

**E7. Stamps, heightmap import, regenerate area, locks.**
Built-in stamp library, user stamps with export and import, heightmap import, regenerate a region, locks and conflict rules.
*Accept:* hand edits survive regeneration per the conflict rules; stamps round-trip through export and import.

**E8. Claude integration.**
Operation schema, map summary builder, the propose, validate, revise and preview loop, and the chosen delivery route or routes.
*Accept:* malformed or out-of-bounds proposals are rejected cleanly; accepted proposals undo like normal edits; the Claude request suite from section 9 passes on every test map, including the 20-block waterfall; results stay editable by hand; follow-up requests modify the right feature.

**E9. Usability and polish.**
Run the usability tasks from section 9 and fix what slows people down; onboarding hints; shortcuts reference; help page; accessibility pass; final performance pass.
*Accept:* every usability task is completed in under 2 minutes by a first-time user.

**Later:** voxel-level cave and overhang tools, a shared online stamp gallery, tablet and touch support.

## 11. Contract with the generator

The generator (`PLAN.md`) and the editor are one app. These shared foundations are defined once, used by both, and built early (see `ROADMAP.md`):

- **Map spec:** one documented JSON schema for settings, seed, archetype, set pieces and constraints. The settings panel, the editor's `SpecPatch` and Claude all produce it.
- **Parametric features:** the generator builds maps from the same feature objects the editor edits (rivers, lakes, landforms, set pieces, forests, berry patches, ruin fields, the start). Generation outputs the feature list together with the terrain, so "Refine this map" opens a map whose parts are already editable.
- **Set-piece builders:** one implementation of each set piece (waterfall, dam site, gorge and any others), used by the generator, the editor tools and Claude alike.
- **Stable IDs:** deterministic IDs for features and entities, derived the same way in both.
- **Validation:** one set of validation modules with the calibrated thresholds, used for generation retries, the editor's live checks and export gating.
- **Format I/O:** one reader and writer for `.timber` files, verified by the round-trip tests.
- **Determinism:** the same spec and edits always produce a byte-identical `.timber` file, whether the map came straight from the generator or through the editor.

If `PLAN.md` defines any of these differently, reconcile them into a single definition before either side builds on it, and record the decision in "Editor decisions."

