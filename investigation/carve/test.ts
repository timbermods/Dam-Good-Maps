import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CarveRun, DEFAULTS, placeSource, protectedGround, modelFor, hardness, type CarveMap } from './engine';
import { fixture, loadMap, placeMap } from './maps';
import { canonicalSettle, canonicalRun } from '../../src/core/sim/prefill';
import { operation, applyOperation } from './operation';
import { frameContext, makeChunk } from './meshes';
const checks:string[]=[];const timings:Record<string,number>={};
function check(name:string,fn:()=>void){fn();checks.push(name);console.log('PASS',name);}
function source(m:CarveMap){return placeSource(m,Math.floor(m.H*.84)*m.W+Math.floor(m.W*.5),4);}
function hash(a:Uint8Array){return createHash('sha256').update(a).digest('hex');}
function extrema(h:Uint8Array,W:number,H:number){const out=new Set<number>();for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,a=[h[i-1],h[i+1],h[i-W],h[i+W]];if(h[i]<Math.min(...a)||h[i]>Math.max(...a))out.add(i);}return out;}
const before=source(fixture('mountain',64)), keep=protectedGround(before), oldExtrema=extrema(before.heights,64,64);
const wide=new CarveRun(before,DEFAULTS), signs=new Int8Array(before.heights.length);
const initialPlantCount=before.entities.length;
const time=performance.now();
for(let step=0;step<800;step++){
 const old=wide.map.heights.slice();wide.step();
 for(let i=0;i<old.length;i++){
   const d=Math.sign(wide.map.heights[i]-old[i]);
   if(d){assert.ok(!signs[i]||signs[i]===d,'direction reversal');signs[i]=d;}
   assert.ok(wide.map.heights[i]>=0&&wide.map.heights[i]<=16);
   if(keep[i])assert.equal(wide.map.heights[i],before.heights[i]);
 }
 if(step%50===0)for(const i of extrema(wide.map.heights,64,64))assert.ok(oldExtrema.has(i),'new isolated pit/spike');
 const v=wide.metrics;assert.ok(Math.abs(v.cut-v.deposited-v.exported-v.suspended)<1e-7,'sediment mass balance');
}
timings['800 steps, 64 squared']=performance.now()-time;
check('whole levels, per-step monotonicity, protected start, no new isolated extrema and sediment conservation',()=>{assert.ok(wide.metrics.cut>500);assert.ok(wide.metrics.deposited>100);assert.ok(wide.map.entities.length<initialPlantCount);});
check('source-first progression leaves distant existing water terrain alone',()=>{
 const m=source(fixture('mountain',64)), r=new CarveRun(m,DEFAULTS), sx=32,sy=Math.floor(64*.84);
 for(let k=0;k<12;k++)r.step();
 let changed=0;
 for(let i=0;i<m.heights.length;i++)if(m.heights[i]!==r.map.heights[i]){
  changed++;assert.ok(Math.abs(i%64-sx)+Math.abs(Math.floor(i/64)-sy)<=16);
 }
 assert.ok(changed>0);
});
check('a flowing river stops itself after a long stable-course interval',()=>{
 const m=placeSource(fixture('mountain',64),54*64+32,4),r=new CarveRun(m,DEFAULTS);
 for(let k=0;k<7000&&!r.metrics.stable;k++)r.step();
 assert.ok(r.metrics.stable);assert.ok(r.metrics.steps>800);
});
const steep=new CarveRun(before,{...DEFAULTS,walls:'steep'});for(let k=0;k<800;k++)steep.step();
check('wide walls produce more bank retreat than steep walls',()=>assert.ok(wide.metrics.bankCuts>steep.metrics.bankCuts*2));
check('outside-bend momentum erodes banks',()=>assert.ok(wide.metrics.bendCuts>50));
check('v2 rock coefficient and level bands',()=>{assert.equal(hardness(8,true),1);assert.equal(hardness(7,true),0);assert.equal(hardness(8,false),0);});
const soft=new CarveRun(before,{...DEFAULTS,layers:false});for(let k=0;k<800;k++)soft.step();
check('rock layers change the resulting terrain',()=>assert.notEqual(hash(soft.map.heights),hash(wide.map.heights)));
const replay=new CarveRun(before,DEFAULTS);
for(const batch of [17,93,1,209,480])for(let k=0;k<batch;k++)replay.step();
check('identical duration gives byte-identical terrain, water, sediment and objects independent of scheduling',()=>{
 assert.deepEqual(replay.map.heights,wide.map.heights);assert.deepEqual(replay.sim.D,wide.sim.D);assert.deepEqual(replay.sediment,wide.sediment);assert.deepEqual(replay.map.entities,wide.map.entities);
});
const dry=fixture('mountain',32);dry.water.depth.fill(0);dry.entities=[];
const stable=new CarveRun(dry,DEFAULTS);for(let k=0;k<400;k++)stable.step();
check('unforced stable map stops automatically and further steps are inert',()=>{assert.ok(stable.metrics.stable);const n=stable.metrics.steps;stable.step();assert.equal(stable.metrics.steps,n);assert.deepEqual(stable.map.heights,dry.heights);});
const final=canonicalSettle(modelFor(wide.map)), sliced=canonicalRun(modelFor(wide.map));let end=null;
while(!end)end=sliced.advance(7);
check('final water equals repository canonical settle byte for byte across slices',()=>{assert.deepEqual(end!.depth,final.depth);assert.deepEqual(end!.contamination,final.contamination);assert.equal(end!.ticks,final.ticks);});
const op=JSON.parse(JSON.stringify(operation(before,wide.map,DEFAULTS,800,'duration',final)));
const after=applyOperation(before,op);const undoStart=performance.now();const undone=applyOperation(after,op,true);timings['undo apply CPU ms']=performance.now()-undoStart;
check('JSON operation survives serialization, exact undo, and replay without erosion',()=>{assert.deepEqual(undone,before);assert.deepEqual(applyOperation(undone,op),after);assert.deepEqual(after.water.depth,final.depth);});
check('stale operation is rejected atomically',()=>assert.throws(()=>applyOperation(after,op),/Stale/));
const mesh=makeChunk(after,0,0,frameContext(after),true);
check('shared renderer geometry is finite and transferable',()=>{assert.ok(mesh.terrain.positions.length>0);assert.ok(mesh.terrain.positions.every(Number.isFinite));assert.ok(mesh.water.positions.every(Number.isFinite));structuredClone(mesh);});
const realResults=[];
for(const id of ['near-yosemite-valley','near-geirangerfjord','near-grand-canyon-colorado']){
 const m=placeMap(readFileSync('../../public/real-places/data/'+id+'.json.gz'));const r=new CarveRun(source(m),DEFAULTS);
 const t=performance.now();for(let k=0;k<20;k++)r.step();timings[id+' 20 steps']=performance.now()-t;
 assert.ok(r.map.heights.length===m.W*m.H);realResults.push({id,W:m.W,H:m.H,cut:r.metrics.cut});
}
checks.push('three Real places load with their actual terrain, sources, start and plants');
const generated=[];
for(const id of ['seed:highlands:18:128','seed:riverValley:18:256']){
 const start=performance.now();const m=await loadMap(id);timings[id+' load']=performance.now()-start;
 const r=new CarveRun(source(m),DEFAULTS),steps=[];
 for(let k=0;k<25;k++){const t=performance.now();r.step();steps.push(performance.now()-t);}
 steps.sort((a,b)=>a-b);timings[id+' step p95']=steps[Math.floor(steps.length*.95)];
 generated.push({id,W:m.W,hash:hash(m.heights),cut:r.metrics.cut});
 assert.equal(m.W,id.endsWith('256')?256:128);
 assert.ok(m.entities.some(e=>e.template==='StartingLocation'));
 const afterState={...r.map.water,sat:new Uint8Array(m.W*m.H),settled:false,ticks:100};
 const base=source(m);const record=operation(base,r.map,DEFAULTS,25,'test',afterState);
 const t=performance.now();const restored=applyOperation(applyOperation(base,record),record,true);
 timings[id+' undo+redo data CPU']=performance.now()-t;
 assert.deepEqual(restored,base);
}
checks.push('real M9 generated maps at 128 and 256 load and carve');
mkdirSync('captures',{recursive:true});
writeFileSync('captures/checks.json',JSON.stringify({checks,timings,wide:wide.metrics,steep:steep.metrics,soft:soft.metrics,canonical:{settled:final.settled,ticks:final.ticks},realResults,generated},null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,timings,canonical:{settled:final.settled,ticks:final.ticks}},null,2));
