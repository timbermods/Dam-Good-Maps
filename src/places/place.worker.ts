// Builds a real place's .timber off the main thread, so the gallery stays responsive while the
// water settles (several seconds at 256²). The build is src/core/places: the same bytes as in Node
// (tests/contract/places.test.ts).

import { expose, transfer } from "comlink";
import { decodePlaceFile, placeTimber } from "../core/places/place";

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const api = {
  /** The place's .timber, from its data file. */
  async build(data: Uint8Array): Promise<{ bytes: Uint8Array; fileName: string; sha256: string }> {
    const r = placeTimber(decodePlaceFile(data));
    const out = { bytes: r.bytes, fileName: r.fileName, sha256: await sha256(r.bytes) };
    return transfer(out, [out.bytes.buffer as Transferable]);
  },
};

export type PlaceWorkerApi = typeof api;
expose(api);
