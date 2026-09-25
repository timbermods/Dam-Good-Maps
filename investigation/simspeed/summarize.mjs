import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {variants,themes} from './suite.mjs';
const build=JSON.parse(readFileSync('results/build.json','utf8'));
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const scan=dir=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>read(dir+'/'+f)).filter(r=>r.buildId===build.id):[];
const maps=scan('results/node/maps'),bench=scan('results/node/bench');
const stageSets=bench.filter(b=>b.stages.length===21&&b.stages.every(s=>s.timingMethod==='batched-500ms-v3')).length;
const profiles=scan('results/profiles').filter(p=>p.method==='instrumented-method-wall-v2'||(!p.id.endsWith('-drought')&&p.method==='instrumented-method-wall-v1'));
const missingMaps=[],missingBench=[],missingProfiles=[];
for(const size of [96,128,256])for(const theme of themes){
  if(!bench.some(r=>r.theme===theme&&r.size===size))missingBench.push(theme+'-'+size);
  for(const stage of ['canonical','preview','drought','cycle-sample'])if(!profiles.some(r=>r.id===theme+'-'+size+'-'+stage))missingProfiles.push(theme+'-'+size+'-'+stage);
  for(let seed=1;seed<=(size===128?30:3);seed++)if(!maps.some(r=>r.theme===theme&&r.size===size&&r.seed===seed))missingMaps.push(theme+'-'+size+'-'+seed);
}
for(const m of maps)for(const v of variants)if(m.hashes[v]!==m.hashes.baseline)throw Error('hash mismatch '+m.theme+'/'+m.seed+'/'+v);
for(const b of bench){
  const days=b.cycle.reduce((s,c)=>s+c.phases.reduce((n,p)=>n+p.days,0),0);
  const checkpoints=b.cycle.reduce((s,c)=>s+c.checkpoints.length,0);
  if(b.cycle.length!==6||days!==73||checkpoints!==94)throw Error('incomplete cycle evidence '+b.theme+'/'+b.size);
  for(const c of b.cycle)for(const v of variants)if(!Number.isFinite(c.times[v]))throw Error('missing cycle measurement '+v);
}
if(existsSync('results/reference-sha256.json')){
  const ref=read('results/reference-sha256.json');
  const records=ref.records.map(r=>{
    const m=maps.find(m=>m.theme+'-'+m.size+'-'+m.seed===r.id);
    if(m&&m.hashes.baseline!==r.sha256)throw Error('Historical hash mismatch: '+r.id);
    return {...r,status:m?'matched':'pending'};
  });
  writeFileSync('results/historical-parity.json',JSON.stringify({source:ref.source,buildId:build.id,records},null,2)+'\n');
}
const median=a=>{a=a.filter(x=>Number.isFinite(x)).sort((a,b)=>a-b);const m=Math.floor(a.length/2);return a.length?(a.length%2?a[m]:(a[m-1]+a[m])/2):null;};
const med=(b,v,key)=>median(b.stages.filter(r=>r.variant===v).map(r=>r[key]));
const total=(b,v,key='times')=>b.cycle.reduce((s,c)=>s+c[key][v],0);
const ratio=(a,b)=>a>0&&b>0?a/b:null;
const ratios={};
for(const v of variants.slice(1)){
  ratios[v]={
    canonicalWall:median(bench.map(b=>ratio(med(b,'baseline','canonicalMs'),med(b,v,'canonicalMs')))),
    canonicalCpu:median(bench.map(b=>ratio(med(b,'baseline','canonicalCpuMs'),med(b,v,'canonicalCpuMs')))),
    previewWall:median(bench.map(b=>ratio(med(b,'baseline','previewMs'),med(b,v,'previewMs')))),
    previewCpu:median(bench.map(b=>ratio(med(b,'baseline','previewCpuMs'),med(b,v,'previewCpuMs')))),
    droughtWall:median(bench.map(b=>ratio(med(b,'baseline','droughtMs'),med(b,v,'droughtMs')))),
    droughtCpu:median(bench.map(b=>ratio(med(b,'baseline','droughtCpuMs'),med(b,v,'droughtCpuMs')))),
    cycleWall:median(bench.map(b=>ratio(total(b,'baseline'),total(b,v)))),
    cycleCpu:median(bench.map(b=>ratio(total(b,'baseline','cpuTimes'),total(b,v,'cpuTimes')))),
    generationWall:median(maps.map(m=>ratio(m.timings.baseline,m.timings[v]))),
    generationCpu:median(maps.map(m=>ratio(m.cpuTimings?.baseline,m.cpuTimings?.[v]))),
  };
}
const browserMaps=scan('results/chromium/maps'),browserBench=scan('results/chromium/bench');
const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Node/Chromium mismatch: '+label);};
for(const r of browserMaps){
  const n=maps.find(n=>n.theme===r.theme&&n.size===r.size&&n.seed===r.seed);
  if(!n)throw Error('Unexpected Chromium map');
  for(const k of ['hashes','checkpoints','drought','accepted'])same(r[k],n[k],r.theme+'/'+r.size+'/'+r.seed+'/'+k);
}
for(const r of browserBench){
  const n=bench.find(n=>n.theme===r.theme&&n.size===r.size&&n.seed===r.seed);
  if(!n||r.cycle.length!==6||r.stages.length!==21)throw Error('Incomplete Chromium benchmark');
  for(let i=0;i<6;i++){
    same(r.cycle[i].phases,n.cycle[i].phases,'cycle phases');
    same(r.cycle[i].checkpoints,n.cycle[i].checkpoints,r.theme+'/'+r.size+'/cycle/'+i);
    for(const v of variants)if(!Number.isFinite(r.cycle[i].times[v]))throw Error('Missing Chromium cycle time');
  }
}
const browserGolden=existsSync('results/chromium/golden.json');
if(browserGolden)same(read('results/chromium/golden.json'),read('results/node/golden.json'),'golden');
const chromium={status:browserMaps.length===216&&browserBench.length===18&&browserGolden?'passed':'incomplete',
  maps:browserMaps.length,benchmarks:browserBench.length,golden:browserGolden};
