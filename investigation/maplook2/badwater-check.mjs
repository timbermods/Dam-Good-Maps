// This revision changes visual response, not just a flat colour swatch. Check
// clean-frame parity, bed transmission, low-angle reflection and dullness directly.
import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
mkdirSync('.cache',{recursive:true});
writeFileSync('.cache/before-badwater.ts',execFileSync('git',['show','675eb50:investigation/maplook2/water.ts'],{encoding:'utf8'}).replace('../../src/render3d/palette','../../../src/render3d/palette'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-vulkan']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:940}});page.setDefaultTimeout(300000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:4197');await page.waitForFunction(()=>window.maplook2?.ready);
  const result=await page.evaluate(async()=>{
    const a=window.maplook2;a.freeze();const mat=a.high.waterMat;
    const {highWater}=await import('/.cache/before-badwater.ts');
    const before=highWater(a.effects.standard.clone());
    before.uniforms={...mat.uniforms,mlBad:before.uniforms.mlBad,mlMix:before.uniforms.mlMix};
    function bed(depth,contamination,poisoned=contamination){
      const W=64,N=W*W,floor=8;
      const map={W,H:W,heights:new Uint8Array(N).fill(floor),columns:{tiles:new Int32Array(),voxels:new Uint8Array()},entities:{...a.map.entities,count:0},soil:{moisture:new Uint8Array(N),contamination:new Uint8Array(N).fill(Math.round(poisoned*255))},water:{count:N,tile:Int32Array.from({length:N},(_,i)=>i),floor:new Float32Array(N).fill(floor),depth:new Float32Array(N).fill(depth),contamination:new Float32Array(N).fill(contamination)}};
      if(depth===0)map.water={count:0,tile:new Int32Array(),floor:new Float32Array(),depth:new Float32Array(),contamination:new Float32Array()};
      a.standard.setMap(map);a.high.setMap(map);a.effects.fit(W,W);a.flow.set(W,W,new Float32Array(N*2),new Float32Array(N).fill(contamination));
      return floor+depth;
    }
    function render(material,height,pitch=1.22,bedOn=true){
      a.bed.setEnabled(bedOn);a.high.waterMat=material;for(const mesh of a.high.water.values())mesh.material=material;
      a.camera({mode:'orbit',target:[32,height,-32],distance:44,yaw:-.55,pitch});a.freeze();
      const gl=a.high.canvas.getContext('webgl2'),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return {data,w,h};
    }
    function stats(p){const pixels=[];for(let y=Math.floor(p.h/2)-24;y<Math.floor(p.h/2)+24;y++)for(let x=Math.floor(p.w/2)-60;x<Math.floor(p.w/2)+60;x++){const i=(y*p.w+x)*4;pixels.push([p.data[i],p.data[i+1],p.data[i+2]]);}pixels.sort((a,b)=>(a[0]+2*a[1]+a[2])-(b[0]+2*b[1]+b[2]));
      const mean=arr=>[0,1,2].map(c=>arr.reduce((s,p)=>s+p[c],0)/arr.length),body=mean(pixels.slice(Math.floor(pixels.length*.15),Math.floor(pixels.length*.4))),crest=mean(pixels.slice(Math.floor(pixels.length*.96),Math.floor(pixels.length*.985)));
      return {body,crest,mean:mean(pixels),greyContrast:crest.reduce((s,v,c)=>s+(v-body[c])*[.299,.587,.114][c],0)};
    }
    const cleanParity=[];
    for(const [depth,pitch] of [[.25,1.22],[1.25,1.22],[4.25,1.22],[1.25,.5235987756],[1.25,.18]]){
      const h=bed(depth,0),b=render(before,h,pitch),c=render(mat,h,pitch);let changed=0,maxDelta=0;
      for(let i=0;i<b.data.length;i++){const d=Math.abs(b.data[i]-c.data[i]);if(d)changed++;maxDelta=Math.max(maxDelta,d);}cleanParity.push({depth,pitch,channels:b.data.length,changed,maxDelta});
    }
    const h=bed(1.25,1,0);
    const oldAbove=stats(render(before,h,1.22,false)),oldLow=stats(render(before,h,.18,false));
    const newAbove=stats(render(mat,h)),newLow=stats(render(mat,h,.18));
    const cleanH=bed(1.25,0),cleanLow=stats(render(mat,cleanH,.18));
    const dryH=bed(0,0),dryGround=stats(render(mat,dryH));
    // A controlled bed brightness delta measures actual alpha transmission.
    const terrain=a.high.terrainMat,saved=terrain.fragmentShader;
    const shallowH=bed(.25,1);
    function transmission(material){const values=[];for(const c of [.05,.55]){terrain.fragmentShader=`void main(){gl_FragColor=vec4(vec3(${c}),1.0);}`;terrain.needsUpdate=true;values.push(stats(render(material,shallowH)).mean);}return values[1].map((v,c)=>(v-values[0][c])/(.5*255));}
    const oldTransmission=transmission(before),newTransmission=transmission(mat);terrain.fragmentShader=saved;terrain.needsUpdate=true;
    const hiddenBed=stats(render(mat,shallowH,1.22,false)),visibleBed=stats(render(mat,shallowH));
    for(const [name,depth,contamination] of [['exposed poisoned terrain',0,1],['clean water over poisoned terrain',.25,0],['25% mixing anchor',1.25,.25]]){
      const h=bed(depth,contamination,1),b=render(before,h),c=render(mat,h);let changed=0,maxDelta=0;
      for(let i=0;i<b.data.length;i++){const d=Math.abs(b.data[i]-c.data[i]);if(d)changed++;maxDelta=Math.max(maxDelta,d);}cleanParity.push({name,channels:b.data.length,changed,maxDelta});
    }
    before.dispose();
    return {baseline:'675eb50',cleanParity,dryGround,reflection:{before:{above:oldAbove,grazing:oldLow},after:{above:newAbove,grazing:newLow},cleanGrazing:cleanLow},shallowTransmission:{before:oldTransmission,after:newTransmission},poisonedBed:{hidden:hiddenBed,visible:visibleBed}};
  });
  result.errors=errors;writeFileSync('captures/badwater-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  // RGBA8 stores 25% as 64/255, just above the fixed quarter-mix anchor.
  // Its tiny contribution from the revised bad endpoint may round by one code.
  if(result.cleanParity.some(p=>p.name==='25% mixing anchor'?p.maxDelta>1:p.changed))throw new Error('Clean water or mixing anchor changed');
  const r=result.reflection,newBlue=r.after.grazing.crest[2]-r.after.above.crest[2];
  if(newBlue>6)throw new Error('Cool low-angle reflection remains too strong');
  // The latest request replaces low diffuse contrast with clear troughs/streaks.
  // Sparse specular flecks keep their existing warm colour and duller strength.
  const luminance=rgb=>rgb.reduce((s,v,c)=>s+v*[.299,.587,.114][c],0);
  if(luminance(result.poisonedBed.visible.body)>=luminance(result.dryGround.body)||result.poisonedBed.visible.greyContrast<=result.dryGround.greyContrast)throw new Error('Badwater must be darker and more contrasting than dry ground');
  if(result.shallowTransmission.after.some((v,i)=>v<.4||Math.abs(v-result.shallowTransmission.before[i])>.005))throw new Error('Shallow bed transmission changed');
  const p=result.poisonedBed;
  if(p.visible.body[0]-p.visible.body[1]<20||p.visible.crest[0]-p.hidden.crest[0]<5)throw new Error('Poisoned ground is not visible through warm badwater');
}finally{await browser.close();}
