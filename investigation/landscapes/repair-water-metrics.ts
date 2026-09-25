/** Repair pre-v2 fall measurements by replaying only the unchanged water model.
 * Existing validation, planting and relief records remain unchanged. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { crop, quantise, sourcesFromHalo, neighbours } from "./lib/terrain";
import { terrainMetrics } from "./lib/metrics";
import { density } from "../../src/core/gen/calibrated";
import { waterSource, entityJson } from "../../src/core/format/entities";
import { waterModel, mapObjects } from "../../src/core/sim/model";
import { canonicalSettle } from "../../src/core/sim/prefill";
import { checkCache } from "./lib/provenance";
function repair(filename: string) {
  const path = ".work/rows/" + filename;
  const row = JSON.parse(readFileSync(path, "utf8"));
  if (row.measurementVersion === 2) return;
  if (!row.settled) {
    row.falls = null;
    row.measurementVersion = 2;
    row.cachedWaterReplaySkipped =
      "No steady state; fall statistics are unavailable.";
    writeFileSync(path, JSON.stringify(row));
    return;
  }
  const W = row.size,
    N = W * W;
  const bytes = gunzipSync(
    readFileSync(`.cache/patches/${row.location}-${W}-${row.metres}.f32.gz`),
  );
  const raw = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const hydro = sourcesFromHalo(raw, W, 32);
  const original = quantise(
    crop(raw, W + 64, W, 32),
    row.mode,
    row.cap,
  ).heights;
  const h = original.slice(),
    open = new Set<number>();
  for (const o of hydro.outlets) {
    open.add(o.i);
    for (const j of neighbours(o.i, W, W, false))
      if (j % W === 0 || j % W === W - 1 || j < W || j >= N - W) open.add(j);
  }
  for (let i = 0; i < N; i++)
    if ((i % W === 0 || i % W === W - 1 || i < W || i >= N - W) && !open.has(i))
      h[i] = row.cap;
  const sum = hydro.sources.reduce(
    (s: number, v: any) => s + Math.sqrt(v.area),
    0,
  );
  const flow = (2 * density("water_strength_per_10k", N) * N) / 1e4;
  const seen = new Set<number>(),
    entities: any[] = [];
  for (const s of hydro.sources) {
    if (seen.has(s.i)) continue;
    seen.add(s.i);
    entities.push(
      entityJson(
        waterSource({
          id: `00000000-0000-4000-8000-${String(entities.length).padStart(12, "0")}`,
          owner: "survey",
          x: s.i % W,
          y: Math.floor(s.i / W),
          z: h[s.i],
          strength: Math.min(8, (flow * Math.sqrt(s.area)) / (sum || 1)),
        }),
      ),
    );
  }
  const water = canonicalSettle(
    waterModel(W, W, h, mapObjects({ entities } as any)),
  );
  if (
    water.settled !== row.settled ||
    water.ticks !== row.settleTicks ||
    entities.length !== row.sourceCount
  )
    throw Error("Replay differs from original water run: " + row.id);
  const metrics = terrainMetrics(original, W, W, water, h);
  if (
    JSON.stringify(metrics.network) !== JSON.stringify(row.network) ||
    JSON.stringify(metrics.relief) !== JSON.stringify(row.relief)
  )
    throw Error("Replay changed network or relief: " + row.id);
  const changed = JSON.stringify(row.falls) !== JSON.stringify(metrics.falls);
  row.falls = metrics.falls;
  row.measurementVersion = 2;
  row.waterMetricsRechecked = true;
  row.boundaryFallCorrectionChanged = changed;
  writeFileSync(path, JSON.stringify(row));
}
if (isMainThread) {
  await checkCache();
  mkdirSync(".work/repair-errors", { recursive: true });
  const tasks = readdirSync(".work/rows").filter(
    (f) =>
      JSON.parse(readFileSync(".work/rows/" + f, "utf8")).measurementVersion !==
      2,
  );
  let next = 0,
    done = 0,
    failures = 0;
  const i = process.argv.indexOf("--workers"),
    workers = i < 0 ? 4 : Number(process.argv[i + 1]);
  await Promise.all(
    Array.from(
      { length: workers },
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), {
            execArgv: [
              "--import",
              new URL("./register.mjs", import.meta.url).href,
            ],
          });
          const send = () => {
            const filename = tasks[next++];
            if (filename) worker.postMessage(filename);
            else {
              worker.postMessage(null);
              resolve();
            }
          };
          worker.on("error", reject);
          worker.on("message", (result) => {
            if (!result.ready) {
              done++;
              if (result.error) {
                failures++;
                writeFileSync(
                  ".work/repair-errors/" + result.file,
                  JSON.stringify(result),
                );
              }
              if (done % 50 === 0 || result.error)
                console.log(
                  `water recheck ${done}/${tasks.length}; failures ${failures}`,
                );
            }
            send();
          });
        }),
    ),
  );
  console.log(`Water recheck complete: ${done}, errors ${failures}`);
  if (failures) process.exitCode = 1;
} else {
  parentPort!.on("message", (file) => {
    if (file === null) {
      parentPort!.close();
      return;
    }
    try {
      repair(file);
      parentPort!.postMessage({ file });
    } catch (error) {
      parentPort!.postMessage({ file, error: String(error) });
    }
  });
  parentPort!.postMessage({ ready: true });
}
