// The place resolver on rivers flowing in every direction (EDITOR_PLAN §7; M9's flow-relative place
// words). Everything is read from the actual flow: "upstream" must never mean "west".

import { describe, expect, it } from "vitest";
import { network } from "../lib/flow";
import { extent, parse, resolve } from "../lib/places";
import { syntheticMap } from "../lib/synthetic";
import { openSetup, type Setup } from "../lib/fixtures";
import { viewOf, type MapView } from "../lib/view";

type Dir = "north" | "south" | "east" | "west";
const CASES: { name: string; points: [number, number][]; downhill: Dir; heading: string; source: Dir; left: Dir }[] = [
  { name: "north to south", points: [[48, 95], [48, 0]], downhill: "south", heading: "north to south", source: "north", left: "east" },
  { name: "south to north", points: [[40, 0], [40, 95]], downhill: "north", heading: "south to north", source: "south", left: "west" },
  { name: "east to west", points: [[95, 50], [0, 50]], downhill: "west", heading: "east to west", source: "east", left: "south" },
  { name: "west to east", points: [[0, 44], [95, 44]], downhill: "east", heading: "west to east", source: "west", left: "north" },
];

/** +1 when `p` lies toward `dir` from `q`. */
function toward(dir: Dir, p: [number, number], q: [number, number]): boolean {
  if (dir === "north") return p[1] > q[1];
  if (dir === "south") return p[1] < q[1];
  if (dir === "east") return p[0] > q[0];
  return p[0] < q[0];
}

function centroidOf(v: MapView, where: Parameters<typeof resolve>[1], ctx = {}): [number, number] {
  const r = resolve(v, where, ctx);
  expect(r.errors).toEqual([]);
  expect(r.ok).toBe(true);
  return extent(v, r.mask)!.centroid;
}

describe("flow-relative places on straight rivers in all four directions", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const m = syntheticMap({ points: c.points, downhill: c.downhill, start: c.left === "east" || c.left === "west" ? [c.points[0][0] + (c.left === "east" ? 15 : -15), 60] : [60, c.points[0][1] + (c.left === "north" ? 15 : -15)] });
      const v = m.view;
      const net = network(v);
      expect(net.courses).toHaveLength(1);
      const k = net.courses[0];
      expect(k.heading).toBe(c.heading);
      expect(k.evidence).toBe("water"); // read from the settled water surface
      expect(k.surfaceTop).toBeGreaterThan(k.surfaceBottom);
      const mid: [number, number] = [v.W / 2, v.H / 2];
      const up = centroidOf(v, "upstream");
      const down = centroidOf(v, "downstream");
      expect(toward(c.source, up, mid)).toBe(true);
      expect(toward(c.source, down, mid)).toBe(false);
      expect(toward(c.source, centroidOf(v, "near the source"), mid)).toBe(true);
      expect(toward(c.source, centroidOf(v, "near the mouth"), mid)).toBe(false);
      // halfway down sits at the middle of the course
      const half = centroidOf(v, "halfway down");
      expect(Math.hypot(half[0] - mid[0], half[1] - mid[1])).toBeLessThan(4);
      // the left bank, facing downstream
      const left = centroidOf(v, "the left bank");
      expect(toward(c.left, left, mid)).toBe(true);
      // the start's bank and the opposite bank
      const start: [number, number] = [v.start!.x, v.start!.y];
      const same = resolve(v, "the start's bank");
      const opp = resolve(v, "the opposite bank");
      expect(same.mask[start[1] * v.W + start[0]]).toBe(1);
      expect(opp.mask[start[1] * v.W + start[0]]).toBe(0);
      expect(toward(c.left, extent(v, same.mask)!.centroid, mid)).toBe(true);
      // upstream of the start: every tile is above the start on the course
      const s0 = k.field.s[start[1] * v.W + start[0]];
      const upOf = resolve(v, "upstream of the start");
      for (let i = 0; i < upOf.mask.length; i++) if (upOf.mask[i]) expect(k.field.s[i]).toBeLessThan(s0);
      const downOf = resolve(v, "downstream of the start");
      for (let i = 0; i < downOf.mask.length; i++) if (downOf.mask[i]) expect(k.field.s[i]).toBeGreaterThan(s0);
    });
  }

  it("never reads upstream as west: on a river flowing west, upstream is in the east", () => {
    const v = syntheticMap({ points: [[95, 50], [0, 50]], downhill: "west" }).view;
    expect(centroidOf(v, "upstream")[0]).toBeGreaterThan(v.W / 2);
    expect(centroidOf(v, "downstream")[0]).toBeLessThan(v.W / 2);
  });
});

