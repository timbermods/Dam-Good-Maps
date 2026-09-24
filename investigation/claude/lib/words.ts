// The judgement-word table and the size words (EDITOR_PLAN §7 "Spatial language"; M9 builds the
// table, M12 reuses it). The app, not Claude, decides what "harsher", "huge" or "a bit wider" mean,
// so the same words always do the same thing.
//
// A judgement word ("harsher", "lush", "dangerous") names measured targets: a metric, the way it
// moves, and how far, relative to the map's current value and bounded by the official range
// (investigation/calibration.json) and each setting's hard bounds. It moves them with levers: steps
// on the settings (PLAN §5), each already proven to move its metric by tools/settings-suite.ts.
// Playability checks are guards, never traded away: when the full step breaks one, the word backs
// off lever by lever (riskiest first) until the map passes, and the report says what was held back.
//
// Size words resolve against what the set-piece builders publish for this map (PLAN §9.10).

import { reservoirNeeded } from "../../../src/core/gen/calibrated";
import { flowBudget } from "../../../src/core/features/setpieces";
import type { MapSession } from "../../../src/core/doc/session";
import type { Difficulty, MapSpec, Settings } from "../../../src/core/spec/mapspec";
import { MAP_METRICS, measureSession, type Measured } from "./metrics";
import { round2 } from "./view";

// ------------------------------------------------------------------------------------ official

/** Official ranges (19 official maps, calibration.json) for the metrics a word moves, so a report
 *  can say where the map now sits. */
export const OFFICIAL: Record<string, { p10: number; median: number; p90: number }> = {
  heightRange: { p10: 10.8, median: 13, p90: 15 },
  flatShare: { p10: 0.36, median: 0.52, p90: 0.6 },
  cliffShare: { p10: 0.09, median: 0.16, p90: 0.19 },
  step1Share: { p10: 0.45, median: 0.62, p90: 0.8 },
  waterShare: { p10: 0.07, median: 0.12, p90: 0.4 },
  badwaterRatio: { p10: 0.36, median: 0.65, p90: 1.86 },
  basins20: { p10: 2.8, median: 12, p90: 21.4 },
  badwaterDistance: { p10: 12, median: 30.5, p90: 53.6 },
  treesNearStart: { p10: 47, median: 117, p90: 172 },
  bushesNearStart: { p10: 6.4, median: 47, p90: 79.8 },
  waterDistance: { p10: 4.4, median: 13.75, p90: 22.2 },
  treesPer10k: { p10: 402, median: 606, p90: 1196 },
  bushesPer10k: { p10: 16.7, median: 43.8, p90: 148.5 },
  scrapPer1k: { p10: 151.7, median: 280.8, p90: 723.9 },
  reach: { p10: 1007, median: 1296, p90: 4523 },
};

// -------------------------------------------------------------------------------------- levers

type Path = [keyof Settings, string];

/** One step on one setting, relative to its current value, within its hard bounds. */
export type Lever =
  | { setting: Path; steps: number; order: readonly string[]; risk: number }
  | { setting: Path; factor: number; min: number; max: number; risk: number }
  | { setting: Path; delta: number; min: number; max: number; risk: number };

const FLOW = ["trickle", "normal", "strong", "lush"] as const;
const RESERVE = ["scarce", "normal", "plenty"] as const;
const BADWATER = ["off", "low", "normal", "high"] as const;
const LAKES = ["none", "few", "some", "many"] as const;
const LAND = ["tight", "normal", "generous"] as const;
const FALLS = ["off", "few", "many"] as const;

export interface Target {
  metric: keyof typeof MAP_METRICS;
  direction: "up" | "down";
}

export interface JudgementWord {
  word: string;
  aliases: string[];
  /** What it means, in one plain line (for the report and the tool description). */
  means: string;
  levers: Lever[];
  targets: Target[];
  /** A word that also has a feature-level meaning (a dangerous badwater spring). */
  feature?: Record<string, Record<string, unknown>>;
}

