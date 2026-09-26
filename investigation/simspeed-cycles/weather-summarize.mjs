import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {weatherJobs,weatherVariants,themes} from './weather-suite.mjs';
import {productJobs} from './weather-product-suite.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),build=read('results/weather/build.json');
const scan=dir=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>read(dir+'/'+f)):[];
const rows=runtime=>scan('results/weather/'+runtime).filter(r=>r.buildId===build.id);
const node=rows('node'),chrome=rows('chromium'),id=r=>r.theme+'-'+r.size+'-'+r.seed;
for(const records of [node,chrome]){assert.equal(new Set(records.map(id)).size,records.length);for(const r of records)assert(weatherJobs.some(j=>id(j)===id(r)),'Unexpected proof case');}
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null;};
const total=(r,v,field)=>r.probes.reduce((n,p)=>n+p.timings[v][field],0);
for(const r of [...node,...chrome]){
  assert(r.passed&&!r.smokeTicks);assert.deepEqual(r.variants,weatherVariants);assert.equal(r.probes.length,6);
  assert.equal(r.inputSha256,read('../simspeed/results/node/maps/'+id(r)+'.json').hashes.baseline,'Historical generated input');
  for(const p of r.probes){assert(p.checkpoints.length>=p.days+1);assert.equal(p.checkpoints.at(-1).elapsedTicks,p.days*768);
    for(const v of weatherVariants){assert(Number.isFinite(p.timings[v].wallMs)&&p.timings[v].wallMs>0);assert.equal(p.timings[v].progress.length,p.checkpoints.length);if(r.cpuAccounting==='thread')assert(Number.isFinite(p.timings[v].cpuMs)&&p.timings[v].cpuMs>0);}}
}
for(const c of chrome){const n=node.find(n=>id(n)===id(c));assert(n);for(const k of ['inputSha256','variants','weatherSeed','plantSeed'])assert.deepEqual(c[k],n[k]);
  for(let i=0;i<6;i++)for(const k of ['id','days','spans','checkpoints'])assert.deepEqual(c.probes[i][k],n.probes[i][k],id(c)+'/'+k);}
const profiles=scan('results/weather/profiles-full').filter(r=>r.profileBundle===build.bundles.profile);
const missing={node:weatherJobs.filter(j=>!node.some(r=>id(r)===id(j))).map(id),chromium:weatherJobs.filter(j=>!chrome.some(r=>id(r)===id(j))).map(id),
  profiles:[96,128,256].flatMap(size=>themes.map(theme=>({theme,size,seed:1}))).filter(j=>!profiles.some(r=>id(r)===id(j))).map(id)};
let boundaries=false;if(existsSync('results/weather/boundaries-chromium.json')){const n=read('results/weather/boundaries-node.json'),c=read('results/weather/boundaries-chromium.json');assert.deepEqual(c,n);boundaries=n.buildId===build.id&&n.passed;}
const bySize=Object.fromEntries([96,128,256].map(size=>{
  const n=node.filter(r=>r.size===size),c=chrome.filter(r=>r.size===size);
  return [size,{nodeCases:n.length,chromiumCases:c.length,ratios:Object.fromEntries(weatherVariants.slice(1).map(v=>[v,{
    nodeCpu:median(n.map(r=>total(r,'baseline','cpuMs')/total(r,v,'cpuMs'))),chromiumWall:median(c.map(r=>total(r,'baseline','wallMs')/total(r,v,'wallMs')))}])),
    nodeBaselineCpuMs:median(n.map(r=>total(r,'baseline','cpuMs'))),nodeCombinedCpuMs:median(n.map(r=>total(r,'combined','cpuMs'))),
    chromiumBaselineWallMs:median(c.map(r=>total(r,'baseline','wallMs'))),chromiumCombinedWallMs:median(c.map(r=>total(r,'combined','wallMs')))}];
}));
const products=Object.fromEntries(['node','chromium'].map(rt=>[rt,scan('results/weather/product/'+rt).filter(r=>r.buildId===build.id)]));
for(const records of Object.values(products)){
  assert.equal(new Set(records.map(id)).size,records.length);
  for(const r of records){assert(r.passed&&productJobs.some(j=>id(j)===id(r)));assert.equal(r.continuousDays,73);assert.equal(r.checkpoints.at(-1).elapsedTicks,55936);
    assert.equal(r.inputSha256,read('../simspeed/results/node/maps/'+id(r)+'.json').hashes.baseline);
    for(const v of ['baseline','combined']){assert(r.timings[v].wallMs>0);assert.equal(r.timings[v].progress.length,r.checkpoints.length);}
  }
}
for(const c of products.chromium){const n=products.node.find(n=>id(n)===id(c));assert(n);for(const k of ['inputSha256','spans','checkpoints'])assert.deepEqual(c[k],n[k]);for(const k of ['frameBytes','metadataBytes','frameSha256','metadataSha256','frameCount','uncompressedArrayTimelineBytes'])assert.deepEqual(c.cache[k],n.cache[k]);}
const productMissing=Object.fromEntries(['node','chromium'].map(rt=>[rt,productJobs.filter(j=>!products[rt].some(r=>id(r)===id(j))).map(id)]));
const audit=existsSync('results/weather/source-audit.json')?read('results/weather/source-audit.json'):null;
const sourceAudit=!!(audit?.passed&&audit.buildId===build.id);
const smoke=scan('results/weather/smoke').filter(r=>r.buildId===build.id);
const smokePassed=weatherJobs.filter(j=>j.size===96).every(j=>smoke.some(r=>id(r)===id(j)&&r.passed&&r.smokeTicks===160&&r.probes.length===6&&r.probes.every(p=>p.ticks===160)));
const complete=sourceAudit&&smokePassed&&boundaries&&Object.values(missing).every(a=>!a.length)&&Object.values(productMissing).every(a=>!a.length);
const dayHistogram={};for(const r of node){const days=r.probes.reduce((s,p)=>s+p.days,0);dayHistogram[days]=(dayHistogram[days]||0)+1;}
const profilePhases=Object.fromEntries([...new Set(profiles.flatMap(p=>Object.keys(p.phases)))].map(k=>[k,median(profiles.map(p=>(p.phases[k]?.ms??0)/p.wallMs))]));
const profileGroups=profiles.map(p=>{
  const sum=prefix=>Object.entries(p.phases).filter(([k])=>k.startsWith(prefix)).reduce((n,[,v])=>n+v.ms,0);
  return {theme:p.theme,size:p.size,days:p.probes.reduce((n,q)=>n+q.days,0),wallMs:p.wallMs,waterMs:sum('water.'),soilMs:sum('soil.')};
});
const summary={buildId:build.id,reference:build.reference,status:complete?'complete':'incomplete',nodeCases:node.length,chromiumCases:chrome.length,expectedCases:204,
  variants:weatherVariants,boundaries,sourceAudit,smokePassed,smokeCases:smoke.length,fullProfiles:profiles.length,missing,productMissing,dayHistogram,
  checkpointsPerVariant:node.reduce((s,r)=>s+r.probes.reduce((n,p)=>n+p.checkpoints.length,0),0),
  simulatedDaysPerVariant:node.reduce((s,r)=>s+r.probes.reduce((n,p)=>n+p.days,0),0),bySize,profilePhases,profileGroups};
