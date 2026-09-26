// Measures the final, blended framebuffer, not material constants or JPEG colours.
// A synthetic bed uses the same MapRenderer, terrain, water, sun and shadows as real maps.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
mkdirSync('.cache',{recursive:true});
writeFileSync('.cache/accepted-water.ts',execFileSync('git',['show','1919106:investigation/maplook2/water.ts']));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan']});
const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
page.setDefaultTimeout(300000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:4197');await page.waitForFunction(()=>window.maplook2?.ready);
  const result=await page.evaluate(async()=>{
    const a=window.maplook2;a.freeze();
    const material=a.high.waterMat;
    const keys=['mlShallow','mlBody','mlDeep','mlStreakAbove','mlStreakLow','mlGrazing','mlStreakGrazing'];
    const hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
    function bed(depth,contamination=0,falls=false){
      const W=64,N=W*W,floor=depth===0.25?8:depth===1.25?7:4;
      const m={W,H:W,heights:new Uint8Array(N).fill(floor),columns:{tiles:new Int32Array(),voxels:new Uint8Array()},entities:{...a.map.entities,count:0},soil:{moisture:new Uint8Array(N),contamination:new Uint8Array(N)},water:{count:N,tile:Int32Array.from({length:N},(_,i)=>i),floor:new Float32Array(N).fill(floor),depth:new Float32Array(N).fill(depth),contamination:new Float32Array(N).fill(contamination)}};
      if(falls)for(let i=0;i<N;i++)m.heights[i]=m.water.floor[i]=i%W<32?8:4;
      a.standard.setMap(m);a.high.setMap(m);a.effects.fit(W,W);
      return floor+depth;
    }
    function sample(height,pitch){
      a.camera({mode:'orbit',target:[32,height,-32],distance:44,yaw:-0.55,pitch});a.freeze();
      const r=a.high,g=r.canvas.getContext('webgl2'),w=g.drawingBufferWidth,h=g.drawingBufferHeight;
      const p=new Uint8Array(w*h*4);r.renderNow();g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,p);
      const pixels=[];
      // A small central patch limits angular variation, especially near the horizon.
      for(let y=Math.floor(h/2)-24;y<Math.floor(h/2)+24;y++)for(let x=Math.floor(w/2)-60;x<Math.floor(w/2)+60;x++){
        const i=(y*w+x)*4;pixels.push([p[i],p[i+1],p[i+2]]);
      }
      pixels.sort((a,b)=>(a[0]+2*a[1]+a[2])-(b[0]+2*b[1]+b[2]));
      function band(lo,hi){const s=pixels.slice(Math.floor(pixels.length*lo),Math.floor(pixels.length*hi));return [0,1,2].map(c=>s.reduce((sum,p)=>sum+p[c],0)/s.length);}
      return {body:band(.15,.40),streak:band(.96,.985)};
    }
    const targets={mlShallow:[42,75,85],mlBody:[36,67,77],mlDeep:[29,50,62],mlStreakAbove:[47,84,95],mlStreakLow:[58,87,97],mlGrazing:[52,80,90],mlStreakGrazing:[80,123,129]};
    const measurements=[];
    for(const [depth,pitch,label]of [[.25,1.22,'shallow above'],[1.25,1.22,'body above'],[4.25,1.22,'deep above'],[1.25,Math.PI/6,'low 30 degrees'],[1.25,.18,'grazing 10.3 degrees']]){
      const height=bed(depth),s=sample(height,pitch);
      measurements.push({label,depth,pitch,body:s.body.map(Math.round),bodyHex:hex(s.body),streak:s.streak.map(Math.round),streakHex:hex(s.streak)});
    }
    const {highWater:acceptedWater}=await import('/.cache/accepted-water.ts');
    const accepted=acceptedWater(a.effects.standard.clone());accepted.uniforms=material.uniforms;
    function renderWith(mat){
      a.high.waterMat=mat;for(const mesh of a.high.water.values())mesh.material=mat;
      a.high.renderNow();const gl=a.high.canvas.getContext('webgl2'),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return {data,w,h};
    }
    function compare(before,after,box=[0,0,before.w,before.h]){
      let channels=0,changed=0,maxDelta=0;
      for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++)for(let c=0;c<3;c++){
        const i=((before.h-1-y)*before.w+x)*4+c,d=Math.abs(before.data[i]-after.data[i]);channels++;if(d)changed++;maxDelta=Math.max(maxDelta,d);
      }
      return {channels,changed,maxDelta};
    }
    const height=bed(1.25,1);a.camera({mode:'orbit',target:[32,height,-32],distance:44,yaw:-0.55,pitch:1.22});a.freeze();
    const badwaterUnchanged=compare(renderWith(accepted),renderWith(material));
    bed(1.25,0,true);a.camera({mode:'orbit',target:[32,7,-32],distance:30,yaw:Math.PI/2,pitch:0.30});a.freeze();
    const corner1=a.high.project(32.01,6.25,-30),corner2=a.high.project(32.01,8.75,-34);
    const box=[Math.ceil(Math.min(corner1.x,corner2.x))+2,Math.ceil(Math.min(corner1.y,corner2.y))+2,Math.floor(Math.max(corner1.x,corner2.x))-2,Math.floor(Math.max(corner1.y,corner2.y))-2];
    const waterfallUnchanged=compare(renderWith(accepted),renderWith(material),box);
    accepted.dispose();
    return {renderer:a.high.gpu().renderer,targets,inputs:Object.fromEntries(keys.map(k=>[k,material.uniforms[k].value.toArray().map(v=>v*255)])),measurements,badwaterUnchanged,waterfallUnchanged};
  });
  result.errors=errors;
  const probes=[[0,'body','mlShallow'],[1,'body','mlBody'],[2,'body','mlDeep'],[1,'streak','mlStreakAbove'],[3,'streak','mlStreakLow'],[4,'body','mlGrazing'],[4,'streak','mlStreakGrazing']];
  result.maxTargetError=Math.max(...probes.flatMap(([i,part,key])=>result.measurements[i][part].map((v,c)=>Math.abs(v-result.targets[key][c]))));
  writeFileSync('captures/colour-check.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  if(result.maxTargetError>2)throw new Error('Rendered colour is more than two code values from its target');
  if(result.badwaterUnchanged.changed||result.waterfallUnchanged.changed||!result.waterfallUnchanged.channels)throw new Error('Accepted badwater or waterfall curtain changed');
}finally{await browser.close();}
