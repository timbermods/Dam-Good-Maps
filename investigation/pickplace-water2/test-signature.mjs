import { build } from 'esbuild';import {launch}from'./browser.mjs';import{serve}from'./server.mjs';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';
await mkdir('.work',{recursive:true});
for(const name of ['test-rules','test-signature']){await build({entryPoints:[name+'.ts'],outfile:'.work/'+name+'.mjs',bundle:true,platform:'node',format:'esm',nodePaths:['./node_modules']});await import('./.work/'+name+'.mjs');}
const server=serve(4179),browser=await launch();try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:4179');
 await page.locator('#coordinates').fill('42.94, -122.11');await page.locator('#generate').click();await page.locator('#cancel').click();assert.equal(await page.locator('#status').textContent(),'Cancelled.');
 await page.locator('#generate').click();await page.waitForFunction(()=>!document.querySelector('#result').hidden,{},{timeout:180000});assert.equal(await page.locator('#download').isVisible(),true);
 const download=page.waitForEvent('download');await page.locator('#download').click();assert.match((await download).suggestedFilename(),/\.timber$/);
 await page.screenshot({path:'results-signature/prototype.png',fullPage:true});
 await page.locator('#coordinates').fill('invalid');await page.locator('#generate').click();assert.equal(await page.locator('#download').isVisible(),false);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'results-signature/mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 await writeFile('results-signature/tests.json',JSON.stringify({passed:true,browser:browser.version(),checks:['legacy focused unit regressions','signature lake and edge source rules','negative sea-floor classification regression','canonical counterfactual rejects second source inside a supplied lake','prefill reach equals exact prefill wet set on 30 random terrains with off-source footprints','unchanged land outside observed water cells','shoreline-first start','fixed-extent retention and missing-reference semantics','real Crater Lake worker conversion and download','cancel','invalid-input stale-download prevention','390px layout','no page errors']},null,2));
}finally{await browser.close();server.close();}
