# Dam Good Maps: Map Editor and Claude Integration, Build Plan

This plan adds an in-browser map editor to Dam Good Maps, plus Claude-driven editing. It builds on the generator website described in `PLAN.md`. All of it lives in the **Dam Good Maps** repository in the **timbermods** GitHub organization, alongside `PLAN.md`, `FORMAT.md` and the investigation results.

**The goal: a web editor that is superior to Timberborn's in-game editor by being easier to use and simpler, while offering more creative power.** Players should be able to shape a great map in minutes without learning a complicated tool, and advanced users should find tools the in-game editor doesn't have. When simplicity and power conflict, simplicity wins by default and power moves into an advanced mode.

**The whole product in one line: generate → refine → play.**

1. **Generate.** The player picks settings and parameters and generates a map (covered by `PLAN.md`).
2. **Refine.** One click on "Refine this map" opens it in the editor, where the player reshapes it by hand and by asking Claude, e.g. "add a giant waterfall in the north part of the map that is roughly 20 blocks wide" (covered by this plan).
3. **Play.** Export a validated `.timber` file, drop it into Timberborn's Maps folder, and play.

These steps must feel like one app, not separate tools. Moving between them never loses work: going back to the settings and regenerating keeps the player's own features and edits, and export is available from every screen. Judge every decision by how smoothly a player gets from settings to playing a map they're happy with.

## 0. Before writing any code

**Prerequisites.** Follow `ROADMAP.md`. Editor work starts at roadmap milestone M3. It needs two things from M1 and M2:
- the shared core that `PLAN.md` §19 defines: the `MapSpec`, the parametric features, the build pipeline, format I/O, and the validation modules with their classes and profiles;
- a generator that already produces its maps from those features.

If any of these is missing, stop and tell me.

**This plan was written before the investigation ran.** The audit of 2026-09-23 (`AUDIT.md`) reconciled it with the findings and with `PLAN.md`, and produced the merged `ROADMAP.md`. Its changes are listed at the end of this file. Where `ROADMAP.md` orders the work differently from §10, follow `ROADMAP.md`. Section 11 points to the one definition of what the generator provides for the editor, `PLAN.md` §19. Both plans honour it.

**Reconcile first.** Read `PLAN.md`, `FORMAT.md`, `investigation/REPORT.md` and `investigation/calibration.json`, plus the current codebase. Where this plan conflicts with the investigation's findings (footprints, slope rules, moisture reach, water behaviour, limits) or with the architecture as actually built, the findings and the built code win. Record every deviation and decision in "Editor decisions" (`PLAN.md` §20, which the audit started) before starting each milestone. Ask me about anything that changes the scope of a milestone.

**Working rules.**
- Build one milestone at a time. Each ends with its acceptance criteria met, tests passing, and a short summary of what changed.
- Stop at milestones marked **IN-GAME CHECK** and wait for my results before continuing.
- The editor must never be able to export a file that breaks the game. Load problems block export. Playability and design problems warn. The classes are defined in `PLAN.md` §19.5.
- Everything works without Claude. Claude features are an add-on.

## 1. Product principles

These guide every design decision. When a choice isn't covered elsewhere, decide by these, and note the decision in "Editor decisions."

1. **Edit features, not blocks.** The main way to edit is by working with things players think in: a river, a lake, a hill, a plateau, a canyon, a waterfall, a forest, a ruin field, the start. Each is an object with handles that can be moved, reshaped, resized or deleted at any time, like shapes in a drawing program. Block-level sculpting exists, but as a secondary tool.
2. **Valid by default.** Tools produce playable results without the user having to know the rules:
   - rivers always flow downhill to an outlet, and a river entering at the map edge gets a sealed mouth, so its water can't drain back off the map;
   - a lake fills to its outlet sill and has an inflow;
   - slopes are placed and oriented automatically wherever the colony needs to cross a one-level step;
   - the start clears its own footprint and keeps its entrance free;
   - forests grow only where they'll survive, unless the user overrides it.

   When something does go wrong, the issue comes with a one-click fix ("move the start to the nearest valid spot," "open an outlet for this lake").
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
- Voxel-level cave and overhang editing.
  - Imported caves and overhangs must be preserved and exported unchanged, together with the water the file stores under them.
  - The tools edit surface height only.
  - Design the data model so voxel editing can be added later.
- Terrain above 16. It is the in-game editor's limit, and every tool keeps to it. Imported maps with terrain up to 22 are preserved.
- Multiplayer starts. Timberborn 1.1 keeps exactly one StartingLocation per map, so symmetry makes maps look balanced but never adds starts.
- Real-time collaborative editing, accounts, or server-side storage.
- Matching the game's exact visuals. The game's assets can't be included, so the editor uses its own clear, stylized look. The game remains the reference for final appearance and exact water behaviour.

## 3. Data model

This is the most important part to get right. Everything else builds on it. The shared parts (spec, features, set-piece builders, ids, build order) are defined once in `PLAN.md` §19. This section adds what only the editor needs.

**Map document**

