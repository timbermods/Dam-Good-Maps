import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pickHeightfield } from '../../src/render3d/pick';
import { sceneUniforms,terrainMaterial,waterMaterial,objectMaterial,tileTexture,lightTexture,overlayTexture,drawPatterns } from '../../src/render3d/materials';
import { MAPS } from './maps';
import type { Chunk,Geometry } from './meshes';
import type { QuakeOperation } from './operation';
import { Fault,DEFAULTS,type Settings,type Point,type Intent } from './engine';
import { Rupture,type Head } from './effects';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id),canvas=$<HTMLCanvasElement>('view'),notice=$('notice');
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const scene=new THREE.Scene();scene.background=new THREE.Color('#b8cbd8');
const camera=new THREE.PerspectiveCamera(42,1,.1,3000),gl=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.outputColorSpace=THREE.LinearSRGBColorSpace;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.maxPolarAngle=Math.PI*.49;
controls.mouseButtons={LEFT:undefined,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
scene.add(new THREE.HemisphereLight(0xffffff,0x687366,2));
const sun=new THREE.DirectionalLight(0xfff4d6,2);sun.position.set(-80,160,100);scene.add(sun);
const uniforms=sceneUniforms(1,1,tileTexture(1,1,new Uint8Array(4)),lightTexture(1,1,new Uint8Array(16)),overlayTexture(1,1),overlayTexture(1,1));
uniforms.patternTex.value=drawPatterns(gl).texture;uniforms.markers.value=0;
const groundMat=terrainMaterial(uniforms,0,16),waterMat=waterMaterial(uniforms),objectsMat=objectMaterial(uniforms);
groundMat.uniforms.rockBeds={value:new Array(23).fill(0)};
groundMat.fragmentShader='uniform float rockBeds[23];\n'+groundMat.fragmentShader.replace('float py = fwidth(y);','wc *= mix(vec3(1.04,1.01,.95),vec3(.78,.85,.87),rockBeds[int(clamp(level,0.0,22.0))]); float py = fwidth(y);');
const chunks=new Map<string,THREE.Group>(),uploads:Chunk[]=[];
const retained=new Set<THREE.BufferGeometry>(),retainedInstances=new Set<THREE.InstancedMesh>();
const marker=new THREE.Mesh(new THREE.TorusGeometry(.9,.12,5,20),new THREE.MeshBasicMaterial({color:0xffeac2}));
marker.rotation.x=Math.PI/2;marker.visible=false;scene.add(marker);
const aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xf8efd2,dashSize:1,gapSize:.6,depthTest:false}));scene.add(aimLine);aimLine.renderOrder=9;
const surge=new Rupture();scene.add(surge.group);
let W=0,H=0,heights=new Uint8Array(),keep=new Uint8Array(),busy=true,active=false,mode:'lift'|'slide'='lift',path:Point[]=[],effectPath:Point[]=[];
let nextAt=0,steps=0,epoch=0,top=false,settling=false,head:Head|null=null,startedAt=0;
let canReroll=false,historyIndex=0,cachedAfterIndex=-1;
let savedRun:unknown=null,lastOperation:QuakeOperation|null=null,finishCache=false;
interface Lighting {tiles:Uint8Array;light:Uint8Array;checks:any}
let lighting:Lighting|null=null;
interface Cache {groups:Map<string,THREE.Group>;heights:Uint8Array;lighting:Lighting}
let beforeCache:Cache|null=null,afterCache:Cache|null=null,carveBaseCache:Cache|null=null;
let priorCaches:{before:Cache|null;after:Cache|null;base:Cache|null;index:number}|null=null;
const historyCaches=new Map<number,Cache>();
const allCaches=()=>[beforeCache,afterCache,carveBaseCache,priorCaches?.before,priorCaches?.after,priorCaches?.base,...historyCaches.values()];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');input('motion').checked=!reduced.matches;
const motion=()=>!reduced.matches&&input('motion').checked;
function send(msg:Record<string,unknown>){busy=true;worker.postMessage(msg);}
function stateControls(){
 for(const id of ['map','reset','lift','slide','power','scarp','replay-file'])($<HTMLButtonElement>(id)).disabled=active||busy;
 $<HTMLButtonElement>('reroll').disabled=active||busy||!!uploads.length||finishCache||!canReroll;
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
  const c=l.checks;$('checks').textContent=c.present?('Start · '+(c.meets?'resources in reach':'resources missing')+'\n'+c.reach.toLocaleString()+' reachable tiles\nWater '+(c.water===null?'out of reach':c.water+' tiles')+' · Wood '+c.trees+' · Berries '+c.bushes):'No start on this map';
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
function pruneCaches(){
  const oldInstances=new Set(retainedInstances),old=new Set(retained);
  retainedInstances.clear();retained.clear();allCaches().forEach(c=>retain(c??null));
  const currentInstances=new Set<THREE.InstancedMesh>(),current=new Set<THREE.BufferGeometry>();
  chunks.forEach(g=>g.traverse(o=>{if(o instanceof THREE.Mesh)current.add(o.geometry);if(o instanceof THREE.InstancedMesh)currentInstances.add(o);}));
  for(const o of oldInstances)if(!retainedInstances.has(o)&&!currentInstances.has(o))o.dispose();
  for(const g of old)if(!retained.has(g)&&!current.has(g))g.dispose();
}
function releaseCaches(){beforeCache=afterCache=carveBaseCache=null;priorCaches=null;historyCaches.clear();pruneCaches();}
function preserveCaches(){priorCaches={before:beforeCache,after:afterCache,base:carveBaseCache,index:cachedAfterIndex};}
function rollbackCaches(){
  if(!priorCaches)return;
  beforeCache=priorCaches.before;afterCache=priorCaches.after;carveBaseCache=priorCaches.base;cachedAfterIndex=priorCaches.index;
  priorCaches=null;pruneCaches();
}
function upload(c:Chunk){
  let group=chunks.get(c.key);
  if(group&&allCaches().some(saved=>saved?.groups.get(c.key)===group)){
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
function instruction(){notice.textContent=path.length>1?'Click the side to '+(mode==='lift'?'lift.':'slide forward.') :path.length?'Shift-click for a straight fault, or drag from here.':'Drag a fault across the land.';}
worker.onmessage=(event:MessageEvent)=>{
 const m=event.data;if(m.epoch<epoch)return;epoch=m.epoch;
 if(m.type==='reset'){W=m.W;H=m.H;releaseCaches();uploads.length=0;for(const g of chunks.values()){dispose(g);scene.remove(g);}chunks.clear();groundMat.uniforms.rockBeds.value=m.rockLayers;resetView();}
 if(m.type==='chunk')uploads.push(m.chunk);
 if(m.type==='lighting')setLighting(m);
 if(m.type==='frame'){
  canReroll=!!m.canReroll;historyIndex=m.undo;heights=m.heights;keep=m.keep;head=m.head;effectPath=m.path;
  if(m.seed!==null)$('seed-label').textContent='Personality '+m.seed;
  surge.set(head,effectPath,heights,W);
  if(m.metrics){steps=m.metrics.steps;$('metrics').textContent=m.metrics.changed.toLocaleString()+' tiles moved · '+m.metrics.toppled+' trees toppled';}
  $<HTMLButtonElement>('undo').disabled=!active&&!m.undo;$<HTMLButtonElement>('redo').disabled=active||!m.redo;
 }
 if(m.type==='status')notice.textContent=m.text;
 if(m.type==='settling'){settling=true;canvas.dataset.ruptureMs=String(performance.now()-startedAt);notice.textContent='Water finding its level · Esc reverts';}
 if(m.type==='started'){showSettings(m.settings);$('seed-label').textContent='Personality '+m.seed;active=true;settling=false;steps=0;effectPath=m.path;const p=m.path[0];head={...p,z:heights[Math.round(p.y)*W+Math.round(p.x)],progress:.02};surge.set(head,effectPath,heights,W);notice.textContent='The fault is moving · Esc reverts';}
 if(m.type==='cancelled'){rollbackCaches();active=false;settling=false;head=null;surge.set(null,[],heights,W);notice.textContent='Whole quake reverted.';}
 if(m.type==='finished'){
  priorCaches=null;canReroll=true;historyIndex=m.undo;cachedAfterIndex=m.undo;active=false;settling=false;head=null;finishCache=true;surge.set(null,[],heights,W);
  const sorted=measurements.slice().sort((a,b)=>a-b);canvas.dataset.eventP95Ms=String(sorted[Math.floor(sorted.length*.95)]??0);canvas.dataset.eventMaxMs=String(Math.max(0,...measurements));
  notice.textContent=m.settled?'A new piece of land. One undo brings it back.':'Quake saved. Water reached the repository’s settle limit.';$<HTMLButtonElement>('undo').disabled=false;
 }
 if(m.type==='operation'){lastOperation=m.op;savedRun={format:1,base:m.base,quakeBase:m.quakeBase,operation:m.op};$<HTMLButtonElement>('save-run').disabled=false;}
 if(m.type==='replayed'){notice.textContent='Exact saved quake restored.';finishCache=true;cachedAfterIndex=historyIndex;}
 if(m.type==='error'){notice.textContent=m.text;if(active){restoreView(beforeCache);rollbackCaches();}active=false;settling=false;head=null;}
 if(m.type==='ready'){busy=false;stateControls();if(notice.textContent==='Loading land…')instruction();}
};
worker.onerror=e=>{notice.textContent='Worker error: '+e.message;busy=false;active=false;stateControls();};
const select=$<HTMLSelectElement>('map');for(const [id,name]of MAPS){const o=document.createElement('option');o.value=id;o.textContent=name;select.add(o);}
select.value='fixture:river:128';
function load(){canReroll=false;cachedAfterIndex=-1;path=[];marker.visible=false;aimLine.visible=false;savedRun=null;lastOperation=null;head=null;$('metrics').textContent='';notice.textContent='Loading land…';$<HTMLButtonElement>('save-run').disabled=true;send({type:'load',id:select.value});stateControls();}
select.onchange=load;$('reset').onclick=load;
for(const value of ['lift','slide'] as const)$(value).onclick=()=>{mode=value;for(const a of ['lift','slide'])$(a).setAttribute('aria-pressed',String(a===mode));powerLabel();instruction();};
function powerLabel(){const p=Number(input('power').value);$('power-label').textContent=(mode==='lift'?1+Math.round(p*.075):1+Math.round(p*.13))+(mode==='lift'?' levels':' tiles');}
input('power').oninput=powerLabel;
let nextSeed=crypto.getRandomValues(new Uint32Array(1))[0];
function settings():Settings{return {mode,power:Number(input('power').value),scarp:$<HTMLSelectElement>('scarp').value as Settings['scarp'],seed:nextSeed++>>>0};}
function showSettings(s:Settings){mode=s.mode;input('power').value=String(s.power);$<HTMLSelectElement>('scarp').value=s.scarp;for(const a of ['lift','slide'])$(a).setAttribute('aria-pressed',String(a===mode));powerLabel();}
$('reroll').onclick=()=>{if(!canReroll||busy||active||uploads.length)return;preserveCaches();beforeCache=cache();if(beforeCache)historyCaches.set(historyIndex,beforeCache);afterCache=null;retain(beforeCache);if(historyIndex===cachedAfterIndex)restoreView(carveBaseCache);else carveBaseCache=null;pruneCaches();active=true;path=[];aimLine.visible=false;startedAt=performance.now();measurements.length=0;delete canvas.dataset.firstChangeMs;notice.textContent='Trying another personality…';send({type:'reroll'});stateControls();};
function begin(side:1|-1,explicit?:{settings:Settings;intent:Intent}){
 if(busy||active||uploads.length)return;
 preserveCaches();beforeCache=cache();afterCache=null;carveBaseCache=beforeCache;pruneCaches();active=true;marker.visible=false;aimLine.visible=false;
 if(beforeCache)historyCaches.set(historyIndex,beforeCache);for(const k of historyCaches.keys())if(k>historyIndex)historyCaches.delete(k);measurements.length=0;
 const intent=explicit?.intent??{path:path.map(p=>({...p})),side};startedAt=performance.now();delete canvas.dataset.firstChangeMs;send({type:'start',settings:explicit?.settings??settings(),intent});path=[];notice.textContent='The fault is waking · Esc reverts';stateControls();
}
function cancel(){
 if(!active){path=[];aimLine.visible=false;marker.visible=false;if(!busy&&historyIndex)$('undo').click();else instruction();return;}
 epoch++;active=false;settling=false;head=null;restoreView(beforeCache);rollbackCaches();surge.set(null,[],heights,W);busy=true;worker.postMessage({type:'cancel'});notice.textContent='Whole quake reverted.';stateControls();
}
$('undo').onclick=()=>{if(active){cancel();return;}if(busy)return;restoreView(historyCaches.get(historyIndex-1)??(historyIndex===cachedAfterIndex?beforeCache:null));send({type:'undo'});notice.textContent='Whole quake reverted.';};
$('redo').onclick=()=>{if(busy)return;restoreView(historyCaches.get(historyIndex+1)??(historyIndex===cachedAfterIndex-1?afterCache:null));send({type:'redo'});notice.textContent='Stored result restored.';};
$('save-run').onclick=()=>{if(!savedRun)return;const text=JSON.stringify(savedRun,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as number[]):v),a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='quake-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
input('replay-file').onchange=async()=>{const f=input('replay-file').files?.[0];if(!f||active||busy)return;if(f.size>32*1024*1024){notice.textContent='Quake file is too large.';return;}try{send({type:'replay',bundle:JSON.parse(await f.text())});}catch{notice.textContent='This quake file could not be read.';}};
$('home').onclick=resetView;$('top').onclick=()=>{if(top){resetView();return;}camera.position.set(controls.target.x,Math.max(W,H)*1.55,controls.target.z+.01);controls.update();top=true;$('top').textContent='Orbit';};
function hitAt(e:PointerEvent){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);return pickHeightfield({origin:ray.ray.origin.toArray(),direction:ray.ray.direction.toArray()},W,H,heights);}
function reason(points=path){if(points.length<2)return false;const f=new Fault({...DEFAULTS,seed:0},{path:points,side:1});for(let i=0;i<keep.length;i++)if(keep[i]){const d=f.at(i%W,Math.floor(i/W));if(Math.abs(d.d)<3.5&&d.end<3.5)return true;}return false;}
function drawLine(points=path){
 const bad=reason(points),sample:THREE.Vector3[]=[];
 for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n,i=Math.round(y)*W+Math.round(x);sample.push(new THREE.Vector3(x+.5,heights[i]+.35,-y-.5));}}
 aimLine.geometry.dispose();aimLine.geometry=new THREE.BufferGeometry().setFromPoints(sample);(aimLine.material as THREE.LineDashedMaterial).color.set(bad?0xd44c40:0xffedb4);aimLine.computeLineDistances();aimLine.visible=true;
 if(bad)notice.textContent='Start here';else instruction();return bad;
}
let down:Point|null=null,dragged=false,choosing=false;
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||active||busy||uploads.length||!W)return;const h=hitAt(e);if(!h)return;canvas.setPointerCapture(e.pointerId);down={x:e.clientX,y:e.clientY};dragged=false;
 if(e.shiftKey&&path.length===1){path.push({x:h.x,y:h.y});drawLine();down=null;return;}
 choosing=path.length>1;if(!choosing){path=[{x:h.x,y:h.y}];marker.visible=false;}canvas.focus();
});
canvas.addEventListener('pointermove',e=>{
 if(active||busy||!W)return;const h=hitAt(e);if(!h)return;
 if(down&&!choosing&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>3){dragged=true;const prev=path[path.length-1];if(Math.hypot(h.x-prev.x,h.y-prev.y)>=2&&path.length<512)path.push({x:h.x,y:h.y});drawLine();}
 else if(path.length===1&&!down)drawLine([path[0],{x:h.x,y:h.y}]);
 else if(path.length>1&&!down){marker.position.set(h.x+.5,heights[h.y*W+h.x]+.3,-h.y-.5);marker.visible=true;}
});
canvas.addEventListener('pointerup',e=>{
 if(!down)return;down=null;const h=hitAt(e);if(!h)return;
 if(choosing&&!dragged){if(reason()){notice.textContent='Start here';return;}const f=new Fault(DEFAULTS,{path,side:1}),a=f.at(h.x,h.y);begin(a.d>=0?1:-1);}
 else if(dragged){drawLine();}else instruction();
});
canvas.addEventListener('pointercancel',()=>{down=null;path=[];aimLine.visible=false;});
canvas.addEventListener('wheel',e=>{if(e.shiftKey&&!active&&!busy){e.preventDefault();e.stopImmediatePropagation();input('power').value=String(Math.max(0,Math.min(100,Number(input('power').value)+(e.deltaY<0?5:-5))));powerLabel();}},{capture:true,passive:false});
const keys=new Set<string>();window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();if(path.length){path=[];aimLine.visible=false;instruction();}else cancel();return;}
 if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();$(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo').click();return;}
 if(/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))return;keys.add(e.key.toLowerCase());
});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
new ResizeObserver(()=>{gl.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();uniforms.viewHeight.value=canvas.clientHeight;}).observe(canvas);
let previous=performance.now(),fpsAt=previous,frames=0,frameMs:number[]=[],effectTime=0;
const measurements:number[]=[];
function animate(t:number){
 requestAnimationFrame(animate);const dt=Math.min(.05,(t-previous)/1000);frameMs.push(t-previous);if(active)measurements.push(t-previous);previous=t;frames++;
 const hadUploads=uploads.length>0,at=performance.now();let count=0;while(uploads.length&&count<2&&performance.now()-at<3){upload(uploads.shift()!);count++;if(active&&!canvas.dataset.firstChangeMs)canvas.dataset.firstChangeMs=String(performance.now()-startedAt);}
 if(hadUploads&&!uploads.length)stateControls();if(finishCache&&!uploads.length){afterCache=cache();if(afterCache)historyCaches.set(historyIndex,afterCache);retain(afterCache);finishCache=false;pruneCaches();stateControls();}
 const pan=Math.max(W,H)*.25*dt*(keys.has('shift')?3:1),x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 if(x||z){camera.position.x+=x*pan;camera.position.z+=z*pan;controls.target.x+=x*pan;controls.target.z+=z*pan;}
 const turn=(keys.has('q')?1:0)-(keys.has('e')?1:0);if(turn){const off=camera.position.clone().sub(controls.target);off.applyAxisAngle(new THREE.Vector3(0,1,0),turn*dt);camera.position.copy(controls.target).add(off);}
 if(active&&head&&input('follow').checked&&motion()&&!settling){const target=new THREE.Vector3(head.x,head.z,-head.y),offset=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*1.4));controls.target.add(offset);camera.position.add(offset);}
 if(motion())effectTime+=dt;uniforms.time.value=motion()?effectTime:0;surge.update(effectTime,motion()&&active&&!settling);controls.update();
 for(const [key,g] of chunks){const [cx,cy]=key.split(',').map(Number),near=head&&Math.hypot(cx*32+16-head.x,cy*32+16-head.y)<18+Number(input('power').value)*.5;
  g.position.y=motion()&&active&&!settling&&near?Math.sin(t*.04+cx+cy)*.12:0;}
 const shake=motion()&&input('shake').checked&&active&&!settling ? .12 : 0;camera.position.x+=Math.sin(t*.045)*shake;camera.position.y+=Math.cos(t*.061)*shake;gl.render(scene,camera);camera.position.x-=Math.sin(t*.045)*shake;camera.position.y-=Math.cos(t*.061)*shake;
 if(t-fpsAt>=1000){const sorted=frameMs.sort((a,b)=>a-b);$('fps').textContent=Math.round(frames*1000/(t-fpsAt))+' fps · p95 '+Math.round(sorted[Math.floor(sorted.length*.95)]??0)+' ms';frameMs=[];frames=0;fpsAt=t;}
 if(!busy&&!uploads.length&&active&&!settling&&t>=nextAt){nextAt=t+65;send({type:'advance'});}
}
requestAnimationFrame(animate);powerLabel();
Object.assign(window,{quake:{get operation(){return lastOperation;},get bundle(){return savedRun;},get state(){return {steps,active,busy,settling,queued:uploads.length,W,H,mode,head,path,heights,measurements};},
 start:(settings:Settings,intent:Intent)=>begin(intent.side,{settings,intent}),
 project:(x:number,y:number)=>{const p=new THREE.Vector3(x+.5,heights[Math.floor(y)*W+Math.floor(x)]+.1,-y-.5).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}
}});load();
