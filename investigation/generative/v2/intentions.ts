// Intentions (D138): zero, one or two outcomes a map is steered toward, never built. Each one is
// written as what a player finds, never as how to make it (Kyler's first principle). Steering is
// only a nudge to the genome's prior and a preference in the settler; the processes decide whether
// the outcome appears. A check on the finished map confirms it; when it fails the intention is
// dropped and recorded, never forced (the second principle). The no-clone and no-archetype measures
// run within each intention (the third principle, measures-v2.ts).
//
// Kyler's own first intention, in his words: "I love when the start sits under a cliff with water
// below" (`under-cliff`).

import type { Rng } from "../../../src/core/math/rng";
import type { ThemeId } from "../../../src/core/spec/mapspec";
import type { GenomeV2 } from "./genome";

export const INTENTIONS = [
  "under-cliff",
  "landmark",
  "farmland-past-gorge",
  "safe-water-uphill",
  "falls-shield",
  "hidden-valley",
  "high-lake",
  "meeting-waters",
  "long-view",
] as const;
export type IntentionId = (typeof INTENTIONS)[number];

/** The outcome in a player's words (the briefs name it). */
export const INTENTION_TEXT: Record<IntentionId, string> = {
  "under-cliff": "The start sits under a cliff, with water below (Kyler's own).",
  landmark: "A signature landmark stands out: a spire, a mesa, a peak or a tall waterfall.",
  "farmland-past-gorge": "The best farmland lies past the gorge.",
  "safe-water-uphill": "The only safe water is uphill: a high lake keeps its water when the river runs low.",
  "falls-shield": "A waterfall shields the start: its cliff stands between the start and the nearest threat.",
  "hidden-valley": "A hidden valley up the cliffs, reached only by stairs, holds riches.",
  "high-lake": "A lake high on the heights spills over a fall.",
  "meeting-waters": "Two rivers meet by the start.",
  "long-view": "The start looks out from high ground over the land below.",
};

/** How often each intention is drawn, by theme; Verticality weights the vertical ones up. */
const WEIGHT: Record<IntentionId, Record<ThemeId, number>> = {
  "under-cliff": { riverValley: 1, canyon: 1.5, highlands: 1.5, lakeBasin: 0.8, delta: 0.5, islands: 0.8 },
  landmark: { riverValley: 1, canyon: 1, highlands: 1, lakeBasin: 1, delta: 0.8, islands: 1.2 },
  "farmland-past-gorge": { riverValley: 1, canyon: 1.2, highlands: 0.8, lakeBasin: 0.5, delta: 1, islands: 0.3 },
  "safe-water-uphill": { riverValley: 0.8, canyon: 0.6, highlands: 1, lakeBasin: 0.8, delta: 0.4, islands: 0.5 },
  "falls-shield": { riverValley: 0.8, canyon: 1, highlands: 1, lakeBasin: 0.5, delta: 0.3, islands: 0.4 },
  "hidden-valley": { riverValley: 0.6, canyon: 1, highlands: 1, lakeBasin: 0.4, delta: 0.3, islands: 0.4 },
  "high-lake": { riverValley: 0.5, canyon: 0.8, highlands: 1.2, lakeBasin: 0.8, delta: 0.3, islands: 0.5 },
  "meeting-waters": { riverValley: 1, canyon: 0.6, highlands: 0.8, lakeBasin: 0.8, delta: 1.2, islands: 0.4 },
  "long-view": { riverValley: 0.8, canyon: 1, highlands: 1.2, lakeBasin: 0.6, delta: 0.4, islands: 0.8 },
};
const VERTICAL = new Set<IntentionId>(["under-cliff", "falls-shield", "hidden-valley", "high-lake", "long-view"]);
/** Pairs that pull the start two ways. */
const CLASH: [IntentionId, IntentionId][] = [
  ["safe-water-uphill", "long-view"],
  ["under-cliff", "long-view"],
];

