# Real places

**Built** on branch `feature/real-places` (PLAN §20 D136, ROADMAP "Real places"). It is released as
`real-places-done`, right after `map-look-done`. No generated map changes: the generator stays
0.6.0.

Round 2 (below) changes the titles, the description, **Download**, **Refine**, the card pictures
and where the byte check runs.

- **The gallery** (`real-places/index.html`, `src/places/`), linked as **Real places** at the top of
  the generator. 85 maps made from real land. Each card shows our own top-down render of the map
  and its settled water, the name ("Near Yosemite Valley"), the landform, size and scale, and a
  line on how it plays. **Landform** and size filter the list; the page's query keeps them, so Back
  returns to the same list. On a phone the cards stack, the picture beside the text.
- **Download** fetches the place's data and builds its `.timber` in a worker (`place.worker.ts`),
  with a progress bar; the page never waits on it. **Refine** opens the generator page at
  `#place=<id>`: its worker builds the same file and opens it through the existing import path
  (`ed.openTimber`, `MapSession.importMap`). If a map is saved in the browser, the page asks first
  and offers its project file (a place must never replace a player's edits unasked).
- **The text:** near the top, "Each map is inspired by the land near its namesake, at Timberborn's
  scale. It is not a replica." (Kyler's instruction). At the bottom, **Elevation data**: the source
  (Terrain Tiles on AWS), what was changed, that the providers do not endorse the maps, and every
  required provider notice, verbatim (`investigation/landscapes/ATTRIBUTION.md`;
  `src/core/places/attribution.ts`).
- **In-game description** (`placeDescription`): landform, size, scale and how it plays; "Inspired by
  the land near <place>, at Timberborn's scale; not a replica."; the source, the changes and "The
  data providers do not endorse this map."; the provider notices. The game shows the file name,
  `Near <place>.timber`, as the map's name.
- **One build path** (`src/core/places/place.ts`): the place's objects as entities (ids hashed from
  the place), the canonical settle, soil moisture and contamination (build.ts step 10), the world
  and thumbnail as gen/pack.ts writes them, `validateMap` in the export profile, `writeTimber`. A
  pure function of the data: the same bytes in Node, in the gallery's worker and in the editor's.
- **The data** (`tools/real-places.ts`, `npm run places`): reads the survey's library at run time
  (product code never imports `investigation/`) and writes `public/real-places/`: `index.json`
  (38 KB, 8 KB gzipped), `data/<id>.json.gz` (453 KB in all, at most 22 KB each: heights as one
  digit a tile, sources, start, and each kind of object as tile gaps) and `cards/<id>.jpg` (240²
  JPEG, 652 KB in all, 7.7 KB each). It checks that the place's builders write exactly the
  survey's objects, builds and validates every map, and records each file's sha256 in the index.
  `--check` compares the committed files with a fresh run. The gallery keeps the library's order:
  rounds of one place per landform, so neighbours differ.
- **Page weight:** the page's own code is 26 KB of script (11 KB gzipped) and 9 KB of styles. It
  loads the index and the cards in view (lazily); the build worker (101 KB) and a map's data load
  on the first **Download**.
- **Left out:** the survey's three random-land controls (Random land 37, 41 and 49): controls, not
  places (Kyler's instruction). 85 of the library's 88.
- **Names:** the survey's, without "(… sample)" and the scale. One is renamed: "Near Death Valley
  Badwater fan" is "Near Death Valley", because badwater is a hazard in the game and the map has
  none.
- **How it plays:** one line per landform family, from the survey's play value
  (`investigation/landscapes/FAMILIES.md`) in plain words. It says what the landform tends to give;
  a window may show only part of the named landform.
- **Separate from the generator** (D108): only the gallery, the generator worker's `openPlace` and
  the page's Refine link use real places, and the page's own bundle loads only the fetch helpers. A
  contract test holds this.
- **M12 readiness** (D134): not applicable. Real places are content, not a way to edit or
  understand maps.

## Checks

Blocking, under Kyler's one rule (D115): every map passes the validators and exports, and the page
works on a desktop and a phone.

- **Every map** (`tests/contract/places-build-{1,2,3}.test.ts`, 85 cases): built as the page builds
  it, it passes the export profile, and its written file passes every check of the generate profile
  on its own settle; its sha256 and size are the index's. Advisories stay advisories (most maps
  have `plants.drought`; some `start.reach` or `water.reservoir`).
