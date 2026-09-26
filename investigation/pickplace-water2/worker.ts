import {sample,checkInput,requests} from './terrain';
import {metrics,mapping,prediction} from './settings';
import {referenceWater,referenceRequests,rangeRequests} from './reference-water';
import {signaturePlan,drama,auditSignatureOrigins} from './signature-water';
import {crop} from '../landscapes/lib/terrain';
import {convert} from './convert';
import {writeTimber,readTimber,mapMetadata} from '../../src/core/format/timber';
import {thumbnailJpeg} from '../../src/core/render/shade';
import {validateMap} from '../../src/core/validate/checks';
import {measure,projectWet} from './measure-water.mjs';
const progress=(phase:string)=>postMessage({type:'progress',phase});
const rank=(r:any,d:any)=>(d.signaturePresent?1e6:0)+(r.current.passed?1e5:0)+d.targetCoverage*10000-r.current.failures.length*100;
function preview(h:Uint8Array,d:Float64Array,W:number){const size=40,heights=[],depth=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=Math.floor((y+.5)*W/size)*W+Math.floor((x+.5)*W/size);heights.push(h[i]);depth.push(d[i]);}return {size,heights,depth};}
export async function run(input:any){
 const {lat,lon,size}=input;checkInput(lat,lon,size);
 if(input.action==='reference'){const r=await referenceWater(lat,lon,size,input.mpt);return {reference:{...r,fraction:Array.from(r.fraction),valid:Array.from(r.valid)}};}
 if(input.mpt!==undefined&&![30,60,120,240].includes(input.mpt))throw Error('Scale must be 30, 60, 120 or 240 metres per tile.');
 const started=performance.now(),attempts:any[]=[],suggestions:any[]=[],choices:any[]=[],scales=input.mpt?[input.mpt]:[60,120,240,30];
 let best:any=null,anchor:any=null,directPassed=false,directMs=0,fetchMs=0,convertMs=0;
 for(const mpt of scales){
  const cfg={lat,lon,size,mpt,reason:mpt===scales[0]?'requested area':'different scale'},t=performance.now();
  progress('Finding the place’s lakes, coast and rivers');
  try{
   const [sampled,reference]=await Promise.all([sample(lat,lon,size,mpt,16),referenceWater(lat,lon,size,mpt)]);
   anchor??={reference,frame:{lat,lon,size,mpt}};
   const raw=crop(sampled.raw,sampled.W,size,16),mapped=mapping(raw),m=metrics(raw,size,mpt),pred=prediction(m,mpt);choices.push({mpt,metrics:m,prediction:pred});postMessage({type:'prediction',prediction:pred});fetchMs+=performance.now()-t;
   for(const variant of [0,1,2]){
    progress(`Filling signature water, then finding its shore (${mpt} m/tile)`);
    const vertical=variant===2?{...mapped,heights:Uint8Array.from(mapped.heights,h=>1+Math.round((h-1)*.6)),levels:Math.round(mapped.levels*.6)}:mapped;
    const plan=signaturePlan(raw,vertical.heights,size,reference,variant,{raw:sampled.raw,W:sampled.W,halo:16}),s=performance.now();
    const result=convert(plan.heights,size,16,plan,`${lat},${lon}/${size}/${mpt}/signature/${variant}`),quality=drama(plan,result.water.depth,reference,size);
    const anchorMeasure=measure(anchor.reference.fraction,projectWet(result.water.depth,cfg,anchor.frame),size,anchor.reference.coverage);
    Object.assign(quality,{anchor:anchorMeasure,ownSignaturePresent:quality.signaturePresent});
    quality.signaturePresent=quality.signaturePresent&&anchorMeasure.signaturePresent!==false;
    const origin=result.current.passed&&quality.signaturePresent?auditSignatureOrigins(result.heights,size,result.sources):{checked:false,passed:false,policy:'Not accepted: playability or signature already failed.'};
    Object.assign(plan.originAudit,{canonical:origin});
    if(result.current.passed&&quality.signaturePresent&&!origin.passed){result.current.passed=false;result.current.failures.push({id:'water.source_origins',message:'Another head already wets an interior source site, or its independent flow does not settle.'});}
    if(plan.landEdits||!result.heights.every((v,i)=>v===plan.heights[i]))throw Error('Land/no-wall invariant failed');
    convertMs+=performance.now()-s;
    const accepted=result.current.passed&&quality.signaturePresent;
    attempts.push({...cfg,variant,passed:result.current.passed,accepted,drama:quality,failures:result.current.failures,sources:result.sources,bedCells:plan.bedCells,landEdits:plan.landEdits,settled:result.water.settled,ms:performance.now()-s});
    const candidate={result,cfg,mapped:vertical,raw,sampled,reference,plan,quality,accepted,attemptIndex:attempts.length-1};
    if(!best||rank(result,quality)>rank(best.result,best.quality))best=candidate;
    suggestions.push({...cfg,passed:accepted,failures:result.current.failures,drama:quality,preview:preview(result.heights,result.water.depth,size)});
    if(accepted)break;
   }
   if(mpt===scales[0]){directPassed=attempts.some(a=>a.accepted);directMs=performance.now()-started;}
   if(best.accepted)break;
  }catch(e){if(String(e).includes('invariant'))throw e;attempts.push({...cfg,error:String(e),passed:false,accepted:false,ms:performance.now()-t});}
 }
 if(!best)throw Error('The elevation or water reference could not be read.');
 const {result,cfg,mapped,sampled,reference,plan,quality}=best,selected=choices.find(c=>c.mpt===cfg.mpt),convertedTime=performance.now();
 const notices=await(await fetch('./ATTRIBUTION.md')).text();
 const waterDesign={...plan,heights:undefined,target:undefined,mask:undefined,groups:undefined};
 const provenance={schema:3,algorithm:'pickplace-signature-water-v4',base:'91981517f747fa345b5586b9f036aedb74255b1b',requested:{lat,lon,size,mpt:input.mpt??'auto'},...cfg,source:'AWS Terrain Tiles + ESA WorldCover 2021 v200',accessed:new Date().toISOString(),changes:'Quantised real land. Designed beds only in observed permanent-water cells; no walls, rims or dry-land edits. Sources at water origins; start selected after water.',waterDesign,drama:quality,tiles:requests,referenceRequests,rangeRequests,referenceErrors:reference.errors,currentRules:result.current,attempts};
 result.file.metadata=mapMetadata(size,size,`Pick a place: ${lat}, ${lon}. Signature water first. ${best.accepted?'Local playability and signature checks passed.':'EXPERIMENTAL: local checks or signature missing.'}\n${notices}`);
 result.file.thumbnail=thumbnailJpeg(result.heights,size,size,result.water.depth);
 result.file.extraFiles=[['ATTRIBUTION.txt',new TextEncoder().encode(notices)],['pickplace.json',new TextEncoder().encode(JSON.stringify(provenance))]];
 const bytes=writeTimber(result.file),reload=validateMap(readTimber(bytes),{profile:'export',loadOnly:true});
 if(!reload.report.passed){result.current.passed=false;result.current.failures.push({id:'file.roundtrip',message:'Export reload failed.'});}
 const summary={lat,lon,size,requested:{lat,lon,size},choices,selected,vertical:{min:mapped.lo,max:mapped.hi,levels:mapped.levels,gamma:mapped.gamma},passed:best.accepted&&reload.report.passed,playabilityPassed:result.current.passed,signatureWaterDistance:Number.isFinite(result.start?.waterDistance)?result.start.waterDistance:null,directPassed,firstPlanPassed:attempts[0]?.accepted??false,current:result.current,settled:result.water.settled,ticks:result.water.ticks,sourceCount:result.sources.length,waterDesign,drama:quality,landEdits:plan.landEdits,edgeChanges:0,bedCells:plan.bedCells,start:result.fixture.start,roundTripPassed:reload.report.passed,bytes:bytes.byteLength,reference:{coverage:reference.coverage,errors:reference.errors,requests:referenceRequests,ranges:rangeRequests},autoTry:{attempts,selectedAttempt:best.attemptIndex,suggestions},timings:{fetchMs,convertMs,directMs,retryMs:convertedTime-started-directMs,exportMs:performance.now()-convertedTime,totalMs:performance.now()-started},requests};
 return {bytes,heights:result.heights,depth:Float32Array.from(result.water.depth),reference:Float32Array.from(reference.fraction),summary};
}
self.onmessage=async e=>{try{postMessage({type:'result',...await run(e.data)});}catch(e){postMessage({type:'error',error:e instanceof Error?e.stack:String(e)});}};
