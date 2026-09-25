// The 3D view's colours (ROADMAP "Map look", PLAN §20 D86, D110, D114), in one place: the shaders
// and models read them and the legend shows the same swatches, so the legend always says what the
// scene shows. The ground is coloured by soil, as in the game (Kyler's reference screenshots):
// moist ground a vivid yellow-green grass (living plants grow), dry ground cracked earth, warm
// grey-brown, contaminated ground rusty red-brown with glowing cracks, and ground under water a
// dark wet bed; a toggle switches the ground back to height colours. Walls are stone, a band per
// level with a pale ledge between levels. Colours are display values (the renderer outputs them
// without conversion).
//
// Every meaning differs in lightness too, so it reads in greyscale and with any colour blindness
// (the review's fix round, D114): from light to dark, dead trees, moist ground, clean water, the
// walls, dry ground, contaminated ground, badwater. Living trees are dark, dead trees nearly white.
// Dam sites are hatched light and dark with a dark rim, so they show on any ground or water.
//
// Pure TypeScript, no three.js: the unit tests and the page's legend read it too.

export type Rgb = readonly [number, number, number];

/** What colours the tops of the ground. */
export type GroundMode = "moisture" | "height";

/** A tile's ground, as its colour shows it. */
export type GroundKind = "moist" | "dry" | "contaminated" | "underwater";

export const GROUND = {
  /** Dry ground: cracked earth, warm grey-brown, with dark cracks; plants die there. */
  dry: [0.48, 0.38, 0.29] as Rgb,
  /** Dry ground's cooler, greyer patches. */
  dryCool: [0.43, 0.38, 0.33] as Rgb,
  /** The cracks in dry ground. */
  crack: [0.2, 0.16, 0.16] as Rgb,
  /** Moist ground at the edge of the moist area (the least moisture). */
  moistLow: [0.7, 0.78, 0.3] as Rgb,
  /** Moist ground by the water (the most moisture). */
  moistHigh: [0.56, 0.71, 0.22] as Rgb,
  /** Contaminated ground: badwater spoils the soil and plants die. Rusty cracked earth... */
  contaminated: [0.39, 0.15, 0.09] as Rgb,
  /** ...its cracks glowing. */
  contaminatedGlow: [0.98, 0.56, 0.2] as Rgb,
  /** Ground under water (seen through it). */
  underwater: [0.44, 0.45, 0.38] as Rgb,
} as const;

/** Height colours (the toggle): the low and high ends of the ramp, as before Map look. */
export const HEIGHT_RAMP = { low: [0.478, 0.588, 0.329] as Rgb, high: [0.769, 0.698, 0.549] as Rgb } as const;

/** The block walls: grey-green stone in faint cobbles, every other level a shade darker, with a
 *  pale ledge and a dark groove between levels so levels can be counted; a little lighter higher
 *  up. Lighter than Kyler's reference (dark charcoal) so the bands read (D114). */
export const WALL = {
  stone: [0.42, 0.41, 0.35] as Rgb,
  mortar: [0.2, 0.2, 0.17] as Rgb,
  ledge: [0.84, 0.81, 0.7] as Rgb,
  groove: [0.1, 0.1, 0.09] as Rgb,
  alternate: 0.74,
  low: 0.92,
  high: 1.12,
} as const;

export const WATER = {
  /** Clean water: light teal where shallow (and see-through), blue where deep; lighter than dry
   *  ground at any depth, darker than moist ground. */
  shallow: [0.42, 0.7, 0.74] as Rgb,
  deep: [0.28, 0.52, 0.66] as Rgb,
  foam: [0.93, 0.97, 0.97] as Rgb,
  /** The sky the water reflects. */
  sky: [0.62, 0.74, 0.84] as Rgb,
  /** Badwater: much darker than clean water at any depth, a murky red-black liquid with slow
   *  glowing bubbles. Water mixed with badwater is murkier than clean water all over, and
   *  streaked with badwater as densely as it is bad. */
  bad: [0.16, 0.06, 0.05] as Rgb,
  badDeep: [0.1, 0.035, 0.03] as Rgb,
  badVein: [0.98, 0.5, 0.16] as Rgb,
  badFoam: [0.66, 0.5, 0.36] as Rgb,
} as const;

/** Dead trees: bare, nearly white wood (no crown), so they read as dead in any colours. */
export const DEAD_TREE: Rgb = [0.95, 0.94, 0.9];

/** Living trees' crowns (the legend; each species has its own shade in the models). */
export const LIVING_TREE: Rgb = [0.15, 0.36, 0.2];

/** A hatched overlay (dam sites): light stripes in the overlay's colour, dark stripes, and a
 *  dark rim round the hatched tiles. */
export const HATCH = { dark: [0.06, 0.05, 0.04] as Rgb } as const;

/** Dam sites on the map (the overlay colour; alpha 255 draws it hatched). */
export const DAM_SITE: Rgb = [1.0, 0.9, 0.3];

