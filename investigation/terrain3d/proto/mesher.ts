// A mesher for terrain above terrain (step 4.2): every tile meshed alike, from voxels.
//
// - Faces: a solid voxel gets a face toward each air neighbour, tops, undersides and all four
//   sides. The bottom layer's underside is never seen and gets none; the map's border gets walls.
// - Greedy merging per face plane: in each 32×32 chunk (the product's CHUNK), the faces of one
//   plane and one direction merge into maximal rectangles, so a heightfield's flat tops and long
//   walls stay a few quads, and cave ceilings and overhang undersides merge the same way.
// - Light: a 3D texture of sky light per cell (1 under open sky, fading with the walk from the
//   nearest sky-lit air, 0 in solid). The shader samples it just in front of each face, which
//   darkens caves and corners without baking anything into the mesh, so merging stays maximal.
// - Cutaway: a level slice, as the game's own (`MaxVisibleLevel`): everything above the level is
//   discarded in the shader, and a cap mesh closes the cut on solid ground.
//
// World space as the product's (D45): X = x, Y = height, Z = −y. Pure TypeScript: it runs in Node
// (timings) and in the browser (the benchmark page).

export const CHUNK = 32;

export interface Mesh {
  positions: Float32Array;
  normals: Int8Array;
  indices: Uint32Array;
  quads: number;
}

class Quads {
  pos: Float32Array;
  nrm: Int8Array;
  n = 0;
  constructor(cap = 1024) {
    this.pos = new Float32Array(cap * 12);
    this.nrm = new Int8Array(cap * 12);
  }
  /** A quad p, p+u, p+u+v, p+v, with u × v along the outward normal (nx, ny, nz). */
  add(px: number, py: number, pz: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, nx: number, ny: number, nz: number): void {
    if ((this.n + 1) * 12 > this.pos.length) {
      const p = new Float32Array(this.pos.length * 2);
      p.set(this.pos);
      this.pos = p;
      const q = new Int8Array(this.nrm.length * 2);
      q.set(this.nrm);
      this.nrm = q;
    }
    const o = this.n * 12;
    const P = this.pos, Nn = this.nrm;
    P[o] = px; P[o + 1] = py; P[o + 2] = pz;
    P[o + 3] = px + ux; P[o + 4] = py + uy; P[o + 5] = pz + uz;
    P[o + 6] = px + ux + vx; P[o + 7] = py + uy + vy; P[o + 8] = pz + uz + vz;
    P[o + 9] = px + vx; P[o + 10] = py + vy; P[o + 11] = pz + vz;
    for (let k = 0; k < 4; k++) { Nn[o + 3 * k] = nx * 127; Nn[o + 3 * k + 1] = ny * 127; Nn[o + 3 * k + 2] = nz * 127; }
    this.n++;
  }
  mesh(): Mesh {
    const idx = new Uint32Array(this.n * 6);
    for (let q = 0; q < this.n; q++) {
      const b = q * 4, o = q * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
    }
    return { positions: this.pos.slice(0, this.n * 12), normals: this.nrm.slice(0, this.n * 12), indices: idx, quads: this.n };
  }
}

export class VoxelTerrain {
  readonly N: number;
  constructor(readonly W: number, readonly H: number, readonly L: number, readonly v: Uint8Array) {
    this.N = W * H;
  }
  solid(x: number, y: number, z: number): boolean {
    if (z < 0) return true;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H || z >= this.L) return false;
    return this.v[z * this.N + y * this.W + x] === 1;
  }
}

/** Greedy rectangles over a mask of `a` × `b` cells (row-major, a fastest); calls emit(a0, b0, da, db). */
function greedy(mask: Uint8Array, A: number, B: number, emit: (a: number, b: number, da: number, db: number) => void): void {
  for (let b = 0; b < B; b++) {
    for (let a = 0; a < A; ) {
      if (!mask[b * A + a]) { a++; continue; }
      let da = 1;
      while (a + da < A && mask[b * A + a + da]) da++;
      let db = 1;
      outer: while (b + db < B) {
        for (let k = 0; k < da; k++) if (!mask[(b + db) * A + a + k]) break outer;
        db++;
      }
      for (let j = 0; j < db; j++) for (let k = 0; k < da; k++) mask[(b + j) * A + a + k] = 0;
      emit(a, b, da, db);
      a += da;
    }
  }
}

