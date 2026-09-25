// Small adversarial fixtures for the experimental drainage/repair contracts.
import assert from 'node:assert/strict';
import { drainage,channelCandidates,constrainedLevels,drawGenome } from './techniques.mjs';
const W=9,H=9, pit=new Float64Array(W*H).fill(8);pit[4*W+4]=1;
for(let y=3;y<=5;y++)for(let x=3;x<=5;x++)pit[y*W+x]=1;
const d=drainage(pit,W,H,{eight:false});
assert.equal(d.filled[4*W+4],8,'closed pit spill');
const flat=channelCandidates(new Float64Array(W*H).fill(4),W,H);
const rank=new Int32Array(W*H);flat.order.forEach((i,k)=>rank[i]=k);
flat.rcv.forEach((r,i)=>{if(r>=0)assert(rank[r]<rank[i],'flat drainage must be acyclic');});
const g=drawGenome('highlands',3,W,H,0,70);
for(const cap of [16,22]) {
  const result=constrainedLevels(pit,g,3,W,H,cap,{...d,keep:new Uint8Array(W*H).fill(1)});
  d.rcv.forEach((r,i)=>{if(r>=0)assert(result.proposed[r]<=result.proposed[i]);});
  assert(result.proposed.every(z=>z<=cap));
  assert.equal(result.accepted,false,'deep bowl repair must reject, not flatten silently');
}
console.log('PASS: closed basin, flat routing, non-rising beds, caps, excessive-cut rejection');
