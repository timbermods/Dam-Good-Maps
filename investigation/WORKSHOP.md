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
   theme score 0.16–0.38; all six themes together 0.58.
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

<!-- CATALOGUE -->

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

Each recipe starts from a generated map and applies only the engine's existing operations through a
`MapSession`, then passes the real validators in the `generate` profile.

<!-- RECIPES -->

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
