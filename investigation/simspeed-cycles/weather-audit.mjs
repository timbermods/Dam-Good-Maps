// Read-only source/kernel checks; results stay in the investigation directory.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import binaryen from 'binaryen';
import ts from 'typescript';
const root=resolve('../..'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const build=read('results/weather/build.json'),hash=s=>createHash('sha256').update(s).digest('hex');
const lf=s=>s.replaceAll('\r\n','\n');
const helperBodies=p=>{
  const file=ts.createSourceFile(p,lf(readFileSync(p,'utf8')),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  return Object.fromEntries(file.statements.filter(n=>ts.isFunctionDeclaration(n)&&['bytes','equal','sha','compare','digest'].includes(n.name?.text)).map(n=>[n.name.text,n.getText(file)]));
};
assert.deepEqual(helperBodies('suite.mjs'),helperBodies('../simspeed/suite.mjs'),'Copied comparison helper bodies');
assert.equal(readFileSync('.work/weather/current-dev-reference.txt','utf8').trim(),build.reference);
const original=p=>readFileSync('.work/weather/current-dev/'+p,'utf8');
const normalize=(s,base)=>lf(s).replace(/(from\s+['"])(\.[^'"]+)(['"])/g,(_,a,p,b)=>a+relative(root,resolve(base,p)).replaceAll('\\','/').replace(relative(root,resolve('weather/reference')).replaceAll('\\','/')+'/','investigation/cycles/')+b).trimEnd();
let sourceCount=0;
for(const [p,h] of Object.entries(build.sources)){assert.equal(hash(lf(readFileSync(p,'utf8'))),h,'Frozen input '+p);sourceCount++;}
for(const [v,h] of Object.entries(build.bundles))assert.equal(hash(readFileSync('.work/weather/bundles/'+v+'.mjs')),h,'Frozen bundle '+v);
assert.equal(hash(JSON.stringify(build.bundles)),build.id);
const referenceFiles=['game-water.ts','game-soil.ts','model.ts','weather.ts','measures.ts','stretch.ts','FIDELITY.md','world.ts'];
for(const file of referenceFiles){
  const source=file==='world.ts'?'src/core/format/world.ts':'investigation/cycles/'+file;
  assert.equal(hash(normalize(readFileSync('weather/reference/'+file,'utf8'),resolve('weather/reference'))),
    hash(normalize(original(source),resolve(root,dirname(source)))),'Pinned reference '+file);
}
const currentDependencies=[];
for(const p of Object.keys(build.sources).filter(p=>p.startsWith('../../src/'))){
  const source=p.slice(6);assert.equal(lf(readFileSync(p,'utf8')),lf(original(source)),'Current-dev dependency '+source);currentDependencies.push(source);
}
const binary=read('weather/kernel-bytes.json'),compiler=read('results/weather/compiler.json'),bytes=Buffer.from(binary.base64,'base64');
assert.equal(hash(bytes),binary.sha256);assert.equal(binary.sha256,compiler.sha256);assert.equal(bytes.length,compiler.bytes);
assert.equal(compiler.binaryenFastMath,false);assert.equal(WebAssembly.validate(bytes),true);
const module=binaryen.readBinary(bytes),wat=module.emitText();assert(module.validate());module.dispose();
// Binary encoding groups locals by type and drops symbolic names. Compare the
// reassembled bytes rather than requiring those textual names to round-trip.
const retained=binaryen.parseText(readFileSync('weather/kernel.wat','utf8'));
assert.equal(hash(Buffer.from(retained.emitBinary())),binary.sha256,'Retained WAT encodes the tested binary');retained.dispose();
assert(!/f32\.|v128|relaxed|f64x2|f32x4/.test(wat));
const result={passed:true,buildId:build.id,reference:build.reference,sourceCount,bundles:Object.keys(build.bundles),
  referenceFiles,currentDependencies,comparisonHelperBodiesUnchanged:true,kernelSha256:binary.sha256,kernelBytes:bytes.length,scalarF64:true,binaryenFastMath:false};
writeFileSync('results/weather/source-audit.json',JSON.stringify(result,null,2)+'\n');
console.log('PASS pinned current-dev copies, '+sourceCount+' frozen inputs, seven bundles, and strict scalar WASM');
