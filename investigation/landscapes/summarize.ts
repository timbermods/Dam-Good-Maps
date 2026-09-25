import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { scalarDefinitions, get } from "./bench/measure";
import { quantiles } from "./lib/metrics";
import { setVariety } from "../workshop/lib/variety";
import { checkCache } from "./lib/provenance";
const partial = process.argv.includes("--partial");
const provenance = await checkCache();
const qualityFlags = JSON.parse(
  readFileSync("data/quality-flags.json", "utf8"),
);
const rows = readdirSync(".work/rows")
  .filter((x) => x.endsWith(".json"))
  .sort()
  .map((f) => {
    const r = JSON.parse(readFileSync(".work/rows/" + f, "utf8"));
    // A terminal transient is not a steady-state fall measurement.
    if (!r.settled) r.falls = null;
    return r;
  });
const generated = readdirSync(".work/generated")
  .filter((x) => x.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(".work/generated/" + f, "utf8")));
if ([...rows, ...generated].some((r) => r.measurementVersion !== 2))
  throw Error("Old water metrics remain; run repair-water-metrics.ts first");
if (!partial && (rows.length !== 16200 || generated.length !== 180))
  throw Error(
    `Run incomplete: ${rows.length}/16200 converted, ${generated.length}/180 generated`,
  );
const regionValues = (rs: any[], path: string) => {
  const a = new Map<string, number[]>();
  for (const r of rs) {
    const v = get(r, path);
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const key = r.region ?? r.id;
    if (!a.has(key)) a.set(key, []);
    a.get(key)!.push(v);
  }
  return [...a.values()].map((v) => quantiles(v).p50!);
};
function band(values: number[], patches: number) {
  const q = quantiles(values);
  return {
    nPatches: patches,
    nRegions: q.n,
    p10: q.p10,
    p50: q.p50,
    p90: q.p90,
  };
}
function stratum(rs: any[]) {
  const scalars: any = {};
  for (const [name, def] of Object.entries(scalarDefinitions)) {
    const valid =
      def.group === "water"
        ? rs.filter(
            (r) =>
              r.settled ??
              r.checks.find((c: any) => c.id === "water.settles")?.ok,
          )
        : rs;
    scalars[name] = band(
      regionValues(valid, def.path),
      valid.filter((r) => typeof get(r, def.path) === "number").length,
    );
  }
  const histograms: any = {},
    histogramSupport: any = {};
  for (const key of [
    "heightHistogram",
    "slopeHistogram",
    "valleyCrossSectionMean",
  ]) {
    const records = rs.filter((r) => Array.isArray(r.relief[key]));
    histogramSupport[key] = {
      nPatches: records.length,
      nRegions: new Set(records.map((r) => r.region ?? r.id)).size,
    };
    if (!records.length) {
      histograms[key] = null;
      continue;
    }
    histograms[key] = Array.from(
      { length: records[0].relief[key].length },
      (_, i) => {
        const v = regionValues(records, `relief.${key}.${i}`);
        return v.reduce((a, b) => a + b, 0) / v.length;
      },
    );
    if (key !== "valleyCrossSectionMean") {
      const sum = histograms[key].reduce((a: number, b: number) => a + b, 0);
      histograms[key] = histograms[key].map((v: number) => v / sum);
    }
  }
  return {
    nPatches: rs.length,
    nRegions: new Set(rs.map((r) => r.region ?? r.id)).size,
    passRate: rs.filter((r) => r.passed).length / rs.length,
    scalars,
    histograms,
    histogramSupport,
  };
}
const groups = new Map<string, any[]>();
for (const r of rows.filter(
  (r) => !qualityFlags[r.region]?.excludeFromNaturalTargets,
))
  for (const family of ["all", ...(r.family === "random" ? [] : [r.family])]) {
    const key = [r.cohort, r.size, r.metres, r.mode, r.cap, family].join("/");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
const targets = {
  schema: 1,
  base: "cfa5990caeaf462de695caf428280da55fc0f7f5",
  definitions: scalarDefinitions,
  aggregation:
    "Within each size/scale/mapping/cap/cohort/family, median of valid patch measures per region, then p10/p50/p90 across regions. Named and random cohorts remain separate. These convenience strata are not population confidence intervals.",
  strata: Object.fromEntries(
    [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rs]) => [key, stratum(rs)]),
  ),
};
const failureCounts = (rs: any[]) => {
  const a: any = {};
  for (const r of rs)
    for (const c of r.checks)
      if (!c.ok && !c.advisory && c.applicable) a[c.id] = (a[c.id] || 0) + 1;
  return Object.fromEntries(
    Object.entries(a).sort((a: any, b: any) => b[1] - a[1]),
  );
};
const all16 = rows.filter((r) => r.cap === 16),
  families: any = {};
for (const f of [...new Set(rows.map((r) => r.family))].sort()) {
  const a = all16.filter((r) => r.family === f);
  families[f] = {
    converted: a.length,
    passed: a.filter((r) => r.passed).length,
    locations: new Set(a.map((r) => r.location)).size,
    regions: new Set(a.map((r) => r.region)).size,
    failures: failureCounts(a),
  };
}
const mappings: any = {};
for (const mode of ["linear", "compressed", "normalised"])
  for (const cap of [16, 22]) {
    const a = rows.filter((r) => r.mode === mode && r.cap === cap);
    if (a.length)
      mappings[mode + "-" + cap] = {
        n: a.length,
        passed: a.filter((r) => r.passed).length,
        readabilityProxy: a.filter((r) => r.mapping.readabilityProxy).length,
        correlation: quantiles(
          a.map((r) => r.mapping.shapeCorrelation).filter((v) => v !== null),
        ),
        occupiedLevels: quantiles(a.map((r) => r.mapping.occupiedLevels)),
      };
  }
