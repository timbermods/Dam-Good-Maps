// Everything the 2D preview needs, computed once per generated map: shaded terrain pixels, a
// per-tile index of the features that cover each tile (for hover labels), and feature outlines.

import { pathField, pointAtArc, polygonMask, bedAt, type PathField } from "../core/features/geometry";
import type { Feature, LakeFeature, RiverFeature, SetPieceFeature } from "../core/features/schema";
import { runsToTiles } from "../core/math/grid";
import { shadeTiles } from "../core/render/shade";
import type { GenerateResponse } from "../worker/api";

export interface Outline {
  kind: "polyline" | "polygon" | "segment" | "marker" | "edges";
  color: string;
  dashed?: boolean;
  points: [number, number][];
  label?: string;
  featureId: string;
}

export interface PreviewModel {
  W: number;
  H: number;
  /** Shaded terrain without water. */
  rgb: Uint8Array;
  /** For each tile, indices into `features` of the area features covering it (-1 = none). */
  areaOwner: Int32Array;
  riverFields: Map<string, PathField>;
  lakeMasks: Map<string, Uint8Array>;
  outlines: Outline[];
  features: Feature[];
}

const AREA_COLORS: Record<string, string> = { forest: "#2f6b2f", berryPatch: "#7a3fa0", ruinField: "#8a5a44" };

export function buildPreviewModel(r: GenerateResponse): PreviewModel {
  const { W, H, features } = r;
  const rgb = shadeTiles(r.heights, W, H, null);
  const areaOwner = new Int32Array(W * H).fill(-1);
  const outlines: Outline[] = [];
  const riverFields = new Map<string, PathField>();
  const lakeMasks = new Map<string, Uint8Array>();
  features.forEach((f, k) => {
    if (f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField") {
      const tiles = runsToTiles(f.params.area, W);
      const set = new Set(tiles);
      for (const i of tiles) areaOwner[i] = k;
      // outline: tile edges between inside and outside
      const pts: [number, number][] = [];
      for (const i of tiles) {
        const x = i % W;
        const y = (i - x) / W;
        if (!set.has(i - 1) || x === 0) pts.push([x, y], [x, y + 1]);
        if (!set.has(i + 1) || x === W - 1) pts.push([x + 1, y], [x + 1, y + 1]);
        if (!set.has(i - W)) pts.push([x, y], [x + 1, y]);
        if (!set.has(i + W)) pts.push([x, y + 1], [x + 1, y + 1]);
      }
      outlines.push({ kind: "edges", color: AREA_COLORS[f.kind], points: pts, featureId: f.id });
    } else if (f.kind === "river") {
      riverFields.set(f.id, pathField(f.params.path, W, H));
      outlines.push({ kind: "polyline", color: "#2a64c8", points: f.params.path.map(([x, y]) => [x + 0.5, y + 0.5]), label: "River", featureId: f.id });
    } else if (f.kind === "lake") {
      lakeMasks.set(f.id, polygonMask(f.params.outline, W, H));
      outlines.push({
        kind: "polygon",
        color: "#3aa0c8",
        dashed: true,
        points: f.params.outline.map(([x, y]) => [x + 0.5, y + 0.5]),
        label: f.params.planned ? "Reservoir site" : "Lake",
        featureId: f.id,
      });
    }
  });
  for (const f of features) {
    if (f.kind !== "setPiece") continue;
    const river = features.find((g): g is RiverFeature => g.kind === "river" && g.id === (f.params.plan as { river?: string }).river);
    if (!river) continue;
    const at = Number((f.params.plan as { at: number }).at);
    const { p, normal } = pointAtArc(river.params.path, at);
    if (f.params.kind === "damSite") {
      const half = river.params.width / 2 + 2;
      outlines.push({
        kind: "segment",
        color: "#e07a1f",
        points: [
          [p[0] + normal[0] * half + 0.5, p[1] + normal[1] * half + 0.5],
          [p[0] - normal[0] * half + 0.5, p[1] - normal[1] * half + 0.5],
        ],
        label: "Dam site",
        featureId: f.id,
      });
    } else if (f.params.kind === "waterfall") {
      outlines.push({ kind: "marker", color: "#ffffff", points: [[p[0] + 0.5, p[1] + 0.5]], label: `Falls, ${(f.params.plan as { drop: number }).drop} levels`, featureId: f.id });
    }
  }
  return { W, H, rgb, areaOwner, riverFields, lakeMasks, outlines, features };
}

