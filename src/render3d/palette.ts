// The 3D view's colours (ROADMAP "Map look", PLAN §20 D86, D110), in one place: the shaders read
// them and the legend shows the same swatches, so the legend always says what the scene shows. The
// ground is coloured by soil, as in the game (Kyler's reference screenshots): moist ground a vivid
// yellow-green grass (living plants grow), dry ground cracked earth, warm grey-brown, contaminated
// ground rusty red-brown with glowing cracks, and ground under water a dark wet bed; a toggle
// switches the ground back to height colours. Walls are dark stone, a band per level. Colours are
// display values (the renderer outputs them without conversion).
//
// Pure TypeScript, no three.js: the unit tests and the page's legend read it too.

export type Rgb = readonly [number, number, number];

/** What colours the tops of the ground. */
export type GroundMode = "moisture" | "height";

/** A tile's ground, as its colour shows it. */
export type GroundKind = "moist" | "dry" | "contaminated" | "underwater";

export const GROUND = {
  /** Dry ground: cracked earth, warm grey-brown, with dark cracks; plants die there. */
  dry: [0.54, 0.45, 0.35] as Rgb,
  /** Dry ground's cooler, greyer patches. */
  dryCool: [0.46, 0.44, 0.41] as Rgb,
  /** The cracks in dry ground. */
  crack: [0.25, 0.2, 0.2] as Rgb,
  /** Moist ground at the edge of the moist area (the least moisture). */
  moistLow: [0.64, 0.72, 0.24] as Rgb,
  /** Moist ground by the water (the most moisture). */
  moistHigh: [0.46, 0.62, 0.17] as Rgb,
  /** Contaminated ground: badwater spoils the soil and plants die. Rusty cracked earth... */
  contaminated: [0.42, 0.19, 0.12] as Rgb,
  /** ...its cracks glowing. */
  contaminatedGlow: [0.98, 0.52, 0.18] as Rgb,
  /** Ground under water (seen through it). */
  underwater: [0.34, 0.32, 0.28] as Rgb,
} as const;

/** Height colours (the toggle): the low and high ends of the ramp, as before Map look. */
export const HEIGHT_RAMP = { low: [0.478, 0.588, 0.329] as Rgb, high: [0.769, 0.698, 0.549] as Rgb } as const;

/** The block walls: dark charcoal-green stone, cobbles with mortar between them; every other level
 *  a shade darker and a groove between levels, so levels can be counted; a little lighter higher up. */
export const WALL = { stone: [0.25, 0.29, 0.25] as Rgb, mortar: [0.11, 0.13, 0.11] as Rgb, alternate: 0.84, low: 0.9, high: 1.15 } as const;

export const WATER = {
  /** Clean water: teal where shallow (and see-through), navy where deep. */
  shallow: [0.16, 0.42, 0.46] as Rgb,
  deep: [0.05, 0.16, 0.3] as Rgb,
  foam: [0.9, 0.95, 0.95] as Rgb,
  /** The sky the water reflects. */
  sky: [0.55, 0.68, 0.78] as Rgb,
  /** Badwater: murky red-brown, with slow glowing veins. */
  bad: [0.28, 0.11, 0.08] as Rgb,
  badDeep: [0.17, 0.06, 0.05] as Rgb,
  badVein: [0.92, 0.4, 0.15] as Rgb,
  badFoam: [0.6, 0.4, 0.28] as Rgb,
} as const;

/** Dead trees: bare, pale wood (no crown), so they read as dead in any colours. */
export const DEAD_TREE: Rgb = [0.8, 0.72, 0.58];

/** The light: a warm sun from the north-west, a cool sky (violet in the shadows of the earth),
 *  and a blue-grey haze over distant ground. */
export const LIGHT = {
  /** Toward the sun: west and north (x east, y north), 50° above the horizon. */
  sunAzimuth: [-Math.SQRT1_2, Math.SQRT1_2] as const,
  sunElevation: (50 * Math.PI) / 180,
  /** The sun's disc and the sky's scatter soften shadows: two sweeps, this far either side. */
  penumbra: (6 * Math.PI) / 180,
  sun: [1.0, 0.92, 0.78] as Rgb,
  sky: [0.6, 0.61, 0.73] as Rgb,
  haze: [0.63, 0.7, 0.78] as Rgb,
} as const;

