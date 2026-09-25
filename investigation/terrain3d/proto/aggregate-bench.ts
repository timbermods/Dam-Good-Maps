// The mesher benchmark's committed results: per map for the generated and official maps, and for
// the workshop maps only the worst case and the median (their per-map numbers stay local).
//
//   npx tsx investigation/terrain3d/proto/aggregate-bench.ts <bench-mesher-full.json> [--out investigation/terrain3d/results]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const full = JSON.parse(readFileSync(process.argv[2], "utf8")) as { machine: unknown; nodeSide: Record<string, Record<string, number>>; runs: any[] };
const i = process.argv.indexOf("--out");
const out = i >= 0 ? process.argv[i + 1] : "investigation/terrain3d/results";
mkdirSync(out, { recursive: true });
const r1 = (v: number) => Math.round(v * 10) / 10;
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const row = (m: any) => ({
  map: m.map, source: m.source, buildMs: m.build.ms, meshMs: m.build.meshMs, lightMs: m.build.lightMs, firstFrameMs: m.build.firstFrameMs,
  terrainQuads: m.build.terrainQuads, waterQuads: m.build.waterQuads, triangles: m.triangles, fps: r1(m.orbit.fps), p95Ms: r1(m.orbit.p95), over60: m.orbit.over60,
  cutMs: m.cutMs, fpsWithCut: r1(m.orbitCut.fps), p95MsWithCut: r1(m.orbitCut.p95),
});
const configs = full.runs.map((run) => {
  const own = run.results.filter((m: any) => m.source === "generated" || m.source === "official").map(row);
  const ws = run.results.filter((m: any) => m.source === "workshop").map(row);
  const stress = run.results.filter((m: any) => m.source === "stress").map((m: any) => ({ ...row(m), map: "oversize workshop map (399×399)" }));
  const all = run.results.filter((m: any) => m.source !== "stress").map(row);
  return {
    label: run.label, gpu: run.gpu, cpuSlowdown: run.cpuSlowdown, screen: run.screen,
    worstBuildMs256: Math.max(...all.map((m: any) => m.buildMs)),
    worstFps256: Math.min(...all.map((m: any) => Math.min(m.fps, m.fpsWithCut))),
    maps: own,
    workshop: ws.length ? {
      maps: ws.length,
      buildMs: { median: med(ws.map((m: any) => m.buildMs)), max: Math.max(...ws.map((m: any) => m.buildMs)) },
      fps: { median: r1(med(ws.map((m: any) => m.fps))), min: Math.min(...ws.map((m: any) => m.fps)) },
      fpsWithCut: { median: r1(med(ws.map((m: any) => m.fpsWithCut))), min: Math.min(...ws.map((m: any) => m.fpsWithCut)) },
      triangles: { median: med(ws.map((m: any) => m.triangles)), max: Math.max(...ws.map((m: any) => m.triangles)) },
    } : null,
    stress,
  };
});
const summary = { budget: { buildMs: 1500, fps: 60 }, machine: full.machine, configs };
writeFileSync(join(out, "mesher-bench.json"), JSON.stringify(summary, null, 1) + "\n");
for (const c of configs) console.log(`${c.label}: worst build ${c.worstBuildMs256} ms, worst fps ${c.worstFps256.toFixed(0)} (with and without the cut)`);
