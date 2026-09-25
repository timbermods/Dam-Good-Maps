// Map look captures (ROADMAP "Map look", PLAN §20 D86, D110 and D114): the same maps from the same
// camera poses, before and after the new look, so the two can be compared, plus greyscale and
// colour-blind versions of the after captures for the readability review.
//
//   npx tsx tools/capture-look.ts --label before|after [--only riverValley,beavertopia] [--quality 80] [--dir .scratch/try]
//
// Maps: seed 4242 in every theme at 128², seed 4242 River Valley at 256², and Beavertopia (a local
// workshop map; skipped when investigation/raw is absent). Each map is opened in the editor (the
// generated ones through "Refine this map", Beavertopia through the file input), with its dam sites
// shown, and drawn from fixed poses:
//   - overview: the whole map from the south (the view's default pose before Map look);
//   - start: close to the start, from the game's default direction (30° east of north, pitched down);
//   - badwater: close to where the map's badwater meets clean water (else its badwater, else its
//     dam site), the same direction;
//   - falls: close to the map's tallest waterfall, seen from downstream, when it has one.
// The after run takes each pose's camera from the before run's record, so the two match exactly.
// Only the canvas is captured, but for one whole view of the first map from its default camera, with
// the view's buttons and legend (riverValley-128-default-ui). Our own generated maps go to docs/map-look/<label>/ (committed);
// Beavertopia to .scratch/map-look/<label>/ (never committed: the map is not ours).
//
// For every capture, the tool also records where to look for each map meaning (<label>.json beside
// the images): example tiles, their screen position in the capture, and what they show. The
// meanings come from what the view draws (the renderer's own heights, water, soil of each tile's
// top, and objects), not from a separate reading of the map. Each position is the visible point:
// the water's surface, the middle of a tree or a ruin, the start as it is drawn from that distance.
// Ground and water examples are tiles inside an area of their kind (their eight neighbours alike),
// away from objects that could stand in front, and each is checked by picking the tile under its
// position in the view: an example whose pick lands on another kind is dropped.
//
// With --label after it also writes, for each capture, a greyscale version and the three
// colour-blindness simulations (Machado, Oliveira and Fernandes 2009, severity 1, in linear RGB).
// --doc writes docs/map-look/captures.md from the two runs' records.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { build, preview } from "vite";
import { FOOTPRINTS, footprintTiles, rotate, slopeHighSide, type Orientation } from "../src/core/format/footprints";
import { THEMES, THEME_NAMES, type ThemeId } from "../src/core/spec/mapspec";
import { plantPlacement } from "../src/render3d/entities3d";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LABEL = arg("label") ?? "after";
const ONLY = arg("only")?.split(",");
const QUALITY = Number(arg("quality") ?? 80);
/** The greyscale and colour-blind versions: a little more compressed (they are many). */
const VARIANT_QUALITY = Math.min(QUALITY, 62);
const PORT = 4191;
const DIST = ".scratch/capture-dist";
const BEAVERTOPIA = "investigation/raw/workshop/Beavertopia - 256x256.timber";
const VIEWPORT = { width: 1280, height: 800 };
const DEAD = 1;
const YOUNG = 4;

/** A map meaning, as the review names it. */
type Meaning =
  | "clean water"
  | "badwater"
  | "water partly bad"
  | "badwater meets clean water"
  | "moist ground"
  | "dry ground"
  | "contaminated ground"
  | "contaminated beside moist ground"
  | "living tree"
  | "dead tree"
  | "ruin"
  | "the start"
  | "slope"
  | "dam site"
  | "tall cliff";

const MEANINGS: Meaning[] = [
  "clean water",
  "badwater",
  "water partly bad",
  "badwater meets clean water",
  "moist ground",
  "dry ground",
  "contaminated ground",
  "contaminated beside moist ground",
  "living tree",
  "dead tree",
  "ruin",
  "the start",
  "slope",
  "dam site",
  "tall cliff",
];

interface MapSource {
  id: string;
  name: string;
  open: (page: Page) => Promise<void>;
}

