import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalSettle } from '../../src/core/sim/prefill';
import { WaterSim, type WaterModel } from '../../src/core/sim/water';
import { droughtStorage } from '../../src/core/sim/drought';
import { generate } from '../../src/core/gen/generate';
import { makeSpec } from '../../src/core/spec/mapspec';
import { CycleModel, temperateSettle, cloneModel, sourcesOff, Trigger } from './model';
import { GameWater } from './game-water';
import { GameSoil, EVAPORATION } from './game-soil';
import { handicap, schedule, badtideChance, droughtModifier, badtideContamination, transitionDays, Clock, TICKS_PER_DAY, type CyclePlan } from './weather';
import { Measures } from './measures';
import { cases, runStretch } from './stretch';
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => Array.from(a).reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
const sum = (a: ArrayLike<number>) => Array.from(a).reduce((a, b) => a + b, 0);
const root = process.cwd().endsWith('cycles') ? '../..' : '.';

// Water with every source off, evaporating as the game does: the soil pass supplies the modifiers.
function droughtWater(model: WaterModel, depth: Float64Array, contamination: Float64Array, ticks: number) {
    const N = model.W * model.H, z = Uint8Array.from(model.floor), none = new Uint8Array(N);
    const water = new GameWater(cloneModel(model), depth, contamination, new Float64Array(N).fill(1));
    const soil = new GameSoil({ W: model.W, H: model.H, z, F: model.floor, fullBarrier: none, aboveBarrier: none, contaminationBarrier: none }, new Float64Array(N), new Float64Array(N));
    for (let t = 0; t < ticks; t++) {
        water.swapEvaporation();
        soil.step(water.D, water.C, water.evapCurrent);
        water.tick();
    }
    return water;
}

// 1. The canonical settle is untouched; the exact water keeps the golden drought checks.
const fixtures = JSON.parse(gunzipSync(readFileSync(`${root}/tests/golden/water.json.gz`)).toString()).fixtures;
const rows: any[] = [];
let portChecked = 0, portDiff = 0;
for (const f of fixtures) {
    const model: WaterModel = { W: f.W, H: f.H, floor: Float64Array.from(f.floor), dam: f.dam ? Float64Array.from(f.dam) : null, emitters: f.emitters };
    const c = canonicalSettle(model), ours = temperateSettle(model);
    assert.equal(maxDiff(c.depth, ours.depth), 0);
    assert.equal(maxDiff(c.contamination, ours.contamination), 0);
    assert.equal(c.ticks, ours.ticks);
    assert(maxDiff(ours.depth, f.canonical.depth) < 1e-6);
    // With the first model's rules switched back on and evaporation from the current water, the game
    // port reproduces the repository's validated port (it adds each direction's flows in the game's
    // order, so the last bits can differ).
    if (!model.emitters.some(e => e.depthLimit)) {
        const ref = new WaterSim(cloneModel(model), c), game = new GameWater(cloneModel(model), c.depth, c.contamination, new Float64Array(f.W * f.H).fill(1));
        ref.Dold.set(c.depth);
        game.legacy = { contamination: true, bookkeeping: true };
        game.sources = model.emitters.map(e => ({ cells: e.cells, strength: e.strength, contamination: e.contamination }));
        for (let t = 0; t < 300; t++) {
            const sat = new WaterSim(cloneModel(model), { depth: game.D, contamination: game.C }).saturation();
            for (let i = 0; i < sat.length; i++) game.evapBuffered[i] = sat[i] ? (10 - sat[i]) ** 2 * .0595 + .101 * (10 - sat[i]) + .72 : 1;
            game.tick();
            ref.run(1);
        }
        portDiff = Math.max(portDiff, maxDiff(game.D, ref.D), maxDiff(game.C, ref.C));
        assert(maxDiff(game.D, ref.D) < 1e-9 && maxDiff(game.C, ref.C) < 1e-9, `${f.name}: port differs`);
        portChecked++;
    }
    if (['lake_sill', 'valley_basin', 'weir'].includes(f.name)) {
        const analytic = sum(droughtStorage(model, c.depth, 9));
        const simulated = droughtWater(model, c.depth, c.contamination, TICKS_PER_DAY * 9).volume();
        const error = Math.abs(simulated - analytic) / analytic;
        assert(error < .05, `${f.name}: ${error}`);
        rows.push({ fixture: f.name, analytic, simulated, relativeError: error });
    }
}
assert(portChecked >= 6, 'Too few fixtures without seeps');

