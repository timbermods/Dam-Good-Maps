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
  rgb: Uint8Array;
  rgbWater: Uint8Array;
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
  const rgbWater = shadeTiles(r.heights, W, H, r.water);
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
  return { W, H, rgb, rgbWater, areaOwner, riverFields, lakeMasks, outlines, features };
}

/** Plain-language description of a tile for the hover label. */
export function describeTile(m: PreviewModel, r: GenerateResponse, x: number, y: number): string[] {
  const i = y * m.W + x;
  const lines = [`Tile ${x}, ${y} · level ${r.heights[i]}`];
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
