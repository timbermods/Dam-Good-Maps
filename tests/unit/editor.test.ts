// The editor's page-side helpers (EDITOR_PLAN §4): plain names, the tiles each feature covers,
// what a click selects, the hover text, how a handle moves a feature, and the features the drawing
// tools make, which must pass the operation checks the worker runs.

import { describe, expect, it } from "vitest";
import { validateOp, emptyState } from "../../src/core/doc/ops";
import type { Feature } from "../../src/core/features/schema";
import { generate } from "../../src/core/gen/generate";
import { makeSpec } from "../../src/core/spec/mapspec";
import { anchorOf, clampMove, describeTile, entitiesByTile, featureName, FeatureIndex, moveBlocked, movePatch, rectOf, rectOutline, rectRuns, tabOf } from "../../src/editor/features";
import { DEFAULT_OPTIONS, featureFromRect, paintOverlay, SELECTED, type ToolKind } from "../../src/editor/tools";
import { entityView, surfaceWater, waterFromDepth } from "../../src/render3d/model";

const W = 64;
const H = 48;
const forest: Feature = { id: "u-forest", kind: "forest", origin: "user", locked: false, params: { area: rectRuns({ x0: 2, y0: 3, x1: 5, y1: 4 }, W), density: 1, speciesMix: { Pine: 1 }, life: "auto", youngShare: 0 } };
const plateau: Feature = { id: "u-plateau", kind: "landform", origin: "user", locked: false, params: { kind: "plateau", edgeStyle: "cliff", outline: rectOutline({ x0: 1, y0: 1, x1: 10, y1: 8 }), height: 9 } };
const start: Feature = { id: "u-start", kind: "start", origin: "generated", locked: false, params: { position: [20, 20], orientation: "Cw0", benchRadius: 4, benchLevel: 5, player: 0 } };
const river: Feature = {
  id: "u-river",
  kind: "river",
  origin: "user",
  locked: false,
  params: { path: [[-1, 30], [20, 30], [40, 34], [64, 34]], width: 3, bedDepth: 1, bedProfile: { start: 4, steps: [] }, flow: 2, style: "straight", entry: { edge: "west" }, exit: { edge: "east" }, badwater: false },
};

describe("feature names and tabs", () => {
  it("names features in plain words", () => {
    expect(featureName(forest)).toBe("Pine forest");
    expect(featureName({ ...forest, params: { ...(forest.params as object), speciesMix: { Pine: 0.5, Oak: 0.5 } } } as Feature)).toBe("Pine and oak forest");
    expect(featureName({ ...forest, params: { ...(forest.params as object), speciesMix: { Pine: 0.4, Oak: 0.3, Birch: 0.3 } } } as Feature)).toBe("Mixed forest");
    expect(featureName(plateau)).toBe("Plateau");
    expect(featureName(start)).toBe("Start");
    expect(featureName(river)).toBe("River");
    expect([forest, plateau, start, river].map(tabOf)).toEqual(["resources", "land", "start", "water"]);
  });
});

describe("the tile index", () => {
  const index = new FeatureIndex(W, H);
  index.update([plateau, river, forest, start]);

  it("covers each feature's tiles", () => {
    expect(index.tilesOf(forest).length).toBe(8);
    // the rectangle outline holds exactly its tiles
    expect(index.tilesOf(plateau).length).toBe(10 * 8);
    expect([...index.tilesOf(start)].sort((a, b) => a - b)).toEqual([19, 20, 21].flatMap((y) => [19, 20, 21].map((x) => y * W + x)).sort((a, b) => a - b));
    expect(index.tilesOf(river).length).toBeGreaterThan(60);
  });

  it("selects the most specific feature first", () => {
    expect(index.candidatesAt(3, 3).map((f) => f.id)).toEqual(["u-forest", "u-plateau"]);
    expect(index.candidatesAt(20, 20).map((f) => f.id)).toEqual(["u-start"]);
    expect(index.candidatesAt(10, 30).map((f) => f.id)).toEqual(["u-river"]);
    expect(index.candidatesAt(50, 5)).toEqual([]);
  });

  it("puts the move handle on the feature", () => {
    const [x, y] = anchorOf(index, forest)!;
    expect(index.tilesOf(forest)).toContain(y * W + x);
    expect(anchorOf(index, start)).toEqual([20, 20]);
  });
});

