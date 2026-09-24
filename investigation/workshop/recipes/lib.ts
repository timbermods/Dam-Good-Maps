// What every premise recipe shares: a generated base map opened as a MapSession, the editor's own
// planners (core/doc/tools.ts: landforms, lakes, rivers, set pieces) and operations, shapes drawn as
// outlines, and helpers that keep a new piece clear of the start, the rivers and the set pieces.
// A recipe only calls operations the engine already has; where it cannot express a pattern, its
// notes say which builder is missing.

import { generate, type GenerateResult } from "../../../src/core/gen/generate";
import { MapSession } from "../../../src/core/doc/session";
import { planContextOf, planLake, planLandform, planPiece, planRiver, type LakeRequest, type LandformRequest, type RiverRequest } from "../../../src/core/doc/tools";
import type { EditOp } from "../../../src/core/doc/ops";
import type { Feature, Point, SetPieceKind } from "../../../src/core/features/schema";
import { polygonMask } from "../../../src/core/features/geometry";
import { tilesToRuns, runsToTiles, type Runs } from "../../../src/core/math/grid";
import { decodeSpecFragment, type MapSpec, type ThemeId } from "../../../src/core/spec/mapspec";
import type { PlanRecord } from "../../../src/core/features/setpieces";

export interface RecipeContext {
  session: MapSession;
  base: GenerateResult;
  spec: MapSpec;
  W: number;
  H: number;
  /** Deterministic draws for this recipe run (seed, size, attempt). */
  rand: () => number;
  attempt: number;
  notes: string[];
}

export interface Recipe {
  id: string;
  /** Plain-language name for the report. */
  name: string;
  /** The catalogue pattern it proves. */
  pattern: string;
  whimsical: boolean;
  /** The base theme and extra settings (share-link keys, core/spec/codec.ts). */
  theme: ThemeId;
  settings?: string;
  /** Apply the premise; throw RecipeFailure when this attempt cannot place it. */
  apply(ctx: RecipeContext): void;
}

export class RecipeFailure extends Error {}

export function baseSpec(theme: ThemeId, seed: number, size: number, settings = ""): MapSpec {
  const d = decodeSpecFragment(`s=${seed}&t=${theme}&z=${size}&d=n${settings ? "&" + settings : ""}`);
  if (!d || d.problems.length) throw new Error(`bad spec: ${d?.problems.join("; ")}`);
  return d.spec;
}

export function openBase(theme: ThemeId, seed: number, size: number, settings = ""): { session: MapSession; base: GenerateResult } {
  const base = generate(baseSpec(theme, seed, size, settings));
  return { session: MapSession.fromGenerated(base), base };
}

/** A small deterministic generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A feature id for a recipe's feature: a UUID, as the editor gives user features, drawn from the
 *  run's own stream so a recipe reproduces its map exactly. */
