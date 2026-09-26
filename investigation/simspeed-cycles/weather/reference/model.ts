// One untouched map through the weather, tick by tick in Timberborn 1.1.2.4's order (FIDELITY.md).
// A tick runs the game's singletons (clock, snapshots, soil published to plants, flood checks, dying
// timers), then its entity components (water sources), then its parallel tasks (soil, then water;
// both read the water as the previous tick left it).
import { WaterSim, SettleRun, type WaterModel } from '../../../../src/core/sim/water';
import { prefill, type CanonicalWater } from '../../../../src/core/sim/prefill';
import { moistureBarrier, EMITTERS, specifiedStrength } from '../../../../src/core/sim/model';
import { moisture } from '../../../../src/core/sim/moisture';
import { soilContamination } from '../../../../src/core/sim/contamination';
import { Rng } from '../../../../src/core/math/rng';
import { hash32 } from '../../../../src/core/math/hash';
import type { BuildResult } from '../../../../src/core/features/build';
import { GameWater, type SourceSnapshot, type WaterLegacy } from './game-water';
import { GameSoil } from './game-soil';
import { Clock, droughtModifier, badtideContamination, transitionDays, TICKS_PER_DAY, NEW_GAME_TICK, type CyclePlan } from './weather';

/** NaturalResources/* blueprints: WateredNaturalResourceSpec.DaysToDieDry (or AridNaturalResourceSpec
 *  .DaysToDieWet), FloodableNaturalResourceSpec.DaysToDie, and the logs a cut tree gives. */
export const SPECIES: Record<string, { dry: number; flood: number; logs: number; arid?: boolean }> = {
    Pine: { dry: 13, flood: 12, logs: 2 }, Birch: { dry: 11, flood: 14, logs: 1 }, Oak: { dry: 15, flood: 10, logs: 8 },
    BlueberryBush: { dry: 9, flood: 7, logs: 0 }, Succulent: { dry: 8, flood: 4, logs: 0, arid: true },
};
/** ContaminatedNaturalResource.MinDaysToDie / MaxDaysToDie. */
const BAD_MIN = .2, BAD_MAX = .3;
/** WaterDepthStrengthModifier: DepthLimit 0.8, back on below 0.9 × that, fading in at 0.5 per second
 *  of Unity frame time. */
const SEEP_LIMIT = Math.fround(0.8), SEEP_ON = Math.fround(0.8 * Math.fround(0.9)), SEEP_FADE = .5;

/** TimeTrigger: a countdown in game days that pauses, resumes and resets. */
export class Trigger {
    left: number;
    at = 0;
    running = false;
    finished = false;
    constructor(readonly full: number) { this.left = full; }
    get deadline(): number { return this.at + this.left; }
    resume(now: number): void { if (!this.running && !this.finished) { this.at = now; this.running = true; } }
    pause(now: number): void { if (this.running) { this.left -= now - this.at; this.running = false; } }
    reset(now: number): void { this.finished = false; this.pause(now); this.left = this.full; }
}

export interface Plant {
    tile: number;
    species: string;
    initialDead: boolean;
    dead: boolean;
    /** Days since the run started, and which timer ended the plant. */
    diedAt: number | null;
    cause: string | null;
    /** What the plant's components last saw: DryObject.IsDry, ContaminatedObject.IsContaminated,
     *  LivingWaterObject.WaterNeedsAreMet (false = flooded). */
    isDry: boolean;
    isBad: boolean;
    flooded: boolean;
    /** WateredNaturalResource (or AridNaturalResource), LivingWaterNaturalResource,
     *  ContaminatedNaturalResource: each draws its delay once, when the plant is created. */
    soilTimer: Trigger;
    floodTimer: Trigger;
    badTimer: Trigger;
}

interface Source {
    template: string;
    cells: number[];
    /** WaterSource.SpecifiedStrength, limited to 8 per tile. */
    specified: number;
    defaultContamination: number;
    /** Has BadtideWaterSourceContaminationControllerSpec (every clean source and seep). */
    badtideControlled: boolean;
    badtideActive: boolean;
    strength: number;
    contamination: number;
    /** TimedComponentActivator. */
    delayed: boolean;
    activated: boolean;
    cyclesUntil: number;
    daysUntil: number;
    daysPassed: number;
    /** WaterDepthStrengthModifier (seeps). */
    seep: boolean;
    seepEnabled: boolean;
    seepModifier: number;
}

export interface Start {
    plans: readonly CyclePlan[];
    cycle: number;
    cycleDay: number;
    ticksToday: number;
    /** The game day the run starts on (1 for a new game). */
    dayNumber?: number;
}

