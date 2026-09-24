// The settled water measure.ts stores per map: depth, contamination and moisture, float32.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SETTLED } from "./paths";

export function readSettled(key: string, N: number): { depth: Float32Array; contam: Float32Array; moist: Float32Array } | null {
  const p = join(SETTLED, `${key}.f32`);
  if (!existsSync(p)) return null;
  const b = readFileSync(p);
  const f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  if (f.length !== 3 * N) return null;
  return { depth: f.subarray(0, N), contam: f.subarray(N, 2 * N), moist: f.subarray(2 * N, 3 * N) };
}