- **Both validators** (`tests/contract/places.test.ts`, a sample of 5: two at 96², two at 128², one
  at 256²): `prototype/validate.py` passes each and gives every check the same verdict. CI has
  Python; a machine without it skips this.
- **Refine** (the same sample): the editor imports each place with its name and size, passes the
  load checks, and exports it unedited as the same file.
- **Credits:** every place's description carries the "not a replica" line, the source and every
  provider notice.
- **The page** (`tests/e2e/places.spec.ts`): the gallery lists 85 cards with the credits; the
  landform and size filters work and survive a reload; **Download** saves `Near <place>.timber`,
  byte for byte Node's and the index's; Chromium and Node build the same file at 96², 128² and 256²;
  **Refine** opens the editor on the place, and its export is the same file; the generator links to
  the gallery, and a saved map is never replaced unasked; on a phone (375×812, touch) nothing is
  wider than the screen, the cards stack, the filters work and a download is Node's file; an
  unknown place says so and shows the generator.

Information:
- Build time, Node on this machine: 96² 0.3–2 s, 128² 0.8–4.5 s, 256² 6–14 s, nearly all of it the
  canonical settle. The browser is about the same. A phone will be slower; the page stays
  responsive.
- CI's unit and contract step takes about 5.5 minutes, up from about 2: the 85 builds run in three
  files side by side (about 2 minutes each on CI), and the Python sample takes most of
  `places.test.ts`'s 2 minutes. Moving the three build files to the nightly run would win the
  time back, at the cost of finding a changed place a day later.
- The in-game check is optional: when the probe is available, Kyler may approve a batch that loads
  a few of them (D117). None was run, and Timberborn was never launched.
- `playwright.config.ts` takes `DGM_E2E_PORT` (default 4173), so the browser tests can run beside
  another checkout's.

