import { launch } from './browser.mjs';
import { serve } from './server.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import os from 'node:os';
import { compactJSON } from './compact-json.mjs';
import { measure,projectWet } from './measure-water.mjs';
import {installBudget} from './benchmark-browser.mjs';
const limit=Number(process.env.LIMIT||50), sizes=(process.env.SIZES||'96,128,256').split(',').map(Number);
const budgetMs=15*60*1000;
const previousRun=process.env.RESUME?JSON.parse(await readFile('results-signature/run.json','utf8')):{};
const startedAt=previousRun.startedAt??previousRun.date??new Date().toISOString();
const places=JSON.parse(await readFile('places.json','utf8')).slice(Number(process.env.OFFSET||0),Number(process.env.OFFSET||0)+limit).filter(p=>!process.env.IDS||process.env.IDS.split(',').map(Number).includes(p.id));
await mkdir('results-signature/previews',{recursive:true});await mkdir('.work/maps-signature',{recursive:true});
const server=serve(), browser=await launch();
try {
  const context=await browser.newContext();
  const page=await context.newPage(); await page.goto('http://127.0.0.1:4178/');
  await page.waitForFunction(()=>!!window.pickplace);
  await page.evaluate(()=>{window.heartbeats=0;setInterval(()=>window.heartbeats++,50);});
  await installBudget(page,budgetMs);
  const rows=[];
  await writeFile('results-signature/run.json',JSON.stringify({status:'running',date:new Date().toISOString(),startedAt,resumed:!!process.env.RESUME,budgetMs,places:places.length,sizes,attempts:0},null,2));
  for(const place of places) for(const size of sizes) {
    const id=`${String(place.id).padStart(2,'0')}-${size}`, start=Date.now();
    if(process.env.RESUME){try{rows.push(JSON.parse(await readFile(`results-signature/${id}.json`,'utf8')));continue;}catch(e){if(e.code!=='ENOENT')throw e;}}
    const input={lat:place.lat,lon:place.lon,size,...(process.env.MPT?{mpt:Number(process.env.MPT)}:{})};
    try {
      await writeFile('.work/progress-signature.json',JSON.stringify({id,phase:'conversion',startedAt:new Date(start).toISOString(),budgetMs}));
      const output=await page.evaluate(async input=>{
        const b=window.heartbeats;
        const r=await window.benchConvert(input);
        const binary=(v)=>{let s='';for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s);};
        return {summary:r.summary,heights:Array.from(r.heights),depth:Array.from(r.depth),reference:Array.from(r.reference),map:binary(r.bytes),heartbeats:window.heartbeats-b};
      },input);
      const row={...place,...output.summary,heartbeats:output.heartbeats};
      console.log(`${id} converted in ${(row.timings.totalMs/1000).toFixed(2)}s; measuring previous footprint`);
      await writeFile('.work/progress-signature.json',JSON.stringify({id,phase:'comparison',conversionMs:row.timings.totalMs,startedAt:new Date(start).toISOString(),budgetMs}));
      const before=JSON.parse(await readFile(`before-water/${id}.json`,'utf8'));
      const priorReference=await page.evaluate(async input=>(await window.benchConvert({...input,action:'reference'})).reference,before);
      const beforeWet=new Uint8Array(before.size**2);for(const i of before.wet)beforeWet[i]=1;
      row.comparison={before:measure(priorReference.fraction,beforeWet,before.size,priorReference.coverage),afterOnBeforeExtent:measure(priorReference.fraction,projectWet(output.depth,{lat:row.lat,lon:row.lon,size:row.size,mpt:row.selected.mpt},before),before.size,priorReference.coverage),afterOwnExtent:measure(output.reference,output.depth.map(d=>d>.05?1:0),row.size,row.reference.coverage),beforeExtent:{lat:before.lat,lon:before.lon,size:before.size,mpt:before.mpt}};
      await writeFile(`results-signature/${id}-reference.json`,compactJSON({beforeFraction:priorReference.fraction,afterFraction:output.reference,afterWet:output.depth.flatMap((d,i)=>d>.05?[i]:[]),coverage:{before:priorReference.coverage,after:row.reference.coverage}}));
      const renderSize=row.size; const image=new PNG({width:renderSize,height:renderSize});
      for(let y=0;y<renderSize;y++) for(let x=0;x<renderSize;x++) {
        const i=y*renderSize+x,k=((renderSize-1-y)*renderSize+x)*4,h=output.heights[i],d=output.depth[i];
        const shade=Math.max(.5,Math.min(1.3,1+(h-output.heights[y*renderSize+Math.max(0,x-1)])*.08));
        const color=d>.05?[45,135,163]:[85+h*6,105+h*5,65+h*5];
        for(let c=0;c<3;c++) image.data[k+c]=color[c]*shade;image.data[k+3]=255;
      }
      if(row.start) for(let dx=-2;dx<=4;dx++) for(let dy=-2;dy<=4;dy++) if(dx===-2||dx===4||dy===-2||dy===4){const k=((renderSize-1-row.start.y-dy)*renderSize+row.start.x+dx)*4;if(k>=0&&k<image.data.length){image.data[k]=255;image.data[k+1]=220;image.data[k+2]=80;}}
      await writeFile(`results-signature/previews/${id}.png`,PNG.sync.write(image));
      await writeFile(`.work/maps-signature/${id}.timber`,Buffer.from(output.map,'base64'));
      await writeFile(`results-signature/${id}.json`,compactJSON(row));
      rows.push(row);
      console.log(`${id} ${place.name}: ${row.passed?'PASS':'FAIL'} ${(row.timings.totalMs/1000).toFixed(2)}s ${row.current.failures.map(c=>c.id).join(',')}`);
    } catch(e) {
      const row={...place,size,passed:false,error:String(e),totalMs:Date.now()-start};rows.push(row);await writeFile(`results-signature/${id}.json`,JSON.stringify(row,null,2));console.log(`${id} ERROR ${e}`);
    }
  }
  await writeFile('results-signature/run.json',JSON.stringify({date:new Date().toISOString(),startedAt,resumed:!!process.env.RESUME,budgetMs,timeouts:rows.filter(r=>String(r.error??'').includes('Benchmark timeout')).length,browser:browser.version(),node:process.version,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,memoryGiB:os.totalmem()/2**30,base:'91981517f747fa345b5586b9f036aedb74255b1b',places:places.length,sizes,attempts:rows.length,passed:rows.filter(r=>r.passed).length,method:'Signature-water-v4; four scales at fixed centre and size, up to three designs each; signature-first acceptance plus canonical whole-head origin audit; ordinary Edge module Worker; direct AWS DEM plus fixed-dataset WorldCover range proxy; shared tile/range caches; same-old-footprint water comparison measured after conversion.'},null,2));
} finally {await browser.close();server.close();}