```
MapDocument {
  formatVersion
  generatorVersion  // the generator that built `base`
  spec              // MapSpec (PLAN.md §19.1), or null for imported maps
  base              // built from spec, or parsed from an imported file; stored in the project file, never mutated
  features          // parametric feature objects (PLAN.md §19.2)
  edits             // ordered list of edit operations
  locks             // regions protected from regeneration
  meta              // name, premise, designedFor, timestamps, app version, import report
}
```

**Features are first-class, parametric objects.** Each feature stores its parameters, not its final blocks. The kinds, their parameters and the game rules each must respect are defined in `PLAN.md` §19.2. What the editor shows for each:

- `River { path, width, bedDepth, bedProfile, flow, style, entry, exit, badwater }`.
  - Drawing from the map edge makes a sealed mouth.
  - `bedDepth` 1 keeps the full 16-tile band of moist soil; 2 gives 10 tiles, 3 gives 4, and 4 none. The inspector shows the band.
  - The water depth follows from the flow and the outlet, not from the carve.
- `Lake { basin, floorDepth, outlet: {at, sill, to}, inflow }`.
  - The water level *is* the outlet sill, because settled water is flat. The user drags the rim or the sill, not a separate "water level".
  - A lake with no inflow gets a warning: it loses about 0.054 levels a day.
  - The basin keeps off the map edge, because edges drain.
- `Landform { kind: hill | plateau | ridge | canyon | valley | island | terraces, outline, height, edgeStyle: gentle | terraced | cliff }`.
  - Terrain is whole levels, so "gentle" means one-level steps at least 3 tiles apart, joined by slopes.
  - "terraced" means one-level bands 6–12 deep.
  - "cliff" means a step of two or more levels, which beavers cannot cross without player stairs.
- Set pieces, each a `setPiece` feature built by its shared builder:
  - `Waterfall { lip (position and facing), width, drop, flow, mode: on-river | standalone, headerPool, plungePool, outflow }`
  - `DamSite { narrows, crest, basin }`
  - `Gorge { path, width, wallHeight, access }`
  - `TerracedCliffs`, `BadwaterBasin`, `PlugSpillway`, `ObstaclePayoff` and `SecondDistrict`
- `Forest { area, density, speciesMix }`, `BerryPatch { area, density }`
- `RuinField { area, density, scrapTarget }` (placement follows the calibrated clustering)
- `MapObject { kind: mineSite | relic | geothermal | thornBelt | weir | plug | bridge, placement }`
- `Start { position, orientation }`
- `StampInstance { stampId, position, rotation, mirror }`
- `SymmetryRule { mode: mirror-x | mirror-y | rotate-2 | rotate-4 (square maps only), center }`

**Set-piece features build everything they need to work.** A `Waterfall` creates its own cliff and a header pool one level below the lip, so the fall spreads across the whole lip. It adds the springs that feed the pool, the plunge pool below, and an outflow that drains to an edge or an existing river. When it sits on a river, it takes that river's flow instead. A `DamSite` creates a basin with a narrow outlet, a `Gorge` a narrow channel between high walls. One operation therefore produces a complete, working piece, which is what makes single requests like "add a waterfall here" reliable for both the tools and Claude. Each set piece:
- takes its size parameters in blocks and levels. Values outside the schema's hard bounds are rejected. Values beyond what this map allows are reduced to the nearest achievable value, and every reduction is reported. The achievable ranges are in `PLAN.md` §9.10: for example, a waterfall drop of at most 15 levels, and a width of at most 40% of the side along the lip;
- sizes its water so the flow suits its size (`PLAN.md` §9.2). The lip is about 0.3·S/W deep, so a 20-block fall stays wet from 0.5 blocks/s but needs about 8 to look like an official fall. It keeps downstream channels able to carry the flow: about 3 blocks/s per tile of channel width with banks 1 level high;
- clears or relocates what it overlaps (trees, ruins, bushes), never moves the start or touches locked regions, and lists everything it changed.

Generated maps expose their rivers, lakes, landforms, set pieces, forests, berry patches, ruin fields, map objects and start as features from the start (`PLAN.md` §19.2), so users can immediately grab and reshape what the generator made. Imported maps start with no features: just the terrain and entities. Users add new features on top. Detecting the rivers, lakes and plateaus of an imported map and offering "make editable" is a later addition.

**Building the final map:** the one build pipeline in `PLAN.md` §19.8. It runs landforms, then set pieces, rivers and lakes, pads, sculpt edits, derived slopes, water, resources, the start and entity edits, in that order. Every step is deterministic, so the same document always produces a byte-identical `.timber` file. Changing a feature's parameter rebuilds only the area it affects. That incremental rebuild must equal a full rebuild (`PLAN.md` §19.7).

**Edit operations** are small, serializable commands with undo data:

- Feature operations: `AddFeature`, `UpdateFeature { id, patch }`, `DeleteFeature`, `ReorderFeature`
- `Sculpt { mode: raise | lower | flatten | terrace | smooth | naturalize, cells, params }`
- `PlaceEntity`, `MoveEntity`, `DeleteEntity`, `SetEntityProps` (advanced mode)
- `PinSlope`, `RemoveSlope` (overrides on the derived slopes)
- `RegenerateRegion { area, seedVariant, layers }`, `SetLock`
- `SpecPatch { patch }` (a JSON Merge Patch on the `MapSpec`, used by Claude and by "change a setting and regenerate")

