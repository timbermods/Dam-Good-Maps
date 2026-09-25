# Dam Good Maps

A map generator for [Timberborn](https://mechanistry.com/). Pick settings, generate a map, see it
in the browser and download a `.timber` file that loads and plays in Timberborn 1.1.

The website is in progress, following [ROADMAP.md](ROADMAP.md). Once Pages is on, it is served at
<https://timbermods.github.io/dam-good-maps/>.

The generator:
- Pick a theme: **River Valley**, **Canyon**, **Highlands**, **Lake Basin**, **Delta** or
  **Islands**. Then pick the size and the difficulty.
- Open **Terrain**, **Water**, **Hazards**, **Resources** or **Advanced: start rules** to change the
  map. Each setting shows what the official maps use.
- **Generate** makes the map. Its water is settled by the game's own rules, and it is checked for a
  colony's survival.
- The preview shows water, moisture and reach layers.
- **Copy link** gives a link that opens the same map. It carries the settings, not your edits.
- **Download** the map's `.timber` for the game. **Download project file** keeps it for editing later.

The editor:
- **Refine this map** opens the map in 3D.
- **Land**: draw a **Hill**, **Plateau**, **Ridge**, **Canyon**, **Valley** or **Island**, and pick
  its height and edges. Add **Terraced cliffs**. Click a step to add a **Slope**, or a slope to
  remove it. Draw a **Thorn belt**.
- **Water**: click a **River** from its source to where it ends. Draw a **Lake** by its shore. Add
  a **Waterfall**, a **Dam site**, a **Gorge** or a **Badwater spring**. Click a river to add a
  **Weir** or a **Plug**. Click a lake's shore to add a **Plugged spillway**. **Show dam sites**
  marks the best places for a dam. Select a river and click **Make it badwater** to turn its
  water bad.
- **Resources**: draw a **Forest**, **Berry patch** or **Ruin field**. Green shows where trees and
  bushes live. Click to place a **Mine site**, **Relic** or **Geothermal field**.
- Objects show under the pointer before you click. Green means the game keeps them there. Red
  means it would delete them, and says why.
- Tick **Advanced** to add **Unstable core** and **Object** to **Resources**. **Object** places any
  object by hand. In advanced mode, click a tile to change the objects on it: move, turn or delete
  them, set a water source's strength, or make it turn on in a later cycle.
- **Start**: drag the start. Green means the district center fits.
- Each tool shows what it will do first. **Place** adds it.
- Select a feature to move it, change it or delete it. This works on most of what the generator
  made too.
- A problem shows as soon as you make it, with a button that fixes it.
- **Back to settings** keeps your edits. Generate again and they stay.
- **Open a map** opens any `.timber`, from 0.6 to 1.1.
- The preview's **3D** switch shows the map in 3D.

Your map is saved in the browser as you work.

| Path | What it is |
|---|---|
| [src/](src/) | The website. `src/core/` is the generator and format code: pure TypeScript that runs in the worker, in Node and in tests. |
| [tools/](tools/) | Command-line tools on the same core: batch generation, the Python oracle, the benchmark and the in-game check files. |
| [PLAN.md](PLAN.md) | The implementation plan for the website: architecture, settings, generation pipeline, validation rules, scoring, tests, and (§19) the foundations shared with the editor. |
| [EDITOR_PLAN.md](EDITOR_PLAN.md) | The plan for the in-browser map editor and the Claude integration. |
| [ROADMAP.md](ROADMAP.md) | One milestone order for both plans. |
| [AUDIT.md](AUDIT.md) | The audit that reconciled both plans with the investigation. Kyler's answers to its decisions are in PLAN.md §20. |
| [docs/ingame-log.md](docs/ingame-log.md) | The in-game checks each milestone needs. They are deferred for now and listed as pending. |
| [FORMAT.md](FORMAT.md) | The `.timber` map format as the game writes it in 1.1. |
| [investigation/REPORT.md](investigation/REPORT.md) | What the game's code, data and maps say about map rules and design, with the numbers behind every threshold. |
| [investigation/calibration.json](investigation/calibration.json) | Measurements of the 19 official maps and 9 workshop maps. |
| [prototype/](prototype/) | The Python prototype: map reader/writer, generator, validator and round-trip test. It stays as the reference implementation and test oracle for the website. |

## Website quick start

Node 22 or later. The oracle and the calibration test also need Python 3.11+ with
`prototype/requirements.txt`.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run oracle
```

```bash
npm run gen -- --seeds 1-10 --sizes 96,128,256 --out out/batch
```

- `npm run dev` serves the site at <http://localhost:5173/dam-good-maps/>.
- `npm test` runs the unit and contract tests.
- `npm run oracle` generates 50 seeds × 3 sizes, checks each map with the Python validator and
  round-trip test, and compares the two validators check by check on 50 of them and on the
  official maps (when `investigation/raw/builtin` is present).
- `npm run gen` writes maps from the command line.
- `npm run batch` reports first-attempt and final pass rates (default 100 seeds at 128²).
- `npm run test:e2e` builds the site and runs the browser tests: Chrome and Node produce the same
  bytes, the editor's tools and its generate-refine-regenerate journey, the 3D view, and every local
  investigation map through import, 3D and export.
- `npm run bench` times generation at 128²; `npm run bench:water` times the water settle at 256².
- `npm run bench:3d` measures the 3D view's build time and frame rate at 256² in Chrome. It opens
  browser windows, so it runs locally only. It writes `out/m4/bench3d.json`.
- `npm run fixtures` rewrites the water golden vectors from the Python reference.
- `npm run build:spike` builds the Claude artifact test page into `dist-spike/`.
- `npm run spike:check` runs that page and the Messages API CORS page in Chrome. It writes
  `out/spike/checks.json`.

## Prototype quick start

Python 3.11+ with `numpy` and `Pillow`.

```bash
python prototype/generate_test.py --seed 4242 --out out
```

```bash
python prototype/validate.py out/*.timber
```

```bash
python prototype/roundtrip_test.py
```

The round trip reads maps copied from a local game install into `investigation/raw/` (not
committed; see [investigation/REPORT.md](investigation/REPORT.md) for how they were collected).

To play a generated map, copy the `.timber` file to `Documents\Timberborn\Maps` and pick it
under New game.

## License

MIT, see [LICENSE](LICENSE). Timberborn is a game by Mechanistry; this project is not affiliated
with Mechanistry.
