import { CarveRun, DEFAULTS, modelFor, placeSource, type CarveMap, type Settings } from './engine';
import { loadMap } from './maps';
import { canonicalRun } from '../../src/core/sim/prefill';
import { WaterSim } from '../../src/core/sim/water';
import { applyOperation, operation, type CarveOperation } from './operation';
import { changedChunks, frameContext, makeChunk, snapshot } from './meshes';
let map:CarveMap, before:CarveMap, run:CarveRun|null=null, last:CarveMap|null=null;
let undo:CarveOperation[] = [], redo:CarveOperation[] = [];
let settings:Settings={...DEFAULTS}, busy=false, epoch=0;
const send=(data:unknown)=>postMessage(data);
const yieldSlice=()=>new Promise<void>(r=>setTimeout(r,0));
async function frame(reset=false) {
  const context=frameContext(map), chunks=changedChunks(map,reset?null:last);
  if(reset) send({type:'reset',W:map.W,H:map.H,name:map.name});
  for(const c of chunks) {
    const chunk=makeChunk(map,c.cx,c.cy,context,c.objects);
    const buffers = new Set<ArrayBuffer>();
    const collect = (v:unknown):void => {
      if(ArrayBuffer.isView(v)) buffers.add(v.buffer as ArrayBuffer);
      else if(v && typeof v==='object') for(const c of Object.values(v)) collect(c);
    };
    collect(chunk);
    postMessage({type:'chunk',chunk}, [...buffers]);
    await yieldSlice();
  }
  last=snapshot(map);
  send({type:'frame',heights:map.heights,metrics:run?.metrics??null,source:map.entities.find(e=>e.id==='carve-source')??null,undo:undo.length,redo:redo.length});
}
async function settle() {
  const r=canonicalRun(modelFor(map));
  let result=null;
  while(!result) {
    result=r.advance(4);
    if(r.ticks%128===0) send({type:'status',text:'Settling water · '+Math.round(100*r.ticks/r.maxTicks)+'%'});
    await yieldSlice();
  }
  map.water={depth:result.depth,contamination:result.contamination};
  return result;
}
async function finish(reason:string) {
  if(!run)return;
  map=run.map;
  const water=await settle();
  const op=operation(before,map,settings,run.metrics.steps,reason,water);
  undo.push(op);redo=[];
  send({type:'operation',op,metrics:run.metrics});
  await frame();
  run=null;
  send({type:'finished',reason,settled:water.settled,ticks:water.ticks});
}
self.onmessage=async(event:MessageEvent)=>{
  const msg=event.data;
  if(busy) {send({type:'error',text:'Wait for the current small slice.'});return;}
  busy=true;
  const t=performance.now();
  try {
    if(run && !['advance','stop','snapshot'].includes(msg.type))throw new Error('Stop this run before editing history or the map.');
    switch(msg.type) {
      case 'load':
        epoch++;run=null;undo=[];redo=[];last=null;
        send({type:'status',text:'Loading land…'});
        map=await loadMap(msg.id);
        if(msg.id.startsWith('place:')) await settle();
        await frame(true);break;
      case 'source':
        before=snapshot(map);
        map=placeSource(map,msg.tile,msg.strength);
        // A short actual simulation shows water arriving locally before carving.
        {const sim=new WaterSim(modelFor(map),map.water);for(let i=0;i<8;i++){sim.run(4);await yieldSlice();}map.water=sim.state();}
        undo.push(operation(before,map,settings,0,'source placement',{...map.water,sat:new Uint8Array(map.W*map.H),settled:false,ticks:32}));redo=[];send({type:'sourcePlaced'});
        await frame();break;
      case 'start':
        settings={...msg.settings};before=snapshot(map);
        { const source=map.entities.find(e=>e.id==='carve-source');
          if(!source)throw new Error('Place a source first.');
          map=placeSource(map,source.y*map.W+source.x,settings.strength);
        }
        run=new CarveRun(map,settings);map=run.map;
        send({type:'started'});break;
      case 'advance':
        if(run) {run.step();map=run.map;await frame();if(run.metrics.stable)await finish('stable');}
        break;
      case 'stop': await finish(msg.reason??'stopped');break;
      case 'undo':
        if(undo.length){const op=undo.pop()!;map=applyOperation(map,op,true);redo.push(op);await frame();}
        break;
      case 'redo':
        if(redo.length){const op=redo.pop()!;map=applyOperation(map,op);undo.push(op);await frame();}
        break;
      case 'snapshot':send({type:'snapshot',map});break;
    }
  } catch(error) {send({type:'error',text:error instanceof Error?error.message:String(error)});}
  finally {busy=false;send({type:'ready',ms:performance.now()-t,epoch});}
};


