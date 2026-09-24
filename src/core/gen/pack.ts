// A built map as a native 1.1 .timber (FORMAT.md §8): voxels from the heights, fresh simulation
// singletons (M1 writes no water; M2 pre-fills the canonical settle), entities, metadata, a
// 960×540 thumbnail. `pack(build(spec, features))` is the one path to file bytes (PLAN §19.7).

import { entityJson } from "../format/entities";
import { mapMetadata, writeTimber, type TimberFile } from "../format/timber";
import { emptySimulationSingletons, GAME_VERSION, LAYERS, voxelsFromHeights, type WorldModel } from "../format/world";
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
  return (
    `${THEME_NAMES[spec.theme]}, ${size}, designed for ${spec.designedFor}. A river enters from the west, ` +
    `drops over a cascade into a basin that a rock ridge pinches into a gorge (one short dam there holds a ` +
    `reservoir), then over falls and out to the east. Made with Dam Good Maps ${GENERATOR_VERSION}, seed ${spec.seed}.`
  );
}

export function toWorld(spec: MapSpec, built: BuildResult): WorldModel {
  return {
    gameVersion: GAME_VERSION,
    timestamp: TIMESTAMP,
    sizeX: built.W,
    sizeY: built.H,
    layers: LAYERS,
    voxels: voxelsFromHeights(built.heights, built.W, built.H),
    singletons: emptySimulationSingletons(built.W, built.H, 1),
    entities: built.entities.map(entityJson),
  };
}

export function toTimberFile(spec: MapSpec, built: BuildResult): TimberFile {
  return {
    metadata: mapMetadata(built.W, built.H, description(spec)),
    thumbnail: thumbnailJpeg(built.heights, built.W, built.H, built.water),
    versionTxt: GAME_VERSION + "\r\n",
    world: toWorld(spec, built),
    extraFiles: [],
  };
}

export function pack(spec: MapSpec, built: BuildResult): Uint8Array {
  return writeTimber(toTimberFile(spec, built));
}
