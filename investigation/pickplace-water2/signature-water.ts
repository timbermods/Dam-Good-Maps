import { neighbours,drainage } from '../landscapes/lib/terrain';
import { designWater } from './designed-water';
import { prefill,canonicalSettle,spillLevels } from '../../src/core/sim/prefill';
import { waterModel } from '../../src/core/sim/model';
export function components(mask:Uint8Array,W:number) {
 const seen=new Uint8Array(mask.length),out:number[][]=[];
 for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){const q=[i];seen[i]=1;for(let k=0;k<q.length;k++)for(const j of neighbours(q[k],W,W,false))if(mask[j]&&!seen[j]){seen[j]=1;q.push(j);}out.push(q);}
 return out.sort((a,b)=>b.length-a.length);
}
/** Exact union of prefill's non-increasing spill-surface walks. If a cell is
 * unreachable here, its prefill depth is exactly zero for any positive flows.
 * This only skips redundant screening; final canonical audits are unchanged. */
export function prefillReach(model:any){
 const W=model.W,H=model.H,N=W*H,spill=spillLevels(model),seen=new Uint8Array(N),queue=new Int32Array(N);let head=0,tail=0;
 for(const s of model.emitters)if(s.strength>0)for(const i of s.cells)if(!seen[i]){seen[i]=1;queue[tail++]=i;}
 while(head<tail){const i=queue[head++],x=i%W,y=Math.floor(i/W);for(const j of [y?i-W:-1,x?i-1:-1,y<H-1?i+W:-1,x<W-1?i+1:-1])if(j>=0&&!seen[j]&&spill[j]<=spill[i]){seen[j]=1;queue[tail++]=j;}}
 return seen;
}
const edge=(i:number,W:number)=>i<W||i>=W*(W-1)||i%W===0||i%W===W-1;
export function signaturePlan(raw:Float32Array,original:Uint8Array,W:number,reference:any,variant=0,halo?:any) {
 const h=original.slice(),mask=Uint8Array.from(reference.fraction as Float32Array,f=>f>=.08?1:0),groups=components(mask,W).filter(c=>c.length>=4&&c.reduce((s,i)=>s+reference.fraction[i],0)>=3),sources:any[]=[],features:any[]=[],target=new Uint8Array(h.length);
 const q=(values:number[],p:number)=>values.sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
 // Reference-derived beds are designed underwater geometry; dry land is unchanged.
 for(const cells of groups){
  const fid=`water-${features.length}`,edges=cells.filter(i=>edge(i,W)),zs=cells.map(i=>raw[i]),lo=q(zs,.1),hi=q(zs,.9),nearSea=q(zs,.5)<3;
  const interior=cells.filter(i=>neighbours(i,W,W,false).filter(j=>mask[j]).length===4).length/cells.length;
  const core=cells.filter(i=>reference.fraction[i]>.8).map(i=>raw[i]),flat=core.length>5&&q(core,.7)-q(core,.3)<8;
  const broad=cells.length>W*2,lakeLike=flat&&interior>.2&&cells.length>12;
  const kind=edges.length&&nearSea&&broad?'sea opening':edges.length&&lakeLike?'open lake':!edges.length&&lakeLike?'lake':'river';
  let level=q(cells.map(i=>original[i]),.5);
  // Terrain Tiles may contain bathymetry, not a sea surface. Anchor open sea to
  // mapped zero metres, rather than mistaking its negative elevations for a river.
  if(kind==='sea opening'){let zero=0;for(let i=1;i<raw.length;i++)if(Math.abs(raw[i])<Math.abs(raw[zero]))zero=i;level=original[zero];}
  const bedDepth=variant===2?2:1;
  for(const i of cells){target[i]=1;h[i]=Math.max(0,Math.min(original[i],(kind==='river'?original[i]:level)-bedDepth));}
  let heads:number[]=[];
  if(kind==='sea opening'||kind==='open lake')heads=edges;
  else if(kind==='lake'){
   // A new, independent lake begins at one spring within its basin (user decision).
   heads=[cells.reduce((a,b)=>raw[a]<raw[b]?a:b)];
  }else if(edges.length){
   const edgeMask=new Uint8Array(h.length);for(const i of edges)edgeMask[i]=1;
   const mouths=components(edgeMask,W).sort((a,b)=>q(b.map(i=>raw[i]),.5)-q(a.map(i=>raw[i]),.5));
   const top=q(mouths[0].map(i=>raw[i]),.5),bottom=q(mouths.at(-1)!.map(i=>raw[i]),.5);
   // Upstream mouths only, side-by-side sources spanning each inlet. Never outlet boosters.
   for(const mouth of mouths)if(mouth===mouths[0]||q(mouth.map(i=>raw[i]),.5)>bottom+(top-bottom)*.65)heads.push(...mouth);
  }else{
   const first=cells.reduce((a,b)=>raw[a]>raw[b]?a:b),banks=neighbours(first,W,W,false).filter(i=>!mask[i]&&raw[i]>=raw[first]);
   if(banks.length)heads=[banks.sort((a,b)=>raw[a]-raw[b])[0]];
  }
  const total=(kind==='river'?Math.max(1.5,heads.length*1.2):Math.max(.05,cells.length*.00012))*(variant===1?2:1);
  for(const i of heads)sources.push({i,area:cells.length,strength:Math.min(8,total/Math.max(1,heads.length)),featureId:fid,headId:fid,kind:edge(i,W)?kind==='river'?'upstream river entry':'sea/lake edge opening':kind==='lake'?'basin spring':'river head spring'});
  features.push({id:fid,kind,cells:cells.length,referenceArea:cells.reduce((s,i)=>s+reference.fraction[i],0),heads:heads.length,rawRange:[lo,hi]});
 }
 if(!features.length){
  // No observed signature water: prefer a long drainage course, then the old opening fallback.
  const plans=designWater(raw,h,W,'waterfall',halo),plan=plans[0];
  const d=drainage(raw,W,W);let best:any=null;
  for(const p of plans)for(const s of p.sources)if(!best||(s.routeLength??0)>(best.routeLength??0))best=s;
  if(best){const source={...best,strength:6*Math.sqrt(W/128)*(variant===1?2:1),featureId:'designed-drainage',headId:'designed-drainage'};sources.push(source);let i=source.i,steps=0;while(i>=0&&steps++<h.length){target[i]=1;i=d.to[i];}features.push({id:'designed-drainage',kind:'designed drainage (no observed water)',cells:steps,referenceArea:0,heads:1});}
  else sources.push(...plan.sources);
 }
 if(groups.length){const total=reference.waterCells;target.fill(0);for(let k=0;k<features.length;k++)if(features[k].referenceArea>=Math.max(3,total*.03))for(const i of groups[k])target[i]=1;}
 // A downstream water fragment must not receive a booster. Origins belonging to
 // an already-fed drainage route are removed; sea fronts are a single boundary head.
 const route=drainage(h,W,W),fed=new Uint8Array(h.length),kept:any[]=[];
 const batches=new Map<string,any[]>();for(const s of sources){if(!batches.has(s.headId))batches.set(s.headId,[]);batches.get(s.headId)!.push(s);}
 const ordered=[...batches.values()].sort((a,b)=>raw[b[0].i]-raw[a[0].i]);
 for(const batch of ordered){if(batch.every(s=>!edge(s.i,W)&&fed[s.i]))continue;kept.push(...batch);for(const s of batch){let i=s.i,n=0;while(i>=0&&!fed[i]&&n++<h.length){fed[i]=1;i=route.to[i];}}}
 // A lake spring may feed its own new lake. It may not sit in water supplied by
 // another head. Test whole head clusters together, retaining their edge footprints.
 let final=kept;const removed:string[]=[];
 for(const batch of [...ordered].reverse())if(batch.some(s=>!edge(s.i,W))&&final.some(s=>s.headId===batch[0].headId)){
  const model=waterModel(W,W,h,[]);model.emitters=final.map(s=>({cells:[s.i],strength:s.headId===batch[0].headId?0:s.strength,contamination:0}));
  const reachable=prefillReach(model);if(batch.every(s=>!reachable[s.i]))continue;
  const water=prefill(model);
  if(batch.some(s=>water.depth[s.i]>.05)){removed.push(batch[0].headId);final=final.filter(s=>s.headId!==batch[0].headId);}
 }
 return {heights:h,target,mask,groups,features,sources:final,outlets:[],variant,algorithm:'signature-water-v4',originAudit:{policy:'LOCAL: exact edge entries or head/single-basin origins; whole-head counterfactual prefill removes springs inside existing flow; lake spring may fill its own lake',removedHeads:removed,prefillChecked:true},bedCells:h.reduce((s,v,i)=>s+(v!==original[i]?1:0),0),landEdits:h.reduce((s,v,i)=>s+(!mask[i]&&v!==original[i]?1:0),0)};
}
export function auditSignatureOrigins(h:Uint8Array,W:number,sources:any[]){
 const checks:any[]=[],heads=[...new Set(sources.map(s=>s.headId))];
 for(const head of heads){const own=sources.filter(s=>s.headId===head);if(own.every(s=>edge(s.i,W))){checks.push({head,kind:'boundary opening',passed:true});continue;}
  if(heads.length===1){checks.push({head,kind:'independent origin',passed:true,depthFromOthers:0});continue;}
  const model=waterModel(W,W,h,[]);model.emitters=sources.map(s=>({cells:[s.i],strength:s.headId===head?0:s.strength,contamination:0}));
  const water=canonicalSettle(model),depth=Math.max(...own.map(s=>water.depth[s.i]));checks.push({head,kind:'interior origin',settled:water.settled,depthFromOthers:depth,passed:water.settled&&depth<=.05});
 }
 return {checked:true,passed:sources.length>0&&checks.every(c=>c.passed),checks,policy:'LOCAL canonical whole-head audit: turn off each interior head, keeping footprints; other heads must settle with its origin dry. Boundary openings are origins by definition.'};
}
/** Native-water recall is area weighted. Precision penalises indiscriminate flooding. */
export function drama(plan:any,depth:Float64Array|Float32Array,reference:any,W:number) {
 let area=0,retained=0,wet=0,target=0,hit=0;
 for(let i=0;i<depth.length;i++){area+=reference.fraction[i];if(depth[i]>.05){wet++;retained+=reference.fraction[i];}if(plan.target[i]){target++;if(depth[i]>.05)hit++;}}
 const features=plan.features.map((f:any,k:number)=>{const cells=plan.groups[k]??Array.from(plan.target.keys()).filter(i=>plan.target[i]),coverage=cells.filter((i:number)=>depth[i]>.05).length/Math.max(1,cells.length);return {...f,coverage,present:coverage>=.7};});
 const recall=area>=1?retained/area:null,precision=wet?retained/wet:null,signature=features.filter((f:any)=>f.referenceArea>=Math.max(3,area*.03)||f.id==='designed-drainage');
 return {referenceCoverage:reference.coverage,referenceWaterCells:area,retainedWaterFraction:recall,waterPrecision:precision,wetShare:wet/depth.length,targetCoverage:hit/Math.max(1,target),features,signaturePresent:signature.length>0&&signature.every((f:any)=>f.present),observedSignature:area>=3,method:'WorldCover class 80 fractional native-pixel recall; feature coverage >=70%; features >=3% of reference water or 3 tile-equivalents; no observed water uses designed route coverage, not real-water retention'};
}
