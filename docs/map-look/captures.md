# Map look captures

Before and after captures of the same maps from the same camera poses, for the Map look review
(ROADMAP "Map look", PLAN §20 D86 and D110). The before captures show the 3D view at `m8-done`
(cfa5990); the after captures show it with Map look. Each after capture (but the falls) also
comes in greyscale and in three colour-blindness simulations (protanopia, deuteranopia,
tritanopia; Machado, Oliveira and Fernandes 2009, full severity, in linear RGB).

Made with `npx tsx tools/capture-look.ts --label before|after` (before on 2026-09-25, after on 2026-09-25), in the installed Chrome, headed, at 1280×800 CSS pixels and a device pixel ratio of 1. Each map is opened in the editor (generated maps with **Refine this map**, Beavertopia through the file input) with **Show dam sites** on, and only the 3D canvas is captured, except for one whole view per run. The water is held at one moment of its movement.

The maps: seed 4242 in every theme at 128² (Normal), seed 4242 River Valley at 256², and
Beavertopia (a workshop map, 256²). Beavertopia's captures are not ours to share: they stay in
`.scratch/map-look/` on the machine that made them and are never committed.

## Where to look

For each capture, up to three example tiles of each meaning that are in view: the tile (x east,
y north, from the map's south-west corner) and its position in the image, in pixels from the
top-left corner. The before and after captures of a pose share the camera, so the positions
hold for both, and for the greyscale and colour-blind versions. Trees and the start are
objects standing on the tile; dam sites are lines of tiles across a river. "Badwater meets clean
water" is water partly bad, where the two mix; our generated maps keep their badwater in its
basins, so only Beavertopia has it. "Contaminated beside moist ground" is contaminated ground
with moist ground next to it.

### River Valley (4242), 128×128

**default-ui** (the page's own view from its default camera, with its buttons and legend):

- before: [before/riverValley-128-default-ui.jpg](before/riverValley-128-default-ui.jpg)
- after: [after/riverValley-128-default-ui.jpg](after/riverValley-128-default-ui.jpg)

**overview** (the whole map from the south):

- before: [before/riverValley-128-overview.jpg](before/riverValley-128-overview.jpg)
- after: [after/riverValley-128-overview.jpg](after/riverValley-128-overview.jpg)
- after, greyscale: [after/riverValley-128-overview-grey.jpg](after/riverValley-128-overview-grey.jpg); protanopia: [after/riverValley-128-overview-protanopia.jpg](after/riverValley-128-overview-protanopia.jpg); deuteranopia: [after/riverValley-128-overview-deuteranopia.jpg](after/riverValley-128-overview-deuteranopia.jpg); tritanopia: [after/riverValley-128-overview-tritanopia.jpg](after/riverValley-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (64, 59) → 493, 400; (60, 58) → 470, 405; (69, 59) → 522, 400 |
| badwater | (44, 81) → 384, 298; (39, 81) → 357, 298; (44, 87) → 386, 274 |
| badwater meets clean water | not in view |
| moist ground | (62, 63) → 481, 378; (68, 63) → 516, 378; (59, 67) → 464, 360 |
| dry ground | (64, 64) → 493, 360; (67, 60) → 511, 378; (68, 67) → 516, 346 |
| contaminated ground | (46, 80) → 394, 294; (41, 79) → 366, 298; (37, 76) → 343, 315 |
| contaminated beside moist ground | (33, 76) → 320, 315; (28, 76) → 293, 315; (23, 76) → 265, 315 |
| living tree | (60, 63) → 470, 378; (63, 69) → 487, 352; (71, 68) → 532, 356 |
| dead tree | (63, 63) → 487, 364; (67, 65) → 510, 355; (61, 75) → 476, 326 |
| the start | (45, 55) → 380, 413 |
| slope | (59, 58) → 464, 405; (68, 55) → 517, 419; (75, 61) → 556, 391 |
| dam site | (66, 57) → 505, 410; (77, 61) → 568, 391; (53, 53) → 428, 429 |

- The slope at (59, 58) rises toward the west.
- The slope at (68, 55) rises toward the south.
- The slope at (75, 61) rises toward the west.

**start** (close to the start):

- before: [before/riverValley-128-start.jpg](before/riverValley-128-start.jpg)
- after: [after/riverValley-128-start.jpg](after/riverValley-128-start.jpg)
- after, greyscale: [after/riverValley-128-start-grey.jpg](after/riverValley-128-start-grey.jpg); protanopia: [after/riverValley-128-start-protanopia.jpg](after/riverValley-128-start-protanopia.jpg); deuteranopia: [after/riverValley-128-start-deuteranopia.jpg](after/riverValley-128-start-deuteranopia.jpg); tritanopia: [after/riverValley-128-start-tritanopia.jpg](after/riverValley-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (49, 50) → 632, 439; (50, 51) → 638, 411; (48, 49) → 625, 468 |
| badwater | (44, 81) → 231, 20; (42, 81) → 196, 33; (40, 81) → 160, 45 |
| badwater meets clean water | not in view |
| moist ground | (45, 53) → 515, 402; (43, 55) → 448, 387; (47, 55) → 531, 347 |
| dry ground | (43, 58) → 414, 335; (44, 59) → 424, 309; (42, 59) → 382, 328 |
| contaminated ground | (37, 76) → 131, 109; (35, 76) → 90, 124; (36, 77) → 104, 104 |
| contaminated beside moist ground | (33, 76) → 49, 139 |
| living tree | (42, 51) → 475, 473; (41, 52) → 440, 465; (43, 50) → 510, 482 |
| dead tree | (38, 69) → 203, 195; (37, 70) → 174, 189; (39, 72) → 200, 146 |
| the start | (45, 55) → 490, 366 |
| slope | (40, 58) → 350, 365; (44, 49) → 544, 502; (51, 54) → 620, 338 |
| dam site | (50, 56) → 578, 301; (51, 55) → 610, 308; (52, 54) → 639, 328 |

- The slope at (40, 58) rises toward the west.
- The slope at (44, 49) rises toward the north.
- The slope at (51, 54) rises toward the west.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/riverValley-128-badwater.jpg](before/riverValley-128-badwater.jpg)
- after: [after/riverValley-128-badwater.jpg](after/riverValley-128-badwater.jpg)
- after, greyscale: [after/riverValley-128-badwater-grey.jpg](after/riverValley-128-badwater-grey.jpg); protanopia: [after/riverValley-128-badwater-protanopia.jpg](after/riverValley-128-badwater-protanopia.jpg); deuteranopia: [after/riverValley-128-badwater-deuteranopia.jpg](after/riverValley-128-badwater-deuteranopia.jpg); tritanopia: [after/riverValley-128-badwater-tritanopia.jpg](after/riverValley-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (14, 77) → 71, 710; (13, 78) → 38, 701; (12, 78) → 12, 714 |
| badwater | (36, 83) → 490, 367; (35, 84) → 461, 360; (37, 84) → 498, 344 |
| badwater meets clean water | not in view |
| moist ground | (33, 75) → 523, 516; (34, 74) → 556, 524; (31, 75) → 482, 538 |
| dry ground | (36, 79) → 535, 404; (35, 88) → 420, 278; (39, 78) → 603, 405 |
| contaminated ground | (36, 82) → 501, 356; (35, 82) → 482, 378; (37, 81) → 531, 363 |
| contaminated beside moist ground | (33, 76) → 511, 498; (31, 76) → 470, 519; (29, 76) → 428, 541 |
| living tree | (23, 72) → 337, 698; (22, 73) → 302, 688; (21, 72) → 288, 725 |
| dead tree | (33, 87) → 394, 321; (32, 88) → 366, 315; (39, 90) → 472, 221 |
| the start | not in view |
| slope | (35, 83) → 472, 375; (42, 78) → 657, 377; (40, 91) → 480, 202 |
| dam site | not in view |

- The slope at (35, 83) rises toward the south.
- The slope at (42, 78) rises toward the north.
- The slope at (40, 91) rises toward the north.

**falls** (the tallest waterfall, from downstream):

- before: [before/riverValley-128-falls.jpg](before/riverValley-128-falls.jpg)
- after: [after/riverValley-128-falls.jpg](after/riverValley-128-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (87, 77) → 490, 367; (87, 76) → 490, 281; (88, 77) → 451, 367 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (85, 76) → 572, 249; (84, 77) → 616, 274; (84, 76) → 612, 249 |
| dry ground | (102, 65) → 29, 47; (101, 63) → 78, 21; (102, 63) → 48, 21 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (86, 77) → 532, 274; (86, 78) → 533, 301; (85, 77) → 574, 274 |
| dead tree | not in view |
| the start | not in view |
| slope | (88, 80) → 448, 453; (96, 85) → 40, 639; (75, 61) → 822, 24 |
| dam site | (88, 78) → 450, 394; (89, 77) → 413, 367; (90, 76) → 377, 341 |

- The slope at (88, 80) rises toward the north.
- The slope at (96, 85) rises toward the south.
- The slope at (75, 61) rises toward the west.

### Canyon (4242), 128×128

**overview** (the whole map from the south):

- before: [before/canyon-128-overview.jpg](before/canyon-128-overview.jpg)
- after: [after/canyon-128-overview.jpg](after/canyon-128-overview.jpg)
- after, greyscale: [after/canyon-128-overview-grey.jpg](after/canyon-128-overview-grey.jpg); protanopia: [after/canyon-128-overview-protanopia.jpg](after/canyon-128-overview-protanopia.jpg); deuteranopia: [after/canyon-128-overview-deuteranopia.jpg](after/canyon-128-overview-deuteranopia.jpg); tritanopia: [after/canyon-128-overview-tritanopia.jpg](after/canyon-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 395; (67, 61) → 510, 405; (59, 61) → 464, 405 |
| badwater | (16, 50) → 201, 437; (16, 45) → 196, 462; (12, 50) → 177, 437 |
| badwater meets clean water | not in view |
| moist ground | (63, 65) → 487, 376; (65, 60) → 499, 399; (68, 65) → 516, 376 |
| dry ground | (65, 66) → 499, 365; (65, 59) → 499, 397; (69, 68) → 521, 356 |
| contaminated ground | (18, 51) → 212, 425; (18, 46) → 207, 450; (14, 51) → 187, 425 |
| contaminated beside moist ground | (2, 57) → 124, 399 |
| living tree | (64, 57) → 493, 420; (57, 66) → 454, 379; (61, 70) → 476, 361 |
| dead tree | (54, 78) → 438, 306; (64, 81) → 493, 290; (50, 76) → 415, 314 |
| the start | (41, 53) → 357, 436 |
| slope | (74, 61) → 550, 405; (81, 66) → 588, 382; (45, 58) → 384, 418 |
| dam site | (64, 64) → 493, 391; (57, 63) → 453, 395; (72, 63) → 538, 395 |

- The slope at (74, 61) rises toward the south.
- The slope at (81, 66) rises toward the north.
- The slope at (45, 58) rises toward the east.

**start** (close to the start):

- before: [before/canyon-128-start.jpg](before/canyon-128-start.jpg)
- after: [after/canyon-128-start.jpg](after/canyon-128-start.jpg)
- after, greyscale: [after/canyon-128-start-grey.jpg](after/canyon-128-start-grey.jpg); protanopia: [after/canyon-128-start-protanopia.jpg](after/canyon-128-start-protanopia.jpg); deuteranopia: [after/canyon-128-start-deuteranopia.jpg](after/canyon-128-start-deuteranopia.jpg); tritanopia: [after/canyon-128-start-tritanopia.jpg](after/canyon-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (41, 58) → 435, 310; (39, 58) → 396, 328; (43, 58) → 473, 293 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (41, 51) → 515, 402; (39, 53) → 448, 387; (43, 53) → 531, 347 |
| dry ground | (41, 47) → 567, 479; (38, 46) → 517, 476; (36, 47) → 450, 480 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (40, 49) → 519, 451; (42, 49) → 561, 429; (38, 49) → 475, 473 |
| dead tree | (39, 45) → 558, 486; (37, 45) → 506, 513; (38, 44) → 548, 524 |
| the start | (41, 53) → 490, 366 |
| slope | (40, 47) → 544, 502; (45, 58) → 511, 276; (48, 47) → 708, 414 |
| dam site | (54, 66) → 581, 90; (55, 65) → 608, 95; (56, 64) → 633, 114 |

- The slope at (40, 47) rises toward the north.
- The slope at (45, 58) rises toward the east.
- The slope at (48, 47) rises toward the east.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/canyon-128-badwater.jpg](before/canyon-128-badwater.jpg)
- after: [after/canyon-128-badwater.jpg](after/canyon-128-badwater.jpg)
- after, greyscale: [after/canyon-128-badwater-grey.jpg](after/canyon-128-badwater-grey.jpg); protanopia: [after/canyon-128-badwater-protanopia.jpg](after/canyon-128-badwater-protanopia.jpg); deuteranopia: [after/canyon-128-badwater-deuteranopia.jpg](after/canyon-128-badwater-deuteranopia.jpg); tritanopia: [after/canyon-128-badwater-tritanopia.jpg](after/canyon-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (16, 63) → 481, 177; (8, 65) → 343, 179; (14, 64) → 444, 179 |
| badwater | (8, 48) → 490, 367; (7, 49) → 461, 360; (9, 49) → 498, 344 |
| badwater meets clean water | not in view |
| moist ground | (14, 57) → 503, 217; (8, 59) → 388, 234; (6, 59) → 355, 248 |
| dry ground | (7, 45) → 504, 397; (5, 45) → 465, 416; (7, 43) → 528, 430 |
| contaminated ground | (8, 47) → 501, 356; (7, 46) → 493, 381; (9, 46) → 531, 363 |
| contaminated beside moist ground | (2, 57) → 295, 276 |
| living tree | (8, 60) → 380, 222; (3, 59) → 303, 269; (18, 56) → 572, 227 |
| dead tree | (7, 44) → 516, 414; (6, 43) → 508, 440; (3, 51) → 366, 352 |
| the start | (41, 53) → 904, 134 |
| slope | (7, 50) → 451, 346; (36, 61) → 754, 112; (40, 47) → 957, 211 |
| dam site | not in view |

- The slope at (7, 50) rises toward the north.
- The slope at (36, 61) rises toward the north.
- The slope at (40, 47) rises toward the north.

**falls** (the tallest waterfall, from downstream):

- before: [before/canyon-128-falls.jpg](before/canyon-128-falls.jpg)
- after: [after/canyon-128-falls.jpg](after/canyon-128-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (89, 65) → 490, 367; (88, 65) → 490, 281; (90, 65) → 490, 394 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (89, 64) → 448, 274; (90, 64) → 447, 301; (89, 63) → 406, 274 |
| dry ground | (91, 58) → 107, 81; (92, 58) → 91, 108; (94, 59) → 117, 169 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (86, 68) → 606, 203; (87, 69) → 648, 226; (89, 70) → 700, 274 |
| dead tree | not in view |
| the start | not in view |
| slope | (81, 66) → 523, 138; (74, 61) → 377, 36 |
| dam site | (89, 65) → 490, 367; (90, 64) → 447, 301; (88, 66) → 530, 281 |

- The slope at (81, 66) rises toward the north.
- The slope at (74, 61) rises toward the south.

### Highlands (4242), 128×128

**overview** (the whole map from the south):

- before: [before/highlands-128-overview.jpg](before/highlands-128-overview.jpg)
- after: [after/highlands-128-overview.jpg](after/highlands-128-overview.jpg)
- after, greyscale: [after/highlands-128-overview-grey.jpg](after/highlands-128-overview-grey.jpg); protanopia: [after/highlands-128-overview-protanopia.jpg](after/highlands-128-overview-protanopia.jpg); deuteranopia: [after/highlands-128-overview-deuteranopia.jpg](after/highlands-128-overview-deuteranopia.jpg); tritanopia: [after/highlands-128-overview-tritanopia.jpg](after/highlands-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (64, 59) → 493, 404; (59, 58) → 464, 408; (69, 59) → 522, 404 |
| badwater | (42, 84) → 374, 282; (37, 84) → 347, 282; (40, 90) → 365, 258 |
| badwater meets clean water | not in view |
| moist ground | (63, 65) → 487, 373; (68, 63) → 516, 382; (58, 65) → 459, 373 |
| dry ground | (63, 63) → 487, 367; (67, 62) → 511, 372; (65, 68) → 499, 345 |
| contaminated ground | (44, 83) → 383, 278; (39, 82) → 355, 282; (34, 83) → 328, 278 |
| contaminated beside moist ground | (41, 82) → 366, 282; (36, 82) → 339, 282; (31, 82) → 312, 286 |
| living tree | (62, 63) → 481, 382; (57, 66) → 453, 368; (69, 68) → 521, 359 |
| dead tree | (65, 70) → 499, 336; (64, 54) → 493, 410; (65, 76) → 498, 311 |
| the start | (44, 59) → 376, 397 |
| slope | (62, 58) → 481, 408; (72, 56) → 540, 418; (77, 63) → 567, 385 |
| dam site | (66, 57) → 505, 413; (71, 66) → 533, 368; (75, 62) → 556, 386 |

- The slope at (62, 58) rises toward the north.
- The slope at (72, 56) rises toward the south.
- The slope at (77, 63) rises toward the west.

**start** (close to the start):

- before: [before/highlands-128-start.jpg](before/highlands-128-start.jpg)
- after: [after/highlands-128-start.jpg](after/highlands-128-start.jpg)
- after, greyscale: [after/highlands-128-start-grey.jpg](after/highlands-128-start-grey.jpg); protanopia: [after/highlands-128-start-protanopia.jpg](after/highlands-128-start-protanopia.jpg); deuteranopia: [after/highlands-128-start-deuteranopia.jpg](after/highlands-128-start-deuteranopia.jpg); tritanopia: [after/highlands-128-start-tritanopia.jpg](after/highlands-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (51, 52) → 718, 444; (50, 51) → 713, 473; (52, 53) → 722, 415 |
| badwater | (41, 84) → 193, 12; (39, 84) → 156, 25; (37, 84) → 117, 38 |
| badwater meets clean water | not in view |
| moist ground | (44, 57) → 515, 402; (46, 59) → 531, 347; (43, 57) → 493, 413 |
| dry ground | (42, 59) → 448, 387; (44, 61) → 467, 332; (42, 61) → 425, 352 |
| contaminated ground | (39, 82) → 158, 14; (37, 82) → 118, 28; (35, 82) → 76, 42 |
| contaminated beside moist ground | (39, 82) → 158, 14; (37, 82) → 118, 28; (35, 82) → 76, 42 |
| living tree | (40, 59) → 405, 408; (40, 61) → 383, 372; (39, 59) → 383, 419 |
| dead tree | (40, 66) → 322, 245; (39, 66) → 300, 254; (42, 68) → 355, 254 |
| the start | (44, 59) → 490, 367 |
| slope | (43, 53) → 544, 502; (50, 58) → 620, 338; (53, 49) → 801, 478 |
| dam site | (49, 53) → 672, 423; (51, 53) → 712, 401; (53, 53) → 741, 405 |

- The slope at (43, 53) rises toward the north.
- The slope at (50, 58) rises toward the west.
- The slope at (53, 49) rises toward the south.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/highlands-128-badwater.jpg](before/highlands-128-badwater.jpg)
- after: [after/highlands-128-badwater.jpg](after/highlands-128-badwater.jpg)
- after, greyscale: [after/highlands-128-badwater-grey.jpg](after/highlands-128-badwater-grey.jpg); protanopia: [after/highlands-128-badwater-protanopia.jpg](after/highlands-128-badwater-protanopia.jpg); deuteranopia: [after/highlands-128-badwater-deuteranopia.jpg](after/highlands-128-badwater-deuteranopia.jpg); tritanopia: [after/highlands-128-badwater-tritanopia.jpg](after/highlands-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (25, 80) → 412, 631; (24, 81) → 380, 623; (23, 81) → 359, 634 |
| badwater | (34, 89) → 490, 367; (33, 90) → 461, 360; (35, 90) → 498, 344 |
| badwater meets clean water | not in view |
| moist ground | (34, 82) → 572, 455; (34, 81) → 583, 484; (32, 81) → 544, 505 |
| dry ground | (35, 94) → 457, 262; (38, 93) → 520, 239; (39, 92) → 549, 244 |
| contaminated ground | (34, 88) → 501, 356; (33, 88) → 482, 378; (35, 87) → 531, 363 |
| contaminated beside moist ground | (34, 83) → 560, 438; (33, 82) → 551, 477; (35, 82) → 592, 445 |
| living tree | (26, 76) → 479, 677; (27, 75) → 515, 687; (26, 75) → 492, 700 |
| dead tree | (28, 100) → 275, 237; (26, 100) → 242, 265; (27, 101) → 249, 231 |
| the start | not in view |
| slope | (44, 79) → 795, 420; (50, 86) → 802, 253 |
| dam site | not in view |

- The slope at (44, 79) rises toward the north.
- The slope at (50, 86) rises toward the west.

**falls** (the tallest waterfall, from downstream):

- before: [before/highlands-128-falls.jpg](before/highlands-128-falls.jpg)
- after: [after/highlands-128-falls.jpg](after/highlands-128-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (12, 109) → 490, 421; (11, 109) → 451, 421; (12, 108) → 490, 450 |
| badwater | (18, 110) → 716, 394; (18, 109) → 723, 421; (18, 111) → 710, 368 |
| badwater meets clean water | not in view |
| moist ground | (13, 110) → 539, 80; (13, 109) → 531, 364; (10, 110) → 392, 80 |
| dry ground | (21, 112) → 837, 257; (21, 113) → 828, 235; (22, 111) → 887, 281 |
| contaminated ground | (12, 105) → 490, 520; (13, 105) → 535, 520; (12, 104) → 490, 557 |
| contaminated beside moist ground | (12, 105) → 490, 520; (13, 105) → 535, 520 |
| living tree | (15, 111) → 632, 57; (16, 110) → 686, 80 |
| dead tree | (16, 109) → 654, 364; (16, 108) → 659, 393; (16, 107) → 664, 424 |
| the start | not in view |
| slope | not in view |
| dam site | not in view |

### Lake Basin (4242), 128×128

**overview** (the whole map from the south):

- before: [before/lakeBasin-128-overview.jpg](before/lakeBasin-128-overview.jpg)
- after: [after/lakeBasin-128-overview.jpg](after/lakeBasin-128-overview.jpg)
- after, greyscale: [after/lakeBasin-128-overview-grey.jpg](after/lakeBasin-128-overview-grey.jpg); protanopia: [after/lakeBasin-128-overview-protanopia.jpg](after/lakeBasin-128-overview-protanopia.jpg); deuteranopia: [after/lakeBasin-128-overview-deuteranopia.jpg](after/lakeBasin-128-overview-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-overview-tritanopia.jpg](after/lakeBasin-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 390; (67, 65) → 510, 381; (59, 65) → 465, 381 |
| badwater | (46, 105) → 402, 209; (41, 105) → 377, 209; (45, 112) → 399, 181 |
| badwater meets clean water | not in view |
| moist ground | (72, 38) → 544, 501; (77, 40) → 575, 490; (76, 88) → 556, 271 |
| dry ground | (87, 30) → 645, 543; (83, 100) → 590, 223; (72, 104) → 533, 209 |
| contaminated ground | (48, 98) → 410, 234; (52, 101) → 431, 223; (43, 98) → 385, 234 |
| contaminated beside moist ground | (48, 98) → 410, 234; (52, 101) → 431, 223; (43, 98) → 385, 234 |
| living tree | (75, 39) → 563, 495; (80, 86) → 578, 279; (62, 92) → 482, 256 |
| dead tree | (51, 102) → 427, 219; (90, 99) → 626, 226; (105, 46) → 747, 455 |
| the start | (69, 98) → 518, 234 |
| slope | (95, 64) → 671, 375; (30, 78) → 307, 314; (102, 59) → 715, 398 |
| dam site | (83, 44) → 609, 482; (83, 83) → 594, 305; (87, 48) → 631, 461 |

- The slope at (95, 64) rises toward the north.
- The slope at (30, 78) rises toward the north.
- The slope at (102, 59) rises toward the south.

**start** (close to the start):

- before: [before/lakeBasin-128-start.jpg](before/lakeBasin-128-start.jpg)
- after: [after/lakeBasin-128-start.jpg](after/lakeBasin-128-start.jpg)
- after, greyscale: [after/lakeBasin-128-start-grey.jpg](after/lakeBasin-128-start-grey.jpg); protanopia: [after/lakeBasin-128-start-protanopia.jpg](after/lakeBasin-128-start-protanopia.jpg); deuteranopia: [after/lakeBasin-128-start-deuteranopia.jpg](after/lakeBasin-128-start-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-start-tritanopia.jpg](after/lakeBasin-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (66, 91) → 512, 574; (69, 90) → 587, 560; (65, 91) → 491, 586 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (69, 96) → 515, 402; (67, 98) → 448, 387; (71, 98) → 531, 347 |
| dry ground | (72, 104) → 481, 228; (69, 105) → 411, 239; (71, 105) → 450, 221 |
| contaminated ground | (53, 103) → 78, 444; (52, 101) → 69, 495; (53, 105) → 63, 407 |
| contaminated beside moist ground | (53, 103) → 78, 444; (52, 101) → 69, 495; (53, 105) → 63, 407 |
| living tree | (73, 98) → 571, 327; (65, 98) → 405, 408; (68, 102) → 424, 309 |
| dead tree | (72, 109) → 424, 108; (73, 110) → 433, 69; (72, 111) → 402, 64 |
| the start | (69, 98) → 490, 367 |
| slope | (72, 103) → 492, 257; (62, 105) → 268, 316; (76, 111) → 480, 34 |
| dam site | (81, 85) → 890, 522; (82, 84) → 924, 531; (83, 83) → 959, 539 |

- The slope at (72, 103) rises toward the north.
- The slope at (62, 105) rises toward the north.
- The slope at (76, 111) rises toward the north.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/lakeBasin-128-badwater.jpg](before/lakeBasin-128-badwater.jpg)
- after: [after/lakeBasin-128-badwater.jpg](after/lakeBasin-128-badwater.jpg)
- after, greyscale: [after/lakeBasin-128-badwater-grey.jpg](after/lakeBasin-128-badwater-grey.jpg); protanopia: [after/lakeBasin-128-badwater-protanopia.jpg](after/lakeBasin-128-badwater-protanopia.jpg); deuteranopia: [after/lakeBasin-128-badwater-deuteranopia.jpg](after/lakeBasin-128-badwater-deuteranopia.jpg); tritanopia: [after/lakeBasin-128-badwater-tritanopia.jpg](after/lakeBasin-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (53, 91) → 941, 695; (53, 90) → 958, 716 |
| badwater | (43, 113) → 490, 367; (44, 112) → 519, 373; (44, 114) → 498, 344 |
| badwater meets clean water | not in view |
| moist ground | (54, 105) → 774, 403; (53, 102) → 799, 459; (54, 103) → 801, 434 |
| dry ground | (42, 113) → 470, 309; (41, 112) → 461, 334; (41, 114) → 439, 302 |
| contaminated ground | (47, 107) → 634, 411; (49, 107) → 667, 405; (47, 105) → 660, 444 |
| contaminated beside moist ground | (53, 105) → 757, 412; (53, 103) → 785, 443; (52, 102) → 782, 469 |
| living tree | (56, 104) → 820, 401; (57, 103) → 850, 407; (59, 105) → 854, 361 |
| dead tree | (50, 110) → 655, 312; (35, 112) → 333, 392; (41, 121) → 368, 202 |
| the start | not in view |
| slope | (36, 109) → 389, 449; (49, 106) → 679, 421; (41, 102) → 579, 582 |
| dam site | not in view |

- The slope at (36, 109) rises toward the north.
- The slope at (49, 106) rises toward the west.
- The slope at (41, 102) rises toward the west.

**falls** (the tallest waterfall, from downstream):

- before: [before/lakeBasin-128-falls.jpg](before/lakeBasin-128-falls.jpg)
- after: [after/lakeBasin-128-falls.jpg](after/lakeBasin-128-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (16, 88) → 490, 366; (16, 87) → 451, 366; (15, 88) → 490, 215 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (17, 88) → 490, 229; (16, 89) → 535, 203; (17, 89) → 536, 229 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (16, 90) → 579, 203; (16, 91) → 624, 203; (17, 92) → 674, 229 |
| dead tree | not in view |
| the start | not in view |
| slope | (13, 85) → 371, 170; (20, 80) → 141, 485 |
| dam site | not in view |

- The slope at (13, 85) rises toward the south.
- The slope at (20, 80) rises toward the west.

### Delta (4242), 128×128

**overview** (the whole map from the south):

- before: [before/delta-128-overview.jpg](before/delta-128-overview.jpg)
- after: [after/delta-128-overview.jpg](after/delta-128-overview.jpg)
- after, greyscale: [after/delta-128-overview-grey.jpg](after/delta-128-overview-grey.jpg); protanopia: [after/delta-128-overview-protanopia.jpg](after/delta-128-overview-protanopia.jpg); deuteranopia: [after/delta-128-overview-deuteranopia.jpg](after/delta-128-overview-deuteranopia.jpg); tritanopia: [after/delta-128-overview-tritanopia.jpg](after/delta-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 59) → 487, 400; (68, 60) → 516, 396; (58, 58) → 458, 405 |
| badwater | (63, 39) → 487, 501; (67, 39) → 512, 501; (59, 39) → 462, 501 |
| badwater meets clean water | not in view |
| moist ground | (63, 63) → 487, 378; (67, 65) → 510, 369; (59, 64) → 464, 370 |
| dry ground | (58, 69) → 459, 348; (53, 67) → 430, 357; (63, 76) → 487, 322 |
| contaminated ground | (60, 46) → 469, 461; (69, 46) → 524, 461; (73, 46) → 548, 461 |
| contaminated beside moist ground | (60, 46) → 469, 461; (69, 46) → 524, 461; (73, 46) → 548, 461 |
| living tree | (60, 61) → 470, 388; (56, 59) → 446, 397; (52, 61) → 423, 384 |
| dead tree | (72, 46) → 542, 461; (49, 78) → 409, 299; (45, 76) → 386, 307 |
| the start | (55, 65) → 441, 366 |
| slope | (66, 59) → 505, 400; (54, 59) → 434, 397; (60, 53) → 469, 429 |
| dam site | (65, 60) → 499, 392; (68, 57) → 516, 410; (57, 57) → 452, 410 |

- The slope at (66, 59) rises toward the north.
- The slope at (54, 59) rises toward the north.
- The slope at (60, 53) rises toward the south.

**start** (close to the start):

- before: [before/delta-128-start.jpg](before/delta-128-start.jpg)
- after: [after/delta-128-start.jpg](after/delta-128-start.jpg)
- after, greyscale: [after/delta-128-start-grey.jpg](after/delta-128-start-grey.jpg); protanopia: [after/delta-128-start-protanopia.jpg](after/delta-128-start-protanopia.jpg); deuteranopia: [after/delta-128-start-deuteranopia.jpg](after/delta-128-start-deuteranopia.jpg); tritanopia: [after/delta-128-start-tritanopia.jpg](after/delta-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (58, 58) → 639, 487; (60, 59) → 665, 446; (56, 57) → 612, 529 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (55, 63) → 515, 402; (53, 65) → 448, 387; (57, 65) → 531, 347 |
| dry ground | (53, 67) → 425, 352; (55, 68) → 455, 316; (51, 66) → 394, 390 |
| contaminated ground | (60, 46) → 884, 717 |
| contaminated beside moist ground | (60, 46) → 884, 717 |
| living tree | (51, 63) → 428, 446; (53, 61) → 497, 462; (55, 60) → 553, 459 |
| dead tree | (49, 78) → 222, 170; (45, 76) → 150, 236; (50, 79) → 253, 208 |
| the start | (55, 65) → 490, 367 |
| slope | (54, 59) → 544, 502; (66, 59) → 778, 385; (60, 53) → 754, 564 |
| dam site | (56, 58) → 600, 498; (57, 57) → 633, 517; (58, 56) → 667, 526 |

- The slope at (54, 59) rises toward the north.
- The slope at (66, 59) rises toward the north.
- The slope at (60, 53) rises toward the south.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/delta-128-badwater.jpg](before/delta-128-badwater.jpg)
- after: [after/delta-128-badwater.jpg](after/delta-128-badwater.jpg)
- after, greyscale: [after/delta-128-badwater-grey.jpg](after/delta-128-badwater-grey.jpg); protanopia: [after/delta-128-badwater-protanopia.jpg](after/delta-128-badwater-protanopia.jpg); deuteranopia: [after/delta-128-badwater-deuteranopia.jpg](after/delta-128-badwater-deuteranopia.jpg); tritanopia: [after/delta-128-badwater-tritanopia.jpg](after/delta-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (30, 95) → 490, 366; (29, 96) → 461, 360; (28, 95) → 453, 384 |
| badwater meets clean water | not in view |
| moist ground | (27, 87) → 523, 516; (27, 85) → 549, 554; (21, 89) → 374, 544 |
| dry ground | (30, 88) → 572, 455; (36, 99) → 553, 251; (30, 87) → 583, 484 |
| contaminated ground | (30, 94) → 501, 356; (29, 94) → 482, 378; (31, 93) → 531, 363 |
| contaminated beside moist ground | (27, 88) → 511, 498; (25, 88) → 470, 519; (23, 89) → 417, 522 |
| living tree | (26, 87) → 503, 527; (27, 86) → 536, 535; (23, 88) → 428, 541 |
| dead tree | (28, 93) → 474, 403; (27, 94) → 444, 396; (27, 92) → 465, 428 |
| the start | not in view |
| slope | (29, 95) → 472, 375; (33, 103) → 463, 223; (42, 99) → 653, 194 |
| dam site | not in view |

- The slope at (29, 95) rises toward the south.
- The slope at (33, 103) rises toward the north.
- The slope at (42, 99) rises toward the north.

### Islands (4242), 128×128

**overview** (the whole map from the south):

- before: [before/islands-128-overview.jpg](before/islands-128-overview.jpg)
- after: [after/islands-128-overview.jpg](after/islands-128-overview.jpg)
- after, greyscale: [after/islands-128-overview-grey.jpg](after/islands-128-overview-grey.jpg); protanopia: [after/islands-128-overview-protanopia.jpg](after/islands-128-overview-protanopia.jpg); deuteranopia: [after/islands-128-overview-deuteranopia.jpg](after/islands-128-overview-deuteranopia.jpg); tritanopia: [after/islands-128-overview-tritanopia.jpg](after/islands-128-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (63, 63) → 487, 386; (67, 65) → 510, 377; (59, 65) → 464, 377 |
| badwater | (90, 112) → 623, 166; (95, 112) → 648, 166; (32, 113) → 332, 163 |
| badwater meets clean water | not in view |
| moist ground | (63, 71) → 487, 333; (58, 57) → 457, 397; (54, 60) → 434, 383 |
| dry ground | (110, 70) → 757, 330; (110, 55) → 770, 406; (108, 47) → 766, 446 |
| contaminated ground | (86, 106) → 603, 202; (91, 105) → 629, 201; (83, 111) → 587, 181 |
| contaminated beside moist ground | (86, 106) → 603, 202; (36, 107) → 352, 198; (31, 106) → 326, 202 |
| living tree | (61, 75) → 476, 316; (52, 60) → 422, 383; (48, 59) → 398, 387 |
| dead tree | (103, 90) → 700, 256; (106, 42) → 758, 473; (101, 34) → 735, 517 |
| the start | (64, 112) → 492, 182 |
| slope | (98, 77) → 680, 315; (106, 73) → 727, 332; (26, 86) → 289, 279 |
| dam site | (89, 89) → 623, 278; (97, 77) → 672, 326; (93, 85) → 646, 294 |

- The slope at (98, 77) rises toward the north.
- The slope at (106, 73) rises toward the south.
- The slope at (26, 86) rises toward the north.

**start** (close to the start):

- before: [before/islands-128-start.jpg](before/islands-128-start.jpg)
- after: [after/islands-128-start.jpg](after/islands-128-start.jpg)
- after, greyscale: [after/islands-128-start-grey.jpg](after/islands-128-start-grey.jpg); protanopia: [after/islands-128-start-protanopia.jpg](after/islands-128-start-protanopia.jpg); deuteranopia: [after/islands-128-start-deuteranopia.jpg](after/islands-128-start-deuteranopia.jpg); tritanopia: [after/islands-128-start-tritanopia.jpg](after/islands-128-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (64, 104) → 587, 560; (62, 104) → 546, 583; (66, 104) → 627, 537 |
| badwater | (90, 113) → 971, 65; (90, 115) → 940, 39; (90, 117) → 910, 15 |
| badwater meets clean water | not in view |
| moist ground | (64, 110) → 515, 402; (62, 112) → 448, 387; (66, 112) → 531, 347 |
| dry ground | (63, 118) → 401, 263; (65, 118) → 438, 199; (69, 116) → 543, 240 |
| contaminated ground | (82, 116) → 797, 68; (82, 118) → 774, 24; (83, 112) → 848, 181 |
| contaminated beside moist ground | (83, 110) → 878, 209; (84, 109) → 910, 216; (84, 108) → 917, 245 |
| living tree | (68, 111) → 584, 344; (68, 113) → 559, 311; (60, 113) → 394, 390 |
| dead tree | (60, 118) → 338, 291; (58, 117) → 305, 327; (59, 119) → 296, 238 |
| the start | (64, 112) → 490, 367 |
| slope | (68, 116) → 523, 264; (56, 115) → 284, 395; (76, 112) → 721, 254 |
| dam site | (64, 104) → 587, 560; (62, 104) → 546, 583; (66, 104) → 627, 537 |

- The slope at (68, 116) rises toward the north.
- The slope at (56, 115) rises toward the north.
- The slope at (76, 112) rises toward the north.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/islands-128-badwater.jpg](before/islands-128-badwater.jpg)
- after: [after/islands-128-badwater.jpg](after/islands-128-badwater.jpg)
- after, greyscale: [after/islands-128-badwater-grey.jpg](after/islands-128-badwater-grey.jpg); protanopia: [after/islands-128-badwater-protanopia.jpg](after/islands-128-badwater-protanopia.jpg); deuteranopia: [after/islands-128-badwater-deuteranopia.jpg](after/islands-128-badwater-deuteranopia.jpg); tritanopia: [after/islands-128-badwater-tritanopia.jpg](after/islands-128-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (89, 118) → 490, 367; (90, 117) → 518, 385; (90, 119) → 498, 344 |
| badwater meets clean water | not in view |
| moist ground | (82, 110) → 445, 616; (80, 111) → 396, 619; (84, 107) → 516, 650 |
| dry ground | (82, 115) → 387, 479; (81, 118) → 334, 426; (82, 114) → 399, 507 |
| contaminated ground | (89, 117) → 501, 369; (88, 118) → 471, 363; (88, 116) → 493, 394 |
| contaminated beside moist ground | (83, 110) → 464, 597; (84, 109) → 494, 605; (84, 108) → 505, 631 |
| living tree | (83, 109) → 475, 624; (81, 110) → 425, 626; (79, 111) → 376, 629 |
| dead tree | (87, 124) → 394, 285; (85, 124) → 357, 301; (88, 126) → 394, 252 |
| the start | not in view |
| slope | (93, 109) → 670, 473; (76, 112) → 306, 643; (68, 116) → 105, 655 |
| dam site | not in view |

- The slope at (93, 109) rises toward the north.
- The slope at (76, 112) rises toward the north.
- The slope at (68, 116) rises toward the north.

**falls** (the tallest waterfall, from downstream):

- before: [before/islands-128-falls.jpg](before/islands-128-falls.jpg)
- after: [after/islands-128-falls.jpg](after/islands-128-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (10, 95) → 490, 366; (10, 94) → 451, 366; (9, 95) → 490, 312 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (10, 96) → 532, 274; (11, 96) → 533, 301; (12, 95) → 490, 362 |
| dry ground | (20, 102) → 882, 707 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | not in view |
| dead tree | not in view |
| the start | not in view |
| slope | not in view |
| dam site | not in view |

### River Valley (4242), 256×256

**overview** (the whole map from the south):

- before: [before/riverValley-256-overview.jpg](before/riverValley-256-overview.jpg)
- after: [after/riverValley-256-overview.jpg](after/riverValley-256-overview.jpg)
- after, greyscale: [after/riverValley-256-overview-grey.jpg](after/riverValley-256-overview-grey.jpg); protanopia: [after/riverValley-256-overview-protanopia.jpg](after/riverValley-256-overview-protanopia.jpg); deuteranopia: [after/riverValley-256-overview-deuteranopia.jpg](after/riverValley-256-overview-deuteranopia.jpg); tritanopia: [after/riverValley-256-overview-tritanopia.jpg](after/riverValley-256-overview-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (127, 117) → 489, 397; (136, 118) → 515, 394; (119, 116) → 465, 399 |
| badwater | (141, 130) → 529, 367; (148, 137) → 548, 351; (138, 101) → 522, 436 |
| badwater meets clean water | (173, 154) → 615, 318; (182, 157) → 639, 312; (182, 169) → 636, 288 |
| moist ground | (127, 128) → 489, 369; (135, 124) → 512, 379; (119, 125) → 465, 374 |
| dry ground | (128, 127) → 491, 364; (119, 127) → 465, 370; (133, 136) → 506, 344 |
| contaminated ground | (139, 129) → 523, 365; (144, 138) → 537, 345; (148, 128) → 550, 368 |
| contaminated beside moist ground | (139, 129) → 523, 365; (148, 128) → 550, 368; (143, 108) → 537, 417 |
| living tree | (127, 127) → 489, 372; (137, 131) → 517, 363; (122, 118) → 474, 392 |
| dead tree | (119, 132) → 466, 360; (115, 148) → 455, 325; (137, 151) → 516, 319 |
| the start | (117, 125) → 459, 374 |
| slope | (126, 117) → 486, 397; (138, 129) → 520, 367; (137, 118) → 518, 394 |
| dam site | (130, 122) → 497, 376; (135, 117) → 512, 397; (117, 117) → 459, 395 |

- The slope at (126, 117) rises toward the north.
- The slope at (138, 129) rises toward the east.
- The slope at (137, 118) rises toward the north.

**start** (close to the start):

- before: [before/riverValley-256-start.jpg](before/riverValley-256-start.jpg)
- after: [after/riverValley-256-start.jpg](after/riverValley-256-start.jpg)
- after, greyscale: [after/riverValley-256-start-grey.jpg](after/riverValley-256-start-grey.jpg); protanopia: [after/riverValley-256-start-protanopia.jpg](after/riverValley-256-start-protanopia.jpg); deuteranopia: [after/riverValley-256-start-deuteranopia.jpg](after/riverValley-256-start-deuteranopia.jpg); tritanopia: [after/riverValley-256-start-tritanopia.jpg](after/riverValley-256-start-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (119, 116) → 647, 538; (121, 116) → 688, 514; (117, 115) → 619, 583 |
| badwater | (141, 130) → 841, 124; (141, 132) → 816, 100; (141, 134) → 792, 78 |
| badwater meets clean water | not in view |
| moist ground | (117, 123) → 515, 402; (119, 125) → 531, 347; (116, 123) → 493, 413 |
| dry ground | (115, 125) → 448, 387; (117, 127) → 467, 332; (115, 127) → 425, 352 |
| contaminated ground | (139, 129) → 835, 120; (139, 131) → 808, 96; (140, 128) → 864, 126 |
| contaminated beside moist ground | (139, 129) → 835, 120; (139, 131) → 808, 96; (140, 128) → 864, 126 |
| living tree | (113, 124) → 416, 427; (114, 121) → 475, 473; (113, 122) → 440, 465 |
| dead tree | (117, 130) → 433, 284; (116, 131) → 404, 291; (117, 132) → 414, 267 |
| the start | (117, 125) → 490, 367 |
| slope | (116, 119) → 544, 502; (126, 117) → 770, 441; (121, 109) → 800, 665 |
| dam site | (117, 117) → 593, 531; (118, 116) → 632, 529; (119, 115) → 661, 558 |

- The slope at (116, 119) rises toward the north.
- The slope at (126, 117) rises toward the north.
- The slope at (121, 109) rises toward the south.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: [before/riverValley-256-badwater.jpg](before/riverValley-256-badwater.jpg)
- after: [after/riverValley-256-badwater.jpg](after/riverValley-256-badwater.jpg)
- after, greyscale: [after/riverValley-256-badwater-grey.jpg](after/riverValley-256-badwater-grey.jpg); protanopia: [after/riverValley-256-badwater-protanopia.jpg](after/riverValley-256-badwater-protanopia.jpg); deuteranopia: [after/riverValley-256-badwater-deuteranopia.jpg](after/riverValley-256-badwater-deuteranopia.jpg); tritanopia: [after/riverValley-256-badwater-tritanopia.jpg](after/riverValley-256-badwater-tritanopia.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | not in view |
| badwater meets clean water | (193, 176) → 490, 367; (192, 175) → 482, 390; (194, 175) → 519, 373 |
| moist ground | (195, 173) → 560, 382; (196, 174) → 567, 358; (194, 172) → 553, 407 |
| dry ground | (198, 171) → 639, 386; (197, 170) → 634, 411; (199, 172) → 644, 362 |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (188, 179) → 366, 352; (187, 177) → 365, 392; (192, 182) → 412, 278 |
| dead tree | (224, 182) → 895, 70; (225, 181) → 920, 74; (227, 181) → 945, 64 |
| the start | not in view |
| slope | not in view |
| dam site | not in view |

**falls** (the tallest waterfall, from downstream):

- before: [before/riverValley-256-falls.jpg](before/riverValley-256-falls.jpg)
- after: [after/riverValley-256-falls.jpg](after/riverValley-256-falls.jpg)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (84, 79) → 490, 367; (84, 78) → 449, 307; (83, 79) → 490, 281 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (86, 77) → 400, 329; (84, 76) → 364, 274; (85, 76) → 360, 301 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (86, 89) → 912, 393; (87, 89) → 925, 424; (86, 90) → 954, 393 |
| dead tree | not in view |
| the start | not in view |
| slope | (81, 83) → 640, 235; (77, 74) → 321, 156 |
| dam site | not in view |

- The slope at (81, 83) rises toward the north.
- The slope at (77, 74) rises toward the south.

### Beavertopia, 256×256 (workshop map, local only)

**overview** (the whole map from the south):

- before: `.scratch/map-look/before/beavertopia-256-overview.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-overview.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-overview-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-overview-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-overview-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-overview-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (118, 130) → 462, 351; (112, 123) → 444, 367; (118, 141) → 463, 326 |
| badwater | (109, 175) → 441, 275; (75, 131) → 339, 363; (75, 142) → 342, 339 |
| badwater meets clean water | (110, 178) → 444, 271; (118, 186) → 465, 256; (106, 191) → 435, 249 |
| moist ground | (128, 127) → 491, 379; (125, 130) → 483, 356; (134, 133) → 509, 357 |
| dry ground | (131, 131) → 500, 365; (102, 139) → 417, 338; (96, 127) → 399, 374 |
| contaminated ground | (94, 99) → 387, 434; (82, 129) → 360, 378; (107, 171) → 434, 272 |
| contaminated beside moist ground | (82, 129) → 360, 378; (107, 171) → 434, 272; (122, 185) → 476, 256 |
| living tree | (127, 127) → 489, 379; (126, 132) → 486, 354; (135, 132) → 511, 368 |
| dead tree | (133, 124) → 506, 388; (142, 129) → 531, 377; (135, 114) → 512, 411 |
| the start | (96, 161) → 403, 292 |
| slope | (131, 160) → 500, 286; (117, 160) → 461, 288; (207, 127) → 721, 371 |
| dam site | not in view |

- The slope at (131, 160) rises toward the east.
- The slope at (117, 160) rises toward the east.
- The slope at (207, 127) rises toward the south.

**start** (close to the start):

- before: `.scratch/map-look/before/beavertopia-256-start.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-start.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-start-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-start-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-start-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-start-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (113, 166) → 755, 97; (113, 168) → 729, 71; (114, 165) → 786, 103 |
| badwater | (109, 175) → 565, 147; (108, 178) → 522, 146; (108, 180) → 505, 125 |
| badwater meets clean water | (110, 178) → 551, 122; (110, 181) → 525, 104; (108, 183) → 480, 95 |
| moist ground | (100, 162) → 559, 311; (99, 164) → 515, 288; (101, 161) → 591, 318 |
| dry ground | (96, 159) → 515, 402; (94, 161) → 448, 387; (98, 161) → 531, 347 |
| contaminated ground | (96, 165) → 444, 300; (94, 165) → 403, 318; (95, 166) → 413, 293 |
| contaminated beside moist ground | (99, 168) → 470, 227; (101, 168) → 508, 211; (100, 172) → 447, 164 |
| living tree | (104, 150) → 811, 487; (107, 153) → 820, 396; (103, 149) → 807, 519 |
| dead tree | (91, 165) → 340, 347; (90, 164) → 329, 375; (89, 160) → 349, 460 |
| the start | (96, 161) → 490, 367 |
| slope | (111, 160) → 788, 243; (113, 160) → 828, 212; (115, 160) → 870, 180 |
| dam site | not in view |

- The slope at (111, 160) rises toward the east.
- The slope at (113, 160) rises toward the east.
- The slope at (115, 160) rises toward the east.

**badwater** (close to the badwater, where it meets clean water if it does):

- before: `.scratch/map-look/before/beavertopia-256-badwater.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-badwater.jpg` (local only)
- after, greyscale: `.scratch/map-look/after/beavertopia-256-badwater-grey.jpg` (local only); protanopia: `.scratch/map-look/after/beavertopia-256-badwater-protanopia.jpg` (local only); deuteranopia: `.scratch/map-look/after/beavertopia-256-badwater-deuteranopia.jpg` (local only); tritanopia: `.scratch/map-look/after/beavertopia-256-badwater-tritanopia.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | not in view |
| badwater | (123, 242) → 929, 134; (124, 245) → 899, 91; (124, 247) → 871, 68 |
| badwater meets clean water | (101, 245) → 490, 367; (100, 244) → 482, 390; (102, 244) → 519, 373 |
| moist ground | (103, 243) → 549, 367; (99, 247) → 432, 342; (102, 242) → 542, 391 |
| dry ground | (98, 248) → 402, 322; (99, 250) → 402, 286; (97, 249) → 371, 303 |
| contaminated ground | (101, 238) → 571, 467; (103, 238) → 609, 447; (104, 238) → 630, 425 |
| contaminated beside moist ground | (101, 238) → 571, 467; (103, 238) → 609, 447 |
| living tree | (95, 246) → 361, 366; (95, 241) → 416, 475; (92, 246) → 294, 381 |
| dead tree | (97, 247) → 393, 346; (97, 250) → 362, 288; (98, 254) → 342, 212 |
| the start | not in view |
| slope | not in view |
| dam site | not in view |

**falls** (the tallest waterfall, from downstream):

- before: `.scratch/map-look/before/beavertopia-256-falls.jpg` (local only)
- after: `.scratch/map-look/after/beavertopia-256-falls.jpg` (local only)

| Meaning | Tile → position in the image |
|---|---|
| clean water | (111, 108) → 363, 573; (112, 107) → 402, 610; (110, 108) → 320, 573 |
| badwater | not in view |
| badwater meets clean water | not in view |
| moist ground | (114, 112) → 490, 364; (113, 112) → 449, 364; (114, 111) → 490, 393 |
| dry ground | not in view |
| contaminated ground | not in view |
| contaminated beside moist ground | not in view |
| living tree | (115, 111) → 532, 393; (114, 110) → 490, 424; (116, 108) → 583, 491 |
| dead tree | (125, 109) → 970, 485 |
| the start | not in view |
| slope | not in view |
| dam site | not in view |
