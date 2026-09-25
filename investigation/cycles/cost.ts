// Where the exact model's time goes: CPU per simulated day of the game soil pass, the first model's
// 16-tick soil, the game-order water step and the repository's water port, on two reference maps.
import { writeFileSync } from 'node:fs';
import { generate } from '../../src/core/gen/generate';
import { makeSpec, type ThemeId } from '../../src/core/spec/mapspec';
import { WaterSim } from '../../src/core/sim/water';
import { CycleModel, cloneModel, fileState } from './model';
import { cases } from './stretch';

const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const cpu = () => process.cpuUsage().user / 1000;
const rows: any[] = [];
for (const theme of ['riverValley', 'lakeBasin'] as ThemeId[])
    for (const probe of ['first-normal', 'first-badtide']) {
        const r = generate(makeSpec({ theme, seed: 2, size: { x: 128, y: 128 } }));
        const stretch = cases(r.built).find(c => c.id === probe)!, days = 3;
        // Both soils run side by side; each is timed on its own.
        const m = new CycleModel(r.built, stretch.start, { legacy: { moisture: true, soilContamination: true } }) as any;
        const t = { game: 0, first: 0, water: 0, total: 0 };
        const wrap = (o: any, name: string, key: keyof typeof t) => { const f = o[name].bind(o); o[name] = (...a: any[]) => { const s = cpu(); f(...a); t[key] += cpu() - s; }; };
        wrap(m.soil, 'step', 'game');
        wrap(m.equilibrium, 'step', 'first');
        wrap(m.sim, 'tick', 'water');
        const s0 = cpu();
        m.run(768 * days);
        t.total = cpu() - s0 - t.first;
        const f = fileState(r.built), port = new WaterSim(cloneModel(r.built.waterModel), { depth: f.depth, contamination: f.contamination });
        const p0 = cpu();
        port.run(768 * days);
        const portMs = cpu() - p0;
        const perDay = (x: number) => Math.round(x / days);
        rows.push({ map: `${theme}-128-2`, probe, exactModel: perDay(t.total), gameSoil: perDay(t.game), firstModelSoil: perDay(t.first), gameWater: perDay(t.water), repositoryWaterPort: perDay(portMs) });
        console.log(rows.at(-1));
    }
writeFileSync(`${dir}/results/cost.json`, JSON.stringify({ unit: 'CPU ms per simulated day', rows }, null, 2) + '\n');
