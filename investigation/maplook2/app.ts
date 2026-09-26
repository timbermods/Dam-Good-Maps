import './style.css';
import { MapRenderer, type ViewState } from '../../src/render3d/renderer';
import { surfaceWater, type MapView } from '../../src/render3d/model';
import { THEMES, THEME_NAMES } from '../../src/core/spec/mapspec';
import { CHANGES, NOT_ENDORSED, PROVIDER_NOTICES } from '../../src/core/places/attribution';
import { bridge, Effects } from './effects';
import { pose } from './poses';
import { WaterFlow, surfaceContamination } from './flow';
import type { MapRequest } from './maps.worker';

const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const select = $<HTMLSelectElement>('map');
const status=$('status');
const standard=new MapRenderer($<HTMLCanvasElement>('standard'));
const high=new MapRenderer($<HTMLCanvasElement>('high'));
standard.setClock(8); high.setClock(8);
const effects=new Effects(high);
effects.water=effects.shadows=true;
effects.apply();
const flow = new WaterFlow(bridge(high).waterMat);
let flowSource = '', velocity = new Float32Array(0);
let map: MapView | undefined, label='', worker:Worker|undefined, serial=0, ready=false;
let waterView:ReturnType<typeof surfaceWater>|undefined;
let syncing=false;
function sync(other:MapRenderer,v:ViewState){if(syncing)return;syncing=true;other.setView(v);syncing=false;}
standard.onView=v=>sync(high,v);high.onView=v=>sync(standard,v);
const options:MapRequest[]=[];
function option(group:HTMLOptGroupElement,name:string,r:Omit<MapRequest,'id'>){const o=document.createElement('option');o.value=String(options.length);o.textContent=name;group.append(o);options.push({id:0,...r});}
function group(label:string){const g=document.createElement('optgroup');g.label=label;select.append(g);return g;}
const generated=group('Generated · repository generator');
for(const theme of THEMES)for(const size of [128,256])option(generated,`${THEME_NAMES[theme]} · ${size}²`,{kind:'generated',theme,size});
const places=group('Real places · existing library');
for(const name of ['near-victoria-falls','near-yosemite-valley','near-danube-delta'])option(places,name.replaceAll('-',' '),{kind:'place',name});
const proto=await fetch('/maps/prototypes').then(r=>r.json()) as string[];
if(proto.length){const g=group('M9 · local prototype maps');for(const name of proto)option(g,name.replace('.timber',''),{kind:'prototype',name});}
const credits=$('credits');
for(const text of [CHANGES,NOT_ENDORSED,...PROVIDER_NOTICES]){const p=document.createElement('p');p.textContent=text;credits.append(p);}
const gpu=standard.gpu().renderer;
$('gpu').textContent=/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)?`Software rendering · full Standard / High forced for comparison` : gpu;

