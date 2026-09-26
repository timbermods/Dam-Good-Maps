import { readFile,writeFile,mkdir,copyFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { PNG } from 'pngjs';
const places=JSON.parse(await readFile('places.json','utf8')),rows=[];
for(const p of places)for(const size of [96,128,256])rows.push(JSON.parse(await readFile(`results/${String(p.id).padStart(2,'0')}-${size}.json`,'utf8')));
const run=JSON.parse(await readFile('results/run.json','utf8'));
if(run.attempts!==150)throw Error('Full 150-attempt run required.');
for(const r of rows)if(r.error){const image=new PNG({width:r.size,height:r.size});for(let y=0;y<r.size;y++)for(let x=0;x<r.size;x++){const k=(y*r.size+x)*4,v=Math.abs(x-y)<2||Math.abs(x+y-r.size)<2?120:50;image.data[k]=image.data[k+1]=image.data[k+2]=v;image.data[k+3]=255;}await writeFile(`results/previews/${String(r.id).padStart(2,'0')}-${r.size}.png`,PNG.sync.write(image));}
const q=(values,p)=>{const s=values.filter(Number.isFinite).sort((a,b)=>a-b);return s[Math.floor((s.length-1)*p)];};
const seconds=(r,key)=>r.timings?.[key]/1000;
const failures={};for(const r of rows)for(const f of r.current?.failures||[{id:'runtime.error'}])failures[f.id]=(failures[f.id]||0)+1;
const timing=[96,128,256].map(size=>{const rs=rows.filter(r=>r.size===size);return {size,attempts:rs.length,passes:rs.filter(r=>r.passed).length,medianSeconds:q(rs.map(r=>seconds(r,'totalMs')),.5),p90Seconds:q(rs.map(r=>seconds(r,'totalMs')),.9),maxSeconds:q(rs.map(r=>seconds(r,'totalMs')),1),medianConversionSeconds:q(rs.map(r=>seconds(r,'convertMs')),.5),medianFetchAndPreviewSeconds:q(rs.map(r=>seconds(r,'settingsMs')+seconds(r,'fetchMs')),.5)};});
const prediction=['promising','uncertain','difficult'].map(verdict=>{const rs=rows.filter(r=>r.selected?.prediction.verdict===verdict);return {verdict,count:rs.length,passes:rs.filter(r=>r.passed).length};});
const byFamily=[...new Set(places.map(p=>p.family))].map(family=>{const rs=rows.filter(r=>r.family===family);return {family,attempts:rs.length,passes:rs.filter(r=>r.passed).length};});
const summary={...run,passes:rows.filter(r=>r.passed).length,rate:rows.filter(r=>r.passed).length/rows.length,placesWithAPassingSize:places.filter(p=>rows.some(r=>r.id===p.id&&r.passed)).length,legacyPasses:rows.filter(r=>r.legacyPassed).length,roundTripPasses:rows.filter(r=>r.roundTripPassed).length,settled:rows.filter(r=>r.settled).length,errors:rows.filter(r=>r.error).length,minHeartbeats:Math.min(...rows.filter(r=>!r.error).map(r=>r.heartbeats)),timing,prediction,byFamily,failures};
await writeFile('results/summary.json',JSON.stringify(summary,null,2));
const fmt=n=>Number(n).toFixed(2),pct=n=>(100*n).toFixed(1)+'%';
let md=`# All conversion results\n\n${summary.passes}/150 (${pct(summary.rate)}) pass the labelled local checks. ${summary.placesWithAPassingSize}/50 places pass at one or more sizes. ${summary.legacyPasses}/150 pass the unchanged base validator. No in-game tests. All 150 attempts count.\n\n| Size | Passes | Total median / p90 / max (s) | Convert median (s) | Preview + fetch median (s) |\n| --- | ---: | --- | ---: | ---: |\n`;
for(const r of timing)md+=`| ${r.size}² | ${r.passes}/50 | ${fmt(r.medianSeconds)} / ${fmt(r.p90Seconds)} / ${fmt(r.maxSeconds)} | ${fmt(r.medianConversionSeconds)} | ${fmt(r.medianFetchAndPreviewSeconds)} |\n`;
md+='\nOne machine, ordinary network, cache reused across sizes. Timings include failed conversions.\n\n| Cheap prediction | Actual passes |\n| --- | ---: |\n';
for(const p of prediction)md+=`| ${p.verdict} | ${p.passes}/${p.count} |\n`;
md+='\nFailures overlap:\n\n'+Object.entries(failures).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`- ${k}: ${v}`).join('\n');
md+='\n\n[All renders](results/gallery.html) · [Contact sheet](results/contact-sheet.png). Blue is simulated water, lighter terrain is higher; yellow square marks the start. Unsettled water is a terminal simulation state, not a steady-state promise. Previews omit resources and slopes. [Attribution](ATTRIBUTION.md).\n\n| Place | Family | 96 | 128 | 256 |\n| --- | --- | --- | --- | --- |\n';
for(const p of places){const result=[96,128,256].map(size=>{const r=rows.find(r=>r.id===p.id&&r.size===size),id=`${String(p.id).padStart(2,'0')}-${size}`;return `[${r.passed?'pass':'fail'} · ${r.selected?.mpt??'?'} m/tile](results/${id}.json)`;});md+=`| ${p.name} | ${p.family} | ${result.join(' | ')} |\n`;}
await writeFile('RESULTS.md',md);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const style=`body{font:13px system-ui;background:#172a2a;color:#e9efdc;margin:20px}h1{font:32px Georgia}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{background:#233b38;padding:8px}img{width:100%;image-rendering:pixelated}small{display:block}a{color:#e6c77b}.pass{color:#b6e6a1}.fail{color:#ffbd9e}`;
let html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Pick a place · all 50 places</title><style>${style}</style><h1>Pick a place · 50 places × 3 sizes</h1><p>${summary.passes}/150 local checks pass. No in-game tests. <a href="../ATTRIBUTION.md">Full open-data credits</a>.</p><p>Blue: simulated water. Yellow: start. Lighter: higher. Unsettled water is only a terminal state. <label>Size <select id="size"><option>96</option><option selected>128</option><option>256</option></select></label></p><div class="grid">`;
for(const p of places){const rs=rows.filter(r=>r.id===p.id),r=rs.find(r=>r.size===128),id=String(p.id).padStart(2,'0');html+=`<article class="card" data-id="${id}"><strong>${p.id}. ${esc(p.name)}</strong><small>${p.family} · ${p.lat}, ${p.lon}</small><img alt="Terrain preview for ${esc(p.name)}" src="previews/${id}-128.png"><small>${rs.map(v=>`${v.size}: <span class="${v.passed?'pass':'fail'}">${v.passed?'PASS':'FAIL'}</span>`).join(' · ')}</small><small class="info">${r.selected?.mpt??'?'} m/tile · ${r.timings?fmt(r.timings.totalMs/1000):'error'} s</small></article>`;}
html+=`</div><p>Data: Terrain Tiles / Mapzen and providers, modified. <a href="../ATTRIBUTION.md">Required notices and licences</a>. All image derivatives carry those terms.</p><script>const rows=${JSON.stringify(rows.map(r=>({id:r.id,size:r.size,mpt:r.selected?.mpt,seconds:r.timings?.totalMs/1000})))};document.querySelector('select').onchange=e=>{for(const a of document.querySelectorAll('article')){const r=rows.find(r=>r.id===+a.dataset.id&&r.size===+e.target.value);a.querySelector('img').src='previews/'+a.dataset.id+'-'+r.size+'.png';a.querySelector('.info').textContent=r.mpt+' m/tile · '+r.seconds.toFixed(2)+' s';}};</script></html>`;
await writeFile('results/gallery.html',html);
const browser=await launch();try{const page=await browser.newPage({viewport:{width:1100,height:900}});await page.goto(pathToFileURL(path.resolve('results/gallery.html')).href);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:'results/contact-sheet.png',fullPage:true});}finally{await browser.close();}
await mkdir('examples',{recursive:true});
const examples=[];
for(const family of ['canyon','cone','fjord','plain','caldera','glacial']){const r=rows.find(r=>r.family===family&&r.size===128&&r.passed)||rows.find(r=>r.family===family&&r.passed);if(r){const id=`${String(r.id).padStart(2,'0')}-${r.size}`;await copyFile(`.work/maps/${id}.timber`,`examples/${id}.timber`);examples.push({name:r.name,file:`${id}.timber`,family,size:r.size});}}
await writeFile('examples/README.md','# Sample exports\n\nThese passed the labelled local prototype checks. They were not tested in game. Every file contains its full terrain-provider notices and provenance.\n\n'+examples.map(e=>`- [${e.name}](${e.file}) — ${e.family}, ${e.size}².`).join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
await import('./write-report.mjs');
