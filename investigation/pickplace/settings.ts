import { drainage } from '../landscapes/lib/terrain';
export function metrics(raw:Float32Array,W:number,spacing:number) {
  const sorted=raw.slice().sort(), n=raw.length;
  const q=(p:number)=>sorted[Math.floor((n-1)*p)];
  let sea=0, flat=0, steep=0, edges=0;
  for(let i=0;i<n;i++) {
    if(raw[i]<=0) sea++;
    for(const j of [i%W<W-1?i+1:-1,i+W<n?i+W:-1]) if(j>=0) {
      const slope=Math.abs(raw[i]-raw[j])/spacing;
      if(slope<.01) flat++; if(slope>.7) steep++;edges++;
    }
  }
  const d=drainage(raw,W,W); let channels=0, longest=0, best=-1;
  for(let i=0;i<n;i++) if(d.acc[i]>=n*.04&&raw[i]>0&&raw[i]>sorted[0]+.5) {
    channels++; if(i%W>4&&i%W<W-5&&Math.floor(i/W)>4&&Math.floor(i/W)<W-5&&d.acc[i]>longest) {longest=d.acc[i];best=i;}
  }
  return {min:q(0),max:q(1),relief:q(.98)-q(.02),fullRelief:q(1)-q(0),seaProxy:sea/n,flatShare:flat/edges,steepShare:steep/edges,channelCells:channels,channelIndex:best};
}
export function mapping(raw:Float32Array) {
  const sorted=raw.slice().sort(),lo=sorted[0],hi=sorted[sorted.length-1],span=hi-lo;
  // Never amplify centimetres of noise into mountains. Keep all heights in 1..16.
  const maxLevels=Math.min(15,Math.max(1,Math.round(span/3)));
  const median=sorted[Math.floor(sorted.length/2)];
  const gammas=span>300&&(median-lo)/span<.3?[1,.8]:[1],W=Math.sqrt(raw.length);
  let best:any=null;
  for(const levels of [...new Set([Math.min(8,maxLevels),Math.min(12,maxLevels),maxLevels])]) for(const gamma of gammas) {
    const heights=Uint8Array.from(raw,v=>1+Math.round(levels*(span?((v-lo)/span)**gamma:0)));
    let cliffs=0,edges=0,pads=0;
    for(let y=1;y<W-1;y++)for(let x=1;x<W-1;x++) {
      const i=y*W+x;
      for(const j of [i+1,i+W]){edges++;if(Math.abs(heights[i]-heights[j])>1)cliffs++;}
      let flat=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(heights[i+dy*W+dx]!==heights[i])flat=false;
      if(flat)pads++;
    }
    const cliffShare=cliffs/Math.max(1,edges),padShare=pads/Math.max(1,(W-2)**2);
    const score=levels*.15-8*cliffShare+Math.min(.08,padShare)*10;
    if(!best||score>best.score)best={heights,lo,hi,levels,gamma,metresPerLevel:span/levels,cliffShare,padShare,score};
  }
  return best;
}
export function prediction(m:ReturnType<typeof metrics>,mpt:number) {
  const warnings:string[]=[],suggestions:string[]=[];
  if(m.relief<10) {warnings.push('Very little relief; small height errors may dominate.');suggestions.push('Try a larger area to include valley sides.');}
  if(m.seaProxy>.4) {warnings.push('Much of the area may be sea or low ground; elevation alone cannot identify water.');suggestions.push('Move inland or try a finer scale.');}
  if(m.channelCells<3||m.relief<3) {warnings.push('No convincing drainage corridor in this preview. A real river is unverified.');suggestions.push('Try a larger area or move towards a visible valley.');}
  if(m.steepShare>.12||m.relief>1800) {warnings.push('Extreme relief may leave little room for a start.');suggestions.push('Try a finer scale on the valley floor.');}
  const score=Math.max(0,Math.min(100,80-35*(m.relief<10?1:0)-45*m.seaProxy-40*m.steepShare-20*(m.channelCells<3?1:0)+Math.min(12,m.channelCells/8)));
  return {score,verdict:score>=65?'promising':score>=40?'uncertain':'difficult',warnings,suggestions,metresPerTile:mpt,riverVerified:false};
}
