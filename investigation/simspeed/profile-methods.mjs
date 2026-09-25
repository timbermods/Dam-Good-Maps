// Instrumented attribution only. bench.mjs uses a separate, uninstrumented process.
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {threadId} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {load,themes,editedModel,cases} from './suite.mjs';
import {matrix,matrixWorkers} from './matrix.mjs';
await load();
const method='instrumented-method-wall-v2';
let groups=new Map(),stack=[];
function wrap(label,original){
  return function(...args){
    const frame={child:0},start=performance.now();stack.push(frame);
    try{return original.apply(this,args);}
    finally{
      const elapsed=(performance.now()-start)*1000;stack.pop();
      const g=groups.get(label)||{name:label,calls:0,selfUs:0,inclusiveUs:0};
      g.calls++;g.selfUs+=elapsed-frame.child;g.inclusiveUs+=elapsed;groups.set(label,g);
      if(stack.length)stack[stack.length-1].child+=elapsed;
    }
  };
}
globalThis.simProfileExports=(id,exports)=>{
  const names=id.endsWith('/sim/prefill.ts')?['spillLevels']:
    id.endsWith('/sim/moisture.ts')?['clusterSaturation','moisture','soilContamination']:
    id.endsWith('/sim/drought.ts')?['droughtStorage']:[];
  for(const name of names)if(typeof exports[name]==='function')exports[name]=wrap(name,exports[name]);
};
// A diagnostic-only copy wraps selected module exports at require time. The
// measured/proven bundles stay untouched, and no simulation expression changes.
const original=readFileSync('.work/bundles/baseline.mjs','utf8');
const marker='modules[id](m, m.exports, require);';
if(original.split(marker).length!==2)throw Error('profile bundle marker changed');
const source=original.replace(marker,marker+' globalThis.simProfileExports?.(id, m.exports);');
const profileBundleSha256=createHash('sha256').update(source).digest('hex');
const profilePath=resolve('.work/bundles/profile-'+threadId+'.mjs');writeFileSync(profilePath,source);
const a=await import(pathToFileURL(profilePath).href);
function instrument(type,names){
  for(const name of names){
    const original=type.prototype[name];
    if(typeof original!=='function')continue;
    const label=type.name+'.'+name;
    type.prototype[name]=wrap(label,original);
  }
}
// Avoid per-tile satAt instrumentation; its work stays within its calling method.
instrument(a.WaterSim,['run','substep','buildActive','updateEvapMod','computeWn','updateSeeps','volume','saturation']);
instrument(a.CycleModel,['tick','updateLife']);
mkdirSync('results/profiles',{recursive:true});
const current=id=>{
  const file='results/profiles/'+id+'.json';
  if(!existsSync(file)||process.argv.includes('--force'))return false;
  const p=JSON.parse(readFileSync(file,'utf8'));
  return p.buildId===globalThis.simBuildId&&(p.method===method||(!id.endsWith('-drought')&&p.method==='instrumented-method-wall-v1'));
};
function profile(id,fn){
  if(current(id))return;
  console.log('PROFILE starting',id);
  groups=new Map();stack=[];
  const frame={child:0};stack.push(frame);
  const cpu=process.threadCpuUsage(),t=performance.now();fn();
  const workloadMs=performance.now()-t,cpuUsed=process.threadCpuUsage(cpu);stack.pop();
  const remainder=workloadMs*1000-frame.child;
  groups.set('uninstrumented remainder',{name:'uninstrumented remainder',calls:1,selfUs:remainder,inclusiveUs:remainder});
  const result={buildId:globalThis.simBuildId,id,method,profileBundleSha256,cpuAccounting:'thread',matrixWorkers,workloadMs,workloadCpuMs:(cpuUsed.user+cpuUsed.system)/1000,
    functions:[...groups.values()].sort((a,b)=>b.selfUs-a.selfUs)};
  writeFileSync('results/profiles/'+id+'.json',JSON.stringify(result,null,2)+'\n');
  console.log('PROFILE',id,Math.round(workloadMs)+'ms wall',result.workloadCpuMs+'ms CPU');
}
await matrix(new URL('./profile.mjs',import.meta.url),[96,128,256].flatMap(size=>themes.map(theme=>({size,theme}))),async({size,theme})=>{
  if(process.argv.includes('--smoke')&&(size!==128||theme!=='lakeBasin'))return;
  if(['canonical','preview','drought','cycle-sample'].every(stage=>current(theme+'-'+size+'-'+stage)))return;
  console.log('PROFILE generating',theme,size);
  const generated=a.generate(a.makeSpec({theme,seed:1,size:{x:size,y:size}})),b=generated.built,m=b.waterModel,next=editedModel(m,b.water),id=theme+'-'+size;
  const proof=JSON.parse(readFileSync('results/node/maps/'+id+'-1.json','utf8'));
  if(createHash('sha256').update(generated.bytes).digest('hex')!==proof.hashes.baseline)throw Error('instrumented generation changed '+id);
  profile(id+'-canonical',()=>a.canonicalSettle(m));
  profile(id+'-preview',()=>a.previewSettle({model:m,water:b.settle},next));
  profile(id+'-drought',()=>{for(let i=0;i<30;i++)a.droughtStorage(m,b.water,9);});
  profile(id+'-cycle-sample',()=>{for(const scenario of cases(a)){const c=new a.CycleModel(b),phase=scenario.phases[0];for(let i=0;i<768;i++)c.tick(phase,i);}});
});
