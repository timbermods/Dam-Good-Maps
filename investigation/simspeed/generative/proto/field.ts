// The uplift field: the genome's parts summed over a regional slope and warped noise, in terrain
// levels (floats). Everything here is exact arithmetic: value noise from integer hashes, square
// roots, and the deterministic sine for oriented parts.

import { hash32 } from "../../../../src/core/math/hash";
import { fbm } from "../../../../src/core/math/noise";
import { stream } from "../../../../src/core/math/rng";
import type { Genome, Part } from "./genome";
import { bump, clamp, DIRS8, dist, polyDist, smoothstep, unit } from "./num";

/** A part's polyline: a gentle bend through its anchor, `size` tiles long, turned by `turn`. */
function partLine(p: Part, W: number, H: number, seed: number, k: number): [number, number][] {
  const [ux, uy] = unit(p.turn);
  const cx = p.at[0] * (W - 1);
  const cy = p.at[1] * (H - 1);
  const rng = stream(seed, "part-line", k);
  const bend = (rng.float() * 2 - 1) * 0.25 * p.size;
  const half = p.size / 2;
  return [
    [cx - ux * half, cy - uy * half],
    [cx - uy * bend, cy + ux * bend],
    [cx + ux * half, cy + uy * half],
  ];
}

/** Noise-shaped blob membership (0–1): a radial falloff pushed around by noise, so outlines are
 *  lobed and irregular rather than round. */
function blob(x: number, y: number, cx: number, cy: number, r: number, s: number, soft: number): number {
  const d = dist(x, y, cx, cy) / r;
  const n = fbm(s, x, y, Math.max(6, r * 0.8), 3);
  return smoothstep(((1 - d) + 0.45 * n) * (r / Math.max(0.5, soft)) + 0.5);
}

export function upliftField(g: Genome, seed: number, W: number, H: number): Float64Array {
  const N = W * H;
  const U = new Float64Array(N);
  const [fx, fy] = DIRS8[g.flowDir];
  // the regional slope: high on the side the water comes from, falling toward the outlet side
  const sx = hash32(seed, "noise", g.theme);
  const wx = hash32(seed, "warp-x");
  const wy = hash32(seed, "warp-y");
  const nz = g.noise;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1;
      const v = (y / (H - 1)) * 2 - 1;
      // projection on the flow direction, -1 (upstream side) to 1 (outlet side), diagonals scaled
      const proj = (u * fx + v * fy) / (Math.abs(fx) + Math.abs(fy));
      let h = g.base + g.relief * 0.45;
      if (g.tiltKind === "linear") h += g.tilt * -0.5 * proj;
      else {
        // falling toward the focus from every side, a little lower toward the outlet side
        const du = x / (W - 1) - g.focus[0];
        const dv = y / (H - 1) - g.focus[1];
        h += g.tilt * (Math.sqrt(du * du + dv * dv) * 1.6 - 0.4) - 0.3 * g.tilt * proj;
      }
      const px = x + nz.warp * fbm(wx, x, y, nz.warpCell, 2);
      const py = y + nz.warp * fbm(wy, x, y, nz.warpCell, 2);
      let n = fbm(sx, px, py, nz.cell, nz.octaves);
      if (nz.ridged > 0) n = (1 - nz.ridged) * n + nz.ridged * (1 - 2 * Math.abs(n)) * 0.8;
      h += nz.amp * n;
      U[y * W + x] = h;
    }
  }
  g.parts.forEach((p, k) => addPart(U, p, g, seed, W, H, k));
  return U;
}

