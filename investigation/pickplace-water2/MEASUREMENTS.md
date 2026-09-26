# Water and playability by place

Local prototype checks, not in-game tests. Every cell lists 96² / 128² / 256² in that order. Native-water retention uses ESA WorldCover 2021 class 80. Before and fixed-footprint after measure the same previous map extent; water outside the new map counts as lost. n/a means no measurable classified water, inadequate reference coverage, or no completed result after an error/timeout; never 100% survival. “Signature target” includes deliberately designed drainage when no native feature was observed. See METHODS.md.

| Place | Local playability | Signature target | Both | Before water retained | After, same old footprint | Before signature | After signature, same footprint | Returned m/tile |
|---|---|---|---|---|---|---|---|---|
| Grand Canyon Colorado | yes / yes / yes | yes / yes / yes | yes / yes / yes | 62.0% / 57.6% / 70.4% | 74.4% / 83.2% / 80.5% | no / yes / yes | yes / yes / yes | 120 / 60 / 60 |
| Colca Canyon | yes / yes / no | yes / yes / yes | yes / yes / no | 91.2% / 68.8% / 66.1% | 41.8% / 74.7% / 80.5% | yes / no / no | yes / yes / no | 60 / 60 / 60 |
| Verdon Gorge | yes / yes / yes | yes / yes / yes | yes / yes / yes | 87.7% / 51.4% / 87.7% | 79.5% / 82.0% / 94.4% | yes / yes / yes | yes / yes / yes | 60 / 120 / 60 |
| Tara Gorge | yes / yes / no | yes / yes / yes | yes / yes / no | 100.0% / 99.9% / 100.0% | 100.0% / 99.9% / 100.0% | n/a / yes / yes | n/a / yes / yes | 60 / 120 / 60 |
| Mississippi birdfoot | no / no / no | yes / yes / yes | no / no / no | 0.8% / 7.2% / 6.4% | 99.3% / 99.6% / 98.1% | no / no / no | yes / yes / yes | 60 / 120 / 240 |
| Danube delta | no / no / no | yes / yes / yes | no / no / no | 0.2% / 47.0% / 9.1% | 11.6% / 19.2% / 21.6% | no / no / no | no / no / no | 60 / 60 / 60 |
| Waimakariri River | no / no / yes | yes / yes / yes | no / no / yes | 51.8% / 0.4% / 58.7% | 99.9% / 99.2% / 95.7% | no / no / no | yes / yes / yes | 60 / 60 / 120 |
| Tagliamento River | yes / yes / yes | yes / yes / yes | yes / yes / yes | 0.0% / 8.3% / 26.8% | 93.1% / 95.4% / 99.4% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Goosenecks San Juan | yes / yes / yes | yes / yes / yes | yes / yes / yes | 65.8% / 74.9% / 95.5% | 100.0% / 99.5% / 99.9% | no / no / yes | yes / yes / yes | 120 / 60 / 60 |
| Mamore River | no / no / no | yes / yes / yes | no / no / no | 1.3% / 37.9% / 37.9% | 99.4% / 98.7% / 99.3% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Death Valley Badwater fan | yes / yes / yes | yes / yes / yes | yes / yes / yes | 25.2% / 1.3% / 3.1% | 25.7% / 15.6% / 8.7% | n/a / n/a / no | n/a / n/a / yes | 60 / 60 / 60 |
| Taklimakan Kunlun fan | yes / yes / no | yes / yes / yes | yes / yes / no | n/a / n/a / 0.0% | n/a / n/a / 98.3% | n/a / n/a / no | n/a / n/a / yes | 240 / 120 / 120 |
| Crater Lake | yes / yes / yes | yes / yes / yes | yes / yes / yes | 0.0% / 0.0% / 0.0% | 100.0% / 90.9% / 99.9% | no / no / no | yes / yes / yes | 120 / 60 / 60 |
| Ngorongoro | yes / yes / yes | yes / yes / yes | yes / yes / yes | 96.1% / 10.0% / 99.8% | 98.9% / 99.7% / 90.4% | yes / no / yes | yes / yes / no | 120 / 60 / 60 |
| Mount Fuji | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / n/a / 0.4% | n/a / n/a / 94.6% | n/a / n/a / no | n/a / n/a / yes | 120 / 240 / 240 |
| Mount Taranaki | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / 0.0% / 68.8% | n/a / 0.0% / 23.0% | n/a / n/a / n/a | n/a / n/a / n/a | 60 / 30 / 60 |
| Monument Valley | yes / yes / no | yes / yes / yes | yes / yes / no | 0.0% / 0.0% / 0.6% | 75.4% / 75.1% / 83.1% | no / no / no | yes / yes / no | 60 / 60 / 60 |
| Capitol Reef | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 60 / 60 / 60 |
| Badlands National Park | yes / no / no | yes / yes / yes | yes / no / no | 3.7% / 2.7% / 6.6% | 8.8% / 4.6% / 58.1% | n/a / no / no | n/a / no / yes | 60 / 60 / 60 |
| Bardenas Reales | yes / no / yes | yes / yes / yes | yes / no / yes | n/a / 0.1% / 2.0% | n/a / 96.2% / 95.7% | n/a / no / no | n/a / yes / yes | 60 / 60 / 120 |
| Li River Yangshuo | yes / yes / no | yes / yes / yes | yes / yes / no | 51.6% / 51.6% / 74.8% | 78.8% / 98.0% / 98.8% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Phong Nha | yes / yes / yes | yes / yes / yes | yes / yes / yes | 53.9% / 0.0% / 0.0% | 15.3% / 98.2% / 96.3% | no / no / no | no / yes / yes | 60 / 60 / 60 |
| Geirangerfjord | yes / yes / no | yes / yes / yes | yes / yes / no | 81.6% / 0.0% / 54.8% | 41.8% / 99.6% / 99.2% | no / no / no | no / yes / yes | 60 / 60 / 60 |
| Milford Sound | yes / yes / no | yes / yes / yes | yes / yes / no | 0.5% / 71.1% / 14.1% | 99.7% / 99.6% / 98.2% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Yosemite Valley | yes / yes / yes | yes / yes / yes | yes / yes / yes | 33.5% / 26.8% / 33.6% | 33.9% / 3.9% / 61.6% | no / no / no | no / no / yes | 240 / 60 / 60 |
| Lauterbrunnen | no / no / no | yes / yes / yes | no / no / no | 0.1% / 0.2% / 14.8% | 57.6% / 83.6% / 53.0% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Drakensberg Amphitheatre | yes / no / yes | yes / yes / yes | yes / no / yes | 1.9% / 0.0% / 37.8% | 84.6% / 59.5% / 88.8% | no / no / no | yes / yes / yes | 60 / 60 / 60 |
| Bandiagara | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 120 / 60 / 30 |
| Colorado Plateau | yes / yes / no | yes / yes / yes | yes / yes / no | n/a / n/a / 28.9% | n/a / n/a / 48.3% | n/a / n/a / no | n/a / n/a / yes | 60 / 60 / 60 |
| Tibetan Plateau | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / n/a / 17.0% | n/a / n/a / 14.8% | n/a / n/a / no | n/a / n/a / no | 60 / 240 / 60 |
| English Lake District | yes / yes / no | yes / yes / yes | yes / yes / no | 60.9% / 91.0% / 65.4% | 61.8% / 99.5% / 99.4% | no / no / no | no / yes / yes | 60 / 60 / 60 |
| Finnish Saimaa | no / yes / n/a | yes / yes / n/a | no / yes / no | 33.8% / 21.9% / n/a | 99.6% / 99.7% / n/a | no / no / n/a | yes / yes / n/a | 60 / 60 / error |
| Green and Colorado | yes / yes / yes | yes / yes / yes | yes / yes / yes | 9.7% / 57.4% / 77.3% | 97.4% / 98.2% / 97.9% | no / no / no | yes / yes / yes | 240 / 60 / 60 |
| Rio Negro and Solimoes | yes / yes / yes | yes / yes / yes | yes / yes / yes | 42.1% / 11.9% / 42.1% | 99.0% / 99.9% / 99.9% | no / no / no | yes / yes / yes | 120 / 120 / 60 |
| Victoria Falls | yes / yes / yes | yes / yes / yes | yes / yes / yes | 15.6% / 14.5% / 39.5% | 97.0% / 99.1% / 99.4% | no / no / no | yes / yes / yes | 240 / 120 / 240 |
| Iguazu Falls | no / no / yes | yes / yes / yes | no / no / yes | 11.1% / 80.7% / 9.8% | 99.7% / 99.6% / 100.0% | no / yes / no | yes / yes / yes | 240 / 240 / 240 |
| Cliffs of Moher | yes / yes / yes | yes / yes / yes | yes / yes / yes | 0.0% / 5.9% / 23.5% | 17.9% / 99.9% / 100.0% | no / no / no | no / yes / yes | 60 / 60 / 60 |
| Twelve Apostles | yes / yes / yes | yes / yes / yes | yes / yes / yes | 10.9% / 53.3% / 21.8% | 99.8% / 99.7% / 99.9% | no / no / no | yes / yes / yes | 60 / 120 / 60 |
| Stockholm archipelago | no / no / no | yes / yes / yes | no / no / no | 18.4% / 40.3% / 41.6% | 100.0% / 31.0% / 100.0% | no / no / no | yes / no / yes | 60 / 60 / 60 |
| Thousand Islands Saint Lawrence | yes / yes / yes | yes / yes / yes | yes / yes / yes | 27.6% / 0.0% / 71.5% | 99.6% / 99.7% / 99.6% | no / no / no | yes / yes / yes | 120 / 60 / 60 |
| Kansas prairie | no / no / no | yes / yes / yes | no / no / no | 25.8% / 0.7% / 25.8% | 19.5% / 15.5% / 53.0% | no / n/a / no | no / n/a / yes | 60 / 60 / 60 |
| Dutch polder | no / no / no | yes / yes / yes | no / no / no | 2.7% / 10.8% / 5.1% | 87.9% / 89.0% / 12.8% | no / no / no | yes / yes / no | 60 / 60 / 60 |
| Ganges plain | yes / no / yes | no / yes / yes | no / no / yes | 17.8% / 17.8% / 17.8% | 30.3% / 0.1% / 9.1% | no / no / no | no / no / no | 240 / 30 / 60 |
| Sahara dunes | yes / yes / yes | yes / yes / yes | yes / yes / yes | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 60 / 60 / 240 |
| Central Pacific control | yes / no / yes | yes / yes / yes | yes / no / yes | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 240 / 240 / 60 |
| Greenland ice sheet | yes / no / no | yes / yes / yes | yes / no / no | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 30 / 30 / 240 |
| Svalbard valley | yes / yes / yes | yes / yes / yes | yes / yes / yes | 0.6% / 44.9% / 18.7% | 99.9% / 99.2% / 99.9% | no / no / no | yes / yes / yes | 60 / 60 / 120 |
| Antarctic Dry Valleys | no / yes / yes | yes / yes / yes | no / yes / yes | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | n/a / n/a / n/a | 240 / 60 / 60 |
| Taveuni dateline | yes / no / no | yes / yes / yes | yes / no / no | 0.0% / 0.0% / 0.0% | 99.5% / 99.8% / 99.9% | no / no / no | yes / yes / yes | 60 / 120 / 240 |
| Kathmandu valley | yes / yes / yes | yes / yes / yes | yes / yes / yes | 32.7% / 69.2% / 57.4% | 84.7% / 90.9% / 85.0% | no / no / n/a | no / yes / n/a | 120 / 120 / 120 |
