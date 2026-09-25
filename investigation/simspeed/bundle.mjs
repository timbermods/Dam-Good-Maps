// In-process bundler for sandbox hosts that forbid child processes.
// TypeScript strips types/rewrites module syntax; no arithmetic transforms.
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
export const variants = ['baseline', 'saturation', 'topology', 'clear', 'unroll', 'drought', 'combined'];
const transpiled = new Map();
const bundleHashes={}, sourceHashes={};
mkdirSync('.work/bundles', {recursive: true});
for (const variant of variants) {
  const modules = new Map();
  function visit(file) {
    const id = relative(process.cwd(), file).replaceAll('\\', '/');
    if (modules.has(id)) return id;
    modules.set(id, '');
    let code = transpiled.get(file);
    if (!code) {
      const input = readFileSync(file, 'utf8');
      sourceHashes[id]=createHash('sha256').update(input.replaceAll('\r\n','\n')).digest('hex');
      code = file.endsWith('.json') ? 'module.exports = ' + input : /\.(ts|js)$/.test(file) ?
        ts.transpileModule(input, {fileName:file, compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, esModuleInterop:true}}).outputText : input;
      transpiled.set(file, code);
    }
    code = code.replace(/require\(["']([^"']+)["']\)/g, (_, spec) => {
      let target = spec === 'fflate' ? resolve('node_modules/fflate/lib/browser.cjs') : resolve(dirname(file), spec);
      if (!['baseline', 'drought'].includes(variant) && target === resolve('../../src/core/sim/water'))
        target = resolve(`prototypes/${variant}/water`);
      if (['drought', 'combined'].includes(variant) && target === resolve('../../src/core/sim/drought'))
        target = resolve('prototypes/drought');
      if (existsSync(target + '.ts')) target += '.ts';
      else if (existsSync(target + '/index.ts')) target += '/index.ts';
      else if (!existsSync(target)) throw new Error('Cannot bundle: ' + target);
      return 'require(' + JSON.stringify(visit(target)) + ')';
    });
    modules.set(id, code);
    return id;
  }
  const entry = visit(resolve('api.ts'));
  const text = '// Generated investigation bundle; do not edit.\nconst modules = {\n' + [...modules].map(([id, code]) =>
    JSON.stringify(id) + ': (module, exports, require) => {\n' + code + '\n}').join(',\n') + `\n};
const cache = Object.create(null);
function require(id) { if (!cache[id]) { const m = cache[id] = {exports:{}}; modules[id](m, m.exports, require); } return cache[id].exports; }
const api = require(${JSON.stringify(entry)});
export const { WaterSim, SettleRun, DT, TICKS_PER_DAY, canonicalRun, canonicalSettle, prefill, spillLevels,
  previewSettle, warmStart, changedTiles, droughtStorage, generate, rebuild, makeSpec, AVAILABLE_THEMES,
  moisture, soilContamination, CycleModel, schedule, Measures } = api;
`;
  writeFileSync(`.work/bundles/${variant}.mjs`, text);
  bundleHashes[variant]=createHash('sha256').update(text).digest('hex');
  console.log('bundled', variant, modules.size, 'modules');
}
const id=createHash('sha256').update(JSON.stringify(bundleHashes)).digest('hex');
writeFileSync('.work/bundles/version.mjs','export const buildId = '+JSON.stringify(id)+';\n');
mkdirSync('results',{recursive:true});
writeFileSync('results/build.json',JSON.stringify({id,compiler:ts.version,bundles:bundleHashes,sources:sourceHashes},null,2)+'\n');
