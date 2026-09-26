# All conversion results

47/150 (31.3%) pass the labelled local checks. 30/50 places pass at one or more sizes. 27/150 pass the unchanged base validator. No in-game tests. All 150 attempts count.

| Size | Passes | Total median / p90 / max (s) | Convert median (s) | Preview + fetch median (s) |
| --- | ---: | --- | ---: | ---: |
| 96² | 10/50 | 2.25 / 3.72 / 4.68 | 1.14 | 0.96 |
| 128² | 17/50 | 2.10 / 4.41 / 6.39 | 1.61 | 0.23 |
| 256² | 20/50 | 7.81 / 16.47 / 21.66 | 6.63 | 0.63 |

One machine, ordinary network, cache reused across sizes. Timings include failed conversions.

| Cheap prediction | Actual passes |
| --- | ---: |
| promising | 45/131 |
| uncertain | 2/9 |
| difficult | 0/10 |

Failures overlap:

- water.settles: 67
- start.water.D153: 36
- start.wood: 9
- start.food: 8
- resources.bushes: 8
- water.source.D152: 8
- resources.scrap: 5
- ruins.access: 1

[All renders](results/gallery.html) · [Contact sheet](results/contact-sheet.png). Blue is simulated water, lighter terrain is higher; yellow square marks the start. Unsettled water is a terminal simulation state, not a steady-state promise. Previews omit resources and slopes. [Attribution](ATTRIBUTION.md).

