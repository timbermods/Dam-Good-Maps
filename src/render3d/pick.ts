// Heightfield picking (EDITOR_PLAN §8): which tile a ray from the camera hits. The ray walks the
// tile grid (a 2D DDA) and stops at the first tile whose top it passes below, or whose wall it
// meets. Columns with caves or overhangs are picked by their surface height. Pure TypeScript.
//
// World space: X = x, Y = height, Z = −y.

export interface Ray {
  origin: [number, number, number];
  direction: [number, number, number];
}

export interface TileHit {
  x: number;
  y: number;
  /** Where the ray hit, in world space. */
  point: [number, number, number];
  face: "top" | "side";
  t: number;
}

/** The first tile the ray hits, or null if it misses the map. */
export function pickHeightfield(ray: Ray, W: number, H: number, heights: Uint8Array, maxHeight = 23): TileHit | null {
  const [ox, oy, oz] = ray.origin;
  const [dxw, dy, dzw] = ray.direction;
  // grid coordinates: gx = X, gy = −Z
  const gx0 = ox;
  const gy0 = -oz;
  const dgx = dxw;
  const dgy = -dzw;
  // clip to the box [0, W] × [0, maxHeight] × [0, H]
  let tmin = 0;
  let tmax = Infinity;
  const slab = (o: number, d: number, lo: number, hi: number): boolean => {
    if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
    let t0 = (lo - o) / d;
    let t1 = (hi - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    return tmin <= tmax;
  };
  if (!slab(gx0, dgx, 0, W) || !slab(gy0, dgy, 0, H) || !slab(oy, dy, 0, maxHeight)) return null;
  const eps = 1e-7;
  let t = tmin;
  const px = gx0 + dgx * (t + eps);
  const py = gy0 + dgy * (t + eps);
  let x = Math.min(W - 1, Math.max(0, Math.floor(px)));
  let y = Math.min(H - 1, Math.max(0, Math.floor(py)));
  const stepX = dgx > 0 ? 1 : dgx < 0 ? -1 : 0;
  const stepY = dgy > 0 ? 1 : dgy < 0 ? -1 : 0;
  const tDeltaX = stepX ? Math.abs(1 / dgx) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dgy) : Infinity;
  let tMaxX = stepX > 0 ? (x + 1 - gx0) / dgx : stepX < 0 ? (x - gx0) / dgx : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - gy0) / dgy : stepY < 0 ? (y - gy0) / dgy : Infinity;
  let first = true;
  for (let guard = 0; guard < 4 * (W + H) + 8; guard++) {
    const tOut = Math.min(tMaxX, tMaxY, tmax);
    const h = heights[y * W + x];
    const yIn = oy + dy * t;
    const yOut = oy + dy * tOut;
    if (yIn <= h) {
      // entered this tile below its top: its wall (or, on the first tile, the ray started below)
      return { x, y, point: [ox + dxw * t, yIn, oz + dzw * t], face: first && t === 0 ? "top" : "side", t };
    }
    if (yOut <= h && dy < 0) {
      const th = (h - oy) / dy;
      return { x, y, point: [ox + dxw * th, h, oz + dzw * th], face: "top", t: th };
    }
    if (tOut >= tmax) return null;
    first = false;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
    } else {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
    }
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
  }
  return null;
}

/** Where the ray crosses the horizontal plane at `height` (null if parallel or behind). */
export function pickPlane(ray: Ray, height: number): { x: number; y: number; point: [number, number, number] } | null {
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.direction;
  if (Math.abs(dy) < 1e-9) return null;
  const t = (height - oy) / dy;
  if (t < 0) return null;
  const X = ox + dx * t;
  const Z = oz + dz * t;
  return { x: Math.floor(X), y: Math.floor(-Z), point: [X, height, Z] };
}
