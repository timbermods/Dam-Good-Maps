import { waterModel, mapObjects } from "../../../src/core/sim/model";
import { canonicalSettle } from "../../../src/core/sim/prefill";
import { moisture } from "../../../src/core/sim/moisture";
import { waterSource, entityJson } from "../../../src/core/format/entities";
import { parse as parseGameJson } from "../../../src/core/format/json";
import { validateMap } from "../../../src/core/validate/checks";
import { measureValidated } from "../../workshop/lib/measures";
import { featureVector } from "../../workshop/lib/variety";
import { naturalness } from "../../workshop/lib/naturalness";
import { makeFile } from "../lib/convert";
import { terrainMetrics } from "../lib/metrics";
export function validateInput(input: any) {
  const W = input.W ?? input.width,
    H = input.H ?? input.height;
  if (
    !Number.isInteger(W) ||
    !Number.isInteger(H) ||
    W < 4 ||
    H < 4 ||
    W > 256 ||
    H > 256
  )
    throw Error("W and H must be integers from 4 to 256");
  if (
    !Array.isArray(input.heights) ||
    input.heights.length !== W * H ||
    input.heights.some((v: any) => !Number.isInteger(v) || v < 0 || v > 22)
  )
    throw Error("heights must contain W*H integers from 0 to 22");
  if (!Array.isArray(input.waterSources))
    throw Error("waterSources must be an array of {x,y,strength}");
  const seen = new Set();
  for (const s of input.waterSources) {
    if (
      !Number.isInteger(s.x) ||
      !Number.isInteger(s.y) ||
      s.x < 0 ||
      s.x >= W ||
      s.y < 0 ||
      s.y >= H ||
      !Number.isFinite(s.strength) ||
      s.strength <= 0 ||
      s.strength > 8
    )
      throw Error(
        "source coordinates must be in bounds and strength must be >0 and <=8",
      );
    const k = s.y * W + s.x;
    if (seen.has(k)) throw Error("duplicate water source");
    seen.add(k);
  }
  if (
    input.referenceHeights &&
    (!Array.isArray(input.referenceHeights) ||
      input.referenceHeights.length !== W * H ||
      input.referenceHeights.some(
        (v: any) => !Number.isInteger(v) || v < 0 || v > 22,
      ))
  )
    throw Error("invalid referenceHeights");
  return { W, H };
}
export function measureInput(input: any) {
  const { W, H } = validateInput(input),
    h = Uint8Array.from(input.heights),
    reference = Uint8Array.from(input.referenceHeights ?? input.heights);
  const others = (input.entities ?? [])
    .filter((e: any) => e.Template !== "WaterSource")
    .map((e: any, k: number) => ({
      ...e,
      Id: e.Id ?? `10000000-0000-4000-8000-${String(k).padStart(12, "0")}`,
    }));
  const entities = [
    ...(parseGameJson(JSON.stringify(others)) as any[]),
    ...input.waterSources.map((s: any, k: number) =>
      entityJson(
        waterSource({
          id: `00000000-0000-4000-8000-${String(k).padStart(12, "0")}`,
          owner: "bench",
          x: s.x,
          y: s.y,
          z: h[s.y * W + s.x],
          strength: s.strength,
        }),
      ),
    ),
  ];
  const model = waterModel(W, H, h, mapObjects({ entities } as any)),
    water = canonicalSettle(model),
    M = moisture(h, water.depth, water.contamination, W, H),
    file = makeFile(h, W, H, entities, water, M, true);
  const v = validateMap(file, {
      profile: "generate",
      designedFor: "normal",
      features: [],
      water: { model, settled: water },
    }),
    m = measureValidated(file, v, []);
  const row = {
    ...terrainMetrics(reference, W, H, water, h),
    natural: naturalness(
      reference,
      W,
      H,
      null,
      [],
      Math.max(6000, 0.15 * W * H),
    ),
    water: m.water,
    dams: m.dams,
    coreMetrics: m.metrics,
    layout: m.layout,
    features: featureVector(m),
    size: W,
    waterReliable: water.settled,
  };
  return { row, v, file, water };
}
export const scalarDefinitions: Record<
  string,
  { path: string; unit: string; group: string }
