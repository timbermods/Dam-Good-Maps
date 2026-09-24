// The map document and its project file (PLAN §19.6, EDITOR_PLAN §3). A generated map's document
// holds its spec, the features it was built from and the built base, so the editor opens exactly
// what the generator made, and rebuilding it reproduces the .timber byte for byte.
// The project file (`.damgoodmaps.json`) is the document as JSON, gzip-compressed.

import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import type { Feature } from "../features/schema";
import type { MapSpec } from "../spec/mapspec";
import type { BuildResult } from "../features/build";
import { description, mapName } from "../gen/pack";

export const DOCUMENT_FORMAT_VERSION = 1;

export interface MapDocument {
  formatVersion: 1;
  app: "dam-good-maps";
  /** The generator that built `base`. */
  generatorVersion: string;
  /** The spec, with `accepted` filled in; null for imported maps. */
  spec: MapSpec | null;
  /** The built base: surface heights (base64 of one byte per tile, row-major). Never mutated. */
  base: { sizeX: number; sizeY: number; heights: string };
  features: Feature[];
  /** Edit operations (the editor, roadmap M3). */
  edits: unknown[];
  locks: unknown[];
  meta: { name: string; premise: string; designedFor: "easy" | "normal" | "hard" };
}

export function toDocument(spec: MapSpec, features: Feature[], built: BuildResult): MapDocument {
  return {
    formatVersion: 1,
    app: "dam-good-maps",
    generatorVersion: spec.generatorVersion,
    spec,
    base: { sizeX: built.W, sizeY: built.H, heights: toBase64(built.heights) },
    features,
    edits: [],
    locks: [],
    meta: { name: mapName(spec), premise: description(spec), designedFor: spec.designedFor },
  };
}

export function encodeProject(doc: MapDocument): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(doc)), { level: 9, mtime: 0 });
}

export function decodeProject(bytes: Uint8Array): MapDocument {
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes);
  const doc = JSON.parse(text) as MapDocument;
  if (doc.app !== "dam-good-maps" || doc.formatVersion !== 1) throw new Error("not a Dam Good Maps project file");
  return doc;
}

export function projectFileName(spec: MapSpec): string {
  return `${mapName(spec)} (${spec.seed}).damgoodmaps.json`;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[n >> 18] + B64[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out[o++] = n >> 16;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}
