import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { THEMES, THEME_NAMES } from '../../src/core/spec/mapspec';
const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const maps = readdirSync(`${dir}/results/maps`).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${dir}/results/maps/${f}`, 'utf8')));
const partial = process.argv.includes('--partial');
if (!partial)
    for (const theme of THEMES)
        for (const [size, seeds] of [[96, 2], [128, 30], [256, 2]])
            for (let seed = 1; seed <= seeds; seed++)
                if (!maps.some(m => m.theme === theme && m.size === size && m.seed === seed))
                    throw Error(`Missing ${theme} ${size} ${seed}`);
const good = maps.filter(m => m.passed), survey = good.filter(m => m.size === 128);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const q = (a: number[], p = .5) => { if (!a.length)
    return 0; const sorted = a.slice().sort((a, b) => a - b), i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
const span = (a: number[], percent = true) => `${percent ? pct(q(a, 0)) : q(a, 0).toFixed(1)}–${percent ? pct(q(a, 1)) : q(a, 1).toFixed(1)}`;
const hazard = (s: any) => s.days.filter((d: any) => d.phase !== 'normal').at(-1);
const signature = (m: any) => {
    const find = (id: string) => m.scenarios.find((s: any) => s.id === id), short = find('first-normal'), long = find('late-hard'), bad = find('first-badtide');
    const d = hazard(long), s = hazard(short), b = hazard(bad), base = m.baseline;
    const startDays = long.firstWaterLost === null ? 26 : Math.max(0, long.firstWaterLost - 1);
    const cleanVolume = (day: any) => day.regionCleanVolume.reduce((sum: number, v: number) => sum + v, 0);
    const values = { shortRetention: s.volume / base.volume, longRetention: d.volume / base.volume,
        cleanLongRetention: cleanVolume(d) / Math.max(1, cleanVolume(base)), startDays,
        driedShare: d.driedTiles / Math.max(1, base.wetTiles), fragments: Math.max(...long.days.map((x: any) => x.maxFragments)),
        badwaterExposure: Math.max(0, b.badTiles - base.badTiles) / Math.max(1, base.wetTiles - base.badTiles),
        soilExposure: Math.max(0, b.soilTiles - base.soilTiles) / (m.size * m.size),
        treesLost: d.plants.treesLost / Math.max(1, d.plants.originalTrees), bushesLost: d.plants.bushesLost / Math.max(1, d.plants.originalBushes),
        badRecovery: bad.recoveryDays ?? 6 };
    const vector = [values.shortRetention, values.longRetention, values.cleanLongRetention, startDays / 26, values.driedShare, Math.min(1, values.fragments / 20),
        values.badwaterExposure, values.soilExposure, values.treesLost, values.bushesLost, values.badRecovery / 6].map(x => Math.min(1, Math.max(0, x)));
    // Fixed diagnostic bins: retained water, source exposure, start access.
    const bin = (v: number, cuts: number[]) => cuts.filter(c => v >= c).length;
    const group = [bin(values.longRetention, [.05, .25, .5, .75]), bin(values.badwaterExposure, [.25, .5, .75]), bin(startDays, [1, 7, 14, 26])].join('/');
    return { id: m.id, theme: m.theme, seed: m.seed, ...values, vector, group };
};
const signatures = survey.map(signature);
const distance = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
const themeStats = THEMES.map(theme => {
    const rows = signatures.filter(s => s.theme === theme), groups = new Map<string, number>();
    rows.forEach(r => groups.set(r.group, (groups.get(r.group) ?? 0) + 1));
    const nearest = rows.map((r, i) => Math.min(...rows.filter((_, j) => i !== j).map(s => distance(r.vector, s.vector))));
    return { theme, n: rows.length, retentionRange: [q(rows.map(r => r.longRetention), 0), q(rows.map(r => r.longRetention), 1)],
        exposureRange: [q(rows.map(r => r.badwaterExposure), 0), q(rows.map(r => r.badwaterExposure), 1)],
        startRange: [q(rows.map(r => r.startDays), 0), q(rows.map(r => r.startDays), 1)],
        largestGroup: Math.max(0, ...groups.values()) / Math.max(1, rows.length), groups: groups.size, nearestMedian: q(nearest),
        pumpLostFirst: survey.filter(m => m.theme === theme && m.scenarios.find((s: any) => s.id === 'first-normal').firstWaterLost !== null).length };
});
const timings = [96, 128, 256].map(size => {
    const rows = good.filter(m => m.size === size && m.seed <= 2);
    return { size, n: rows.length, generationMedian: q(rows.map(m => m.timings.generationMs)) / 1000,
        settleMedian: q(rows.map(m => m.timings.settleMs)) / 1000, settleMax: q(rows.map(m => m.timings.settleMs), 1) / 1000,
        timelineMedian: q(rows.map(m => m.scenarios.reduce((s: number, x: any) => s + x.ms, 0))) / 1000,
        timelineMax: q(rows.map(m => m.scenarios.reduce((s: number, x: any) => s + x.ms, 0)), 1) / 1000,
        dayMedian: q(rows.map(m => m.scenarios.reduce((s: number, x: any) => s + x.ms, 0) / m.scenarios.reduce((s: number, x: any) => s + x.phases.reduce((a: number, p: any) => a + p.days, 0), 0))) / 1000 };
});
const comparisons = good.flatMap(m => m.droughtComparison.map((c: any) => ({ id: m.id, ...c })));
const failures = comparisons.filter(c => !c.withinFivePercent);
const baselineMax = Math.max(...comparisons.map(c => c.initialVolumeError));
const depthMax = Math.max(...comparisons.map(c => c.maxDepthError));
const generatedToleranceFailures = comparisons.filter(c => c.initialVolumeError > .05 || c.maxDepthError > .1);
const summary = { complete: !partial, maps: maps.length, passed: good.length, failed: maps.filter(m => !m.passed).map(m => m.id), survey: survey.length,
    timings, themeStats, settleMaxError: Math.max(...good.map(m => m.parity.depth)),
    drought: { comparisons: comparisons.length, withinFivePercent: comparisons.length - failures.length, failures, maxInitialVolumeError: baselineMax, maxDepthError: depthMax, generatedToleranceFailures },
    normalDriftMax: Math.max(...good.map(m => Math.abs(m.scenarios.find((s: any) => s.id === 'normal').finalRetention - 1))) };
if (partial) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
}
mkdirSync(`${dir}/results`, { recursive: true });
writeFileSync(`${dir}/results/summary.json`, JSON.stringify(summary, null, 2) + '\n');
writeFileSync(`${dir}/results/signatures.json`, JSON.stringify(signatures, null, 2) + '\n');
writeFileSync(`${dir}/results/timelines.json.gz`, gzipSync(JSON.stringify(maps), { level: 9 }));
const manifest = THEMES.flatMap(theme => [[96, 1], [128, 2]].map(([size, seed]) => ({ id: `${theme}-${size}-${seed}`, name: THEME_NAMES[theme], size, seed })));
writeFileSync(`${dir}/viewer/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
let md = `# Measured results\n\n${good.length}/${maps.length} generated maps passed generation. ${survey.length} survey maps: seeds 1–30 in each of six themes at 128². Size checks use seeds 1 and 2 in every theme at 96², 128² and 256². Generator 0.6.0; base cfa5990. Weather seed 1729.\n\n## Model checks\n\nCanonical initialization: maximum depth error ${summary.settleMaxError}. All source modifiers run each tick. A 17-day temperate continuation changes volume by at most ${pct(summary.normalDriftMax)}; the canonical stopping test allows small ongoing changes. We never pin or overwrite the timeline to make it match.\n\nDrought: ${summary.drought.withinFivePercent}/${comparisons.length} endpoints meet the 5% stored-volume tolerance (or 1 m³ when the analytic store is at most 1 m³). The largest difference is ${pct(baselineMax)} of the initial water. Every failed comparison is below. These are discrepancies, not passing claims under the original stored-volume tolerance. For generated maps we also report a practical tolerance: 0.1 block maximum tile-depth difference (the solver’s dry-ground spill threshold), and 5% of initial volume. This does not relax the three golden-fixture gates. The summary records any failures of this second tolerance.\n\nThe analytic view clips water to spill levels immediately, freezes pool membership and uses a fixed evaporation rate per pool. The tick model retains draining water and momentum, changes shoreline area, retains a shallow head at the 0.1 dry-ground spill threshold, and uses 10× evaporation below 0.02 deep. The long-drought failures are often tiny remnants: their percentage error grows as the denominator approaches zero. Large basins also retain the small outlet head that the analytic view clips. A sources-off comparison excludes ramping; weather timelines include it.\n\n| Map | Drought days | Analytic m³ | Simulated m³ | Difference / stored water | Difference / initial water | Max depth difference |\n|---|---:|---:|---:|---:|---:|---:|\n`;
for (const c of failures)
    md += `| ${c.id} | ${c.days} | ${c.analytic} | ${c.simulated} | ${c.relativeError === null ? 'dry' : pct(c.relativeError)} | ${pct(c.initialVolumeError)} | ${c.maxDepthError} |\n`;