export function drawIntentions(theme: ThemeId, vt: number, rng: Rng): IntentionId[] {
  // some maps have none, most one, some two (the mix is never a template)
  const r = rng.float();
  const n = r < 0.25 ? 0 : r < 0.75 ? 1 : 2;
  const out: IntentionId[] = [];
  for (let k = 0; k < n; k++) {
    const w = INTENTIONS.map((id) => {
      if (out.includes(id) || out.some((o) => CLASH.some(([a, b]) => (a === o && b === id) || (b === o && a === id)))) return 0;
      return WEIGHT[id][theme] * (VERTICAL.has(id) ? 1 + vt / 100 : 1);
    });
    if (w.every((x) => x === 0)) break;
    out.push(INTENTIONS[rng.weighted(w)]);
  }
  return out;
}

/** Nudges to the prior: more of what tends to make the outcome, never the outcome itself. */
export function nudgeFor(id: IntentionId): (g: GenomeV2, rng: Rng, W: number, H: number) => void {
  const tall = (g: GenomeV2) => 1 + (0.6 * g.vt) / 100;
  const part = (g: GenomeV2, rng: Rng, kind: "cone" | "mesa" | "escarpment" | "plateau" | "caldera", mul = 1) => {
    const side = Math.min(128, 128);
    void side;
    const at: [number, number] = [0.2 + 0.6 * rng.float(), 0.2 + 0.6 * rng.float()];
    const h = (kind === "cone" ? 5 + 2.5 * rng.float() : kind === "mesa" ? 4 + 3 * rng.float() : 3 + 2 * rng.float()) * tall(g) * mul;
    const size = kind === "escarpment" ? 40 + 50 * rng.float() : kind === "cone" ? 10 + 7 * rng.float() : 12 + 10 * rng.float();
    g.parts.push({ kind, at, size, height: h, turn: rng.float(), extra: kind === "escarpment" ? 4 + 6 * rng.float() : kind === "caldera" ? 3 + 3 * rng.float() : 0.3 + 0.4 * rng.float(), soft: kind === "cone" ? 0 : (0.7 + rng.float()) / tall(g) });
  };
  switch (id) {
    case "under-cliff":
      return (g, rng) => {
        g.terrace.share = Math.min(1, g.terrace.share + 0.15);
        if (g.terrace.step < 2 && rng.float() < 0.6) g.terrace.step = 2;
        if (rng.float() < 0.5) part(g, rng, "escarpment");
      };
    case "landmark":
      return (g, rng) => {
        if (rng.float() < 0.75) part(g, rng, (["cone", "mesa", "caldera", "escarpment"] as const)[rng.int(0, 4)], 1.3);
        g.cap.share = Math.min(0.75, g.cap.share + 0.1);
      };
    case "farmland-past-gorge":
      return (g) => {
        g.hydro.incise += 1.5;
        g.hydro.floor += 2;
      };
    case "safe-water-uphill":
      return (g, rng) => {
        g.hydro.springs += 1;
        if (g.hazards.badwater === "none" && rng.float() < 0.7) g.hazards.badwater = "pit";
        if (rng.float() < 0.5) part(g, rng, rng.float() < 0.5 ? "mesa" : "plateau");
      };
    case "falls-shield":
      return (g, rng) => {
        g.hydro.incise += 0.5;
        g.terrace.share = Math.min(1, g.terrace.share + 0.1);
        if (g.hazards.badwater === "none" && rng.float() < 0.7) g.hazards.badwater = "pit";
      };
    case "hidden-valley":
      return (g, rng) => {
        g.ramps = Math.max(0.1, g.ramps - 0.3);
        part(g, rng, "plateau", 1.3);
        g.resources.ruins = Math.min(300, g.resources.ruins + 40);
      };
    case "high-lake":
      return (g, rng) => {
        g.hydro.springs += 1;
        if (rng.float() < 0.8) part(g, rng, "mesa", 1.2);
        g.weathering = Math.min(1, g.weathering + 0.2);
      };
    case "meeting-waters":
      return (g) => {
        g.hydro.springs += 1;
        if (g.hydro.inflows === 0) g.hydro.inflows = 1;
      };
    case "long-view":
      return (g, rng) => {
        if (rng.float() < 0.5) part(g, rng, rng.float() < 0.5 ? "plateau" : "escarpment");
      };
  }
}

