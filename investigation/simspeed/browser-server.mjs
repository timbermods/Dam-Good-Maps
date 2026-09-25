// Alternative to Playwright: open the printed loopback URL in an existing Chromium.
// The browser runs the shared suite in three module workers; this server verifies
// each returned digest against Node before saving any accepted result.
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, sep, extname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {randomBytes} from 'node:crypto';
import {themes} from './suite.mjs';
const root=resolve('.'), token=randomBytes(24).toString('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const exactMode=process.argv.includes('--exact');
const m9Mode=process.argv.includes('--m9'),workers=m9Mode?1:3;
const buildId=read(m9Mode?'results/m9-build.json':exactMode?'results/exact-build.json':'results/build.json').id;
for(const dir of ['maps','bench'])mkdirSync('results/chromium/'+dir,{recursive:true});
if(exactMode)mkdirSync('results/exact/chromium',{recursive:true});
if(m9Mode)mkdirSync('results/m9/chromium',{recursive:true});
const jobs=[], active=new Map();let completed=0, goldenPassed=false, failure=null;
const force=process.argv.includes('--force');
for(const kind of m9Mode?['m9']:exactMode?['exact']:['maps','bench'])for(const size of m9Mode?[128,256]:[96,128,256])for(const theme of themes)
  for(let seed=1;seed<=(m9Mode?2:kind!=='maps'?1:size===128?30:3);seed++){
    const id=theme+'-'+size+'-'+seed, file=m9Mode?'results/m9/chromium/'+id+'.json':exactMode?'results/exact/chromium/'+id+'.json':'results/chromium/'+kind+'/'+id+'.json';
    if(!force&&existsSync(file)&&read(file).buildId===buildId)continue;
    jobs.push({kind,id,theme,size,seed});
  }
const total=jobs.length;
const status=()=>({buildId,goldenPassed,completed,total,queued:jobs.length,active:[...active.keys()],failure,done:goldenPassed&&!failure&&!jobs.length&&!active.size});
const send=(res,obj,code=200)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'), path=decodeURIComponent(url.pathname);
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><title>Simspeed ${m9Mode?'M9 pipeline':exactMode?'exact cycles':'exactness proof'}</title><h1>Simspeed Chromium verification${m9Mode?' — M9 pipeline':exactMode?' — exact cycles':''}</h1><p id="status">Starting golden fixtures…</p><pre id="detail"></pre><script>globalThis.proofToken=${JSON.stringify(token)};globalThis.proofMode=${JSON.stringify(m9Mode?'m9':exactMode?'exact':'core')};globalThis.proofWorkers=${workers}</script><script type="module" src="/browser-page.mjs"></script>`);return;}
    if(path==='/status'){send(res,status());return;}
    if(path==='/golden.json'){send(res,JSON.parse(gunzipSync(readFileSync('../../tests/golden/water.json.gz'))));return;}
    if(['/next','/result','/golden','/failure'].includes(path)){
      if(req.method!=='POST'||req.headers['x-proof-token']!==token){send(res,{error:'Unauthorized'},403);return;}
      let body='';for await(const chunk of req){body+=chunk;if(body.length>32*1024*1024)throw Error('Result too large');}
      const data=body?JSON.parse(body):{};
      if(path==='/failure'){failure=String(data.error);console.error('FAIL',failure);send(res,status());return;}
      if(failure)throw Error(failure);
      if(path==='/golden'){
        if(JSON.stringify(data.result)!==JSON.stringify(read('results/node/golden.json')))throw Error('Node/Chromium golden mismatch');
        writeFileSync(m9Mode?'results/m9/chromium-golden.json':exactMode?'results/exact/chromium-golden.json':'results/chromium/golden.json',JSON.stringify(data.result)+'\n');
        writeFileSync(m9Mode?'results/m9/chromium-environment.json':exactMode?'results/exact/chromium-environment.json':'results/chromium/environment.json',JSON.stringify({...data.environment,date:new Date().toISOString(),buildId,workers,runner:'browser-server.mjs, module Web Workers',cpuTiming:false},null,2));
        goldenPassed=true;console.log('PASS Chromium/Node golden');send(res,status());return;
      }
      if(!goldenPassed)throw Error('Golden fixtures must pass first');
      if(path==='/next'){
        // M9 can run alongside its serial Node oracle, but never accept a browser
        // case before the corresponding Node evidence is available.
        if(m9Mode&&jobs.length){
          const p='results/m9/node/'+jobs[0].id+'.json';
          if(!existsSync(p)||read(p).buildId!==buildId){send(res,{job:null,pending:true});return;}
        }
        const job=jobs.shift()||null;if(job)active.set(job.kind+'/'+job.id,job);
        send(res,{job});return;
      }
      const job=active.get(data.key);if(!job)throw Error('Unknown job');
      const r=data.result, n=read(m9Mode?'results/m9/node/'+job.id+'.json':exactMode?'results/exact/node/'+job.id+'.json':'results/node/'+job.kind+'/'+job.id+'.json');
      for(const k of ['buildId','theme','size','seed'])if(r[k]!==n[k])throw Error(job.id+': '+k+' mismatch');
      if(m9Mode){
        for(const k of ['sha256','attempts','accepted','passed','bytes','arrays'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error(job.id+': M9 '+k);
      }else if(exactMode){
        if(r.inputSha256!==n.inputSha256||r.coreWaterSimCalls!==0||r.probes.length!==6)throw Error('Exact-cycle input or guard mismatch');
        for(let i=0;i<6;i++)for(const k of ['id','days','spans','checkpoints'])if(JSON.stringify(r.probes[i][k])!==JSON.stringify(n.probes[i][k]))throw Error(job.id+': exact cycles '+k);
      }else if(job.kind==='maps'){
        for(const k of ['hashes','checkpoints','drought','accepted'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error(job.id+': Node/Chromium '+k);
      }else{
        if(r.cycle.length!==n.cycle.length)throw Error('Cycle probe count');
        for(let i=0;i<r.cycle.length;i++)if(JSON.stringify(r.cycle[i].checkpoints)!==JSON.stringify(n.cycle[i].checkpoints))throw Error(job.id+': cycle Node/Chromium '+i);
      }
      writeFileSync(m9Mode?'results/m9/chromium/'+job.id+'.json':exactMode?'results/exact/chromium/'+job.id+'.json':'results/chromium/'+job.kind+'/'+job.id+'.json',JSON.stringify(r)+'\n');
      active.delete(data.key);completed++;console.log('PASS Chromium/Node',job.kind,job.id,completed+'/'+total);
      send(res,status());return;
    }
    const file=resolve('.'+path);
    if(!file.startsWith(root+sep)){send(res,{error:'Forbidden'},403);return;}
    if(extname(file)!=='.mjs'){send(res,{error:'Not found'},404);return;}
    res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));
  }catch(e){failure=e.stack||String(e);console.error(failure);send(res,{error:failure},500);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
console.log('Open http://127.0.0.1:'+server.address().port+'/');
console.log('Pending jobs:',total);
