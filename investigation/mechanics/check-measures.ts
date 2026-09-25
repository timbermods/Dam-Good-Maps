// Small synthetic cases check decisions that could otherwise corrupt the baseline silently.
import assert from 'node:assert/strict';
import { tree, bush } from '../../src/core/format/entities';
import { makeSpec } from '../../src/core/spec/mapspec';
import { waterModel } from '../../src/core/sim/model';
import { measureOpening } from './measure';
const W = 12, H = 12, N = W * H;
const heights = new Uint8Array(N).fill(4);
const water = new Float64Array(N), contamination = new Float64Array(N);
const start = { x: 3, y: 5, z: 4 };
const pos = (id: string, x: number, y: number) => ({ id, owner: 'test', x, y, z: 4 });
const entities = [
  tree({ ...pos('mature-pine', 3, 3), species: 'Pine' }),
  tree({ ...pos('dead-oak', 3, 4), species: 'Oak', dead: true }),
  tree({ ...pos('young-oak', 3, 7), species: 'Oak', growth: 0.4 }),
  bush({ ...pos('ripe', 4, 3), ripe: true }),
  bush({ ...pos('unripe', 4, 4), ripe: false, regrowth: 0.4 })
];
const result = () => ({
  spec: makeSpec({ seed: 1, size: { x: W, y: H } }), features: [],
  built: { W, H, heights, water, contamination, start, entities, sources: [], moisture: new Float64Array(N).fill(5),
    soilContamination: new Float64Array(N), waterModel: waterModel(W,H,heights,[]), settle: {} },
  report: { passed: true, profile: 'generate', checks: [] },
  analysis: { startDistance: Float64Array.from({length:N},(_,i)=>Math.hypot(i%W-start.x,Math.floor(i/W)-start.y)), damSites: [], bestDam: null, naturalStorage: 0 }
} as any);
const base = measureOpening(result());
assert.equal(base.logs20, 10, 'Mature pine and dead oak count; the JsonFloat sapling does not');
assert.equal(base.deadLogs20, 8);
assert.equal(base.readyBerries20, 3, 'JsonFloat ripe progress counts once; regrowing berries do not');
assert.equal(base.shortestAdequateDam, null, 'Absent dam is not a free closure');
assert.equal(base.flatAccessShare, 1);
assert.equal(base.safeLost40, 0);
for (let y=0;y<H;y++) { const i=y*W+9; heights[i]=0; water[i]=0.4; }
const deep=measureOpening(result());
assert.equal(deep.pumpShore2,0,'A 3.6-level drop is beyond the shallow proxy');
assert.ok(deep.deepPumpExtraShore>0,'The same shore fits the six-level proxy');
for (let y=0;y<H;y++) { const i=y*W+6; water[i]=0.2; contamination[i]=1; }
const hazard=measureOpening(result());
assert.ok(hazard.safeLost40>0,'A continuous badwater crossing removes the safe route, not physical walking');
console.log('Passed: mature/dead wood, ripe JsonFloat berries, missing dam, flat reach, deep shore and hazard-route cases.');
