// Map look captures (ROADMAP "Map look", PLAN §20 D86): the same maps from the same camera poses,
// before and after the new look, so the two can be compared, plus greyscale and colour-blind
// versions of the after captures for the readability review.
//
//   npx tsx tools/capture-look.ts --label before|after [--only riverValley,beavertopia] [--quality 80] [--dir .scratch/try]
//
// Maps: seed 4242 in every theme at 128², seed 4242 River Valley at 256², and Beavertopia (a local
// workshop map; skipped when investigation/raw is absent). Each map is opened in the editor (the
// generated ones through "Refine this map", Beavertopia through the file input), with its dam sites
// shown, and drawn from fixed poses:
//   - overview: the whole map from the south (the view's default pose before Map look);
//   - start: close to the start, from the game's default direction (30° east of north, pitched down);
//   - badwater: close to the map's badwater (its dam site when it has none), the same direction;
//   - falls: close to the map's tallest waterfall, seen from downstream, when it has one.
// Only the canvas is captured, but for one whole view of the first map from its default camera, with
// the view's buttons and legend (riverValley-128-default-ui). Our own generated maps go to docs/map-look/<label>/ (committed);
// Beavertopia to .scratch/map-look/<label>/ (never committed: the map is not ours). For every
// capture, the tool also records where to look for each map meaning: an example tile of each, its
// screen position in the capture, and whether it is in view (<label>.json beside the images).
//
// With --label after it also writes, for each capture, a greyscale version and the three
// colour-blindness simulations (Machado, Oliveira and Fernandes 2009, severity 1, in linear RGB).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { build, preview } from "vite";
import { generate } from "../src/core/gen/generate";
import { readTimber } from "../src/core/format/timber";
import { placementOf } from "../src/core/format/entities";
import { rotate, slopeHighSide, type Orientation } from "../src/core/format/footprints";
import { storedWater, surfaceOf } from "../src/core/format/world";
import { decodeSpecFragment, THEMES, THEME_NAMES, type ThemeId } from "../src/core/spec/mapspec";
import { lifeOf } from "../src/worker/api";
import type { JsonObject } from "../src/core/format/json";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LABEL = arg("label") ?? "after";
const ONLY = arg("only")?.split(",");
const QUALITY = Number(arg("quality") ?? 80);
const PORT = 4191;
const DIST = ".scratch/capture-dist";
const BEAVERTOPIA = "investigation/raw/workshop/Beavertopia - 256x256.timber";
const VIEWPORT = { width: 1280, height: 800 };

/** A map meaning, as the review names it. */
type Meaning =
  | "clean water"
  | "badwater"
  | "moist ground"
  | "dry ground"
  | "contaminated ground"
  | "living tree"
  | "dead tree"
  | "the start"
  | "slope"
  | "dam site";

interface MapData {
  id: string;
  name: string;
  W: number;
  H: number;
  heights: Uint8Array;
  depth: Float32Array;
  contamination: Float32Array;
  moisture: Float32Array;
  soil: Float32Array;
  /** Tiles with an object on them (the ground is hidden there). */
  covered: Uint8Array;
  trees: { x: number; y: number; dead: boolean; species: string }[];
  slopes: { x: number; y: number; rises: string }[];
  start: [number, number] | null;
  sha256?: string;
  open: (page: Page) => Promise<void>;
}

const DIRS: Record<string, string> = { "0,1": "north", "0,-1": "south", "1,0": "east", "-1,0": "west" };

