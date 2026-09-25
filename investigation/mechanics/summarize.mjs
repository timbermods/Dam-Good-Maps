import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('.', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const themes = ['riverValley', 'canyon', 'highlands', 'lakeBasin', 'delta', 'islands'];
export const bins = {
  storageRatio: [0.25, 1, 3], peakAxialFlow64: [0.5, 1, 2], flatDry40: [150, 500, 1200],
  fertilityPersistence: [0.25, 0.75], badwaterDistance: [15, 30, 60], logs20: [80, 160, 320],
  frontierComponents: [1.5, 3.5], deepPumpExtraShore: [0.5, 10, 50]
};
export function quantile(a, p) {
  if (!a.length) return null;
  const v = [...a].sort((a,b) => a-b), n = p * (v.length - 1), lo = Math.floor(n), hi = Math.ceil(n);
  return v[lo] + (v[hi] - v[lo]) * (n - lo);
}
export function stats(values) {
  const finite = values.filter(x => x !== null && Number.isFinite(x));
  return { n: finite.length, missing: values.length - finite.length, min: quantile(finite,0), p10: quantile(finite,.1), median: quantile(finite,.5), p90: quantile(finite,.9), max: quantile(finite,1) };
}
export function clusters(rows, factor = 1) {
  const fields = Object.keys(bins);
  const vectors = rows.map(r => fields.map(k => r.metrics[k] === null ? null : bins[k].filter(t => r.metrics[k] >= t * factor).length));
  const signatures = new Map();
  vectors.forEach((v, i) => { const key = v.join('/'); if (!signatures.has(key)) signatures.set(key, []); signatures.get(key).push(`${rows[i].theme}:${rows[i].seed}`); });
  const groups = [...signatures.entries()].map(([signature, members]) => ({ signature, count: members.length, members })).sort((a,b) => b.count-a.count || a.signature.localeCompare(b.signature));
  const pairs = [], nearest = vectors.map(() => Infinity);
  for (let a = 0; a < vectors.length; a++) for (let b = 0; b < a; b++) {
    const d = vectors[a].reduce((sum, v, k) => sum + (v === null || vectors[b][k] === null ? Number(v !== vectors[b][k]) : Math.abs(v - vectors[b][k]) / bins[fields[k]].length), 0) / fields.length;
    pairs.push(d); nearest[a] = Math.min(nearest[a], d); nearest[b] = Math.min(nearest[b], d);
  }
  const marginal = {};
  fields.forEach((k,j) => {
    const counts = Array(bins[k].length + 2).fill(0);
    vectors.forEach(v => counts[v[j] ?? counts.length-1]++);
    marginal[k] = { counts, largestShare: Math.max(...counts) / rows.length };
  });
  return { factor, distinct: groups.length, largestShare: (groups[0]?.count ?? 0) / rows.length, groups, marginal, pairDistance: stats(pairs), nearestDistance: stats(nearest) };
}
const rows = readdirSync(new URL('results/rows/', root)).filter(f => f.endsWith('.json')).map(f => JSON.parse(read(`results/rows/${f}`)))
  .sort((a,b) => themes.indexOf(a.theme) - themes.indexOf(b.theme) || a.seed-b.seed);
if (rows.length !== 180 || new Set(rows.map(r => `${r.theme}/${r.seed}`)).size !== 180 || themes.some(t => rows.filter(r => r.theme === t && r.seed >= 1 && r.seed <= 30).length !== 30)) throw new Error('Expected all six themes, seeds 1–30');
if (rows.some(r => r.metrics.measurementVersion !== 3)) throw new Error('Outdated measurement rows; rerun that theme');
const compactRows = rows.map(r => ({ ...r, checks: r.checks.map(({ message, ...c }) => c) }));
writeFileSync(new URL('results/maps.jsonl', root), compactRows.map(r => JSON.stringify(r)).join('\n') + '\n');
const summaries = {};
for (const theme of [...themes, 'all']) {
  const group = rows.filter(r => theme === 'all' || r.theme === theme);
  const accepted = group.filter(r => r.passed);
  const fields = Object.keys(group[0].metrics).filter(k => group.every(r => r.metrics[k] === null || typeof r.metrics[k] === 'number'));
  const misses = {};
  for (const r of group) for (const c of r.checks) if (!c.ok) misses[c.id] = (misses[c.id] ?? 0) + 1;
  summaries[theme] = {
    requested: group.length, passed: accepted.length, firstAttempt: group.filter(r => r.attempts === 1 && r.passed).length,
    totalAttempts: group.reduce((a,r) => a+r.attempts,0), misses,
    metrics: Object.fromEntries(fields.map(k => [k, stats(accepted.map(r => r.metrics[k]))])),
    clusters: clusters(accepted), sensitivity: [.8,1.2].map(f => ({ factor:f, ...(({ groups, marginal, ...rest })=>rest)(clusters(accepted,f)) }))
  };
}
writeFileSync(new URL('results/summary.json', root), JSON.stringify({ base:'cfa5990caeaf462de695caf428280da55fc0f7f5', bins, summaries },null,2)+'\n');
const fmt = x => x === null ? '—' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(2).replace(/\.00$/,'');
const band = s => `${fmt(s.median)} [${fmt(s.p10)}–${fmt(s.p90)}]${s.missing ? `; ${s.missing} missing` : ''}`;
let md = '# Baseline measurements\n\nSix themes, seeds 1–30, 128², Normal defaults; generator 0.6.0 at `cfa5990c`.\nMedian [p10–p90]. Units and limitations are in [AXES.md](AXES.md). Full ranges are in `results/summary.json`.\n\n';
md += '| Theme | Passed / requested | First attempt | Total attempts |\n|---|---|---|---|\n';
for (const t of [...themes,'all']) { const s=summaries[t]; md+=`| ${t} | ${s.passed}/${s.requested} | ${s.firstAttempt} | ${s.totalAttempts} |\n`; }
for (const fields of [Object.keys(bins).slice(0,4),Object.keys(bins).slice(4),['shortestAdequateDam','fertile20','fertileEmpty20','fertileKept20'],['waterDistance','treesNearStart','bushesNearStart','readyBerries20'],['geothermal64','mines64','science64','scrap40']]) {
  md+=`\n| Theme | ${fields.join(' | ')} |\n|---|${fields.map(()=>'---').join('|')}|\n`;
  for (const t of [...themes,'all']) md+=`| ${t} | ${fields.map(k=>band(summaries[t].metrics[k])).join(' | ')} |\n`;
}
md+='\n## Clustering\n\nThese are diagnostic bins, not verified strategy classes or D109 acceptance.\n\n| Theme | Distinct signatures | Largest signature | Median pair distance | Median nearest distance | Largest signature at ×0.8 / ×1.2 thresholds |\n|---|---|---|---|---|---|\n';
for (const t of [...themes,'all']) {const s=summaries[t], c=s.clusters;md+=`| ${t} | ${c.distinct} | ${fmt(c.largestShare*100)}% | ${fmt(c.pairDistance.median)} | ${fmt(c.nearestDistance.median)} | ${s.sensitivity.map(x=>fmt(x.largestShare*100)+'%').join(' / ')} |\n`;}
md+='\nLargest single-bin share per axis:\n\n| Theme | '+Object.keys(bins).join(' | ')+' |\n|---|'+Object.keys(bins).map(()=>'---').join('|')+'|\n';
for(const t of [...themes,'all'])md+=`| ${t} | ${Object.keys(bins).map(k=>fmt(summaries[t].clusters.marginal[k].largestShare*100)+'%').join(' | ')} |\n`;
md+='\n## Advisory and blocking misses\n\n';
for(const t of themes)md+=`- ${t}: ${Object.entries(summaries[t].misses).map(([k,n])=>`${k} ${n}/30`).join('; ') || 'none'}.\n`;
md+='\nThe per-map checks retain class, advisory status and applicability. A passed generation may miss advisory targets.\nNo row certifies actual colony survival. Raw files and project runtime dependencies are ignored; their map hashes are retained.\n';
writeFileSync(new URL('BASELINE.md', root),md);
const sourcePaths = ['../../tools/gen.ts','../../src/core/gen/generate.ts','../../src/core/spec/mapspec.ts','../../src/core/analysis/metrics.ts','../../src/core/analysis/walk.ts','../../src/core/analysis/damsites.ts','../../src/core/sim/drought.ts','../../src/core/validate/playability.ts','measure.ts','observe.ts','runtime.mjs','summarize.mjs'];
const hashes=Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')]));
writeFileSync(new URL('results/provenance.json',root),JSON.stringify({base:'cfa5990caeaf462de695caf428280da55fc0f7f5',node:process.version,fflate:JSON.parse(read('node_modules/fflate/package.json')).version,runner:'tools/gen.ts with investigation-only loader; native Node TypeScript because subprocess launch is blocked',hashes},null,2)+'\n');
console.log(`Summarized ${rows.length} maps; ${summaries.all.passed} passed; ${summaries.all.clusters.distinct} opening signatures.`);
