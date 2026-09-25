import ts from 'typescript';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const modules=new Map(),sources={};
const hash=x=>createHash('sha256').update(x).digest('hex');
function visit(file){
  const id=relative(process.cwd(),file).replaceAll('\\','/');
  if(modules.has(id))return id;modules.set(id,'');
  const input=readFileSync(file,'utf8');sources[id]=hash(input.replaceAll('\r\n','\n'));
  let code=file.endsWith('.json')?'module.exports = '+input:/\.(ts|js)$/.test(file)?ts.transpileModule(input,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText:input;
  code=code.replace(/require\(["']([^"']+)["']\)/g,(_,spec)=>{
    let p=spec==='fflate'?resolve('node_modules/fflate/lib/browser.cjs'):resolve(dirname(file),spec);
    if(existsSync(p+'.ts'))p+='.ts';else if(existsSync(p+'/index.ts'))p+='/index.ts';else if(!existsSync(p))throw Error(p);
    return 'require('+JSON.stringify(visit(p))+')';
  });modules.set(id,code);return id;
}
const entry=visit(resolve('api-exact.ts'));
const code='const modules={\n'+[...modules].map(([id,c])=>JSON.stringify(id)+':(module,exports,require)=>{\n'+c+'\n}').join(',\n')+'\n};\n'+
  'const cache=Object.create(null);function require(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,require);}return cache[id].exports;}\n'+
  'const api=require('+JSON.stringify(entry)+');export const {generate,makeSpec,WaterSim,CycleModel,GameWater,GameSoil,Measures,cases,runStretch}=api;\n';
const id=hash(code);mkdirSync('.work/exact',{recursive:true});writeFileSync('.work/exact/api.mjs',code);
writeFileSync('.work/exact/version.mjs','export const buildId='+JSON.stringify(id)+';\n');
writeFileSync('results/exact-build.json',JSON.stringify({id,reference:'a9cdb860be859ddd3339800a88b42e9871293597',compiler:ts.version,sources},null,2)+'\n');
console.log('Exact cycle bundle',id,modules.size,'modules');
