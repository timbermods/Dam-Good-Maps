import { sample, checkInput, requests } from './terrain';
import { metrics, mapping, prediction } from './settings';
import { crop } from '../landscapes/lib/terrain';
import { sourcesFromHalo } from './hydrology';
import { convert } from './convert';
import { writeTimber, readTimber, mapMetadata } from '../../src/core/format/timber';
import { thumbnailJpeg } from '../../src/core/render/shade';
import { validateMap } from '../../src/core/validate/checks';
const progress=(phase:string)=>postMessage({type:'progress',phase});
export async function run(input:any) {
  const {lat,lon,size}=input;checkInput(lat,lon,size);
  if(input.mpt!==undefined&&![30,60,120].includes(input.mpt)) throw Error('Scale must be 30, 60 or 120 metres per tile.');
  const started=performance.now(),requestStart=requests.length;
  progress('Looking at the surrounding terrain');
  const choices=[];
  for(const mpt of input.mpt?[input.mpt]:[30,60,120]) {
    const low=await sample(lat,lon,size,mpt,0,64), m=metrics(low.raw,64,mpt*size/64),p=prediction(m,mpt);
    choices.push({mpt,metrics:m,prediction:p});
  }
  // Weak preference for the survey's middle scale; never use the place name as a classifier.
  choices.sort((a,b)=>(b.prediction.score-(b.mpt===60?0:3))-(a.prediction.score-(a.mpt===60?0:3)));
  const selected=choices[0],settingsTime=performance.now();
  const ci=selected.metrics.channelIndex;
  if(ci>=0) {
    const east=(ci%64-31.5)*size*selected.mpt/64,north=(Math.floor(ci/64)-31.5)*size*selected.mpt/64;
    if(Math.hypot(east,north)>500) selected.prediction.suggestions.push(`Try ${(Math.hypot(east,north)/1000).toFixed(1)} km ${north>=0?'north':'south'}${east>=0?'east':'west'}, towards inferred drainage (${(lat+north/111320).toFixed(5)}, ${(lon+east/(111320*Math.cos(lat*Math.PI/180))).toFixed(5)}). A real river is unverified.`);
  }
  postMessage({type:'prediction',prediction:selected.prediction});
  progress('Reading the selected area');
  const sampled=await sample(lat,lon,size,selected.mpt,16);
  const raw=crop(sampled.raw,sampled.W,size,16), mapped=mapping(raw);
  const hydro=sourcesFromHalo(sampled.raw,size,16);
  // Sea-floor drainage is not evidence for a fresh-water river. Keep inference explicit.
  hydro.sources=hydro.sources.filter((s:any)=>raw[s.i]>0);
  const fetchedTime=performance.now();
  progress('Simulating water and finding a start');
  const result=convert(mapped.heights,size,16,hydro,`${lat},${lon}/${size}/${selected.mpt}`);
  if(!result.heights.every((v,i)=>v===mapped.heights[i])) throw Error('Conversion changed terrain: no-wall invariant failed.');
  const convertedTime=performance.now();
  const notices=await (await fetch('./ATTRIBUTION.md')).text();
  const provenance={schema:1,algorithm:'pickplace-v1',lat,lon,size,metresPerTile:selected.mpt,source:'AWS Terrain Tiles (Terrarium)',accessed:new Date().toISOString().slice(0,10),pixelMetres:sampled.pixelMetres,zoom:sampled.z,vertical:{min:mapped.lo,max:mapped.hi,levels:mapped.levels,gamma:mapped.gamma},changes:'Bilinear crop, monotonic height mapping, quantisation; inferred game sources, natural slopes and planted resources. No walls, rims or other height edits.',tiles:requests.slice(requestStart),prediction:selected.prediction,currentRules:result.current};
  result.file.metadata=mapMetadata(size,size,`Pick a place: ${lat.toFixed(5)}, ${lon.toFixed(5)}. Inspired by open terrain, at Timberborn scale; not a replica. ${result.current.passed?'Prototype checks passed.':'EXPERIMENTAL: start or validation checks failed.'}\n${notices}`);
  result.file.thumbnail=thumbnailJpeg(result.heights,size,size,result.water.depth);
  result.file.extraFiles=[['ATTRIBUTION.txt',new TextEncoder().encode(notices)],['pickplace.json',new TextEncoder().encode(JSON.stringify(provenance,null,2))]];
  progress('Checking the map file');
  const bytes=writeTimber(result.file), read=readTimber(bytes);
  const reload=validateMap(read,{profile:'export',loadOnly:true});
  if(!reload.report.passed) {result.current.passed=false;result.current.failures.push({id:'file.roundtrip',message:'Reloaded file has load failures; download disabled.'});}
  const heights=result.heights,depth=Float32Array.from(result.water.depth);
  const summary={lat,lon,size,choices,selected,vertical:{...provenance.vertical,cliffShare:mapped.cliffShare,padShare:mapped.padShare},pixelMetres:sampled.pixelMetres,passed:result.current.passed,legacyPassed:result.v.report.passed,current:result.current,checks:result.v.report.checks,settled:result.water.settled,ticks:result.water.ticks,sourceCount:result.sources.length,edgeChanges:result.edgeChanges,start:result.fixture.start,roundTripPassed:reload.report.passed,bytes:bytes.byteLength,timings:{settingsMs:settingsTime-started,fetchMs:fetchedTime-settingsTime,convertMs:convertedTime-fetchedTime,exportMs:performance.now()-convertedTime,totalMs:performance.now()-started},requests:requests.slice(requestStart)};
  return {bytes,heights,depth,summary};
}
self.onmessage=async(e)=>{
  try {const result=await run(e.data);postMessage({type:'result',...result},[result.bytes.buffer,result.heights.buffer,result.depth.buffer]);}
  catch(e) {postMessage({type:'error',error:e instanceof Error?e.stack:String(e)});}
};