describe("hover text", () => {
  it("says what stands on a tile", () => {
    const heights = new Uint8Array(W * H).fill(4);
    for (const i of rectRuns({ x0: 1, y0: 1, x1: 10, y1: 8 }, W).flatMap(([y, a, b]) => Array.from({ length: b - a + 1 }, (_, k) => y * W + a + k))) heights[i] = 9;
    const depth = new Float64Array(W * H);
    depth[30 * W + 10] = 0.62;
    const ents = entityView([
      { template: "Pine", x: 3, y: 3, z: 9, orientation: "Cw0", owner: "u-forest" },
      { template: "Birch", x: 30, y: 10, z: 4, orientation: "Cw0", owner: "import", dead: true },
      { template: "RuinColumnH3", x: 31, y: 10, z: 4, orientation: "Cw0", owner: "import" },
    ]);
    const index = new FeatureIndex(W, H);
    index.update([plateau, river, forest]);
    const ctx = { W, H, heights, water: surfaceWater(W, H, waterFromDepth(heights, depth, new Float64Array(W * H))), entities: ents, entitiesAt: entitiesByTile(ents, W), index };
    expect(describeTile(ctx, 3, 3)).toBe("Plateau, height 9, pine forest");
    expect(describeTile(ctx, 10, 30)).toBe("River, height 4, water 0.6 deep");
    expect(describeTile(ctx, 30, 10)).toBe("Height 4, dead birch");
    expect(describeTile(ctx, 31, 10)).toBe("Height 4, ruin column, 3 high");
  });
});

describe("moving a feature", () => {
  const heights = new Uint8Array(W * H).fill(6);

  it("shifts areas, outlines and the start, whose bench takes the new ground", () => {
    expect(movePatch(forest, 2, -1, W, H, heights)).toEqual({ params: { area: [[2, 4, 7], [3, 4, 7]] } });
    expect((movePatch(plateau, 1, 1, W, H, heights).params as { outline: number[][] }).outline[0]).toEqual([1.5, 1.5]);
    heights[20 * W + 23] = 7;
    expect(movePatch(start, 3, 0, W, H, heights)).toEqual({ params: { position: [23, 20], benchLevel: 7 } });
  });

  it("keeps a river's mouth on its edge", () => {
    const p = (movePatch(river, 0, 4, W, H, heights).params as { path: number[][] }).path;
    expect(p).toEqual([[-1, 34], [20, 34], [40, 38], [64, 38]]);
    const q = (movePatch(river, 3, 0, W, H, heights).params as { path: number[][] }).path;
    expect(q[0]).toEqual([-1, 30]);
    expect(q[1]).toEqual([23, 30]);
    expect(q[3]).toEqual([64, 34]);
  });

  it("stops at the map's edge, and says why a feature cannot move", () => {
    expect(clampMove(forest, -10, -10, W, H)).toEqual([-2, -3]);
    expect(clampMove(start, 100, 0, W, H)).toEqual([W - 1 - 21, 0]);
    expect(moveBlocked(forest)).toBeNull();
    expect(moveBlocked({ ...plateau, params: { kind: "valley", edgeStyle: "gentle", along: { river: "r", halfWidth: 4, floorAboveBed: 1 } } } as Feature)).toMatch(/follows its river/);
  });
});

describe("the drawing tools", () => {
  const heights = new Uint8Array(W * H).fill(3);
  heights[5 * W + 5] = 11;
  const rect = rectOf([8, 9], [2, 3], W, H);

  it("make features the worker accepts", () => {
    expect(rect).toEqual({ x0: 2, y0: 3, x1: 8, y1: 9 });
    const ctx = { state: emptyState([]), W, H, generated: true, entityIds: new Set<string>(), slopeTiles: new Set<number>(), lockedColumns: null };
    for (const kind of ["plateau", "forest", "berryPatch", "ruinField"] as ToolKind[]) {
      const f = featureFromRect(kind, rect, { ...DEFAULT_OPTIONS, height: 0, density: 0.5, species: "mixed" }, W, heights);
      expect(f.origin).toBe("user");
      expect(validateOp({ op: "addFeature", params: { feature: f } }, ctx), kind).toEqual([]);
    }
    // a plateau two levels above the highest ground under it, unless a height is picked
    expect((featureFromRect("plateau", rect, { ...DEFAULT_OPTIONS, height: 0, density: 1, species: "Pine" }, W, heights).params as { height: number }).height).toBe(13);
    expect((featureFromRect("plateau", rect, { ...DEFAULT_OPTIONS, height: 7, density: 1, species: "Pine" }, W, heights).params as { height: number }).height).toBe(7);
  });

  it("paint the overlay", () => {
    const data = new Uint8Array(W * H * 4);
    paintOverlay(data, W, H, [{ tiles: [W + 1], color: SELECTED, dx: 1 }]);
    expect([...data.subarray((W + 2) * 4, (W + 2) * 4 + 4)]).toEqual(SELECTED);
    expect(data[(W + 1) * 4 + 3]).toBe(0);
  });
});

describe("a generated map's features in the index", () => {
  it("every feature of a 96² map covers tiles, and the start is found under its tile", () => {
    const r = generate(makeSpec({ seed: 3, size: { x: 96, y: 96 } }));
    const index = new FeatureIndex(96, 96);
    index.update(r.features);
    for (const f of r.features) expect(index.tilesOf(f).length, `${f.kind} ${f.id}`).toBeGreaterThan(0);
    const s = r.features.find((f) => f.kind === "start")!;
    const [x, y] = (s.params as { position: [number, number] }).position;
    expect(index.candidatesAt(x, y)[0].id).toBe(s.id);
  });
});