// 2. Weather: the game's odds, durations and calendar.
for (const mode of ['easy', 'normal', 'hard'] as const) {
    const a = schedule(mode), b = schedule(mode);
    assert.deepEqual(a, b);
    assert(a.filter(x => x.hazard === 'badtide').every(x => x.cycle >= ({ easy: 6, normal: 5, hard: 4 }[mode])));
    assert(a.every(x => x.hazardDays >= 1));
}
assert.equal(handicap(1, .2, 12), .2);
assert.equal(handicap(13, .2, 12), 1);
assert.equal(badtideChance(Array(7).fill('drought'), .4), 1, 'Seven droughts force a badtide');
assert.equal(badtideChance(Array(4).fill('badtide'), .4), 0, 'Four badtides force a drought');
assert(Math.abs(badtideChance(Array(5).fill('drought'), .4) - .7) < 1e-12, 'A five-drought streak halves the chance of a sixth');
assert(Math.abs(badtideChance(Array(4).fill('drought'), .4) - .4) < 1e-12, 'A four-drought streak keeps the base chance');
const plans: CyclePlan[] = [
    { cycle: 1, temperate: 13, hazard: 'drought', hazardDays: 5, occurrence: 1, badtideChance: null },
    { cycle: 2, temperate: 14, hazard: 'badtide', hazardDays: 4, occurrence: 1, badtideChance: .4 },
    { cycle: 3, temperate: 15, hazard: 'drought', hazardDays: 6, occurrence: 2, badtideChance: .4 },
];
const clock = new Clock(plans);
let ticks = 0;
while (clock.dayNumber === 1) { clock.tick(); ticks++; }
assert.equal(ticks, 640, 'A new game starts at hour 4');
let events: string[] = [];
while (!clock.isHazardous) events.push(...clock.tick());
assert.deepEqual([clock.cycle, clock.cycleDay, clock.ticksToday], [1, 14, 0]);
assert.deepEqual(events.slice(-2), ['dayStarted', 'hazardStarted']);
while (clock.cycle === 1) events = clock.tick();
assert.deepEqual(events, ['hazardEnded', 'cycleStarted', 'dayStarted']);
const S = 1, T = transitionDays(S);
assert(Math.abs(T - 1 / (460.8 * .0058)) < 1e-6);
const at = (cycle: number, day: number, ticks: number) => new Clock(plans, cycle, day, ticks);
assert.equal(droughtModifier(at(1, 13, 0), S), 1, 'Before the ramp');
assert(Math.abs(droughtModifier(at(1, 14, 0), S)) < 1e-6 || droughtModifier(at(1, 14, 0), S) === 0);
assert.equal(droughtModifier(at(1, 14, 5), S), 0, 'Off through the drought');
const almost = droughtModifier(at(1, 13, Math.floor(TICKS_PER_DAY * (1 - T / 2))), S);
assert(Math.abs(almost - (1 - .5 * (.85 * .5 + .15))) < .01, `Half-way down the ramp: ${almost}`);
assert(droughtModifier(at(2, 1, 0), S) === 0 && droughtModifier(at(2, 1, 200), S) > 0 && droughtModifier(at(2, 1, 400), S) === 1, 'Recovery ramp');
assert.equal(droughtModifier(at(2, 15, 0), S), 1, 'Badtide keeps sources flowing');
assert.equal(droughtModifier(at(3, 1, 10), S), 1, 'No recovery ramp after a badtide');
assert(Math.abs(badtideContamination(at(2, 15, 0)) - .5) < .001 && badtideContamination(at(2, 16, 0)) === 1 && Math.abs(badtideContamination(at(2, 18, 767)) - .5) < .01);
assert.equal(EVAPORATION[8], Math.fround(Math.fround(Math.fround(Math.fround(Math.fround(.0595) * 2) * 2) + Math.fround(Math.fround(.101) * 2)) + Math.fround(.72)));
const trigger = new Trigger(2);
trigger.resume(1); trigger.pause(2); assert.equal(trigger.left, 1);
trigger.resume(3); assert.equal(trigger.deadline, 4);
trigger.reset(3.5); assert.equal(trigger.left, 2);