Operations validate their inputs against the schemas and reject invalid ones instead of clamping silently. The set-piece builders are the one place where a valid value may be reduced to what the map allows, and they always report it.

**Stable identity** is defined in `PLAN.md` §19.4:
- generated features are hashed from the seed, their kind and their role in the plan, not their position in a list;
- user and Claude features get a stored UUID;
- entities are hashed from their owning feature.

Edits referencing them therefore survive regeneration wherever the referenced object still exists. When a referenced object disappears, the edit is flagged as orphaned and shown to the user, never silently dropped.

**Conflict rules**
- Regeneration never touches locked regions or user-created features. The generator receives them as constraints (`MapSpec.constraints`, `PLAN.md` §7.0) and plans around them.
- Changing settings and regenerating the whole map rebuilds the generated features but keeps the player's own features, Claude's accepted changes and sculpt edits, re-snapping them to the new terrain and flagging any that no longer fit.
- `RegenerateRegion` replaces generated content in its area but keeps sculpt edits and user-placed entities, unless the user chooses to replace them.
- When terrain changes under an entity, the entity snaps to the new ground if placement stays valid; otherwise it's flagged with a fix option.

**Working representation.**
- Surface heights and entities are kept in typed arrays.
- A voxel override layer preserves imported caves and overhangs. Columns with more than one solid run are shown locked to the sculpt tools and exported unchanged.
- After every terrain edit the instant checks re-test terrain support. The game deletes voxels more than 3 tiles sideways from support, and the objects standing on them.
- Dirty-region tracking lets rendering, validation and the water preview update only what changed.

**Persistence**
- Project file download and upload (`.damgoodmaps.json`, compressed). It holds the spec, features, edits, locks, meta, generator version and the built base (`PLAN.md` §19.6), so a project opens exactly even after the generator changes. For imported maps it holds the original file's data.
- Autosave in the browser through the storage adapter (`PLAN.md` §19.9), guarded against storage failures; recover the last session on reload.
- `.timber` export through the `export` validation profile. Re-importing a `.timber` file bakes everything into a new imported map.

**Undo and redo** run over the operation list, with periodic snapshots so undo stays fast on 256×256 maps. The history is visible as a list the user can step back through.

## 4. Editor interface

**Main view: 3D.** The map is edited directly in a 3D view with an easy orbit camera, which is how players already think about Timberborn maps. A top-down map view is one click away for precise layout work, and every tool works in both. Hovering shows what's under the cursor in plain language ("Plateau, height 12, pine forest"). A compass is always visible: north is the top of the top-down view (+Y, the game's grid north), and these directions are the same ones Claude uses. The 3D renderer is the same one the generator's preview uses (`PLAN.md` §3, `render3d`).

**Layout.** The map fills the screen. Four tabs along the side: **Land, Water, Resources, Start.** A small inspector appears next to the selected feature with a few plain controls. A status pill shows map health ("Ready to play," or "2 warnings") and opens the issue list with fix buttons. Undo, redo, history and export are always visible.

**Tools in simple mode**
- *Land:* draw a hill, plateau, ridge, canyon, valley or island by sketching its outline; pick height and edge style. Drag handles to reshape. A naturalize brush makes terrain look eroded and natural. Add a thorn belt across a corridor.
- *Water:*
  - Draw a river by clicking points from source to outlet. It carves its own channel, always flows downhill and seals its mouth at the edge.
  - Draw a lake by its basin and drag its rim or outlet to set the level.
  - Place a waterfall on a height step of a river, or as a standalone landmark.
  - Mark a dam site, draw a gorge, and add a weir (a NaturalDam line) or a plug (a Blockage line).
  - Flow is gentle / steady / strong. Badwater is a toggle on a river or source. Switching it on warns that the river will stop moistening the soil and that forests along it will die.
- *Resources:* paint forests, berry patches and ruin fields as areas with a density slider. Forests show where they'll survive. Place mine sites (UndergroundRuins), relics and geothermal fields, with their distance rules shown.
- *Start:* drag the start. The footprint preview shows green or red, including the entrance tile in front of the door, and nearby water, wood and food distances appear as simple indicators.
- *Everywhere:* symmetry toggle, stamps panel, "regenerate this area," and "Ask Claude" when available.

**Advanced mode adds:** raise, lower, flatten, terrace and smooth brushes with size and strength; placing, moving and deleting individual entities, with the game's footprint rules previewed; exact numeric values, including delayed sources ("turns on at cycle N"); locks; technical overlays (height contours, moisture reach, badwater spread, reachable area from the start, dam site quality, water under roofs where the preview is approximate).

**Overlays** can be toggled in both modes, with the most useful ones (water preview, start reach) in simple mode.

## 5. Creative features

