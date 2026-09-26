import { surfaceWater, type MapView } from '../../src/render3d/model';
import type { ViewState } from '../../src/render3d/renderer';

export function pose(view: MapView, kind: string): { camera: Partial<ViewState>; found: boolean; tile?: number } {
  const { W, H, heights, entities: e } = view;
  if (kind === 'overview') return { found: true, camera: { mode: 'orbit', target: [W/2, 7, -H/2], distance: Math.max(W,H)*1.9, yaw: -0.55, pitch: 0.91 } };
  const water = surfaceWater(W,H,view.water);
  let best = -Infinity, tile = -1, yaw = -0.55;
  if (kind === 'start' || kind === 'ruins') {
    for (let k=0;k<e.count;k++) {
      const name=e.templates[e.template[k]];
      if(kind==='start' && name==='StartingLocation')tile=e.y[k]*W+e.x[k];
      if(kind==='ruins' && name.startsWith('RuinColumnH')) {
        const score=Number(name.slice('RuinColumnH'.length));
        if(score>best){best=score;tile=e.y[k]*W+e.x[k];}
      }
    }
  } else for (let y=2;y<H-2;y++) for(let x=2;x<W-2;x++) {
    const i=y*W+x, d=water.depth[i], c=water.contamination[i];
    let score=-Infinity, direction=yaw;
    if(kind.startsWith('water-') && d>0.1 && c<0.05 && x>5 && y>5 && x<W-6 && y<H-6){
      let wet=0;
      for(let yy=-4;yy<=4;yy+=2)for(let xx=-4;xx<=4;xx+=2)if(water.depth[i+yy*W+xx]>0.1)wet++;
      score=wet+Math.min(d,4)*3-Math.hypot(x-W/2,y-H/2)*0.01;
    }
    if(kind==='badwater' && d>0.15 && c>0.8) score=d - Math.hypot(x-W/2,y-H/2)*0.001;
    if(kind==='mixed' && d>0.1 && c>0.06 && c<0.94) score=1-Math.abs(c-0.5);
    if(kind==='contaminated' && d<0.01 && (view.soil?.contamination[i]??0)>25) score=(view.soil!.contamination[i])/255 - Math.hypot(x-W/2,y-H/2)*0.002;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const j=i+dy*W+dx;
      if(kind==='shore' && d>0.05 && c<0.05 && water.depth[j]<0.001) score=1-Math.abs(d-0.5);
      if(kind==='mixed' && d>0.1 && water.depth[j]>0.1 && c<0.1 && water.contamination[j]>0.7) score=1.2;
      const drop=water.surface[i]-Math.max(heights[j],water.surface[j]||0);
      if(kind==='falls' && d>0.1 && drop>0.2 && drop>score) { score=drop;direction=Math.atan2(dx,-dy); }
      if(kind==='cliff' && heights[i]-heights[j]>score) { score=heights[i]-heights[j];direction=Math.atan2(dx,-dy); }
    }
    if(score>best){best=score;tile=i;yaw=direction;}
  }
  if(tile<0) return {found:false,camera:{}};
  const x=tile%W,y=Math.floor(tile/W);
  if(kind.startsWith('water-'))return {found:true,tile,camera:{mode:'orbit',target:[x+0.5,water.surface[tile],-y-0.5],distance:44,pitch:kind==='water-above'?1.22:kind==='water-low'?Math.PI/6:0.18,yaw:-0.55}};
  return {found:true,tile,camera:{mode:'orbit',target:[x+0.5, Math.max(heights[tile],water.surface[tile]||0),-y-0.5],distance:kind==='falls'?32:44,pitch:kind==='falls'?0.58:0.9,yaw}};
}
