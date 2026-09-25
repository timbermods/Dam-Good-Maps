// The import-and-measure pipeline: import every copied map with the app's importer, validate it
// with the app's validators (import profile, on our canonical settle), and measure it
// (lib/measures.ts). Per-map results stay local: C:\dgm-workshop\measured\<key>.json, and the
// settled water, moisture and contamination in C:\dgm-workshop\settled\<key>.f32 for the renders
// and the Python pass (analyze_py.py).
//
//   npx tsx investigation/workshop/measure.ts                 # every map not measured yet
//   npx tsx investigation/workshop/measure.ts --force         # measure everything again
//   npx tsx investigation/workshop/measure.ts --only Canyon   # keys or file names containing "Canyon"
//
// One map at a time, below normal priority.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listMaps, lowPriority, MEASURED, ROOT, SETTLED } from "./lib/paths";
import { loadMap, sizeClass } from "./lib/load";
import { measureFile } from "./lib/measures";

lowPriority();
const force = process.argv.includes("--force");
const oi = process.argv.indexOf("--only");
const only = oi >= 0 ? process.argv[oi + 1] : "";
mkdirSync(MEASURED, { recursive: true });
mkdirSync(SETTLED, { recursive: true });

const skipped: { key: string; file: string; reason: string }[] = [];
let done = 0;
for (const ref of listMaps()) {
  if (only && !ref.key.includes(only) && !ref.fileName.includes(only)) continue;
  const out = join(MEASURED, `${ref.key}.json`);
  if (!force && existsSync(out)) continue;
  const t0 = performance.now();
  const l = loadMap(ref);
  if (l.skip || !l.file) {
    skipped.push({ key: ref.key, file: ref.fileName, reason: l.skip ?? "not loaded" });
    console.log(`${ref.key}: SKIP ${l.skip}`);
    continue;
  }
  let result;
  try {
    result = measureFile(l.file);
  } catch (e) {
    skipped.push({ key: ref.key, file: ref.fileName, reason: `measure failed: ${(e as Error).message}` });
    console.log(`${ref.key}: FAILED ${(e as Error).stack}`);
    continue;
  }
  const { m, v } = result;
  const rec = {
    key: ref.key,
    source: ref.source,
    id: ref.id ?? null,
    file: ref.fileName,
    version: l.version,
    format: l.format,
    era: l.era,
    sizeClass: sizeClass(m.area),
    oversize: l.W > 256 || l.H > 256,
    aspect: Math.round((Math.max(l.W, l.H) / Math.min(l.W, l.H)) * 100) / 100,
    importChanges: l.report?.changes.map((c) => c.id) ?? [],
    importFlags: l.report?.flags.map((f) => f.id) ?? [],
    templates: l.templates,
    ms: Math.round(performance.now() - t0),
    ...m,
  };
  writeFileSync(out, JSON.stringify(rec));
  // settled water for renders and the Python pass: depth, contamination, moisture (float32)
  const N = m.area;
  const buf = new Float32Array(3 * N);
  buf.set(v.water!.depth, 0);
  buf.set(v.water!.contamination, N);
  buf.set(v.analysis!.moisture, 2 * N);
  writeFileSync(join(SETTLED, `${ref.key}.f32`), new Uint8Array(buf.buffer));
  writeFileSync(join(SETTLED, `${ref.key}.json`), JSON.stringify({ W: m.W, H: m.H, arrays: ["depth", "contamination", "moisture"] }));
  done++;
  console.log(
    `${ref.key.padEnd(22)} ${String(m.W).padStart(4)}x${String(m.H).padEnd(4)} ${String(rec.ms).padStart(6)} ms  settle ${m.settleTicks}${m.settled ? "" : "!"}  ` +
      `water ${(m.metrics.waterShare * 100).toFixed(1)}%  falls ${m.metrics.waterfalls}  dams ${m.dams.sites}  flow ${m.water.flow}  ` +
      `start ${m.start ? `reach ${m.start.reach} water ${m.start.pumpableWater}` : `none (${m.starts})`}  run ${m.natural.longestRun}`,
  );
}
if (skipped.length) {
  const path = join(ROOT, "skipped.json");
  writeFileSync(path, JSON.stringify(skipped, null, 1));
}
console.log(`measured ${done}, skipped ${skipped.length}`);
