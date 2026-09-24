// MapSpec v1 (PLAN §19.1): everything that determines a generated map. The settings panel, the
// URL codec, the editor's SpecPatch and Claude all produce one. Complete, never a diff.

import { hash32 } from "../math/hash";

export const GENERATOR_VERSION = "0.2.0";
export const SPEC_VERSION = 1;

export type ThemeId = "riverValley" | "canyon" | "highlands" | "lakeBasin" | "delta" | "islands";
export type ArchetypeId = ThemeId;
export type Difficulty = "easy" | "normal" | "hard";
export type SizePreset = "small" | "medium" | "large" | "max";

export const THEMES: readonly ThemeId[] = ["riverValley", "canyon", "highlands", "lakeBasin", "delta", "islands"];
/** Themes the generator can build today (M1: River Valley only). */
export const AVAILABLE_THEMES: readonly ThemeId[] = ["riverValley"];
export const THEME_NAMES: Record<ThemeId, string> = {
  riverValley: "River Valley",
  canyon: "Canyon",
  highlands: "Highlands",
  lakeBasin: "Lake Basin",
  delta: "Delta",
  islands: "Islands",
};

export const SIZE_PRESETS: Record<SizePreset, number> = { small: 96, medium: 128, large: 192, max: 256 };
export const MIN_SIDE = 48;
export const MAX_SIDE = 256;

export interface Settings {
  terrain: {
    relief: number; // 0–100
    highestTerrain: number; // 10–16
    terracing: number; // 0–100
    buildableLand: "tight" | "normal" | "generous";
  };
  water: {
    rivers: number; // 0–3
    riverStyle: "straight" | "meandering" | "braided";
    riverFlow: "trickle" | "normal" | "strong" | "lush";
    droughtReserve: "scarce" | "normal" | "plenty";
    lakes: "none" | "few" | "some" | "many";
    waterfalls: "off" | "few" | "many";
  };
  hazards: {
    badwater: "off" | "low" | "normal" | "high";
    badwaterDistance: number; // 12–60
    thornBelts: "off" | "some";
    unstableCores: "off" | "on";
  };
  resources: {
    forestDensity: number; // 50–200 (%)
    groveSize: "scattered" | "normal" | "bigWoods";
    speciesMix: { pine: number; birch: number; oak: number; succulent: number }; // weights 0–100
    berriesNearStart: number; // 20–100
    berryBushes: number; // 50–300 (%)
    ruins: number; // 25–300 (%)
    relics: "off" | "some";
    geothermal: "off" | "some";
    mineSites: number; // 0–4
  };
  start: {
    area: "small" | "normal" | "large";
    rules: {
      waterWithin: number; // tiles to clean pumpable water
      treesWithin20: number;
      bushesWithin20: number;
      badwaterWithin: number; // no badwater within this many tiles
      ruinsWithin: number; // no ruins within this many tiles
    };
  };
}

export interface Region {
  runs: [number, number, number][];
}

export interface SetPieceRequest {
  kind: string;
  params: Record<string, unknown>;
  region?: Region;
}

export interface MapSpec {
  specVersion: 1;
  generatorVersion: string;
  seed: number;
  size: { x: number; y: number };
  theme: ThemeId;
  archetype: ArchetypeId;
  premise?: string;
  designedFor: Difficulty;
  settings: Settings;
  /** Room for Timber Together multi-colony maps (PLAN §20, D5). The generator builds only
   *  {count: 1, mod: "none"} until a milestone schedules multi-colony maps. */
  colonies: { count: 1 | 2 | 3 | 4; mod: "none" | "timberTogether" };
  setPieces: SetPieceRequest[];
  constraints: { locks: Region[]; keepOut: Region[]; keep: string[] };
  accepted?: { attempt: number; candidate: number };
}

// ---------------------------------------------------------------------------- presets (PLAN §6)

interface ThemePreset {
  relief: number;
  terracing: number;
  buildableLand: Settings["terrain"]["buildableLand"];
  rivers: number;
  riverStyle: Settings["water"]["riverStyle"];
  riverFlow: Settings["water"]["riverFlow"];
  droughtReserve: Settings["water"]["droughtReserve"];
  lakes: Settings["water"]["lakes"];
  waterfalls: Settings["water"]["waterfalls"];
  badwater: Settings["hazards"]["badwater"];
  thornBelts: Settings["hazards"]["thornBelts"];
  forestDensity: number;
  ruins: number;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  riverValley: { relief: 50, terracing: 45, buildableLand: "normal", rivers: 1, riverStyle: "meandering", riverFlow: "normal", droughtReserve: "normal", lakes: "some", waterfalls: "few", badwater: "normal", thornBelts: "some", forestDensity: 100, ruins: 100 },
  canyon: { relief: 80, terracing: 75, buildableLand: "tight", rivers: 1, riverStyle: "straight", riverFlow: "normal", droughtReserve: "normal", lakes: "few", waterfalls: "many", badwater: "normal", thornBelts: "off", forestDensity: 80, ruins: 120 },
  highlands: { relief: 90, terracing: 60, buildableLand: "tight", rivers: 2, riverStyle: "meandering", riverFlow: "normal", droughtReserve: "normal", lakes: "some", waterfalls: "many", badwater: "low", thornBelts: "some", forestDensity: 90, ruins: 100 },
  lakeBasin: { relief: 40, terracing: 40, buildableLand: "normal", rivers: 2, riverStyle: "meandering", riverFlow: "strong", droughtReserve: "plenty", lakes: "many", waterfalls: "few", badwater: "normal", thornBelts: "off", forestDensity: 100, ruins: 100 },
  delta: { relief: 20, terracing: 25, buildableLand: "generous", rivers: 1, riverStyle: "braided", riverFlow: "strong", droughtReserve: "scarce", lakes: "few", waterfalls: "off", badwater: "normal", thornBelts: "off", forestDensity: 120, ruins: 80 },
  islands: { relief: 35, terracing: 30, buildableLand: "normal", rivers: 1, riverStyle: "meandering", riverFlow: "lush", droughtReserve: "plenty", lakes: "none", waterfalls: "off", badwater: "low", thornBelts: "off", forestDensity: 100, ruins: 100 },
};

