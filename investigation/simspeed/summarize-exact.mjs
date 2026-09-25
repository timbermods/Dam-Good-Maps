import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {themes} from './suite.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),build=read('results/exact-build.json');
const scan=p=>existsSync(p)?readdirSync(p).filter(f=>f.endsWith('.json')).map(f=>read(p+'/'+f)).filter(r=>r.buildId===build.id):[];
const node=scan('results/exact/node'),chrome=scan('results/exact/chromium');
const key=r=>r.theme+'-'+r.size+'-'+r.seed;
for(const r of node){
  if(r.probes.length!==6||r.coreWaterSimCalls!==0||!r.profile)throw Error('Incomplete exact-case '+key(r));
  for(const p of r.probes)if(!Number.isInteger(p.days)||p.days<=0||p.spans.reduce((s,x)=>s+x.days,0)!==p.days||p.checkpoints.at(-1).elapsedTicks!==p.days*768)throw Error('Incomplete exact schedule '+key(r)+'/'+p.id);
  if(r.inputSha256!==read('results/node/maps/'+key(r)+'.json').hashes.baseline)throw Error('Exact input mismatch');
}
for(const r of chrome){
  const n=node.find(n=>key(n)===key(r));if(!n)throw Error('Missing Node exact-case');
  for(const k of ['inputSha256','coreWaterSimCalls'])if(r[k]!==n[k])throw Error('Exact cross-runtime '+k);
  if(r.probes.length!==6)throw Error('Missing exact probe');
  for(let i=0;i<6;i++)for(const k of ['id','days','spans','checkpoints'])if(JSON.stringify(r.probes[i][k])!==JSON.stringify(n.probes[i][k]))throw Error('Exact cross-runtime '+key(r)+'/'+k);
}
const missingNode=[],missingChrome=[];
for(const size of [96,128,256])for(const theme of themes){const id=theme+'-'+size+'-1';if(!node.some(r=>key(r)===id))missingNode.push(id);if(!chrome.some(r=>key(r)===id))missingChrome.push(id);}
const total=(r,k)=>r.probes.reduce((n,p)=>n+p[k],0),median=a=>{a.sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null;};
const bySize=Object.fromEntries([96,128,256].map(size=>[size,{nodeMedianCpuMs:median(node.filter(r=>r.size===size).map(r=>total(r,'cpuMs'))),
  chromiumMedianWallMs:median(chrome.filter(r=>r.size===size).map(r=>total(r,'wallMs')))}]));
const profileShares=Object.fromEntries(['GameWater.tick','GameSoil.step','CycleModel.plantsTick'].map(name=>[name,median(node.map(r=>r.profile.functions.find(f=>f.name===name).inclusiveMs/r.profile.wallMs))]));
const summary={buildId:build.id,reference:build.reference,nodeCases:node.length,chromiumCases:chrome.length,expectedCases:18,
  missingNode,missingChrome,status:!missingNode.length&&!missingChrome.length?'complete':'incomplete',
  checkpoints:node.reduce((s,r)=>s+r.probes.reduce((n,p)=>n+p.checkpoints.length,0),0),simulatedDaysPerRuntime:node.reduce((s,r)=>s+r.probes.reduce((n,p)=>n+p.days,0),0),
  profiledDays:node.length*6,coreWaterSimCalls:0,bySize,profileShares};
writeFileSync('results/exact-summary.json',JSON.stringify(summary,null,2)+'\n');
let md='# Late-arriving exact cycle reference\n\n'+summary.nodeCases+'/18 Node cases and '+summary.chromiumCases+'/18 Chromium cases; cross-runtime status: **'+summary.status+'**.\n\n'+
  'Reference `investigation/cycles-exact` at `'+build.reference+'` appeared during the investigation. Its six copied modules preserve all expressions; only relative imports and line endings change. They have a separate [bundle fingerprint](results/exact-build.json), so the original cycle proof is not replaced.\n\n'+
  '**The core prototypes do not change this model\'s weather stepping work.** It uses its own `GameWater` and `GameSoil`, including a precomputed neighbour table and dirty soil dependencies. After generation, the harness replaces core `WaterSim.run`, `substep` and `computeWn` with throwing guards. Every weather case completes without calling them. The five prototypes alter only core water/drought code; identical generated inputs feed an unchanged exact-cycle transition function. No measured variant speedup is assigned to this unchanged hot path. Generation and canonical initialization can still benefit.\n\n'+
  'The new reference intentionally has different contamination, soil, calendar and loading rules from the first model. This study does not compare the two models for byte equality, switch the old model to those rules, or port the optimizations into GameWater. Such a port requires its own arithmetic proof and benchmarks. “Exact” identifies the branch and its rules; this is parity against that reference, not validation against a running game. No game was launched.\n\n'+
  'Each case executes the reference\'s six probes and exact `runStretch` callback schedule. They total 73 days except Islands 256²: its longer source ramp makes the lead-in two days, giving 77 days. The schedule is preserved, not shortened to match the old model. Generation must match the formal core baseline export hash. Every daily/phase-boundary snapshot retains raw-array SHA-256 for depth, contamination, previous depth, momentum, both evaporation buffers, moisture, soil contamination, candidates, saturation and first-event arrays, plus plant/source state, clock and metrics. Node and Chromium records must match exactly. The original core-variant proof separately checks all seven implementations; no new exact-cycle optimization is claimed here.\n\n'+
  'Timings include construction and Measures calls. Snapshot copies and digest calculation are excluded. Node uses three workers and thread CPU accounting; Chrome uses three Web Workers and elapsed time. These supplemental runs overlap the original Chromium matrix on the shared host. They are diagnostic costs, not quiet-host budget measurements or controlled old/new model ratios. Separate wrapped profiles run one day from each probe (six days per case), after the uninstrumented full run.\n\n'+
  '| Theme | Size | Days | Node CPU (s) | Node wall (s) | Chromium wall (s) |\n|---|---:|---:|---:|---:|---:|\n';
const sec=n=>n===undefined?'pending':(n/1000).toFixed(2);
for(const n of node.sort((a,b)=>a.size-b.size||themes.indexOf(a.theme)-themes.indexOf(b.theme))){const c=chrome.find(c=>key(c)===key(n));md+='| '+n.theme+' | '+n.size+'² | '+total(n,'days')+' | '+sec(total(n,'cpuMs'))+' | '+sec(total(n,'wallMs'))+' | '+sec(c?total(c,'wallMs'):undefined)+' |\n';}
md+='\n## Diagnostic profiles\n\nInstrumented self times; wrappers and host scheduling affect these figures. Median inclusive shares are '+Object.entries(profileShares).map(([name,share])=>name+' '+(share*100).toFixed(1)+'%').join(', ')+'. These are diagnostic elapsed-time shares, not CPU shares.\n\n| Case | Largest self-time components |\n|---|---|\n';
for(const n of node)md+='| '+key(n)+' | '+n.profile.functions.slice(0,3).map(f=>f.name+' '+f.selfMs.toFixed(0)+' ms').join('; ')+' |\n';
md+='\n## Reproduction\n\nAfter completing the main Node map proof, run from this folder:\n\n```sh\nnode bundle-exact.mjs\nnode exact-bench.mjs\nnode browser-server.mjs --exact\n# Open its loopback URL in Chromium; wait for PASSED, then stop the server.\nnode summarize-exact.mjs\n```\n';
writeFileSync('EXACT-CYCLES.md',md);console.log(JSON.stringify(summary,null,2));
if(missingNode.length)process.exitCode=1;
