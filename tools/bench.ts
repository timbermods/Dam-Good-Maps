// Generation time (ROADMAP M1 acceptance: 128² in under 3 s).
//
//   npx tsx tools/bench.ts [--size 128] [--seeds 1-10] [--budget 3000]

import { generate } from "../src/core/gen/generate";
import { makeSpec } from "../src/core/spec/mapspec";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const size = Number(arg("size", "128"));
const [a, b] = arg("seeds", "1-10").split("-").map(Number);
const budget = Number(arg("budget", "3000"));

generate(makeSpec({ seed: 0, size: { x: size, y: size } })); // warm up the JIT
const times: number[] = [];
for (let seed = a; seed <= (b ?? a); seed++) {
  const t0 = performance.now();
  const r = generate(makeSpec({ seed, size: { x: size, y: size } }));
  const ms = performance.now() - t0;
  times.push(ms);
  if (!r.report.passed) {
    console.log(`seed ${seed}: generation failed`);
    process.exit(1);
  }
}
times.sort((x, y) => x - y);
const max = times[times.length - 1];
console.log(`${size}×${size}, ${times.length} seeds: median ${Math.round(times[times.length >> 1])} ms, max ${Math.round(max)} ms (budget ${budget} ms)`);
process.exit(max < budget ? 0 : 1);
