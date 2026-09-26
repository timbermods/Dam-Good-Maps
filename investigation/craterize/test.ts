import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fixture } from './maps';
import { DEFAULTS, impact, ImpactPlan, snapshot, protectedGround, autoCentre, naturalSize, modelFor, settleImpact, type Settings } from './engine';
import { operation, applyOperation } from './operation';
import { WaterSim } from '../../src/core/sim/water';
const passed:string[]=[];
function check(name:string,fn:()=>void){fn();passed.push(name);console.log('PASS '+name);}
const base=fixture(),intent={origin:64*128+64},settings={...DEFAULTS,power:62,seed:17};
const p=impact(base,settings,intent),after=p.map;
check('Same seed is byte identical; input stays untouched',()=>{
 assert.deepEqual(impact(base,settings,intent).map,after);assert.ok(base.heights.every(h=>h===11));
});
check('Row slicing does not change the result',()=>{
 const q=new ImpactPlan(base,settings,intent);while(!q.advance(1)){}assert.deepEqual(q.map,after);
});
check('Every setting combination remains whole levels 0–22',()=>{
 for(const centre of ['auto','bowl','peak','ring','flat'] as const)for(const walls of ['steep','terraced'] as const)for(const debris of ['light','heavy'] as const){
  const q=impact(base,{...settings,centre,walls,debris,rays:true},intent);
  assert.ok(q.map.heights.every(h=>Number.isInteger(h)&&h>=0&&h<=22));
 }
});
check('Auto centre follows diameter; manual size decouples depth',()=>{
 assert.equal(autoCentre(15),'bowl');assert.equal(autoCentre(40),'peak');assert.equal(autoCentre(90),'ring');
 const pit=impact(base,{...settings,size:14},intent),scar=impact(base,{...settings,size:100},intent);
 assert.ok(pit.anatomy.depth>scar.anatomy.depth);
 assert.equal(naturalSize(0),6);assert.equal(naturalSize(100),118);
});
check('Start rejects the strike and protects footprint plus entrance from nearby impacts',()=>{
 assert.throws(()=>impact(base,settings,{origin:8*128+7}),/Start here/);
 const q=impact(base,{...settings,power:100},{origin:20*128+20}),keep=protectedGround(base);
 keep.forEach((v,i)=>{if(v)assert.equal(q.map.heights[i],base.heights[i]);});
 assert.deepEqual(q.map.entities.find(e=>e.id==='start'),base.entities.find(e=>e.id==='start'));
});
check('Map edges clip a partial crater without wrapping',()=>{
 const q=impact(base,{...settings,size:30,rays:false},{origin:64*128});
 assert.notEqual(q.map.heights[64*128],11);assert.equal(q.map.heights[64*128+127],11);
});
check('Changing personality changes the rim while geology stays fixed',()=>{
 const q=impact(base,{...settings,seed:18},intent);assert.notDeepEqual(q.map.heights,after.heights);
 assert.deepEqual(q.map.rockLayers,base.rockLayers);
});
check('Bowl, peak, ring and flat have distinct interiors',()=>{
 const maps=['bowl','peak','ring','flat'].map(centre=>impact(base,{...settings,size:72,centre:centre as Settings['centre']},intent).map);
 assert.ok(maps[1].heights[intent.origin]>maps[3].heights[intent.origin]+3);
 assert.ok(maps[2].heights[intent.origin+14]>maps[2].heights[intent.origin]+2);
 assert.ok(maps[0].heights[intent.origin+12]>maps[0].heights[intent.origin]);
 assert.equal(maps[3].heights[intent.origin+12],maps[3].heights[intent.origin]);
});
check('Heavy ejecta raises a broader area several levels high',()=>{
 const light=impact(base,{...settings,size:40,debris:'light'},intent),heavy=impact(base,{...settings,size:40,debris:'heavy'},intent);
 const exterior=(q:ImpactPlan)=>Array.from(q.map.heights).reduce((sum,h,i)=>sum+(Math.hypot(i%128-64,Math.floor(i/128)-64)>22?Math.max(0,h-11):0),0);
 assert.ok(exterior(heavy)>exterior(light)*2);assert.ok(Math.max(...heavy.map.heights)>=15);
});
check('Aim elongates the crater and biases ejecta downrange',()=>{
 const q=impact(base,{...settings,size:40,mode:'aim'},{origin:intent.origin,end:intent.origin+50});
 assert.ok(q.anatomy.a>q.anatomy.b*1.5);
 let left=0,right=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const d=q.map.heights[y*128+x]-11;if(d>0){if(x<64)left+=d;else right+=d;}
 }assert.ok(right>left*1.15);
});
check('Rays add one-level ridges and secondary pit chains',()=>{
 const q=impact(base,{...settings,size:32,rays:true},intent),no=impact(base,{...settings,size:32,rays:false},intent);
 let ridges=0,pits=0;for(let i=0;i<base.heights.length;i++)if(Math.hypot(i%128-64,Math.floor(i/128)-64)>22){
   if(q.map.heights[i]===no.map.heights[i]+1)ridges++;if(q.map.heights[i]<11)pits++;
 }assert.ok(ridges>40);assert.ok(pits>15);
});
check('Blast erases central trees and flattens dead trees radially',()=>{
 assert.ok(p.stats.erased>0&&p.stats.flattened>0);
 for(const f of after.fallen){const e=after.entities.find(e=>e.id===f.id)!;assert.deepEqual(e.components.LivingNaturalResource,{IsDead:true});
 assert.ok((f.x-64)*f.dx+(f.y-64)*f.dy>0);}
});
check('Newer impacts overprint old rims; they are not constrained to a minimum height',()=>{
 const second=impact(after,{...settings,size:40},{origin:intent.origin+21});
 assert.ok(second.stats.cut>0&&second.stats.raised>0);assert.notDeepEqual(second.map.heights,after.heights);
 const op=operation(after,second.map,settings,{origin:intent.origin+21},{settled:true,ticks:0});
 assert.deepEqual(applyOperation(second.map,op,true),after);
});
check('Exact JSON result replays, undoes and redoes terrain, trees and water',()=>{
 const op=JSON.parse(JSON.stringify(operation(base,after,settings,intent,{settled:true,ticks:0})));
 assert.deepEqual(applyOperation(base,op),after);assert.deepEqual(applyOperation(after,op,true),base);
 assert.deepEqual(applyOperation(applyOperation(after,op,true),op),after);
 const stale=snapshot(base);stale.heights[op.params.terrain[0][0]]=22;assert.throws(()=>applyOperation(stale,op),/Stale/);
 op.params.terrain[0][2]=23;assert.throws(()=>applyOperation(base,op),/invalid/);
});
check('No source and no water are introduced on dry land',()=>{
 const q=impact(base,settings,intent);settleImpact(q.map);
 assert.ok(q.map.water.depth.every(v=>v===0));assert.equal(modelFor(q.map).emitters.length,0);
});
let riverEvidence:Record<string,unknown>={};
check('Heavy debris dams an existing river; upstream water rises from unchanged sources',()=>{
 const river=fixture('river'),originalSources=river.entities.filter(e=>e.template==='WaterSource');
 settleImpact(river);
 const q=impact(river,{...settings,power:75,size:34,centre:'bowl',debris:'heavy',rays:false},{origin:64*128+62});
 const x=84,sillBefore=river.heights[64*128+x],sillAfter=q.map.heights[64*128+x];
 const upstream=95*128+x,oldDepth=river.water.depth[upstream];
 const result=settleImpact(q.map);
 assert.ok(sillAfter>sillBefore);assert.ok(q.map.water.depth[upstream]>oldDepth+.4);
 assert.deepEqual(q.map.entities.filter(e=>e.template==='WaterSource'),originalSources);
 riverEvidence={sillBefore,sillAfter,upstreamBefore:oldDepth,upstreamAfter:q.map.water.depth[upstream],...result};
});
check('Existing isolated water is conserved apart from simulation drainage/evaporation',()=>{
 const wet=snapshot(base);wet.water.depth[64*128+64]=10;
 const q=impact(wet,{...settings,size:24},intent);const before=q.map.water.depth.reduce((a,b)=>a+b,0);
 const sim=new WaterSim(modelFor(q.map),q.map.water);sim.run(100);
 assert.ok(sim.volume()<=before+1e-9&&sim.volume()>0);
});
const big=fixture('plain',256),times:number[]=[];
for(let k=0;k<8;k++){const t=performance.now();impact(big,{...settings,power:95,rays:true},{origin:128*256+128});times.push(performance.now()-t);}
mkdirSync('captures',{recursive:true});
writeFileSync('captures/checks.json',JSON.stringify({passed,river:riverEvidence,model256Ms:times},null,2)+'\n');
console.log(JSON.stringify({river:riverEvidence,model256Ms:times}));

