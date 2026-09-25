import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  Worker,
  isMainThread,
  workerData,
  parentPort,
} from "node:worker_threads";
import { sourcesFromHalo, crop, quantise } from "./lib/terrain";
import { convert } from "./lib/convert";
import { terrainMetrics } from "./lib/metrics";
import { checkCache } from "./lib/provenance";
if (isMainThread) process.chdir(fileURLToPath(new URL("./", import.meta.url)));
for (const p of [".work/rows", ".work/candidates", ".work/errors"])
  mkdirSync(p, { recursive: true });
if (isMainThread) await checkCache();
const pilot = process.argv.includes("--pilot");
const priority = process.argv.includes("--priority");
const all = JSON.parse(readFileSync("data/locations.json", "utf8"));
const countArg = process.argv.indexOf("--workers");
const workers = countArg < 0 ? 8 : +process.argv[countArg + 1];
const tasks = all.flatMap((loc: any, index: number) =>
  pilot && index % 20 !== 0
    ? []
    : priority
      ? index % 4 === 0
        ? [{ loc, metres: 60, size: 128 }]
        : []
      : [30, 60, 120].flatMap((metres) =>
          [96, 128, 256].map((size) => ({ loc, metres, size })),
        ),
);
async function task(t: any) {
  const key = `${t.loc.id}-${t.size}-${t.metres}`;
  const path = `.cache/patches/${key}.f32.gz`;
  if (!existsSync(path))
    throw Error(`Missing ${path}; finish acquisition first`);
  const meta = JSON.parse(readFileSync(`.cache/patches/${key}.json`, "utf8"));
  const b = gunzipSync(readFileSync(path)),
    raw = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4),
    central = crop(raw, t.size + 64, t.size, 32),
    hydro = sourcesFromHalo(raw, t.size, 32);
  for (const [mode, cap] of [
    ["linear", 16],
    ["compressed", 16],
    ["normalised", 16],
    ["normalised", 22],
  ] as const) {
    const id = `${key}-${mode}-${cap}`,
      path = `.work/rows/${id}.json`;
    if (existsSync(path)) continue;
    const q = quantise(central, mode, cap),
      start = performance.now();
    const r = convert(q.heights, t.size, cap, hydro, id),
      metrics = terrainMetrics(q.heights, t.size, t.size, r.water),
      checks = r.v.report.checks.map((c) => ({
        id: c.id,
        ok: c.ok,
        advisory: !!c.advisory,
        applicable: c.applicable !== false,
        value: c.value,
        limit: c.limit,
      }));
    const row = {
      id,
      location: t.loc.id,
      region: t.loc.region,
      family: t.loc.family,
      cohort: t.loc.cohort,
      size: t.size,
      metres: t.metres,
      cap,
      mode,
      mapping: q.mapping,
      passed: r.v.report.passed,
      checks,
      settled: r.water.settled,
      settleTicks: r.water.ticks,
      edgeCellsRaised: r.edgeChanges,
      sourceCount: r.sources.length,
      sourceThreshold: hydro.threshold,
      haloFillMaxMetres: hydro.filledMetresMax,
      startSearch: r.selection,
      ...metrics,
      natural: r.originalNatural,
      convertedNatural: r.measured.natural,
      water: r.measured.water,
      dams: r.measured.dams,
      coreMetrics: r.measured.metrics,
      layout: r.measured.layout,
      features: r.features,
      ms: Math.round(performance.now() - start),
    };
    writeFileSync(path, JSON.stringify(row));
    if (r.v.report.passed && cap === 16) {
      writeFileSync(
        `.work/candidates/${id}.json.gz`,
        gzipSync(
          JSON.stringify({
            ...r.fixture,
            id,
            name: `${t.loc.name}, ${t.metres} m per tile`,
            location: t.loc,
            metres: t.metres,
            mapping: q.mapping,
            validation: {
              base: "cfa5990caeaf462de695caf428280da55fc0f7f5",
              profile: "generate",
              passed: true,
              checks,
            },
          }),
        ),
      );
    }
  }
}
if (isMainThread) {
  let index = 0,
    done = 0,
    failed = 0;
  const t0 = Date.now();
  await Promise.all(
    Array.from(
      { length: workers },
      () =>
        new Promise<void>((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), {
            workerData: { worker: true },
            execArgv: [
              "--import",
              new URL("./register.mjs", import.meta.url).href,
            ],
          });
          const next = () => {
            const t = tasks[index++];
            if (t) w.postMessage(t);
            else {
              w.postMessage(null);
              resolve();
            }
          };
          w.on("message", (m) => {
            if (m.ready) {
              next();
              return;
            }
            done++;
            if (m.error) {
              failed++;
              writeFileSync(`.work/errors/${m.key}.json`, JSON.stringify(m));
            }
            if (done % 10 === 0 || m.error)
              console.log(
                `convert ${done}/${tasks.length}, errors ${failed}, ${Math.round((Date.now() - t0) / 1000)}s ${m.key}${m.error ? " " + m.error : ""}`,
              );
            next();
          });
          w.on("error", reject);
        }),
    ),
  );
  console.log(`Conversion complete: ${done} patches, ${failed} errors`);
  if (failed) process.exitCode = 1;
} else {
  parentPort!.on("message", async (t) => {
    if (t === null) {
      parentPort!.close();
      return;
    }
    try {
      await task(t);
      parentPort!.postMessage({ key: `${t.loc.id}-${t.size}-${t.metres}` });
    } catch (e) {
      parentPort!.postMessage({
        key: `${t.loc.id}-${t.size}-${t.metres}`,
        error: String(e),
        stack: (e as Error).stack,
      });
    }
  });
  parentPort!.postMessage({ ready: true });
}
