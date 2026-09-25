import {loadM9,m9Case} from './m9-suite.mjs';
self.onmessage=async({data:{token}})=>{
  const post=async(path,data={})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Proof-Token':token},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
  try{
    const loaded=await loadM9();
    for(;;){const {job,pending}=await post('/next');if(pending){await new Promise(r=>setTimeout(r,2000));continue;}if(!job)break;
      const result=await m9Case(loaded,job);
      await post('/result',{key:job.kind+'/'+job.id,result});
    }
  }catch(e){await post('/failure',{error:e.stack||String(e)});}
};
