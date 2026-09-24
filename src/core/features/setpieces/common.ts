// What the set-piece builders share (PLAN §19.3): the context a plan is made in, directions, the
// map's flow budget, and the reduce-and-report rule. A value outside a builder's hard bounds is
// rejected; a value inside them but beyond what this map allows is reduced to the nearest
// achievable value, and the reduction is reported in plain words.

import { density } from "../../gen/calibrated";
import type { Feature, Point } from "../schema";

/** The map a plan is made on (PLAN §19.3 `BuildContext`): the macro layout's terrain during
 *  generation, the current map in the editor. The same code gives the same plan in both. */
export interface PlanContext {
  W: number;
  H: number;
  seed: number;
  features: readonly Feature[];
  /** The surface the piece is planned on (empty in a generation's macro layout, before any
   *  terrain exists: builders that need terrain are planned after the ground is built). */
  heights: Uint8Array;
  /** River channel tiles of that surface, when known. */
  channel?: Uint8Array | null;
  /** Tiles objects take (the start's zone, slopes, sources, resources), when known. */
  occupied?: Uint8Array | null;
  /** The start's centre: a builder never moves it and keeps off its zone. */
  start?: { x: number; y: number; radius: number } | null;
  /** Tiles a builder may not touch (locked regions; during regeneration the player's features).
   *  A plan that would have to fails with the reason. */
  locked?: Uint8Array | null;
  /** Tiles other pieces hold (the start's bench, set pieces, their channels): a new piece's
   *  channels go round them. */
  protect?: Uint8Array | null;
  /** Objects standing on the map (x, y, template), for the report of what a piece clears. */
  objects?: readonly { x: number; y: number; template: string }[] | null;
}

/** A value a plan resolved, or asked for: numbers, words, flags and flat lists of numbers. */
export type PlanValue = number | string | boolean | number[];
export type PlanRecord = Record<string, PlanValue>;

export type PlanOutcome = { ok: true; request: PlanRecord; plan: PlanRecord; report: string[] } | { ok: false; errors: string[] };

export interface Range {
  min: number;
  max: number;
  typical?: [number, number];
}

export interface AchievableRanges {
  [param: string]: Range;
}

// ------------------------------------------------------------------------------------ directions

export type Facing = "north" | "east" | "south" | "west";
export const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];

/** The unit step of a facing, in tiles (x east, y north). */
export const STEP: Record<Facing, [number, number]> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };

/** Tile (x, y) of the local frame of a piece at (ox, oy) facing `f`: u runs along the facing,
 *  v across it (to the left of the facing). */
export function local(ox: number, oy: number, f: Facing, u: number, v: number): [number, number] {
  const [fx, fy] = STEP[f];
  return [ox + u * fx - v * fy, oy + u * fy + v * fx];
}

/** The map side a line across facing `f` runs along. */
export function sideAcross(f: Facing, W: number, H: number): number {
  return f === "north" || f === "south" ? W : H;
}

/** The cardinal direction nearest a vector. Ties go to the east–west axis. */
export function nearestFacing(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "north" : "south";
}

// ------------------------------------------------------------------------------------------ flow

/** The map's Normal flow budget in blocks per second (PLAN §5.3, §9.10): the size-aware official
 *  median of clean source strength. 48² 1.2, 96² 3.0, 128² 3.6, 192² 4.4, 256² 7.2. */
export function flowBudget(W: number, H: number): number {
  const area = W * H;
  return Math.round(density("water_strength_per_10k", area) * (area / 1e4) * 100) / 100;
}

/** River flow presets (PLAN §19.2): gentle 1, steady 2, strong 4 blocks per second. */
export const FLOW_PRESETS = { gentle: 1, steady: 2, strong: 4 } as const;
export type FlowPreset = keyof typeof FLOW_PRESETS;

export function flowOf(v: PlanValue | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v in FLOW_PRESETS) return FLOW_PRESETS[v as FlowPreset];
  return fallback;
}

// -------------------------------------------------------------------------------------- reducing

/** Clamp a requested value to a range; the report says what changed and why. */
export function clampReported(name: string, value: number, range: { min: number; max: number }, report: string[], why = "this map allows"): number {
  if (value < range.min) {
    report.push(`${name} ${fmt(value)} raised to ${fmt(range.min)}, the smallest ${why}`);
    return range.min;
  }
  if (value > range.max) {
    report.push(`${name} ${fmt(value)} reduced to ${fmt(range.max)}, the largest ${why}`);
    return range.max;
  }
  return value;
}

export function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ------------------------------------------------------------------------------------ tile tests

export function inMap(W: number, H: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < W && y < H;
}

/** Whether tile i is in the start's zone (its bench and the clear radius around it). */
export function nearStart(ctx: PlanContext, x: number, y: number, margin = 0): boolean {
  const s = ctx.start;
  if (!s) return false;
  const r = s.radius + margin;
  return Math.abs(x - s.x) <= r && Math.abs(y - s.y) <= r;
}

/** What a set of tiles would clear, in plain words ("12 trees and 3 ruin columns"), or "". */
export function clearsText(ctx: PlanContext, tiles: ReadonlySet<number>): string {
  if (!ctx.objects) return "";
  let trees = 0;
  let bushes = 0;
  let ruins = 0;
  let other = 0;
  for (const o of ctx.objects) {
    if (!tiles.has(o.y * ctx.W + o.x)) continue;
    if (o.template === "Slope" || o.template === "WaterSource" || o.template === "BadwaterSource" || o.template === "StartingLocation") continue;
    if (o.template === "BlueberryBush") bushes++;
    else if (o.template.startsWith("RuinColumnH")) ruins++;
    else if (o.template === "Pine" || o.template === "Birch" || o.template === "Oak" || o.template === "Succulent") trees++;
    else other++;
  }
  const parts: string[] = [];
  if (trees) parts.push(`${trees} tree${trees > 1 ? "s" : ""}`);
  if (bushes) parts.push(`${bushes} berry bush${bushes > 1 ? "es" : ""}`);
  if (ruins) parts.push(`${ruins} ruin column${ruins > 1 ? "s" : ""}`);
  if (other) parts.push(`${other} other object${other > 1 ? "s" : ""}`);
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function pointOf(v: PlanValue | undefined): Point | null {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n)) ? [v[0], v[1]] : null;
}

/** Pairs of a flat list x0, y0, x1, y1, … */
export function pairs(v: PlanValue | undefined): [number, number][] {
  const out: [number, number][] = [];
  if (!Array.isArray(v)) return out;
  for (let k = 0; k + 1 < v.length; k += 2) out.push([v[k], v[k + 1]]);
  return out;
}
