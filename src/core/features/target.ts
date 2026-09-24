// The terrain a build step writes into (PLAN §19.3 `RasterTarget`): heights, the protected mask
// later steps may not change, the river channel, and notes. A rebuild of a dirty region (PLAN §19.7)
// runs every rasterizer restricted to the region's tiles; rasterizers are per-tile, so the tiles
// inside the region come out exactly as in a full build. The few that read other tiles (the dam
// site's ridge ends, the smooth brush) make the pipeline widen the region to cover what they read.

import { pathField, type PathField } from "./geometry";
import type { Feature, RiverFeature } from "./schema";

/** A set of tiles: an inclusive bounding rectangle and, optionally, a mask inside it. */
export interface TileRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** null: every tile of the rectangle. */
  mask: Uint8Array | null;
}

export function fullRegion(W: number, H: number): TileRegion {
  return { x0: 0, y0: 0, x1: W - 1, y1: H - 1, mask: null };
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A rectangle grown by `m` tiles and clipped to the map, or null when it misses the map. */
export function clipRect(r: Rect, W: number, H: number, m = 0): Rect | null {
  const x0 = Math.max(0, Math.floor(r.x0) - m);
  const y0 = Math.max(0, Math.floor(r.y0) - m);
  const x1 = Math.min(W - 1, Math.ceil(r.x1) + m);
  const y1 = Math.min(H - 1, Math.ceil(r.y1) + m);
  return x0 > x1 || y0 > y1 ? null : { x0, y0, x1, y1 };
}

export function boundsOf(points: readonly (readonly number[])[]): Rect | null {
  if (!points.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
}

/** Path fields by river path, shared between the builds of one document. */
export type FieldCache = Map<string, PathField>;

export interface TargetInit {
  W: number;
  H: number;
  seed: number;
  features: readonly Feature[];
  heights: Uint8Array;
  protectedMask: Uint8Array;
  channel: Uint8Array;
  region: TileRegion;
  /** Tiles whose generated content a regeneration kept (locks); generated features skip them. */
  locked?: Uint8Array | null;
  fields?: FieldCache;
}

export class BuildTarget {
  readonly W: number;
  readonly H: number;
  readonly seed: number;
  readonly heights: Uint8Array;
  readonly protectedMask: Uint8Array;
  readonly channel: Uint8Array;
  readonly region: TileRegion;
  readonly locked: Uint8Array | null;
  readonly notes: string[] = [];
  private readonly features: Map<string, Feature>;
  private readonly fields: FieldCache;

  constructor(init: TargetInit) {
    this.W = init.W;
    this.H = init.H;
    this.seed = init.seed;
    this.heights = init.heights;
    this.protectedMask = init.protectedMask;
    this.channel = init.channel;
    this.region = init.region;
    this.locked = init.locked ?? null;
    this.features = new Map(init.features.map((f) => [f.id, f]));
    this.fields = init.fields ?? new Map();
  }

  river(id: string): RiverFeature | undefined {
    const f = this.features.get(id);
    return f && f.kind === "river" ? f : undefined;
  }

  pathField(riverId: string): PathField {
    const r = this.river(riverId);
    if (!r) throw new Error(`unknown river ${riverId}`);
    const key = `${this.W}x${this.H}:${JSON.stringify(r.params.path)}`;
    let f = this.fields.get(key);
    if (!f) {
      f = pathField(r.params.path, this.W, this.H);
      this.fields.set(key, f);
    }
    return f;
  }

  inRegion(i: number): boolean {
    const r = this.region;
    const x = i % this.W;
    const y = (i - x) / this.W;
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && (!r.mask || r.mask[i] === 1);
  }

  /** Visit the region's tiles in index order. */
  forEach(fn: (i: number, x: number, y: number) => void): void {
    const { x0, y0, x1, y1, mask } = this.region;
    const W = this.W;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (mask && !mask[i]) continue;
        fn(i, x, y);
      }
    }
  }

  /** May feature `f` write tile i? Generated features leave locked tiles alone. */
  writable(i: number, f: Feature): boolean {
    return !(this.locked && this.locked[i] && f.origin === "generated");
  }

  protect(i: number): void {
    this.protectedMask[i] = 1;
  }

  note(msg: string): void {
    this.notes.push(msg);
  }
}
