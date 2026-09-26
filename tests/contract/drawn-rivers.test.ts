// Rivers drawn in the editor, by D180's rules (live editing): drawn from existing water, a river
// is a branch of it (no source of its own, its bed starting at that water's bed); its end may lie on
// dry ground, where its water fills the hollow there or runs on downhill; drawn into a river, its
// bed never drops below that river's; Natural gives the same gentle meanders for the same stroke,
// its ends where they were drawn. The rivers the generator plans are not drawn, so none of this
// touches a generated map (the determinism and byte tests hold them).

import { describe, expect, it } from "vitest";
import { MapSession } from "../../src/core/doc/session";
import { meandered, planContextOf, planRiver } from "../../src/core/doc/tools";
import { bedAt } from "../../src/core/features/geometry";
import { hollowAt } from "../../src/core/features/hollow";
import type { Point, RiverFeature } from "../../src/core/features/schema";
import { generate } from "../../src/core/gen/generate";
import { makeSpec } from "../../src/core/spec/mapspec";

const W = 96;

function open(): MapSession {
  const r = generate(makeSpec({ seed: 4242, size: { x: W, y: W }, theme: "riverValley" }));
  const s = MapSession.fromGenerated(r, r.file);
  s.setWaterMode("defer");
  return s;
}

const main = (s: MapSession) => s.features.find((f): f is RiverFeature => f.kind === "river" && f.origin === "generated")!;
const column = (x: number, from: number, to: number, n = 12): Point[] => Array.from({ length: n + 1 }, (_, k) => [x, Math.round(from + ((to - from) * k) / n)] as Point);
const ctxOf = (s: MapSession) => ({ ...planContextOf(s), water: s.built.water });

describe("rivers drawn in the editor (D180)", () => {
  it("drawn from a river, a river is a branch of it: no source of its own, its bed from that river's bed", () => {
    const s = open();
    const m = main(s);
    const start = s.built.start!;
    const x = start.x < W / 2 ? Math.round(W * 0.62) : Math.round(W * 0.38);
    const from = m.params.path.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best));
    const pts = column(Math.round(from[0]), Math.round(from[1]), 0);
    const plan = planRiver({ points: pts, flow: 2, drawn: true }, ctxOf(s), "f-branchaaaaaaa", "user");
    expect(plan.ok, plan.ok ? "" : plan.errors.join()).toBe(true);
    if (!plan.ok) return;
    const f = plan.feature as RiverFeature;
    expect(Object.keys(f.params.entry)).toEqual(["branch"]);
    expect(f.params.exit).toEqual({ edge: "south" });
    // its bed starts no higher than the bed of the river it leaves
    expect(f.params.bedProfile.start).toBeLessThanOrEqual(s.built.heights[Math.round(from[1]) * W + Math.round(from[0])]);
    expect(s.applyAll(plan.ops, "user", plan.label).ok).toBe(true);
    // no water source of its own
    expect(s.built.entities.filter((e) => e.owner === f.id && /Source$/.test(e.template))).toEqual([]);
  });

  it("an end on dry ground: its water fills the hollow there, or runs on downhill, and it is placed", () => {
    const s = open();
    const start = s.built.start!;
    const x = start.x < W / 2 ? Math.round(W * 0.8) : Math.round(W * 0.2);
    // from the north edge a third of the way down
    const pts = column(x, W - 1, Math.round(W * 0.8), 6);
    const plan = planRiver({ points: pts, flow: 1, drawn: true }, ctxOf(s), "f-hollowaaaaaaa", "user");
    expect(plan.ok, plan.ok ? "" : plan.errors.join()).toBe(true);
    if (!plan.ok) return;
    const f = plan.feature as RiverFeature;
    expect(Object.keys(f.params.exit)).toEqual(["basin"]);
    expect(plan.end?.kind === "hollow" || plan.end?.kind === "downhill").toBe(true);
    expect(plan.report.some((l) => /fills the hollow at its end|runs on downhill from its end/.test(l))).toBe(true);
    expect(s.applyAll(plan.ops, "user", plan.label).ok).toBe(true);
    // the same stroke, not drawn in the editor, is refused as before
    const old = planRiver({ points: pts, flow: 1 }, planContextOf(s), "f-hollowaaaaaab", "user");
    expect(old.ok).toBe(false);
  });

  it("drawn into a river, its bed never drops below that river's bed", () => {
    const s = open();
    const m = main(s);
    const start = s.built.start!;
    const x = start.x < W / 2 ? Math.round(W * 0.78) : Math.round(W * 0.22);
    const join = m.params.path.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best));
    const plan = planRiver({ points: column(x, W - 1, Math.round(join[1]) + 1), flow: 2, drawn: true }, ctxOf(s), "f-joinaaaaaaaaa", "user");
    expect(plan.ok, plan.ok ? "" : plan.errors.join()).toBe(true);
    if (!plan.ok) return;
    const f = plan.feature as RiverFeature;
    expect(f.params.exit).toEqual({ river: m.id });
    let joinBed = Infinity;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = (Math.round(join[1]) + dy) * W + Math.round(join[0]) + dx;
      if (s.built.channel[i]) joinBed = Math.min(joinBed, s.built.heights[i]);
    }
    const bedEnd = bedAt(f.params.bedProfile, Infinity);
    expect(bedEnd).toBeGreaterThanOrEqual(joinBed);
  });

  it("Natural meanders the same way for the same stroke, and keeps both ends where they were drawn", () => {
    const pts: Point[] = [[10, 90], [30, 60], [50, 40], [70, 12]];
    const a = meandered(pts, 3, W, W);
    const b = meandered(pts, 3, W, W);
    expect(a).toEqual(b);
    expect(a[0]).toEqual([10, 90]);
    expect(a[a.length - 1]).toEqual([70, 12]);
    // it wanders off the straight line a little, never far
    const off = (p: Point) => {
      let best = Infinity;
      for (let k = 0; k + 1 < pts.length; k++) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const t = Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
        best = Math.min(best, Math.hypot(ax + t * (bx - ax) - p[0], ay + t * (by - ay) - p[1]));
      }
      return best;
    };
    const most = Math.max(...a.map(off));
    expect(most).toBeGreaterThan(0.5);
    expect(most).toBeLessThan(6);
  });

  it("a hollow fills to the level of its lowest rim; on a slope, water runs on downhill", () => {
    // a bowl: level 5 ground, a 3×3 pit of level 2, and a level-3 channel from it to the east edge
    const n = 12;
    const h = new Uint8Array(n * n).fill(5);
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) h[y * n + x] = 2;
    for (let x = 7; x < n; x++) h[5 * n + x] = 3;
    const bowl = hollowAt(h, null, n, n, 5, 5);
    expect(bowl.fills).toBe(true);
    expect(bowl.level).toBe(3);
    expect(bowl.tiles).toBeGreaterThanOrEqual(9);
    // a ramp: every tile a level lower to the west
    const r = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[y * n + x] = x;
    expect(hollowAt(r, null, n, n, 6, 6).fills).toBe(false);
  });
});
