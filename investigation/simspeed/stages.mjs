// Refresh only short-stage timing; retain expensive, already-verified cycle records.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {load,themes,variants,timeStages} from './suite.mjs';
import {matrix,matrixWorkers} from './matrix.mjs';
const api=await load();globalThis.simCpuUsage=()=>process.threadCpuUsage();
await matrix(import.meta.url,[96,128,256].flatMap(size=>themes.map(theme=>({size,theme}))),async({size,theme})=>{
  const id=theme+'-'+size+'-1',file='results/node/bench/'+id+'.json';
  if(!existsSync(file)&&process.argv.includes('--available')){console.log('PENDING CYCLE',id);return;}
  const r=JSON.parse(readFileSync(file,'utf8'));
  if(r.buildId!==globalThis.simBuildId)throw Error('stale cycle record: '+id);
  if(!process.argv.includes('--force')&&r.stages.every(s=>s.timingMethod==='batched-500ms-v3'))return;
  const proof=JSON.parse(readFileSync('results/node/maps/'+id+'.json','utf8')),builds={};
  for(const v of variants){
    const g=api[v].generate(api[v].makeSpec({theme,seed:1,size:{x:size,y:size}}));
    if(createHash('sha256').update(g.bytes).digest('hex')!==proof.hashes[v])throw Error('timing input changed '+id+'/'+v);
    builds[v]=g.built;
  }
  timeStages(api,builds,1,0);r.stages=timeStages(api,builds,3);
  r.stageTiming={method:'batched-500ms-v3',inputsHashChecked:true,matrixWorkers,cpuAccounting:'thread',date:new Date().toISOString()};
  writeFileSync(file,JSON.stringify(r)+'\n');console.log('STAGES',id);
});
