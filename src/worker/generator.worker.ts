// The generator runs here, off the main thread, so the page stays responsive on 256² maps
// (PLAN §2.2). The same core runs in Node for tests and batch runs.

import { expose, transfer } from "comlink";
import type { MapSpec } from "../core/spec/mapspec";
import { emptyWaterFile, runGenerate, type GenerateResponse } from "./api";

const api = {
  async generate(spec: MapSpec): Promise<GenerateResponse> {
    const r = await runGenerate(spec);
    const buffers = [r.heights, r.water, r.contamination, r.moisture, r.soilContamination, r.reach, r.timber, r.project].map((a) => a.buffer);
    return transfer(r, buffers as Transferable[]);
  },
  /** The last generated map without pre-filled water, or null. */
  emptyWater(): { bytes: Uint8Array; name: string } | null {
    const f = emptyWaterFile();
    return f ? transfer(f, [f.bytes.buffer as Transferable]) : null;
  },
};

export type GeneratorApi = typeof api;
expose(api);
