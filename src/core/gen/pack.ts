// A built map as a native 1.1 .timber (FORMAT.md §8): voxels from the heights, simulation
// singletons pre-filled with the canonical settle (water, soil moisture and contamination, as
// official maps ship), entities, metadata, a 960×540 thumbnail. `pack(build(spec, features))` is
// the one path to file bytes (PLAN §19.7). `emptyWater` writes the same map with no water, for the
// in-game A/B check (PLAN §14.4, §18 B2).

import { entityJson } from "../format/entities";
import { mapMetadata, writeTimber, type TimberFile } from "../format/timber";
import { emptySimulationSingletons, GAME_VERSION, LAYERS, settledSimulationSingletons, voxelsFromHeights, type WorldModel } from "../format/world";
import { thumbnailJpeg } from "../render/shade";
import { NO_BADWATER_NOTE } from "../resources/badwater";
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
  const w = spec.settings.water;
  const falls = w.waterfalls !== "off";
  let body: string;
  switch (spec.archetype) {
    case "canyon":
      body =
        `A river runs deep in a canyon${falls ? ", over falls," : ""} through a narrows where one short dam holds a reservoir. ` +
        "A flight of steps climbs the canyon wall beside the start.";
      break;
    case "lakeBasin":
      body =
        `${w.rivers > 1 ? "Rivers run into" : w.rivers === 1 ? "A river runs into" : "A spring fills"} a lake at the heart of the map. ` +
        "Its one outlet runs through a narrow gap, where a short dam raises the whole lake.";
      break;
    default:
      body =
        `A river crosses the valley${falls ? " and drops over a cascade" : ""} into a basin that a rock ridge pinches into a gorge ` +
        `(one short dam there holds a reservoir), then flows on${falls ? " over falls" : ""} and out.`;
  }
  // the player's No badwater is recorded, so the map says so wherever it goes (D200)
  const bad = spec.settings.hazards.badwater !== "off" ? " Badwater rises in side basins; a levee on a basin's outlet holds it back." : ` ${NO_BADWATER_NOTE}`;
  return `${THEME_NAMES[spec.theme]}, ${size}, designed for ${spec.designedFor}. ${body}${bad} Made with Dam Good Maps ${GENERATOR_VERSION}, seed ${spec.seed}.`;
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