export function newId(ctx: RecipeContext): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(ctx.rand() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(ctx.rand() * 4)]}${hex(3)}-${hex(12)}`;
}

/** Apply operations as one step, or fail the attempt with the engine's reasons. */
export function apply(ctx: RecipeContext, ops: EditOp[], label: string): void {
  const r = ctx.session.applyAll(ops, "user", label);
  if (!r.ok) throw new RecipeFailure(`${label}: ${r.errors.join("; ")}`);
}

export function addLandform(ctx: RecipeContext, req: LandformRequest, label = "landform"): Feature {
  const plan = planLandform(req, planContextOf(ctx.session), newId(ctx), "user");
  if (!plan.ok) throw new RecipeFailure(`${label}: ${plan.errors.join("; ")}`);
  apply(ctx, plan.ops, label);
  return plan.feature;
}

export function addLake(ctx: RecipeContext, req: LakeRequest, label = "lake"): Feature {
  const plan = planLake(req, planContextOf(ctx.session), newId(ctx), "user");
  if (!plan.ok) throw new RecipeFailure(`${label}: ${plan.errors.join("; ")}`);
  apply(ctx, plan.ops, label);
  ctx.notes.push(...plan.report);
  return plan.feature;
}

export function addRiver(ctx: RecipeContext, req: RiverRequest, label = "river"): Feature {
  const plan = planRiver(req, planContextOf(ctx.session), newId(ctx), "user");
  if (!plan.ok) throw new RecipeFailure(`${label}: ${plan.errors.join("; ")}`);
  apply(ctx, plan.ops, label);
  ctx.notes.push(...plan.report);
  return plan.feature;
}

export function addPiece(ctx: RecipeContext, kind: SetPieceKind, request: PlanRecord, label: string = kind): Feature {
  const plan = planPiece(ctx.session, kind, request, newId(ctx), "user");
  if (!plan.ok) throw new RecipeFailure(`${label}: ${plan.errors.join("; ")}`);
  apply(ctx, plan.ops, label);
  ctx.notes.push(...plan.report);
  return plan.feature;
}

// ------------------------------------------------------------------------------------- shapes

export function circle(cx: number, cy: number, r: number, n = 28, wobble = 0, rand?: () => number): Point[] {
  const out: Point[] = [];
  const phase = rand ? rand() * Math.PI * 2 : 0;
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    // a gentle, seed-dependent wander of the radius: lumpy, not a perfect disc
    const rr = r * (1 + wobble * (0.6 * Math.sin(3 * a + phase) + 0.4 * Math.sin(5 * a + 2 * phase)));
    out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return out;
}

export function star(cx: number, cy: number, rOut: number, rIn: number, points = 5, turn = 0): Point[] {
  const out: Point[] = [];
  for (let k = 0; k < 2 * points; k++) {
    const a = turn + (Math.PI * k) / points + Math.PI / 2;
    const r = k % 2 ? rIn : rOut;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** A heart, point down (south), `s` tiles tall. */
export function heart(cx: number, cy: number, s: number, n = 40): Point[] {
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push([cx + (x * s) / 34, cy + (y * s) / 34]);
  }
  return out;
}

/** A band `width` tiles wide along a polyline, as an outline. */
export function band(path: Point[], width: number): Point[] {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([path[i][0] + (nx * width) / 2, path[i][1] + (ny * width) / 2]);
    right.push([path[i][0] - (nx * width) / 2, path[i][1] - (ny * width) / 2]);
  }
  return [...left, ...right.reverse()];
}

// ----------------------------------------------------------------------------------- the map

/** Tiles a new piece must stay off: the start's zone (plus a margin), river channels, set pieces
 *  and lakes of the base, and a margin at the map edge. */
export function forbidden(ctx: RecipeContext, startMargin = 14, edge = 4): Uint8Array {
  const { W, H } = ctx;
  const out = new Uint8Array(W * H);
  const pc = planContextOf(ctx.session);
  for (let i = 0; i < W * H; i++) if (pc.channel?.[i] || pc.protect?.[i]) out[i] = 1;
  if (pc.start) {
    const r = pc.start.radius + startMargin;
    for (let y = pc.start.y - r; y <= pc.start.y + r; y++) for (let x = pc.start.x - r; x <= pc.start.x + r; x++) if (x >= 0 && y >= 0 && x < W && y < H) out[y * W + x] = 1;
  }
  for (const f of ctx.session.features) {
    if (f.kind === "lake") polygonMask(f.params.outline, W, H).forEach((v, i) => v && (out[i] = 1));
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < edge || y < edge || x >= W - edge || y >= H - edge) out[y * W + x] = 1;
  return out;
}

/** A centre where a disc of radius r lies off `blocked`, drawn at random among the fits (null when
 *  none fits). `score` ranks the candidates (higher first) before the draw among the best third. */
export function findSpot(ctx: RecipeContext, r: number, blocked: Uint8Array, score?: (x: number, y: number) => number): [number, number] | null {
  const { W, H } = ctx;
  const fits: [number, number, number][] = [];
  const step = Math.max(2, Math.floor(r / 3));
  for (let cy = Math.ceil(r); cy < H - r; cy += step) {
    for (let cx = Math.ceil(r); cx < W - r; cx += step) {
      let ok = true;
      for (let y = Math.floor(cy - r); y <= cy + r && ok; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r && ok; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
          if (x < 0 || y < 0 || x >= W || y >= H || blocked[y * W + x]) ok = false;
        }
      }
      if (ok) fits.push([cx, cy, score ? score(cx, cy) : 0]);
    }
  }
  if (!fits.length) return null;
  fits.sort((a, b) => b[2] - a[2]);
  const top = fits.slice(0, Math.max(1, Math.ceil(fits.length / 3)));
  const pick = top[Math.floor(ctx.rand() * top.length)];
  return [pick[0], pick[1]];
}

/** Take the tiles of an outline out of every resource area and map object of the base, so the new
 *  piece's ground is free (the editor's tools do the same when a piece is placed). */
export function clearResources(ctx: RecipeContext, outline: Point[], margin = 1): void {
  const { W, H } = ctx;
  const mask = polygonMask(outline, W, H);
  if (margin > 0) {
    const grown = mask.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        for (let dy = -margin; dy <= margin; dy++) for (let dx = -margin; dx <= margin; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) grown[yy * W + xx] = 1;
        }
      }
    mask.set(grown);
  }
  const ops: EditOp[] = [];
  for (const f of ctx.session.features) {
    if (f.kind === "forest" || f.kind === "berryPatch" || f.kind === "ruinField") {
      const tiles = runsToTiles(f.params.area as Runs, W);
      const keep = tiles.filter((i) => !mask[i]);
      if (keep.length === tiles.length) continue;
      if (keep.length) ops.push({ op: "updateFeature", params: { id: f.id, patch: { params: { area: tilesToRuns(keep, W) } } } });
      else ops.push({ op: "deleteFeature", params: { id: f.id } });
    } else if (f.kind === "mapObject") {
      const p = f.params.placement;
      const tiles = "area" in p ? runsToTiles(p.area, W) : [p.y * W + p.x];
      if (tiles.some((i) => mask[i])) ops.push({ op: "deleteFeature", params: { id: f.id } });
    }
  }
  if (ops.length) apply(ctx, ops, "clear the ground");
}

/** Ground level statistics under an outline. */
export function groundUnder(ctx: RecipeContext, outline: Point[]): { min: number; max: number; mean: number; tiles: number } {
  const mask = polygonMask(outline, ctx.W, ctx.H);
  const h = ctx.session.built.heights;
  let min = 99;
  let max = 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    min = Math.min(min, h[i]);
    max = Math.max(max, h[i]);
    sum += h[i];
    n++;
  }
  return { min, max, mean: n ? sum / n : 0, tiles: n };
}

/** The start's centre and the main river's feature. */
export function startOf(ctx: RecipeContext): [number, number] {
  const f = ctx.session.features.find((g) => g.kind === "start");
  if (f && f.kind === "start") return f.params.position;
  return [ctx.W / 2, ctx.H / 2];
}

// ---------------------------------------------------------------------------------- slopes

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function orientationFor(dx: number, dy: number): "Cw0" | "Cw90" | "Cw180" | "Cw270" {
  if (dx === 0 && dy === -1) return "Cw0";
  if (dx === -1 && dy === 0) return "Cw90";
  if (dx === 0 && dy === 1) return "Cw180";
  return "Cw270";
}

/** Pin a slope where `low` tiles meet `high` tiles one level above them, nearest `near`: the low
 *  tile must have ground at its own level behind it (the slopes.connect rule). Returns the op, or
 *  null when the two never meet that way. */
export function slopeBetween(ctx: RecipeContext, low: (i: number) => boolean, high: (i: number) => boolean, near: [number, number]): EditOp | null {
  const { W, H } = ctx;
  const h = ctx.session.built.heights;
  const taken = new Set(ctx.session.built.entities.filter((e) => e.template === "Slope").map((e) => e.y * W + e.x));
  let best: { d: number; op: EditOp } | null = null;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!low(i) || taken.has(i)) continue;
      for (const [dx, dy] of DIRS) {
        const n = (y + dy) * W + (x + dx);
        const b = (y - dy) * W + (x - dx);
        if (!high(n) || h[n] !== h[i] + 1 || h[b] !== h[i]) continue;
        const d = (x - near[0]) ** 2 + (y - near[1]) ** 2;
        if (!best || d < best.d) best = { d, op: { op: "pinSlope", params: { x, y, orientation: orientationFor(dx, dy) } } };
      }
    }
  }
  return best?.op ?? null;
}
