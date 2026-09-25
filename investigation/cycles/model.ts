import { WaterSim, TICKS_PER_DAY, SettleRun, type WaterModel } from '../../src/core/sim/water';
import { prefill, type CanonicalWater } from '../../src/core/sim/prefill';
import { moisture } from '../../src/core/sim/moisture';
import { soilContamination } from '../../src/core/sim/contamination';
import { moistureBarrier, EMITTERS, specifiedStrength } from '../../src/core/sim/model';
import { Rng } from '../../src/core/math/rng';
import { hash32 } from '../../src/core/math/hash';
import type { BuildResult } from '../../src/core/features/build';
import { sourceScale, badtideContamination, type Phase } from './weather';
export const SOIL_TICKS = 16; // 1/48 day; daily images never drive the simulation.
export const SPECIES: Record<string, {
    dry: number;
    flood: number;
    logs: number;
    arid?: boolean;
}> = {
    Pine: { dry: 13, flood: 12, logs: 2 }, Birch: { dry: 11, flood: 14, logs: 1 }, Oak: { dry: 15, flood: 10, logs: 8 },
    BlueberryBush: { dry: 9, flood: 7, logs: 0 }, Succulent: { dry: 8, flood: 4, logs: 0, arid: true },
};
export interface Plant {
    tile: number;
    species: string;
    initialDead: boolean;
    dead: boolean;
    dry: number;
    flood: number;
    bad: number;
    dryLimit: number;
    badLimit: number;
    diedAt: number | null;
    cause: string | null;
}
export function cloneModel(m: WaterModel): WaterModel {
    return { ...m, emitters: m.emitters.map(e => ({ ...e, cells: [...e.cells], depthLimit: e.depthLimit ? { ...e.depthLimit } : undefined })) };
}
/** A normal initialization ends on the canonical check, with no extra post-settle ticks. */
export function temperateSettle(model: WaterModel, slice = 16): CanonicalWater {
    const sim = new WaterSim(cloneModel(model), prefill(model));
    const run = new SettleRun(sim);
    let result = run.advance(slice);
    while (!result)
        result = run.advance(slice);
    return { ...result, depth: sim.D, contamination: sim.C, sat: sim.saturation(), out: sim.out.slice() };
}
const move = (a: number, b: number, up: number, down: number) => b > a ? Math.min(b, a + up) : Math.max(b, a - down);
export class CycleModel {
    readonly sim: WaterSim;
    readonly plants: Plant[];
    readonly barrier: Uint8Array | null;
    M: Float64Array;
    SC: Float64Array;
    candidates: Float64Array;
    elapsedTicks = 0;
    private soilElapsed = 0;
    private sources: {
        strength: number;
        contamination: number;
        template: string;
        activation: any;
    }[];
    constructor(readonly built: BuildResult, readonly seed = 1729, readonly soilTicks = SOIL_TICKS) {
        if (!Number.isInteger(soilTicks) || soilTicks < 1 || TICKS_PER_DAY % soilTicks)
            throw new Error('soilTicks must divide 768');
        const objects = built.entities.map(o => ({ ...o, components: { ...o.before, ...o.components } }));
        if (objects.some(o => o.template === 'BadtideDrain' || o.template.startsWith('NaturalOverhang') || o.template === 'UnstableCore'))
            throw new Error('Roofed water and changing terrain are outside this generated-heightfield study.');
        this.sim = new WaterSim(cloneModel(built.waterModel), { depth: built.water, contamination: built.contamination });
        this.sim.Dold.set(this.sim.D);
        if (built.settle.out)
            this.sim.out.set(built.settle.out);
        this.barrier = moistureBarrier(built.W, built.H, objects);
        this.M = built.moisture.slice();
        this.SC = built.soilContamination.slice();
        this.candidates = this.SC.slice();
        this.sources = objects.filter(o => EMITTERS[o.template]).map(o => ({
            strength: Math.min(specifiedStrength(o.components), EMITTERS[o.template].tiles.length * 8),
            contamination: EMITTERS[o.template].contamination, template: o.template, activation: o.components.TimeActivatedComponent,
        }));
        if (this.sources.length !== this.sim.emitters.length)
            throw new Error('Emitter/object order mismatch');
        this.plants = objects.filter(o => SPECIES[o.template]).map(o => {
            const rng = new Rng(hash32(seed, o.id, 'survival'));
            const dead = (o.components.LivingNaturalResource as any)?.IsDead === true;
            return { tile: o.y * built.W + o.x, species: o.template, initialDead: dead, dead, dry: 0, flood: 0, bad: 0,
                dryLimit: SPECIES[o.template].dry * rng.range(.9, 1.1), badLimit: rng.range(.2, .3), diedAt: null, cause: null };
        });
    }
    /** Source modifiers change every game tick; water retains its native two substeps. */
    tick(phase: Phase, phaseTick: number): void {
        const day = phaseTick / TICKS_PER_DAY;
        for (let k = 0; k < this.sources.length; k++) {
            const src = this.sources[k], e = this.sim.emitters[k], a = src.activation;
            const delay = a?.IsEnabled === true && (phase.cycle < (a.CyclesUntilCountdownActivation ?? 5) ||
                (phase.cycle === (a.CyclesUntilCountdownActivation ?? 5) && day < (a.DaysUntilActivation ?? 10)));
            // Aquifers cannot run on an untouched, unpowered map.
            e.strength = delay || src.template === 'Aquifer' ? 0 : src.strength * sourceScale(src.strength, phase, day);
            e.contamination = phase.weather === 'badtide' && src.contamination === 0 ? badtideContamination(day, phase.days) : src.contamination;
        }
        this.sim.run(1);
        this.elapsedTicks++;
        this.soilElapsed++;
        if (this.soilElapsed === this.soilTicks) {
            this.updateLife(this.soilElapsed);
            this.soilElapsed = 0;
        }
    }
    updateLife(ticks: number): void {
        const { built: b, sim: s } = this;
        const target = moisture(b.heights, s.D, s.C, b.W, b.H, this.barrier);
        const bad = soilContamination(b.heights, s.D, s.C, b.W, b.H, this.barrier);
        // Spatial targets are equilibrium fields; finite rise/decay preserves short recovery tails.
        // This operator split is an approximation, measured against one-tick soil updates in test.ts.
        for (let i = 0; i < s.N; i++) {
            this.M[i] = move(this.M[i], target[i], 4 * ticks, .75 * ticks);
            this.candidates[i] = move(this.candidates[i], bad[i], .0396 * ticks, .0198 * ticks);
            this.SC[i] = move(this.SC[i], this.candidates[i], .021 * ticks, .006 * ticks);
            if (this.M[i] < .01)
                this.M[i] = 0;
            if (this.SC[i] < .001)
                this.SC[i] = 0;
            if (this.barrier?.[i]) {
                this.M[i] = 0;
                this.SC[i] = 0;
                this.candidates[i] = 0;
            }
        }
        const dt = ticks / TICKS_PER_DAY;
        for (const p of this.plants) {
            if (p.dead)
                continue;
            const rule = SPECIES[p.species], i = p.tile;
            p.dry = (rule.arid ? this.M[i] > 0 : this.M[i] === 0) ? p.dry + dt : 0;
            p.flood = s.D[i] > 1e-9 ? p.flood + dt : 0;
            p.bad = this.SC[i] > 0 ? p.bad + dt : 0;
            const cause = p.bad >= p.badLimit ? 'bad soil' : p.dry >= p.dryLimit ? (rule.arid ? 'wet soil' : 'dry soil') : p.flood >= rule.flood ? 'flood' : null;
            if (cause) {
                p.dead = true;
                p.cause = cause;
                p.diedAt = this.elapsedTicks / TICKS_PER_DAY;
            }
        }
    }
    run(phase: Phase, onDay?: (day: number, model: CycleModel) => void): void {
        const ticks = Math.round(phase.days * TICKS_PER_DAY);
        onDay?.(0, this);
        for (let t = 0; t < ticks; t++) {
            this.tick(phase, t);
            if ((t + 1) % TICKS_PER_DAY === 0 || t + 1 === ticks)
                onDay?.((t + 1) / TICKS_PER_DAY, this);
        }
    }
}
