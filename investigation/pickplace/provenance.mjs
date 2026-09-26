import { readFile,readdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const files=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else files.push(p);}}
await scan('../../src/core');
files.push('../landscapes/lib/terrain.ts');
for(const e of await readdir('.'))if(/\.(ts|mjs)$/.test(e)||['package-lock.json','ATTRIBUTION.md','places.json'].includes(e))files.push(e);
const records=[];
for(const file of files.sort())records.push({file:file.replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
await writeFile('results/code-sha256.json',JSON.stringify({base:'84b1866b4e1d444346949a7dd57dc0f3f9f69ac5',files:records},null,2));
console.log(`${records.length} source files fingerprinted.`);
