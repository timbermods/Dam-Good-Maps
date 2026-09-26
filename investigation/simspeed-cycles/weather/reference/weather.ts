// The game clock, the weather schedule and the water-source modifiers, as Timberborn 1.1.2.4 runs
// them. FIDELITY.md names the class and member behind every rule; no game code is copied here.
import { Rng } from '../../../../src/core/math/rng';
import { expDet } from '../../../../src/core/math/detmath';
import type { Difficulty } from '../../../../src/core/spec/mapspec';

export type Hazard = 'drought' | 'badtide';
export type Weather = 'normal' | Hazard;

const f = Math.fround;
/** DayNightCycleSpec.ConfiguredDayLengthInTicks. */
export const TICKS_PER_DAY = 768;
/** DayNightCycleSpec.HoursPassedOnNewGame 4, as DayNightCycle.HoursToTicks: int(4 / 24 · 768). */
export const NEW_GAME_TICK = 128;
/** DayNightCycle.DayLengthInSeconds: 768 × TickTimeSpec 0.6, in float. */
export const DAY_SECONDS = f(768 * f(0.6));
/** WaterStrengthSpec. */
const MAX_CHANGE = f(0.0058), MIN_SCALER = f(0.15);

/** GameModeSpec, NewGameModes/GameMode.*. */
export const MODES = {
    easy: { temperate: [16, 19], drought: [2, 4], droughtHandicap: .25, droughtCycles: 8, randomizeAfter: 5, chance: .4, badtide: [1, 3], badHandicap: .3, badCycles: 6 },
    normal: { temperate: [13, 17], drought: [5, 9], droughtHandicap: .38, droughtCycles: 5, randomizeAfter: 4, chance: .4, badtide: [4, 8], badHandicap: .15, badCycles: 5 },
    hard: { temperate: [5, 8], drought: [15, 30], droughtHandicap: .2, droughtCycles: 12, randomizeAfter: 3, chance: .4, badtide: [15, 30], badHandicap: .4, badCycles: 9 },
} as const;

/** One cycle: temperate days, then its hazard. `occurrence` counts that hazard type so far. */
export interface CyclePlan {
    cycle: number;
    temperate: number;
    hazard: Hazard;
    hazardDays: number;
    occurrence: number;
    /** The badtide probability the game used for this cycle (null before badtides can occur). */
    badtideChance: number | null;
}

/** HazardousWeatherHelper.GetHandicapMultiplier: lerp(handicap, 1, (n − 1) / cycles). */
export function handicap(n: number, initial: number, cycles: number): number {
    const t = cycles > 0 ? Math.min(1, Math.max(0, (n - 1) / cycles)) : 1;
    return initial + (1 - initial) * t;
}

/** HazardousWeatherRandomizer: the chance of a badtide after `history`, most recent last. */
export function badtideChance(history: readonly Hazard[], base: number): number {
    if (!history.length) return base;
    const last = history[history.length - 1];
    let streak = 0;
    for (let i = history.length - 1; i >= 0 && history[i] === last; i--) streak++;
    let p = last === 'badtide' ? base : 1 - base;
    const likelihood = Math.pow(p, streak + 1);
    if (likelihood < .025) p = 0;
    else if (likelihood < .05) p *= .5;
    return last === 'badtide' ? p : 1 - p;
}

/** Mathf.Approximately. */
const approximately = (a: number, b: number) => Math.abs(b - a) < Math.max(1e-6 * Math.max(Math.abs(a), Math.abs(b)), 1.1920929e-7 * 8);

/** The cycles of one game, drawn in the game's order with the game's odds. A seeded generator stands
 *  in for Unity's: the odds match, the sequence cannot. */
export function schedule(mode: Difficulty, seed = 1729, cycles = 30): CyclePlan[] {
    const m = MODES[mode], rng = new Rng(seed), out: CyclePlan[] = [], history: Hazard[] = [];
    const counts = { drought: 0, badtide: 0 };
    for (let cycle = 1; cycle <= cycles; cycle++) {
        // TemperateWeatherDurationService.GenerateDuration: Range(min, max + 1).
        const temperate = rng.int(m.temperate[0], m.temperate[1] + 1);
        // HazardousWeatherService.SetForCycle → HazardousWeatherRandomizer → CheckProbability, which
        // draws nothing when the chance is 1.
        let chance: number | null = null, hazard: Hazard = 'drought';
        if (cycle > m.randomizeAfter) {
            chance = badtideChance(history, m.chance);
            if (approximately(chance, 1) || rng.float() < chance) hazard = 'badtide';
        }
        const n = ++counts[hazard];
        const range = m[hazard], h = hazard === 'drought' ? handicap(n, m.droughtHandicap, m.droughtCycles) : handicap(n, m.badHandicap, m.badCycles);
        // DroughtWeather/BadtideWeather.GetDurationAtCycle: round-away(Range(h·min, h·max)), at least 1.
        const lo = h * range[0], hi = h * range[1];
        const hazardDays = Math.max(1, Math.round(lo + (hi - lo) * rng.float()));
        out.push({ cycle, temperate, hazard, hazardDays, occurrence: n, badtideChance: chance });
        history.push(hazard);
    }
    return out;
}

