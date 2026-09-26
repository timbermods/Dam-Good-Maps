import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CarveRun,DEFAULTS,modelFor,protectedGround,sourceStrength,mapSeed,hardness,type CarveMap,type Settings,type Intent } from './engine';
import { fixture,loadMap,placeMap } from './maps';
import { canonicalSettle,canonicalRun } from '../../src/core/sim/prefill';
import { operation,applyOperation } from './operation';
import { consequences } from './consequences';
import { frameContext,makeChunk } from './meshes';
const passed:string[]=[],timings:Record<string,number>={};
function check(name:string,f:()=>void){f();passed.push(name);console.log('PASS',name);}
function hash(h:Uint8Array){return createHash('sha256').update(h).digest('hex');}
function complete(m:CarveMap,s:Partial<Settings>={},intent:Intent={origin:54*m.W+32}){
 const r=new CarveRun(m,{...DEFAULTS,...s},intent);for(let k=0;k<1200&&!r.metrics.stable;k++)r.step();assert.ok(r.metrics.stable);return r;
}
function extrema(h:Uint8Array,W:number,H:number){const out=new Set<number>();for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,n=[h[i-1],h[i+1],h[i-W],h[i+W]];if(h[i]<Math.min(...n)||h[i]>Math.max(...n))out.add(i);}return out;}
const mountain=fixture('mountain',64),intent={origin:54*64+32},initial=extrema(mountain.heights,64,64),keep=protectedGround(mountain);
const run=new CarveRun(mountain,{...DEFAULTS,power:95,walls:'wide'},intent),sign=new Int8Array(4096);
for(let k=0;k<350&&!run.metrics.stable;k++){
 const old=run.map.heights.slice();run.step();
 for(let i=0;i<old.length;i++){
  const d=Math.sign(run.map.heights[i]-old[i]);if(d){assert.ok(!sign[i]||sign[i]===d);sign[i]=d;}
  assert.ok(Number.isInteger(run.map.heights[i])&&run.map.heights[i]>=0&&run.map.heights[i]<=16);
  if(keep[i])assert.equal(run.map.heights[i],mountain.heights[i]);
 }
 for(const i of extrema(run.map.heights,64,64))assert.ok(initial.has(i),'new isolated pit or spike at '+i);
 assert.equal(run.metrics.cut,run.metrics.deposited+run.metrics.exported+run.metrics.suspended);
}
check('every step: whole levels, one terrain direction, no new one-tile extrema, start support and debris volume',()=>{
 assert.ok(run.metrics.stable);assert.equal(run.metrics.reason,'lake');assert.ok(run.metrics.cut>3000);assert.ok(run.metrics.deposited>10);
});
check('first second has visible local chunks, not distant sheet erosion',()=>{
 const r=new CarveRun(mountain,DEFAULTS,intent);for(let k=0;k<10;k++)r.step();
 assert.ok(r.metrics.cut>100);
 for(let i=0;i<4096;i++)if(r.map.heights[i]!==mountain.heights[i])assert.ok(Math.hypot(i%64-32,Math.floor(i/64)-54)<20);
 assert.ok(r.metrics.distance>5&&r.metrics.distance<9);
});
const low=complete(mountain,{power:15}),high=complete(mountain,{power:95});
check('power sets incision and width; catastrophe removes much more land than creek',()=>{
 assert.ok(high.metrics.cut>low.metrics.cut*5);
 assert.ok(high.head.width>low.head.width*2);
 assert.ok(high.map.heights[intent.origin]<low.map.heights[intent.origin]);
});
check('wide walls make broad terraces, steep walls preserve a narrower gorge',()=>{
 const steep=complete(mountain,{power:65,walls:'steep'}),wide=complete(mountain,{power:65,walls:'wide'});
 assert.ok(wide.metrics.bankCuts>steep.metrics.bankCuts*1.4);assert.ok(wide.metrics.cut>steep.metrics.cut);
});
check('hard layers delay breakthroughs; bands are deterministically derived from terrain',()=>{
 const layered=new CarveRun(mountain,{...DEFAULTS,power:35},intent),soft=new CarveRun(mountain,{...DEFAULTS,power:35,layers:false},intent);
 for(let k=0;k<8;k++){layered.step();soft.step();}
 assert.ok(soft.metrics.cut>layered.metrics.cut);
 assert.equal(mapSeed(mountain),mapSeed(structuredClone(mountain)));
 assert.equal(Array.from({length:16},(_,i)=>hardness(i,true,mapSeed(mountain))).filter(v=>v===1).length,4);
});
const ridge=fixture('ridge',64),aim={origin:54*64+32,end:10*64+32};
const ridgeHigh=complete(ridge,{power:95,mode:'aim'},aim),ridgeLow=complete(ridge,{power:15,mode:'aim'},aim);
check('aim breaks through a ridge with a curved course; low power lets the land win',()=>{
 assert.equal(ridgeHigh.metrics.reason,'destination');assert.notEqual(ridgeLow.metrics.reason,'destination');
 assert.ok(ridgeHigh.path.some(s=>Math.abs(s.x-32)>2),'not a ruler line');
 assert.ok(Math.min(...ridgeHigh.map.heights.slice(32*64+15,32*64+49))<=2);assert.ok(ridge.heights[32*64+32]>=12);
});
const uphill=fixture('uphill',64),defy=complete(uphill,{power:95,mode:'aim',defyGravity:true},aim);
check('defy gravity cuts an uphill destination into a connected descending floor',()=>{
 assert.ok(uphill.heights[aim.end]>uphill.heights[aim.origin]);
 assert.throws(()=>new CarveRun(uphill,{...DEFAULTS,mode:'aim'},aim),/Defy gravity/);
 assert.equal(defy.metrics.reason,'destination');
 let last=Infinity;
 for(const s of defy.path){const h=defy.map.heights[Math.round(s.y)*64+Math.round(s.x)];assert.ok(h<=last);last=h;}
 assert.ok(defy.map.heights[aim.end]<=defy.map.heights[aim.origin]);
});
check('same input and duration has exact output independent of presentation batching',()=>{
 const a=new CarveRun(mountain,DEFAULTS,intent),b=new CarveRun(mountain,DEFAULTS,intent);
 for(let k=0;k<45;k++)a.step();
 for(const batch of [3,12,1,19,10])for(let k=0;k<batch;k++)b.step();
 assert.deepEqual(a.map,b.map);assert.deepEqual(a.head,b.head);assert.deepEqual(a.metrics,b.metrics);
});
check('objects on excavated footprints are removed; the start is never removed',()=>{
 const m=structuredClone(mountain);m.entities.push({id:'test-object',owner:'study',template:'Blockage',x:32,y:52,z:m.heights[52*64+32],orientation:'Cw0',flipped:false,components:{}});
 const r=complete(m,{power:95});assert.ok(!r.map.entities.some(e=>e.id==='test-object'));
 assert.ok(r.map.entities.some(e=>e.template==='StartingLocation'));
 assert.ok(r.map.entities.length<m.entities.length);
});
check('keep river creates a real source set by power; dry canyon adds no source',()=>{
 assert.ok(high.map.entities.some(e=>e.id==='carve-source'));
 assert.equal(sourceStrength(100),8);assert.equal(sourceStrength(0),.5);
 const dry=complete(mountain,{dry:true,power:95});assert.ok(!dry.map.entities.some(e=>e.id==='carve-source'));
 const settled=canonicalSettle(modelFor(dry.map));assert.ok(settled.depth.every(v=>v===0));
 assert.deepEqual(dry.map.heights,high.map.heights);
});
check('check status and start reach update from changed terrain and resources without blocking it',()=>{
 const a=consequences(mountain),b=consequences(run.map);
 assert.ok(a.present&&b.present);assert.equal(b.tiles.length,4096);assert.equal(b.reach,b.tiles.reduce((s,v)=>s+v,0));
 assert.ok(run.metrics.cut>0);assert.equal(typeof b.meets,'boolean');
 const severed=structuredClone(mountain);
 // Remove available resources and the start's neighboring land: consequences, not a veto.
 severed.entities=severed.entities.filter(e=>e.template==='StartingLocation');
 const mask=protectedGround(severed);for(let i=0;i<4096;i++)if(!mask[i])severed.heights[i]=0;
 const c=consequences(severed);assert.equal(c.trees,0);assert.equal(c.bushes,0);assert.equal(c.meets,false);assert.ok(c.reach<a.reach);
});
const settled=canonicalSettle(modelFor(high.map)),final={...high.map,water:{depth:settled.depth,contamination:settled.contamination}};
check('canonical water is bit-exact with different slice sizes',()=>{
 const r=canonicalRun(modelFor(high.map));let result=null;while(!result)result=r.advance(7);
 assert.deepEqual(result.depth,settled.depth);assert.deepEqual(result.contamination,settled.contamination);
});
const op=operation(mountain,final,high.settings,high.metrics.steps,'lake',settled);
check('one stored result restores terrain, source, removed objects and water exactly after JSON replay',()=>{
 const stored=JSON.parse(JSON.stringify(op));assert.deepEqual(applyOperation(mountain,stored),final);
 assert.deepEqual(applyOperation(final,stored,true),mountain);
 assert.throws(()=>applyOperation(final,stored),/Stale/);
 stored.params.settings={oldAlgorithm:'unavailable'};assert.deepEqual(applyOperation(mountain,stored),final,'replay never consults algorithm settings');
});
check('worker mesh data supports the actual clean terrain, water and object shaders',()=>{
 const chunk=makeChunk(high.map,0,1,frameContext(high.map),true),c=structuredClone(chunk);
 for(const a of [c.terrain.positions,c.water.positions,c.water.data!,c.water.flags!])assert.ok(a.every(Number.isFinite));
 assert.ok(c.terrain.positions.length>0);assert.ok(c.water.data!.length>0);
});
for(const id of ['near-yosemite-valley','near-geirangerfjord','near-grand-canyon-colorado']){
 const m=placeMap(readFileSync('../../public/real-places/data/'+id+'.json.gz'));
 const origin=Math.floor(m.H*.8)*m.W+Math.floor(m.W*.5),r=new CarveRun(m,DEFAULTS,{origin});
 for(let k=0;k<20;k++)r.step();check('real map '+id+' accepts source-local carving',()=>assert.ok(r.metrics.cut>0));
}
for(const size of [128,256]){
 const m=await loadMap('seed:highlands:18:'+size);let origin=Math.floor(size*.8)*size+Math.floor(size*.5);
 const locked=protectedGround(m);while(locked[origin])origin++;
 const r=new CarveRun(m,DEFAULTS,{origin}),ms:number[]=[];
 for(let k=0;k<100&&!r.metrics.stable;k++){const t=performance.now();r.step();ms.push(performance.now()-t);}
 ms.sort((a,b)=>a-b);timings[size+' step p95 ms']=ms[Math.floor(ms.length*.95)];
 const water=canonicalSettle(modelFor(r.map)),after={...r.map,water:{depth:water.depth,contamination:water.contamination}},o=operation(m,after,DEFAULTS,r.metrics.steps,'stopped',water);
 const t=performance.now();const replay=applyOperation(m,o);assert.deepEqual(applyOperation(replay,o,true),m);timings[size+' apply and undo ms']=performance.now()-t;
 check('generated '+size+' map preserves start and exact complete operation',()=>assert.ok(replay.entities.some(e=>e.template==='StartingLocation')));
}
mkdirSync('captures',{recursive:true});
writeFileSync('captures/checks.json',JSON.stringify({passed,timings,terrainHashes:{mountain:hash(high.map.heights),ridge:hash(ridgeHigh.map.heights),defy:hash(defy.map.heights)},hardwareFPS:'User PC acceptance required; CPU timings are not frame rates'},null,2)+'\n');
console.log(timings);