writeFileSync('results/weather/summary.json',JSON.stringify(summary,null,2)+'\n');
writeFileSync('results/weather/map-hashes.csv','theme,size,seed,input_sha256,node_pass,chromium_pass\n'+weatherJobs.map(j=>{const n=node.find(r=>id(r)===id(j)),c=chrome.find(r=>id(r)===id(j));return [j.theme,j.size,j.seed,n?.inputSha256??'',!!n,!!c].join(',');}).join('\n')+'\n');
writeFileSync('results/weather/performance.csv','runtime,theme,size,seed,variant,days,cpu_ms,wall_ms\n'+[['node',node],['chromium',chrome]].flatMap(([rt,rs])=>rs.flatMap(r=>weatherVariants.map(v=>[rt,r.theme,r.size,r.seed,v,r.probes.reduce((s,p)=>s+p.days,0),rt==='node'?total(r,v,'cpuMs'):'',total(r,v,'wallMs')].join(',')))).join('\n')+'\n');
const sec=x=>x==null?'pending':(x/1000).toFixed(2),ratio=x=>x==null?'pending':x.toFixed(2)+'×';
let md='# Exact-weather optimization results\n\nPinned reference: dev `'+build.reference+'`; its weather and core dependency trees are unchanged at the new branch base `652774175c08b46b40c01536ee3d08a83cbe98d6`. **Acceptance: '+summary.status+'** ('+node.length+'/204 Node maps, '+chrome.length+'/204 Chromium maps, '+profiles.length+'/18 full-duration profiles). The continuous-product experiment has '+products.node.length+'/12 Node and '+products.chromium.length+'/12 browser cases.\n\n';
md+='These results concern `GameWater` and `GameSoil`, separate from the earlier core-port investigation. Each map executes all six reference probes, normally 73 days in total. Longer source ramps retain their extra lead-in days. This is not a continuous 73-day game history; that is measured separately in [WEATHER-PRODUCT.md](WEATHER-PRODUCT.md).\n\n';
md+='| Size | Prototype | Node CPU paired speedup | Chromium elapsed paired speedup |\n|---|---|---:|---:|\n';
for(const size of [96,128,256])for(const v of weatherVariants.slice(1)){const r=bySize[size].ratios[v];md+='| '+size+'² | '+v+' | '+ratio(r.nodeCpu)+' | '+ratio(r.chromiumWall)+' |\n';}
md+='\n| Size | Node CPU baseline → combined (s) | Chromium elapsed baseline → combined (s) |\n|---|---:|---:|\n';
for(const size of [96,128,256]){const s=bySize[size];md+='| '+size+'² | '+sec(s.nodeBaselineCpuMs)+' → '+sec(s.nodeCombinedCpuMs)+' | '+sec(s.chromiumBaselineWallMs)+' → '+sec(s.chromiumCombinedWallMs)+' |\n';}
md+='\nRatios are medians of per-map paired ratios; absolute columns are separate medians. Node uses thread CPU time. Chromium has elapsed time only. Independent proof cases run with four workers per runtime and overlap on this shared host; the diagnostic profiler also overlaps. These elapsed values include host scheduling and memory contention and are not idle-machine latency guarantees. All variants generate their own identical input, warm both drought/badtide branches, and rotate order by seed and probe. Constructor and Measures costs are included; proof snapshot copies, comparisons and SHA-256 are excluded. WASM module compilation occurs before timing; model memory allocation is included.\n\n';
md+='Each map/variant has one timed execution per probe; medians aggregate distinct map seeds rather than repeated trials of one input. Snapshot copying is subtracted, but its allocations may induce later garbage collection inside a timed interval. Small ratios near 1.00× need a quiet-host replication before an integration decision.\n\n';
md+='## Every theme and size (seed 1)\n\n| Theme | Size | Days | Node CPU baseline → combined (s) | Chromium elapsed baseline → combined (s) |\n|---|---:|---:|---:|---:|\n';
for(const size of [96,128,256])for(const theme of themes){const n=node.find(r=>r.size===size&&r.theme===theme&&r.seed===1),c=chrome.find(r=>r.size===size&&r.theme===theme&&r.seed===1);md+='| '+theme+' | '+size+'² | '+(n?n.probes.reduce((s,p)=>s+p.days,0):'pending')+' | '+sec(n?total(n,'baseline','cpuMs'):null)+' → '+sec(n?total(n,'combined','cpuMs'):null)+' | '+sec(c?total(c,'baseline','wallMs'):null)+' → '+sec(c?total(c,'combined','wallMs'):null)+' |\n';}
md+='\n## Full-duration diagnostic profiles\n\nProfiles run every tick of all six probes for each theme/size. Per-pass instrumentation preserves expressions but changes timing and JIT behaviour. Shares below are medians of instrumented elapsed time, not CPU attribution or speedup measurements. Initial six-day profiles are retained separately.\n\n| Phase | Median share |\n|---|---:|\n';
for(const [phase,share] of Object.entries(profilePhases).sort((a,b)=>b[1]-a[1]))md+='| '+phase+' | '+(100*share).toFixed(1)+'% |\n';
md+='\n| Theme | Size | Days | Instrumented total (s) | Water passes (s / share) | Soil passes (s / share) |\n|---|---:|---:|---:|---:|---:|\n';
for(const size of [96,128,256])for(const theme of themes){const p=profileGroups.find(p=>p.theme===theme&&p.size===size);if(p)md+='| '+theme+' | '+size+'² | '+p.days+' | '+sec(p.wallMs)+' | '+sec(p.waterMs)+' / '+(100*p.waterMs/p.wallMs).toFixed(1)+'% | '+sec(p.soilMs)+' / '+(100*p.soilMs/p.wallMs).toFixed(1)+'% |\n';}
md+='\nThese are the sums of the named passes inside each method; small driver/dispatch gaps remain outside those timers. They do not replace the uninstrumented baseline/candidate timings above. The compact [performance CSV](results/weather/performance.csv) retains every map/variant total, and the [input SHA index](results/weather/map-hashes.csv) identifies every proved export.\n';
md+='\n## Exactness coverage\n\nAll six themes, seeds 1–30 at 128², seeds 1–3 at 256² and seed 1 at 96²: 204 maps × six implementations per runtime. Every generated input export must be nonempty and byte-identical across variants; its SHA also matches the previous independent map proof. All native daily/phase-boundary snapshots are compared byte-for-byte within each runtime, including both water/soil arrays and hidden state that feeds later ticks. Every reference digest and summary agrees across Node and Chromium. Calendar, plant/source state, death times and timers, evaporation buffers, momentum and Measures first-event arrays are included. No tolerance or altered stopping schedule is allowed. See [WEATHER-PROOF.md](WEATHER-PROOF.md) for the local equivalence arguments and limits.\n\n';
md+='Current evidence contains '+summary.checkpointsPerVariant+' checkpoints and '+summary.simulatedDaysPerVariant+' simulated days per implementation in Node. Native total-day distribution by map: `'+JSON.stringify(dayHistogram)+'`. Raw cases and per-probe progress timings are in `results/weather/{node,chromium}/`; source/bundle hashes are in `results/weather/build.json`. The 12 narrow-grid/dependency cases each compare 512 ticks/steps in both runtimes, including signed zero, source transitions and changing wet masks.\n';
writeFileSync('WEATHER-RESULTS.md',md);
console.log(JSON.stringify({status:summary.status,node:node.length,chromium:chrome.length,profiles:profiles.length,productNode:products.node.length,productChromium:products.chromium.length,bySize},null,2));
