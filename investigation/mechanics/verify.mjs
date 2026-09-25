import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('.',import.meta.url);
const read = p => readFileSync(new URL(p,root),'utf8');
const rows=read('results/maps.jsonl').trim().split('\n').map(JSON.parse);
const summary=JSON.parse(read('results/summary.json'));
const provenance=JSON.parse(read('results/provenance.json'));
assert.equal(rows.length,180);
assert.equal(new Set(rows.map(r=>`${r.theme}/${r.seed}`)).size,180);
for(const [theme,s] of Object.entries(summary.summaries)) {
  const group=rows.filter(r=>theme==='all'||r.theme===theme);
  assert.equal(group.length,s.requested);
  assert.equal(group.filter(r=>r.passed).length,s.passed);
  assert.equal(s.clusters.groups.reduce((n,g)=>n+g.count,0),s.passed);
}
for(const r of rows) {
  assert.deepEqual(r.size,{x:128,y:128}); assert.equal(r.difficulty,'normal');
  assert.equal(r.metrics.measurementVersion,2);
  assert.ok(r.metrics.pumpShore6>=r.metrics.pumpShore2);
  assert.ok(r.metrics.fertile20>=r.metrics.fertileEmpty20);
  assert.ok(r.metrics.fertilityPersistence===null || (r.metrics.fertilityPersistence>=0&&r.metrics.fertilityPersistence<=1));
  assert.ok(r.metrics.readyBerries20>=0 && r.metrics.readyBerries20%3===0);
  assert.equal(r.attempts, r.failures.length+(r.passed?1:0));
  if(r.passed)assert.equal(r.checks.filter(c=>!c.ok&&!c.advisory&&!c.approximate&&c.applicable!==false).length,0);
}
for(const [path,hash] of Object.entries(provenance.hashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash,`Source changed: ${path}`);
const names={riverValley:'River Valley',canyon:'Canyon',highlands:'Highlands',lakeBasin:'Lake Basin',delta:'Delta',islands:'Islands'};
let files=0;
for(const r of rows) {
  const file=new URL(`results/maps/${r.theme}/128/${names[r.theme]} (${r.seed}).timber`,root);
  if(existsSync(file)){assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),r.sha256);files++;}
}
console.log(`Verified ${rows.length} records, six-theme coverage, source hashes, summaries, invariants and ${files} local map hashes.`);
