import {loadWeather,weatherCase} from './weather-suite.mjs';
import {productCase} from './weather-product-suite.mjs';
onmessage=async({data:{token,mode}})=>{
  const post=async(path,data)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-proof-token':token},body:JSON.stringify(data)});const x=await r.json();if(!r.ok)throw Error(x.error);return x;};
  try{
    const loaded=await loadWeather();
    for(;;){const {job,pending}=await post('/next',{});if(pending){await new Promise(r=>setTimeout(r,2000));continue;}if(!job)break;
      const result=await(mode==='product'?productCase(loaded,job):weatherCase(loaded,job));await post('/result',{key:job.theme+'-'+job.size+'-'+job.seed,result});}
  }catch(e){await post('/failure',{error:e.stack||String(e)});}
};
