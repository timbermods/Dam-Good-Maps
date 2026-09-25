// The files for the in-game checks (PLAN §18), per milestone. The bytes are deterministic for a
// given generator version.
//
//   npx tsx tools/ingame-files.ts --milestone m1 [--seed 4242] [--size 128] [--out out/m1]
//     A (load, start, walk, editor, Iron Teeth) and F2 (sealed river mouth):
//       River Valley (4242).timber                A1–A5 and the sealed half of F2
//       River Valley (4242).png                   start (white, door red), slopes (orange, high side
//                                                 brown), sources (blue)
//       River Valley (4242) F2 source gap.timber  the same map with the middle river-mouth source removed
//       River Valley (4242) F2 source gap.png     the gap tile marked magenta
//       checks.txt                                sha256, the start, slopes and sources
//
//   npx tsx tools/ingame-files.ts --milestone m2 [--seed 4242] [--size 128] [--out out/m2]
//     B (pre-filled water, tree survival, the empty-water A/B file, badwater downstream):
//       River Valley (4242).timber                B1, B3, B4: water, moisture and contamination pre-filled
//       River Valley (4242) (empty water).timber  B2: the same map with no water in the file
//       River Valley (4242).png                   the settled water (badwater brown), start, berry bushes
//                                                 near the start, living and dead trees, the badwater
//                                                 source and its ditch, the dam site, the depth samples
//       checks.txt                                sha256, and where to look, with the expected values
//
//   npx tsx tools/ingame-files.ts --milestone m5 [--seed 4242] [--size 128] [--out out/m5]
//     C (set pieces) and F1 (waterfall visibility), on three maps edited with the M5 tools:
//       River Valley (4242) F1 waterfall S2.timber   a 20-wide standalone waterfall, 2 water/s
//       River Valley (4242) F1 waterfall S8.timber   the same fall at 8 water/s (the exact flow)
//       River Valley (4242) C1 dam site.timber       a dam site placed on the river's lower reach
//       River Valley (4242) gorge stairs.timber      a gorge with a stair notch near the start
//       one .png per map                             where to look (see checks.txt for the colours)
//       checks.txt                                   sha256, coordinates and what should happen
//
//   npx tsx tools/ingame-files.ts --milestone m6 [--seed 4242] [--size 128] [--out out/m6]
//     M6-1 (the new themes load, and their dam sites hold), two generated maps:
//       Canyon (4242).timber        a Canyon map: its dam site in the narrows, the stair up its wall
//       Lake Basin (4242).timber    a Lake Basin map: its dam site on the lake's outlet
//       one .png per map            the dam line orange, the start white (door red), the stair's
//                                   slopes orange with their high side brown, badwater sources magenta
//       checks.txt                  sha256, coordinates and what should happen
//
//   npx tsx tools/ingame-files.ts --milestone m7 [--seed 4242] [--size 128] [--out out/m7]
//     D (the 1.0 objects load, and a spillway's plug releases its water), one map: the generated
//     Lake Basin map, which has a plugged spillway, mine sites, geothermal fields and relics, with a
//     weir (NaturalDam) and a thorn belt added with the M7 editor tools:
//       Lake Basin (4242) D objects.timber   the map
//       Lake Basin (4242) D objects.png      where each object is (see checks.txt for the colours)
//       checks.txt                           sha256, coordinates and what should happen
//
// Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildResult } from "../src/core/features/build";
import { MapSession } from "../src/core/doc/session";
import { planContextOf, planPiece, planRiver, type PlannedEdit } from "../src/core/doc/tools";
import { planObject } from "../src/core/doc/placing";
import { entityTiles } from "../src/core/features/edits";
import type { SpillwayPlan } from "../src/core/features/setpieces/plugSpillway";
import { pointAtArc } from "../src/core/features/geometry";
import type { RiverFeature, SetPieceFeature } from "../src/core/features/schema";
import { lipTiles, measureLip, type StandalonePlan } from "../src/core/features/setpieces/waterfall";
import { reservoirOf, type DamSitePlan } from "../src/core/features/setpieces/damSite";
import { generate } from "../src/core/gen/generate";
import { fileName, toTimberFile } from "../src/core/gen/pack";
import { rotate, slopeHighSide, startEntranceTile, type Orientation } from "../src/core/format/footprints";
import { writeTimber } from "../src/core/format/timber";
import { runsToTiles } from "../src/core/math/grid";
import { shadeTiles } from "../src/core/render/shade";
import { GENERATOR_VERSION, makeSpec } from "../src/core/spec/mapspec";
import { validateFile } from "../src/core/validate/checks";
import { rulesFor } from "../src/core/validate/playability";
import { encodePng } from "./png";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const milestone = arg("milestone", "m2");
const seed = Number(arg("seed", "4242"));
const size = Number(arg("size", "128"));
const outDir = arg("out", `out/${milestone}`);
const SCALE = 5;

type Mark = { x: number; y: number; rgb: [number, number, number]; inset?: number };