function addPart(U: Float64Array, p: Part, g: Genome, seed: number, W: number, H: number, k: number): void {
  const cx = p.at[0] * (W - 1);
  const cy = p.at[1] * (H - 1);
  const s = hash32(seed, "part", k, p.kind);
  const each = (f: (x: number, y: number, i: number) => void) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f(x, y, y * W + x);
  };
  switch (p.kind) {
    case "ridge":
    case "trough": {
      const line = partLine(p, W, H, seed, k);
      // the crest rises and falls along the ridge and its width swells and narrows, as a real
      // range's does (the refinement's naturalness targets: crest height and thickness vary)
      each((x, y, i) => {
        const w = p.extra * (1 + 0.5 * fbm(s, x, y, 16, 2));
        U[i] += p.height * bump(polyDist(x, y, line) / w) * (1 + 0.5 * fbm(s + 1, x, y, 9, 2));
      });
      return;
    }
    case "basin": {
      // a hollow with a lobed outline: the radius swings by up to half with the angle and the noise
      each((x, y, i) => {
        const d = dist(x, y, cx, cy) / (p.size * (1 + 0.5 * fbm(s, x, y, Math.max(8, p.size * 0.7), 3)));
        U[i] += p.height * bump(d) + p.extra * (0.3 + 0.7 * (fbm(s + 3, x, y, 8, 2) + 1)) * bump(Math.abs(d - 1.05) / 0.45);
      });
      return;
    }
    case "caldera": {
      // a raised ring, a sunken floor inside it, sometimes an island cone in the middle
      each((x, y, i) => {
        const r = p.size * (1 + 0.15 * fbm(s, x, y, 14, 2));
        const d = dist(x, y, cx, cy);
        // a rim of uneven height and width, with sloping flanks (a crater's rim, not a wall)
        const ring = bump(Math.abs(d - r) / (p.soft * (3.2 + 1.0 * fbm(s + 2, x, y, 10, 2))));
        const inside = d < r ? smoothstep((r - d) / 5) : 0;
        U[i] += p.height * (0.65 + 0.35 * (fbm(s + 3, x, y, 8, 2) + 1)) * ring - (p.height + 1.5) * inside;
        if (p.extra > 0) U[i] += (p.height + 2) * bump(d / p.extra);
      });
      return;
    }
    case "mesa":
    case "plateau": {
      // a flat-topped table: the ground inside is lifted to one top level, with steep sides
      let top = -Infinity;
      each((x, y, i) => {
        if (dist(x, y, cx, cy) < p.size * 0.5) top = Math.max(top, U[i]);
      });
      top += p.height;
      each((x, y, i) => {
        const m = blob(x, y, cx, cy, p.size, s, p.soft);
        if (m <= 0) return;
        const lifted = Math.max(U[i], top - p.extra * 0.5 * (1 + fbm(s + 2, x, y, 10, 2)));
        U[i] = U[i] * (1 - m) + lifted * m;
      });
      return;
    }
    case "mesaField": {
      const rng = stream(seed, "mesa-field", k);
      const n = Math.max(2, Math.round(p.extra));
      for (let j = 0; j < n; j++) {
        const a = rng.float();
        const r = p.size * Math.sqrt(rng.float());
        const [ux, uy] = unit(a);
        const mx = cx + ux * r;
        const my = cy + uy * r;
        const rad = 3.5 + 4 * rng.float();
        const h = p.height * (0.6 + 0.8 * rng.float());
        const ms = hash32(seed, "mesa", k, j);
        let top = -Infinity;
        for (let y = Math.max(0, Math.floor(my - rad)); y <= Math.min(H - 1, Math.ceil(my + rad)); y++)
          for (let x = Math.max(0, Math.floor(mx - rad)); x <= Math.min(W - 1, Math.ceil(mx + rad)); x++) top = Math.max(top, U[y * W + x]);
        top += h;
        for (let y = Math.max(0, Math.floor(my - 2 * rad)); y <= Math.min(H - 1, Math.ceil(my + 2 * rad)); y++)
          for (let x = Math.max(0, Math.floor(mx - 2 * rad)); x <= Math.min(W - 1, Math.ceil(mx + 2 * rad)); x++) {
            const m = blob(x, y, mx, my, rad, ms, p.soft);
            const i = y * W + x;
            if (m > 0) U[i] = U[i] * (1 - m) + Math.max(U[i], top) * m;
          }
      }
      return;
    }
    case "escarpment": {
      // a long cliff line across the map, wobbling, splitting an upper and a lower world
      const [ux, uy] = unit(p.turn);
      each((x, y, i) => {
        const sd = (x - cx) * ux + (y - cy) * uy + p.extra * fbm(s, x, y, 26, 3);
        U[i] += p.height * (smoothstep(sd / p.soft + 0.5) - 0.5);
      });
      return;
    }
    case "cone": {
      each((x, y, i) => {
        const d = dist(x, y, cx, cy) / (p.size * (1 + 0.15 * fbm(s, x, y, 10, 2)));
        if (d < 1) U[i] += p.height * (1 - d);
        if (p.extra > 0) U[i] -= (p.height * 0.55) * bump(dist(x, y, cx, cy) / p.extra);
      });
      return;
    }
    case "knolls": {
      // hills and knolls scattered over the whole map (decisions-pending #21)
      const rng = stream(seed, "knolls", k);
      const n = Math.round(p.extra);
      for (let j = 0; j < n; j++) {
        const kx = 4 + (W - 8) * rng.float();
        const ky = 4 + (H - 8) * rng.float();
        const rad = 2.5 + 5 * rng.float();
        const h = p.height * (0.5 + rng.float());
        for (let y = Math.max(0, Math.floor(ky - rad)); y <= Math.min(H - 1, Math.ceil(ky + rad)); y++)
          for (let x = Math.max(0, Math.floor(kx - rad)); x <= Math.min(W - 1, Math.ceil(kx + rad)); x++) U[y * W + x] += h * bump(dist(x, y, kx, ky) / rad);
      }
      return;
    }
    case "spiral": {
      // a ramp winding up a peak: height grows with the angle round it, one level per step
      const turns = p.extra;
      each((x, y, i) => {
        const d = dist(x, y, cx, cy);
        if (d > p.size) return;
        // angle as a fraction of a turn from the quadrant and the slope ratio (no atan2)
        const dx = x - cx;
        const dy = y - cy;
        const a = pseudoAngle(dx, dy);
        const lane = (d / p.size) * turns - a;
        const f = lane - Math.floor(lane);
        U[i] += p.height * (1 - d / p.size) + (f < 0.5 ? 0 : -1.2) * (1 - d / p.size);
      });
      return;
    }
  }
}

/** A monotone stand-in for the angle of (dx, dy), 0–1 round the circle, without atan2. */
function pseudoAngle(dx: number, dy: number): number {
  const s = Math.abs(dx) + Math.abs(dy);
  if (s === 0) return 0;
  const p = dy / s; // -1..1
  return clamp((dx < 0 ? 2 - p : p < 0 ? 4 + p : p) / 4, 0, 1);
}
