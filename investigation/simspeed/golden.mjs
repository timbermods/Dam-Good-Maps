import {snapshot,compare,equal,digest,variants} from './suite.mjs';
export async function golden(api,fixtures) {
  const records=[];
  for(const f of fixtures) {
    const m={W:f.W,H:f.H,floor:Float64Array.from(f.floor),dam:f.dam?Float64Array.from(f.dam):null,emitters:f.emitters};
    const sims=Object.fromEntries(variants.map(v=>[v,new api[v].WaterSim(m)]));
    let done=0;
    for(const checkpoint of f.snapshots) {
      for(const v of variants)sims[v].run(checkpoint.ticks-done);
      done=checkpoint.ticks;
      const ref=snapshot(sims.baseline);
      for(const v of variants.slice(1))compare(ref,snapshot(sims[v]),f.name+'/'+v);
      for(const [actual,expected] of [[ref.D,checkpoint.depth],[ref.C,checkpoint.contamination]]) {
        for(let i=0;i<actual.length;i++)if(Math.abs(actual[i]-expected[i])>=1e-6)throw Error(f.name+': Python reference');
      }
      records.push({name:f.name,...await digest(ref)});
    }
    const baseline=api.baseline.canonicalSettle(m);
    for(const v of variants.slice(1)) {
      compare(baseline,api[v].canonicalSettle(m),f.name+'/'+v+'/canonical');
      equal(api.baseline.droughtStorage(m,baseline.depth,9),api[v].droughtStorage(m,baseline.depth,9),f.name+'/'+v+'/analytic');
    }
  }
  for(const [W,H] of [[1,1],[1,9],[9,1],[2,2],[3,7],[13,11]]) {
    const N=W*H, floor=Float64Array.from({length:N},(_,i)=>(i*13+7)%5);
    const dam=Float64Array.from({length:N},(_,i)=>i%7===0?.65:-1);
    const initial={depth:Float64Array.from({length:N},(_,i)=>i%3===0?0:.01+(i%9)/3),contamination:Float64Array.from({length:N},(_,i)=>(i%4)/3)};
    const sims=Object.fromEntries(variants.map(v=>[v,new api[v].WaterSim({W,H,floor,dam,emitters:[
      {cells:[0],strength:2,contamination:0,depthLimit:{anchor:0,off:.8,on:.72}},
      {cells:[N-1],strength:1,contamination:1},
    ]},initial)]));
    for(let t=0;t<256;t++) {
      for(const v of variants) {
        sims[v].emitters[1].contamination=t<128?1:0;
        sims[v].run(1,t<64?1:t<128?0:t<192?.35:1);
      }
      const ref=snapshot(sims.baseline);
      for(const v of variants.slice(1))compare(ref,snapshot(sims[v]),W+'x'+H+'/'+v+'/'+t);
      if([0,63,127,191,255].includes(t))records.push({name:W+'x'+H,...await digest(ref)});
    }
  }
  return records;
}
