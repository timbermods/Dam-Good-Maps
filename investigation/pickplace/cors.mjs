import { launch } from './browser.mjs';
import { serve } from './server.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const server=serve(), browser=await launch();
try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4178/');
  const probes=[
    {source:'AWS Terrarium US',url:'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/193/396.png'},
    {source:'AWS Terrarium EU',url:'https://elevation-tiles-prod-eu.s3.eu-central-1.amazonaws.com/terrarium/10/193/396.png'},
    {source:'Copernicus GLO-30',url:'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_W120_00_DEM/Copernicus_DSM_COG_10_N37_00_W120_00_DEM.tif',range:true},
    {source:'Copernicus GLO-90',url:'https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N37_00_W120_00_DEM/Copernicus_DSM_COG_30_N37_00_W120_00_DEM.tif',range:true},
    {source:'USGS 3DEP 1 arcsecond',url:'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/n38w120/USGS_1_n38w120.tif',range:true},
    {source:'Open Topo Data SRTM30m',url:'https://api.opentopodata.org/v1/srtm30m?locations=37.74,-119.59'},
  ];
  const results=[];
  for(const p of probes) for(let trial=0;trial<3;trial++) {
    const result=await page.evaluate(async ({p,trial})=>{
      const t=performance.now();
      try {
        const r=await fetch(p.url,{mode:'cors',cache:'no-store',headers:p.range?{Range:'bytes=0-65535'}:{},signal:AbortSignal.timeout(20000)});
        const b=await r.arrayBuffer();
        return {...p,trial,status:r.status,type:r.type,bytes:b.byteLength,ms:performance.now()-t,contentRange:r.headers.get('content-range'),ok:r.ok};
      } catch(e) {return {...p,trial,ok:false,ms:performance.now()-t,error:String(e)};}
    },{p,trial});
    results.push(result); console.log(JSON.stringify(result));
    await page.waitForTimeout(1100);
  }
  await mkdir('results',{recursive:true});
  await writeFile('results/cors.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),origin:new URL(page.url()).origin,security:'default; no interception; no proxy',results},null,2));
} finally {await browser.close();server.close();}
