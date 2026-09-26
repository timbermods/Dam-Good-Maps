import { createCanvas, ImageData } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { CarveRun, DEFAULTS, placeSource, objects, type CarveMap, type Settings } from './engine';
import { fixture, loadMap, placeMap } from './maps';
import { canonicalSettle } from '../../src/core/sim/prefill';
import { modelFor } from './engine';
import { topDown, isometric, type Picture } from '../workshop/lib/render';
import { drainage } from '../generative/proto/erode';
import { snapshot } from './meshes';
mkdirSync('captures',{recursive:true});
type Frame={map:CarveMap;label:string;cut:number;deposited:number};
function picture(p:Picture) {
 const c=createCanvas(p.w,p.h),ctx=c.getContext('2d'),rgba=new Uint8ClampedArray(p.w*p.h*4);
 for(let i=0;i<p.w*p.h;i++){rgba[i*4]=p.rgb[i*3];rgba[i*4+1]=p.rgb[i*3+1];rgba[i*4+2]=p.rgb[i*3+2];rgba[i*4+3]=255;}
 ctx.putImageData(new ImageData(rgba,p.w,p.h),0,0);return c;
}
function sheet(file:string,title:string,frames:Frame[]){
 const w=420*frames.length,h=710,c=createCanvas(w,h),ctx=c.getContext('2d');
 ctx.fillStyle='#f4f2e9';ctx.fillRect(0,0,w,h);ctx.fillStyle='#263e38';ctx.font='bold 22px sans-serif';ctx.fillText(title,18,31);
 frames.forEach((f,k)=>{
  const m=f.map,x=k*420;
  ctx.fillStyle='#263e38';ctx.font='bold 17px sans-serif';ctx.fillText(f.label,x+18,63);
  ctx.font='13px sans-serif';ctx.fillText('cut '+f.cut+' / deposited '+f.deposited+' block-volumes',x+18,86);
  const a=picture(isometric(m.heights,m.W,m.H,m.water.depth,m.water.contamination,objects(m.entities),540));
  ctx.drawImage(a,x+8,100,404,255);
  const b=picture(topDown(m.heights,m.W,m.H,m.water.depth,m.water.contamination,objects(m.entities),360));
  ctx.imageSmoothingEnabled=false;ctx.drawImage(b,x+65,365,290,290);
  ctx.font='12px sans-serif';ctx.fillStyle='#5d7168';ctx.fillText('North up · cyan source · red start',x+65,674);
 });
 ctx.fillStyle='#5d7168';ctx.font='12px sans-serif';ctx.fillText('CPU renders of actual stored states. Intermediate water is live; final panels use repository canonical settle. No GPU timing claim.',18,699);
 writeFileSync('captures/'+file+'.png',c.toBuffer('image/png'));
}
function input(m:CarveMap,tile?:number) {
 if(tile===undefined){
  const d=drainage(m.heights,m.W,m.H,{eight:false});let best=-Infinity;tile=0;
  for(let i=0;i<m.heights.length;i+=7){
   if(m.heights[i]<9||i%m.W<4||i%m.W>m.W-5||Math.floor(i/m.W)<4||Math.floor(i/m.W)>m.H-5)continue;
   let j=i,len=0,pool=false,low=m.heights[i];
   for(;j>=0&&len<500;j=d.rcv[j],len++){low=Math.min(low,m.heights[j]);if(d.filled[j]-m.heights[j]>1||m.water.depth[j]>.9)pool=true;}
   const score=(pool?100:0)+(m.heights[i]-low)*3+Math.min(100,len)*.1;
   if(score>best){best=score;tile=i;}
  }
 }
 return placeSource(m,tile,4);
}
const results:Record<string,unknown>={};
function sequence(id:string,title:string,m:CarveMap,settings:Settings,at:number[]){
 const run=new CarveRun(m,settings),frames:Frame[]=[{map:snapshot(m),label:'Before',cut:0,deposited:0}];
 let finalWater;
 for(let k=1;k<=at[at.length-1];k++){
  run.step();
  if(at.includes(k)){
   const s=snapshot(run.map);
   if(k===at[at.length-1]){finalWater=canonicalSettle(modelFor(s));s.water={depth:finalWater.depth,contamination:finalWater.contamination};}
   frames.push({map:s,label:(run.metrics.steps/10)+' s'+(k===at[at.length-1]?' · final':' · running'),cut:run.metrics.cut,deposited:run.metrics.deposited});
  }
 }
 results[id]={source:m.entities.find(e=>e.id==='carve-source'),settings,metrics:run.metrics,canonical:finalWater?{settled:finalWater.settled,ticks:finalWater.ticks}:null};
 sheet(id,title,frames);
 return frames[frames.length-1];
}
const study=input(fixture('mountain',64),54*64+32);
const wide=sequence('mountain-lake','Mountain into a lake · whole-level incision and a delta',study,DEFAULTS,[100,800]);
const steep=sequence('stepped-canyon','Hard bands · slower incision leaves lips and benches',study,{...DEFAULTS,walls:'steep'},[100,800]);
sheet('steep-wide','Same source, duration and layers · walls control bank retreat',[
 {map:snapshot(study),label:'Before',cut:0,deposited:0},{...steep,label:'Steep · 80 s'},{...wide,label:'Wide · 80 s'}
]);
sequence('long-valley','Long run · valley widening and deposition in the basin',study,DEFAULTS,[800,6400]);
sequence('bends','Existing bends grow through outside-bank erosion',input(fixture('bends',64),54*64+33),DEFAULTS,[400,2400]);
sequence('generated-highlands','M9 Highlands · seed 18 · 128 x 128',input(await loadMap('seed:highlands:18:128')),DEFAULTS,[200,800]);
sequence('real-yosemite','Real places library · Near Yosemite Valley',input(placeMap(readFileSync('../../public/real-places/data/near-yosemite-valley.json.gz'))),DEFAULTS,[200,800]);
writeFileSync('captures/scenarios.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