/** Soil moisture (the game's levels, 0–16) and contamination (0–1) as bytes: 0 stays 0, and any
 *  moisture or contamination at all stays above 0 (moist soil is where living plants grow). */
export function moistureByte(m: number): number {
  if (!(m > 0)) return 0;
  return Math.min(255, Math.max(1, Math.round(m * 15)));
}

export function contaminationByte(c: number): number {
  if (!(c > 0)) return 0;
  return Math.min(255, Math.max(1, Math.round(c * 255)));
}

/** A tile's ground kind from its soil bytes: under water first, then contaminated (plants die
 *  even on moist soil), then moist or dry. The shader follows the same order. */
export function groundKind(moisture: number, contamination: number, underwater: boolean): GroundKind {
  if (underwater) return "underwater";
  if (contamination > 0) return "contaminated";
  return moisture > 0 ? "moist" : "dry";
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The ground's base colour (before light and texture) for soil bytes, in moisture mode; the
 *  shader's `groundColor` does the same per pixel. */
export function groundColor(moisture: number, contamination: number, underwater: boolean): Rgb {
  switch (groundKind(moisture, contamination, underwater)) {
    case "underwater":
      return GROUND.underwater;
    case "contaminated":
      return GROUND.contaminated;
    case "moist":
      // the game's moisture levels: 1 at the moist area's edge, 10 and up by the water
      return mixRgb(GROUND.moistLow, GROUND.moistHigh, Math.max(0, Math.min(1, (Math.round(moisture / 15) - 1) / 9)));
    default:
      return GROUND.dry;
  }
}

/** The wall colour of a level (0 = the lowest the map can have, 22 the highest): the stone,
 *  a little lighter higher up, every other level darker. */
export function wallColor(level: number): Rgb {
  const t = Math.max(0, Math.min(1, level / 16));
  const k = (WALL.low + (WALL.high - WALL.low) * t) * (level % 2 ? WALL.alternate : 1);
  return [WALL.stone[0] * k, WALL.stone[1] * k, WALL.stone[2] * k];
}

export function cssColor(c: Rgb): string {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export interface LegendEntry {
  /** CSS background for the swatch (a colour or a gradient). */
  swatch: string;
  label: string;
}

/** What the 3D view's colours mean, for its legend. */
export function legendEntries(mode: GroundMode): LegendEntry[] {
  const cracks = (base: Rgb, line: Rgb) => `repeating-linear-gradient(60deg, ${cssColor(base)} 0 5px, ${cssColor(line)} 5px 6px, ${cssColor(base)} 6px 11px)`;
  const ground: LegendEntry[] =
    mode === "moisture"
      ? [
          { swatch: `linear-gradient(90deg, ${cssColor(GROUND.moistLow)}, ${cssColor(GROUND.moistHigh)})`, label: "Moist ground: plants grow" },
          { swatch: cracks(GROUND.dry, GROUND.crack), label: "Dry ground: plants die" },
          { swatch: cracks(GROUND.contaminated, GROUND.contaminatedGlow), label: "Contaminated ground: plants die" },
        ]
      : [{ swatch: `linear-gradient(90deg, ${cssColor(HEIGHT_RAMP.low)}, ${cssColor(HEIGHT_RAMP.high)})`, label: "Ground by height: low to high" }];
  const bands = [0, 1, 2, 3].map((k) => `${cssColor(wallColor(4 + k))} ${k * 25}% ${(k + 1) * 25}%`).join(", ");
  return [
    ...ground,
    { swatch: `linear-gradient(90deg, ${cssColor(WATER.shallow)}, ${cssColor(WATER.deep)})`, label: "Water: darker is deeper" },
    { swatch: `repeating-linear-gradient(120deg, ${cssColor(WATER.bad)} 0 5px, ${cssColor(WATER.badVein)} 5px 6px, ${cssColor(WATER.bad)} 6px 11px)`, label: "Badwater" },
    { swatch: `linear-gradient(180deg, ${bands})`, label: "Walls: one band per level" },
    { swatch: cssColor(DEAD_TREE), label: "Bare pale trees: dead" },
  ];
}