describe("flow-relative places on a curved river", () => {
  it("follows the bends: halfway down is halfway along the course, not across the map", () => {
    const pts: [number, number][] = [[95, 30], [70, 55], [45, 35], [20, 60], [0, 45]];
    const v = syntheticMap({ points: pts, downhill: "west" }).view;
    const k = network(v).courses[0];
    expect(k.heading).toBe("east to west");
    const r = resolve(v, { all: [{ course: [0.4, 0.6] }, { along: "river", within: 3 }] });
    // every tile of the band lies 40–60% along the course
    for (let i = 0; i < r.mask.length; i++) if (r.mask[i]) {
      const f = k.field.s[i] / k.length;
      expect(f).toBeGreaterThanOrEqual(0.4);
      expect(f).toBeLessThanOrEqual(0.6);
    }
    // the source band is near the first point, the mouth band near the last
    const src = extent(v, resolve(v, { all: [{ course: [0, 0.25] }, { along: "river", within: 3 }] }).mask)!.centroid;
    expect(Math.hypot(src[0] - 95, src[1] - 30)).toBeLessThan(25);
    const mouth = extent(v, resolve(v, { all: [{ course: [0.75, 1] }, { along: "river", within: 3 }] }).mask)!.centroid;
    expect(Math.hypot(mouth[0] - 0, mouth[1] - 45)).toBeLessThan(25);
  });
});

// ---------------------------------------------------------------------------------- real maps

const SETUPS: Record<string, Setup> = {
  tribs: { theme: "riverValley", size: 128, seed: 7, settings: { water: { rivers: 3 } } },
  lake: { theme: "lakeBasin", size: 128, seed: 3 },
  creeks: {
    theme: "riverValley",
    size: 96,
    seed: 3,
    edits: [
      { request: "north creek", steps: [{ op: "addRiver", points: [[82.5, 95], [92.5, 70], [70.5, 58], [72.5, 40]], flow: "gentle", handle: "north-creek" }] },
      { request: "south creek", steps: [{ op: "addRiver", points: [[50, 0], [40, 14], [64, 25], [62, 39]], flow: "gentle", handle: "south-creek" }] },
    ],
  },
  east: { theme: "riverValley", size: 128, seed: 1, edits: [{ request: "east creek", steps: [{ op: "addRiver", points: [[127, 95], [120.5, 87], [106.5, 75], [100.5, 65]], flow: "gentle", handle: "east-creek" }] }] },
};

