import {equal,compare,sha,digest,themes} from './suite.mjs';
export {themes};
export const weatherVariants=['baseline','water-sparse','soil-cache','soil-saturation','water-wasm','combined'];
export const weatherJobs=[96,128,256].flatMap(size=>themes.flatMap(theme=>Array.from({length:size===128?30:size===256?3:1},(_,i)=>({theme,size,seed:i+1}))));
export async function loadWeather(){
  const api=Object.fromEntries(await Promise.all(weatherVariants.map(async v=>[v,await import('./.work/weather/bundles/'+v+'.mjs')])));
  return {api,buildId:(await import('./.work/weather/bundles/version.mjs')).buildId};
}
const cpu=()=>globalThis.simCpuUsage?.()??null;
const used=c=>{if(!c)return null;const n=cpu();return(n.user-c.user+n.system-c.system)/1000;};
export function weatherSnapshot(m,measure=null,row=null,metrics=null){
  const s=m.sim,q=m.soil;
  const result={row,elapsedTicks:m.elapsedTicks,waterTicks:s.ticks,soilPasses:q.passes,volume:s.volume(),
    plants:JSON.stringify(m.plants),sources:JSON.stringify(m.sources),sourceSnapshot:JSON.stringify(m.snapshot),clock:JSON.stringify(m.clock),metrics:JSON.stringify(metrics)};
  for(const key of ['D','C','Dold','out','evapBuffered','evapCurrent','f','buf'])result[key]=s[key].slice();
  for(const key of ['M','level','cand','sat','wn','pWet','pSurf','pDepth','pC','pSat','pGive','pBad'])result['soil_'+key]=q[key].slice();
  if(measure){result.firstDry=measure.firstDry.slice();result.firstBad=measure.firstBad.slice();result.firstWaterLost=measure.firstWaterLost;result.firstSoilClean=measure.firstSoilClean;}
  return result;
}
export function generateWeather(api,job){
  const built={};
  for(const v of weatherVariants){
    const g=api[v].generate(api[v].makeSpec({theme:job.theme,seed:job.seed,size:{x:job.size,y:job.size}}));
    if(!g.report.passed||!g.bytes.length)throw Error('Generation failed '+v+'/'+JSON.stringify(job));
    if(v!=='baseline')equal(g.bytes,built.baseline.bytes,'weather input/'+v);
    built[v]=g;
  }
  return built;
}
export async function weatherCase(loaded,job,{smokeTicks=0}={}){
  const {api,buildId}=loaded,built=generateWeather(api,job),inputSha256=await sha(built.baseline.bytes),probes=[];
  const specifications=api.baseline.cases(built.baseline.built,1729);
  // Full generation and a fixed warm-up through both drought and badtide branches for every bundle.
  if(!smokeTicks)for(const v of weatherVariants)for(const ix of [2,4]){
    const spec=specifications[ix],m=new api[v].CycleModel(built[v].built,spec.start);m.run(384);
  }
  for(let ix=0;ix<specifications.length;ix++){
    const spec=specifications[ix];
    if(smokeTicks){
      const models=Object.fromEntries(weatherVariants.map(v=>[v,new api[v].CycleModel(built[v].built,spec.start)]));
      for(let t=0;t<smokeTicks;t++){
        for(const v of weatherVariants)models[v].tick();
        const ref=weatherSnapshot(models.baseline);
        for(const v of weatherVariants.slice(1))compare(ref,weatherSnapshot(models[v]),job.theme+'/'+spec.id+'/'+t+'/'+v);
      }
      probes.push({id:spec.id,ticks:smokeTicks,checkpoint:await digest(weatherSnapshot(models.baseline))});continue;
    }
    const results={},order=weatherVariants.map((_,k)=>weatherVariants[(k+job.seed+ix)%weatherVariants.length]);
    for(const v of order){
      const t=performance.now(),c=cpu();let excluded=0,excludedCpu=0;const snapshots=[],progress=[];
      const m=new api[v].CycleModel(built[v].built,spec.start),measure=new api[v].Measures(m,built[v].spec.settings.start.rules.waterWithin);
      const spans=api[v].runStretch(m,spec.days,row=>{
        const metrics=measure.sample(row.day);
        const st=performance.now(),sc=cpu();
        progress.push({row,wallMs:st-t-excluded,cpuMs:c?used(c)-excludedCpu:null});
        snapshots.push(weatherSnapshot(m,measure,row,metrics));
        excluded+=performance.now()-st;excludedCpu+=used(sc)??0;
      });
      results[v]={spans,snapshots,progress,wallMs:performance.now()-t-excluded,cpuMs:c?used(c)-excludedCpu:null};
    }
    const ref=results.baseline;
    for(const v of weatherVariants.slice(1)){
      const other=results[v];if(JSON.stringify(ref.spans)!==JSON.stringify(other.spans)||ref.snapshots.length!==other.snapshots.length)throw Error('Weather schedule mismatch '+v);
      for(let i=0;i<ref.snapshots.length;i++)compare(ref.snapshots[i],other.snapshots[i],JSON.stringify(job)+'/'+spec.id+'/'+i+'/'+v);
    }
    const checkpoints=[];for(const s of ref.snapshots)checkpoints.push(await digest(s));
    probes.push({id:spec.id,days:spec.days,spans:ref.spans,order,checkpoints,
      timings:Object.fromEntries(weatherVariants.map(v=>[v,{wallMs:results[v].wallMs,cpuMs:results[v].cpuMs,progress:results[v].progress}]))});
  }
  return {buildId,...job,inputSha256,weatherSeed:1729,plantSeed:1729,variants:weatherVariants,passed:true,smokeTicks,probes};
}
