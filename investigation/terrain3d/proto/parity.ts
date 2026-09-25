// Parity: on heightfield maps the stacked simulation in "port" mode must give exactly the bits of
// today's port (src/core/sim/water.ts), from the same start, tick for tick. Maps come from the
// product's own generator (every theme); the start is the canonical pre-fill (sim/prefill.ts).
//
//   npx tsx investigation/terrain3d/proto/parity.ts [--size 128] [--seeds 1,2] [--ticks 1536]

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generate } from "../../../src/core/gen/generate";
import { makeSpec } from "../../../src/core/spec/mapspec";
import { WaterSim } from "../../../src/core/sim/water";
import { prefill } from "../../../src/core/sim/prefill";
import { waterModelFromWorld } from "../../../src/core/sim/model";
import { readTimber } from "../../../src/core/format/timber";
import { surfaceOf } from "../../../src/core/format/world";
import { loadMap } from "./loadmap";
import { StackSim } from "./stackwater";
import { prefill3d } from "./prefill3d";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const size = Number(arg("size", "128"));
const seeds = arg("seeds", "1,2").split(",").map(Number);
const ticks = Number(arg("ticks", "1536"));
const themes = arg("themes", "riverValley,canyon,lakeBasin,highlands,delta,islands").split(",");
const tmp = arg("tmp", process.env.TEMP ?? ".");
mkdirSync(tmp, { recursive: true });

const rows: string[] = [];
let fails = 0;
for (const theme of themes) {
  for (const seed of seeds) {
    const spec = makeSpec({ seed, size: { x: size, y: size }, designedFor: "normal", theme: theme as never });
    const r = generate(spec);
    const path = join(tmp, `parity-${theme}-${seed}.timber`);
    writeFileSync(path, r.bytes);
    const file = readTimber(r.bytes);
    const surface = surfaceOf(file.world);
    const hm = waterModelFromWorld(file.world, surface);
    const start = prefill(hm);
    const a = new WaterSim(hm, start);
    const lm = loadMap(path);
    const b = new StackSim(lm.model, "port");
    // columns: a heightfield has one column per tile, [surface (raised by blockages), 34)
    let multi = 0;
    for (let i = 0; i < lm.cols.N; i++) if (lm.cols.count[i] !== 1) multi++;
    const p3 = prefill3d(b);
    let pdiff = 0;
    for (let i = 0; i < lm.cols.N; i++) if (p3.depth[i] !== start.depth[i] || p3.cont[i] !== start.contamination[i]) pdiff++;
    if (pdiff) fails++;
    b.setState(p3.depth, null, p3.cont);
    const t0 = process.cpuUsage();
    a.run(ticks);
    const t1 = process.cpuUsage(t0);
    const t2 = process.cpuUsage();
    b.run(ticks);
    const t3 = process.cpuUsage(t2);
    let diff = 0;
    let maxd = 0;
    for (let i = 0; i < lm.cols.N; i++) {
      if (a.D[i] !== b.D[i] || a.C[i] !== b.C[i]) diff++;
      const d = Math.abs(a.D[i] - b.D[i]);
      if (d > maxd) maxd = d;
    }
    if (diff) fails++;
    const row = `${theme}\t${seed}\t${size}\tmulti-column tiles ${multi}\tticks ${ticks}\ttiles differing ${diff}\tmax |dD| ${maxd.toExponential(2)}\tCPU port ${((t1.user + t1.system) / 1000).toFixed(0)} ms, stacked ${((t3.user + t3.system) / 1000).toFixed(0)} ms`;
    rows.push(row);
    console.log(row);
  }
}
console.log(fails ? `PARITY FAILED on ${fails} maps` : `parity: bit-identical on ${rows.length} maps`);
process.exit(fails ? 1 : 0);
