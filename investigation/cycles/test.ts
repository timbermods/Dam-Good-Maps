import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalSettle } from '../../src/core/sim/prefill';
import { WaterSim } from '../../src/core/sim/water';
import { droughtStorage } from '../../src/core/sim/drought';
import { generate } from '../../src/core/gen/generate';
import { makeSpec } from '../../src/core/spec/mapspec';
import { CycleModel,temperateSettle,cloneModel } from './model';
import { handicap,schedule,badChance,sourceScale,badtideContamination } from './weather';
const maxDiff=(a:ArrayLike<number>,b:ArrayLike<number>)=>Array.from(a).reduce((m,v,i)=>Math.max(m,Math.abs(v-b[i])),0);
const sum=(a:ArrayLike<number>)=>Array.from(a).reduce((a,b)=>a+b,0);
const root=process.cwd().endsWith('cycles')?'../..':'.';
const fixtures=JSON.parse(gunzipSync(readFileSync(`${root}/tests/golden/water.json.gz`)).toString()).fixtures;
const rows:any[]=[];
for(const f of fixtures) {
  const model={W:f.W,H:f.H,floor:Float64Array.from(f.floor),dam:f.dam?Float64Array.from(f.dam):null,emitters:f.emitters};
  const c=canonicalSettle(model),ours=temperateSettle(model);
  assert.equal(maxDiff(c.depth,ours.depth),0);assert.equal(maxDiff(c.contamination,ours.contamination),0);assert.equal(c.ticks,ours.ticks);
  assert(maxDiff(ours.depth,f.canonical.depth)<1e-6);
  if(['lake_sill','valley_basin','weir'].includes(f.name)) {
    const analytic=sum(droughtStorage(model,c.depth,9));
    const sim=new WaterSim(cloneModel(model),c).run(768*9,0);
    const error=Math.abs(sim.volume()-analytic)/analytic;
    assert(error<.05,`${f.name}: ${error}`); rows.push({fixture:f.name,analytic,simulated:sim.volume(),relativeError:error});
  }
}
for(const mode of ['easy','normal','hard'] as const) {
  const a=schedule(mode),b=schedule(mode);assert.deepEqual(a,b);
  assert(a.filter(x=>x.weather==='badtide').every(x=>x.cycle>=({easy:6,normal:5,hard:4}[mode])));
}
assert.equal(handicap(1,.2,12),.2);assert.equal(handicap(13,.2,12),1);
assert.equal(badChance('drought',7),1);assert.equal(badChance('badtide',4),0);
assert.equal(sourceScale(1,{weather:'drought',days:3,cycle:1,occurrence:1},1),0);
assert.equal(badtideContamination(1,3),1);assert(badtideContamination(0,3)>.5);
const r=generate(makeSpec({seed:1,size:{x:96,y:96}}));assert(r.report.passed);
const a=new CycleModel(r.built),b=new CycleModel(r.built),fine=new CycleModel(r.built,1729,1);
const initial=r.built.water.slice(),emitters=JSON.stringify(r.built.waterModel.emitters);
const phase={weather:'badtide',days:1,cycle:5,occurrence:1} as const;
a.run(phase);b.run(phase);fine.run(phase);
assert.deepEqual(a.sim.D,b.sim.D);assert.deepEqual(a.sim.C,b.sim.C);assert.deepEqual(a.plants,b.plants);
assert.deepEqual(r.built.water,initial);assert.equal(JSON.stringify(r.built.waterModel.emitters),emitters);
assert.equal(maxDiff(a.sim.D,fine.sim.D),0);assert.equal(maxDiff(a.sim.C,fine.sim.C),0);
const sensitivity={moistureMax:maxDiff(a.M,fine.M),soilMax:maxDiff(a.SC,fine.SC),dead16:a.plants.filter(p=>p.dead).length,dead1:fine.plants.filter(p=>p.dead).length};
assert(Math.abs(sensitivity.dead16-sensitivity.dead1)<=Math.max(5,a.plants.length*.02));
const data={fixtures:fixtures.length,settleMaxError:0,drought:rows,soilSensitivity:sensitivity};
mkdirSync(`${root}/investigation/cycles/results`,{recursive:true});
writeFileSync(`${root}/investigation/cycles/results/verification.json`,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data,null,2));
