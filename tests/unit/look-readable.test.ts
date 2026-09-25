// Map look's fix round (PLAN §20 D114): every meaning reads in greyscale and with any colour
// blindness, never by colour alone. The meanings keep an order of lightness; dam sites are hatched
// with a dark rim; dead trees, slope arrows and the start keep a minimum size from afar; the legend
// names every meaning the view draws.

import { describe, expect, it } from "vitest";
import { ShaderMaterial } from "three";
import { DAM } from "../../src/editor/tools";
import { buildEntities } from "../../src/render3d/entities3d";
import { hatchMarks } from "../../src/render3d/materials";
import { entityView } from "../../src/render3d/model";
import { DAM_OVERLAY, DAM_SITE, damLegendSwatch, DEAD_TREE, GROUND, HATCH, LIVING_TREE, cssColor, legendEntries, objectLegend, WATER } from "../../src/render3d/palette";

const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

type Mesh = { name: string; count: number; geometry: { getAttribute(n: string): { array: ArrayLike<number>; itemSize: number } | undefined } };

describe("the meanings in lightness", () => {
  it("keep their order: dead trees, moist, dry, contaminated ground, badwater", () => {
    expect(lum(DEAD_TREE)).toBeGreaterThan(lum(GROUND.moistLow) + 0.1);
    expect(lum(GROUND.moistHigh)).toBeGreaterThan(lum(GROUND.dry) + 0.2);
    expect(lum(GROUND.dry)).toBeGreaterThan(lum(GROUND.contaminated) + 0.15);
    expect(lum(GROUND.contaminated)).toBeGreaterThan(lum(WATER.bad) + 0.09);
    // clean water is well lighter than badwater at any depth
    expect(lum(WATER.deep)).toBeGreaterThan(lum(WATER.bad) + 0.18);
    expect(lum(WATER.shallow)).toBeGreaterThan(lum(WATER.bad) + 0.4);
    // living trees are dark, dead trees nearly white
    expect(lum(DEAD_TREE) - lum(LIVING_TREE)).toBeGreaterThan(0.55);
    // a dam site's stripes: light and dark
    expect(lum(DAM_SITE) - lum(HATCH.dark)).toBeGreaterThan(0.7);
  });
});

describe("dam sites", () => {
  it("are hatched (alpha 255), in the editor and the preview alike", () => {
    expect(DAM_OVERLAY[3]).toBe(255);
    expect([...DAM]).toEqual([...DAM_OVERLAY]);
  });

  it("mark the hatched tiles and their neighbours, for the rim", () => {
    const W = 5;
    const H = 4;
    const overlay = new Uint8Array(W * H * 4);
    overlay.set([255, 214, 41, 255], (2 * W + 2) * 4); // (2, 2) hatched
    overlay.set([255, 208, 90, 105], (1 * W + 1) * 4); // a selection tint: not hatched
    const m = hatchMarks(W, H, overlay);
    const r = (x: number, y: number) => m[(y * W + x) * 4];
    const g = (x: number, y: number) => m[(y * W + x) * 4 + 1];
    expect(r(2, 2)).toBe(1);
    expect(r(1, 2)).toBe(2); // its east neighbour is hatched
    expect(r(3, 2)).toBe(4); // west
    expect(r(2, 1)).toBe(8); // north
    expect(r(2, 3)).toBe(16); // south
    expect(g(1, 1)).toBe(1); // north-east
    expect(g(3, 3)).toBe(8); // south-west
    expect(r(1, 1)).toBe(0);
    expect(r(0, 0) + g(0, 0)).toBe(0);
  });
});

describe("objects from afar", () => {
  const view = entityView([
    { template: "Pine", x: 1, y: 1, z: 2, orientation: "Cw0", owner: "f" },
    { template: "Pine", x: 3, y: 1, z: 2, orientation: "Cw0", owner: "f", dead: true },
    { template: "Birch", x: 5, y: 1, z: 2, orientation: "Cw0", owner: "f", dead: true },
    { template: "Slope", x: 7, y: 1, z: 2, orientation: "Cw90", owner: "f" },
    { template: "StartingLocation", x: 10, y: 10, z: 2, orientation: "Cw0", owner: "s" },
    { template: "RuinColumnH2", x: 12, y: 1, z: 2, orientation: "Cw0", owner: "f" },
  ]);
  const meshes = new Map((buildEntities(view, new ShaderMaterial()).group.children as unknown as Mesh[]).map((c) => [c.name, c]));
  const grow = (name: string) => Array.from(meshes.get(name)!.geometry.getAttribute("grow")!.array);

  it("dead trees, slope arrows and the start have a minimum size; living trees and ruins do not", () => {
    expect(grow("Pine.dead")[0]).toBeGreaterThan(0);
    expect(grow("Birch.dead")[0]).toBeGreaterThan(0);
    expect(grow("start")[0]).toBeGreaterThan(0);
    expect(grow("Slope.mark")[0]).toBeGreaterThan(0);
    expect(grow("Pine")[0]).toBe(0);
    expect(grow("Slope")[0]).toBe(0);
    for (const [k, m] of meshes) if (k.startsWith("scaffold")) expect(grow(k)[0]).toBe(0);
    expect(meshes.get("Slope.mark")!.count).toBe(1);
  });

  it("a dead tree is ashen: pale all over, a body of bare wood and no green", () => {
    const col = meshes.get("Pine.dead")!.geometry.getAttribute("pcolor")!.array;
    for (let k = 0; k < col.length; k += 3) expect(lum([col[k], col[k + 1], col[k + 2]])).toBeGreaterThan(0.6);
    const living = meshes.get("Pine")!.geometry.getAttribute("pcolor")!.array;
    let dark = 0;
    for (let k = 0; k < living.length; k += 3) if (lum([living[k], living[k + 1], living[k + 2]]) < 0.35) dark++;
    expect(dark / (living.length / 3)).toBeGreaterThan(0.6);
  });
});

describe("the legend", () => {
  it("names every meaning the view draws", () => {
    const labels = [...legendEntries("moisture"), ...objectLegend()].map((e) => e.label);
    for (const want of [/Moist/, /Dry/, /Contaminated/, /^Water: darker is deeper/, /^Badwater$/, /mixed with badwater/, /Walls/, /dead/, /Living trees/, /The start/, /Slopes: arrows point uphill/, /Ruins/, /Mine site/, /Geothermal field/, /Water source/, /Badwater source/, /blocks/])
      expect(labels.some((l) => want.test(l)), String(want)).toBe(true);
    // the dam site's swatch is hatched light and dark
    const dam = decodeURIComponent(/url\("data:image\/svg\+xml,([^"]*)"\)/.exec(damLegendSwatch())![1]);
    expect(dam).toContain(cssColor(DAM_SITE));
    expect(dam).toContain(cssColor(HATCH.dark));
  });
});
