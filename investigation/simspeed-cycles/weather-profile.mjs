import {writeFileSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {matrix,matrixWorkers} from './matrix.mjs';
import {themes,sha} from './suite.mjs';
const api=await import('./.work/weather/bundles/profile.mjs');
const build=JSON.parse(readFileSync('results/weather/build.json','utf8'));
const full=process.argv.includes('--full'),folder=full?'profiles-full':'profiles';
mkdirSync('results/weather/'+folder,{recursive:true});
await matrix(import.meta.url,[96,128,256].flatMap(size=>themes.map(theme=>({theme,size,seed:1}))),async job=>{
  const file='results/weather/'+folder+'/'+job.theme+'-'+job.size+'-1.json';
  if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).profileBundle===build.bundles.profile&&!process.argv.includes('--force'))return;
  const g=api.generate(api.makeSpec({...job,size:{x:job.size,y:job.size}}));
  if(!g.report.passed||!g.bytes.length)throw Error('Profile generation failed');
  const phases={};let last=null,t0=0;
  globalThis.__weatherPhase=name=>{const now=performance.now();if(last){const p=phases[last]??={ms:0,calls:0};p.ms+=now-t0;p.calls++;}last=name;t0=now;};
  const c=process.threadCpuUsage(),start=performance.now(),probes=[];
  for(const spec of api.cases(g.built)){
    const days=full?spec.days:1,m=new api.CycleModel(g.built,spec.start);m.run(768*days);
    probes.push({id:spec.id,days,wet:m.sim.D.reduce((n,d)=>n+(d>0),0),contaminated:m.sim.C.reduce((n,c)=>n+(c>0),0)});
  }
  delete globalThis.__weatherPhase;
  const used=process.threadCpuUsage(c);
  const result={...job,reference:build.reference,profileBundle:build.bundles.profile,inputSha256:await sha(g.bytes),matrixWorkers,
    wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,phases,probes};
  writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log('PROFILE',job.theme,job.size);
});
