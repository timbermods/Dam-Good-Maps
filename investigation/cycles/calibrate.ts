import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const get = (id: string) => JSON.parse(gunzipSync(readFileSync(`${dir}/viewer/data/${id}.json.gz`)).toString());
const unpack = (r: number[]) => { const a: number[] = []; for (let i = 0; i < r.length; i += 2)
    for (let k = 0; k < r[i]; k++)
        a.push(r[i + 1]); return a; };
const river = get('riverValley-128-2'), lake = get('lakeBasin-128-2');
const rs = river.scenarios.find((s: any) => s.id === 'first-normal'), ls = lake.scenarios.find((s: any) => s.id === 'first-hard'), bs = river.scenarios.find((s: any) => s.id === 'first-badtide');
const index = (s: any, phase: string, day: number) => s.days.findIndex((d: any) => d.phase === phase && d.phaseDay === day);
const r0 = unpack(rs.frames[0].depth), r1 = unpack(rs.frames[index(rs, 'drought', 1)].depth);
const l0 = unpack(ls.frames[0].depth), l4 = unpack(ls.frames[index(ls, 'drought', 4)].depth);
const c0 = unpack(bs.frames[0].bad), c1 = unpack(bs.frames[index(bs, 'badtide', 1)].bad);
const coordinate = (i: number) => `(${i % 128}, ${Math.floor(i / 128)})`;
const candidates = r0.flatMap((d, i) => d >= 300 && r1[i] <= 50 ? [i] : []).sort((a, b) => Math.abs(a % 128 - 90) - Math.abs(b % 128 - 90));
const ri = candidates[0];
let li = 0;
for (let i = 1; i < l0.length; i++)
    if (l0[i] > l0[li])
        li = i;
const badTiles = c1.flatMap((c, i) => c >= 50 && c0[i] < 50 && r0[i] >= 300 ? [i] : []).sort((a, b) => b % 128 - a % 128);
const bi = badTiles[0], badEnd = bs.days[index(bs, 'badtide', 1)];
const point = { river: { tile: ri, coordinate: coordinate(ri), before: r0[ri] / 1000, day1: r1[ri] / 1000 }, lake: { tile: li, coordinate: coordinate(li), before: l0[li] / 1000, day4: l4[li] / 1000 }, bad: { tile: bi, coordinate: coordinate(bi), contamination: c1[bi] / 1000 } };
writeFileSync(`${dir}/results/calibration-points.json`, JSON.stringify(point, null, 2) + '\n');
writeFileSync(`${dir}/CALIBRATION.md`, `# One evening in game\n\nUse **River Valley, seed 2, 128²** and **Lake Basin, seed 2, 128²**, both generated with the Normal map settings on base cfa5990. Generate their files with the two-map command in [README](README.md); filenames are in \`generated/\`. Use the viewer's tile readout to find the points below. North is up; coordinates are zero-based (x, y). Leave the land and water untouched. Do not build pumps or dams.\n\nRecord the actual weather duration and start each hazard's clock at zero. The model's weather seed does not reproduce Timberborn's random sequence. Compare the same number of days; if the game ends a hazard early, record that and use an earlier common day. Pause for each reading.\n\n| Watch | Point and predicted result | Write down |\n|---|---|---|\n| River drying | River Valley ${coordinate(ri)}: ${point.river.before.toFixed(3)} deep initially, below 0.05 by drought day 1. The first Normal probe lasts 2 days. | Last wet time, first dry time, and whether the adjoining reach separates into pools. |\n| Lake evaporation | Lake Basin ${coordinate(li)}: ${point.lake.before.toFixed(3)} initially, ${point.lake.day4.toFixed(3)} by drought day 4, including the source slowdown before it. Use a drought lasting at least four days. | Depth before the source slowdown, at hazard start, and on day 4. This separates drainage from evaporation. |\n| Badtide front | River Valley ${coordinate(bi)} is newly contaminated by the end of badtide day 1 (model fraction ${(point.bad.contamination * 100).toFixed(1)}%). | When the front reaches this tile, and whether nearby bushes start dying before the day ends. |\n| Recovery and food | On that River Valley badtide, ${badEnd.plants.nearBushesAlive} original bushes near the start remain alive at day 1. Let temperate weather return for five days. | When the river is visibly clean, when the banks turn green, and which original bushes remain dead. Do not count new seedlings as revival. |\n\nAlso note when the start's existing shore becomes too shallow for a two-level pump intake, without building one. In the viewer this means at least 0.3 water depth, below 5% contamination, and the surface within two levels of the start's bank. A colour change alone cannot verify that threshold.\n\nScreenshots at the four readings and a few times/depths are enough. Tune source ramps first if drying is early or late; then evaporation, contamination travel, soil recovery and plant timers. These checks are pending. No in-game check was run by this investigation.\n`);
console.log(point);
