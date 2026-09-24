# Dam Good Maps: website plan

A static website where a player picks settings, generates a Timberborn map, sees it in the browser
and downloads a `.timber` file that loads and plays in Timberborn 1.1. This plan is meant to be
implemented directly. The facts it rests on are in
[investigation/REPORT.md](investigation/REPORT.md), [FORMAT.md](FORMAT.md) and
[investigation/calibration.json](investigation/calibration.json). The Python prototype in
[prototype/](prototype/) already implements a large part of it: one archetype, the exact water
model, the validator and the file writer.

The generator is the first half of one app. [EDITOR_PLAN.md](EDITOR_PLAN.md) plans the map editor
and the Claude integration, and [ROADMAP.md](ROADMAP.md) orders the work of both plans. The
foundations the two halves share (map spec, parametric features, set-piece builders, stable ids,
validation, format I/O, determinism and the build order) are defined once, in
[§19](#19-shared-foundations-with-the-editor). Every generated map is built from the same feature
objects the editor edits, from the first milestone on. [AUDIT.md](AUDIT.md) records why each part
changed during the plan audit.

## Contents

1. [What the investigation changed](#1-what-the-investigation-changed)
2. [Architecture and tech stack](#2-architecture-and-tech-stack)
3. [Project structure](#3-project-structure)
4. [How the prototype and calibration carry over](#4-how-the-prototype-and-calibration-carry-over)
5. [Settings](#5-settings)
6. [Theme presets](#6-theme-presets)
7. [Generation pipeline](#7-generation-pipeline)
8. [Archetypes](#8-archetypes)
9. [Set pieces](#9-set-pieces)
10. [Water simulation](#10-water-simulation)
11. [Validation](#11-validation)
12. [Interestingness score](#12-interestingness-score)
13. [Names and premises](#13-names-and-premises)
14. [Website features](#14-website-features)
15. [Testing](#15-testing)
16. [Milestones](#16-milestones)
17. [Risks and open questions](#17-risks-and-open-questions)
18. [In-game checklist](#18-in-game-checklist)
19. [Shared foundations with the editor](#19-shared-foundations-with-the-editor)
20. [Editor decisions](#20-editor-decisions)
21. [Changes from audit](#changes-from-audit)

---

## 1. What the investigation changed

Your brief was the starting point. These findings changed it; each is explained where it applies.

| Finding | Consequence for the website |
|---|---|
| Beavers cannot cross even a 1-voxel step without a Slope or stairs (stairs cost 70 science). | Terracing is also a reachability decision. The generator places Slopes to join every level the colony needs early, and validation measures reachable land, not "flat land". |
| All water sources stop in drought. | "Total flow strength" does not make droughts forgiving; stored water does. Flow and drought resilience become separate settings. |
| Normal starts with 130 food and **no water**; thirst deaths begin around day 5.7; a Folktails pump reaches 2 levels down. | Clean water within pump reach of the start is a hard rule, scaled by difficulty. |
| Moisture reaches 16 tiles from wide clean water at bank level, 6 fewer per level of bank. Living plants need moisture > 0. | Forests and berries are placed from simulated moisture. Living trees go on moist soil, dead stands on dry soil, exactly as the official maps store them. |
| The game's water rules are simple enough to port exactly for heightfield maps; the Python port matches the game's own save to 0.001 depth. | The preview shows the water the player will see, validation uses the same water, and maps ship pre-filled with settled water like the official ones. |
| Terrain is 23 layers; the editor caps terrain at 16; official maps all top out at 16. | "Max height" becomes a relief setting within 16 levels. Waterfalls and cliffs are bounded by that budget (§9). |
| Density depends strongly on map size (small maps carry 3–4× the scrap, trees and berries per tile). | Every amount is a size-aware rate interpolated from the official size classes, then scaled by the player's setting. |
| Official ruin fields: 97% of columns in fields of 10+, fill 0.56 of the bounding box, heights in clumps, only a weak lean of tall columns inward. | Ruins are generated as clumped blobs with a mild inward bias (§9.7), not a strong radial gradient. |
| Only Pine, Birch, Oak, Succulent and BlueberryBush load for both factions and in the editor. | The species mix offers exactly these five. |
| Pre-0.7 heightmaps and caves need extra format and water work; the 1.0+ objects differ widely in risk. | 1.0+ features are sorted into settings, theme ingredients and later/left out (§5.7). |
| Map edges drain, except the padding next to a source cell. Water surfaces settle flat at their spill level. (Audit experiment: a channel mouth wider than its row of edge sources lost all its water back off the edge.) | River mouths on the edge are sealed: sources fill the whole mouth, or the mouth is walled and fed by inland springs (§7.6). A lake's level is its outlet sill, not a free number, and a lake without inflow slowly evaporates. |
| A waterfall's width needs flow: lip depth is about 0.3·S/W. Official falls are 2–8 tiles wide on nearly every map, with lips 0.12–0.3 deep. The terrain budget allows a drop of at most 15 levels. | Waterfalls are sized by measured rules (§9.2): the header pool, the flow per tile of width, and the achievable drop. |

---

## 2. Architecture and tech stack

A fully client-side static site. There is no server; everything runs in the player's browser.

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | One language for UI, generator, worker and Node tools. The generator is a large algorithmic codebase that benefits from types. |
| Build | Vite | Fast dev server, worker bundling (`new Worker(new URL(…), {type:"module"})`), code-splitting for the 3D view. Static output. |
| UI | Preact + `@preact/signals` | About 5 KB. React-style components for the settings panel, map card and layers, with fine-grained updates while the worker streams progress. |
| Generator core | Plain TypeScript package (`src/core`) with no DOM access | Runs identically in the Web Worker, in Node (tests, batch runs) and in Vitest. |
| Worker RPC | Comlink (about 1 KB) | Typed calls into the worker; `transfer()` hands typed arrays over without copying. |
| 2D preview | Canvas 2D with an `ImageData` buffer | 256² tiles is 65k pixels: one `putImageData` per layer change, scaled up with smoothing off. No library needed. |
| 3D preview | three.js, lazy-loaded chunk | Only downloaded when the player opens 3D. Terrain columns are meshed as top faces plus side walls with greedy merging (about 40k quads on a 256² map); trees are instanced. |
| Zip | fflate `zipSync` with a fixed `mtime` | Small, fast and synchronous in the worker. A fixed mtime makes the zip byte-reproducible. |
| JPEG thumbnail | `jpeg-js` encoder in the worker (0.4.4, vendored as an ES module that returns a `Uint8Array`, D20) | Canvas `toBlob` encoders differ between browsers; a JS encoder gives the same bytes everywhere, keeping downloads byte-identical per seed. |
| Tests | Vitest (unit, golden files), Playwright (end-to-end and cross-browser determinism), plus the Python prototype as an oracle in CI | See §15. |
| Hosting | GitHub Pages from GitHub Actions: `timbermods.github.io/dam-good-maps/` | Free, the same place as the other timbermods sites, and no server to run. GitHub Pages cannot set response headers (no COOP/COEP), so `SharedArrayBuffer` threads are unavailable: parallel work runs as independent workers. |
| Second build target | A single-file build for publishing as a Claude artifact (EDITOR_PLAN.md §7) | The same code with platform adapters swapped (§19.9). Keep it possible from the start: data is bundled, not fetched at runtime; workers can be inlined; libraries come from npm, since the artifact can load scripts only from cdnjs/jsDelivr/unpkg. |
| Visual design | The org's Impeccable site flow and the timbermods design system (walnut lodge palette, `DESIGN.md`) | Keeps it part of the family; done as its own milestone once the tool works. |

### 2.1 Determinism

"Same seed and settings gives an identical file" must hold across Chrome, Firefox, Safari and
Node:

- **Random numbers.** `sfc32`, seeded through `splitmix32`. Layout planning draws from per-stage
  streams, `hash(seed, stageName, candidate, attempt)`. Everything placed *by a feature* (trees
  of a forest, columns of a ruin field, sources of a river) draws from that feature's own stream,
  `hash(seed, featureId, purpose)` (§19.7). Changing one forest's density then reshuffles
  neither the terrain nor the other forests, and an edit in the editor stays local.
- **Arithmetic.** Anything that affects output uses only `+ − × ÷`, `Math.sqrt`, `Math.floor`,
  `Math.round`, `Math.abs`, `Math.min` and `Math.max`, which IEEE-754 makes exact across engines.
  - `Math.sin/cos/exp/log/pow/atan2` are implementation-defined in precision, so they are not used
    on output paths.
  - Meanders use a polynomial sine (`core/math/detmath.ts`: an odd polynomial through x¹⁷ on an
    argument reduced to [−π/2, π/2], error below 1e-13). `exp` and `ln`, which the log-normal
    draws and the size-aware densities need, are built the same way from basic operations
    (D15).
  - Noise uses integer-hash value noise with a smoothstep fade.
- **Iteration order.** Always over typed arrays in index order. Priority queues break ties by
  index. No iteration over `Object` keys on output paths.
- **File bytes.** Entity Ids are GUIDs hashed from their owning feature (§19.4), `Timestamp` is a
  constant, zip mtimes are fixed and the JPEG encoder is deterministic.
- **Water.** The settled water written into the file always comes from the canonical settle
  (§19.7). It starts from a state computed only from the terrain and sources (empty, or the
  documented priority-flood pre-fill) and runs a fixed schedule. It never comes from an
  interactive, warm-started preview, because a warm start can end in a slightly different steady
  state (for example, thin sheets held at the 0.1 spill threshold).
- **Versioned reproduction.** A share link carries the generator version (§14.5). Every release is
  also deployed to `/v/<version>/`, so old links still reproduce their exact map after the
  generator changes.

### 2.2 Runtime flow

```
UI (main thread)                          Worker (core)
────────────────                          ─────────────
settings form ── URL ─┐
                      ├── generate(spec) ─────────▶ plan features → build (§19.8) → validate
                      │                              ◀── progress events (stage, attempt, %)
                      │                              ◀── candidate #1 (valid) → preview
                      │                              ◀── candidates #2..K, scores → best
map card, layers ◀────┴── result {spec, features, heights, water, entities, report, score, name}
download ── pack(result) ──────────────────▶ writer → Uint8Array (.timber) ── Blob → save
"Refine this map" ── result as a MapDocument (§19) ──▶ editor (EDITOR_PLAN.md)
```

The first valid candidate is shown at once. The remaining candidates are scored in the background,
and the preview switches to the best one with a short notice. The map card says "best of 3".

### 2.3 Ratings without a server

A **GitHub issue form, pre-filled from the page**.

- "Rate this map" opens
  `github.com/timbermods/dam-good-maps/issues/new?template=map-rating.yml&…` in a new tab. The seed,
  settings, share URL, generator version and score are already filled in.
- The player picks one of *fun / too easy / boring terrain / frustrating / broken* and can add a
  comment.
- A labelled issue lands in the repo. `tools/ratings.ts` uses `gh api` to pull labelled issues into
  `ratings.csv`: settings, score, rating, comment.
- The tuning loop joins those ratings to the score components, and recomputes the calibration
  report per theme.

Why this choice:
- It is free, structured and public, and you already live in GitHub.
- It is spam-resistant, and you can reply to players.
- The cost is that raters need a GitHub account.
- A "Copy rating" button gives the same text for Discord or the Steam workshop page.

Alternatives considered:
- Google Forms: no account needed, but a second system and less transparent.
- GoatCounter or Plausible custom events: anonymous, but they cannot carry comments.
- A Cloudflare Worker: needs a server.

If GitHub accounts turn out to suppress ratings, a pre-filled Google Form can be added behind the
same button without touching the generator.

---

## 3. Project structure

```
dam-good-maps/
├─ PLAN.md  FORMAT.md  README.md  LICENSE
├─ package.json  vite.config.ts  tsconfig.json  vitest.config.ts  playwright.config.ts
├─ index.html
├─ src/
│  ├─ core/                        pure TS, no DOM: runs in worker, Node and tests
│  │  ├─ math/        rng.ts (splitmix32, sfc32, streams)  hash.ts (murmur3, ids)  noise.ts  detmath.ts (sin, exp, ln)
│  │  │               grid.ts (typed 2-D helpers, chamfer distance, level regions, heap)
│  │  ├─ format/      timber.ts (read/write zip)  world.ts (world.json encode/decode)  json.ts (C# float format)
│  │  │               entities.ts (templates, component builders)  footprints.ts (generated from notes/footprints.json)
│  │  │               normalize.ts (import normalization, §19.6)  base64.ts
│  │  │               vendor/jpeg-encoder.js (jpeg-js encoder)
│  │  ├─ render/      shade.ts (top-down colours, the thumbnail)
│  │  ├─ sim/         water.ts (exact single-layer port, active list, settle test)  prefill.ts (pre-fill, canonical settle)
│  │  │               model.ts (emitters and obstacles by footprint)  moisture.ts  contamination.ts  drought.ts
│  │  ├─ analysis/    regions.ts (walk regions with slopes, components)  damsites.ts
│  │  │               later: features.ts (rivers, falls, islands, plateaus)
│  │  ├─ spec/        mapspec.schema.json  mapspec.ts (MapSpec, defaults, presets, URL codec, merge patch)  §19.1
│  │  │               schema.ts (the eval-free schema checker, D16)  mergepatch.ts (RFC 7396)
│  │  ├─ features/    schema.ts (every feature kind and its params, §19.2)  features.schema.json  ids.ts (§19.4)
│  │  │               geometry.ts (river paths, bed profiles, polygons)  slopes.ts (derived slopes, §7.5)
│  │  │               raster/*.ts (one rasterizer per kind)  setpieces/*.ts (shared builders, §19.3)
│  │  │               build.ts (the one build pipeline, §19.8, with dirty-region rebuilds)  target.ts  edits.ts (entity and slope edits)
│  │  ├─ doc/         document.ts (MapDocument, project files)  base.ts (the stored map)  ops.ts (edit operations)
│  │  │               session.ts (apply, undo and redo, regenerate, export: what the editor runs)
│  │  ├─ gen/         generate.ts (spec → features, then build, retries)  riverValley.ts (one planner per archetype)
│  │  │               calibrated.ts (size-aware densities)  blobs.ts (ruin and grove shapes)  pack.ts (file, name, thumbnail)
│  │  ├─ validate/    checks.ts (load and design classes, placement emulation, validateMap)  playability.ts
│  │  │               report.ts (result shape, severity per profile, blocking, groups; §19.5)
│  │  ├─ score/       score.ts  naming.ts
│  │  └─ data/        footprints.json (the calibration subset lives in gen/calibrated.ts, tested against calibrated.py)
│  ├─ platform/       adapters: files (save/open), storage, workers, claude (§19.9)
│  ├─ render3d/       the one 3D renderer, used by the generator preview and the editor
│  ├─ worker/         generator.worker.ts (Comlink API: generate, build, pack, cancel)
│  ├─ ui/             App.tsx  SettingsPanel.tsx  Preview2D.tsx  Preview3D.tsx (lazy)  MapCard.tsx  Layers.tsx
│  │                  Download.tsx  Share.tsx  Rate.tsx  InstallHelp.tsx  state.ts (signals)
│  ├─ editor/         the editor UI (EDITOR_PLAN.md §8)
│  └─ styles/
├─ tools/            gen.ts (batch generation)  oracle.ts (Python oracle)  bench.ts  ingame-files.ts  export-footprints.ts
│                    batch.ts (Node: N seeds → first-attempt and final pass rates)  golden.ts
│                    ratings.ts (issue export)  export-fixtures.py (Python → tests/golden/water.json.gz)
├─ tests/            unit/  contract/ (§15)  golden/ (fixed seeds → sha256 + key metrics)  e2e/ (Playwright)
├─ prototype/        Python reference implementation and test oracle (kept, see §4)
├─ investigation/    report, calibration, notes, scripts (raw/ and decompiled/ stay local)
├─ out/              prototype test map and batch results; m1/ and later: the files for the in-game checks
└─ .github/          workflows/ci.yml (typecheck, unit, contract, oracle, bench, e2e) · deploy.yml (Pages, /v/<version>/)
                     ISSUE_TEMPLATE/map-rating.yml
```

---

## 4. How the prototype and calibration carry over

The Python prototype is not thrown away. It becomes the **reference implementation and the
oracle** the TypeScript port is tested against.

| Python (prototype/) | TypeScript (src/core/) | How it is kept in step |
|---|---|---|
| `tbmap.py` writer and reader | `format/*` | CI generates maps with the Node CLI, and the Python `roundtrip_test.py` and `validate.py` must pass on them. |
| `watersim.py` (water, moisture, contamination) | `sim/*` | `tools/export-fixtures.py` writes golden vectors: terrain, sources and the state after 50/200/975 ticks, plus steady-state moisture, soil contamination, the pre-fill, the canonical settle and the drought storage, on a dozen small terrains. TS must match within 1e-6 (depth) and exactly on the moist/dry mask; it matches bit for bit. The game's own save is a local-only test (it is not ours to commit): 975 ticks from empty reproduce it within 0.001. |
| `analysis.py` (distances, regions, basins, dam sites) | `analysis/*` | The same fixtures carry expected region sizes and dam-site volumes. |
| `validate.py`, `playability.py` | `validate/*` | Check ids are identical. The oracle job runs both validators on the same 50 maps; their verdicts must agree check by check. |
| `generate.py`, `terrain.py`, `ruins.py`, `vegetation.py` | `gen/*` | Ported as the River Valley archetype for roadmap milestone M1, as feature planners (§7, §19). Not byte-compatible (numpy RNG differs from sfc32); compared through their calibration metrics instead. |
| `calibrated.py` | `data/calibrated.ts` | One table (§5, §11). A test asserts the TS table equals `prototype/calibrated.py`. **The two disagree today.** The difficulty rules in §5.6 are the design intent; `calibrated.py` still has badwater minimum distances of 30 / 20 / 12 (§5.6: 40 / 30 / 15) and a 750-tile minimum reach, which is the Tight value (the §5.2 default, Normal, is 1,300). Align `calibrated.py` to this plan in milestone M1, before the equality test is written. |
| `investigation/analyze_maps.py` | `tools/batch.ts` reuses `analysis/*` | Generated maps are measured with the same yardstick as the official maps, so the batch report can print "generated vs official" side by side. |

`investigation/calibration.json` is the source of truth for every target. `data/calibration.json`
is a trimmed runtime copy with the aggregates and size-class medians only (about 20 KB).
Re-running `analyze_maps.py` after a game update regenerates both.

---

## 5. Settings

Defaults are for the River Valley theme at Normal. A theme preset (§6) overwrites them, and the
player can then change anything. Each setting maps to generator targets. **Size-aware** means the
value is a multiplier on the official size-class median, interpolated in log(area) between
small (50–100²), medium (128²), large (192²) and max (256²).

### 5.1 Basics

| Setting | Values | Default | Notes |
|---|---|---|---|
| Seed | 0 – 4,294,967,295 | random | Shown as a number; also accepted as text, hashed to a number, so "beaver" is a valid seed. |
| Size | Small 96², Medium 128², Large 192², Max 256², Custom | Medium | 128² is the game's default new-map size. Custom width and height are each 48–256 (the game allows 4–256, but under 48 there is no room for a start zone and a river). Non-square is allowed, as in official maps. |
| Theme | River Valley, Canyon, Highlands, Lake Basin, Delta, Islands | River Valley | Pre-fills everything below (§6). |
| Designed for | Easy, Normal, Hard | Normal | The in-game difficulty the map is balanced for. It sets starting-area rules and drought sizing (§5.6). The map works on any difficulty, and the card warns if you pick Hard for a map designed for Easy. |

### 5.2 Terrain

| Setting | Range | Default | Maps to (official calibration) |
|---|---|---|---|
| Relief | Gentle 0 – 100 Dramatic | 55 | Height range p5–p95 = 7 + 0.08·relief levels (7–15; official 9–15, median 13). Cliff-tile share 0.06 + 0.0018·relief (0.06–0.24; official 0.07–0.24, median 0.16). |
| Highest terrain | 10 – 16 | 16 | Terrain never exceeds this. 16 is the map editor's limit and every official map's top. Heights 17–22 are allowed by the game but are left out: the editor cannot edit them (open question, §17). |
| Terracing | Smooth 0 – 100 Distinct | 50 | The share of height steps that are one level: 0.86 − 0.0059·terracing (0.86–0.27; official median 0.62). Higher terracing gives wider flat benches and more cliffs. |
| Buildable land | Tight, Normal, Generous | Normal | Land walkable from the start through slopes of at least 750 / 1,300 / 2,500 tiles (official min 765, median 1,296, p90 4,523), and flat share 0.40 / 0.52 / 0.60. |

### 5.3 Water

| Setting | Range | Default | Maps to |
|---|---|---|---|
| Rivers | 0 – 3 | theme | Number of river systems, each with 1–2 entry points on the map edge. 0 means only lakes, springs and seeps. |
| River style | Straight, Meandering, Braided | Meandering | Straight: meander amplitude ≤ 0.05·H. Meandering: 0.12–0.2·H with 1–3 bends per 100 tiles. Braided: the channel splits into 2–4 parallel channels around islands over a wide flat stretch (Delta). |
| River flow | Trickle, Normal, Strong, Lush | Normal | Total clean source strength: 0.6× / 1× / 2× / 4× the size-aware official median (medium 2.2, large 1.2, max 1.1 per 10k tiles). Lush is about the workshop median. Sources are mostly 0.5 each, in rows of 3–8 across a channel, as in official maps. This controls river size and how fast reservoirs refill, **not** drought survival. |
| Drought reserve | Scarce, Normal, Plenty | Normal | Minimum stored water near the start, as a multiple of the colony's drought need (§11.4): 1× / 1.5× / 3×. Also sets the number of dam sites and natural basins the layout aims for. This setting is what makes droughts forgiving. **Not every combination fits a small map** (§9.1, §9.10). Reservoirs are 2 deep on Easy and Normal and 3 deep on Hard, so Hard with the Normal reserve needs about 590 tiles and Hard with Plenty about 1,170. The panel disables combinations whose reservoir would exceed 15% of the map area and says why. The smallest sides that fit are: Normal with Plenty 51, Hard with Scarce 52, Hard with Normal 63, Hard with Plenty 89. Every size preset (96² and up) fits every combination, so the guard only affects custom sizes. |
| Lakes and basins | None, Few, Some, Many | Some | Natural basins of 20+ tiles that hold water without a dam: 0 / 0.5× / 1× / 2× the official median for the size (large maps have about 15). |
| Waterfalls | Off, Few, Many | Few | Number of bed drops of 2+ levels: 0 / 1–2 / 3–6. Drop height, width and flow ranges in §9.2. Generated falls sit on rivers and carry that river's flow, so they are 1–9 tiles wide, like official falls. Wider "landmark" falls are a set piece the player or Claude adds. |

### 5.4 Hazards

| Setting | Range | Default | Maps to |
|---|---|---|---|
| Badwater | Off, Low, Normal, High | Normal | Badwater-to-clean strength ratio 0 / 0.3 / 0.65 / 1.2 (official 0.18–2.2, median 0.65). Sources are BadwaterSource 3×3 at strength 1–3, inland on mid-height ground (as in official maps: none are on the edge). |
| Badwater distance | 12 – 60 | 30 (Easy 40, Hard 15) | Minimum distance from the start to badwater or contaminated soil (official p10 12, median 30). |
| Thorn belts | Off, Some | Some (Highlands, River Valley) | 1–3 belts of 13–40 thorns across corridors or plateaus, never within 20 tiles of the start. |
| Unstable cores | Off, On | Off | Advanced. 1–4 cores, 40+ tiles from the start, first countdown at cycle 5+, radius 2–3, never within radius + 2 of each other or of a dam site (no chain reactions). |

### 5.5 Resources

| Setting | Range | Default | Maps to |
|---|---|---|---|
| Forest density | 50% – 200% | 100% | Trees per 10k tiles, size-aware (small 1,715, medium 1,061, large 534, max 500). Living share comes from moisture (official 0.33). |
| Grove size | Scattered, Normal, Big woods | Normal | Grove size median 6 / 10 / 20 trees, with a log-normal tail capped at 120 / 180 / 300. Groves are single-species, as every official grove of 20+ is. |
| Species mix | weights for Pine, Birch, Oak, Succulent | 47 / 27 / 20 / 6 | The only species that load for both factions and in the editor. Succulents go on dry soil only. |
| Berries near start | 20 – 100 | by difficulty (Easy 20, Normal 48, Hard 60): the generation target; §5.6 gives the lower minimum that validation enforces | Living bushes within 20 tiles of the start, in 2–3 patches beside water. |
| Berry bushes elsewhere | 50% – 300% | 100% | Bushes per 10k tiles, size-aware (medium 92, large 40), in patches of about 20–40 beside water. |
| Ruins and scrap | 25% – 300% | 100% | Scrap per 1k tiles, size-aware (small 840, medium 705, large and max 236). |
| Relics | Off, Some | Some | 0–3 small (13–70 tiles out), 0–2 medium (40–140), 0–1 large (140+, maps ≥ 192²). |
| Geothermal fields | Off, Some | Some | 1–3 per map, 30–120 tiles out, flat, dry, outside flood reach. |
| Mine sites (UndergroundRuins) | 0 – 4 | 1 / 2 / 3 / 3 by size | Flat 5×5, no cave below, 60+ tiles out (official 24–173, median 89). |

### 5.6 Start and difficulty

The difficulty preset sets these; each can be overridden under "Start rules".

| Rule | Easy | Normal | Hard | Source |
|---|---|---|---|---|
| Clean pumpable water within | 10 | 16 | 22 | Official median 13.8, p90 22. Water must be 0–2 levels below the start (pump reach). |
| Trees within 20 tiles | 80 | 50 | 40 | Official median 117, p10 47. |
| Living bushes within 20 | 20 | 40 | 40 | Normal food lasts about 3.75 days; official median 47. |
| No badwater within | 40 | 30 | 15 | Official p10 12, median 30. |
| No ruins within | 20 | 15 | 12 | Official p10 22; scrap within 40 is 0 on the median official map. |
| Drought sized for | 4 days, 40 beavers | 9 days, 50 beavers | 30 days, 50 beavers | Game mode durations. |
| Stored water needed near start | 86 | 253 | 1,174, at 3+ deep | §11.4 formula. |
| Start bench | radius 6 | radius 6 | radius 5 | A levelled pad around the district center. |

| Setting | Values | Default |
|---|---|---|
| Start area | Small, Normal, Large | Normal: bench radius 5 / 6 / 8, reachable land ×0.6 / ×1 / ×1.8 |

### 5.7 The 1.0+ map features

| Feature | Decision | Why |
|---|---|---|
| Slopes | **Always**, generated (§7.5) | Required for walking between levels. |
| NaturalDam | Theme ingredient: the "pre-built weir" variant of the dam site (Lake Basin, River Valley) | A 0.65 weir across a 1-deep channel; the heightfield water model supports partial obstacles. |
| Blockage | Theme ingredient: "plugged spillway" set piece (§9.6) | A demolish-to-release water event; simple full-height obstacle. |
| Thorns | Setting (Thorn belts) | A cheap, readable soft wall with a cost to clear. |
| Relics | Setting | A science reward scaled by distance; pure payoff for exploring. |
| GeothermalField | Setting | Free 400 hp power; a strong mid-map objective. |
| UndergroundRuins | Setting (Mine sites) | Every official map has 1–4; the late-game scrap source. |
| UnstableCore | Advanced setting, off by default | Destroys terrain and objects and cannot be removed; fun on purpose, disastrous by accident. |
| NaturalOverhang bridges | Later (ROADMAP.md, Later): natural bridge over narrow 1-deep channels (Delta, Islands) | Needs water under a slab. Fine when water is under 1 deep, but needs stacked-column water to validate in general. |
| WaterSeep / BadwaterSeep | Later: "oasis" ingredient for an arid theme | They cap at 0.8 depth and stop in drought; they need their own tuning. |
| Aquifer + AncientAquiferDrill | Left out for now | Water only while a powered drill stands on it, and per the code only in temperate weather (needs an in-game check). Adds little to a generated map. |
| BadtideDrain | Left out for now | Needs a roofed cliff notch (stacked water columns) and only runs in badtide. Revisit with cave support. |
| Caves and terrain overhangs | Left out for now | Terrain physics (3-tile support rule) and stacked water columns. The heightfield model cannot validate them. |
| Reserve stockpiles | Left out | Used by one official map; faction-good pitfalls. |

---

## 6. Theme presets

Each preset pre-fills the settings and picks the archetype layout (§8). Anchors are the official
maps whose measured numbers the preset follows.

| Setting | River Valley | Canyon | Highlands | Lake Basin | Delta | Islands |
|---|---|---|---|---|---|---|
| Anchors | Meander, Plains | Canyon, Waterfalls, Cliffside | MountainRange, Hollows, HelixMountain | Lakes, Beaverome, Craters | Spillage, Lakes | ThousandIslands |
| Relief | 50 | 80 | 90 | 40 | 20 | 35 |
| Terracing | 45 | 75 | 60 | 40 | 25 | 30 |
| Buildable land | Normal | Tight | Tight | Normal | Generous | Normal |
| Rivers / style | 1 meandering | 1 straight | 2 meandering | 2–3 into a lake | 1 braided | 0 (sea) + 1–2 inflows |
| River flow | Normal | Normal | Normal | Strong | Strong | Lush |
| Drought reserve | Normal | Normal | Normal | Plenty | Scarce | Plenty |
| Lakes and basins | Some | Few | Some | Many | Few | None |
| Waterfalls | Few | Many | Many | Few | Off | Off |
| Target water share | 0.12 | 0.10 | 0.08 | 0.30 | 0.25 | 0.45 |
| Badwater | Normal | Normal | Low | Normal | Normal | Low |
| Thorn belts | Some | Off | Some | Off | Off | Off |
| Forest density | 100% | 80% | 90% | 100% | 120% | 100% |
| Ruins and scrap | 100% | 120% | 100% | 100% | 80% | 100% |

Target water share comes from the anchors' saved water: Meander 0.14, Canyon 0.10, MountainRange
0.08, Lakes 0.14, Beaverome 0.45 and ThousandIslands 0.50. It is a layout target; validation caps it
at 0.35, and at 0.55 for Islands and Lake Basin.

---

## 7. Generation pipeline

Composed maps: intent first, then layout, set pieces, terrain around them, and detail last. Noise
only adds natural variation to edges. The Python `prototype/generate.py` implements this pipeline
for River Valley.

**Features first.** Stages 1–3 *plan*. Their output is a list of parametric feature objects
(§19.2): the rivers with their bed profiles, lakes and basins, landforms (valley floor, terraces,
highlands, plateaus, islands), set pieces with resolved parameters, forests, berry patches, ruin
fields, map objects and the start. Stages 4–7 *build* the map from that list with the shared build
pipeline (§19.8), the same code the editor runs after every edit. The terrain, water and entities
of a generated map are therefore exactly what its features rasterize to. "Refine this map" hands
the editor that feature list, and the player can grab any river, plateau or ruin field at once.
The detected features in §7.10 (`derived`) are measurements for labels, names and scoring. They
are not what the editor edits.

```
spec ──▶ 0 normalise ──▶ 1 concept ──▶ 2 macro layout ──▶ 3 set pieces   ═══▶ Feature[] (§19.2)
                                                                                   │
                     build (§19.8): 4 terrain ▸ 5 connect ▸ 6 water ▸ 7 detail ◀──┘
                                                                                   │
  result ◀── 10 name ◀── 9 score (K candidates) ◀── 8 validate / retry ◀───────────┘
```

### 7.0 Normalise

- Validate the `MapSpec` (§19.1) against its schema. Clamp every setting and resolve size-aware
  targets: `target = multiplier × density(key, W·H)`.
- Derive the difficulty rules.
- Take the spec's constraints: locked regions, keep-out regions and the ids of features to keep
  (user and Claude features on regeneration). The planner treats them as occupied and protected,
  so regeneration never routes a river through a player's plateau.
- Derive seed streams: `layout`, `terrain`, `setpieces`, `water`, `veg`, `ruins`, `extras` and
  `names`, each `hash(seed, stream, candidate, attempt)`.

### 7.1 Concept

The archetype comes from the theme. Roll a **premise variant**: each archetype has 2–4 (§8), for
example River Valley's "gorge-dammed basin", "twin falls" and "oxbow bend". The variant decides which
set pieces are mandatory. The premise also fixes the macro parameters: the flow axis (one of 8
edge-to-edge directions, so maps are not always west to east), the meander phase, and the
anchor positions as fractions of the map.

### 7.2 Macro layout

A small graph of **zones** placed by rules, before any heights exist:

| Zone | Rule |
|---|---|
| Start zone | 40–60% of the way along the main river, on the inside of a bend. Its centre is 6–10 tiles from the channel edge (the prototype uses 6–9), so pump reach and the calibrated water distance hold. It stays 25+ tiles from the map edge on maps ≥ 128². The start bench level is one above the floodplain. |
| River paths | Polylines from entry edge to exit edge. Each carries a **bed profile**: a non-increasing level per segment, with steps only at planned cascades or waterfalls. Upstream reaches sit higher than any downstream dam crest (§9.1), so reservoirs never drain back to the entry edge. |
| Highlands | 1–3 regions away from the start, raised 3–8 levels, holding plateaus and dry dead-forest benches. |
| Expansion zones | A second district site (§9.8) 60+ tiles from the start on maps ≥ 128². |
| Hazard zones | Badwater sources inland, downstream of the start in water terms: their water must drain to an edge without passing the start's river reach, or be held in a closed basin with a narrow outlet (§9.5). |
| Set-piece anchors | Tiles where §9 builders run: the dam site between the start zone and the next falls, waterfalls on bed steps, ruin fields on flat dry ground 20–40% / 40–70% / 70–100% of the way to the far edge. |

Zones are checked for spacing before any terrain exists. A layout that cannot satisfy them is
re-rolled from the `layout` stream, which is much cheaper than failing validation later.

### 7.3 Set pieces

Each set piece (§9) is a shared builder (§19.3), the same one the editor's tools and Claude use.
`plan(params, context, rng)` resolves its anchor and footprint and clamps its parameters to the
achievable ranges, reporting every adjustment. `rasterize(plan, target)` writes into:
- a height **constraint field**: exact levels, minimum and maximum levels per tile;
- a **protected mask**: tiles later stages may not change;
- its water sources and the list of entities it clears.

In generation the context is the macro layout; in the editor it is the current map. The resolved
parameters are stored in the set-piece feature, so rebuilding never re-plans it. For example, the
dam site protects its abutments and basin floor. Set pieces are planned in order of priority
(start, dam site, waterfalls, second district, ruins-on-plateau, badwater basin), so the important
ones get space first. Planning priority only decides who gets space. Build order is §19.8.

### 7.4 Terrain

1. **Base field.** For every tile, the level implied by the layout:
   - river channel = bed profile;
   - floodplain = bed + 1;
   - terraces rise with distance from the floodplain in bands 9–16 tiles wide;
   - highlands have their own base level;
   - set-piece constraints override all of these.
2. **Terracing.** Band rises are 1 level with probability `p1` (the terracing setting); otherwise
   2 or 3 levels (cliffs, 70/30).
3. **Edge wiggle.** Band edges follow a noisy distance: distance plus value noise of amplitude 3–5
   tiles, with a feature size of 24 and 8 tiles. Noise never changes levels directly, so plateaus
   stay flat.
4. **Relief fit.** Rescale band rises until the p5–p95 height range and the cliff share meet the
   relief targets (±1 level). Clip to the highest-terrain setting (at most 16). Layer 22 stays
   empty.
5. **Flat pads.** Level the start bench (radius 5–8) and every set-piece footprint that needs flat
   ground: ruin fields, mine sites, geothermal fields, badwater source 3×3s.
6. **Integrity pass.**
   - Remove single-tile pits and spikes (a tile differing from all 4 neighbours).
   - Enforce bed profiles non-increasing downstream.
   - Ensure every channel tile has lower or equal neighbours downstream, so water always has a path
     to an edge or a planned basin.

### 7.5 Connect: slopes

Beavers cannot cross a 1-level step. Stairs cost 70 science, and 2+ level cliffs need player stairs
or ramps anyway.

1. Label same-level regions (4-connected).
2. Build the region graph: an edge exists wherever two regions differ by exactly one level along
   a boundary.
3. From the start's region, grow a spanning tree over regions within 40 tiles of the start, plus
   every region that holds the pumpable water edge, the near-start groves and berries, and the
   second district. For each tree edge, place one Slope on the boundary pair nearest the start.
   - The low tile must be free, and the tile behind its low side must be at the same level.
   - Orientation comes from the high side: Cw0 if the high side is south (y−1), Cw90 west,
     Cw180 north, Cw270 east.
   - Long boundaries (60+ pairs) get a second slope at least 12 tiles from the first.
4. Beyond 40 tiles, add one slope per region of 400+ tiles toward its lowest neighbour.
5. Leave 1–2 plateaus deliberately unconnected when a set piece asks for it: the "ruins on a
   plateau need stairs" payoff.
6. Target density is 2–6 slopes per 10k tiles on large maps and up to 20 on small ones (official:
   max-size maps 1.9, small 18).

### 7.6 Water

1. Place sources:
   - Clean sources are 1×1 `WaterSource`s at 0.5 (0.25–1.0), in rows across each river's entry
     channel on the map edge. Edge padding next to a source is a wall, so edge sources don't leak.
     **The row must fill the whole mouth**: every channel tile on the border row is a source, or
     the bank is higher than the water there. The padding next to any other border tile is a sink.
     In an audit run of the water port, a 20-wide mouth with 4 sources lost all its water back off
     the edge. Inland springs avoid the problem.
   - Springs are inland sources on highland plateaus feeding cascades.
   - Badwater sources are 3×3 at 1.0–3.0 strength, placed per §9.5.
   - Total strength follows the flow setting.
2. Run the canonical settle (§10, §19.7): the exact simulation to steady state from the
   deterministic pre-fill.
3. Compute moisture and soil contamination at steady state.
4. If the water share exceeds the theme target by 50%, or the settled rivers are not where the
   layout put them (overlap with the planned channel mask below 0.8), adjust strength once and
   re-run. Otherwise re-roll the layout.

### 7.7 Detail

Every placement uses the footprints in `footprints.json` and marks occupied cells, so objects never
overlap.

1. **Start**: one `StartingLocation` on the bench, the door facing the river. Keep clear a
   Chebyshev radius of 3 around it and the 3×3 in front of the entrance.
2. **Berries**: 2–3 patches of blueberry bushes within 16 tiles of the start on moist soil beside
   clean water, until the difficulty minimum is met. Then patches elsewhere (median 20–40, beside
   water) up to the density target. Bushes are ripe (`GatherableYieldGrower 1.0`) near the start and
   55% ripe elsewhere, as in official maps.
3. **Forests**:
   - Groves are single-species blobs grown with a compactness of about 0.8, sized log-normal around
     the grove-size median.
   - Near-start groves come first: at least 40 living trees within 18 tiles.
   - Then living groves on moist soil up to about 40% of the tree target, then dead groves on dry
     soil.
   - Succulent groves go on dry soil and are alive.
   - Living trees: 35% saplings (`Growable` 0.2–0.95).
   - Dead trees: `LivingNaturalResource.IsDead`.
4. **Ruins**: §9.7.
5. **Extras**: mine sites, relics, geothermal fields and thorn belts, by distance band from the
   start, on flat dry ground outside flood reach.

### 7.8 Validate and retry

Run every check in §11. On failure, retry the whole candidate with `attempt + 1`: a new layout
stream and so a new map from the same seed. After 12 attempts, show the best failing candidate with
its report and a "Try another seed" button. Prototype pass rates are 88% (96²) and 62% (128²) on
the first attempt and 100% within 6.

### 7.9 Candidates and score

Build K = 3 valid candidates (candidate index 0, 1, 2 in the seed streams) and keep the highest
score (§12). K is 1 on 256² when the first build took over 6 s; the card then says "single
candidate". The M2 benchmark left the 256² settle well under 3 s (§10, D33), so K = 3 stays the
default at every size.

### 7.10 Output

```ts
interface GeneratedMap {
  spec: MapSpec;                       // §19.1, with `accepted: {attempt, candidate}` filled in
  features: Feature[];                 // §19.2: the parametric objects the map was built from, stable ids (§19.4)
  size: { x: number; y: number };
  heights: Uint8Array;                 // surface level per tile
  water: { depth: Float32Array; contamination: Float32Array; moisture: Float32Array; soilContamination: Float32Array };
  entities: EntitySpec[];              // template, x, y, z, orientation, flipped, components, ownerFeatureId
  derived: DetectedFeatures;           // measured: falls, dam sites, plateaus, islands, groves (labels, names, score)
  report: ValidationReport;            // §19.5: every check with id, class, severity, ok, value, limit, message, where, fix
  score: ScoreBreakdown;
  name: string; premise: string;
  generatorVersion: string;
}
```

`features` is what the editor opens: `toDocument(result)` wraps it with the spec and the built
base into a `MapDocument` (EDITOR_PLAN.md §3) without any conversion. `derived` drives the preview
labels, the map card and the name.

---

## 8. Archetypes

Each archetype is a layout function (`gen/layout/<name>.ts`) plus its premise variants. The
variant's must-have set pieces are listed in brackets.

| Archetype | Layout rules | Premise variants |
|---|---|---|
| **River Valley** (prototype) | One river crosses the map along the flow axis, inside a valley floor 0.35–0.45·H wide. Terraces rise to highlands at both sides. The bed descends in 2–3 steps. The start is on a bench above the widest basin. | *Gorge-dammed basin* [dam site, falls]; *Twin falls* [2 waterfalls, dam site]; *Oxbow bend* [natural basin in a cut-off loop, dam site] |
| **Canyon** | The river runs 4–8 levels below a plateau in a canyon 12–25 tiles wide. Rims are 1–2 terraces wide, with side canyons every 40–70 tiles. The start is on a canyon-floor bench, with slope chains up the walls near the start. | *Narrows* [dam site in a narrows, 2+ waterfalls]; *Rim settlement* [start on the rim, water reached by a slope chain; stored water in rim basins] |
| **Highlands** | 2–4 plateaus at different levels, joined by cliffs. Inland springs on the highest plateau feed streams that cascade to a lowland river or lake. The start is on a mid plateau beside a stream. | *Staircase* [3+ waterfalls, terraced cliffs]; *Twin plateaus* [ruins on a plateau needing stairs, dam site on the upper stream] |
| **Lake Basin** | A central lake at spill level, fed by 2–3 rivers from the edges, with one outlet to an edge through a narrow gap: the prime dam site, which raises the whole lake. The start is on a shore bench 1 above the lake. | *Rising lake* [outlet dam site with a huge ratio, NaturalDam weir variant]; *Crater lakes* [2–3 basins at different levels joined by falls] |
| **Delta** | A wide low plain in the downstream half. The river braids into 2–4 channels around islands and exits along 30–60% of one edge. The start is at the head of the delta on a bench. | *Many mouths* [4+ small dam sites, islands]; *Salt marsh* [badwater marsh in the lower delta, containable per §9.5] |
| **Islands** | A sea or lake filling 45–55% of the map, held by a rim with 1–2 outlets. Inflow rivers come from the edges. 6–25 islands of 100+ tiles, with the start on the largest island or shore. Islands without slopes are reachable over shallow water (water never blocks walking). | *Archipelago* [islands of varied heights, relics on far islands]; *Atoll* [ring island around a lagoon, dam site at the lagoon mouth] |

Layout parameters per archetype live in `gen/layout/<name>.ts` as a typed table, so they can be
tuned from rating data without code changes.

---

## 9. Set pieces

Each set piece lists what it builds, the ranges the game's limits allow, and the constraint that
validation proves. "Levels" are terrain levels. The terrain budget is 0–16: 0 is an empty column
(ground at level 0, used by official maps as river outlets), and 16 is the in-game editor's limit.
Every builder here is a shared set-piece builder (§19.3). The generator, the editor's tools and
Claude all call the same code, and each builder publishes its achievable ranges for the current
map (§9.10). Values outside the schema's hard bounds are rejected. Values inside them but beyond
what the map allows are reduced to the nearest achievable value, and the reduction is reported.

### 9.1 Dam site (gorge and basin)

- **What it builds:**
  - A basin of 150–1,500 tiles on the river upstream of a narrows.
  - The narrows: a ridge 3–6 tiles thick across the valley, cut by the channel, 3–9 tiles wide at
    the crest line.
  - Ridge top at crest + 2 or more. It extends at least 10 tiles past the valley floor into the
    terraces, so the reservoir cannot leak around it.
- **Crest options:** a player dam of 0.65, levees of 1 per level, 1–3 levels above the bed.
- **Upstream bed:** the river entering the basin must sit at crest level or higher. Otherwise the
  raised water backs up to the entry edge and drains off the map; the prototype failed exactly this
  way before the cascade was added.
- **Achievable reservoir:** volume = basin tiles × mean depth. With crest 2 above the bed: about
  150–3,000 blocks (official best dam-site volume per dam tile: median 470, p90 4,479).
- **Limits (audit):**
  - Dam height (crest above the bed) is useful at 1–3 levels, 4 at most. A Folktails WaterPump
    reaches 2 levels below its base, a LargeWaterPump 4, and the Iron Teeth DeepWaterPump 6.
    Water deeper than that is storage the colony cannot pump. The ridge top can go up to 16.
  - The basin is capped at 15% of the map area: 48² ≤ 345 tiles, 96² ≤ 1,382, 128² ≤ 2,457. The
    150–1,500 range above is for 128² and larger; on smaller maps it scales with area.
  - The reservoir must never touch a map edge. Edges drain, except next to a source.
  - The reservoir a difficulty needs, and so the minimum map size, is in §9.10.
- **Validated:** a straight dam line through a channel tile holds `need × drought reserve`
  within 40 tiles of the start. The flood fill must not reach an edge or go around the line
  (`analysis/damsites.ts`).
- **Variants:**
  - *Natural weir*: a `NaturalDam` line across the narrows channel pre-holds 0.65.
  - *Plugged spillway*: §9.6.

### 9.2 Waterfall and cascade (power spot)

- **What it builds:** a bed drop of D levels over one tile, with the channel narrowing to 1–3 tiles
  for 3–6 tiles above the drop. Water wheels want fast, narrow flow.
- **Two modes (one builder):**
  - *On a river* (what the generator makes). It splits the river's bed profile at the lip, and the
    river's own flow goes over it.
  - *Standalone* (a landmark added in the editor or by Claude). It builds its own cliff, a
    **header pool** one level below the lip, inland springs feeding the pool, the plunge pool, and
    an outflow to an edge or an existing river.
- **Achievable drops** (measured with the prototype water port in the audit, §9.10). The drop does
  not depend on map size.
  - The hard maximum with editor-safe terrain is **15 levels**. The lip is a bed at 15 with banks
    at 16, and the plunge pool is at level 0, draining to an edge at level 0. The port measured a
    surface drop of 14.98.
  - Practical within a layout is **12**: keep beds between 2 and 14, so there is a floodplain
    below and banks above. Typical is 3–8.
  - With the game's own limit of 22 (not editable in the in-game editor, §17), the drop could reach
    21; the port measured 20.9. It stays out of scope.
  - Official median highest fall is 4.8, maximum 12.8 (Diorama, a 50² map). Workshop maps reach
    14.7 at the 16 cap.
- **Achievable width:**
  - The lip depth is about **0.3·S/W**: all the flow S spread over the lip width W. Every lip tile
    drains completely each substep.
  - **The whole lip carries water only if a pool feeds it.** Without the header pool, water spreads
    sideways only where the sheet builds past the 0.1 spill threshold. The port wetted 3 of 20
    lip tiles at S = 0.5, and 18 of 20 at S = 2. With a header pool one level below the lip, it
    wetted 20 of 20 at S = 0.5, and 200 of 200 on a 256-wide map at S = 2.
  - Hydraulically, the width is limited only by the map: the dimension along the lip minus about 8
    tiles for side walls. The builder caps it at 40% of that dimension so the map stays playable
    (§9.10).
  - Official falls are narrow: the widest lip on an official map is 2–8 tiles. Counting sheets under 0.1 deep, Canyon
    reaches 10 and Craters 15; Pressure has 22, measured on a map whose water also runs through
    roofed tunnels. Official lips are 0.12–0.29 deep
    (medians per map).
- **Flow for a given width:**
  - The minimum is S ≥ 0.025·W plus the header pool's evaporation (about 0.00012 per pool tile).
    Below that, the lip dries out.
  - A lip that looks like an official fall (at least 0.12 deep) needs S ≈ 0.4·W. For a 20-wide fall
    that is about 8 blocks/s, more than the whole Normal flow budget of a 128² map (3.6). Whether a
    thinner sheet (S ≈ 0.1·W, lip about 0.03 deep) still reads as a waterfall in game needs an
    in-game check (§18 F).
  - The builder takes flow from the river it sits on. Standalone, it adds springs of at most 0.5
    each, and at most 8 per tile (the game's cap), up to 100% of the map's flow budget. Beyond that
    it builds the thinner sheet and reports it. An exact flow typed in advanced mode (or asked for
    explicitly) can exceed the cap, with a warning. In-game check F1 uses that override.
- **Downstream:** friction is negligible, so any channel carries the flow. The water depth in a
  channel draining to an edge is about 0.3·S/w, so banks 1 level high hold up to S ≈ 3·w (for
  example, 10 blocks/s in a 3-wide channel).
- **Validated:** the settled water surface drops at least 1.5 between neighbouring wet tiles at the
  fall (detected as a waterfall feature). Tiles below it are not flooded above the bench. The
  measured width, for Claude's intent checks, is the number of lip tiles with any water (depth > 0.001) and a
  drop of at least 1.5.
- **Counts:** from the waterfall setting, with 12+ tiles between falls.

### 9.3 Terraced cliffs (vertical building)

- **What it builds:** a stair of 3–6 bands, each 1 level high and 6–12 tiles deep, facing water. A
  slope chain climbs it at one end.
- Official maps have 18 plateaus per map (small 3, max 24). This supplies wide, flat benches at
  several levels for tall builds with water close below.

### 9.4 Obstacle with payoff

- **Ridge worth tunnelling:** a ridge 3–5 thick and 2+ levels above both sides, separating the
  start zone from a flat, moist expansion zone. It has one long detour route (slopes) and a short
  path that needs player stairs or a tunnel.
- **Ruins on a plateau:** a ruin field on a plateau 2–4 levels up, deliberately left without slopes
  (§7.5, step 5), so reaching it needs player stairs (70 science) or platforms.
- **Thorn-barred valley:** a thorn belt across a corridor to a relic or geothermal field.
- **Validated:** the payoff is reachable from the start *if* the player builds one stairs (a
  region graph check with one allowed 2-level edge), and unreachable otherwise.

### 9.5 Badwater with counterplay

- **What it builds:** the badwater source (3×3) sits in a side basin with a single outlet 1–3
  tiles wide, whose sill is 1 level above the basin floor. The outlet channel joins the main river
  downstream of the start reach, or runs to its own edge.
- **Counterplay:**
  - A levee or dam across the outlet (1–3 tiles) contains it.
  - Thorn tiles along the basin rim block its soil contamination (7-tile reach).
- **Validated:**
  - No badwater or contaminated soil within the badwater-distance setting of the start.
  - The start's pumpable water stays clean (contamination under 0.05).
  - At least one clean river reach of 40+ tiles exists.
  - Blocking the outlet tiles in a re-simulation keeps the badwater inside the basin: the
    "containable" proof.
- **Badtide:** every clean source emits badwater during badtide, so only stored water stays clean.
  The map card says so when the drought reserve is Scarce.

### 9.6 Plugged spillway

A 1-deep side channel from a basin to a lower valley, closed by a line of 2–9 `Blockage` tiles
flush with the banks. Demolishing it drains or diverts the basin: a strategic choice. Validation
proves the map with the plug is valid. The map card notes the effect of removing it; that is
simulated once.

### 9.7 Ruin fields

- **Totals:**
  - Scrap follows the ruins setting × the size-aware median (small 840, medium 705, large/max
    236 per 1k tiles).
  - Fields per map: small 2–3, medium 4–6, large 4–5, max 8–9.
  - Field sizes are drawn around the size median (21 / 31 / 40 / 41) with a factor of 0.6–1.9.
  - At most 5% of columns stand outside fields.
- **Shape:** blob growth on one flat level, with frontier weight = (neighbours in field)². Grow
  `n / (1 − 0.05)` tiles, then punch 5% interior holes. This gives fill 0.56 and about 9% holes,
  the official medians. There is a one-tile moat between fields.
- **Heights:**
  - Sample from the official shares: H1 28%, H2 22%, H3 17%, H4 10%, H5 8%, H6 5%, H7 4%, H8 4%.
  - Assign them by a key of smooth noise (lattice 2.5 tiles) + 0.35·(1 − r/rmax) + a small jitter,
    tallest to the highest key.
  - The result is clumps of similar height and a mild inward lean. The target Spearman correlation
    is about −0.2: the official median is −0.06 and the workshop median −0.18.
- **Where:**
  - On dry, non-moist ground, so moist land is kept for farms and forests.
  - At least the difficulty's ruin distance from the start, and 18+ tiles between field centres.
  - Distance bands: 1 field 20–40% of the way to the far edge, most at 40–70%, the largest at the
    frontier. On the median official map scrap within 40 tiles of the start is 0, and 43% of scrap
    lies 64–128 tiles out.
- **Each column:** `RuinModels.VariantId` A–E uniform, random Orientation, `Yielder:Ruin` 15·h.
  Each needs an 8-neighbour at its own level, which the one-level rule guarantees.

### 9.8 Second district site

On maps of 128² and up: a zone 60–120 tiles from the start. It has its own clean water (a spring,
or a river reach with pump reach), 600+ tiles of same-level land, 40+ trees, 20+ bushes and a dam
site or natural basin. It is connected to the start's region by slopes, and it is the anchor for the
premise "a second valley beyond the ridge".

### 9.9 Gorge

The editor and Claude treat the gorge as its own set piece, so it gets its own builder. The dam
site (§9.1) and the Canyon archetype use it for their narrows.

- **What it builds:** a channel 3–9 tiles wide between walls at least 2 levels above the bed,
  6–40 tiles long, with the river's bed profile running through it.
- **Limits:**
  - Wall height is 2 up to 16 − bed.
  - A 3–9 wide gorge is also a dam site with a high volume per dam tile.
  - Beavers cannot climb the walls. When the gorge floor is part of the colony's route, the
    builder cuts a stair notch: a 1-wide staircase of 1-level steps with a slope chain (§7.5).
  - Rims 3 or more levels above the ceiled water surface get no moisture from the gorge water
    (6 tiles of reach are lost per level). A gorge therefore has dry rims unless another water body
    feeds them.
  - No roofs: slot canyons with overhangs are out of scope, because the water model does not cover
    water under roofs.
- **Validated:** the channel carries the settled flow without flooding its rims. If the gorge is
  on the colony's route, reachability passes (§11.4).

### 9.10 Achievable ranges by map size

Audit measurements (prototype water port, `prototype/watersim.py`) and the rules above. The
builders publish these ranges for the current map, and the editor and Claude use them to resolve
words such as "giant".

| | 48² | 96² | 128² | 192² | 256² |
|---|---|---|---|---|---|
| Waterfall drop, hard max (editor-safe terrain) | 15 | 15 | 15 | 15 | 15 |
| Waterfall drop, practical in a layout / typical | 12 / 3–8 | 12 / 3–8 | 12 / 3–8 | 12 / 3–8 | 12 / 3–8 |
| Waterfall width cap (40% of the side along the lip; hydraulic limit about side − 8) | 19 | 38 | 51 | 76 | 102 |
| Normal flow budget for the whole map (blocks/s, §5.3) | 1.2 | 3.0 | 3.6 | 4.4 | 7.2 |
| Flow for a 20-wide fall: minimum / official-looking | over the width cap | 0.5 / 8 | 0.5 / 8 | 0.5 / 8 | 0.5 / 8 |
| Dam-site basin cap (15% of the area, tiles) | 345 | 1,382 | 2,457 | 5,529 | 9,830 |
| Reservoir, Normal difficulty with Normal reserve: 380 blocks ≈ 190 tiles at 2 deep | fits (8%) | fits | fits | fits | fits |
| Reservoir, Normal difficulty with Plenty: 759 blocks ≈ 380 tiles | too big (16.5%) | fits | fits | fits | fits |
| Reservoir, Hard with Scarce: 1,174 blocks ≈ 391 tiles at 3 deep | too big (17%) | fits | fits | fits | fits |
| Reservoir, Hard with Normal reserve: 1,761 blocks ≈ 587 tiles | too big (25%) | fits (6.4%) | fits | fits | fits |
| Reservoir, Hard with Plenty: 3,522 blocks ≈ 1,174 tiles | too big | fits (12.7%) | fits | fits | fits |
| Gorge wall height | 2–16 − bed | same | same | same | same |

A standalone waterfall needs a footprint of about (W + 4) × 12 tiles, plus an outflow route.
Claude's example in EDITOR_PLAN.md, a 20-wide fall on 128², fits. Its lip would be about 0.03
deep at S = 2, or about 0.12 deep at S = 8. S = 8 is more than twice the map's Normal flow, so
it needs the advanced override (decision D6). Claude builds the S = 2 sheet by default and says
so in its report.

---

## 10. Water simulation

`sim/water.ts` is a port of the game's rules for heightfield terrain, from
[notes/water_and_soil.md, "Simplified water simulation spec"](investigation/notes/water_and_soil.md).

- One column per tile: floor = terrain surface; state = depth, contamination and 4 stored outflows.
- Substep dt = 0.3 s, 2 per tick; 768 ticks per game day.
- Flow: `f = 0.999·f_prev + 0.675·(H_c − H_n)`, minus 0.1 when spilling onto dry ground at the same
  floor. Flows are kept positive, then scaled so a tile never gives more than it has. The stored
  outflow is `max(0, f − 0.8·f_back)`.
- The port mirrors `prototype/watersim.py` operation for operation and agrees with it bit for bit
  on the golden fixtures; only `+ − × ÷`, `min`, `max` and `ceil` are used (§2.1).
- Evaporation: `1e-4` per second (`1e-3` under 0.02 deep), times the cluster-saturation modifier.
- Sources add `dt·S/N` per cell. **Map edges drain; the edge beside a source cell is a wall.**
- Partial obstacles (NaturalDam 0.65) follow the dam rules in the spec. Blockage and a badtide
  drain's back wall are full obstacles: the column floor rises by one (D28).
- Emitters come from the map's objects through their footprints (`sim/model.ts`): WaterSource,
  BadwaterSource (S/9 on its rotated 3×3), seeps (off above 0.8 deep at their anchor, back on below
  0.72), and aquifers and badtide drains, which are off at map start. Delayed sources are off.
- Contamination moves with flow as a volume-weighted mix.
- Moisture and soil contamination are computed at steady state with a max-heap propagation:
  - moisture: 2·sat on water, then −1 orthogonal / −1.414 diagonal, −6 per level climbed;
  - soil contamination: from water with contamination ≥ 0.5, reaching 7 tiles;
  - Thorns block both (a 4-connected barrier).

**The canonical settle** (`sim/prefill.ts`, D27). It is what files store and what validation
checks:
1. **Pre-fill.** A priority flood from the draining map edge (edge tiles that emit water are
   walled, so they are not outlets; a weir raises its tile by 0.65) gives every tile its spill
   level. Water from each running emitter walks downhill or level on that filled surface. Every
   depression on the path starts full at its spill level. Every other tile of the path starts at
   `min(1, 0.3·Q/w)`: Q is the flow through it, and w the shorter of the row and column runs of
   such tiles through it. The contamination starts at the badwater share of Q.
2. **Settle.** The exact simulation, checked every 128 ticks, until the total volume changes by
   under 0.2% and at least 99.5% of tiles move by at most 0.005 (the §11.3 rule, counted exactly,
   with sums in index order so the Python oracle stops on the same tick); at most 4 game days.
3. **The file** stores the settled depth and contamination (`depth:cont:0:floor:depth`, 7
   significant digits, depths under 1e-6 dry), outflows 0, soil moisture and contamination at
   steady state, and the evaporation modifiers of the settled water.

**Fidelity.**
- On heightfield maps the port matches the game:
  - the game's own save of a generated map after 975 ticks, to 0.001;
  - Diorama exactly, and Waterfalls at 0.98 overlap.
  So the preview's water *is* the water the player sees once the map has run for a day.
- Maps are also written pre-filled with that settled water, as official maps are.
- What it does not model: water under roofs (caves, tunnels, overhang slabs, badtide drains).
  The generator does not produce those (§5.7), and the `generate` validation profile refuses maps
  with more than one terrain floor per tile. Imported maps can have them (Cliffside has 24 wet
  cells under roofs, Canyon 180, Terraces 473, where the single-layer port's overlap drops to
  0.25–0.7). There the editor keeps the file's saved water and marks the preview as approximate
  (EDITOR_PLAN.md §6). Stacked columns are a later milestone.
- Transients are exact too, but only the steady state is used.
- The port was checked against a game save written while mods were active (LateGamePerformance,
  BeaverBuddies, HungryPathing, MixedStorage). None of them is known to touch water, but in-game
  check B confirms the result on vanilla.

**Drought.** Sources ramp to 0 for the whole drought. The drought check is analytic
(`sim/drought.ts`, D29):
- water below each basin's spill level stays, and water above it drains through the edges (a
  weir's own tile drains over its lowest neighbour);
- each pool (4-connected water at one spill level) loses what its surface evaporates: 1e-4 per
  second times each tile's saturation modifier, shared over the flat pool. That is 0.0535 a day on
  wide water, more at a small pool's corners;
- colony drinking is 0.424 per beaver per day.

A test compares this against running the sim with sources off for 9 days on the fixtures with
basins (a lake, a valley basin and a weir pool): they agree within 5% of the stored volume
(measured 0.7%, 0.4% and 2.7%).

**Performance.**
- A 256² map needs about 1,500–3,000 ticks to settle, starting from empty.
- Two things cut the work:
  1. start from the priority-flood fill (basins at spill level), which roughly halves it;
  2. update only an active set: wet tiles and their neighbours, typically 10–25% of the map.
- The first estimate, now superseded by the measurement below: with Float64Array state and a
  flat loop, about 65k × 0.2 × 4,000 substeps ≈ 50M cell updates, 0.5–1.5 s in a worker.
- **Audit measurement** (Node 24, a straightforward Float64Array port of `watersim.py`, cold start
  from empty, prototype River Valley terrain):

  | Map | Ticks | Full grid | Naive active set |
  |---|---|---|---|
  | 128² | 1,500 | 0.98 s | 0.71 s |
  | 256² | 3,000 | 11.3 s | 6.5 s |

  The naive active set was computed once per tick, and it changed the settled volume by 5%. **The
  active set must be exact**: wet cells plus their 4-neighbours, recomputed every substep and kept
  as an index list rather than a full-grid scan.
- **Budget** (revised from 1.5 s / 0.4 s, which the measurement does not support for a cold
  start), **fixed by the M2 benchmark (D33):**
  - A canonical settle of **≤ 3 s at 256² and ≤ 0.6 s at 128²**, with the exact active list and
    the deterministic pre-fill (above), both computed from the document alone (§19.7).
  - **M2 measurement** (`npm run bench:water`, Node 24 on Kyler's machine, River Valley at
    Normal, seeds 1–10, the settle alone, from the pre-fill):

    | Map | Ticks | Median | Max |
    |---|---|---|---|
    | 128² | 640–768 | 0.07 s | 0.07 s |
    | 256² | 1,152–1,408 | 0.39 s | 0.51 s |

    With other work running on the machine the same benchmark measured 0.15 s and 0.77 s. A whole
    256² generation (plan, build, settle, validate, pack) takes a median 0.95 s in Chrome's worker
    (seeds 1–5) and 0.86 s in Node; 128² takes about 0.2 s.
  - The budget holds with room to spare, so K = 3 candidates stay the default at 256² (§7.9).
    CI gates the 256² settle median at 3 s on every push.
  - The editor's interactive preview re-settles from the previous state (EDITOR_PLAN.md §6). The
    file always gets the canonical settle (§2.1, §19.7).

---

## 11. Validation

A generated map is offered for download only when **every** check passes (apart from the one
advisory check, `plants.drought`, §11.5). Check ids match
`prototype/validate.py` and `prototype/playability.py`. Thresholds come from
`data/calibrated.ts`, generated from `prototype/calibrated.py`.

The same modules serve the editor. Each check has a class, and a profile decides what the class
does (§19.5):
- **load**: anything the game would crash on, silently drop, or break at start. That is all of
  §11.1, and §11.2 except the two design checks below. It blocks the download in `generate` and
  the export in `export`. On import it is reported, and the importer fixes what the game itself
  would fix.
- **playability**: §11.3–11.4. In the `generate` profile it must pass (the generator retries). In
  the editor's `export` profile it is a warning. The player confirms, and the warning is noted in
  the map description.
- **design**: `terrain.max_height` (16) and `terrain.single_floor`. They must pass in `generate`.
  For an imported map they are only information, because official and workshop maps with caves,
  or with terrain up to 22, load fine in the game.

Imported maps have no spec, so thresholds come from the document's "designed for" difficulty
(default Normal) and default settings. Checks that need a planned feature, such as
`water.badwater_contained` (a badwater basin's outlet) or `water.outflow` (a planned lake), report
"not applicable" when no such feature exists: the result passes, carries `applicable: false` and
says why (D31). The playability class runs on every map. On maps with caves or overhangs it uses
the top surface, which is an approximation that `terrain.single_floor` reports (D28).

### 11.1 File

| Id | Rule |
|---|---|
| `file.size` | 4 ≤ W, H ≤ 256 (generator: 48 or more) |
| `file.layers` | exactly 23 voxel layers |
| `file.version` | `GameVersion` and `version.txt` equal `1.1.2.4-52e959e-sw` (any `1.1.x` accepted when validating external files) |
| `file.singletons` | MapSize, TerrainMap, WaterMapNew, SoilMoistureSimulator, SoilContaminationSimulator, WaterEvaporationMap and `WaterSimulationMigrator{IsMigrated:true}` present |
| `file.arrays` | every packed array holds exactly `W·H·Levels` tokens; `Levels` is at least the terrain's floor count |
| `file.metadata` | all 8 keys; Width/Height equal MapSize |
| `file.thumbnail` | 960×540 JPEG |

### 11.2 Terrain and objects: emulating the game's loader

| Id | Rule |
|---|---|
| `terrain.max_height` | surface ≤ 16 |
| `terrain.top_layer_free` | voxel layer 22 empty |
| `terrain.supported` | no voxel more than 3 sideways steps from support (0 on heightfields) |
| `terrain.single_floor` | one floor per tile (the water model's scope) |
| `entities.templates` | only common templates (§5.7) |
| `entities.enums` | Orientation ∈ {Cw0, Cw90, Cw180, Cw270}, exact case |
| `entities.components` | RuinModels + Yielder:Ruin on ruins; WaterSource (+WaterDepthStrengthModifier on seeps); UnstableCore on cores |
| `entities.ids` | unique lowercase GUIDs |
| `entities.placement` | For every object, each occupied cell (`Coordinates + R(F(local))`) passes all of these: inside the map, z < 33, not in terrain, occupation flags disjoint from other objects, MatterBelow met (Ground: solid below; GroundOrStackable: solid or an overhang/drain top below), no object under an OccupyAllBelow block, water objects/geothermal/mine sites on the first terrain column. Result: 0 objects the game would delete. |
| `start.clear` | nothing overlaps the StartingLocation |
| `slopes.connect` | every Slope has ground at z+1 on its high side (Cw0 y−1, Cw90 x−1, Cw180 y+1, Cw270 x+1) and ground at z (or a chained slope at z−1) on its low side |
| `start.count` | exactly one StartingLocation |
| `start.flat` | 3×3 footprint flat at the start level |
| `start.entrance` | entrance tile (Cw0 (X+1,Y−1), Cw90 (X−1,Y−1), Cw180 (X−1,Y+1), Cw270 (X+1,Y+1)) is free ground at the start level |

### 11.3 Water

The canonical settle (§10) of the map's own sources. A water tile is one deeper than 0.05;
clean water has contamination under 0.05.

| Id | Rule |
|---|---|
| `water.settles` | Steady within 4 game days: volume change under 0.2% and 99.5% of tiles within 0.005 between 128-tick checks. |
| `water.no_flood` | Wet share ≤ 0.35 (≤ 0.55 for Islands and Lake Basin); official p90 0.40. |
| `water.clean_exists` | Clean wet tiles ≥ 2% of the map. |
| `water.outflow` | Every running source's water reaches an edge or a planned basin: its connected wet region (depth > 0) touches a map-edge tile that drains (not a walled source tile) or a lake feature. Not applicable without features (imports). |
| `water.clean_reach` | At least one connected (4-neighbour) body of clean water of 40+ tiles. |
| `water.badwater_contained` | With the planned outlet tiles blocked (§9.5), the badwater region stays within its basin. Not applicable until the badwater basin builder plans an outlet (roadmap M5; D24). |
| `water.reservoir` | The better of these two ≥ need × drought reserve (Scarce 1×, Normal 1.5×, Plenty 3×; §5.3): (a) the best leak-free dam site within 40 tiles of the start; (b) natural water retained within 40 tiles after the drought (§10). Dam sites are sampled on every second clean water tile within 60 tiles of the start, with crests 1–3, and flood at most max(6,000, 15% of the map) tiles (D30). |

### 11.4 Start and playability

These use the difficulty rules from §5.6. "Near" means reachable by walking.

| Id | Rule |
|---|---|
| `start.dry` | No water within Chebyshev 2 of the start centre after settling. |
| `start.water` | Clean water (depth ≥ 0.3, contamination < 0.05) with its surface 0–2 levels below the start, within the difficulty distance (10 / 16 / 22). |
| `start.reach_water` | That water borders land walkable from the start. |
| `start.badwater` | No badwater water or contaminated soil within the badwater distance. |
| `start.reach` | Dry tiles walkable from the start (same level, plus slope links; blocked by Thorns, Blockage, NaturalDam, relics, cores, geothermal and mine sites) ≥ the buildable-land target (750 / 1,300 / 2,500). |
| `start.food` | Living berry bushes within 20 tiles and on or beside reachable land ≥ 20 / 40 / 40 (Easy/Normal/Hard, or the setting). |
| `start.wood` | Trees within 20 tiles and reachable ≥ 80 / 50 / 40. |
| `start.ruins_clear` | No ruin column within 20 / 15 / 12. |
| `plants.survive` | Every living tree and bush stands on moisture > 0, no water and clean soil. Every living succulent is on moisture 0. |
| `resources.scrap`, `resources.trees`, `resources.bushes` | Totals ≥ 0.5 × the size-aware official median × the setting multiplier (about the official p10). |
| `ruins.fields` | ≥ 80% of columns in fields of 10+ touching columns (official median 97%). |
| `ruins.access` | Every column has an 8-neighbour on ground at its level, not blocked. |
| `extras.placement` | Relics, geothermal fields and mine sites sit on flat dry ground outside flood reach, at their distance bands. |

**Stored water needed** (from `calibrated.reservoir_needed`):

```
drink    = colony × 0.424 × (drought_days + 0.5)
need     = drink + (drink / 2) × 0.0535 × (drought_days + 0.5)     (reservoir 2 deep)
```

That gives Easy 4 days × 40 beavers → 86; Normal 9 days × 50 → 253; Hard 30 days × 50 → 1,174.
Hard also requires the reservoir's mean depth to be at least 3, because evaporation takes 1.6 over
30 days. That rule needs dam sites with a crest of 4 and comes with the Hard feasibility guards in
M6 (D30, pending Kyler); until then `water.reservoir` checks the volume only.

### 11.5 What the prototype already checks

Since M2, `prototype/validate.py` and `playability.py` implement every check above, with the same
ids, rules and "not applicable" cases as the TypeScript validator. A map with a project file beside
it (`<stem>.damgoodmaps.json`) is checked with its spec and features; any other map as an import.
`terrain.single_floor` replaced the prototype's `water.model` check.

The prototype's first playability module was written for generated maps and took three shortcuts
that imported maps break. The TypeScript port does not copy them, and the prototype was fixed to
match (D28):
- A BadwaterSource's tiles come from the footprint transform, whatever its orientation.
- WaterSeep, BadwaterSeep, BadtideDrain and Aquifer are emitters with their rules (§10).
- Multi-tile objects (mine sites, geothermal fields, relics, cores) block walking on their whole
  footprint.

The parity test (`npm run oracle`) runs both validators on 50 generated maps and on all 19
official maps (import profile), and fails on any disagreement.

A further check, `plants.drought`, is added. It is **advisory**: the one check that never blocks,
in any profile, including `generate`. It
flags living berry bushes within 20 tiles of the start whose moisture comes only from water that
drains during a drought longer than 0.9 × their DaysToDieDry (blueberry: 9 days, and Normal
droughts reach 9 days): their soil is dry in the moisture of the analytic drought water (§10).
Every River Valley map at Normal carries this warning today, because its bushes live on the river,
which drains in a drought (see docs/decisions-pending.md).

### 11.6 Report

Each check yields `{id, class, severity, ok, value, limit, message, where?, fix?, advisory?,
applicable?}` (§19.5, `validate/report.ts`): `where` is the tiles, feature or entities involved,
and `fix` an optional list of edit operations the editor offers as a one-click fix (M2 proposes
`deleteEntities` for plants that would die and ruins next to the start; the M3 operations engine
applies them). Severity follows the profile: load failures are errors everywhere; playability and
design failures are errors in `generate`, warnings in `export`, and warnings and information in
`import`; advisory checks warn. The map card groups them into File, Terrain and objects,
Water, and Start and resources. Failures are explained in player terms, for example
"The start is 23 tiles from pumpable clean water; Normal allows 16 (beavers go thirsty on day 6)."

---

## 12. Interestingness score

Computed for every valid candidate, in `score/score.ts`. Each component is normalised to 0–1
against the official maps. It uses the p10→0 and p90→1 of that component in `calibration.json`
unless stated, clamped.

| Component | Measure | Weight |
|---|---|---|
| **Dam value** D | log10 of the best dam site's volume per dam tile within 60 tiles of the start (official p10 65 → 0, p90 4,479 → 1), plus 0.1 per extra site with ratio ≥ 100, capped | 0.20 |
| **Height variety** H | 0.5 · norm(levels covering 1% of the map, 12 → 17) + 0.5 · (1 − abs(one-level step share − 0.62) / 0.35) | 0.15 |
| **Landmarks** L | 0.35 · min(1, waterfalls ≥ 1.5 / 4) + 0.25 · min(1, plateaus / size-class median) + 0.2 · gorge present + 0.2 · min(1, islands ≥ 100 / 3) | 0.15 |
| **River character** R | 0.5 · norm(sinuosity = channel length / straight length, 1.0 → 1.6) + 0.5 · norm(total channel length / map diagonal, 0.5 → 1.5) | 0.10 |
| **Resource pacing** P | 1 − mean, over living trees, bushes and scrap, of the earth-mover distance between the map's distance-ring shares and the official median rings (§4 of REPORT), normalised by the largest possible distance | 0.15 |
| **Regions** G | norm(distinct regions: level regions ≥ 1% of the map + water bodies ≥ 1% + groves ≥ 50 trees; official p10 → p90) | 0.10 |
| **Tradeoff** T | Share of the three largest flat regions whose pumpable water is more than 10 tiles away or which lie 2+ levels above it: the best land is not also the easiest to water | 0.10 |
| **Frontier** F | Share of total scrap plus the largest reservoir site beyond 50% of the start-to-far-edge distance | 0.05 |

`score = 100 · (0.20·D + 0.15·H + 0.15·L + 0.10·R + 0.15·P + 0.10·G + 0.10·T + 0.05·F)`

**Calibration.** Run `score.ts` on the 19 official maps (roadmap M9). The weights above are the starting
point. Adjust them so the recommended official maps (Plains, Lakes, Waterfalls) score in the top
third, and so the unconventional ones don't dominate. Report the official distribution on the map
card: "Score 71 (official maps: 48–79, median 63)". After launch, fit the weights by regressing the
"fun" and "boring terrain" ratings on the components.

---

## 13. Names and premises

Templated text from detected features; no AI calls. `score/naming.ts` holds about 40 name patterns
and 30 premise clauses. Each pattern has a predicate on `features`, and ties break by the `names`
seed stream.

- **Names:**
  - "Twin Falls" when there are 2 waterfalls ≥ 3.
  - "The Narrows" for a dam site with a length ≤ 5 and a ratio ≥ 1,000.
  - "Hundred Isles" for islands ≥ 10.
  - "<Adjective> <Landform>", from word lists keyed by theme, with the dominant tree species
    feeding the adjective ("Birchwood Terraces").
  - Ruin-heavy maps get "… Ruins".
- **Premise:** 1–2 clauses from the strongest score components, plus a warning clause for scarcity.
  - "A meandering river fills a basin that one short dam in the gorge could turn into a lake."
  - "Two waterfalls give power to spare, but the badwater marsh downstream spreads in badtide."
  - "Reserves are thin: plan for droughts early."
- **Map description** in `map_metadata.json`: premise + settings summary + "Made with Dam Good Maps
  <version>, seed N". The in-game map name is the download file name: `<Name> (<seed>).timber`.

---

## 14. Website features

### 14.1 Layout

A two-pane page. On mobile it stacks, with settings in a drawer.

- **Left:** the settings panel.
  - A theme preset strip (6 illustrated cards) on top, then Basics.
  - Terrain, Water, Hazards and Resources as collapsible sections, with Start rules under Advanced.
  - Every control shows its official reference range as a faint band, e.g. "official maps:
    4–35 sources".
- **Right:**
  - The preview canvas, with layer toggles and a 2D/3D switch.
  - The map card beneath: name, premise, score and the validation report.
  - Download, and **Refine this map**, which opens the same map in the editor with its features
    ready to edit (EDITOR_PLAN.md). Before the editor ships, the button is replaced by "Download
    project file" (`.damgoodmaps.json`, §19.6), so maps made early can be opened in the editor
    later.
- **Generate** is always visible. Seed has a dice button. Changing a setting marks the preview stale
  and offers "Generate"; auto-regenerate is optional (default off at 256²).

### 14.2 Preview

- **2D top-down:** elevation colour ramp with a hillshade from the north-west, so terraces read as
  steps. Contour lines are optional.
- **Layers:**

  | Layer | Shows |
  |---|---|
  | Terrain | always on |
  | Water | clean depth in blue shades |
  | Badwater | brown |
  | Moisture | green tint where soil is moist |
  | Contamination | purple tint |
  | Trees | living / dead / succulent dots |
  | Berries | purple dots |
  | Ruins | height-coloured squares |
  | Start | district center outline and entrance arrow |
  | Slopes | arrows pointing uphill |
  | Dam sites | dam line and the reservoir it would hold, with its volume |
  | Reach | land walkable from the start |
  | Features | labels for falls, gorge, plateaus and islands |

- **Hover:** tile tooltip with level, water depth, moisture and what stands there.
- **Zoom and pan:** wheel and drag, at 1–8× integer scaling.
- **3D (lazy):** three.js orbit view of the terrain columns, water surfaces as translucent quads at
  depth, and instanced trees and ruins. Budget: under 1.5 s to build, 60 fps on a mid-range laptop
  at 256². Off by default on mobile.

### 14.3 Map card

- The name and premise.
- Score with its component bars and the official range.
- Key facts:
  - size and theme;
  - sources and strength;
  - badwater;
  - trees, living share and bushes;
  - scrap and ruin fields;
  - the best dam site's volume;
  - the start's distance to water.
- The validation report: all green with a count, or the failures expanded.
- "Best of 3 candidates". The attempts used appear only in debug mode.

### 14.4 Download

- **The file:**
  - `<Name> (<seed>).timber`: a zip built in the worker, with the 960×540 thumbnail rendered from
    the preview palette.
  - Water, moisture and contamination are pre-filled.
  - Byte-identical per seed and settings.
- **Install help (shown after download):**
  1. Move the file to `Documents\Timberborn\Maps` (Windows). On macOS it is
     `~/Documents/Timberborn/Maps`.
  2. Start Timberborn → New game → the map is listed under your maps.
  3. The map editor can open it too.
  - Custom maps show their file name, which is why the name goes in the file name.
- **Optional:** "Download without pre-filled water", for the in-game A/B check (§18) and as a
  fallback while that check is open.

### 14.5 Shareable links

- **State in the URL fragment:**
  `#v=<generatorVersion>&s=<seed>&t=<theme>&z=<size>&d=<difficulty>` plus only the settings that
  differ from the theme preset, in short keys (`rl=70`, `fl=2`). Base64url for custom species
  weights.
- **Old versions:** a link whose `v` is older than the current generator shows
  "Made with v1.2 — open in v1.2 (exact) or regenerate with v1.3". The first option goes to
  `/v/1.2/#…`.
- **Buttons:** Copy link, and "Copy seed + settings" as text for Discord.
- **Edited maps:** a link encodes the `MapSpec` only, so it reproduces the generated map without
  the player's edits. An edited map is shared as its project file. Putting small edit lists into
  the link is a later option (ROADMAP.md, Later).

### 14.6 Ratings

As §2.3: *fun / too easy / boring terrain / frustrating / broken*, sent as a pre-filled GitHub issue
form with a copy-text fallback. The button appears after download and on revisits: the last 5
downloaded maps are remembered in localStorage.

---

## 15. Testing

| Layer | What | When |
|---|---|---|
| **Unit** (Vitest) | RNG streams; sine polynomial error < 1e-9; noise; C#-style float formatting; world.json encoding; footprint transform (all templates × 4 orientations vs `footprints.json`); slope orientation; region labelling; dam-site finder; score normalisation. | every push |
| **Round trip** | Read → write → read on every fixture map (official maps are not redistributable, so CI uses generated fixtures plus a local job for `investigation/raw`); byte-identical `world.json`. | every push (generated); local (official) |
| **Water golden vectors** | TS sim vs Python fixtures (`tests/golden/water.json.gz`) after 50/200/975 ticks within 1e-6; moisture mask exact; pre-fill, canonical settle and drought storage; the analytic drought within 5% of the simulated one; the game's own save reproduced within 0.001 (local only). | every push |
| **Determinism** | The same 20 seeds × 6 themes give identical sha256 in Node, Chromium, Firefox and WebKit (Playwright), and across two runs. | every push (Node), nightly (browsers) |
| **Oracle** | The Node CLI writes 50 seeds × 3 sizes; Python `validate.py --load-only` and `roundtrip_test.py` must pass; on 50 of them, and on the 19 official maps when present, each TS check verdict must equal the Python verdict. | every push (5 seeds); full at each milestone |
| **Contract** (§19) | The `MapSpec` schema accepts every preset and rejects out-of-bound values. Features survive a JSON round trip. `build(features)` equals the generated map byte for byte. An incremental rebuild after a feature edit equals a full rebuild. Feature and entity ids stay the same when an unrelated feature is added or removed. Import normalization (migrator halving, 4-field water, legacy `Heights`) is checked on the investigation maps. | every push |
| **Golden maps** | 12 pinned seeds (2 per theme; 96² and 256²): sha256 of the `.timber` plus key metrics (score, check values). Any change must be intentional: `npm run golden:update`, and the diff shows the metric changes. | every push |
| **Batch pass rates** | `tools/batch.ts`: 100 seeds per theme per size at Normal, plus 30 at Easy and Hard. Report first-attempt and final pass rates, failing checks, score distribution and timings, with generated metrics beside the official ranges. Gates: final pass rate ≥ 98% within 12 attempts, first attempt ≥ 60%, median 256² time ≤ 8 s. | nightly and before release |
| **End-to-end** (Playwright) | Generate → preview → download on 128²; share link round trip; layer toggles; worker cancel. | every push |
| **In-game** | §18, once per milestone that changes the file format or the generator's physical rules, recorded in `docs/ingame-log.md`. **Deferred (D11):** Kyler skips in-game checks for now. Each milestone lists its checks in the log as *pending* and does not wait for them; the automated validation and tests above carry the gate until the checks are played. | per milestone (pending) |

---

## 16. Milestones

**The order of work is now [ROADMAP.md](ROADMAP.md)**, which merges these milestones with the
editor's. The shared foundations (§19) come first. From its first milestone the generator writes
maps whose features the editor can open. The table keeps the original scope of each generator
milestone and says where it went. Effort: S under a day, M 1–3 days, L 3–7 days of focused work.

| # | Milestone | Delivers | Acceptance | Roadmap |
|---|---|---|---|---|
| **1** | **End-to-end slice** (L) | Vite + TS + Preact app shell. `core/format` (writer, footprints, C# float format, fflate, jpeg-js). RNG streams. River Valley ported from the prototype *without* the water sim: sources placed, water left as zeros. Slopes and start rules. File and placement validation (§11.1–11.2). 2D preview (terrain, start, entities). Settings: seed, size preset, difficulty. Download. GitHub Pages deploy. **Added:** `MapSpec` v1, the feature schema v1 and the feature-first River Valley (§19), stable ids, per-feature RNG streams, the reader as well as the writer, the project file download, and the `calibrated.py` alignment (§4). | 50 seeds × 3 sizes pass Python `validate.py` file and placement checks and `roundtrip_test.py`; identical sha256 in Node and Chromium for 10 seeds; 128² generates in < 3 s; **added:** rebuilding from the project file reproduces the `.timber` byte for byte; **in-game check A** (§18). | M1 |
| **2** | **Water and playability** (L) | `sim/*` exact port with golden vectors; steady-state water, moisture and contamination; pre-filled water in the file; vegetation placed from moisture; all §11.3–11.4 checks; retry loop; map card with validation report; water, moisture and reach layers. **Added:** the exact active list and the canonical settle, validation classes and profiles (§19.5), and the water benchmark that fixes the §10 budget. | Golden vectors pass; the game's save reproduced within 0.001; batch 100 seeds at 128² Normal: final pass ≥ 98%, first attempt ≥ 60%; **in-game check B** (pre-filled water, tree survival). | M2 |
| **3** | **Settings, sharing, themes I** (L) | The full settings panel (§5) with reference bands; URL codec; Canyon and Lake Basin archetypes; set pieces dam site, waterfall, terraced cliffs, badwater counterplay; the dam-site layer. | Each setting moves its measured target in batch runs (a test per setting); share links reproduce byte-identical files; batch per theme ≥ 98% final pass; **in-game check C** (build a dam at a generated dam site; a waterfall runs a water wheel). | Set pieces and in-game check C: M5 (built once, shared with the editor). Settings, sharing and themes: M6. |
| **4** | **Interestingness** (M) | `score.ts` calibrated on official maps; K = 3 candidates with progressive preview; names and premises; score on the card. | The official score distribution is documented; recommended official maps in the top third; the name and premise match the detected features on 30 hand-checked maps; 256² with K = 3 ≤ 20 s. | M9 |
| **5** | **Themes II and 1.0 features** (L) | Highlands, Delta, Islands; second district; obstacle-with-payoff set pieces; NaturalDam weir; plugged spillway; thorn belts; relics; geothermal; mine sites. | Batch per theme ≥ 98%; every new object passes the placement emulation; **in-game check D** (the new objects load with no loading issues; demolish a spillway plug). | M7 (with the editor's resources and map-object tools) |
| **6** | **3D, ratings, polish** (M) | Lazy three.js view; ratings flow and `tools/ratings.ts`; install help; the Impeccable design pass with the timbermods design system; accessibility (keyboard, contrast) and mobile layout; versioned deploys `/v/<version>/`. | 3D builds in < 1.5 s at 256²; a Lighthouse performance score ≥ 90 on desktop; a rating issue created from the page with every field filled; an old-version link reproduces its file. | 3D view: M4 (one renderer for preview and editor). The rest: M13. |
| **7** | **Later** | NaturalOverhang bridges; seeps and an arid theme; caves with stacked-column water; aquifers; badtide drains; unstable cores out of Advanced. | Each behind a feature flag until its own in-game check passes. | Later |

---

## 17. Risks and open questions

| Risk or question | Impact | Mitigation |
|---|---|---|
| **Pre-filled water behaves differently in game** (the loader copies depth by slot and recomputes floors; untested with our tokens). | Rivers surge or drain at start. | In-game check B compares the pre-filled file with the empty-water file of the same map (the prototype writes both). Fallback: ship empty water; the game fills rivers in about a day, and living trees are within moisture reach of the *settled* river, so they survive (their dry timers reset). |
| Cross-browser floating point in the water sim. | Share links reproduce a different map. | Only IEEE-exact operations on output paths (§2.1); the nightly cross-browser determinism test. The water result feeds placement, so a divergence would move trees; the golden tests catch it. |
| Generator changes break old share links. | Players lose maps. | Versioned deploys `/v/<version>/`; the version in the link and the map description. |
| JS performance of the Dijkstra moisture pass and the sim at 256². | Slow generation. | Budgets in §10; a binary heap over typed arrays; active-set simulation; a priority-flood initial state; progressive candidates. |
| Official calibration is 19 maps (2 small, 3 medium). | Small-map targets are noisy. | Blend with workshop numbers for small maps; tune from ratings. |
| Heights above 16. | Unknown editor behaviour. | Kept at 16; in-game check E. |
| Aquifer drills only work in temperate weather (per code). | Would mislead if used. | Left out (§5.7). |
| GitHub-account friction for ratings. | Few ratings. | Copy-text fallback; add a Google Form behind the same button if needed. |
| Map name is the file name. | Players rename files and lose the name. | Also stored in `MapDescription`. |
| Iron Teeth's district center on the StartingLocation. | Iron Teeth starts fail on some maps. | Same 3×3×5 footprint and entrance per the blueprints; in-game check A covers one Iron Teeth start. |
| The water sim is slower in JS than §10 first assumed (audit: 6.5–11 s cold at 256² unoptimized). | Slow generation at 256²; a sluggish editor preview. | Exact active list and the deterministic pre-fill; warm starts for editor previews; M2 benchmark gate; K = 1 at 256²; the editor re-settles only what changed (§10). |
| Features first is a bigger port than "port the prototype". | M1 takes longer. | It is the price of an editor that edits what the generator made. The prototype's layout already has the structure (river path, bed profile, gorge, basin, falls); M1 only makes it explicit. |
| Thin waterfall lips may not read as falls in game. | Claude's "giant waterfall" looks like a wet cliff. | In-game check F1; the waterfall builder reports lip depth; flow policy (§9.2). |
| Imported pre-1.0 maps lack `WaterSimulationMigrator`. | Re-exported maps would run at double strength. | Halve strengths and outflows at import, as the game does on load (§19.6). |

Kyler answered the open questions on 2026-09-24 (§20, D12–D14):
1. The address is the `dam-good-maps` repository in the timbermods organization:
   `timbermods.github.io/dam-good-maps/`.
2. Hard maps are warned, never refused: a Hard-designed map with a Scarce reserve generates, and
   the map card says so ("that's part of the fun").
3. GitHub issue ratings are fine.

---

## 18. In-game checklist

Short, and needs you. Each item names the file to use from `out/` (or the milestone's batch
output), what to do, and what should happen. Record the result in `docs/ingame-log.md`.

**Deferred (D11).** Kyler is skipping in-game checks for now. Milestones do not stop or wait for
them: each milestone lists the checks it would have needed in
[docs/ingame-log.md](docs/ingame-log.md) as *pending*, names the files to play, and relies on the
automated validation and tests in §15. The checks below stay the definition of each one.

**A. Load and start** (roadmap M1, with `out/m1/River Valley (4242).timber`; see
[docs/ingame-log.md](docs/ingame-log.md))
1. Copy the file to `Documents\Timberborn\Maps`. It appears under New game with its thumbnail and
   description.
2. Start Folktails on Normal:
   - no "Loading issues" panel;
   - the district center stands where the white square is on `out/m1/River Valley (4242).png`, with the door facing
     the river;
   - 9 adults and 4 children spawn.
3. Walk test:
   - beavers cannot step up a 1-level terrace edge where there is no slope;
   - they can climb the generated slopes both ways.
4. Open the map in the map editor: it opens without errors, and terrain edits and saving work.
5. Start Iron Teeth once: the district center fits and beavers spawn.

**B. Water and plants** (roadmap M2)
1. The pre-filled file: rivers flow on day 1 without a visible surge or drain, the lake levels stay
   put over the first day, and the berry bushes near the start are not flagged dry.
2. `… (empty water).timber`: rivers fill within about a day, and the same trees survive.
3. After 15 days, living groves near the river are alive and the dead stands are still dead with
   logs.
4. The badwater marsh stays downstream; the start's water stays clean.

**C. Set pieces** (roadmap M5)
1. Build a dam or levees across the gorge at the dam-site marker: the basin fills to about the
   crest without leaking round the ridge ends.
2. Place a water wheel at a generated waterfall: it turns.
3. Survive the first drought on Normal using the stored water.

**D. 1.0 objects** (roadmap M7): a map with NaturalDam, Blockage, Thorns, relics, a geothermal field
and a mine site loads with no loading issues. Demolishing the plug releases the water as the card
says.

**E. Open questions from the investigation** (any time)
1. Terrain above 16: can the editor load and edit it?
2. Beavers walk *through* ruin columns, as the code says.
3. Aquifer + powered drill during drought: no water?
4. What a map with no StartingLocation does on a new game (for the error message).

**F. Added by the audit** (F2 in roadmap M1, F1 in M5, F3 and F4 in M8)
1. **Waterfall visibility.** Two 20-wide standalone falls: one at S = 2 (lip about 0.03 deep) and
   one at S = 8 (about 0.12 deep, set with the advanced flow override). Does the thin one read as a waterfall? Does a water wheel below
   each turn? The answer sets the waterfall flow policy (§9.2).
2. **Sealed river mouth.** A river entering on the edge with sources across its whole mouth keeps
   its water. The same river with a gap in the source row drains back off the edge.
3. **Imported pre-1.0 map.** Re-export a workshop map that has no `WaterSimulationMigrator` (the
   importer halves its strengths). Its rivers run at the same level as the original does in game.
4. **Imported map with roofed water** (Canyon or Terraces). Edit it away from the tunnels and
   export it: the tunnels keep flowing as in the original.

---

## 19. Shared foundations with the editor

The generator and the editor are one app. This section is the only definition of what they
share. [EDITOR_PLAN.md §11](EDITOR_PLAN.md#11-contract-with-the-generator) points here and adds
nothing of its own. If either plan disagrees with this section, this section wins, and any change
to it is recorded in §20.

### 19.1 Map spec

`MapSpec` is a TypeScript type and a versioned JSON Schema (`core/spec/mapspec.schema.json`). The
settings panel, the URL codec, the editor's `SpecPatch` and Claude all produce it.

```ts
interface MapSpec {
  specVersion: 1;
  generatorVersion: string;
  seed: number;                       // uint32; text seeds are hashed (§5.1)
  size: { x: number; y: number };     // 48–256 for generation (§5.1)
  theme: ThemeId;                     // the preset the settings started from (§6)
  archetype: ArchetypeId;             // the theme's archetype unless overridden (advanced)
  premise?: PremiseId;                // rolled from the seed when absent; recorded after generation
  designedFor: "easy" | "normal" | "hard";
  settings: Settings;                 // every §5 value, complete, never a diff
  colonies: {                         // room for Timber Together (D5); M1 accepts only {count: 1, mod: "none"}
    count: 1 | 2 | 3 | 4;             // colonies on one map; 2+ requires mod "timberTogether"
    mod: "none" | "timberTogether";   // "none" = vanilla: exactly one StartingLocation
  };
  setPieces: SetPieceRequest[];       // added by the player or Claude: {kind, params, region?}
  constraints: {
    locks: Region[];                  // regeneration never changes these tiles
    keepOut: Region[];                // the planner places nothing here
    keep: FeatureId[];                // user and Claude features the planner builds around
  };
  accepted?: { attempt: number; candidate: number };   // filled in by the generator
}
```

- The URL fragment encodes a `MapSpec` as a diff from its theme preset (§14.5). The schema's hard
  bounds are the ranges in §5.
- A `SpecPatch` is a JSON Merge Patch (RFC 7396) on a `MapSpec`: objects merge and arrays are
  replaced whole. The patched spec is checked against the schema again. A patch that fails is
  rejected, never clamped.
- `accepted` lets a document reproduce its map without running the retry loop again.
- `colonies` reserves room for fair multi-colony maps for Timber Together (D5). With
  `mod: "timberTogether"` and `count` N, a later milestone will plan N `start` features
  (`player` 0..N−1), write each as a `StartingLocation` with a `StartingLocationPlayer
  {PlayerIndex}` component and `MaxPlayers: N` in `map_metadata.json`, and add fairness checks
  (each start's water, wood, food and reachable land within a tolerance of the others, and a
  minimum separation). Until then the schema accepts only `{count: 1, mod: "none"}`, and nothing
  may assume a map has one start in a way that would block this.
- Imported maps have no spec (`spec: null` in the document). Their difficulty comes from the
  document's `meta.designedFor`.

### 19.2 Parametric features

One schema (`core/features/schema.ts`) covers every feature. The fields every feature has are
`{id, kind, origin: "generated" | "user" | "claude" | "stamp", params, locked}`. The generator's
planner emits features, the build pipeline (§19.8) rasterizes them, and the editor edits their
`params`. Sizes are in blocks (tiles) and heights in levels. The ranges each map allows are in
§9.10.

| Kind | Params | Game rules it must respect |
|---|---|---|
| `river` | path (control points from source to outlet), width 1–9, bedDepth 1–4 (default 1), bedProfile (start level; steps with their drop), flow (gentle 1 / steady 2 / strong 4 blocks/s, or an exact value), style (straight / meandering / braided), meander, entry (edge / spring / lake id), exit (edge / lake id / river id), badwater | The bed never rises downstream. An edge mouth is sealed (§7.6). Moisture reach is 16 tiles at bedDepth 1, 10 at 2, 4 at 3 and 0 at 4 (6 tiles lost per bank level above the ceiled surface). At most 8 blocks/s per source tile. |
| `lake` | basin outline, floorDepth, outlet {at, sill level, to: edge / river / lake / none}, inflow (river ids or a spring strength) | The surface settles at the sill level: water is flat, so the level is not a free number. With no inflow the lake loses about 0.054 levels a day (warning). The basin never touches a map edge. |
| `landform` | kind (hill / plateau / ridge / canyon / valley / island / terraces), outline, height (levels), edgeStyle (gentle / terraced / cliff), bands | gentle = 1-level steps at least 3 tiles apart, joined by slopes; terraced = 1-level bands 6–12 deep; cliff = a step of 2+ levels, impassable without player stairs. Terrain stays within 0–16. |
| `setPiece` | kind (waterfall / damSite / gorge / terracedCliffs / badwaterBasin / plugSpillway / obstaclePayoff / secondDistrict), params per §9, resolved plan and report | Built only by its shared builder (§19.3). |
| `forest` | area, density, species mix, grove size, life (auto / alive / dead) | Alive only on moist, dry-footed, clean tiles. Succulents live only on dry soil. Common species only. |
| `berryPatch` | area, density, ripe share | As forests (BlueberryBush). |
| `ruinField` | area, scrap target, height mix | One level. Each column needs an 8-neighbour at its level. `RuinModels.VariantId` A–E. |
| `mapObject` | kind (mineSite / relic small, medium, large / geothermal / thornBelt / weir, a NaturalDam line / plug, a Blockage line / bridge, a NaturalOverhang pair / unstableCore), placement | Footprints, OccupyAllBelow and first-column rules (§11.2). |
| `start` | position (centre tile), orientation, bench radius, player (0–3, default 0) | A flat 3×3 with 5 free layers, and the entrance tile free at the same level. Exactly one per map in vanilla. `player` is reserved for Timber Together maps (D5): one start per colony, numbered from 0. |

- **Derived layers** are rebuilt every time and never edited as features: slopes (pinned or
  removed slopes are stored as edits), water, soil moisture and soil contamination.
- **Editor-only kinds** (`stampInstance`, `symmetryRule`) live in the document (EDITOR_PLAN.md §3).
- **What a generated map exposes:** every river, lake and planned basin; the landforms of its
  layout (valley floor, terrace bands, highlands, plateaus, islands); every set piece; every
  grove, as a forest; every berry patch, ruin field and map object; and the start.
- Every entity the build places records its owning feature. The ownership is kept in the document,
  not in the `.timber`.

### 19.3 Set-piece builders

There is one module per kind in `core/features/setpieces/`. The generator's planner, the editor's
tools and Claude's proposals all use it.

```ts
interface SetPieceBuilder<P> {
  kind: SetPieceKind;
  schema: JSONSchema;                                    // hard bounds: outside them, rejected
  limits(ctx: BuildContext): AchievableRanges;           // §9.10 for this map and this place
  plan(params: P, ctx: BuildContext, rng: Rng): SetPiecePlan;   // anchor, footprint, params clamped to limits, report
  rasterize(plan: SetPiecePlan, target: RasterTarget): void;    // height constraints, protected mask, sources, entity clears
}
```

- `BuildContext` is the macro layout during generation and the current map in the editor. It is
  the same code with the same results.
- The resolved plan is stored in the feature. A rebuild rasterizes the stored plan and never plans
  again (§19.7). Planning again happens only on an explicit edit of the feature.
- The report lists:
  - every value that was reduced, and to what;
  - everything that was cleared or relocated (trees, ruins, bushes);
  - every source that was added.

  A builder never moves the start or touches a locked region. When it would have to, the plan
  fails with the reason.
- The kinds are waterfall (on-river and standalone modes, §9.2), damSite, gorge, terracedCliffs,
  badwaterBasin, plugSpillway, obstaclePayoff and secondDistrict. Ruin fields are ordinary
  features with their own placement rules (§9.7).

### 19.4 Stable ids

- **Generated features:** `id = "f-" + base32(hash64(seed, kind, roleKey))`.
  - `roleKey` is the feature's role in the plan, and does not depend on how many other features
    exist: `river/main`, `river/tributary/2`, `setpiece/damSite/primary`, `ruinField/band2/1`,
    `forest/grove/<anchor tile>`.
  - Adding a river therefore does not rename the ruin fields.
  - Retries (`attempt`) and candidates are not part of the id.
- **User and Claude features:** a random UUID, made when the feature is created and stored in the
  document.
- **Entities:** `Id = guid(hash128(ownerFeatureId, template, localIndex))`, written as a lowercase
  GUID.
  - An entity keeps its Id through edits elsewhere. The game seeds a tree's look from its Id, so
    the tree also keeps its look.
  - Entities placed by hand get a random GUID, stored in the document. Imported entities keep their
    original Ids.
- `entities.ids` still checks that every Id is unique. A collision is resolved by rehashing with a
  counter.
- Edits refer to ids. An edit whose target no longer exists after regeneration becomes orphaned and
  is shown to the player, never dropped.

### 19.5 Validation

One set of modules (`core/validate/`) with the calibrated thresholds serves generation retries,
the editor's live checks and export gating.

- **Check result:** `{id, class, severity, ok, value, limit, message, where?, fix?}`. The classes
  are `load`, `playability` and `design` (§11). A check marked advisory (today only
  `plants.drought`) is reported in every profile and never blocks.
- **Profiles:**

  | Profile | load | playability | design |
  |---|---|---|---|
  | `generate` (retry until all pass, then offer the download) | must pass | must pass | must pass |
  | `export` (editor export) | blocks | warns: the player confirms, and it is noted in the map description | warns |
  | `import` (opening a file) | reported; the importer fixes what the game itself would fix (§19.6) | reported | information |

- **Scope:** every check runs on the whole map or on a dirty region. The instant subset
  (footprints, overlaps, start area, limits, slopes, terrain support) runs after each edit. The
  rest runs in a worker.
- **Thresholds** come from `spec.designedFor` and `spec.settings`. For imported maps they come from
  `meta.designedFor` (default Normal) and the default settings.
- **Check ids** match the prototype, which stays the oracle (§4).

### 19.6 Format I/O

There is one reader and one writer (`core/format`), verified by the round-trip tests.

- **Writer:** always the native 1.1 format of [FORMAT.md](FORMAT.md), with deterministic bytes.
- **Reader:** 1.1 and 1.0 voxel maps; 0.7 maps, whose keys are migrated the way the game migrates
  them; and 0.6 maps with `TerrainMap.Heights`, converted to voxels. Saves (`save_metadata.json`)
  are refused with a message.
- **Import normalization**, applied once and listed to the player:
  - No `WaterSimulationMigrator`, or `IsMigrated:false`: halve every `SpecifiedStrength` and
    saved outflow, as the game does on load, then write `IsMigrated:true`. Otherwise the exported
    map would run at double strength.
  - 4-field water tokens: set `OldWaterDepth = WaterDepth`.
  - More than 23 voxel layers: keep layers 0–21 and drop the rest, as the game does, with a
    warning. The writer then writes the standard 23 layers, with layer 22 empty.
  - Components 1.1 never reads (FORMAT.md §7) are dropped; `StartingLocationPlayer` is kept for
    Timber Together (D5). Old key shapes are migrated the way the game migrates them, and the
    version is stamped 1.1.2.4 (D36). Unknown components, unknown singletons,
    multi-slot water and moisture arrays, and key order are all preserved verbatim.
  - Faction-only plants are flagged, with a one-click removal. They fail to load for the other
    faction and in the in-game editor.
- **"Exports unchanged":** after normalization, exporting an unedited import reproduces the
  normalized `world.json` byte for byte and keeps the original thumbnail. An edited map gets a new
  thumbnail.
- **Project file** (`.damgoodmaps.json`, gzip-compressed): the `MapDocument` with its spec,
  features, edits, locks, meta, `generatorVersion` and built base. The base is the whole map:
  surface heights, the multi-run columns verbatim, and world.json's exact text without its
  terrain array (D37). A document opens exactly even after the generator has changed: it shows
  its stored base until the player rebuilds it with the current generator. M1 and M2 files
  (format 1, heights only) still open, rebuilt from their features.

### 19.7 Determinism

§2.1 applies to both halves. In addition:

- `build(document) → .timber bytes` is a pure function. The generator's download is `build` of its
  own document, and so is the editor's export.
- **RNG streams:** layout planning uses one stream per stage. Everything a feature places uses
  `hash(seed, featureId, purpose)`.
- **Incremental rebuilds** of dirty regions are an optimization. A property test checks that an
  incremental rebuild equals a full rebuild after random edits.
- **Water** written to a file comes from the canonical settle. It starts from a state computed only
  from the document (empty, or the documented priority-flood pre-fill), runs a fixed tick schedule
  and stops on a deterministic test. Interactive previews may warm-start, but an export never uses
  their state.
- **Versions:** a document records its `generatorVersion` and its built base. A newer generator
  opens it from the stored base, exactly, and offers "rebuild with the current generator", which
  flags orphaned edits. Versioned deploys (`/v/<version>/`) keep old share links exact.

### 19.8 Build order

Generation and editing use one pipeline (`core/features/build.ts`):

1. base terrain: the layout's macro terrain, a heightmap import, or the imported map;
2. landforms, in document order;
3. set-piece terrain: cliffs, header pools, ridges, gorges, basins;
4. rivers and lakes: bed profiles carve; where a river crosses a landform, the river wins;
5. the start bench and object pads;
6. sculpt edits, in order;
7. integrity pass: remove pits and spikes, keep beds non-increasing downstream;
8. slopes: derived, plus pinned and removed overrides;
9. water sources, then the entity edits whose targets exist by now (D38);
10. water settle, soil moisture and soil contamination (canonical for export);
11. resources: berries, forests, ruin fields, map objects, placed using moisture;
12. the start entity;
13. the remaining entity edits, on resources and the start (place, move, delete, set properties);
14. validation.

Generation plans the features (§7.1–7.3), then runs this pipeline. On regeneration, steps 1–13
leave locked regions untouched.

### 19.9 Platform adapters

The core never touches the DOM or a platform API. Five adapters let one codebase build both the
website and the Claude artifact edition (EDITOR_PLAN.md §7):

- **files:** save and open;
- **storage:** autosave;
- **workers:** a module URL on the website, an inlined blob in the artifact;
- **claude:** the Messages API, or the artifact's `sample` capability;
- **download naming:** `.timber` on the website; a `.zip` holding the `.timber` in the artifact,
  whose downloads allowlist has no `.timber`.

---

## 20. Editor decisions

EDITOR_PLAN.md §0 asks for every deviation and decision to be recorded here. The audit seeded the
list, and implementation adds to it.

| # | Decision | Why | Status |
|---|---|---|---|
| D1 | The shared foundations are defined once, in §19. EDITOR_PLAN.md §11 points to it. | Each contract item must have one definition. | Audit |
| D2 | Features first: the generator emits parametric features and builds the map from them. | The editor must edit what the generator made. | Audit |
| D3 | Validation classes and profiles (§19.5). Generated maps pass every check except the advisory `plants.drought`; edited maps are blocked only by load problems. | Resolves "every check passes" (PLAN) against "errors block, warnings warn" (EDITOR_PLAN). | Audit |
| D4 | Terrain stays at 16 or below in generated maps and editor tools. Imported maps with terrain up to 22 are preserved. | 16 is the in-game editor's limit; 17–22 is untested (§18 E1). | Audit default, accepted by Kyler |
| D5 | **Revised by Kyler, 2026-09-24.** Vanilla maps have exactly one start, and symmetry is a creative tool. Dam Good Maps will *later* make fair maps for Kyler's Timber Together mod (separate colonies on one shared map). The spec and feature schema keep room for it now (`MapSpec.colonies`, §19.1; `start.player`, §19.2), and nothing multi-colony is built until a milestone schedules it. | Vanilla 1.1 keeps one StartingLocation. The mod (BeaverBuddies lineage) reads extra starts as `StartingLocation` entities with a `StartingLocationPlayer {PlayerIndex}` component, plus `MaxPlayers` in `map_metadata.json`. | Kyler |
| D6 | Waterfall flow policy (§9.2): a fall takes the flow of the river it sits on. A standalone fall adds at most 100% of the map's flow budget; beyond that it builds a thinner sheet and says so. An exact flow set in advanced mode may exceed the cap, with a warning. | An official-looking 20-wide fall needs about 8 blocks/s. | Audit default, accepted by Kyler; in-game check F1 pending |
| D7 | Share links carry the spec only. Edited maps are shared as project files. | An edit list does not fit reliably in a URL. | Audit default, accepted by Kyler |
| D8 | Claude: build the bridge against the Messages API first. It runs the request suite in Node and powers bring-your-own-key. The artifact edition follows. **M3 spike ([docs/spike-m3.md](docs/spike-m3.md)):** route B works. A browser request with `anthropic-dangerous-direct-browser-access: true` passes its preflight (204, the origin and headers allowed) and gets a readable 401. Without the header the response is blocked. Route A's building blocks work under the artifact's rules: the whole core runs in a blob worker (its file equals Node's byte for byte); a file input and FileReader open `.timber` files of every format; a `.zip` holds the map; `sample` takes page functions as tools. `sample`'s real latency and who can open the artifact (sharing, public links) wait for Kyler's run of the published spike page. | EDITOR_PLAN.md §7. | Audit default, accepted by Kyler; spike run M3, Kyler's live run pending |
| D9 | `prototype/calibrated.py` is aligned to §5.2 and §5.6 in M1. | The two tables disagree today (§4). | Audit, accepted by Kyler |
| D10 | The artifact edition downloads a `.zip` that contains the `.timber`. Project files save as `.json`. | `.timber` is not on the artifact downloads allowlist. **Confirmed in M3** by the platform's downloads contract (0.2.54): the allowlist is `gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf xlsx zip`, and other names reject with `rejected_extension`. The spike page's `.zip` holds the generated `.timber` byte for byte. | Audit default, accepted by Kyler; confirmed by the M3 spike |
| D11 | In-game checks are deferred. Milestones list the checks they would have needed in `docs/ingame-log.md` as *pending*, never stop or wait for them, and rely on the automated validation and tests (§15). | Kyler, 2026-09-24: "I'm skipping in-game checks for now." | Kyler |
| D12 | The site lives in the `dam-good-maps` repository of the timbermods organization, served at `timbermods.github.io/dam-good-maps/`. The repository was renamed from `Dam-Good-Maps`; GitHub redirects the old name. | Kyler's answer to §17 question 1. | Kyler |
| D13 | Difficulty mismatches are warned, never refused. A Hard-designed map with a Scarce reserve generates, with a warning on the map card. | Kyler: "hard maps are warned (that's part of the fun)". | Kyler |
| D14 | Ratings use the pre-filled GitHub issue form (§2.3). | Kyler's answer to §17 question 3. | Kyler |
| D15 | Deterministic `sin`, `exp` and `ln` in `core/math/detmath.ts`. `sin` is an odd polynomial through x¹⁷ after reduction to [−π/2, π/2] (measured error 4.4e-14), not a 7th-order minimax fit. `exp` and `ln` use range reduction and series. | A Taylor polynomial is exact to write down and easy to check. The extra terms cost nothing measurable. The log-normal draws and the size-aware density interpolation also need `exp` and `ln`. | M1 |
| D16 | The JSON schemas are checked at runtime by a small eval-free checker (`core/spec/schema.ts`) that covers the keywords the two schemas use. Ajv checks the same schemas in the contract tests only, and they must agree. | Ajv compiles validators with `new Function`, which the artifact edition's CSP may refuse, and it would add over 100 KB to the worker. | M1 |
| D17 | Entity `localIndex` (§19.4) is the entity's tile index, y·W + x. The ruin template in the hash is `RuinColumnH<h>`. | One owner never places two entities of one template on one tile. The id stays stable as long as that entity stays on its tile. | M1 |
| D18 | In M1 the project file's base holds heights only, and a project file is rebuilt from its features. Voxel overrides, and opening from the stored base across generator versions, come with import in M3. | Generated maps are heightfields. Rebuilding from features is the M1 acceptance: it reproduces the `.timber` byte for byte. | M1; replaced by D37 in M3 |
| D19 | The River Valley planner in M1 follows the prototype: the river enters on the west edge and leaves on the east edge, and "highlands" are the upper bands of the two `terraces` landforms, not a separate feature. The planned lake basin runs from the basin start to 6 tiles above the gorge. There is no badwater (M2) and there are no map objects (M7). Every ruin column is in a field, within §9.7's "at most 5% outside fields". | Port the proven layout first and change one thing at a time. Other river directions come with the themes in M6. | M1 |
| D20 | The JPEG encoder is jpeg-js 0.4.4, vendored as an ES module (`core/format/vendor/`, BSD notice kept) that returns a `Uint8Array`. | The npm build is CommonJS and returns a Node `Buffer` when a `module` object exists, so Node and the worker would run different code paths. | M1 |
| D21 | In M1, slopes use the prototype's reach rule: every level region within ⌊0.6·max(W, H)⌋ tiles of the start is joined along the region tree (one slope per edge, a second on boundaries of 60+ pairs, at least 12 tiles apart). The §7.5 rules for the 40-tile core, the targeted regions and the 400-tile regions beyond come with `start.reach` and the playability class in M2. | The prototype's playability results were tuned with this rule. Measured over 10 seeds, it gives 14–21 slopes per 10k tiles at 96², 9–16 at 128² and 3–8 at 256². That is close to §7.5's target of up to 20 on small maps and 2–6 on large ones, slightly over at both ends. | M1; M2 kept it (below) |
| D22 | The browser test runs on the installed Chrome locally (`channel: "chrome"`) and on Playwright's Chromium in CI. CI runs the Python oracle on 5 seeds × 3 sizes on every push. The full 50 × 3 run is `npm run oracle`, run at each milestone. | Installing Playwright's browsers on Kyler's machine needs his go-ahead. The full oracle takes about a minute and CI keeps a fast subset. | M1 |
| D23 | The site deploys to Pages from `main` only (`deploy.yml`). CI runs on every branch. | Kyler reviews `dev` and merges. Pages shows what was merged. | M1 |
| D24 | River Valley gets the prototype's badwater, as a `badwaterBasin` set piece in a `marsh` mode: a BadwaterSource 3×3 below the falls, as far from the start as the valley allows, at the badwater ratio × the river's flow (0.65 at Normal, §5.4), clamped to 1–3. It sits in a pit one level below the floodplain, with a one-tile ditch to the river. `water.badwater_contained` is not applicable until the §9.5 side basin with its planned outlet arrives with the shared builder (M5). | M2 needs badwater for `start.badwater`, `water.clean_reach` and in-game check B4. The prototype's marsh on flat floodplain spread a thin badwater sheet over the whole lower valley: contaminated soil reached within 30 tiles of the start on 7% of maps, and sheets were the slowest water to settle. The pit and ditch send the badwater straight into the river. | M2 |
| D25 | The dam-site ridge is a straight band square to the valley's axis (the river's source-to-outlet line), as in the prototype. Each end runs on until it is 4 tiles into ground at least as high as the useful crest (the terrain of build step 2). The gorge goes on the gentlest stretch of the river within 8% of the map of its drawn place. M1's ridge, which followed the river's arc position, is replaced. | With the reservoir checked (`water.reservoir`), the M1 ridge leaked: on a bend its band broke up, and a fixed 40-tile span let the valley floor of a downstream loop wrap round its end. A river that runs along the axis crosses an axis-square band once, and sealing by terrain holds whatever the loop. A steep crossing left a gap no straight dam closes. | M2 |
| D26 | River Valley layout fixes that settled water exposed. (1) Floodplains step down 4 tiles below each bed step (`PLUNGE`), a short plunge gorge. (2) The channel widens with flow so its water stays about 0.55 deep: width = flow / (0.55 / (0.3 + 0.0015 · 0.8 · W)), from 4.4 to 8.4 (only 256² maps change today, to 7.95). (3) The start bench never fills channel tiles. (4) The start is 6–10 tiles from the channel's edge by true distance to the river path (§7.2), and within 34 tiles of the gorge. (5) The river's centre stays 0.2·H + 12 tiles off the north and south edges, and the planned basin 4 tiles. | (1) The upper channel's lip sat beside the lower floodplain, one level below its bed, and poured over the whole basin floor. (2) A 5-wide channel's surface rose 0.3 over a long 256² reach and overtopped its banks. (3) The bench dammed the river where the start was close. (4) The prototype's vertical offset put starts in the water where the river is steep, and a gorge more than 40 tiles away failed `water.reservoir`. (5) A basin touching the edge drains any dam. With D25, these take the 128² batch to 96% on the first attempt (100 seeds). | M2 |
| D27 | The canonical settle is defined in §10: a priority-flood basin pre-fill plus an open-channel pre-fill of `min(1, 0.3·Q/w)`, then the simulation until the §11.3 test passes, checked every 128 ticks for at most 4 days. The test counts "at least 99.5% of tiles within 0.005" exactly (not a percentile) and sums volumes in index order. Both validators run this settle on the file (the `generate` profile reuses the build's). Files store 7-significant-digit water tokens and the settled evaporation modifiers. | One definition, computed from the document alone (§19.7), which the Python oracle reproduces bit for bit, so the two validators stop on the same tick and agree on every verdict. From empty, River Valley settled in about 900 ticks at 128² and never within 4 days at 256² with the sheets of D26; from the pre-fill it takes 640–768 and 1,152–1,408. | M2 |
| D28 | The water model of map objects (`sim/model.ts`, and `prototype/playability.py` alike): emitters and walking blockers by footprint; Blockage and a badtide drain's back wall are full obstacles; NaturalDam follows the spec's partial-obstacle rules; seeps switch off above 0.8 deep and on below 0.72 without the game's real-time fade; aquifers, badtide drains and delayed sources are off; every emitter walls its map-edge padding, also when off. Roofs are not modelled: maps with caves or overhangs are simulated on their top surface, which `terrain.single_floor` reports (information on import). The prototype's three §11.5 shortcuts are fixed in the prototype too. | Parity needs one rule set in both validators. NaturalDam's rules and the seep hysteresis come from the code notes and are untested in game (the golden fixtures cover the port, not the game). Every official map has some multi-floor columns (3–4,790), so refusing the playability class on them would leave nothing to compare; the top-surface approximation is what the editor's preview will also show (EDITOR_PLAN §6). | M2 |
| D29 | The analytic drought (§10) evaporates each pool by its tiles' own saturation modifiers, shared over the flat pool, instead of a flat 0.0535 a day, and a weir tile's own water drains over its lowest neighbour. | With the flat rate, a small weir pool kept 27% more than the simulation after 9 days (its corners evaporate 2.3× faster), outside the 5% the §10 test allows. Now the three fixtures agree within 0.4–2.7%. | M2 |
| D30 | `water.reservoir` needs the colony's drought need × the drought reserve (Normal 1.5×: 380 at Normal). Dam sites are sampled within 60 tiles of the start (the same sampling in both validators) and may flood max(6,000, 15% of the map) tiles. Hard's "mean depth ≥ 3" rule (§11.4) waits for M6. | §5.3 defines the reserve multiplier; the prototype used 1×. Sampling only near the start keeps the Python oracle fast without changing any site within 40 tiles. On 256² maps the gorge basin is larger than 6,000 tiles (the prototype's limit), and §9.1 caps basins at 15% of the map. A mean depth of 3 needs crest-4 dam sites and the Hard feasibility guards of §5.3, which M6 builds. | M2; Hard rule pending Kyler |
| D31 | Validation reports (`validate/report.ts`): a check that does not apply to a map is reported as passing with `applicable: false` and the reason (both validators). Severity follows the profile (§11.6). `fix` holds edit operations in the shape the M3 engine takes (today `deleteEntities` for plants that would die and ruins next to the start). The map card groups results as §11.6 says and shows advisory and export-profile failures as warnings. | Parity compares pass, fail and not applicable, so "not applicable" had to be a first-class result, not a missing check. | M2 |
| D32 | The generator version is 0.2.0. M1's 0.1.0 files (out/m1) stay as they were logged. | Every map changes in M2: settled water in the file, the layout fixes of D25 and D26, the badwater of D24. | M2 |
| D33 | **Water budget (the M2 benchmark, §10):** the canonical settle takes ≤ 3 s at 256² and ≤ 0.6 s at 128². Measured medians in Node: 0.39 s at 256² (max 0.51 s) and 0.07 s at 128² (max 0.07 s); a whole 256² generation takes a median 0.95 s in Chrome. K = 3 candidates stay the default at 256² (§7.9). CI checks the 256² median on every push. | The M2 acceptance asks for the budget to be measured and recorded here. The exact active list plus the pre-fill cut the audit's 6.5–11.3 s cold start at 256² to under 0.6 s. | M2 |
| D34 | The M1 slope rule (the prototype's reach rule, D21) stays through M2. §7.5's 40-tile core, targeted regions and the 400-tile rule arrive with the slope tools in M5, which lists §7.5. | With it, `start.reach` passed on every one of 100 maps at 128² (12,000+ walkable tiles against 1,300 needed), so M2 had no reason to change a rule M5 rebuilds. | M2 |
| D35 | Edit operations share one envelope, `{op, params}`, with camelCase names. Every EDITOR_PLAN §3 operation is covered: `addFeature`, `updateFeature` (a merge patch on `params` and `locked`), `deleteFeature`, `reorderFeature`, `sculpt`, `placeEntity`, `moveEntity`, `deleteEntities` (plural, so one fix removes many), `setEntityProps`, `pinSlope`, `removeSlope`, `setLock`, `regenerateRegion` and `specPatch`. The validation report's fixes are this envelope plus a label (D31). Operations are rejected with reasons when invalid, never clamped. Operations whose tools come later are rejected until their milestone: naturalize (M10), `regenerateRegion` (M11), adding set pieces (M5) and map objects (M7). The sculpt brushes keep terrain within 0–16, as the in-game editor's do. Hand-placed entities get a random GUID when the operation is made, stored in it. | One shape for the tools, the fixes and Claude (M12). Plural `deleteEntities` was already the fix shape. A brush that stops at the editor's limit is a defined tool, not a silent clamp of an invalid value. | M3 |
| D36 | Import normalization (§19.6) applies the game's own load-time migrations once. It also stamps the native 1.1.2.4 version, and it halves `CurrentStrength` along with `SpecifiedStrength`. It drops only the components 1.1 never reads: `DryObject`, `ContaminatedObject` and `NaturalResourceModelRandomizer`. It keeps `BlockObjectState`, `WateredNaturalResource`, `LivingWaterNaturalResource` and `ContaminatedNaturalResource`, which 1.1 still reads. It keeps `StartingLocationPlayer` and every start of a multi-colony map (D5); `start.count` stays a vanilla load check until the Timber Together milestone. A map with fewer than 23 layers is padded, with a warning. `file.arrays` (both validators) checks each packed array against its own size field, as the loaders read them. | FORMAT.md §7 listed four live components as obsolete; the decompiled loaders read them. Timber Together reads `StartingLocationPlayer`. The halved `CurrentStrength` is what the game computes from the halved `SpecifiedStrength` on load. 0.6 maps store one soil slot beside two water levels. On all 30 voxel-format investigation maps the normalized world exports byte for byte, and it normalizes to itself. | M3 |
| D37 | A document is a generation plus an edit log. The generation is the spec, the planned features, what locks kept, and the built `base`. The base stores the whole map, for generated maps too: the surface heights, the multi-run columns verbatim, and world.json's exact text without its terrain array. A document from another generator version therefore opens exactly from its base ("frozen"). There the player's own edits apply, and edits to what the generator made wait for `rebuildWithCurrentGenerator`. Project files are format 2: `features` and `locks` are the log applied to the generation, checked on open, and `baseFeatures` is stored only when it differs. Format-1 files (M1, M2) still open: their base is rebuilt with the current generator, with a notice when the version differs. The log persists and still undoes after reopening; a regeneration's previous generation stays in the session only. | §19.7 asks a document to open exactly after the generator changes, and heights alone (D18) cannot do that. Storing world.json as text keeps every float's digits. Storing earlier generations would multiply the file's size for an undo that the log mostly covers. | M3, replaces D18 |
| D38 | Build order (§19.8): entity edits run in two passes. The first runs after the sources (step 9), on everything that exists by then: slopes, sources, an imported map's objects and hand-placed objects. A deleted source or a placed Blockage therefore changes the water. The second pass runs at step 13, on resources and the start. Hand-placed objects take their tiles before resources are placed. Incremental rebuilds (§19.7) rasterize terrain only inside the dirty region: the footprints of the changed features, old and new, the whole map when a river other features follow changes, and the sculpted cells. The region widens to the dam site's whole band and a smooth brush's cells when it touches them, and by one tile for the integrity pass. Slopes, the water settle, moisture and each resource feature are reused when their inputs are unchanged. | Step 13 alone would settle water around objects the player had deleted. Region-restricted rasterizers keep a feature edit cheap. The settle (0.4–0.75 s at 256²) is skipped for every edit that does not change terrain or water objects. The E1 property tests check that it equals a full build after every step. | M3 |
| D39 | Regeneration (a `specPatch`) plans around the player's features, locked regions and keep-out regions (§7.0). They form one protect mask. River Valley draws its layout again, up to 24 times per attempt, until the river with its bank, the basin, the dam ridge and the start keep off it; its marsh and resources keep off it too. The log is replayed on the new plan, and the retry loop validates the whole document in the `generate` profile. If no attempt passes, the last one is kept with its report. If no layout fits, the regeneration is refused and the document is unchanged. Locks keep the previous generation's generated content in their area: its surface and generated objects, but not its slopes or start. Generated features skip locked tiles, the player's edits replay on top, and water is derived again. Changing the map size while areas are locked is refused. | Nothing the player made is dropped, and nothing is silently lost: operations that no longer apply are flagged with reasons. Keeping the generation's content under a lock, not the final map, stops the player's own edits from being applied twice. | M3; locks are revisited with the lock tools in M11 |
| D40 | Editing imported maps: the file's own slopes are kept (no derived slopes), and the slope pin and remove operations still work. The sculpt tools refuse columns with caves or overhangs, and features leave them unchanged. The integrity pass and the terrain clip touch only tiles an edit changed. Imported objects move to the new ground when an edit changes the surface under them. The water is re-settled only on heightfield maps; maps with caves keep the file's water until M8 brings the roofed-water rule, with a notice. The thumbnail is redrawn only when terrain or water changed. | An unedited import must export byte for byte, and terrain up to 22 must survive (D4). A top-surface settle is an approximation under roofs (D28). The thumbnail shows only terrain and water. | M3 |
| D41 | The artifact edition's build (the M3 spike): two Vite builds, with the worker bundled on its own and inlined as a string the page turns into a `blob:` URL, then the page script inlined into one HTML file. Fonts are the only thing fetched at run time. The page declares only `sample` and `downloads`, reaches the runtime through `window.claude.use()`, and renders without it. | The spike page proves the shape: 209 KB, of which the core is 189 KB, with no `eval`, under the artifact's rules. Vite's own inline worker falls back to a `data:` URL, which would hide whether blob workers work. | M3 spike |

---

## Changes from audit

The audit of 2026-09-23 ([AUDIT.md](AUDIT.md)) changed this plan as follows:

1. Added §19, the single definition of the foundations shared with the editor (map spec,
   parametric features, set-piece builders, stable ids, validation, format I/O, determinism, build
   order, platform adapters), and §20 Editor decisions.
2. §7: the generator plans parametric features first and builds the map from them with the shared
   pipeline. §7.0 takes regeneration constraints. §7.3 uses the shared set-piece builders. §7.10
   returns the spec and features, and keeps detected features apart as `derived`.
3. §7.6 and §1: river mouths on the map edge must be sealed. Lake levels follow their outlet sill.
4. §9: measured limits for waterfalls (drop at most 15 editor-safe and 12 practical; width needs a
   header pool and flow of about 0.025·W to 0.4·W blocks/s), dam sites (useful crest 1–3, basin
   capped at 15% of the map, reservoir feasibility by size), a new §9.9 Gorge, and a new §9.10
   table of achievable ranges by map size. Set-piece values are rejected outside hard bounds and
   reduced, with a report, beyond what the map allows.
5. §5.3: generated waterfalls are 1–9 wide and landmark falls are set pieces. Drought reserve
   combinations that cannot fit small maps are disabled.
6. §10: fidelity notes (roofed water in imported maps, the modded save) and the measured JS
   performance. The budget is revised to ≤ 3 s at 256², with an exact active list, and M2 fixes it
   by benchmark.
7. §11: check classes (load, playability, design) and profiles (generate, export, import); the
   report gains severity, location and fixes; imported-map thresholds; three prototype shortcuts
   the port must not copy; the new `plants.drought` warning.
8. §2 and §2.1: per-feature RNG streams, ids hashed from features, the canonical water settle, no
   COOP/COEP on GitHub Pages, and a second build target for the Claude artifact.
9. §3: new `core/spec`, `core/features`, `core/doc`, `platform`, `render3d` and `editor` modules.
10. §4: recorded the drift between `calibrated.py` and §5.6, to be fixed in M1.
11. §14: "Refine this map" (or a project-file download until the editor ships). Share links carry
    the spec only.
12. §15: contract tests (schema, feature round trip, build equality, incremental equals full, id
    stability, import normalization).
13. §16: milestones mapped to the merged [ROADMAP.md](ROADMAP.md). M1 now includes the feature
    model and the project file.
14. §17: new risks (JS water performance, features-first port size, thin waterfall lips, pre-1.0
    imports). §18: new in-game checks F1–F4.
