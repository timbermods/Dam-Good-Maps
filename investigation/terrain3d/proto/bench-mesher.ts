// The mesher against the 3D budgets (PLAN §14.2, D46), measured the way `npm run bench:3d` does:
// installed Chrome, headed; (1) the default GPU at 1600×900; (2) the other GPU (the integrated
// one) at 1600×900; (3) the other GPU with the page's CPU 4× slower, on a 1280×720 screen at 150%.
// Budgets: a build under 1.5 s at 256², and 60 fps.
//
// Maps (256², plus Hollows at 192² and one oversize stress map): the prototype's generated maps
// (ordinary and high verticality), the official cave maps, and the local workshop maps with the
// most caves (read only; their per-map numbers stay local, only aggregates are written to results).
//
//   npx tsx investigation/terrain3d/proto/bench-mesher.ts --work <scratch dir> [--seconds 8]
//        [--configs 1,2,3] [--maps name,...] [--gen <dir with terrain3d-*.timber>]

import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";
import { build } from "vite";
import { cpus, platform, release } from "node:os";
import { loadMap } from "./loadmap";
import { OPEN_CEILING } from "./columns";
import { VoxelTerrain, meshAll, skyLight } from "./mesher";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const WORK = arg("work", ".scratch/terrain3d-bench")!;
const SECONDS = Number(arg("seconds", "8"));
const CONFIGS = arg("configs")?.split(",").map(Number);
const ONLY = arg("maps")?.split(",");
const GEN = arg("gen", join(WORK, "..", "maps3d"))!;
const PORT = 4191;
const SHOTS = arg("shots");
const here = dirname(fileURLToPath(import.meta.url));

const OFFICIAL = "C:/Users/Kyler/code/DamGoodMaps/investigation/raw/builtin";
const WORKSHOP = "C:/dgm-workshop/items";
/** Workshop maps at 256² (or 255²) with the most terrain above terrain, and one oversize map. */
const WORKSHOP_IDS = ["3516254147", "3471578892", "3543101769", "3527380089", "3633105277", "3532567335", "3538102198"];
const STRESS_ID = "3483070047";

interface Ref { name: string; path: string; source: "generated" | "official" | "workshop" | "stress" }

function refs(): Ref[] {
  const out: Ref[] = [];
  if (existsSync(GEN)) for (const f of readdirSync(GEN).sort()) if (/^terrain3d-.*-256-\d+\.timber$/.test(f)) out.push({ name: f.replace(/\.timber$/, ""), path: join(GEN, f), source: "generated" });
  for (const n of ["Hollows", "Pressure", "Nomads", "Lakes", "HelixMountain", "Oasis"]) {
    const p = join(OFFICIAL, `${n}.timber`);
    if (existsSync(p)) out.push({ name: n, path: p, source: "official" });
  }
  for (const id of [...WORKSHOP_IDS, STRESS_ID]) {
    const dir = join(WORKSHOP, id);
    if (!existsSync(dir)) continue;
    const f = readdirSync(dir).find((x) => x.endsWith(".timber"));
    if (f) out.push({ name: `w${id}`, path: join(dir, f), source: id === STRESS_ID ? "stress" : "workshop" });
  }
  return ONLY ? out.filter((r) => ONLY.some((o) => r.name.includes(o))) : out;
}