- **Parametric features** (section 3): everything the user draws stays editable.
- **Stamps:** a built-in library of set pieces (waterfall basin, gorge dam site, terraced cliff, ruin district, island lake), each placeable, rotatable and mirrorable. Users can save any selection as their own stamp and export or import stamp files. A shared online gallery is out of scope (it needs a server) but the stamp format should allow one later.
  - Rotating or mirroring a stamp transforms its entities with the game's own footprint rule: `Coordinates + R(F(local))` (`FORMAT.md` §4.4). A mirror remaps orientations (for a mirror across x, Cw90 ↔ Cw270) and recomputes Coordinates from the footprint's minimum corner.
  - `Flipped` is only honoured for flippable templates. Asymmetric footprints that are not flippable (BadtideDrain, the upper layer of LargeRelic) are re-placed rather than mirrored.
  - Slopes are re-derived after the stamp lands.
- **Symmetry:** mirror or rotational symmetry, so maps look balanced. Every tool respects it live. Rotate-4 needs a square map. Timberborn 1.1 keeps exactly one start, so symmetry never duplicates the start.
- **Naturalize brush:** a simple erosion simulation that softens artificial-looking terrain while respecting terrace steps where the user wants them.
- **Heightmap import:** create or modify terrain from a grayscale image, scaled to heights 0–16.
- **Regenerate an area:** rerun the generator in a region with a new seed variant, choosing which layers (terrain, water, resources). The rest of the map is passed in as constraints.
- **Claude editing:** section 7.

## 6. Live validation, fixes and water preview

- Reuse the generator's validation modules unchanged. There must be one source of truth for what "valid" means. The editor runs them with the `export` profile (`PLAN.md` §19.5).
- **Instant checks** after every edit, on the dirty region: footprints, ground support, overlaps, start area, limits, slopes, terrain support.
- **Background checks** in a web worker, debounced and cancelled when a newer edit arrives: water simulation, reachability, resource totals, moisture reach, drought survival, interestingness scores.
- Issues have a severity, a location and a plain-language explanation; clicking one flies the camera to it.
  - **Error** (load class): the file would crash the game, lose objects on load, or start without beavers. Export is blocked until fixed.
  - **Warning** (playability or design class): a playability problem (flooded start, no water nearby, a map above height 16). Export is allowed after a clear confirmation, and the warning is noted in the map description.
- **One-click fixes** wherever a sensible fix exists: move the start to the nearest valid spot, add an outlet to a lake, pull trees back into moisture reach, remove overlapping entities, add a missing slope. Each fix is a normal edit operation, previewed and undoable.
- **Water preview:** the settled water of the prototype's port of the game's rules (`PLAN.md` §10).
  - **Exact on heightfield terrain**, which covers every generated map and most edited ones. The port reproduced the game's own save to 0.001 depth, and matched Diorama and Waterfalls exactly.
  - **Approximate under roofs** (imported caves, tunnels, overhang bridges, badtide drains). There the editor keeps the water the file stores, shows a "preview approximate" overlay, and does not re-simulate unless the user edits nearby.
  - **Steady state in temperate weather.** Delayed sources and badtide drains are off, seeps stop at 0.8 deep, and aquifers run only under a powered drill. Drought is shown analytically: what the basins still hold after N days.
  - **Speed:** after an edit the preview re-settles from its previous state. The target is ≤ 2 s for a local edit on 256². A full re-settle runs in the background with progress.
  - **Export:** the exported file always gets the canonical settle (`PLAN.md` §19.7), with a progress bar, so an export never depends on the preview's history.

## 7. Claude integration

Claude lets users fine-tune a map in plain language, for example: "add a giant waterfall in the north part of the map that is roughly 20 blocks wide," "make it a bit wider," "move the start closer to the lake," or "put more ruins on the eastern plateau." Requests like these must work reliably, with results that match what was asked.

**Principle.** Claude never edits terrain or voxels directly. It proposes operations from section 3, mostly adding and updating features and set pieces, as JSON that matches a published schema. The app validates the operations, applies them to a preview copy, runs validation, and shows a before/after comparison for the user to accept or reject. Accepted operations join the normal edit list and undo like any other edit. Because features are parametric, anything Claude builds stays editable by hand.

**Spatial language.** The app, not Claude, resolves places and sizes, so results are consistent:
- Directions use the editor's compass. "The north part" means the northern third by default; "north edge," "center," "northeast corner," "near the start," "along the river" and "between the lake and the start" each have a defined meaning in a region resolver. Non-square maps use the same fractions of each side.
- Sizes are in blocks, matching what users see on the map grid. "Giant," "small," "a bit wider" map to defined ranges relative to the map's size and to the achievable ranges the builders publish (`PLAN.md` §9.10), documented in the schema. For example, a giant waterfall is 30–40% of the side along its lip, and a bit wider is +25%.

