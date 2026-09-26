import ts from 'typescript';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const variants=process.argv.includes('--baseline')?['baseline','profile']:['baseline','water-sparse','soil-cache','soil-saturation','water-wasm','combined','profile'];
mkdirSync('.work/weather/bundles',{recursive:true});
// The committed world.ts reference pins the only changed generator dependency.
// Build only from committed sources; fetching/updating references is a separate decision.
function instrumentation(input,kind){
  const edits=kind==='water'?[
    ['const { F, D, C, out, f, wall, dam, nb } = this;',"globalThis.__weatherPhase?.('water.clear-active');\n        const { F, D, C, out, f, wall, dam, nb } = this;"],
    ['// OutflowsUpdateTask,',"globalThis.__weatherPhase?.('water.outflows');\n        // OutflowsUpdateTask,"],
    ['// WaterParametersUpdateTask:',"globalThis.__weatherPhase?.('water.depth');\n        // WaterParametersUpdateTask:"],
    ['// SimulateContaminationTask:',"globalThis.__weatherPhase?.('water.mix');\n        // SimulateContaminationTask:"],
    ['// UpdateContaminationTask.',"globalThis.__weatherPhase?.('water.diffusion');\n        // UpdateContaminationTask."],
    ['        this.sourcesStep();\n        this.finishSubstep();',"        globalThis.__weatherPhase?.('water.sources-finish');\n        this.sourcesStep();\n        this.finishSubstep();\n        globalThis.__weatherPhase?.(null);"]
  ]:[
    ['const { N } = this, { z, F } = this.g, sat = this.sat, wn = this.wn, nb = this.nb;',"globalThis.__weatherPhase?.('soil.wet-count-saturation');\n        const { N } = this, { z, F } = this.g, sat = this.sat, wn = this.wn, nb = this.nb;"],
    ['// WaterEvaporationCalculationTask.',"globalThis.__weatherPhase?.('soil.evaporation');\n        // WaterEvaporationCalculationTask."],
    ['// Which tiles can change.',"globalThis.__weatherPhase?.('soil.dirty');\n        // Which tiles can change."],
    ['// Remember the water this pass read.',"globalThis.__weatherPhase?.('soil.remember');\n        // Remember the water this pass read."],
    ['// MoistureCalculationTask: read',"globalThis.__weatherPhase?.('soil.moisture');\n        // MoistureCalculationTask: read"],
    ['// ContaminationCandidatesCountingTask,',"globalThis.__weatherPhase?.('soil.candidates');\n        // ContaminationCandidatesCountingTask,"],
    ['        this.mChanged = [];',"        globalThis.__weatherPhase?.('soil.publish-levels');\n        this.mChanged = [];"],
    ['        this.passes++;',"        this.passes++;\n        globalThis.__weatherPhase?.(null);"]
  ];
  for(const [a,b] of edits){if(!input.includes(a))throw Error('Missing profile marker '+a);input=input.replace(a,b);}return input;
}
const bundles={},sources={};
for(const variant of variants){
  const modules=new Map();
  function visit(file){
    const id=relative(process.cwd(),file).replaceAll('\\','/');
    if(modules.has(id))return id;modules.set(id,'');
    let input=readFileSync(file,'utf8').replaceAll('\r\n','\n');sources[id]=hash(input);
    if(variant==='profile'&&id==='weather/reference/game-water.ts')input=instrumentation(input,'water');
    if(variant==='profile'&&id==='weather/reference/game-soil.ts')input=instrumentation(input,'soil');
    let code=file.endsWith('.json')?'module.exports = '+input:/\.(ts|js)$/.test(file)?ts.transpileModule(input,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText:input;
    code=code.replace(/require\(["']([^"']+)["']\)/g,(_,spec)=>{
      let p=spec==='fflate'?resolve('node_modules/fflate/lib/browser.cjs'):resolve(dirname(file),spec);
      if(p===resolve('../../src/core/format/world'))p=resolve('weather/reference/world');
      if(['water-sparse','water-wasm','combined'].includes(variant)&&p===resolve('weather/reference/game-water'))p=resolve('weather/prototypes/'+variant+'/game-water');
      if(['soil-cache','soil-saturation','combined'].includes(variant)&&p===resolve('weather/reference/game-soil'))p=resolve('weather/prototypes/'+variant+'/game-soil');
      if(existsSync(p+'.ts'))p+='.ts';else if(existsSync(p+'/index.ts'))p+='/index.ts';else if(!existsSync(p))throw Error(p);
      return 'require('+JSON.stringify(visit(p))+')';
    });modules.set(id,code);return id;
  }
  const entry=visit(resolve('weather/api.ts'));
  let prelude='';
  if(['water-wasm','combined'].includes(variant)){
    for(const file of ['weather/kernel-bytes.json','weather/kernel.ts'])sources[file]=hash(readFileSync(file,'utf8').replaceAll('\r\n','\n'));
    const binary=JSON.parse(readFileSync('weather/kernel-bytes.json','utf8'));
    if(hash(Buffer.from(binary.base64,'base64'))!==binary.sha256)throw Error('Kernel hash mismatch');
    prelude='const __waterWasm=new WebAssembly.Module(Uint8Array.from(atob('+JSON.stringify(binary.base64)+'),c=>c.charCodeAt(0)));\n';
  }
  const code=prelude+'const modules={\n'+[...modules].map(([id,c])=>JSON.stringify(id)+':(module,exports,require)=>{\n'+c+'\n}').join(',\n')+'\n};\n'+
    'const cache=Object.create(null);function require(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,require);}return cache[id].exports;}\n'+
    'const api=require('+JSON.stringify(entry)+');export const {generate,makeSpec,CycleModel,GameWater,GameSoil,Measures,cases,runStretch,journey,schedule}=api;\n';
  bundles[variant]=hash(code);writeFileSync('.work/weather/bundles/'+variant+'.mjs',code);
}
const id=hash(JSON.stringify(bundles));
writeFileSync('.work/weather/bundles/version.mjs','export const buildId='+JSON.stringify(id)+';\n');
writeFileSync('results/weather/build.json',JSON.stringify({id,reference:'948f395137a6725d4b726864a47e6966d7f2f09a',compiler:ts.version,bundles,sources},null,2)+'\n');
console.log('Weather bundles',id,Object.keys(bundles));
