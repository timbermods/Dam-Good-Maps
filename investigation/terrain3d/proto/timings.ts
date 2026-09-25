// CPU times of the pieces the editor would run after an edit, on the prototype's generated maps
// (Node, CPU time per run, repeated until 400 ms of CPU have run): the whole-map support check, a local support check (the
// game's own window: 6 tiles round the edit), meshing all chunks and one chunk, the sky light, a
// cutaway cap. Writes results/timings.json.
//
//   npx tsx investigation/terrain3d/proto/timings.ts <dir with terrain3d-*.vox>

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkSupport } from "./support";
import { VoxelTerrain, meshAll, meshChunk, skyLight, capMesh } from "./mesher";

const dir = process.argv[2];
// Windows' CPU clock ticks every 15.6 ms: repeat until 400 ms of CPU have run, then divide
const cpu = (f: () => void): number => {
  let n = 0;
  const c = process.cpuUsage();
  let d = process.cpuUsage(c);
  while ((d.user + d.system) / 1000 < 400 || n < 3) {
    f();
    n++;
    d = process.cpuUsage(c);
  }
  return Math.round(((d.user + d.system) / 1000 / n) * 100) / 100;
};
const out: Record<string, unknown>[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".vox")).sort()) {
  const S = Number(/-(\d+)-\d+\.vox$/.exec(f)![1]);
  const v = new Uint8Array(readFileSync(join(dir, f)));
  const t = new VoxelTerrain(S, S, 23, v);
  // a local check: the 13×13 window round an edit (the game's extended search area is 6 tiles)
  const win = (() => {
    const w = 13, cx = Math.floor(S / 2), cy = Math.floor(S / 2);
    const sub = new Uint8Array(w * w * 23);
    for (let z = 0; z < 23; z++) for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) sub[z * w * w + y * w + x] = v[z * S * S + (cy - 6 + y) * S + (cx - 6 + x)];
    return () => checkSupport(w, w, sub, 23);
  })();
  const m = meshAll(t);
  out.push({
    map: f.replace(/\.vox$/, ""),
    supportWholeMapMs: cpu(() => checkSupport(S, S, v, 23)),
    supportLocalWindowMs: cpu(win),
    meshAllMs: cpu(() => meshAll(t)),
    meshOneChunkMs: cpu(() => meshChunk(t, 2, 2)),
    skyLightMs: cpu(() => skyLight(t)),
    capMs: cpu(() => capMesh(t, 10)),
    quads: m.quads,
  });
  console.log(JSON.stringify(out[out.length - 1]));
}
writeFileSync("investigation/terrain3d/results/timings.json", JSON.stringify(out, null, 1) + "\n");
