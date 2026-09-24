// Generation (PLAN §7): spec → plan features → build → validate, retrying with the next attempt
// until the `generate` profile passes (PLAN §7.8). Feature ids never include the attempt
// (PLAN §19.4), so the accepted attempt only changes what the features are, not their names.

import { build, SettleCache, type BuildResult } from "../features/build";
import type { Feature } from "../features/schema";
import { assertSpec } from "../spec/schema";
import { AVAILABLE_THEMES, type MapSpec } from "../spec/mapspec";
import { validateMap, type Validation } from "../validate/checks";
import { blocks, type ValidationReport } from "../validate/report";
import type { PlayabilityAnalysis } from "../validate/playability";
import { writeTimber } from "../format/timber";
import { toTimberFile } from "./pack";
import { planRiverValley } from "./riverValley";

export const MAX_ATTEMPTS = 12;

export interface GenerateResult {
  spec: MapSpec;
  features: Feature[];
  built: BuildResult;
  report: ValidationReport;
  /** What the playability checks measured (reach, dam sites, distances) for the map card. */
  analysis: PlayabilityAnalysis | null;
  bytes: Uint8Array;
  attempts: number;
  failures: { attempt: number; failed: string[] }[];
}

export interface GenerateOptions {
  maxAttempts?: number;
  onProgress?: (p: { attempt: number; stage: string }) => void;
}

export function planFeatures(spec: MapSpec, attempt: number, candidate = 0, settleCache?: SettleCache): Feature[] {
  if (!AVAILABLE_THEMES.includes(spec.theme)) throw new Error(`the ${spec.theme} theme is not available yet`);
  if (spec.colonies.count !== 1 || spec.colonies.mod !== "none") {
    throw new Error("multi-colony (Timber Together) maps are not built yet (PLAN §20, D5)");
  }
  return planRiverValley(spec, attempt, candidate, settleCache);
}

/** Validate a built map in the generate profile, on the build's own canonical settle. */
export function validateBuilt(spec: MapSpec, features: readonly Feature[], built: BuildResult, file = toTimberFile(spec, built)): Validation {
  return validateMap(file, { profile: "generate", spec, features, water: { model: built.waterModel, settled: built.settle } });
}

export function generate(specIn: MapSpec, opts: GenerateOptions = {}): GenerateResult {
  assertSpec(specIn);
  const max = opts.maxAttempts ?? MAX_ATTEMPTS;
  const failures: GenerateResult["failures"] = [];
  let last: GenerateResult | null = null;
  for (let attempt = 0; attempt < max; attempt++) {
    opts.onProgress?.({ attempt, stage: "plan" });
    const spec: MapSpec = { ...specIn, accepted: { attempt, candidate: 0 } };
    const cache = new SettleCache();
    const features = planFeatures(spec, attempt, 0, cache);
    opts.onProgress?.({ attempt, stage: "build" });
    const built = build(spec, features, { settleCache: cache });
    opts.onProgress?.({ attempt, stage: "validate" });
    const file = toTimberFile(spec, built);
    const { report, analysis } = validateBuilt(spec, features, built, file);
    const bytes = report.passed ? writeTimber(file) : new Uint8Array();
    last = { spec, features, built, report, analysis, bytes, attempts: attempt + 1, failures };
    if (report.passed) return last;
    failures.push({ attempt, failed: report.checks.filter((c) => blocks("generate", c)).map((c) => c.id) });
  }
  return last!;
}

/** Rebuild a saved document's map: the same pure path the generator's download takes
 *  (PLAN §19.7), so the bytes are identical. */
export function rebuild(spec: MapSpec, features: Feature[]): { built: BuildResult; bytes: Uint8Array; report: ValidationReport } {
  const built = build(spec, features);
  const file = toTimberFile(spec, built);
  return { built, bytes: writeTimber(file), report: validateBuilt(spec, features, built, file).report };
}