// 3. The model on a generated map.
const r = generate(makeSpec({ seed: 1, size: { x: 96, y: 96 } }));
assert(r.report.passed);
const probes = cases(r.built);
const badtide = probes.find(c => c.id === 'first-badtide')!;
const a = new CycleModel(r.built, badtide.start), b = new CycleModel(r.built, badtide.start), full = new CycleModel(r.built, badtide.start, { fullSoil: true });
const initial = r.built.water.slice(), emitters = JSON.stringify(r.built.waterModel.emitters);
a.run(TICKS_PER_DAY); b.run(TICKS_PER_DAY); full.run(TICKS_PER_DAY);
assert(a.sources.some(s => s.strength > 0), 'Sources flow in badtide');
assert(a.sim.C.some(c => c > .5), 'Clean sources emit badwater');
assert.deepEqual(a.sim.D, b.sim.D);
assert.deepEqual(a.sim.C, b.sim.C);
assert.deepEqual(a.plants.map(p => p.diedAt), b.plants.map(p => p.diedAt));
assert.deepEqual(a.M, full.M, 'Incremental soil moisture equals a full recomputation');
assert.deepEqual(a.SC, full.SC, 'Incremental soil contamination equals a full recomputation');
assert.deepEqual(a.plants.map(p => p.diedAt), full.plants.map(p => p.diedAt));
assert.deepEqual(r.built.water, initial);
assert.equal(JSON.stringify(r.built.waterModel.emitters), emitters);
const dead = a.plants.map(p => p.dead);
a.run(TICKS_PER_DAY * 6);
assert.equal(a.clock.weather, 'normal');
assert(dead.every((v, i) => !v || a.plants[i].dead), 'Dead plants do not revive during recovery');
assert(a.sim.D.every(x => Number.isFinite(x) && x >= 0));
assert(a.sim.C.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
assert(a.sources.every(s => s.contamination === s.defaultContamination), 'Badtide contamination resets when it ends');
const firstNormal = probes.find(c => c.id === 'first-normal')!;
const rowsSeen: any[] = [];
const spans = runStretch(new CycleModel(r.built, firstNormal.start), firstNormal.days, row => rowsSeen.push(row));
assert.deepEqual(spans.map(s => s.weather), ['normal', 'drought', 'normal']);
assert.equal(spans.reduce((n, s) => n + s.days, 0), firstNormal.days);
assert.equal(rowsSeen.at(-1).day, firstNormal.days);
const measure = new Measures(new CycleModel(r.built, firstNormal.start), r.spec.settings.start.rules.waterWithin), base = measure.sample(0);
assert(base.pumpTiles > 0);
assert.equal(base.plants.nearTreesAlive, r.analysis!.treesNear);
assert.equal(base.plants.nearBushesAlive, r.analysis!.bushesNear);
const off = sourcesOff(r.built);
off.run(TICKS_PER_DAY);
assert(off.sources.every(s => s.strength === 0), 'A drought stops every source');

const data = { fixtures: fixtures.length, settleMaxError: 0, portFixtures: portChecked, portMaxDifference: portDiff, drought: rows,
    soil: { incrementalEqualsFull: true, badtideDay1Deaths: full.plants.filter(p => p.dead && !p.initialDead).length } };
mkdirSync(`${root}/investigation/cycles/results`, { recursive: true });
writeFileSync(`${root}/investigation/cycles/results/verification.json`, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(data, null, 2));