function generated(theme: ThemeId, size: number): MapData {
  const fragment = `#s=4242&z=${size}&d=n&t=${theme}`;
  const spec = decodeSpecFragment(fragment)!.spec;
  const r = generate(spec);
  const b = r.built;
  const N = b.W * b.H;
  const covered = new Uint8Array(N);
  const trees: MapData["trees"] = [];
  const slopes: MapData["slopes"] = [];
  let start: [number, number] | null = null;
  for (const e of b.entities) {
    if (e.x >= 0 && e.y >= 0 && e.x < b.W && e.y < b.H) covered[e.y * b.W + e.x] = 1;
    const life = lifeOf(e.raw ? (e.raw.Components as Record<string, unknown>) : { ...(e.before ?? {}), ...e.components });
    if (/^(Pine|Birch|Oak)$/.test(e.template) && !life.young) trees.push({ x: e.x, y: e.y, dead: !!life.dead, species: e.template });
    if (e.template === "Slope") {
      const [dx, dy] = slopeHighSide(e.orientation as Orientation);
      slopes.push({ x: e.x, y: e.y, rises: DIRS[`${dx},${dy}`] });
    }
    if (e.template === "StartingLocation") {
      const [dx, dy] = rotate(e.orientation as Orientation, 1, 1);
      start = [e.x + dx, e.y + dy];
      for (let y = start[1] - 1; y <= start[1] + 1; y++) for (let x = start[0] - 1; x <= start[0] + 1; x++) covered[y * b.W + x] = 1;
    }
  }
  const id = `${theme}-${size}`;
  return {
    id,
    name: `${THEME_NAMES[theme]} (4242), ${size}×${size}`,
    W: b.W,
    H: b.H,
    heights: b.heights,
    depth: Float32Array.from(b.water),
    contamination: Float32Array.from(b.contamination),
    moisture: Float32Array.from(b.moisture),
    soil: Float32Array.from(b.soilContamination),
    covered,
    trees,
    slopes,
    start,
    async open(page) {
      await page.goto("about:blank");
      await page.goto(`http://localhost:${PORT}/${fragment}`);
      await page.getByText(/All \d+ checks passed/).first().waitFor({ timeout: 180_000 });
      await page.getByRole("button", { name: "Refine this map" }).click();
      await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 120_000 });
    },
  };
}

/** A soil singleton's array, the highest value over its slots per tile. */
function soilArray(singletons: JsonObject, name: string, key: string, N: number): Float32Array {
  const out = new Float32Array(N);
  const s = singletons[name] as JsonObject | undefined;
  const a = s && (s[key] as JsonObject | undefined);
  if (!a) return out;
  const t = String(a.Array).split(" ");
  if (t.length % N) return out;
  for (let k = 0; k < t.length; k++) {
    const v = Number(t[k]) || 0;
    if (v > out[k % N]) out[k % N] = v;
  }
  return out;
}

function imported(path: string, id: string, name: string): MapData {
  const file = readTimber(new Uint8Array(readFileSync(path)));
  const w = file.world;
  const W = w.sizeX;
  const H = w.sizeY;
  const N = W * H;
  const heights = surfaceOf(w);
  const water = storedWater(w.singletons, W, H);
  const depth = new Float32Array(N);
  const contamination = new Float32Array(N);
  // the surface water of each tile (the column with the highest floor)
  const floor = new Float32Array(N).fill(-1);
  for (let k = 0; k < water.tile.length; k++) {
    const i = water.tile[k];
    const f = water.floor[k] < 0 ? heights[i] : water.floor[k];
    if (f < floor[i]) continue;
    floor[i] = f;
    depth[i] = f >= heights[i] - 0.01 ? water.depth[k] : 0;
    contamination[i] = water.contamination[k];
  }
  const covered = new Uint8Array(N);
  const trees: MapData["trees"] = [];
  const slopes: MapData["slopes"] = [];
  let start: [number, number] | null = null;
  for (const e of w.entities) {
    const p = placementOf(e);
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) continue;
    covered[p.y * W + p.x] = 1;
    const life = lifeOf(e.Components as Record<string, unknown>);
    if (/^(Pine|Birch|Oak)$/.test(p.template) && !life.young) trees.push({ x: p.x, y: p.y, dead: !!life.dead, species: p.template });
    if (p.template === "Slope") {
      const [dx, dy] = slopeHighSide(p.orientation);
      slopes.push({ x: p.x, y: p.y, rises: DIRS[`${dx},${dy}`] });
    }
    if (p.template === "StartingLocation") {
      const [dx, dy] = rotate(p.orientation, 1, 1);
      start = [p.x + dx, p.y + dy];
      for (let y = start[1] - 1; y <= start[1] + 1; y++) for (let x = start[0] - 1; x <= start[0] + 1; x++) covered[y * W + x] = 1;
    }
  }
  return {
    id,
    name,
    W,
    H,
    heights,
    depth,
    contamination,
    moisture: soilArray(w.singletons, "SoilMoistureSimulator", "MoistureLevels", N),
    soil: soilArray(w.singletons, "SoilContaminationSimulator", "ContaminationLevels", N),
    covered,
    trees,
    slopes,
    start,
    async open(page) {
      await page.goto("about:blank");
      await page.goto(`http://localhost:${PORT}/#s=1&z=96&d=n&t=riverValley`);
      await page.getByText(/checks passed|checks failed/).first().waitFor({ timeout: 120_000 });
      await page.getByLabel("Open a map or a project file in the editor").setInputFiles(path);
      await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 180_000 });
    },
  };
}

