import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {themes} from './suite.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),build=read('results/m9-build.json');
const scan=p=>existsSync(p)?readdirSync(p).filter(f=>f.endsWith('.json')).map(f=>read(p+'/'+f)).filter(r=>r.buildId===build.id):[];
const node=scan('results/m9/node'),chrome=scan('results/m9/chromium'),key=r=>r.theme+'-'+r.size+'-'+r.seed;
const median=a=>{a.sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null;};
const med=(r,v,k)=>median(r.rows.filter(x=>x.variant===v).map(x=>x[k]));
for(const r of [...node,...chrome]){
  if(!r.passed||!r.bytes||r.rows.length!==6||r.rows.some(x=>x.attempts!==r.attempts||!Number.isFinite(x.wallMs)))throw Error('Incomplete M9 case '+key(r));
}
for(const r of chrome){const n=node.find(n=>key(n)===key(r));if(!n)throw Error('Missing Node M9 case');
  for(const k of ['sha256','attempts','accepted','passed','bytes','arrays'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error('M9 Node/Chromium mismatch '+key(r)+'/'+k);
}
const missingNode=[],missingChrome=[];
for(const size of [128,256])for(const theme of themes)for(const seed of [1,2]){const id=theme+'-'+size+'-'+seed;if(!node.some(r=>key(r)===id))missingNode.push(id);if(!chrome.some(r=>key(r)===id))missingChrome.push(id);}
const bySize=Object.fromEntries([128,256].map(size=>{
  const n=node.filter(r=>r.size===size),c=chrome.filter(r=>r.size===size),budgetMs=size===256?6000:3000;
  return [size,{budgetMs,nodeCases:n.length,chromiumCases:c.length,
    nodeCpuSpeedup:median(n.map(r=>med(r,'baseline','cpuMs')/med(r,'combined','cpuMs'))),
    nodeWallSpeedup:median(n.map(r=>med(r,'baseline','wallMs')/med(r,'combined','wallMs'))),
    chromiumWallSpeedup:median(c.map(r=>med(r,'baseline','wallMs')/med(r,'combined','wallMs'))),
    nodeBaselineCpuMs:median(n.map(r=>med(r,'baseline','cpuMs'))),nodeCombinedCpuMs:median(n.map(r=>med(r,'combined','cpuMs'))),
    chromiumBaselineWallMs:median(c.map(r=>med(r,'baseline','wallMs'))),chromiumCombinedWallMs:median(c.map(r=>med(r,'combined','wallMs'))),
    chromiumCombinedCaseMedianRangeMs:c.length?[Math.min(...c.map(r=>med(r,'combined','wallMs'))),Math.max(...c.map(r=>med(r,'combined','wallMs')))]:null,
    nodeCombinedCpuOverBudget:n.filter(r=>med(r,'combined','cpuMs')>budgetMs).map(key),
    chromiumCombinedWallOverBudget:c.filter(r=>med(r,'combined','wallMs')>budgetMs).map(key)}];
}));
const summary={buildId:build.id,reference:build.reference,nodeCases:node.length,chromiumCases:chrome.length,expectedCases:24,
  missingNode,missingChrome,status:!missingNode.length&&!missingChrome.length?'complete':'incomplete',bySize};
writeFileSync('results/m9-summary.json',JSON.stringify(summary,null,2)+'\n');
const sec=n=>n===null||n===undefined?'pending':(n/1000).toFixed(2),x=n=>n===null?'pending':n.toFixed(2)+'×';
let md='# M9 whole-pipeline benchmark\n\n'+summary.nodeCases+'/24 Node cases and '+summary.chromiumCases+'/24 Chromium cases; exactness status: **'+summary.status+'**.\n\n'+
  'Reference: `investigation/generative` at `'+build.reference+'`, prototype `0.7.0-proto.2`. The prototype was absent from the observed dev revision `948f395137a6725d4b726864a47e6966d7f2f09a`, so the branch was used. Its production `src/` matches this investigation\'s base. The ten prototype modules and `lib/ridge.ts` are copied under `generative/`, changing only relative imports and line endings. [m9-build.json](results/m9-build.json) fingerprints inputs and both bundles. Only the combined core water/drought prototypes are substituted in the optimized bundle.\n\n'+
  'Coverage: all six themes, seeds 1 and 2, 128² and 256², Normal difficulty, default Variety 70 and maximum 12 attempts. A candidate means one complete `generateProto` call through its successful compressed `.timber`, including failed retries, field/erosion/hydrology, every build/settle, start and hazard planning, objects/resources, validators, storage and dam-wall checks, and writing. No simulation cache is shared between calls. This is not just the first settle or the final attempt. It does not include K=3 selection, UI transport or rendering, which this prototype call does not implement.\n\n'+
  'Each case warms both bundles with a complete generation, then times three calls per variant, alternating order. Node runs serially with thread CPU and elapsed time; Chromium runs one Web Worker with elapsed time. Comparison and hashing happen after the timed calls. Every run must produce nonempty identical file bytes, exact water/contamination/moisture/soil/heights and settle arrays, identical accepted attempt, genome, features, analysis and validation. Only diagnostic `info.ms` clock readings are excluded from object comparison. SHA-256 and array digests must also match across runtimes. A complete run produces 192 exports per runtime over the 24 distinct maps (two warm-ups and six timed generations each).\n\n'+
  '`docs/m9-design.md` §13 sets under 3 s for a 128² generation and about 6 s for one 256² candidate, derived from K=3 in ≤20 s. The tables compare the whole accepted-candidate cost to those targets. Native stage timings in the raw rows describe only the last attempt; they are not summed or presented as an all-attempt breakdown. Retry counts are unchanged by optimization. The shared host also runs the tail of the water/cycle proof; observed wall times are not a quiet-machine budget certification. CPU over 6 s already indicates that this patch alone does not remove that case\'s computational budget problem.\n\n'+
  '| Size | Node CPU speedup | Node median CPU baseline → combined (s) | Chrome speedup | Chrome median wall baseline → combined (s) | Combined Chrome cases over target |\n|---|---:|---:|---:|---:|---:|\n';
for(const size of [128,256]){const s=bySize[size];md+='| '+size+'² | '+x(s.nodeCpuSpeedup)+' | '+sec(s.nodeBaselineCpuMs)+' → '+sec(s.nodeCombinedCpuMs)+' | '+x(s.chromiumWallSpeedup)+' | '+sec(s.chromiumBaselineWallMs)+' → '+sec(s.chromiumCombinedWallMs)+' | '+s.chromiumCombinedWallOverBudget.length+'/'+s.chromiumCases+' |\n';}
md+='\nRatios are medians of paired per-case ratios; the absolute-time columns are separate medians and need not divide to the same ratio. “Over target” uses each case\'s three-run median, not a pass/fail guarantee for every call. Small gains and cases near 6 s need replication: individual trial values show JIT/GC and scheduling variation, and one full warm-up does not guarantee every path is fully optimized. All three raw trials are retained.\n\n| Theme | Size | Seed | Attempts | Node CPU baseline → combined (s) | Node wall baseline → combined (s) | Chrome wall baseline → combined (s) | Combined Chrome / target (>1 is over) |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
for(const n of node.sort((a,b)=>a.size-b.size||themes.indexOf(a.theme)-themes.indexOf(b.theme)||a.seed-b.seed)){
  const c=chrome.find(c=>key(c)===key(n)),budget=n.size===256?6000:3000;
  md+='| '+n.theme+' | '+n.size+'² | '+n.seed+' | '+n.attempts+' | '+sec(med(n,'baseline','cpuMs'))+' → '+sec(med(n,'combined','cpuMs'))+' | '+sec(med(n,'baseline','wallMs'))+' → '+sec(med(n,'combined','wallMs'))+' | '+sec(c?med(c,'baseline','wallMs'):null)+' → '+sec(c?med(c,'combined','wallMs'):null)+' | '+(c?x(med(c,'combined','wallMs')/budget):'pending')+' |\n';
}
md+='\n## Reproduction\n\nRun from this folder after installing its dependencies and generating the core prototypes:\n\n```sh\nnode bundle-m9.mjs\nnode m9-bench.mjs\nnode browser-server.mjs --m9\n# Open its loopback URL in Chromium; wait for PASSED, then stop the server.\nnode summarize-m9.mjs\n```\n\nUse `--force` on both runners to replace matching-build cached results. Whole-pipeline wall budgets should be replicated on a quiet host before integration. Fewer settles or retries would be separate generator changes and are not included in these measured gains.\n';
writeFileSync('M9-PIPELINE.md',md);console.log(JSON.stringify(summary,null,2));
if(missingNode.length)process.exitCode=1;