**Query tools.** Claude asks the app questions before proposing anything. Both delivery routes let Claude call functions the app defines: tool use in the Messages API, and page functions passed as tools to the artifact's `sample` capability. So queries are tools, not a text protocol:
- `resolve_region` ("north third") returns an area and what's in it;
- `find_sites` finds candidate locations (e.g. "a cliff site at least 20 blocks wide in the north third, away from the start");
- `measure` measures distances, heights and widths;
- `list_features` returns the features with their parameters;
- `limits` returns the achievable ranges for a set piece here;
- `dry_run` applies a proposal to a preview copy and returns the validation report and measurements;
- `propose` submits the final operation list with its expectations.

Tool results stay small. The artifact caps a tool result at 32 KB, a tool's input schema at 4 KB and a whole request at 64 KiB. So the map summary Claude starts from is feature-level and at most about 16 KB, and details come through the tools. A text version of the same messages remains as a fallback for a view where tools are unavailable.

**Intent checks.** Every proposal includes the measurable expectations behind the request, e.g. `{feature: waterfall, width: 20 ±3, location: north third}`. After applying the proposal to the preview copy, the app measures the actual result and compares:
- the width of the falling water in the water preview: lip tiles with water deeper than 0.01 and a drop of at least 1.5;
- where the feature ended up.

A mismatch goes back to Claude to revise, just like a validation failure.

**Loop.** Request → queries → proposal with expectations → the app applies it to a preview, validates and measures → revise if anything fails, up to 3 rounds and about 10 tool calls per request → the user sees the result with a short plain-language report. Each round is a paid request on the user's plan or key, which is why the cap matters. The report says what was built and anything that differs from the request, for example: "Added a waterfall in the north, 20 blocks wide with a 9-block drop, fed by four new springs (2 blocks/s: a thin sheet; a full official-looking fall needs about 8 blocks/s, twice this map's river flow). It drains into the existing river. Cleared 34 trees."

**Follow-ups.** The conversation keeps track of what Claude created, so "make it wider," "move it a bit east" or "undo the waterfall" refer to the right feature. Users can also select a feature on the map and ask about it ("make this lake deeper").

**Ambiguity.** For normal requests Claude picks a sensible interpretation, does it, and states its assumptions in the report. It asks a question first only when interpretations would lead to very different maps, or when the request conflicts with a lock or would break playability (for example, a waterfall that would flood the start).

**Other uses.** "Explain this map," "why does this fail validation," and "suggest improvements" (answered with proposed operations the user can apply).

**Safety.** Treat Claude's output as untrusted input:
- schema validation, bounds checks, a cap on operation count and area per proposal, and no code execution;
- every tool checks its own arguments, because the artifact route does not enforce tool schemas and the API's strict mode cannot express numeric bounds;
- text inside map names or imported files is data, never instructions.

**Delivery.** The audit checked Anthropic's current documentation (sources in `AUDIT.md`) and evaluated both routes.

*Route A: the Claude artifact edition.* Dam Good Maps is published as a Claude artifact whose Claude calls count against each user's own plan.
- **Page:** one self-contained HTML page of at most 16 MiB. Scripts load only from cdnjs, jsDelivr (`/npm/` paths), unpkg and the Tailwind and jQuery CDNs. `fetch`, XHR and WebSockets reach only the page's own origin, so the page cannot call the Anthropic API or any other host.
- **Calling Claude:** through the `sample` capability.
  - The viewer's own plan pays. Viewers sign in and consent on the first call, and rate limits apply.
  - The page picks a model tier (quick / default / complex), not a model id. There is no system prompt, and input is capped at 64 KiB.
  - Page functions can be offered as tools. `sample.json` parses but does not check the reply against a schema.
- **Downloads:** a page cannot start a download itself. The `downloads` capability saves files after the viewer confirms, but its extension allowlist has no `.timber`. The artifact edition therefore offers a `.zip` holding the `.timber` (decision D10), and the install help says to extract it. Project files save as `.json`.
- **Storage:** per-viewer browser storage works but may be unavailable. The `db` capability, a shared JSON store with documents of at most 256 KiB, makes an artifact organisation-internal. The editor therefore autosaves to browser storage and never uses `db`.
- **Sharing:**
  - Viewers need a Claude account.
  - The help center says artifacts that use Claude cannot use "Anyone with the link" on Team and Enterprise plans.
  - For Pro and Max, the help center and the Claude Code docs disagree about public links.
- **Verdict:** partly as described. "Claude calls count against the user's own plan" holds. The rest needs changes: the download must be a `.zip`; queries become tools, not a text protocol; and public sharing, Web Workers, and opening a local `.timber` must be proven by the spike below.

*Route B: bring your own API key on the standalone site.*
- **Browser calls:** the Messages API accepts calls from a browser when the client opts in: `dangerouslyAllowBrowser: true` in the TypeScript SDK, which sends the `anthropic-dangerous-direct-browser-access` header.
- **Key risk:** the official docs warn that a key in a browser can be extracted, and call it low-risk only for internal tools and short-lived keys. Mitigations:
  - the key stays in memory by default, with an opt-in "remember" that stores it in browser storage and says so;
  - suggest a key with an expiry (the Console can create one);
  - set a strict Content-Security-Policy with `connect-src 'self' https://api.anthropic.com`;
  - load no third-party scripts at runtime;
  - never log the key or put it in a URL.
