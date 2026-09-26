// The 3D view's water in one place (PLAN §20 D177): clean water's and badwater's colours, their
// opacity by depth, how water turns from clean to bad with its badwater share (the contamination
// blend), and how the colours are calibrated on screen. The Standard look's water shader reads it
// through `WATER_GLSL` (generated from these values; the Light look runs the same shader code),
// the legend and the tests read the values, and Map look 2's High shader is to read it when it
// adopts #38, so the looks never drift apart. No other module defines a water colour
// (tests/unit/water-palette.test.ts). The 2D preview and the map file's thumbnail keep their own
// schematic colours; they are not the 3D view.
//
// Badwater's colours and opacity are placeholders (`WATER_PLACEHOLDERS`) until Kyler approves the
// High prototype's badwater (#38): then its body, trough and streak colours and its opacity come
// from #38's calibration (`WATER_CALIBRATION`). Colours are display values, before the light.
//
// Pure TypeScript, no three.js.

export type Rgb = readonly [number, number, number];

export const WATER = {
  /** Clean water, as in the game (Kyler's clean look): clear in the shallows, where the bed shows
   *  through a light teal tint, and a deep teal body darkening to navy with depth. The body may be
   *  as dark as dry ground or darker; water reads as water by its shore foam, glints, ripples and
   *  see-through shallows, and badwater stays darker. */
  shallow: [0.36, 0.6, 0.64] as Rgb,
  /** The ripples' lit crests, where they catch the sky: the lightest the water gets. */
  crest: [0.26, 0.5, 0.62] as Rgb,
  /** The body of water a level or so deep. */
  teal: [0.09, 0.23, 0.25] as Rgb,
  /** The body of deep water. */
  navy: [0.07, 0.15, 0.2] as Rgb,
  foam: [0.9, 0.94, 0.95] as Rgb,
  /** The sky the water reflects (clean water's pale flow streaks are this, a little darker). */
  sky: [0.6, 0.72, 0.84] as Rgb,
  /** Badwater's body in its usual shallow pools (`BADWATER.shallow` deep or less), nearly opaque
   *  and dull; deeper it darkens toward `badDeep` (Kyler's option A), so it stays darker than clean
   *  water of the same depth. Placeholder. */
  bad: [0.292, 0.234, 0.204] as Rgb,
  badDeep: [0.1, 0.07, 0.06] as Rgb,
  /** Badwater's troughs, in the ripples' low parts (`BADWATER.trough` of the way). Placeholder:
   *  none yet, the body's own colour. */
  badTrough: [0.292, 0.234, 0.204] as Rgb,
  /** Badwater's lighter flow streaks, where it flows (`BADWATER.streak` of the way). Placeholder. */
  badStreak: [0.462, 0.35, 0.252] as Rgb,
  /** Badwater's slow glowing bubbles, denser the more of the water is bad. */
  badVein: [0.98, 0.5, 0.16] as Rgb,
  /** Foam on badwater: along its shores and below its falls. */
  badFoam: [0.66, 0.5, 0.36] as Rgb,
  /** The warm red that water partly bad turns toward (only its hue: `WATER_BLEND`), so a mixed
   *  river reads as poisoned at a glance, not as deeper blue. Placeholder until #38's badwater body
   *  is approved; then its hue. */
  tint: [0.5, 0.17, 0.15] as Rgb,
} as const;

/** Clean water's surface, as the water shader draws it: foam along the shore and broken foam
 *  just off it, glints on the ripples, and shallows clear enough to see the bed through, the more
 *  so toward the banks. */
export const WATER_SURFACE = {
  /** Foam: the line along the shore, and the broken foam just off it. */
  shoreFoam: 0.7,
  brokenFoam: 0.6,
  /** Glints of light on the ripples (up close). */
  glints: 0.6,
  /** Opacity where the water is shallowest, and where it is deep; the water's side at the map's
   *  edge. */
  clearest: 0.3,
  deepest: 0.93,
  edge: 0.85,
  /** At a bank the water is this share of its depth, deepening over this far from it (tiles). */
  bank: 0.3,
  bankWidth: 0.45,
  /** How quickly clean water turns from its clear shallows to its teal body (per level), and
   *  between which depths the teal turns navy. */
  absorb: 4,
  navyFrom: 0.6,
  navyTo: 2.8,
  /** How strongly the ripples' crests, the sky's reflection, the pale flow streaks and the sun's
   *  glint show. */
  crest: 0.3,
  reflect: 0.35,
  pale: 0.22,
  spec: 0.5,
} as const;

