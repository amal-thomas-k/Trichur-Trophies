import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
process.env.TEST_TRANSPORT='direct';
const {createHarness}=await import('../tests/http-harness.js');
const h=await createHarness({worker:false}),checks=[];
try{
 const owner=await h.login();const templates=(await h.api(owner,'GET','/api/templates')).body;
 const response=await h.api(owner,'GET',`/api/templates/${templates[0].id}/thumbnail`);assert.equal(response.status,200);const meta=await h.sharp(response.bytes).metadata();assert.ok(meta.width>0&&meta.width<=240&&meta.height<=320);assert.equal((await h.api(h.anonymous,'GET',`/api/templates/${templates[0].id}/thumbnail`)).status,403);checks.push('Actual decoded template thumbnail is private and dimension-bounded');
 const invalid=structuredClone(templates[0]);invalid.fields.push(structuredClone(invalid.fields[0]));assert.equal((await h.api(owner,'POST','/api/staff/templates',invalid)).status,400);checks.push('Publication rejects duplicate field definitions');
 const fixed=await h.order(owner,{shared:{heading:'',event:'',date:''}});assert.equal(fixed.view.order.shared.heading,'');checks.push('Explicit empty heading is retained for staff-approved fixed heading artwork');
 const order=await h.order(owner),recipientId=crypto.randomUUID();let r=await h.api(order.customer,'PUT',`/api/customer/recipients/${recipientId}`,{expectedRevision:0,groupId:order.view.groups[0].id,name:'Storage Check',achievement:'',copies:1,crop:{x:0,y:0,zoom:1,rotation:0}});assert.equal(r.status,200);
 process.env.MIN_FREE_STORAGE_MB='999999999';const upload=await h.api(order.customer,'POST',`/api/customer/recipients/${recipientId}/photo`,h.image,{'x-file-name':'test.png','x-upload-id':crypto.randomUUID(),'x-expected-revision':String(r.body.revision)});delete process.env.MIN_FREE_STORAGE_MB;assert.equal(upload.status,507);assert.match(upload.body.error,/storage/i);const current=(await h.api(order.customer,'GET','/api/customer/order')).body.recipients[0];assert.equal(current.assetId,null);assert.equal(current.name,'Storage Check');checks.push('Storage admission failure is actionable and preserves the saved entry');
 const root=path.resolve(import.meta.dirname,'..'),inventory=JSON.parse(await fs.readFile(path.join(root,'docs','reference-inventory.json'),'utf8'));for(const item of inventory.files){const bytes=await fs.readFile(path.join(root,'Design Templates',item.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);}
 checks.push(`All ${inventory.files.length} original reference file SHA-256 hashes are unchanged`);
 const report={status:'passed',checkedAt:new Date().toISOString(),transport:'Actual server handler and storage; TCP substituted',checks};await fs.writeFile(path.join(root,'artifacts','boundary-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{delete process.env.MIN_FREE_STORAGE_MB;await h.close();}
