// Light baked when the mesh is built (ROADMAP "Map look", D86): per-tile data for the terrain
// shader (height, soil, sky visibility, water over the top) and a soft sun-shadow map. Pure
// TypeScript and deterministic: the same map always bakes the same bytes.
//
// - Sky visibility (broad ambient occlusion): how much of the sky a tile's top sees, from the
//   highest ground within 5 tiles in 8 directions. The bottom of a gorge sees less sky.
// - Sun shadows: the sun shines from the north-west. A sweep from the sun's side carries the top
//   of the shadow volume across the map (`shadowTops`): a point is in shadow when it lies below
//   it. Two sweeps with the sun a little higher and lower give the penumbra, so shadows are soft
//   and widen with the distance from what casts them. Trees and ruins cast shadows too.
// - Contact shadows at the foot of walls are drawn by the shader from the tile data (the heights
//   of the neighbours next to each point), so they stay sharp at every zoom.

import { DEAD, YOUNG, type EntityView, type SoilView, type SurfaceWater } from "./model";
import { LIGHT } from "./palette";

/** Shadow samples per tile, along each axis. */
export const SHADOW_RES = 2;

/** Shadow-top heights are stored as bytes: (top + 2) × 9, so −2 to 26.3 levels at 0.11 steps. */
export const SHADOW_SCALE = 9;
export const SHADOW_OFFSET = 2;

export function encodeTop(t: number): number {
  return Math.max(0, Math.min(255, Math.round((t + SHADOW_OFFSET) * SHADOW_SCALE)));
}

export function decodeTop(b: number): number {
  return b / SHADOW_SCALE - SHADOW_OFFSET;
}

const SKY_DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SKY_STEPS = [1, 2, 3, 5];

/** Sky visibility per tile, 0–255 (255: the whole sky). */
export function skyVisibility(W: number, H: number, heights: Uint8Array): Uint8Array {
  const out = new Uint8Array(W * H);
  const norm = 2 / Math.PI;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = heights[y * W + x];
      let occ = 0;
      for (const [dx, dy] of SKY_DIRS) {
        const len = dx && dy ? Math.SQRT2 : 1;
        let best = 0;
        for (const k of SKY_STEPS) {
          const xx = x + dx * k;
          const yy = y + dy * k;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
          const s = (heights[yy * W + xx] - h) / (k * len);
          if (s > best) best = s;
        }
        occ += Math.atan(best) * norm;
      }
      // the horizon's angle averaged over the directions; walls hide the sky's low part only
      out[y * W + x] = Math.round(255 * Math.max(0, 1 - (occ / SKY_DIRS.length) * 0.9));
    }
  }
  return out;
}

/** Extra height that objects add to the shadow casters of their tile (trees, ruins, the start). */
export function objectCasters(W: number, H: number, e: EntityView | null): Float32Array | null {
  if (!e || !e.count) return null;
  const out = new Float32Array(W * H);
  const tall: Record<string, number> = { Pine: 1.35, Oak: 1.2, Birch: 1.15, Succulent: 0.5, StartingLocation: 2.2 };
  for (let k = 0; k < e.count; k++) {
    const t = e.templates[e.template[k]];
    const x = e.x[k];
    const y = e.y[k];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    let add = tall[t] ?? 0;
    const ruin = /^RuinColumnH(\d)$/.exec(t);
    if (ruin) add = Number(ruin[1]) * 0.85;
    if (!add) continue;
    const f = e.flags[k];
    if (f & DEAD) add *= t === "StartingLocation" ? 1 : 0.35;
    if (f & YOUNG) add *= 0.5;
    const i = y * W + x;
    if (add > out[i]) out[i] = add;
  }
  return out;
}

/** The top of the shadow volume at each shadow sample (W·R × H·R, row-major from the south-west),
 *  for the sun at `elevation`: a point at height z is lit when z is at or above it. */
export function shadowTops(W: number, H: number, heights: Uint8Array, casters: Float32Array | null, elevation: number): Float32Array {
  const R = SHADOW_RES;
  const SW = W * R;
  const SH = H * R;
  const out = new Float32Array(SW * SH);
  // the sun is toward (−x, +y): the sample the light comes through is one west and one north
  const drop = (Math.SQRT2 / R) * Math.tan(elevation);
  const occ = (sx: number, sy: number): number => {
    const i = Math.floor(sy / R) * W + Math.floor(sx / R);
    return heights[i] + (casters ? casters[i] : 0);
  };
  for (let sx = 0; sx < SW; sx++) {
    for (let sy = 0; sy < SH; sy++) {
      if (sx === 0 || sy === SH - 1) {
        out[sy * SW + sx] = -SHADOW_OFFSET;
        continue;
      }
      const up = (sy + 1) * SW + sx - 1;
      const top = Math.max(occ(sx - 1, sy + 1), out[up]) - drop;
      out[sy * SW + sx] = top;
    }
  }
  return out;
}

/** The shadow map as RGBA bytes (W·R × H·R): R the shadow top with the sun a little higher, G a
 *  little lower (the penumbra between them). */
export function shadowMap(W: number, H: number, heights: Uint8Array, casters: Float32Array | null): Uint8Array {
  const hi = shadowTops(W, H, heights, casters, LIGHT.sunElevation + LIGHT.penumbra);
  const lo = shadowTops(W, H, heights, casters, LIGHT.sunElevation - LIGHT.penumbra);
  const out = new Uint8Array(hi.length * 4);
  for (let k = 0; k < hi.length; k++) {
    out[k * 4] = encodeTop(hi[k]);
    out[k * 4 + 1] = encodeTop(lo[k]);
    out[k * 4 + 3] = 255;
  }
  return out;
}

/** How lit a point at height z is, 0–1, from its shadow sample (the shader's rule). */
export function litFraction(z: number, topHigh: number, topLow: number): number {
  const span = Math.max(0.05, topLow - topHigh);
  return Math.max(0, Math.min(1, (z - topHigh) / span));
}

/** Water over a tile's top as a byte: 0 dry, else 1 + depth × 60 (to 255). */
export function waterByte(sw: SurfaceWater | null, heights: Uint8Array, i: number): number {
  if (!sw) return 0;
  const s = sw.surface[i];
  if (!(s === s)) return 0;
  if (sw.floor[i] < heights[i] - 0.01) return 0; // water in a cave under the top
  return Math.min(255, 1 + Math.round(sw.depth[i] * 60));
}

/** Soil bytes as the tile data's two nibbles: moisture (levels 1–15, 0 dry) above contamination
 *  (1–15, 0 clean). Any moisture or contamination stays above 0. */
export function soilNibbles(moisture: number, contamination: number): number {
  const m = moisture > 0 ? Math.max(1, Math.min(15, Math.round(moisture / 15))) : 0;
  const c = contamination > 0 ? Math.max(1, Math.min(15, Math.round(contamination / 17))) : 0;
  return (m << 4) | c;
}

/** The terrain shader's per-tile data, RGBA bytes (W × H): R the height, G the soil nibbles,
 *  B the sky visibility, A the water over the top. */
export function tileData(W: number, H: number, heights: Uint8Array, sky: Uint8Array, soil: SoilView | null, sw: SurfaceWater | null, into?: Uint8Array): Uint8Array {
  const N = W * H;
  const out = into ?? new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    out[o] = heights[i];
    out[o + 1] = soil ? soilNibbles(soil.moisture[i], soil.contamination[i]) : 0;
    out[o + 2] = sky[i];
    out[o + 3] = waterByte(sw, heights, i);
  }
  return out;
}