const chromiumRatios=Object.fromEntries(variants.slice(1).map(v=>[v,{
  canonicalWall:median(browserBench.map(b=>ratio(med(b,'baseline','canonicalMs'),med(b,v,'canonicalMs')))),
  previewWall:median(browserBench.map(b=>ratio(med(b,'baseline','previewMs'),med(b,v,'previewMs')))),
  droughtWall:median(browserBench.map(b=>ratio(med(b,'baseline','droughtMs'),med(b,v,'droughtMs')))),
  cycleWall:median(browserBench.map(b=>ratio(total(b,'baseline'),total(b,v)))),
  generationWall:median(browserMaps.map(m=>ratio(m.timings.baseline,m.timings[v])))
}]));
const bySize=Object.fromEntries([96,128,256].map(size=>{
  const rows=bench.filter(b=>b.size===size);
  return [size,{cases:rows.length,
    canonicalCpu:median(rows.map(b=>ratio(med(b,'baseline','canonicalCpuMs'),med(b,'combined','canonicalCpuMs')))),
    previewCpu:median(rows.map(b=>ratio(med(b,'baseline','previewCpuMs'),med(b,'combined','previewCpuMs')))),
    cycleCpu:median(rows.map(b=>ratio(total(b,'baseline','cpuTimes'),total(b,'combined','cpuTimes')))),
    baselineCycleCpuMs:median(rows.map(b=>total(b,'baseline','cpuTimes'))),
    combinedCycleCpuMs:median(rows.map(b=>total(b,'combined','cpuTimes')))}];
}));
const nodeComplete=!missingMaps.length&&!missingBench.length&&!missingProfiles.length&&stageSets===18;
const exactReference=existsSync('results/exact-summary.json')?read('results/exact-summary.json'):null;
const exactComplete=exactReference?.status==='complete'&&exactReference.buildId===read('results/exact-build.json').id;
const m9Reference=existsSync('results/m9-summary.json')?read('results/m9-summary.json'):null;
const m9Complete=m9Reference?.status==='complete'&&m9Reference.buildId===read('results/m9-build.json').id;
const acceptance={node:nodeComplete?'complete':'incomplete',chromium:chromium.status,exactCycles:exactComplete?'complete':'incomplete',m9Pipeline:m9Complete?'complete':'incomplete',
  overall:nodeComplete&&chromium.status==='passed'&&exactComplete&&m9Complete?'complete':'incomplete'};
const summary={buildId:build.id,maps:maps.length,expectedMaps:216,benchmarks:bench.length,expectedBenchmarks:18,
  acceptance,
  stageSets,expectedStageSets:18,
  profiles:profiles.length,expectedProfiles:72,missingProfiles,
  exportedFiles:maps.length*variants.length,variantFileComparisons:maps.length*(variants.length-1),
  canonicalAndWarmCheckpoints:maps.reduce((s,m)=>s+m.checkpoints.length,0),
  analyticArrays:maps.reduce((s,m)=>s+m.drought.length,0),
  cycleCheckpoints:bench.reduce((s,b)=>s+b.cycle.reduce((n,c)=>n+c.checkpoints.length,0),0),
  simulatedCycleDays:bench.length*variants.length*73,
  missingMaps,missingBench,ratios,bySize,chromium,chromiumRatios,exactReference,m9Reference};
