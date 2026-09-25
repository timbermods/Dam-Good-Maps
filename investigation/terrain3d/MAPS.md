# How maps use terrain above terrain

Step 2 of the terrain-3D investigation. The maps measured:
- the 19 official maps;
- the 132 local workshop maps in `C:\dgm-workshop` (read only): 35 saved by 1.0 or later, 97 before.

Only aggregates of the workshop maps are committed, and the numbers are in `results/caves.json`.
`proto/measure-caves.ts` measures; `proto/aggregate-caves.ts` aggregates.

## How it was measured

**"Roofed air"** is an air cell with solid ground somewhere above it in the same tile. Roofed air
splits into 3D-connected spaces; spaces under 8 cells are left out. Each space is classified by its
openings (cells beside open-sky air, or the map edge) and how far it reaches from them:

| Kind | Openings | Reach |
|---|---|---|
| **shelter** | one side | every cell within 3 tiles of an opening: an overhang, a cliff notch, the underside of a ledge |
| **cave** | one cluster | reaches more than 3 tiles in |
| **tunnel** | two or more clusters at least 4 tiles apart | a passage longer than 1 tile |
| **arch** | two or more clusters | a hole you can see through (reach 1 or less) |
| **sealed** | none | a closed pocket |

**Measured per space:** size, tallest air gap, reach, the ground above it (roof), the floor's level,
and whether the file stores water in it.

**Measured per map:**
- stored water under roofs, and pressure (overflow);
- the start under or near a roof;
- plants, ruins, relics, slopes and water objects under roofs;
- terrain above 16;
- NaturalOverhang objects and badtide drains.

## How often

| | Official (19) | Workshop 1.0+ (35) | Workshop before 1.0 (97) |
|---|---|---|---|
| Maps with any roofed space | 19 | 29 | 37 |
| Maps with 5% or more of tiles not one plain run | 3 | 14 | 32 |
| Median share of such tiles (maps that have some) | 1.1% | 4.7% | 36% |
| Maps with a cave | 8 | 24 | 27 |
| Maps with a tunnel | 16 | 28 | 35 |
| Maps with a terrain arch | 0 | 2 | 1 |
| Maps with shelters (overhangs, notches) | 17 | 20 | 25 |
| Maps with a sealed pocket | 2 | 14 | 15 |
| Maps with NaturalOverhang objects | 7 | 31 | 84 |
| Maps with badtide drains | 7 | 21 | 0 |
| Maps with terrain above 16 | 0 | 7 | 13 |

**Every official map has some terrain above terrain**, but mostly small shelters: undercut river
banks and notches. Only Hollows, Pressure and Pillars have 5% or more.

**The workshop leans on it much harder**, and the older maps hardest: before 1.0, 32 maps are a
third or more caves.

## How big and deep

Medians, with the 90th percentile in brackets. Official and workshop 1.0+.

| | Caves (official / 1.0+) | Tunnels (official / 1.0+) | Shelters (1.0+) |
|---|---|---|---|
| Spaces | 16 / 130 | 100 / 208 | 625 |
| Per map, where there are any | 1 (5) / 4 (10) | 3 (15) / 4 (22) | 17 (86) |
| Size, cells | 178 (766) / 103 (1,431) | 151 (1,029) / 140 (2,929) | 16 (75) |
| Tallest air gap | 5 (9) / 4 (11) | 5 (10) / 4 (11) | 5 (8) |
| Reach from an opening, tiles | 7 (15) / 8 (36) | 8 (27) / 7 (45) | 1 (2) |
| Ground above | 3 (5) / 2 (7) | 3 (7) / 2 (6) | 1 (4) |
| Floor level | 5 (8) / 4 (11) | 3 (8) / 4 (10) | 4 (10) |

- **Caves and tunnels are modest in section:** 4–5 high, under 2–3 levels of rock. They lie low,
  near the valley floors.
- **The largest are big:** the biggest 1.0+ tunnel system is 172,000 cells. Some pre-1.0 maps are
  mostly underground.
- **Tunnels are the common form**, more common than caves, on official and workshop maps alike.
- **Terrain arches are rare.** Natural bridges are made with NaturalOverhang objects instead: on 31
  of 35 1.0+ maps.

## Water in caves

| | Official | Workshop 1.0+ | Workshop before 1.0 |
|---|---|---|---|
| Maps storing water under roofs | 18 | 33 | 92 |
| Median roofed wet columns (maps that have some) | 88 | 626 | 258 |
| Maps storing pressure (overflow) | 3 | 25 | 59 |
| Maps with a water source under a roof | 8 | 29 | 37 |
| Caves / tunnels holding water | 8 of 16 / 46 of 100 | 83 of 130 / 161 of 208 | 96 of 133 / 266 of 327 |

- **Water through rock is the norm, not the exception.** Most 1.0+ tunnels carry water: underground
  rivers and flooded passages.
- **Pressurised water** (full cave columns) is stored on 25 of 35 1.0+ maps.
- **Hidden springs** (sources under roofs) are on 29.

## Starts, resources and space under roofs

| | Official | Workshop 1.0+ | Workshop before 1.0 |
|---|---|---|---|
| Start under a roof (5×5 round the start's anchor) | 0 | 5 | 31 |
| Start within 5 tiles of a roof | 6 | 17 | 52 |
| Maps with trees under roofs | 5 | 20 | 34 |
| Maps with berry bushes under roofs | 2 | 15 | 30 |
| Maps with ruins under roofs | 2 | 17 | 29 |
| Maps with relics under roofs | 0 | 16 | 0 |
| Maps with slopes under roofs | 2 | 14 | 29 |
| Walkable floor tiles under roofs, median per map | 219 | 1,125 | 4,177 |

## What they add to play

What the numbers point to (abstract descriptions; no single map is described):
1. **Routes.** Tunnels join valleys through ridges. They are the most common form, on 28 of 35 1.0+
   maps. A tunnel is a way through that the land offers, often the only one on a level.
2. **Hidden water.** Springs in caves, underground rivers, and flooded passages under pressure. Water
   is found, not only seen.
3. **Rewards to explore.** Ruins and relics under roofs, on about half of the 1.0+ maps. Scrap and
   science wait in the dark.
4. **Sheltered land.** Forests and berries in caves and under overhangs, and around a thousand
   walkable floor tiles under roofs on a typical 1.0+ map.
5. **Dramatic starts.** A start under or beside a cliff, on 17 of 35 1.0+ maps. On 5 the start
   itself is under a roof.
6. **Height.** Seven 1.0+ maps rise above 16: towers, sky islands and cliffs.

## For the design

- **3D forms should be common but modest by default:** mostly tunnels and shelters, sometimes a
  cave, 4–5 high under 2–3 levels of rock (DESIGN §5.4, Verticality 20).
- **Water belongs underground:** underground rivers and cave springs are the norm on 1.0+ maps
  (DESIGN §5.3).
- **Rewards under roofs** (ruins, relics) match what map makers do (DESIGN §5.5).
- **Arches and natural bridges** are rare in terrain but common as objects. A terrain sky bridge is
  a high-Verticality form, and NaturalOverhang bridges join 3D-b.
- **Cave starts** are a minority, even in the workshop (5 of 35 1.0+ maps): a high-Verticality
  option, never the default (DESIGN §4.4).
