import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pickHeightfield } from '../../src/render3d/pick';
import { sceneUniforms,terrainMaterial,waterMaterial,objectMaterial,tileTexture,lightTexture,overlayTexture,drawPatterns } from '../../src/render3d/materials';
import { MAPS } from './maps';
import type { Chunk,Geometry } from './meshes';
import type { CarveOperation } from './operation';
import type { Settings,Head } from './engine';
import { Surge } from './effects';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id),canvas=$<HTMLCanvasElement>('view'),notice=$('notice');
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const scene=new THREE.Scene();scene.background=new THREE.Color('#b8cbd8');
const camera=new THREE.PerspectiveCamera(42,1,.1,3000),gl=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.outputColorSpace=THREE.LinearSRGBColorSpace;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x687366,2));
const sun=new THREE.DirectionalLight(0xfff4d6,2);sun.position.set(-80,160,100);scene.add(sun);
const uniforms=sceneUniforms(1,1,tileTexture(1,1,new Uint8Array(4)),lightTexture(1,1,new Uint8Array(16)),overlayTexture(1,1),overlayTexture(1,1));
uniforms.patternTex.value=drawPatterns(gl).texture;uniforms.markers.value=0;
const groundMat=terrainMaterial(uniforms,0,16),waterMat=waterMaterial(uniforms),objectsMat=objectMaterial(uniforms);
const chunks=new Map<string,THREE.Group>(),uploads:Chunk[]=[];
const retained=new Set<THREE.BufferGeometry>(),retainedInstances=new Set<THREE.InstancedMesh>();
const marker=new THREE.Mesh(new THREE.TorusGeometry(.9,.12,5,20),new THREE.MeshBasicMaterial({color:0xffeac2}));
marker.rotation.x=Math.PI/2;marker.visible=false;scene.add(marker);
const aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xf8efd2,dashSize:1,gapSize:.6}));scene.add(aimLine);
const surge=new Surge();scene.add(surge.group);
let W=0,H=0,heights=new Uint8Array(),busy=true,active=false,paused=false,mode:'unleash'|'aim'='unleash',origin:number|null=null;
let speed=1,nextAt=0,steps=0,epoch=0,top=false,settling=false,pending:Record<string,unknown>|null=null,head:Head|null=null;
let savedRun:unknown=null,lastOperation:CarveOperation|null=null,finishCache=false;
interface Lighting {tiles:Uint8Array;light:Uint8Array;checks:any}
let lighting:Lighting|null=null;
interface Cache {groups:Map<string,THREE.Group>;heights:Uint8Array;lighting:Lighting}
let beforeCache:Cache|null=null,afterCache:Cache|null=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');input('motion').checked=!reduced.matches;
const motion=()=>!reduced.matches&&input('motion').checked;
function send(msg:Record<string,unknown>){busy=true;worker.postMessage(msg);}
function stateControls(){
  for(const id of ['map','reset','unleash','aim','power','walls','dry','layers','replay-file'])($<HTMLButtonElement>(id)).disabled=active||busy;
  input('defy').disabled=active||busy||mode!=='aim';
  $<HTMLButtonElement>('pause').disabled=!active||settling;
  $<HTMLButtonElement>('stop').disabled=!active||settling||paused&&pending?.type==='stop';
  if(active){$<HTMLButtonElement>('undo').disabled=false;$<HTMLButtonElement>('redo').disabled=true;}
}
function resetView(){
  controls.target.set(W*.52,3,-H*.52);camera.position.set(W*1.05,Math.max(W,H)*.95,H*.38);controls.update();top=false;$('top').textContent='Top-down';
}
function geometry(d:Geometry){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(d.positions,3));
  g.setAttribute('normal',new THREE.BufferAttribute(d.normals,3,d.normals instanceof Int8Array));
  g.setAttribute('pcolor',new THREE.BufferAttribute(d.colors,3));g.setAttribute('grow',new THREE.BufferAttribute(new Float32Array(d.positions.length),3));
  if(d.data)g.setAttribute('wdata',new THREE.BufferAttribute(d.data,2));
  if(d.flags)g.setAttribute('wflags',new THREE.BufferAttribute(d.flags,1));
  if(d.indices)g.setIndex(new THREE.BufferAttribute(d.indices,1));g.computeBoundingSphere();return g;
}
function dispose(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh&&!retained.has(o.geometry))o.geometry.dispose();if(o instanceof THREE.InstancedMesh&&!retainedInstances.has(o))o.dispose();});}
function retain(c:Cache|null){c?.groups.forEach(g=>g.traverse(o=>{if(o instanceof THREE.Mesh)retained.add(o.geometry);if(o instanceof THREE.InstancedMesh)retainedInstances.add(o);}));}
function cache():Cache|null{return lighting?{groups:new Map(chunks),heights:heights.slice(),lighting}:null;}
function setLighting(l:Lighting){
  lighting=l;uniforms.tileTex.value.dispose();uniforms.lightTex.value.dispose();
  uniforms.tileTex.value=tileTexture(W,H,l.tiles);uniforms.lightTex.value=lightTexture(W,H,l.light);uniforms.mapSize.value.set(W,H);
  const c=l.checks;$('checks').textContent=c.present?('Start · '+(c.meets?'resources in reach':'resources missing')+'\n'+c.reach.toLocaleString()+' reachable tiles\nWater '+(c.water===null?'out of reach':c.water+' tiles')+' · Wood '+c.trees+' · Berries '+c.bushes+(active?'\nLive estimate · consequences allowed':'')):'No start on this map';
  updateReach();
}
function updateReach(){
  const tex=uniforms.overlay.value;tex.dispose();uniforms.overlay.value=overlayTexture(W||1,H||1);
  const a=uniforms.overlay.value.image.data as Uint8Array,reach=lighting?.checks.tiles;
  if(input('reach').checked&&reach)for(let i=0;i<reach.length;i++)if(reach[i]){a[i*4]=125;a[i*4+1]=202;a[i*4+2]=133;a[i*4+3]=75;}
  uniforms.overlay.value.needsUpdate=true;
}
input('reach').onchange=updateReach;
function restoreView(c:Cache|null){
  if(!c)return;uploads.length=0;for(const g of chunks.values()){scene.remove(g);dispose(g);}chunks.clear();
  for(const [key,g]of c.groups){chunks.set(key,g);scene.add(g);}heights=c.heights.slice();setLighting(c.lighting);
}
function releaseCaches(){
  const oldInstances=new Set(retainedInstances);retainedInstances.clear();const currentInstances=new Set<THREE.InstancedMesh>();chunks.forEach(g=>g.traverse(o=>{if(o instanceof THREE.InstancedMesh)currentInstances.add(o);}));for(const o of oldInstances)if(!currentInstances.has(o))o.dispose();
  const old=new Set(retained);retained.clear();beforeCache=afterCache=null;
  const current=new Set<THREE.BufferGeometry>();chunks.forEach(g=>g.traverse(o=>{if(o instanceof THREE.Mesh)current.add(o.geometry);}));
  for(const g of old)if(!current.has(g))g.dispose();
}
function upload(c:Chunk){
  let group=chunks.get(c.key);
  if(group&&(beforeCache?.groups.get(c.key)===group||afterCache?.groups.get(c.key)===group)){
    scene.remove(group);group=group.clone(true);scene.add(group);chunks.set(c.key,group);
  }
  if(!group){group=new THREE.Group();scene.add(group);chunks.set(c.key,group);}
  for(const name of ['terrain','water']){
    const old=group.getObjectByName(name) as THREE.Mesh|undefined;
    if(old){if(!retained.has(old.geometry))old.geometry.dispose();group.remove(old);}
    const mesh=new THREE.Mesh(geometry(name==='terrain'?c.terrain:c.water),name==='terrain'?groundMat:waterMat);
    mesh.name=name;mesh.renderOrder=name==='water'?2:0;group.add(mesh);
  }
  if(c.objects){
    const old=group.getObjectByName('objects') as THREE.Group|undefined;if(old){dispose(old);group.remove(old);}
    const objects=new THREE.Group();objects.name='objects';
    for(const o of c.objects){
      const m=new THREE.InstancedMesh(geometry(o.geometry),objectsMat,o.count);m.instanceMatrix.array.set(o.matrices);m.instanceMatrix.needsUpdate=true;
      m.instanceColor=new THREE.InstancedBufferAttribute(o.colors,3);m.computeBoundingSphere();objects.add(m);
    }group.add(objects);
  }
}
function instruction(){notice.textContent=mode==='unleash'?'Click a mountain. Unleash a river.':origin===null?'Pick where the river begins.':'Now pick its destination.';}
worker.onmessage=(event:MessageEvent)=>{
  const m=event.data;if(m.epoch<epoch)return;epoch=m.epoch;
  if(m.type==='reset'){
    W=m.W;H=m.H;releaseCaches();uploads.length=0;for(const g of chunks.values()){dispose(g);scene.remove(g);}chunks.clear();resetView();
  }
  if(m.type==='chunk')uploads.push(m.chunk);
  if(m.type==='lighting')setLighting(m);
  if(m.type==='frame'){
    heights=m.heights;head=m.head;if(!m.metrics&&!active)$('metrics').textContent='';
    surge.set(head,m.trail,heights,W);
    if(m.metrics){steps=m.metrics.steps;$('metrics').textContent=(steps/10).toFixed(1)+' s · '+m.metrics.cut.toLocaleString()+' blocks cut · '+m.metrics.deposited+' deposited';}
    $<HTMLButtonElement>('undo').disabled=!active&&!m.undo;$<HTMLButtonElement>('redo').disabled=active||!m.redo;
  }
  if(m.type==='status')notice.textContent=m.text;
  if(m.type==='settling'){settling=true;stateControls();}
  if(m.type==='started'){settling=false;active=true;paused=false;steps=0;notice.textContent='The river is unleashed. Stop to keep it. Esc to revert.';}
  if(m.type==='cancelled'){settling=false;steps=0;$('metrics').textContent='';active=false;paused=false;head=null;pending=null;notice.textContent='Whole carve reverted.';$('pause').textContent='Pause';}
  if(m.type==='finished'){
    settling=false;active=false;paused=false;head=null;finishCache=true;if(lighting)setLighting(lighting);$('pause').textContent='Pause';
    notice.textContent=(m.reason==='stopped'?'Stopped.': 'The river reached '+m.reason+'.')+' One undo step saved.';
    if(!m.settled)notice.textContent+=' Water reached the repo’s settle limit.';
    $<HTMLButtonElement>('undo').disabled=false;
  }
  if(m.type==='operation'){lastOperation=m.op;savedRun={format:1,base:m.base,operation:m.op};$<HTMLButtonElement>('save-run').disabled=false;}
  if(m.type==='replayed')notice.textContent='Exact saved result restored.';
  if(m.type==='error'){notice.textContent=m.text;active=false;pending=null;if(beforeCache)restoreView(beforeCache);}
  if(m.type==='ready'){busy=false;stateControls();if(notice.textContent==='Loading land…')instruction();}
};
worker.onerror=e=>{notice.textContent='Worker error: '+e.message;busy=false;active=false;stateControls();};
const select=$<HTMLSelectElement>('map');
for(const [id,name]of MAPS){const o=document.createElement('option');o.value=id;o.textContent=name;select.add(o);}
select.value='fixture:mountain';
function load(){origin=null;marker.visible=false;aimLine.visible=false;savedRun=null;lastOperation=null;head=null;$('metrics').textContent='';$<HTMLButtonElement>('save-run').disabled=true;send({type:'load',id:select.value});stateControls();}
select.onchange=load;$('reset').onclick=load;
for(const value of ['unleash','aim'] as const)$(value).onclick=()=>{
  mode=value;origin=null;marker.visible=false;aimLine.visible=false;$('unleash').setAttribute('aria-pressed',String(mode==='unleash'));$('aim').setAttribute('aria-pressed',String(mode==='aim'));stateControls();instruction();
};
input('power').oninput=()=>{const p=Number(input('power').value);$('power-label').textContent=p+' · '+(p<25?'Creek':p<55?'Torrent':p<85?'River':'Catastrophe');};
function settings():Settings{return {mode,power:Number(input('power').value),walls:$<HTMLSelectElement>('walls').value as Settings['walls'],defyGravity:input('defy').checked,dry:input('dry').checked,layers:input('layers').checked};}
function begin(end?:number){
  releaseCaches();beforeCache=cache();retain(beforeCache);active=true;paused=false;marker.visible=false;aimLine.visible=false;
  send({type:'start',settings:settings(),intent:{origin,end}});origin=null;stateControls();
}
function cancel(){
  if(!active)return;epoch++;pending=null;paused=false;active=false;head=null;restoreView(beforeCache);surge.set(null,[],heights,W);
  busy=true;worker.postMessage({type:'cancel'});notice.textContent='Whole carve reverted.';$('pause').textContent='Pause';stateControls();
}
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';};
$('speed').onclick=()=>{speed=speed===1?4:speed===4?12:1;$('speed').textContent=speed+'×';};
$('stop').onclick=()=>{if(!active)return;pending={type:'stop'};paused=true;notice.textContent='Keeping the canyon and settling water…';stateControls();};
$('undo').onclick=()=>{if(active){cancel();return;}if(busy)return;restoreView(beforeCache);send({type:'undo'});notice.textContent='Run undone.';};
$('redo').onclick=()=>{if(busy)return;restoreView(afterCache);send({type:'redo'});notice.textContent='Stored result restored.';};
$('save-run').onclick=()=>{
  if(!savedRun)return;const text=JSON.stringify(savedRun,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as number[]):v);
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='carve-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
input('replay-file').onchange=async()=>{
  const f=input('replay-file').files?.[0];if(!f||active||busy)return;
  if(f.size>32*1024*1024){notice.textContent='Run file is too large.';return;}
  try{send({type:'replay',bundle:JSON.parse(await f.text())});}catch{notice.textContent='This run file could not be read.';}
};
$('home').onclick=resetView;$('top').onclick=()=>{
  if(top){resetView();return;}camera.position.set(controls.target.x,Math.max(W,H)*1.65,controls.target.z+.01);controls.update();top=true;$('top').textContent='Orbit';
};
let down:{x:number;y:number}|null=null;
canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
function hitAt(e:PointerEvent){
  const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  return pickHeightfield({origin:ray.ray.origin.toArray(),direction:ray.ray.direction.toArray()},W,H,heights);
}
canvas.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;
  if(active||busy||uploads.length||!W)return;const hit=hitAt(e);if(!hit)return;const tile=hit.y*W+hit.x;
  if(mode==='unleash'){origin=tile;begin();}else if(origin===null){origin=tile;marker.position.set(hit.x+.5,heights[tile]+.2,-hit.y-.5);marker.visible=true;instruction();}else begin(tile);
});
canvas.addEventListener('pointermove',e=>{
  if(active||!W)return;const hit=hitAt(e);if(!hit)return;
  if(origin!==null){
    aimLine.geometry.dispose();aimLine.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(origin%W+.5,heights[origin]+.3,-Math.floor(origin/W)-.5),new THREE.Vector3(hit.x+.5,heights[hit.y*W+hit.x]+.3,-hit.y-.5)]);
    aimLine.computeLineDistances();aimLine.visible=true;
  }else{marker.position.set(hit.x+.5,heights[hit.y*W+hit.x]+.2,-hit.y-.5);marker.visible=true;}
});
const keys=new Set<string>();
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){cancel();origin=null;marker.visible=false;aimLine.visible=false;return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();return;}
  if(/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))return;
  keys.add(e.key.toLowerCase());if(e.code==='Space'&&active){e.preventDefault();$('pause').click();}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
