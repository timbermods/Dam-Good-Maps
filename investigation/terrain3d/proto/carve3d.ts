// Carving terrain above terrain: a voxel grid, operators that keep the game's support rule by
// construction, and site finders that read the terrain for places where each form belongs.
//
// The support rule (GAME_RULES.md §2): in each layer, every solid voxel over air must be within 3
// same-layer steps of a voxel that stands on a supported voxel. So:
// - galleries (tunnels, caves, ledges cut into a face) are at most 6 wide, or keep pillars;
// - a lean or a corbel grows by at most 3 per layer;
// - an undercut reaches at most 3 into a face.
// proto/support.ts checks every result anyway.

export const LAYERS = 23;
/** Terrain in layers 0–21, so the highest surface is 22 (layer 22 stays empty, FORMAT.md §4.3). */
export const MAX_SURFACE = 22;
const DX = [0, -1, 0, 1];
const DY = [-1, 0, 1, 0];

export class Vox {
  readonly N: number;
  readonly v: Uint8Array;
  constructor(readonly W: number, readonly H: number, readonly L = LAYERS) {
    this.N = W * H;
    this.v = new Uint8Array(this.N * L);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }
  get(x: number, y: number, z: number): boolean {
    if (!this.inside(x, y) || z < 0) return z < 0;
    if (z >= this.L) return false;
    return this.v[z * this.N + y * this.W + x] === 1;
  }
  set(x: number, y: number, z: number, s: boolean): void {
    if (!this.inside(x, y) || z < 0 || z >= MAX_SURFACE) return;
    this.v[z * this.N + y * this.W + x] = s ? 1 : 0;
  }
  /** Surface: the first air layer above the tile's top solid voxel. */
  top(x: number, y: number): number {
    for (let z = this.L - 1; z >= 0; z--) if (this.get(x, y, z)) return z + 1;
    return 0;
  }
  column(x: number, y: number, h: number): void {
    for (let z = 0; z < this.L; z++) this.set(x, y, z, z < h);
  }
  surface(): Int16Array {
    const out = new Int16Array(this.N);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) out[y * this.W + x] = this.top(x, y);
    return out;
  }
  /** Solid cells changed by an operator, for the report. */
  count(): number {
    let n = 0;
    for (const b of this.v) n += b;
    return n;
  }
}

// ------------------------------------------------------------------------------ site finders

export interface Face {
  /** Cliff-top tiles, in order along the face. */
  tiles: [number, number][];
  /** Direction the face looks (toward the low side): 0 −y, 1 −x, 2 +y, 3 +x. */
  dir: number;
  top: number;
  base: number;
}

/** Cliff faces: tiles whose neighbour in a direction is at least `minDrop` lower, grouped into runs
 *  along the face (same direction, next to each other, tops within 1). Longest first. */
export function findFaces(h: Int16Array, W: number, H: number, minDrop: number): Face[] {
  const faces: Face[] = [];
  for (let dir = 0; dir < 4; dir++) {
    const seen = new Uint8Array(W * H);
    const isFace = (x: number, y: number) => {
      const xx = x + DX[dir], yy = y + DY[dir];
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
      return h[y * W + x] - h[yy * W + xx] >= minDrop;
    };
    // along the face: perpendicular to dir
    const ax = DY[dir] !== 0 ? 1 : 0, ay = DY[dir] !== 0 ? 0 : 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (seen[i] || !isFace(x, y)) continue;
      // walk back to the run's start, then forward
      let sx = x, sy = y;
      while (isFace(sx - ax, sy - ay) && Math.abs(h[(sy - ay) * W + sx - ax] - h[i]) <= 1) { sx -= ax; sy -= ay; }
      const tiles: [number, number][] = [];
      let cx = sx, cy = sy, top = 0, base = 99;
      while (cx < W && cy < H && isFace(cx, cy) && Math.abs(h[cy * W + cx] - h[i]) <= 1) {
        seen[cy * W + cx] = 1;
        tiles.push([cx, cy]);
        top = Math.max(top, h[cy * W + cx]);
        base = Math.min(base, h[(cy + DY[dir]) * W + cx + DX[dir]]);
        cx += ax;
        cy += ay;
      }
      if (tiles.length >= 3) faces.push({ tiles, dir, top, base });
    }
  }
  faces.sort((a, b) => b.tiles.length * (b.top - b.base) - a.tiles.length * (a.top - a.base) || a.tiles[0][1] - b.tiles[0][1] || a.tiles[0][0] - b.tiles[0][0]);
  return faces;
}

export interface TunnelSite {
  a: [number, number];
  b: [number, number];
  dir: number;
  z: number;
  length: number;
}

/** Tunnel sites: two tiles on the same level, facing each other through a ridge that stands at
 *  least `clear` above that level all the way, with no walk between them on that level (their
 *  level regions differ). Shortest first. */
