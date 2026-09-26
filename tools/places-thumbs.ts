// The Real places card pictures (Kyler, 2026-09-25): each place drawn by the Map look 3D view, the
// clean look, as an angled overview of the whole map, at twice the card's size (480 px square),
// saved as WebP. They are rendered on this machine's GPU, in the installed Chrome, headed (CI has
// no GPU, and a browser that draws in software gets the light look), and committed.
//
//   npm run places:thumbs                   (the places whose picture does not show the current map)
//   npm run places:thumbs -- --all          (every place)
//   npm run places:thumbs -- --only a,b     (the places named)
//   npm run places:thumbs -- --dir <dir>    (write there instead, and leave the index alone: trials)
//
// Each place opens in the editor as the gallery's Refine opens it (its .timber, built by
// tools/places-build.ts), in a fresh browser context. The camera stands on the low side of the land
// and looks toward the high side, so valleys and water are in front and the heights behind them; a
// map without a clear rise is seen from the game's own direction. It stands as near as it can while
// the map fills the picture, only the tips of its corners cut. The water is held at one moment of
// its movement. The picture is drawn at 960 px and scaled down, then written to
// public/real-places/cards/<id>.webp; the index records the sha256 of the .timber it shows
// (imageFrom), so a map the engine changes is seen to need a new picture (the contract test).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { build, preview } from "vite";
import type { PlaceIndex, PlaceIndexEntry } from "../src/core/places/place";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const PUBLIC = "public/real-places";
const DIST = ".scratch/thumbs-dist";
const PORT = Number(arg("port") ?? 4193);
/** The picture's side: twice the card's 240 px. */
const SIDE = 480;
/** Drawn at twice that, then scaled down. */
const DRAWN = SIDE * 2;
const QUALITY = Number(arg("quality") ?? 0.8);
const GAME_YAW = -Math.PI / 6;
const PITCH = Number(arg("pitch") ?? 0.72);
/** The view's vertical field of view, in degrees (src/render3d/renderer.ts). */
const FOV = 40;
/** Where the map's corners may reach, from the picture's centre to its side (1): a little past it,
 *  so the land fills the picture and only the corners' tips are cut. */
const MARGIN = Number(arg("margin") ?? 1.08);

interface Pose {
  mode: "orbit";
  yaw: number;
  pitch: number;
  distance: number;
  target: [number, number, number];
}

/** The camera for a map: on the low side, looking toward the high side, over the whole map. The
 *  land's level and rise leave out a band along the edges, where a map may be walled. */
function poseOf(W: number, H: number, heights: number[]): Pose {
  const n = W * H;
  const EDGE = 4;
  let inner = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const x = i % W;
    const y = Math.floor(i / W);
    if (x >= EDGE && y >= EDGE && x < W - EDGE && y < H - EDGE) {
      inner += heights[i];
      count++;
    }
  }
  const level = inner / count;
  let hx = 0;
  let hy = 0;
  let hw = 0;
  let lx = 0;
  let ly = 0;
  let lw = 0;
  for (let i = 0; i < n; i++) {
    const x = (i % W) + 0.5;
    const y = Math.floor(i / W) + 0.5;
    if (x < EDGE || y < EDGE || x > W - EDGE || y > H - EDGE) continue;
    const d = heights[i] - level;
    if (d > 0) {
      hx += x * d;
      hy += y * d;
      hw += d;
    } else if (d < 0) {
      lx -= x * d;
      ly -= y * d;
      lw -= d;
    }
  }
  const span = Math.max(W, H);
  let yaw = GAME_YAW;
  if (hw > 0 && lw > 0) {
    const vx = hx / hw - lx / lw;
    const vy = hy / hw - ly / lw;
    // yaw 0 stands south of the target, looking north (tile y grows northward)
    if (Math.hypot(vx, vy) > span * 0.06) yaw = Math.atan2(-vx, vy);
  }
  return fit(W, H, level, yaw, PITCH);
}

/** The camera that shows the map's corners, at its mean level, as large as the square picture
 *  allows (reaching MARGIN), looking at the map's centre (the view's 40° field, as
 *  src/render3d/renderer.ts places its camera). The near side, drawn larger, sits lower in the
 *  picture, with the sky above the far side. */
function fit(W: number, H: number, level: number, yaw: number, pitch: number): Pose {
  const tan = Math.tan((FOV / 2) * (Math.PI / 180));
  const target: V3 = [W / 2, level, -H / 2];
  const corners: V3[] = [];
  for (const x of [0, W]) for (const z of [0, -H]) corners.push([x, level, z]);
  const fits = (d: number) => {
    const cp = Math.cos(pitch);
    const cam: V3 = [target[0] + Math.sin(yaw) * cp * d, target[1] + Math.sin(pitch) * d, target[2] + Math.cos(yaw) * cp * d];
    const f = norm([target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]]);
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    return corners.every((c) => {
      const v = [c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]];
      const depth = dot(v, f);
      return depth > 0 && Math.abs(dot(v, r) / (depth * tan)) <= MARGIN && Math.abs(dot(v, u) / (depth * tan)) <= MARGIN;
    });
  };
  let a = Math.max(W, H) * 0.3;
  let b = Math.max(W, H) * 4;
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2;
    if (fits(m)) b = m;
    else a = m;
  }
  return { mode: "orbit", yaw, pitch, distance: b, target };
}

