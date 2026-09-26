// Software rendering only. Does not measure or claim the user's GPU performance.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
mkdirSync('captures', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(300_000);
const errors=[];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
const report={ renderer:'', maps:[], captures:[], checks:{}, errors };
try {
  await page.goto('http://127.0.0.1:4197');
  await page.waitForFunction(()=>window.maplook2?.ready);
  await page.evaluate(()=>window.maplook2.freeze());
  report.renderer=await page.evaluate(()=>window.maplook2.standard.gpu().renderer);
  console.log('Renderer:',report.renderer);
  const smoke=process.argv.includes('--smoke');
  async function capture(name,kind,turn=0,pitch=null){
    const found=await page.evaluate(({kind,turn,pitch})=>{
      const a=window.maplook2;const found=a.setPose(kind);
      if(turn)a.camera({yaw:a.standard.getView().yaw+turn});if(pitch!==null)a.camera({pitch});a.freeze();return found;
    },{kind,turn,pitch});
    if(!found){console.log('No pose:',name,kind);return;}
    await page.waitForTimeout(150);
    const camera=await page.evaluate(()=>window.maplook2.standard.getView());
    const meanings=await page.evaluate(()=>{
      const a=window.maplook2,m=a.map,r=a.high,rect=r.canvas.getBoundingClientRect();
      const water=new Map();for(let k=0;k<m.water.count;k++){const i=m.water.tile[k];if(!water.has(i)||m.water.floor[k]>water.get(i).floor)water.set(i,{floor:m.water.floor[k],depth:m.water.depth[k],bad:m.water.contamination[k]});}
      const occupied=new Set();for(let k=0;k<m.entities.count;k++)occupied.add(m.entities.y[k]*m.W+m.entities.x[k]);
      const candidates=[];
      for(let i=0;i<m.heights.length;i++){
        if(occupied.has(i))continue;
        const x=i%m.W,y=Math.floor(i/m.W),w=water.get(i),wet=w&&w.depth>0.05&&w.floor>=m.heights[i]-0.01;
        const z=wet?w.floor+w.depth:m.heights[i],p=r.project(x+0.5,z,-y-0.5);
        if(!p.visible||p.x<30||p.y<30||p.x>rect.width-30||p.y>rect.height-30)continue;
        const hit=r.pick(rect.left+p.x,rect.top+p.y);if(!hit)continue;
        if(wet?hit.point[1]>z+0.01:hit.x!==x||hit.y!==y||hit.face!=='top')continue;
        const c=m.soil.contamination[i],moist=m.soil.moisture[i];
        const meaning=wet?(w.bad>=0.95?'badwater':w.bad>0.05?'mixed water':'clean water'):(c>25?(moist>0?'moist contaminated':'dry contaminated'):(moist>0?'moist':'dry'));
        candidates.push({meaning,tile:[x,y],pixel:[Math.round(p.x),Math.round(p.y)],depth:wet?w.depth:0,bad:wet?w.bad:0,moisture:moist,contamination:c,distance:Math.hypot(p.x-rect.width/2,p.y-rect.height/2)});
      }
      candidates.sort((a,b)=>a.distance-b.distance);const out={};
      for(const c of candidates)if((out[c.meaning]?.length??0)<2){(out[c.meaning]??=[]).push(c);}
      return out;
    });
    await page.locator('main').screenshot({path:`captures/${name}.jpg`,type:'jpeg',quality:76});
    report.captures.push({file:`${name}.jpg`,kind,camera,meanings});
    console.log('Captured',name);
  }
  await capture('river-128-start','start');
  await capture('river-128-falls','falls');
  if(smoke){await page.screenshot({path:'captures/demo.jpg',type:'jpeg',quality:75});}
  else {
    // Pixel parity proves the disabled High path still draws today's clean materials.
    report.checks.disabledParity=await page.evaluate(()=>{
      const a=window.maplook2;a.toggle(false,false);a.freeze();
      function pixels(renderer){renderer.renderNow();const g=renderer.canvas.getContext('webgl2');const p=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,p);return p;}
      const l=pixels(a.standard),r=pixels(a.high);let changed=0,max=0;
      for(let i=0;i<l.length;i++){const d=Math.abs(l[i]-r[i]);if(d)changed++;max=Math.max(max,d);}
      a.toggle(true,true);a.freeze();return {changedChannels:changed,maxDelta:max,totalChannels:l.length};
    });
    report.checks.effects=await page.evaluate(()=>{
      const a=window.maplook2;
      function hash(r){r.renderNow();const g=r.canvas.getContext('webgl2');const p=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,p);let h=2166136261;for(const v of p)h=Math.imul(h^v,16777619);return h>>>0;}
      const result=[];
      for(const [water,shadows] of [[false,false],[true,false],[false,true],[true,true]]){a.toggle(water,shadows);a.freeze();result.push({water,shadows,standard:hash(a.standard),high:hash(a.high),passes:a.effects.passes});}
      a.effects.sunAngle(35);a.freeze();const turned={standard:hash(a.standard),high:hash(a.high)};
      a.effects.sunAngle(0);a.freeze(11);const movedWater=hash(a.high);a.freeze(8);
      return {modes:result,turned,movedWater};
    });
    const options=await page.evaluate(()=>window.maplook2.options);
    for(let i=0;i<options.length;i++){
      if(i)await page.evaluate(i=>window.maplook2.load(i),i);
      const entry=await page.evaluate(()=>{
        const a=window.maplook2;a.freeze();const m=a.map;
        return {label:a.label,W:m.W,H:m.H,objects:m.entities.count,waterColumns:m.water.count,caveColumns:m.columns.tiles.length,badwater:Array.from(m.water.contamination).filter(c=>c>=0.95).length,mixed:Array.from(m.water.contamination).filter(c=>c>0.05&&c<0.95).length,moist:Array.from(m.soil.moisture).filter(v=>v>0).length,contaminated:Array.from(m.soil.contamination).filter(v=>v>0).length};
      });
      report.maps.push(entry);console.log('Loaded',i,entry.label);
      if(i===0){await capture('river-128-badwater','badwater');await capture('river-128-soil','contaminated');await capture('river-128-ruins','ruins');}
      if(i===1){await capture('river-256-meeting','mixed');await capture('river-256-overview','overview');}
      if(i===6){await capture('lake-128-shore','shore');await capture('lake-128-shore-low','shore',Math.PI/3,0.35);}
      if(i===12)await capture('real-victoria-falls','falls');
      if(i===13)await capture('real-yosemite-cliff','cliff');
      if(i===15)await capture('m9-canyon-falls','falls');
      if(i===options.length-1)await capture('m9-river-start','start');
    }
    await page.evaluate(()=>window.maplook2.load(0));
    await page.evaluate(()=>{window.maplook2.setPose('start');window.maplook2.freeze();});
    for(const [name,water,shadows] of [['water-only',true,false],['shadows-only',false,true]]){
      await page.evaluate(({water,shadows})=>{window.maplook2.toggle(water,shadows);window.maplook2.freeze();},{water,shadows});
      await page.locator('main').screenshot({path:`captures/${name}.jpg`,type:'jpeg',quality:76});
    }
    await page.evaluate(()=>{window.maplook2.toggle(true,true);window.maplook2.freeze();});
    // Camera input really propagates from either pane, not just scripted poses.
    const box=await page.locator('#high').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2+15,{steps:5});await page.mouse.up();
    await page.waitForTimeout(200);
    report.checks.syncedCamera=await page.evaluate(()=>JSON.stringify(window.maplook2.standard.getView())===JSON.stringify(window.maplook2.high.getView()));
    await capture('river-128-start-angle','start',Math.PI/2);
    await page.screenshot({path:'captures/demo.jpg',type:'jpeg',quality:75});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  if(!smoke){
    const e=report.checks.effects,m=e.modes;
    if(report.checks.disabledParity.maxDelta>0 || !report.checks.syncedCamera)throw new Error('Comparison checks failed');
    if(new Set(m.map(v=>v.standard)).size!==1 || new Set(m.map(v=>v.high)).size!==4 || e.turned.high===m[3].high || e.turned.standard!==m[3].standard || e.movedWater===m[3].high)throw new Error('Effect independence / animation checks failed');
  }
} finally {
  writeFileSync(`captures/${process.argv.includes('--smoke')?'smoke':'verification'}.json`,JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
