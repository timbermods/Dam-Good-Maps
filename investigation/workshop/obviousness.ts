// How obvious is the reservoir? For every map, the dam sites near the start (the validator's own
// sampling: straight dams across clean water, crests 1–3, lines up to 21 tiles) and the shortest
// dam that holds a Normal drought's need (380 blocks, water.reservoir). A 3-tile dam across a
// ready-made gap beside the start is spoon-fed; a site that needs a 15-tile dam plus levees, or
// terraforming, is the engineering players enjoy. Uses the settled water measure.ts stored.
//
//   npx tsx investigation/workshop/obviousness.ts     → C:\dgm-workshop\obviousness.json (local)

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { damSites } from "../../src/core/analysis/damsites";
import { readTimber } from "../../src/core/format/timber";
import { surfaceOf } from "../../src/core/format/world";
import { distanceFrom } from "../../src/core/math/grid";
import { mapObjects } from "../../src/core/sim/model";
import { listMaps, lowPriority, ROOT } from "./lib/paths";
import { loadMap } from "./lib/load";
import { readSettled } from "./lib/settled";
import { startCentre } from "./lib/measures";

lowPriority();
const NEED = 380;
export interface Obviousness {
  sites: number;
  /** Shortest dam line (tiles) whose reservoir holds the need, within 40 and within 20 tiles. */
  shortestHolding40: number | null;
  shortestHolding20: number | null;
  /** Largest volume a dam of at most 5 tiles holds within 40 tiles of the start. */
  bestShortDam: number;
  /** Largest volume any site holds within 40 tiles. */
  best: number;
}

function measure(h: Uint8Array, W: number, H: number, depth: ArrayLike<number>, contam: ArrayLike<number>, start: { x: number; y: number }): Obviousness {
  const N = W * H;
  const clean = new Uint8Array(N);
  const surf = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    clean[i] = depth[i] > 0.05 && contam[i] < 0.05 ? 1 : 0;
    surf[i] = h[i] + depth[i];
  }
  const m = new Uint8Array(N);
  for (let y = start.y - 1; y <= start.y + 1; y++) for (let x = start.x - 1; x <= start.x + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1;
  const sd = distanceFrom(m, W, H);
  // every site, not only the best per sampled tile: minRatio 0, and all three crests
  const sites = damSites(h, clean, surf, W, H, sd, 60, [1, 2, 3], 2, 0, 0);
  const near = (r: number) => sites.filter((s) => sd[s.y * W + s.x] <= r);
  const holding = (r: number) => near(r).filter((s) => s.volume >= NEED).map((s) => s.length);
  const h40 = holding(40);
  const h20 = holding(20);
  return {
    sites: near(40).length,
    shortestHolding40: h40.length ? Math.min(...h40) : null,
    shortestHolding20: h20.length ? Math.min(...h20) : null,
    bestShortDam: Math.round(near(40).filter((s) => s.length <= 5).reduce((a, s) => Math.max(a, s.volume), 0)),
    best: Math.round(near(40).reduce((a, s) => Math.max(a, s.volume), 0)),
  };
}

const out: Record<string, Obviousness & { source: string }> = {};
for (const ref of listMaps()) {
  const rec = join(ROOT, "measured", `${ref.key}.json`);
  if (!existsSync(rec)) continue;
  const r = JSON.parse(readFileSync(rec, "utf8"));
  if (!r.start) continue;
  const l = loadMap(ref);
  if (!l.file) continue;
  const w = l.file.world;
  const s = readSettled(ref.key, w.sizeX * w.sizeY);
  if (!s) continue;
  out[ref.key] = { source: ref.source, ...measure(surfaceOf(w), w.sizeX, w.sizeY, s.depth, s.contam, r.start) };
}
for (const dirName of ["generated", "recipes"]) {
  const dir = join(ROOT, dirName);
  if (!existsSync(dir)) continue;
  for (const n of readdirSync(dir).filter((f) => f.endsWith(".timber"))) {
    const key = n.replace(/\.timber$/, "");
    const file = readTimber(new Uint8Array(readFileSync(join(dir, n))));
    const w = file.world;
    const N = w.sizeX * w.sizeY;
    const b = readFileSync(join(dir, `${key}.f32`));
    const f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    const st = mapObjects(w).find((o) => o.template === "StartingLocation");
    if (!st) continue;
    out[`${dirName}:${key}`] = { source: dirName, ...measure(surfaceOf(w), w.sizeX, w.sizeY, f.subarray(0, N), f.subarray(N, 2 * N), startCentre(st)) };
  }
}
writeFileSync(join(ROOT, "obviousness.json"), JSON.stringify(out, null, 1));
console.log(`measured ${Object.keys(out).length} maps`);
