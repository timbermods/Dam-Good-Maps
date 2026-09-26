# Badwater blends into clean water (D177)

Before (dev) on the left, after (branch `look/badwater-blend`) on the right. Both are the Standard
look on our own generated maps, with the same camera and water time. No Real place has badwater, so
none is shown. Made with `tools/capture-badwater.ts`.

**Status (second round, after Kyler's review of #41):** the water now has one shared palette
(`src/render3d/waterPalette.ts`), and partly bad water takes a warm red tint early. Badwater's own
colours and opacity are placeholders until Kyler approves #38's badwater. Then they come from #38's
calibration, and every capture below is made again.

## The tint (second round)

| Image | What to look at |
|---|---|
| [tint-riverValley-4242-256-top.jpg](tint-riverValley-4242-256-top.jpg) | From above: the river above the badwater ditches (about 40% bad) now reads red, clearly tainted. Before, it looked like deep clean water. |
| [tint-riverValley-4242-256-angled.jpg](tint-riverValley-4242-256-angled.jpg) | Default angle: the same river. The ditches (pure badwater) are still the muddy placeholder until #38's colours arrive. |

## First round

| Image | What to look at |
|---|---|
| [riverValley-4242-256-top.jpg](riverValley-4242-256-top.jpg) | From above: the river mixed with badwater is one smooth tone, where dev had dark red blotches. |
| [riverValley-4242-256-angled.jpg](riverValley-4242-256-angled.jpg) | Default angle: the badwater channels on both sides fade into the river over a few tiles. |
| [delta-4242-256-top.jpg](delta-4242-256-top.jpg) | From above: the badwater plume in the delta is a soft gradient, not a speckled band. |
| [delta-4242-256-angled.jpg](delta-4242-256-angled.jpg) | Default angle: the same front. |
| [riverValley-5-128-top.jpg](riverValley-5-128-top.jpg) | 128² from above: the channel's badwater runs into the river and turns it murky gradually. |
| [riverValley-5-128-angled.jpg](riverValley-5-128-angled.jpg) | 128² default angle: the murky river meets the clean river in a smooth gradient. |
| [delta-5-128-top.jpg](delta-5-128-top.jpg) | 128² from above: a badwater stream meets a clean channel, and the water below it turns murky without speckle. |
| [delta-5-128-angled.jpg](delta-5-128-angled.jpg) | 128² default angle: the same meeting. |
| [greyscale.jpg](greyscale.jpg) | Every after view in greyscale: badwater and mixed water read darker than clean water, with no speckle. |
| [colour-blindness.jpg](colour-blindness.jpg) | The angled after views with deuteranopia, protanopia and tritanopia. |
| [deep-badwater-options.jpg](deep-badwater-options.jpg) | Deep badwater, A and B. Kyler chose A: darker with depth. |

## Colour on screen

`npx tsx tools/capture-badwater.ts --measure` measures the water with the method in
`WATER_CALIBRATION` (`src/render3d/waterPalette.ts`), the same method as #38's colour check. A 64²
bed of water, all one badwater share and depth, is drawn by the site's renderer on the GPU at
1440 × 940. The camera looks 70° down, with the water held at 8 s. Pixels in a central 240 × 96
patch are sorted by r + 2g + b, and each band is averaged. The body band is 15–40%. Second-round
body colours:

| Depth | Clean (unchanged) | 10% bad | 25% bad | Half bad | Pure badwater (placeholder) |
|---|---|---|---|---|---|
| 0.25 | #40626A (L\* 39.3) | #5A5961 (38.2) | #6D4D53 (36.4) | #793D3E (33.4) | **#4B3C38 (26.8)** |
| 0.8 | #254954 (28.8) | #3E4049 (27.3) | #4E363B (25.3) | #55282A (22.4) | #332724 (17.0) |
| 1.25 | #21434F (26.3) | #383A44 (24.5) | #453036 (22.4) | #4B2325 (19.3) | #281F1C (12.7) |
| 4.25 | #1D3545 (21.0) | #2C2D3B (19.0) | #36252E (16.9) | #371A1D (13.5) | #1C1412 (7.1) |

- **Clean water is unchanged:** a clean-water map draws the same pixels as dev in three views. The
  palette's clean targets hold it exactly.
- **Greyscale:** at every depth, water gets darker as more of it is bad. Its luminance falls in
  proportion to the share.
- **The tint:** the hue turns warm red early, over half way at a quarter bad, separately from the
  darkening.
- **Placeholder:** pure badwater a quarter level deep is #4B3C38, one code from Kyler's in-game
  #4B3C37. #38's approved colours replace it.