function preview(b: BuildResult, marks: Mark[], water: boolean): Uint8Array {
  const { W, H } = b;
  const tiles = shadeTiles(b.heights, W, H, water ? b.water : null);
  if (water) {
    // badwater brown over the blue
    for (let i = 0; i < W * H; i++) {
      if (b.water[i] > 0.001 && b.contamination[i] >= 0.05) {
        tiles[i * 3] = 128;
        tiles[i * 3 + 1] = 84;
        tiles[i * 3 + 2] = 38;
      }
    }
  }
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

function startMarks(b: BuildResult): Mark[] {
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
  return marks;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
mkdirSync(outDir, { recursive: true });
const spec = makeSpec({ seed, size: { x: size, y: size } });
const r = generate(spec);
if (!r.report.passed) throw new Error("generation failed");
const base = fileName(r.spec).replace(/\.timber$/, "");
const b = r.built;
const W = b.W;
const start = b.entities.find((e) => e.template === "StartingLocation")!;
const door = startEntranceTile(start.x, start.y, start.orientation as Orientation);
const lines: string[] = [];

if (milestone === "m1") {
  writeFileSync(join(outDir, `${base}.timber`), r.bytes);
  const m1marks = (bb: BuildResult, gap?: { x: number; y: number }): Mark[] => {
    const marks = startMarks(bb);
    for (const s of bb.entities.filter((e) => e.template === "Slope")) {
      marks.push({ x: s.x, y: s.y, rgb: [245, 150, 20] });
      const [hx, hy] = slopeHighSide(s.orientation as Orientation);
      marks.push({ x: s.x + hx, y: s.y + hy, rgb: [150, 80, 0], inset: 1 });
    }
    for (const s of bb.entities.filter((e) => e.template === "WaterSource")) marks.push({ x: s.x, y: s.y, rgb: [30, 60, 230], inset: 1 });
    if (gap) marks.push({ x: gap.x, y: gap.y, rgb: [230, 0, 200] });
    return marks;
  };
  writeFileSync(join(outDir, `${base}.png`), preview(b, m1marks(b), false));
  // F2: drop the middle source of the river mouth. The other sources keep their strengths, so the
  // river is the same except for the gap.
  const sources = b.entities.filter((e) => e.template === "WaterSource");
  const mid = sources[sources.length >> 1];
  const gapBuilt: BuildResult = { ...b, entities: b.entities.filter((e) => e !== mid) };
  const gapFile = toTimberFile(r.spec, gapBuilt);
  const gapBytes = writeTimber(gapFile);
  const gapReport = validateFile(gapFile, { profile: "generate", loadOnly: true });
  if (!gapReport.passed) throw new Error(`the F2 gap file fails: ${gapReport.checks.filter((c) => !c.ok).map((c) => c.id).join(", ")}`);
  writeFileSync(join(outDir, `${base} F2 source gap.timber`), gapBytes);
  writeFileSync(join(outDir, `${base} F2 source gap.png`), preview(gapBuilt, m1marks(gapBuilt, mid), false));
  const slopes = b.entities.filter((e) => e.template === "Slope");
  lines.push(
    `${base}: ${size}×${size}, seed ${seed}, generator ${r.spec.generatorVersion}`,
    `sha256 ${sha(r.bytes)}  ${base}.timber`,
    `sha256 ${sha(gapBytes)}  ${base} F2 source gap.timber`,
    "",
    "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
    `Start: StartingLocation at (${start.x}, ${start.y}), z ${start.z}, ${start.orientation}; door tile (${door.join(", ")}).`,
    `Slopes (${slopes.length}): ${slopes.map((e) => `(${e.x}, ${e.y}) z${e.z} ${e.orientation}`).join("; ")}`,
    `River-mouth sources (${sources.length}): ${sources.map((e) => `(${e.x}, ${e.y})`).join(" ")}; strength ${b.sources[0]?.strength} each`,
    `F2 gap: the source at (${mid.x}, ${mid.y}) is removed in the gap file.`,
  );
} else if (milestone === "m5") {
  m5();
} else if (milestone === "m6") {
  m6();
} else if (milestone === "m7") {
  m7();
} else {
  // ---- B: pre-filled water, tree survival, the empty-water A/B file, badwater downstream
  const emptyBytes = writeTimber(toTimberFile(r.spec, b, { emptyWater: true }));
  writeFileSync(join(outDir, `${base}.timber`), r.bytes);
  writeFileSync(join(outDir, `${base} (empty water).timber`), emptyBytes);
  const a = r.analysis!;
  const sd = a.startDistance!;
  const marks = startMarks(b);
  const living = (e: (typeof b.entities)[number]) => !("LivingNaturalResource" in e.components);
  const bushesNear = b.entities.filter((e) => e.template === "BlueberryBush" && living(e) && sd[e.y * W + e.x] <= 20);
  for (const e of b.entities) {
    if (["Pine", "Birch", "Oak"].includes(e.template)) marks.push({ x: e.x, y: e.y, rgb: living(e) ? [40, 200, 60] : [120, 105, 85], inset: 1 });
  }
  for (const e of bushesNear) marks.push({ x: e.x, y: e.y, rgb: [170, 60, 210], inset: 1 });
  const bad = b.entities.find((e) => e.template === "BadwaterSource");
  const marsh = r.features.find((f) => f.kind === "setPiece" && f.params.kind === "badwaterBasin");
  const ditch = marsh ? ((marsh.params as unknown as { plan: { ditch?: number[] } }).plan.ditch ?? []) : [];
  for (let k = 0; k + 1 < ditch.length; k += 2) marks.push({ x: ditch[k], y: ditch[k + 1], rgb: [230, 0, 200], inset: 1 });
  if (bad) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) marks.push({ x: bad.x + dx, y: bad.y + dy, rgb: [230, 0, 200] });
  const dam = a.bestDam;
  if (dam) {
    const half = Math.floor((dam.length - 1) / 2);
    for (let k = -half; k <= dam.length - 1 - half; k++) marks.push({ x: dam.x + k * dam.dir[1], y: dam.y + k * dam.dir[0], rgb: [255, 140, 20] });
  }
  // depth samples along the river: the channel tile on each sampled column with the most water
  const river = r.features.find((f) => f.kind === "river")!;
  const samples: string[] = [];
  const cols = [2, Math.round(W * 0.25), Math.round(W * 0.45), Math.round(W * 0.65), Math.round(W * 0.85), W - 3];
  for (const x of cols) {
    let best = -1;
    for (let y = 0; y < b.H; y++) if (b.channel[y * W + x] && (best < 0 || b.water[y * W + x] > b.water[best])) best = y * W + x;
    if (best < 0) continue;
    const y = Math.floor(best / W);
    marks.push({ x, y, rgb: [0, 230, 255], inset: 1 });
    const bw = b.contamination[best] >= 0.05 ? `, badwater ${Math.round(b.contamination[best] * 100)}%` : "";
    samples.push(`(${x}, ${y}) ${b.water[best].toFixed(2)} deep, surface ${(b.heights[best] + b.water[best]).toFixed(2)}${bw}`);
  }
  // nearest pumpable clean water to the start
  let pump = -1;
  for (let i = 0; i < W * b.H; i++) {
    const s = b.heights[i] + b.water[i];
    if (b.water[i] >= 0.3 && b.contamination[i] < 0.05 && s >= start.z - 2 && s <= start.z + 0.01 && (pump < 0 || sd[i] < sd[pump])) pump = i;
  }
  if (pump >= 0) marks.push({ x: pump % W, y: Math.floor(pump / W), rgb: [0, 230, 255] });
  writeFileSync(join(outDir, `${base}.png`), preview(b, marks, true));

  // groves: the largest living groves near the river and the largest dead stands
  const groves = r.features
    .filter((f) => f.kind === "forest")
    .map((f) => {
      const trees = b.entities.filter((e) => e.owner === f.id);
      const alive = trees.filter(living).length;
      const tiles = runsToTiles((f.params as { area: [number, number, number][] }).area, W);
      const cx = Math.round(tiles.reduce((s, i) => s + (i % W), 0) / tiles.length);
      const cy = Math.round(tiles.reduce((s, i) => s + Math.floor(i / W), 0) / tiles.length);
      return { id: f.id, species: Object.keys((f.params as { speciesMix: object }).speciesMix)[0], n: trees.length, alive, cx, cy };
    });
  const livingGroves = groves.filter((g) => g.species !== "Succulent" && g.alive > 0 && g.alive === g.n).sort((p, q) => q.n - p.n || p.cx - q.cx).slice(0, 4);
  const deadStands = groves.filter((g) => g.n > 0 && g.alive === 0).sort((p, q) => q.n - p.n || p.cx - q.cx).slice(0, 4);
  let nearestBad = Infinity;
  for (let i = 0; i < W * b.H; i++) if ((b.soilContamination[i] > 0 || (b.water[i] > 0.05 && b.contamination[i] >= 0.05)) && sd[i] < nearestBad) nearestBad = sd[i];
  let wet = 0;
  for (let i = 0; i < W * b.H; i++) if (b.water[i] > 0.001) wet++;
  const tr = b.entities.filter((e) => ["Pine", "Birch", "Oak", "Succulent"].includes(e.template));
  lines.push(
    `${base}: ${size}×${size}, seed ${seed}, generator ${r.spec.generatorVersion}`,
    `sha256 ${sha(r.bytes)}  ${base}.timber`,
    `sha256 ${sha(emptyBytes)}  ${base} (empty water).timber`,
    "",
    "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
    "PNG: north up, 5 px per tile, dotted grid every 16 tiles; water blue, badwater brown; start white (door red);",
    "living trees green, dead trees grey-brown; living berry bushes within 20 tiles of the start purple; the badwater",
    "source and its ditch magenta; the best dam site orange; depth samples and the nearest pumpable water cyan.",
    "",
    `Start: StartingLocation at (${start.x}, ${start.y}), z ${start.z}, ${start.orientation}; door tile (${door.join(", ")}).`,
    `Settled water: ${wet} wet tiles after the canonical settle (${b.settle.ticks} ticks from the pre-fill).`,
    `River: ${b.sources.filter((s) => s.template === "WaterSource").length} sources on the west edge, ${(river.params as { flow: number }).flow} water/s in all.`,
    `River depth samples, west to east (B1: the same on day 1, no surge or drain): ${samples.join("; ")}.`,
    pump >= 0
      ? `Nearest pumpable clean water to the start: (${pump % W}, ${Math.floor(pump / W)}), ${b.water[pump].toFixed(2)} deep, ${sd[pump].toFixed(1)} tiles from the start.`
      : "No pumpable water near the start.",
    `Living berry bushes within 20 tiles of the start (B1: none flagged dry): ${bushesNear.length}; for example ${bushesNear.slice(0, 5).map((e) => `(${e.x}, ${e.y})`).join(" ")}.`,
    `Trees: ${tr.length}, ${tr.filter(living).length} alive. Living groves (B3: still alive after 15 days): ${livingGroves.map((g) => `${g.n} ${g.species} around (${g.cx}, ${g.cy})`).join("; ")}.`,
    `Dead stands (B3: still dead, with logs): ${deadStands.map((g) => `${g.n} ${g.species} around (${g.cx}, ${g.cy})`).join("; ")}.`,
    bad
      ? `Badwater (B4): BadwaterSource at (${bad.x}, ${bad.y})–(${bad.x + 2}, ${bad.y + 2}), strength ${b.sources.find((s) => s.template === "BadwaterSource")?.strength}, in a pit with a ditch of ${ditch.length / 2} tiles to the river; the nearest badwater or contaminated soil is ${nearestBad.toFixed(0)} tiles from the start.`
      : "No badwater on this map.",
    dam
      ? `Best dam site: a ${dam.length}-tile dam at (${dam.x}, ${dam.y}), ${dam.height} level(s) high, holds ${dam.volume} water (the colony needs ${Math.round(rulesFor(r.spec).reservoirNeed)} stored through the worst drought).`
      : "No dam site near the start.",
    `Advisory: ${r.report.checks.filter((c) => c.advisory && !c.ok).map((c) => `${c.id}: ${c.message}`).join(" ") || "none"}`,
  );
}
writeFileSync(join(outDir, "checks.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));

// ------------------------------------------------------------------------------------------ M5

/** C and F1 on three maps edited with the M5 tools. Every edit is planned by the same code the
 *  editor runs, with fixed ids, so the files reproduce. */
function m5(): void {
  const id = (k: number) => `00000000-0000-4000-8000-${String(k).padStart(12, "0")}`;
  const open = () => MapSession.fromGenerated(r);
  const river = r.features.find((f): f is RiverFeature => f.kind === "river")!;
  const H = b.H;
  const exportOf = (s: MapSession, name: string) => {
    const { bytes } = s.exportTimber();
    writeFileSync(join(outDir, `${base} ${name}.timber`), bytes);
    const v = s.validate("export");
    const failing = v.report.checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false);
    if (failing.some((c) => c.class === "load")) throw new Error(`${name}: load problems: ${failing.map((c) => c.id).join(", ")}`);
    return { bytes, warnings: failing.map((c) => `${c.id}: ${c.message}`) };
  };
  const apply = (s: MapSession, r2: PlannedEdit) => {
    if (!r2.ok) throw new Error(r2.errors.join("; "));
    const a = s.applyAll(r2.ops, "user", r2.label);
    if (!a.ok) throw new Error(a.errors.join("; "));
    return r2.feature as SetPieceFeature;
  };
  lines.push(
    `${base}: ${size}×${size}, seed ${seed}, generator ${r.spec.generatorVersion}, edited with the M5 tools (one edit per map).`,
    "",
    "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
    "PNGs: north up, 5 px per tile, dotted grid every 16 tiles; water blue, start white (door red); each map's marks are listed below.",
    `Start: StartingLocation at (${start.x}, ${start.y}), z ${start.z}, ${start.orientation}; door tile (${door.join(", ")}).`,
    "",
  );

  // ---- F1: a 20-wide standalone waterfall at S = 2, and the same fall at S = 8
  const sA = open();
  let fall: PlannedEdit | null = null;
  search: for (let y = H - 10; y >= Math.floor((2 * H) / 3); y -= 3)
    for (let dx = 0; dx <= W / 2; dx += 4)
      for (const x of dx ? [Math.floor(W / 2) + dx, Math.floor(W / 2) - dx] : [Math.floor(W / 2)]) {
        const p = planPiece(sA, "waterfall", { mode: "standalone", lip: [x, y], facing: "north", width: 20, drop: 6, flow: "steady" }, id(1));
        if (p.ok && !p.report.some((l) => l.startsWith("moved"))) {
          fall = p;
          break search;
        }
      }
  if (!fall) throw new Error("no place for the F1 waterfall");
  const fA = apply(sA, fall);
  const lip = (fA.params.plan as unknown as StandalonePlan).lip;
  const sB = open();
  const fB = apply(sB, planPiece(sB, "waterfall", { mode: "standalone", facing: "north", width: 20, drop: 6, flow: 8, exactFlow: true, lip }, id(1)));
  for (const [name, s, f, flow] of [
    ["F1 waterfall S2", sA, fA, 2],
    ["F1 waterfall S8", sB, fB, 8],
  ] as const) {
    const out = exportOf(s, name);
    const p = f.params.plan as unknown as StandalonePlan;
    const m = measureLip(f, W, s.built.heights, s.built.water)!;
    const marks = startMarks(s.built);
    for (const [x, y] of lipTiles(p)) marks.push({ x, y, rgb: [230, 0, 200] });
    for (let k = 0; k + 1 < p.springs.length; k += 2) marks.push({ x: p.springs[k], y: p.springs[k + 1], rgb: [30, 60, 230], inset: 1 });
    for (let k = 0; k + 1 < p.outflow.length; k += 2) marks.push({ x: p.outflow[k], y: p.outflow[k + 1], rgb: [0, 230, 255], inset: 1 });
    writeFileSync(join(outDir, `${base} ${name}.png`), preview(s.built, marks, true));
    const lt = lipTiles(p);
    const below = lt.map(([x, y]) => [x, y + 1] as [number, number]);
    const channel: string[] = [];
    for (let k = 0; k + 1 < p.outflow.length && channel.length < 3; k += Math.max(2, 2 * Math.floor(p.outflow.length / 8))) channel.push(`(${p.outflow[k]}, ${p.outflow[k + 1]})`);
    lines.push(
      `sha256 ${sha(out.bytes)}  ${base} ${name}.timber`,
      `${name}: a standalone waterfall, 20 wide, falling north: lip (${lt[0].join(", ")})–(${lt[lt.length - 1].join(", ")}) at level ${p.lipLevel}, plunge pool below it at level ${p.lipLevel - p.drop} (rows y ${lip[1] + 1}–${lip[1] + 4}).`,
      `  ${flow} water/s from ${p.springs.length / 2} springs of ${p.springStrength} in the header pool (y ${lip[1] - 3}–${lip[1] - 1}); settled: ${m.width} of 20 lip tiles wet, ${m.depth.toFixed(3)} deep (0.3·S/W = ${((0.3 * flow) / 20).toFixed(3)}), a drop of ${m.drop.toFixed(2)}.`,
      `  The outflow (cyan) runs ${p.outflow.length / 2} tiles to ${p.outflowTo === "edge" ? "the map edge" : "the river"}, ${p.outflowWidth} wide; a water wheel fits on it, e.g. at ${channel.join(", ")}. The plunge pool is at (${below[0].join(", ")})–(${below[below.length - 1].join(", ")}).`,
      `  Export warnings: ${out.warnings.join("; ") || "none"}.`,
      "",
    );
  }

  // ---- C1: a dam site on the river's lower reach, where a dam holds a reservoir
  const sC = open();
  let dam: PlannedEdit | null = null;
  const length = river.params.path.reduce((a, q, k, ps) => (k ? a + Math.hypot(q[0] - ps[k - 1][0], q[1] - ps[k - 1][1]) : 0), 0);
  for (let at = Math.round(length * 0.62); at < length - 12 && !dam; at += 3) {
    const p = planPiece(sC, "damSite", { river: river.id, at, crest: 2 }, id(2));
    if (p.ok && p.report.some((l) => l.startsWith("a dam "))) dam = p;
  }
  if (!dam) throw new Error("no place for the C1 dam site");
  const dC = apply(sC, dam);
  const outC = exportOf(sC, "C1 dam site");
  const dp = dC.params.plan as unknown as DamSitePlan;
  const held = reservoirOf(dp, river, planContextOf(sC, dC.id), dC.id)!;
  const marksC = startMarks(sC.built);
  for (const [x, y] of held.line) marksC.push({ x, y, rgb: [255, 140, 20] });
  writeFileSync(join(outDir, `${base} C1 dam site.png`), preview(sC.built, marksC, true));
  const need = Math.round(rulesFor(r.spec).reservoirNeed);
  lines.push(
    `sha256 ${sha(outC.bytes)}  ${base} C1 dam site.timber`,
    `C1 dam site: a rock ridge (top level ${dp.topLevel}) across the river's lower reach. Build levees ${dp.crest} high (${dp.crest === 1 ? "one levee" : `${dp.crest} levees stacked`}) on its ${held.line.length} gap tiles (orange): ${held.line.map(([x, y]) => `(${x}, ${y})`).join(" ")}. The river bed there is at level ${held.bed}, so the crest is at level ${held.bed + dp.crest}.`,
    `  The basin behind it should fill to about level ${held.bed + dp.crest}: ${held.area} tiles, about ${Math.round(held.volume)} blocks of water, and none of it should leak round the ridge's ends.`,
    `  C3 (first drought on Normal): the colony needs about ${need} blocks stored; this reservoir holds ${Math.round(held.volume)}. Export warnings: ${outC.warnings.join("; ") || "none"}.`,
    "",
  );
  // C2: the generated falls, where a water wheel should turn
  const falls = r.features.filter((f): f is SetPieceFeature => f.kind === "setPiece" && f.params.kind === "waterfall");
  const fallAt = falls.map((f) => {
    const q = pointAtArc(river.params.path, Number(f.params.plan.at)).p;
    return `(${Math.round(q[0])}, ${Math.round(q[1])}), a drop of ${f.params.plan.drop}`;
  });
  lines.push(`C2 (any of these maps): the generated river falls at ${fallAt.join(" and ")}; a water wheel just below either should turn.`, "");

  // ---- a gorge with a stair notch near the start. River Valley's valley floor is wide, so a gorge
  //      on the main river has floodplain behind its walls and its notch is a plain cut. The check
  //      wants stairs: a tributary drawn from the south edge through the terraces to the main
  //      river, with the gorge where it cuts through high ground, its notch on the start's side.
  const sD = open();
  let gorge: PlannedEdit | null = null;
  let trib: RiverFeature | null = null;
  const sx = start.x + 1;
  const sy = start.y + 1;
  tries: for (const dx of [18, -18, 24, -24, 30, -30, 12, -12]) {
    const x0 = sx + dx;
    if (x0 < 12 || x0 > W - 12) continue;
    // the main river's point above x0
    const join = river.params.path.reduce((q, p) => (Math.abs(p[0] - x0) < Math.abs(q[0] - x0) ? p : q));
    const sDraft = open();
    const rv = planRiver({ points: [[x0, 0], [x0, Math.round(join[1] * 0.5)], [Math.round(join[0]), Math.round(join[1])]], flow: 1 }, planContextOf(sDraft), id(4));
    if (!rv.ok || !sDraft.applyAll(rv.ops, "user", rv.label).ok) continue;
    const tr = rv.feature as RiverFeature;
    const len = tr.params.path.reduce((acc, q, k, ps) => (k ? acc + Math.hypot(q[0] - ps[k - 1][0], q[1] - ps[k - 1][1]) : 0), 0);
    for (let from = 6; from < len - 20; from += 4) {
      const g = planPiece(sDraft, "gorge", { river: tr.id, from, length: 12, width: 3, wallHeight: 3, access: "stairs" }, id(3));
      if (!g.ok) continue;
      // keep it only when its notch climbs: the slopes it places on the built map
      const probe = open();
      if (!probe.applyAll(rv.ops, "user", rv.label).ok || !probe.applyAll(g.ops, "user", g.label).ok) continue;
      if (probe.built.entities.filter((e) => e.owner === id(3) && e.template === "Slope").length < 2) continue;
      if (!sD.applyAll(rv.ops, "user", rv.label).ok) throw new Error("the tributary did not apply");
      gorge = g;
      trib = tr;
      break tries;
    }
  }
  void sx;
  void sy;
  if (!gorge) throw new Error("no place for the gorge");
  const gD = apply(sD, gorge);
  const outD = exportOf(sD, "gorge stairs");
  const notch = sD.built.entities.filter((e) => e.owner === gD.id && e.template === "Slope");
  const marksD = startMarks(sD.built);
  for (const e of notch) {
    marksD.push({ x: e.x, y: e.y, rgb: [245, 150, 20] });
    const [hx, hy] = slopeHighSide(e.orientation as Orientation);
    marksD.push({ x: e.x + hx, y: e.y + hy, rgb: [150, 80, 0], inset: 1 });
  }
  writeFileSync(join(outDir, `${base} gorge stairs.png`), preview(sD.built, marksD, true));
  const gp = gD.params.plan as unknown as { from: number; to: number; width: number; wallHeight: number };
  const g0 = pointAtArc(trib!.params.path, gp.from).p.map(Math.round);
  const g1 = pointAtArc(trib!.params.path, gp.to).p.map(Math.round);
  const tp = trib!.params.path;
  lines.push(
    `sha256 ${sha(outD.bytes)}  ${base} gorge stairs.timber`,
    `Gorge stairs: two edits. A river drawn from the south edge at (${tp[0].join(", ")}) through (${tp[1].join(", ")}) into the main river at (${tp[tp.length - 1].join(", ")}), 1 water/s (${trib!.params.width} wide); ${trib!.params.bedProfile.steps.length} steps down where the ground falls.`,
    `Gorge: the tributary runs ${gp.width} wide between walls ${gp.wallHeight} levels above its bed, from about (${g0.join(", ")}) to (${g1.join(", ")}).`,
    `  The stair notch: ${notch.length} slopes (orange, high side brown) climb one wall from a two-tile landing beside the water: ${notch.map((e) => `(${e.x}, ${e.y}) z${e.z} ${e.orientation}`).join("; ")}.`,
    "  Beavers should walk down the notch to the landing and back up, and a water pump on the landing should reach the water.",
    `  ${gD.params.report.join("; ")}. Export warnings: ${outD.warnings.join("; ") || "none"}.`,
  );
}

function m6(): void {
  lines.length = 0;
  lines.push(
    `Generator ${GENERATOR_VERSION}; ${size}×${size}, seed ${seed}, designed for Normal, every setting at its theme's preset.`,
    "",
    "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
    "PNGs: north up, 5 px per tile, dotted grid every 16 tiles; water blue (badwater brown); start white (door red); the dam line orange; the stair's slopes orange with their high side brown; badwater sources magenta.",
    "",
  );
  for (const theme of ["canyon", "lakeBasin"] as const) {
    const g = generate(makeSpec({ seed, size: { x: size, y: size }, theme }));
    if (!g.report.passed) throw new Error(`${theme} ${seed} failed: ${g.report.checks.filter((c) => !c.ok && !c.advisory).map((c) => c.id).join(", ")}`);
    const name = fileName(g.spec).replace(/\.timber$/, "");
    writeFileSync(join(outDir, `${name}.timber`), g.bytes);
    const gb = g.built;
    const dam = g.features.find((f): f is SetPieceFeature => f.kind === "setPiece" && f.params.kind === "damSite")!;
    const dp = dam.params.plan as unknown as DamSitePlan;
    const river = g.features.find((f): f is RiverFeature => f.kind === "river" && f.id === dp.river)!;
    const held = reservoirOf(dp, river, { W: gb.W, H: gb.H, seed, features: g.features, heights: gb.heights }, dam.id);
    if (!held) throw new Error(`${theme}: the dam site holds no reservoir`);
    const marks = startMarks(gb);
    for (const [x, y] of held.line) marks.push({ x, y, rgb: [255, 140, 20] });
    const stairs = g.features.find((f) => f.role === "setpiece/terracedCliffs/stairs");
    const stairSlopes = stairs ? gb.entities.filter((e) => e.owner === stairs.id && e.template === "Slope") : [];
    for (const e of stairSlopes) {
      marks.push({ x: e.x, y: e.y, rgb: [245, 150, 20] });
      const [hx, hy] = slopeHighSide(e.orientation as Orientation);
      marks.push({ x: e.x + hx, y: e.y + hy, rgb: [150, 80, 0], inset: 1 });
    }
    const bad = gb.entities.filter((e) => e.template === "BadwaterSource");
    for (const e of bad) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) marks.push({ x: e.x + dx, y: e.y + dy, rgb: [230, 0, 200], inset: 1 });
    writeFileSync(join(outDir, `${name}.png`), preview(gb, marks, true));
    const st = gb.entities.find((e) => e.template === "StartingLocation")!;
    const dr = startEntranceTile(st.x, st.y, st.orientation as Orientation);
    const need = Math.round(rulesFor(g.spec).reservoirNeed);
    const crestLevel = held.bed + dp.crest;
    lines.push(`sha256 ${sha(g.bytes)}  ${name}.timber`);
    lines.push(`${name}: StartingLocation at (${st.x}, ${st.y}), z ${st.z}, ${st.orientation}; door tile (${dr.join(", ")}). Generated in ${g.attempts} attempt${g.attempts > 1 ? "s" : ""}; ${g.report.checks.filter((c) => c.ok || c.advisory).length} of ${g.report.checks.length} checks pass (the advisory plants.drought may warn).`);
    if (theme === "canyon") {
      lines.push(
        `  The dam site is a rock ridge (top level ${dp.topLevel}) across the canyon's narrows. Build levees ${dp.crest} high (${dp.crest === 1 ? "one levee" : `${dp.crest} levees stacked`}) on its ${held.line.length} gap tiles (orange): ${held.line.map(([x, y]) => `(${x}, ${y})`).join(" ")}. The river bed there is at level ${held.bed}, so the crest is at level ${crestLevel}.`,
        `  The canyon floor behind it should fill to about level ${crestLevel}: ${held.area} tiles, about ${Math.round(held.volume)} blocks of water, held between the canyon walls; none of it should leak round the ridge.`,
        `  The stair: ${stairSlopes.length} slopes climb the canyon wall beside the start, one level each: ${stairSlopes.map((e) => `(${e.x}, ${e.y}) z${e.z}`).join("; ")}. Beavers should walk up it to the rim and back.`,
      );
    } else {
      const lake = g.features.find((f) => f.kind === "lake" && f.role === "lake/central");
      const sill = lake && lake.kind === "lake" ? lake.params.outlet.sill : held.bed;
      lines.push(
        `  The lake's water stands at about level ${sill} (its outlet's sill), a little higher while the rivers run. The dam site is a rock ridge (top level ${dp.topLevel}) across the outlet's narrow gap. Build levees ${dp.crest} high (${dp.crest === 1 ? "one levee" : `${dp.crest} levees stacked`}) on its ${held.line.length} gap tiles (orange): ${held.line.map(([x, y]) => `(${x}, ${y})`).join(" ")}.`,
        `  The whole lake should rise to about level ${crestLevel}: ${held.area} tiles, about ${Math.round(held.volume)} blocks of water behind the dam; none of it should leak round the ridge, and the start's bench (level ${st.z}) should stay dry.`,
      );
    }
    lines.push(
      `  Badwater: ${bad.length ? bad.map((e) => `a source at (${e.x}, ${e.y})–(${e.x + 2}, ${e.y + 2})`).join("; ") + " in a basin with one outlet" : "none"}. The colony needs about ${need} water stored through the first Normal drought.`,
      "",
    );
  }
}

function m7(): void {
  lines.length = 0;
  const g = generate(makeSpec({ seed, size: { x: size, y: size }, theme: "lakeBasin" }));
  if (!g.report.passed) throw new Error(`lakeBasin ${seed} failed`);
  const name = `${fileName(g.spec).replace(/\.timber$/, "")} D objects`;
  const s = MapSession.fromGenerated(g);
  const id = (k: number) => `00000000-0000-4000-8000-${String(700 + k).padStart(12, "0")}`;
  const apply = (p: PlannedEdit) => {
    if (!p.ok) throw new Error(p.errors.join("; "));
    const a = s.applyAll(p.ops, "user", p.label);
    if (!a.ok) throw new Error(a.errors.join("; "));
    return p;
  };
  const Wm = s.size.x;
  const Hm = s.size.y;
  const st = s.built.entities.find((e) => e.template === "StartingLocation")!;
  const dist = (x: number, y: number) => Math.sqrt((x - st.x - 1) * (x - st.x - 1) + (y - st.y - 1) * (y - st.y - 1));

  // a weir across an inflow river, as the Weir tool places it (a click on the river)
  let weir: PlannedEdit | null = null;
  for (const f of s.features) {
    if (f.kind !== "river" || f.params.badwater || !f.role?.startsWith("river/inflow") || weir) continue;
    const len = f.params.path.reduce((a, q, k, ps) => (k ? a + Math.hypot(q[0] - ps[k - 1][0], q[1] - ps[k - 1][1]) : 0), 0);
    for (let at = Math.round(len * 0.4); at < len * 0.85 && !weir; at += 2) {
      const p = planObject(s, { kind: "weir", river: { id: f.id, at } }, id(1));
      if (p.ok) weir = p;
    }
  }
  if (!weir || !weir.ok) throw new Error("no place for the weir");
  apply(weir);
  // a thorn belt drawn on dry land 24–40 tiles from the start (the Thorn belt tool, 60% of the area)
  let belt: PlannedEdit | null = null;
  search: for (let r = 24; r <= 40; r += 4)
    for (let a = 0; a < 16; a++) {
      const cx = Math.round(st.x + 1 + r * Math.cos((a * Math.PI) / 8));
      const cy = Math.round(st.y + 1 + r * Math.sin((a * Math.PI) / 8));
      if (cx < 8 || cy < 8 || cx > Wm - 9 || cy > Hm - 9) continue;
      const tiles: number[] = [];
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 5; x <= cx + 5; x++) tiles.push(y * Wm + x);
      const p = planObject(s, { kind: "thornBelt", tiles, density: 0.6 }, id(2));
      if (!p.ok || p.report.some((l) => l.includes("stay free"))) continue;
      let near = Infinity;
      for (const i of p.tiles) near = Math.min(near, dist(i % Wm, Math.floor(i / Wm)));
      if (near >= 22) {
        belt = p;
        break search;
      }
    }
  if (!belt) throw new Error("no place for the thorn belt");
  apply(belt);

  const { bytes } = s.exportTimber();
  writeFileSync(join(outDir, `${name}.timber`), bytes);
  const v = s.validate("export");
  const failing = v.report.checks.filter((c) => !c.ok && !c.advisory && c.applicable !== false);
  if (failing.some((c) => c.class === "load")) throw new Error(`load problems: ${failing.map((c) => c.id).join(", ")}`);
  const placement = v.report.checks.find((c) => c.id === "entities.placement")!;
  const extras = v.report.checks.find((c) => c.id === "extras.placement")!;

  const b2 = s.built;
  const ents = (t: string) => b2.entities.filter((e) => e.template === t);
  const marks = startMarks(b2);
  const COLOURS: [string, [number, number, number]][] = [
    ["Blockage", [230, 0, 200]],
    ["NaturalDam", [0, 230, 255]],
    ["Thorns", [120, 20, 30]],
    ["SmallRelic", [255, 230, 0]],
    ["MediumRelic", [255, 230, 0]],
    ["GeothermalField", [255, 120, 0]],
    ["UndergroundRuins", [150, 60, 220]],
  ];
  for (const [t, rgb] of COLOURS) for (const e of ents(t)) for (const [x, y] of entityTiles(e)) marks.push({ x, y, rgb });
  const spill = s.features.find((f): f is SetPieceFeature => f.kind === "setPiece" && f.params.kind === "plugSpillway")!;
  const sp = spill.params.plan as unknown as SpillwayPlan;
  const plugAt = new Set<string>();
  for (let k = 0; k + 1 < sp.plug.length; k += 2) plugAt.add(`${sp.plug[k]},${sp.plug[k + 1]}`);
  for (let k = 0; k + 1 < sp.outlet.length; k += 2) if (!plugAt.has(`${sp.outlet[k]},${sp.outlet[k + 1]}`)) marks.push({ x: sp.outlet[k], y: sp.outlet[k + 1], rgb: [40, 90, 200], inset: 1 });
  writeFileSync(join(outDir, `${name}.png`), preview(b2, marks, true));

  const at = (e: { x: number; y: number }) => `(${e.x}, ${e.y})`;
  const box = (t: string) =>
    ents(t).map((e) => {
      const ts = entityTiles(e);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of ts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      return `(${x0}, ${y0})–(${x1}, ${y1}), ${Math.round(dist(x0, y0))} tiles from the start`;
    });
  const dams = ents("NaturalDam");
  const thorns = ents("Thorns");
  const plug = ents("Blockage");
  const lake = s.features.find((f) => f.kind === "lake" && f.id === sp.lake);
  const door2 = startEntranceTile(st.x, st.y, st.orientation as Orientation);
  let tx0 = Infinity;
  let ty0 = Infinity;
  let tx1 = -Infinity;
  let ty1 = -Infinity;
  for (const e of thorns) {
    tx0 = Math.min(tx0, e.x);
    ty0 = Math.min(ty0, e.y);
    tx1 = Math.max(tx1, e.x);
    ty1 = Math.max(ty1, e.y);
  }
  const count = ["Blockage", "NaturalDam", "Thorns", "SmallRelic", "MediumRelic", "GeothermalField", "UndergroundRuins"].reduce((a, t) => a + ents(t).length, 0);
  lines.push(
    `Generator ${GENERATOR_VERSION}; ${size}×${size}, seed ${seed}, Lake Basin, designed for Normal, every setting at its theme's preset; two edits with the M7 tools (a weir and a thorn belt).`,
    "",
    "Tile coordinates: x runs west to east, y runs south to north, (0, 0) is the south-west corner.",
    "PNG: north up, 5 px per tile, dotted grid every 16 tiles; water blue (badwater brown); start white (door red); Blockage (the plug) magenta; NaturalDam (the weir) cyan; Thorns dark red; relics yellow; geothermal fields orange; mine sites (UndergroundRuins) purple; the spillway's channel dark blue dots.",
    "",
    `sha256 ${sha(bytes)}  ${name}.timber`,
    `StartingLocation at ${at(st)}, z ${st.z}, ${st.orientation}; door tile (${door2.join(", ")}).`,
    `Validation (export profile): entities.placement ${placement.ok ? "passes" : "FAILS"} (the loader's rules for every object); extras.placement ${extras.ok ? "passes" : "fails"}; warnings: ${failing.map((c) => c.id).join(", ") || "none"}.`,
    "",
    `Objects (${count} entities):`,
    `  Blockage (the spillway's plug), ${plug.length} tiles: ${plug.map(at).join(" ")}.`,
    `  NaturalDam (the weir), ${dams.length} tiles across a river: ${dams.map(at).join(" ")}. ${weir.report.join("; ")}.`,
    `  Thorns, ${thorns.length} in a belt within (${tx0}, ${ty0})–(${tx1}, ${ty1}).`,
    `  Small relic: ${box("SmallRelic").join("; ")}.`,
    `  Medium relic: ${box("MediumRelic").join("; ")}.`,
    `  Geothermal fields: ${box("GeothermalField").join("; ")}.`,
    `  Mine sites (UndergroundRuins): ${box("UndergroundRuins").join("; ")}.`,
    "",
    `The plugged spillway: the lake${lake && lake.kind === "lake" ? ` (sill at level ${lake.params.outlet.sill})` : ""} has a side channel ${sp.outletWidth} wide, its bed one level below the sill (level ${sp.level - 1}), running ${sp.outlet.length / 2} tiles to ${sp.outletTo === "edge" ? "the map edge" : "lower ground"}. The plug's top stands at the sill, so the lake keeps its level and spills over it as over its own outlet.`,
    `  Its report: ${spill.params.report.join("; ")}.`,
    `  Demolish the ${plug.length} Blockage tiles: the lake should drain about one level (to about level ${sp.level - 1}) down the channel, about ${sp.release.toLocaleString("en-US")} water, and then keep that level.`,
    "",
  );
}
