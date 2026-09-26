import {equal,digest} from './suite.mjs';
import {weatherVariants} from './weather-suite.mjs';
export async function adversarialWeather({api,buildId}){
  const records=[];
  for(const [W,H] of [[1,1],[1,9],[9,1],[3,3],[9,9],[31,31]]){
    const N=W*H,F=Float64Array.from({length:N},(_,i)=>(i*17%5===0?1:0)),dam=Float64Array.from({length:N},(_,i)=>i%11===2?.65:-1);
    const initD=Float64Array.from({length:N},(_,i)=>i%7===0?0:1+(i%9)/20),initC=Float64Array.from({length:N},(_,i)=>i===0?-0:i===Math.floor(N/2)?.6:0);
    const model={W,H,floor:F,dam,emitters:[{cells:[0],strength:1,contamination:0}]};
    const water=Object.fromEntries(weatherVariants.map(v=>[v,new api[v].GameWater(model,initD,initC,new Float64Array(N).fill(1))]));
    for(const s of Object.values(water))s.sources=[{cells:[0],strength:1,contamination:0}];
    for(let tick=0;tick<512;tick++){
      for(const v of weatherVariants){const s=water[v];s.sources[0].strength=tick<128?1:tick<256?0:.7;s.sources[0].contamination=tick<200?0:tick<350?1:.1;s.tick();}
      for(const v of weatherVariants.slice(1))for(const k of ['D','C','Dold','out','evapBuffered','evapCurrent','f','buf'])equal(water.baseline[k],water[v][k],`water ${W}x${H}/${tick}/${v}/${k}`);
    }
    records.push({mode:'water',W,H,ticks:512,...await digest({D:water.baseline.D,C:water.baseline.C,out:water.baseline.out})});
    const z=Uint8Array.from(F),fullBarrier=Uint8Array.from({length:N},(_,i)=>i%13===4?1:0),aboveBarrier=Uint8Array.from({length:N},(_,i)=>i%17===5?1:0);
    const grid={W,H,z,F,fullBarrier,aboveBarrier,contaminationBarrier:fullBarrier};
    const soil=Object.fromEntries(weatherVariants.map(v=>[v,new api[v].GameSoil(grid,new Float32Array(N),new Float32Array(N))]));
    const evap=Object.fromEntries(weatherVariants.map(v=>[v,new Float64Array(N)]));
    for(let tick=0;tick<512;tick++){
      // Identical scripted inputs: stable masks, local flips, wholesale drying, and badwater.
      const era=Math.floor(tick/41),D=Float64Array.from({length:N},(_,i)=>(i+era)%7===0||era===5?0:(i%4+1)/3);
      const C=Float64Array.from({length:N},(_,i)=>D[i]&&((i+era)%11===0)?((era%3)+1)/3:0);
      for(const v of weatherVariants)soil[v].step(D,C,evap[v],tick%97===0);
      for(const v of weatherVariants.slice(1)){
        for(const k of ['M','level','cand','sat','wn','pWet','pSurf','pDepth','pC','pSat','pGive','pBad'])equal(soil.baseline[k],soil[v][k],`soil ${W}x${H}/${tick}/${v}/${k}`);
        equal(evap.baseline,evap[v],`evap ${W}x${H}/${tick}/${v}`);
      }
    }
    records.push({mode:'soil',W,H,ticks:512,...await digest({M:soil.baseline.M,SC:soil.baseline.level,cand:soil.baseline.cand,sat:soil.baseline.sat,evaporation:evap.baseline})});
  }
  return {buildId,passed:true,records};
}
