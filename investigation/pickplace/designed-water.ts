import { drainage, neighbours } from '../landscapes/lib/terrain';
import { prefill, canonicalSettle } from '../../src/core/sim/prefill';
import { waterModel } from '../../src/core/sim/model';

export type Intention = 'balanced' | 'waterfall' | 'basin';
/** Scores real drainage, but invents game water. No native-water or sea-level gate. */
export function designWater(raw: Float32Array, h: Uint8Array, W: number, intention: Intention = 'balanced', halo?:{raw:Float32Array,W:number,halo:number}) {
  const N = h.length, d = drainage(raw, W, W), game = drainage(h, W, W);
  const interest = new Float64Array(N), pads = new Uint8Array(N);
  for (let y=3;y<W-3;y++) for(let x=3;x<W-3;x++) {
    const i=y*W+x; let flat=true;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(h[i+dy*W+dx]!==h[i]) flat=false;
    if(flat) pads[i]=1;
  }
  // Downstream feature value is propagated upstream in flood order. It is a routing
  // preference, not a claim that the real world contains a river or a lake bed.
  const downstream = new Float64Array(N), length = new Uint16Array(N);
  for(let k=0;k<N;k++) {
    const i=d.order[k], j=d.to[i];
    const drop=j<0?0:Math.max(0,h[i]-h[j]);
    const basin=Math.min(4,game.filled[i]-h[i]);
    let bank=0,confinement=0;
    for(const n of neighbours(i,W,W)) confinement+=Math.max(0,h[n]-h[i]);
    for(const [dx,dy] of [[-5,0],[5,0],[0,-5],[0,5]]) {
      const x=i%W+dx,y=Math.floor(i/W)+dy;
      if(x>=0&&x<W&&y>=0&&y<W) {const p=y*W+x;if(pads[p]&&h[p]>h[i]&&h[p]<=h[i]+2)bank++;}
    }
    interest[i]=Math.min(3,confinement)*.2+bank*2+drop*(intention==='waterfall'?5:1.2)+basin*(intention==='basin'?3:.5);
    downstream[i]=interest[i]+(j>=0?.965*downstream[j]:0);
    length[i]=j>=0?Math.min(65534,length[j]+1):0;
  }
  // Build the channel graph before ranking sites. A high-scoring midstream cell
  // is never eligible: only a channel's first cell or its exact map-edge entry.
  const HW=halo?.W??W,pad=halo?.halo??0,hr=halo?.raw??raw;
  const hd=halo?drainage(hr,HW,HW):d,threshold=Math.max(24,N*.003);
  const inside=(i:number)=>i>=0&&i%HW>=pad&&i%HW<pad+W&&Math.floor(i/HW)>=pad&&Math.floor(i/HW)<pad+W;
  const local=(i:number)=>(Math.floor(i/HW)-pad)*W+i%HW-pad;
  const incoming=new Uint16Array(hr.length),entries=new Map<number,number>();
  for(let i=0;i<hr.length;i++)if(hd.to[i]>=0&&hd.acc[i]>=threshold){incoming[hd.to[i]]++;if(!inside(i)&&inside(hd.to[i]))entries.set(hd.to[i],i);}
  const candidates:any[]=[];
  for(let p=0;p<hr.length;p++)if(inside(p)) {
    const i=local(p),x=i%W,y=Math.floor(i/W),edge=x===0||y===0||x===W-1||y===W-1;
    const entry=entries.has(p),head=hd.acc[p]>=threshold&&incoming[p]===0;
    if(!entry&&(!head||edge))continue;
    // A lake/basin is fed from above or from its bank, never from its interior.
    if(game.filled[i]>h[i]||hd.filled[p]-hr[p]>.5)continue;
    const ridge=Math.max(...neighbours(p,HW,HW).map(j=>hr[j]))-hr[p];
    if(!entry&&ridge<.1)continue;
    const score=downstream[i]+Math.min(4,Math.log2(hd.acc[p]+1))+.4*Math.min(30,length[i]);
    candidates.push({i,area:hd.acc[p],score,kind:entry?'map-edge river entry':'tributary head spring',headId:`head-${i}`,upstreamChannels:incoming[p],entryFrom:entry?entries.get(p):null,routeLength:length[i],downstreamInterest:downstream[i]});
  }
  // No native river is necessary: a designer can introduce a river at the edge.
  // Even flat controls get a boundary origin, never a mid-plain/downstream spring.
  if(!candidates.length) {
    for(let k=4;k<W-4;k+=4)for(const i of [k,(W-1)*W+k,k*W,k*W+W-1]) {
      const inner=i<W?i+W:i>=N-W?i-W:i%W===0?i+1:i-1;
      if(h[inner]>h[i])continue;
      candidates.push({i,area:1,score:downstream[inner]+h[i]*.1,kind:'designed map-edge entry',headId:`head-${i}`,upstreamChannels:0,entryFrom:null,routeLength:length[inner],downstreamInterest:downstream[inner]});
    }
    if(!candidates.length)candidates.push({i:Math.floor(W/2),area:1,score:0,kind:'designed map-edge entry',headId:'boundary-fallback',upstreamChannels:0,entryFrom:null,routeLength:0,downstreamInterest:0});
  }
  candidates.sort((a,b)=>b.score-a.score||a.i-b.i);
  const count=Math.max(1,Math.min(3,Math.round(W/96))), plans:any[]=[];
  for(let variant=0;variant<2;variant++) {
    const selected:any[]=[];
    // The alternate explores one other head at lower flow. More water always
    // changes a head's strength; there are no downstream booster sources.
    const start=variant?Math.min(candidates.length-1,Math.max(1,Math.floor(candidates.length*.08))):0;
    for(let k=start;k<candidates.length&&selected.length<(variant?1:count);k++) {
      const c=candidates[k];
      if(selected.some(s=>Math.hypot(s.i%W-c.i%W,Math.floor(s.i/W)-Math.floor(c.i/W))<W*.25))continue;
      const trial=[...selected,{...c,strength:(variant?1.8:3)*Math.sqrt(W/128)}];
      // Conservative prefill rejects heads on another planned river/lake,
      // including routes which collapse together after height quantisation.
      if(!headsSeparate(h,W,trial))continue;
      selected.push(trial[trial.length-1]);
    }
    plans.push({sources:selected,outlets:[],intention,variant,candidateCount:candidates.length,threshold,algorithm:'designed-water-v3-heads-only'});
  }
  return plans;
}

