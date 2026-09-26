import {loadWeather} from './weather-suite.mjs';
import {adversarialWeather} from './weather-adversarial.mjs';
const post=async(path,data)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-proof-token':globalThis.proofToken},body:JSON.stringify(data)});const x=await r.json();if(!r.ok)throw Error(x.error);return x;};
const status=document.querySelector('#status'),detail=document.querySelector('#detail');
try{
  const loaded=await loadWeather(),result=await adversarialWeather(loaded);
  await post('/boundaries',{result,environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency}});
  for(let i=0;i<globalThis.proofWorkers;i++){
    const worker=new Worker('/weather-browser-worker.mjs',{type:'module'});
    worker.onerror=e=>post('/failure',{error:e.message});worker.postMessage({token:globalThis.proofToken,mode:globalThis.proofMode});
  }
  const refresh=async()=>{const s=await(await fetch('/status')).json();detail.textContent=JSON.stringify(s,null,2);status.textContent=s.failure?'FAILED':s.done?'PASSED — every exact-weather comparison matches':'Running full exact-weather seed matrix…';if(!s.done&&!s.failure)setTimeout(refresh,2000);};
  refresh();
}catch(e){status.textContent='FAILED';detail.textContent=e.stack;await post('/failure',{error:e.stack||String(e)});}