- **Schema-shaped output:** structured outputs are generally available. Strict tool use (`strict: true`) guarantees schema-shaped operations. Its JSON Schema subset drops `minimum`/`maximum`, `minLength`/`maxLength` and recursive schemas, so bounds stay in the app.
- **Model:** configurable. The default is the starting point the models overview recommends; at audit time that was `claude-opus-5-5`, with `claude-sonnet-5` as the cheaper choice.
- **Prompt caching:** cache the stable prefix (instructions, schemas, map summary).
- **Verdict:** works as described, with the mitigations above.

*Recommendation* (decision D8 in `PLAN.md` §20):
- One `ClaudeBridge` interface with two adapters.
- Build the Messages API adapter first. It also runs the Claude request suite in Node.
- Ship bring-your-own-key as an advanced option.
- Then ship the artifact edition as the no-key route, once the spike passes.
- The standalone site works fully without Claude.

*One codebase, two builds.*
- The platform adapters of `PLAN.md` §19.9 (files, storage, workers, claude, download naming) are the only differences.
- `vite build --mode artifact` produces one HTML file with everything inlined and workers as blobs.
- It declares only the `sample` and `downloads` capabilities, because `db`, `assets` and `mcp` would each rule out public sharing.

*Spike (roadmap M3).* Publish a test artifact. It must prove:
- a blob Web Worker runs;
- a file input reads a local `.timber`;
- `downloads.save` saves a `.zip`;
- `sample` works with tools on the quick and default tiers, with measured latency;
- the artifact can be opened by others on Kyler's plan, including by public link.

Record the results in "Editor decisions".

## 8. Architecture

- **Module boundaries** (the same tree as `PLAN.md` §3):
  - `core`: spec, features and rasterization, set-piece builders, format I/O, the map document, the operations engine, validation, the water simulation;
  - `generator`;
  - `render3d`, shared with the generator's preview;
  - `editor-ui`;
  - `render-2d`;
  - `sim-worker` (water preview and background validation);
  - `stamps`;
  - `claude-bridge` (summary builder, schema, tools, proposal loop);
  - `platform` adapters.
- The operations engine and feature rasterization are headless and fully testable without the UI.
- Determinism: the same document always produces a byte-identical `.timber` file (`PLAN.md` §19.7).
- 3D rendering:
  - chunked meshing (32×32 chunks) with remeshing of dirty chunks only;
  - a voxel mesher only for columns with more than one solid run (1% of official map columns, up to 58% on one workshop map);
  - instanced trees, bushes and ruins;
  - picking against the heightfield and the features for direct manipulation.
- Keep worker messages small: send dirty regions and compact arrays, not whole documents.
- Hosting: a static site on GitHub Pages under the timbermods organization, built from the Dam Good Maps repository. The same code also builds the Claude artifact edition (section 7).

## 9. Testing

- **Unit:** every operation and feature type applies and undoes correctly; features rasterize deterministically; operations serialize losslessly; orphaned edits are detected.
- **Property tests:**
  - random operation sequences, then export, re-import and compare;
  - undoing everything returns the exact starting map;
  - rivers drawn in random directions always flow downhill to an outlet and keep their water;
  - an incremental rebuild equals a full rebuild.
- **Validation parity:** the editor's validation gives identical results to the generator's for the same map, including on all 19 official maps, with multi-tile emitters and blockers handled by their footprints (`PLAN.md` §11.5).
- **Import:**
  - every voxel-format map from the investigation (official, dev and workshop, 0.7 to 1.1) imports, renders and validates;
  - with no edits, each re-exports its normalized world byte for byte (`PLAN.md` §19.6);
  - the two 0.6 heightmap maps import through the `Heights` conversion;
  - the 90-layer workshop map is truncated to 22 layers with a warning, as the game does;
  - a pre-1.0 map without `WaterSimulationMigrator` has its strengths halved at import.
- **Performance budgets on 256×256** (revised by the audit; adjust in "Editor decisions" if measurements differ, with reasons):
  - tool feedback within one frame (16 ms), with lightweight proxies while dragging;
  - a feature edit committed (rasterize and remesh the affected chunks) in ≤ 100 ms;
  - instant checks ≤ 50 ms;
  - a dirty-chunk remesh ≤ 5 ms per chunk;
  - the water preview after a local edit ≤ 2 s (warm start);
  - the canonical full settle for export ≤ 3 s as the target. The audit measured 6.5–11 s for an unoptimized JS port from empty (`PLAN.md` §10).
- **End to end** (e.g. Playwright): generate, edit features, export, re-import, compare.
- **Claude request suite:** a fixed set of requests, each with measurable expectations, run against several generated maps of different sizes.
  - It runs in Node through the Messages API adapter (nightly, with a key), with the same prompts and tools the artifact edition uses. It checks expectations against the achievable ranges (`PLAN.md` §9.10).
  - Include at least:
    - "add a giant waterfall in the north part of the map that is roughly 20 blocks wide", on 128² and 256²; on 96² it must fit, and on 48² it must report the reduction to 19;
    - "make it wider";
    - "move the start closer to the lake";
    - "add a dam site near the start";
    - "put more ruins on the eastern plateau";
    - "keep badwater in the south";
    - "make the map harder".
  - A request passes when the result validates, meets its expectations, and the report accurately describes what changed.
  - The artifact edition gets a manual smoke test on the same requests.
