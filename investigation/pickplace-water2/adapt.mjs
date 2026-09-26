// Reproducible browser adaptation of the landscape converter at the recorded base commit.
// Run only when deliberately refreshing the adapter; output is committed for inspection.
import { readFile, writeFile } from 'node:fs/promises';
let s=await readFile('../landscapes/lib/convert.ts','utf8');
s=s.replace('import { createHash } from "node:crypto";','import { naturalSlopes, pumpShore, currentRules, stableId } from "./rules";');
s=s.replaceAll('../../../src/','../../src/');
s=s.replace(/import \{ measureValidated \}[^;]+;\s*/,'').replace(/import \{ naturalness \}[^;]+;\s*/,'').replace(/import \{ featureVector \}[^;]+;\s*/,'');
s=s.replace('from "./terrain"','from "../landscapes/lib/terrain"');
s=s.replace('  entityJson,','  entityJson,\n  slope,');
s=s.replace('  occupied: Set<number>,','  occupied: Set<number>,\n  links: [number, number][],');
s=s.replace('walkDistance(h, W, W, null, [], c, 24)','walkDistance(h, W, W, null, links, c, 24)');
s=s.replace('shoreDistance(dist, h, W, W, mask, c.z)','pumpShore(dist, h, D, new Float64Array(N), W)');
const begin=s.indexOf('    h = original.slice(),');
const end=s.indexOf('  const entities: any[]',begin);
s=s.slice(0,begin)+'    h = original.slice();\n  const edgeChanges = 0; // D151/D152: every terrain cell is preserved.\n'+s.slice(end);
s=s.replace(/    const hex = createHash\("sha256"\)[\s\S]*?\.slice\(0, 32\);/,'    const hex = stableId(`${key}:${serial++}`);');
s=s.replace('  const selection = bestStart(h, water.depth, M, W, occupied),','  const ramps = naturalSlopes(h, water.depth, W, occupied);\n  for (const r of ramps.slopes) add(slope({ ...base(r.i), orientation: r.orientation }));\n  const selection = bestStart(h, water.depth, M, W, occupied, ramps.links),');
const ms=s.indexOf('  const measured = measureValidated');
const me=s.indexOf('  const fixture =',ms);
s=s.slice(0,ms)+'  const current = currentRules(file, v, h, water, ramps.links, start, sources);\n'+s.slice(me);
s=s.replace('    measured,\n    originalNatural,\n    features: featureVector(measured),','    current,');
s=s.replace('    file,\n    v,','    file,\n    start,\n    v,');
await writeFile('convert.ts','// Adapted from investigation/landscapes/lib/convert.ts; see adapt.mjs and METHODS.md.\n'+s);
const t=await readFile('../landscapes/lib/terrain.ts','utf8');
let hydro=t.slice(t.indexOf('export function sourcesFromHalo'));
hydro=hydro.replace(/Math\.max\(\s*\.\.\.Array\.from\(d\.filled, \(v, i\) => v - raw\[i\]\)\.filter\(\(_, i\) =>\s*inPatch\(i\),\s*\),\s*\)/,'d.filled.reduce((max, v, i) => inPatch(i) ? Math.max(max, v - raw[i]) : max, 0)');
await writeFile('hydrology.ts','// Browser-safe copy: avoid spreading 65,536 values onto the worker stack.\nimport { drainage } from "../landscapes/lib/terrain";\n'+hydro);
