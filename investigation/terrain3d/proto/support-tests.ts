// The support rule on tall overhangs and arches: synthetic shapes up to the game's full height,
// each with the outcome the rule predicts (GAME_RULES.md §2), checked with the port of the game's
// load-time rule (support.ts). Writes results/support.json.
//
//   npx tsx investigation/terrain3d/proto/support-tests.ts [--out investigation/terrain3d/results]

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Vox, skyBridge, leanOut, windowArch, MAX_SURFACE, type Face, type Gap } from "./carve3d";
import { checkSupport } from "./support";

const out = (() => {
  const i = process.argv.indexOf("--out");
  return i >= 0 ? process.argv[i + 1] : "investigation/terrain3d/results";
})();
mkdirSync(out, { recursive: true });

interface Case { name: string; expectOk: boolean; unsupported: number; ok: boolean; note: string }
const cases: Case[] = [];
const run = (name: string, vx: Vox, expectOk: boolean, note = "") => {
  const r = checkSupport(vx.W, vx.H, vx.v, vx.L);
  const unsupported = r.unsupported.length;
  cases.push({ name, expectOk, unsupported, ok: (unsupported === 0) === expectOk, note });
};

// 1. cantilevers: one layer sticking out of a wall 20 levels high
for (let L = 1; L <= 6; L++) {
  const vx = new Vox(20, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) vx.column(x, y, 20);
  for (let k = 1; k <= L; k++) vx.set(2 + k, 2, 19, true);
  run(`cantilever ${L} long at layer 19`, vx, L <= 3);
}

// 2. flat roofs over a gap between two walls, 1 and 3 thick
for (const thick of [1, 3]) for (let G = 4; G <= 8; G++) {
  const vx = new Vox(G + 6, 5);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) vx.column(x, y, 20);
    for (let x = 3 + G; x < 6 + G; x++) vx.column(x, y, 20);
    for (let x = 3; x < 3 + G; x++) for (let z = 20 - thick; z < 20; z++) vx.set(x, y, z, true);
  }
  run(`flat roof ${thick} thick over a ${G}-wide gap`, vx, G <= 6);
}

// 3. corbelled sky bridges at the top of the game's height (deck walkable at 22), gaps 6–40
for (const G of [6, 10, 16, 24, 32, 40]) {
  const vx = new Vox(G + 8, 7);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 4; x++) vx.column(x, y, MAX_SURFACE);
    for (let x = 4 + G; x < 8 + G; x++) vx.column(x, y, MAX_SURFACE);
    for (let x = 4; x < 4 + G; x++) vx.column(x, y, 2);
  }
  const g: Gap = { a: [3, 3], b: [4 + G, 3], dir: 3, level: MAX_SURFACE, span: G, floor: 2 };
  const r = skyBridge(vx, g, 3);
  run(`sky bridge over a ${G}-wide gorge, deck at 22`, vx, true, `${r.layers} corbel layers under the deck`);
}
// the same bridge with corbel steps of 4 (one too many)
{
  const G = 24;
  const vx = new Vox(G + 8, 7);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 4; x++) vx.column(x, y, MAX_SURFACE);
    for (let x = 4 + G; x < 8 + G; x++) vx.column(x, y, MAX_SURFACE);
  }
  const reach = [12, 8, 4, 0];
  for (let t = 1; t <= G; t++) {
    const dEnd = Math.min(t, G + 1 - t);
    for (let j = 0; j < reach.length; j++) if (dEnd <= reach[j]) for (let y = 2; y <= 4; y++) vx.set(3 + t, y, MAX_SURFACE - 1 - j, true);
  }
  run("sky bridge over a 24-wide gorge with corbel steps of 4", vx, false);
}

// 4. leaning cliffs 20 levels tall, leaning out from layer 8 at 1–4 tiles per level
for (const rate of [1, 2, 3, 4]) {
  const vx = new Vox(70, 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) vx.column(x, y, 20);
  const face: Face = { tiles: [[9, 1], [9, 2], [9, 3], [9, 4]], dir: 3, top: 20, base: 0 };
  const ext = leanOut(vx, face, 8, () => rate);
  // leanOut clamps at 3 per layer; build the 4-per-layer case by hand
  if (rate === 4) {
    for (let z = 8; z < 20; z++) for (let k = 1; k <= 4 * (z - 7); k++) for (let y = 1; y <= 4; y++) if (9 + k < 70) vx.set(9 + k, y, z, true);
  }
  run(`cliff 20 tall leaning ${rate} per level from layer 8`, vx, rate <= 3, `overhang at the top: ${rate === 4 ? Math.min(60, 48) : ext} tiles`);
}

// 5. a 20-level cliff undercut along its whole face: 3 deep holds, 4 deep loses its outer edge.
//    A shorter undercut (a notch) holds deeper, because the rock beside it holds the roof sideways.
for (const [depth, full] of [[3, true], [4, true], [4, false], [6, false]] as const) {
  const vx = new Vox(20, 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) vx.column(x, y, 20);
  const y0 = full ? 0 : 1, y1 = full ? 5 : 4;
  for (let y = y0; y <= y1; y++) for (let k = 0; k < depth; k++) for (let z = 2; z <= 5; z++) vx.set(11 - k, y, z, false);
  run(`20-level cliff undercut ${depth} deep, 4 high, ${full ? "along the whole face" : "as a 4-wide notch"}`, vx, depth <= 3 || !full, full ? "" : "held by the rock on both sides");
}

// 6. window arches through a 3-thick fin 20 high, openings 5–25 wide and 6–15 high
for (const [span, height] of [[5, 6], [11, 8], [17, 10], [25, 15]]) {
  const vx = new Vox(span + 12, 5);
  for (let x = 0; x < span + 12; x++) for (let y = 1; y <= 3; y++) vx.column(x, y, 20);
  const n = windowArch(vx, Math.floor((span + 12) / 2), 1, 2, 1, span, height, 3);
  run(`window arch ${span} wide and ${height} high through a fin 20 tall`, vx, true, `${n} voxels cut`);
}

// 7. hanging rock and floating rock
{
  const vx = new Vox(9, 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) vx.column(x, y, 2);
  for (let z = 10; z < 20; z++) vx.set(4, 4, z, true); // a floating pillar, air below it
  run("floating pillar with air below (a sky island without support)", vx, false);
}
{
  const vx = new Vox(12, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) vx.column(x, y, 20);
  for (let z = 12; z < 19; z++) vx.set(5, 2, z, true);
  vx.set(4, 2, 19, true);
  vx.set(5, 2, 19, true);
  run("stalactite hanging from a 2-long ledge", vx, false, "support never passes downward");
}
{
  const vx = new Vox(12, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) vx.column(x, y, 20);
  for (let k = 1; k <= 3; k++) for (let z = 15; z < 20; z++) vx.set(3 + k, 2, z, true);
  run("a 5-thick slab 3 long out of a wall (every layer a 3-long cantilever)", vx, true);
}

const failed = cases.filter((c) => !c.ok);
for (const c of cases) console.log(`${c.ok ? "ok  " : "FAIL"}  ${c.name}: expected ${c.expectOk ? "stands" : "falls"}, ${c.unsupported} voxels deleted ${c.note ? `(${c.note})` : ""}`);
writeFileSync(join(out, "support.json"), JSON.stringify({ cases, passed: cases.length - failed.length, total: cases.length }, null, 1) + "\n");
console.log(`${cases.length - failed.length}/${cases.length} as the rule predicts`);
process.exit(failed.length ? 1 : 0);