- **Usability tasks,** timed, run by me or testers who haven't seen the editor, each with a target of under 2 minutes and no help:
  1. Add a river from the north edge that passes near the start.
  2. Add a lake that can be dammed, near the start.
  3. Move the start onto a plateau and make it playable.
  4. Add a ruin field on a hill.
  5. Make the map mirror-symmetric while keeping one valid start.
  6. Export the map and fix any warnings first.
  7. The full journey: generate a map from settings, refine it with at least one manual edit and one Claude request, export it and load it in Timberborn, in under 10 minutes.
- **In-game checklist** for the IN-GAME CHECK milestones: the map loads, water settles as the preview showed, the district center places, beavers survive the first drought, and edited features behave as intended. Add the audit's checks in `PLAN.md` §18 F (waterfall visibility, sealed river mouths, halved pre-1.0 imports, roofed water in imported maps).

## 10. Milestones

Each milestone is complete when its acceptance criteria pass and its tests are green. `ROADMAP.md` gives the merged order. The roadmap milestone for each is in brackets.

**E1. Map document, features and operations engine (headless).** [M3]
Features with parameters and deterministic rasterization; operations; undo and redo; project files; stable ids; orphan detection. The feature schema and the generator's feature output already exist from M1, so E1 adds the document and the operations engine, import normalization, and regeneration with constraints. The delivery spike (section 7) runs alongside.
*Accept:* determinism, round-trip and undo property tests pass on generated maps of every size preset; incremental rebuilds equal full rebuilds; every investigation map imports and re-exports its normalized world unchanged.

**E2. Editor shell with 3D and top-down views, connected to the generator.** [M4]
"Refine this map" on the generator page opens the map in the editor, and "Back to settings" returns without losing work; import of any `.timber` file; orbit camera and top-down view; hover readout; selection of features; the four-tab layout; history panel; export from every screen. The 3D renderer is built once and also serves the generator's 3D preview.
*Accept:* every investigation map imports and exports unchanged; smooth on 256×256; generate → refine → back to settings → regenerate → refine keeps user edits.

**E3. Land and water features, start, slopes, instant validation with fixes.** [M5]
Draw and reshape landforms, rivers, lakes, and the set pieces (waterfall, dam site, gorge) with handles; move the start with footprint preview; issue list with one-click fixes. Slopes are derived automatically after every terrain change (moved here from E4, so edited maps never strand the colony). The set-piece builders are the shared ones the generator also uses.
*Accept:* feature property tests pass; drawn rivers always drain and keep their water; the set-piece range tests of `PLAN.md` §9.10 pass. **IN-GAME CHECK:** export three edited maps and play them. The three include a 20-wide standalone waterfall at two flows, a dam site and a gorge (`PLAN.md` §18 C and F1–F2).

