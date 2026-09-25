// Map look's third round (PLAN §20 D115): clean water sits between dry and moist ground in
// lightness; each water top shows its own tile's badwater share (so water partly bad never looks
// pure); a slope's arrow is level and floats above the slope, pointing uphill, so it reads from
// any camera angle; ruins stand apart from contaminated ground; and the light look (software
// rendering) draws each model once, however many objects use it.

import { describe, expect, it } from "vitest";
import { ShaderMaterial } from "three";
import { buildEntities, SLOPE_ARROW_HEIGHT } from "../../src/render3d/entities3d";
import { entityView, surfaceWater, waterFromDepth } from "../../src/render3d/model";
import { GROUND, RUIN, WATER } from "../../src/render3d/palette";
import { lowerByTile, meshWaterChunk } from "../../src/render3d/waterMesh";

const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

type Mesh = { name: string; count: number; geometry: { getAttribute(n: string): { array: ArrayLike<number>; count: number } } };

describe("water", () => {
  it("is lighter than dry ground at any depth, and darker than moist ground", () => {
    expect(lum(WATER.deep)).toBeGreaterThan(lum(GROUND.dry) + 0.05);
    expect(lum(WATER.shallow)).toBeGreaterThan(lum(WATER.deep));
    expect(lum(WATER.shallow)).toBeLessThan(lum(GROUND.moistLow));
  });

  it("shows each tile's own badwater share on its top", () => {
    // four tiles in a row at one level: pure badwater, a third bad, a tenth bad, clean
    const W = 4;
    const heights = new Uint8Array([2, 2, 2, 2]);
    const shares = [1, 0.33, 0.1, 0];
    const view = waterFromDepth(heights, [0.6, 0.6, 0.6, 0.6], shares);
    const sw = surfaceWater(W, 1, view);
    const m = meshWaterChunk(W, 1, heights, sw, view, lowerByTile(sw, view), 0, 0);
    for (let q = 0; q < m.quads; q++) {
      if (m.normals[q * 12 + 1] <= 0) continue;
      const x = Math.round(Math.min(m.positions[q * 12], m.positions[q * 12 + 3], m.positions[q * 12 + 6]));
      for (let v = 0; v < 4; v++) expect(m.data[(q * 4 + v) * 2 + 1]).toBeCloseTo(shares[x], 5);
    }
  });
});

describe("slopes", () => {
  const view = entityView([{ template: "Slope", x: 3, y: 3, z: 2, orientation: "Cw0", owner: "f" }]);
  const meshes = new Map((buildEntities(view, new ShaderMaterial()).group.children as unknown as Mesh[]).map((c) => [c.name, c]));

  it("have a level arrow just above the slope's top, pointing uphill", () => {
    expect(SLOPE_ARROW_HEIGHT).toBeGreaterThan(1);
    const g = meshes.get("Slope.mark")!.geometry;
    const nrm = g.getAttribute("normal").array;
    for (let k = 1; k < nrm.length; k += 3) expect(nrm[k]).toBeCloseTo(1, 5);
    // the tip is the vertex farthest toward the high side (+Z in the model), on the middle line
    const pos = g.getAttribute("position").array;
    let tip = 0;
    for (let k = 0; k < pos.length; k += 3) if (pos[k + 2] > pos[tip + 2]) tip = k;
    expect(pos[tip + 2]).toBeGreaterThan(0.4);
    expect(Math.abs(pos[tip])).toBeLessThan(0.01);
  });
});

describe("ruins", () => {
  it("are grey-brown metal, apart from rusty contaminated ground", () => {
    const hue = (c: readonly number[]) => c[0] - c[2];
    expect(lum(RUIN.body)).toBeGreaterThan(lum(GROUND.contaminated) + 0.12);
    expect(hue(RUIN.body)).toBeLessThan(hue(GROUND.contaminated) - 0.15);
  });
});

describe("the light look", () => {
  it("draws each model once, whatever the number of objects", () => {
    const list = Array.from({ length: 40 }, (_, k) => ({ template: k % 2 ? "Pine" : "Oak", x: k, y: k % 5, z: 2, orientation: "Cw0", owner: "f", dead: k % 4 === 0 }));
    const lite = buildEntities(entityView(list), new ShaderMaterial(), null, 0, true).group.children as unknown as Mesh[];
    const full = new Map((buildEntities(entityView(list), new ShaderMaterial()).group.children as unknown as Mesh[]).map((c) => [c.name, c.count]));
    for (const m of lite) {
      expect(m.count).toBe(1);
      const of = full.get(m.name.replace(/\.lite$/, ""))!;
      expect(of).toBeGreaterThan(0);
      expect(m.geometry.getAttribute("position").count % of).toBe(0);
    }
  });
});