function generated(theme: ThemeId, size: number): MapSource {
  const fragment = `#s=4242&z=${size}&d=n&t=${theme}`;
  return {
    id: `${theme}-${size}`,
    name: `${THEME_NAMES[theme]} (4242), ${size}×${size}`,
    async open(page) {
      await page.goto("about:blank");
      await page.goto(`http://localhost:${PORT}/${fragment}`);
      await page.getByText(/All \d+ checks passed/).first().waitFor({ timeout: 180_000 });
      await page.getByRole("button", { name: "Refine this map" }).click();
      await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 120_000 });
    },
  };
}

function imported(path: string, id: string, name: string): MapSource {
  return {
    id,
    name,
    async open(page) {
      await page.goto("about:blank");
      await page.goto(`http://localhost:${PORT}/#s=1&z=96&d=n&t=riverValley`);
      await page.getByText(/checks passed|checks failed/).first().waitFor({ timeout: 120_000 });
      await page.getByLabel("Open a map or a project file in the editor").setInputFiles(path);
      await page.waitForFunction(() => !!window.dgmEditor && !!window.dgm3d, null, { timeout: 180_000 });
    },
  };
}

// ------------------------------------------------------------------------------ what the view draws

/** The renderer's own state: heights, the water on each tile's top, the soil of each tile's top
 *  and the objects (read from the page, so the examples are what the view draws). */
interface ViewData {
  W: number;
  H: number;
  heights: number[];
  /** The water's surface on the tile's top (-1: none there; water in a cave under the top is none). */
  surface: number[];
  depth: number[];
  cont: number[];
  moisture: number[];
  soilC: number[];
  ent: { template: string[]; x: number[]; y: number[]; z: number[]; flags: number[]; orientation: number[] };
}

const READ_VIEW_JS = `() => {
  const m = window.dgm3d.renderer.map;
  const e = m.entities;
  const s = m.surface;
  const N = m.W * m.H;
  const surface = new Array(N);
  const depth = new Array(N);
  const cont = new Array(N);
  for (let i = 0; i < N; i++) {
    const top = s.surface[i] === s.surface[i] && s.floor[i] >= m.heights[i] - 0.01;
    surface[i] = top ? s.surface[i] : -1;
    depth[i] = top ? s.depth[i] : 0;
    cont[i] = top ? s.contamination[i] : 0;
  }
  const template = [];
  for (let k = 0; k < e.count; k++) template.push(e.templates[e.template[k]]);
  return JSON.stringify({
    W: m.W, H: m.H, heights: Array.from(m.heights), surface, depth, cont,
    moisture: m.soil ? Array.from(m.soil.moisture) : new Array(N).fill(0),
    soilC: m.soil ? Array.from(m.soil.contamination) : new Array(N).fill(0),
    ent: { template, x: Array.from(e.x).slice(0, e.count), y: Array.from(e.y).slice(0, e.count), z: Array.from(e.z).slice(0, e.count), flags: Array.from(e.flags).slice(0, e.count), orientation: Array.from(e.orientation).slice(0, e.count) },
  });
}`;

const ORIENTATIONS: Orientation[] = ["Cw0", "Cw90", "Cw180", "Cw270"];
type Tile = [number, number];

/** A point to show: the tile, the world point, its minimum size on screen (px per unit, 0 for
 *  none: the object shader's growth) and how far its visible middle is above the point per unit
 *  of growth; and what it shows (a note for the doc). */
interface Candidate {
  tile: Tile;
  point: [number, number, number];
  grow: number;
  rise: number;
  /** The most it grows (the object shader's cap). */
  cap?: number;
  note?: string;
}

/** A tile's kind as the view draws its top. */
type Kind = "clean" | "bad" | "partly" | "moist" | "dry" | "contaminated";

