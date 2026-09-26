import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { mkdirSync,writeFileSync } from 'node:fs';
import { SCENARIOS } from './scenarios';
const server=await createServer();await server.listen();const url=server.resolvedUrls!.local[0];
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const idle=()=>page.waitForFunction(()=>{const s=(window as any).erupt?.state;return s&&!s.busy&&!s.active&&!s.queued;},{},{timeout:180000});
const frames:Buffer[]=[];const shot=async()=>{frames.push(await page.screenshot());};
const results:unknown[]=[];
try{
 await page.goto(url);await idle();mkdirSync('captures',{recursive:true});
 for(const scene of SCENARIOS){
  frames.length=0;
  await page.evaluate(id=>(window as any).erupt.load(id),scene.map);await idle();await shot();
  await page.evaluate(s=>{const a=(window as any).erupt;a.setSettings(s.settings);a.erupt(s.intent);},scene);
  for(let k=0;k<10;k++){await page.waitForTimeout(230);await shot();}
  await idle();await shot();
  if(scene.second){await page.evaluate(s=>{const a=(window as any).erupt;a.setSettings(s.settings);a.erupt(s.intent);},scene.second);for(let k=0;k<8;k++){await page.waitForTimeout(280);await shot();}await idle();await shot();}
  if(scene.carve){await page.evaluate(i=>(window as any).erupt.carve(i),scene.carve);for(let k=0;k<8;k++){await page.waitForTimeout(230);await shot();}await idle();await shot();}
  const encoder=GIFEncoder(),canvas=createCanvas(512,360),ctx=canvas.getContext('2d'),selected=frames.filter((_,k)=>k%2===0||k===frames.length-1);
  for(let k=0;k<selected.length;k++){const im=await loadImage(selected[k]);ctx.drawImage(im,0,0,512,360);const rgba=ctx.getImageData(0,0,512,360).data,palette=quantize(rgba,64);encoder.writeFrame(applyPalette(rgba,palette),512,360,{palette,delay:k===selected.length-1?1700:520});}
  encoder.finish();writeFileSync('captures/'+scene.id+'.gif',encoder.bytes());
  if(scene.id==='huge-caldera')writeFileSync('captures/hero.png',frames.at(-1)!);
  const state=await page.evaluate(()=>{const a=(window as any).erupt;return {seed:a.state.seed,operation:a.operation?.params.terrain.length,renderer:a.renderer};});results.push({id:scene.id,...state});console.log(scene.id,state);
 }
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync('captures/scenarios.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();await server.close();}