export function findTunnels(h: Int16Array, W: number, H: number, regions: Int32Array, clear: number, minLen = 5, maxLen = 40): TunnelSite[] {
  const out: TunnelSite[] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const z = h[y * W + x];
    for (let dir = 0; dir < 4; dir++) {
      let len = 0;
      let cx = x + DX[dir], cy = y + DY[dir];
      while (cx > 0 && cy > 0 && cx < W - 1 && cy < H - 1 && h[cy * W + cx] >= z + clear && len < maxLen) {
        len++;
        cx += DX[dir];
        cy += DY[dir];
      }
      if (len < minLen || len >= maxLen) continue;
      if (h[cy * W + cx] !== z) continue;
      if (regions[y * W + x] === regions[cy * W + cx]) continue;
      if (dir === 1 || dir === 0) continue; // count each pair once (from the −x / −y end)
      out.push({ a: [x, y], b: [cx, cy], dir, z, length: len });
    }
  }
  out.sort((p, q) => p.length - q.length || p.a[1] - q.a[1] || p.a[0] - q.a[0]);
  return out;
}

export interface Gap {
  a: [number, number];
  b: [number, number];
  dir: number;
  level: number;
  span: number;
  floor: number;
}

/** Gaps between high ground: two tiles at `level` or higher with lower ground between them (at
 *  least `depth` below), `minSpan`–`maxSpan` tiles across. Narrowest first. */
export function findGaps(h: Int16Array, W: number, H: number, level: number, depth: number, minSpan: number, maxSpan: number): Gap[] {
  const out: Gap[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (h[y * W + x] < level) continue;
    for (const dir of [2, 3]) {
      let span = 0, floor = 99;
      let cx = x + DX[dir], cy = y + DY[dir];
      while (cx >= 0 && cy >= 0 && cx < W && cy < H && h[cy * W + cx] <= level - depth && span <= maxSpan) {
        floor = Math.min(floor, h[cy * W + cx]);
        span++;
        cx += DX[dir];
        cy += DY[dir];
      }
      if (span < minSpan || span > maxSpan || !(cx >= 0 && cy >= 0 && cx < W && cy < H)) continue;
      if (h[cy * W + cx] < level) continue;
      out.push({ a: [x, y], b: [cx, cy], dir, level, span, floor });
    }
  }
  out.sort((p, q) => p.span - q.span || p.a[1] - q.a[1] || p.a[0] - q.a[0]);
  return out;
}

// ------------------------------------------------------------------------------ operators

/** A gallery along a path: `width` × `height` air above `floor(t)` at each step, centred on the
 *  path. Width ≤ 6 keeps the roof up without pillars. Returns the cells cleared. */
export function carveGallery(vx: Vox, path: [number, number][], floor: (t: number) => number, width: number, height: number, roof: (t: number, dz: number) => boolean = () => true): number {
  let n = 0;
  for (let t = 0; t < path.length; t++) {
    const [px, py] = path[t];
    const f = floor(t);
    const lo = -Math.floor((width - 1) / 2), hi = lo + width - 1;
    for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
      for (let dz = 0; dz < height; dz++) {
        if (!roof(t, dz) && (dx === lo || dx === hi || dy === lo || dy === hi)) continue;
        if (vx.get(px + dx, py + dy, f + dz)) { vx.set(px + dx, py + dy, f + dz, false); n++; }
      }
    }
  }
  return n;
}

/** A straight 4-connected path from a to b with a gentle wiggle from `wiggle(t)` (−1, 0, +1 across). */
export function straightPath(a: [number, number], b: [number, number], wiggle: (t: number) => number = () => 0): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
  const len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  let prevOff = 0;
  for (let t = 0; t <= len; t++) {
    const off = wiggle(t);
    const x = a[0] + dx * t + (dy !== 0 ? off : 0);
    const y = a[1] + dy * t + (dx !== 0 ? off : 0);
    if (t > 0 && off !== prevOff) {
      // keep it 4-connected: step sideways first
      out.push([a[0] + dx * t + (dy !== 0 ? prevOff : 0), a[1] + dy * t + (dx !== 0 ? prevOff : 0)]);
    }
    out.push([x, y]);
    prevOff = off;
  }
  return out;
}

/** Lean a face out: from layer `z0` up to the face's top, each layer reaches `rate(z)` further out
 *  than the one below (at most 3). Returns the overhang reached at the top. */
export function leanOut(vx: Vox, face: Face, z0: number, rate: (t: number, z: number) => number): number {
  let maxExt = 0;
  for (let t = 0; t < face.tiles.length; t++) {
    const [fx, fy] = face.tiles[t];
    const top = vx.top(fx, fy);
    let ext = 0;
    for (let z = z0; z < top; z++) {
      const r = Math.min(3, Math.max(0, rate(t, z)));
      ext += r;
      for (let k = 1; k <= ext; k++) {
        const x = fx + DX[face.dir] * k, y = fy + DY[face.dir] * k;
        if (!vx.inside(x, y)) break;
        if (!vx.get(x, y, z)) vx.set(x, y, z, true);
      }
    }
    if (ext > maxExt) maxExt = ext;
  }
  return maxExt;
}

