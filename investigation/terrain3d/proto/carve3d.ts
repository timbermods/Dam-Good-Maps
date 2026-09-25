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

/** Cliff faces: tiles whose neighbour in a direction is at least `minDrop` lower, grouped into
 *  8-connected runs and ordered along the face (one tile per step along it, the one nearest the
 *  low side). Largest first (length × drop). */
export function findFaces(h: Int16Array, W: number, H: number, minDrop: number): Face[] {
  const faces: Face[] = [];
  for (let dir = 0; dir < 4; dir++) {
    const isFace = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xx = x + DX[dir], yy = y + DY[dir];
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (h[y * W + x] - h[yy * W + xx] >= minDrop) isFace[y * W + x] = 1;
    }
    const seen = new Uint8Array(W * H);
    const alongX = DY[dir] !== 0;
    for (let i0 = 0; i0 < W * H; i0++) {
      if (!isFace[i0] || seen[i0]) continue;
      const comp: number[] = [];
      const st = [i0];
      seen[i0] = 1;
      while (st.length) {
        const i = st.pop()!;
        comp.push(i);
        const x = i % W, y = (i - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (isFace[j] && !seen[j]) { seen[j] = 1; st.push(j); }
        }
      }
      // one tile per step along the face: the one furthest toward the low side
      const byAlong = new Map<number, number>();
      for (const i of comp) {
        const x = i % W, y = (i - x) / W;
        const a = alongX ? x : y;
        const o = alongX ? y : x;
        const prev = byAlong.get(a);
        if (prev === undefined) { byAlong.set(a, i); continue; }
        const px = prev % W, py = (prev - px) / W;
        const po = alongX ? py : px;
        const toward = alongX ? DY[dir] : DX[dir];
        if ((o - po) * toward > 0) byAlong.set(a, i);
      }
      const keys = [...byAlong.keys()].sort((a, b) => a - b);
      if (keys.length < 3) continue;
      const tiles: [number, number][] = [];
      let top = 0, base = 99;
      for (const a of keys) {
        const i = byAlong.get(a)!;
        const x = i % W, y = (i - x) / W;
        tiles.push([x, y]);
        top = Math.max(top, h[i]);
        base = Math.min(base, h[(y + DY[dir]) * W + x + DX[dir]]);
      }
      faces.push({ tiles, dir, top, base });
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
      // the ledge needs its floor voxel, standing on rock: never add rock over air
      if (!vx.get(x, y, f - 1) && !vx.get(x, y, f - 2)) continue;
      for (let z = f; z < Math.min(f + height, MAX_SURFACE); z++) vx.set(x, y, z, false);
      vx.set(x, y, f - 1, true);
      out.push({ x, y, z: f });
    }
  }
  return out;
}

/** A natural bridge over a gap at its deck level: the deck (`width` rows wide) plus a corbelled
 *  underside, each layer reaching at most 3 further than the one below, shaped like an arch. Each
 *  row is corbelled from its own two walls (a gorge's walls are rarely straight). */
export function skyBridge(vx: Vox, g: Gap, width: number): { layers: number; thickness: number } {
  const deck = g.level - 1; // the deck's top voxel layer; its top is walkable at g.level
  const ax = DY[g.dir] !== 0 ? 1 : 0, ay = DY[g.dir] !== 0 ? 0 : 1;
  const lo = -Math.floor((width - 1) / 2);
  let layers = 0;
  for (let w = lo; w < lo + width; w++) {
    const ox = g.a[0] + ax * w, oy = g.a[1] + ay * w;
    // this row's gap: its own near wall (at or behind the gap's first end), then the gap, then
    // its far wall, each at the deck's level
    const topAt = (t: number) => (vx.inside(ox + DX[g.dir] * t, oy + DY[g.dir] * t) ? vx.top(ox + DX[g.dir] * t, oy + DY[g.dir] * t) : -1);
    let tw = 0;
    while (tw > -6 && topAt(tw) < g.level) tw--;
    if (topAt(tw) < g.level) continue;
    let t0 = tw + 1;
    while (t0 <= g.span + 3 && topAt(t0) >= g.level) t0++;
    let t1 = t0;
    while (t1 <= g.span + 6 && topAt(t1) >= 0 && topAt(t1) < g.level) t1++;
    const span = t1 - t0; // tiles t0 .. t1-1 are the gap on this row
    if (span <= 0 || topAt(t1) < g.level) continue;
    const half = Math.ceil(span / 2);
    const reach: number[] = [half];
    while (reach[reach.length - 1] > 0) {
      const prev = reach[reach.length - 1];
      const step = reach.length <= 1 ? 1 : reach.length === 2 ? 2 : 3;
      reach.push(Math.max(0, prev - step));
    }
    layers = Math.max(layers, reach.length - 1);
    for (let t = t0; t < t1; t++) {
      const dEnd = Math.min(t - t0 + 1, t1 - t);
      for (let j = 0; j < reach.length; j++) {
        if (dEnd > reach[j]) continue;
        const x = ox + DX[g.dir] * t, y = oy + DY[g.dir] * t;
        // the walls must hold this layer: a lower wall than the deck leaves the layer to the ones above
        vx.set(x, y, deck - j, true);
      }
    }
  }
  return { layers, thickness: layers };
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
