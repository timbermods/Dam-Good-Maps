import assert from'node:assert/strict';import{waterProxy}from'./water-proxy.mjs';
import {serve} from './server.mjs';import {writeFile} from 'node:fs/promises';
const valid='https://local/worldcover/ESA_WorldCover_10m_2021_v200_N42W123_Map.tif';
for(const [url,options]of[['https://local/worldcover/https://example.org/file',{}],[valid,{method:'POST'}],[valid,{}],[valid,{headers:{Range:'bytes=0-9000000'}}],[valid,{headers:{Range:'bytes=99-0'}}],[valid,{headers:{Range:'bytes=9999999999999999999999-99999999999999999999999'}}],[valid,{headers:{Range:'bytes=0-1,4-8'}}]])assert.equal((await waterProxy(new Request(url,options))).status,400);
console.log('Proxy rejects arbitrary objects, methods and invalid/unbounded ranges before fetching.');
const server=serve(0);await new Promise(resolve=>server.once('listening',resolve));
try{for(const method of ['POST','HEAD']){const r=await fetch(`http://127.0.0.1:${server.address().port}/worldcover/ESA_WorldCover_10m_2021_v200_N42W123_Map.tif`,{method,headers:{Range:'bytes=0-1023'}});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET');await r.arrayBuffer();}}
finally{await new Promise(resolve=>server.close(resolve));}
await writeFile('results-signature/proxy-tests.json',JSON.stringify({passed:true,checks:['fixed objects only','GET only in handler and local wrapper','bounded safe-integer single ranges','invalid requests rejected before upstream fetch']},null,2));
console.log('Local wrapper preserves GET-only policy.');
