import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { root, M9_REV } from './m9.mjs';
import { drawGenome,upliftField,erode,spatialControls,baselineLevels,channelCandidates,cutChannels,constrainedLevels,metrics } from './techniques.mjs';
import { render } from './render.mjs';

const out=resolve(root,'investigation/techniques/out'), verify=process.argv.includes('--verify');
if(!verify)mkdirSync(out,{recursive:true});
const W=96,H=96, rows=[], timings=[], hasher=createHash('sha256'), gallery=[];
for(const theme of ['riverValley','canyon','highlands'])for(let seed=1;seed<=12;seed++) {
  const started=performance.now(), g=drawGenome(theme,seed,W,H,0,70);
  const raw=upliftField(g,seed,W,H), controls=spatialControls(raw,g,seed,W,H);
  const eroded=[raw,controls.field].map(f=>erode(f,W,H,g.erosion.iterations,g.erosion.k,g.erosion.diffusion));
  const ds=eroded.map(f=>channelCandidates(f,W,H));
  for(const cap of [16,22]) {
    const baseline=cutChannels(baselineLevels(eroded[0],g,seed,W,H,cap),ds[0]);
    const spatial=cutChannels(baselineLevels(eroded[1],g,seed,W,H,cap),ds[1]);
    const aware=constrainedLevels(eroded[1],g,seed,W,H,cap,ds[1]);
    const variants={baseline,spatial,beforeRepair:aware.before,constrained:aware.proposed};
    const measured={};
    for(const [name,h] of Object.entries(variants)) {
      assert(h.every(z=>z>=0&&z<=cap),'level cap');
      const d=name==='baseline'?ds[0]:ds[1];
      // Each receiver must already have been visited when its child was popped.
      const rank=new Int32Array(W*H);d.order.forEach((v,k)=>rank[v]=k);
      d.rcv.forEach((r,i)=>{if(r>=0)assert(rank[r]<rank[i],'receiver cycle');});
      measured[name]=metrics(h,d,W,H);hasher.update(h);
    }
    assert.equal(measured.constrained.uphill,0,'non-rising proposed river beds');
    rows.push({theme,seed,cap,controls:controls.scales,accepted:aware.accepted,repair:aware.repair,metrics:measured});
    // Prespecified examples: seed 1 in each theme, at each cap. Failures stay visible.
    if(seed===1) {
      const images=[];
      for(const name of ['baseline','spatial','constrained']) {
        const file=`${theme}-${seed}-${cap}-${name}.png`;
        const png=render(variants[name],name==='baseline'?ds[0]:ds[1],W,H,cap);
        hasher.update(png);
        if(!verify)writeFileSync(resolve(out,file),png);
        images.push(`<figure><img src="${file}" alt="${name}, ${theme}, seed ${seed}, cap ${cap}"><figcaption>${name}</figcaption></figure>`);
      }
      gallery.push(`<h2>${theme}, seed ${seed}, cap ${cap} — repair ${aware.accepted?'accepted':'REJECTED'}</h2><div>${images.join('')}</div>`);
    }
  }
  timings.push(performance.now()-started);
}
function average(list){return list.reduce((a,b)=>a+b,0)/list.length;}
const summary=[];
for(const cap of [16,22])for(const name of ['baseline','spatial','beforeRepair','constrained']) {
  const set=rows.filter(r=>r.cap===cap), m=set.map(r=>r.metrics[name]);
  summary.push({cap,variant:name,cases:m.length,uphill:m.reduce((a,b)=>a+b.uphill,0),
    meanFalls:average(m.map(v=>v.falls)),meanTinyShare:average(m.map(v=>v.tinyShare)),
    meanBenchShare:average(m.map(v=>v.benchShare)),meanPads:average(m.map(v=>v.padCandidates)),
    meanCliffShare:average(m.map(v=>v.cliffShare)),accepted:name==='constrained'?set.filter(r=>r.accepted).length:null});
}
// A coarse terrain-distance diagnostic, explicitly NOT M9's clone or opening test.
// Different hashes alone are not evidence of play variety; keep pairwise metric spreads too.
const spread=[];
for(const cap of [16,22])for(const theme of ['riverValley','canyon','highlands'])for(const name of ['baseline','spatial']) {
  const set=rows.filter(r=>r.cap===cap&&r.theme===theme).map(r=>r.metrics[name]);let distances=[];
  for(let i=0;i<set.length;i++)for(let j=0;j<i;j++)distances.push(Math.sqrt(
    (set[i].cliffShare-set[j].cliffShare)**2+(set[i].benchShare-set[j].benchShare)**2+
    ((set[i].falls-set[j].falls)/100)**2+((set[i].padCandidates-set[j].padCandidates)/(W*H))**2));
  spread.push({cap,theme,variant:name,meanPairwiseProxyDistance:average(distances)});
}
const result={schema:1,m9Revision:M9_REV,size:[W,H],seeds:[1,12],themes:['riverValley','canyon','highlands'],
  cap22:'M9 16-level baseline stretched to 22; experimental comparator',summary,spread,rows,sha256:hasher.digest('hex')};
const serialized=JSON.stringify(result,null,2)+'\n';
if(verify)assert.equal(serialized,readFileSync(resolve(out,'results.json'),'utf8'),'fresh-process metrics/maps/renders must match');
else {
  writeFileSync(resolve(out,'results.json'),serialized);
  writeFileSync(resolve(out,'timing.json'),JSON.stringify({node:process.version,platform:process.platform,
    note:'Per theme/seed: both fields, erosion, both caps, metrics, plus renders for seed 1. Not production budgets.',
    meanMs:average(timings),maxMs:Math.max(...timings)},null,2)+'\n');
  writeFileSync(resolve(out,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>DGM technique experiments</title><style>body{font:16px system-ui;background:#efede2;color:#29352f;margin:2rem}h1{font-size:28px}h2{font-size:18px;margin-top:2rem}div{display:grid;grid-template-columns:repeat(3,1fr)}figure{margin:0}img{width:100%}figcaption{text-align:center;font-weight:bold}p{max-width:85ch}</style><h1>Terrain techniques — paired experiments</h1><p>All maps are ours. Each row shares an M9 genome and seed. Left: M9 levels with a diagnostic channel cut. Middle: independent spatial controls. Right: controls plus constrained levels (including rejected proposals).</p><p>Blue marks candidate drainage channels, not simulated water. Green/tan shows height, not moisture. No starts, slopes, plants, or voxel caves are placed. 22-level baselines stretch M9's 16-level result.</p>${gallery.join('')}`);
}
console.log(JSON.stringify({verified:verify,sha256:result.sha256,summary,spread},null,2));
