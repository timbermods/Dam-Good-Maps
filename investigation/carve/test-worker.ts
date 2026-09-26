import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { canonicalSettle } from '../../src/core/sim/prefill';
import { modelFor, DEFAULTS, type CarveMap } from './engine';
import { applyOperation, type CarveOperation } from './operation';
const workerFile=resolve('.cache/worker-test.mjs'),hostFile=resolve('.cache/worker-host.mjs');
await build({entryPoints:[resolve('worker.ts')],outfile:workerFile,bundle:true,platform:'node',format:'esm',nodePaths:[resolve('node_modules')],absWorkingDir:process.cwd()});
writeFileSync(hostFile,"import {parentPort} from 'node:worker_threads';\nglobalThis.self=globalThis;\nglobalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);\nawait import("+JSON.stringify(pathToFileURL(workerFile).href)+");\nparentPort.on('message',data=>self.onmessage({data}));\nparentPort.postMessage({type:'boot'});\n");
const worker=new Worker(hostFile);
type Message={type:string;[k:string]:any};
let receive:(m:Message)=>void=()=>{};
worker.on('message',m=>receive(m));
const boot=new Promise<void>((yes,no)=>{receive=m=>{if(m.type==='boot')yes();};worker.once('error',no);});
await boot;
async function command(msg:Record<string,unknown>){
 const messages:Message[]=[];
 return await new Promise<Message[]>((yes,no)=>{
  const timer=setTimeout(()=>no(new Error('Worker response timeout')),30000);
  receive=m=>{
   messages.push(m);
   if(m.type==='error'){clearTimeout(timer);no(new Error(m.text));}
   if(m.type==='ready'){clearTimeout(timer);yes(messages);}
  };
  worker.postMessage(msg);
 });
}
async function snap(){return (await command({type:'snapshot'})).find(m=>m.type==='snapshot')!.map as CarveMap;}
try{
 await command({type:'load',id:'fixture:mountain'});const bare=await snap();
 await command({type:'source',tile:80*96+48,strength:4});const before=await snap();
 assert.equal(before.entities.filter(e=>e.id==='carve-source').length,1);
 await command({type:'start',settings:DEFAULTS});
 for(let i=0;i<25;i++)await command({type:'advance'});
 const paused=await snap();
 await new Promise(r=>setTimeout(r,70));
 assert.deepEqual(await snap(),paused,'idle/paused worker must not advance');
 const done=await command({type:'stop'});
 const op=done.find(m=>m.type==='operation')!.op as CarveOperation;
 assert.equal(op.params.steps,25);assert.equal(op.params.reason,'stopped');
 const final=await snap(),expected=canonicalSettle(modelFor(final));
 assert.deepEqual(final.water.depth,expected.depth);
 await command({type:'undo'});assert.deepEqual(await snap(),before);
 await command({type:'redo'});assert.deepEqual(await snap(),final);
 assert.deepEqual(applyOperation(before,JSON.parse(JSON.stringify(op))),final);
 await command({type:'undo'});await command({type:'undo'});assert.deepEqual(await snap(),bare);
 await command({type:'redo'});await command({type:'redo'});assert.deepEqual(await snap(),final);
 const bundle=JSON.parse(JSON.stringify({format:1,base:before,operation:op},(_key,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as number[]):v));
 await command({type:'load',id:'fixture:bends'});
 await command({type:'replay',bundle});assert.deepEqual(await snap(),final);
 const result={passed:['real worker module load and transferable mesh frames','source placement is its own exact undo step','idle pause leaves every byte unchanged','stop records exactly 25 acknowledged steps','worker final water equals repository canonical solve','run undo/redo and source undo/redo restore exact complete state','portable file replays exact saved result on a fresh map without simulation'],operationBytes:JSON.stringify(op).length};
 writeFileSync('captures/worker-checks.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await worker.terminate();}
