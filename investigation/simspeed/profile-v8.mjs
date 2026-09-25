// Sample baseline CPU stacks, separate from reported benchmark runs.
import {Session} from 'node:inspector';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {load,themes,editedModel,cases} from './suite.mjs';
console.log('PROFILE loading bundles');
const a=(await load()).baseline,s=new Session();s.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>s.post(method,params,(e,r)=>e?reject(e):resolve(r)));
const samplingIntervalUs=5000;
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:samplingIntervalUs});
mkdirSync('results/v8-diagnostics',{recursive:true});
const current=id=>{
  const file='results/v8-diagnostics/'+id+'.json';
  if(!existsSync(file)||process.argv.includes('--force'))return false;
  const p=JSON.parse(readFileSync(file,'utf8'));
  return p.buildId===globalThis.simBuildId&&p.samplingIntervalUs===samplingIntervalUs;
};
async function profile(id,fn){
  if(current(id))return;
  console.log('PROFILE starting',id);
  await post('Profiler.start');
  const cpu=process.cpuUsage(),t=performance.now();fn();
  const workloadMs=performance.now()-t,cpuUsed=process.cpuUsage(cpu);
  const workloadCpuMs=(cpuUsed.user+cpuUsed.system)/1000;
  const {profile:p}=await post('Profiler.stop');
  const byId=new Map(p.nodes.map(n=>[n.id,n])), self=new Map(),inclusive=new Map(), parents=new Map();
  for(const n of p.nodes)for(const child of n.children??[])parents.set(child,n.id);
  for(let i=0;i<(p.samples?.length??0);i++){
    const id=p.samples[i],dt=p.timeDeltas[i]??samplingIntervalUs;self.set(id,(self.get(id)??0)+dt);
    let k=id;while(k){inclusive.set(k,(inclusive.get(k)??0)+dt);k=parents.get(k);}
  }
  const groups=new Map();
  for(const [key,us]of inclusive){
    const n=byId.get(key),name=n.callFrame.functionName||'(anonymous)',g=groups.get(name)||{name,selfUs:0,inclusiveUs:0};
    g.selfUs+=self.get(key)||0;g.inclusiveUs+=us;groups.set(name,g);
  }
  writeFileSync('results/v8-diagnostics/'+id+'.json',JSON.stringify({buildId:globalThis.simBuildId,id,samplingIntervalUs,workloadMs,workloadCpuMs,durationUs:p.endTime-p.startTime,samples:p.samples?.length,functions:[...groups.values()].sort((a,b)=>b.selfUs-a.selfUs)},null,2)+'\n');
  console.log('PROFILE',id);
}
for(const size of [96,128,256])for(const theme of themes){
  if(process.argv.includes('--smoke') && (size!==128 || theme!=='lakeBasin'))continue;
  if(['canonical','preview','drought','cycle-sample'].every(stage=>current(theme+'-'+size+'-'+stage)))continue;
  console.log('PROFILE generating',theme,size);
  const b=a.generate(a.makeSpec({theme,seed:1,size:{x:size,y:size}})).built,m=b.waterModel,next=editedModel(m,b.water),id=theme+'-'+size;
  await profile(id+'-canonical',()=>a.canonicalSettle(m));
  await profile(id+'-preview',()=>a.previewSettle({model:m,water:b.settle},next));
  await profile(id+'-drought',()=>{for(let i=0;i<30;i++)a.droughtStorage(m,b.water,9);});
  // The same first day from each of the six probes: normal, off/ramp, badtide.
  await profile(id+'-cycle-sample',()=>{for(const scenario of cases(a)){const c=new a.CycleModel(b),phase=scenario.phases[0];for(let i=0;i<768;i++)c.tick(phase,i);}});
}
s.disconnect();