md += `\nThe additional combined check (5% of initial volume and 0.1 block at every tile) passes ${comparisons.length - generatedToleranceFailures.length}/${comparisons.length} endpoints. Maximum tile-depth error across the set is ${depthMax} blocks. Exceptions follow; they are retained as failures of this target. A local depth mismatch can exist even when total stored volume passes.\n\n| Map | Drought days | Difference / initial water | Max depth difference |\n|---|---:|---:|---:|\n`;
for (const c of generatedToleranceFailures)
    md += `| ${c.id} | ${c.days} | ${pct(c.initialVolumeError)} | ${c.maxDepthError} |\n`;
md += `\nA direct inspection of Lake Basin 128² seed 14 locates the nine-day depth difference at (21, 79). The analytic pooled surface leaves 0.103987 depth; the tick model dries this tile and its two wet neighbours. The starting depth is 0.663610 and the spill depth is 0.65. Fixed pool evaporation and changing local wet footprints can therefore produce different wet/dry boundaries even with similar total volume. The precise source of this local discrepancy remains a calibration question; it is not hidden by a looser passing label. See [depth evidence](results/depth-outlier.json); reproduce with \`node investigation/cycles/run.cjs investigation/cycles/diagnose.ts\`.\n`;
md += `\n## Run time\n\nWall time in Node ${good[0].machine.node}, ${good[0].machine.cpu.trim()}. Batches ran concurrently with other work, so these are loaded-machine timings, not an isolated CPU benchmark. Generation, canonical settle and the six scenario timelines are timed separately. The six timelines total 73 simulated days; the direct nine- and 25-day drought comparisons are extra. File compression is outside the scenario timer. The viewer reads precomputed frames.\n\n| Size | Maps | Generation median, s | Settle median / max, s | Timelines median / max, s | Per-day median, s |\n|---|---:|---:|---:|---:|---:|\n`;
for (const t of timings)
    md += `| ${t.size}² | ${t.n} | ${t.generationMedian.toFixed(2)} | ${t.settleMedian.toFixed(2)} / ${t.settleMax.toFixed(2)} | ${t.timelineMedian.toFixed(2)} / ${t.timelineMax.toFixed(2)} | ${t.dayMedian.toFixed(3)} |\n`;