/** Voxels and the stored water's surfaces as the page's .bin; plus Node-side CPU timings. */
function exportMap(r: Ref, dir: string): Record<string, number> {
  const lm = loadMap(r.path, r.name);
  const { W, H } = lm;
  const N = W * H;
  const L = 23;
  const wet: number[] = [];
  for (let i = 0; i < N; i++) for (let s = 0; s < lm.cols.count[i]; s++) {
    const c = s * N + i;
    const d = lm.stored.depth[c];
    if (d > 0.02) wet.push(i % W, (i - (i % W)) / W, lm.cols.floor[c] + Math.min(d, lm.cols.ceil[c] - lm.cols.floor[c]), lm.cols.ceil[c] < OPEN_CEILING ? 1 : 0);
  }
  const head = new Uint32Array([0x33443344, W, H, L, wet.length / 4]);
  const vox = lm.voxels.subarray(0, N * L);
  const bin = new Uint8Array(20 + N * L + wet.length * 4);
  bin.set(new Uint8Array(head.buffer), 0);
  bin.set(vox, 20);
  bin.set(new Uint8Array(Float32Array.from(wet).buffer), 20 + N * L);
  writeFileSync(join(dir, `${r.name}.bin`), bin);
  // Node-side CPU time of the mesh and the light (the page's build adds upload and the first frame)
  const t = new VoxelTerrain(W, H, L, vox);
  const c0 = process.cpuUsage();
  const m = meshAll(t);
  const c1 = process.cpuUsage(c0);
  const c2 = process.cpuUsage();
  skyLight(t);
  const c3 = process.cpuUsage(c2);
  let multi = 0;
  for (let i = 0; i < N; i++) if (lm.runs.count[i] > 1) multi++;
  return { W, H, quads: m.quads, wetColumns: wet.length / 4, multiRunTiles: multi, nodeMeshCpuMs: Math.round((c1.user + c1.system) / 1000), nodeLightCpuMs: Math.round((c3.user + c3.system) / 1000) };
}

async function gpus(): Promise<{ name: string; luid: string; active: boolean }[]> {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const p = await b.newPage();
  await p.goto("chrome://gpu");
  await p.waitForTimeout(1500);
  const text = (await p.evaluate(
    "(() => { const walk = (n) => { let s = ''; if (n.shadowRoot) s += walk(n.shadowRoot); n.childNodes.forEach((c) => { s += c.nodeType === 3 ? c.textContent + '\\n' : walk(c); }); return s; }; return walk(document.body); })()",
  )) as string;
  await b.close();
  const out: { name: string; luid: string; active: boolean }[] = [];
  for (const line of text.split("\n")) {
    const m = /VENDOR= 0x([0-9a-f]+), DEVICE=0x[0-9a-f]+ \[([^\]]+)\].*LUID=\{(\d+),(\d+)\}(.*)/i.exec(line);
    if (!m || m[1] === "1414") continue;
    out.push({ name: m[2], luid: `${m[3]},${m[4]}`, active: /ACTIVE/.test(m[5]) });
  }
  return out;
}

