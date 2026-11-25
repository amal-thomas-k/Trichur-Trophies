import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './http-harness.js';

test('private order QR endpoint enforces native server authentication and active scopes',async t=>{
 const h=await createHarness({worker:false});t.after(()=>h.close());
 const owner=await h.login(),fixture=await h.order(owner);
 await t.test('authenticated staff obtain a self-contained image without external services',async()=>{const r=await h.api(owner,'POST','/api/staff/order-qr',{url:fixture.url});assert.equal(r.status,200);assert.match(r.body.svg,/<svg/);assert.ok(!r.body.svg.includes('<script'));assert.ok(!r.body.svg.includes(fixture.token));assert.ok(!r.body.svg.includes('<image'));});
 await t.test('unauthenticated, organiser and missing-CSRF requests are rejected',async()=>{assert.equal((await h.api(h.anonymous,'POST','/api/staff/order-qr',{url:fixture.url})).status,401);assert.equal((await h.api(fixture.customer,'POST','/api/staff/order-qr',{url:fixture.url})).status,403);assert.equal((await h.api({...owner,csrf:''},'POST','/api/staff/order-qr',{url:fixture.url})).status,403);});
 await t.test('foreign host, malformed token and non-order path cannot produce a QR',async()=>{for(const url of ['https://example.invalid/o#'+fixture.token,h.base+'/o#short',h.base+'/staff#'+fixture.token]){const r=await h.api(owner,'POST','/api/staff/order-qr',{url});assert.ok([400,403,404].includes(r.status),`${r.status}: ${r.body.error}`);assert.ok(!r.body.svg);}});
 await t.test('revocation disables QR regeneration',async()=>{assert.equal((await h.api(owner,'DELETE',`/api/staff/links/${fixture.id}`)).status,200);const r=await h.api(owner,'POST','/api/staff/order-qr',{url:fixture.url});assert.equal(r.status,410);assert.ok(!r.body.svg);});
});