function modelWithout(h:Uint8Array,W:number,sources:any[],omit:number) {
  const model=waterModel(W,W,h,[]);
  // Retain the omitted source's edge footprint, but turn off its flow.
  model.emitters=sources.map((s,k)=>({cells:[s.i],strength:k===omit?0:s.strength,contamination:0}));
  return model;
}
export function headsSeparate(h:Uint8Array,W:number,sources:any[]) {
  if(sources.length<2)return true;
  return sources.every((s,k)=>prefill(modelWithout(h,W,sources,k)).depth[s.i]===0);
}
/** Final accepted maps: independently simulate all other tributaries without each
 * head's own flow. A head must remain dry, never embedded in an existing stream. */
export function auditOrigins(h:Uint8Array,W:number,sources:any[]) {
  const checks=sources.map((s,k)=>{
    if(sources.length===1)return {headId:s.headId,depthFromOthers:0,settled:true};
    const water=canonicalSettle(modelWithout(h,W,sources,k));
    return {headId:s.headId,depthFromOthers:water.depth[s.i],settled:water.settled};
  });
  return {checked:true,passed:checks.every(c=>c.settled&&c.depthFromOthers<=.05),checks,policy:'LOCAL source-origin audit: exact edge entries or tributary heads; no basin interiors or downstream boosters; other tributaries alone must settle with each head dry.'};
}
