// Contract (PLAN §15): the MapSpec schema accepts every preset and rejects out-of-bound values; the
// eval-free checker the app uses agrees with Ajv on the same schema.

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { decodeSpecFragment, encodeSpecFragment, makeSpec, seedFromText, THEMES, type MapSpec } from "../../src/core/spec/mapspec";
import { MAPSPEC_SCHEMA, validateSpec } from "../../src/core/spec/schema";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const ajvValidate = ajv.compile(MAPSPEC_SCHEMA);

function both(spec: unknown): [boolean, boolean] {
  return [validateSpec(spec).length === 0, ajvValidate(spec) as boolean];
}

describe("MapSpec schema", () => {
  it("accepts every theme preset at every difficulty and size preset", () => {
    for (const theme of THEMES)
      for (const d of ["easy", "normal", "hard"] as const)
        for (const s of [48, 96, 128, 192, 256]) {
          const spec = makeSpec({ seed: 123, theme, designedFor: d, size: { x: s, y: s === 48 ? 256 : s } });
          expect(both(spec), `${theme} ${d} ${s}`).toEqual([true, true]);
        }
  });

  const bad: [string, (s: MapSpec) => void][] = [
    ["negative seed", (s) => (s.seed = -1)],
    ["seed above uint32", (s) => (s.seed = 2 ** 32)],
    ["size above 256", (s) => (s.size.x = 300)],
    ["size below 48", (s) => (s.size.y = 40)],
    ["relief above 100", (s) => (s.settings.terrain.relief = 101)],
    ["terrain above 16", (s) => (s.settings.terrain.highestTerrain = 17)],
    ["unknown theme", (s) => ((s as { theme: string }).theme = "volcano")],
    ["unknown property", (s) => ((s as unknown as Record<string, unknown>).extra = 1)],
    ["two colonies without the mod", (s) => (s.colonies = { count: 2, mod: "none" })],
    ["five colonies", (s) => ((s.colonies as { count: number }).count = 5)],
    ["missing settings", (s) => delete (s as Partial<MapSpec>).settings],
  ];
  it.each(bad)("rejects %s", (_, mutate) => {
    const spec = makeSpec({ seed: 1 });
    mutate(spec);
    expect(both(spec)).toEqual([false, false]);
  });

  it("allows the reserved Timber Together shape (D5)", () => {
    const spec = makeSpec({ seed: 1 });
    spec.colonies = { count: 2, mod: "timberTogether" };
    expect(both(spec)).toEqual([true, true]);
  });
});

describe("URL codec (PLAN §14.5)", () => {
  it("round-trips seed, theme, size and difficulty", () => {
    const spec = makeSpec({ seed: 4242, size: { x: 96, y: 96 }, designedFor: "hard" });
    const back = decodeSpecFragment("#" + encodeSpecFragment(spec))!;
    expect(back.problems).toEqual([]);
    expect(back.spec).toEqual(spec);
    const wide = makeSpec({ seed: 7, size: { x: 256, y: 150 } });
    expect(decodeSpecFragment(encodeSpecFragment(wide))!.spec.size).toEqual({ x: 256, y: 150 });
  });

  it("hashes text seeds", () => {
    expect(seedFromText("4242")).toBe(4242);
    expect(seedFromText("beaver")).toBe(seedFromText(" beaver "));
    expect(seedFromText("beaver")).not.toBe(seedFromText("otter"));
  });
});
