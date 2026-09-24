// The .timber container (FORMAT.md §1): a zip with map_metadata.json, map_thumbnail.jpg,
// version.txt and world.json at the root, Deflate. Entry dates come from the world Timestamp, so
// the same map always gives the same bytes.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { parse, stringify, type JsonObject } from "./json";
import { decodeWorld, encodeWorld, GAME_VERSION, type WorldModel } from "./world";

export interface TimberFile {
  /** map_metadata.json, or null for a save (which carries save_metadata.json instead). */
  metadata: JsonObject | null;
  thumbnail: Uint8Array | null;
  versionTxt: string;
  world: WorldModel;
  /** Any other entries, in file order (save_metadata.json, save_thumbnail.jpg, ...). */
  extraFiles: [string, Uint8Array][];
}

export function mapMetadata(sizeX: number, sizeY: number, description: string, extra: JsonObject = {}): JsonObject {
  return {
    Width: sizeX,
    Height: sizeY,
    MapNameLocKey: "",
    MapDescriptionLocKey: "",
    MapDescription: description,
    IsRecommended: false,
    IsUnconventional: false,
    IsDev: false,
    ...extra,
  };
}

/** Zip entry time from "yyyy-MM-dd HH:mm:ss". fflate reads local-time fields from the Date, and a
 *  Date built from local components returns those same fields in every time zone. */
function entryTime(timestamp: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(timestamp);
  if (!m) return new Date(2026, 0, 1, 0, 0, 0);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export function writeTimber(file: TimberFile): Uint8Array {
  const mtime = entryTime(file.world.timestamp);
  const opts = { level: 6 as const, mtime };
  const entries: Zippable = {};
  if (file.metadata) {
    const meta: JsonObject = { ...file.metadata, Width: file.world.sizeX, Height: file.world.sizeY };
    entries["map_metadata.json"] = [strToU8(stringify(meta)), opts];
    if (file.thumbnail) entries["map_thumbnail.jpg"] = [file.thumbnail, opts];
  }
  for (const [name, data] of file.extraFiles) entries[name] = [data, opts];
  entries["version.txt"] = [strToU8(file.versionTxt), opts];
  entries["world.json"] = [strToU8(encodeWorld(file.world)), opts];
  return zipSync(entries);
}

export function readTimber(bytes: Uint8Array): TimberFile {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const byName = (n: string) => {
    // entries are matched by file name only, like the game (FORMAT.md §1)
    const key = names.find((k) => k === n || k.endsWith("/" + n));
    return key ? files[key] : undefined;
  };
  const worldBytes = byName("world.json");
  if (!worldBytes) throw new Error("not a .timber file: world.json missing");
  const world = decodeWorld(strFromU8(worldBytes));
  const metaBytes = byName("map_metadata.json");
  const metadata = metaBytes ? (parse(strFromU8(metaBytes)) as JsonObject) : null;
  const versionBytes = byName("version.txt");
  const known = new Set(["world.json", "map_metadata.json", "map_thumbnail.jpg", "version.txt"]);
  return {
    metadata,
    thumbnail: byName("map_thumbnail.jpg") ?? null,
    versionTxt: versionBytes ? strFromU8(versionBytes) : GAME_VERSION + "\r\n",
    world,
    extraFiles: names.filter((n) => !known.has(n.split("/").pop()!)).map((n) => [n, files[n]] as [string, Uint8Array]),
  };
}