export const JUDGEMENT: JudgementWord[] = [
  {
    word: "harsher",
    aliases: ["harder", "tougher", "more challenging", "more difficult", "brutal", "unforgiving", "meaner"],
    means: "less clean water, less stored water near the start, more badwater, fewer trees and berries; the start rules still hold",
    levers: [
      { setting: ["water", "riverFlow"], steps: -1, order: FLOW, risk: 3 },
      { setting: ["water", "droughtReserve"], steps: -1, order: RESERVE, risk: 2 },
      { setting: ["hazards", "badwater"], steps: 1, order: BADWATER, risk: 1 },
      { setting: ["resources", "forestDensity"], factor: 0.75, min: 50, max: 200, risk: 0 },
      { setting: ["resources", "berryBushes"], factor: 0.7, min: 50, max: 300, risk: 0 },
    ],
    targets: [
      { metric: "cleanStrength", direction: "down" },
      { metric: "badwaterRatio", direction: "up" },
      { metric: "treesPer10k", direction: "down" },
      { metric: "bushesPer10k", direction: "down" },
    ],
  },
  {
    word: "easier",
    aliases: ["gentler", "friendlier", "more forgiving", "kinder", "relaxed", "cozier", "cosier"],
    means: "more clean water, more stored water near the start, less badwater, more trees and berries",
    levers: [
      { setting: ["water", "riverFlow"], steps: 1, order: FLOW, risk: 1 },
      { setting: ["water", "droughtReserve"], steps: 1, order: RESERVE, risk: 1 },
      { setting: ["hazards", "badwater"], steps: -1, order: BADWATER, risk: 0 },
      { setting: ["resources", "forestDensity"], factor: 1.3, min: 50, max: 200, risk: 0 },
      { setting: ["resources", "berryBushes"], factor: 1.4, min: 50, max: 300, risk: 0 },
    ],
    targets: [
      { metric: "cleanStrength", direction: "up" },
      { metric: "badwaterRatio", direction: "down" },
      { metric: "treesPer10k", direction: "up" },
      { metric: "bushesPer10k", direction: "up" },
    ],
  },
  {
    word: "lush",
    aliases: ["lusher", "greener", "green", "fertile", "verdant", "overgrown", "jungle"],
    means: "more trees and berry bushes, a stronger river and more ponds",
    levers: [
      { setting: ["resources", "forestDensity"], factor: 1.5, min: 50, max: 200, risk: 0 },
      { setting: ["resources", "berryBushes"], factor: 1.6, min: 50, max: 300, risk: 0 },
      { setting: ["water", "riverFlow"], steps: 1, order: FLOW, risk: 1 },
      { setting: ["water", "lakes"], steps: 1, order: LAKES, risk: 2 },
    ],
    targets: [
      { metric: "treesPer10k", direction: "up" },
      { metric: "bushesPer10k", direction: "up" },
      { metric: "cleanStrength", direction: "up" },
    ],
  },
  {
    word: "barren",
    aliases: ["drier", "dry", "arid", "sparse", "desolate", "bleak", "dusty"],
    means: "fewer trees and bushes, a weaker river and fewer ponds; the start keeps its trees, berries and water",
    levers: [
      { setting: ["resources", "forestDensity"], factor: 0.6, min: 50, max: 200, risk: 0 },
      { setting: ["resources", "berryBushes"], factor: 0.6, min: 50, max: 300, risk: 0 },
      { setting: ["water", "riverFlow"], steps: -1, order: FLOW, risk: 3 },
      { setting: ["water", "lakes"], steps: -1, order: LAKES, risk: 1 },
    ],
    targets: [
      { metric: "treesPer10k", direction: "down" },
      { metric: "bushesPer10k", direction: "down" },
      { metric: "cleanStrength", direction: "down" },
    ],
  },
  {
    word: "wetter",
    aliases: ["more water", "watery", "rainier", "more rivers"],
    means: "a stronger river, more ponds and more stored water",
    levers: [
      { setting: ["water", "riverFlow"], steps: 1, order: FLOW, risk: 1 },
      { setting: ["water", "lakes"], steps: 1, order: LAKES, risk: 2 },
      { setting: ["water", "droughtReserve"], steps: 1, order: RESERVE, risk: 1 },
    ],
    targets: [
      { metric: "cleanStrength", direction: "up" },
      { metric: "basins20", direction: "up" },
    ],
  },
  {
    word: "dangerous",
    aliases: ["deadly", "hazardous", "perilous", "toxic", "nastier", "more dangerous"],
    means: "more badwater, nearer the start, but never nearer than the start rule allows",
    levers: [
      { setting: ["hazards", "badwater"], steps: 1, order: BADWATER, risk: 1 },
      { setting: ["hazards", "badwaterDistance"], delta: -10, min: 12, max: 60, risk: 2 },
    ],
    targets: [
      { metric: "badwaterRatio", direction: "up" },
      { metric: "badwaterDistance", direction: "down" },
    ],
    feature: { badwaterBasin: { strength: 3, nearer: true } },
  },
  {
    word: "safer",
    aliases: ["less dangerous", "cleaner", "less badwater", "less toxic"],
    means: "less badwater, farther from the start",
    levers: [
      { setting: ["hazards", "badwater"], steps: -1, order: BADWATER, risk: 0 },
      { setting: ["hazards", "badwaterDistance"], delta: 12, min: 12, max: 60, risk: 1 },
    ],
    targets: [
      { metric: "badwaterRatio", direction: "down" },
      { metric: "badwaterDistance", direction: "up" },
    ],
    feature: { badwaterBasin: { strength: 1 } },
  },
  {
    word: "rugged",
    aliases: ["dramatic", "mountainous", "steeper", "hillier", "craggy", "wilder", "more vertical"],
    means: "a larger height range, more cliffs and more waterfalls",
    levers: [
      { setting: ["terrain", "relief"], delta: 25, min: 0, max: 100, risk: 1 },
      { setting: ["terrain", "terracing"], delta: 20, min: 0, max: 100, risk: 1 },
      { setting: ["water", "waterfalls"], steps: 1, order: FALLS, risk: 1 },
    ],
    targets: [
      { metric: "heightRange", direction: "up" },
      { metric: "step1Share", direction: "down" },
    ],
  },
  {
    word: "flatter",
    aliases: ["gentle terrain", "smoother", "lower", "calmer terrain", "less hilly"],
    means: "a smaller height range and fewer cliffs",
    levers: [
      { setting: ["terrain", "relief"], delta: -25, min: 0, max: 100, risk: 0 },
      { setting: ["terrain", "terracing"], delta: -20, min: 0, max: 100, risk: 0 },
    ],
    targets: [
      { metric: "heightRange", direction: "down" },
      { metric: "step1Share", direction: "up" },
    ],
  },
  {
    word: "richer",
    aliases: ["more resources", "more scrap", "wealthier", "more loot", "more ruins"],
    means: "more scrap in ruins and more trees",
    levers: [
      { setting: ["resources", "ruins"], factor: 1.6, min: 25, max: 300, risk: 0 },
      { setting: ["resources", "forestDensity"], factor: 1.2, min: 50, max: 200, risk: 0 },
    ],
    targets: [
      { metric: "scrapPer1k", direction: "up" },
      { metric: "treesPer10k", direction: "up" },
    ],
  },
  {
    word: "poorer",
    aliases: ["fewer resources", "less scrap", "scarce", "fewer ruins"],
    means: "less scrap in ruins",
    levers: [{ setting: ["resources", "ruins"], factor: 0.55, min: 25, max: 300, risk: 0 }],
    targets: [{ metric: "scrapPer1k", direction: "down" }],
  },
  {
    word: "roomier",
    aliases: ["more space", "more room", "more building room", "spacious", "open"],
    means: "more flat land the colony can walk to from the start",
    levers: [{ setting: ["terrain", "buildableLand"], steps: 1, order: LAND, risk: 0 }],
    targets: [{ metric: "reach", direction: "up" }],
  },
  {
    word: "cramped",
    aliases: ["tighter", "less room", "less space", "claustrophobic"],
    means: "less flat land walkable from the start (never under the start rule)",
    levers: [{ setting: ["terrain", "buildableLand"], steps: -1, order: LAND, risk: 1 }],
    targets: [{ metric: "reach", direction: "down" }],
  },
];