/** The mesh of one chunk: every face of its voxels toward air, merged per plane. */
export function meshChunk(t: VoxelTerrain, cx: number, cy: number): Mesh {
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const X = Math.min(CHUNK, t.W - x0), Y = Math.min(CHUNK, t.H - y0), L = t.L;
  const q = new Quads(Math.max(256, X * Y));
  const s = (x: number, y: number, z: number) => t.solid(x, y, z);
  // tops and undersides: planes of constant z over (x, y)
  const mxy = new Uint8Array(X * Y);
  for (let z = 0; z < L; z++) {
    let any = 0;
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
      const m = s(x0 + x, y0 + y, z) && !s(x0 + x, y0 + y, z + 1) ? 1 : 0;
      mxy[y * X + x] = m;
      any |= m;
    }
    if (any) greedy(mxy, X, Y, (a, b, da, db) => q.add(x0 + a, z + 1, -(y0 + b), da, 0, 0, 0, 0, -db, 0, 1, 0));
    if (z === 0) continue;
    any = 0;
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
      const m = s(x0 + x, y0 + y, z) && !s(x0 + x, y0 + y, z - 1) ? 1 : 0;
      mxy[y * X + x] = m;
      any |= m;
    }
    if (any) greedy(mxy, X, Y, (a, b, da, db) => q.add(x0 + a, z, -(y0 + b), 0, 0, -db, da, 0, 0, 0, -1, 0));
  }
  // east and west walls: planes of constant x over (y, z)
  const myz = new Uint8Array(Y * L);
  for (let x = 0; x < X; x++) {
    for (const dir of [1, -1]) {
      let any = 0;
      for (let z = 0; z < L; z++) for (let y = 0; y < Y; y++) {
        const m = s(x0 + x, y0 + y, z) && !s(x0 + x + dir, y0 + y, z) ? 1 : 0;
        myz[z * Y + y] = m;
        any |= m;
      }
      if (!any) continue;
      if (dir === 1) greedy(myz, Y, L, (a, b, da, db) => q.add(x0 + x + 1, b, -(y0 + a), 0, 0, -da, 0, db, 0, 1, 0, 0));
      else greedy(myz, Y, L, (a, b, da, db) => q.add(x0 + x, b, -(y0 + a), 0, db, 0, 0, 0, -da, -1, 0, 0));
    }
  }
  // north and south walls: planes of constant y over (x, z)
  const mxz = new Uint8Array(X * L);
  for (let y = 0; y < Y; y++) {
    for (const dir of [1, -1]) {
      let any = 0;
      for (let z = 0; z < L; z++) for (let x = 0; x < X; x++) {
        const m = s(x0 + x, y0 + y, z) && !s(x0 + x, y0 + y + dir, z) ? 1 : 0;
        mxz[z * X + x] = m;
        any |= m;
      }
      if (!any) continue;
      if (dir === 1) greedy(mxz, X, L, (a, b, da, db) => q.add(x0 + a, b, -(y0 + y + 1), 0, db, 0, da, 0, 0, 0, 0, -1));
      else greedy(mxz, X, L, (a, b, da, db) => q.add(x0 + a, b, -(y0 + y), da, 0, 0, 0, db, 0, 0, 0, 1));
    }
  }
  return q.mesh();
}

/** The cap that closes a level slice: solid cells in layer `level − 1` whose cell above is solid too
 *  (where the cut shows the inside of the ground), merged per chunk-sized block. */
export function capMesh(t: VoxelTerrain, level: number): Mesh {
  const q = new Quads(1024);
  const z = level - 1;
  if (z < 0 || z >= t.L) return q.mesh();
  const mask = new Uint8Array(t.W * t.H);
  for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) mask[y * t.W + x] = t.solid(x, y, z) && t.solid(x, y, z + 1) ? 1 : 0;
  greedy(mask, t.W, t.H, (a, b, da, db) => q.add(a, level, -b, da, 0, 0, 0, 0, -db, 0, 1, 0));
  return q.mesh();
}

/** Sky light per cell, W × H × (L + 1) bytes (x fastest, then y, then z): 255 under open sky, then
 *  32 less per step through air from the nearest sky-lit cell, never below 48; 0 in solid.
 *  Only the air under roofs is walked: sky-lit cells never change, so the walk starts from the
 *  roofed cells that touch them. A heightfield costs one column scan. */
export function skyLight(t: VoxelTerrain): Uint8Array {
  const { W, H, N, v } = t;
  const L = t.L, D = L + 1;
  const out = new Uint8Array(N * D);
  const FLOOR = 48, STEP = 32;
  // 1. columns: air above the top solid voxel is sky-lit; air below it is roofed (FLOOR for now)
  let roofed = 0;
  for (let i = 0; i < N; i++) {
    let z = D - 1;
    for (; z >= 0; z--) {
      if (z < L && v[z * N + i]) break;
      out[z * N + i] = 255;
    }
    for (; z >= 0; z--) {
      if (!v[z * N + i]) { out[z * N + i] = FLOOR; roofed++; }
    }
  }
  if (!roofed) return out;
  // 2. the walk, through roofed air only, from the roofed cells beside sky-lit ones
  const queue = new Int32Array(roofed);
  let head = 0, tail = 0;
  const first = 255 - STEP;
  for (let c = 0; c < N * D; c++) {
    if (out[c] !== FLOOR) continue;
    const z = (c / N) | 0, i = c - z * N, x = i % W;
    const lit =
      (x > 0 && out[c - 1] === 255) || (x < W - 1 && out[c + 1] === 255) ||
      (i >= W && out[c - W] === 255) || (i < N - W && out[c + W] === 255);
    if (lit) { out[c] = first; queue[tail++] = c; }
  }
  while (head < tail) {
    const c = queue[head++];
    const next = out[c] - STEP;
    if (next <= FLOOR) continue;
    const z = (c / N) | 0, i = c - z * N, x = i % W;
    const nb = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, i >= W ? c - W : -1, i < N - W ? c + W : -1, z > 0 ? c - N : -1, z < D - 1 ? c + N : -1];
    for (let k = 0; k < 6; k++) {
      const n = nb[k];
      if (n < 0) continue;
      const o = out[n];
      if (o === 0 || o === 255 || o >= next) continue; // solid, sky-lit, or already brighter
      if (n < N * L && v[n]) continue;
      out[n] = next;
      if (tail < queue.length) queue[tail++] = n;
    }
  }
  return out;
}

/** Every chunk, and the totals (quads per face count as 2 triangles). */
export function meshAll(t: VoxelTerrain): { chunks: Mesh[]; quads: number } {
  const chunks: Mesh[] = [];
  let quads = 0;
  for (let cy = 0; cy < Math.ceil(t.H / CHUNK); cy++) for (let cx = 0; cx < Math.ceil(t.W / CHUNK); cx++) {
    const m = meshChunk(t, cx, cy);
    chunks.push(m);
    quads += m.quads;
  }
  return { chunks, quads };
}