// ------------------------------------------------------------------------------------ steering

/** What the settler knows when it scores a place: the land and the settled water. */
export interface SettlerView {
  W: number;
  H: number;
  h: Uint8Array;
  /** Distance to a planned confluence, and to a fall of the settled water (1.5+ levels). */
  dJoin: Float64Array;
  dFall: Float64Array;
  /** Clean water bodies (60+ tiles) with their surface and the share they keep through a 9-day
   *  drought. */
  lakes: { tiles: number[]; surface: number; keep9: number }[];
  /** Farmland patches (moist, dry, level within a step; 400+ tiles) and the gorges (wet tiles with
   *  banks 2+ above the water on two sides). */
  farms: { size: number; cx: number; cy: number }[];
  gorge: Uint8Array;
  p75: number;
}

/** A straight line from (x, y) to (px, py) crosses a gorge tile. */
export function crossesGorge(gorge: Uint8Array, W: number, x: number, y: number, px: number, py: number): boolean {
  const d = Math.max(Math.abs(px - x), Math.abs(py - y));
  for (let t = 1; t < d; t++) {
    const xx = Math.round(x + ((px - x) * t) / d);
    const yy = Math.round(y + ((py - y) * t) / d);
    if (gorge[yy * W + xx]) return true;
  }
  return false;
}

/** A preference in 0–1 for a start at (x, y) on level L, `walk` tiles from its water. It reads
 *  the same land and water the check reads, so steering and checking agree. */
export function startPreference(id: IntentionId, s: SettlerView, x: number, y: number, L: number, walk: number): number {
  const { W, H, h } = s;
  const box = (r: number, f: (i: number) => void) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) f(yy * W + xx);
      }
  };
  const near = (tiles: number[], r: number) => tiles.some((i) => Math.max(Math.abs((i % W) - x), Math.abs(Math.floor(i / W) - y)) <= r);
  switch (id) {
    case "under-cliff": {
      if (!(walk <= 12)) return 0;
      let hi = 0;
      let cliff = false;
      box(7, (i) => {
        if (h[i] >= L + 2) hi++;
        const xx = i % W;
        const yy = (i - xx) / W;
        if (h[i] >= L && h[i] <= L + 1)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const X = xx + dx;
            const Y = yy + dy;
            if (X >= 0 && Y >= 0 && X < W && Y < H && h[Y * W + X] - h[i] >= 2 && h[Y * W + X] >= L + 2) cliff = true;
          }
      });
      return cliff ? Math.min(1, hi / 16) : 0;
    }
    case "long-view": {
      let lo = 99;
      box(15, (i) => {
        if (h[i] < lo) lo = h[i];
      });
      return L >= s.p75 && L - lo >= 4 ? 1 : 0;
    }
    case "meeting-waters":
      return s.dJoin[y * W + x] <= 18 ? 1 : 0;
    case "falls-shield":
      return s.dFall[y * W + x] <= 18 ? 1 : 0;
    case "safe-water-uphill":
      return s.lakes.some((lk) => lk.surface >= L + 1 && lk.keep9 >= 0.5 && near(lk.tiles, 40)) ? 1 : 0;
    case "farmland-past-gorge":
      return s.farms.some((f) => {
        const d = Math.sqrt((f.cx - x) * (f.cx - x) + (f.cy - y) * (f.cy - y));
        return d <= 70 && crossesGorge(s.gorge, W, x, y, Math.round(f.cx), Math.round(f.cy));
      })
        ? 1
        : 0;
    default:
      return 0;
  }
}

// --------------------------------------------------------------------------------------- checks

