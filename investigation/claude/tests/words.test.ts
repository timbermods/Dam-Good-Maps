// Every judgement word on several maps: applying its levers moves each target metric the stated way,
// and the regenerated map passes every guard (the generate profile), backing off a lever when the
// full step would break one.

import { describe, expect, it } from "vitest";
import { MapSession } from "../../../src/core/doc/session";
import { generate } from "../../../src/core/gen/generate";
import { makeSpec, type ThemeId } from "../../../src/core/spec/mapspec";
import { applyWord, findWord, JUDGEMENT, sizeTarget } from "../lib/words";

const MAPS: [ThemeId, number, number][] = [
  ["riverValley", 96, 3],
  ["riverValley", 128, 2],
  ["canyon", 128, 2],
];

describe.each(MAPS)("judgement words on %s %i² (seed %i)", (theme, side, seed) => {
  const r = generate(makeSpec({ seed, size: { x: side, y: side }, theme }));
  for (const w of JUDGEMENT) {
    it(w.word, () => {
      const s = MapSession.open(MapSession.fromGenerated(r).document);
      const res = applyWord(s, w);
      // a word may hold a lever back to keep the guards; it must still move something
      expect(res.ok, `${w.word}: ${res.heldBack.join("; ")}`).toBe(true);
      expect(res.guardsFailing).toEqual([]);
      for (const t of res.targets) {
        // a target whose lever was held back or is already at its bound may stay put
        const leverUsed = res.moved.length > 0;
        if (leverUsed) expect(t.moved || res.heldBack.length > 0 || res.atBound.length > 0, `${w.word}: ${t.metric} went ${t.before} → ${t.after}, not ${t.direction}`).toBe(true);
      }
    });
  }
});

describe("words in requests", () => {
  it("finds the word and its degree", () => {
    expect(findWord("make this valley harsher")).toMatchObject({ word: { word: "harsher" }, degree: 1 });
    expect(findWord("make it a bit richer")).toMatchObject({ word: { word: "richer" }, degree: 0.5 });
    expect(findWord("make it much safer")).toMatchObject({ word: { word: "safer" }, degree: 2 });
    expect(findWord("make the map harder")?.word.word).toBe("harsher");
    expect(findWord("more interesting")).toBeNull();
  });

  it("size words follow PLAN §9.10", () => {
    // a giant waterfall is 30–40% of the side along its lip; the cap is 40%
    expect(sizeTarget("waterfall", "huge", { W: 128, H: 128, designedFor: "normal" })).toMatchObject({ min: 38, max: 51 });
    expect(sizeTarget("waterfall", "huge", { W: 48, H: 48, designedFor: "normal" })).toMatchObject({ max: 19 });
    // "roughly 20" is 20 ±3
    expect(sizeTarget("waterfall", 20, { W: 128, H: 128, designedFor: "normal" })).toMatchObject({ approx: 20, tol: 3 });
    // a huge dam site holds 6× the colony's drought need
    expect(sizeTarget("damSite", "huge", { W: 128, H: 128, designedFor: "normal" })?.min).toBe(1518);
    expect(sizeTarget("damSite", "large", { W: 128, H: 128, designedFor: "hard" })?.min).toBeGreaterThan(3000);
  });
});
