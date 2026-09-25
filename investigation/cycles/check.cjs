const ts=require('typescript'),path=require('node:path');
const dir=__dirname;
const deps=path.dirname(path.dirname(require.resolve('typescript/package.json')));
const files=ts.sys.readDirectory(dir,['.ts'],['**/node_modules/**']);
const p=ts.createProgram(files,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  strict:true,resolveJsonModule:true,esModuleInterop:true,skipLibCheck:true,noEmit:true,baseUrl:dir,
  paths:{'*':[deps+'/*']},typeRoots:[deps+'/@types']});
const ds=ts.getPreEmitDiagnostics(p);
console.log(ds.length?ts.formatDiagnosticsWithColorAndContext(ds,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=>String.fromCharCode(10)}):'Type check passed.');
process.exitCode=ds.length?1:0;
