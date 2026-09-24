# Dam Good Maps

A map generator for [Timberborn](https://mechanistry.com/). Pick settings, generate a map, see it
in the browser and download a `.timber` file that loads and plays in Timberborn 1.1.

The website is not built yet. This repository currently holds:

| Path | What it is |
|---|---|
| [PLAN.md](PLAN.md) | The implementation plan for the website: architecture, settings, generation pipeline, validation rules, scoring, tests and milestones. |
| [FORMAT.md](FORMAT.md) | The `.timber` map format as the game writes it in 1.1. |
| [investigation/REPORT.md](investigation/REPORT.md) | What the game's code, data and maps say about map rules and design, with the numbers behind every threshold. |
| [investigation/calibration.json](investigation/calibration.json) | Measurements of the 19 official maps and 9 workshop maps. |
| [prototype/](prototype/) | The Python prototype: map reader/writer, generator, validator and round-trip test. It stays as the reference implementation and test oracle for the website. |

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
