# What players build: a study of the workshop's maps

What 130 Timberborn workshop maps do that the generator does not, and what to build from it. The
plan to build it is [WORKSHOP-INTEGRATION.md](WORKSHOP-INTEGRATION.md); the numbers are in
[workshop.json](workshop.json); the tools and recipes are in [workshop/](workshop/) (usage in its
[README](workshop/README.md)). Studied on 2026-09-24, against the 19 official maps and the generator on
branch `dev` (six themes, 30 seeds each at 128²).

## The maps

- **Used:** 130 of the 132 workshop items with a map, and all 19 official maps. Every map was read
  with the app's own importer, whatever its version.
- **Skipped (2), both for needing mods:** Tower of Beaverlon (terrain 90 layers high, a taller-terrain
  mod) and Meander Multiplayer (three starts, for the BeaverBuddies mod). Five maps made with the
  "Map Resizer" mod (up to 399×399 and 29×599) load without it and are kept.
- **Era:** 95 made before 1.0 (57 on 0.6, 38 on 0.7), 35 on 1.0 or later (32 on 1.0, 3 on 1.1).
- **Size:** median 32,704 tiles (about 181²); 18 small, 26 medium, 33 large, 47 max, and 6 of
  unusual shape (a side over 256, or 4 times longer than wide). 95 are square.
- **Water** is our own steady state of each map's sources, never the water an older file stores.
  On 49 maps (and 5 official ones) that state cannot stand for the game's water: caves, timed
  sources, aquifers or seeps. Their water numbers are left out.

## Top findings

1. **Workshop maps diverge; generated maps do not.** On a variety score where a typical pair of
   workshop maps is 1 apart, the workshop scores 1.04 and the official maps 0.91. Thirty seeds of one
   theme score 0.16–0.38; all six themes together 0.58. Adding a landmark barely helps; the whole
   layout has to change.
2. **Rivers run every way.** Of maps whose water leaves the map, 10% of workshop maps and none of the
   official maps flow west to east; 74% of generated maps do. South is the commonest direction.
3. **Reservoirs are earned.** A dam of 5 tiles or fewer near the start holds a Normal drought's
   water on 46% of workshop and 36% of official maps; on 77–100% of generated valley maps it does.
   On 46% of workshop maps no straight dam of any length within 40 tiles holds it: players engineer
   their reservoirs with levees and digging.
4. **Workshop maps are more vertical.** Median height range 14 levels (official 13, generated 10);
   tallest waterfall 6.1 levels (official 4.9, generated 2.4); a fall of 4+ levels on 69% of maps
   (official 67%, generated 18%). 19 of 130 go above the editor's limit of 16.
5. **Generated terrain looks engineered.** 13.8% of its height steps lie in straight runs of 8+
   tiles, against 6.6% official and 3.1% workshop; every generated ridge crest sits at one level.
6. **Players are generous.** Per 10,000 tiles, the median workshop map has 4 times the official
   clean water flow, 2 times the trees and 4 times the berry bushes. Its water covers 27% of the map
   (official 14%), and it has 4 inland springs (generated 0).
7. **Official starts stand on wide level land.** 980 tiles at the start's level, with water at that
   level 13 tiles' walk away. Generated starts sit on a 113-tile bench, one level above the
   floodplain, closer to the water (7 tiles) but cut off from it without a slope.
8. **Badwater comes closer in the official maps.** Median 15 tiles from the start; generated 36.
9. **Creators use the 1.0 objects heavily.** In 1.0+ maps: relics 91%, plugs 94%, geothermal 86%,
   caves 83%, thorns and seeps 74%, aquifers 66%, unstable cores 63%.
10. **Natural-looking terrain is favoured.** Among one author's maps, those with fewer straight steps
    and more varied ridges collect more favourites per subscriber (ρ −0.53 and +0.47; hints, not
    proof).

## The catalogue

33 patterns, found by looking at every map. "Engine today": **yes**, today's operations build it;
**laborious**, possible but wants a builder; **needs**, a new builder or premise; **later**, outside
today's scope. ✦ marks whimsical or surprising patterns.

**Shapes**