/** The overlay bytes for a dam site (RGBA; the editor's dam-site layer and the preview's best dam
 *  site). */
export const DAM_OVERLAY: readonly [number, number, number, number] = [255, 230, 77, 255];

/** The start: a timber lodge with pale walls, a dark roof and a yellow banner on a pale deck. */
export const START = {
  walls: [0.86, 0.78, 0.62] as Rgb,
  roof: [0.42, 0.13, 0.09] as Rgb,
  deck: [0.74, 0.62, 0.44] as Rgb,
  banner: [1.0, 0.82, 0.16] as Rgb,
} as const;

/** Ruins: towers of weathered grey-brown metal with rusty posts and beige panels, one storey per
 *  level (grey-brown, so they stand apart from rusty contaminated ground). */
export const RUIN = { body: [0.46, 0.41, 0.35] as Rgb, rust: [0.42, 0.19, 0.09] as Rgb, panel: [0.84, 0.77, 0.6] as Rgb } as const;

/** Slopes: a ramp with pale arrows, rimmed dark, pointing uphill. */
export const SLOPE = { ramp: [0.62, 0.52, 0.38] as Rgb, side: [0.46, 0.37, 0.26] as Rgb, arrow: [0.97, 0.93, 0.78] as Rgb, rim: [0.14, 0.1, 0.07] as Rgb } as const;

/** Geothermal fields: orange blocks (their footprint's blocks, as every template without a model
 *  of its own). */
export const GEOTHERMAL: Rgb = [0.82, 0.48, 0.16];

/** Mine sites: a dark pit in an orange frame. */
export const MINE = { pit: [0.06, 0.06, 0.06] as Rgb, frame: [0.88, 0.45, 0.14] as Rgb } as const;

/** The light: a warm sun from the north-west, a cool sky (violet in the shadows of the earth),
 *  and a blue-grey haze over distant ground. */
export const LIGHT = {
  /** Toward the sun: west and north (x east, y north), 50° above the horizon. */
  sunAzimuth: [-Math.SQRT1_2, Math.SQRT1_2] as const,
  sunElevation: (50 * Math.PI) / 180,
  /** The sun's disc and the sky's scatter soften shadows: two sweeps, this far either side. */
  penumbra: (6 * Math.PI) / 180,
  sun: [1.0, 0.92, 0.78] as Rgb,
  sky: [0.63, 0.63, 0.7] as Rgb,
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
  /** CSS background for the swatch (a colour, a gradient or a small picture). */
  swatch: string;
  label: string;
}

/** A small picture (24 × 16) as a CSS background. */
function icon(body: string, ground = "#00000000"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16"><rect width="24" height="16" fill="${ground}"/>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
}

/** What the 3D view's colours mean for the ground, the water and the walls, for its legend. */
export function legendEntries(mode: GroundMode): LegendEntry[] {
  const c = cssColor;
  const cracks = (base: Rgb, line: Rgb, w = 1.5) => `repeating-linear-gradient(60deg, ${c(base)} 0 4px, ${c(line)} 4px ${4 + w}px, ${c(base)} ${4 + w}px 10px)`;
  const ground: LegendEntry[] =
    mode === "moisture"
      ? [
          { swatch: `linear-gradient(90deg, ${c(GROUND.moistLow)}, ${c(GROUND.moistHigh)})`, label: "Moist ground: plants grow" },
          { swatch: cracks(GROUND.dry, GROUND.crack), label: "Dry ground: plants die" },
          { swatch: cracks(GROUND.contaminated, GROUND.contaminatedGlow, 1), label: "Contaminated ground: plants die" },
        ]
      : [{ swatch: `linear-gradient(90deg, ${c(HEIGHT_RAMP.low)}, ${c(HEIGHT_RAMP.high)})`, label: "Ground by height: low to high" }];
  // walls: two levels, each with its pale ledge at the top and a dark groove below it
  const walls = icon(
    `<rect width="24" height="8" fill="${c(wallColor(11))}"/><rect y="8" width="24" height="8" fill="${c(wallColor(10))}"/>` +
      `<rect y="0" width="24" height="2" fill="${c(WALL.ledge)}"/><rect y="6" width="24" height="2" fill="${c(WALL.ledge)}"/><rect y="8" width="24" height="0.8" fill="${c(WALL.groove)}"/>`,
  );
  return [
    ...ground,
    { swatch: `linear-gradient(90deg, ${c(WATER.foam)} 0 2px, ${c(mixRgb(WATER.shallow, WATER.foam, 0.35))} 2px, ${c(WATER.shallow)})`, label: "Water: darker is deeper" },
    { swatch: icon(`<path d="M0 7 Q6 4 12 7 T24 7" stroke="${c([0.55, 0.4, 0.38])}" stroke-width="1.2" fill="none"/><circle cx="17" cy="11" r="1.3" fill="${c(WATER.badVein)}"/>`, c(WATER.bad)), label: "Badwater" },
    { swatch: walls, label: "Walls: one band per level" },
    { swatch: cssColor(DEAD_TREE), label: "Bare pale trees: dead" },
  ];
}

