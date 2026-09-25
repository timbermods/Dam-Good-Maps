// Separate M9 baseline/combined bundles: original proof bundles stay unchanged.
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const hash=x=>createHash('sha256').update(x).digest('hex'),bundles={},sources={};
mkdirSync('.work/m9',{recursive:true});
for(const variant of ['baseline','combined']){
  const modules=new Map();
  function visit(file){
    const id=relative(process.cwd(),file).replaceAll('\\','/');
    if(modules.has(id))return id;modules.set(id,'');
    const input=readFileSync(file,'utf8');sources[id]=hash(input.replaceAll('\r\n','\n'));
    let code=file.endsWith('.json')?'module.exports = '+input:/\.(ts|js)$/.test(file)?ts.transpileModule(input,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText:input;
    code=code.replace(/require\(["']([^"']+)["']\)/g,(_,spec)=>{
      let p=spec==='fflate'?resolve('node_modules/fflate/lib/browser.cjs'):resolve(dirname(file),spec);
      if(variant==='combined'&&p===resolve('../../src/core/sim/water'))p=resolve('prototypes/combined/water');
      if(variant==='combined'&&p===resolve('../../src/core/sim/drought'))p=resolve('prototypes/drought');
      if(existsSync(p+'.ts'))p+='.ts';else if(existsSync(p+'/index.ts'))p+='/index.ts';else if(!existsSync(p))throw Error(p);
      return 'require('+JSON.stringify(visit(p))+')';
    });modules.set(id,code);return id;
  }
  const entry=visit(resolve('api-m9.ts'));
  const code='const modules={\n'+[...modules].map(([id,c])=>JSON.stringify(id)+':(module,exports,require)=>{\n'+c+'\n}').join(',\n')+'\n};\n'+
    'const cache=Object.create(null);function require(id){if(!cache[id]){const m=cache[id]={exports:{}};modules[id](m,m.exports,require);}return cache[id].exports;}\n'+
    'const api=require('+JSON.stringify(entry)+');export const {generateProto,PROTO_VERSION}=api;\n';
  bundles[variant]=hash(code);writeFileSync('.work/m9/'+variant+'.mjs',code);console.log('M9 bundle',variant,modules.size,'modules');
}
const id=hash(JSON.stringify(bundles));writeFileSync('.work/m9/version.mjs','export const buildId='+JSON.stringify(id)+';\n');
writeFileSync('results/m9-build.json',JSON.stringify({id,reference:'a5f189d3e96affec533415090bdb8f09d606c8fd',compiler:ts.version,bundles,sources},null,2)+'\n');
