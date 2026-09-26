import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
export const matrixWorkers=Math.max(1,Math.min(8,Number(process.env.WEATHER_WORKERS||4)));
// Separate maps share a queue; variants within each map run in order on one thread.
export async function matrix(entry,jobs,fn){
  if(!isMainThread){
    const next=new Int32Array(workerData.next);
    for(;;){const i=Atomics.add(next,0,1);if(i>=jobs.length)break;await fn(jobs[i]);}
    parentPort.postMessage('complete');return;
  }
  if(matrixWorkers===1){for(const job of jobs)await fn(job);return;}
  const next=new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),workers=[];
  try{
    await Promise.all(Array.from({length:matrixWorkers},()=>new Promise((resolve,reject)=>{
      const w=new Worker(typeof entry==='string'?new URL(entry):entry,{workerData:{next},argv:process.argv.slice(2)});workers.push(w);
      w.on('message',m=>{if(m==='complete')resolve();});w.on('error',reject);
      w.on('exit',code=>code===0?resolve():reject(Error('matrix worker exited '+code)));
    })));
  }finally{await Promise.all(workers.map(w=>w.terminate()));}
}