export interface Options {
    /** Seed for the plants' random dying delays (the game draws them with Unity's generator). */
    seed?: number;
    /** Game seconds per rendered frame, for the seeps' fade (the game uses Time.deltaTime): 1/60 is
     *  60 frames a second at speed 1. */
    frameSeconds?: number;
    /** Start from the settle's stored momentum instead of the file's zeros. */
    settleMomentum?: boolean;
    /** Recompute every soil tile every tick (tests only; the result is the same). */
    fullSoil?: boolean;
    /** Put back one rule group of the study's first model, to measure what that rule changes. */
    legacy?: Legacy;
}

export interface Legacy extends WaterLegacy {
    /** Moisture moves toward its steady state every 16 ticks, rising 4 and falling 0.75 a tick. */
    moisture?: boolean;
    /** Soil contamination does the same with its own rates. */
    soilContamination?: boolean;
    /** Every task reads what the tasks before it wrote in the same tick. */
    lags?: boolean;
    /** The flood delay is exactly DaysToDie, not DaysToDie × U(0.9, 1.1). */
    floodDelay?: boolean;
    /** Start from the settle's full-precision water and momentum, not the file's. */
    settleState?: boolean;
}

/** The first model's soil: steady-state targets every 16 ticks with finite rates. */
class EquilibriumSoil {
    static readonly TICKS = 16;
    M: Float32Array;
    candidates: Float64Array;
    SC: Float32Array;
    private elapsed = 0;
    constructor(readonly b: BuildResult, readonly barrier: Uint8Array | null, M: ArrayLike<number>, SC: ArrayLike<number>) {
        this.M = Float32Array.from(M);
        this.SC = Float32Array.from(SC);
        this.candidates = Float64Array.from(SC);
    }
    step(D: Float64Array, C: Float64Array, which: Legacy): void {
        if (++this.elapsed < EquilibriumSoil.TICKS) return;
        const t = this.elapsed;
        this.elapsed = 0;
        const move = (a: number, b: number, up: number, down: number) => b > a ? Math.min(b, a + up) : Math.max(b, a - down);
        const { b } = this;
        if (which.moisture) {
            const target = moisture(b.heights, D, C, b.W, b.H, this.barrier);
            for (let i = 0; i < target.length; i++) {
                let v = move(this.M[i], target[i], 4 * t, .75 * t);
                if (v < .01 || this.barrier?.[i]) v = 0;
                this.M[i] = v;
            }
        }
        if (which.soilContamination) {
            const bad = soilContamination(b.heights, D, C, b.W, b.H, this.barrier);
            for (let i = 0; i < bad.length; i++) {
                this.candidates[i] = move(this.candidates[i], bad[i], .0396 * t, .0198 * t);
                let v = move(this.SC[i], this.candidates[i], .021 * t, .006 * t);
                if (v < .001 || this.barrier?.[i]) { v = 0; if (this.barrier?.[i]) this.candidates[i] = 0; }
                this.SC[i] = v;
            }
        }
    }
}

export function cloneModel(m: WaterModel): WaterModel {
    return { ...m, emitters: m.emitters.map(e => ({ ...e, cells: [...e.cells], depthLimit: e.depthLimit ? { ...e.depthLimit } : undefined })) };
}

/** A normal initialization ends on the canonical check, with no extra post-settle ticks. */
export function temperateSettle(model: WaterModel, slice = 16): CanonicalWater {
    const sim = new WaterSim(cloneModel(model), prefill(model));
    const run = new SettleRun(sim);
    let result = run.advance(slice);
    while (!result) result = run.advance(slice);
    return { ...result, depth: sim.D, contamination: sim.C, sat: sim.saturation(), out: sim.out.slice() };
}

/** A value as the map file stores it and the game reads it: seven significant digits, then float. */
const stored = (v: number) => Math.fround(Number.isInteger(v) && v >= 0 && v <= 16 ? v : Number(v.toPrecision(7)));

/** The simulation state the game loads from a generated map (src/core/format/world.ts
 *  settledSimulationSingletons): water under 1e-6 is dry, momentum is zero. */
export function fileState(b: BuildResult) {
    const N = b.W * b.H, depth = new Float64Array(N), contamination = new Float64Array(N);
    const moisture = new Float64Array(N), soil = new Float64Array(N), evaporation = new Float64Array(N);
    const sat = b.settle.sat;
    for (let i = 0; i < N; i++) {
        if (b.water[i] > 1e-6) {
            depth[i] = stored(b.water[i]);
            contamination[i] = b.contamination[i] > 1e-6 ? stored(b.contamination[i]) : 0;
        }
        moisture[i] = stored(b.moisture[i]);
        soil[i] = stored(b.soilContamination[i]);
        const t = 10 - (sat?.[i] ?? 0);
        evaporation[i] = sat?.[i] ? stored(0.0595 * (t * t) + 0.101 * t + 0.72) : 1;
    }
    return { depth, contamination, moisture, soil, evaporation };
}