export type ClockEvent = 'dayStarted' | 'hazardEnded' | 'cycleStarted' | 'hazardStarted';

/** DayNightCycle, GameCycleService and WeatherService together. A cycle day starts when the night
 *  ends (tick 0 of a day); a hazard starts on cycle day temperate + 1 and ends with its cycle. */
export class Clock {
    dayNumber: number;
    ticksToday: number;
    cycle: number;
    cycleDay: number;
    constructor(readonly plans: readonly CyclePlan[], cycle = 1, cycleDay = 1, ticksToday = NEW_GAME_TICK, dayNumber = 1) {
        this.cycle = cycle;
        this.cycleDay = cycleDay;
        this.ticksToday = ticksToday;
        this.dayNumber = dayNumber;
    }
    get plan(): CyclePlan { return this.plans[this.cycle - 1]; }
    get dayProgress(): number { return this.ticksToday / TICKS_PER_DAY; }
    get partialDayNumber(): number { return this.dayNumber + this.dayProgress; }
    get partialCycleDay(): number { return this.cycleDay + this.dayProgress; }
    get hazardStartDay(): number { return this.plan.temperate + 1; }
    get cycleLength(): number { return this.plan.temperate + this.plan.hazardDays; }
    get isHazardous(): boolean { return this.cycleDay >= this.hazardStartDay; }
    get weather(): Weather { return this.isHazardous ? this.plan.hazard : 'normal'; }
    /** HazardousWeatherHistory.TryGetPreviousHazardousWeatherData: the last cycle's hazard. */
    get previous(): CyclePlan | null { return this.cycle > 1 ? this.plans[this.cycle - 2] : null; }
    /** One DayNightCycle.Tick and the events it posts, in order. */
    tick(): ClockEvent[] {
        this.ticksToday++;
        if (this.ticksToday < TICKS_PER_DAY) return [];
        this.ticksToday -= TICKS_PER_DAY;
        this.dayNumber++;
        const events: ClockEvent[] = [];
        this.cycleDay++;
        if (this.cycleDay > this.cycleLength) {
            if (this.plan.hazardDays > 0) events.push('hazardEnded');
            if (this.cycle >= this.plans.length) throw new Error('The weather plan ran out of cycles');
            this.cycle++;
            this.cycleDay = 1;
            events.push('cycleStarted');
        }
        events.push('dayStarted');
        if (this.cycleDay === this.hazardStartDay) events.push('hazardStarted');
        return events;
    }
}

/** DroughtWaterStrengthModifier.GetTransitionTime, in days. */
export function transitionDays(strength: number): number {
    return strength / (DAY_SECONDS * MAX_CHANGE);
}

/** DroughtWaterStrengthModifier.GetModifier: the eased share of the ramp done after `progress` days. */
function eased(progress: number, transition: number, strength: number): number {
    const scaler = (1 - MIN_SCALER) * (progress / transition) + MIN_SCALER;
    return progress * DAY_SECONDS * MAX_CHANGE * scaler / strength;
}

/** DroughtWaterStrengthModifier.GetStrengthModifier for a source of specified strength `strength`. */
export function droughtModifier(clock: Clock, strength: number): number {
    if (clock.isHazardous) return clock.plan.hazard === 'drought' ? 0 : 1;
    if (!(strength > 0)) return 1;
    const transition = transitionDays(strength);
    const rampStart = clock.hazardStartDay - transition;
    if (clock.plan.hazard === 'drought' && clock.plan.hazardDays > 0 && clock.partialCycleDay >= rampStart)
        return 1 - eased(clock.partialCycleDay - rampStart, transition, strength);
    const since = clock.partialCycleDay - 1;
    const prev = clock.previous;
    if (prev && prev.hazardDays > 0 && prev.hazard === 'drought' && since < transition) return eased(since, transition, strength);
    return 1;
}

/** BadtideWaterSourceContaminationController.GetCurrentContamination while a badtide runs. */
export function badtideContamination(clock: Clock): number {
    const shape = (t: number) => { const x = 17 * (t - .5); return 1 / (expDet(x) + expDet(-x)) + .5; };
    const sinceStart = clock.partialCycleDay - clock.hazardStartDay;
    if (sinceStart < .5) return shape(sinceStart);
    const toEnd = clock.cycleLength + 1 - clock.partialCycleDay;
    if (toEnd < .5) return shape(toEnd);
    return 1;
}
