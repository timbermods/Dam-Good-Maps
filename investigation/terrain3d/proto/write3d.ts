// A .timber with terrain above terrain and its settled stacked water (FORMAT.md, extended):
// - `WaterMapNew.Levels` = the most water columns of any tile; tokens per (slot, tile) in the
//   game's slot order, `depth:contamination:overflow:floor:depth`, outflows all "0";
// - `WaterEvaporationMap` with the same levels (the modifier of each column's saturation);
// - `SoilMoistureSimulator` / `SoilContaminationSimulator` with `Size` = the most terrain runs of
//   any tile, all zero: the game recomputes them within about 20 ticks (FORMAT.md §4.3). Moisture
//   per run top is DESIGN.md §2.5's work, not this prototype's.

import { writeTimber, mapMetadata } from "../../../src/core/format/timber";
import { emptySimulationSingletons, numToken, repeatToken, GAME_VERSION, type WorldModel } from "../../../src/core/format/world";
import { entityJson, type EntitySpec } from "../../../src/core/format/entities";
import { thumbnailJpeg } from "../../../src/core/render/shade";
import type { JsonObject } from "../../../src/core/format/json";
import { terrainRuns, type WaterColumns } from "./columns";
import type { StackSim } from "./stackwater";

export function stackedSingletons(W: number, H: number, voxels: Uint8Array, cols: WaterColumns, sim: StackSim | null): JsonObject {
  const N = W * H;
  const L = cols.L;
  const runs = terrainRuns(W, H, voxels);
  const s = emptySimulationSingletons(W, H, L);
  const water: string[] = new Array(L * N).fill("0");
  const evap: string[] = new Array(L * N).fill("1");
  if (sim) {
    const sat = sim.saturation();
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < cols.count[i]; k++) {
        const c = k * N + i;
        const d = sim.D[c];
        const o = sim.O[c];
        if (d > 1e-6 || o > 1e-6) {
          const ds = numToken(d);
          const cc = sim.C[c];
          water[c] = `${ds}:${cc > 1e-6 ? numToken(cc) : "0"}:${o > 1e-6 ? numToken(o) : "0"}:${cols.floor[c]}:${ds}`;
        }
        if (sat[c] > 0) {
          const t = 10 - sat[c];
          evap[c] = numToken(0.0595 * (t * t) + 0.101 * t + 0.72);
        }
      }
    }
  }
  (s.WaterMapNew as JsonObject).WaterColumns = { Array: water.join(" ") };
  (s.WaterEvaporationMap as JsonObject).EvaporationModifiers = { Array: evap.join(" ") };
  const zeros = repeatToken("0", runs.L * N);
  s.SoilMoistureSimulator = { Size: runs.L, MoistureLevels: { Array: zeros } };
  s.SoilContaminationSimulator = { Size: runs.L, ContaminationCandidates: { Array: zeros }, ContaminationLevels: { Array: zeros } };
  return s;
}

export function writeStacked(W: number, H: number, voxels: Uint8Array, cols: WaterColumns, sim: StackSim | null, entities: EntitySpec[], description: string): Uint8Array {
  const singletons = stackedSingletons(W, H, voxels, cols, sim);
  const world: WorldModel = {
    gameVersion: GAME_VERSION,
    timestamp: "2026-09-25 12:00:00",
    sizeX: W,
    sizeY: H,
    layers: 23,
    voxels,
    singletons,
    entities: entities.map(entityJson),
  };
  // the thumbnail shows the top surface, as the game's own does
  const N = W * H;
  const heights = new Uint8Array(N);
  for (let i = 0; i < N; i++) for (let z = 22; z >= 0; z--) if (voxels[z * N + i]) { heights[i] = z + 1; break; }
  const thumb = thumbnailJpeg(heights, W, H, null);
  return writeTimber({ metadata: mapMetadata(W, H, description), thumbnail: thumb, versionTxt: GAME_VERSION + "\r\n", world, extraFiles: [] });
}
