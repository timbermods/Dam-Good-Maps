// Two pictures of a map for the study: a shaded top-down view with its objects, and an isometric
// 3D view seen from the south-east. Plain RGB buffers, written as PNG. North is up in the top-down
// view and at the back in the 3D view. Renders of other creators' maps stay local.

import { shadeTiles } from "../../../src/core/render/shade";
import type { MapObject } from "../../../src/core/sim/model";
import { encodePng } from "../../../tools/png";

export interface Picture {
  rgb: Uint8Array;
  w: number;
  h: number;
}

type RGB = readonly [number, number, number];

const MARK: Record<string, RGB> = {
  tree: [38, 92, 44],
  deadTree: [128, 104, 72],
  succulent: [150, 170, 80],
  bush: [120, 60, 150],
  ruin: [150, 150, 162],
  start: [230, 40, 40],
  source: [40, 230, 250],
  badSource: [90, 80, 20],
  slope: [250, 220, 60],
  relic: [255, 190, 0],
  geothermal: [255, 120, 20],
  mine: [20, 20, 20],
  thorns: [140, 20, 40],
  dam: [210, 120, 200],
};
const BAD: RGB = [110, 120, 40];
const WATER: RGB = [64, 128, 200];

function markOf(o: MapObject): RGB | null {
  const t = o.template;
  const dead = (o.components.LivingNaturalResource as { IsDead?: boolean } | undefined)?.IsDead === true;
  if (t === "Succulent") return MARK.succulent;
  if (["Pine", "Birch", "Oak", "Maple", "ChestnutTree", "Mangrove"].includes(t)) return dead ? MARK.deadTree : MARK.tree;
  if (["BlueberryBush", "CoffeeBush", "Dandelion", "Spadderdock", "Cattail"].includes(t)) return MARK.bush;
  if (t.startsWith("RuinColumnH")) return MARK.ruin;
  if (t === "StartingLocation") return MARK.start;
  if (t === "WaterSource" || t === "WaterSeep") return MARK.source;
  if (t === "BadwaterSource" || t === "BadwaterSeep" || t === "BadtideDrain") return MARK.badSource;
  if (t === "Slope") return MARK.slope;
  if (t.endsWith("Relic")) return MARK.relic;
  if (t === "GeothermalField") return MARK.geothermal;
  if (t === "UndergroundRuins") return MARK.mine;
  if (t === "Thorns") return MARK.thorns;
  if (t === "NaturalDam" || t === "Blockage") return MARK.dam;
  return null;
}

export function topDown(h: Uint8Array, W: number, H: number, depth: ArrayLike<number>, contam: ArrayLike<number>, objects: readonly MapObject[], maxSide = 768): Picture {
  const base = shadeTiles(h, W, H, depth);
  for (let i = 0; i < W * H; i++) {
    if (depth[i] > 0.05 && contam[i] >= 0.3) {
      base[i * 3] = (base[i * 3] + 2 * BAD[0]) / 3;
      base[i * 3 + 1] = (base[i * 3 + 1] + 2 * BAD[1]) / 3;
      base[i * 3 + 2] = (base[i * 3 + 2] + 2 * BAD[2]) / 3;
    }
  }
  const s = Math.max(1, Math.floor(maxSide / Math.max(W, H)));
  const w = W * s;
  const ph = H * s;
  const rgb = new Uint8Array(w * ph * 3);
  const put = (px: number, py: number, c: RGB | Uint8Array, off = 0) => {
    if (px < 0 || py < 0 || px >= w || py >= ph) return;
    const k = (py * w + px) * 3;
    rgb[k] = c[off];
    rgb[k + 1] = c[off + 1];
    rgb[k + 2] = c[off + 2];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) put(x * s + dx, (H - 1 - y) * s + dy, base, i * 3);
    }
  }
  const dot = Math.max(1, s - 1);
  for (const o of objects) {
    const c = markOf(o);
    if (!c || o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const big = o.template === "StartingLocation" ? 3 : 1;
    for (let ty = 0; ty < big; ty++) {
      for (let tx = 0; tx < big; tx++) {
        const x = o.x + (big > 1 ? tx - 1 : 0);
        const y = o.y + (big > 1 ? ty - 1 : 0);
        for (let dy = 0; dy < dot; dy++) for (let dx = 0; dx < dot; dx++) put(x * s + dx, (H - 1 - y) * s + dy, c);
      }
    }
  }
  return { rgb, w, h: ph };
}

// ------------------------------------------------------------------------------ isometric

function fillPoly(buf: Uint8Array, w: number, hgt: number, pts: [number, number][], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.ceil(minY - 0.5));
  const y1 = Math.min(hgt - 1, Math.floor(maxY - 0.5));
  for (let py = y0; py <= y1; py++) {
    const yc = py + 0.5;
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < pts.length; k++) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[(k + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const x = ax + ((yc - ay) / (by - ay)) * (bx - ax);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    if (lo > hi) continue;
    const x0 = Math.max(0, Math.ceil(lo - 0.5));
    const x1 = Math.min(w - 1, Math.floor(hi - 0.5));
    for (let px = x0; px <= x1; px++) {
      const k = (py * w + px) * 3;
      buf[k] = c[0];
      buf[k + 1] = c[1];
      buf[k + 2] = c[2];
    }
  }
}

