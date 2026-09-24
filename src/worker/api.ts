// What the generator worker returns to the page: everything the preview, the map card and the
// downloads need, with the big arrays as typed arrays (transferred, not copied).

import { encodeProject, projectFileName, toDocument } from "../core/doc/document";
import type { Feature } from "../core/features/schema";
import { writeTimber } from "../core/format/timber";
import { generate, type GenerateResult } from "../core/gen/generate";
import { fileName, mapName, description, toTimberFile } from "../core/gen/pack";
import type { MapSpec } from "../core/spec/mapspec";
import { rulesFor } from "../core/validate/playability";
import type { CheckResult } from "../core/validate/report";

export interface PreviewEntity {
  template: string;
  x: number;
  y: number;
  z: number;
  orientation: string;
  owner: string;
  dead?: boolean;
}

/** Key facts for the map card (PLAN §14.3). */
export interface MapFacts {
  cleanSources: number;
  cleanFlow: number;
  badwaterFlow: number;
  /** Share of the map under water (deeper than 0.05). */
  wetShare: number;
  /** The best dam site within 40 tiles of the start. */
  bestDam: { x: number; y: number; dir: [number, number]; length: number; height: number; volume: number; area: number } | null;
  /** Water natural pools keep through the worst drought, within 40 tiles of the start. */
  naturalStorage: number;
  /** Stored water the colony needs through the worst drought. */
  reservoirNeed: number;
  /** Tiles from the start to pumpable clean water (null: none). */
  waterDistance: number | null;
  settle: { ticks: number; settled: boolean };
}

export interface GenerateResponse {
  spec: MapSpec;
  features: Feature[];
  W: number;
  H: number;
  heights: Uint8Array;
  water: Float32Array;
  contamination: Float32Array;
  moisture: Float32Array;
  soilContamination: Float32Array;
  /** Land walkable from the start (1). */
  reach: Uint8Array;
  facts: MapFacts;
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

/** The last map generated here, for the "without pre-filled water" download. */
let last: GenerateResult | null = null;

export async function runGenerate(spec: MapSpec): Promise<GenerateResponse> {
  const t0 = performance.now();
  const r = generate(spec);
  const ms = Math.round(performance.now() - t0);
  last = r;
  const project = encodeProject(toDocument(r.spec, r.features, r.built));
  const b = r.built;
  const a = r.analysis;
  const N = b.W * b.H;
  let wet = 0;
  for (let i = 0; i < N; i++) if (b.water[i] > 0.05) wet++;
  const clean = b.sources.filter((s) => s.template === "WaterSource");
  const bad = b.sources.filter((s) => s.template === "BadwaterSource");
  const sum = (xs: { strength: number }[]) => Math.round(xs.reduce((s, x) => s + x.strength, 0) * 100) / 100;
  const facts: MapFacts = {
    cleanSources: clean.length,
    cleanFlow: sum(clean),
    badwaterFlow: sum(bad),
    wetShare: wet / N,
    bestDam: a?.bestDam ?? null,
    naturalStorage: a ? Math.round(a.naturalStorage) : 0,
    reservoirNeed: Math.round(rulesFor(r.spec).reservoirNeed),
    waterDistance: a && Number.isFinite(a.waterDistance) ? Math.round(a.waterDistance * 10) / 10 : null,
    settle: { ticks: b.settle.ticks, settled: b.settle.settled },
  };
  return {
    spec: r.spec,
    features: r.features,
    W: b.W,
    H: b.H,
    heights: b.heights.slice(), // a copy: the transfer detaches it, and the worker keeps `last`
    water: Float32Array.from(b.water),
    contamination: Float32Array.from(b.contamination),
    moisture: Float32Array.from(b.moisture),
    soilContamination: Float32Array.from(b.soilContamination),
    reach: a ? a.reach : new Uint8Array(N),
    facts,
    entities: b.entities.map((e) => ({
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

/** The last map again, without pre-filled water (PLAN §14.4, in-game check B2). */
export function emptyWaterFile(): { bytes: Uint8Array; name: string } | null {
  if (!last || !last.report.passed) return null;
  const bytes = writeTimber(toTimberFile(last.spec, last.built, { emptyWater: true }));
  return { bytes, name: fileName(last.spec).replace(/\.timber$/, " (empty water).timber") };
}