/** Badwater's depth, opacity and surface (Kyler's option A: darker with depth). Placeholders. */
export const BADWATER = {
  /** Down to this depth (levels) badwater shows `WATER.bad`; below it, it darkens toward
   *  `WATER.badDeep`, this quickly (per level). */
  shallow: 0.25,
  absorb: 1.3,
  /** Its opacity from clear shallows to deep water (by clean water's depth curve), and at the
   *  map's edge. */
  opacity: [0.95, 0.99] as readonly [number, number],
  edge: 0.95,
  /** How far the troughs and the flow streaks turn toward their colours, and how strongly the
   *  sky's reflection, the sun's glint, the glints and the bubbles show. */
  trough: 0,
  streak: 0.3,
  reflect: 0.25,
  spec: 0.2,
  glints: 0.2,
  bubbles: 0.55,
} as const;

/** The values that wait for #38's approved badwater (D177 (1)). */
export const WATER_PLACEHOLDERS = ["WATER.bad", "WATER.badDeep", "WATER.badTrough", "WATER.badStreak", "WATER.tint", "BADWATER.opacity", "BADWATER.trough", "BADWATER.streak"] as const;

/** How water turns from clean to bad with its badwater share `s` (0–1, blended between tiles by
 *  the water mesh), in parts that each follow their own curve (in linear light, so greyscale
 *  darkens at every step):
 *  - it darkens in proportion: its luminance goes from clean water's to badwater's by s^darken;
 *  - it takes the warm red tint early: its hue (the colour over its luminance) turns from clean
 *    water's toward `WATER.tint`'s by 1 - (1 - s)^tint (at a quarter bad over half way), then
 *    settles on badwater's own by s^settle, so pure badwater is exactly its body;
 *  - it grows murky: opacity, by s^opacity;
 *  and badwater's dull surface (fewer glints and crests, its streaks, foam and bubbles) comes in
 *  by s^surface. Clean water (s = 0) is exactly clean water. */
export const WATER_BLEND = { darken: 1, tint: 3, settle: 4, opacity: 0.5, surface: 0.75 } as const;

/** How the water's colours are measured on screen, as #38's colour check does
 *  (investigation/maplook2/colour-check.mjs), and what they should measure. `npx tsx
 *  tools/capture-badwater.ts --measure` runs it: a bed of water one badwater share and one depth
 *  all over, its soil as contaminated as the water, drawn by the site's renderer on the GPU (a
 *  browser that draws in software gets the Light look), the camera orbiting at `pitch` (70° down,
 *  or lower), yaw −0.55 and 44 away, the water held at 8 s; the central patch's pixels sorted by
 *  r + 2g + b and each band's mean. */
export const WATER_CALIBRATION = {
  method: {
    viewport: [1440, 940] as readonly [number, number],
    bed: 64,
    yaw: -0.55,
    distance: 44,
    time: 8,
    patch: [240, 96] as readonly [number, number],
    bands: { trough: [0.05, 0.15], body: [0.15, 0.4], typical: [0.45, 0.55], streak: [0.96, 0.985] } as Record<string, readonly [number, number]>,
    /** Codes a measured band may be off its target, per channel. */
    tolerance: 2,
  },
  /** On-screen targets (0–255): badwater's is a placeholder, Kyler's in-game #4B3C37, until #38's
   *  approved body, trough and streak replace it; clean water's are the Standard look as approved
   *  (they hold it still). */
  targets: [
    { name: "badwater, a quarter level deep, 70° down", share: 1, depth: 0.25, pitch: 1.22, bands: { body: [75, 60, 55] }, placeholder: true },
    { name: "clean water, a quarter level deep, 70° down", share: 0, depth: 0.25, pitch: 1.22, bands: { body: [64, 98, 106] } },
    { name: "clean water, 1.25 deep, 70° down", share: 0, depth: 1.25, pitch: 1.22, bands: { body: [33, 67, 79] } },
    { name: "clean water, 4.25 deep, 70° down", share: 0, depth: 4.25, pitch: 1.22, bands: { body: [29, 53, 69] } },
  ] as readonly { name: string; share: number; depth: number; pitch: number; bands: Record<string, readonly [number, number, number]>; placeholder?: boolean }[],
  /** The ground level under a bed of water this deep (so the camera sees the same scene as #38's). */
  floor(depth: number): number {
    return depth <= 0.25 ? 8 : depth <= 1.25 ? 7 : 4;
  },
} as const;

// ------------------------------------------------------------------------------ the colours