function candidatesOf(v: ViewData, dam: Tile[]): { cands: Record<Meaning, Candidate[]>; kind: (x: number, y: number) => Kind | null; covered: Uint8Array; tall: Uint8Array } {
  const { W, H } = v;
  const N = W * H;
  const h = (x: number, y: number) => v.heights[y * W + x];
  const kindAt = (x: number, y: number): Kind | null => {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const i = y * W + x;
    if (v.surface[i] >= 0) {
      const c = v.cont[i];
      return c >= 0.95 ? "bad" : c < 0.05 ? "clean" : "partly";
    }
    if (v.soilC[i] > 0) return "contaminated";
    return v.moisture[i] > 0 ? "moist" : "dry";
  };
  // tiles an object stands on, tiles a standing object stands on (`tall`: not the flat pits and
  // springs of sources and mine sites, nor a slope's ramp), and tiles near one (it could stand in
  // front)
  const covered = new Uint8Array(N);
  const tall = new Uint8Array(N);
  const near = new Uint8Array(N);
  const e = v.ent;
  for (let k = 0; k < e.template.length; k++) {
    const t = e.template[k];
    const p = { template: t, x: e.x[k], y: e.y[k], z: e.z[k], orientation: ORIENTATIONS[e.orientation[k]], flipped: false };
    const tiles: Tile[] = FOOTPRINTS[t] ? footprintTiles(t, p) : [[p.x, p.y]];
    const flat = /^(WaterSource|BadwaterSource|UndergroundRuins|Slope)$/.test(t);
    for (const [x, y] of tiles) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      covered[y * W + x] = 1;
      if (flat) continue;
      tall[y * W + x] = 1;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1;
        }
    }
  }
  const cands = Object.fromEntries(MEANINGS.map((m) => [m, [] as Candidate[]])) as Record<Meaning, Candidate[]>;
  const top = (x: number, y: number): [number, number, number] => {
    const i = y * W + x;
    return [x + 0.5, v.surface[i] >= 0 ? v.surface[i] : v.heights[i], -(y + 0.5)];
  };
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const k = kindAt(x, y)!;
      // inside an area of its kind: the eight neighbours alike (ground: at the same height too)
      let inside = true;
      for (let dy = -1; dy <= 1 && inside; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (kindAt(x + dx, y + dy) !== k || (k !== "clean" && k !== "bad" && k !== "partly" && h(x + dx, y + dy) !== h(x, y))) {
            inside = false;
            break;
          }
        }
      const four: Tile[] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      if (k === "clean" && inside && v.depth[i] >= 0.25 && !near[i] && !covered[i]) cands["clean water"].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
      if (k === "bad" && inside && v.depth[i] >= 0.1 && !near[i] && !covered[i]) cands.badwater.push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
      if (k === "partly" && v.cont[i] >= 0.15 && v.cont[i] <= 0.85 && four.every(([a, b]) => v.surface[b * W + a] >= 0) && !near[i] && !covered[i])
        cands["water partly bad"].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0, note: `${Math.round(v.cont[i] * 100)}% bad` });
      if (k === "bad" && four.some(([a, b]) => kindAt(a, b) === "clean") && !near[i] && !covered[i]) cands["badwater meets clean water"].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
      if ((k === "moist" || k === "dry" || k === "contaminated") && inside && !covered[i] && !near[i]) cands[`${k} ground` as Meaning].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
      if (k === "contaminated" && !covered[i] && !near[i] && four.some(([a, b]) => kindAt(a, b) === "moist" && h(a, b) === h(x, y)))
        cands["contaminated beside moist ground"].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
      // a tall cliff: a wall three levels or more, facing south or west (toward the cameras)
      for (const [dx, dy, px, pz] of [[0, -1, x + 0.5, -y], [-1, 0, x, -(y + 0.5)]] as const) {
        const drop = h(x, y) - h(x + dx, y + dy);
        if (drop >= 3 && !near[(y + dy) * W + x + dx]) cands["tall cliff"].push({ tile: [x, y], point: [px, (h(x, y) + h(x + dx, y + dy)) / 2, pz], grow: 0, rise: 0, note: `${drop} levels, facing ${dy ? "south" : "west"}` });
      }
    }
  for (let k = 0; k < e.template.length; k++) {
    const t = e.template[k];
    const x = e.x[k];
    const y = e.y[k];
    const z = e.z[k];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = ORIENTATIONS[e.orientation[k]];
    if (/^(Pine|Birch|Oak)$/.test(t) && !(e.flags[k] & YOUNG)) {
      // where the view stands it (a little off the tile's middle), at the middle of its crown
      const dead = !!(e.flags[k] & DEAD);
      const p = plantPlacement(x, y, e.flags[k]);
      cands[dead ? "dead tree" : "living tree"].push({ tile: [x, y], point: [x + 0.5 + p.dx, z, -(y + 0.5 + p.dy)], grow: dead ? 16 : 0, rise: 0.9 * p.scale, cap: 4, note: t });
    }
    const ruin = /^RuinColumnH(\d)$/.exec(t);
    if (ruin) cands.ruin.push({ tile: [x, y], point: [x + 0.5, z + Number(ruin[1]) / 2, -(y + 0.5)], grow: 0, rise: 0, note: `${ruin[1]} high` });
    if (t === "Slope") {
      const [dx, dy] = slopeHighSide(o);
      const dir = dx ? (dx > 0 ? "east" : "west") : dy > 0 ? "north" : "south";
      cands.slope.push({ tile: [x, y], point: [x + 0.5, z + 0.5, -(y + 0.5)], grow: 30, rise: 0.6, cap: 5, note: `rises toward the ${dir}` });
    }
    if (t === "StartingLocation") {
      const [dx, dy] = rotate(o, 1, 1);
      cands["the start"].push({ tile: [x + dx, y + dy], point: [x + dx + 0.5, z, -(y + dy + 0.5)], grow: 14, rise: 0.9 });
    }
  }
  // dam sites: tiles inside a straight run of the line first (its middle is all light there)
  const onDam = new Set(dam.map(([x, y]) => y * W + x));
  const straight = (x: number, y: number) => (onDam.has(y * W + x - 1) && onDam.has(y * W + x + 1)) || (onDam.has((y - 1) * W + x) && onDam.has((y + 1) * W + x));
  const inMap = ([x, y]: Tile) => x >= 0 && y >= 0 && x < W && y < H && !near[y * W + x];
  for (const [x, y] of [...dam.filter(([x, y]) => straight(x, y)), ...dam.filter(([x, y]) => !straight(x, y))].filter(inMap)) cands["dam site"].push({ tile: [x, y], point: top(x, y), grow: 0, rise: 0 });
  // objects the start (drawn larger from afar) or a ruin could stand in front of are left out
  const start = cands["the start"][0]?.tile;
  const ruins = cands.ruin.map((c) => c.tile);
  for (const m of ["living tree", "dead tree", "slope"] as Meaning[])
    cands[m] = cands[m].filter((c) => !(start && Math.hypot(c.tile[0] - start[0], c.tile[1] - start[1]) < 7) && !ruins.some(([a, b]) => Math.abs(a - c.tile[0]) <= 1 && Math.abs(b - c.tile[1]) <= 2));
  return { cands, kind: kindAt, covered, tall };
}

