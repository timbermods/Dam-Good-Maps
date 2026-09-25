// Where the stacked water and a map's stored water disagree: lists the columns (local use only).
//   npx tsx investigation/terrain3d/proto/debug-water.ts <map.timber> [--days 6] [--hold] [--mode game]

import { loadMap } from "./loadmap";
import { StackSim, settle, type Mode } from "./stackwater";
import { OPEN_CEILING } from "./columns";

const path = process.argv[2];
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const lm = loadMap(path);
const sim = new StackSim(lm.model, arg("mode", "game") as Mode);
if (process.argv.includes("--hold")) {
  sim.setState(lm.stored.depth, lm.stored.overflow, lm.stored.cont);
  console.log("momentum dropped", sim.setMomentum(lm.stored.momentum), "of", lm.stored.momentum.length);
  sim.run(Number(arg("ticks", "768")));
} else {
  console.log(settle(sim, Number(arg("days", "6"))));
}
const { N, W } = lm.cols;
let shown = 0;
const onlyRoofed = process.argv.includes("--roofed");
for (let i = 0; i < N; i++) {
  for (let s = 0; s < lm.cols.count[i]; s++) {
    const c = s * N + i;
    const roofed = lm.cols.ceil[c] < OPEN_CEILING;
    if (onlyRoofed && !roofed) continue;
    const a = lm.stored.depth[c];
    const b = sim.D[c];
    if ((a > 0.05) !== (b > 0.05) || Math.abs(a - b) > 0.25) {
      if (shown++ < 60) {
        const x = i % W, y = (i - x) / W;
        const runs: string[] = [];
        for (let k = 0; k < lm.runs.count[i]; k++) runs.push(`${lm.runs.floor[k * N + i]}-${lm.runs.ceil[k * N + i]}`);
        console.log(`(${x},${y}) slot ${s} col [${lm.cols.floor[c]},${lm.cols.ceil[c]}) stored ${a.toFixed(3)}+${lm.stored.overflow[c].toFixed(3)} sim ${b.toFixed(3)}+${sim.O[c].toFixed(3)} runs ${runs.join(",")}`);
      }
    }
  }
}
console.log(`${shown} columns differ`);