/** Words that are not measurable targets: they need a creative proposal (M12 answers with options). */
export const VAGUE = ["interesting", "more interesting", "better", "cooler", "prettier", "nicer", "surprise me", "more fun", "unique", "epic"];

export const DEGREE: [RegExp, number][] = [
  [/\b(a (little )?bit|slightly|a little|somewhat|a touch)\b/, 0.5],
  [/\b(much|a lot|way|far|very|really|extremely|massively|super)\b/, 2],
];

export function findWord(text: string): { word: JudgementWord; degree: number } | null {
  const t = ` ${text.toLowerCase()} `;
  let degree = 1;
  for (const [re, d] of DEGREE) if (re.test(t)) degree = d;
  let best: { word: JudgementWord; at: number; len: number } | null = null;
  for (const w of JUDGEMENT)
    for (const a of [w.word, ...w.aliases]) {
      const re = new RegExp(`\\b${a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`);
      const m = re.exec(t);
      if (m && (!best || a.length > best.len)) best = { word: w, at: m.index, len: a.length };
    }
  return best ? { word: best.word, degree } : null;
}

/** The settings patch a word's levers make from the current spec (degree 0.5: half the numeric
 *  deltas, one enum step on the first lever only; degree 2: double). Levers already at their bound
 *  are skipped and named. */
