import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
const variants=['saturation','topology','clear','unroll','combined'];
const program=ts.createProgram(['api.ts','api-exact.ts','api-m9.ts','prototypes/drought.ts',...variants.map(v=>'prototypes/'+v+'/water.ts')],{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],strict:true,noEmit:true,skipLibCheck:true,
  noImplicitOverride:true,noFallthroughCasesInSwitch:true,resolveJsonModule:true,isolatedModules:true,esModuleInterop:true,
  baseUrl:'.',paths:{fflate:['node_modules/fflate']},
});
const diagnostics=ts.getPreEmitDiagnostics(program);
for(const d of diagnostics)console.error(ts.flattenDiagnosticMessageText(d.messageText,'\n'));
writeFileSync('results/typecheck.json',JSON.stringify({buildId:JSON.parse(readFileSync('results/build.json','utf8')).id,compiler:ts.version,errors:diagnostics.length},null,2)+'\n');
if(diagnostics.length)process.exitCode=1;else console.log('PASS TypeScript investigation modules');
