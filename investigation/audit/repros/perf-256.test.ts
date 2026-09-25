import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { generate } from "../../../src/core/gen/generate";
import { THEMES, makeSpec } from "../../../src/core/spec/mapspec";

function generateOne(theme: (typeof THEMES)[number]) {
  const start = performance.now();
  const result = generate(makeSpec({ seed: 11, theme, size: { x: 256, y: 256 } }));
  return { theme, ms: Math.round(performance.now() - start), bytes: result.bytes.length, passed: result.report.passed };
}

it("sweeps every theme at 256² and checks post-GC retained memory", () => {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  const rows = [];
  for (const theme of THEMES) {
    gc?.();
    const before = process.memoryUsage();
    const result = generateOne(theme);
    expect(result.passed, theme).toBe(true);
    gc?.();
    gc?.();
    const after = process.memoryUsage();
    rows.push({
      ...result,
      heapDeltaMiB: Math.round((after.heapUsed - before.heapUsed) / 1048576 * 10) / 10,
      arrayBufferDeltaMiB: Math.round((after.arrayBuffers - before.arrayBuffers) / 1048576 * 10) / 10,
      rssMiB: Math.round(after.rss / 1048576),
    });
  }
  writeFileSync("repros/perf-256-results.json", JSON.stringify(rows, null, 2) + "\n");
}, 600_000);
