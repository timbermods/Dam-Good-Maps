// Summarize results/fidelity.json: how far each switched-back rule, and the first model, move the
// reference maps' outcomes from the exact model. Writes results/fidelity-summary.json.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const data = JSON.parse(readFileSync(`${dir}/results/fidelity.json`, 'utf8'));
const rows: any[] = data.results;
const rel = (a: number, b: number) => b > 1e-9 ? Math.abs(a - b) / b : Math.abs(a - b) > 1e-9 ? 1 : 0;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
function compare(pick: (row: any) => any, probes: string[]) {
    const pairs = rows.filter(r => probes.includes(r.probe)).flatMap(r => { const v = pick(r); return v ? [[r, v]] : []; });
    if (!pairs.length) return null;
    const stat = (f: (x: any) => number, relative = false) => {
        const d = pairs.map(([r, v]) => relative ? rel(f(v), f(r.exact)) : Math.abs(f(v) - f(r.exact)));
        return { mean: r3(d.reduce((a, b) => a + b, 0) / d.length), max: r3(Math.max(...d)) };
    };
    return {
        runs: pairs.length,
        hazardVolume: stat(x => x.hazardVolume, true),
        hazardMoistTiles: stat(x => x.hazardMoistTiles),
        hazardBadTiles: stat(x => x.hazardBadTiles),
        hazardSoilTiles: stat(x => x.hazardSoilTiles),
        endVolume: stat(x => x.endVolume, true),
        endMoistTiles: stat(x => x.endMoistTiles),
        deaths: { ...stat(x => x.deaths), exact: pairs.reduce((a, [r]) => a + r.exact.deaths, 0), switched: pairs.reduce((a, [, v]) => a + v.deaths, 0) },
        firstWaterLostChanged: pairs.filter(([r, v]) => r.exact.firstWaterLost !== v.firstWaterLost).length,
        cpu: { exact: r3(pairs.reduce((a, [r]) => a + r.exact.cpuMs, 0) / 1000), switched: r3(pairs.reduce((a, [, v]) => a + v.cpuMs, 0) / 1000) },
    };
}
const probes = ['first-normal', 'first-badtide', 'late-hard'];
const variants = Object.keys(rows.find(r => r.probe === 'first-normal').variants).filter(k => k !== 'leadOneDay');
const summary: any = { sameWeather: data.sameWeather, byProbe: {}, variants: {}, firstModel: {}, leadOneDay: null, newGame: null };
for (const v of variants) summary.variants[v] = Object.fromEntries(probes.map(p => [p, compare(r => r.variants[v], [p])]));
summary.firstModel = Object.fromEntries(probes.map(p => [p, compare(r => r.firstModel, [p])]));
summary.leadOneDay = compare(r => r.variants.leadOneDay, ['first-normal', 'late-hard']);
summary.newGame = compare(r => r.variants?.wholeFirstDay, ['new-game']);
summary.leadMaps = [...new Set(rows.filter(r => r.lead > 1).map(r => r.id))];
// Cost of exactness: CPU of the exact model over the first model on the same probes.
const both = rows.filter(r => r.firstModel);
summary.cost = { exactCpuSeconds: r3(both.reduce((a, r) => a + r.exact.cpuMs, 0) / 1000), firstModelCpuSeconds: r3(both.reduce((a, r) => a + r.firstModel.cpuMs, 0) / 1000) };
summary.cost.ratio = r3(summary.cost.exactCpuSeconds / summary.cost.firstModelCpuSeconds);
summary.cost.byProbe = Object.fromEntries(probes.map(p => { const x = both.filter(r => r.probe === p); return [p, r3(x.reduce((a, r) => a + r.exact.cpuMs, 0) / x.reduce((a, r) => a + r.firstModel.cpuMs, 0))]; }));
writeFileSync(`${dir}/results/fidelity-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 1));