/** Where points are on screen: [x, y, visible, picked tile x, picked tile y] in client pixels. The
 *  point rises by `rise` for each time the object grows from afar (as the object shader does). */
const PROJECT_JS = `(pts) => {
  const r = window.dgm3d.renderer;
  const v = r.getView();
  const rx = Math.cos(v.yaw);
  const rz = -Math.sin(v.yaw);
  const box = r.canvas.getBoundingClientRect();
  return pts.map((q) => {
    const a = r.project(q[0], q[1], q[2]);
    const b = r.project(q[0] + rx, q[1], q[2] + rz);
    const ppu = Math.max(0.001, Math.hypot(b.x - a.x, b.y - a.y));
    const k = q[3] > 0 ? Math.min(q[5], Math.max(1, q[3] / ppu)) : 1;
    const c = r.project(q[0], q[1] + q[4] * k, q[2]);
    const hit = r.pick(c.x + box.left, c.y + box.top);
    return [c.x, c.y, c.visible ? 1 : 0, hit ? hit.x : -1, hit ? hit.y : -1];
  });
}`;

// ------------------------------------------------------------------------------ poses

interface Pose {
  id: string;
  view: { mode: "orbit"; yaw: number; pitch: number; distance: number; target: [number, number, number] };
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
/** The poses of a map: the before run's, when it recorded them (so before and after match), else
 *  worked out from the map as the before run did. */
function posesOf(id: string, v: ViewData, dam: Tile[], before: Shot[]): Pose[] {
  const recorded = before.filter((s) => s.map === id && s.pose !== "default-ui");
  if (recorded.length && LABEL === "after") return recorded.map((s) => ({ id: s.pose, view: s.view }));
  const { W, H } = v;
  const span = Math.max(W, H);
  const mean = v.heights.reduce((a, b) => a + b, 0) / v.heights.length;
  const at = ([x, y]: Tile): [number, number, number] => [x + 0.5, v.heights[y * W + x], -(y + 0.5)];
  const poses: Pose[] = [{ id: "overview", view: { mode: "orbit", yaw: 0, pitch: 0.9, distance: span * 1.35, target: [W / 2, mean, -H / 2] } }];
  const { cands } = candidatesOf(v, dam);
  const start = cands["the start"][0]?.tile;
  if (start) poses.push({ id: "start", view: { mode: "orbit", yaw: GAME_YAW, pitch: 1.0, distance: 42, target: at(start) } });
  const meets: Tile[] = [];
  const bad: Tile[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!(v.depth[i] > 0.1)) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    if (v.cont[i] >= 0.5) bad.push([x, y]);
    if ((v.cont[i] >= 0.05 && v.cont[i] < 0.5) || (v.cont[i] >= 0.5 && [i + 1, i - 1, i + W, i - W].some((j) => v.depth[j] > 0.1 && v.cont[j] < 0.05))) meets.push([x, y]);
  }
  const target = centreOf(meets) ?? centreOf(bad) ?? centreOf(cands["contaminated ground"].map((c) => c.tile)) ?? centreOf(dam);
  if (target) poses.push({ id: "badwater", view: { mode: "orbit", yaw: GAME_YAW, pitch: 0.95, distance: 48, target: at(target) } });
  // the tallest waterfall (water falling a level or more to water), seen from downstream
  let fall: Tile | null = null;
  let toward: Tile = [0, -1];
  let best = 0.9;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!(v.depth[i] > 0.05)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = i + dx + dy * W;
        if (!(v.depth[j] > 0.05)) continue;
        const drop = v.surface[i] - v.surface[j];
        if (drop > best) {
          best = drop;
          fall = [x + dx, y + dy];
          toward = [dx, dy];
        }
      }
    }
  if (fall) poses.push({ id: "falls", view: { mode: "orbit", yaw: Math.atan2(toward[0], -toward[1]), pitch: 0.75, distance: 26, target: at(fall) } });
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

