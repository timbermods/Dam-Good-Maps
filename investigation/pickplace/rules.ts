import { neighbours } from '../landscapes/lib/terrain';
import { walkDistance } from '../../src/core/analysis/walk';
import { mapObjects } from '../../src/core/sim/model';
import { blocks } from '../../src/core/validate/report';
import { WALK_BLOCKERS } from '../../src/core/validate/playability';
import { footprintTiles } from '../../src/core/format/footprints';

export function stableId(text:string) {
  return [0,1,2,3].map(s=>{let h=(2166136261+s)>>>0;for(const c of text) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h.toString(16).padStart(8,'0');}).join('');
}
/** Place game Slope objects on existing one-level steps; never cut or raise terrain. */
export function naturalSlopes(h:Uint8Array,D:Float64Array,W:number,occupied:Set<number>) {
  const slopes:any[]=[],links:[number,number][]=[];
  const used=new Set(occupied);
  for(let y=2;y<W-2;y++) for(let x=2;x<W-2;x++) {
    const i=y*W+x;
    if((x+y)%3!==0||D[i]>.05||used.has(i)) continue;
    for(const [dx,dy,orientation] of [[0,-1,'Cw0'],[-1,0,'Cw90'],[0,1,'Cw180'],[1,0,'Cw270']] as const) {
      const j=i+dy*W+dx,back=i-dy*W-dx;
      if(h[j]!==h[i]+1||h[back]!==h[i]||D[j]>.05||used.has(j)||used.has(back)) continue;
      slopes.push({i,orientation});links.push([i,j]);used.add(i);used.add(j);break;
    }
  }
  return {slopes,links};
}
export function pumpShore(dist:Float64Array,h:Uint8Array,D:Float64Array,C:Float64Array,W:number) {
  let distance=Infinity,tile=-1,shore=-1;
  for(let i=0;i<h.length;i++) if(D[i]>=.3&&C[i]<.05) {
    const surface=h[i]+D[i];
    for(const j of neighbours(i,W,W,false)) if(D[j]<.05&&h[j]>=surface-.01&&h[j]-surface<=2&&dist[j]<distance) {distance=dist[j];tile=i;shore=j;}
  }
  return {distance,tile,shore};
}
/** Retain the untouched legacy report, explicitly apply the later real-place decisions. */
export function currentRules(file:any,v:any,h:Uint8Array,water:any,links:[number,number][],start:any,sources:any[]) {
  const W=file.world.sizeX;
  const blocked=Uint8Array.from(water.depth as Float64Array,d=>d>.05?1:0);
  for(const o of mapObjects(file.world)) if(WALK_BLOCKERS.has(o.template)) for(const [x,y] of footprintTiles(o.template,o)) if(x>=0&&y>=0&&x<W&&y<W) blocked[y*W+x]=1;
  const dist=start?walkDistance(h,W,W,blocked,links,start):new Float64Array(h.length).fill(Infinity);
  const shore=pumpShore(dist,h,water.depth,water.contamination,W);
  const replacements=new Set(['start.water','water.outflow','water.no_flood','water.clean_exists','water.clean_reach']);
  // D152 does not guarantee retained water or a particular wet-area fraction. Settling stays required.
  const failures=v.report.checks.filter((c:any)=>blocks('generate',c)&&!replacements.has(c.id)).map((c:any)=>({id:c.id,message:c.message}));
  if(shore.distance>20) failures.push({id:'start.water.D153',message:'No clean pumpable shore within 20 tiles walking over natural slopes.'});
  if(!sources.length) failures.push({id:'water.source.D152',message:'At least one designed game water source is required.'});
  return {passed:failures.length===0,failures,waterDistance:Number.isFinite(shore.distance)?shore.distance:null,shore:shore.shore,retainedLegacyFailures:v.report.checks.filter((c:any)=>blocks('generate',c)).map((c:any)=>c.id),policy:'LOCAL D151–D153 adapter; Normal start; base load/design/resource checks; water amount, connected-body size and outflow advisory; canonical settle required; D164 log thresholds pending shared implementation'};
}
