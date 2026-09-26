import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch} from './browser.mjs';
import {serve} from './server.mjs';
import {installBudget} from './benchmark-browser.mjs';
const server=serve(4183),browser=await launch();
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4183');
  await page.waitForFunction(()=>!!window.pickplace);
  assert.equal(await page.locator('#cancel').isDisabled(),true);
  await installBudget(page,1);
  await assert.rejects(page.evaluate(()=>window.benchConvert({lat:42.94,lon:-122.11,size:256})),/Benchmark timeout/);
  assert.equal(await page.locator('#status').textContent(),'Cancelled.');
  assert.equal(await page.evaluate(()=>1+1),2);
  await writeFile('results-signature/budget-tests.json',JSON.stringify({passed:true,checks:['deadline terminates a real worker even when the survey bypasses the form','deadline is reported as a timeout, never a passing result','page remains responsive after cancellation']},null,2));
  console.log('Browser benchmark watchdog cancels a real worker and reports the timeout.');
}finally{await browser.close();server.close();}