// ------------------------------------------------------------------------------ meanings

type Tile = [number, number];

function examplesOf(m: MapData): Record<Meaning, Tile[]> {
  const { W, H } = m;
  const out: Record<Meaning, Tile[]> = {
    "clean water": [],
    badwater: [],
    "moist ground": [],
    "dry ground": [],
    "contaminated ground": [],
    "living tree": [],
    "dead tree": [],
    "the start": [],
    slope: [],
    "dam site": [],
  };
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const d = m.depth[i];
      if (d > 0.3 && m.contamination[i] < 0.05) out["clean water"].push([x, y]);
      else if (d > 0.1 && m.contamination[i] >= 0.5) out.badwater.push([x, y]);
      else if (d <= 0.001 && !m.covered[i]) {
        if (m.soil[i] > 0) out["contaminated ground"].push([x, y]);
        else if (m.moisture[i] > 0) out["moist ground"].push([x, y]);
        else out["dry ground"].push([x, y]);
      }
    }
  for (const t of m.trees) (t.dead ? out["dead tree"] : out["living tree"]).push([t.x, t.y]);
  for (const s of m.slopes) out.slope.push([s.x, s.y]);
  if (m.start) out["the start"].push(m.start);
  return out;
}

interface Pose {
  id: string;
  view: { mode: "orbit"; yaw: number; pitch: number; distance: number; target: [number, number, number] };
}