Deployed: real-places-done, 2026-09-25, live check passed (PR #31; the generator's download unchanged, sha256 `5118b6a6…`; the live gallery page and its index answer 200).

## Round 2 (Kyler, 2026-09-25)

Built on branch `feature/real-places-2`. Kyler's four instructions, and the card pictures he added.
Several round-1 details above are replaced here: the titles, the description, **Download**,
**Refine**, the pictures and where the byte check runs.

- **Credits by link.** Every provider's licence or terms were read, and each verdict is in
  [docs/real-places-credits.md](../real-places-credits.md). Nine of the eleven accept credit by a
  link. Two need their notice in the file itself, and only for maps in their region: Kartverket
  (its name wherever its data is used: Geirangerfjord and Lofoten) and LINZ (CC BY 3.0 NZ asks
  for the licence on every copy: Waimakariri River, Milford Sound, Hooker Valley, Mount Taranaki).
  Kyler confirmed both judgement calls: Austria's data under CC BY 4.0, and New Zealand's notice
  kept in the file.
  The new **credits page** (`real-places/credits/`) and the gallery show the same credits in full
  (`src/places/Credits.tsx`): the source, the changes, that the providers do not endorse the maps,
  and every notice with a link to its licence.
- **The in-game description** is the title; "Inspired by the land near <place>, at Timberborn's
  scale; not a replica."; "Credits: https://timbermods.github.io/dam-good-maps/real-places/credits/";
  then, for the six maps above, "Elevation data: <notice>." Plain ASCII: whether the game shows
  other characters waits for a probe batch, asked for first. So Kartverket's line has "(c)" where
  its terms ask for "©" until then.
- **Built at deploy time.** `npm run places:build` (`tools/places-build.ts`) builds every place's
  `.timber` with `src/core/places/place.ts`, in worker threads, into
  `dist/real-places/maps/<id>.timber`. It runs in `deploy.yml` after `vite build`, before the
  noindex step. A map that fails the export profile or any check of the generate profile, or whose
  file is not the index's (sha256 and size), fails the deploy. Every deploy rebuilds with the engine
  it deploys, so the files always match it; the index keeps each sha256, so a change shows in its
  diff. 85 maps in 30 s on this machine's 16 threads; 15.7 MB in all, the largest 437 KB.
- **Download** is a plain link to the static file (`download` names it after the title): instant.
  **Refine** fetches the same file and opens it through `MapSession.importMap`. The browser never
  builds a place: `place.worker.ts` and the generator worker's `openPlace` are gone.
  `npm run dev` builds a map on request with the same code (a dev-server middleware in
  `vite.config.ts`); `npm run preview` serves what `npm run build` and `npm run places:build` wrote.
- **The byte check** (`places-build-{1,2,3}.test.ts`, all 85 maps against the index) moved to the
  nightly run (vitest's heavy project). It also runs in the release check: a CI job,
  `release-places`, on pull requests whose base is `main` (`npm run test:places`). Every push keeps
  a sample of every size (`placeSample`: the first two at 96² and 128², the first at 256²) with the
  same assertions, in `places.test.ts`; the browser tests serve the same sample's files. CI's unit
  and contract step is back to about 3.5 minutes (from about 5.5); `npm run test:places` takes
  about 90 s here.
- **Titles.** No "Near", no "(… sample)", and the awkward ones tidied; the index keeps the survey's
  name verbatim (`surveyName`) and the part it sampled (`sample`). The ids, the data and picture
  files and the `.timber` names follow the new titles. The description's sentence adds "the" where
  a title needs it ("near the Grand Canyon"). The gallery's "inspired by, not a replica" line
  stays. Per-map "how it plays" lines wait for M9c's names and descriptions.
- **Card pictures.** Two for each place, both drawn by the Map look 3D view in its clean look, on
  this machine's GPU in the installed Chrome (`npm run places:thumbs`, `tools/places-thumbs.ts`),
  as WebP:
  - the **overview**, 480 px (twice the card): the camera looks along the map's axis nearest to
    the way the land rises, from the low side, and stands so the land fills the picture: the far
    edge spans it under a thin band of sky, and the near edge runs off the bottom. Drawn at 960 px
    and scaled down.
  - the **map from above**, north up (the view's Top mode, an orthographic camera): moist grass,
    cracked earth, water by depth and contaminated ground, as in the 3D view. A whole number of
    pixels a tile (480 px at 96², 512 px at 128² and 256²), so every tile edge is sharp.

  About 84 KB a place, 7.1 MB for all 85; the gallery loads them lazily, as their cards come into
  view. The index records which `.timber` they show (`imageFrom`); a test fails when a map changed
  and its pictures did not. About 4.3 s a place, 6 minutes for all 85. Kyler approved the
  direction; he picks the card layout from two, behind `?cards=`: `minimap` (the default: the
  overview, with the map from above as a minimap in its corner that fills the picture on hover,
  keyboard focus or a tap) and `side` (the two side by side; on a phone, above the text). Both are
  shared components with shared styles (`src/ui/Pictures.tsx`, `app.css`), as is the link that
  looks like a button, so the design pass restyles them rather than rebuilds them (D176). All the
  pictures are drawn again after the rebuild without walls.
- **The survey's elevation patches, downloaded again** (Kyler's yes, 2026-09-25), for the rebuild:
  the survey's own `sample.ts`, unchanged, into its ignored cache
  (`investigation/landscapes/.cache/`), with at most 6 requests at once, 50 ms apart. All 4,050
  patches (681 MB) from 6,102 Terrain Tiles (396 MB) in 5.5 minutes, no failures. Every tile
  matches the sha256 the survey recorded, and the rebuilt patch manifest is byte for byte the
  committed one. Nothing of it is committed.
- **The live check** also downloads the smallest real place from the live gallery and compares it
  with the deployed index's sha256 (and the checked-out commit's), and loads the credits page.

Title changes (old → new). Every other title only loses "Near": Badlands National Park, Toklat
River, Crater Lake, Colca Canyon, Twelve Apostles, Mount Mayon, Rhine and Moselle, Drakensberg
Amphitheatre, Kaieteur Falls, Death Valley, Geirangerfjord, Torres del Paine, Tiger Leaping Gorge,
Phong Nha, Uvac River, Mount Roraima, Ethiopian Highlands, Lofoten, Drumheller, Tagliamento River,
Blyde River Canyon, Cliffs of Moher, Paricutin, Alaknanda and Bhagirathi, Niagara Falls, Glencoe,
Verdon Gorge, Chocolate Hills, Kinabatangan River, Deccan Plateau, Bardenas Reales, Waimakariri
River, Lake Toba, Mount Etna, Gullfoss, Milford Sound, Lauterbrunnen, Katherine Gorge, Bungle
Bungle, Tibetan Plateau, Painted Desert, Ngorongoro, Fish River Canyon, Mount Fuji, Victoria Falls,
Todgha Gorge, Monument Valley, Colorado Plateau, Sete Cidades, Copper Canyon, Mount Taranaki,
Bandiagara, Iguazu Falls, Yosemite Valley, Tara Gorge, Mamore River, Capitol Reef, Altiplano.

| Old | New |
|---|---|
| Near Thousand Islands Saint Lawrence | Thousand Islands |
| Near Lena delta | Lena Delta |
| Near English Lake District | Lake District |
| Near Aso caldera | Aso Caldera |
| Near Danube delta | Danube Delta |
| Near Western Ghats Mahabaleshwar | Mahabaleshwar, Western Ghats |
| Near Roaring River fan | Roaring River Fan |
| Near Chilean Aysen fjord | Aysen Fjord |
| Near Finnish Saimaa | Lake Saimaa |
| Near Ennedi plateau | Ennedi Plateau |
| Near Grand Canyon Colorado | Grand Canyon |
| Near Na Pali coast | Na Pali Coast |
| Near Godavari delta | Godavari Delta |
| Near Niagara escarpment Hamilton | Niagara Escarpment |
| Near Taklimakan Kunlun fan | Kunlun Alluvial Fan |
| Near Dinaric karst Plitvice | Plitvice Lakes |
| Near Lower Mississippi oxbows | Mississippi Oxbows |
| Near Skeidara outwash | Skeidara Outwash |
| Near Blue Mountains Jamison | Blue Mountains |
| Near Atacama fan | Atacama Fan |
| Near Kenai Aialik Bay | Aialik Bay |
| Near Aoraki Hooker Valley | Hooker Valley |
| Near Li River Yangshuo | Li River |
| Near Goosenecks San Juan | Goosenecks of the San Juan |
| Near Brahmaputra near Majuli | Majuli, Brahmaputra |
| Near Ilulissat icefjord | Ilulissat Icefjord |
| Near Tsingy Bemaraha | Tsingy de Bemaraha |

Tests updated to Kyler's decisions (D148), none weakened:
- `places.test.ts`: the title check (was "starts with Near") checks the new rules, the survey's
  name and sample in the index, and the renames; the description check (was: the full credits in
  the file) checks the new format, plain ASCII, and exactly which maps carry which notice; the card
  check (was a 240 px JPEG) checks a 480 px WebP that shows the current map; the D108 check (was:
  the gallery, the editor's worker and the Refine link use real places) drops the worker, which no
  longer builds them, and adds that the pages only import the builder's types. New: every
  provider's licence and verdict; a sample of every size, built, validated and compared with the
  index on every push.
- `places-build-*.test.ts`: unchanged assertions, now nightly and in the release check.
- `places.spec.ts`: **Download** is a link to the static file (was a button that built it); "Node
  and Chromium build the same file" becomes "the site serves each place's `.timber` as Node builds
  it", since the browser no longer builds one; the credits test checks every notice and licence
  link. New: the credits page on a desktop and a phone, and that the pictures load lazily.
- `tests/live/live.spec.ts`: new, the real place and the credits page (above).

Checks: `npm run typecheck`, `npm run test:quick`, `npm run test:e2e` and `npm run test:places`
pass locally. The deploy build (`npm run build`, `npm run places:build` and the noindex step) was
run locally, and the live check passes against it, served locally. Timberborn was never launched.
