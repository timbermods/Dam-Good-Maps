// Follow one original plant cohort through consecutive cycles of a new game, without resetting the map.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { generate } from '../../src/core/gen/generate';
import { makeSpec, THEMES } from '../../src/core/spec/mapspec';
import { CycleModel } from './model';
import { Measures, frame, rounded } from './measures';
import { journey, runStretch } from './stretch';
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
mkdirSync(`${dir}/results/journeys`, { recursive: true });
for (const theme of THEMES)
    for (const [size, seed] of [[96, 1], [128, 2]]) {
        const id = `${theme}-${size}-${seed}`, path = `${dir}/results/journeys/${id}.json.gz`;
        if (existsSync(path) && !process.argv.includes('--force'))
            continue;
        const r = generate(makeSpec({ theme, seed, size: { x: size, y: size } }));
        if (!r.report.passed)
            throw Error(id);
        const stretch = journey(1729);
        const model = new CycleModel(r.built, stretch.start), measure = new Measures(model, r.spec.settings.start.rules.waterWithin);
        const days: any[] = [], frames: any[] = [];
        const t = performance.now();
        const phases = runStretch(model, stretch.days, (row, m) => {
            days.push({ ...measure.sample(row.day), phase: row.phase, phaseDay: row.phaseDay, cycle: row.cycle });
            frames.push(frame(m, measure.initialWet));
        });
        const record = { id: 'journey', label: stretch.label, phases, days, frames, ms: rounded(performance.now() - t), firstWaterLost: measure.firstWaterLost,
            recoveryDays: null, deaths: model.plants.flatMap((p, k) => p.diedAt !== null ? [{ plant: k, tile: p.tile, day: rounded(p.diedAt), cause: p.cause }] : []) };
        const galleryPath = `${dir}/viewer/data/${id}.json.gz`;
        const gallery = JSON.parse(gunzipSync(readFileSync(galleryPath)).toString());
        gallery.scenarios = gallery.scenarios.filter((s: any) => s.id !== 'journey');
        gallery.scenarios.push(record);
        writeFileSync(galleryPath, gzipSync(JSON.stringify(gallery), { level: 9 }));
        const { frames: _, ...metrics } = record;
        writeFileSync(path, gzipSync(JSON.stringify({ map: id, ...metrics }), { level: 9 }));
        console.log(`${id}: ${stretch.days} days, ${record.ms}ms, ${record.deaths.length} original plants lost`);
    }