interface Where {
  tile: Tile;
  screen: [number, number];
  note?: string;
}

interface Shot {
  map: string;
  name: string;
  pose: string;
  file: string;
  variants: string[];
  size: [number, number];
  view: Pose["view"];
  /** For each meaning: example tiles in view, with their screen position in the capture (px). */
  where: Partial<Record<Meaning, Where[]>>;
  notes: string[];
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.dgmEditor!.idle());
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

/** Kinds a picked tile may have for an example of each meaning to count as seen. */
const SEEN_AS: Partial<Record<Meaning, Kind[]>> = {
  "clean water": ["clean"],
  badwater: ["bad"],
  "water partly bad": ["partly", "bad", "clean"],
  "badwater meets clean water": ["bad", "partly", "clean"],
  "moist ground": ["moist"],
  "dry ground": ["dry"],
  "contaminated ground": ["contaminated"],
  "contaminated beside moist ground": ["contaminated"],
};

async function captureMap(page: Page, tool: Page, m: MapSource, dir: string, before: Shot[]): Promise<Shot[]> {
  console.log(`${m.name}: opening`);
  await m.open(page);
  await page.mouse.move(2, 2);
  // nothing selected
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
  // --height: the ground by height (the toggle), for trying things out
  if (process.argv.includes("--height")) await page.evaluate(() => (window.dgm3d!.renderer as unknown as { setGroundMode(m: string): void }).setGroundMode("height"));
  const data = JSON.parse((await page.evaluate(`(${READ_VIEW_JS})()`)) as string) as ViewData;
  const shots: Shot[] = [];
  // the first map: the whole view as the page shows it, from its default camera (with the legend)
  if (m.id === "riverValley-128") {
    await page.evaluate(() => window.dgm3d!.renderer.resetView());
    // the legend open (the editor starts it closed)
    await page.evaluate(() => document.querySelector<HTMLDetailsElement>(".view3d-legend")!.setAttribute("open", ""));
    await settle(page);
    await page.waitForTimeout(250);
    const png = await page.locator(".editor-view").screenshot({ type: "png" });
    const file = `${m.id}-default-ui.jpg`;
    writeFileSync(join(dir, file), await toJpeg(tool, png, QUALITY));
    const view = (await page.evaluate(() => window.dgm3d!.renderer.getView())) as Pose["view"];
    shots.push({ map: m.id, name: m.name, pose: "default-ui", file, variants: [], size: [0, 0], view, where: {}, notes: ["the page's own view: its default camera, buttons and legend (opened)"] });
    console.log(`  ${file}`);
  }
  // then only the scene: the view's buttons, the inspector and the handles hidden
  await page.addStyleTag({ content: ".view3d > :not(canvas), .editor-map > :not(.view3d) { visibility: hidden !important; }" });
  const { cands, kind, tall } = candidatesOf(data, dam);
  const damTiles = new Set(dam.map(([x, y]) => y * data.W + x));
  const poses = posesOf(m.id, data, dam, before);
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
      const v = await variants(tool, png, VARIANT_QUALITY);
      for (const [k, buf] of Object.entries(v)) {
        const f = `${m.id}-${pose.id}-${k}.jpg`;
        writeFileSync(join(dir, f), buf);
        vs.push(f);
      }
    }
    // where each meaning is: the examples nearest the pose's target that are in view and seen
    const where: Shot["where"] = {};
    const [tx, , tz] = pose.view.target;
    // nothing stands in front of an example: no object on the tiles toward the camera (farther
    // in a view of the whole map, where objects are drawn larger)
    const fx = Math.sin(pose.view.yaw);
    const fy = -Math.cos(pose.view.yaw);
    const reach = pose.id === "overview" ? 5 : 2;
    const clear = ([x0, y0]: Tile): boolean => {
      for (let d = 1; d <= reach; d++)
        for (let l = -1; l <= 1; l++) {
          const x = Math.round(x0 + d * fx - l * fy);
          const y = Math.round(y0 + d * fy + l * fx);
          if (x >= 0 && y >= 0 && x < data.W && y < data.H && tall[y * data.W + x]) return false;
        }
      return true;
    };
    for (const meaning of MEANINGS) {
      const list = cands[meaning];
      if (!list.length) continue;
      const sorted = [...list].sort((a, b) => Math.hypot(a.point[0] - tx, a.point[2] - tz) - Math.hypot(b.point[0] - tx, b.point[2] - tz)).slice(0, 300);
      const pts = (await page.evaluate(`(${PROJECT_JS})(${JSON.stringify(sorted.map((c) => [...c.point, c.grow, c.rise, c.cap ?? 3]))})`)) as [number, number, number, number, number][];
      const found: Where[] = [];
      for (let k = 0; k < sorted.length && found.length < 3; k++) {
        const [cx, cy, vis, hx, hy] = pts[k];
        const px = cx;
        const py = cy;
        if (!vis || px < 10 || py < 10 || px > box.width - 10 || py > box.height - 10) continue;
        // the view shows it there: the tile picked under the point is of the same kind (ground
        // and water), or near the object and not a cliff in front of it
        const c = sorted[k];
        if (meaning !== "the start" && !clear(c.tile)) continue;
        const seen = SEEN_AS[meaning];
        if (meaning === "dam site") {
          if (!damTiles.has(hy * data.W + hx)) continue;
        } else if (seen) {
          if (hx < 0 || !seen.includes(kind(hx, hy)!)) continue;
        } else if (hx < 0 || Math.hypot(hx - c.tile[0], hy - c.tile[1]) > 4 || data.heights[hy * data.W + hx] > c.point[1] + 2) continue;
        // spread the examples out a little
        if (found.some((f) => Math.hypot(f.screen[0] - px, f.screen[1] - py) < 24)) continue;
        found.push({ tile: c.tile, screen: [Math.round(px), Math.round(py)], ...(c.note ? { note: c.note } : {}) });
      }
      if (found.length) where[meaning] = found;
    }
    shots.push({ map: m.id, name: m.name, pose: pose.id, file, variants: vs, size: [Math.round(box.width), Math.round(box.height)], view: pose.view, where, notes: [] });
    console.log(`  ${file}: ${Object.keys(where).length} meanings in view`);
  }
  return shots;
}

