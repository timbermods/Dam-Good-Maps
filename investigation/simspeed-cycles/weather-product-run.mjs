import {mkdirSync,readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {loadWeather} from './weather-suite.mjs';
import {productJobs,productCase} from './weather-product-suite.mjs';
import {matrix,matrixWorkers} from './weather-matrix.mjs';
const loaded=await loadWeather();globalThis.simCpuUsage=()=>process.threadCpuUsage();
mkdirSync('results/weather/product/node',{recursive:true});
await matrix(import.meta.url,productJobs,async job=>{
  const id=job.theme+'-'+job.size+'-'+job.seed,file='results/weather/product/node/'+id+'.json';
  if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===loaded.buildId&&!process.argv.includes('--force'))return;
  const result=await productCase(loaded,job);writeFileSync(file+'.partial',JSON.stringify({...result,matrixWorkers})+'\n');renameSync(file+'.partial',file);console.log('CONTINUOUS PASS',id);
});
