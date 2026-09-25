// Renders for every measured map: C:\dgm-workshop\renders\<key>-top.png (shaded top-down view with
// its objects) and <key>-3d.png (isometric, from the south-east). Local only: they show other
// creators' maps. Uses the settled water measure.ts stored, so nothing is simulated again.
//
//   npx tsx investigation/workshop/render.ts [--only <text>] [--force]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { surfaceOf } from "../../src/core/format/world";
import { mapObjects } from "../../src/core/sim/model";
import { listMaps, lowPriority, RENDERS } from "./lib/paths";
import { loadMap } from "./lib/load";
import { isometric, png, topDown } from "./lib/render";
import { readSettled } from "./lib/settled";

lowPriority();
const force = process.argv.includes("--force");
const oi = process.argv.indexOf("--only");
const only = oi >= 0 ? process.argv[oi + 1] : "";
mkdirSync(RENDERS, { recursive: true });

let n = 0;
for (const ref of listMaps()) {
  if (only && !ref.key.includes(only) && !ref.fileName.includes(only)) continue;
  const top = join(RENDERS, `${ref.key}-top.png`);
  if (!force && existsSync(top)) continue;
  const l = loadMap(ref);
  if (!l.file) continue;
  const w = l.file.world;
  const W = w.sizeX;
  const H = w.sizeY;
  const s = readSettled(ref.key, W * H);
  if (!s) continue;
  const h = surfaceOf(w);
  const objs = mapObjects(w);
  writeFileSync(top, png(topDown(h, W, H, s.depth, s.contam, objs)));
  writeFileSync(join(RENDERS, `${ref.key}-3d.png`), png(isometric(h, W, H, s.depth, s.contam, objs)));
  n++;
  console.log(`${ref.key}`);
}
console.log(`rendered ${n}`);
