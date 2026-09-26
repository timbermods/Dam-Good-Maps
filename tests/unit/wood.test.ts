// Starting wood (D164) and saplings: a tree's growth read as the file stores it. The parser keeps a
// float as a JsonFloat, and older files wrap values as {"Value": …}; the page once read the growth
// with Number(), which gave NaN for a JsonFloat, so no sapling ever read as young (the 3D view drew
// them grown, the hover never said "young", and wood counted them as grown).

import { describe, expect, it } from "vitest";
import { growthOf, isSapling, treeLogs, woodDetail, woodWords } from "../../src/core/analysis/wood";
import { F, parse, type JsonObject } from "../../src/core/format/json";
import { tree } from "../../src/core/format/entities";
import { lifeOf } from "../../src/worker/api";
import { entityView, YOUNG } from "../../src/render3d/model";

describe("a tree's growth (Growable.GrowthProgress)", () => {
  it("a sapling reads as a sapling, in every form the value takes", () => {
    for (const v of [0.5, F(0.5), { Value: 0.5 }, { Value: F(0.5) }] as JsonObject[keyof JsonObject][]) {
      const c = { Growable: { GrowthProgress: v } } as JsonObject;
      expect(growthOf(c)).toBe(0.5);
      expect(isSapling(c)).toBe(true);
      expect(lifeOf(c as Record<string, unknown>).young).toBe(true);
    }
    // as the generator writes it, and as a file is read back
    const e = tree({ id: "t", owner: "o", x: 1, y: 1, z: 3, species: "Oak", growth: 0.3 });
    expect(isSapling(e.components)).toBe(true);
    const read = parse(JSON.stringify({ Growable: { GrowthProgress: 0.3 } })) as JsonObject;
    expect(isSapling(read)).toBe(true);
  });

  it("a grown tree has no Growable, a growth of 1, or no readable growth: never a made-up number", () => {
    const grown = [{}, { Growable: { GrowthProgress: F(1) } }, { Growable: {} }, { Growable: { GrowthProgress: "half" } }, { Growable: { GrowthProgress: null } }, { Growable: 0.5 }] as JsonObject[];
    for (const c of grown) {
      expect(isSapling(c), JSON.stringify(c)).toBe(false);
      expect(lifeOf(c as Record<string, unknown>).young, JSON.stringify(c)).toBeUndefined();
    }
    expect(growthOf({})).toBeNull();
    expect(growthOf({ Growable: { GrowthProgress: "half" } })).toBeNull();
    expect(isSapling(tree({ id: "t", owner: "o", x: 1, y: 1, z: 3, species: "Oak" }).components)).toBe(false);
  });

  it("the page marks saplings young (the 3D view draws them small, the hover says so)", () => {
    const young = tree({ id: "t", owner: "o", x: 1, y: 1, z: 3, species: "Pine", growth: 0.4 });
    const grown = tree({ id: "u", owner: "o", x: 2, y: 1, z: 3, species: "Pine" });
    const v = entityView([
      { template: "Pine", x: 1, y: 1, z: 3, orientation: "Cw0", owner: "o", ...lifeOf(young.components as Record<string, unknown>) },
      { template: "Pine", x: 2, y: 1, z: 3, orientation: "Cw0", owner: "o", ...lifeOf(grown.components as Record<string, unknown>) },
    ]);
    expect(v.flags[0] & YOUNG).toBe(YOUNG);
    expect(v.flags[1] & YOUNG).toBe(0);
  });
});

describe("a tree's logs", () => {
  it("each species' yield, what the file holds when it is logs, and none from anything else", () => {
    expect(treeLogs("Oak", {})).toBe(8);
    expect(treeLogs("Pine", {})).toBe(2);
    expect(treeLogs("Birch", {})).toBe(1);
    expect(treeLogs("Succulent", {})).toBe(0);
    expect(treeLogs("BlueberryBush", {})).toBe(0);
    expect(treeLogs("Oak", { "Yielder:Cuttable": { Yield: { Good: "Log", Amount: 5 } } })).toBe(5);
    expect(treeLogs("Oak", { "Yielder:Cuttable": { Yield: { Good: "Log", Amount: { Value: 6 } } } })).toBe(6);
    // another good is ignored, as the game ignores it
    expect(treeLogs("Oak", { "Yielder:Cuttable": { Yield: { Good: "Water", Amount: 2 } } })).toBe(8);
    expect(treeLogs("Oak", { "Yielder:Cuttable": { Yield: { Good: "Log", Amount: "many" } } })).toBe(8);
  });

  it("says the wood in plain words", () => {
    expect(woodWords({ Oak: 80, Pine: 0, Birch: 0 })).toBe("all oak");
    expect(woodWords({ Oak: 80, Pine: 20, Birch: 5 })).toBe("mostly oak");
    expect(woodWords({ Oak: 40, Pine: 50, Birch: 10 })).toBe("pine and oak");
    expect(woodWords({ Oak: 0, Pine: 0, Birch: 0 })).toBe("");
    expect(woodDetail({ Oak: 80, Pine: 0, Birch: 0 }, 11)).toBe(", all oak, plus about 11 growing");
    expect(woodDetail({ Oak: 0, Pine: 0, Birch: 0 }, 0)).toBe("");
  });
});
