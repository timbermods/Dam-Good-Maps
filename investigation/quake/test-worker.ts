import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { canonicalSettle } from '../../src/core/sim/prefill';
import { quake,modelFor,DEFAULTS,type QuakeMap } from './engine';
import { applyOperation,type QuakeOperation } from './operation';
const workerFile=resolve('.cache/worker-test.mjs'),hostFile=resolve('.cache/worker-host.mjs');
await build({entryPoints:[resolve('worker.ts')],outfile:workerFile,bundle:true,platform:'node',format:'esm',nodePaths:[resolve('node_modules')],absWorkingDir:process.cwd()});
writeFileSync(hostFile,"import {parentPort} from 'node:worker_threads';\nglobalThis.self=globalThis;\nglobalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);\nawait import("+JSON.stringify(pathToFileURL(workerFile).href)+");\nparentPort.on('message',data=>self.onmessage({data}));\nparentPort.postMessage({type:'boot'});\n");
const worker=new Worker(hostFile);type Message={type:string;[k:string]:any};let receive:(m:Message)=>void=()=>{};
worker.on('message',m=>receive(m));await new Promise<void>((yes,no)=>{receive=m=>{if(m.type==='boot')yes();};worker.once('error',no);});
async function command(msg:Record<string,unknown>,interrupt?:{on:string;msg:Record<string,unknown>}){
 const messages:Message[]=[];return new Promise<Message[]>((yes,no)=>{
  const timer=setTimeout(()=>no(Error('Worker timeout '+msg.type)),90000);let sent=false;
  receive=m=>{messages.push(m);if(interrupt&&!sent&&m.type===interrupt.on){sent=true;worker.postMessage(interrupt.msg);}if(m.type==='error'){clearTimeout(timer);no(Error(m.text));}if(m.type==='ready'){clearTimeout(timer);yes(messages);}};worker.postMessage(msg);
 });
}
const snap=async()=>(await command({type:'snapshot'})).find(m=>m.type==='snapshot')!.map as QuakeMap;
const intent={path:[{x:0,y:64},{x:127,y:64}],side:1},settings={...DEFAULTS,seed:18};
async function complete(){let operationMessage:Message|undefined;for(let k=0;k<7;k++){const m=await command({type:'advance'});operationMessage=m.find(a=>a.type==='operation')??operationMessage;}assert.ok(operationMessage);return operationMessage;}
const passed:string[]=[],measurements:Record<string,unknown>[]=[];
const pass=(name:string)=>{passed.push(name);console.log('PASS '+name);};
try{
 const load=await command({type:'load',id:'fixture:river:128'}),before=await snap();assert.ok(load.some(m=>m.type==='chunk'));assert.ok(load.some(m=>m.type==='lighting'));pass('actual worker builds transferable clean terrain, water and object meshes');
 const t=performance.now(),begun=await command({type:'start',settings,intent});assert.ok(begun.some(m=>m.type==='started'));assert.notDeepEqual((await snap()).heights,before.heights);measurements.push({case:'first changed frame',ms:performance.now()-t});
 const finish=await complete(),op=finish.op as QuakeOperation,final=await snap(),water=canonicalSettle(modelFor(final));assert.deepEqual(final.water.depth,water.depth);assert.deepEqual(final.water.contamination,water.contamination);pass('live fronts finish in one operation with exact repository canonical water');
 await command({type:'undo'});assert.deepEqual(await snap(),before);await command({type:'redo'});assert.deepEqual(await snap(),final);assert.deepEqual(applyOperation(before,JSON.parse(JSON.stringify(op))),final);pass('one undo/redo restores every terrain, object, fallen tree and water byte');
 await command({type:'undo'});
 const cancelled=await command({type:'start',settings,intent},{on:'started',msg:{type:'cancel'}});assert.ok(cancelled.some(m=>m.type==='cancelled'));assert.deepEqual(await snap(),before);pass('Esc interrupts sliced planning and leaves no history entry');
 await command({type:'start',settings,intent});const cancelMesh=await command({type:'advance'},{on:'chunk',msg:{type:'undo'}});assert.ok(cancelMesh.some(m=>m.type==='cancelled'));assert.deepEqual(await snap(),before);pass('Undo interrupts chunk generation and restores the entire prior map');
 await command({type:'start',settings,intent});for(let k=0;k<6;k++)await command({type:'advance'});
 const cancelledWater=await command({type:'advance'},{on:'settling',msg:{type:'cancel'}});assert.ok(cancelledWater.some(m=>m.type==='cancelled'));assert.ok(!cancelledWater.some(m=>m.type==='operation'));assert.deepEqual(await snap(),before);pass('Esc cancels canonical settling without recording partial changes');
 const json=(v:unknown)=>JSON.parse(JSON.stringify(v,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as number[]):v));
 await command({type:'replay',bundle:json({format:1,base:before,quakeBase:before,operation:op})});assert.deepEqual(await snap(),final);
 await command({type:'reroll'});const alt=await complete(),altMap=await snap(),reference=quake(before,{...settings,seed:19},intent as any).map;
 assert.deepEqual(altMap.heights,reference.heights);assert.notDeepEqual(altMap.heights,final.heights);assert.deepEqual(alt.quakeBase,before);assert.equal(alt.op.params.settings.seed,19);pass('Try another starts from original ground with a recorded new seed');
 await command({type:'undo'});assert.deepEqual(await snap(),final);await command({type:'redo'});assert.deepEqual(await snap(),altMap);
 await command({type:'reroll'});await command({type:'cancel'});assert.deepEqual(await snap(),altMap);pass('cancelling an alternative restores the kept quake exactly');
 await command({type:'load',id:'fixture:plain:128'});await command({type:'replay',bundle:json({format:1,base:final,quakeBase:before,operation:alt.op})});assert.deepEqual(await snap(),altMap);pass('saved alternative replays exactly on another loaded map');
 await command({type:'load',id:'fixture:river:256'});const bigBefore=await snap(),bigIntent={side:1,path:[{x:0,y:128},{x:255,y:128}]};
 const now=performance.now();await command({type:'start',settings,intent:bigIntent});let first=performance.now()-now;
 for(let k=0;k<6;k++)await command({type:'advance'});measurements.push({case:'256² rupture seven of eight fronts',firstMs:first,ms:performance.now()-now});await command({type:'cancel'});assert.deepEqual(await snap(),bigBefore);pass('256² real worker responds progressively and cancels exactly');
 writeFileSync('captures/worker-checks.json',JSON.stringify({passed,measurements},null,2)+'\n');console.log(JSON.stringify(measurements,null,2));
}finally{await worker.terminate();}
