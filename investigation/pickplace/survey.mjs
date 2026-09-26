import { launch } from './browser.mjs';
import { serve } from './server.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import os from 'node:os';
const limit=Number(process.env.LIMIT||50), sizes=(process.env.SIZES||'96,128,256').split(',').map(Number);
const places=JSON.parse(await readFile('places.json','utf8')).slice(0,limit);
await mkdir('results/previews',{recursive:true});await mkdir('.work/maps',{recursive:true});
const server=serve(), browser=await launch();
try {
  const context=await browser.newContext();
  const page=await context.newPage(); await page.goto('http://127.0.0.1:4178/');
  await page.waitForFunction(()=>!!window.pickplace);
  await page.evaluate(()=>{window.heartbeats=0;setInterval(()=>window.heartbeats++,50);});
  const rows=[];
  for(const place of places) for(const size of sizes) {
    const id=`${String(place.id).padStart(2,'0')}-${size}`, start=Date.now();
    const input={lat:place.lat,lon:place.lon,size};
    try {
      const output=await page.evaluate(async input=>{
        const b=window.heartbeats;
        const r=await window.pickplace.convert(input);
        const binary=(v)=>{let s='';for(let i=0;i<v.length;i+=8192)s+=String.fromCharCode(...v.subarray(i,i+8192));return btoa(s);};
        return {summary:r.summary,heights:Array.from(r.heights),depth:Array.from(r.depth),map:binary(r.bytes),heartbeats:window.heartbeats-b};
      },input);
      const row={...place,...output.summary,heartbeats:output.heartbeats};rows.push(row);
      const image=new PNG({width:size,height:size});
      for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const i=y*size+x,k=((size-1-y)*size+x)*4,h=output.heights[i],d=output.depth[i];
        const shade=Math.max(.5,Math.min(1.3,1+(h-output.heights[y*size+Math.max(0,x-1)])*.08));
        const color=d>.05?[45,135,163]:[85+h*6,105+h*5,65+h*5];
        for(let c=0;c<3;c++) image.data[k+c]=color[c]*shade;image.data[k+3]=255;
      }
      if(row.start) for(let dx=-2;dx<=4;dx++) for(let dy=-2;dy<=4;dy++) if(dx===-2||dx===4||dy===-2||dy===4){const k=((size-1-row.start.y-dy)*size+row.start.x+dx)*4;if(k>=0&&k<image.data.length){image.data[k]=255;image.data[k+1]=220;image.data[k+2]=80;}}
      await writeFile(`results/previews/${id}.png`,PNG.sync.write(image));
      await writeFile(`.work/maps/${id}.timber`,Buffer.from(output.map,'base64'));
      await writeFile(`results/${id}.json`,JSON.stringify(row,null,2));
      console.log(`${id} ${place.name}: ${row.passed?'PASS':'FAIL'} ${(row.timings.totalMs/1000).toFixed(2)}s ${row.current.failures.map(c=>c.id).join(',')}`);
    } catch(e) {
      const row={...place,size,passed:false,error:String(e),totalMs:Date.now()-start};rows.push(row);await writeFile(`results/${id}.json`,JSON.stringify(row,null,2));console.log(`${id} ERROR ${e}`);
    }
  }
  await writeFile('results/run.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),node:process.version,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,memoryGiB:os.totalmem()/2**30,base:'84b1866b4e1d444346949a7dd57dc0f3f9f69ac5',places:places.length,sizes,attempts:rows.length,passed:rows.filter(r=>r.passed).length,method:'One chosen scale; no conversion retries; same-origin page creates module Worker; remote DEM fetched directly inside Worker; default browser security; ordinary browser Cache API shared across sizes.'},null,2));
} finally {await browser.close();server.close();}