const reference = rows.filter(
  (r) =>
    !qualityFlags[r.region]?.excludeFromNaturalTargets &&
    r.cohort === "named" &&
    r.size === 128 &&
    r.metres === 60 &&
    r.mode === "normalised" &&
    r.cap === 16,
);
const onePerRegion = [...new Set(reference.map((r) => r.region))].map(
  (region) =>
    reference
      .filter((r) => r.region === region)
      .sort((a, b) => a.id.localeCompare(b.id))[0],
);
const varietyRef = onePerRegion.map((r) => ({
  key: r.id,
  layout: r.layout,
  features: r.features,
}));
// Use the repository's published calibration. Fitting this planted-resource sample
// would give near-zero spreads for several features and inflate distances.
const scale = JSON.parse(
  readFileSync("../workshop/variety-scale.json", "utf8"),
);
const baseline: any = {};
for (const theme of [...new Set(generated.map((r) => r.theme))]) {
  const a = generated.filter((r) => r.theme === theme);
  baseline[theme] = {
    n: a.length,
    passed: a.filter((r) => r.passed).length,
    statistics: stratum(a),
    variety: scale
      ? setVariety(
          a.map((r) => ({ key: r.id, layout: r.layout, features: r.features })),
          scale,
        )
      : null,
  };
}
const comparison: any = {};
for (const [name, def] of Object.entries(scalarDefinitions)) {
  const eligible =
    def.group === "water" ? reference.filter((r) => r.settled) : reference;
  const a = regionValues(eligible, def.path),
    b = generated
      .map((r) => get(r, def.path))
      .filter((v) => typeof v === "number" && Number.isFinite(v));
  const real = quantiles(a),
    gen = quantiles(b);
  comparison[name] = {
    unit: def.unit,
    real,
    generated: gen,
    medianDifference:
      real.p50 !== null && gen.p50 !== null ? gen.p50 - real.p50 : null,
    generatedOutsideRealCentral80:
      real.n >= 5 && b.length
        ? b.filter((v) => v < real.p10! || v > real.p90!).length / b.length
        : null,
  };
}
const summary = {
  schema: 1,
  complete: rows.length === 16200 && generated.length === 180,
  locations: 450,
  patches: 4050,
  converted: rows.length,
  editorSafe: all16.length,
  passed16: all16.filter((r) => r.passed).length,
  comparison22: rows.filter((r) => r.cap === 22).length,
  passed22: rows.filter((r) => r.cap === 22 && r.passed).length,
  waterMetricAudit: {
    measurementVersion: 2,
    fallPolicy:
      "Unsettled simulations have no published fall statistics. Other terminal-state diagnostics remain flagged by settled=false; all water targets require settled=true.",
    cachedRecordsRechecked: rows.filter((r) => r.waterMetricsRechecked).length,
    cachedReplaysSkippedUnsettled: rows.filter(
      (r) => r.cachedWaterReplaySkipped,
    ).length,
    boundaryCorrectionsChangedFalls: rows.filter(
      (r) => r.boundaryFallCorrectionChanged,
    ).length,
  },
  failures16: failureCounts(all16),
  families,
  mappings,
  generated: {
    count: generated.length,
    passed: generated.filter((r) => r.passed).length,
    defaultCliMatches: generated.filter((r) => r.cliMatch === true).length,
  },
  baseline,
  comparison,
  variety: {
    scale,
    reference:
      "one anchor centre per named region; 128 tiles, 60 m/tile, normalised 16; unchanged workshop/variety-scale.json calibration",
    referenceCount: varietyRef.length,
    referenceVariety: scale ? setVariety(varietyRef, scale) : null,
    settledReferenceCount: onePerRegion.filter((r) => r.settled).length,
    settledReferenceVariety: setVariety(
      onePerRegion
        .filter((r) => r.settled)
        .map((r) => ({ key: r.id, layout: r.layout, features: r.features })),
      scale,
    ),
    generatedVariety: setVariety(
      generated.map((r) => ({
        key: r.id,
        layout: r.layout,
        features: r.features,
      })),
      scale,
    ),
  },
};
const dir = partial ? ".work/partial" : "data";
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/targets.json`, JSON.stringify(targets, null, 2));
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
if (!partial) {
  writeFileSync(
    "data/converted.jsonl.gz",
    gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n"),
  );
  writeFileSync(
    "data/generated.jsonl.gz",
    gzipSync(generated.map((r) => JSON.stringify(r)).join("\n") + "\n"),
  );
}
if (!partial)
  writeFileSync(
    "data/run-environment.json",
    JSON.stringify(provenance, null, 2),
  );
console.log(
  JSON.stringify(
    {
      converted: rows.length,
      pass16: summary.passed16,
      generated: generated.length,
      targets: groups.size,
      comparison,
    },
    null,
    2,
  ),
);