| Pattern | What it is | Workshop | Official | Engine today | Examples |
|---|---|---|---|---|---|
| Island in a moat ✦ (recipe: moat-island) | A central island or plateau ringed by water: a moat, a round lake with an island, or a river that loops round the middle. | 11 | 0 | yes | [Legacy of the Tides](https://steamcommunity.com/sharedfiles/filedetails/?id=3379271633) by Schtr0umpf; [Beavers Heart - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3323348714) by Janleon |
| Spiral mountain or quarry ✦ (recipe: spiral-mountain) | A ramp that winds up a central peak, or down into a pit, one level per step; sometimes a channel spirals with it. | 6 | 1 (HelixMountain) | laborious | [Beavers Reverse Helix - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3342551295) by Janleon; [Beavers Riverworld - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3349312276) by Janleon |
| Concentric rings ✦ | Nested rings of terraces or water round a centre, like a target or the Eye of the Sahara. | 8 | 1 (HelixMountain) | yes | [Legacy of the Tides](https://steamcommunity.com/sharedfiles/filedetails/?id=3379271633) by Schtr0umpf; [Beavers Reverse Helix - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3342551295) by Janleon |
| Crater or caldera lake ✦ (recipe: crater-lake) | A round basin with a raised rim holding a lake, often with an island in the middle and a notch where it spills out. | 7 | 1 (Craters) | yes | [Ancient Waterways](https://steamcommunity.com/sharedfiles/filedetails/?id=3394638776) by Mr. Bones; [Caldera Lake](https://steamcommunity.com/sharedfiles/filedetails/?id=3536193947) by Astrala |
| Shaped lake or island ✦ (recipe: heart-lake) | A lake, island or range drawn as a recognisable shape: a heart, a star, a spiral, a symbol. | 5 | 0 | yes | [Bloodflow Ravines](https://steamcommunity.com/sharedfiles/filedetails/?id=3393660514) by Fabius; [Beavers Starfish - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3355099196) by Janleon |

**Layouts**

| Pattern | What it is | Workshop | Official | Engine today | Examples |
|---|---|---|---|---|---|
| Real geography ✦ | A real place in miniature: a continent, a lake district, a mountain range. | 4 | 0 | needs | [The Great Lakes](https://steamcommunity.com/sharedfiles/filedetails/?id=3442651964) by ThereisnoP; [Medicine Lake (256x256)](https://steamcommunity.com/sharedfiles/filedetails/?id=3687057301) by DynamiteTiger |
| Archipelago | Many islands in a sea or lake, crossed by shallow water or bridges. | 5 | 1 (ThousandIslands) | yes | [Beavers of the Caribbean - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3357313674) by Janleon; [Beavers Islands - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3353510554) by Janleon |
| Lone island | One island in a sea that fills the map to its edges: survival on a single landmass. | 5 | 0 | needs | [Forsaken Bay [update 6]](https://steamcommunity.com/sharedfiles/filedetails/?id=3414982285) by cactusinapot; [The Island](https://steamcommunity.com/sharedfiles/filedetails/?id=3339712786) by 703joe |
| Cluster of basins | Many round bowls, some wet and some dry, joined by channels or saddles. | 0 | 5 (Beaverome, Craters, Hollows, Pressure, Spillage) | yes | – |
| Ribbon map ✦ | A long thin strip, 3–20 times longer than wide, travelled end to end. | 11 | 0 | yes | [Ribbon World](https://steamcommunity.com/sharedfiles/filedetails/?id=3292255580) by Petrol Pimp (L9M2); [Mystery River - 89x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3382444287) by Janleon |
| Parallel ridges | Ridges and valleys running side by side across the map. | 6 | 1 (MountainRange) | yes | [Beavers Quest - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3331549060) by Janleon; [Beavers Wave - 77x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3363416628) by Janleon |
| Contour terraces | Hillsides stepped like rice terraces, following the contours, with water running down between them. | 4 | 1 (Terraces) | yes | [Terraces](https://steamcommunity.com/sharedfiles/filedetails/?id=3352283943) by Jon Jon; [Gentle Rivers](https://steamcommunity.com/sharedfiles/filedetails/?id=3347027086) by Kettu the Ness |
| Symmetric layout ✦ | Mirror or rotational symmetry: a map that looks designed. | 6 | 0 | needs | [Beavers Wonders - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3350787414) by Janleon; [Beavers of the Caribbean - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3357313674) by Janleon |
| Diorama ✦ | A tiny map (64² or smaller) packed with vertical detail. | 6 | 2 (Cliffside, Diorama) | yes | [Beavers Lost Hope - 70x70](https://steamcommunity.com/sharedfiles/filedetails/?id=3345564262) by Janleon; [Ant Farm V3](https://steamcommunity.com/sharedfiles/filedetails/?id=3522347456) by Moose150 |

**Landmarks**

| Pattern | What it is | Workshop | Official | Engine today | Examples |
|---|---|---|---|---|---|
| Volcano ✦ (recipe: volcano) | A cone rising above the land with a crater at the top, often spilling badwater down its flank. | 4 | 0 | laborious | [Caldera Lake](https://steamcommunity.com/sharedfiles/filedetails/?id=3536193947) by Astrala; [ENGITOPIA'S PEAK](https://steamcommunity.com/sharedfiles/filedetails/?id=3690311632) by Spoenky #6310 |
| Mesa field (recipe: mesa-field) | Many flat-topped columns of different heights standing out of lower ground, some crowned with ruins. | 6 | 1 (Pillars) | yes | [Beavers Canyons - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3352195928) by Janleon; [Beavers Pillars - 128x128](https://steamcommunity.com/sharedfiles/filedetails/?id=3370734125) by Janleon |
| Tower or sky island ✦ (recipe: hanging-lake) | Very tall, narrow landforms or islands raised high above the floor, sometimes with water on top falling off the edge. | 3 | 0 | yes | [Beavers Tower Challenge - 111x111](https://steamcommunity.com/sharedfiles/filedetails/?id=3348192534) by Janleon; [Sky Island Challenge](https://steamcommunity.com/sharedfiles/filedetails/?id=3482086110) by TheNightglow |
| Great scarp or wall | One long cliff or wall splitting the map into an upper and a lower world, crossed by a fall or a breach. | 6 | 0 | yes | [Cozy Secret Valley](https://steamcommunity.com/sharedfiles/filedetails/?id=3518810067) by Krat; [Fortitude](https://steamcommunity.com/sharedfiles/filedetails/?id=3377582190) by Dav |
| Perched channel or aqueduct ✦ | Straight water channels raised above the ground on embankments, crossing or bridging, like ruined aqueducts or a highway interchange. | 4 | 1 (Waterfalls) | laborious | [Ancient Waterways](https://steamcommunity.com/sharedfiles/filedetails/?id=3394638776) by Mr. Bones; [Highway to Heaven](https://steamcommunity.com/sharedfiles/filedetails/?id=3276916782) by Gustoftime |
| Landmark falls (recipe: twin-falls) | Wide or twin waterfalls meant to be seen, often horseshoe-shaped. | 6 | 1 (Waterfalls) | yes | [[1.1] Niagara & Iguazu - Twin Waterfalls Challenge](https://steamcommunity.com/sharedfiles/filedetails/?id=3684122526) by neklai; [Breath taking](https://steamcommunity.com/sharedfiles/filedetails/?id=3347627844) by pauljbeeby |
| Human-made landmark ✦ | Ruins of a megadam, a fortress wall, a stepped pyramid, a highway or a temple, built from terrain and ruin columns. | 10 | 0 | laborious | [Ancient Waterways](https://steamcommunity.com/sharedfiles/filedetails/?id=3394638776) by Mr. Bones; [Highway to Heaven](https://steamcommunity.com/sharedfiles/filedetails/?id=3276916782) by Gustoftime |

**Water**

| Pattern | What it is | Workshop | Official | Engine today | Examples |
|---|---|---|---|---|---|
| Big meanders and oxbows (recipe: oxbow-lake) | A river that loops back on itself, leaving oxbow lakes and near-islands. | 11 | 1 (Meander) | laborious | [River Wonderland](https://steamcommunity.com/sharedfiles/filedetails/?id=3276662512) by Bishotron; [Legacy of the Tides](https://steamcommunity.com/sharedfiles/filedetails/?id=3379271633) by Schtr0umpf |
| Hairpin canyon | A river that doubles back in tight switchbacks inside a canyon. | 2 | 0 | needs | [Secret Tunnel Canyon](https://steamcommunity.com/sharedfiles/filedetails/?id=3275582315) by chagogo; [Cliff River Run](https://steamcommunity.com/sharedfiles/filedetails/?id=3374759219) by Aramil Moonmist |
| River that splits round an island | A river that divides into two arms round a big island (an eye) or fans out into a delta. | 6 | 0 | needs | [Beavers Start - 192x192](https://steamcommunity.com/sharedfiles/filedetails/?id=3324415283) by Janleon; [Gentle Rivers](https://steamcommunity.com/sharedfiles/filedetails/?id=3347027086) by Kettu the Ness |
| Hub and spokes ✦ | Channels radiating from a central pool or island like a compass rose, often symmetric. | 6 | 1 (Craters) | needs | [Beavers Riverland - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3338852125) by Janleon; [Greenfold Basin](https://steamcommunity.com/sharedfiles/filedetails/?id=3648245661) by NadeKatcher |
| Branching network | A tree of rivers or dry rifts branching across the map, meeting at a trunk. | 5 | 0 | laborious | [Beavers Cliffs - 99x99](https://steamcommunity.com/sharedfiles/filedetails/?id=3366356309) by Janleon; [Grand rifts (v7)](https://steamcommunity.com/sharedfiles/filedetails/?id=3571525569) by DuxTUF |
| Chain of lakes | Lakes strung together by short channels and falls, each at its own level. | 7 | 3 (Beaverome, Lakes, Spillage) | yes | [River Wonderland](https://steamcommunity.com/sharedfiles/filedetails/?id=3276662512) by Bishotron; [The Great Lakes](https://steamcommunity.com/sharedfiles/filedetails/?id=3442651964) by ThereisnoP |

**Play**

| Pattern | What it is | Workshop | Official | Engine today | Examples |
|---|---|---|---|---|---|
| Flood challenge ✦ | The map starts flooded (or in a badwater sea) and the colony must drain or tame it. | 4 | 0 | needs | [The Island](https://steamcommunity.com/sharedfiles/filedetails/?id=3339712786) by 703joe; [Beavers Quest - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3331549060) by Janleon |
| Buried water ✦ | Old canals and rivers blocked with rubble, or water hidden underground, for the player to open. | 7 | 1 (Oasis) | laborious | [Beavers Canyons - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3352195928) by Janleon; [Beavers Island of Power - 256x256](https://steamcommunity.com/sharedfiles/filedetails/?id=3343399831) by Janleon |
| Choose your side | Two or more distinct regions to expand into, each with its own trade-off. | 5 | 0 | yes | [Legacy of the Tides](https://steamcommunity.com/sharedfiles/filedetails/?id=3379271633) by Schtr0umpf; [Right-Side128x128](https://steamcommunity.com/sharedfiles/filedetails/?id=3281865359) by Linna |
| Carpet forest | The whole map under dense forest the colony clears as it grows. | 2 | 0 | yes | [The Forest](https://steamcommunity.com/sharedfiles/filedetails/?id=3335403190) by Hiro; [Deep Woods](https://steamcommunity.com/sharedfiles/filedetails/?id=3722416641) by Harry the Hutt |
| Caves and tunnels ✦ | Overhangs, tunnels and caverns: a start under a cliff, water running through the mountain. | 46 | 2 (Hollows, Pressure) | later | [Beavers Twist - 77x77](https://steamcommunity.com/sharedfiles/filedetails/?id=3473424972) by Janleon; [Secret Tunnel Canyon](https://steamcommunity.com/sharedfiles/filedetails/?id=3275582315) by chagogo |
| Hazard play ✦ | Unstable cores, badtide drains and timed sources that reshape the map as cycles pass. | 6 | 2 (Nomads, Pressure) | yes | [Beavers Twist - 77x77](https://steamcommunity.com/sharedfiles/filedetails/?id=3473424972) by Janleon; [Beavers New Twist - 123x123](https://steamcommunity.com/sharedfiles/filedetails/?id=3490510695) by Janleon |

Full descriptions, risks and what each needs are in `workshop.json` (`catalogue`).

## How far playable maps go

Medians, workshop against official (p10–p90 in `workshop.json` `bands`, by size):

| | Official | Workshop | Generated (128²) |
|---|---|---|---|
| Height range (levels) | 13 | 14 | 10 |
| One-level share of height steps | 0.62 | 0.81 | 0.58 |
| Flat share | 0.52 | 0.44 | 0.69 |
| Water share | 0.14 | 0.27 | 0.08 |
| Clean flow per 10k tiles | 1.1 | 3.9 | 3.8 |
| Waterfalls per map | 5.5 | 7 | 2 |
| Trees per 10k tiles | 606 | 1,243 | 1,060 |
| Berry bushes per 10k tiles | 44 | 185 | 99 |

The generator's spread is narrow: berry bushes per 10k run 93–115 across its seeds (p10–p90) against
74–434 in the workshop. The bands to widen, as data for the calibration table, are in
[workshop/settings-bands.json](workshop/settings-bands.json).

## The start

Measured where a start can be (11 official, 67 workshop, 180 generated maps), by walking distance:

| At the start | Official median | Workshop | Generated |
|---|---|---|---|
| Water at the start's level, no slopes | 13 tiles | 10.9 | 7 (missing on 82 of 180) |
| Land at the start's level | 980 tiles | 643 | 113 |
| Living trees within 20 tiles' walk | 112 | 46 | 67 |
| Living bushes within 20 tiles' walk | 57 | 44 | 46 |

Every official map fails at least one of today's Normal checks, even the recommended Plains. The
proposed thresholds are in the integration plan.

## Popularity hints

Subscribers follow authors and luck as much as maps (one author made 63 of the 130), so these are
hints. Allowing for upload date, more subscribers go with bigger maps, more lakes, more dam sites and
big meanders (ρ 0.2–0.3); fewer with high relief, lots of scrap and caves. Within one author's maps,
more favourites per subscriber go with natural-looking terrain (fewer straight steps ρ −0.53, varied
ridges +0.47), more relief (+0.33) and more water (+0.34).

## Proof: recipes

Each recipe starts from a generated River Valley map and applies only the engine's existing operations through a
`MapSession`, then passes the real validators in the `generate` profile.

| Recipe | Passed (of 23) | Gain to River Valley's variety | Tallest fall (median) | Short dam holds near the start |
|---|---|---|---|---|
| Island in a moat ✦ | 23 | +0.017 | 1.9 | 78% |
| Crater lake with an island ✦ | 23 | +0.011 | 8.0 | 74% |
| Spiral mountain or quarry ✦ | 23 | −0.004 | 1.9 | 70% |
| Heart lake ✦ | 23 | +0.019 | 1.9 | 70% |
| Badwater volcano ✦ | 23 | +0.002 | 7.0 | 83% |
| Hanging lake on a mesa ✦ | 23 | +0.003 | 5.0 | 74% |
| Mesa field with ruins on top | 23 | +0.002 | 1.9 | 70% |
| Twin waterfalls | 23 | 0 | 1.8 | 70% |
| Oxbow lake | 23 | −0.004 | 1.9 | 74% |
| Valley running north to south | 23 | +0.075 | 2.9 | 70% |
| Dam narrows between two spurs | 22 | −0.001 | 1.9 | 35% |
| *River Valley as it is* | | | 1.9 | 77% |

Seeds 1–10 at 96² and 128², 1–3 at 256²; up to 3 attempts each. "Short dam holds": a dam of 5 tiles
or fewer within 40 tiles of the start holds a Normal drought's water. The north–south river runs north
to south on 11 maps and south to north on 12.

- **Every premise builds today.** Ten pass every seed; the narrows miss one 96² seed. A spiral, a
  cone and a mesa field want their own builders to be less laborious.
- **A landmark alone does not make a map diverge.** Each adds at most 0.02 to the theme's variety.
  Counting landmarks, River Valley goes from 0.20 to 0.53 of the workshop's variety. The north–south
  valley, which changes the layout, adds the most: +0.075.
- **Tall falls, not taller maps.** Crater, volcano and hanging lake add falls of 5–8 levels; the
  height range stays 11.
- **Spurs hide the easy dam.** Two hillside spurs keep the reservoir possible (22 of 23) but cut the
  short dam from 77% to 35% of maps. Their tops are still flat.

The full results, the failures and the builders each recipe needs are in the
[integration plan §5](WORKSHOP-INTEGRATION.md#5-recipes-what-they-proved).

## The score

A prototype with 12 components, each 0–1: PLAN §12's, with the dam value turned into *engineering*
(no credit for a ready-made reservoir), plus *surprise* (novelty), *verticality*, *naturalness* and
*water*. With its default parameters the recommended official maps rank 3rd, 6th and 7th of 19, M9's
criterion. Medians: workshop 61.5, official 52.2, generated 40.1. Kyler's ratings refit it when they
arrive.

## Caveats

- Our steady state runs every source forever; the game's water on day one is the file's. Where caves,
  timed sources or drills decide the water, those numbers are left out.
- 130 maps are the subscribed ones on this machine, and one author made half of them.
- Patterns were tagged by hand from renders, by one reader.
- Nothing here was checked in game.
