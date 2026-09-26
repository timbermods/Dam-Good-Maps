// Identical reference-mask metric for the saved before water and the new water.
export function measure(fraction,wet,W,coverage=1){
 const seen=new Uint8Array(W*W),features=[];let area=0,hit=0,wetCells=0;
 for(let i=0;i<wet.length;i++){area+=fraction[i];if(wet[i]){hit+=fraction[i];wetCells++;}}
 for(let i=0;i<wet.length;i++)if(fraction[i]>=.08&&!seen[i]){const q=[i];seen[i]=1;for(let k=0;k<q.length;k++){const c=q[k],x=c%W,y=Math.floor(c/W);for(const n of [x?c-1:-1,x<W-1?c+1:-1,y?c-W:-1,y<W-1?c+W:-1])if(n>=0&&fraction[n]>=.08&&!seen[n]){seen[n]=1;q.push(n);}}
  const a=q.reduce((s,i)=>s+fraction[i],0);if(q.length>=4&&a>=Math.max(3,area*.03))features.push({cells:q.length,area:a,coverage:q.filter(i=>wet[i]).length/q.length});
 }
 return {referenceCoverage:coverage,referenceWaterCells:area,retained:coverage>=.95&&area>=3?hit/area:null,precision:wetCells&&area>=3?hit/wetCells:null,signaturePresent:coverage>=.95&&features.length?features.every(f=>f.coverage>=.7):null,features,wetShare:wetCells/wet.length};
}
export function projectWet(depth,after,before){
 const W=before.size,out=new Uint8Array(W*W),R=6378137,DEG=Math.PI/180;
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){
  const lat=before.lat+(y-(W-1)/2)*before.mpt/R/DEG,lon=before.lon+(x-(W-1)/2)*before.mpt/(R*Math.cos(before.lat*DEG))/DEG;
  const dx=((lon-after.lon+540)%360)-180;
  const ax=Math.round(dx*DEG*R*Math.cos(after.lat*DEG)/after.mpt+(after.size-1)/2),ay=Math.round((lat-after.lat)*DEG*R/after.mpt+(after.size-1)/2);
  if(ax>=0&&ay>=0&&ax<after.size&&ay<after.size)out[y*W+x]=depth[ay*after.size+ax]>.05?1:0;
 }
 return out;
}
