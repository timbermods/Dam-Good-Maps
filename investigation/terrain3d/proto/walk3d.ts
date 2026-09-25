// Walking on terrain above terrain (GAME_RULES.md §4): a node is every air cell standing on solid
// ground, in every layer (`OnGround`). Nodes join their 4 neighbours at the same z, and diagonals
// when both orthogonal cells are nodes too. No headroom is needed. Only slopes (and the player's
// stairs and platforms) join levels: a Slope at (x, y, z) leads from its tile at z up to the tile
// on its high side at z + 1, and needs air in its own cells z and z + 1.
//
// `autoSlopes` places natural ramps the way the build's derived slopes do on a heightfield: where
// a walkable region meets another one level higher, a slope goes on the low tile, and regions are
// joined until everything a one-level step apart is connected. Regions separated only by steps of
// two or more levels stay apart: they are reachable only by building stairs (a reward, or a
// barrier). A slope is entered from its front, at its own level (the Slope's navigation edges).

export interface Slope {
  x: number;
  y: number;
  z: number;
  /** Direction of the high side: 0 = −y (Cw0), 1 = −x (Cw90), 2 = +y (Cw180), 3 = +x (Cw270). */
  dir: number;
}

export const SLOPE_ORIENTATION = ["Cw0", "Cw90", "Cw180", "Cw270"] as const;
const DX = [0, -1, 0, 1];
const DY = [-1, 0, 1, 0];

export class FloorGraph {
  readonly N: number;
  readonly L: number;
  /** 1 where (z, tile) is a walking node. */
  readonly node: Uint8Array;
  constructor(readonly W: number, readonly H: number, readonly voxels: Uint8Array, readonly layers = 23) {
    const N = W * H;
    this.N = N;
    this.L = layers + 1;
    this.node = new Uint8Array(N * this.L);
    for (let z = 1; z < this.L; z++) {
      for (let i = 0; i < N; i++) {
        const below = voxels[(z - 1) * N + i];
        const here = z < layers ? voxels[z * N + i] : 0;
        if (below && !here) this.node[z * N + i] = 1;
      }
    }
  }

  isAir(x: number, y: number, z: number): boolean {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
    return z >= this.layers || !this.voxels[z * this.N + y * this.W + x];
  }

