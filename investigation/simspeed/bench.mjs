import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { load, themes, variants, timeStages, cycles } from './suite.mjs';
import {isMainThread} from 'node:worker_threads';
import {matrix,matrixWorkers} from './matrix.mjs';
const api=await load();
globalThis.simCpuUsage=()=>process.threadCpuUsage();
mkdirSync('results/node/bench',{recursive:true});
if(isMainThread)writeFileSync('results/node/environment.json',JSON.stringify({node:process.version,v8:process.versions.v8,cpu:cpus()[0].model,platform:process.platform,cpuAccounting:'thread',matrixWorkers,date:new Date().toISOString()},null,2)+'\n');
await matrix(import.meta.url,[96,128,256].flatMap(size=>themes.map(theme=>({size,theme}))),async({size,theme})=>{
  const id=`${theme}-${size}-1`, file=`results/node/bench/${id}.json`;
  if(existsSync(file) && JSON.parse(readFileSync(file,'utf8')).buildId===globalThis.simBuildId && !process.argv.includes('--force')) return;
  const generated=api.baseline.generate(api.baseline.makeSpec({seed:1,theme,size:{x:size,y:size}})),b=generated.built;
  const modelSummary={tiles:b.W*b.H,prefillWetCells:api.baseline.prefill(b.waterModel).depth.reduce((n,d)=>n+(d>0?1:0),0),
    settledWetCells:b.water.reduce((n,d)=>n+(d>0?1:0),0),settleTicks:b.settle.ticks,emitters:b.waterModel.emitters.length,
    partialDamCells:b.waterModel.dam?.reduce((n,d)=>n+(d>=0?1:0),0)??0};
  // F32 wrappers are branded by their bundle's class. Keep entity inputs native
  // to each implementation; generation parity is independently proved by verify.mjs.
  const builds={baseline:b};
  for(const v of variants.slice(1))builds[v]=api[v].generate(api[v].makeSpec({seed:1,theme,size:{x:size,y:size}})).built;
  timeStages(api,builds,1,0);
  const stages=timeStages(api,builds,3);
  writeFileSync(file+'.partial',JSON.stringify({theme,size,seed:1,stages})+'\n');
  const cycle=await cycles(api,builds,msg=>console.log(id,msg),generated.spec.settings.start.rules.waterWithin);
  writeFileSync(file,JSON.stringify({buildId:globalThis.simBuildId,theme,size,seed:1,cpuAccounting:'thread',matrixWorkers,modelSummary,stages,cycle})+'\n');
  console.log('PASS',id,'73-day cycle byte equality');
});