/** The finished map, as the checks read it. */
export interface FinalCtx {
  W: number;
  H: number;
  h: Uint8Array;
  D: ArrayLike<number>;
  C: ArrayLike<number>;
  moist: ArrayLike<number>;
  start: { x: number; y: number; z: number };
  /** Walking distance from the start with the map's slopes (Infinity: not on foot). */
  walk: Float64Array;
  /** Water left after the Normal difficulty's longest drought (9 days, analytic). */
  kept9: Float64Array;
  objects: { template: string; x: number; y: number }[];
  /** Tiles where the water falls 2 levels or more to a wet neighbour, with the drop. */
  falls: { i: number; drop: number }[];
  /** Planned confluences (river ends that join another river). */
  joins: number[];
}

const D4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Wet bodies (4-connected water ≥ 0.1 deep): labels and each body's tiles. */
function bodies(c: FinalCtx): { lab: Int32Array; tiles: number[][] } {
  const { W, H, D } = c;
  const N = W * H;
  const lab = new Int32Array(N).fill(-1);
  const tiles: number[][] = [];
  for (let s = 0; s < N; s++) {
    if (lab[s] >= 0 || !(D[s] >= 0.1)) continue;
    const id = tiles.length;
    const q = [s];
    lab[s] = id;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of D4) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (lab[j] >= 0 || !(D[j] >= 0.1)) continue;
        lab[j] = id;
        q.push(j);
      }
    }
    tiles.push(q);
  }
  return { lab, tiles };
}

export interface CheckResult {
  ok: boolean;
  note: string;
}

