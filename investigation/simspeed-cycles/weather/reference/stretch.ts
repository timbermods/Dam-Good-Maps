// Weather stretches on the game's calendar, and the daily rows the measures and the viewer read.
import type { BuildResult } from '../../../../src/core/features/build';
import type { Difficulty } from '../../../../src/core/spec/mapspec';
import { CycleModel, newGame, rampLead, startBefore, type Start } from './model';
import { schedule, type CyclePlan, type Weather } from './weather';

export interface Stretch {
    id: string;
    label: string;
    start: Start;
    /** Calendar days to run: the run stops at the start of game day `start day + days`. */
    days: number;
}

export interface Row {
    day: number;
    phase: Weather;
    phaseDay: number;
    cycle: number;
}

export interface Span {
    weather: Weather;
    days: number;
    cycle: number;
    /** Cycle number for normal weather; the hazard's occurrence count otherwise. */
    occurrence: number;
}

/** The six probes of every map. Each loads the map at a date in the weather seed's schedule. A drought
 *  probe starts `rampLead` days before the drought, so every source is still at full strength. */
export function cases(b: BuildResult, seed = 1729): Stretch[] {
    const lead = rampLead(b);
    const normal = schedule('normal', seed), bad = normal.find(p => p.hazard === 'badtide')!;
    const hard = schedule('hard', seed, 40), later = hard.find(p => p.hazard === 'drought' && p.occurrence === 13)!;
    const first = (mode: Difficulty): Stretch => {
        const plans = schedule(mode, seed);
        return { id: `first-${mode}`, label: `First drought · ${mode}`, start: startBefore(plans, 1, lead), days: lead + plans[0].hazardDays + 3 };
    };
    return [
        { id: 'normal', label: 'Normal weather', start: { plans: normal, cycle: 1, cycleDay: 1, ticksToday: 0 }, days: normal[0].temperate },
        first('easy'), first('normal'), first('hard'),
        { id: 'first-badtide', label: `First badtide · Normal · cycle ${bad.cycle}`,
            start: { plans: normal, cycle: bad.cycle, cycleDay: bad.temperate + 1, ticksToday: 0 }, days: bad.hazardDays + 5 },
        { id: 'late-hard', label: `Later drought · Hard · cycle ${later.cycle}`, start: startBefore(hard, later.cycle, lead), days: lead + later.hazardDays + 5 },
    ];
}

/** A new Normal game from its first hour to five days after its first badtide. */
export function journey(seed = 1729): Stretch {
    const plans = schedule('normal', seed), bad = plans.findIndex(p => p.hazard === 'badtide');
    const days = plans.slice(0, bad + 1).reduce((a, p) => a + p.temperate + p.hazardDays, 0) + 5;
    return { id: 'journey', label: 'First five cycles · Normal', start: newGame(plans), days };
}

/** Run a stretch and report a row at its start and at every day boundary. When the weather changes at
 *  a boundary, the boundary gets two rows: one closing the old phase and one opening the new. */
export function runStretch(model: CycleModel, days: number, onRow: (row: Row, model: CycleModel) => void): Span[] {
    const clock = model.clock, startDay = clock.dayNumber;
    const spans: Span[] = [];
    let phase = clock.weather, cycle = clock.cycle, opened = 0;
    const open = () => spans.push({ weather: phase, days: 0, cycle, occurrence: phase === 'normal' ? cycle : clock.plan.occurrence });
    open();
    onRow({ day: 0, phase, phaseDay: 0, cycle }, model);
    while (clock.dayNumber - startDay < days) {
        model.tick();
        if (clock.ticksToday !== 0) continue;
        const day = clock.dayNumber - startDay;
        spans[spans.length - 1].days = day - opened;
        onRow({ day, phase, phaseDay: day - opened, cycle }, model);
        if ((clock.weather !== phase || clock.cycle !== cycle) && day < days) {
            phase = clock.weather;
            cycle = clock.cycle;
            opened = day;
            open();
            onRow({ day, phase, phaseDay: 0, cycle }, model);
        }
    }
    return spans;
}

export type { CyclePlan };
