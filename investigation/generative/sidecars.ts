// Per-map analysis for the measures (docs/m9-design.md, "Measures"), computed once from each map's
// file and settled water and kept beside it as <key>.x.json: the opening (lib/opening.ts), the dam
// walls (lib/ridge.ts), water.storage_possible (proto/storage.ts, on the stored water) and the
// score's reservoir obviousness. Workshop and official maps get the same analysis from their local
// copies (their per-map results stay in C:\dgm-workshop, never committed).
//
//   npx tsx investigation/generative/sidecars.ts --dir current-128 [--themes riverValley] [--force]
//   npx tsx investigation/generative/sidecars.ts --workshop      (workshop and official maps)

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTimber } from "../../src/core/format/timber";
import { surfaceOf } from "../../src/core/format/world";
import { mapObjects, waterModel } from "../../src/core/sim/model";
import type { Feature } from "../../src/core/features/schema";
import type { MapSpec } from "../../src/core/spec/mapspec";
import { validateMap } from "../../src/core/validate/checks";
import type { BuildResult } from "../../src/core/features/build";
import { listMaps } from "../workshop/lib/paths";
import { loadMap } from "../workshop/lib/load";
import { readSettled } from "../workshop/lib/settled";
import { startCentre } from "../workshop/lib/measures";
import { openingOf } from "./lib/opening";
import { arg, lowPriority, MAPS, ROOT, WORKSHOP } from "./lib/paths";
import { damWalls } from "./lib/ridge";
import { storagePossible } from "./proto/storage";

lowPriority();
const force = process.argv.includes("--force");

function sidecarFor(h: Uint8Array, W: number, H: number, depth: ArrayLike<number>, contam: ArrayLike<number>, moist: ArrayLike<number> | null, objects: ReturnType<typeof mapObjects>, start: { x: number; y: number; z: number } | null) {
  const walls = damWalls(h, W, H, depth);
  const opening = start ? openingOf(h, W, H, depth, contam, objects, start, "normal", moist) : null;
  return { walls: walls.map((w) => ({ x: w.x, y: w.y, points: w.points, crest: w.crest, floor: w.floor })), opening };
}

if (process.argv.includes("--workshop")) {
  const out: Record<string, unknown> = {};
  const path = join(ROOT, "workshop-sidecars.json");
  const prev: Record<string, unknown> = existsSync(path) && !force ? JSON.parse(readFileSync(path, "utf8")) : {};
  for (const ref of listMaps()) {
    if (prev[ref.key]) {
      out[ref.key] = prev[ref.key];
      continue;
    }
    const recPath = join(WORKSHOP, "measured", `${ref.key}.json`);
    if (!existsSync(recPath)) continue;
    const rec = JSON.parse(readFileSync(recPath, "utf8"));
    const l = loadMap(ref);
    if (!l.file) continue;
    const w = l.file.world;
    const W = w.sizeX;
    const H = w.sizeY;
    const s = readSettled(ref.key, W * H);
    if (!s) continue;
    const h = surfaceOf(w);
    const objects = mapObjects(w);
    // openings only where the start can be measured (one start on the top surface, dry, water our
    // steady state can show), as the workshop study does
    const special: string[] = rec.mechanics?.special ?? [];
    const reliable = !special.some((x: string) => x !== "caves: water under roofs" && x !== "unstable cores") && (rec.terrain?.caveShare ?? 0) < 0.05;
    const start = reliable && rec.start && rec.starts === 1 && rec.checks?.["start.dry"]?.ok !== false ? { x: rec.start.x, y: rec.start.y, z: rec.start.z } : null;
    const t0 = performance.now();
    out[ref.key] = { source: ref.source, W, H, ...sidecarFor(h, W, H, s.depth, s.contam, s.moist, objects, start) };
    console.log(ref.key, Math.round(performance.now() - t0), "ms", start ? "opening" : "no opening");
    writeFileSync(path, JSON.stringify(out));
  }
  writeFileSync(path, JSON.stringify(out));
} else {
  const dir = arg("path", "") || join(MAPS, arg("dir", "current-128"));
  const themes = arg("themes", "");
  for (const f of readdirSync(dir).filter((n) => /^[^.]+\.json$/.test(n)).sort()) {
    const key = f.replace(/\.json$/, "");
    if (themes && !themes.split(",").includes(key.replace(/-\d+$/, "").replace(/-128$/, ""))) continue;
    const xPath = join(dir, `${key}.x.json`);
    if (existsSync(xPath) && !force) continue;
    const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!rec.passed || !existsSync(join(dir, `${key}.timber`))) continue;
    const t0 = performance.now();
    const file = readTimber(new Uint8Array(readFileSync(join(dir, `${key}.timber`))));
    const w = file.world;
    const W = w.sizeX;
    const H = w.sizeY;
    const N = W * H;
    const b = readFileSync(join(dir, `${key}.f32`));
    const a = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    const depth = Float64Array.from(a.subarray(0, N));
    const contam = Float64Array.from(a.subarray(N, 2 * N));
    const moist = a.subarray(2 * N, 3 * N);
    const h = surfaceOf(w);
    const objects = mapObjects(w);
    const st = objects.find((o) => o.template === "StartingLocation");
    const start = st ? startCentre(st) : null;
    const side = sidecarFor(h, W, H, depth, contam, moist, objects, start);
    // water.storage_possible on the stored water (the prototype's batch records its own too)
    let storage: unknown = rec.storage ?? null;
    if (!storage && start && existsSync(join(dir, `${key}.features.json`))) {
      const { spec, features } = JSON.parse(readFileSync(join(dir, `${key}.features.json`), "utf8")) as { spec: MapSpec; features: Feature[] };
      const model = waterModel(W, H, h, objects);
      const settled = { settled: true, ticks: rec.settleTicks ?? 0, depth, contamination: contam, sat: new Uint8Array(N) };
      const v = validateMap(file, { profile: "generate", spec, features, water: { model, settled } });
      const built = { W, H, water: depth, contamination: contam, waterModel: model, start: { ...start, feature: "" } } as unknown as BuildResult;
      const r = storagePossible(h, W, H, built, v, spec);
      storage = { ok: r.ok, value: r.value ?? null, message: r.message };
    }
    writeFileSync(xPath, JSON.stringify({ ...side, storage }));
    console.log(key, Math.round(performance.now() - t0), "ms", "walls", side.walls.length, "short40", side.opening?.shortest40 ?? "-");
  }
}
