import { fixture } from './maps';
import { CarveRun, placeSource, DEFAULTS } from './engine';
for (const walls of ['steep','wide'] as const) {
 const m = fixture('mountain',64), src = Math.floor(m.H*.84)*m.W+Math.floor(m.W*.5);
 const run = new CarveRun(placeSource(m,src,4),{...DEFAULTS,walls});
 const start=performance.now();
 for(let k=0;k<800;k++) {run.step();if(k%200===199) console.log(walls,k+1,run.metrics);}
 console.log('ms',performance.now()-start);
}
