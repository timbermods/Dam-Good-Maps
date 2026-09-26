import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {matrix,matrixWorkers} from './weather-matrix.mjs';
import {loadWeather,weatherJobs,weatherCase} from './weather-suite.mjs';
const loaded=await loadWeather();globalThis.simCpuUsage=()=>process.threadCpuUsage();
const smoke=process.argv.includes('--smoke'),folder=smoke?'smoke':'node';
mkdirSync('results/weather/'+folder,{recursive:true});
const jobs=smoke||process.argv.includes('--pilot')?weatherJobs.filter(j=>j.size===96):weatherJobs;
await matrix(import.meta.url,jobs,async job=>{
  const id=job.theme+'-'+job.size+'-'+job.seed,file='results/weather/'+folder+'/'+id+'.json';
  if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===loaded.buildId&&!process.argv.includes('--force'))return;
  const result=await weatherCase(loaded,job,{smokeTicks:smoke?160:0});
  writeFileSync(file+'.partial',JSON.stringify({...result,matrixWorkers,cpuAccounting:'thread'})+'\n');renameSync(file+'.partial',file);
  console.log('WEATHER PASS',folder,id,smoke?'tick checks':result.probes.reduce((n,p)=>n+p.days,0)+' days');
});
