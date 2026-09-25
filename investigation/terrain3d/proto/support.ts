// The game's support rule (`TerrainPhysicsPostLoader.ValidateTerrain`, MaxSupportDistance 3),
// terrain only: a queue starts at z = 0 on every tile with distance 0; a solid voxel reached with
// distance d is valid, the voxel above it is reached with distance 0, and if d < 3 its four
// sideways neighbours in the same layer are reached with d + 1. Support never passes downward or
// through air. Voxels in runs that do not start at z = 0 and are never reached are deleted, and the
// pass repeats (deleting can only remove support). `stackTops` are cells whose voxel above counts
// as supported (the top of a finished stackable object).

export interface SupportResult {
  /** Voxels (index z·N + tile) the game would delete, over every pass. */
  unsupported: number[];
  /** Support distance per voxel after the last pass: 0–3, 99 unreached, 255 air. */
  distance: Uint8Array;
  passes: number;
}

export function checkSupport(W: number, H: number, voxels: Uint8Array, layers = 23, stackTops: readonly number[] = []): SupportResult {
  const N = W * H;
  const vox = voxels.slice();
  const unsupported: number[] = [];
  let passes = 0;
  let dist = new Uint8Array(N * layers);
  for (;;) {
    passes++;
    dist = new Uint8Array(N * layers).fill(255);
    for (let v = 0; v < N * layers; v++) if (vox[v]) dist[v] = 99;
    const queue: number[] = [];
    const push = (v: number, d: number) => {
      if (vox[v] && d < dist[v]) {
        dist[v] = d;
        queue.push(v);
      }
    };
    for (let i = 0; i < N; i++) push(i, 0);
    for (const k of stackTops) if (k + N < N * layers) push(k + N, 0);
    for (let h = 0; h < queue.length; h++) {
      const v = queue[h];
      const d = dist[v];
      const z = Math.floor(v / N);
      const i = v - z * N;
      const x = i % W;
      const y = (i - x) / W;
      if (z + 1 < layers) push(v + N, 0);
      if (d < 3) {
        if (x > 0) push(v - 1, d + 1);
        if (x < W - 1) push(v + 1, d + 1);
        if (y > 0) push(v - W, d + 1);
        if (y < H - 1) push(v + W, d + 1);
      }
    }
    // delete unreached voxels outside the run that starts at z = 0
    let removed = 0;
    for (let i = 0; i < N; i++) {
      let z = 0;
      while (z < layers && vox[z * N + i]) z++; // run 0
      for (; z < layers; z++) {
        const v = z * N + i;
        if (vox[v] && dist[v] === 99) {
          vox[v] = 0;
          unsupported.push(v);
          removed++;
        }
      }
    }
    if (!removed) break;
  }
  return { unsupported, distance: dist, passes };
}
