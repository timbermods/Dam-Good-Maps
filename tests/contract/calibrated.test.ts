// PLAN §4 and decision D9: the TypeScript calibration table equals prototype/calibrated.py.

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DENSITY, REACH_MIN, reservoirNeeded, RUIN_HEIGHT_SHARES, SIZE_ANCHORS } from "../../src/core/gen/calibrated";
import { DIFFICULTY_RULES } from "../../src/core/spec/mapspec";

function python(): string | null {
  for (const exe of ["python", "python3"]) {
    try {
      return execFileSync(exe, ["prototype/calibrated.py"], { encoding: "utf8" });
    } catch {
      /* try the next name */
    }
  }
  return null;
}

const out = python();

describe.skipIf(!out)("calibrated tables", () => {
  const py = JSON.parse(out ?? "{}");

  it("density anchors and values", () => {
    expect([...SIZE_ANCHORS]).toEqual(py.size_anchors);
    for (const [k, v] of Object.entries(DENSITY)) expect([...v], k).toEqual(py.density[k]);
  });

  it("difficulty rules (PLAN §5.6)", () => {
    for (const d of ["easy", "normal", "hard"] as const) {
      const a = DIFFICULTY_RULES[d];
      const b = py.difficulty[d];
      expect([a.waterWithin, a.treesWithin20, a.bushesWithin20, a.badwaterWithin, a.ruinsWithin], d).toEqual([
        b.water_dist, b.trees_r20, b.bushes_r20, b.badwater_min, b.ruin_min,
      ]);
      expect(reservoirNeeded(d)).toBe(py.reservoir_needed[d]);
    }
  });

  it("reach by buildable land (PLAN §5.2) and ruin height shares", () => {
    expect(REACH_MIN).toEqual(py.reach_by_buildable_land);
    expect(RUIN_HEIGHT_SHARES).toEqual(py.ruin_height_shares);
  });
});
