# Map look captures

Before and after captures of the same maps from the same camera poses, for the Map look review
(ROADMAP "Map look", PLAN §20 D86, D110 and D114). The before captures show the 3D view at
`m8-done` (cfa5990); the after captures show it with Map look, after the review's fix round. Each
after capture also comes in greyscale and in three colour-blindness simulations (protanopia,
deuteranopia, tritanopia; Machado, Oliveira and Fernandes 2009, full severity, in linear RGB).

Made with `npx tsx tools/capture-look.ts --label before|after` (before on 2026-09-25, after on 2026-09-25), in the installed Chrome, headed, at 1280×800 CSS pixels and a device pixel ratio of 1. Each map is opened in the editor (generated maps with **Refine this map**, Beavertopia through the file input) with **Show dam sites** on, and only the 3D canvas is captured, except for one whole view per run. The after run takes every pose's camera from the before run's record. The water is held at one moment of its movement.

The maps: seed 4242 in every theme at 128² (Normal), seed 4242 River Valley at 256², and
Beavertopia (a workshop map, 256²). Beavertopia's captures are not ours to share: they stay in
`.scratch/map-look/` on the machine that made them and are never committed.

## Where to look

For each capture, up to three example tiles of each meaning that are in view: the tile (x east,
y north, from the map's south-west corner) and its position in the after image, in pixels from
the top-left corner. The positions hold for the greyscale and colour-blind versions too, and for
the before image, which shares the camera (but for the objects that the after view draws
larger from afar).

The examples come from what the view draws: its heights, the water on each tile's top, the soil
of each tile's top (a tile over a cave shows its top's soil, not the cave floor's) and its
objects. Each position is the visible point: the water's surface, the middle of a tree or a
ruin, the middle of a wall, and the start, the slope arrows and the dead trees as they are drawn
from that distance. Ground and water examples lie inside an area of their kind (their eight
neighbours alike) and away from objects; no example has an object on the tiles in front of it
(toward the camera); and every example was checked by picking the tile under its position in
the view.

- **Water partly bad** is water with some badwater in it (the percentage is given); **badwater
  meets clean water** is badwater next to clean water.
- **Contaminated beside moist ground** is contaminated ground with moist ground next to it, at the
  same height.
- **Tall cliff** is a wall three levels high or more, facing the camera; the levels are given.
- **Slope** gives the way the slope rises; its arrows point that way.
- **Dam site** tiles are the editor's dam sites, shown with **Show dam sites**.

### River Valley (4242), 128×128

**default-ui** (the editor's own view from its default camera, with its buttons, and its legend opened):

- before: [before/riverValley-128-default-ui.jpg](before/riverValley-128-default-ui.jpg)
- after: [after/riverValley-128-default-ui.jpg](after/riverValley-128-default-ui.jpg)

**overview** (the whole map from the south):

- before: [before/riverValley-128-overview.jpg](before/riverValley-128-overview.jpg)
- after: [after/riverValley-128-overview.jpg](after/riverValley-128-overview.jpg)
- after, greyscale: [after/riverValley-128-overview-grey.jpg](after/riverValley-128-overview-grey.jpg); protanopia: [after/riverValley-128-overview-protanopia.jpg](after/riverValley-128-overview-protanopia.jpg); deuteranopia: [after/riverValley-128-overview-deuteranopia.jpg](after/riverValley-128-overview-deuteranopia.jpg); tritanopia: [after/riverValley-128-overview-tritanopia.jpg](after/riverValley-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (65, 58) → 499, 404; (61, 57) → 475, 408; (70, 58) → 528, 404 |
| badwater | (43, 83) → 379, 289; (38, 84) → 352, 285; (33, 84) → 325, 285 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (69, 61) → 522, 388; (56, 59) → 446, 397; (57, 72) → 454, 339 |
| dry ground | (66, 72) → 504, 324; (56, 75) → 449, 326; (48, 72) → 403, 339 |
| contaminated ground | (35, 77) → 332, 310; (30, 77) → 304, 310; (25, 77) → 277, 310 |
| contaminated beside moist ground | (33, 76) → 320, 315; (28, 76) → 293, 315; (18, 76) → 237, 315 |
| living tree | (59, 61) → 464, 385 (Birch); (75, 62) → 557, 379 (Pine); (51, 63) → 418, 376 (Pine) |
| dead tree | (64, 61) → 494, 364 (Birch); (51, 72) → 419, 331 (Birch); (66, 79) → 503, 287 (Birch) |
| ruin | (27, 91) → 297, 253 (1 high); (66, 120) → 502, 134 (1 high); (9, 92) → 199, 240 (2 high) |
| the start | (45, 55) → 379, 405 |
| slope | (59, 58) → 463, 393 (rises toward the west); (68, 55) → 517, 407 (rises toward the south); (75, 61) → 558, 379 (rises toward the west) |
| dam site | (66, 57) → 505, 408; (53, 53) → 427, 428; (78, 60) → 574, 394 |
| tall cliff | (65, 75) → 496, 319 (4 levels, facing west); (76, 52) → 565, 438 (3 levels, facing south); (59, 83) → 466, 290 (3 levels, facing south) |

**start** (close to the start):

- before: [before/riverValley-128-start.jpg](before/riverValley-128-start.jpg)
- after: [after/riverValley-128-start.jpg](after/riverValley-128-start.jpg)
- after, greyscale: [after/riverValley-128-start-grey.jpg](after/riverValley-128-start-grey.jpg); protanopia: [after/riverValley-128-start-protanopia.jpg](after/riverValley-128-start-protanopia.jpg); deuteranopia: [after/riverValley-128-start-deuteranopia.jpg](after/riverValley-128-start-deuteranopia.jpg); tritanopia: [after/riverValley-128-start-tritanopia.jpg](after/riverValley-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (50, 49) → 666, 441; (51, 50) → 672, 413; (49, 48) → 661, 471 |
| badwater | (39, 83) → 127, 26; (38, 84) → 103, 21; (35, 84) → 47, 40 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (49, 55) → 571, 327; (46, 51) → 561, 429; (41, 56) → 394, 390 |
| dry ground | (42, 68) → 300, 206; (44, 69) → 329, 177; (43, 70) → 302, 172 |
| contaminated ground | (36, 77) → 104, 104; (34, 77) → 64, 118; (32, 77) → 22, 133 |
| contaminated beside moist ground | (33, 76) → 49, 139 |
| living tree | (42, 63) → 340, 265 (Oak); (51, 63) → 517, 191 (Pine); (41, 43) → 566, 652 (Birch) |
| dead tree | (38, 69) → 197, 184 (Oak); (37, 70) → 168, 175 (Oak); (51, 72) → 426, 80 (Birch) |
| ruin | not in view |
| the start | (45, 55) → 490, 355 |
| slope | (59, 58) → 714, 203 (rises toward the west); (31, 47) → 246, 700 (rises toward the north); (42, 78) → 206, 28 (rises toward the north) |
| dam site | (50, 56) → 578, 301; (51, 55) → 610, 308; (52, 54) → 639, 328 |
| tall cliff | (62, 53) → 835, 231 (4 levels, facing west); (64, 54) → 854, 199 (4 levels, facing west); (43, 78) → 236, 57 (3 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/riverValley-128-badwater.jpg](before/riverValley-128-badwater.jpg)
- after: [after/riverValley-128-badwater.jpg](after/riverValley-128-badwater.jpg)
- after, greyscale: [after/riverValley-128-badwater-grey.jpg](after/riverValley-128-badwater-grey.jpg); protanopia: [after/riverValley-128-badwater-protanopia.jpg](after/riverValley-128-badwater-protanopia.jpg); deuteranopia: [after/riverValley-128-badwater-deuteranopia.jpg](after/riverValley-128-badwater-deuteranopia.jpg); tritanopia: [after/riverValley-128-badwater-tritanopia.jpg](after/riverValley-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (36, 84) → 480, 348; (34, 84) → 443, 365; (38, 84) → 515, 332 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (32, 74) → 515, 546; (33, 73) → 549, 554; (30, 74) → 473, 568 |
| dry ground | (40, 77) → 634, 411; (39, 75) → 641, 454; (41, 76) → 665, 418 |
| contaminated ground | (34, 81) → 474, 403; (33, 80) → 465, 428; (34, 79) → 496, 435 |
| contaminated beside moist ground | (33, 76) → 511, 498; (31, 76) → 470, 519; (29, 76) → 428, 541 |
| living tree | (23, 72) → 336, 686 (Birch); (42, 63) → 874, 663 (Oak) |
| dead tree | (33, 87) → 393, 309 (Pine); (31, 88) → 346, 310 (Pine); (39, 90) → 474, 210 (Pine) |
| ruin | (30, 92) → 293, 270 (1 high); (27, 91) → 244, 307 (1 high); (26, 92) → 216, 301 (1 high) |
| the start | not in view |
| slope | (35, 83) → 471, 358 (rises toward the south); (42, 78) → 661, 361 (rises toward the north); (47, 85) → 664, 206 (rises toward the north) |
| dam site | not in view |
| tall cliff | (43, 88) → 565, 231 (3 levels, facing south); (45, 85) → 617, 252 (3 levels, facing west); (43, 78) → 679, 382 (3 levels, facing south) |

**falls** (the tallest waterfall, from downstream):

- before: [before/riverValley-128-falls.jpg](before/riverValley-128-falls.jpg)
- after: [after/riverValley-128-falls.jpg](after/riverValley-128-falls.jpg)
- after, greyscale: [after/riverValley-128-falls-grey.jpg](after/riverValley-128-falls-grey.jpg); protanopia: [after/riverValley-128-falls-protanopia.jpg](after/riverValley-128-falls-protanopia.jpg); deuteranopia: [after/riverValley-128-falls-deuteranopia.jpg](after/riverValley-128-falls-deuteranopia.jpg); tritanopia: [after/riverValley-128-falls-tritanopia.jpg](after/riverValley-128-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (87, 74) → 490, 223; (86, 74) → 528, 223; (86, 72) → 526, 181 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (82, 76) → 694, 249; (82, 75) → 688, 226; (81, 76) → 735, 249 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (86, 80) → 543, 328 (Birch); (84, 80) → 635, 330 (Birch); (93, 80) → 217, 400 (Oak) |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | (96, 85) → 23, 608 (rises toward the south) |
| dam site | not in view |
| tall cliff | not in view |

### Canyon (4242), 128×128

**overview** (the whole map from the south):

- before: [before/canyon-128-overview.jpg](before/canyon-128-overview.jpg)
- after: [after/canyon-128-overview.jpg](after/canyon-128-overview.jpg)
- after, greyscale: [after/canyon-128-overview-grey.jpg](after/canyon-128-overview-grey.jpg); protanopia: [after/canyon-128-overview-protanopia.jpg](after/canyon-128-overview-protanopia.jpg); deuteranopia: [after/canyon-128-overview-deuteranopia.jpg](after/canyon-128-overview-deuteranopia.jpg); tritanopia: [after/canyon-128-overview-tritanopia.jpg](after/canyon-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 394; (68, 63) → 515, 394; (73, 63) → 544, 394 |
| badwater | (15, 49) → 194, 441; (13, 45) → 177, 462; (10, 49) → 163, 441 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (63, 66) → 487, 372; (71, 66) → 532, 372; (71, 59) → 533, 404 |
| dry ground | (67, 67) → 510, 360; (67, 58) → 511, 401; (66, 74) → 504, 323 |
| contaminated ground | (10, 55) → 169, 409; (6, 52) → 141, 423 |
| contaminated beside moist ground | not in view |
| living tree | (57, 66) → 454, 376 (Birch); (49, 64) → 407, 384 (Pine); (82, 70) → 593, 358 (Pine) |
| dead tree | (64, 81) → 493, 280 (Pine); (77, 79) → 565, 294 (Pine); (69, 84) → 520, 268 (Pine) |
| ruin | (79, 86) → 574, 268 (1 high); (84, 87) → 601, 264 (1 high); (64, 24) → 493, 561 (7 high) |
| the start | (41, 53) → 356, 428 |
| slope | (74, 61) → 551, 393 (rises toward the south); (52, 47) → 418, 444 (rises toward the east); (46, 41) → 378, 469 (rises toward the south) |
| dam site | (64, 64) → 493, 390; (72, 63) → 538, 394; (73, 73) → 543, 327 |
| tall cliff | (63, 65) → 487, 384 (3 levels, facing south); (68, 65) → 515, 384 (3 levels, facing south); (69, 57) → 522, 415 (4 levels, facing south) |

**start** (close to the start):

- before: [before/canyon-128-start.jpg](before/canyon-128-start.jpg)
- after: [after/canyon-128-start.jpg](after/canyon-128-start.jpg)
- after, greyscale: [after/canyon-128-start-grey.jpg](after/canyon-128-start-grey.jpg); protanopia: [after/canyon-128-start-protanopia.jpg](after/canyon-128-start-protanopia.jpg); deuteranopia: [after/canyon-128-start-deuteranopia.jpg](after/canyon-128-start-deuteranopia.jpg); tritanopia: [after/canyon-128-start-tritanopia.jpg](after/canyon-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (41, 59) → 425, 290; (43, 59) → 463, 272; (40, 60) → 395, 283 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (38, 63) → 326, 248; (36, 63) → 287, 265; (37, 64) → 298, 242 |
| dry ground | (45, 43) → 739, 452; (46, 43) → 763, 439; (31, 48) → 301, 525 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (41, 63) → 385, 211 (Birch); (45, 63) → 459, 180 (Birch); (47, 63) → 493, 162 (Birch) |
| dead tree | (36, 42) → 525, 595 (Birch); (34, 43) → 454, 597 (Birch); (37, 41) → 579, 598 (Birch) |
| ruin | not in view |
| the start | (41, 53) → 490, 355 |
| slope | (36, 61) → 303, 291 (rises toward the north); (52, 47) → 817, 301 (rises toward the east); (46, 41) → 809, 470 (rises toward the south) |
| dam site | (57, 63) → 660, 113; (63, 65) → 739, 12; (64, 64) → 755, 57 |
| tall cliff | (32, 63) → 206, 302 (3 levels, facing south); (30, 63) → 162, 320 (3 levels, facing south); (33, 71) → 143, 123 (4 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/canyon-128-badwater.jpg](before/canyon-128-badwater.jpg)
- after: [after/canyon-128-badwater.jpg](after/canyon-128-badwater.jpg)
- after, greyscale: [after/canyon-128-badwater-grey.jpg](after/canyon-128-badwater-grey.jpg); protanopia: [after/canyon-128-badwater-protanopia.jpg](after/canyon-128-badwater-protanopia.jpg); deuteranopia: [after/canyon-128-badwater-deuteranopia.jpg](after/canyon-128-badwater-deuteranopia.jpg); tritanopia: [after/canyon-128-badwater-tritanopia.jpg](after/canyon-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (10, 66) → 366, 152; (12, 66) → 396, 141; (18, 64) → 501, 151 |
| badwater | (8, 49) → 480, 349; (6, 49) → 443, 366; (10, 49) → 515, 332 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (26, 57) → 675, 167; (27, 56) → 699, 172; (1, 71) → 187, 146 |
| dry ground | (9, 40) → 605, 463; (1, 44) → 393, 474; (14, 54) → 533, 226 |
| contaminated ground | (6, 52) → 413, 313; (8, 54) → 430, 270; (10, 54) → 465, 255 |
| contaminated beside moist ground | not in view |
| living tree | (8, 60) → 379, 209 (Pine); (0, 58) → 253, 289 (Pine); (10, 69) → 340, 104 (Birch) |
| dead tree | (0, 51) → 304, 371 (Birch); (3, 40) → 481, 514 (Pine); (19, 45) → 721, 297 (Birch) |
| ruin | not in view |
| the start | (41, 53) → 909, 123 |
| slope | (7, 50) → 451, 329 (rises toward the north); (36, 61) → 760, 92 (rises toward the north) |
| dam site | not in view |
| tall cliff | (15, 68) → 430, 120 (3 levels, facing south); (18, 67) → 480, 113 (3 levels, facing south); (29, 63) → 659, 117 (3 levels, facing south) |

**falls** (the tallest waterfall, from downstream):

- before: [before/canyon-128-falls.jpg](before/canyon-128-falls.jpg)
- after: [after/canyon-128-falls.jpg](after/canyon-128-falls.jpg)
- after, greyscale: [after/canyon-128-falls-grey.jpg](after/canyon-128-falls-grey.jpg); protanopia: [after/canyon-128-falls-protanopia.jpg](after/canyon-128-falls-protanopia.jpg); deuteranopia: [after/canyon-128-falls-deuteranopia.jpg](after/canyon-128-falls-deuteranopia.jpg); tritanopia: [after/canyon-128-falls-tritanopia.jpg](after/canyon-128-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (89, 66) → 529, 356; (90, 66) → 530, 383; (87, 65) → 490, 246 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (90, 63) → 403, 301; (91, 63) → 400, 329; (89, 62) → 364, 274 |
| dry ground | (92, 57) → 34, 108; (93, 57) → 14, 137; (95, 58) → 35, 204 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (90, 71) → 754, 271 (Oak); (85, 71) → 723, 154 (Pine); (92, 73) → 851, 395 (Oak) |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | (81, 66) → 524, 105 (rises toward the north) |
| dam site | (90, 64) → 447, 301; (91, 63) → 400, 329; (90, 62) → 360, 301 |
| tall cliff | (92, 65) → 490, 393 (3 levels, facing west) |

### Highlands (4242), 128×128

**overview** (the whole map from the south):

- before: [before/highlands-128-overview.jpg](before/highlands-128-overview.jpg)
- after: [after/highlands-128-overview.jpg](after/highlands-128-overview.jpg)
- after, greyscale: [after/highlands-128-overview-grey.jpg](after/highlands-128-overview-grey.jpg); protanopia: [after/highlands-128-overview-protanopia.jpg](after/highlands-128-overview-protanopia.jpg); deuteranopia: [after/highlands-128-overview-deuteranopia.jpg](after/highlands-128-overview-deuteranopia.jpg); tritanopia: [after/highlands-128-overview-tritanopia.jpg](after/highlands-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (68, 58) → 516, 406; (60, 56) → 469, 416; (73, 59) → 545, 402 |
| badwater | (41, 86) → 369, 273; (33, 90) → 328, 258; (28, 90) → 302, 258 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (69, 62) → 522, 386; (73, 64) → 544, 377; (54, 62) → 435, 386 |
| dry ground | (65, 63) → 499, 367; (54, 74) → 437, 334; (68, 80) → 515, 294 |
| contaminated ground | (32, 83) → 318, 282; (27, 83) → 291, 282; (32, 93) → 324, 243 |
| contaminated beside moist ground | (35, 82) → 333, 282; (30, 82) → 307, 286; (25, 82) → 279, 286 |
| living tree | (62, 59) → 481, 396 (Birch); (69, 68) → 521, 357 (Birch); (55, 65) → 441, 369 (Birch) |
| dead tree | (65, 70) → 499, 328 (Oak); (58, 80) → 460, 284 (Oak); (61, 42) → 474, 464 (Oak) |
| ruin | (85, 48) → 623, 442 (3 high); (74, 38) → 557, 495 (7 high); (69, 36) → 525, 516 (1 high) |
| the start | (44, 59) → 375, 389 |
| slope | (77, 63) → 568, 373 (rises toward the west); (53, 49) → 426, 440 (rises toward the south); (44, 79) → 381, 285 (rises toward the north) |
| dam site | (73, 64) → 544, 377; (58, 53) → 457, 430; (77, 60) → 568, 397 |
| tall cliff | (68, 64) → 516, 372 (4 levels, facing south); (70, 83) → 525, 291 (4 levels, facing south); (60, 39) → 465, 495 (4 levels, facing west) |

**start** (close to the start):

- before: [before/highlands-128-start.jpg](before/highlands-128-start.jpg)
- after: [after/highlands-128-start.jpg](after/highlands-128-start.jpg)
- after, greyscale: [after/highlands-128-start-grey.jpg](after/highlands-128-start-grey.jpg); protanopia: [after/highlands-128-start-protanopia.jpg](after/highlands-128-start-protanopia.jpg); deuteranopia: [after/highlands-128-start-deuteranopia.jpg](after/highlands-128-start-deuteranopia.jpg); tritanopia: [after/highlands-128-start-tritanopia.jpg](after/highlands-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (52, 51) → 754, 445; (51, 50) → 750, 474; (53, 52) → 759, 416 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (48, 59) → 571, 327; (48, 57) → 597, 361; (51, 57) → 652, 345 |
| dry ground | (44, 63) → 444, 300; (46, 63) → 484, 281; (46, 72) → 393, 168 |
| contaminated ground | (32, 83) → 15, 68 |
| contaminated beside moist ground | (35, 82) → 76, 42; (33, 82) → 42, 73; (34, 83) → 49, 37 |
| living tree | (37, 59) → 322, 392 (Birch); (42, 52) → 541, 525 (Oak); (50, 64) → 548, 234 (Birch) |
| dead tree | (39, 66) → 299, 241 (Birch); (38, 67) → 261, 233 (Birch); (43, 71) → 346, 188 (Birch) |
| ruin | not in view |
| the start | (44, 59) → 490, 355 |
| slope | (53, 49) → 809, 464 (rises toward the south); (27, 54) → 111, 649 (rises toward the north); (62, 58) → 835, 227 (rises toward the north) |
| dam site | (51, 53) → 712, 401; (53, 53) → 744, 398; (55, 53) → 781, 378 |
| tall cliff | (29, 52) → 190, 694 (3 levels, facing west); (29, 51) → 201, 721 (3 levels, facing west); (68, 64) → 865, 85 (4 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/highlands-128-badwater.jpg](before/highlands-128-badwater.jpg)
- after: [after/highlands-128-badwater.jpg](after/highlands-128-badwater.jpg)
- after, greyscale: [after/highlands-128-badwater-grey.jpg](after/highlands-128-badwater-grey.jpg); protanopia: [after/highlands-128-badwater-protanopia.jpg](after/highlands-128-badwater-protanopia.jpg); deuteranopia: [after/highlands-128-badwater-deuteranopia.jpg](after/highlands-128-badwater-deuteranopia.jpg); tritanopia: [after/highlands-128-badwater-tritanopia.jpg](after/highlands-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (24, 79) → 397, 641; (23, 80) → 363, 632; (23, 79) → 374, 653 |
| badwater | (34, 90) → 480, 350; (32, 90) → 443, 367; (37, 89) → 544, 339 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (34, 80) → 596, 502; (32, 80) → 556, 524; (36, 80) → 635, 482 |
| dry ground | (39, 94) → 527, 218; (35, 96) → 437, 236; (40, 93) → 555, 224 |
| contaminated ground | (32, 87) → 474, 403; (31, 86) → 465, 428; (32, 85) → 496, 435 |
| contaminated beside moist ground | (34, 83) → 560, 438; (33, 82) → 551, 477; (35, 82) → 592, 445 |
| living tree | (15, 80) → 158, 722 (Pine) |
| dead tree | (28, 100) → 274, 226 (Oak); (26, 100) → 241, 254 (Oak); (37, 103) → 405, 112 (Birch) |
| ruin | not in view |
| the start | not in view |
| slope | (44, 79) → 803, 404 (rises toward the north); (50, 86) → 810, 234 (rises toward the west) |
| dam site | not in view |
| tall cliff | (40, 91) → 581, 277 (3 levels, facing south); (42, 91) → 615, 262 (3 levels, facing south); (43, 89) → 640, 278 (3 levels, facing west) |

**falls** (the tallest waterfall, from downstream):

- before: [before/highlands-128-falls.jpg](before/highlands-128-falls.jpg)
- after: [after/highlands-128-falls.jpg](after/highlands-128-falls.jpg)
- after, greyscale: [after/highlands-128-falls-grey.jpg](after/highlands-128-falls-grey.jpg); protanopia: [after/highlands-128-falls-protanopia.jpg](after/highlands-128-falls-protanopia.jpg); deuteranopia: [after/highlands-128-falls-deuteranopia.jpg](after/highlands-128-falls-deuteranopia.jpg); tritanopia: [after/highlands-128-falls-tritanopia.jpg](after/highlands-128-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (19, 113) → 735, 318; (19, 115) → 723, 275; (19, 101) → 842, 708 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (9, 111) → 348, 57; (9, 106) → 359, 485; (8, 106) → 315, 485 |
| dry ground | (22, 113) → 865, 235; (23, 112) → 914, 257; (22, 115) → 846, 193 |
| contaminated ground | (13, 101) → 542, 685; (14, 101) → 594, 685; (15, 101) → 646, 685 |
| contaminated beside moist ground | not in view |
| living tree | not in view |
| dead tree | (15, 104) → 637, 535 (Birch); (16, 104) → 678, 526 (Birch); (17, 104) → 734, 533 (Birch) |
| ruin | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
| tall cliff | (21, 112) → 806, 302 (3 levels, facing west); (21, 113) → 797, 279 (3 levels, facing west); (21, 115) → 782, 237 (3 levels, facing west) |

### Lake Basin (4242), 128×128

**overview** (the whole map from the south):

- before: [before/lakeBasin-128-overview.jpg](before/lakeBasin-128-overview.jpg)
- after: [after/lakeBasin-128-overview.jpg](after/lakeBasin-128-overview.jpg)
- after, greyscale: [after/lakeBasin-128-overview-grey.jpg](after/lakeBasin-128-overview-grey.jpg); protanopia: [after/lakeBasin-128-overview-protanopia.jpg](after/lakeBasin-128-overview-protanopia.jpg); deuteranopia: [after/lakeBasin-128-overview-deuteranopia.jpg](after/lakeBasin-128-overview-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-overview-tritanopia.jpg](after/lakeBasin-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 378; (67, 65) → 510, 369; (59, 65) → 464, 369 |
| badwater | (45, 106) → 397, 201; (44, 113) → 394, 177 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (72, 91) → 535, 259; (83, 42) → 612, 479; (67, 93) → 508, 252 |
| dry ground | (86, 100) → 605, 223; (94, 33) → 689, 526; (100, 38) → 723, 498 |
| contaminated ground | (47, 99) → 405, 230; (42, 99) → 380, 230; (36, 102) → 350, 216 |
| contaminated beside moist ground | (50, 99) → 421, 230; (45, 98) → 395, 234; (40, 98) → 369, 234 |
| living tree | (80, 86) → 578, 275 (Pine); (62, 92) → 482, 252 (Oak); (74, 36) → 558, 510 (Birch) |
| dead tree | (51, 102) → 426, 210 (Pine); (73, 109) → 539, 170 (Pine); (98, 31) → 721, 522 (Birch) |
| ruin | (112, 92) → 751, 231 (1 high); (116, 89) → 778, 236 (4 high); (121, 90) → 802, 236 (2 high) |
| the start | (69, 98) → 519, 224 |
| slope | (95, 64) → 674, 362 (rises toward the north); (30, 78) → 304, 301 (rises toward the north); (41, 102) → 374, 206 (rises toward the west) |
| dam site | (92, 62) → 655, 383 |
| tall cliff | (63, 37) → 484, 515 (3 levels, facing west); (71, 90) → 529, 272 (4 levels, facing south); (76, 88) → 556, 280 (4 levels, facing south) |

**start** (close to the start):

- before: [before/lakeBasin-128-start.jpg](before/lakeBasin-128-start.jpg)
- after: [after/lakeBasin-128-start.jpg](after/lakeBasin-128-start.jpg)
- after, greyscale: [after/lakeBasin-128-start-grey.jpg](after/lakeBasin-128-start-grey.jpg); protanopia: [after/lakeBasin-128-start-protanopia.jpg](after/lakeBasin-128-start-protanopia.jpg); deuteranopia: [after/lakeBasin-128-start-deuteranopia.jpg](after/lakeBasin-128-start-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-start-tritanopia.jpg](after/lakeBasin-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (65, 90) → 504, 577; (69, 89) → 608, 549; (68, 89) → 586, 561 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (69, 94) → 540, 440; (70, 94) → 561, 429; (71, 94) → 582, 418 |
| dry ground | (74, 105) → 508, 196; (68, 107) → 370, 217; (66, 107) → 330, 235 |
| contaminated ground | not in view |
| contaminated beside moist ground | (50, 99) → 33, 562 |
| living tree | (62, 99) → 327, 411 (Pine); (62, 92) → 402, 553 (Oak); (60, 93) → 346, 554 (Oak) |
| dead tree | (72, 109) → 423, 96 (Pine); (76, 110) → 491, 29 (Pine); (71, 113) → 361, 28 (Pine) |
| ruin | not in view |
| the start | (69, 98) → 490, 355 |
| slope | not in view |
| dam site | not in view |
| tall cliff | (66, 92) → 506, 545 (4 levels, facing south); (69, 91) → 584, 531 (4 levels, facing south); (68, 91) → 563, 542 (4 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/lakeBasin-128-badwater.jpg](before/lakeBasin-128-badwater.jpg)
- after: [after/lakeBasin-128-badwater.jpg](after/lakeBasin-128-badwater.jpg)
- after, greyscale: [after/lakeBasin-128-badwater-grey.jpg](after/lakeBasin-128-badwater-grey.jpg); protanopia: [after/lakeBasin-128-badwater-protanopia.jpg](after/lakeBasin-128-badwater-protanopia.jpg); deuteranopia: [after/lakeBasin-128-badwater-deuteranopia.jpg](after/lakeBasin-128-badwater-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-badwater-tritanopia.jpg](after/lakeBasin-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (44, 113) → 508, 355; (44, 111) → 530, 385; (43, 110) → 523, 409 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (43, 96) → 703, 681; (54, 100) → 845, 483; (41, 96) → 662, 706 |
| dry ground | (41, 113) → 450, 318; (41, 115) → 428, 287; (40, 114) → 418, 311 |
| contaminated ground | (43, 101) → 631, 579; (45, 101) → 670, 557; (47, 101) → 707, 536 |
| contaminated beside moist ground | (43, 98) → 673, 639; (41, 98) → 633, 663; (45, 98) → 712, 615 |
| living tree | (56, 104) → 826, 391 (Pine); (57, 103) → 855, 400 (Pine); (58, 102) → 888, 399 (Pine) |
| dead tree | (50, 109) → 671, 312 (Birch); (41, 121) → 367, 187 (Pine); (51, 115) → 618, 190 (Pine) |
| ruin | (28, 123) → 60, 233 (6 high); (27, 124) → 51, 266 (1 high) |
| the start | not in view |
| slope | (36, 109) → 387, 433 (rises toward the north); (49, 106) → 684, 405 (rises toward the west); (41, 102) → 581, 570 (rises toward the west) |
| dam site | not in view |
| tall cliff | (46, 112) → 548, 335 (4 levels, facing west); (40, 112) → 448, 392 (6 levels, facing south); (47, 110) → 588, 369 (4 levels, facing west) |

**falls** (the tallest waterfall, from downstream):

- before: [before/lakeBasin-128-falls.jpg](before/lakeBasin-128-falls.jpg)
- after: [after/lakeBasin-128-falls.jpg](after/lakeBasin-128-falls.jpg)
- after, greyscale: [after/lakeBasin-128-falls-grey.jpg](after/lakeBasin-128-falls-grey.jpg); protanopia: [after/lakeBasin-128-falls-protanopia.jpg](after/lakeBasin-128-falls-protanopia.jpg); deuteranopia: [after/lakeBasin-128-falls-deuteranopia.jpg](after/lakeBasin-128-falls-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-falls-tritanopia.jpg](after/lakeBasin-128-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (15, 86) → 414, 328; (14, 87) → 449, 179; (16, 85) → 372, 354 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (13, 92) → 652, 135; (13, 83) → 287, 135; (13, 93) → 693, 135 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (16, 90) → 576, 171 (Birch); (17, 92) → 680, 195 (Birch); (23, 94) → 848, 387 (Pine) |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | (13, 85) → 368, 131 (rises toward the south) |
| dam site | not in view |
| tall cliff | (14, 86) → 394, 257 (4 levels, facing south); (16, 82) → 217, 274 (4 levels, facing south); (14, 80) → 153, 226 (4 levels, facing south) |

### Delta (4242), 128×128

**overview** (the whole map from the south):

- before: [before/delta-128-overview.jpg](before/delta-128-overview.jpg)
- after: [after/delta-128-overview.jpg](after/delta-128-overview.jpg)
- after, greyscale: [after/delta-128-overview-grey.jpg](after/delta-128-overview-grey.jpg); protanopia: [after/delta-128-overview-protanopia.jpg](after/delta-128-overview-protanopia.jpg); deuteranopia: [after/delta-128-overview-deuteranopia.jpg](after/delta-128-overview-deuteranopia.jpg); tritanopia: [after/delta-128-overview-tritanopia.jpg](after/delta-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 58) → 487, 403; (68, 59) → 516, 398; (72, 58) → 540, 403 |
| badwater | (58, 38) → 455, 506; (75, 38) → 563, 506; (54, 37) → 430, 511 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (63, 63) → 487, 378; (67, 65) → 510, 369; (63, 69) → 487, 352 |
| dry ground | (54, 73) → 437, 334; (63, 77) → 487, 318; (58, 76) → 460, 322 |
| contaminated ground | (58, 44) → 456, 471; (76, 45) → 567, 466; (80, 44) → 592, 471 |
| contaminated beside moist ground | (76, 46) → 567, 461; (54, 42) → 431, 482; (50, 40) → 405, 489 |
| living tree | (59, 59) → 463, 389 (Pine); (53, 56) → 427, 408 (Oak); (60, 47) → 469, 452 (Pine) |
| dead tree | (49, 78) → 408, 288 (Birch); (45, 76) → 385, 298 (Pine); (58, 87) → 461, 269 (Birch) |
| ruin | (44, 121) → 393, 122 (1 high); (39, 121) → 369, 122 (1 high); (7, 124) → 216, 127 (4 high) |
| the start | (55, 65) → 441, 358 |
| slope | (66, 59) → 505, 388 (rises toward the north); (75, 56) → 559, 402 (rises toward the south); (49, 51) → 402, 427 (rises toward the west) |
| dam site | (65, 60) → 499, 392; (69, 56) → 522, 413; (73, 59) → 545, 398 |
| tall cliff | (77, 64) → 567, 381 (3 levels, facing south); (63, 50) → 487, 448 (3 levels, facing south); (67, 50) → 511, 448 (3 levels, facing south) |

**start** (close to the start):

- before: [before/delta-128-start.jpg](before/delta-128-start.jpg)
- after: [after/delta-128-start.jpg](after/delta-128-start.jpg)
- after, greyscale: [after/delta-128-start-grey.jpg](after/delta-128-start-grey.jpg); protanopia: [after/delta-128-start-protanopia.jpg](after/delta-128-start-protanopia.jpg); deuteranopia: [after/delta-128-start-deuteranopia.jpg](after/delta-128-start-deuteranopia.jpg); tritanopia: [after/delta-128-start-tritanopia.jpg](after/delta-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (62, 58) → 720, 437; (57, 55) → 664, 552; (60, 56) → 710, 497 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (59, 65) → 571, 327; (59, 67) → 546, 295; (62, 67) → 602, 281 |
| dry ground | (55, 69) → 444, 300; (53, 69) → 403, 318; (53, 72) → 374, 284 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (50, 57) → 484, 583 (Oak); (37, 67) → 50, 534 (Birch); (60, 47) → 874, 680 (Pine) |
| dead tree | (49, 78) → 216, 153 (Birch); (45, 76) → 142, 222 (Pine); (48, 79) → 186, 147 (Birch) |
| ruin | not in view |
| the start | (55, 65) → 490, 355 |
| slope | (66, 59) → 785, 370 (rises toward the north); (43, 78) → 108, 263 (rises toward the north); (55, 87) → 277, 51 (rises toward the north) |
| dam site | (59, 55) → 705, 528; (65, 60) → 750, 366; (66, 59) → 781, 378 |
| tall cliff | (48, 73) → 259, 294 (4 levels, facing south); (49, 76) → 253, 238 (4 levels, facing south); (43, 69) → 164, 412 (4 levels, facing west) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/delta-128-badwater.jpg](before/delta-128-badwater.jpg)
- after: [after/delta-128-badwater.jpg](after/delta-128-badwater.jpg)
- after, greyscale: [after/delta-128-badwater-grey.jpg](after/delta-128-badwater-grey.jpg); protanopia: [after/delta-128-badwater-protanopia.jpg](after/delta-128-badwater-protanopia.jpg); deuteranopia: [after/delta-128-badwater-deuteranopia.jpg](after/delta-128-badwater-deuteranopia.jpg); tritanopia: [after/delta-128-badwater-tritanopia.jpg](after/delta-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (30, 96) → 480, 348; (33, 95) → 544, 337; (33, 93) → 566, 366 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | not in view |
| dry ground | (31, 86) → 616, 492; (33, 86) → 654, 471; (37, 102) → 540, 193 |
| contaminated ground | (30, 100) → 439, 283; (32, 100) → 475, 268; (29, 101) → 412, 278 |
| contaminated beside moist ground | not in view |
| living tree | (29, 79) → 679, 645 (Oak) |
| dead tree | (29, 90) → 531, 434 (Pine); (25, 90) → 444, 471 (Pine); (24, 91) → 414, 467 (Pine) |
| ruin | (9, 88) → 54, 672 (3 high) |
| the start | not in view |
| slope | (33, 103) → 462, 203 (rises toward the north); (18, 90) → 292, 545 (rises toward the west); (44, 89) → 813, 306 (rises toward the north) |
| dam site | not in view |
| tall cliff | (47, 86) → 899, 327 (3 levels, facing west) |

### Islands (4242), 128×128

**overview** (the whole map from the south):

- before: [before/islands-128-overview.jpg](before/islands-128-overview.jpg)
- after: [after/islands-128-overview.jpg](after/islands-128-overview.jpg)
- after, greyscale: [after/islands-128-overview-grey.jpg](after/islands-128-overview-grey.jpg); protanopia: [after/islands-128-overview-protanopia.jpg](after/islands-128-overview-protanopia.jpg); deuteranopia: [after/islands-128-overview-deuteranopia.jpg](after/islands-128-overview-deuteranopia.jpg); tritanopia: [after/islands-128-overview-tritanopia.jpg](after/islands-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 375; (67, 65) → 510, 365; (59, 65) → 464, 365 |
| badwater | (91, 113) → 628, 158; (31, 114) → 327, 155; (90, 121) → 620, 132 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (57, 56) → 451, 402; (64, 74) → 493, 320; (58, 73) → 459, 324 |
| dry ground | (111, 54) → 777, 411; (105, 101) → 707, 196; (114, 39) → 821, 472 |
| contaminated ground | (97, 109) → 661, 168; (88, 116) → 612, 145; (83, 119) → 587, 136 |
| contaminated beside moist ground | (86, 106) → 603, 202; (36, 107) → 352, 198; (31, 106) → 326, 202 |
| living tree | (61, 75) → 476, 312 (Oak); (51, 49) → 413, 434 (Birch); (46, 49) → 381, 433 (Birch) |
| dead tree | (101, 98) → 690, 204 (Oak); (90, 19) → 679, 592 (Pine); (118, 56) → 828, 374 (Pine) |
| ruin | (104, 29) → 766, 531 (1 high); (38, 111) → 363, 179 (1 high); (110, 94) → 740, 220 (1 high) |
| the start | (64, 112) → 492, 172 |
| slope | (98, 77) → 683, 302 (rises toward the north); (26, 86) → 287, 266 (rises toward the north); (18, 82) → 240, 282 (rises toward the west) |
| dam site | (24, 79) → 273, 305 |
| tall cliff | (82, 60) → 595, 393 (4 levels, facing west); (82, 55) → 600, 419 (4 levels, facing south); (63, 41) → 484, 488 (4 levels, facing west) |

**start** (close to the start):

- before: [before/islands-128-start.jpg](before/islands-128-start.jpg)
- after: [after/islands-128-start.jpg](after/islands-128-start.jpg)
- after, greyscale: [after/islands-128-start-grey.jpg](after/islands-128-start-grey.jpg); protanopia: [after/islands-128-start-protanopia.jpg](after/islands-128-start-protanopia.jpg); deuteranopia: [after/islands-128-start-deuteranopia.jpg](after/islands-128-start-deuteranopia.jpg); tritanopia: [after/islands-128-start-tritanopia.jpg](after/islands-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (64, 103) → 608, 548; (63, 103) → 586, 560; (65, 103) → 630, 536 |
| badwater | (91, 115) → 966, 10 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (64, 108) → 540, 440; (64, 116) → 444, 300; (65, 108) → 561, 429 |
| dry ground | (66, 123) → 401, 81; (68, 123) → 443, 65; (64, 124) → 348, 83 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (57, 111) → 343, 451 (Oak); (57, 108) → 378, 508 (Oak); (55, 112) → 283, 451 (Oak) |
| dead tree | (57, 118) → 271, 310 (Pine); (56, 117) → 254, 337 (Pine); (54, 118) → 205, 339 (Pine) |
| ruin | not in view |
| the start | (64, 112) → 490, 355 |
| slope | (76, 112) → 727, 235 (rises toward the north) |
| dam site | not in view |
| tall cliff | (65, 118) → 446, 238 (4 levels, facing south); (64, 119) → 415, 231 (4 levels, facing south); (64, 105) → 584, 531 (4 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/islands-128-badwater.jpg](before/islands-128-badwater.jpg)
- after: [after/islands-128-badwater.jpg](after/islands-128-badwater.jpg)
- after, greyscale: [after/islands-128-badwater-grey.jpg](after/islands-128-badwater-grey.jpg); protanopia: [after/islands-128-badwater-protanopia.jpg](after/islands-128-badwater-protanopia.jpg); deuteranopia: [after/islands-128-badwater-deuteranopia.jpg](after/islands-128-badwater-deuteranopia.jpg); tritanopia: [after/islands-128-badwater-tritanopia.jpg](after/islands-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (90, 119) → 498, 341; (91, 117) → 537, 361; (90, 121) → 477, 312 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (86, 104) → 590, 686; (84, 104) → 552, 709; (89, 103) → 660, 671 |
| dry ground | (80, 120) → 296, 403; (80, 122) → 278, 372; (79, 121) → 267, 397 |
| contaminated ground | (87, 118) → 453, 372; (88, 116) → 493, 394; (87, 120) → 432, 342 |
| contaminated beside moist ground | (87, 106) → 585, 636; (89, 105) → 634, 633 |
| living tree | (80, 108) → 425, 666 (Pine); (81, 107) → 457, 674 (Pine); (78, 109) → 376, 668 (Pine) |
| dead tree | (84, 124) → 336, 300 (Pine); (75, 118) → 206, 486 (Oak); (74, 120) → 165, 461 (Oak) |
| ruin | (99, 116) → 697, 266 (5 high); (105, 118) → 763, 215 (2 high) |
| the start | not in view |
| slope | (93, 109) → 674, 458 (rises toward the north); (76, 112) → 302, 632 (rises toward the north) |
| dam site | not in view |
| tall cliff | (86, 111) → 516, 543 (3 levels, facing south); (87, 110) → 546, 551 (3 levels, facing south); (89, 109) → 580, 544 (3 levels, facing west) |

**falls** (the tallest waterfall, from downstream):

- before: [before/islands-128-falls.jpg](before/islands-128-falls.jpg)
- after: [after/islands-128-falls.jpg](after/islands-128-falls.jpg)
- after, greyscale: [after/islands-128-falls-grey.jpg](after/islands-128-falls-grey.jpg); protanopia: [after/islands-128-falls-protanopia.jpg](after/islands-128-falls-protanopia.jpg); deuteranopia: [after/islands-128-falls-deuteranopia.jpg](after/islands-128-falls-deuteranopia.jpg); tritanopia: [after/islands-128-falls-tritanopia.jpg](after/islands-128-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (10, 94) → 450, 344; (9, 94) → 451, 311; (10, 93) → 411, 344 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (8, 99) → 653, 192; (9, 100) → 700, 215; (8, 100) → 694, 192 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | not in view |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
| tall cliff | (10, 96) → 510, 322 (3 levels, facing south); (9, 97) → 550, 265 (3 levels, facing south) |

### River Valley (4242), 256×256

**overview** (the whole map from the south):

- before: [before/riverValley-256-overview.jpg](before/riverValley-256-overview.jpg)
- after: [after/riverValley-256-overview.jpg](after/riverValley-256-overview.jpg)
- after, greyscale: [after/riverValley-256-overview-grey.jpg](after/riverValley-256-overview-grey.jpg); protanopia: [after/riverValley-256-overview-protanopia.jpg](after/riverValley-256-overview-protanopia.jpg); deuteranopia: [after/riverValley-256-overview-deuteranopia.jpg](after/riverValley-256-overview-deuteranopia.jpg); tritanopia: [after/riverValley-256-overview-tritanopia.jpg](after/riverValley-256-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (127, 116) → 489, 398; (136, 117) → 515, 396; (119, 114) → 465, 403 |
| badwater | (142, 132) → 532, 361; (151, 136) → 557, 353; (139, 100) → 525, 437 |
| water partly bad | (173, 154) → 615, 317 (54% bad); (182, 156) → 640, 312 (55% bad); (183, 169) → 639, 286 (39% bad) |
| badwater meets clean water | not in view |
| moist ground | (133, 121) → 506, 385; (142, 122) → 532, 383; (122, 100) → 473, 436 |
| dry ground | (130, 127) → 497, 364; (131, 138) → 500, 340; (122, 144) → 475, 334 |
| contaminated ground | (146, 140) → 542, 343; (153, 133) → 563, 358; (143, 106) → 537, 421 |
| contaminated beside moist ground | (142, 106) → 534, 421; (156, 149) → 570, 323; (162, 109) → 593, 414 |
| living tree | (127, 127) → 489, 370 (Pine); (137, 131) → 517, 361 (Birch); (123, 118) → 477, 391 (Birch) |
| dead tree | (119, 132) → 465, 355 (Birch); (115, 148) → 455, 318 (Pine); (137, 151) → 516, 312 (Oak) |
| ruin | (196, 98) → 700, 441 (1 high); (116, 211) → 461, 192 (2 high); (79, 209) → 366, 198 (1 high) |
| the start | (117, 125) → 459, 370 |
| slope | (126, 117) → 486, 390 (rises toward the north); (138, 129) → 521, 361 (rises toward the east); (137, 118) → 518, 388 (rises toward the north) |
| dam site | (130, 122) → 497, 376; (135, 117) → 512, 396; (120, 114) → 468, 403 |
| tall cliff | (128, 124) → 490, 375 (4 levels, facing west); (129, 137) → 493, 346 (4 levels, facing west); (126, 109) → 484, 411 (4 levels, facing west) |

**start** (close to the start):

- before: [before/riverValley-256-start.jpg](before/riverValley-256-start.jpg)
- after: [after/riverValley-256-start.jpg](after/riverValley-256-start.jpg)
- after, greyscale: [after/riverValley-256-start-grey.jpg](after/riverValley-256-start-grey.jpg); protanopia: [after/riverValley-256-start-protanopia.jpg](after/riverValley-256-start-protanopia.jpg); deuteranopia: [after/riverValley-256-start-deuteranopia.jpg](after/riverValley-256-start-deuteranopia.jpg); tritanopia: [after/riverValley-256-start-tritanopia.jpg](after/riverValley-256-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (118, 114) → 657, 587; (119, 114) → 678, 574; (120, 114) → 700, 562 |
| badwater | (143, 131) → 859, 93; (143, 135) → 810, 49; (145, 131) → 888, 80 |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (108, 119) → 362, 599; (135, 121) → 876, 276; (99, 120) → 120, 699 |
| dry ground | (111, 131) → 303, 337; (110, 132) → 272, 330; (109, 131) → 260, 356 |
| contaminated ground | (151, 132) → 962, 23 |
| contaminated beside moist ground | not in view |
| living tree | (110, 122) → 368, 500 (Pine); (125, 127) → 624, 260 (Pine); (111, 119) → 434, 554 (Pine) |
| dead tree | (115, 132) → 376, 274 (Birch); (114, 133) → 341, 268 (Birch); (119, 140) → 376, 131 (Pine) |
| ruin | not in view |
| the start | (117, 125) → 490, 355 |
| slope | (126, 117) → 777, 426 (rises toward the north); (121, 109) → 808, 656 (rises toward the south); (137, 118) → 959, 300 (rises toward the north) |
| dam site | (120, 114) → 700, 562; (121, 113) → 736, 571; (130, 122) → 799, 248 |
| tall cliff | (128, 124) → 712, 269 (4 levels, facing west); (128, 119) → 803, 356 (4 levels, facing south); (130, 119) → 841, 336 (4 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/riverValley-256-badwater.jpg](before/riverValley-256-badwater.jpg)
- after: [after/riverValley-256-badwater.jpg](after/riverValley-256-badwater.jpg)
- after, greyscale: [after/riverValley-256-badwater-grey.jpg](after/riverValley-256-badwater-grey.jpg); protanopia: [after/riverValley-256-badwater-protanopia.jpg](after/riverValley-256-badwater-protanopia.jpg); deuteranopia: [after/riverValley-256-badwater-deuteranopia.jpg](after/riverValley-256-badwater-deuteranopia.jpg); tritanopia: [after/riverValley-256-badwater-tritanopia.jpg](after/riverValley-256-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | not in view |
| water partly bad | (193, 176) → 490, 355 (41% bad); (192, 175) → 482, 379 (41% bad); (194, 175) → 519, 362 (41% bad) |
| badwater meets clean water | not in view |
| moist ground | (196, 172) → 591, 389; (197, 173) → 597, 364; (195, 171) → 584, 414 |
| dry ground | (199, 170) → 670, 393; (198, 169) → 665, 418; (200, 171) → 675, 369 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (187, 177) → 361, 383 (Pine); (191, 182) → 393, 273 (Pine); (183, 177) → 283, 416 (Pine) |
| dead tree | (224, 182) → 902, 60 (Pine); (227, 181) → 950, 53 (Pine) |
| ruin | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
| tall cliff | not in view |

**falls** (the tallest waterfall, from downstream):

- before: [before/riverValley-256-falls.jpg](before/riverValley-256-falls.jpg)
- after: [after/riverValley-256-falls.jpg](after/riverValley-256-falls.jpg)
- after, greyscale: [after/riverValley-256-falls-grey.jpg](after/riverValley-256-falls-grey.jpg); protanopia: [after/riverValley-256-falls-protanopia.jpg](after/riverValley-256-falls-protanopia.jpg); deuteranopia: [after/riverValley-256-falls-deuteranopia.jpg](after/riverValley-256-falls-deuteranopia.jpg); tritanopia: [after/riverValley-256-falls-tritanopia.jpg](after/riverValley-256-falls-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (84, 79) → 490, 350; (84, 78) → 449, 296; (83, 79) → 490, 270 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | (85, 75) → 317, 301; (87, 76) → 351, 360; (86, 75) → 311, 329 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | not in view |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | (81, 83) → 644, 200 (rises toward the north); (77, 74) → 316, 122 (rises toward the south) |
| dam site | not in view |
| tall cliff | (86, 77) → 406, 363 (3 levels, facing west); (87, 78) → 447, 393 (3 levels, facing west); (89, 79) → 490, 458 (3 levels, facing west) |

### Beavertopia, 256×256 (workshop map, local only)

**overview** (the whole map from the south):

- before: `.scratch/map-look/before/beavertopia-256-overview.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-overview.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-overview-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-overview-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-overview-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-overview-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (125, 98) → 482, 453; (118, 167) → 464, 273; (153, 95) → 567, 461 |
| badwater | (127, 225) → 489, 176; (135, 248) → 508, 139; (145, 247) → 532, 141 |
| water partly bad | (109, 180) → 441, 268 (65% bad); (107, 196) → 437, 239 (24% bad); (104, 213) → 431, 209 (25% bad) |
| badwater meets clean water | not in view |
| moist ground | (159, 124) → 582, 376; (95, 120) → 396, 399; (140, 160) → 525, 284 |
| dry ground | (163, 107) → 597, 416; (97, 156) → 405, 302; (99, 95) → 401, 439 |
| contaminated ground | (82, 102) → 351, 427; (77, 94) → 333, 447; (119, 196) → 468, 227 |
| contaminated beside moist ground | (106, 184) → 434, 260; (131, 226) → 499, 173; (103, 238) → 431, 167 |
| living tree | (127, 127) → 489, 378 (Pine); (133, 134) → 506, 353 (Pine); (122, 139) → 475, 335 (Birch) |
| dead tree | (133, 123) → 506, 384 (Oak); (141, 120) → 529, 390 (Oak); (151, 127) → 558, 374 (Oak) |
| ruin | (140, 112) → 527, 412 (5 high); (131, 100) → 501, 443 (3 high); (247, 153) → 820, 319 (2 high) |
| the start | (96, 161) → 403, 287 |
| slope | (191, 64) → 696, 538 (rises toward the south); (249, 149) → 829, 325 (rises toward the west); (248, 82) → 870, 483 (rises toward the south) |
| dam site | not in view |
| tall cliff | (90, 183) → 391, 255 (4 levels, facing south); (112, 197) → 449, 228 (3 levels, facing west); (77, 182) → 356, 259 (3 levels, facing west) |

**start** (close to the start):

- before: `.scratch/map-look/before/beavertopia-256-start.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-start.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-start-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-start-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-start-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-start-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (117, 167) → 811, 50; (119, 168) → 829, 24 |
| badwater | not in view |
| water partly bad | (109, 183) → 494, 83 (46% bad); (109, 185) → 478, 64 (38% bad); (108, 188) → 441, 42 (34% bad) |
| badwater meets clean water | not in view |
| moist ground | (90, 176) → 250, 279; (89, 177) → 225, 274; (88, 178) → 201, 268 |
| dry ground | (96, 157) → 540, 440; (92, 161) → 405, 408; (96, 165) → 444, 300 |
| contaminated ground | (106, 179) → 484, 135 |
| contaminated beside moist ground | (107, 185) → 450, 69 |
| living tree | (107, 153) → 826, 384 (Pine); (93, 176) → 300, 247 (Oak); (102, 146) → 843, 589 (Birch) |
| dead tree | (89, 164) → 304, 371 (Birch); (90, 167) → 294, 315 (Birch); (87, 161) → 284, 451 (Pine) |
| ruin | not in view |
| the start | (96, 161) → 490, 355 |
| slope | not in view |
| dam site | not in view |
| tall cliff | (90, 183) → 187, 147 (4 levels, facing south); (89, 184) → 149, 107 (3 levels, facing south); (94, 185) → 233, 62 (3 levels, facing south) |

**badwater** (close to the badwater, where it meets clean water if it does):

- before: `.scratch/map-look/before/beavertopia-256-badwater.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-badwater.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-badwater-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-badwater-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-badwater-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-badwater-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | not in view |
| water partly bad | (101, 245) → 490, 361 (41% bad); (100, 244) → 482, 384 (41% bad); (102, 244) → 519, 367 (41% bad) |
| badwater meets clean water | not in view |
| moist ground | (104, 242) → 579, 373; (103, 241) → 572, 398; (105, 243) → 585, 349 |
| dry ground | (85, 250) → 53, 291 |
| contaminated ground | (101, 237) → 583, 484; (100, 236) → 576, 513; (101, 235) → 609, 521 |
| contaminated beside moist ground | (101, 238) → 571, 467; (103, 238) → 609, 447 |
| living tree | (95, 241) → 416, 461 (Birch); (94, 246) → 335, 361 (Birch); (94, 251) → 284, 259 (Birch) |
| dead tree | (97, 250) → 362, 279 (Oak); (98, 254) → 339, 201 (Birch); (92, 254) → 198, 182 (Birch) |
| ruin | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
| tall cliff | not in view |

**falls** (the tallest waterfall, from downstream):

- before: `.scratch/map-look/before/beavertopia-256-falls.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-falls.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-falls-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-falls-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-falls-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-falls-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (113, 105) → 442, 677; (114, 104) → 490, 721 |
| badwater | not in view |
| water partly bad | not in view |
| badwater meets clean water | not in view |
| moist ground | not in view |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (114, 110) → 485, 390 (Oak); (116, 108) → 579, 457 (Oak); (118, 107) → 691, 495 (Oak) |
| dead tree | not in view |
| ruin | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
| tall cliff | not in view |
