import { readFile,readdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const files=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else files.push(p);}}
await scan('../../src/core');
files.push('../landscapes/lib/terrain.ts');
for(const e of await readdir('.'))if(/\.(ts|mjs)$/.test(e)||['package-lock.json','ATTRIBUTION.md','places.json'].includes(e))files.push(e);
const records=[];
for(const file of files.sort()){
 const bytes=await readFile(file),content=/\.(ts|mjs|json|md|html)$/.test(file)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;
 records.push({file:file.replaceAll('\\','/'),sha256:createHash('sha256').update(content).digest('hex')});
}
await writeFile('results-signature/code-sha256.json',JSON.stringify({base:'91981517f747fa345b5586b9f036aedb74255b1b',branchBase:'2f8b4e6100063b5cd79cb0cc07343533f446724d',normalization:'UTF-8 text is normalized to LF before SHA-256; other files use raw bytes.',files:records},null,2));
console.log(`${records.length} source files fingerprinted.`);