async function measure(page: Page, r: Ref, cut: number) {
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/index.html?map=${r.name}`);
  await page.waitForFunction("window.bench && (window.bench.ready || window.bench.error)", undefined, { timeout: 180_000 });
  const err = (await page.evaluate("window.bench.error")) as string | undefined;
  if (err) throw new Error(`${r.name}: ${err}`);
  const openMs = Date.now() - t0;
  const buildStats = (await page.evaluate("window.bench.build")) as Record<string, number>;
  const orbit = (await page.evaluate(`window.bench.orbit(${SECONDS * 1000})`)) as Record<string, number>;
  const info = (await page.evaluate("window.bench.info()")) as { triangles: number; calls: number };
  const cutMs = (await page.evaluate(`window.bench.setCut(${cut})`)) as number;
  const orbitCut = (await page.evaluate(`window.bench.orbit(${SECONDS * 1000})`)) as Record<string, number>;
  await page.evaluate("window.bench.setCut(null)");
  return { map: r.name, source: r.source, openMs, build: buildStats, triangles: info.triangles, calls: info.calls, orbit, cutMs, orbitCut };
}

async function main() {
  const dist = join(WORK, "dist");
  console.log("building the page…");
  await build({ configFile: false, root: join(here, "view"), base: "./", logLevel: "warn", build: { outDir: dist, emptyOutDir: true } });
  const mapsDir = join(dist, "maps");
  mkdirSync(mapsDir, { recursive: true });
  const list = refs();
  const nodeSide: Record<string, Record<string, number>> = {};
  for (const r of list) {
    nodeSide[r.name] = exportMap(r, mapsDir);
    console.log(`${r.name.padEnd(28)} ${JSON.stringify(nodeSide[r.name])}`);
  }
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".bin": "application/octet-stream", ".css": "text/css" };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const file = join(dist, decodeURIComponent(url.pathname));
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  }).listen(PORT);
  try {
    const gl = await gpus();
    const active = gl.find((g) => g.active) ?? gl[0];
    const other = gl.find((g) => g !== active);
    const DESKTOP = { width: 1600, height: 900, scale: 1 };
    const LAPTOP = { width: 1280, height: 720, scale: 1.5 };
    const configs: [string, string[], number, typeof DESKTOP][] = [["default GPU", [], 1, DESKTOP]];
    if (other) {
      configs.push([`other GPU (${other.name})`, [`--use-adapter-luid=${other.luid}`], 1, DESKTOP]);
      configs.push([`other GPU (${other.name}), CPU 4× slower, 1280×720 at 150%`, [`--use-adapter-luid=${other.luid}`], 4, LAPTOP]);
    }
    const chosen = CONFIGS ? configs.filter((_, k) => CONFIGS.includes(k + 1)) : configs;
    const runs = [];
    for (const [label, args, slow, screen] of chosen) {
      const keep = ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"];
      const browser = await chromium.launch({ channel: "chrome", headless: false, args: [...args, ...keep] });
      const page = await browser.newPage({ viewport: { width: screen.width, height: screen.height }, deviceScaleFactor: screen.scale });
      if (slow > 1) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
      }
      const gpu = (await page.evaluate(`(() => { const c = document.createElement("canvas").getContext("webgl2"); const e = c.getExtension("WEBGL_debug_renderer_info"); return String(e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)); })()`)) as string;
      console.log(`\n== ${label}: ${gpu}, CPU ${slow}× slower`);
      const results = [];
      if (SHOTS && runs.length === 0) {
        // pictures of the generated high-verticality map (our own map; nothing else is pictured)
        mkdirSync(SHOTS, { recursive: true });
        for (const r of list.filter((x) => x.source === "generated" && x.name.includes("high"))) {
          await page.goto(`http://localhost:${PORT}/index.html?map=${r.name}`);
          await page.waitForFunction("window.bench && window.bench.ready", undefined, { timeout: 180_000 });
          const S = Number(/-(\d+)-\d+$/.exec(r.name)?.[1] ?? 256);
          const poses: [string, number, number, number, number | null, [number, number, number] | null][] = [
            ["overview", 30, 45, S * 1.2, null, null],
            ["massif-face", 10, 22, S * 0.55, null, [S * 0.45, S * 0.62, 14]],
            ["gorge-bridge", 70, 28, S * 0.35, null, [S * 0.68, S * 0.75, 16]],
            ["cutaway-level-7", 30, 60, S * 0.9, 7, [S * 0.35, S * 0.45, 4]],
            ["cutaway-level-17", 20, 55, S * 0.7, 17, [S * 0.45, S * 0.65, 12]],
          ];
          for (const [label, yaw, pitch, dist, cut, target] of poses) {
            await page.evaluate(`window.bench.pose(${yaw}, ${pitch}, ${dist}, ${cut}, ${target ? JSON.stringify(target) : "undefined"})`);
            await page.screenshot({ path: join(SHOTS, `${r.name}-${label}.png`) });
          }
          await page.evaluate("window.bench.setCut(null)");
        }
      }
      for (const r of list) {
        const m = await measure(page, r, 10);
        results.push(m);
        console.log(`${r.name.padEnd(28)} build ${String(m.build.ms).padStart(5)} ms (mesh ${m.build.meshMs}, light ${m.build.lightMs}, first frame ${m.build.firstFrameMs}), ${m.triangles.toLocaleString()} tris, orbit ${m.orbit.fps.toFixed(0)} fps (p95 ${m.orbit.p95.toFixed(1)} ms), cut ${m.cutMs} ms, orbit cut ${m.orbitCut.fps.toFixed(0)} fps`);
      }
      await browser.close();
      runs.push({ label, gpu, cpuSlowdown: slow, screen, results });
    }
    const machine = { cpu: cpus()[0]?.model.trim(), threads: cpus().length, os: `${platform()} ${release()}`, gpus: gl.map((g) => g.name) };
    writeFileSync(join(WORK, "bench-mesher-full.json"), JSON.stringify({ machine, nodeSide, runs }, null, 1));
    console.log(`\nfull results in ${join(WORK, "bench-mesher-full.json")}`);
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
