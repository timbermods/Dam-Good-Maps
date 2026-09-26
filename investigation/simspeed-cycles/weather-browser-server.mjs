import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {weatherJobs,weatherVariants} from './weather-suite.mjs';
import {productJobs} from './weather-product-suite.mjs';
const root=resolve('.'),token=randomBytes(24).toString('hex'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const productMode=process.argv.includes('--product'),buildId=read('results/weather/build.json').id,workers=productMode?1:4;
mkdirSync('results/weather/'+(productMode?'product/':'')+'chromium',{recursive:true});
const path=(runtime,j)=>'results/weather/'+(productMode?'product/':'')+runtime+'/'+j.theme+'-'+j.size+'-'+j.seed+'.json';
const jobs=(productMode?productJobs:weatherJobs).filter(j=>process.argv.includes('--force')||!existsSync(path('chromium',j))||read(path('chromium',j)).buildId!==buildId);
const total=jobs.length,active=new Map();let completed=0,boundariesPassed=false,failure=null;
const key=j=>j.theme+'-'+j.size+'-'+j.seed;
const status=()=>({buildId,boundariesPassed,completed,total,queued:jobs.length,active:[...active.keys()],failure,done:boundariesPassed&&!failure&&!jobs.length&&!active.size});
const send=(res,data,code=200)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><title>Exact weather ${productMode?'continuous timeline':'optimization proof'}</title><h1>Exact weather — ${productMode?'continuous 73-day timeline':'Node and Chromium'}</h1><p id="status">Starting dependency tests…</p><pre id="detail"></pre><script>globalThis.proofToken=${JSON.stringify(token)};globalThis.proofWorkers=${workers};globalThis.proofMode=${JSON.stringify(productMode?'product':'proof')};</script><script type="module" src="/weather-browser-page.mjs"></script>`);return;}
    if(pathname==='/status'){send(res,status());return;}
    if(['/next','/result','/boundaries','/failure'].includes(pathname)){
      if(req.method!=='POST'||req.headers['x-proof-token']!==token){send(res,{error:'Unauthorized'},403);return;}
      let body='';for await(const chunk of req){body+=chunk;if(body.length>16*1024*1024)throw Error('Result too large');}
      const data=JSON.parse(body||'{}');
      if(pathname==='/failure'){failure=String(data.error);console.error('FAIL',failure);send(res,status());return;}
      if(failure)throw Error(failure);
      if(pathname==='/boundaries'){
        if(JSON.stringify(data.result)!==JSON.stringify(read('results/weather/boundaries-node.json')))throw Error('Boundary Node/Chromium mismatch');
        writeFileSync('results/weather/boundaries-chromium.json',JSON.stringify(data.result)+'\n');
        writeFileSync('results/weather/'+(productMode?'product/':'')+'chromium-environment.json',JSON.stringify({...data.environment,buildId,workers,date:new Date().toISOString()},null,2)+'\n');
        boundariesPassed=true;console.log('PASS Chromium weather dependency tests');send(res,status());return;
      }
      if(!boundariesPassed)throw Error('Dependency tests must pass first');
      if(pathname==='/next'){
        const i=jobs.findIndex(j=>existsSync(path('node',j))&&read(path('node',j)).buildId===buildId);
        const job=i>=0?jobs.splice(i,1)[0]:null;if(job)active.set(key(job),job);
        send(res,{job,pending:!job&&jobs.length>0});return;
      }
      const job=active.get(data.key);if(!job)throw Error('Unknown result');
      const r=data.result,n=read(path('node',job));
      for(const k of ['buildId','theme','size','seed','inputSha256','weatherSeed','plantSeed','variants','passed','smokeTicks'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error(key(job)+'/'+k);
      if(productMode){
        for(const k of ['continuousDays','spans','checkpoints'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error(key(job)+'/continuous/'+k);
        for(const k of ['frameBytes','metadataBytes','frameSha256','metadataSha256','frameCount','uncompressedArrayTimelineBytes'])if(r.cache[k]!==n.cache[k])throw Error(key(job)+'/cache/'+k);
      }else{
        if(r.probes.length!==6||r.variants.length!==weatherVariants.length)throw Error('Incomplete result');
        for(let i=0;i<6;i++)for(const k of ['id','days','spans','checkpoints'])if(JSON.stringify(r.probes[i][k])!==JSON.stringify(n.probes[i][k]))throw Error(key(job)+'/'+r.probes[i].id+'/'+k);
      }
      writeFileSync(path('chromium',job),JSON.stringify({...r,workers})+'\n');
      active.delete(data.key);completed++;console.log('WEATHER Chromium/Node PASS',key(job),completed+'/'+total);send(res,status());return;
    }
    const file=resolve('.'+pathname);
    if(!file.startsWith(root+sep)||extname(file)!=='.mjs'){send(res,{error:'Not found'},404);return;}
    res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));
  }catch(error){failure=error.stack||String(error);console.error(failure);send(res,{error:failure},500);}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
console.log('Open http://127.0.0.1:'+server.address().port+'/');console.log('Pending weather cases:',total);
