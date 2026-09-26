# Badwater blends into clean water (D177)

Before (dev) on the left, after (branch `look/badwater-blend`) on the right. Both are the Standard
look on our own generated maps, with the same camera and water time. No Real place has badwater, so
none is shown. Made with `tools/capture-badwater.ts`.

Badwater is #38's crimson, as Kyler approved it: matte and nearly opaque, with darker troughs and
subdued streaks. It is see-through only at its shallow edges, and darker with depth (option A).
Partly bad water takes that crimson hue early and darkens in proportion to how bad it is. All the
water's colours come from one shared palette, `src/render3d/waterPalette.ts`.

| Image | What to look at |
|---|---|
| [tint-riverValley-4242-256-top.jpg](tint-riverValley-4242-256-top.jpg) | The river above the badwater ditches (37% bad), from above. It reads tainted, wine-red, where dev drew blue water with dark blotches. |
| [tint-riverValley-4242-256-angled.jpg](tint-riverValley-4242-256-angled.jpg) | The same river at the default angle. |
| [riverValley-4242-256-top.jpg](riverValley-4242-256-top.jpg) | Where the ditches and the river meet clean water, from above. Each front is a soft gradient over a few tiles. |
| [riverValley-4242-256-angled.jpg](riverValley-4242-256-angled.jpg) | The same meeting at the default angle. The ditches are pure badwater, crimson and matte. |
| [delta-4242-256-top.jpg](delta-4242-256-top.jpg) | A badwater plume in the delta, from above: a smooth gradient, not a speckled band. |
| [delta-4242-256-angled.jpg](delta-4242-256-angled.jpg) | The same plume at the default angle. The deep channel is darker (option A). |
| [riverValley-5-128-top.jpg](riverValley-5-128-top.jpg) | 128² from above: badwater runs into the river and taints it gradually. |
| [riverValley-5-128-angled.jpg](riverValley-5-128-angled.jpg) | 128² at the default angle: the tainted river meets the clean river in a smooth gradient. |
| [delta-5-128-top.jpg](delta-5-128-top.jpg) | 128² from above: a badwater stream meets a clean channel and taints the water below it. |
| [delta-5-128-angled.jpg](delta-5-128-angled.jpg) | 128² at the default angle: the same meeting. |
| [greyscale.jpg](greyscale.jpg) | Every after view in greyscale: badwater and tainted water are darker than clean water, with no speckle. |
| [colour-blindness.jpg](colour-blindness.jpg) | The angled after views with deuteranopia, protanopia and tritanopia. |

## Colour on screen

`npx tsx tools/capture-badwater.ts --measure` measures with the method in `WATER_CALIBRATION`,
which is #38's colour check:
- a 64² bed of water, all one badwater share and depth, over a poisoned bed;
- drawn by the site's renderer on the GPU at 1440 × 940, 70° down, water held at 8 s;
- pixels in a central 240 × 96 patch sorted by r + 2g + b, and each band averaged.

It passes when every target lands within 2 codes.

| Pure badwater, 0.25 deep | #38's target (e63a3ff) | Standard, measured |
|---|---|---|
| Typical (45–55%) | #6E3431 [110, 52, 49] | #6E3431 [110, 52, 49] |
| Troughs (5–15%) | #5E2E2B [94, 46, 43] | #5E2E2B [94, 46, 43] |
| Streaks (96–98.5%) | #7C4538 [124, 69, 56] | #7C4538 [124, 69, 56] |
| Body (15–40%, not a target) | #6B3330 [107, 51, 48], as #38 measured it | #6B332F [107, 51, 47] |

Clean water's targets (Standard's approved look) land exactly too: #40626A, #21434F and #1D3545 at
0.25, 1.25 and 4.25 deep.

Body band by share and depth:

| Depth | Clean | 10% bad | 25% bad | Half bad | Pure badwater |
|---|---|---|---|---|---|
| 0.25 | #40626A (L\* 39.3) | #555A61 (37.9) | #655053 (36.1) | #6F4342 (33.4) | #6B332F (28.6) |
| 0.8 | #254954 (28.8) | #394048 (26.8) | #45373B (24.6) | #492B2C (21.4) | #3E1E1C (15.6) |
| 1.25 | #21434F (26.3) | #333A43 (24.0) | #3D3036 (21.5) | #3F2526 (18.0) | #301716 (11.1) |
| 4.25 | #1D3545 (21.0) | #292E3A (18.8) | #30262E (16.5) | #311D1E (13.2) | #231110 (7.2) |

- **Greyscale:** at every depth, water gets darker as more of it is bad.
- **Colour blindness:** tainted water and badwater are dark olive-brown against blue water with
  deuteranopia and protanopia. With tritanopia they are red against teal.
- **Clean water is unchanged:** a clean-water map draws the same pixels as dev in three views.
