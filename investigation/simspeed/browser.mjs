// Reproduce the identical suite in a real Chromium renderer.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { themes } from './suite.mjs';
const root=resolve('.');
mkdirSync('.work/browser-temp',{recursive:true});
process.env.TMP=process.env.TEMP=resolve('.work/browser-temp');
const server=createServer((req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Simulation exactness tests</title><p>Automated investigation harness</p>');return;}
  if(path==='/golden.json'){res.setHeader('Content-Type','application/json');res.end(gunzipSync(readFileSync('../../tests/golden/water.json.gz')));return;}
  const file=resolve('.'+path);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',extname(file)==='.mjs'?'text/javascript':'application/json');res.end(readFileSync(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=process.env.CDP_URL?await chromium.connectOverCDP(process.env.CDP_URL,{timeout:15000}):
    await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(async()=>{globalThis.suite=await import('/suite.mjs');globalThis.api=await suite.load();});
  mkdirSync('results/chromium/maps',{recursive:true});mkdirSync('results/chromium/bench',{recursive:true});
  writeFileSync('results/chromium/environment.json',JSON.stringify({version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),date:new Date().toISOString()},null,2));
  const golden=await page.evaluate(async()=>{const {golden}=await import('/golden.mjs');return golden(api,(await (await fetch('/golden.json')).json()).fixtures);});
  const nodeGolden=JSON.parse(readFileSync('results/node/golden.json','utf8'));
  if(JSON.stringify(golden)!==JSON.stringify(nodeGolden))throw Error('Node/Chromium golden mismatch');
  writeFileSync('results/chromium/golden.json',JSON.stringify(golden));
  if(!process.argv.includes('--bench-only'))for(const size of [96,128,256])for(const theme of themes)for(let seed=1;seed<=(size===128?30:3);seed++){
    const id=theme+'-'+size+'-'+seed,file='results/chromium/maps/'+id+'.json';
    if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===JSON.parse(readFileSync('results/build.json','utf8')).id&&!process.argv.includes('--force'))continue;
    const r=await page.evaluate(c=>suite.verifyMap(api,c),{theme,size,seed});
    const n=JSON.parse(readFileSync('results/node/maps/'+id+'.json','utf8'));
    for(const k of ['buildId','hashes','checkpoints','drought','accepted'])if(JSON.stringify(r[k])!==JSON.stringify(n[k]))throw Error(id+': Node/Chromium '+k);
    writeFileSync(file,JSON.stringify(r)+'\n');console.log('PASS Chromium/Node',id);
  }
  if(!process.argv.includes('--maps-only'))for(const size of [96,128,256])for(const theme of themes){
    const id=theme+'-'+size+'-1',file='results/chromium/bench/'+id+'.json';
    if(existsSync(file)&&JSON.parse(readFileSync(file,'utf8')).buildId===JSON.parse(readFileSync('results/build.json','utf8')).id&&!process.argv.includes('--force'))continue;
    const r=await page.evaluate(async({theme,size})=>{
      const g=api.baseline.generate(api.baseline.makeSpec({theme,seed:1,size:{x:size,y:size}})),b=g.built;
      const builds={baseline:b};
      for(const v of suite.variants.slice(1))builds[v]=api[v].generate(api[v].makeSpec({theme,seed:1,size:{x:size,y:size}})).built;
      suite.timeStages(api,builds,1,0);
      const stages=suite.timeStages(api,builds,3);
      return {buildId:globalThis.simBuildId,theme,size,seed:1,stages,cycle:await suite.cycles(api,builds,()=>{},g.spec.settings.start.rules.waterWithin)};
    },{theme,size});
    const n=JSON.parse(readFileSync('results/node/bench/'+id+'.json','utf8'));
    for(let i=0;i<r.cycle.length;i++)if(JSON.stringify(r.cycle[i].checkpoints)!==JSON.stringify(n.cycle[i].checkpoints))throw Error(id+': cycle Node/Chromium');
    writeFileSync(file,JSON.stringify(r)+'\n');console.log('PASS Chromium cycles',id);
  }
}finally{if(browser)await browser.close();server.close();}
