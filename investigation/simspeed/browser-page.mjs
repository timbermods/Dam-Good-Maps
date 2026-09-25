import {load} from './suite.mjs';
import {golden} from './golden.mjs';
const label=document.querySelector('#status'), detail=document.querySelector('#detail');
const post=async(path,data)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Proof-Token':globalThis.proofToken},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
try{
  const api=await load(), fixtures=(await(await fetch('/golden.json')).json()).fixtures;
  await post('/golden',{result:await golden(api,fixtures),environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency}});
  for(let i=0;i<(globalThis.proofWorkers??3);i++){
    const w=new Worker(globalThis.proofMode==='m9'?'/browser-m9-worker.mjs':globalThis.proofMode==='exact'?'/browser-exact-worker.mjs':'/browser-worker.mjs',{type:'module'});
    w.onerror=e=>post('/failure',{error:e.message});
    w.postMessage({token:globalThis.proofToken});
  }
  const timer=setInterval(async()=>{
    const s=await(await fetch('/status')).json();
    label.textContent=s.failure?'FAILED':s.done?'PASSED — all Node/Chromium comparisons match':`${s.completed} / ${s.total} cases verified`;
    detail.textContent=JSON.stringify(s,null,2);
    if(s.done||s.failure)clearInterval(timer);
  },2000);
}catch(e){label.textContent='FAILED';detail.textContent=e.stack;await post('/failure',{error:e.stack});}