export class CycleModel {
    readonly sim: GameWater;
    readonly soil: GameSoil;
    readonly clock: Clock;
    readonly plants: Plant[];
    readonly sources: Source[];
    readonly frameSeconds: number;
    readonly fullSoil: boolean;
    elapsedTicks = 0;
    private readonly z: Uint8Array;
    private readonly snapshot: SourceSnapshot[];
    private readonly legacy: Legacy;
    private readonly equilibrium: EquilibriumSoil | null;

    constructor(readonly built: BuildResult, start: Start, readonly options: Options = {}) {
        const seed = options.seed ?? 1729;
        this.frameSeconds = options.frameSeconds ?? 1 / 60;
        this.fullSoil = options.fullSoil ?? false;
        const objects = built.entities.map(o => ({ ...o, components: { ...o.before, ...o.components } }));
        if (objects.some(o => o.template === 'BadtideDrain' || o.template.startsWith('NaturalOverhang') || o.template === 'UnstableCore'))
            throw new Error('Roofed water and changing terrain are outside this generated-heightfield study.');
        const file = fileState(built), W = built.W, H = built.H, N = W * H;
        this.legacy = options.legacy ?? {};
        if (this.legacy.settleState) {
            file.depth = Float64Array.from(built.water);
            file.contamination = Float64Array.from(built.contamination);
        }
        this.z = built.heights;
        this.clock = new Clock(start.plans, start.cycle, start.cycleDay, start.ticksToday, start.dayNumber ?? 1);
        this.sim = new GameWater(cloneModel(built.waterModel), file.depth, file.contamination, file.evaporation,
            options.settleMomentum || this.legacy.settleState ? built.settle.out : undefined);
        this.sim.legacy = { contamination: this.legacy.contamination, bookkeeping: this.legacy.bookkeeping };
        const barrier = moistureBarrier(W, H, objects);
        this.equilibrium = this.legacy.moisture || this.legacy.soilContamination ? new EquilibriumSoil(built, barrier, file.moisture, file.soil) : null;
        const thorns = barrier ?? new Uint8Array(N);
        this.soil = new GameSoil({ W, H, z: built.heights, F: built.waterModel.floor, fullBarrier: thorns, aboveBarrier: new Uint8Array(N), contaminationBarrier: thorns },
            file.moisture, file.soil);
        const emitterObjects = objects.filter(o => EMITTERS[o.template]);
        if (emitterObjects.length !== built.waterModel.emitters.length) throw new Error('Emitter/object order mismatch');
        this.sources = emitterObjects.map((o, k) => {
            const rule = EMITTERS[o.template], a = o.components.TimeActivatedComponent as any;
            return {
                template: o.template, cells: built.waterModel.emitters[k].cells,
                specified: Math.min(specifiedStrength(o.components), rule.tiles.length * 8), defaultContamination: rule.contamination,
                badtideControlled: o.template !== 'BadwaterSource', badtideActive: false, strength: 0, contamination: rule.contamination,
                delayed: a?.IsEnabled === true, activated: false, cyclesUntil: a?.CyclesUntilCountdownActivation ?? 5,
                daysUntil: a?.DaysUntilActivation ?? 10, daysPassed: a?.DaysPassed ?? 0,
                seep: !!rule.seep, seepEnabled: false, seepModifier: (o.components.WaterDepthStrengthModifier as any)?.CurrentModifier ?? 0,
            };
        });
        this.snapshot = this.sources.map(s => ({ cells: s.cells, strength: 0, contamination: s.contamination }));
        this.sim.sources = this.snapshot;
        this.plants = objects.filter(o => SPECIES[o.template]).map(o => {
            const rng = new Rng(hash32(seed, o.id, 'survival')), rule = SPECIES[o.template];
            const dead = (o.components.LivingNaturalResource as any)?.IsDead === true;
            // Awake order: the soil timer, the flood timer, then the contamination timer.
            const soilTimer = new Trigger(rule.dry * rng.range(.9, 1.1));
            const floodFactor = rng.range(.9, 1.1);
            const floodTimer = new Trigger(rule.flood * (this.legacy.floodDelay ? 1 : floodFactor));
            const badTimer = new Trigger(rng.range(BAD_MIN, BAD_MAX));
            return { tile: o.y * W + o.x, species: o.template, initialDead: dead, dead, diedAt: null, cause: null,
                isDry: false, isBad: false, flooded: false, soilTimer, floodTimer, badTimer };
        });
        this.load();
    }