export function leverPatch(spec: MapSpec, levers: readonly Lever[], degree = 1): { patch: Record<string, Record<string, unknown>>; moved: string[]; atBound: string[] } {
  const patch: Record<string, Record<string, unknown>> = {};
  const moved: string[] = [];
  const atBound: string[] = [];
  levers.forEach((l, k) => {
    const [group, key] = l.setting;
    const cur = (spec.settings[group] as unknown as Record<string, unknown>)[key];
    let next: unknown = cur;
    if ("order" in l) {
      if (degree < 1 && k > 0) return;
      const i = l.order.indexOf(String(cur));
      const steps = Math.round(l.steps * Math.max(1, degree));
      const j = Math.min(l.order.length - 1, Math.max(0, i + steps));
      next = l.order[j];
    } else if ("factor" in l) {
      const f = 1 + (l.factor - 1) * degree;
      next = Math.round(Math.min(l.max, Math.max(l.min, Number(cur) * f)));
    } else {
      next = Math.round(Math.min(l.max, Math.max(l.min, Number(cur) + l.delta * degree)));
    }
    if (next === cur) {
      atBound.push(`${group}.${key}`);
      return;
    }
    (patch[group] ??= {})[key] = next;
    moved.push(`${group}.${key}: ${String(cur)} → ${String(next)}`);
  });
  return { patch, moved, atBound };
}

export interface WordResult {
  word: string;
  ok: boolean;
  /** The settings actually changed, and levers held back to keep the guards. */
  moved: string[];
  heldBack: string[];
  atBound: string[];
  targets: { metric: string; direction: string; before: number; after: number; moved: boolean; official?: { p10: number; median: number; p90: number } }[];
  guardsFailing: string[];
  attempts: number;
}

/** Apply a judgement word to a generated map: regenerate with its levers, backing off lever by
 *  lever (riskiest first) until the regenerated map passes every guard. The session keeps the
 *  result; one undo takes it back. */
export function applyWord(s: MapSession, word: JudgementWord, degree = 1, before?: Measured): WordResult {
  if (!s.spec) return { word: word.word, ok: false, moved: [], heldBack: [], atBound: [], targets: [], guardsFailing: ["an imported map has no settings to change"], attempts: 0 };
  const b = before ?? measureSession(s);
  const levers = [...word.levers];
  const held: string[] = [];
  let attempts = 0;
  for (;;) {
    const { patch, moved, atBound } = leverPatch(s.spec, levers, degree);
    if (!moved.length) return { word: word.word, ok: false, moved: [], heldBack: held, atBound, targets: [], guardsFailing: [], attempts };
    attempts++;
    const r = s.regenerate({ settings: patch }, `Make it ${word.word}`);
    if (r.ok && r.report?.passed) {
      const a = measureSession(s);
      return {
        word: word.word,
        ok: true,
        moved,
        heldBack: held,
        atBound,
        targets: word.targets.map((t) => {
          const bv = round2(MAP_METRICS[t.metric].get(b.map, b));
          const av = round2(MAP_METRICS[t.metric].get(a.map, a));
          return { metric: t.metric, direction: t.direction, before: bv, after: av, moved: t.direction === "up" ? av > bv : av < bv, ...(OFFICIAL[t.metric] ? { official: OFFICIAL[t.metric] } : {}) };
        }),
        guardsFailing: a.guards.filter((g) => !g.ok && g.class !== "load" && g.applicable).map((g) => g.id),
        attempts,
      };
    }
    // back off: undo the failed regeneration and drop the riskiest lever still in use
    if (r.ok) s.undo();
    const risky = levers.reduce((best, l, k) => (l.risk > levers[best].risk ? k : best), 0);
    const [dropped] = levers.splice(risky, 1);
    held.push(`${dropped.setting.join(".")} (the map failed ${r.report ? r.report.checks.filter((c) => !c.ok && !c.advisory).map((c) => c.id).join(", ") : r.errors.join("; ")} with it)`);
    if (!levers.length) return { word: word.word, ok: false, moved: [], heldBack: held, atBound: [], targets: [], guardsFailing: [], attempts };
  }
}

