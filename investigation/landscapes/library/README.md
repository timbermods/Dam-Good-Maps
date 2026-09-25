# Landscape fixtures

88 converted patches from distinct sampling regions. Every fixture passed the unchanged TypeScript generate-profile checks after a fresh settle. Advisory failures remain in each file.

Open [gallery.html](gallery.html) for previews. Red marks the start; blue is simulated water. North is up.

Each gzip JSON stores row-major heights (y increases north), sources, start anchor, game entities, location, mapping, attribution and checks. `referenceHeights` keeps the same quantised patch before edge sealing, for fair terrain measurements. `heights` is the playable conversion. Sources and resources are simulated or placed for the game. Entity UUIDs are omitted for compact storage; the bench reconstructs them in stored order. Family labels describe sampling regions; a window may show only part of the named landform.

Use these for regression tests, tuning and an optional M11 import. Never load these into the generator as templates. See [attribution](../ATTRIBUTION.md).

## One example per sampling family

The full gallery and index include every fixture. These images show terrain, simulated water and the start.

| Family | Example | Preview |
|---|---|---|
| archipelago | [Near Thousand Islands Saint Lawrence, 60 m per tile](n384-128-60-normalised-16.json.gz) | <img src="previews/n384-128-60-normalised-16.png" alt="Near Thousand Islands Saint Lawrence, 60 m per tile" width="160"> |
| badlands | [Near Badlands National Park (east sample), 30 m per tile](n181-128-30-normalised-16.json.gz) | <img src="previews/n181-128-30-normalised-16.png" alt="Near Badlands National Park (east sample), 30 m per tile" width="160"> |
| braided | [Near Waimakariri River, 30 m per tile](n060-256-30-normalised-16.json.gz) | <img src="previews/n060-256-30-normalised-16.png" alt="Near Waimakariri River, 30 m per tile" width="160"> |
| caldera | [Near Sete Cidades, 60 m per tile](n128-96-60-normalised-16.json.gz) | <img src="previews/n128-96-60-normalised-16.png" alt="Near Sete Cidades, 60 m per tile" width="160"> |
| canyon | [Near Blyde River Canyon (north sample), 30 m per tile](n014-96-30-normalised-16.json.gz) | <img src="previews/n014-96-30-normalised-16.png" alt="Near Blyde River Canyon (north sample), 30 m per tile" width="160"> |
| coast | [Near Na Pali coast, 60 m per tile](n368-128-60-compressed-16.json.gz) | <img src="previews/n368-128-60-compressed-16.png" alt="Near Na Pali coast, 60 m per tile" width="160"> |
| cone | [Near Mount Taranaki, 30 m per tile](n144-256-30-normalised-16.json.gz) | <img src="previews/n144-256-30-normalised-16.png" alt="Near Mount Taranaki, 30 m per tile" width="160"> |
| confluence | [Near Rhine and Moselle, 60 m per tile](n328-128-60-normalised-16.json.gz) | <img src="previews/n328-128-60-normalised-16.png" alt="Near Rhine and Moselle, 60 m per tile" width="160"> |
| delta | [Near Lena delta (southwest sample), 60 m per tile](n055-128-60-normalised-16.json.gz) | <img src="previews/n055-128-60-normalised-16.png" alt="Near Lena delta (southwest sample), 60 m per tile" width="160"> |
| escarpment | [Near Drakensberg Amphitheatre (north sample), 120 m per tile](n262-128-120-normalised-16.json.gz) | <img src="previews/n262-128-120-normalised-16.png" alt="Near Drakensberg Amphitheatre (north sample), 120 m per tile" width="160"> |
| falls | [Near Niagara Falls, 60 m per tile](n348-128-60-compressed-16.json.gz) | <img src="previews/n348-128-60-compressed-16.png" alt="Near Niagara Falls, 60 m per tile" width="160"> |
| fan | [Near Death Valley Badwater fan (east sample), 120 m per tile](n101-128-120-normalised-16.json.gz) | <img src="previews/n101-128-120-normalised-16.png" alt="Near Death Valley Badwater fan (east sample), 120 m per tile" width="160"> |
| fjord | [Near Milford Sound, 60 m per tile](n224-256-60-normalised-16.json.gz) | <img src="previews/n224-256-60-normalised-16.png" alt="Near Milford Sound, 60 m per tile" width="160"> |
| glacial | [Near Lauterbrunnen (north sample), 120 m per tile](n246-256-120-normalised-16.json.gz) | <img src="previews/n246-256-120-normalised-16.png" alt="Near Lauterbrunnen (north sample), 120 m per tile" width="160"> |
| gorge | [Near Verdon Gorge (north sample), 60 m per tile](n022-96-60-normalised-16.json.gz) | <img src="previews/n022-96-60-normalised-16.png" alt="Near Verdon Gorge (north sample), 60 m per tile" width="160"> |
| karst | [Near Chocolate Hills (east sample), 120 m per tile](n209-96-120-normalised-16.json.gz) | <img src="previews/n209-96-120-normalised-16.png" alt="Near Chocolate Hills (east sample), 120 m per tile" width="160"> |
| lakes | [Near English Lake District, 60 m per tile](n300-128-60-normalised-16.json.gz) | <img src="previews/n300-128-60-normalised-16.png" alt="Near English Lake District, 60 m per tile" width="160"> |
| meander | [Near Lower Mississippi oxbows (north sample), 60 m per tile](n098-256-60-normalised-16.json.gz) | <img src="previews/n098-256-60-normalised-16.png" alt="Near Lower Mississippi oxbows (north sample), 60 m per tile" width="160"> |
| mesa | [Near Monument Valley (southwest sample), 120 m per tile](n163-128-120-normalised-16.json.gz) | <img src="previews/n163-128-120-normalised-16.png" alt="Near Monument Valley (southwest sample), 120 m per tile" width="160"> |
| plateau | [Near Colorado Plateau, 30 m per tile](n280-128-30-normalised-16.json.gz) | <img src="previews/n280-128-30-normalised-16.png" alt="Near Colorado Plateau, 30 m per tile" width="160"> |
| random | [Random land 41, 60 m per tile](u040-128-60-normalised-16.json.gz) | <img src="previews/u040-128-60-normalised-16.png" alt="Random land 41, 60 m per tile" width="160"> |
