# The clean look

Kyler's decision after Map look's third round (2026-09-25): the 3D view opens clean, as close to the
game as our own shaders and models can draw it, and everything that exists only to inform moves to
an information layer, off by default. The core meanings must still read in the clean view, in
colour, in greyscale and with colour blindness. This note says what changed, where to look for
each core meaning in the captures, and where readability needed a compromise. The captures are
listed in [clean/captures.md](clean/captures.md).

## What changed

**The clean view** (the default):

- Dry ground is cracked earth in the reference's grey-brown: broad patches, a few tiles to a dozen
  across, drift between a cooler grey, the base grey-brown and a warmer brown, and in lightness, so
  the ground varies from afar. The cracks are finer, and fainter from afar.
- Grass varies within and between patches (lighter and deeper patches, darker blotches) and bleeds
  onto the earth in ragged edges.
- Light reads from afar: shadows keep about three fifths of the light (they kept four fifths), the
  corners at the foot of walls are darker, and objects keep their pale sides pale.
- Walls are dark cobbled stone, every other level a shade darker, without the pale line at each
  level.
- A sky surrounds the map: blue overhead, paler at the horizon, soft clouds above and below. The
  map's sides go down below its lowest ground, so it is a block of land floating in the sky, as in
  the game. (The light look for software rendering clears to the sky's colour and draws no clouds.)
- Dead trees are bare trunks at their true size: a dead pine a tall pale pole with its top broken
  off, a dead birch a white fork, a dead oak a thick stump with pale broken limbs.
- Ruins are open scaffold towers again: weathered posts, rusty rails and braces, grey-brown decks,
  beige crates and sheets, ivy where the ground is moist.
- Slopes are stone ramps, without arrows.
- Geothermal fields (dark rock with glowing vents), relics (broken stone columns on a plinth),
  thorns (dark brambles) and blockages and natural dams (heaps of stones) are world objects; they
  were boxes.
- Nothing grows from afar, and dam sites are not drawn.

**The information layer** (**Markers**, off by default): dam sites (hatched light and dark), slope
arrows, a pale line at every wall level, and dead trees, slope arrows and the start drawn larger
from afar. The **Markers** button beside **Height colours** turns it on; the choice is remembered.
In the editor, the **Dam site** tool shows the dam sites with the markers while it is out, and puts
them away after; the **Slope** tool turns the markers on while it is out; **Show dam sites** turns
them on too. The legend lists the clean view's meanings, then the lines that show "With **Markers**
on". The generator's 3D preview draws its best dam site only with **Markers** on.

What did not change: generation, validation, the file format, the existing tests and `shade.ts`.

## Where to look for each core meaning

Positions are in pixels from the top-left corner of the capture (in `docs/map-look/clean/`); they
hold for its greyscale and colour-blind versions. Greyscale lightness (L\*) is the median over every
listed example in the clean captures of our maps.

| Meaning | Capture and position | What shows it | Greyscale L\* |
|---|---|---|---|
| Clean water | riverValley-128-start, 666, 441 | blue-teal, sparkles, a pale edge where it meets a wall | 56 |
| Badwater | riverValley-256-meets, 415, 370; riverValley-128-badwater, 480, 348 | near black-brown with dark streaks | 14 |
| Badwater meeting clean water | riverValley-256-meets, 482, 341 and 765, 353 | dark brown streaks and blotches drifting into the blue | between the two |
| Moist ground | riverValley-128-badwater, 515, 546 | yellow-green grass | 62 |
| Dry ground | riverValley-128-badwater, 634, 411 | grey-brown cracked earth | 40 |
| Contaminated ground | riverValley-128-badwater, 474, 403 | rust-red cracked earth with glowing cracks | 30 |
| Living trees | riverValley-128-start, 382, 288 (oak) and 512, 247 (pine) | dark green crowns with shadows | dark |
| Dead trees | riverValley-128-badwater, 393, 309 (pines); riverValley-128-start, 197, 184 (oaks) | pale bare trunks and stumps, far lighter than living crowns | pale |
| The start | riverValley-128-start, 490, 355; riverValley-128-overview, 379, 409 | the lodge: red roof, pale walls and deck, yellow banner | light and dark together |

From light to dark in greyscale: dead trees, moist ground, clean water, dry ground, contaminated
ground, badwater; living trees are dark. With protanopia and deuteranopia grass turns yellow,
contaminated ground dark olive and dry ground grey; with tritanopia grass turns a pale grey-green,
dry ground a greyish mauve and contaminated ground red. The markers captures (`*-markers.jpg`) show the information layer: dam
sites at riverValley-128-overview-markers 505, 408, slope arrows and the enlarged start and dead
trees.

## Where readability needed a compromise

- **Water is lighter than in the game.** The game's deep water is darker than dry ground; ours
  stays lighter (L\* 56 against 40), because in greyscale water as dark as the ground would read as
  ground. Clean and badwater still differ by about 40 L\*.
- **Grass is lighter than in the game.** The game's grass and dry ground are about as light as each
  other; ours differ by about 20 L\*, so moist and dry ground read in greyscale and with colour
  blindness.
- **Contaminated ground is a brighter rust-red than the game's**, and a step darker than dry
  ground, so it reads apart from dry ground and ruins in greyscale and with colour blindness.
- **Dead trees at their true size are specks in a view of the whole map.** They read as pale
  poles and stumps from the game's usual distance; from afar only **Markers** draws them larger.
  The same holds for the start on a 256 map: a small red and pale spot in the overview.
- **The sun stays in the north-west.** In the game the camera faces the lit side of things and
  shadows fall away from it; our baked shadows fall south-east (a tested direction), so objects
  face the camera with their shaded side. Objects keep more sky light, so pale trunks stay pale.
- **Dam sites need Markers.** The clean view has no hazard stripes; the **Dam site** tool and
  **Show dam sites** turn the markers on, and the preview's best dam site shows with **Markers**.

## Comparing with the game

A local page, never committed, shows each of Kyler's reference screenshots beside the clean view
of a comparable scene of our maps, the same scene in the third round's look, and a place for the
DGM Probe's in-game shot of our map: `C:\dgm-workshop\look\compare.html`. It links the screenshots
where they are (`C:\dgm-reference\`) and copies none.
