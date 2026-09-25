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
// Water wheels read the net stored outflow along their axis (VERIFIED.md U01).
for (let i=0;i<N;i++) { water[i]=0; contamination[i]=0; heights[i]=4; }
const wheel = (flows: [number, number, number, number][]) => {
  const out = new Float64Array(4*N);
  flows.forEach(([i,k,v]) => { out[4*i+k] = v; });
  return measureOpening({ ...result(), built: { ...result().built, settle: { out } } });
};
const a = 5*W+6, b = 6*W+6;
heights[a] = heights[b] = 3; water[a] = water[b] = 0.5;
let w = wheel([[a,3,0.6,0]]);
assert.equal(w.peakAxialFlow64, 0.6, 'Net flow along x counts');
assert.equal(w.compactWheelHp64, 72, 'ceil(120 × 0.6)');
assert.equal(w.waterWheelHp64, 81, 'The second blade cell has no flow: ceil(270 × 0.3)');
w = wheel([[a,3,0.6,0],[b,3,0.6,0]]);
assert.equal(w.waterWheelHp64, 162, 'Both blade cells carry 0.6');
w = wheel([[a,3,0.6,0],[a,1,0.5,0]]);
assert.equal(w.peakAxialFlow64, 0, 'Opposite outflows cancel to 0.1, under the 0.15 threshold');
assert.ok(w.peakCleanFlux64 > 1, 'The old four-outflow sum counted them as 1.1');
w = wheel([[a,3,0.6,0],[b,1,0.6,0]]);
assert.equal(w.waterWheelHp64, 0, 'Opposite flows in the two blade cells cancel');
console.log('Passed: mature/dead wood, ripe JsonFloat berries, missing dam, flat reach, deep shore, hazard-route and water-wheel cases.');
