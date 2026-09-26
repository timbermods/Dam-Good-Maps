import { build } from 'esbuild';
import { launch } from './browser.mjs';
import { serve } from './server.mjs';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('.work',{recursive:true});
await build({entryPoints:['test-rules.ts'],outfile:'.work/test.mjs',bundle:true,platform:'node',format:'esm',nodePaths:['./node_modules']});
await import('./.work/test.mjs');
const server=serve(4179),browser=await launch();
try {
  const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4179');
  await page.locator('#coordinates').fill('36.1, -112.1');
  await page.locator('#generate').click();
  await page.locator('#cancel').click();
  assert.equal(await page.locator('#status').textContent(),'Cancelled.');
  await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.querySelector('#result').hidden,{},{timeout:120000});
  assert.equal(await page.locator('#download').isVisible(),true);
  assert.match(await page.locator('#details').textContent(),/Real terrain, designed water/);
  assert.match(await page.locator('#details').textContent(),/Returned area:/);
  assert.equal(await page.locator('#intention option').count(),3);
  const download=page.waitForEvent('download');await page.locator('#download').click();
  assert.match((await download).suggestedFilename(),/\.timber$/);
  await page.screenshot({path:'results-water/prototype.png',fullPage:true});
  await page.locator('#coordinates').fill('not coordinates');await page.locator('#generate').click();
  assert.equal(await page.locator('#download').isVisible(),false);
  await page.locator('#coordinates').fill('90, 0');await page.locator('#generate').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('latitude'));
  assert.equal(await page.locator('#download').isVisible(),false);
  assert.deepEqual(errors,[]);
  // Fully flat ground has no natural pump bank: exhaust bounded search and show
  // measured nearby previews, never a download. Stub only the public DEM response.
  const { PNG }=await import('pngjs');
  const png=new PNG({width:256,height:256});
  for(let i=0;i<png.data.length;i+=4){png.data[i]=128;png.data[i+1]=0;png.data[i+2]=0;png.data[i+3]=255;}
  const flatContext=await browser.newContext({serviceWorkers:'block'});
  await flatContext.route('https://s3.amazonaws.com/elevation-tiles-prod/**',route=>route.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:PNG.sync.write(png)}));
  const flatPage=await flatContext.newPage();await flatPage.goto('http://127.0.0.1:4179');
  await flatPage.locator('#coordinates').fill('0, -140');await flatPage.locator('#size').selectOption('96');
  await flatPage.locator('#generate').click();
  await flatPage.waitForFunction(()=>!document.querySelector('#result').hidden,{},{timeout:180000});
  assert.equal(await flatPage.locator('#download').isVisible(),false);
  assert.equal(await flatPage.locator('#suggestions canvas').count(),2);
  assert.match(await flatPage.locator('#details').textContent(),/14 water designs tested/);
  await flatContext.close();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'results-water/mobile.png',fullPage:true});
  await writeFile('results-water/tests.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),passed:true,checks:['unit regressions','UI cancellation','real worker conversion','download','invalid-input stale-download prevention','390px layout without horizontal overflow','no page errors','designed-water status and returned area','three water intentions','14-design exhaustion on a mocked flat DEM','two measured nearby previews and no failed download']},null,2));
  console.log('PASS: browser UI cancellation, worker conversion, download, invalid input, no page errors.');
}finally{await browser.close();server.close();}
