import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {themes} from './suite.mjs';
import {loadExact,exactCase} from './exact-suite.mjs';
import {matrix,matrixWorkers} from './matrix.mjs';
const loaded=await loadExact();globalThis.simCpuUsage=()=>process.threadCpuUsage();
mkdirSync('results/exact/node',{recursive:true});
await matrix(import.meta.url,[96,128,256].flatMap(size=>themes.map(theme=>({theme,size,seed:1}))),async job=>{
  const id=job.theme+'-'+job.size+'-1',file='results/exact/node/'+id+'.json';
  if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===loaded.buildId&&!process.argv.includes('--force'))return;
  const r=await exactCase(loaded,job);
  if(r.inputSha256!==JSON.parse(readFileSync('results/node/maps/'+id+'.json','utf8')).hashes.baseline)throw Error('Changed exact-cycle input '+id);
  writeFileSync(file,JSON.stringify({...r,matrixWorkers,cpuAccounting:'thread'})+'\n');console.log('EXACT PASS',id,r.probes.reduce((n,p)=>n+p.days,0),'days');
});
