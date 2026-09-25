// Map look (PLAN §20 D86) on the worker's side: the 3D view gets the soil its ground is coloured
// by, and it follows the water. After an edit that moves water the view is updated twice (the
// warm-started preview, then the exact settle in the background, M8), and the soil comes with
// each; an imported map shows the soil its file stores, as it shows the file's water.

import { describe, expect, it } from "vitest";
import { writeTimber } from "../../src/core/format/timber";
import { generate } from "../../src/core/gen/generate";
import { makeSpec } from "../../src/core/spec/mapspec";
import { soilView } from "../../src/render3d/model";
import { runGenerate } from "../../src/worker/api";
import * as ed from "../../src/worker/session";

const W = 96;

describe("the soil the 3D view shows", () => {
  it("comes with the map, and again with each of the two water updates after an edit", async () => {
    const spec = makeSpec({ seed: 21, size: { x: W, y: W } });
    const gen = await runGenerate(spec);
    const open = ed.refine();
    const expected = soilView(gen.moisture, gen.soilContamination);
    expect(open.view.soil).toBeDefined();
    expect(Buffer.from(open.view.soil!.moisture).equals(Buffer.from(expected.moisture))).toBe(true);
    expect(Buffer.from(open.view.soil!.contamination).equals(Buffer.from(expected.contamination))).toBe(true);
    expect(open.view.soil!.moisture.some((m) => m > 0)).toBe(true);
    expect(open.view.soil!.moisture.some((m) => m === 0)).toBe(true);

    // lower ground beside the water: the water moves, so the soil follows
    const depth = new Map<number, number>();
    for (let k = 0; k < open.view.water.count; k++) depth.set(open.view.water.tile[k], open.view.water.depth[k]);
    let at: [number, number] | null = null;
    for (let i = 0; i < W * W && !at; i += 5) {
      const x = i % W;
      const y = Math.floor(i / W);
      if (x < 10 || y < 10 || x > W - 11 || y > W - 11 || depth.has(i)) continue;
      for (let d = -3; d <= 3 && !at; d++) if ((depth.get(i + d) ?? 0) > 0.3) at = [x, y];
    }
    const cells: [number, number, number][] = [];
    for (let y = at![1] - 2; y <= at![1] + 2; y++) cells.push([y, at![0] - 2, at![0] + 2]);
    const u = ed.apply({ op: "sculpt", params: { mode: "lower", cells, amount: 2 } }, "user", "Lower terrain");
    expect(u.ok).toBe(true);
    expect(u.view.water).toBeDefined();
    expect(u.view.soil).toBeDefined();
    // the background check puts the exact settle in place: water and soil again
    const bg = await ed.backgroundCheck();
    expect(bg).not.toBeNull();
    if (bg!.view.water) expect(bg!.view.soil).toBeDefined();
    // an edit that moves no water (a tree cut) sends no soil
    const pine = gen.entities.find((e) => e.template === "Pine")!;
    const ids = ed.entitiesAt(pine.x, pine.y).map((e) => e.id);
    const cut = ed.apply({ op: "deleteEntities", params: { entities: ids } }, "user", "Cut a tree");
    expect(cut.ok).toBe(true);
    expect(cut.view.entities).toBeDefined();
    expect(cut.view.water).toBeUndefined();
    expect(cut.view.soil).toBeUndefined();
  });

  it("is the file's own on an imported map", () => {
    const r = generate(makeSpec({ seed: 9, size: { x: W, y: W } }));
    const open = ed.openTimber(writeTimber(r.file), "Mine.timber");
    const expected = soilView(r.built.moisture, r.built.soilContamination);
    expect(open.view.soil).toBeDefined();
    expect(Buffer.from(open.view.soil!.moisture).equals(Buffer.from(expected.moisture))).toBe(true);
    expect(Buffer.from(open.view.soil!.contamination).equals(Buffer.from(expected.contamination))).toBe(true);
  });
});
