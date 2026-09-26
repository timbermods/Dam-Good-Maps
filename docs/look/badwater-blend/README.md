# Badwater blends into clean water (D177)

Before (dev) on the left, after (branch `look/badwater-blend`) on the right; the Standard look, our
own generated maps, the same camera and water time in each. No Real place has badwater, so none is
shown. Made with `tools/capture-badwater.ts`.

| Image | What to look at |
|---|---|
| [riverValley-4242-256-top.jpg](riverValley-4242-256-top.jpg) | From above: the river mixed with badwater is one smooth, murkier tone, where dev had dark red blotches. |
| [riverValley-4242-256-angled.jpg](riverValley-4242-256-angled.jpg) | Default angle: the badwater channels on both sides are the game's murky red-brown and fade into the river over a few tiles. |
| [delta-4242-256-top.jpg](delta-4242-256-top.jpg) | From above: the badwater plume in the delta is a soft gradient, not a speckled band. |
| [delta-4242-256-angled.jpg](delta-4242-256-angled.jpg) | Default angle: the same front; the deep badwater channel is still very dark (see the decision below). |
| [riverValley-5-128-top.jpg](riverValley-5-128-top.jpg) | 128² from above: the channel's badwater runs into the river and turns it murky gradually. |
| [riverValley-5-128-angled.jpg](riverValley-5-128-angled.jpg) | 128² default angle: the murky river meets the clean river in a smooth gradient. |
| [delta-5-128-top.jpg](delta-5-128-top.jpg) | 128² from above: a badwater stream meets a clean channel, and the water below it turns murky without speckle. |
| [delta-5-128-angled.jpg](delta-5-128-angled.jpg) | 128² default angle: the same meeting. |
| [greyscale.jpg](greyscale.jpg) | Every after view in greyscale: badwater and mixed water read darker and duller than clean water, with no speckle. |
| [colour-blindness.jpg](colour-blindness.jpg) | The angled after views with deuteranopia, protanopia and tritanopia: brown or maroon badwater against blue or teal water in all three. |
| [deep-badwater-options.jpg](deep-badwater-options.jpg) | Deep badwater, as built (A) and with a flatter depth ramp (B): the one decision below. |

## Colour on screen

Measured as #38's colour check does: a 64² bed of water with one badwater share and depth all over,
drawn by the site's renderer on the GPU, 70° down at water time 8 s. Each value is the mean of the
15–40% luminance band (the water's body) of a central 240 × 96 patch of the final frame
(`npx tsx tools/capture-badwater.ts --measure`).

| Depth | Clean (unchanged) | A quarter bad | Half bad | Pure badwater |
|---|---|---|---|---|
| 0.25 | #40626A (L\* 39.3) | #42585D (35.8) | #454F51 (32.8) | **#4B3C38 (26.8)** |
| 0.5 | #2E525C (32.5) | #32484E (28.9) | #364042 (26.2) | #3E312D (21.6) |
| 1.25 | #21424E (26.2) | #23373E (21.7) | #242E32 (18.3) | #281F1C (12.7) |
| 4.25 | #1D3545 (20.9) | #1C2A35 (16.4) | #1C2229 (12.9) | #1C1412 (7.1) |

- **Calibration:** pure badwater a quarter level deep lands on #4B3C38, one code value from the
  game's #4B3C37. That is the usual depth of badwater on our maps (median 0.27, 90% under 0.45).
- **Clean water is unchanged:** a map with clean water only draws the same pixels as dev, every
  channel of three views.
- **Greyscale:** at any depth, water gets darker as more of it is bad, and pure badwater is at least
  10 L\* darker than clean water of the same depth. Up close it is also duller: no light ripple
  crests, a fifth of the glints, and slow orange bubbles that grow denser with the share.
- **Colour blindness:** badwater stays brown or maroon and clean water blue or teal in all three
  simulations.

## Kyler's decision: how dark deep badwater gets

Deeper badwater darkens, to stay at least 6 L\* darker than clean water of the same depth in the
palette. That is your clean-look rule, and the test for it is unchanged. So pure badwater two
levels deep is nearly black on screen (#201816, L\* 9); see A in `deep-badwater-options.jpg`.

Option B keeps deep badwater nearer #4B3C37: #382B27 at 1.25 deep, #2E221E at 4.25. On screen it
is still at least 6.5 L\* darker than clean water of the same depth, but the palette's colours
before the light no longer are, so that test would change. Say which you prefer; B is two
constants and that test.