| Place | Family | 96 | 128 | 256 |
| --- | --- | --- | --- | --- |
| Grand Canyon Colorado | canyon | [fail · 60 m/tile](results/01-96.json) | [pass · 60 m/tile](results/01-128.json) | [pass · 60 m/tile](results/01-256.json) |
| Colca Canyon | canyon | [pass · 60 m/tile](results/02-96.json) | [pass · 60 m/tile](results/02-128.json) | [pass · 60 m/tile](results/02-256.json) |
| Verdon Gorge | gorge | [fail · 60 m/tile](results/03-96.json) | [fail · 60 m/tile](results/03-128.json) | [fail · 60 m/tile](results/03-256.json) |
| Tara Gorge | gorge | [pass · 60 m/tile](results/04-96.json) | [pass · 60 m/tile](results/04-128.json) | [pass · 60 m/tile](results/04-256.json) |
| Mississippi birdfoot | delta | [fail · 120 m/tile](results/05-96.json) | [fail · 120 m/tile](results/05-128.json) | [fail · 60 m/tile](results/05-256.json) |
| Danube delta | delta | [fail · 60 m/tile](results/06-96.json) | [pass · 60 m/tile](results/06-128.json) | [fail · 120 m/tile](results/06-256.json) |
| Waimakariri River | braided | [fail · 60 m/tile](results/07-96.json) | [fail · 60 m/tile](results/07-128.json) | [fail · 60 m/tile](results/07-256.json) |
| Tagliamento River | braided | [fail · 60 m/tile](results/08-96.json) | [pass · 60 m/tile](results/08-128.json) | [fail · 60 m/tile](results/08-256.json) |
| Goosenecks San Juan | meander | [fail · 60 m/tile](results/09-96.json) | [pass · 60 m/tile](results/09-128.json) | [fail · 60 m/tile](results/09-256.json) |
| Mamore River | meander | [fail · 60 m/tile](results/10-96.json) | [fail · 60 m/tile](results/10-128.json) | [fail · 60 m/tile](results/10-256.json) |
| Death Valley Badwater fan | fan | [fail · 60 m/tile](results/11-96.json) | [pass · 60 m/tile](results/11-128.json) | [fail · 120 m/tile](results/11-256.json) |
| Taklimakan Kunlun fan | fan | [fail · 60 m/tile](results/12-96.json) | [fail · 60 m/tile](results/12-128.json) | [fail · 60 m/tile](results/12-256.json) |
| Crater Lake | caldera | [pass · 120 m/tile](results/13-96.json) | [fail · 60 m/tile](results/13-128.json) | [pass · 60 m/tile](results/13-256.json) |
| Ngorongoro | caldera | [fail · 60 m/tile](results/14-96.json) | [fail · 60 m/tile](results/14-128.json) | [pass · 60 m/tile](results/14-256.json) |
| Mount Fuji | cone | [fail · 60 m/tile](results/15-96.json) | [fail · 60 m/tile](results/15-128.json) | [fail · 120 m/tile](results/15-256.json) |
| Mount Taranaki | cone | [fail · 60 m/tile](results/16-96.json) | [fail · 60 m/tile](results/16-128.json) | [pass · 60 m/tile](results/16-256.json) |
| Monument Valley | mesa | [fail · 60 m/tile](results/17-96.json) | [pass · 60 m/tile](results/17-128.json) | [pass · 60 m/tile](results/17-256.json) |
| Capitol Reef | mesa | [fail · 60 m/tile](results/18-96.json) | [pass · 60 m/tile](results/18-128.json) | [fail · 60 m/tile](results/18-256.json) |
| Badlands National Park | badlands | [fail · 60 m/tile](results/19-96.json) | [fail · 60 m/tile](results/19-128.json) | [fail · 60 m/tile](results/19-256.json) |
| Bardenas Reales | badlands | [pass · 60 m/tile](results/20-96.json) | [fail · 60 m/tile](results/20-128.json) | [pass · 60 m/tile](results/20-256.json) |
| Li River Yangshuo | karst | [fail · 60 m/tile](results/21-96.json) | [pass · 60 m/tile](results/21-128.json) | [pass · 60 m/tile](results/21-256.json) |
| Phong Nha | karst | [fail · 60 m/tile](results/22-96.json) | [fail · 60 m/tile](results/22-128.json) | [fail · 60 m/tile](results/22-256.json) |
| Geirangerfjord | fjord | [fail · 120 m/tile](results/23-96.json) | [fail · 60 m/tile](results/23-128.json) | [pass · 60 m/tile](results/23-256.json) |
| Milford Sound | fjord | [fail · 120 m/tile](results/24-96.json) | [pass · 120 m/tile](results/24-128.json) | [pass · 60 m/tile](results/24-256.json) |
| Yosemite Valley | glacial | [fail · 120 m/tile](results/25-96.json) | [fail · 120 m/tile](results/25-128.json) | [pass · 60 m/tile](results/25-256.json) |
| Lauterbrunnen | glacial | [fail · 60 m/tile](results/26-96.json) | [fail · 60 m/tile](results/26-128.json) | [pass · 60 m/tile](results/26-256.json) |
| Drakensberg Amphitheatre | escarpment | [pass · 60 m/tile](results/27-96.json) | [fail · 60 m/tile](results/27-128.json) | [pass · 60 m/tile](results/27-256.json) |
| Bandiagara | escarpment | [fail · 60 m/tile](results/28-96.json) | [fail · 60 m/tile](results/28-128.json) | [fail · 60 m/tile](results/28-256.json) |
| Colorado Plateau | plateau | [pass · 60 m/tile](results/29-96.json) | [pass · 60 m/tile](results/29-128.json) | [pass · 60 m/tile](results/29-256.json) |
| Tibetan Plateau | plateau | [fail · 60 m/tile](results/30-96.json) | [fail · 60 m/tile](results/30-128.json) | [fail · 60 m/tile](results/30-256.json) |
| English Lake District | lakes | [fail · 120 m/tile](results/31-96.json) | [fail · 60 m/tile](results/31-128.json) | [pass · 60 m/tile](results/31-256.json) |
| Finnish Saimaa | lakes | [pass · 60 m/tile](results/32-96.json) | [fail · 60 m/tile](results/32-128.json) | [fail · 60 m/tile](results/32-256.json) |
| Green and Colorado | confluence | [fail · 120 m/tile](results/33-96.json) | [pass · 60 m/tile](results/33-128.json) | [pass · 60 m/tile](results/33-256.json) |
| Rio Negro and Solimoes | confluence | [fail · 60 m/tile](results/34-96.json) | [fail · 60 m/tile](results/34-128.json) | [fail · 60 m/tile](results/34-256.json) |
| Victoria Falls | falls | [pass · 60 m/tile](results/35-96.json) | [pass · 60 m/tile](results/35-128.json) | [fail · 60 m/tile](results/35-256.json) |
| Iguazu Falls | falls | [fail · 60 m/tile](results/36-96.json) | [pass · 60 m/tile](results/36-128.json) | [fail · 60 m/tile](results/36-256.json) |
| Cliffs of Moher | coast | [fail · 30 m/tile](results/37-96.json) | [fail · 30 m/tile](results/37-128.json) | [pass · 30 m/tile](results/37-256.json) |
| Twelve Apostles | coast | [fail · 60 m/tile](results/38-96.json) | [fail · 60 m/tile](results/38-128.json) | [fail · 30 m/tile](results/38-256.json) |
| Stockholm archipelago | archipelago | [fail · 120 m/tile](results/39-96.json) | [fail · 120 m/tile](results/39-128.json) | [fail · 60 m/tile](results/39-256.json) |
| Thousand Islands Saint Lawrence | archipelago | [fail · 60 m/tile](results/40-96.json) | [pass · 60 m/tile](results/40-128.json) | [pass · 60 m/tile](results/40-256.json) |
| Kansas prairie | plain | [fail · 60 m/tile](results/41-96.json) | [fail · 60 m/tile](results/41-128.json) | [pass · 60 m/tile](results/41-256.json) |
| Dutch polder | plain | [fail · 60 m/tile](results/42-96.json) | [fail · 60 m/tile](results/42-128.json) | [fail · 60 m/tile](results/42-256.json) |
| Ganges plain | plain | [fail · 120 m/tile](results/43-96.json) | [fail · 120 m/tile](results/43-128.json) | [fail · 60 m/tile](results/43-256.json) |
| Sahara dunes | desert | [pass · 60 m/tile](results/44-96.json) | [fail · 60 m/tile](results/44-128.json) | [fail · 60 m/tile](results/44-256.json) |
| Central Pacific control | ocean | [fail · 60 m/tile](results/45-96.json) | [fail · 60 m/tile](results/45-128.json) | [fail · 60 m/tile](results/45-256.json) |
| Greenland ice sheet | ice | [fail · 60 m/tile](results/46-96.json) | [fail · 30 m/tile](results/46-128.json) | [fail · 60 m/tile](results/46-256.json) |
| Svalbard valley | polar | [fail · 30 m/tile](results/47-96.json) | [fail · 60 m/tile](results/47-128.json) | [fail · 60 m/tile](results/47-256.json) |
| Antarctic Dry Valleys | polar | [fail · 60 m/tile](results/48-96.json) | [fail · 60 m/tile](results/48-128.json) | [fail · 60 m/tile](results/48-256.json) |
| Taveuni dateline | dateline | [fail · 120 m/tile](results/49-96.json) | [fail · 120 m/tile](results/49-128.json) | [fail · 120 m/tile](results/49-256.json) |
| Kathmandu valley | city | [pass · 60 m/tile](results/50-96.json) | [pass · 60 m/tile](results/50-128.json) | [fail · 60 m/tile](results/50-256.json) |
