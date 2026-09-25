import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { THEMES } from '../../src/core/spec/mapspec';

const dir = process.cwd().endsWith('cycles') ? '.' : 'investigation/cycles';
const json = (path: string) => JSON.parse(readFileSync(`${dir}/${path}`, 'utf8'));
const compressed = (path: string) => JSON.parse(gunzipSync(readFileSync(`${dir}/${path}`)).toString());
const maps: any[] = compressed('results/timelines.json.gz');
const manifest: any[] = json('viewer/manifest.json');
const ids = new Set(maps.map(m => m.id));
assert.equal(maps.length, 204);
assert.equal(ids.size, 204);
assert.equal(manifest.length, 12);
assert.equal(new Set(manifest.map(m => m.id)).size, 12);
for (const theme of THEMES) {
    for (const [size, count] of [[96, 2], [128, 30], [256, 2]]) {
        for (let seed = 1; seed <= count; seed++) assert(ids.has(`${theme}-${size}-${seed}`));
    }
}

function rle(pairs: number[], n: number, min: number, max: number) {
    assert.equal(pairs.length % 2, 0);
    let count = 0;
    for (let i = 0; i < pairs.length; i += 2) {
        assert(Number.isInteger(pairs[i]) && pairs[i] > 0);
        assert(Number.isInteger(pairs[i + 1]) && pairs[i + 1] >= min && pairs[i + 1] <= max);
        count += pairs[i];
    }
    assert.equal(count, n);
}

let dailyRows = 0, frames = 0;
function timeline(s: any, n: number, regions: number) {
    const duration = s.phases.reduce((a: number, p: any) => a + p.days, 0);
    assert.equal(s.days[0].day, 0);
    assert.equal(s.days.at(-1).day, duration);
    const days = new Set(s.days.map((d: any) => d.day));
    for (let d = 0; d <= duration; d++) assert(days.has(d), `Missing day ${d}`);
    let previous = -1, trees = 0, bushes = 0;
    for (const d of s.days) {
        dailyRows++;
        assert(Number.isInteger(d.day) && d.day >= previous);
        previous = d.day;
        for (const key of ['volume', 'badVolume', 'wetTiles', 'badTiles', 'soilTiles', 'moistTiles', 'driedTiles', 'pumpTiles']) {
            assert(Number.isFinite(d[key]) && d[key] >= 0, `${key} is invalid`);
        }
        assert(d.badVolume <= d.volume + .001 && d.badTiles <= d.wetTiles);
        assert(d.wetTiles <= n && d.soilTiles <= n && d.moistTiles <= n);
        assert.equal(d.regionVolume.length, regions);
        assert.equal(d.regionCleanVolume.length, regions);
        const sum = d.regionVolume.reduce((a: number, b: number) => a + b, d.outsideBaselineVolume);
        assert(Math.abs(sum - d.volume) <= (regions + 2) * .00051, 'Region totals differ from whole-map water');
        d.regionCleanVolume.forEach((v: number, i: number) => assert(v >= 0 && v <= d.regionVolume[i] + .001));
        assert(d.plants.treesLost >= trees && d.plants.bushesLost >= bushes, 'Original plants revived');
        trees = d.plants.treesLost;
        bushes = d.plants.bushesLost;
        assert(trees <= d.plants.originalTrees && bushes <= d.plants.originalBushes);
    }
    if (s.firstDry) rle(s.firstDry, n, -1, duration * 48);
    if (s.firstBad) rle(s.firstBad, n, -1, duration * 48);
}

for (const m of maps) {
    assert(m.passed, m.id);
    assert.equal(m.parity.depth, 0);
    assert.equal(m.parity.contamination, 0);
    assert.equal(m.scenarios.length, 6);
    for (const s of m.scenarios) timeline(s, m.size ** 2, m.regions.length);
}
for (const entry of manifest) {
    const m = compressed(`viewer/data/${entry.id}.json.gz`);
    const raw = maps.find(row => row.id === entry.id);
    assert.equal(m.id, entry.id);
    assert.equal(m.sha256, raw.sha256);
    assert.equal(m.scenarios.length, 7);
    rle(m.heights, m.size ** 2, 0, 255);
    for (const s of m.scenarios) {
        assert.equal(s.frames.length, s.days.length);
        if (s.id === 'journey') {
            const journey = compressed(`results/journeys/${entry.id}.json.gz`);
            assert.deepEqual(s.days, journey.days);
            assert.equal(s.days.at(-1).day, 97);
            timeline(s, m.size ** 2, m.regions.length);
        } else assert.deepEqual(s.days, raw.scenarios.find((r: any) => r.id === s.id).days);
        let dead = new Set<number>();
        for (const f of s.frames) {
            frames++;
            rle(f.state, m.size ** 2, 0, 6);
            rle(f.depth, m.size ** 2, 0, 65535);
            rle(f.bad, m.size ** 2, 0, 1000);
            const now = new Set<number>(f.dead);
            assert.equal(now.size, f.dead.length);
            for (const k of dead) assert(now.has(k), 'A dead plant disappeared from a later frame');
            for (const k of now) assert(Number.isInteger(k) && k >= 0 && k < m.plants.length);
            dead = now;
        }
    }
}
const result = { passed: true, maps: maps.length, surveyMaps: maps.filter(m => m.size === 128).length,
    galleryMaps: manifest.length, continuousRuns: manifest.length, dailyRows, frames,
    checks: ['complete seed and size coverage', 'canonical parity', 'daily continuity', 'region water balance',
        'finite bounded measures', 'original deaths persist', 'viewer matches measured timelines', 'valid RLE fields'] };
writeFileSync(`${dir}/results/data-check.json`, JSON.stringify(result, null, 2) + '\n');
console.log(result);
