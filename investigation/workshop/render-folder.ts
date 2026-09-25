// Render the maps a tool wrote into a local folder (generated maps, recipe results): every
// <key>.timber with its <key>.f32 settled water becomes <key>-top.png and <key>-3d.png in
// <folder>\renders. Our own generated maps, so these may be shared.
//
//   npx tsx investigation/workshop/render-folder.ts C:\dgm-workshop\recipes [--only text]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTimber } from "../../src/core/format/timber";
import { surfaceOf } from "../../src/core/format/world";
import { mapObjects } from "../../src/core/sim/model";
import { lowPriority } from "./lib/paths";
import { isometric, png, topDown } from "./lib/render";

lowPriority();
const dir = process.argv[2];
const oi = process.argv.indexOf("--only");
const only = oi >= 0 ? process.argv[oi + 1] : "";
const out = join(dir, "renders");
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".timber"))) {
  const key = f.replace(/\.timber$/, "");
  if (only && !key.includes(only)) continue;
  if (!existsSync(join(dir, `${key}.f32`))) continue;
  const w = readTimber(new Uint8Array(readFileSync(join(dir, f)))).world;
  const N = w.sizeX * w.sizeY;
  const b = readFileSync(join(dir, `${key}.f32`));
  const a = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  const h = surfaceOf(w);
  const objs = mapObjects(w);
  writeFileSync(join(out, `${key}-top.png`), png(topDown(h, w.sizeX, w.sizeY, a.subarray(0, N), a.subarray(N, 2 * N), objs, 512)));
  writeFileSync(join(out, `${key}-3d.png`), png(isometric(h, w.sizeX, w.sizeY, a.subarray(0, N), a.subarray(N, 2 * N), objs, 800)));
  n++;
}
console.log(`rendered ${n}`);
