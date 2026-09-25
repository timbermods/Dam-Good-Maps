// Load a .timber map into the stacked-column model: normalized as the importer does (the 0.7→1.0
// halving of source strength when WaterSimulationMigrator is missing), terrain runs, water columns
// with the map objects' obstacles, emitters at their z, and the water the file stores, by slot.

import { readFileSync } from "node:fs";
import { readTimber } from "../../../src/core/format/timber";
import { normalizeImport } from "../../../src/core/format/normalize";
import { isObject, num, type JsonObject } from "../../../src/core/format/json";
import { mapObjects, EMITTERS, MAX_STRENGTH_PER_TILE, SEEP_OFF, SEEP_ON, isDelayed, specifiedStrength, objectTile } from "../../../src/core/sim/model";
import { terrainRuns, waterColumns, slotAt, type TerrainRuns, type WaterColumns } from "./columns";
import type { StackEmitter, StackModel } from "./stackwater";

export interface LoadedMap {
  name: string;
  W: number;
  H: number;
  voxels: Uint8Array;
  runs: TerrainRuns;
  cols: WaterColumns;
  model: StackModel;
  /** The file's water per column id (slot·N + tile), mapped by slot as the game loads it. */
  stored: { depth: Float64Array; overflow: Float64Array; cont: Float64Array; levels: number; ok: boolean };
  gameVersion: string;
  migrated: boolean;
}

export function loadMap(path: string, name = path): LoadedMap {
  const file = readTimber(new Uint8Array(readFileSync(path)));
  const hadMigrator = isObject(file.world.singletons.WaterSimulationMigrator) && (file.world.singletons.WaterSimulationMigrator as JsonObject).IsMigrated === true;
  const gameVersion = file.world.gameVersion;
  normalizeImport(file);
  const w = file.world;
  const W = w.sizeX;
  const H = w.sizeY;
  const runs = terrainRuns(W, H, w.voxels, w.layers);
  const objects = mapObjects(w);
  const cols = waterColumns(W, H, w.voxels, objects, w.layers);
  const N = W * H;

  const emitters: StackEmitter[] = [];
  for (const o of objects) {
    const rule = EMITTERS[o.template];
    if (!rule) continue;
    const ec: number[] = [];
    const tiles: number[] = [];
    for (const [lx, ly] of rule.tiles) {
      const [x, y] = objectTile(o, lx, ly);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x;
      tiles.push(i);
      const s = slotAt(cols, i, o.z);
      if (s >= 0) ec.push(s * N + i);
    }
    if (!tiles.length) continue;
    let strength = rule.runs && !isDelayed(o.components) ? specifiedStrength(o.components) : 0;
    if (strength > MAX_STRENGTH_PER_TILE * rule.tiles.length) strength = MAX_STRENGTH_PER_TILE * rule.tiles.length;
    if (!(strength > 0) || !ec.length) strength = 0;
    const e: StackEmitter = { cols: ec.length ? ec : [], tiles, strength, contamination: rule.contamination };
    if (rule.seep && ec.length) e.depthLimit = { anchor: ec[0], off: SEEP_OFF, on: SEEP_ON };
    emitters.push(e);
  }

  // stored water: WaterSimulator.PostLoad copies depth, overflow and contamination by slot index
  const M = cols.L * N;
  const depth = new Float64Array(M);
  const overflow = new Float64Array(M);
  const cont = new Float64Array(M);
  let levels = 0;
  let ok = false;
  const wm = w.singletons.WaterMapNew;
  if (isObject(wm) && isObject(wm.WaterColumns)) {
    levels = num(wm.Levels ?? 1);
    const tokens = String((wm.WaterColumns as JsonObject).Array).split(" ");
    if (tokens.length >= levels * N) {
      ok = true;
      for (let i = 0; i < N; i++) {
        for (let s = 0; s < cols.count[i]; s++) {
          const k = s * N + i;
          if (s >= levels) continue;
          const t = tokens[k];
          if (t === "0") continue;
          const f = t.split(":");
          depth[k] = Number(f[0]) || 0;
          cont[k] = Number(f[1]) || 0;
          overflow[k] = Number(f[2]) || 0;
        }
      }
    }
  }
  return {
    name,
    W,
    H,
    voxels: w.voxels,
    runs,
    cols,
    model: { cols, emitters },
    stored: { depth, overflow, cont, levels, ok },
    gameVersion,
    migrated: hadMigrator,
  };
}