  isNode(x: number, y: number, z: number): boolean {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H || z < 1 || z >= this.L) return false;
    return this.node[z * this.N + y * this.W + x] === 1;
  }

  /** Free air above a node, up to the next solid voxel (the room for buildings and trees). */
  headroom(x: number, y: number, z: number): number {
    let h = 0;
    while (z + h < this.layers && !this.voxels[(z + h) * this.N + y * this.W + x]) h++;
    return z + h >= this.layers ? 99 : h;
  }

  /** Connected regions without slopes (4-neighbour plus guarded diagonals). */
  regions(): Int32Array {
    const { N, W, H, L } = this;
    const reg = new Int32Array(N * L).fill(-1);
    let next = 0;
    const q: number[] = [];
    for (let v = 0; v < N * L; v++) {
      if (!this.node[v] || reg[v] >= 0) continue;
      reg[v] = next;
      q.length = 0;
      q.push(v);
      for (let h = 0; h < q.length; h++) {
        const u = q[h];
        const z = Math.floor(u / N), i = u - z * N, x = i % W, y = (i - x) / W;
        for (let k = 0; k < 4; k++) {
          const xx = x + DX[k], yy = y + DY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = z * N + yy * W + xx;
          if (this.node[n] && reg[n] < 0) { reg[n] = next; q.push(n); }
        }
        for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (!this.isNode(xx, yy, z) || !this.isNode(x + dx, y, z) || !this.isNode(x, y + dy, z)) continue;
          const n = z * N + yy * W + xx;
          if (reg[n] < 0) { reg[n] = next; q.push(n); }
        }
      }
      next++;
    }
    return reg;
  }

  /** Nodes reachable from `start` (a node index) with the given slopes. */
  reach(start: number, slopes: readonly Slope[]): Uint8Array {
    const { N, W } = this;
    const reg = this.regions();
    const links = new Map<number, number[]>();
    const link = (a: number, b: number) => {
      if (a < 0 || b < 0 || a === b) return;
      (links.get(a) ?? links.set(a, []).get(a)!).push(b);
      (links.get(b) ?? links.set(b, []).get(b)!).push(a);
    };
    for (const s of slopes) {
      const lo = s.z * N + s.y * W + s.x;
      const hx = s.x + DX[s.dir], hy = s.y + DY[s.dir];
      if (!this.isNode(s.x, s.y, s.z) || !this.isNode(hx, hy, s.z + 1)) continue;
      // the slope is entered from its front (the side away from the high side), at z
      if (!this.isNode(s.x - DX[s.dir], s.y - DY[s.dir], s.z)) continue;
      if (!this.isAir(s.x, s.y, s.z + 1)) continue;
      link(reg[lo], reg[(s.z + 1) * N + hy * W + hx]);
    }
    const ok = new Set<number>();
    const q = [reg[start]];
    ok.add(reg[start]);
    for (let h = 0; h < q.length; h++) for (const n of links.get(q[h]) ?? []) if (!ok.has(n)) { ok.add(n); q.push(n); }
    const out = new Uint8Array(N * this.L);
    for (let v = 0; v < out.length; v++) if (reg[v] >= 0 && ok.has(reg[v])) out[v] = 1;
    return out;
  }

  /** Natural ramps: join regions one level apart with slopes, starting from the start's region,
   *  preferring the longest shared edge's middle; at most `max` slopes. Regions smaller than
   *  `minRegion` nodes are not worth a slope. Tiles in `keepClear` get none. */
  autoSlopes(start: number, max = 200, minRegion = 6, keepClear?: Uint8Array): Slope[] {
    const { N, W, H } = this;
    const reg = this.regions();
    const size = new Map<number, number>();
    for (let v = 0; v < reg.length; v++) if (reg[v] >= 0) size.set(reg[v], (size.get(reg[v]) ?? 0) + 1);
    // candidate links between regions: (low node, dir) where the high side is a node one level up
    const cands = new Map<string, { lo: number; dir: number; count: number }[]>();
    for (let v = 0; v < reg.length; v++) {
      if (reg[v] < 0) continue;
      const z = Math.floor(v / N), i = v - z * N, x = i % W, y = (i - x) / W;
      if (keepClear && keepClear[i]) continue;
      if (!this.isAir(x, y, z + 1)) continue; // the slope's upper cell
      for (let k = 0; k < 4; k++) {
        const hx = x + DX[k], hy = y + DY[k];
        if (!this.isNode(hx, hy, z + 1)) continue;
        if (!this.isNode(x - DX[k], y - DY[k], z)) continue; // its front, where beavers step on
        const a = reg[v], b = reg[(z + 1) * N + hy * W + hx];
        if ((size.get(a) ?? 0) < minRegion || (size.get(b) ?? 0) < minRegion) continue;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        (cands.get(key) ?? cands.set(key, []).get(key)!).push({ lo: v, dir: k, count: 0 });
      }
    }
    const joined = new Set<number>([reg[start]]);
    const slopes: Slope[] = [];
    let grew = true;
    while (grew && slopes.length < max) {
      grew = false;
      // deterministic order: keys sorted
      for (const key of [...cands.keys()].sort()) {
        const [a, b] = key.split(",").map(Number);
        if (joined.has(a) === joined.has(b)) continue;
        const list = cands.get(key)!;
        const c = list[Math.floor(list.length / 2)];
        const z = Math.floor(c.lo / N), i = c.lo - z * N, x = i % W, y = (i - x) / W;
        slopes.push({ x, y, z, dir: c.dir });
        joined.add(a);
        joined.add(b);
        grew = true;
        if (slopes.length >= max) break;
      }
    }
    void H;
    return slopes;
  }
}
