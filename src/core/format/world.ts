// world.json in memory (FORMAT.md §4). Terrain voxels live in a Uint8Array (index z·X·Y + y·X + x,
// 1 = solid); every other singleton and every entity is kept as parsed JSON, so unknown data passes
// through untouched and an unedited file re-serializes byte for byte.

import { F, isObject, num, parse, stringify, type JsonObject, type JsonValue } from "./json";

export const GAME_VERSION = "1.1.2.4-52e959e-sw";
export const LAYERS = 23; // MaxGameTerrainHeight 22 + 1
export const MAX_OBJECT_Z = 33; // terrain layers + 10 above
export const EDITOR_MAX_HEIGHT = 16;

export interface WorldModel {
  gameVersion: string;
  timestamp: string;
  sizeX: number;
  sizeY: number;
  layers: number;
  voxels: Uint8Array;
  /** Every singleton in file order. TerrainMap.Voxels.Array is rebuilt from `voxels` on write. */
  singletons: JsonObject;
  entities: JsonObject[];
  /** Read from a pre-0.7 heightmap map: readable, never written back. */
  legacy?: boolean;
}

// ---------------------------------------------------------------- voxels <-> text

export function encodeVoxels(voxels: Uint8Array): string {
  const n = voxels.length;
  if (n === 0) return "";
  const bytes = new Uint8Array(2 * n - 1);
  for (let i = 0, j = 0; i < n; i++, j += 2) {
    bytes[j] = voxels[i] ? 49 : 48;
    if (j + 1 < bytes.length) bytes[j + 1] = 32;
  }
  return new TextDecoder("latin1").decode(bytes);
}

export function decodeVoxels(text: string): Uint8Array {
  // tokens are single "0"/"1" separated by single spaces
  const n = (text.length + 1) >> 1;
  const out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 2) {
    const c = text.charCodeAt(j);
    if (c === 49) out[i] = 1;
    else if (c !== 48) throw new Error(`voxel token ${text[j]} at ${i}`);
  }
  return out;
}

/** Surface: the first free layer above the topmost solid voxel of each column (entity Z). */
export function surfaceOf(w: Pick<WorldModel, "sizeX" | "sizeY" | "layers" | "voxels">): Uint8Array {
  const { sizeX: X, sizeY: Y, layers: L, voxels } = w;
  const out = new Uint8Array(X * Y);
  const plane = X * Y;
  for (let i = 0; i < plane; i++) {
    for (let z = L - 1; z >= 0; z--) {
      if (voxels[z * plane + i]) {
        out[i] = z + 1;
        break;
      }
    }
  }
  return out;
}

/** Solid-to-air transitions per column (a column solid to the top counts one). */
export function floorsOf(w: Pick<WorldModel, "sizeX" | "sizeY" | "layers" | "voxels">): Uint8Array {
  const { sizeX: X, sizeY: Y, layers: L, voxels } = w;
  const plane = X * Y;
  const out = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    let n = 0;
    for (let z = 0; z < L - 1; z++) if (voxels[z * plane + i] && !voxels[(z + 1) * plane + i]) n++;
    if (voxels[(L - 1) * plane + i]) n++;
    out[i] = n;
  }
  return out;
}

export function voxelsFromHeights(heights: Uint8Array, sizeX: number, sizeY: number, layers = LAYERS): Uint8Array {
  const plane = sizeX * sizeY;
  const out = new Uint8Array(plane * layers);
  for (let i = 0; i < plane; i++) {
    const h = Math.min(heights[i], layers);
    for (let z = 0; z < h; z++) out[z * plane + i] = 1;
  }
  return out;
}

// ---------------------------------------------------------------- simulation state singletons

/** Fresh singletons for a new heightfield map (FORMAT.md §4.3): no water, no moisture, no
 *  contamination, neutral evaporation. `WaterSimulationMigrator.IsMigrated` must be true or the
 *  game halves every source's strength. The editor-only thumbnail camera is left out. */
export function emptySimulationSingletons(sizeX: number, sizeY: number, levels = 1): JsonObject {
  const n = levels * sizeX * sizeY;
  const zeros = repeatToken("0", n);
  return {
    MapSize: { Size: { X: sizeX, Y: sizeY } },
    TerrainMap: { Voxels: { Array: "" } },
    HazardousWeatherHistory: { HistoryData: [] },
    WaterEvaporationMap: { Levels: levels, EvaporationModifiers: { Array: repeatToken("1", n) } },
    WaterSimulationMigrator: { IsMigrated: true },
    WaterMapNew: { Levels: levels, WaterColumns: { Array: zeros }, ColumnOutflows: { Array: zeros } },
    SoilMoistureSimulator: { Size: levels, MoistureLevels: { Array: zeros } },
    SoilContaminationSimulator: {
      Size: levels,
      ContaminationCandidates: { Array: zeros },
      ContaminationLevels: { Array: zeros },
    },
    NumberedEntityNamerService: { NextNumbers: [] },
    WindService: { WindStrength: F(0), WindDirection: { X: F(0), Y: F(0) }, NextWindChangeTime: F(0) },
  };
}

export function repeatToken(token: string, n: number): string {
  if (n <= 0) return "";
  return (token + " ").repeat(n - 1) + token;
}

// ---------------------------------------------------------------- encode / decode

export function encodeWorld(w: WorldModel): string {
  if (w.legacy) throw new Error("pre-0.7 heightmap maps are read-only");
  const singletons: JsonObject = {};
  for (const k in w.singletons) singletons[k] = w.singletons[k];
  singletons.MapSize = { ...(w.singletons.MapSize as JsonObject), Size: { X: w.sizeX, Y: w.sizeY } };
  singletons.TerrainMap = { ...(w.singletons.TerrainMap as JsonObject), Voxels: { Array: encodeVoxels(w.voxels) } };
  return stringify({ GameVersion: w.gameVersion, Timestamp: w.timestamp, Singletons: singletons, Entities: w.entities });
}

export function decodeWorld(text: string): WorldModel {
  const root = parse(text);
  if (!isObject(root)) throw new Error("world.json is not an object");
  const s = root.Singletons;
  if (!isObject(s)) throw new Error("world.json has no Singletons");
  const ms = s.MapSize;
  if (!isObject(ms) || !isObject(ms.Size)) throw new Error("world.json has no MapSize");
  const sizeX = num(ms.Size.X);
  const sizeY = num(ms.Size.Y);
  const entities = (root.Entities ?? []) as JsonValue[];
  const terrain = s.TerrainMap;
  let voxels: Uint8Array;
  let layers: number;
  let legacy = false;
  if (isObject(terrain) && isObject(terrain.Voxels)) {
    voxels = decodeVoxels(String(terrain.Voxels.Array));
    if (voxels.length % (sizeX * sizeY)) throw new Error(`voxel count ${voxels.length} is not a multiple of ${sizeX}x${sizeY}`);
    layers = voxels.length / (sizeX * sizeY);
  } else if (isObject(terrain) && isObject(terrain.Heights)) {
    // 0.6 maps: Heights[y*X + x] is the surface layer (FORMAT.md §4.3)
    const heights = new Uint8Array(String(terrain.Heights.Array).split(" ").map(Number));
    layers = LAYERS;
    voxels = voxelsFromHeights(heights, sizeX, sizeY, layers);
    legacy = true;
  } else {
    throw new Error("world.json has no TerrainMap");
  }
  return {
    gameVersion: String(root.GameVersion ?? ""),
    timestamp: String(root.Timestamp ?? ""),
    sizeX,
    sizeY,
    layers,
    voxels,
    singletons: s,
    entities: entities as JsonObject[],
    legacy,
  };
}