> = {
  branching: {
    path: "network.branchingPer10k",
    unit: "junctions / 10000 tiles",
    group: "network",
  },
  drainageDensity: {
    path: "network.drainageDensity",
    unit: "channel tiles / tile²",
    group: "network",
  },
  sinuosity: {
    path: "network.sinuosity.p50",
    unit: "path / chord",
    group: "network",
  },
  junctionAngle: {
    path: "network.junctionAngleDegrees.p50",
    unit: "degrees",
    group: "network",
  },
  segmentLength: {
    path: "network.segmentLengthTiles.p50",
    unit: "tiles",
    group: "network",
  },
  splitTileShare: {
    path: "network.flowSplitTileShare",
    unit: "fraction of flowing wet cells",
    group: "water",
  },
  rejoinTileShare: {
    path: "network.flowRejoinTileShare",
    unit: "rejoining cells / flowing wet cells",
    group: "water",
  },
  enclosedIslands: {
    path: "network.wetEnclosedLandComponents",
    unit: "enclosed dry components >=4 tiles",
    group: "water",
  },
  stepLength: {
    path: "relief.levelStepLength.p50",
    unit: "tiles",
    group: "relief",
  },
  valleyWidth1: {
    path: "relief.valleyWidth1.p50",
    unit: "tiles between sides +1 level",
    group: "relief",
  },
  valleyWidth2: {
    path: "relief.valleyWidth2.p50",
    unit: "tiles between sides +2 levels",
    group: "relief",
  },
  narrowingRatio: {
    path: "relief.narrowingRatio",
    unit: "narrowest / widest sampled valley",
    group: "relief",
  },
  straightShare8: {
    path: "natural.straightShare8",
    unit: "fraction of contour edges",
    group: "naturalness",
  },
  longestRun: {
    path: "natural.longestRun",
    unit: "tiles",
    group: "naturalness",
  },
  ridgeThicknessCV: {
    path: "natural.ridgeThicknessCV",
    unit: "coefficient of variation",
    group: "naturalness",
  },
  ridgeHeightStd: {
    path: "natural.ridgeHeightStd",
    unit: "levels",
    group: "naturalness",
  },
  basinRimThicknessCV: {
    path: "natural.basinRimThicknessCV",
    unit: "coefficient of variation",
    group: "naturalness",
  },
  lakeShare: {
    path: "water.lakeShare",
    unit: "fraction of tiles",
    group: "water",
  },
  lakes: { path: "water.lakes", unit: "lake components", group: "water" },
  fallCount: {
    path: "falls.count",
    unit: "connected lips with surface drop >=1",
    group: "water",
  },
  fallDrop: { path: "falls.drop.p50", unit: "levels", group: "water" },
  fallSpacing: {
    path: "falls.nearestSpacingTiles.p50",
    unit: "tiles to nearest other fall",
    group: "water",
  },
  damSites: {
    path: "dams.per10k",
    unit: "sampled sites / 10000 tiles",
    group: "water",
  },
  reservoirVolume: { path: "dams.bestVolume", unit: "tile³", group: "water" },
  reservoirEfficiency: {
    path: "dams.bestRatio",
    unit: "tile³ / dam tile",
    group: "water",
  },
  damLength: { path: "dams.medianLength", unit: "tiles", group: "water" },
};
export function get(obj: any, path: string) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}
export function compare(row: any, target: any) {
  const scalars: any = {},
    groups: any = {};
  for (const [name, def] of Object.entries(scalarDefinitions)) {
    const v = get(row, def.path),
      t = target.scalars[name];
    if (def.group === "water" && row.waterReliable === false) {
      scalars[name] = { value: v ?? null, status: "simulation did not settle" };
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || !t || t.nRegions < 5) {
      scalars[name] = { value: v ?? null, status: "insufficient evidence" };
      continue;
    }
    const scale = Math.max(
        (t.p90 - t.p10) / 2.56,
        Math.abs(t.p50) * 0.05,
        0.001,
      ),
      distance = Math.abs(v - t.p50) / scale,
      bandDistance =
        v < t.p10 ? (t.p10 - v) / scale : v > t.p90 ? (v - t.p90) / scale : 0;
    scalars[name] = {
      value: v,
      unit: def.unit,
      p10: t.p10,
      median: t.p50,
      p90: t.p90,
      nRegions: t.nRegions,
      inCentral80: v >= t.p10 && v <= t.p90,
      medianDistance: distance,
      bandDistance,
    };
    (groups[def.group] ??= []).push(Math.min(10, distance));
  }
  for (const k of Object.keys(groups))
    groups[k] = {
      meanCappedMedianDistance:
        groups[k].reduce((a: number, b: number) => a + b, 0) / groups[k].length,
      measures: groups[k].length,
    };
  const histograms: any = {};
  for (const key of ["heightHistogram", "slopeHistogram"]) {
    const a = row.relief[key],
      b = target.histograms[key],
      support =
        target.histogramSupport?.[key]?.nRegions ?? target.nRegions ?? 0;
    histograms[key] = {
      nRegions: support,
      totalVariation:
        a && b && support >= 5
          ? a.reduce(
              (s: number, v: number, i: number) => s + Math.abs(v - b[i]),
              0,
            ) / 2
          : null,
    };
  }
  const section = row.relief.valleyCrossSectionMean,
    referenceSection = target.histograms.valleyCrossSectionMean,
    sectionSupport =
      target.histogramSupport?.valleyCrossSectionMean?.nRegions ?? 0;
  const valleyCrossSection = {
    nRegions: sectionSupport,
    rootMeanSquareLevels:
      section && referenceSection && sectionSupport >= 5
        ? Math.sqrt(
            section.reduce(
              (s: number, v: number, i: number) =>
                s + (v - referenceSection[i]) ** 2,
              0,
            ) / section.length,
          )
        : null,
  };
  return {
    scalars,
    groups,
    histograms,
    valleyCrossSection,
    interpretation:
      "Descriptive distance from region-balanced terrain statistics. Lower is closer, not more fun or more valid. Missing measurements are not zeros. D8 cannot represent distributaries; flow split shares and enclosed islands are water-grid proxies.",
  };
}
