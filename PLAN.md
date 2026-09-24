# Dam Good Maps: website plan

A static website where a player picks settings, generates a Timberborn map, sees it in the browser
and downloads a `.timber` file that loads and plays in Timberborn 1.1. This plan is meant to be
implemented directly. The facts it rests on are in
[investigation/REPORT.md](investigation/REPORT.md), [FORMAT.md](FORMAT.md) and
[investigation/calibration.json](investigation/calibration.json). The Python prototype in
[prototype/](prototype/) already implements a large part of it: one archetype, the exact water
model, the validator and the file writer.

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
| JPEG thumbnail | `jpeg-js` encoder in the worker | Canvas `toBlob` encoders differ between browsers; a JS encoder gives the same bytes everywhere, keeping downloads byte-identical per seed. |
| Tests | Vitest (unit, golden files), Playwright (end-to-end and cross-browser determinism), plus the Python prototype as an oracle in CI | See §15. |
| Hosting | GitHub Pages from GitHub Actions: `timbermods.github.io/Dam-Good-Maps/` | Free, the same place as the other timbermods sites, and no server to run. |
| Visual design | The org's Impeccable site flow and the timbermods design system (walnut lodge palette, `DESIGN.md`) | Keeps it part of the family; done as its own milestone once the tool works. |

### 2.1 Determinism

"Same seed and settings gives an identical file" must hold across Chrome, Firefox, Safari and
Node:

- **Random numbers.** `sfc32`, seeded through `splitmix32`. Each pipeline stage draws from its
  own stream, derived as `hash(seed, stageName, attempt)`. Changing the forest density then never
  reshuffles the terrain, and a tweak keeps the map recognisable.
- **Arithmetic.** Anything that affects output uses only `+ − × ÷`, `Math.sqrt`, `Math.floor`,
  `Math.round`, `Math.abs`, `Math.min` and `Math.max`, which IEEE-754 makes exact across engines.
  - `Math.sin/cos/exp/log/pow/atan2` are implementation-defined in precision, so they are not used
    on output paths.
  - Meanders use a polynomial sine (`core/math/sine.ts`: a 7th-order minimax polynomial on a
    range-reduced argument).
  - Noise uses integer-hash value noise with a smoothstep fade.
- **Iteration order.** Always over typed arrays in index order. Priority queues break ties by
  index. No iteration over `Object` keys on output paths.
- **File bytes.** Entity Ids are GUIDs from the entity stream, `Timestamp` is a constant, zip mtimes
  are fixed and the JPEG encoder is deterministic.
- **Versioned reproduction.** A share link carries the generator version (§14.5). Every release is
  also deployed to `/v/<version>/`, so old links still reproduce their exact map after the
  generator changes.

### 2.2 Runtime flow

```
UI (main thread)                          Worker (core)
────────────────                          ─────────────
settings form ── URL ─┐
                      ├── generate(settings) ─────▶ plan → build → water → detail → validate
                      │                              ◀── progress events (stage, attempt, %)
                      │                              ◀── candidate #1 (valid) → preview
                      │                              ◀── candidates #2..K, scores → best
map card, layers ◀────┴── result {heights, water, entities, features, report, score, name}
download ── pack(result) ──────────────────▶ writer → Uint8Array (.timber) ── Blob → save
```

The first valid candidate is shown at once. The remaining candidates are scored in the background,
and the preview switches to the best one with a short notice. The map card says "best of 3".

### 2.3 Ratings without a server

A **GitHub issue form, pre-filled from the page**.

