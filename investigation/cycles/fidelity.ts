// What each exact rule changes: run the 12 reference maps with the exact model, with one rule group
// switched back to the study's first model, and with the first model itself (taken from git into the
// ignored .cache/legacy). Old and exact runs alternate, so their timings share the machine's load.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate } from '../../src/core/gen/generate';
import { makeSpec, THEMES } from '../../src/core/spec/mapspec';
import { CycleModel, newGame, rampLead, startBefore, type Legacy } from './model';
import { Measures, rounded } from './measures';
import { cases, runStretch, type Stretch } from './stretch';
import { schedule } from './weather';

const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const LEGACY_COMMIT = '1a8eba2';
mkdirSync(`${dir}/.cache/legacy`, { recursive: true });
for (const file of ['model.ts', 'weather.ts']) {
    const source = execFileSync('git', ['show', `${LEGACY_COMMIT}:investigation/cycles/${file}`], { encoding: 'utf8' });
    writeFileSync(`${dir}/.cache/legacy/${file}`, source.replaceAll("'../../src/", "'../../../../src/"));
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const old = require('./.cache/legacy/model') as any, oldWeather = require('./.cache/legacy/weather') as any;

// 1. Does the weather seed still draw the same weather?
const sameWeather: Record<string, { cycles: number; identical: boolean; firstDifference: number | null }> = {};
for (const [mode, cycles] of [['easy', 30], ['normal', 30], ['hard', 40]] as const) {
    const a = schedule(mode, 1729, cycles), b = oldWeather.schedule(mode, 1729, cycles).filter((p: any) => p.weather !== 'normal');
    const differs = a.findIndex((p, i) => p.hazard !== b[i].weather || p.hazardDays !== b[i].days || p.temperate !== oldWeather.schedule(mode, 1729, cycles)[2 * i].days);
    sameWeather[mode] = { cycles, identical: differs < 0, firstDifference: differs < 0 ? null : differs + 1 };
}

const variants: [string, Legacy][] = [
    ['moisture', { moisture: true }], ['soilContamination', { soilContamination: true }], ['waterContamination', { contamination: true }],
    ['waterBookkeeping', { bookkeeping: true }], ['lags', { lags: true }], ['floodDelay', { floodDelay: true }], ['settleState', { settleState: true }],
];
const probeIds = ['first-normal', 'first-badtide', 'late-hard'];
const outcome = (rows: any[], deaths: number) => {
    const hazard = rows.filter(d => d.phase !== 'normal').at(-1) ?? rows.at(-1), end = rows.at(-1);
    return { hazardVolume: hazard.volume, hazardBadTiles: hazard.badTiles, hazardSoilTiles: hazard.soilTiles, hazardMoistTiles: hazard.moistTiles,
        hazardDriedTiles: hazard.driedTiles, endVolume: end.volume, endMoistTiles: end.moistTiles, deaths };
};
const results: any[] = [];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
/** CPU milliseconds of this process: steadier than wall time on a shared machine. */
const cpu = () => process.cpuUsage().user / 1000;
for (const theme of THEMES)
    for (const [size, seed] of [[96, 1], [128, 2]]) {
        const id = `${theme}-${size}-${seed}`;
        if (only && id !== only) continue;
        const r = generate(makeSpec({ theme, seed, size: { x: size, y: size } }));
        const within = r.spec.settings.start.rules.waterWithin;
        const run = (stretch: Stretch, legacy?: Legacy) => {
            const t = cpu(), model = new CycleModel(r.built, stretch.start, { legacy }), measure = new Measures(model, within), rows: any[] = [];
            runStretch(model, stretch.days, row => rows.push({ ...measure.sample(row.day), phase: row.phase }));
            return { cpuMs: cpu() - t, days: stretch.days, rows, firstWaterLost: measure.firstWaterLost,
                ...outcome(rows, model.plants.filter(p => p.dead && !p.initialDead).length) };
        };
        const all = cases(r.built), lead = rampLead(r.built);
        for (const probeId of probeIds) {
            const stretch = all.find(c => c.id === probeId)!;
            // The first model on the same probe, as its batch defined it.
            const oldCases = oldCasesFor(probeId);
            const t = cpu();
            const legacyModel = new old.CycleModel(r.built), measure = new Measures(legacyModel, within), rows: any[] = [];
            let elapsed = 0;
            for (const phase of oldCases) {
                legacyModel.run(phase, (day: number) => rows.push({ ...measure.sample(elapsed + day), phase: phase.weather }));
                elapsed += phase.days;
            }
            const legacyRun = { cpuMs: cpu() - t, days: elapsed, firstWaterLost: measure.firstWaterLost,
                ...outcome(rows, legacyModel.plants.filter((p: any) => p.dead && !p.initialDead).length) };
            const exact = run(stretch);
            const row: any = { id, probe: probeId, lead, exact: strip(exact), firstModel: strip(legacyRun), variants: {} };
            for (const [name, legacy] of variants) row.variants[name] = strip(run(stretch, legacy));
            if (lead > 1 && probeId !== 'first-badtide') {
                const plans = stretch.start.plans, cycle = stretch.start.cycle;
                row.variants.leadOneDay = strip(run({ ...stretch, start: startBefore(plans, cycle, 1), days: stretch.days - lead + 1 }));
            }
            results.push(row);
            console.log(`${id} ${probeId}: exact ${Math.round(exact.cpuMs)} ms, first model ${Math.round(legacyRun.cpuMs)} ms CPU`);
        }
        // A new game starts at hour 4: the first drought comes four hours sooner than on a whole day.
        const plans = schedule('normal', 1729), firstCycle = plans[0].temperate + plans[0].hazardDays + 3;
        const hour4 = run({ id: 'new-game', label: '', start: newGame(plans), days: firstCycle });
        const hour0 = run({ id: 'new-game-hour-0', label: '', start: { plans, cycle: 1, cycleDay: 1, ticksToday: 0 }, days: firstCycle });
        results.push({ id, probe: 'new-game', exact: strip(hour4), variants: { wholeFirstDay: strip(hour0) } });
    }
if (!only) writeFileSync(`${dir}/results/fidelity.json`, JSON.stringify({ legacyCommit: LEGACY_COMMIT, sameWeather, results }, null, 1) + '\n');
console.log(JSON.stringify(sameWeather));

function strip(x: any) {
    const { rows: _, ...rest } = x;
    for (const k of Object.keys(rest)) if (typeof rest[k] === 'number') rest[k] = rounded(rest[k]);
    return rest;
}

/** The first model's probes (its batch.ts `cases`), rebuilt from its own weather module. */
function oldCasesFor(probeId: string): any[] {
    const s = (mode: string, cycles = 30) => oldWeather.schedule(mode, 1729, cycles);
    if (probeId === 'first-normal') return [{ weather: 'normal', days: 1, cycle: 1, occurrence: 1, next: 'drought' }, s('normal').find((p: any) => p.weather === 'drought'), { weather: 'normal', days: 3, cycle: 2, occurrence: 2, previous: 'drought' }];
    if (probeId === 'first-badtide') {
        const bad = s('normal').find((p: any) => p.weather === 'badtide');
        return [bad, { weather: 'normal', days: 5, cycle: bad.cycle + 1, occurrence: bad.cycle + 1, previous: 'badtide' }];
    }
    const later = s('hard', 40).find((p: any) => p.weather === 'drought' && p.occurrence === 13);
    return [{ weather: 'normal', days: 1, cycle: later.cycle, occurrence: later.cycle, next: 'drought' }, later, { weather: 'normal', days: 5, cycle: later.cycle + 1, occurrence: later.cycle + 1, previous: 'drought' }];
}
