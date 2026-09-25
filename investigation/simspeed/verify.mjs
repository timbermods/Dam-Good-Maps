import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { golden } from './golden.mjs';
import { load, themes, verifyMap } from './suite.mjs';
const api = await load();
globalThis.simCpuUsage=()=>process.threadCpuUsage();
mkdirSync('results/node/maps',{recursive:true});
async function run(jobs, next) {
  let local=0;
  for(;;) {
    const index=next?Atomics.add(next,0,1):local++;
    if(index>=jobs.length)break;
    const c=jobs[index];
    const {theme,size,seed}=c,id=theme+'-'+size+'-'+seed,file='results/node/maps/'+id+'.json';
    console.log('VERIFY',id);
    const result=await verifyMap(api,c);
    result.cpuAccounting='thread';result.verificationWorkers=Number(process.env.VERIFY_WORKERS||3);
    writeFileSync(file,JSON.stringify(result)+'\n');
    console.log('PASS',id,Object.values(result.timings).reduce((a,b)=>a+b,0).toFixed(0)+'ms');
  }
}
if(!isMainThread) {
  await run(workerData.jobs,new Int32Array(workerData.next));
  parentPort.postMessage('complete');
} else {
  const fixtures=JSON.parse(gunzipSync(readFileSync('../../tests/golden/water.json.gz'))).fixtures;
  writeFileSync('results/node/golden.json',JSON.stringify(await golden(api,fixtures))+'\n');
  const jobs=[];
  for(const size of [96,128,256])for(const theme of themes)for(let seed=1;seed<=(size===128?30:3);seed++){
    const file='results/node/maps/'+theme+'-'+size+'-'+seed+'.json';
    if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===globalThis.simBuildId&&!process.argv.includes('--force'))continue;
    jobs.push({theme,size,seed});
  }
  const count=Math.max(1,Math.min(3,Number(process.env.VERIFY_WORKERS||3)));
  if(count===1)await run(jobs);
  else {
    const workers=[];
    const next=new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    try {
      await Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{
        const w=new Worker(new URL(import.meta.url),{workerData:{jobs,next}});
        workers.push(w);w.on('message',message=>{if(message==='complete')resolve();});
        w.on('error',reject);w.on('exit',code=>code===0?resolve():reject(Error('verification worker exited '+code)));
      })));
    } finally {await Promise.all(workers.map(w=>w.terminate()));}
  }
}