// -------------------------------------------------------------------------------- size words

export interface SizeTarget {
  metric: string;
  min?: number;
  max?: number;
  approx?: number;
  tol?: number;
  unit: string;
  /** How the numbers were worked out, for the report. */
  basis: string;
}

const SIZE = {
  tiny: /\b(tiny|little|wee|minimal)\b/,
  small: /\b(small|narrow|modest|short|low|minor)\b/,
  medium: /\b(medium|decent|average|moderate|normal|good|reasonable)\b/,
  large: /\b(large|big|wide|tall|high|major|sizable|sizeable|deep)\b/,
  huge: /\b(huge|giant|gigantic|massive|enormous|immense|colossal|landmark|towering|mega|vast|grand)\b/,
};
export type SizeWord = keyof typeof SIZE | "number";

export function sizeWordOf(text: string): SizeWord | null {
  const t = text.toLowerCase();
  for (const k of ["huge", "tiny", "large", "medium", "small"] as const) if (SIZE[k].test(t)) return k;
  return null;
}

/** "roughly 20", "about 20 blocks", "20 wide" → 20 with ±max(3, 15%). */
export function numberOf(text: string): number | null {
  const m = /\b(\d{1,3})\s*(?:blocks?|tiles?|wide|levels?|high|deep|long)?\b/.exec(text.toLowerCase());
  return m ? Number(m[1]) : null;
}

export interface SizeContext {
  W: number;
  H: number;
  designedFor: Difficulty;
  /** The side along a waterfall's lip (W for a fall facing north or south). */
  side?: number;
}

