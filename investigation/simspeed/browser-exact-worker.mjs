import {loadExact,exactCase} from './exact-suite.mjs';
self.onmessage=async({data:{token}})=>{
  const post=async(path,data={})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Proof-Token':token},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
  try{
    const loaded=await loadExact();
    for(;;){const {job}=await post('/next');if(!job)break;
      const result=await exactCase(loaded,job,false);
      await post('/result',{key:job.kind+'/'+job.id,result});
    }
  }catch(e){await post('/failure',{error:e.stack||String(e)});}
};