new ResizeObserver(()=>{gl.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();uniforms.viewHeight.value=canvas.clientHeight;}).observe(canvas);
let previous=performance.now(),fpsAt=previous,frames=0,frameMs:number[]=[],effectTime=0;
function animate(t:number){
  requestAnimationFrame(animate);const dt=Math.min(.05,(t-previous)/1000);frameMs.push(t-previous);previous=t;frames++;
  const at=performance.now();let count=0;while(uploads.length&&count<2&&performance.now()-at<3){upload(uploads.shift()!);count++;}
  if(finishCache&&!uploads.length){afterCache=cache();retain(afterCache);finishCache=false;}
  const pan=Math.max(W,H)*.25*dt*(keys.has('shift')?3:1);
  const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  if(x||z){camera.position.x+=x*pan;camera.position.z+=z*pan;controls.target.x+=x*pan;controls.target.z+=z*pan;}
  const turn=(keys.has('q')?1:0)-(keys.has('e')?1:0);
  if(turn){const off=camera.position.clone().sub(controls.target);off.applyAxisAngle(new THREE.Vector3(0,1,0),turn*dt);camera.position.copy(controls.target).add(off);}
  if(active&&head&&input('follow').checked&&motion()&&!paused){
    const target=new THREE.Vector3(head.x,head.z,-head.y),offset=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*1.4));controls.target.add(offset);camera.position.add(offset);
  }
  if(motion()&&!paused&&!settling)effectTime+=dt;uniforms.time.value=motion()?effectTime:0;
  surge.update(effectTime,motion()&&active);controls.update();gl.render(scene,camera);
  if(t-fpsAt>=1000){const sorted=frameMs.sort((a,b)=>a-b);$('fps').textContent=Math.round(frames*1000/(t-fpsAt))+' fps · p95 '+Math.round(sorted[Math.floor(sorted.length*.95)]??0)+' ms';frameMs=[];frames=0;fpsAt=t;}
  if(!busy&&!uploads.length){
    if(pending){const msg=pending;pending=null;send(msg);}
    else if(active&&!paused&&t>=nextAt){const dramatic=motion()&&input('follow').checked&&head&&['breakthrough','waterfall'].includes(head.event);nextAt=t+(dramatic?150:100)/speed;send({type:'advance'});}
  }
}
requestAnimationFrame(animate);
Object.assign(window,{carve:{get operation(){return lastOperation;},get state(){return {steps,active,paused,busy,queued:uploads.length,W,H,mode,head};}}});
load();
