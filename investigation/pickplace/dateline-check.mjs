import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { launch } from './browser.mjs';
import { serve } from './server.mjs';
import { PNG } from 'pngjs';
await build({entryPoints:['terrain.ts'],outfile:'dist/terrain-check.js',bundle:true,format:'esm',platform:'browser'});
const server=serve(),browser=await launch();
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4178');
  const result=await page.evaluate(async()=>{
    const {sample}=await import('./terrain-check.js');
    const a=await sample(-16.82,179.99,128,60),b=await sample(-16.82,-180.01,128,60);
    let maxDifference=0;for(let i=0;i<a.raw.length;i++)maxDifference=Math.max(maxDifference,Math.abs(a.raw[i]-b.raw[i]));
    return {lat:-16.82,representations:[179.99,-180.01],size:128,metresPerTile:60,maxDifference,centreRow:Array.from(a.raw.slice(64*128,65*128)),note:'Equivalent longitudes test wrapped fetching/interpolation; this does not establish source accuracy.'};
  });
  if(result.maxDifference>.001)throw Error('Dateline sampling differs across equivalent longitudes.');
  const url='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/4095/2242.png';
  const png=PNG.sync.read(Buffer.from(await (await fetch(url)).arrayBuffer()));
  let min=Infinity,max=-Infinity;
  for(let i=0;i<png.data.length;i+=4){const value=png.data[i]*256+png.data[i+1]+png.data[i+2]/256-32768;min=Math.min(min,value);max=Math.max(max,value);}
  result.independentPNGDecoder={url,min,max,note:'Raw upstream tile decoded independently with pngjs in Node; constant zero on this side of the seam.'};
  await writeFile('results/dateline-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify({maxDifference:result.maxDifference,rowMin:Math.min(...result.centreRow),rowMax:Math.max(...result.centreRow)}));
}finally{await browser.close();server.close();}
