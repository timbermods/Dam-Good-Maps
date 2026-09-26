// Rendered motion checks: track detail across world-space probes, including reversed
// and northward flow. Also compare flecks/feature density with the accepted broad streaks.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
mkdirSync('.cache',{recursive:true});
writeFileSync('.cache/accepted-water.ts',execFileSync('git',['show','9aeac6b:investigation/maplook2/water.ts']));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:940}});page.setDefaultTimeout(300000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:4197');await page.waitForFunction(()=>window.maplook2?.ready);
  const result=await page.evaluate(async()=>{
    const a=window.maplook2;a.freeze();
    const {surfaceVelocity,surfaceContamination}=await import('/flow.ts');
    const cardinal=[];
    for(const [k,expected] of [[0,[0,-1]],[1,[-1,0]],[2,[0,1]],[3,[1,0]]]){
      const out=new Float64Array(3*3*4);for(let i=0;i<9;i++)out[i*4+k]=.3;
      const v=surfaceVelocity(3,3,new Float32Array(9).fill(1),out);
      const actual=[v[8],v[9]];if(actual.some((v,c)=>Math.abs(v-expected[c])>1e-6))throw new Error('Flow coordinate conversion failed');cardinal.push({expected,actual});
    }
    const W=64,N=W*W,height=8.25;
    const map={W,H:W,heights:new Uint8Array(N).fill(7),columns:{tiles:new Int32Array(),voxels:new Uint8Array()},entities:{...a.map.entities,count:0},soil:{moisture:new Uint8Array(N),contamination:new Uint8Array(N)},water:{count:N,tile:Int32Array.from({length:N},(_,i)=>i),floor:new Float32Array(N).fill(7),depth:new Float32Array(N).fill(1.25),contamination:new Float32Array(N)}};
    for(let i=0;i<N;i++)map.water.contamination[i]=i%W>=32?1:0;
    const gradient=surfaceContamination(map);
    const front=Array.from(gradient.slice(32*W+28,32*W+36));
    if(front[0]!==0||front.at(-1)!==1||front.filter(v=>v>0&&v<1).length<4||front.some((v,i)=>i>0&&v<front[i-1]))throw new Error('Mixing front is not a monotonic multi-tile gradient');
    map.water.contamination.fill(0);
    a.standard.setMap(map);a.high.setMap(map);a.effects.fit(W,W);
    a.camera({mode:'orbit',target:[32,height,-32],distance:18,yaw:0,pitch:1.22});
    function flow(x,y){const v=new Float32Array(N*2);for(let i=0;i<N;i++){v[i*2]=x;v[i*2+1]=y;}a.flow.set(W,W,v);}
    function pixels(t){a.freeze(t);const g=a.high.canvas.getContext('webgl2'),w=g.drawingBufferWidth,h=g.drawingBufferHeight,data=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,data);return {data,w,h};}
    function green(p,x,y){const c=a.high.project(x,height,-y),px=c.x,py=p.h-1-c.y,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
      const value=(x,y)=>p.data[(y*p.w+x)*4+1];return (value(ix,iy)*(1-fx)+value(ix+1,iy)*fx)*(1-fy)+(value(ix,iy+1)*(1-fx)+value(ix+1,iy+1)*fx)*fy;}
    function metrics(p){let white=0,edges=0;for(let y=180;y<380;y++)for(let x=200;x<500;x++){const i=(y*p.w+x)*4;if(p.data[i]>140&&p.data[i+1]>140&&p.data[i+2]>140)white++;if(Math.abs(p.data[i+1]-p.data[i+5])>4&&p.data[i+1]<110&&p.data[i+5]<110)edges++;}return {white,edges,pixels:60000};}
    const motions=[];
    for(const [name,x,y,axis,contamination=0] of [['lake',0,0,0],['slow east',1,0,0],['fast east',8,0,0],['fast west',-8,0,0],['fast north',0,8,1],['mixed east',8,0,0,.25],['badwater east',8,0,0,1]]){
      flow(x,y);if(contamination){const v=new Float32Array(N*2);for(let i=0;i<N;i++)v[i*2]=8;a.flow.set(W,W,v,new Float32Array(N).fill(contamination));}
      const before=pixels(8),after=pixels(8.1);let best={shift:0,error:Infinity};
      for(let step=-20;step<=20;step++){const shift=step*.01;let sum=0,count=0;
        for(let gy=30;gy<34;gy+=.065)for(let gx=30;gx<34;gx+=.065){const b=green(before,gx,gy),c=green(after,gx+(axis===0?shift:0),gy+(axis===1?shift:0));if(b>110||c>110)continue;sum+=(b-c)**2;count++;}
        const error=sum/count;if(error<best.error)best={shift,error};
      }
      motions.push({name,...best,detail:metrics(before)});
    }
    const {highWater}=await import('/.cache/accepted-water.ts');
    const original=a.high.waterMat,accepted=highWater(a.effects.standard.clone());accepted.uniforms=original.uniforms;
    a.high.waterMat=accepted;for(const mesh of a.high.water.values())mesh.material=accepted;
    const previous=metrics(pixels(8));a.high.waterMat=original;for(const mesh of a.high.water.values())mesh.material=original;accepted.dispose();
    // Flow-phase handoffs must not pop; measure tiny time steps either side of reset.
    flow(8,0);
    const changes=[];
    for(const t of [11.99,12,17.99,18]){const b=pixels(t),c=pixels(t+.001);let delta=0;for(let i=0;i<b.data.length;i+=4)delta+=Math.abs(b.data[i+1]-c.data[i+1]);changes.push({time:t,meanDelta:delta/(b.w*b.h)});}
    return {cardinal,mixingFront:front,motions,previous,phaseChanges:changes};
  });
  result.errors=errors;
  writeFileSync('captures/surface-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  const [lake,slow,east,west,north,mixed,badwater]=result.motions;
  if(Math.abs(lake.shift)>.01||slow.shift<=0||east.shift<=slow.shift||west.shift>=-.04||north.shift<=.04)throw new Error('Rendered flow direction/speed mismatch');
  if(mixed.shift!==east.shift||badwater.shift!==east.shift)throw new Error('Surface motion is discontinuous through contamination');
  if(east.detail.white<=lake.detail.white||lake.detail.white<=result.previous.white)throw new Error('Fleck density did not increase with flow');
  if(lake.detail.edges<result.previous.edges*1.5)throw new Error('Ripples are not sufficiently finer than accepted broad streaks');
  if(result.phaseChanges.some(c=>c.meanDelta>1))throw new Error('Flow phase handoff is discontinuous');
  if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