**E4. Resources and entities.** [M7]
Forest, berry and ruin field areas; map objects (mine sites, relics, geothermal fields, thorn belts, weirs, plugs); badwater; advanced mode with individual entity placement and numeric values.
*Accept:* resource areas respect moisture reach and calibrated clustering; invalid placements are previewed and refused. **IN-GAME CHECK** (shared with the generator's 1.0 objects, `PLAN.md` §18 D).

**E5. Water preview and background validation.** [M8]
Worker-based simulation and full validation; export rules for errors and warnings; the canonical settle on export; roofed water kept from the file.
*Accept:* validation parity tests pass. **IN-GAME CHECK:** compare the preview with the game on three edited maps, one of them an imported official map with roofed water; record differences in "Editor decisions."

**E6. Sculpting, naturalize and symmetry.** [M10]
Advanced sculpt brushes; the naturalize brush; symmetry across all tools.
*Accept:* performance budgets met; caves and overhangs in imported maps survive edits elsewhere; symmetric edits stay exactly symmetric, entities included (section 5).

**E7. Stamps, heightmap import, regenerate area, locks.** [M11]
Built-in stamp library, user stamps with export and import, heightmap import, regenerate a region, locks and conflict rules.
*Accept:* hand edits survive regeneration per the conflict rules; stamps round-trip through export and import.

**E8. Claude integration.** [M12]
Operation schema, map summary builder, the tools, the propose, validate, revise and preview loop, and the delivery routes chosen after the spike (section 7).
*Accept:* malformed or out-of-bounds proposals are rejected cleanly; accepted proposals undo like normal edits; the Claude request suite from section 9 passes on every test map, including the 20-block waterfall; results stay editable by hand; follow-up requests modify the right feature. **IN-GAME CHECK:** play the map made by the waterfall request.

**E9. Usability and polish.** [M13]
Run the usability tasks from section 9 and fix what slows people down; onboarding hints; shortcuts reference; help page; accessibility pass; final performance pass.
*Accept:* every usability task is completed in under 2 minutes by a first-time user.

**Later:** voxel-level cave and overhang tools with stacked-column water, a shared online stamp gallery, tablet and touch support, "make editable" detection for imported maps, share links that carry small edit lists, terrain 17–22 if `PLAN.md` §18 E1 allows it.

## 11. Contract with the generator

The generator (`PLAN.md`) and the editor are one app. The shared foundations are defined once, in **`PLAN.md` §19**, used by both, and built first (`ROADMAP.md` M1–M3). This section only points there:

| Item | Definition | In short |
|---|---|---|
| Map spec | `PLAN.md` §19.1 | One versioned JSON schema (`MapSpec`) for seed, size, theme, archetype, premise, difficulty, settings, set-piece requests and constraints. The settings panel, the URL codec, `SpecPatch` (a JSON Merge Patch) and Claude all produce it. |
| Parametric features | `PLAN.md` §19.2 | One schema for rivers, lakes, landforms, set pieces, forests, berry patches, ruin fields, map objects and the start. The generator builds every map from them and outputs them, so "Refine this map" opens a map whose parts are already editable. |
| Set-piece builders | `PLAN.md` §19.3 | One builder per kind (`plan` / `rasterize` / `limits`), used by the generator, the editor tools and Claude. |
| Stable ids | `PLAN.md` §19.4 | Generated features hashed from seed, kind and role; user features get stored UUIDs; entities are hashed from their owning feature. |
| Validation | `PLAN.md` §19.5 | One set of modules with check classes (load, playability, design) and profiles (generate, export, import). |
| Format I/O | `PLAN.md` §19.6 | One reader and writer, import normalization, project files. |
| Determinism | `PLAN.md` §19.7 | `build(document)` is pure; per-feature RNG streams; incremental equals full; the canonical water settle for files. |
| Build order | `PLAN.md` §19.8 | One pipeline for generation and editing. |
| Platform adapters | `PLAN.md` §19.9 | Files, storage, workers, Claude and download naming: the only differences between the website and the artifact edition. |

If anything here or in `PLAN.md` defines one of these differently, `PLAN.md` §19 wins. Reconcile the other text and record the decision in "Editor decisions" (`PLAN.md` §20).

## Changes from audit

The audit of 2026-09-23 (`AUDIT.md`) changed this plan as follows:

1. §0: prerequisites now follow `ROADMAP.md`: editor work starts at M3, after the shared core. "Editor decisions" lives in `PLAN.md` §20, started by the audit. The blocking rule uses the validation classes.
2. §1: "valid by default" now covers sealed river mouths, lakes filled to their outlet sill, and automatic slopes.
3. §2: new non-goals: terrain above 16 (imported maps up to 22 are preserved), and multiplayer starts (1.1 keeps exactly one start). Imported caves keep their stored water.
4. §3: the document stores the generator version and the built base. Feature parameters were corrected to the game's rules:
   - a lake's level is its outlet sill;
   - a river's `bedDepth` sets its moisture band, and its mouth at the edge is sealed;
   - landform edge styles follow the whole-level terrain and the slope rule;
   - waterfalls get a header pool and on-river or standalone modes;
   - new set pieces (gorge, terraced cliffs, badwater basin, plugged spillway, obstacle with payoff, second district) and map objects;
   - set-piece ranges and flows come from the measured limits in `PLAN.md` §9.10.

   Also: reject versus reduce-and-report is defined; stable ids and the build order point to `PLAN.md` §19; regeneration passes user features as constraints; multi-run columns and terrain support are handled; slope overrides are new operations.
5. §4: Start shows the entrance tile. Water gains standalone waterfalls, gorges, weirs and plugs. Resources gain mine sites, relics and geothermal fields. The badwater toggle warns about forests. New overlays for approximate roofed water; delayed sources in advanced mode.
6. §5: stamp and symmetry transforms follow the game's footprint and orientation rules. Symmetry no longer promises multiplayer fairness. Rotate-4 needs square maps.
7. §6: the `export` profile; errors and warnings map to check classes; the water preview's fidelity is spelled out (exact on heightfields, approximate under roofs, steady state); warm-start preview with the canonical settle for export.
8. §7: query tools become real tools in both routes, sized to the artifact's limits. Size words resolve against the builders' achievable ranges. The loop is capped at 3 rounds. The report example is realistic about flow. Both delivery routes were evaluated against Anthropic's documentation, with a recommendation, a two-build plan and a spike.
9. §8: modules align with `PLAN.md` §3; the 3D renderer is shared with the generator; the voxel mesher is only for multi-run columns.
10. §9: import scope and normalization tests; revised performance budgets with the audit's measurements; the Claude suite runs through the API adapter with size-specific expectations; usability task 5 reworded (a mirror-symmetric map keeps one start).
11. §10: each E-milestone is mapped to its roadmap milestone. Automatic slopes moved from E4 into E3. The 3D renderer is shared in E2. The E3, E5 and E8 in-game checks are extended.
12. §11: the contract is no longer restated here. It points to its single definition in `PLAN.md` §19.
