import assert from 'node:assert/strict';
import { decode,pixel,checkInput } from './terrain';
import { mapping,metrics,prediction } from './settings';
import { naturalSlopes,pumpShore,currentRules } from './rules';
import { designWater, headsSeparate, auditOrigins } from './designed-water';
import { walkDistance } from '../../src/core/analysis/walk';
import { sourcesFromHalo } from './hydrology';
import { convert } from './convert';
assert.equal(decode(128,0,0),0);assert.equal(decode(127,255,128),-.5);
assert.equal(pixel(0,180,4)[0]-pixel(0,-180,4)[0],4096);
assert.throws(()=>checkInput(90,0,128));assert.throws(()=>checkInput(0,NaN,128));assert.throws(()=>checkInput(0,0,512));
const flat=new Float32Array(64*64).fill(100), fm=mapping(flat);
assert.equal(new Set(fm.heights).size,1);
assert.notEqual(prediction(metrics(flat,64,60),60).verdict,'promising');
const ocean=new Float32Array(64*64).fill(-3000);
assert.equal(prediction(metrics(ocean,64,60),60).verdict,'difficult');
const extreme=Float32Array.from({length:4096},(_,i)=>i%64===0?4000:i%64);
const em=mapping(extreme);assert.ok(em.heights.every(v=>v>=1&&v<=16));
for(let i=1;i<63;i++)assert.ok(em.heights[i]>=em.heights[i-1]||i===1);
// D153 regression: the lower bank is reachable only via a natural slope.
const W=12,h=new Uint8Array(W*W).fill(4),D=new Float64Array(h.length),C=new Float64Array(h.length);
for(let y=0;y<W;y++)for(let x=6;x<W;x++)h[y*W+x]=3;
for(let y=0;y<W;y++){h[y*W+10]=2;D[y*W+10]=.5;}
const start={x:3,y:5},link:[number,number]=[5*W+6,5*W+5];
const noRamp=pumpShore(walkDistance(h,W,W,null,[],start),h,D,C,W);
const ramp=pumpShore(walkDistance(h,W,W,null,[link],start),h,D,C,W);
assert.equal(noRamp.distance,Infinity);assert.ok(ramp.distance<=20);
const blocked=new Uint8Array(h.length);for(let y=0;y<W;y++)blocked[y*W+7]=1;
assert.equal(pumpShore(walkDistance(h,W,W,blocked,[link],start),h,D,C,W).distance,Infinity);
C.fill(1);assert.equal(pumpShore(walkDistance(h,W,W,null,[link],start),h,D,C,W).distance,Infinity);
const ramps=naturalSlopes(h,D,W,new Set());for(const [a,b] of ramps.links)assert.equal(h[b]-h[a],1);
// Browser-safe hydrology is also exercised at the failing 256 size.
const size=256,halo=16,raw=Float32Array.from({length:(size+2*halo)**2},(_,i)=>100+i%(size+2*halo));
assert.ok(Number.isFinite(sourcesFromHalo(raw,size,halo).filledMetresMax));
// Full converter preserves every terrain cell, including all four edges.
const map=new Uint8Array(96*96).fill(4);for(let y=0;y<96;y++)for(let x=43;x<53;x++)map[y*96+x]=2;
const result=convert(map,96,16,{sources:[{i:10*96+48,area:1000}],outlets:[]},'regression');
assert.deepEqual(result.heights,map);assert.equal(result.edgeChanges,0);
console.log('PASS: decoding, dateline projection, input limits, noise cap, quality controls, D153 slope/blocker/pump path, slope validity, 256 hydrology, unchanged terrain.');
// Designed water has no native river or positive-elevation prerequisite.
for(const elevation of [-100,0,100]) {
  const raw=new Float32Array(96*96).fill(elevation),h=new Uint8Array(96*96).fill(2);
  const plans=designWater(raw,h,96);
  assert.equal(plans.length,2);assert.ok(plans.every(p=>p.sources.length>0));
  assert.deepEqual(plans,designWater(raw,h,96));
  assert.ok(plans.every(p=>p.sources.every(s=>s.strength>0&&s.i>=0&&s.i<h.length)));
  assert.ok(plans.every(p=>p.sources.every(s=>s.i%96===0||s.i%96===95||s.i<96||s.i>=95*96)));
}
// A walking path cannot use a flooded crossing to reach the clean bank beyond.
const wetH=new Uint8Array(16*16).fill(4),wetD=new Float64Array(256),wetC=new Float64Array(256);
for(let y=0;y<16;y++){wetD[y*16+6]=3;wetC[y*16+6]=1;wetH[y*16+10]=2;wetD[y*16+10]=.5;}
const verdict=currentRules({world:{sizeX:16,entities:[]}},{report:{checks:[]}},wetH,{depth:wetD,contamination:wetC},[],{x:3,y:7},[{i:10}]);
assert.equal(verdict.waterDistance,null);assert.equal(verdict.passed,false);
const ridges=Float32Array.from({length:96*96},(_,i)=>100+Math.abs(i%96-48)*10+Math.floor(i/96)*2);
const before=ridges.slice(),height=mapping(ridges).heights;
for(const intention of ['balanced','waterfall','basin'] as const) {
  const plan=designWater(ridges,height,96,intention);
  assert.ok(plan.every(p=>p.sources.length>0));assert.deepEqual(ridges,before);
}
console.log('PASS: designed springs without native water, deterministic source plans, bounded positive strengths, dry walking path, intentions preserve terrain.');
// A downstream booster is forbidden even when it would make a start easier.
const stream=new Uint8Array(12*12).fill(5);
for(let y=0;y<12;y++)stream[y*12+6]=1+Math.floor(y/4);
assert.equal(headsSeparate(stream,12,[{i:9*12+6,strength:3},{i:3*12+6,strength:3}]),false);
assert.equal(auditOrigins(stream,12,[{i:9*12+6,strength:3,headId:'head'}]).passed,true);
// Sources belong outside lake interiors; interior channel candidates must be heads.
const lake=new Uint8Array(96*96).fill(6);
for(let y=30;y<66;y++)for(let x=30;x<66;x++)lake[y*96+x]=1;
for(const p of designWater(Float32Array.from(lake,v=>v*10),lake,96))for(const s of p.sources) {
  assert.equal(lake[s.i],6);
  if(s.kind==='tributary head spring')assert.equal(s.upstreamChannels,0);
  else assert.ok(s.i%96===0||s.i%96===95||s.i<96||s.i>=95*96);
}
console.log('PASS: no downstream boosters, only structural heads or edge entries, no lake-interior sources, independent-origin audit.');
const forks=new Uint8Array(12*12).fill(5);
for(let y=0;y<12;y++)for(const x of [3,8])forks[y*12+x]=1+Math.floor(y/4);
const tributaries=[{i:9*12+3,strength:2,headId:'left'},{i:9*12+8,strength:2,headId:'right'}];
assert.ok(headsSeparate(forks,12,tributaries));assert.ok(auditOrigins(forks,12,tributaries).passed);
console.log('PASS: independent tributaries keep distinct dry source heads.');