/** Undercut a face: clear `depth` (≤ 3) tiles into the face over layers z0..z1. */
export function undercut(vx: Vox, face: Face, from: number, to: number, z0: number, z1: number, depth: (t: number) => number): number {
  let n = 0;
  for (let t = from; t < to && t < face.tiles.length; t++) {
    const [fx, fy] = face.tiles[t];
    const d = Math.min(3, depth(t));
    for (let k = 0; k < d; k++) {
      const x = fx - DX[face.dir] * k, y = fy - DY[face.dir] * k;
      for (let z = z0; z <= z1; z++) if (vx.get(x, y, z)) { vx.set(x, y, z, false); n++; }
    }
  }
  return n;
}

/** A cliff path: a ledge cut `depth` tiles into a face and `height` high, whose floor rises one
 *  level every `step` tiles from `z0` until it meets the top. Each rise is a one-level step, so
 *  natural slopes join it. Returns the tiles of the ledge floor with their levels. */
export function cliffPath(vx: Vox, face: Face, z0: number, step: number, depth = 2, height = 3): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (let t = 0; t < face.tiles.length; t++) {
    const [fx, fy] = face.tiles[t];
    const top = vx.top(fx, fy);
    const f = z0 + Math.floor(t / step);
    if (f >= top) break;
    for (let k = 0; k < depth; k++) {
      const x = fx - DX[face.dir] * k, y = fy - DY[face.dir] * k;
      for (let z = f; z < Math.min(f + height, MAX_SURFACE); z++) vx.set(x, y, z, false);
      vx.set(x, y, f - 1, true);
      out.push({ x, y, z: f });
    }
  }
  return out;
}

/** A natural bridge over a gap at its deck level: the deck (`width` tiles wide) plus a corbelled
 *  underside, each layer reaching at most 3 further than the one below, shaped like an arch. */
export function skyBridge(vx: Vox, g: Gap, width: number): { layers: number; thickness: number } {
  const deck = g.level - 1; // the deck's top voxel layer; its top is walkable at g.level
  const span = g.span;
  const half = Math.ceil(span / 2);
  // layers under the deck: reach e_j from each end at deck − j, e_0 = half; e_j ≥ e_{j−1} − 3;
  // a rounder underside with smaller steps near the crown
  const reach: number[] = [half];
  while (reach[reach.length - 1] > 0) {
    const prev = reach[reach.length - 1];
    const step = reach.length <= 1 ? 1 : reach.length === 2 ? 2 : 3;
    reach.push(Math.max(0, prev - step));
  }
  const ax = DY[g.dir] !== 0 ? 1 : 0, ay = DY[g.dir] !== 0 ? 0 : 1;
  const lo = -Math.floor((width - 1) / 2);
  for (let t = 1; t <= span; t++) {
    const dEnd = Math.min(t, span + 1 - t);
    for (let j = 0; j < reach.length; j++) {
      if (dEnd > reach[j]) continue;
      for (let w = lo; w < lo + width; w++) {
        const x = g.a[0] + DX[g.dir] * t + ax * w, y = g.a[1] + DY[g.dir] * t + ay * w;
        vx.set(x, y, deck - j, true);
      }
    }
  }
  return { layers: reach.length - 1, thickness: reach.length - 1 };
}

/** A window arch through a wall or fin: an opening `span` long along the wall and `height` high,
 *  its top corbelled in (at most 3 per layer). `across` tiles through, in direction `dir`. */
export function windowArch(vx: Vox, cx: number, cy: number, dir: number, z0: number, span: number, height: number, across: number): number {
  let n = 0;
  const ax = DY[dir] !== 0 ? 1 : 0, ay = DY[dir] !== 0 ? 0 : 1;
  // the crown's opening is at most 5 wide (the lintel reaches 3 from each side), and each layer
  // below may be up to 3 wider on each side: steps 1, 2, 3, 3 … from the crown down (a round top)
  const halfSpan = Math.floor(span / 2);
  const halfAt: number[] = new Array(height).fill(halfSpan);
  let hw = Math.min(2, halfSpan);
  const steps = [1, 2, 3];
  for (let k = 0; k < height; k++) {
    const dz = height - 1 - k;
    halfAt[dz] = Math.min(halfSpan, hw);
    hw += steps[Math.min(k, 2)];
  }
  for (let dz = 0; dz < height; dz++) {
    const half = halfAt[dz];
    for (let s = -half; s <= half; s++) {
      for (let k = 0; k < across; k++) {
        const x = cx + ax * s + DX[dir] * k, y = cy + ay * s + DY[dir] * k;
        if (vx.get(x, y, z0 + dz)) { vx.set(x, y, z0 + dz, false); n++; }
      }
    }
  }
  return n;
}