    /** Soil moisture and contamination as the last soil pass left them. */
    get M(): Float32Array { return this.legacy.moisture ? this.equilibrium!.M : this.soil.M; }
    get SC(): Float32Array { return this.legacy.soilContamination ? this.equilibrium!.SC : this.soil.level; }

    /** InitializeEntity / PostInitializeEntity of every component, at the loaded date. */
    private load(): void {
        const now = this.clock.partialDayNumber;
        for (const p of this.plants) {
            if (p.dead) continue;
            this.setDry(p, !(this.M[p.tile] > 0), now, true);
            this.setBad(p, this.SC[p.tile] > 0, now, true);
            this.setFlooded(p, this.waterAboveBase(p.tile) > 0, now, true);
        }
        for (const s of this.sources) {
            if (s.delayed && this.pastActivation(s)) s.activated = true;
            if (s.badtideControlled && this.clock.weather === 'badtide') s.badtideActive = true;
        }
        this.updateSources();
    }

    /** WaterObject.CurrentWaterAboveBase from the thread-safe water map. */
    private waterAboveBase(i: number): number {
        const d = this.sim.D[i];
        if (!(d > 0)) return 0;
        return Math.max(0, Math.ceil(Math.fround(this.sim.F[i] + Math.fround(d))) - this.z[i]);
    }

    private die(p: Plant, cause: string, now: number): void {
        p.dead = true;
        p.cause = cause;
        p.diedAt = (this.elapsedTicks + 1) / TICKS_PER_DAY; // the end of the tick it died in
        for (const t of [p.soilTimer, p.floodTimer, p.badTimer]) t.pause(now);
    }

    /** DryObject enter/exit → WateredNaturalResource (dry kills) or AridNaturalResource (moist kills). */
    private setDry(p: Plant, dry: boolean, now: number, force = false): void {
        if (!force && dry === p.isDry) return;
        p.isDry = dry;
        const arid = SPECIES[p.species].arid, dying = arid ? !dry : dry;
        if (dying) p.soilTimer.resume(now); else p.soilTimer.reset(now);
    }

    private setBad(p: Plant, bad: boolean, now: number, force = false): void {
        if (!force && bad === p.isBad) return;
        p.isBad = bad;
        if (bad) p.badTimer.resume(now); else p.badTimer.reset(now);
    }

    /** LivingWaterObject: land plants tolerate no water above their base (0..0). */
    private setFlooded(p: Plant, flooded: boolean, now: number, force = false): void {
        if (!force && flooded === p.flooded) return;
        p.flooded = flooded;
        if (flooded) p.floodTimer.resume(now); else p.floodTimer.reset(now);
    }

    private pastActivation(s: Source): boolean {
        return this.clock.cycle >= s.cyclesUntil && s.daysPassed + this.clock.dayProgress >= s.daysUntil;
    }

    /** WaterSource.Tick (with every IWaterStrengthModifier), BadtideWaterSourceContaminationController.Tick
     *  and TimedComponentActivator.Tick, reading the thread-safe water map. */
    private updateSources(): void {
        const clock = this.clock;
        for (const s of this.sources) {
            if (s.delayed && !s.activated && this.pastActivation(s)) s.activated = true;
            let modifier = droughtModifier(clock, s.specified);
            if (s.delayed && !s.activated) modifier = 0;
            if (s.template === 'Aquifer') modifier = 0; // UndergroundWaterSource: no finished drill
            if (s.seep) {
                const d = this.sim.D[s.cells[0]];
                if (s.seepEnabled && d > SEEP_LIMIT) s.seepEnabled = false;
                else if (!s.seepEnabled && d < SEEP_ON) s.seepEnabled = true;
                s.seepModifier = s.seepEnabled ? Math.min(1, s.seepModifier + SEEP_FADE * this.frameSeconds) : 0;
                modifier *= s.seepModifier;
            }
            s.strength = Math.min(s.specified * modifier, s.cells.length * 8);
            if (s.badtideActive) s.contamination = badtideContamination(clock);
        }
    }

