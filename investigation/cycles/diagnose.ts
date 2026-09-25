// Inspect the largest local depth difference between the analytic drought view and the exact model,
// without changing either. The map and day come from results/summary.json, or `--map id --days n`.
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../../src/core/gen/generate';
import { makeSpec, type ThemeId } from '../../src/core/spec/mapspec';
import { spillLevels } from '../../src/core/sim/prefill';
import { droughtStorage } from '../../src/core/sim/drought';
import { sourcesOff } from './model';

const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const arg = (name: string) => { const i = process.argv.indexOf('--' + name); return i < 0 ? null : process.argv[i + 1]; };
const worst = JSON.parse(readFileSync(`${dir}/results/summary.json`, 'utf8')).drought.worstDepth;
const id: string = arg('map') ?? worst.id, days = Number(arg('days') ?? worst.days);
const [theme, size, seed] = id.split('-');
const r = generate(makeSpec({ theme: theme as ThemeId, seed: Number(seed), size: { x: Number(size), y: Number(size) } }));
if (!r.report.passed) throw Error('Generation failed');
const b = r.built, W = b.W, model = sourcesOff(b);
model.run(days * 768);
const s = model.sim, analytic = droughtStorage(b.waterModel, b.water, days), spill = spillLevels(b.waterModel);
let i = 0;
for (let j = 1; j < s.N; j++) if (Math.abs(s.D[j] - analytic[j]) > Math.abs(s.D[i] - analytic[i])) i = j;
const cell = (j: number) => ({ x: j % W, y: Math.floor(j / W), floor: b.heights[j], spill: spill[j],
    initial: b.water[j], analytic: analytic[j], simulated: s.D[j], difference: s.D[j] - analytic[j] });
const evidence = { map: id, sourceOffDays: days, model: 'exact (FIDELITY.md)', maximum: cell(i),
    neighbours: [i - W, i - 1, i + 1, i + W].filter(j => j >= 0 && j < s.N).map(cell) };
writeFileSync(`${dir}/results/depth-outlier.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence);