- "Rate this map" opens
  `github.com/timbermods/Dam-Good-Maps/issues/new?template=map-rating.yml&…` in a new tab. The seed,
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
Dam-Good-Maps/
├─ PLAN.md  FORMAT.md  README.md  LICENSE
├─ package.json  vite.config.ts  tsconfig.json  vitest.config.ts  playwright.config.ts
├─ index.html
├─ src/
│  ├─ core/                        pure TS, no DOM: runs in worker, Node and tests
│  │  ├─ math/        rng.ts (splitmix32, sfc32, streams)  noise.ts  sine.ts  grid.ts (typed 2-D helpers)
│  │  ├─ format/      timber.ts (read/write zip)  world.ts (world.json encode/decode, C# float format)
│  │  │               entities.ts (templates, component builders)  footprints.ts (generated from notes/footprints.json)
│  │  │               thumbnail.ts (render + jpeg-js)
│  │  ├─ sim/         water.ts (exact single-layer port)  moisture.ts  contamination.ts  drought.ts
│  │  ├─ analysis/    distance.ts  regions.ts (level regions, walk regions with slopes)  basins.ts (priority flood)
│  │  │               damsites.ts  features.ts (rivers, falls, islands, plateaus)
│  │  ├─ gen/         settings.ts (schema, defaults, presets, URL codec)  pipeline.ts  layout/*.ts (one per archetype)
│  │  │               setpieces/*.ts  terrain.ts  slopes.ts  vegetation.ts  ruins.ts  extras.ts
│  │  ├─ validate/    checks.ts (every check, id, rule, threshold)  placement.ts (load-time emulation)  report.ts
│  │  ├─ score/       score.ts  naming.ts
│  │  └─ data/        calibration.json (subset used at runtime)  calibrated.ts  footprints.json
│  ├─ worker/         generator.worker.ts (Comlink API: generate, pack, cancel)
│  ├─ ui/             App.tsx  SettingsPanel.tsx  Preview2D.tsx  Preview3D.tsx (lazy)  MapCard.tsx  Layers.tsx
│  │                  Download.tsx  Share.tsx  Rate.tsx  InstallHelp.tsx  state.ts (signals)
│  └─ styles/
├─ tools/            batch.ts (Node: N seeds × themes → pass rates, score distribution)  golden.ts
│                    ratings.ts (issue export)  export-fixtures.py (Python → golden vectors)
├─ tests/            unit/  golden/ (fixed seeds → sha256 + key metrics)  e2e/ (Playwright)
├─ prototype/        Python reference implementation and test oracle (kept, see §4)
├─ investigation/    report, calibration, notes, scripts (raw/ and decompiled/ stay local)
├─ out/              prototype test map and batch results
└─ .github/          workflows/ci.yml (lint, unit, golden, oracle, e2e) · deploy.yml (Pages, /v/<version>/)
                     ISSUE_TEMPLATE/map-rating.yml
```

---

## 4. How the prototype and calibration carry over

The Python prototype is not thrown away. It becomes the **reference implementation and the
oracle** the TypeScript port is tested against.

| Python (prototype/) | TypeScript (src/core/) | How it is kept in step |
|---|---|---|
| `tbmap.py` writer and reader | `format/*` | CI generates maps with the Node CLI, and the Python `roundtrip_test.py` and `validate.py` must pass on them. |
| `watersim.py` (water, moisture, contamination) | `sim/*` | `tools/export-fixtures.py` writes golden vectors: terrain, sources and the state after 50/200/975 ticks, plus steady-state moisture, on a dozen small terrains and the game's own save. TS must match within 1e-6 (depth) and exactly on the moist/dry mask. |
| `analysis.py` (distances, regions, basins, dam sites) | `analysis/*` | The same fixtures carry expected region sizes and dam-site volumes. |
| `validate.py`, `playability.py` | `validate/*` | Check ids are identical. The oracle job runs both validators on the same 50 maps; their verdicts must agree check by check. |
| `generate.py`, `terrain.py`, `ruins.py`, `vegetation.py` | `gen/*` | Ported as the River Valley archetype for milestone 1. Not byte-compatible (numpy RNG differs from sfc32); compared through their calibration metrics instead. |
| `calibrated.py` | `data/calibrated.ts` | One table (§5, §11). A test asserts the TS table equals `prototype/calibrated.py`. |
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
| Drought reserve | Scarce, Normal, Plenty | Normal | Minimum stored water near the start, as a multiple of the colony's drought need (§11.4): 1× / 1.5× / 3×. Also sets the number of dam sites and natural basins the layout aims for. This setting is what makes droughts forgiving. |
| Lakes and basins | None, Few, Some, Many | Some | Natural basins of 20+ tiles that hold water without a dam: 0 / 0.5× / 1× / 2× the official median for the size (large maps have about 15). |
| Waterfalls | Off, Few, Many | Few | Number of bed drops of 2+ levels: 0 / 1–2 / 3–6. Drop height range in §9.2. |

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
| Berries near start | 20 – 100 | by difficulty (Easy 20, Normal 48, Hard 60) | Living bushes within 20 tiles of the start, in 2–3 patches beside water. |
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
| NaturalOverhang bridges | Later (milestone 7): natural bridge over narrow 1-deep channels (Delta, Islands) | Needs water under a slab. Fine when water is under 1 deep, but needs stacked-column water to validate in general. |
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

```
settings ──▶ 0 normalise ──▶ 1 concept ──▶ 2 macro layout ──▶ 3 set pieces ──▶ 4 terrain
                                                                                   │
  result ◀── 10 name ◀── 9 score (K candidates) ◀── 8 validate / retry ◀── 7 detail ◀── 6 water ◀── 5 connect
```

### 7.0 Normalise

- Clamp every setting and resolve size-aware targets: `target = multiplier × density(key, W·H)`.
- Derive the difficulty rules.
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

Each set piece (§9) is a builder with
`plan(layout, rng) → {anchor, footprint, constraints}` and
`apply(heights, masks)`.

It writes into:
- a height **constraint field**: exact levels, minimum and maximum levels per tile;
- a **protected mask**: tiles later stages may not change.

For example, the dam site protects its abutments and basin floor. Set pieces are planned in order
of priority (start, dam site, waterfalls, second district, ruins-on-plateau, badwater basin), so
the important ones get space first.

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
   - Springs are inland sources on highland plateaus feeding cascades.
   - Badwater sources are 3×3 at 1.0–3.0 strength, placed per §9.5.
   - Total strength follows the flow setting.
2. Run the exact simulation (§10) to steady state from a priority-flood initial guess.
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
candidate".

### 7.10 Output

```ts
interface GeneratedMap {
  size: { x: number; y: number };
  heights: Uint8Array;                 // surface level per tile
  water: { depth: Float32Array; contamination: Float32Array; moisture: Float32Array; soilContamination: Float32Array };
  entities: EntitySpec[];              // template, x, y, z, orientation, flipped, components
  features: Feature[];                 // rivers, lakes, falls, dam sites, plateaus, fields, groves, start… with ids
  report: ValidationReport;            // every check: id, ok, value, limit, message
  score: ScoreBreakdown;
  name: string; premise: string;
  seed: number; settings: Settings; generatorVersion: string; attempt: number; candidate: number;
}
```

`features` drives the preview layers, the map card and the name. It is also what an editor needs:
every feature has a stable id derived from the seed and its stage.

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
validation proves. "Levels" are terrain levels; the terrain budget is 1–16.

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
- **Validated:** a straight dam line through a channel tile holds `need × drought reserve`
  within 40 tiles of the start. The flood fill must not reach an edge or go around the line
  (`analysis/damsites.ts`).
- **Variants:**
  - *Natural weir*: a `NaturalDam` line across the narrows channel pre-holds 0.65.
  - *Plugged spillway*: §9.6.

### 9.2 Waterfall and cascade (power spot)

- **What it builds:** a bed drop of D levels over one tile, with the channel narrowing to 1–3 tiles
  for 3–6 tiles above the drop. Water wheels want fast, narrow flow.
- **Achievable drops:** D ranges from 2 up to the terrain budget left between the upstream bed and
  the downstream bed, keeping the floodplain above the next set piece.
  - With terrain at most 16 and the lowest bed at 2 or more: at most 12 for a single fall on a map
    whose river crosses the full height range, and 4–6 on typical layouts.
  - Official median highest fall is 4.8, maximum 12.8 (Diorama).
  - The **width** of a fall is its channel width: 1–3 tiles for power spots, up to the river width
    (5–9) for a "big falls" landmark. Any width fits in 96–256 maps.
- **Validated:** the settled water surface drops at least 1.5 between neighbouring wet tiles at the
  fall (detected as a waterfall feature). Tiles below it are not flooded above the bench.
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

---

## 10. Water simulation

`sim/water.ts` is a port of the game's rules for heightfield terrain, from
[notes/water_and_soil.md, "Simplified water simulation spec"](investigation/notes/water_and_soil.md).

- One column per tile: floor = terrain surface; state = depth, contamination and 4 stored outflows.
- Substep dt = 0.3 s, 2 per tick; 768 ticks per game day.
- Flow: `f = 0.999·f_prev + 0.675·(H_c − H_n)`, minus 0.1 when spilling onto dry ground at the same
  floor. Flows are kept positive, then scaled so a tile never gives more than it has. The stored
  outflow is `max(0, f − 0.8·f_back)`.
- Evaporation: `1e-4` per second (`1e-3` under 0.02 deep), times the cluster-saturation modifier.
- Sources add `dt·S/N` per cell. **Map edges drain; the edge beside a source cell is a wall.**
- Partial obstacles (NaturalDam 0.65) follow the dam rules in the spec.
- Contamination moves with flow as a volume-weighted mix.
- Moisture and soil contamination are computed at steady state with a max-heap propagation:
  - moisture: 2·sat on water, then −1 orthogonal / −1.414 diagonal, −6 per level climbed;
  - soil contamination: from water with contamination ≥ 0.5, reaching 7 tiles.

**Fidelity.**
- On heightfield maps the port matches the game:
  - the game's own save of a generated map after 975 ticks, to 0.001;
  - Diorama exactly, and Waterfalls at 0.98 overlap.
  So the preview's water *is* the water the player sees once the map has run for a day.
- Maps are also written pre-filled with that settled water, as official maps are.
- What it does not model: water under roofs (caves, tunnels, overhang slabs, badtide drains).
  The generator does not produce those (§5.7), and validation refuses maps with more than one
  terrain floor per tile.
- Transients are exact too, but only the steady state is used.

**Drought.** Sources ramp to 0 for the whole drought. The drought check is analytic:
- water below each basin's spill level stays, and water above it drains through the edges;
- evaporation is 0.0535 per day on wide water;
- colony drinking is 0.424 per beaver per day.

A test compares this against running the sim with sources off for the drought length on
fixtures. Agreement must be within 5% of stored volume.

**Performance.**
- A 256² map needs about 1,500–3,000 ticks to settle, starting from empty.
- Two things cut the work:
  1. start from the priority-flood fill (basins at spill level), which roughly halves it;
  2. update only an active set: wet tiles and their neighbours, typically 10–25% of the map.
- With Float64Array state and a flat loop, that is about 65k × 0.2 × 4,000 substeps ≈ 50M cell
  updates: 0.5–1.5 s in a worker.
- Budget: settle in ≤ 1.5 s at 256² and ≤ 0.4 s at 128².

---

## 11. Validation

A map is offered for download only when **every** check passes. Check ids match
`prototype/validate.py` and `prototype/playability.py`. Thresholds come from
`data/calibrated.ts`, generated from `prototype/calibrated.py`.

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

The exact simulation of the map's own sources, run to steady state.

| Id | Rule |
|---|---|
| `water.settles` | Steady within 4 game days: volume change under 0.2% and 99.5% of tiles within 0.005 between 128-tick checks. |
| `water.no_flood` | Wet share ≤ 0.35 (≤ 0.55 for Islands and Lake Basin); official p90 0.40. |
| `water.clean_exists` | Clean wet tiles ≥ 2% of the map. |
| `water.outflow` | Every source's water reaches an edge or a planned basin: its connected wet region touches the map edge or a basin feature. |
| `water.clean_reach` | At least one connected clean water body of 40+ tiles that badwater never reaches. |
| `water.badwater_contained` | With the planned outlet tiles blocked (§9.5), the badwater region stays within its basin. |
| `water.reservoir` | The better of these two ≥ need × drought reserve: (a) the best leak-free dam site within 40 tiles of the start; (b) natural water retained within 40 tiles after the drought (§10). |

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
30 days.

### 11.5 What the prototype already checks

`prototype/validate.py` and `playability.py` implement every check above except `water.outflow`,
`water.clean_reach`, `water.badwater_contained` and `extras.placement`. Those belong to set pieces
the prototype does not build yet. `terrain.single_floor` is the prototype's `water.model` check.

### 11.6 Report

Each check yields `{id, ok, value, limit, message}`. The map card groups them into File, Terrain
and objects, Water, and Start and resources. Failures are explained in player terms, for example
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

**Calibration.** Run `score.ts` on the 19 official maps (M4). The weights above are the starting
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
  - Download.
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
| **Water golden vectors** | TS sim vs Python fixtures after 50/200/975 ticks within 1e-6; moisture mask exact; the game's own save reproduced within 0.001. | every push |
| **Determinism** | The same 20 seeds × 6 themes give identical sha256 in Node, Chromium, Firefox and WebKit (Playwright), and across two runs. | every push (Node), nightly (browsers) |
| **Oracle** | The Node CLI writes 50 maps across themes and sizes; Python `validate.py` and `roundtrip_test.py` must pass; each TS check verdict must equal the Python verdict. | every push |
| **Golden maps** | 12 pinned seeds (2 per theme; 96² and 256²): sha256 of the `.timber` plus key metrics (score, check values). Any change must be intentional: `npm run golden:update`, and the diff shows the metric changes. | every push |
| **Batch pass rates** | `tools/batch.ts`: 100 seeds per theme per size at Normal, plus 30 at Easy and Hard. Report first-attempt and final pass rates, failing checks, score distribution and timings, with generated metrics beside the official ranges. Gates: final pass rate ≥ 98% within 12 attempts, first attempt ≥ 60%, median 256² time ≤ 8 s. | nightly and before release |
| **End-to-end** (Playwright) | Generate → preview → download on 128²; share link round trip; layer toggles; worker cancel. | every push |
| **In-game** | §18, once per milestone that changes the file format or the generator's physical rules, recorded in `docs/ingame-log.md`. | per milestone |

---

## 16. Milestones

Each milestone can be built and verified on its own. Effort: S under a day, M 1–3 days, L 3–7
days of focused work.

| # | Milestone | Delivers | Acceptance |
|---|---|---|---|
| **1** | **End-to-end slice** (L) | Vite + TS + Preact app shell. `core/format` (writer, footprints, C# float format, fflate, jpeg-js). RNG streams. River Valley ported from the prototype *without* the water sim: sources placed, water left as zeros. Slopes and start rules. File and placement validation (§11.1–11.2). 2D preview (terrain, start, entities). Settings: seed, size preset, difficulty. Download. GitHub Pages deploy. | 50 seeds × 3 sizes pass Python `validate.py` file and placement checks and `roundtrip_test.py`; identical sha256 in Node and Chromium for 10 seeds; 128² generates in < 3 s; **in-game check A** (§18). |
| **2** | **Water and playability** (L) | `sim/*` exact port with golden vectors; steady-state water, moisture and contamination; pre-filled water in the file; vegetation placed from moisture; all §11.3–11.4 checks; retry loop; map card with validation report; water, moisture and reach layers. | Golden vectors pass; the game's save reproduced within 0.001; batch 100 seeds at 128² Normal: final pass ≥ 98%, first attempt ≥ 60%; **in-game check B** (pre-filled water, tree survival). |
| **3** | **Settings, sharing, themes I** (L) | The full settings panel (§5) with reference bands; URL codec; Canyon and Lake Basin archetypes; set pieces dam site, waterfall, terraced cliffs, badwater counterplay; the dam-site layer. | Each setting moves its measured target in batch runs (a test per setting); share links reproduce byte-identical files; batch per theme ≥ 98% final pass; **in-game check C** (build a dam at a generated dam site; a waterfall runs a water wheel). |
| **4** | **Interestingness** (M) | `score.ts` calibrated on official maps; K = 3 candidates with progressive preview; names and premises; score on the card. | The official score distribution is documented; recommended official maps in the top third; the name and premise match the detected features on 30 hand-checked maps; 256² with K = 3 ≤ 20 s. |
| **5** | **Themes II and 1.0 features** (L) | Highlands, Delta, Islands; second district; obstacle-with-payoff set pieces; NaturalDam weir; plugged spillway; thorn belts; relics; geothermal; mine sites. | Batch per theme ≥ 98%; every new object passes the placement emulation; **in-game check D** (the new objects load with no loading issues; demolish a spillway plug). |
| **6** | **3D, ratings, polish** (M) | Lazy three.js view; ratings flow and `tools/ratings.ts`; install help; the Impeccable design pass with the timbermods design system; accessibility (keyboard, contrast) and mobile layout; versioned deploys `/v/<version>/`. | 3D builds in < 1.5 s at 256²; a Lighthouse performance score ≥ 90 on desktop; a rating issue created from the page with every field filled; an old-version link reproduces its file. |
| **7** | **Later** | NaturalOverhang bridges; seeps and an arid theme; caves with stacked-column water; aquifers; badtide drains; unstable cores out of Advanced. | Each behind a feature flag until its own in-game check passes. |

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

Open questions for you:
1. Is `timbermods.github.io/Dam-Good-Maps/` the address you want, or a custom domain?
2. Should maps offer an optional in-game difficulty *warning* only, or also refuse to generate
   Hard-designed maps with Scarce reserves (currently allowed with a warning)?
3. Are GitHub issue ratings acceptable, or do you prefer a no-account form from the start?

---

## 18. In-game checklist

Short, and needs you. Each item names the file to use from `out/` (or the milestone's batch
output), what to do, and what should happen. Record the result in `docs/ingame-log.md`.

**A. Load and start** (milestone 1; now with `out/Dam Good Maps - River Valley 4242.timber`)
1. Copy the file to `Documents\Timberborn\Maps`. It appears under New game with its thumbnail and
   description.
2. Start Folktails on Normal:
   - no "Loading issues" panel;
   - the district center stands where the white square is on `out/…4242.png`, with the door facing
     the river;
   - 9 adults and 4 children spawn.
3. Walk test:
   - beavers cannot step up a 1-level terrace edge where there is no slope;
   - they can climb the generated slopes both ways.
4. Open the map in the map editor: it opens without errors, and terrain edits and saving work.
5. Start Iron Teeth once: the district center fits and beavers spawn.

**B. Water and plants** (milestone 2)
1. The pre-filled file: rivers flow on day 1 without a visible surge or drain, the lake levels stay
   put over the first day, and the berry bushes near the start are not flagged dry.
2. `… (empty water).timber`: rivers fill within about a day, and the same trees survive.
3. After 15 days, living groves near the river are alive and the dead stands are still dead with
   logs.
4. The badwater marsh stays downstream; the start's water stays clean.

**C. Set pieces** (milestone 3)
1. Build a dam or levees across the gorge at the dam-site marker: the basin fills to about the
   crest without leaking round the ridge ends.
2. Place a water wheel at a generated waterfall: it turns.
3. Survive the first drought on Normal using the stored water.

**D. 1.0 objects** (milestone 5): a map with NaturalDam, Blockage, Thorns, relics, a geothermal field
and a mine site loads with no loading issues. Demolishing the plug releases the water as the card
says.

**E. Open questions from the investigation** (any time)
1. Terrain above 16: can the editor load and edit it?
2. Beavers walk *through* ruin columns, as the code says.
3. Aquifer + powered drill during drought: no water?
4. What a map with no StartingLocation does on a new game (for the error message).
