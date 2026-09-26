import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { launch } from './browser.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { compactJSON } from './compact-json.mjs';
import { unzipSync,zipSync,strFromU8,strToU8 } from 'fflate';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
const places=JSON.parse(await readFile('places.json','utf8')),rows=[],before=[];
const run=JSON.parse(await readFile('results-water/run.json','utf8'));
assert.equal(run.attempts,150,'Finish the complete 150-request matrix before summarizing.');
assert.equal(run.places,50);assert.deepEqual(run.sizes,[96,128,256]);assert.notEqual(run.status,'running');
const id=(p,n)=>`${String(p).padStart(2,'0')}-${n}`;
for(const p of places)for(const n of [96,128,256]){
  const file=`results-water/${id(p.id,n)}.json`,row=JSON.parse(await readFile(file,'utf8'));
  rows.push(row);await writeFile(file,compactJSON(row));
  if(!row.error){
    const previewFile=`results-water/previews/${id(p.id,n)}.png`,png=PNG.sync.read(await readFile(previewFile));
    assert.equal(png.width,row.size);
    for(const s of row.waterDesign.sources)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const x=s.i%row.size+dx,y=row.size-1-Math.floor(s.i/row.size)+dy;
      if(x<0||y<0||x>=row.size||y>=row.size)continue;
      const k=(y*row.size+x)*4,v=dx===0&&dy===0?255:25;
      png.data[k]=v;png.data[k+1]=v;png.data[k+2]=v;
    }
    await writeFile(previewFile,PNG.sync.write(png));
  }
  before.push(JSON.parse(await readFile(`results/${id(p.id,n)}.json`,'utf8')));
}
const count=(rs,k)=>rs.filter(r=>r[k]).length;
assert.equal(rows.length,150);assert.equal(count(before,'passed'),47);
assert.equal(new Set(before.filter(r=>r.passed).map(r=>r.id)).size,30);
for(const r of rows) {
  if(r.error)continue;
  assert.equal(r.waterDesign.algorithm,'designed-water-v3-heads-only');
  assert.ok(r.sourceCount>0);assert.equal(r.edgeChanges,0);
  assert.ok(r.autoTry.attempts.length<=14);
  for(const a of r.autoTry.attempts)for(const s of a.sources??[]) {
    assert.ok(s.i>=0&&s.i<a.size*a.size);
    const edge=s.i%a.size===0||s.i%a.size===a.size-1||s.i<a.size||s.i>=a.size*(a.size-1);
    if(s.kind==='tributary head spring'){assert.equal(s.upstreamChannels,0);assert.equal(edge,false);}
    else {assert.ok(['map-edge river entry','designed map-edge entry'].includes(s.kind));assert.equal(edge,true);}
  }
  if(r.passed){assert.ok(r.current.passed&&r.roundTripPassed&&r.settled&&r.start&&r.originAudit.checked&&r.originAudit.passed);assert.ok(r.current.waterDistance!==null&&r.current.waterDistance<=20);}
}
const perPlace=k=>places.filter(p=>rows.some(r=>r.id===p.id&&r[k])).length;
const stat=xs=>{xs=xs.filter(Number.isFinite).sort((a,b)=>a-b);return {median:xs[Math.floor(xs.length*.5)],p90:xs[Math.floor(xs.length*.9)],max:xs.at(-1)};};
const summary={requests:rows.length,baseline:{conversions:count(before,'passed'),places:new Set(before.filter(r=>r.passed).map(r=>r.id)).size},firstPlan:count(rows,'firstPlanPassed'),direct:count(rows,'directPassed'),directPlaces:perPlace('directPassed'),recovered:count(rows,'passed'),recoveredPlaces:perPlace('passed'),roundTrips:count(rows,'roundTripPassed'),errors:rows.filter(r=>r.error).length,attemptErrors:rows.reduce((s,r)=>s+(r.autoTry?.attempts.filter(a=>a.error).length??0),0),minHeartbeats:Math.min(...rows.map(r=>r.heartbeats??0)),sourceDesigns:rows.reduce((s,r)=>s+(r.autoTry?.attempts.length??0),0),changedSize:rows.filter(r=>r.passed&&r.size!==r.requested.size).length,shifted:rows.filter(r=>r.passed&&(r.lat!==r.requested.lat||r.lon!==r.requested.lon)).length,bySize:[],failures:{}};
summary.originAuditedPasses=rows.filter(r=>r.passed&&r.originAudit?.passed).length;
summary.originRejectedAttempts=rows.flatMap(r=>r.autoTry?.attempts??[]).filter(a=>a.failures?.some(f=>f.id==='water.source_origins')).length;
summary.multiHeadPasses=rows.filter(r=>r.passed&&r.sourceCount>1).length;
for(const n of [96,128,256]) {
  const rr=rows.filter(r=>(r.requested?.size??r.size)===n),bb=before.filter(r=>r.size===n);
  summary.bySize.push({size:n,before:count(bb,'passed'),firstPlan:count(rr,'firstPlanPassed'),direct:count(rr,'directPassed'),recovered:count(rr,'passed'),totalSeconds:stat(rr.map(r=>r.timings?.totalMs/1000)),directSeconds:stat(rr.map(r=>r.timings?.directMs/1000)),retrySeconds:stat(rr.map(r=>r.timings?.retryMs/1000)),pairedAddedSeconds:stat(rr.map((r,i)=>(r.timings?.totalMs-bb[i].timings.totalMs)/1000))});
}
for(const r of rows)if(!r.passed)for(const f of r.current?.failures??[])summary.failures[f.id]=(summary.failures[f.id]??0)+1;
await writeFile('results-water/summary.json',JSON.stringify(summary,null,2));
const sec=x=>x.toFixed(2),pct=n=>(100*n/150).toFixed(1);
const table=summary.bySize.map(r=>`| ${r.size}² | ${r.before}/50 | ${r.firstPlan}/50 | ${r.direct}/50 | ${r.recovered}/50 | ${sec(r.totalSeconds.median)} / ${sec(r.totalSeconds.p90)} / ${sec(r.totalSeconds.max)} s | ${sec(r.pairedAddedSeconds.median)} s |`).join('\n');
const chosen=[1,5,13,15,23,25,35,41,42,44];
const cards=chosen.map(p=>{const a=before.find(r=>r.id===p&&r.size===128),b=rows.find(r=>r.id===p&&(r.requested?.size??r.size)===128),key=id(p,128);return `<article><h2>${a.name}</h2><div class="pair"><figure><img src="../results/previews/${key}.png"><figcaption>Before: ${a.passed?'pass':'fail'} · 128² · ${a.selected.mpt} m/tile</figcaption></figure><figure><img src="previews/${key}.png"><figcaption>After: ${b.passed?'pass':'fail'} · ${b.size}² · ${b.selected?.mpt} m/tile</figcaption></figure></div><p>${b.lat.toFixed(4)}, ${b.lon.toFixed(4)} · ${b.autoTry?.attempts.length} designs · ${b.directPassed?'requested area passed':'auto-try used'}</p></article>`;}).join('');
const css=`body{background:#172a2a;color:#edf1df;font:14px system-ui;margin:24px}h1{font:32px Georgia}h2{font-size:17px;margin:0 0 8px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}article{background:#243b38;padding:14px}.pair{display:flex;gap:12px}figure{margin:0;width:50%}img{width:100%;height:160px;object-fit:contain;image-rendering:pixelated}p,figcaption{font-size:12px;margin:7px 0 0}a{color:#e6c77b}`;
const heading=`<h1>Real terrain, designed water</h1><p>Ten fixed places, requested at 128². Blue: simulated water. Gold: start. White: river origins in the after views. Settings below each preview disclose scale/size changes.</p><p>AWS Terrain Tiles / Mapzen and providers · Modified elevation · <a href="../ATTRIBUTION.md">Full attribution</a>. Local prototype checks; no in-game play test.</p>`;
await writeFile('results-water/before-after.html',`<!doctype html><meta charset="utf-8"><title>Ten before and after places</title><style>${css}</style>${heading}<div class="grid">${cards}</div>`);
const all=places.map(p=>`<article><h2>${p.id}. ${p.name}</h2><div class="pair">${[96,128,256].map(n=>{const r=rows.find(r=>r.id===p.id&&(r.requested?.size??r.size)===n);return `<figure><img src="previews/${id(p.id,n)}.png"><figcaption>Request ${n}² → ${r.size}²<br>${r.passed?'PASS':'FAIL'} · ${r.directPassed?'direct':'auto-try'}<br>${r.selected?.mpt} m/tile</figcaption></figure>`;}).join('')}</div></article>`).join('');
await writeFile('results-water/gallery.html',`<!doctype html><meta charset="utf-8"><title>All 150 designed-water results</title><style>${css}</style>${heading}<div class="grid">${all}</div>`);
const browser=await launch();try{const page=await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:1});await page.goto(pathToFileURL(path.resolve('results-water/before-after.html')).href);await page.screenshot({path:'results-water/before-after.png',fullPage:true});}finally{await browser.close();}
await mkdir('examples-water',{recursive:true});
const examples=[],notices=await readFile('ATTRIBUTION.md','utf8');
for(const p of chosen.filter(p=>[1,13,23,41].includes(p))) {
  const key=id(p,128),r=rows.find(r=>r.id===p&&r.requested.size===128);
  if(r.passed) {
    // Refresh wording in portable notices; the simulation and world bytes stay exact.
    const entries=unzipSync(await readFile(`.work/maps-water/${key}.timber`));
    const meta=JSON.parse(strFromU8(entries['map_metadata.json']));
    meta.MapDescription=meta.MapDescription.split('\n')[0]+'\n'+notices;
    entries['map_metadata.json']=strToU8(JSON.stringify(meta));entries['ATTRIBUTION.txt']=strToU8(notices);
    const bytes=zipSync(entries,{level:6,mtime:new Date(2026,0,1)});
    assert.deepEqual(unzipSync(bytes)['world.json'],entries['world.json']);
    await writeFile(`examples-water/${key}.timber`,bytes);
    examples.push(`| [${r.name}](${key}.timber) | ${r.size}² | ${r.selected.mpt} m/tile | ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)} |`);
  }
}
await writeFile('examples-water/README.md',`# Passing designed-water examples\n\nLocal prototype checks, not in-game play tests. All were requested at 128²; returned settings are below. World bytes match the survey exports; full attribution wording is refreshed without resimulation.\n\n| Map | Actual size | Scale | Coordinates |\n|---|---|---|---|\n${examples.join('\n')}\n\nAWS Terrain Tiles / Mapzen and providers. Modified terrain; designed game water. [Full notices](../ATTRIBUTION.md), also inside every map.\n`);
const text=`# Pick a place: designed water\n\nThe land is real; the water is designed. AWS Terrarium still works directly in the browser worker, so **no proxy is needed**. [Sources and browser tests](SOURCES.md).\n\nThe same 50 places × 3 requested sizes now yield **${summary.direct}/150 (${pct(summary.direct)}%)** passing requested areas with up to two water designs, across **${summary.directPlaces}/50 places**. With automatic retries: **${summary.recovered}/150 (${pct(summary.recovered)}%)**, across **${summary.recoveredPlaces}/50 places**. Before: **47/150 and 30/50**. One source design alone passes ${summary.firstPlan}/150. [Unchanged baseline](BASELINE.md).\n\n| Requested size | Before | First design | Requested area, ≤2 designs | With auto-try | Total median / p90 / max | Median paired time added |\n|---|---|---|---|---|---|---|\n${table}\n\nThese are local checks, not in-game play tests. The before/after comparison includes the stricter dry-path check, head-origin audit, new scale screening and source planning; it is not a water-placement-only ablation. Paired time differences include network/cache variation on the same host. The original results remain in results/; the new results are in results-water/.\n\n**Water design.** Score real drainage for nearby flat banks, confined valleys, downhill length, cliffs and natural basins. Place springs below ridges or at valley heads so their routes cross interesting ground. A flat place still gets a designed boundary entry. There is no native-river or positive-elevation requirement. Use up to 1/1/3 distinct tributary heads at 96/128/256, spaced a quarter-map apart; the alternate uses one head. First-design strength per source is 3 × sqrt(size/128); the alternate head uses 1.8 × sqrt(size/128). The optional cliff/basin intention changes routing weights; it cannot guarantee a waterfall or lake. Canonical simulation decides where water actually goes.\n\n**Source origins.** Game sources begin at an exact map-edge river entry or a tributary head below a ridge, never mid-river or on a lake/basin floor. More flow changes head strength; there are no downstream boosters. Prefill rejects a head on another river route. Before accepting a multi-head map, simulate all other heads with each head turned off: it must stay dry. Every passing result includes this local origin audit.

**Start.** Keep a dry existing 3×3 pad and ring. Rank starts by a clean pumpable shore within 20 walking tiles, using exported natural slopes and blocking flooded ground. Place resources from simulated moisture. Download only passes. No terrain cell is edited after mapping: no cut channels, flattened pads, rims or walls.\n\n**Auto-try.** After two unsuccessful water designs, try the other two scales, other two sizes, then two measured offsets. Stop at the first passing design in this bounded order; this is the best passing result tested, not a global optimum. Return its actual size, coordinates and scale visibly. If all fail, show the best failed terrain and two nearby simulated previews with reasons, without a download. All ${summary.sourceDesigns} source-design attempts are recorded. ${summary.changedSize} passing requests change size; ${summary.shifted} shift coordinates.\n\n**Evidence.** ${summary.roundTrips}/150 selected files pass write/read/load checks; ${summary.errors} request-level runtime errors. Remaining failures (overlap): ${Object.entries(summary.failures).map(([k,v])=>k+' '+v).join(', ')||'none'}. Passing a desert means the designed opening works, not that a real river exists. The Pacific control recasts real bathymetry as game land; a pass does not reconstruct the ocean surface or real coastlines. Constant ocean, ice and provider seams can still be poor terrain. Source seam detection and polar coverage remain limitations.\n\n![Ten before and after places](results-water/before-after.png)\n\n[All 150 renders](results-water/gallery.html) · [Machine-readable summary](results-water/summary.json) · [Passing example files](examples-water/) · [Algorithm and reproduction](METHODS.md) · [Integration proposal and deletion plan](INTEGRATION.md).\n\nThe milestone run still owns shared D153 and no-wall validation. This run uses the explicitly labelled LOCAL D151–D153 adapter against core 84b1866; origin/dev bf4e612 still had the old validator when checked. It retains the old Normal 40-living-tree gate pending shared D164. No shared validator was changed. No game was launched; no site or proxy was published.\n`;
await writeFile('REPORT.md',text);
await mkdir('.work',{recursive:true});
await writeFile('.work/pr-body-water.md',`This investigation turns coordinates into a Timberborn map in a browser worker. The land comes from open elevation; water is designed for the terrain. Sources are restricted to edge entries or tributary heads; no lake-interior sources or downstream boosters. Independent-flow audits keep each head dry without its own source. Routes favour useful banks, cliffs and basins. Failed openings trigger bounded scale, size and nearby-area retries, with previews and explicit returned settings.\n\n- **Data source:** AWS Terrain Tiles (Terrarium), fetched directly with browser CORS. Full provider attribution is on the page and inside every map. Source/licence/CORS comparisons are included.\n- **Proxy:** not needed for the chosen source; fallback proxy remains a proposal only.\n- **Conversion success:** requested area, up to two water plans: **${summary.direct}/150 (${pct(summary.direct)}%)**, **${summary.directPlaces}/50 places**. With auto-try: **${summary.recovered}/150 (${pct(summary.recovered)}%)**, **${summary.recoveredPlaces}/50 places**. Baseline: **47/150, 30/50**. First water plan alone: ${summary.firstPlan}/150. Recovered results can change scale, size or location; all attempts are retained.\n\nValidation: focused terrain/source/walking regressions; Edge worker conversion, cancellation, download gating and nearby-preview exhaustion; ${summary.roundTrips}/150 selected files pass ZIP write/read/load checks. Ten fixed places have before/after renders; all 150 have small renders and timing records. No in-game play test.\n\nResults use the clearly labelled local D151–D153 adapter and the older Normal living-tree threshold. Production validators are untouched. INTEGRATION.md names the local adapters and copied code to remove when the milestone's shared D153/no-wall/D164 work lands.\n\nREPORT.md, METHODS.md and INTEGRATION.md are under investigation/pickplace/. All changed files are inside that folder; the dev...HEAD path-scope check was completed before publishing this update. This updates the existing PR and is left open, unmerged.\n`);
console.log(JSON.stringify(summary,null,2));
