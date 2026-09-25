import {equal,compare,sha,digest} from './suite.mjs';
const cpu=()=>globalThis.simCpuUsage?.()??null;
const elapsed=c=>{if(!c)return null;const n=cpu();return(n.user-c.user+n.system-c.system)/1000;};
export async function loadM9(){return {api:{baseline:await import('./.work/m9/baseline.mjs'),combined:await import('./.work/m9/combined.mjs')},buildId:(await import('./.work/m9/version.mjs')).buildId};}
function same(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('M9 '+label);}
function parity(a,b){
  equal(a.bytes,b.bytes,'M9 file');
  for(const k of ['water','contamination','moisture','soilContamination','heights'])equal(a.built[k],b.built[k],'M9 '+k);
  compare(a.built.settle,b.built.settle,'M9 settle');
  for(const k of ['spec','features','genome','report','analysis','storage','attempts','failures'])same(a[k],b[k],k);
  same({...a.info,ms:null},{...b.info,ms:null},'info without timings');
}
export async function m9Case({api,buildId},{theme,size,seed}){
  // Whole accepted candidate, including all retries, every build/settle,
  // resource planning, validation, storage/dam-wall checks and compressed export.
  const generate=v=>api[v].generateProto(theme,seed,size,'normal');
  const warm={baseline:generate('baseline'),combined:generate('combined')};parity(warm.baseline,warm.combined);
  if(!warm.baseline.bytes.length)throw Error('M9 candidate failed '+theme+'/'+size+'/'+seed);
  const expected=await sha(warm.baseline.bytes),rows=[];
  let reference=warm.baseline;
  for(let trial=0;trial<3;trial++){
    const results={};
    for(const v of trial%2?['combined','baseline']:['baseline','combined']){
      const c=cpu(),t=performance.now(),r=generate(v),wallMs=performance.now()-t,cpuMs=elapsed(c);
      results[v]=r;parity(reference,r);
      if(!r.bytes.length||await sha(r.bytes)!==expected)throw Error('M9 output drift');
      rows.push({variant:v,trial,wallMs,cpuMs,attempts:r.attempts,lastAttemptStages:r.info.ms,stage:r.info.stage});
    }
    parity(results.baseline,results.combined);reference=results.baseline;
  }
  return {buildId,theme,size,seed,prototypeVersion:api.baseline.PROTO_VERSION,difficulty:'normal',variety:70,maxAttempts:12,
    sha256:expected,attempts:reference.attempts,accepted:reference.spec.accepted,passed:true,bytes:reference.bytes.length,rows,
    arrays:await digest({water:reference.built.water,contamination:reference.built.contamination,moisture:reference.built.moisture,
      soil:reference.built.soilContamination,heights:reference.built.heights,...reference.built.settle})};
}
