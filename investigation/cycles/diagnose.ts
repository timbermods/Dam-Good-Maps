// Inspect the local depth outlier without changing either trusted solver.
import { writeFileSync } from 'node:fs';
import { generate } from '../../src/core/gen/generate';
import { makeSpec } from '../../src/core/spec/mapspec';
import { WaterSim } from '../../src/core/sim/water';
import { spillLevels } from '../../src/core/sim/prefill';
import { droughtStorage } from '../../src/core/sim/drought';
import { cloneModel } from './model';

const r = generate(makeSpec({ theme: 'lakeBasin', seed: 14, size: { x: 128, y: 128 } }));
if (!r.report.passed) throw Error('Generation failed');
const b = r.built, s = new WaterSim(cloneModel(b.waterModel), { depth: b.water, contamination: b.contamination });
s.run(9 * 768, 0);
const analytic = droughtStorage(b.waterModel, b.water, 9), spill = spillLevels(b.waterModel);
let i = 0;
for (let j = 1; j < s.N; j++) if (Math.abs(s.D[j] - analytic[j]) > Math.abs(s.D[i] - analytic[i])) i = j;
const cell = (j: number) => ({ x: j % 128, y: Math.floor(j / 128), floor: b.heights[j], spill: spill[j],
    initial: b.water[j], analytic: analytic[j], simulated: s.D[j], difference: s.D[j] - analytic[j] });
const evidence = { map: 'lakeBasin-128-14', sourceOffDays: 9, maximum: cell(i),
    neighbours: [i - 128, i - 1, i + 1, i + 128].filter(j => j >= 0 && j < s.N).map(cell) };
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
writeFileSync(`${dir}/results/depth-outlier.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence);