/** Luminance weights (Rec. 709, linear light): the lightness the blend keeps apart from hue. */
const LUMA: Rgb = [0.2126, 0.7152, 0.0722];
const luma = (c: Rgb) => LUMA[0] * c[0] + LUMA[1] * c[1] + LUMA[2] * c[2];
/** Display values to linear light and back (sRGB). */
const toLinear = (c: Rgb): Rgb => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as unknown as Rgb;
const toDisplay = (c: Rgb): Rgb => c.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)) as unknown as Rgb;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Clean water's depth as its colour and opacity see it, `fromBank` tiles from a bank. */
function seenDepth(depth: number, fromBank: number): number {
  const S = WATER_SURFACE;
  return depth * (S.bank + (1 - S.bank) * smooth(0, S.bankWidth, fromBank));
}

const absorbed = (d: number) => 1 - Math.exp(-d * WATER_SURFACE.absorb);

/** Clean water's body `depth` levels deep, `fromBank` tiles from a bank (open water by default). */
export function cleanWaterBody(depth: number, fromBank = 1): Rgb {
  const S = WATER_SURFACE;
  const d = seenDepth(depth, fromBank);
  return mixRgb(mixRgb(WATER.shallow, WATER.teal, absorbed(d)), WATER.navy, smooth(S.navyFrom, S.navyTo, d));
}

/** Badwater's body `depth` levels deep: `WATER.bad` in its shallows, darker below them. */
export function badwaterBody(depth: number): Rgb {
  return mixRgb(WATER.bad, WATER.badDeep, 1 - Math.exp(-Math.max(0, depth - BADWATER.shallow) * BADWATER.absorb));
}

/** The blend's curves at a badwater share (0–1): how far the lightness, the hue (toward the tint,
 *  then badwater's own), the opacity and the surface have turned toward badwater's. */
export function waterBlend(share: number): { darken: number; tint: number; settle: number; opacity: number; surface: number } {
  const s = Math.max(0, Math.min(1, share));
  const B = WATER_BLEND;
  if (s === 0) return { darken: 0, tint: 0, settle: 0, opacity: 0, surface: 0 };
  return { darken: s ** B.darken, tint: 1 - (1 - s) ** B.tint, settle: s ** B.settle, opacity: s ** B.opacity, surface: s ** B.surface };
}

/** Water between a clean colour and a bad one at a badwater share, as `WATER_BLEND` says, in
 *  linear light: its luminance darkens in proportion; its hue (the colour over its luminance)
 *  turns to the tint's early, then to badwater's. */
export function blendWater(clean: Rgb, bad: Rgb, share: number): Rgb {
  if (!(share > 0)) return clean;
  if (share >= 1) return bad;
  const k = waterBlend(share);
  const cl = toLinear(clean);
  const bl = toLinear(bad);
  const yc = luma(cl);
  const yb = luma(bl);
  const y = yc + (yb - yc) * k.darken;
  const hue = (c: Rgb): Rgb => {
    const l = Math.max(luma(c), 1e-5);
    return [c[0] / l, c[1] / l, c[2] / l];
  };
  const h = mixRgb(mixRgb(hue(cl), hue(toLinear(WATER.tint)), k.tint), hue(bl), k.settle);
  return toDisplay([Math.max(0, y * h[0]), Math.max(0, y * h[1]), Math.max(0, y * h[2])]);
}

/** The body colour of water `depth` levels deep, `fromBank` tiles from a bank (open water by
 *  default), clean (false), pure badwater (true) or with a badwater share (0–1): before the light,
 *  the ripples, the foam and the glints (as the shader). */
export function waterBody(depth: number, bad: boolean | number, fromBank = 1): Rgb {
  const share = bad === true ? 1 : bad === false ? 0 : bad;
  return blendWater(cleanWaterBody(depth, fromBank), badwaterBody(depth), share);
}

/** The water's opacity `depth` levels deep and `fromBank` tiles from a bank, with a badwater share
 *  (clean by default): see-through in clean shallows and toward the banks, murkier the more of it
 *  is bad (as the shader, before foam and glints). */
export function waterOpacity(depth: number, fromBank = 1, share = 0): number {
  const S = WATER_SURFACE;
  const a = absorbed(seenDepth(depth, fromBank));
  const clean = S.clearest + (S.deepest - S.clearest) * a;
  const bad = BADWATER.opacity[0] + (BADWATER.opacity[1] - BADWATER.opacity[0]) * a;
  return clean + (bad - clean) * waterBlend(share).opacity;
}

// ------------------------------------------------------------------------------ the shader's copy

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const glColor = (c: Rgb) => `vec3(${c.map((v) => f(Math.round(v * 1000) / 1000)).join(", ")})`;

/** The same values and functions in GLSL, for every water shader: the colours as constants, and
 *  clean water's body and opacity, badwater's, and the blend between them. */