describe("flow on generated and drawn rivers", () => {
  it("tributaries: the north one flows south, the south one flows north, and both are upstream of their junctions", () => {
    const o = openSetup(SETUPS, "tribs");
    const v = viewOf(o.session);
    const net = network(v);
    const north = net.courses.find((c) => c.name === "the north tributary")!;
    const south = net.courses.find((c) => c.name === "the south tributary")!;
    expect(north.heading).toMatch(/north.* to .*south/);
    expect(south.heading).toMatch(/south.* to .*north/);
    // "near the source" of the south tributary is in the south of the map
    const src = centroidOf(v, { course: [0, 0.25], river: "south tributary" });
    expect(src[1]).toBeLessThan(v.H / 3);
    // upstream of a point on the main river below both junctions takes in both tributaries
    const main = net.main!;
    const below = Math.max(north.outlet.joinsAt!, south.outlet.joinsAt!) + 10;
    const p = main.path[0];
    void p;
    const at = (() => {
      for (let i = 0; i < main.field.s.length; i++) if (main.field.d[i] < 1 && Math.abs(main.field.s[i] - below) < 1) return [i % v.W, Math.floor(i / v.W)] as [number, number];
      return null;
    })()!;
    const up = resolve(v, { upstream: at, river: "main river" });
    const k = net.courses.indexOf(north);
    let hits = 0;
    for (let i = 0; i < up.mask.length; i++) if (up.mask[i] && net.owner[i] === k) hits++;
    expect(hits).toBeGreaterThan(50);
  });

  it("lake basin: the south inflow flows north into the lake; its upstream is in the south", () => {
    const o = openSetup(SETUPS, "lake");
    const v = viewOf(o.session);
    const c = network(v).courses.find((k) => k.name === "the inflow from the south edge")!;
    expect(c.heading).toMatch(/to .*north/);
    const up = centroidOf(v, { upstream: null, river: "south inflow" });
    expect(up[1]).toBeLessThan(40);
  });

  it("drawn curved creeks: 'this valley' and 'upstream' follow the selected creek", () => {
    const o = openSetup(SETUPS, "creeks");
    const v = viewOf(o.session);
    const north = { handles: o.conv.handles, selected: o.conv.handles["north-creek"] };
    const south = { handles: o.conv.handles, selected: o.conv.handles["south-creek"] };
    const nc = network(v).byId.get(o.conv.handles["north-creek"])!;
    const sc = network(v).byId.get(o.conv.handles["south-creek"])!;
    expect(nc.heading).toMatch(/north.* to .*south/);
    expect(sc.heading).toMatch(/south.* to .*north/);
    expect(centroidOf(v, "upstream", north)[1]).toBeGreaterThan(v.H / 2);
    expect(centroidOf(v, "upstream", south)[1]).toBeLessThan(v.H / 2);
    // this valley is the creek's, not the main river's
    const valley = resolve(v, "this valley", north);
    const k = network(v).courses.indexOf(nc);
    for (let i = 0; i < valley.mask.length; i++) if (valley.mask[i]) expect(network(v).owner[i]).toBe(k);
  });

  it("a creek drawn from the east edge: upstream is toward the east edge", () => {
    const o = openSetup(SETUPS, "east");
    const v = viewOf(o.session);
    const ctx = { handles: o.conv.handles, selected: o.conv.handles["east-creek"] };
    const up = centroidOf(v, "upstream", ctx);
    const down = centroidOf(v, "downstream", ctx);
    expect(up[0]).toBeGreaterThan(down[0]);
  });
});

describe("compass and feature places", () => {
  it("compass thirds, halves, edges, corners and the center, also on a non-square map", () => {
    const v = syntheticMap({ W: 96, H: 64, points: [[0, 30], [95, 30]], downhill: "east" }).view;
    const all = (w: string) => resolve(v, w).mask;
    const every = (m: Uint8Array, f: (x: number, y: number) => boolean) => {
      for (let i = 0; i < m.length; i++) if (m[i] && !f(i % v.W, Math.floor(i / v.W))) return false;
      return true;
    };
    expect(every(all("the north third"), (_x, y) => y >= 42)).toBe(true);
    expect(every(all("the south half"), (_x, y) => y < 32)).toBe(true);
    expect(every(all("the east edge"), (x) => x >= 88)).toBe(true);
    expect(every(all("the northeast corner"), (x, y) => x >= 64 && y >= 42)).toBe(true);
    expect(every(all("the center"), (x, y) => x >= 32 && x < 64 && y >= 21 && y < 43)).toBe(true);
    expect(every(all("the top of the map"), (_x, y) => y >= 42)).toBe(true);
  });

  it("parses phrases into places and lists the words it ignores", () => {
    expect(parse("halfway down this valley").place).toEqual({ course: [0.4, 0.6] });
    // a named river's course: never the compass word inside its name
    expect(parse("halfway down the north tributary").place).toEqual({ course: [0.4, 0.6], river: "north tributary" });
    expect(parse("near the mouth of the south creek").place).toEqual({ course: [0.75, 1], river: "south tributary" });
    expect(parse("the opposite bank").place).toEqual({ bank: "opposite" });
    expect(parse("just upstream of the start").place).toEqual({ upstream: "start", reach: "just" });
    expect(parse("between the lake and the start").place).toEqual({ between: ["lake", "start"] });
    expect(parse("far from the start").place).toEqual({ far: "start", beyond: 40 });
    expect(parse("the north part").place).toEqual({ compass: "north" });
    expect(parse("closer to the lake").place).toEqual({ closer: "lake" });
    expect(parse("the eastern plateau").place).toEqual({ all: [{ terrain: "high" }, { compass: "east" }] });
    expect(parse("somewhere cozy").ignored).toEqual(["cozy"]);
  });
});
