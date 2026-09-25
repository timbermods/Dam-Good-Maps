// Load a map the way the app does: its own reader and importer (PLAN §19.6), which normalizes any
// map the game can load (0.6 heightmaps, 0.7, 1.0, 1.1) into a native 1.1 map. Saves are refused
// by the importer; maps that need mods are recognised here and skipped.

import { readFileSync } from "node:fs";
import { importDocument } from "../../../src/core/doc/document";
import { fileFromBase } from "../../../src/core/doc/base";
import { readTimber, type TimberFile } from "../../../src/core/format/timber";
import { FACTION_ONLY_PLANTS, ImportError, type ImportReport } from "../../../src/core/format/normalize";
import { LAYERS } from "../../../src/core/format/world";
import type { MapRef } from "./paths";

/** Templates a vanilla 1.1 map may hold: the Common set (validate/checks.ts), the plants of one
 *  faction, the district centers, and the legacy names the game renames on load. */
export const VANILLA = new Set([
  "Pine", "Birch", "Oak", "Succulent", "BlueberryBush",
  "Blockage", "GeothermalField", "LargeRelic", "MediumRelic", "SmallRelic", "NaturalDam",
  "NaturalOverhang2x1", "NaturalOverhang3x1", "NaturalOverhang4x1", "ReservePile", "ReserveTank", "ReserveWarehouse",
  "Slope", "Thorns", "UnstableCore", "RuinColumnH1", "RuinColumnH2", "RuinColumnH3", "RuinColumnH4", "RuinColumnH5",
  "RuinColumnH6", "RuinColumnH7", "RuinColumnH8", "UndergroundRuins", "StartingLocation", "AncientAquiferDrill", "Aquifer",
  "BadtideDrain", "BadwaterSeep", "BadwaterSource", "WaterSeep", "WaterSource",
  "DistrictCenter.Folktails", "DistrictCenter.IronTeeth",
  ...FACTION_ONLY_PLANTS,
  "Barrier", "Bramble", "Bomb", "Cactus",
]);

export type Era = "pre-1.0" | "1.0+";

export interface Loaded {
  ref: MapRef;
  /** The normalized map (null when skipped). */
  file: TimberFile | null;
  report: ImportReport | null;
  /** The file's own version stamp, and its format family. */
  version: string;
  format: "0.6" | "0.7" | "1.0" | "1.1" | "unknown";
  era: Era;
  W: number;
  H: number;
  /** Voxel layers in the file before normalization, and solid voxels above layer 21 (a map built
   *  with a taller-terrain mod: the game drops them). */
  layers: number;
  voxelsAboveVanilla: number;
  legacyHeightmap: boolean;
  templates: Record<string, number>;
  unknownTemplates: string[];
  skip: string | null;
}

export function formatOf(version: string, legacy: boolean): Loaded["format"] {
  if (legacy) return "0.6";
  const m = /^(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return "unknown";
  const v = `${m[1]}.${m[2]}`;
  if (v === "0.6" || v === "0.7" || v === "1.0" || v === "1.1") return v;
  if (Number(m[1]) === 0) return Number(m[2]) < 7 ? "0.6" : "0.7";
  return "1.1";
}

export function eraOf(format: Loaded["format"]): Era {
  return format === "1.0" || format === "1.1" ? "1.0+" : "pre-1.0";
}

export function loadMap(ref: MapRef): Loaded {
  const bytes = new Uint8Array(readFileSync(ref.path));
  let raw: TimberFile;
  try {
    raw = readTimber(bytes);
  } catch (e) {
    return blank(ref, `unreadable: ${(e as Error).message}`);
  }
  const w = raw.world;
  const plane = w.sizeX * w.sizeY;
  let above = 0;
  for (let v = (LAYERS - 1) * plane; v < w.voxels.length; v++) above += w.voxels[v];
  const templates: Record<string, number> = {};
  for (const e of w.entities) {
    const t = String(e.Template);
    templates[t] = (templates[t] ?? 0) + 1;
  }
  const unknown = Object.keys(templates).filter((t) => !VANILLA.has(t)).sort();
  const format = formatOf(w.gameVersion, !!w.legacy);
  const base: Loaded = {
    ref,
    file: null,
    report: null,
    version: w.gameVersion,
    format,
    era: eraOf(format),
    W: w.sizeX,
    H: w.sizeY,
    layers: w.layers,
    voxelsAboveVanilla: above,
    legacyHeightmap: !!w.legacy,
    templates,
    unknownTemplates: unknown,
    skip: null,
  };
  let doc;
  try {
    doc = importDocument(bytes, ref.fileName);
  } catch (e) {
    if (e instanceof ImportError) return { ...base, skip: "save: the importer refuses saved games" };
    return { ...base, skip: `import failed: ${(e as Error).message}` };
  }
  if (unknown.length) return { ...base, skip: `needs mods: templates ${unknown.join(", ")}` };
  if (above > 0) return { ...base, skip: `needs mods: ${above} terrain voxels above the vanilla height limit (${w.layers} layers)` };
  // vanilla keeps one StartingLocation; maps with more are made for a multiplayer mod
  // (BeaverBuddies, Timber Together) and crash or lose starts in the unmodded game
  const starts = templates.StartingLocation ?? 0;
  if (starts > 1) return { ...base, skip: `needs mods: ${starts} starts, a multiplayer map (BeaverBuddies)` };
  return { ...base, file: fileFromBase(doc.base), report: doc.meta.source?.report ?? null };
}

function blank(ref: MapRef, skip: string): Loaded {
  return { ref, file: null, report: null, version: "", format: "unknown", era: "pre-1.0", W: 0, H: 0, layers: 0, voxelsAboveVanilla: 0, legacyHeightmap: false, templates: {}, unknownTemplates: [], skip };
}

/** Size classes of investigation/analyze_maps.py: small up to about 100², medium 128², large
 *  192² and 151×251, max 256×150 and up. */
export function sizeClass(area: number): "small" | "medium" | "large" | "max" {
  if (area <= 12_000) return "small";
  if (area <= 20_000) return "medium";
  if (area <= 45_000) return "large";
  return "max";
}
