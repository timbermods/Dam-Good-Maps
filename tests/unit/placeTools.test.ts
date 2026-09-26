// The shelf's and Remove's pointer tools (PLAN §20 D184): a click places, a drag paints trees and
// plants them once on release; Remove glows under the pointer, a click takes a tile, a drag its
// rectangle.

import { describe, expect, it } from "vitest";
import { removeTool, shelfTool } from "../../src/editor/placeTools";
import { quietWord } from "../../src/editor/shelfItems";
import type { TileHit } from "../../src/render3d";

const hit = (x: number, y: number) => ({ x, y }) as TileHit;
const ev = (button = 0) => ({ button, clientX: 0, clientY: 0 }) as PointerEvent;
const W = 20;

describe("the shelf's pointer tool", () => {
  it("a click places; a drag with trees paints along the way and plants once", () => {
    const log: string[] = [];
    let painting: number[] | null = null;
    const host = (trees: boolean) => ({
      W,
      H: W,
      hover: (h: TileHit | null) => log.push(`hover ${h ? `${h.x},${h.y}` : "off"}`),
      place: (x: number, y: number) => log.push(`place ${x},${y}`),
      paintAround: (x: number, y: number) => (trees ? [Math.floor(y) * W + Math.floor(x)] : null),
      painting: (t: number[] | null) => void (painting = t),
      plant: (t: number[]) => log.push(`plant ${t.length}`),
    });
    const click = shelfTool(host(false));
    click.down(hit(3, 4), ev());
    click.up(hit(3, 4), ev());
    expect(log).toEqual(["place 3,4"]);
    log.length = 0;
    const drag = shelfTool(host(true));
    drag.down(hit(2, 2), ev());
    drag.move(hit(6, 2), ev());
    expect(painting!.length).toBe(5);
    drag.up(hit(6, 2), ev());
    expect(log.filter((l) => !l.startsWith("hover"))).toEqual(["plant 5"]);
    expect(painting).toBeNull();
    // a click with trees plants one, as a place
    log.length = 0;
    drag.down(hit(8, 8), ev());
    drag.up(hit(8, 8), ev());
    expect(log).toEqual(["place 8,8"]);
    // the right button is the camera's
    expect(drag.down(hit(1, 1), ev(2))).toBe(false);
  });
});

describe("Remove's pointer tool", () => {
  it("glows under the pointer; a click takes a tile, a drag a rectangle", () => {
    const removed: number[][] = [];
    const lit: (number[] | null)[] = [];
    const t = removeTool({
      W,
      H: W,
      objectsOn: (tiles) => tiles.filter((i) => i % 2 === 0),
      highlight: (c) => lit.push(c),
      drawing: () => undefined,
      remove: (tiles) => removed.push(tiles),
    });
    t.hover!(hit(2, 0), ev());
    expect(lit.at(-1)).toEqual([2]);
    t.down(hit(3, 3), ev());
    t.up(hit(3, 3), ev());
    expect(removed).toEqual([[63]]);
    t.down(hit(1, 1), ev());
    t.move(hit(3, 2), ev());
    t.up(hit(3, 2), ev());
    expect(removed.at(-1)!.length).toBe(6);
    expect(lit.at(-1)).toBeNull();
  });
});

describe("the shelf's quiet words (D184)", () => {
  it("say why in a word or two", () => {
    expect(quietWord("it would stand inside the ground: the ground under it is not level")).toBe("needs level ground");
    expect(quietWord("the district center stands there")).toBe("the start stands there");
    expect(quietWord("a mine site stands there")).toBe("a mine site is there");
    expect(quietWord("too close to the map edge")).toBe("too near the edge");
    expect(quietWord("under water")).toBe("under water");
  });
});
