import {sha,digest} from './suite.mjs';
const cpu=()=>globalThis.simCpuUsage?.()??null;
const elapsed=c=>{if(!c)return null;const n=cpu();return(n.user-c.user+n.system-c.system)/1000;};
export async function loadExact(){return {api:await import('./.work/exact/api.mjs'),buildId:(await import('./.work/exact/version.mjs')).buildId};}
function snapshot(m,measure,metrics){
  const s=m.sim;
  return {D:s.D.slice(),C:s.C.slice(),Dold:s.Dold.slice(),out:s.out.slice(),evapBuffered:s.evapBuffered.slice(),evapCurrent:s.evapCurrent.slice(),
    M:m.M.slice(),SC:m.SC.slice(),candidates:m.soil.cand.slice(),sat:m.soil.sat.slice(),
    plants:JSON.stringify(m.plants),sources:JSON.stringify(m.sources),clock:JSON.stringify(m.clock),elapsedTicks:m.elapsedTicks,
    volume:s.volume(),metrics:JSON.stringify(metrics),firstDry:measure.firstDry.slice(),firstBad:measure.firstBad.slice(),firstWaterLost:measure.firstWaterLost};
}
export async function exactCase({api,buildId},{theme,size,seed=1},withProfile=true){
  const g=api.generate(api.makeSpec({theme,seed,size:{x:size,y:size}}));
  if(!g.report.passed||!g.bytes.length)throw Error('Exact reference generation failed');
  const inputSha256=await sha(g.bytes),probes=[];
  // The original core port must never execute during this reference's weather ticks.
  // Guarding it proves these core prototypes do not change the new hot path.
  const originals=new Map();
  for(const name of ['run','substep','computeWn']){
    originals.set(name,api.WaterSim.prototype[name]);
    api.WaterSim.prototype[name]=()=>{throw Error('Unexpected core WaterSim call in exact-cycle workload: '+name);};
  }
  try{
    for(const spec of api.cases(g.built,1729)){
      const c0=cpu(),t0=performance.now();
      const m=new api.CycleModel(g.built,spec.start),measure=new api.Measures(m,g.spec.settings.start.rules.waterWithin);
      let excludedMs=0,excludedCpu=0;const snapshots=[];
      const capture=(row)=>{
        const metrics=measure.sample(row.day); // original reference overhead remains timed
        const c=cpu(),t=performance.now();
        snapshots.push({row,...snapshot(m,measure,metrics)});
        excludedMs+=performance.now()-t;excludedCpu+=elapsed(c)??0;
      };
      capture({day:0,phase:'baseline'});
      const spans=api.runStretch(m,spec.days,capture);
      const wallMs=performance.now()-t0-excludedMs,cpuMs=c0?elapsed(c0)-excludedCpu:null;
      const checkpoints=[];for(const s of snapshots)checkpoints.push(await digest(s));
      probes.push({id:spec.id,days:spec.days,spans,wallMs,cpuMs,checkpoints});
    }
    let profile=null;
    if(withProfile){
      const functions=new Map(),stack=[];
      const wrap=(obj,name,label)=>{
        const fn=obj[name];obj[name]=function(...args){const t=performance.now(),frame={child:0};stack.push(frame);
          try{return fn.apply(this,args);}finally{const dt=performance.now()-t;stack.pop();if(stack.length)stack.at(-1).child+=dt;
            const r=functions.get(label)||{name:label,calls:0,selfMs:0,inclusiveMs:0};r.calls++;r.inclusiveMs+=dt;r.selfMs+=dt-frame.child;functions.set(label,r);}};
        return()=>{obj[name]=fn;};
      };
      const restore=[wrap(api.GameWater.prototype,'tick','GameWater.tick'),wrap(api.GameWater.prototype,'substep','GameWater.substep'),
        wrap(api.GameWater.prototype,'buildActive','GameWater.buildActive'),wrap(api.GameSoil.prototype,'step','GameSoil.step'),
        wrap(api.CycleModel.prototype,'plantsTick','CycleModel.plantsTick'),wrap(api.CycleModel.prototype,'updateSources','CycleModel.updateSources')];
      const c=cpu(),t=performance.now();
      try{for(const s of api.cases(g.built,1729)){const m=new api.CycleModel(g.built,s.start);m.run(768);}}
      finally{profile={days:6,wallMs:performance.now()-t,cpuMs:elapsed(c),functions:[...functions.values()].sort((a,b)=>b.selfMs-a.selfMs)};for(const r of restore)r();}
    }
    return {buildId,theme,size,seed,inputSha256,coreWaterSimCalls:0,probes,profile};
  }finally{for(const [name,fn] of originals)api.WaterSim.prototype[name]=fn;}
}