export const WATER_GLSL = /* glsl */ `
  #define WATER_SHALLOW ${glColor(WATER.shallow)}
  #define WATER_CREST ${glColor(WATER.crest)}
  #define WATER_TEAL ${glColor(WATER.teal)}
  #define WATER_NAVY ${glColor(WATER.navy)}
  #define WATER_FOAM ${glColor(WATER.foam)}
  #define WATER_SKY ${glColor(WATER.sky)}
  #define WATER_PALE (WATER_SKY * 0.85)
  #define BADWATER_BODY ${glColor(WATER.bad)}
  #define BADWATER_DEEP ${glColor(WATER.badDeep)}
  #define BADWATER_TROUGH ${glColor(WATER.badTrough)}
  #define BADWATER_STREAK ${glColor(WATER.badStreak)}
  #define BADWATER_VEIN ${glColor(WATER.badVein)}
  #define BADWATER_FOAM ${glColor(WATER.badFoam)}
  #define WATER_TINT ${glColor(WATER.tint)}
  #define WATER_CREST_AMOUNT ${f(WATER_SURFACE.crest)}
  #define WATER_REFLECT ${f(WATER_SURFACE.reflect)}
  #define WATER_PALE_AMOUNT ${f(WATER_SURFACE.pale)}
  #define WATER_SPEC ${f(WATER_SURFACE.spec)}
  #define WATER_EDGE ${f(WATER_SURFACE.edge)}
  #define BADWATER_TROUGH_AMOUNT ${f(BADWATER.trough)}
  #define BADWATER_STREAK_AMOUNT ${f(BADWATER.streak)}
  #define BADWATER_REFLECT ${f(BADWATER.reflect)}
  #define BADWATER_SPEC ${f(BADWATER.spec)}
  #define BADWATER_GLINTS ${f(BADWATER.glints)}
  #define BADWATER_BUBBLES ${f(BADWATER.bubbles)}
  #define BADWATER_EDGE ${f(BADWATER.edge)}
  /** Clean water's depth as its colour and opacity see it, by how far the point is from a shore. */
  float waterSeenDepth(float depth, float shore) {
    return depth * mix(${f(WATER_SURFACE.bank)}, 1.0, smoothstep(0.0, ${f(WATER_SURFACE.bankWidth)}, shore));
  }
  float waterAbsorb(float d) {
    return 1.0 - exp(-d * ${f(WATER_SURFACE.absorb)});
  }
  vec3 cleanWaterBody(float d, float absorb) {
    return mix(mix(WATER_SHALLOW, WATER_TEAL, absorb), WATER_NAVY, smoothstep(${f(WATER_SURFACE.navyFrom)}, ${f(WATER_SURFACE.navyTo)}, d));
  }
  float cleanWaterAlpha(float absorb) {
    return mix(${f(WATER_SURFACE.clearest)}, ${f(WATER_SURFACE.deepest)}, absorb);
  }
  vec3 badwaterBody(float depth) {
    return mix(BADWATER_BODY, BADWATER_DEEP, 1.0 - exp(-max(0.0, depth - ${f(BADWATER.shallow)}) * ${f(BADWATER.absorb)}));
  }
  float badwaterAlpha(float absorb) {
    return mix(${f(BADWATER.opacity[0])}, ${f(BADWATER.opacity[1])}, absorb);
  }
  /** The blend's opacity and surface curves at a badwater share. */
  float waterMurk(float s) {
    return s > 0.0 ? pow(min(s, 1.0), ${f(WATER_BLEND.opacity)}) : 0.0;
  }
  float waterDull(float s) {
    return s > 0.0 ? pow(min(s, 1.0), ${f(WATER_BLEND.surface)}) : 0.0;
  }
  vec3 waterToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
  vec3 waterToDisplay(vec3 v) {
    return mix(v * 12.92, 1.055 * pow(v, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, v));
  }
  /** Water between clean and bad at a badwater share, in linear light: it darkens in proportion,
   *  and its hue turns to the warm tint early, then to badwater's own. */
  vec3 waterBlend(vec3 clean, vec3 bad, float s) {
    if (s <= 0.0) return clean;
    if (s >= 1.0) return bad;
    vec3 luma = vec3(${LUMA.map(f).join(", ")});
    vec3 cl = waterToLinear(clean);
    vec3 bl = waterToLinear(bad);
    vec3 tl = waterToLinear(WATER_TINT);
    float yc = dot(cl, luma);
    float yb = dot(bl, luma);
    float y = mix(yc, yb, pow(s, ${f(WATER_BLEND.darken)}));
    vec3 hue = mix(cl / max(yc, 0.00001), tl / dot(tl, luma), 1.0 - pow(1.0 - s, ${f(WATER_BLEND.tint)}));
    hue = mix(hue, bl / max(yb, 0.00001), pow(s, ${f(WATER_BLEND.settle)}));
    return waterToDisplay(max(y * hue, 0.0));
  }
`;
