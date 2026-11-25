// Real counter workflow with a disposable order. No live customer credentials
// or QR pixels are written to the report.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHarness} from '../tests/http-harness.js';
import decodeQr from '../tests/vendor/jsQR.cjs';

process.env.TT_OFFLINE_RENDERING='1';
const h=await createHarness({transport:'http',worker:false});
const {getBrowser,closeRenderer}=await import('../src/render.js');
try{
  const migrated=spawnSync(process.execPath,['scripts/migrate.js'],{env:{...process.env,DATA_DIR:h.data},windowsHide:true});
  assert.equal(migrated.status,0);
  const browser=await getBrowser(),staff=await browser.newContext(),phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const counter=await staff.newPage();
  await counter.goto(h.base+'/staff');
  await counter.locator('#username').fill('test-owner');
  await counter.locator('#password').fill('test-only-password-2026');
  await counter.locator('#login-form button[type=submit]').click();
  await counter.locator('#new-order').click();
  await counter.locator('#order-title').fill('Jyothi counter test');
  await counter.locator('[data-group-template]').selectOption('shop-carving-jyothi-v2');
  assert.equal(await counter.locator('#order-heading').isDisabled(),true);
  await counter.locator('button[form=create-order-form]').click();
  const qr=counter.locator('#order-qr');
  await qr.waitFor({state:'visible'});
  const pixels=await h.sharp(await qr.screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const decoded=decodeQr(new Uint8ClampedArray(pixels.data),pixels.info.width,pixels.info.height);
  assert.ok(decoded,'Displayed QR must decode at its actual on-screen size');
  assert.equal(new URL(decoded.data).origin,h.base);
  const page=await phone.newPage();
  await page.goto(decoded.data);
  await page.locator('#recipient-name').waitFor();
  assert.equal(new URL(page.url()).hash,'');
  assert.equal(await page.locator('#achievement:visible').count(),0);
  await page.locator('#recipient-name').fill('College award');
  await page.locator('#photo-input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:h.image});
  await page.locator('#save-card').click();
  await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent.includes('Saved to order'));
  await page.reload();
  const order=await page.evaluate(async()=>await (await fetch('/api/customer/order')).json());
  assert.equal(order.order.title,'Jyothi counter test');
  assert.equal(order.recipients[0].name,'College award');
  assert.ok(order.recipients[0].assetId);
  assert.equal(order.templates[0].fixedHeading,'Jyothi Engineering College');
  const report={passed:true,checks:['Staff signs into /staff','Staff creates a new Jyothi model order','Fixed heading is protected','Decoded the QR from actual screen pixels','A separate phone browser opened the matching order','Saved name and photo survived reload'],browser:browser.version(),transport:'native loopback HTTP',physicalCameraTest:false};
  await mkdir('artifacts/shop-qa',{recursive:true});
  await writeFile('artifacts/shop-qa/counter.json',JSON.stringify(report,null,2));
  console.log('Passed staff login, new order dialog, screen QR decode, customer entry and persisted save.');
}finally{await closeRenderer();await h.close();}
