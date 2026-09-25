import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {themes} from './suite.mjs';
import {loadM9,m9Case} from './m9-suite.mjs';
const loaded=await loadM9();globalThis.simCpuUsage=()=>process.threadCpuUsage();
mkdirSync('results/m9/node',{recursive:true});
for(const size of [128,256])for(const theme of themes)for(const seed of [1,2]){
  const id=theme+'-'+size+'-'+seed,file='results/m9/node/'+id+'.json';
  if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===loaded.buildId&&!process.argv.includes('--force'))continue;
  const r=await m9Case(loaded,{theme,size,seed});
  writeFileSync(file,JSON.stringify({...r,workers:1,cpuAccounting:'thread'})+'\n');console.log('M9 PASS',id,'attempts',r.attempts);
}
