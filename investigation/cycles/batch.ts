import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { generate } from '../../src/core/gen/generate';
import { makeSpec, THEMES, THEME_NAMES, type ThemeId } from '../../src/core/spec/mapspec';
import { WaterSim } from '../../src/core/sim/water';
import { droughtStorage } from '../../src/core/sim/drought';
import { CycleModel, cloneModel, temperateSettle } from './model';
import { Measures, frame, rle, rounded } from './measures';
import { schedule, type Phase } from './weather';
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf('--' + name); return i < 0 ? fallback : process.argv[i + 1]; };
const themes = arg('themes', THEMES.join(',')).split(',') as ThemeId[];
const sizes = arg('sizes', '96,128,256').split(',').map(Number);
const seeds = arg('seeds', '1,2').split(',').flatMap(s => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
const study = arg('study', 'gallery'), weatherSeed = 1729;
const mapsOnly = process.argv.includes('--maps-only');
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
for (const p of ['results/maps', 'viewer/data', 'generated'])
    mkdirSync(`${dir}/${p}`, { recursive: true });
const sum = (a: ArrayLike<number>) => Array.from(a).reduce((a, b) => a + b, 0);
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => Array.from(a).reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
export function cases(): {
    id: string;
    label: string;
    phases: Phase[];
}[] {
    const first = (mode: 'easy' | 'normal' | 'hard') => schedule(mode, weatherSeed).find(p => p.weather === 'drought')!;
    const bad = schedule('normal', weatherSeed).find(p => p.weather === 'badtide')!;
    const later = schedule('hard', weatherSeed, 40).find(p => p.weather === 'drought' && p.occurrence === 13)!;
    return [
        { id: 'normal', label: 'Normal weather', phases: [{ weather: 'normal', days: schedule('normal', weatherSeed)[0].days, cycle: 1, occurrence: 1 }] },
        ...(['easy', 'normal', 'hard'] as const).map(mode => ({ id: `first-${mode}`, label: `First drought · ${mode}`, phases: [
                { weather: 'normal', days: 1, cycle: 1, occurrence: 1, next: 'drought' } as Phase, first(mode),
                { weather: 'normal', days: 3, cycle: 2, occurrence: 2, previous: 'drought' } as Phase
            ] })),
        { id: 'first-badtide', label: `First badtide · Normal · cycle ${bad.cycle}`, phases: [bad, { weather: 'normal', days: 5, cycle: bad.cycle + 1, occurrence: bad.cycle + 1, previous: 'badtide' }] },
        { id: 'late-hard', label: `Later drought · Hard · cycle ${later.cycle}`, phases: [{ weather: 'normal', days: 1, cycle: later.cycle, occurrence: later.cycle, next: 'drought' }, later, { weather: 'normal', days: 5, cycle: later.cycle + 1, occurrence: later.cycle + 1, previous: 'drought' }] },
    ];
}
for (const size of sizes)
    for (const theme of themes)
        for (const seed of seeds) {
            const id = `${theme}-${size}-${seed}`, path = `${dir}/results/maps/${id}.json`;
            if (!mapsOnly && existsSync(path) && !process.argv.includes('--force')) {
                console.log(`cached ${id}`);
                continue;
            }
            const start = performance.now();
            const r = generate(makeSpec({ seed, theme, size: { x: size, y: size } })), generationMs = performance.now() - start;
            if (!r.report.passed) {
                writeFileSync(path, JSON.stringify({ id, theme, size, seed, passed: false, failures: r.failures }, null, 2));
                console.log(`FAILED ${id}`);
                continue;
            }
            // Same generate/makeSpec path as tools/gen.ts; unlike that CLI this accepts every theme.
            if (study === 'gallery' || mapsOnly)
                writeFileSync(`${dir}/generated/${id}.timber`, r.bytes);
            const sha256 = createHash('sha256').update(r.bytes).digest('hex');
            if (mapsOnly) {
                console.log(`generated ${id} sha256=${sha256}`);
                continue;
            }
            let t = performance.now();
            const canonical = temperateSettle(r.built.waterModel);
            const settleMs = performance.now() - t;
            const parity = { depth: maxDiff(canonical.depth, r.built.water), contamination: maxDiff(canonical.contamination, r.built.contamination), ticks: canonical.ticks, settled: canonical.settled };
            if (parity.depth !== 0 || parity.contamination !== 0)
                throw new Error(`${id}: settle mismatch`);
            const scenarios: any[] = [];
            const gallery = study === 'gallery' && ((size === 96 && seed === 1) || (size === 128 && seed === 2));
            const visual: any = { id, name: THEME_NAMES[theme], size, seed, start: r.built.start, heights: rle(r.built.heights), plants: [], scenarios: [] };
            let regions: any[] = [], baseline: any;
            for (const spec of cases()) {
                t = performance.now();
                const model = new CycleModel(r.built), measure = new Measures(model, r.spec.settings.start.rules.waterWithin);
                regions = measure.regions;
                baseline = measure.sample(0);
                if (!visual.plants.length)
                    visual.plants = model.plants.map(p => ({ tile: p.tile, species: p.species, dead: p.initialDead }));
                let elapsed = 0;
                const days: any[] = [];
                const images: any[] = [];
                for (const phase of spec.phases) {
                    model.run(phase, (day, m) => {
                        const row = { ...measure.sample(elapsed + day), phase: phase.weather, phaseDay: day, cycle: phase.cycle };
                        days.push(row);
                        if (gallery)
                            images.push(frame(m, measure.initialWet));
                    });
                    elapsed += phase.days;
                }
                const first = days[0], last = days.at(-1), hazard = days.filter(x => x.phase !== 'normal').at(-1);
                const recovery = hazard ? days.filter(x => x.day >= hazard.day && x.phase === 'normal') : [];
                const recoverAt = recovery.find(x => x.volume >= baseline.volume * .95 && x.badTiles <= baseline.badTiles + Math.max(1, baseline.wetTiles * .01) && x.moistTiles >= baseline.moistTiles * .95);
                const record = { id: spec.id, label: spec.label, phases: spec.phases, ms: rounded(performance.now() - t), days,
                    firstWaterLost: measure.firstWaterLost, recoveryDays: recoverAt ? rounded(recoverAt.day - hazard.day) : null,
                    finalRetention: hazard ? rounded(hazard.volume / baseline.volume) : rounded(last.volume / first.volume),
                    firstDry: rle(Int16Array.from(measure.firstDry, n => n < 0 ? -1 : Math.round(n * 48))),
                    firstBad: rle(Int16Array.from(measure.firstBad, n => n < 0 ? -1 : Math.round(n * 48))),
                    deaths: model.plants.flatMap((p, k) => p.diedAt !== null ? [{ plant: k, tile: p.tile, day: rounded(p.diedAt), cause: p.cause }] : []) };
                scenarios.push(record);
                if (gallery)
                    visual.scenarios.push({ ...record, frames: images });
            }
            t = performance.now();
            const comparisonDays = [9, cases().find(c => c.id === 'late-hard')!.phases[1].days].sort((a, b) => a - b);
            const sim = new WaterSim(cloneModel(r.built.waterModel), { depth: r.built.water, contamination: r.built.contamination });
            let ran = 0;
            const droughtComparison = comparisonDays.map(days => {
                sim.run((days - ran) * 768, 0);
                ran = days;
                const analytic = droughtStorage(r.built.waterModel, r.built.water, days), a = sum(analytic), v = sim.volume();
                return { days, analytic: rounded(a), simulated: rounded(v), relativeError: a > 1e-9 ? rounded(Math.abs(v - a) / a) : null,
                    absoluteError: rounded(Math.abs(v - a)), initialVolumeError: rounded(Math.abs(v - a) / baseline.volume), maxDepthError: rounded(maxDiff(analytic, sim.D)),
                    withinFivePercent: a > 1 ? Math.abs(v - a) / a <= .05 : Math.abs(v - a) <= 1 };
            });
            const comparisonMs = performance.now() - t;
            const record = { id, theme, size, seed, passed: true, sha256, accepted: r.spec.accepted, weatherSeed, baseline, regions, parity, droughtComparison,
                timings: { generationMs: rounded(generationMs), settleMs: rounded(settleMs), comparisonMs: rounded(comparisonMs), totalMs: rounded(performance.now() - start) },
                machine: { node: process.version, cpu: cpus()[0].model }, scenarios };
            writeFileSync(path, JSON.stringify(record) + '\n');
            if (gallery) {
                visual.regions = regions;
                visual.sha256 = sha256;
                writeFileSync(`${dir}/viewer/data/${id}.json.gz`, gzipSync(JSON.stringify(visual), { level: 9 }));
            }
            console.log(`${id} ${Math.round(record.timings.totalMs)}ms drought errors ${droughtComparison.map(x => x.relativeError).join(',')}`);
        }
