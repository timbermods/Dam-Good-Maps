import type { Station } from './engine';
import type { Point } from './course';
export interface Oxbow {start:number;end:number;step:number;floor:number;neck:Point[];pool:Point[];cap:Point}
/** Detect an actual long bend with a short neck, not a decorative pond added
 * beside an arbitrary channel. Only one cutoff is allowed per prototype run. */
export function findNeck(path:Station[],step:number):Oxbow|null {
 const end=path.length-1,B=path[end];if(!B||B.bed<2||end<25)return null;
 for(let start=Math.max(5,end-100);start<end-20;start++){
  const A=path[start],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy),radius=Math.min(A.width,B.width),arc=(end-start)*1.35;
  if(d<radius*2+3||d>radius*4+10||arc<d*2.2)continue;
  const bow=path.slice(start,end+1),sides=bow.map(p=>((p.x-A.x)*dy-(p.y-A.y)*dx)/d),swing=Math.max(...sides.map(Math.abs));
  if(Math.min(...sides)<-.25&&Math.max(...sides)>.25)continue;
  if(swing<radius*2+3)continue;
  const neck=Array.from({length:Math.ceil(d/1.1)+1},(_,k)=>{const t=k/Math.ceil(d/1.1);return {x:A.x+dx*t,y:A.y+dy*t};});
  // Keep the downstream arm perched. The old upstream arm becomes a quiet
  // backwater off the shortcut; canonical game water decides its actual level.
  const pool=bow.filter(p=>Math.hypot(p.x-B.x,p.y-B.y)>radius*2.8+3);
  if(pool.length<12)continue;
  const cap=bow.find(p=>Math.hypot(p.x-B.x,p.y-B.y)<radius*2.8+2&&Math.hypot(p.x-B.x,p.y-B.y)>radius*2+2);
  if(!cap)continue;
  return {start,end,step,floor:B.bed-1,neck,pool,cap};
 }
 return null;
}
