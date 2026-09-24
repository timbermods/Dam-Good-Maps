// The generator and the editor's document run here, off the main thread, so the page stays
// responsive on 256² maps (PLAN §2.2, EDITOR_PLAN §8). The same core runs in Node for tests and
// batch runs.

import { expose, transfer } from "comlink";
import type { EditOp, OpOrigin } from "../core/doc/ops";
import type { MapSpec } from "../core/spec/mapspec";
import { viewBuffers } from "../render3d/model";
import { emptyWaterFile, runGenerate, type GenerateResponse } from "./api";
import * as ed from "./session";

function responseBuffers(r: GenerateResponse): Transferable[] {
  return [r.heights, r.water, r.contamination, r.moisture, r.soilContamination, r.reach, r.timber, r.project].map((a) => a.buffer) as Transferable[];
}

function sendUpdate(u: ed.SessionUpdate): ed.SessionUpdate {
  return transfer(u, viewBuffers(u.view) as Transferable[]);
}

function sendOpen(o: ed.SessionOpen): ed.SessionOpen {
  return transfer(o, viewBuffers(o.view) as Transferable[]);
}

const api = {
  async generate(spec: MapSpec): Promise<GenerateResponse> {
    const r = await runGenerate(spec);
    return transfer(r, responseBuffers(r));
  },
  /** The last generated map without pre-filled water, or null. */
  emptyWater(): { bytes: Uint8Array; name: string } | null {
    const f = emptyWaterFile();
    return f ? transfer(f, [f.bytes.buffer as Transferable]) : null;
  },

  // --- the editor's document
  refine: () => sendOpen(ed.refine()),
  openTimber: (bytes: Uint8Array, fileName: string) => sendOpen(ed.openTimber(bytes, fileName)),
  openProject: (bytes: Uint8Array) => sendOpen(ed.openProject(bytes)),
  sessionView: () => sendOpen(ed.sessionView()),
  sessionInfo: () => (ed.hasSession() ? ed.sessionInfo() : null),
  closeSession: () => ed.closeSession(),
  check: (op: EditOp) => ed.check(op),
  apply: (op: EditOp, origin?: OpOrigin, label?: string) => sendUpdate(ed.apply(op, origin, label)),
  applyAll: (ops: EditOp[], label: string, origin?: OpOrigin) => sendUpdate(ed.applyAll(ops, label, origin)),
  undo: () => sendUpdate(ed.undo()),
  redo: () => sendUpdate(ed.redo()),
  jump: (index: number) => sendUpdate(ed.jump(index)),
  async settingsResponse(): Promise<GenerateResponse> {
    const r = await ed.settingsResponse();
    return transfer(r, responseBuffers(r));
  },
  async regenerate(spec: MapSpec) {
    const r = await ed.regenerate(spec);
    return r.response ? transfer(r, responseBuffers(r.response)) : r;
  },
  exportCheck: () => ed.exportCheck(),
  exportTimber(confirmWarnings: boolean) {
    const r = ed.exportTimber(confirmWarnings);
    return transfer(r, [r.bytes.buffer as Transferable]);
  },
  project(level?: number) {
    const r = ed.project(level);
    return transfer(r, [r.bytes.buffer as Transferable]);
  },
};

export type GeneratorApi = typeof api;
expose(api);