const LOW: RGB = [122, 150, 84];
const HIGH: RGB = [196, 178, 140];

function scale(c: RGB, k: number): RGB {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

export function isometric(h: Uint8Array, W: number, H: number, depth: ArrayLike<number>, contam: ArrayLike<number>, objects: readonly MapObject[], target = 1200): Picture {
  let tw = Math.floor((2 * target) / (W + H));
  tw = Math.max(2, Math.min(24, tw - (tw % 2)));
  const th = tw / 2;
  const zs = Math.max(1, Math.round(tw * 0.5));
  let lo = 255;
  let top = 0;
  for (const v of h) {
    if (v < lo) lo = v;
    if (v > top) top = v;
  }
  const span = Math.max(1, top - lo);
  const maxZ = top + 3;
  const w = Math.ceil(((W + H) * tw) / 2 + tw);
  const hgt = Math.ceil(((W + H) * th) / 2 + maxZ * zs + th * 2);
  const buf = new Uint8Array(w * hgt * 3);
  for (let k = 0; k < buf.length; k += 3) {
    buf[k] = 236;
    buf[k + 1] = 232;
    buf[k + 2] = 222;
  }
  const ox = ((H - 1) * tw) / 2 + tw / 2;
  const oy = maxZ * zs + th / 2;
  const screen = (x: number, y: number, z: number): [number, number] => {
    const a = x;
    const b = H - 1 - y;
    return [ox + ((a - b) * tw) / 2, oy + ((a + b) * th) / 2 - z * zs];
  };
  const surfAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    const i = y * W + x;
    return depth[i] > 0.05 ? h[i] + depth[i] : h[i];
  };
  const ground = (i: number, k: number): RGB => {
    const t = (h[i] - lo) / span;
    return scale([LOW[0] * (1 - t) + HIGH[0] * t, LOW[1] * (1 - t) + HIGH[1] * t, LOW[2] * (1 - t) + HIGH[2] * t], k);
  };
  const waterC = (i: number, k: number): RGB => scale(contam[i] >= 0.3 ? BAD : WATER, k * (0.85 + 0.15 * Math.max(0, 1 - Math.min(depth[i], 3) / 3)));
  const objAt = new Map<number, MapObject[]>();
  for (const o of objects) {
    if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= H) continue;
    const i = o.y * W + o.x;
    (objAt.get(i) ?? objAt.set(i, []).get(i)!).push(o);
  }
  // back to front: a + b grows toward the viewer
  for (let s = 0; s <= W - 1 + H - 1; s++) {
    for (let a = Math.max(0, s - (H - 1)); a <= Math.min(W - 1, s); a++) {
      const b = s - a;
      const x = a;
      const y = H - 1 - b;
      const i = y * W + x;
      const g = h[i];
      const wet = depth[i] > 0.05;
      const surf = wet ? g + depth[i] : g;
      // light from the north-west
      const gx = (surfAt(x + 1, y) - surfAt(x - 1, y)) / 2;
      const gy = (surfAt(x, y + 1) - surfAt(x, y - 1)) / 2;
      const light = Math.max(0.6, Math.min(1.2, 1 - 0.12 * (gx - gy)));
      // east face (toward +x) and south face (toward -y), down to the neighbour's top
      for (const [nx, ny, k, side] of [[x + 1, y, 0.62, "e"], [x, y - 1, 0.8, "s"]] as const) {
        const nTop = nx < W && ny >= 0 ? surfAt(nx, ny) : 0;
        if (nTop >= surf) continue;
        const [cx, cy] = screen(x, y, 0);
        const edge = side === "e" ? [[cx + tw / 2, cy], [cx, cy + th / 2]] : [[cx - tw / 2, cy], [cx, cy + th / 2]];
        const band = (zTop: number, zBot: number, col: RGB) => {
          if (zTop <= zBot) return;
          fillPoly(buf, w, hgt, [
            [edge[0][0], edge[0][1] - zTop * zs],
            [edge[1][0], edge[1][1] - zTop * zs],
            [edge[1][0], edge[1][1] - zBot * zs],
            [edge[0][0], edge[0][1] - zBot * zs],
          ], col);
        };
        band(g, nTop, ground(i, k * 0.85));
        if (wet) band(surf, Math.max(g, nTop), waterC(i, k));
      }
      const [cx, cy] = screen(x, y, surf);
      fillPoly(buf, w, hgt, [[cx, cy - th / 2], [cx + tw / 2, cy], [cx, cy + th / 2], [cx - tw / 2, cy]], wet ? waterC(i, light) : ground(i, light));
      for (const o of objAt.get(i) ?? []) {
        const c = markOf(o);
        if (!c || o.template === "Slope") continue;
        const tall = o.template.startsWith("RuinColumnH") ? 0.5 * Number(o.template.slice(11)) : o.template === "StartingLocation" ? 3 : 1.6;
        const r = Math.max(0.6, tw / 5);
        fillPoly(buf, w, hgt, [[cx - r, cy], [cx + r, cy], [cx + r, cy - tall * zs], [cx - r, cy - tall * zs]], c);
      }
    }
  }
  return { rgb: buf, w, h: hgt };
}

export function png(p: Picture): Uint8Array {
  return encodePng(p.rgb, p.w, p.h);
}