    /** One game tick. */
    tick(): void {
        const clock = this.clock;
        // Singletons. DayNightCycle first: its events reach the weather, the badtide controllers and
        // the timed activators at once.
        for (const e of clock.tick()) {
            if (e === 'hazardEnded' && clock.previous?.hazard === 'badtide')
                for (const s of this.sources) if (s.badtideActive) { s.badtideActive = false; s.contamination = s.defaultContamination; }
            if (e === 'hazardStarted' && clock.plan.hazard === 'badtide')
                for (const s of this.sources) if (s.badtideControlled) s.badtideActive = true;
            if (e === 'dayStarted')
                for (const s of this.sources) {
                    if (!s.delayed || (clock.cycle === s.cyclesUntil && clock.cycleDay === 1)) continue;
                    if (clock.cycle >= s.cyclesUntil) s.daysPassed += 1;
                }
        }
        const lags = !this.legacy.lags;
        if (!lags) this.updateSources();
        // WaterSourceRegistry.Tick and WaterEvaporationMap.Tick.
        for (let k = 0; k < this.sources.length; k++) {
            this.snapshot[k].strength = this.sources[k].strength;
            this.snapshot[k].contamination = this.sources[k].contamination;
        }
        if (lags) this.sim.swapEvaporation();
        if (lags) this.plantsTick();
        // Entity components.
        if (lags) this.updateSources();
        // Parallel tasks.
        this.soil.step(this.sim.D, this.sim.C, lags ? this.sim.evapCurrent : this.sim.evapBuffered, this.fullSoil);
        this.equilibrium?.step(this.sim.D, this.sim.C, this.legacy);
        this.sim.tick();
        if (!lags) this.plantsTick();
        this.elapsedTicks++;
    }

    private plantsTick(): void {
        const clock = this.clock;
        // SoilMoistureService and SoilContaminationService publish last tick's soil; WaterObjectService
        // checks flooding; TimeTriggerService ends the timers that are due. A plant's events touch only
        // its own timers, so one pass per plant keeps the game's order.
        const now = clock.partialDayNumber, M = this.M, L = this.SC;
        for (const p of this.plants) {
            if (p.dead) continue;
            const dry = !(M[p.tile] > 0), bad = L[p.tile] > 0, flooded = this.waterAboveBase(p.tile) > 0;
            if (dry !== p.isDry) this.setDry(p, dry, now);
            if (bad !== p.isBad) this.setBad(p, bad, now);
            if (flooded !== p.flooded) this.setFlooded(p, flooded, now);
            let due: Trigger | null = null, cause = '';
            if (p.soilTimer.running && p.soilTimer.deadline <= now) { due = p.soilTimer; cause = SPECIES[p.species].arid ? 'wet soil' : 'dry soil'; }
            if (p.floodTimer.running && p.floodTimer.deadline <= now && (!due || p.floodTimer.deadline < due.deadline)) { due = p.floodTimer; cause = 'flood'; }
            if (p.badTimer.running && p.badTimer.deadline <= now && (!due || p.badTimer.deadline < due.deadline)) { due = p.badTimer; cause = 'bad soil'; }
            if (due) { due.finished = true; due.running = false; due.left = 0; this.die(p, cause, now); }
        }
    }

    run(ticks: number, onTick?: (model: CycleModel) => void): void {
        for (let t = 0; t < ticks; t++) { this.tick(); onTick?.(this); }
    }
}

/** Where a stretch of a schedule starts: `lead` days before the hazard of `plan`'s cycle. */
export function startBefore(plans: readonly CyclePlan[], cycle: number, lead: number): Start {
    return { plans, cycle, cycleDay: plans[cycle - 1].temperate + 1 - lead, ticksToday: 0 };
}

/** The longest source ramp on this map, in whole days, at least 1: a probe starting this long before a
 *  drought sees every source at full strength when it starts. */
export function rampLead(b: BuildResult): number {
    let lead = 1;
    for (const o of b.entities) {
        if (!EMITTERS[o.template]) continue;
        const s = Math.min(specifiedStrength({ ...o.before, ...o.components }), EMITTERS[o.template].tiles.length * 8);
        lead = Math.max(lead, Math.ceil(transitionDays(s)));
    }
    return lead;
}

/** A drought with every source already off: the map loads on the first day of a 40-day drought. */
export function sourcesOff(b: BuildResult, options: Options = {}): CycleModel {
    const plans: CyclePlan[] = [{ cycle: 1, temperate: 1, hazard: 'drought', hazardDays: 40, occurrence: 1, badtideChance: null }];
    return new CycleModel(b, { plans, cycle: 1, cycleDay: 2, ticksToday: 0 }, options);
}

/** A new game: cycle 1, day 1, hour 4. */
export function newGame(plans: readonly CyclePlan[]): Start {
    return { plans, cycle: 1, cycleDay: 1, ticksToday: NEW_GAME_TICK, dayNumber: 1 };
}