function readRun(label: string): Shot[] {
  const f = join("docs/map-look", label, `${label}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { shots: Shot[] }).shots : [];
}

async function main() {
  const maps: MapSource[] = [];
  for (const t of THEMES) maps.push(generated(t, 128));
  maps.push(generated("riverValley", 256));
  if (existsSync(BEAVERTOPIA)) maps.push(imported(BEAVERTOPIA, "beavertopia-256", "Beavertopia, 256×256 (workshop map, local only)"));
  const before = readRun("before");
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
    for (const m of maps) {
      if (ONLY && !ONLY.some((o) => m.id.startsWith(o))) continue;
      const dir = m.id.startsWith("beavertopia") ? local : committed;
      const shots = await captureMap(page, tool, m, dir, before);
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

// ------------------------------------------------------------------------------ the review doc

const POSE_NAMES: Record<string, string> = {
  overview: "the whole map from the south",
  start: "close to the start",
  badwater: "close to the badwater, where it meets clean water if it does",
  falls: "the tallest waterfall, from downstream",
  "default-ui": "the editor's own view from its default camera, with its buttons, and its legend opened",
};
const VARIANT_NAMES: Record<string, string> = { grey: "greyscale", protanopia: "protanopia", deuteranopia: "deuteranopia", tritanopia: "tritanopia" };

/** docs/map-look/captures.md: every capture, and for each map where to look for each meaning. */
function writeDoc(): void {
  const read = (label: string) => JSON.parse(readFileSync(join("docs/map-look", label, `${label}.json`), "utf8")) as { date: string; viewport: { width: number; height: number }; shots: Shot[] };
  const before = read("before");
  const after = read("after");
  const link = (file: string) => (file.startsWith("docs/map-look/") ? `[${file.slice("docs/map-look/".length)}](${file.slice("docs/map-look/".length)})` : `\`${file}\` (local only)`);
  const out: string[] = [];
  out.push("# Map look captures");
  out.push("");
  out.push("Before and after captures of the same maps from the same camera poses, for the Map look review");
  out.push("(ROADMAP \"Map look\", PLAN §20 D86, D110 and D114). The before captures show the 3D view at");
  out.push("`m8-done` (cfa5990); the after captures show it with Map look, after the review's fix round. Each");
  out.push("after capture also comes in greyscale and in three colour-blindness simulations (protanopia,");
  out.push("deuteranopia, tritanopia; Machado, Oliveira and Fernandes 2009, full severity, in linear RGB).");
  out.push("");
  out.push(`Made with \`npx tsx tools/capture-look.ts --label before|after\` (before on ${before.date}, after on ${after.date}), in the installed Chrome, headed, at ${after.viewport.width}×${after.viewport.height} CSS pixels and a device pixel ratio of 1. Each map is opened in the editor (generated maps with **Refine this map**, Beavertopia through the file input) with **Show dam sites** on, and only the 3D canvas is captured, except for one whole view per run. The after run takes every pose's camera from the before run's record. The water is held at one moment of its movement.`);
  out.push("");
  out.push("The maps: seed 4242 in every theme at 128² (Normal), seed 4242 River Valley at 256², and");
  out.push("Beavertopia (a workshop map, 256²). Beavertopia's captures are not ours to share: they stay in");
  out.push("`.scratch/map-look/` on the machine that made them and are never committed.");
  out.push("");
  out.push("## Where to look");
  out.push("");
  out.push("For each capture, up to three example tiles of each meaning that are in view: the tile (x east,");
  out.push("y north, from the map's south-west corner) and its position in the after image, in pixels from");
  out.push("the top-left corner. The positions hold for the greyscale and colour-blind versions too, and for");
  out.push("the before image, which shares the camera (but for the objects that the after view draws");
  out.push("larger from afar).");
  out.push("");
  out.push("The examples come from what the view draws: its heights, the water on each tile's top, the soil");
  out.push("of each tile's top (a tile over a cave shows its top's soil, not the cave floor's) and its");
  out.push("objects. Each position is the visible point: the water's surface, the middle of a tree or a");
  out.push("ruin, the middle of a wall, and the start, the slope arrows and the dead trees as they are drawn");
  out.push("from that distance. Ground and water examples lie inside an area of their kind (their eight");
  out.push("neighbours alike) and away from objects; no example has an object on the tiles in front of it");
  out.push("(toward the camera); and every example was checked by picking the tile under its position in");
  out.push("the view.");
  out.push("");
  out.push("- **Water partly bad** is water with some badwater in it (the percentage is given); **badwater");
  out.push("  meets clean water** is badwater next to clean water.");
  out.push("- **Contaminated beside moist ground** is contaminated ground with moist ground next to it, at the");
  out.push("  same height.");
  out.push("- **Tall cliff** is a wall three levels high or more, facing the camera; the levels are given.");
  out.push("- **Slope** gives the way the slope rises; its arrows point that way.");
  out.push("- **Dam site** tiles are the editor's dam sites, shown with **Show dam sites**.");
  out.push("");
  const maps = [...new Set(after.shots.map((s) => s.map))];
  for (const map of maps) {
    const shots = after.shots.filter((s) => s.map === map);
    out.push(`### ${shots[0].name}`);
    out.push("");
    for (const s of shots) {
      const b = before.shots.find((x) => x.map === s.map && x.pose === s.pose);
      out.push(`**${s.pose}** (${POSE_NAMES[s.pose] ?? s.pose}):`);
      out.push("");
      out.push(`- before: ${b ? link(b.file) : "none"}`);
      out.push(`- after: ${link(s.file)}`);
      if (s.variants.length) out.push(`- after, ${s.variants.map((v) => `${VARIANT_NAMES[v.replace(/^.*-(\w+)\.jpg$/, "$1")] ?? v}: ${link(v)}`).join("; ")}`);
      out.push("");
      if (!Object.keys(s.where).length) continue;
      out.push("| Meaning | Tile → position in the image |");
      out.push("|---|---|");
      for (const meaning of MEANINGS) {
        const w = s.where[meaning];
        out.push(`| ${meaning} | ${w ? w.map((e) => `(${e.tile[0]}, ${e.tile[1]}) → ${e.screen[0]}, ${e.screen[1]}${e.note ? ` (${e.note})` : ""}`).join("; ") : "not in view"} |`);
      }
      out.push("");
    }
  }
  writeFileSync("docs/map-look/captures.md", out.join("\n").replace(/\n{3,}/g, "\n\n"));
  console.log("wrote docs/map-look/captures.md");
}

if (process.argv.includes("--doc")) writeDoc();
else await main();