/** Start rules by difficulty (PLAN §5.6). */
export const DIFFICULTY_RULES: Record<Difficulty, Settings["start"]["rules"] & { berriesTarget: number }> = {
  easy: { waterWithin: 10, treesWithin20: 80, bushesWithin20: 20, badwaterWithin: 40, ruinsWithin: 20, berriesTarget: 20 },
  normal: { waterWithin: 16, treesWithin20: 50, bushesWithin20: 40, badwaterWithin: 30, ruinsWithin: 15, berriesTarget: 48 },
  hard: { waterWithin: 22, treesWithin20: 40, bushesWithin20: 40, badwaterWithin: 15, ruinsWithin: 12, berriesTarget: 60 },
};

export function mineSitesForSize(x: number, y: number): number {
  const area = x * y;
  return area <= 96 * 96 ? 1 : area <= 128 * 128 ? 2 : 3;
}

export function defaultSettings(theme: ThemeId, designedFor: Difficulty, size: { x: number; y: number }): Settings {
  const p = THEME_PRESETS[theme];
  const d = DIFFICULTY_RULES[designedFor];
  return {
    terrain: { relief: p.relief, highestTerrain: 16, terracing: p.terracing, buildableLand: p.buildableLand },
    water: {
      rivers: p.rivers,
      riverStyle: p.riverStyle,
      riverFlow: p.riverFlow,
      droughtReserve: p.droughtReserve,
      lakes: p.lakes,
      waterfalls: p.waterfalls,
    },
    hazards: { badwater: p.badwater, badwaterDistance: d.badwaterWithin, thornBelts: p.thornBelts, unstableCores: "off" },
    resources: {
      forestDensity: p.forestDensity,
      groveSize: "normal",
      speciesMix: { pine: 47, birch: 27, oak: 20, succulent: 6 },
      berriesNearStart: d.berriesTarget,
      berryBushes: 100,
      ruins: p.ruins,
      relics: "some",
      geothermal: "some",
      mineSites: mineSitesForSize(size.x, size.y),
    },
    start: {
      area: "normal",
      rules: {
        waterWithin: d.waterWithin,
        treesWithin20: d.treesWithin20,
        bushesWithin20: d.bushesWithin20,
        badwaterWithin: d.badwaterWithin,
        ruinsWithin: d.ruinsWithin,
      },
    },
  };
}

export function makeSpec(opts: {
  seed: number;
  size?: { x: number; y: number };
  theme?: ThemeId;
  designedFor?: Difficulty;
}): MapSpec {
  const theme = opts.theme ?? "riverValley";
  const designedFor = opts.designedFor ?? "normal";
  const size = opts.size ?? { x: 128, y: 128 };
  return {
    specVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    seed: opts.seed >>> 0,
    size: { x: size.x, y: size.y },
    theme,
    archetype: theme,
    designedFor,
    settings: defaultSettings(theme, designedFor, size),
    colonies: { count: 1, mod: "none" },
    setPieces: [],
    constraints: { locks: [], keepOut: [], keep: [] },
  };
}

/** Seeds may be typed as text; anything that is not a plain uint32 is hashed (PLAN §5.1). */
export function seedFromText(text: string): number {
  const t = text.trim();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n <= 0xffffffff) return n;
  }
  return hash32("seed", t);
}

// ---------------------------------------------------------------------------- URL codec (PLAN §14.5)

const DIFFS: Record<string, Difficulty> = { e: "easy", n: "normal", h: "hard" };

/** `v=<generatorVersion>&s=<seed>&t=<theme>&z=<size>&d=<difficulty>`. M1 encodes these basics;
 *  settings that differ from the theme preset are added with the full settings panel (M6). */
export function encodeSpecFragment(spec: MapSpec): string {
  const z = spec.size.x === spec.size.y ? String(spec.size.x) : `${spec.size.x}x${spec.size.y}`;
  const params = new URLSearchParams();
  params.set("v", spec.generatorVersion);
  params.set("s", String(spec.seed));
  params.set("t", spec.theme);
  params.set("z", z);
  params.set("d", spec.designedFor[0]);
  return params.toString();
}

export interface DecodedFragment {
  spec: MapSpec;
  version: string;
  problems: string[];
}

export function decodeSpecFragment(fragment: string): DecodedFragment | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  if (!params.has("s")) return null;
  const problems: string[] = [];
  const seed = seedFromText(params.get("s") ?? "0");
  const t = params.get("t") ?? "riverValley";
  let theme: ThemeId = "riverValley";
  if ((THEMES as readonly string[]).includes(t)) theme = t as ThemeId;
  else problems.push(`unknown theme "${t}"`);
  const d = DIFFS[params.get("d") ?? "n"] ?? "normal";
  let size = { x: 128, y: 128 };
  const z = params.get("z") ?? "128";
  const m = /^(\d+)(?:x(\d+))?$/.exec(z);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2] ?? m[1]);
    if (x >= MIN_SIDE && x <= MAX_SIDE && y >= MIN_SIDE && y <= MAX_SIDE) size = { x, y };
    else problems.push(`size ${z} is outside ${MIN_SIDE}–${MAX_SIDE}`);
  } else problems.push(`bad size "${z}"`);
  return { spec: makeSpec({ seed, size, theme, designedFor: d }), version: params.get("v") ?? GENERATOR_VERSION, problems };
}
