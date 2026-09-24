// What the generator worker returns to the page: everything the preview, the map card and the
// downloads need, with the big arrays as typed arrays (transferred, not copied).

import { encodeProject, projectFileName, toDocument } from "../core/doc/document";
import type { Feature } from "../core/features/schema";
import { generate } from "../core/gen/generate";
import { fileName, mapName, description } from "../core/gen/pack";
import type { MapSpec } from "../core/spec/mapspec";
import type { CheckResult } from "../core/validate/checks";

export interface PreviewEntity {
  template: string;
  x: number;
  y: number;
  z: number;
  orientation: string;
  owner: string;
  dead?: boolean;
}

export interface GenerateResponse {
  spec: MapSpec;
  features: Feature[];
  W: number;
  H: number;
  heights: Uint8Array;
  water: Float32Array;
  moisture: Float32Array;
  entities: PreviewEntity[];
  checks: CheckResult[];
  passed: boolean;
  attempts: number;
  timber: Uint8Array;
  timberName: string;
  project: Uint8Array;
  projectName: string;
  name: string;
  premise: string;
  sha256: string;
  ms: number;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function runGenerate(spec: MapSpec): Promise<GenerateResponse> {
  const t0 = performance.now();
  const r = generate(spec);
  const ms = Math.round(performance.now() - t0);
  const project = encodeProject(toDocument(r.spec, r.features, r.built));
  return {
    spec: r.spec,
    features: r.features,
    W: r.built.W,
    H: r.built.H,
    heights: r.built.heights,
    water: Float32Array.from(r.built.water),
    moisture: Float32Array.from(r.built.moisture),
    entities: r.built.entities.map((e) => ({
      template: e.template,
      x: e.x,
      y: e.y,
      z: e.z,
      orientation: e.orientation,
      owner: e.owner,
      dead: "LivingNaturalResource" in e.components ? true : undefined,
    })),
    checks: r.report.checks,
    passed: r.report.passed,
    attempts: r.attempts,
    timber: r.bytes,
    timberName: fileName(r.spec),
    project,
    projectName: projectFileName(r.spec),
    name: mapName(r.spec),
    premise: description(r.spec),
    sha256: r.bytes.length ? await sha256(r.bytes) : "",
    ms,
  };
}