writeFileSync('results/summary.json',JSON.stringify(summary,null,2)+'\n');
const x=v=>v===null?'pending':v.toFixed(2)+'×',ms=v=>v===null?'pending':v.toFixed(1),sec=v=>v===null?'pending':(v/1000).toFixed(2);
let md='# Measured results\n\n'+(missingMaps.length||missingBench.length||missingProfiles.length||stageSets!==18?'INCOMPLETE: ':'')+maps.length+'/216 maps; '+bench.length+'/18 cycle workload sets; '+stageSets+'/18 batched stage sets; '+profiles.length+'/72 profiles. See [machine information](results/node/environment.json) and [complete summary](results/summary.json).\n\n';
md+='**Cross-runtime acceptance: '+acceptance.overall+'. Chromium: '+chromium.status+'.**\n\n';
md+='Supplemental exact-cycle reference: **'+acceptance.exactCycles+'**. Its independent water/soil code is profiled separately in [EXACT-CYCLES.md](EXACT-CYCLES.md); the original-model cycle speedups below do not apply to it.\n\n';
md+='M9 whole-pipeline supplement: **'+acceptance.m9Pipeline+'**, reported in [M9-PIPELINE.md](M9-PIPELINE.md). Stacked-layer applicability is assessed separately in [STACKED-LAYERS.md](STACKED-LAYERS.md).\n\n';
md+='Ratios are medians of paired baseline/variant measurements across maps (greater than 1 is faster). Thread CPU time is the primary computational comparison. The matrix used up to three workers, running variants sequentially within a map. The busy host caused large scheduling gaps even in serial probes: wall ratios are retained observations, not reliable idle-machine speedups or budget evidence. Generation checks are descriptive. A dash marks unchanged workload code; its raw measurements are retained as controls. The water-only prototypes do not change analytic drought, which uses separate flood and saturation functions. Small differences require replication.\n\n';
md+='| Prototype | Canonical CPU / wall | Preview CPU / wall | Drought CPU / wall | 73-day cycle CPU / wall | Generation CPU / wall |\n|---|---:|---:|---:|---:|---:|\n';
for(const v of variants.slice(1)){
  const r=ratios[v],water=v!=='drought',dry=['drought','combined'].includes(v);
  md+='| '+v+' | '+(water?x(r.canonicalCpu)+' / '+x(r.canonicalWall):'—')+' | '+(water?x(r.previewCpu)+' / '+x(r.previewWall):'—')+' | '+(dry?x(r.droughtCpu)+' / '+x(r.droughtWall):'—')+' | '+(water?x(r.cycleCpu)+' / '+x(r.cycleWall):'—')+' | '+x(r.generationCpu)+' / '+x(r.generationWall)+' |\n';
}
md+='\n## Every theme and size: thread CPU time\n\nShort stages are medians of three repetitions; cycles are one complete six-probe run per variant. Canonical includes prefill; preview includes warm-start preparation. CPU time excludes descheduling and background V8 threads, so it is not a user-visible latency promise.\n\n';
md+='| Theme | Size | Canonical baseline → combined CPU ms | Preview baseline → combined CPU ms | Drought baseline → combined CPU ms | 73 days baseline → combined CPU s |\n|---|---:|---:|---:|---:|---:|\n';
for(const b of bench.sort((a,b)=>a.size-b.size||themes.indexOf(a.theme)-themes.indexOf(b.theme))){
  md+='| '+b.theme+' | '+b.size+'² | '+ms(med(b,'baseline','canonicalCpuMs'))+' → '+ms(med(b,'combined','canonicalCpuMs'))+' | '+ms(med(b,'baseline','previewCpuMs'))+' → '+ms(med(b,'combined','previewCpuMs'))+' | '+ms(med(b,'baseline','droughtCpuMs'))+' → '+ms(med(b,'combined','droughtCpuMs'))+' | '+sec(total(b,'baseline','cpuTimes'))+' → '+sec(total(b,'combined','cpuTimes'))+' |\n';
}
md+='\n## Observed wall time under contention\n\nThese observations do not establish budget compliance. 96² has no stated canonical budget; PLAN targets 600 ms at 128² and 3,000 ms at 256². The editor water-preview target is 2,000 ms after a local edit at 256². This probe measures that call, including warm-start preparation, but excludes the rest of the editor interaction.\n\n';
md+='| Theme | Size | Canonical baseline → combined ms | Preview baseline → combined ms | Drought baseline → combined ms | 73 days baseline → combined s |\n|---|---:|---:|---:|---:|---:|\n';
for(const b of bench.sort((a,b)=>a.size-b.size||themes.indexOf(a.theme)-themes.indexOf(b.theme))){
  md+='| '+b.theme+' | '+b.size+'² | '+ms(med(b,'baseline','canonicalMs'))+' → '+ms(med(b,'combined','canonicalMs'))+' | '+ms(med(b,'baseline','previewMs'))+' → '+ms(med(b,'combined','previewMs'))+' | '+ms(med(b,'baseline','droughtMs'))+' → '+ms(med(b,'combined','droughtMs'))+' | '+sec(total(b,'baseline'))+' → '+sec(total(b,'combined'))+' |\n';
}
md+='\n## Chromium elapsed-time measurements\n\n'+browserMaps.length+'/216 map cases and '+browserBench.length+'/18 stage/cycle cases; see [browser environment](results/chromium/environment.json). Three independent Web Workers run the same suite. These are elapsed-time ratios on a shared host, without thread CPU counters; they are not idle-machine latency guarantees. A dash identifies unchanged workload code.\n\n| Prototype | Canonical | Preview | Drought | 73-day cycle | Generation |\n|---|---:|---:|---:|---:|---:|\n';
for(const v of variants.slice(1)){
  const r=chromiumRatios[v],water=v!=='drought',dry=['drought','combined'].includes(v);
  md+='| '+v+' | '+(water?x(r.canonicalWall):'—')+' | '+(water?x(r.previewWall):'—')+' | '+(dry?x(r.droughtWall):'—')+' | '+(water?x(r.cycleWall):'—')+' | '+x(r.generationWall)+' |\n';
}
md+='\n| Theme | Size | Canonical baseline → combined ms | Preview baseline → combined ms | Drought baseline → combined ms | 73 days baseline → combined s |\n|---|---:|---:|---:|---:|---:|\n';
for(const b of browserBench.sort((a,b)=>a.size-b.size||themes.indexOf(a.theme)-themes.indexOf(b.theme)))
  md+='| '+b.theme+' | '+b.size+'² | '+ms(med(b,'baseline','canonicalMs'))+' → '+ms(med(b,'combined','canonicalMs'))+' | '+ms(med(b,'baseline','previewMs'))+' → '+ms(med(b,'combined','previewMs'))+' | '+ms(med(b,'baseline','droughtMs'))+' → '+ms(med(b,'combined','droughtMs'))+' | '+sec(total(b,'baseline'))+' → '+sec(total(b,'combined'))+' |\n';