async function load(index=Number(select.value),seed=Number($<HTMLInputElement>('seed').value)) {
  ready=false;worker?.terminate();serial++;
  select.value=String(index);
  $<HTMLInputElement>('seed').disabled=options[index].kind!=='generated';
  status.textContent='Loading map in a worker…';
  const request={...options[index],id:serial,seed};
  worker=new Worker(new URL('./maps.worker.ts',import.meta.url),{type:'module'});
  return new Promise<void>((resolve,reject)=>{
    worker!.onerror=e=>{status.textContent=`Worker failed: ${e.message}`;reject(new Error(e.message));};
    worker!.onmessage=({data})=>{
      if(data.id!==serial)return;
      if(data.progress){status.textContent=data.progress;return;}
      if(data.error){status.textContent=data.error;reject(new Error(data.error));return;}
      map=data.view;label=data.label;waterView=surfaceWater(map!.W,map!.H,map!.water);
      try {
        standard.setMap(map!);high.setMap(map!);effects.fit(map!.W,map!.H);
        velocity=data.velocity;flowSource=data.flowSource;flow.set(map!.W,map!.H,velocity,surfaceContamination(map!));
        $<HTMLInputElement>('sun').value='0';
        setPose($<HTMLSelectElement>('pose').value);
        ready=true;status.textContent=`${label} · ${map!.entities.count.toLocaleString()} objects · cameras synced`;
        worker?.terminate();worker=undefined;resolve();
      }catch(e){status.textContent=String(e);reject(e);}
    };
    worker!.postMessage(request);
  });
}
function setPose(kind:string){
  if(!map)return false;
  const p=pose(map,kind);
  if(!p.found){status.textContent=`No ${kind} found in this map. Choose another map or view.`;return false;}
  standard.setView(p.camera);high.setView(p.camera);
  $<HTMLSelectElement>('pose').value=kind;
  return true;
}
$('load').onclick=()=>{void load().catch(console.error);};
select.onchange=()=>{void load().catch(console.error);};
$<HTMLSelectElement>('pose').onchange=e=>setPose((e.target as HTMLSelectElement).value);
$('angle').onclick=()=>{const v=standard.getView();standard.setView({yaw:v.yaw+Math.PI/2});};
function toggle(){effects.water=$<HTMLInputElement>('water').checked;effects.shadows=$<HTMLInputElement>('shadows').checked;effects.apply();effects.sunAngle(Number($<HTMLInputElement>('sun').value));}
$('water').onchange=toggle;$('shadows').onchange=toggle;
$('sun').oninput=()=>effects.sunAngle(Number($<HTMLInputElement>('sun').value));
$('reset-sun').onclick=()=>{$<HTMLInputElement>('sun').value='0';effects.sunAngle(0);};
for(const r of [standard,high])r.onHover=hit=>{
  if(!hit||!map)return;
  const i=hit.y*map.W+hit.x;
  const sw=waterView!;
  $('inspection').textContent=`Tile ${hit.x}, ${hit.y} · water ${sw.depth[i].toFixed(2)} levels · badwater ${Math.round(sw.contamination[i]*100)}% · moisture ${map.soil?.moisture[i]??0}/255 · ground contamination ${map.soil?.contamination[i]??0}/255`;
};

// Actual displayed frame count (the two views share CPU/GPU). Not a guessed GPU benchmark.
const counts=[0,0];let last=performance.now();
for(const [i,r] of [standard,high].entries()){
  const b=bridge(r),render=b.gl.render.bind(b.gl);
  b.gl.render=(scene,camera)=>{render(scene,camera);if(scene===b.scene)counts[i]++;};
}
let clock=8,previous=performance.now();
function frame(now:number){
  const dt=Math.min(0.1,(now-previous)/1000);previous=now;
  const paused=$<HTMLInputElement>('pause').checked||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(ready&&!paused){clock+=dt;standard.setClock(clock);high.setClock(clock);}
  if(now-last>1000){for(const [i,id]of ['standard-fps','high-fps'].entries())$(id).textContent=paused?'paused':`${(counts[i]*1000/(now-last)).toFixed(1)} fps`;counts.fill(0);last=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Local capture/test API. No remote data and no product-global hooks.
declare global { interface Window { maplook2: typeof api } }
const api={
  get ready(){return ready;},get map(){return map;},get label(){return label;},options,
  load,setPose,standard,high,effects,
  flow,get velocity(){return velocity;},get flowSource(){return flowSource;},
  freeze(t=8){$<HTMLInputElement>('pause').checked=true;clock=t;standard.setClock(t);high.setClock(t);standard.renderNow();high.renderNow();},
  toggle(water:boolean,shadows:boolean){$<HTMLInputElement>('water').checked=water;$<HTMLInputElement>('shadows').checked=shadows;toggle();},
  camera(v:Partial<ViewState>){standard.setView(v);high.setView(v);},
  render(){standard.renderNow();high.renderNow();},
};
window.maplook2=api;
for(const r of [standard,high])r.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;status.textContent='WebGL context lost. Reload the page to restore the comparison.';});
window.addEventListener('pagehide',()=>{worker?.terminate();flow.dispose();effects.dispose();standard.dispose();high.dispose();});
void load().catch(console.error);
