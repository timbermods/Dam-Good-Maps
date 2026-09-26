import assert from 'node:assert/strict';
import { decode,pixel,checkInput } from './terrain';
import { mapping,metrics,prediction } from './settings';
import { naturalSlopes,pumpShore } from './rules';
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
