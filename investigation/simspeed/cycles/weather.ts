import { Rng } from '../../../src/core/math/rng';
import { expDet } from '../../../src/core/math/detmath';
import type { Difficulty } from '../../../src/core/spec/mapspec';
export type Weather = 'normal' | 'drought' | 'badtide';
export interface Phase {
    weather: Weather;
    days: number;
    cycle: number;
    occurrence: number;
    previous?: Weather;
    next?: Weather;
}
export const MODES = {
    easy: { normal: [16, 19], drought: [2, 4], droughtHandicap: .25, droughtRamp: 8, firstBad: 6, badtide: [1, 3], badHandicap: .3, badRamp: 6 },
    normal: { normal: [13, 17], drought: [5, 9], droughtHandicap: .38, droughtRamp: 5, firstBad: 5, badtide: [4, 8], badHandicap: .15, badRamp: 5 },
    hard: { normal: [5, 8], drought: [15, 30], droughtHandicap: .2, droughtRamp: 12, firstBad: 4, badtide: [15, 30], badHandicap: .4, badRamp: 9 },
} as const;
export function handicap(n: number, initial: number, ramp: number): number {
    return initial + (1 - initial) * Math.min(1, Math.max(0, (n - 1) / ramp));
}
// HazardousWeatherRandomizer: reduce a streak below 5% likelihood, reset below 2.5%.
export function badChance(previous: Weather | undefined, streak: number): number {
    if (!streak)
        return .4;
    let p = previous === 'badtide' ? .4 : .6;
    let likelihood = 1;
    for (let i = 0; i < streak + 1; i++)
        likelihood *= p;
    if (likelihood < .025)
        p = 0;
    else if (likelihood < .05)
        p *= .5;
    return previous === 'badtide' ? p : 1 - p;
}
export function schedule(mode: Difficulty, seed = 1729, cycles = 30): Phase[] {
    const m = MODES[mode], rng = new Rng(seed), out: Phase[] = [];
    let droughts = 0, badtides = 0, streak = 0, previous: Weather | undefined;
    for (let cycle = 1; cycle <= cycles; cycle++) {
        const days = rng.int(m.normal[0], m.normal[1] + 1);
        const weather = cycle >= m.firstBad && rng.float() < badChance(previous, streak) ? 'badtide' : 'drought';
        const n = weather === 'drought' ? ++droughts : ++badtides;
        const range = m[weather];
        const h = weather === 'drought' ? handicap(n, m.droughtHandicap, m.droughtRamp) : handicap(n, m.badHandicap, m.badRamp);
        const duration = Math.max(1, Math.round(rng.range(range[0], range[1]) * h));
        out.push({ weather: 'normal', days, cycle, occurrence: cycle, previous, next: weather });
        out.push({ weather, days: duration, cycle, occurrence: n, previous: 'normal', next: 'normal' });
        streak = previous === weather ? streak + 1 : 1;
        previous = weather;
    }
    return out;
}
export function sourceScale(strength: number, phase: Phase, day: number): number {
    if (phase.weather === 'drought')
        return 0;
    if (phase.weather === 'badtide' || strength <= 0)
        return 1;
    const transition = strength / (460.8 * .0058);
    const curve = (p: number) => p * (.85 * p + .15);
    if (phase.next === 'drought' && day >= phase.days - transition)
        return 1 - curve(Math.min(1, (day - phase.days + transition) / transition));
    if (phase.previous === 'drought' && day < transition)
        return curve(Math.max(0, day / transition));
    return 1;
}
export function badtideContamination(day: number, days: number): number {
    const edge = Math.min(day, days - day);
    if (edge >= .5)
        return 1;
    const x = 17 * (Math.max(0, edge) - .5);
    return .5 + 1 / (expDet(x) + expDet(-x));
}