md+='\n## Workload profiles\n\nEach profile reports method call counts, wall-clock self/inclusive time and total workload CPU time. The table names the largest self-time components; uninstrumented work is explicitly a remainder. Timers, wrapper dispatch and host scheduling affect these values, so they are attribution diagnostics, not speedup measurements. The cycle profile covers the first day of each of six probes; the uninstrumented benchmark covers all 73 days.\n\n| Workload | Largest self-time components |\n|---|---|\n';
for(const p of profiles.sort((a,b)=>a.id.localeCompare(b.id))){
  const a=p.functions.filter(x=>!['post','dispatch','profile','(anonymous)','(root)'].includes(x.name)).slice(0,3);
  md+='| '+p.id+' | '+a.map(x=>x.name+' '+(x.selfUs/1000).toFixed(0)+' ms').join('; ')+' |\n';
}
md+='\n## Proof coverage\n\n'+summary.exportedFiles+' complete nonempty exports were generated, giving '+summary.variantFileComparisons+' exact byte comparisons against baseline. There are '+summary.canonicalAndWarmCheckpoints+' canonical/warm snapshots, '+summary.analyticArrays+' analytic drought arrays and '+summary.cycleCheckpoints+' cycle snapshots per implementation. Each snapshot is checked across all variants before a result is saved. Full array bytes are compared in Node; checkpoint SHA-256s and per-seed file hashes are retained.\n\n';
md+='The 12 Python golden fixtures and six boundary grids are recorded in [golden.json](results/node/golden.json). [Type checking](results/typecheck.json) covers copied TypeScript modules. [build.json](results/build.json) fingerprints every bundle and input module. '+(chromium.status==='passed'?'Chromium independently generated the same 1,512 exports and passed the same byte comparisons and checkpoint suite; all 216 file-hash sets, 3,038 canonical/warm snapshots, 864 analytic arrays, 1,692 cycle snapshots and golden digests match Node exactly.':'The browser acceptance gate is incomplete; only saved Chromium records have passed.')+'\n';
writeFileSync('RESULTS.md',md);
console.log(JSON.stringify({maps:maps.length,benchmarks:bench.length,missingMaps:missingMaps.length,missingBench:missingBench.length,ratios},null,2));
if(missingMaps.length||missingBench.length||missingProfiles.length||stageSets!==18)process.exitCode=1;