/** The legend's lines for water mixed with badwater and for what stands on the map: trees, the
 *  start, slopes, ruins and the other objects, each as its model looks from above. */
export function objectLegend(): LegendEntry[] {
  const c = cssColor;
  const grass = c(GROUND.moistLow);
  const dry = c(GROUND.dry);
  return [
    {
      swatch: icon(`<path d="M0 5 Q7 2 12 6 T24 5 V9 Q16 12 10 9 T0 10Z" fill="${c(WATER.bad)}"/><path d="M0 12 Q8 10 14 13 T24 12 V14 Q15 16 9 14 T0 15Z" fill="${c(WATER.bad)}"/>`, c(WATER.shallow)),
      label: "Water mixed with badwater: murkier, with dark streaks",
    },
    {
      swatch: icon(`<circle cx="7" cy="8" r="5" fill="${c(LIVING_TREE)}"/><path d="M16 2 L21 14 H11Z" fill="${c([0.11, 0.28, 0.17])}"/>`, grass),
      label: "Living trees and bushes",
    },
    {
      swatch: icon(
        `<rect x="3" y="3" width="18" height="12" fill="${c(START.deck)}"/><rect x="6" y="5" width="12" height="8" fill="${c(START.walls)}"/><path d="M5 8 L12 4 L19 8 L19 11 L5 11Z" fill="${c(START.roof)}"/>` +
          `<rect x="3" y="0" width="1" height="9" fill="#3a2a1c"/><rect x="4" y="0.5" width="6" height="3.5" fill="${c(START.banner)}" stroke="#000" stroke-width="0.5"/>`,
        dry,
      ),
      label: "The start: district center",
    },
    {
      swatch: icon(`<rect x="4" y="1" width="16" height="14" fill="${c(SLOPE.ramp)}"/><path d="M12 2 L18 8 L14.2 8 L14.2 14 L9.8 14 L9.8 8 L6 8Z" fill="${c(SLOPE.arrow)}" stroke="${c(SLOPE.rim)}" stroke-width="1.2"/>`, dry),
      label: "Slopes: arrows point uphill",
    },
    {
      swatch: icon(`<rect x="7" y="1" width="10" height="14" fill="${c(RUIN.body)}" stroke="${c(RUIN.rust)}" stroke-width="1.2"/><rect x="8.5" y="3" width="7" height="4" fill="${c(RUIN.panel)}"/><rect x="8.5" y="9" width="7" height="4" fill="${c(RUIN.panel)}"/>`, c(GROUND.contaminated)),
      label: "Ruins: metal towers, a storey per level",
    },
    { swatch: icon(`<rect x="4" y="1" width="16" height="14" fill="${c(MINE.frame)}"/><rect x="6.5" y="3.5" width="11" height="9" fill="${c(MINE.pit)}"/>`, dry), label: "Mine site" },
    {
      swatch: icon(`<circle cx="12" cy="8" r="6" fill="#77746d"/><circle cx="12" cy="8" r="4.2" fill="${c([0.32, 0.62, 0.95])}"/>`, dry) + `, ${dry}`,
      label: "Water source",
    },
    {
      swatch: icon(`<circle cx="12" cy="8" r="7" fill="#33261f"/><path d="M12 8 m-4 0 a4 4 0 1 1 4 4" stroke="${c([0.5, 0.3, 0.18])}" stroke-width="1.6" fill="none"/>`, dry),
      label: "Badwater source",
    },
    {
      swatch: icon([2, 9, 16].flatMap((x) => [2, 9].map((y) => `<rect x="${x}" y="${y}" width="6" height="5" fill="${c(GEOTHERMAL)}"/>`)).join(""), dry),
      label: "Geothermal field",
    },
    {
      swatch: icon(`<rect x="2" y="4" width="6" height="8" fill="#c9a64a"/><rect x="9" y="4" width="6" height="8" fill="#7a2e2e"/><rect x="16" y="4" width="6" height="8" fill="#858380"/>`, dry),
      label: "Relics, thorns and other objects: blocks",
    },
  ];
}

/** A dam site's legend swatch: hatched light and dark, rimmed dark. */
export function damLegendSwatch(): string {
  const c = cssColor;
  const stripes = Array.from({ length: 6 }, (_, k) => `<path d="M${k * 6 - 6} 16 L${k * 6 + 2} 0 L${k * 6 + 5} 0 L${k * 6 - 3} 16Z" fill="${c(HATCH.dark)}"/>`).join("");
  return icon(`<defs><clipPath id="d"><rect x="2" y="2" width="20" height="12"/></clipPath></defs><rect x="2" y="2" width="20" height="12" fill="${c(DAM_SITE)}"/><g clip-path="url(#d)">${stripes}</g><rect x="1" y="1" width="22" height="14" fill="none" stroke="${c(HATCH.dark)}" stroke-width="2"/>`);
}