export function checkIntention(id: IntentionId, c: FinalCtx): CheckResult {
  const { W, H, h, D, C, start } = c;
  const N = W * H;
  const sx = start.x;
  const sy = start.y;
  const z = start.z;
  const cheb = (i: number) => Math.max(Math.abs((i % W) - sx), Math.abs(Math.floor(i / W) - sy));
  const eu = (i: number) => {
    const dx = (i % W) - sx;
    const dy = Math.floor(i / W) - sy;
    return Math.sqrt(dx * dx + dy * dy);
  };
  switch (id) {
    case "under-cliff": {
      // a cliff (a step of 2+ levels) rising from the start's ground within 7 tiles, its top 2+
      // levels above the start, over 8 tiles or more
      let high = 0;
      let cliff = false;
      for (let i = 0; i < N; i++) {
        if (cheb(i) > 7 || cheb(i) <= 1) continue;
        if (h[i] >= z + 2) high++;
        const x = i % W;
        const y = (i - x) / W;
        for (const [dx, dy] of D4) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (h[i] >= z && h[i] <= z + 1 && h[j] - h[i] >= 2 && h[j] >= z + 2) cliff = true;
        }
      }
      // water below: the start's pumpable water within 12 tiles' walk, below the start
      let water = Infinity;
      for (let i = 0; i < N; i++) {
        if (!(D[i] >= 0.3) || !(C[i] < 0.05)) continue;
        const s = h[i] + D[i];
        if (s > z - 0.05 || s < z - 2) continue;
        const x = i % W;
        const y = (i - x) / W;
        for (const [dx, dy] of D4) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (h[j] === z && c.walk[j] < water) water = c.walk[j];
        }
      }
      const ok = high >= 8 && cliff && water <= 12;
      return { ok, note: `${high} tiles 2+ levels above within 7, cliff ${cliff ? "yes" : "no"}, water ${Number.isFinite(water) ? Math.round(water) : "none"} tiles' walk` };
    }
    case "landmark": {
      // a stack, butte, mesa or peak standing 5+ levels above the ground 6–8 tiles round it, on
      // at most 600 tiles; or a waterfall of 5+ levels
      let best = 0;
      const ring: [number, number][] = [];
      for (let k = 0; k < 16; k++) {
        const a = [1, 0.92, 0.71, 0.38, 0, -0.38, -0.71, -0.92, -1, -0.92, -0.71, -0.38, 0, 0.38, 0.71, 0.92][k];
        const b = [0, 0.38, 0.71, 0.92, 1, 0.92, 0.71, 0.38, 0, -0.38, -0.71, -0.92, -1, -0.92, -0.71, -0.38][k];
        ring.push([Math.round(7 * a), Math.round(7 * b)]);
      }
      const top = new Uint8Array(N);
      for (let y = 7; y < H - 7; y++)
        for (let x = 7; x < W - 7; x++) {
          const i = y * W + x;
          let lo = 99;
          for (const [dx, dy] of ring) lo = Math.min(lo, h[(y + dy) * W + x + dx]);
          const p = h[i] - lo;
          if (p >= 5) top[i] = 1;
          if (p > best) best = p;
        }
      // the standing forms: connected high tiles on at most 300 tiles; the landmark is the most
      // prominent one, and it must stand 8+ levels over its ring (or a fall of 6+ levels)
      let forms = 0;
      let standout = 0;
      const seen = new Uint8Array(N);
      for (let s = 0; s < N; s++) {
        if (!top[s] || seen[s]) continue;
        const q = [s];
        seen[s] = 1;
        for (let k = 0; k < q.length; k++) {
          const i = q[k];
          const x = i % W;
          const y = (i - x) / W;
          for (const [dx, dy] of D4) {
            const j = (y + dy) * W + x + dx;
            if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || seen[j] || !top[j]) continue;
            seen[j] = 1;
            q.push(j);
          }
        }
        if (q.length <= 300) {
          forms++;
          for (const i of q) {
            const x = i % W;
            const y = (i - x) / W;
            let lo = 99;
            for (const [dx, dy] of ring) lo = Math.min(lo, h[(y + dy) * W + x + dx]);
            standout = Math.max(standout, h[i] - lo);
          }
        }
      }
      const fall = c.falls.reduce((m, f) => Math.max(m, f.drop), 0);
      const ok = standout >= 8 || fall >= 6;
      void best;
      return { ok, note: `${forms} standing form${forms === 1 ? "" : "s"} of 300 tiles or fewer (the most prominent ${standout} levels over its ring), tallest fall ${Math.round(fall * 10) / 10}` };
    }
    case "farmland-past-gorge": {
      // farmland: moist, dry, level land; the start's own within 20 tiles' walk, and the largest
      // other patch within 70 tiles that is past a gorge (water with banks 2+ above it on both sides)
      const farm = new Uint8Array(N);
      for (let i = 0; i < N; i++) farm[i] = c.moist[i] > 0 && !(D[i] > 0.05) && C[i] < 0.05 ? 1 : 0;
      let own = 0;
      for (let i = 0; i < N; i++) if (farm[i] && c.walk[i] <= 20) own++;
      const lab = new Int32Array(N).fill(-1);
      const sizes: number[] = [];
      const cent: [number, number][] = [];
      for (let s = 0; s < N; s++) {
        if (!farm[s] || lab[s] >= 0) continue;
        const id = sizes.length;
        const q = [s];
        lab[s] = id;
        let cx = 0;
        let cy = 0;
        for (let k = 0; k < q.length; k++) {
          const i = q[k];
          const x = i % W;
          const y = (i - x) / W;
          cx += x;
          cy += y;
          for (const [dx, dy] of D4) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (lab[j] >= 0 || !farm[j] || Math.abs(h[j] - h[i]) > 1) continue;
            lab[j] = id;
            q.push(j);
          }
        }
        sizes.push(q.length);
        cent.push([cx / q.length, cy / q.length]);
      }
      const ownLab = new Set<number>();
      for (let i = 0; i < N; i++) if (farm[i] && c.walk[i] <= 20) ownLab.add(lab[i]);
      let best = -1;
      for (let k = 0; k < sizes.length; k++) {
        if (ownLab.has(k) || sizes[k] < 400) continue;
        const [px, py] = cent[k];
        const d = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
        if (d > 70) continue;
        // a gorge on the way: a wet tile on the line whose banks within 3 tiles stand 2+ above it
        let gorge = false;
        const steps = Math.ceil(d);
        for (let t = 1; t < steps && !gorge; t++) {
          const x = Math.round(sx + ((px - sx) * t) / steps);
          const y = Math.round(sy + ((py - sy) * t) / steps);
          const i = y * W + x;
          if (!(D[i] >= 0.1)) continue;
          const s = h[i] + D[i];
          let sides = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            for (let r = 1; r <= 3; r++) {
              const xx = x + dx * r;
              const yy = y + dy * r;
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
              if (h[yy * W + xx] >= s + 2) {
                sides++;
                break;
              }
            }
          }
          if (sides >= 2) gorge = true;
        }
        if (gorge && sizes[k] >= 1.5 * Math.max(200, own) && (best < 0 || sizes[k] > sizes[best])) best = k;
      }
      return { ok: best >= 0, note: best >= 0 ? `${sizes[best]} tiles of farmland past a gorge, against ${own} by the start` : `no larger farmland past a gorge (${own} by the start)` };
    }
    case "safe-water-uphill": {
      const b = bodies(c);
      let startBody = -1;
      let bestD = Infinity;
      for (let i = 0; i < N; i++) {
        if (b.lab[i] < 0 || !(C[i] < 0.05)) continue;
        const s = h[i] + D[i];
        if (s > z - 0.05 || s < z - 2) continue;
        const d = eu(i);
        if (d < bestD) {
          bestD = d;
          startBody = b.lab[i];
        }
      }
      const keep = (id: number) => {
        let v = 0;
        let k = 0;
        for (const i of b.tiles[id]) {
          v += D[i];
          k += c.kept9[i];
        }
        return v > 0 ? k / v : 0;
      };
      const startKeep = startBody >= 0 ? keep(startBody) : 0;
      let high = -1;
      for (let id = 0; id < b.tiles.length; id++) {
        if (id === startBody || b.tiles[id].length < 60) continue;
        const t = b.tiles[id];
        let surf = 0;
        let near = false;
        let bad = false;
        for (const i of t) {
          surf = Math.max(surf, h[i] + D[i]);
          if (eu(i) <= 40) near = true;
          if (C[i] >= 0.05) bad = true;
        }
        if (!near || bad || surf < z + 1) continue;
        if (keep(id) >= 0.5) high = id;
      }
      const ok = high >= 0 && startKeep < 0.35;
      return { ok, note: `start's water keeps ${Math.round(startKeep * 100)}% through a 9-day drought; ${high >= 0 ? `a lake uphill keeps ${Math.round(keep(high) * 100)}%` : "no lake uphill keeps half"}` };
    }
    case "falls-shield": {
      const near = c.falls.filter((f) => eu(f.i) <= 20 && f.drop >= 1.5);
      // the nearest threat: badwater or thorns
      let t = -1;
      let td = Infinity;
      for (let i = 0; i < N; i++) if (D[i] > 0.05 && C[i] >= 0.3 && eu(i) < td) {
        td = eu(i);
        t = i;
      }
      for (const o of c.objects) if (o.template === "Thorns") {
        const i = o.y * W + o.x;
        if (eu(i) < td) {
          td = eu(i);
          t = i;
        }
      }
      if (!near.length || t < 0) return { ok: false, note: `${near.length} falls within 20 tiles; ${t < 0 ? "no threat on the map" : "a threat"}` };
      // the walk to the threat's shore or tile: the land between must make it long
      let w = Infinity;
      const tx = t % W;
      const ty = Math.floor(t / W);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        w = Math.min(w, c.walk[yy * W + xx]);
      }
      const ok = !(w <= 2 * td);
      return { ok, note: `a fall ${Math.round(Math.min(...near.map((f) => eu(f.i))))} tiles away; the threat ${Math.round(td)} tiles off is ${Number.isFinite(w) ? `${Math.round(w)} tiles' walk` : "out of reach on foot"}` };
    }
    case "hidden-valley": {
      // stairs-only dry land within 60 tiles of the start, in regions of 400+ tiles holding ruins,
      // relics or trees
      // cut off by cliffs: not joined to the start's ground by one-level steps, and 2+ levels up
      const own = new Uint8Array(N);
      {
        const q0 = [start.y * W + start.x];
        own[q0[0]] = 1;
        for (let k = 0; k < q0.length; k++) {
          const i = q0[k];
          const x = i % W;
          const y = (i - x) / W;
          for (const [dx, dy] of D4) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (own[j] || D[j] > 0.05 || Math.abs(h[j] - h[i]) > 1) continue;
            own[j] = 1;
            q0.push(j);
          }
        }
      }
      const off = new Uint8Array(N);
      for (let i = 0; i < N; i++) off[i] = !(D[i] > 0.05) && !own[i] && !Number.isFinite(c.walk[i]) && h[i] >= z + 2 && eu(i) <= 60 ? 1 : 0;
      const riches = new Uint8Array(N);
      for (const o of c.objects) if (/Ruin|Relic|Pine|Birch|Oak|Blueberry|UndergroundRuins|Geothermal/.test(o.template)) riches[o.y * W + o.x] = 1;
      const seen = new Uint8Array(N);
      let found = 0;
      let bestSize = 0;
      for (let s = 0; s < N; s++) {
        if (!off[s] || seen[s]) continue;
        const q = [s];
        seen[s] = 1;
        let rich = 0;
        for (let k = 0; k < q.length; k++) {
          const i = q[k];
          if (riches[i]) rich++;
          const x = i % W;
          const y = (i - x) / W;
          for (const [dx, dy] of D4) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (seen[j] || !off[j] || Math.abs(h[j] - h[i]) > 1) continue;
            seen[j] = 1;
            q.push(j);
          }
        }
        if (q.length >= 400 && rich >= 10) {
          found++;
          bestSize = Math.max(bestSize, q.length);
        }
      }
      return { ok: found > 0, note: found ? `${found} upland${found > 1 ? "s" : ""} cut off by cliffs, reached only by stairs, with riches (largest ${bestSize} tiles)` : "no upland cut off by cliffs with riches within 60 tiles" };
    }
    case "high-lake": {
      const b = bodies(c);
      const sorted = Array.from(h).sort((p, q) => p - q);
      const med = sorted[N >> 1];
      let found = "";
      for (let id = 0; id < b.tiles.length && !found; id++) {
        const t = b.tiles[id];
        if (t.length < 60) continue;
        let surf = 0;
        let deep = 0;
        for (const i of t) {
          surf = Math.max(surf, h[i] + D[i]);
          if (D[i] >= 1) deep++;
        }
        if (surf < med + 5 || deep < 10) continue;
        const inBody = new Set(t);
        const spill = c.falls.some((f) => {
          const fx = f.i % W;
          const fy = Math.floor(f.i / W);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inBody.has((fy + dy) * W + fx + dx)) return true;
          return false;
        });
        if (spill) found = `a ${t.length}-tile lake ${Math.round(surf - med)} levels above the map's middle spills over a fall`;
      }
      return { ok: !!found, note: found || "no lake on the heights with a fall" };
    }
    case "meeting-waters": {
      const j = c.joins.filter((i) => eu(i) <= 18 && D[i] >= 0.1);
      return { ok: j.length > 0, note: j.length ? `a confluence ${Math.round(Math.min(...j.map(eu)))} tiles from the start` : "no confluence within 18 tiles" };
    }
    case "long-view": {
      const sorted = Array.from(h).sort((p, q) => p - q);
      const p75 = sorted[Math.floor(0.75 * (N - 1))];
      let lo = 99;
      for (let i = 0; i < N; i++) if (cheb(i) <= 15) lo = Math.min(lo, h[i]);
      const ok = z >= p75 && z - lo >= 4;
      return { ok, note: `start at level ${z} (map's 75th percentile ${p75}), ${z - lo} levels above the lowest ground within 15 tiles` };
    }
  }
}
