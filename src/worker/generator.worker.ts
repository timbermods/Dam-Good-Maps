// The generator runs here, off the main thread, so the page stays responsive on 256² maps
// (PLAN §2.2). The same core runs in Node for tests and batch runs.

import { expose, transfer } from "comlink";
import type { MapSpec } from "../core/spec/mapspec";
import { runGenerate, type GenerateResponse } from "./api";

const api = {
  async generate(spec: MapSpec): Promise<GenerateResponse> {
    const r = await runGenerate(spec);
    return transfer(r, [r.heights.buffer, r.water.buffer, r.moisture.buffer, r.timber.buffer, r.project.buffer] as Transferable[]);
  },
};

export type GeneratorApi = typeof api;
expose(api);