function mean(a: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

/** The middle of the largest group of tiles near each other (a badwater basin, say). */
function centreOf(tiles: Tile[]): Tile | null {
  if (!tiles.length) return null;
  let best: Tile = tiles[0];
  let bestN = -1;
  const step = Math.max(1, Math.floor(tiles.length / 400));
  for (let k = 0; k < tiles.length; k += step) {
    const [x, y] = tiles[k];
    let n = 0;
    for (const [a, b] of tiles) if (Math.abs(a - x) <= 8 && Math.abs(b - y) <= 8) n++;
    if (n > bestN) {
      bestN = n;
      best = [x, y];
    }
  }
  return best;
}

const GAME_YAW = -Math.PI / 6; // the game's camera looks 30° east of north
function posesOf(m: MapData, dam: Tile[]): Pose[] {
  const span = Math.max(m.W, m.H);
  const at = ([x, y]: Tile): [number, number, number] => [x + 0.5, m.heights[y * m.W + x], -(y + 0.5)];
  const poses: Pose[] = [{ id: "overview", view: { mode: "orbit", yaw: 0, pitch: 0.9, distance: span * 1.35, target: [m.W / 2, mean(m.heights), -m.H / 2] } }];
  if (m.start) poses.push({ id: "start", view: { mode: "orbit", yaw: GAME_YAW, pitch: 1.0, distance: 42, target: at(m.start) } });
  const ex = examplesOf(m);
  const bad = centreOf(ex.badwater) ?? centreOf(ex["contaminated ground"]) ?? centreOf(dam);
  if (bad) poses.push({ id: "badwater", view: { mode: "orbit", yaw: GAME_YAW, pitch: 0.95, distance: 48, target: at(bad) } });
  // the tallest waterfall (water falling a level or more to water), for its foam
  let fall: Tile | null = null;
  let toward: Tile = [0, -1];
  let best = 0.9;
  for (let y = 1; y < m.H - 1; y++)
    for (let x = 1; x < m.W - 1; x++) {
      const i = y * m.W + x;
      if (!(m.depth[i] > 0.05)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = i + dx + dy * m.W;
        if (!(m.depth[j] > 0.05)) continue;
        const drop = m.heights[i] + m.depth[i] - m.heights[j] - m.depth[j];
        if (drop > best) {
          best = drop;
          fall = [x + dx, y + dy];
          toward = [dx, dy];
        }
      }
    }
  // seen from downstream, so the fall faces the camera
  if (fall) poses.push({ id: "falls", view: { mode: "orbit", yaw: Math.atan2(toward[0], -toward[1]), pitch: 0.75, distance: 26, target: at(fall) } });
  // --at x,y,distance,pitch: one more pose, for trying things out
  const extra = arg("at")?.split(",").map(Number);
  if (extra) poses.push({ id: "at", view: { mode: "orbit", yaw: GAME_YAW, pitch: extra[3] ?? 0.9, distance: extra[2] ?? 30, target: at([extra[0], extra[1]]) } });
  return poses;
}

// ------------------------------------------------------------------------------ images

/** The page-side transform (a string, so the bundler's helpers stay out of the page). */
const VARIANTS_JS = `async ([b64, q]) => {
  const img = new Image();
  img.src = "data:image/png;base64," + b64;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, c.width, c.height);
  const table = new Float32Array(256);
  for (let k = 0; k < 256; k++) {
    const s = k / 255;
    table[k] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }
  const enc = (v) => {
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(s * 255)));
  };
  const M = {
    grey: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
    protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  };
  const res = {};
  for (const name of Object.keys(M)) {
    const m = M[name];
    const d = g.createImageData(c.width, c.height);
    const s = src.data;
    for (let k = 0; k < s.length; k += 4) {
      const r = table[s[k]];
      const gg = table[s[k + 1]];
      const b = table[s[k + 2]];
      d.data[k] = enc(m[0] * r + m[1] * gg + m[2] * b);
      d.data[k + 1] = enc(m[3] * r + m[4] * gg + m[5] * b);
      d.data[k + 2] = enc(m[6] * r + m[7] * gg + m[8] * b);
      d.data[k + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    res[name] = c.toDataURL("image/jpeg", q / 100).split(",")[1];
  }
  return res;
}`;

/** Greyscale and the three colour-blindness simulations of a PNG, as JPEGs (in the page's canvas). */
async function variants(page: Page, png: Buffer, quality: number): Promise<Record<string, Buffer>> {
  const out = (await page.evaluate(`(${VARIANTS_JS})(${JSON.stringify([png.toString("base64"), quality])})`)) as Record<string, string>;
  const buffers: Record<string, Buffer> = {};
  for (const [k, v] of Object.entries(out)) buffers[k] = Buffer.from(v, "base64");
  return buffers;
}

async function toJpeg(page: Page, png: Buffer, quality: number): Promise<Buffer> {
  const b64 = (await page.evaluate(
    async ([data, q]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", q / 100).split(",")[1];
    },
    [png.toString("base64"), quality] as [string, number],
  )) as string;
  return Buffer.from(b64, "base64");
}

// ------------------------------------------------------------------------------ capture

interface Shot {
  map: string;
  name: string;
  pose: string;
  file: string;
  variants: string[];
  size: [number, number];
  view: Pose["view"];
  /** For each meaning: example tiles in view, with their screen position in the capture (px). */
  where: Partial<Record<Meaning, { tile: Tile; screen: [number, number] }[]>>;
  notes: string[];
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.dgmEditor!.idle());
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

async function captureMap(page: Page, tool: Page, m: MapData, dir: string): Promise<Shot[]> {
  console.log(`${m.name}: opening`);
  await m.open(page);
  await page.mouse.move(2, 2);
  // nothing selected, and only the scene: the view's buttons, the inspector and the handles hidden
  await page.keyboard.press("Escape");
  // show the dam sites (the editor's Water tab)
  await page.getByRole("tab", { name: "Water" }).click();
  if (!process.argv.includes("--no-dams")) await page.getByLabel("Show dam sites").check();
  await page.waitForTimeout(300);
  await settle(page);
  const sites = (await page.evaluate(() => window.dgmEditor!.worker.damSites())) as { sites: { tiles: Tile[] }[] };
  const dam: Tile[] = sites.sites.flatMap((s) => s.tiles);
  // wait for the background check (it may replace the water once)
  await page.waitForTimeout(2500);
  await settle(page);
  // a fixed moment of the water's movement, where the view animates it
  await page.evaluate(() => {
    const r = window.dgm3d!.renderer as unknown as { setClock?: (t: number | null) => void };
    r.setClock?.(12.5);
  });
  const shots: Shot[] = [];
  // the first map: the whole view as the page shows it, from its default camera (with the legend)
  if (m.id === "riverValley-128") {
    await page.evaluate(() => window.dgm3d!.renderer.resetView());
    await settle(page);
    await page.waitForTimeout(250);
    const png = await page.locator(".editor-view").screenshot({ type: "png" });
    const file = `${m.id}-default-ui.jpg`;
    writeFileSync(join(dir, file), await toJpeg(tool, png, QUALITY));
    const view = (await page.evaluate(() => window.dgm3d!.renderer.getView())) as Pose["view"];
    shots.push({ map: m.id, name: m.name, pose: "default-ui", file, variants: [], size: [0, 0], view, where: {}, notes: ["the page's own view: its default camera, buttons and legend"] });
    console.log(`  ${file}`);
  }
  // then only the scene: the view's buttons, the inspector and the handles hidden
  await page.addStyleTag({ content: ".view3d > :not(canvas), .editor-map > :not(.view3d) { visibility: hidden !important; }" });
  const ex = examplesOf(m);
  ex["dam site"] = dam;
  const poses = posesOf(m, dam);
  const canvas = page.locator(".editor-view canvas");
  for (const pose of poses) {
    await page.evaluate((v) => window.dgm3d!.renderer.setView(v), pose.view);
    await settle(page);
    await page.waitForTimeout(250);
    const png = await canvas.screenshot({ type: "png" });
    const box = (await canvas.boundingBox())!;
    const file = `${m.id}-${pose.id}.jpg`;
    writeFileSync(join(dir, file), await toJpeg(tool, png, QUALITY));
    const vs: string[] = [];
    if (LABEL === "after") {
      const v = await variants(tool, png, QUALITY);
      for (const [k, buf] of Object.entries(v)) {
        const f = `${m.id}-${pose.id}-${k}.jpg`;
        writeFileSync(join(dir, f), buf);
        vs.push(f);
      }
    }
    // where each meaning is: the example tiles nearest the pose's target that are in view
    const where: Shot["where"] = {};
    const [tx, , tz] = pose.view.target;
    for (const [meaning, tiles] of Object.entries(ex) as [Meaning, Tile[]][]) {
      if (!tiles.length) continue;
      const sorted = [...tiles].sort((a, b) => Math.hypot(a[0] + 0.5 - tx, -(a[1] + 0.5) - tz) - Math.hypot(b[0] + 0.5 - tx, -(b[1] + 0.5) - tz)).slice(0, 400);
      const pts = (await page.evaluate(
        ({ list, left, top }) =>
          list.map(([x, y]) => {
            const c = window.dgm3d!.renderer.tileToClient(x, y);
            return [c.x - left, c.y - top, c.visible ? 1 : 0];
          }),
        { list: sorted, left: box.x, top: box.y },
      )) as [number, number, number][];
      const found: { tile: Tile; screen: [number, number] }[] = [];
      for (let k = 0; k < sorted.length && found.length < 3; k++) {
        const [px, py, vis] = pts[k];
        if (!vis || px < 8 || py < 8 || px > box.width - 8 || py > box.height - 8) continue;
        // spread the examples out a little
        if (found.some((f) => Math.hypot(f.screen[0] - px, f.screen[1] - py) < 24)) continue;
        found.push({ tile: sorted[k], screen: [Math.round(px), Math.round(py)] });
      }
      if (found.length) where[meaning] = found;
    }
    const notes: string[] = [];
    if (where.slope) for (const s of where.slope) notes.push(`slope at (${s.tile[0]}, ${s.tile[1]}) rises toward the ${m.slopes.find((q) => q.x === s.tile[0] && q.y === s.tile[1])?.rises}`);
    shots.push({ map: m.id, name: m.name, pose: pose.id, file, variants: vs, size: [Math.round(box.width), Math.round(box.height)], view: pose.view, where, notes });
    console.log(`  ${file}: ${Object.keys(where).length} meanings in view`);
  }
  return shots;
}

async function main() {
  const maps: (() => MapData)[] = [];
  for (const t of THEMES) maps.push(() => generated(t, 128));
  maps.push(() => generated("riverValley", 256));
  if (existsSync(BEAVERTOPIA)) maps.push(() => imported(BEAVERTOPIA, "beavertopia-256", "Beavertopia, 256×256 (workshop map, local only)"));
  process.env.DGM_BASE = "/";
  console.log("building the site…");
  await build({ configFile: "vite.config.ts", base: "/", logLevel: "warn", build: { outDir: DIST, emptyOutDir: true } });
  const server = await preview({ configFile: "vite.config.ts", base: "/", build: { outDir: DIST }, preview: { port: PORT, strictPort: true }, logLevel: "warn" });
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: "light" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 400)));
    const tool = await browser.newPage();
    await tool.goto(`http://localhost:${PORT}/`);
    // --dir puts everything in one folder (trial runs)
    const committed = arg("dir") ?? join("docs/map-look", LABEL);
    const local = arg("dir") ?? join(".scratch/map-look", LABEL);
    mkdirSync(committed, { recursive: true });
    mkdirSync(local, { recursive: true });
    const all: Shot[] = [];
    for (const make of maps) {
      const m = make();
      if (ONLY && !ONLY.some((o) => m.id.startsWith(o))) continue;
      const dir = m.id.startsWith("beavertopia") ? local : committed;
      const shots = await captureMap(page, tool, m, dir);
      for (const s of shots) all.push({ ...s, file: join(dir, s.file).replace(/\\/g, "/"), variants: s.variants.map((v) => join(dir, v).replace(/\\/g, "/")) });
    }
    const json = join(committed, `${LABEL}.json`);
    const old = existsSync(json) && ONLY ? (JSON.parse(readFileSync(json, "utf8")) as { shots: Shot[] }).shots.filter((s) => !all.some((a) => a.file === s.file)) : [];
    writeFileSync(json, JSON.stringify({ label: LABEL, date: new Date().toISOString().slice(0, 10), viewport: VIEWPORT, shots: [...old, ...all] }, null, 1) + "\n");
    console.log(`wrote ${all.length} captures and ${json}`);
    if (errors.length) console.log(`page errors: ${errors.join("; ")}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
