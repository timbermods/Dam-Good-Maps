// A built map as a native 1.1 .timber (FORMAT.md §8): voxels from the heights, simulation
// singletons pre-filled with the canonical settle (water, soil moisture and contamination, as
// official maps ship), entities, metadata, a 960×540 thumbnail. `pack(build(spec, features))` is
// the one path to file bytes (PLAN §19.7). `emptyWater` writes the same map with no water, for the
// in-game A/B check (PLAN §14.4, §18 B2).

import { entityJson } from "../format/entities";
import { mapMetadata, writeTimber, type TimberFile } from "../format/timber";
import { emptySimulationSingletons, GAME_VERSION, LAYERS, settledSimulationSingletons, voxelsFromHeights, type WorldModel } from "../format/world";
import { thumbnailJpeg } from "../render/shade";
import type { BuildResult } from "../features/build";
import { GENERATOR_VERSION, THEME_NAMES, type MapSpec } from "../spec/mapspec";

/** Written into world.json; never read by the game (FORMAT.md §4.1). Fixed so files reproduce. */
export const TIMESTAMP = "2026-01-01 00:00:00";

export function mapName(spec: MapSpec): string {
  return THEME_NAMES[spec.theme];
}

export function fileName(spec: MapSpec): string {
  return `${mapName(spec)} (${spec.seed}).timber`;
}

export function description(spec: MapSpec): string {
  const size = `${spec.size.x}×${spec.size.y}`;
  const marsh = spec.settings.hazards.badwater !== "off" ? ", past a badwater marsh," : "";
  return (
    `${THEME_NAMES[spec.theme]}, ${size}, designed for ${spec.designedFor}. A river enters from the west, ` +
    `drops over a cascade into a basin that a rock ridge pinches into a gorge (one short dam there holds a ` +
    `reservoir), then over falls${marsh} and out to the east. Made with Dam Good Maps ${GENERATOR_VERSION}, seed ${spec.seed}.`
  );
}

export interface PackOptions {
  /** Write no water, moisture or contamination: the game fills the rivers in about a day. */
  emptyWater?: boolean;
  /** Use this thumbnail instead of drawing one (checks that only read its size). */
  thumbnail?: Uint8Array;
}

export function toWorld(spec: MapSpec, built: BuildResult, opts: PackOptions = {}): WorldModel {
  const singletons = opts.emptyWater
    ? emptySimulationSingletons(built.W, built.H, 1)
    : settledSimulationSingletons(built.W, built.H, {
        floor: built.heights,
        depth: built.water,
        contamination: built.contamination,
        moisture: built.moisture,
        soilContamination: built.soilContamination,
        sat: built.settle.sat,
      });
  return {
    gameVersion: GAME_VERSION,
    timestamp: TIMESTAMP,
    sizeX: built.W,
    sizeY: built.H,
    layers: LAYERS,
    voxels: voxelsFromHeights(built.heights, built.W, built.H),
    singletons,
    entities: built.entities.map(entityJson),
  };
}

export function toTimberFile(spec: MapSpec, built: BuildResult, opts: PackOptions = {}): TimberFile {
  return {
    metadata: mapMetadata(built.W, built.H, description(spec) + (opts.emptyWater ? " This copy starts without water." : "")),
    thumbnail: opts.thumbnail ?? thumbnailJpeg(built.heights, built.W, built.H, built.water),
    versionTxt: GAME_VERSION + "\r\n",
    world: toWorld(spec, built, opts),
    extraFiles: [],
  };
}

export function pack(spec: MapSpec, built: BuildResult, opts: PackOptions = {}): Uint8Array {
  return writeTimber(toTimberFile(spec, built, opts));
}
