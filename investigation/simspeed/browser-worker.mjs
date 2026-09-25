import * as suite from './suite.mjs';
self.onmessage=async({data:{token}})=>{
  const post=async(path,data={})=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Proof-Token':token},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
  try{
    const api=await suite.load();
    for(;;){
      const {job}=await post('/next');if(!job)break;
      let result;
      if(job.kind==='maps')result=await suite.verifyMap(api,job);
      else{
        const builds={};let generated;
        for(const v of suite.variants){
          const g=api[v].generate(api[v].makeSpec({theme:job.theme,seed:job.seed,size:{x:job.size,y:job.size}}));
          builds[v]=g.built;if(v==='baseline')generated=g;
        }
        suite.timeStages(api,builds,1,0);
        const stages=suite.timeStages(api,builds,3);
        result={buildId:globalThis.simBuildId,theme:job.theme,size:job.size,seed:job.seed,stages,
          cycle:await suite.cycles(api,builds,()=>{},generated.spec.settings.start.rules.waterWithin)};
      }
      await post('/result',{key:job.kind+'/'+job.id,result});
    }
  }catch(e){await post('/failure',{error:e.stack||String(e)});}
};
