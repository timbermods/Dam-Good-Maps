// Write CALIBRATION.md: a few in-game spot checks, predicted by the exact model from the viewer data.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SPECIES } from './model';
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const get = (id: string) => JSON.parse(gunzipSync(readFileSync(`${dir}/viewer/data/${id}.json.gz`)).toString());
const unpack = (r: number[]) => { const a: number[] = []; for (let i = 0; i < r.length; i += 2) for (let k = 0; k < r[i]; k++) a.push(r[i + 1]); return a; };
const river = get('riverValley-128-2'), lake = get('lakeBasin-128-2');
const rs = river.scenarios.find((s: any) => s.id === 'first-normal'), ls = lake.scenarios.find((s: any) => s.id === 'first-hard'), bs = river.scenarios.find((s: any) => s.id === 'first-badtide');
const index = (s: any, phase: string, day: number) => s.days.findIndex((d: any) => d.phase === phase && d.phaseDay === day);
const coordinate = (i: number) => `(${i % 128}, ${Math.floor(i / 128)})`;
const hazardStart = (s: any) => s.days.find((d: any) => d.phase !== 'normal').day;
// A river tile that is at least 0.3 deep at the start and dry by the end of drought day 1.
const r0 = unpack(rs.frames[0].depth), r1 = unpack(rs.frames[index(rs, 'drought', 1)].depth);
const ri = r0.flatMap((d, i) => d >= 300 && r1[i] <= 50 ? [i] : []).sort((a, b) => Math.abs(a % 128 - 90) - Math.abs(b % 128 - 90))[0];
// The deepest lake tile through the first Hard drought.
const l0 = unpack(ls.frames[0].depth), lStart = unpack(ls.frames[index(ls, 'drought', 0)].depth), l4 = unpack(ls.frames[index(ls, 'drought', 4)].depth);
let li = 0;
for (let i = 1; i < l0.length; i++) if (l0[i] > l0[li]) li = i;
// A river tile that is clean at the start and at least half contaminated after badtide day 1.
const c0 = unpack(bs.frames[0].bad), c1 = unpack(bs.frames[index(bs, 'badtide', 1)].bad);
const bi = c1.flatMap((c, i) => c >= 500 && c0[i] < 50 && r0[i] >= 300 ? [i] : []).sort((a, b) => b % 128 - a % 128)[0];
// The first original plant to die of dry soil in the later Hard drought.
const hs = river.scenarios.find((s: any) => s.id === 'late-hard');
const dry = hs.deaths.filter((d: any) => d.cause === 'dry soil').sort((a: any, b: any) => a.day - b.day)[0];
const plant = dry ? river.plants[dry.plant] : null;
const point = {
    river: { tile: ri, coordinate: coordinate(ri), before: r0[ri] / 1000, droughtDay1: r1[ri] / 1000 },
    lake: { tile: li, coordinate: coordinate(li), before: l0[li] / 1000, hazardStart: lStart[li] / 1000, droughtDay4: l4[li] / 1000 },
    badtide: { tile: bi, coordinate: coordinate(bi), contaminationDay1: c1[bi] / 1000 },
    plant: plant && { species: plant.species, coordinate: coordinate(plant.tile), day: dry.day, droughtDay: Math.round((dry.day - hazardStart(hs)) * 10) / 10 },
};
writeFileSync(`${dir}/results/calibration-points.json`, JSON.stringify(point, null, 2) + '\n');
const window = plant ? SPECIES[plant.species].dry : 0;
writeFileSync(`${dir}/CALIBRATION.md`, `# Spot checks in game

The model's rules and timings now come from the game's code ([FIDELITY.md](FIDELITY.md)), so these are spot checks, not calibration. Each takes a few minutes. None has been run; no game was launched for this study.

Generate **River Valley, seed 2, 128²** and **Lake Basin, seed 2, 128²** with the two-map command in [README](README.md). Start a Normal game (Hard for check 2), build nothing, and pause for each reading. Coordinates are zero-based (x, y), north up; the viewer's tile readout shows them. The game's weather is random: count days from the start of each hazard, not from the model's calendar.

1. **Source slowdown.** River Valley ${point.river.coordinate} is ${point.river.before.toFixed(2)} deep before the first drought and dry by the end of its first day.
2. **Evaporation.** Lake Basin ${point.lake.coordinate} is ${point.lake.before.toFixed(3)} deep before the first Hard drought, ${point.lake.hazardStart.toFixed(3)} when it starts and ${point.lake.droughtDay4.toFixed(3)} on its fourth day.
3. **Badtide front.** River Valley ${point.badtide.coordinate} is clean before the first badtide and about ${Math.round(point.badtide.contaminationDay1 * 100)}% contaminated after its first day.
${plant ? `4. **Plant timer.** The ${plant.species} at River Valley ${point.plant!.coordinate} is the first original plant to die of dry soil in the later Hard drought (cycle ${hs.phases.find((p: any) => p.weather !== 'normal').cycle}), on drought day ${point.plant!.droughtDay}. A dry ${plant.species} dies ${(window * .9).toFixed(1)}–${(window * 1.1).toFixed(1)} days after its soil dries.\n` : ''}
A mismatch in check 1 points at the source ramp, in 2 at evaporation, in 3 at contamination transport, and in 4 at soil drying or the dying timers. The random parts (weather, plant delays) differ by run; the deterministic parts should match within a tick or two.
`);
console.log(point);
