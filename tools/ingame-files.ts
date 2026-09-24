// The files for the M1 in-game checks (PLAN §18 A and F2), written to out/m1/:
//
//   River Valley (4242).timber                A1–A5 and the sealed half of F2
//   River Valley (4242).png                   where things are: start (white, door red), slopes
//                                             (orange, high side brown), sources (blue)
//   River Valley (4242) F2 source gap.timber  F2: the same map with the middle river-mouth source
//                                             removed, so the mouth has a gap
//   River Valley (4242) F2 source gap.png     the gap tile marked magenta
//   checks.txt                                sha256, the start, slopes and sources in tile coordinates
//
//   npx tsx tools/ingame-files.ts [--seed 4242] [--size 128] [--out out/m1]

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildResult } from "../src/core/features/build";
import { generate } from "../src/core/gen/generate";
import { fileName, toTimberFile } from "../src/core/gen/pack";
import { rotate, slopeHighSide, startEntranceTile, type Orientation } from "../src/core/format/footprints";
import { writeTimber } from "../src/core/format/timber";
import { shadeTiles } from "../src/core/render/shade";
import { makeSpec } from "../src/core/spec/mapspec";
import { validateFile } from "../src/core/validate/checks";
import { encodePng } from "./png";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const seed = Number(arg("seed", "4242"));
const size = Number(arg("size", "128"));
const outDir = arg("out", "out/m1");
const SCALE = 5;

type Mark = { x: number; y: number; rgb: [number, number, number]; inset?: number };

function preview(b: BuildResult, marks: Mark[]): Uint8Array {
  const { W, H } = b;
  const tiles = shadeTiles(b.heights, W, H, b.water);
  const w = W * SCALE;
  const h = H * SCALE;
  const img = new Uint8Array(w * h * 3);
  const put = (px: number, py: number, c: ArrayLike<number>) => img.set([c[0], c[1], c[2]], (py * w + px) * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = tiles.subarray((y * W + x) * 3, (y * W + x) * 3 + 3);
      const row = H - 1 - y; // north up
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) put(x * SCALE + dx, row * SCALE + dy, c);
    }
  for (const m of marks) {
    if (m.x < 0 || m.y < 0 || m.x >= W || m.y >= H) continue;
    const row = H - 1 - m.y;
    const k = m.inset ?? 0;
    for (let dy = k; dy < SCALE - k; dy++) for (let dx = k; dx < SCALE - k; dx++) put(m.x * SCALE + dx, row * SCALE + dy, m.rgb);
  }
  // a dotted grid every 16 tiles, so coordinates can be read off the image (x east, y north)
  for (let y = 0; y < H; y += 16) for (let px = 0; px < w; px += 2) put(px, (H - 1 - y) * SCALE + SCALE - 1, [255, 255, 255]);
  for (let x = 0; x < W; x += 16) for (let py = 0; py < h; py += 2) put(x * SCALE, py, [255, 255, 255]);
  return encodePng(img, w, h);
}

function marksFor(b: BuildResult, gap?: { x: number; y: number }): Mark[] {
  const marks: Mark[] = [];
  const start = b.entities.find((e) => e.template === "StartingLocation")!;
  const o = start.orientation as Orientation;
  for (let lx = 0; lx < 3; lx++)
    for (let ly = 0; ly < 3; ly++) {
      const [dx, dy] = rotate(o, lx, ly);
      marks.push({ x: start.x + dx, y: start.y + dy, rgb: [255, 255, 255] });
    }
  const [ex, ey] = startEntranceTile(start.x, start.y, o);
  marks.push({ x: ex, y: ey, rgb: [220, 30, 30] });
  for (const s of b.entities.filter((e) => e.template === "Slope")) {
    marks.push({ x: s.x, y: s.y, rgb: [245, 150, 20] });
    const [hx, hy] = slopeHighSide(s.orientation as Orientation);
    marks.push({ x: s.x + hx, y: s.y + hy, rgb: [150, 80, 0], inset: 1 });
  }
  for (const s of b.entities.filter((e) => e.template === "WaterSource")) marks.push({ x: s.x, y: s.y, rgb: [30, 60, 230], inset: 1 });
  if (gap) marks.push({ x: gap.x, y: gap.y, rgb: [230, 0, 200] });
  return marks;
}

mkdirSync(outDir, { recursive: true });
const spec = makeSpec({ seed, size: { x: size, y: size } });
const r = generate(spec);
if (!r.report.passed) throw new Error("generation failed");
const base = fileName(r.spec).replace(/\.timber$/, "");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
writeFileSync(join(outDir, `${base}.timber`), r.bytes);
writeFileSync(join(outDir, `${base}.png`), preview(r.built, marksFor(r.built)));

// F2: drop the middle source of the river mouth. The other sources keep their strengths, so the
// river is the same except for the gap.
const sources = r.built.entities.filter((e) => e.template === "WaterSource");
const mid = sources[sources.length >> 1];
const gapBuilt: BuildResult = { ...r.built, entities: r.built.entities.filter((e) => e !== mid) };
const gapFile = toTimberFile(r.spec, gapBuilt);
const gapBytes = writeTimber(gapFile);
const gapReport = validateFile(gapFile, { profile: "generate" });
if (!gapReport.passed) throw new Error(`the F2 gap file fails: ${gapReport.checks.filter((c) => !c.ok).map((c) => c.id).join(", ")}`);
writeFileSync(join(outDir, `${base} F2 source gap.timber`), gapBytes);
writeFileSync(join(outDir, `${base} F2 source gap.png`), preview(gapBuilt, marksFor(gapBuilt, mid)));

const start = r.built.entities.find((e) => e.template === "StartingLocation")!;
const door = startEntranceTile(start.x, start.y, start.orientation as Orientation);
const slopes = r.built.entities.filter((e) => e.template === "Slope");
const lines = [
  `${base}: ${size}×${size}, seed ${seed}, generator ${r.spec.generatorVersion}`,
  `sha256 ${sha(r.bytes)}  ${base}.timber`,
  `sha256 ${sha(gapBytes)}  ${base} F2 source gap.timber`,
  "",
  "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
  `Start: StartingLocation at (${start.x}, ${start.y}), z ${start.z}, ${start.orientation}; door tile (${door.join(", ")}).`,
  `Slopes (${slopes.length}): ${slopes.map((e) => `(${e.x}, ${e.y}) z${e.z} ${e.orientation}`).join("; ")}`,
  `River-mouth sources (${sources.length}): ${sources.map((e) => `(${e.x}, ${e.y})`).join(" ")}; strength ${r.built.sources[0]?.strength} each`,
  `F2 gap: the source at (${mid.x}, ${mid.y}) is removed in the gap file.`,
];
writeFileSync(join(outDir, "checks.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
