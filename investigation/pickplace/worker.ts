import { sample, checkInput, requests } from './terrain';
import { metrics, mapping, prediction } from './settings';
import { designWater, auditOrigins, type Intention } from './designed-water';
import { crop } from '../landscapes/lib/terrain';
import { convert } from './convert';
import { writeTimber, readTimber, mapMetadata } from '../../src/core/format/timber';
import { thumbnailJpeg } from '../../src/core/render/shade';
import { validateMap } from '../../src/core/validate/checks';
const progress=(phase:string)=>postMessage({type:'progress',phase});
const rank=(r:any)=>(r.current.passed?1e6:0)-r.current.failures.length*1000+(r.water.settled?500:0)+Math.min(200,r.selection.moistWithin20)-(r.current.waterDistance??100);
function preview(h:Uint8Array,d:Float64Array,W:number) {
  const size=40,heights:number[]=[],depth:number[]=[];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=Math.floor((y+.5)*W/size)*W+Math.floor((x+.5)*W/size);heights.push(h[i]);depth.push(Math.round(d[i]*100)/100);}
  return {size,heights,depth};
}
export async function run(input:any) {
  const {lat,lon,size}=input;checkInput(lat,lon,size);
  if(input.mpt!==undefined&&![30,60,120].includes(input.mpt)) throw Error('Scale must be 30, 60 or 120 metres per tile.');
  const intention:Intention=input.intention??'balanced';
  if(!['balanced','waterfall','basin'].includes(intention))throw Error('Unknown water intention.');
  const started=performance.now(),requestStart=requests.length;
  progress('Looking at the surrounding terrain');
  const choices=[];
  for(const mpt of input.mpt?[input.mpt]:[30,60,120]) {
    const low=await sample(lat,lon,size,mpt,0,64),m=metrics(low.raw,64,mpt*size/64);
    choices.push({mpt,metrics:m,prediction:prediction(m,mpt)});
  }
  choices.sort((a,b)=>(b.prediction.score-(b.mpt===60?0:3))-(a.prediction.score-(a.mpt===60?0:3)));
  const settingsTime=performance.now(),initial=choices[0];
  postMessage({type:'prediction',prediction:initial.prediction});
  const configs=[{lat,lon,size,mpt:initial.mpt,reason:'requested area'}];
  if(input.autoTry!==false) {
    for(const mpt of [30,60,120])if(mpt!==initial.mpt)configs.push({lat,lon,size,mpt,reason:'different scale'});
    for(const n of [96,128,256])if(n!==size)configs.push({lat,lon,size:n,mpt:initial.mpt,reason:'different size'});
    const ci=initial.metrics.channelIndex;
    let east=ci>=0?(ci%64-31.5)/64*size*initial.mpt:0;
    let north=ci>=0?(Math.floor(ci/64)-31.5)/64*size*initial.mpt:size*initial.mpt*.5;
    if(Math.hypot(east,north)<500)north=size*initial.mpt*.5;
    for(const sign of [1,-1])configs.push({lat:Math.max(-84.9,Math.min(84.9,lat+sign*north/111320)),lon:((lon+sign*east/(111320*Math.cos(lat*Math.PI/180))+540)%360)-180,size,mpt:initial.mpt,reason:'nearby area'});
  }
  const attempts:any[]=[],suggestions:any[]=[];let best:any=null,directPassed=false,directMs=0,fetchMs=0,convertMs=0;
  for(let c=0;c<configs.length;c++) {
    const cfg=configs[c],t=performance.now();
    progress(c?'Finding a better opening':'Designing water for the terrain');
    try {
      const sampled=await sample(cfg.lat,cfg.lon,cfg.size,cfg.mpt,16),raw=crop(sampled.raw,sampled.W,cfg.size,16),mapped=mapping(raw);
      const plans=designWater(raw,mapped.heights,cfg.size,intention,{raw:sampled.raw,W:sampled.W,halo:16}),fetched=performance.now();fetchMs+=fetched-t;
      let cropBest:any=null;
      for(const plan of plans) {
        const s=performance.now(),result=convert(mapped.heights,cfg.size,16,plan,`${cfg.lat},${cfg.lon}/${cfg.size}/${cfg.mpt}/${plan.variant}`);
        const originAudit=result.current.passed?auditOrigins(result.heights,cfg.size,result.sources):{checked:false,passed:false,policy:'Not accepted: opening/settling checks already failed.'};
        if(result.current.passed&&!originAudit.passed){result.current.passed=false;result.current.failures.push({id:'water.source_origins',message:'A tributary head is flooded by another river or its independent flow does not settle.'});}
        convertMs+=performance.now()-s;
        if(!result.heights.every((v,i)=>v===mapped.heights[i]))throw Error('Conversion changed terrain: no-wall invariant failed.');
        attempts.push({...cfg,variant:plan.variant,passed:result.current.passed,failures:result.current.failures,waterDistance:result.current.waterDistance,settled:result.water.settled,ticks:result.water.ticks,sources:result.sources,originAudit,ms:performance.now()-s});
        const candidate={result,cfg,mapped,sampled,raw,plan,originAudit,attemptIndex:attempts.length-1};
        if(!cropBest||rank(result)>rank(cropBest.result))cropBest=candidate;
        if(!best||rank(result)>rank(best.result))best=candidate;
        if(result.current.passed)break;
      }
      suggestions.push({...cfg,passed:cropBest.result.current.passed,failures:cropBest.result.current.failures,preview:preview(cropBest.result.heights,cropBest.result.water.depth,cfg.size)});
      if(c===0){directPassed=cropBest.result.current.passed;directMs=performance.now()-started;}
      if(best.result.current.passed)break;
    }catch(e) {
      if(String(e).includes('no-wall invariant'))throw e;
      attempts.push({...cfg,passed:false,error:String(e),ms:performance.now()-t});
      if(c===0)directMs=performance.now()-started;
    }
  }
  if(!best)throw Error('Terrain could not be fetched. Try again when the source is available.');
  const {result,cfg,mapped,sampled,raw,plan,originAudit}=best,m=metrics(raw,cfg.size,cfg.mpt);
  const selected={mpt:cfg.mpt,metrics:m,prediction:prediction(m,cfg.mpt)},convertedTime=performance.now();
  const notices=await (await fetch('./ATTRIBUTION.md')).text();
  const provenance={schema:2,algorithm:'pickplace-designed-water-v3-heads-only',requested:{lat,lon,size,mpt:input.mpt??'auto'},...cfg,intention,source:'AWS Terrain Tiles (Terrarium)',accessed:new Date().toISOString().slice(0,10),pixelMetres:sampled.pixelMetres,zoom:sampled.z,vertical:{min:mapped.lo,max:mapped.hi,levels:mapped.levels,gamma:mapped.gamma},changes:'Bilinear crop, monotonic height mapping, quantisation; designed game water sources, natural slopes and planted resources. No walls, rims or other height edits.',tiles:requests.slice(requestStart),waterDesign:plan,originAudit,currentRules:result.current,attempts};
  result.file.metadata=mapMetadata(cfg.size,cfg.size,`Pick a place: ${cfg.lat.toFixed(5)}, ${cfg.lon.toFixed(5)}. Real terrain, designed water. ${result.current.passed?'Local prototype checks passed.':'EXPERIMENTAL: checks failed.'}\n${notices}`);
  result.file.thumbnail=thumbnailJpeg(result.heights,cfg.size,cfg.size,result.water.depth);
  result.file.extraFiles=[['ATTRIBUTION.txt',new TextEncoder().encode(notices)],['pickplace.json',new TextEncoder().encode(JSON.stringify(provenance,null,2))]];
  progress('Checking the map file');
  const bytes=writeTimber(result.file),reload=validateMap(readTimber(bytes),{profile:'export',loadOnly:true});
  if(!reload.report.passed){result.current.passed=false;result.current.failures.push({id:'file.roundtrip',message:'Reloaded file has load failures; download disabled.'});}
  const summary={lat:cfg.lat,lon:cfg.lon,size:cfg.size,requested:{lat,lon,size},choices,selected,vertical:{...provenance.vertical,cliffShare:mapped.cliffShare,padShare:mapped.padShare},pixelMetres:sampled.pixelMetres,passed:result.current.passed,directPassed,firstPlanPassed:attempts[0]?.passed??false,legacyPassed:result.v.report.passed,current:result.current,checks:result.v.report.checks,settled:result.water.settled,ticks:result.water.ticks,sourceCount:result.sources.length,waterDesign:plan,originAudit,edgeChanges:result.edgeChanges,start:result.fixture.start,roundTripPassed:reload.report.passed,bytes:bytes.byteLength,autoTry:{enabled:input.autoTry!==false,attempts,selectedAttempt:best.attemptIndex,suggestions},timings:{settingsMs:settingsTime-started,fetchMs,convertMs,exportMs:performance.now()-convertedTime,directMs,retryMs:Math.max(0,convertedTime-started-directMs),totalMs:performance.now()-started},requests:requests.slice(requestStart)};
  return {bytes,heights:result.heights,depth:Float32Array.from(result.water.depth),summary};
}
self.onmessage=async(e)=>{
  try {const result=await run(e.data);postMessage({type:'result',...result},[result.bytes.buffer,result.heights.buffer,result.depth.buffer]);}
  catch(e){postMessage({type:'error',error:e instanceof Error?e.stack:String(e)});}
};
