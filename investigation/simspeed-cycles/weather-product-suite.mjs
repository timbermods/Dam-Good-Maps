// Separate product experiment: a continuous Normal game, not the six reset probes.
import {compare,equal,digest,sha,themes} from './suite.mjs';
import {weatherSnapshot} from './weather-suite.mjs';
export const productJobs=[128,256].flatMap(size=>themes.map(theme=>({theme,size,seed:1})));
const cpu=()=>globalThis.simCpuUsage?.()??null;
const used=c=>{if(!c)return null;const n=cpu();return(n.user-c.user+n.system-c.system)/1000;};
// JSON's finite nonzero numbers round-trip exactly; tag the exceptional encodings.
const metadata=value=>JSON.stringify(value,(_,v)=>typeof v==='number'&&(Object.is(v,-0)||!Number.isFinite(v))?{$ieee64:Object.is(v,-0)?'-0':String(v)}:v);
function cacheFrame(s){
  const arrays=[s.D,s.C,s.soil_M,s.soil_level],size=arrays.reduce((n,a)=>n+a.byteLength,0),bytes=new Uint8Array(size);
  let p=0;for(const a of arrays){bytes.set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength),p);p+=a.byteLength;}
  return {bytes,metadata:metadata({row:s.row,plants:s.plants,clock:s.clock,metrics:s.metrics})};
}
async function yieldProbe(){
  const channel=new MessageChannel(),samples=[];
  let resolveNext;channel.port1.onmessage=()=>resolveNext();
  for(let i=0;i<201;i++){const t=performance.now();await new Promise(resolve=>{resolveNext=resolve;channel.port2.postMessage(0);});if(i)samples.push(performance.now()-t);}
  channel.port1.close();channel.port2.close();samples.sort((a,b)=>a-b);
  return {iterations:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],method:'MessageChannel self-message in the executing worker; no simulation'};
}
export async function productCase({api,buildId},job){
  const generated={},results={},variants=['baseline','combined'];
  for(const v of variants){const a=api[v],g=a.generate(a.makeSpec({theme:job.theme,seed:job.seed,size:{x:job.size,y:job.size}}));if(!g.report.passed||!g.bytes.length)throw Error('Product map generation failed');generated[v]=g;}
  equal(generated.baseline.bytes,generated.combined.bytes,'product map');
  for(const v of variants){const a=api[v],spec=a.cases(generated[v].built)[4];new a.CycleModel(generated[v].built,spec.start).run(768);}
  const order=themes.indexOf(job.theme)%2?['combined','baseline']:variants;
  for(const v of order){
    const a=api[v],g=generated[v],t=performance.now(),c=cpu();let excludedMs=0,excludedCpu=0;
    const model=new a.CycleModel(g.built,a.journey(1729).start),measure=new a.Measures(model,g.spec.settings.start.rules.waterWithin),snapshots=[],progress=[];
    const spans=a.runStretch(model,73,row=>{
      const metrics=measure.sample(row.day),st=performance.now(),sc=cpu();
      progress.push({row,elapsedTicks:model.elapsedTicks,wallMs:st-t-excludedMs,cpuMs:c?used(c)-excludedCpu:null});
      snapshots.push(weatherSnapshot(model,measure,row,metrics));
      excludedMs+=performance.now()-st;excludedCpu+=used(sc)??0;
    });
    results[v]={spans,progress,snapshots,wallMs:performance.now()-t-excludedMs,cpuMs:c?used(c)-excludedCpu:null};
  }
  const base=results.baseline,opt=results.combined;
  if(JSON.stringify(base.spans)!==JSON.stringify(opt.spans)||base.snapshots.length!==opt.snapshots.length)throw Error('Continuous schedule mismatch');
  for(let i=0;i<base.snapshots.length;i++)compare(base.snapshots[i],opt.snapshots[i],job.theme+'/continuous/'+i);
  const checkpoints=[];for(const s of base.snapshots)checkpoints.push(await digest(s));
  const end=base.snapshots.find(s=>s.row.phase==='drought'&&s.row.cycle===1&&s.row.phaseDay===2);
  if(!end)throw Error('Missing first drought end');
  // In-memory cache serialization/copy cost only: no disk, IndexedDB, messaging or paint claim.
  const cached=cacheFrame(end),copyMs=[];
  for(let repeat=0;repeat<21;repeat++){const t=performance.now(),copied=cached.bytes.slice(),parsed=JSON.parse(cached.metadata);copyMs.push(performance.now()-t);if(copied.length!==cached.bytes.length||!parsed.row)throw Error('Cache copy failed');}
  copyMs.shift();copyMs.sort((a,b)=>a-b);
  return {buildId,...job,passed:true,continuousDays:73,weatherSeed:1729,plantSeed:1729,inputSha256:await sha(generated.baseline.bytes),
    spans:base.spans,checkpoints,order,timings:Object.fromEntries(variants.map(v=>[v,{wallMs:results[v].wallMs,cpuMs:results[v].cpuMs,progress:results[v].progress}])),
    yieldProbe:await yieldProbe(),cache:{kind:'in-memory frame copy plus metadata parse',frameBytes:cached.bytes.length,metadataBytes:new TextEncoder().encode(cached.metadata).length,
      frameSha256:await sha(cached.bytes),metadataSha256:await sha(new TextEncoder().encode(cached.metadata)),medianCopyParseMs:(copyMs[9]+copyMs[10])/2,
      frameCount:base.snapshots.length,uncompressedArrayTimelineBytes:base.snapshots.length*24*job.size*job.size}};
}
