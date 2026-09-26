import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pickHeightfield } from '../../src/render3d/pick';
import { MAPS } from './maps';
import type { Chunk, Geometry } from './meshes';
import type { CarveOperation } from './operation';
const $ = <T extends HTMLElement = HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('view'), notice=$('notice'), fps=$('fps');
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const scene=new THREE.Scene();scene.background=new THREE.Color('#dbe4df');
const camera=new THREE.PerspectiveCamera(42,1,.1,3000);
const gl=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.outputColorSpace=THREE.LinearSRGBColorSpace;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x687366,2));
const sun=new THREE.DirectionalLight(0xfff4d6,2);sun.position.set(-80,160,100);scene.add(sun);
const groundMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
const waterMaterial=new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:.84,side:THREE.DoubleSide,depthWrite:false});
const chunks=new Map<string,THREE.Group>(), uploads:Chunk[]=[];
const marker=new THREE.Mesh(new THREE.TorusGeometry(.9,.12,5,20),new THREE.MeshBasicMaterial({color:0xefe7a2}));
marker.rotation.x=Math.PI/2;marker.visible=false;scene.add(marker);
let W=0,H=0,heights=new Uint8Array(),busy=true,active=false,paused=false,placing=true,sourcePlaced=false,speed=1;
let pending:Record<string,unknown>|null=null,nextAt=0,steps=0,duration=0,top=false,frameMs:number[]=[];
let lastOperation:CarveOperation|null=null;let savedRun:unknown=null;
function send(msg:Record<string,unknown>){busy=true;worker.postMessage(msg);}
function controlsState() {
  $<HTMLButtonElement>('carve').disabled=!sourcePlaced||active||busy;
  $<HTMLButtonElement>('source').disabled=active||busy;
  $<HTMLButtonElement>('pause').disabled=!active;
  $<HTMLButtonElement>('stop').disabled=!active;
  for(const id of ['map','walls','layers','duration','strength','reset','replay-file']) ($<HTMLInputElement>(id)).disabled=active||busy;
  $('carve').classList.toggle('active',active);
}
function resetView(){controls.target.set(W/2,3,-H/2);camera.position.set(W*.9,Math.max(W,H)*.95,H*.45);controls.update();top=false;$('top').textContent='Top-down';}
function geometry(d:Geometry) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(d.positions,3));
  g.setAttribute('normal',new THREE.BufferAttribute(d.normals,3,d.normals instanceof Int8Array));
  g.setAttribute('color',new THREE.BufferAttribute(d.colors,3));
  if(d.indices)g.setIndex(new THREE.BufferAttribute(d.indices,1));
  g.computeBoundingSphere();return g;
}
function dispose(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();if(o instanceof THREE.InstancedMesh)o.dispose();});}
function upload(c:Chunk) {
  let group=chunks.get(c.key);
  if(!group){group=new THREE.Group();scene.add(group);chunks.set(c.key,group);}
  for(const name of ['terrain','water']) {
    const old=group.getObjectByName(name) as THREE.Mesh|undefined;
    if(old){old.geometry.dispose();group.remove(old);}
    const m=new THREE.Mesh(geometry(name==='terrain'?c.terrain:c.water),name==='terrain'?groundMaterial:waterMaterial);
    m.name=name;group.add(m);
  }
  if(c.objects) {
    const old=group.getObjectByName('objects') as THREE.Group|undefined;
    if(old){dispose(old);group.remove(old);}
    const objects=new THREE.Group();objects.name='objects';
    for(const o of c.objects) {
      const m=new THREE.InstancedMesh(geometry(o.geometry),groundMaterial,o.count);
      m.instanceMatrix.array.set(o.matrices);m.instanceMatrix.needsUpdate=true;
      m.instanceColor=new THREE.InstancedBufferAttribute(o.colors,3);m.computeBoundingSphere();objects.add(m);
    }group.add(objects);
  }
}
worker.onmessage=(event:MessageEvent)=>{
  const m=event.data;
  if(m.type==='reset'){W=m.W;H=m.H;uploads.length=0;for(const g of chunks.values()){dispose(g);scene.remove(g);}chunks.clear();resetView();}
  if(m.type==='chunk')uploads.push(m.chunk);
  if(m.type==='sourcePlaced')notice.textContent='Source placed. Switch on carving.';
  if(m.type==='frame'){
    heights=m.heights;sourcePlaced=!!m.source;
    if(!sourcePlaced)marker.visible=false;
    if(active){$<HTMLButtonElement>('undo').disabled=true;$<HTMLButtonElement>('redo').disabled=true;}
    if(!m.metrics)$('metrics').textContent='';
    if(m.metrics){steps=m.metrics.steps;$('metrics').textContent=(steps/10).toFixed(1)+' s · cut '+m.metrics.cut+' · deposited '+m.metrics.deposited;}
    $<HTMLButtonElement>('undo').disabled=active||!m.undo;
    $<HTMLButtonElement>('redo').disabled=active||!m.redo;
  }
  if(m.type==='status')notice.textContent=m.text;
  if(m.type==='started'){active=true;paused=false;steps=0;placing=false;notice.textContent='The water is carving. Stop whenever the land feels right.';$('source').setAttribute('aria-pressed','false');}
  if(m.type==='finished'){active=false;paused=false;$('pause').textContent='Pause';notice.textContent=m.reason==='stable'?'The river has settled into its course.': 'Carving stopped. One undo step saved.';
    if(!m.settled)notice.textContent+=' Water reached the repo’s settle limit; this is its canonical result, not a converged solve.';
    $<HTMLButtonElement>('undo').disabled=false;
  }
  if(m.type==='operation'){lastOperation=m.op;savedRun={format:1,base:m.base,operation:m.op};$<HTMLButtonElement>('save-run').disabled=false;}
  if(m.type==='replayed')notice.textContent='Saved result replayed exactly. No erosion or water simulation was run.';
  if(m.type==='error'){notice.textContent=m.text;active=false;pending=null;}
  if(m.type==='ready'){busy=false;controlsState();if(!active&&(notice.textContent==='Loading…'||notice.textContent?.startsWith('Loading land')))notice.textContent=sourcePlaced?'Source placed. Switch on carving.':'Click a hillside to place a source.';}
};
worker.onerror=e=>{notice.textContent='Worker error: '+e.message;busy=false;active=false;controlsState();};
const select=$<HTMLSelectElement>('map');
for(const [id,name] of MAPS){const o=document.createElement('option');o.value=id;o.textContent=name;select.add(o);}
function load(){sourcePlaced=false;lastOperation=null;savedRun=null;$<HTMLButtonElement>('save-run').disabled=true;steps=0;marker.visible=false;placing=true;$('source').setAttribute('aria-pressed','true');$('metrics').textContent='';send({type:'load',id:select.value});controlsState();}
$('save-run').onclick=()=>{
 if(!savedRun)return;
 const text=JSON.stringify(savedRun,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as number[]):v);
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 a.href=url;a.download='carve-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$<HTMLInputElement>('replay-file').onchange=async(e)=>{
 const f=(e.target as HTMLInputElement).files?.[0];if(!f||active||busy)return;
 if(f.size>32*1024*1024){notice.textContent='Run file is too large.';return;}
 try{const bundle=JSON.parse(await f.text());send({type:'replay',bundle});}
 catch{notice.textContent='This is not a readable run file.';}
};
select.onchange=load;$('reset').onclick=load;
$('source').onclick=()=>{placing=!placing;$('source').setAttribute('aria-pressed',String(placing));};
$('carve').onclick=()=>{
 duration=Number($<HTMLInputElement>('duration').value)*10;
 send({type:'start',settings:{walls:$<HTMLSelectElement>('walls').value,layers:$<HTMLInputElement>('layers').checked,strength:Number($<HTMLInputElement>('strength').value)}});controlsState();
};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';notice.textContent=paused?'Paused. The camera is still free.':'The water is carving.';};
$('speed').onclick=()=>{speed=speed===1?4:speed===4?12:1;$('speed').textContent=speed+'×';};
$('stop').onclick=()=>{pending={type:'stop'};paused=true;notice.textContent='Finishing this step and settling water…';};
$('undo').onclick=()=>{send({type:'undo'});notice.textContent='Run undone.';};
$('redo').onclick=()=>{send({type:'redo'});notice.textContent='Stored result restored.';};
$('home').onclick=resetView;
$('top').onclick=()=>{if(top){resetView();return;}camera.position.set(controls.target.x,Math.max(W,H)*1.3,controls.target.z+.01);controls.update();top=true;$('top').textContent='Orbit';};
let down:{x:number;y:number}|null=null;
canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
function hitAt(e:PointerEvent){
 const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
 ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
 return pickHeightfield({origin:ray.ray.origin.toArray(),direction:ray.ray.direction.toArray()},W,H,heights);
}
canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;
 if(!placing||active||busy||!W)return;
 const hit=hitAt(e);if(!hit)return;
 const tile=hit.y*W+hit.x;sourcePlaced=true;marker.position.set(hit.x+.5,heights[tile]+.2,-hit.y-.5);marker.visible=true;
 send({type:'source',tile,strength:Number($<HTMLInputElement>('strength').value)});controlsState();
});
canvas.addEventListener('pointermove',e=>{if(placing&&!active&&W){const h=hitAt(e);if(h){marker.position.set(h.x+.5,heights[h.y*W+h.x]+.2,-h.y-.5);marker.visible=true;}}});
const keys=new Set<string>();
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))return;keys.add(e.key.toLowerCase());if(e.key==='Escape'){if(active){pending={type:'stop'};paused=true;}placing=false;$('source').setAttribute('aria-pressed','false');}if(e.code==='Space'&&active){e.preventDefault();$('pause').click();}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
new ResizeObserver(()=>{gl.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();}).observe(canvas);
let previous=performance.now(),fpsAt=previous,frames=0;
function animate(t:number){
 requestAnimationFrame(animate);const dt=Math.min(.05,(t-previous)/1000);frameMs.push(t-previous);previous=t;frames++;
 // Upload at most two pre-built chunks and at most 3 ms of CPU work per frame.
 const start=performance.now();let count=0;while(uploads.length&&count<2&&performance.now()-start<3){upload(uploads.shift()!);count++;}
 const pan=(Math.max(W,H)*.25)*dt*(keys.has('shift')?3:1);
 const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
 const z=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 if(x||z){camera.position.x+=x*pan;camera.position.z+=z*pan;controls.target.x+=x*pan;controls.target.z+=z*pan;}
 const turn=(keys.has('q')?1:0)-(keys.has('e')?1:0);
 if(turn){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),turn*dt);camera.position.copy(controls.target).add(offset);}
 controls.update();gl.render(scene,camera);
 if(t-fpsAt>=1000){const sorted=frameMs.sort((a,b)=>a-b);fps.textContent=Math.round(frames*1000/(t-fpsAt))+' fps · p95 '+Math.round(sorted[Math.floor(sorted.length*.95)]??0)+' ms';frameMs=[];frames=0;fpsAt=t;}
 if(!busy&&!uploads.length){
   if(pending){const msg=pending;pending=null;send(msg);}
   else if(active&&!paused&&t>=nextAt){nextAt=t+100/speed;if(duration&&steps>=duration){paused=true;send({type:'stop',reason:'duration'});}else send({type:'advance'});}
 }
}
requestAnimationFrame(animate);
// Debugging/export is read-only and never used by replay.
Object.assign(window,{carve:{get operation(){return lastOperation;},get state(){return {steps,active,paused,busy,queued:uploads.length,W,H};},gpu:gl.getContext().getParameter(gl.getContext().RENDERER)}});
load();