export interface LayerSet {
  water: boolean;
  moisture: boolean;
  contamination: boolean;
  reach: boolean;
}

const CLEAN = [52, 112, 214];
const BADWATER = [128, 84, 38];
const MOIST = [60, 150, 40];
const POISON = [150, 60, 170];
const REACH = [255, 248, 215];

function mix(c: number[], k: number, into: Uint8Array, o: number): void {
  into[o] = Math.round(into[o] * (1 - k) + c[0] * k);
  into[o + 1] = Math.round(into[o + 1] * (1 - k) + c[1] * k);
  into[o + 2] = Math.round(into[o + 2] * (1 - k) + c[2] * k);
}

/** Tile colours for the chosen layers, row-major (3 bytes per tile). */
export function composeLayers(m: PreviewModel, r: GenerateResponse, layers: LayerSet): Uint8Array {
  const out = m.rgb.slice();
  const N = m.W * m.H;
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    const d = r.water[i];
    const wet = d > 0.001;
    if (layers.moisture && !wet && r.moisture[i] > 0) mix(MOIST, 0.15 + 0.4 * Math.min(1, r.moisture[i] / 16), out, o);
    if (layers.contamination && r.soilContamination[i] > 0) mix(POISON, 0.25 + 0.4 * Math.min(1, r.soilContamination[i]), out, o);
    if (layers.reach && r.reach[i] && !wet) mix(REACH, 0.35, out, o);
    if (layers.water && wet) mix(r.contamination[i] >= 0.05 ? BADWATER : CLEAN, 0.35 + 0.5 * Math.min(1, d / 1.2), out, o);
  }
  return out;
}

/** Plain-language description of a tile for the hover label. */
export function describeTile(m: PreviewModel, r: GenerateResponse, x: number, y: number): string[] {
  const i = y * m.W + x;
  const lines = [`Tile ${x}, ${y} · level ${r.heights[i]}`];
  const d = r.water[i];
  if (d > 0.001) lines.push(`${r.contamination[i] >= 0.05 ? `Badwater (${Math.round(r.contamination[i] * 100)}%)` : "Water"} ${d.toFixed(2)} deep`);
  if (r.moisture[i] > 0) lines.push(`Moist soil (${r.moisture[i].toFixed(1)})${r.soilContamination[i] > 0 ? ", contaminated" : ""}`);
  else if (r.soilContamination[i] > 0) lines.push("Contaminated soil");
  else if (d <= 0.001) lines.push("Dry soil");
  if (r.reach[i]) lines.push("Walkable from the start");
  const k = m.areaOwner[i];
  if (k >= 0) {
    const f = m.features[k];
    const n = r.entities.filter((e) => e.owner === f.id).length;
    if (f.kind === "forest") lines.push(`${Object.keys(f.params.speciesMix).join("/")} grove · ${n} trees (${f.id})`);
    if (f.kind === "berryPatch") lines.push(`Berry patch · ${n} bushes (${f.id})`);
    if (f.kind === "ruinField") lines.push(`Ruin field · ${n} columns, about ${f.params.scrapTarget} scrap (${f.id})`);
  }
  for (const [id, field] of m.riverFields) {
    const river = m.features.find((f): f is RiverFeature => f.id === id)!;
    if (field.d[i] < river.params.width / 2) lines.push(`River · bed level ${bedAt(river.params.bedProfile, field.s[i])} (${id})`);
  }
  for (const [id, mask] of m.lakeMasks) {
    if (!mask[i]) continue;
    const lake = m.features.find((f): f is LakeFeature => f.id === id)!;
    lines.push(`${lake.params.planned ? "Reservoir site (dam the gorge to fill it)" : "Lake"} (${id})`);
  }
  const here = r.entities.filter((e) => e.x === x && e.y === y && !e.template.startsWith("Pine") && !e.template.startsWith("Birch") && !e.template.startsWith("Oak"));
  for (const e of here) if (e.template === "Slope" || e.template === "WaterSource" || e.template.startsWith("Ruin")) lines.push(e.template);
  return lines;
}

export function setPieceLabel(f: SetPieceFeature): string {
  return f.params.kind;
}