md += `\n## Cycle signature\n\nEleven quantities describe each map: water kept after the first Normal drought and a full-ramp Hard drought, plus clean water kept in the original water regions after that long drought; how long the start keeps pumpable clean water; wet tiles lost; the largest number of fragments from one original water body; new badwater exposure; new contaminated soil; original trees and bushes lost; and recovery time after badtide. Stored water and plant losses are fractions of their original totals. Start access is capped at 26 days (26 means it remained available throughout the 25-day hazard), fragments at 20, recovery at six days (six means not recovered within five). Soil exposure is a fraction of all map tiles. Other entries are clamped to 0–1 only for distance.\n\nDistance is the mean absolute difference over these eleven normalized values. A nearest-peer median close to zero means two seeds behave almost alike. This is a diagnostic, not M9's separate variety scale or an acceptance threshold.\n\nThe group key uses fixed bins: long-drought retention at 5/25/50/75%; new badwater exposure at 25/50/75%; start-water duration at 1/7/14/26 days. A large group means many maps share that broad opening. These bins do not establish perceptual equivalence.\n\n| Theme | n | Water kept after 25 days | New badwater reach after 1 day | Start water, days | Largest group | Groups | Nearest-peer median |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const t of themeStats)
    md += `| ${THEME_NAMES[t.theme]} | ${t.n} | ${span(t.retentionRange)} | ${span(t.exposureRange)} | ${span(t.startRange, false)} | ${pct(t.largestGroup)} | ${t.groups} | ${t.nearestMedian.toFixed(4)} |\n`;
md += `\nThe gallery adds a continuous 97-day run through the first five Normal cycles and five recovery days. Original plant deaths persist. The survey uses isolated probes to compare terrain under the same weather; it does not claim that late-cycle vegetation would still match a fresh map.\n\n## Definitions and limits\n\nWater is deeper than 0.05; pumpable water is at least 0.3 deep, below 5% contamination, within two levels of the start's shore and within the map's own walking limit. Start walks reuse the repo's same-level and slope rules. The original walking network is fixed: this is water access potential, not a beaver pathfinding or consumption forecast.\n\nRegions are fixed connected patches of the initial water, split into below-spill storage and river reaches. Their coordinates name the centroid, not an authored landmark. New water outside those patches is counted separately. Splits count connected descendants, including one-tile pools, at daily snapshots. First-dry and first-bad days are daily upper bounds; a missing event is right-censored at the run's end.\n\nRecovery means at least 95% of initial water and moist area, and badwater area no more than the initial area plus 1% of initial wet tiles. It does not mean every tile is back to its original condition. Dead original plants never revive; surviving mature trees retain potential logs even when dead. New seedlings, growth/yield amounts and player pumping are outside this study.\n\nSoil is an equilibrium spatial target with finite temporal rates, sampled every 16 ticks. On the 96² seed-1 badtide, one-tick and 16-tick updates give identical final soil and moisture, but differ by two plant deaths at day 1. This is an uncertainty check, not a comparison with the real game. Calibration remains necessary.\n\nMachine-readable evidence: [summary](results/summary.json), [signatures](results/signatures.json), [all daily timelines](results/timelines.json.gz), and [golden checks](results/verification.json). Timelines contain regions, daily measures, first-arrival maps and plant deaths. Gallery frames are display-quantized; measurements use Float64 values.\n`;
writeFileSync(`${dir}/RESULTS.md`, md);
console.log(JSON.stringify({ maps: maps.length, passed: good.length, survey: survey.length, timings, themeStats, droughtPass: summary.drought.withinFivePercent, comparisons: comparisons.length, normalDriftMax: summary.normalDriftMax }, null, 2));
