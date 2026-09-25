import test from 'node:test';
import assert from 'node:assert/strict';
import {drainage,quantise,sourcesFromHalo} from '../lib/terrain';
import {terrainMetrics} from '../lib/metrics';
test('drainage conserves contributing area and has no cycles, including flats and pits',()=>{
  for(const kind of ['flat','pit','slope']){const W=20,h=Float32Array.from({length:W*W},(_,i)=>kind==='flat'?5:kind==='slope'?Math.floor(i/W):Math.max(Math.abs(i%W-10),Math.abs(Math.floor(i/W)-10)));
    const d=drainage(h,W,W);let area=0;for(let i=0;i<h.length;i++){if(d.to[i]<0)area+=d.acc[i];else{assert.ok(d.rank[d.to[i]]<d.rank[i]);assert.ok(d.filled[d.to[i]]<=d.filled[i]);}}assert.equal(area,W*W);
  }
});
test('mappings are monotone, integer and bounded; constant terrain is not readable',()=>{for(const cap of [16,22])for(const mode of ['linear','compressed','normalised']){const q=quantise(Float32Array.from({length:100},(_,i)=>i*10-100),mode,cap);assert.ok([...q.heights].every((h,i)=>h>=0&&h<=cap&&Number.isInteger(h)&&(!i||h>=q.heights[i-1])));assert.equal(quantise(new Float32Array(100).fill(45),mode,cap).mapping.readabilityProxy,false);}});
test('plain slope has valid source/outlet indices from halo',()=>{const size=32,halo=8,W=size+halo*2,h=Float32Array.from({length:W*W},(_,i)=>100-Math.floor(i/W)+Math.abs(i%W-W/2));const d=sourcesFromHalo(h,size,halo);assert.ok(d.outlets.length>0);assert.ok(d.sources.length>0);assert.ok(d.sources.every(s=>s.i>=0&&s.i<size*size));});
test('metric histograms are probability distributions and empty angles remain null',()=>{const m=terrainMetrics(new Uint8Array(16*16).fill(4),16,16);assert.equal(m.relief.heightHistogram.reduce((a,b)=>a+b),1);assert.equal(m.relief.slopeHistogram.reduce((a,b)=>a+b),1);assert.equal(m.relief.levelStepLength.n,0);assert.equal(m.relief.levelStepLength.p50,null);});
