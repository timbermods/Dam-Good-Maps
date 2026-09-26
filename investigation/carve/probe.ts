import { CarveRun, DEFAULTS, modelFor } from './engine';
import { fixture } from './maps';
import { canonicalSettle } from '../../src/core/sim/prefill';
for(const kind of ['mountain','ridge','uphill'])for(const power of [15,95]){
 const m=fixture(kind,64),r=new CarveRun(m,{...DEFAULTS,power,mode:kind==='mountain'?'unleash':'aim',defyGravity:kind==='uphill'},{origin:54*64+32,end:10*64+32});
 const start=performance.now();
 for(let k=0;k<600&&!r.metrics.stable;k++)r.step();
 console.log(kind,power,r.metrics, 'head',r.head.x,r.head.y,'path',r.path.length,'ms',performance.now()-start);
 const w=canonicalSettle(modelFor(r.map));console.log('water',w.settled,w.ticks,'centerfloor',r.path.map(s=>r.map.heights[Math.round(s.y)*64+Math.round(s.x)]).join(','));
}