/** What a size word (or a number) means for a set piece or feature on this map. */
export function sizeTarget(kind: string, size: SizeWord | number, ctx: SizeContext): SizeTarget | null {
  const side = ctx.side ?? Math.min(ctx.W, ctx.H);
  const area = ctx.W * ctx.H;
  if (typeof size === "number") {
    const tol = Math.max(3, Math.round(0.15 * size));
    const metric = kind === "waterfall" ? "lipWidth" : kind === "lake" ? "area" : kind === "damSite" ? "reservoir" : kind === "forest" ? "trees" : kind === "ruinField" ? "scrap" : "size";
    return { metric, approx: size, tol, unit: kind === "damSite" ? "blocks" : "tiles", basis: `the number asked for, ±${tol} (EDITOR_PLAN §7: "roughly 20" is 20 ±3)` };
  }
  switch (kind) {
    case "waterfall": {
      const cap = Math.floor(0.4 * side);
      const r: Record<string, [number, number]> = { tiny: [2, 3], small: [3, 6], medium: [6, 12], large: [Math.min(cap, 12), Math.min(cap, Math.max(20, Math.round(0.25 * side)))], huge: [Math.round(0.3 * side), cap] };
      const [min, max] = r[size];
      return { metric: "lipWidth", min: Math.min(min, cap), max, unit: "tiles", basis: size === "huge" ? `30–40% of the ${side}-tile side along the lip (EDITOR_PLAN §7; the builder's cap is ${cap}, PLAN §9.10)` : `the waterfall size words, capped at ${cap} (40% of the side)` };
    }
    case "waterfallDrop": {
      const r: Record<string, [number, number]> = { tiny: [2, 2], small: [2, 4], medium: [4, 7], large: [7, 11], huge: [11, 15] };
      const [min, max] = r[size];
      return { metric: "drop", min, max, unit: "levels", basis: "drops: typical 3–8, practical 12, hard maximum 15 (PLAN §9.2)" };
    }
    case "damSite": {
      const need = reservoirNeeded(ctx.designedFor);
      const k: Record<string, number> = { tiny: 0.5, small: 1, medium: 1.5, large: 3, huge: 6 };
      const min = Math.round(need * k[size]);
      return { metric: "reservoir", min, unit: "blocks", basis: `${k[size]}× the ${ctx.designedFor} colony's drought need of ${Math.round(need)} blocks (PLAN §11.4; a large site holds the Plenty reserve, a huge one twice that); the basin stays under 15% of the map (${Math.floor(0.15 * area)} tiles)` };
    }
    case "lake": {
      const f: Record<string, [number, number]> = { tiny: [0.001, 0.003], small: [0.003, 0.006], medium: [0.006, 0.012], large: [0.012, 0.03], huge: [0.03, 0.06] };
      const [a, b] = f[size];
      return { metric: "area", min: Math.max(6, Math.round(a * area)), max: Math.max(12, Math.round(b * area)), unit: "tiles", basis: `${a * 100}–${b * 100}% of the map's area` };
    }
    case "landform": {
      const f: Record<string, number> = { tiny: 0.05, small: 0.08, medium: 0.13, large: 0.2, huge: 0.3 };
      const d = Math.max(5, Math.round(f[size] * Math.min(ctx.W, ctx.H)));
      return { metric: "diameter", approx: d, tol: Math.max(2, Math.round(d * 0.25)), unit: "tiles", basis: `${f[size] * 100}% of the shorter side` };
    }
    case "landformHeight": {
      const r: Record<string, number> = { tiny: 1, small: 2, medium: 3, large: 5, huge: 7 };
      return { metric: "rise", approx: r[size], tol: 1, unit: "levels", basis: "levels above the ground round it (16 at most)" };
    }
    case "forest": {
      const r: Record<string, [number, number]> = { tiny: [8, 20], small: [20, 50], medium: [50, 120], large: [120, 300], huge: [300, 800] };
      const [min, max] = r[size];
      return { metric: "trees", min, max, unit: "trees", basis: "tree counts (an official grove is 6–20; a map holds 500–1,700 per 10k tiles)" };
    }
    case "ruinField": {
      const r: Record<string, [number, number]> = { tiny: [100, 300], small: [300, 800], medium: [800, 2000], large: [2000, 5000], huge: [5000, 12000] };
      const [min, max] = r[size];
      return { metric: "scrap", min, max, unit: "scrap", basis: "scrap (15 per column level; an official field holds 21–41 columns)" };
    }
    case "badwaterBasin": {
      const r: Record<string, number> = { tiny: 1, small: 1, medium: 1.5, large: 2.5, huge: 3 };
      return { metric: "strength", approx: r[size], tol: 0.5, unit: "blocks/s", basis: "a badwater source of 1–3 blocks/s (PLAN §5.4)" };
    }
    case "river": {
      const r: Record<string, number> = { tiny: 0.5, small: 1, medium: 2, large: 4, huge: Math.min(8, Math.round(flowBudget(ctx.W, ctx.H) * 1.5)) };
      return { metric: "flow", approx: r[size], tol: 0.5, unit: "blocks/s", basis: "gentle 1, steady 2, strong 4 blocks/s (PLAN §19.2)" };
    }
    default:
      return null;
  }
}

/** Comparatives on an existing feature: "a bit wider" is +25% (EDITOR_PLAN §7). */
export function comparative(text: string): { param: string; factor: number } | null {
  const t = text.toLowerCase();
  let f = 1.25;
  if (/\b(much|a lot|way|far|twice|double)\b/.test(t)) f = /twice|double/.test(t) ? 2 : 1.6;
  if (/\bnarrower|smaller|thinner|less wide|shrink\b/.test(t)) return { param: /smaller|shrink/.test(t) ? "size" : "width", factor: 1 / f };
  if (/\bwider|broader\b/.test(t)) return { param: "width", factor: f };
  if (/\btaller|higher|bigger drop|deeper drop\b/.test(t)) return { param: "drop", factor: f };
  if (/\bshorter|lower\b/.test(t)) return { param: "drop", factor: 1 / f };
  if (/\bbigger|larger\b/.test(t)) return { param: "size", factor: f };
  if (/\bdeeper\b/.test(t)) return { param: "depth", factor: f };
  if (/\bstronger|more water|more flow\b/.test(t)) return { param: "flow", factor: f };
  if (/\bweaker|less water|less flow\b/.test(t)) return { param: "flow", factor: 1 / f };
  return null;
}