type V3 = [number, number, number];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

async function render(browser: Browser, base: string, p: PlaceIndexEntry): Promise<{ webp: Buffer; pose: Pose; gpu: string }> {
  const ctx = await browser.newContext({ viewport: { width: DRAWN + 40, height: DRAWN + 40 }, deviceScaleFactor: 1, colorScheme: "light" });
  try {
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}#place=${p.id}`);
    await page.waitForFunction((name) => window.dgmEditor?.info().name === name && !!window.dgm3d, p.name, { timeout: 180_000 });
    await page.evaluate(() => window.dgmEditor!.idle());
    // the background check may replace the water once
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.dgmEditor!.idle());
    // only the scene, on a square canvas
    await page.addStyleTag({
      content: `.editor-view { position: fixed !important; left: 0 !important; top: 0 !important; width: ${DRAWN}px !important; height: ${DRAWN}px !important; z-index: 2147483647 !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; }
        .editor-view > :not(canvas) { visibility: hidden !important; }
        .editor-view canvas { width: ${DRAWN}px !important; height: ${DRAWN}px !important; }`,
    });
    await page.mouse.move(DRAWN + 30, DRAWN + 30);
    // (the renderer's map is private to it: read loosely, as tools/capture-look.ts does)
    const view = (await page.evaluate(() => {
      const m = (window.dgm3d!.renderer as unknown as { map: { W: number; H: number; heights: ArrayLike<number> } }).map;
      return { W: m.W, H: m.H, heights: Array.from(m.heights) };
    })) as { W: number; H: number; heights: number[] };
    const pose = poseOf(view.W, view.H, view.heights);
    const gpu = (await page.evaluate(() => window.dgm3d!.renderer.gpu().renderer)) as string;
    if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) throw new Error(`Chrome draws in software (${gpu}): the pictures need the GPU`);
    await page.evaluate((v) => {
      const r = window.dgm3d!.renderer as unknown as { setView(v: unknown): void; setClock?(t: number | null): void };
      r.setClock?.(12.5);
      r.setView(v);
    }, pose);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200)))));
    const png = await page.locator(".editor-view canvas").screenshot({ type: "png" });
    // scaled down to the picture's side, then WebP
    const b64 = (await page.evaluate(
      async ([data, side, q]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = side;
        c.height = side;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, side, side);
        return c.toDataURL("image/webp", q).split(",")[1];
      },
      [png.toString("base64"), SIDE, QUALITY] as [string, number, number],
    )) as string;
    if (errors.length) throw new Error(`${p.name}: page errors: ${errors.join("; ")}`);
    return { webp: Buffer.from(b64, "base64"), pose, gpu };
  } finally {
    await ctx.close();
  }
}

async function main(): Promise<void> {
  const indexPath = join(PUBLIC, "index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as PlaceIndex;
  const only = arg("only")?.split(",");
  const dir = arg("dir");
  const places = index.places.filter((p) =>
    only ? only.includes(p.id) : process.argv.includes("--all") || p.imageFrom !== p.sha256 || !existsSync(join(PUBLIC, p.image)),
  );
  if (only && places.length !== only.length) throw new Error(`no place called ${only.filter((id) => !places.some((p) => p.id === id)).join(", ")}`);
  if (!places.length) {
    console.log("every card picture shows its current map");
    return;
  }
  console.log(`${places.length} picture(s) to render; building the site and the maps…`);
  await build({ configFile: "vite.config.ts", base: "/", logLevel: "warn", build: { outDir: DIST, emptyOutDir: true } });
  execFileSync(process.execPath, [...process.execArgv, "tools/places-build.ts", "--out", DIST, "--only", places.map((p) => p.id).join(",")], { stdio: "inherit" });
  const server = await preview({ configFile: "vite.config.ts", base: "/", build: { outDir: DIST }, preview: { port: PORT, strictPort: true }, logLevel: "warn" });
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--ignore-gpu-blocklist"] });
  const out = dir ?? PUBLIC;
  mkdirSync(join(out, "cards"), { recursive: true });
  const t0 = performance.now();
  let total = 0;
  try {
    for (const p of places) {
      const t = performance.now();
      const r = await render(browser, `http://localhost:${PORT}/`, p);
      writeFileSync(join(out, p.image), r.webp);
      total += r.webp.length;
      if (!dir) p.imageFrom = p.sha256;
      console.log(`${p.size}² ${((performance.now() - t) / 1000).toFixed(1).padStart(5)} s  ${(r.webp.length / 1024).toFixed(1).padStart(5)} KB  yaw ${((r.pose.yaw * 180) / Math.PI).toFixed(0).padStart(4)}°  ${p.name}${p === places[0] ? `  (${r.gpu})` : ""}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (!dir) writeFileSync(indexPath, JSON.stringify(index, null, 1) + "\n");
  console.log(`${places.length} picture(s) in ${((performance.now() - t0) / 1000).toFixed(0)} s, ${(total / 1024).toFixed(0)} KB (${(total / 1024 / places.length).toFixed(1)} KB each), in ${join(out, "cards")}${dir ? "" : "; the index records the map each shows"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
