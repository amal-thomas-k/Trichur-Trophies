import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createHarness } from './http-harness.js';

test(`real server customer, approval, security and export invariants (${process.env.TEST_TRANSPORT||'http'} transport)`, {timeout:240000}, async t=>{
 const h=await createHarness();
 t.after(()=>h.close());
 const owner=await h.login(),operator=await h.login('test-operator');
 const fixture=await h.order(owner),customer=fixture.customer;
 const orderId=fixture.order.id,groupId=fixture.view.groups[0].id,recipientId=randomUUID();
 const name='\u0D05\u0D28\u0D41 \u0D15\u0D43\u0D37\u0D4D\u0D23\u0D7B K.';
 const save=(r,nameText=name)=>({expectedRevision:r,groupId,name:nameText,achievement:'Synthetic award',copies:2,crop:{x:0,y:0,zoom:1,rotation:0}});
 let recipient,assetId,proofId,artworkHash,approvalId,printJobId;

 await t.test('public routes do not disclose orders and unknown static files fail safely',async()=>{
  assert.equal((await h.api(h.anonymous,'GET','/api/staff/orders')).status,403);
  assert.equal((await h.api(h.anonymous,'GET','/api/customer/order')).status,401);
  assert.equal((await h.api(h.anonymous,'GET','/does-not-exist.png')).status,404);
  assert.equal((await h.api(h.anonymous,'GET','/api/health')).status,200);
 });
 await t.test('CSRF and foreign origin writes are rejected',async()=>{
  assert.equal((await h.api({...customer,csrf:''},'PUT',`/api/customer/recipients/${recipientId}`,save(0))).status,403);
  assert.equal((await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(0),{origin:'https://attacker.invalid'})).status,403);
 });
 await t.test('name-first record, Unicode and repeated Save are persistent and idempotent',async()=>{
  const r=await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(0));assert.equal(r.status,200);recipient=r.body;assert.equal(recipient.name,name);assert.deepEqual(recipient.issues,['needs_photo','needs_checking']);
  const repeated=await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(0));assert.equal(repeated.status,200);assert.equal(repeated.body.revision,recipient.revision);
  const view=(await h.api(customer,'GET','/api/customer/order')).body;assert.equal(view.recipients.length,1);assert.equal(view.recipients[0].name,name);assert.equal(view.counts.copies,2);
  assert.equal((await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/proof`,{expectedRevision:recipient.revision})).status,422);
 });
 await t.test('decoded upload validation returns actionable HEIC errors and preserves drafts',async()=>{
  for(const [file,bytes] of [['not-a-photo.jpg',Buffer.from('not an image')],['phone.HEIC',Buffer.from('invalid heic data')],['hostile.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')]]){
   const r=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/photo`,bytes,{'x-file-name':file,'x-expected-revision':String(recipient.revision),'x-upload-id':randomUUID()});assert.equal(r.status,415);if(file.endsWith('HEIC'))assert.match(r.body.error,/HEIC.*JPEG/);
  }
  assert.equal((await h.api(customer,'GET','/api/customer/order')).body.recipients[0].name,name);
 });
 await t.test('validated photo upload, duplicate retry and stale upload cannot replace newer selection',async()=>{
  const uploadId=randomUUID(),oldRevision=recipient.revision;
  const r=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/photo`,h.image,{'x-file-name':encodeURIComponent(name+'.png'),'x-expected-revision':String(oldRevision),'x-upload-id':uploadId});assert.equal(r.status,200);recipient=r.body;assetId=recipient.assetId;assert.ok(assetId);
  const retry=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/photo`,h.image,{'x-file-name':'repeat.png','x-expected-revision':String(oldRevision),'x-upload-id':uploadId});assert.equal(retry.status,200);assert.equal(retry.body.assetId,assetId);assert.equal(retry.body.revision,recipient.revision);
  const stale=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/photo`,h.image2,{'x-file-name':'late.jpg','x-expected-revision':String(oldRevision),'x-upload-id':randomUUID()});assert.equal(stale.status,409);
  assert.equal((await h.api(customer,'GET','/api/customer/order')).body.recipients[0].assetId,assetId);
 });
 await t.test('cross-order media, helper ownership and production role isolation',async()=>{
  const other=await h.order(owner);assert.equal((await h.api(other.customer,'GET',`/api/media/${assetId}`)).status,403);
  assert.equal((await h.api(h.anonymous,'GET',`/api/media/${assetId}`)).status,401);
  const helperLink=(await h.api(owner,'POST',`/api/staff/orders/${orderId}/links`,{role:'helper',groupId})).body;const helper=await h.access(helperLink.token);
  assert.equal((await h.api(helper,'GET',`/api/media/${assetId}`)).status,403);
  assert.equal((await h.api(helper,'PUT',`/api/customer/recipients/${recipientId}`,save(recipient.revision,'Overwrite'))).status,403);
  assert.equal((await h.api(helper,'POST','/api/customer/approve',{expectedRevision:1,confirm:true})).status,403);
  assert.equal((await h.api(operator,'POST','/api/staff/templates',{modelCode:'No'})).status,403);
  assert.equal((await h.api(owner,'DELETE',`/api/staff/links/${helperLink.id}`)).status,200);
  assert.equal((await h.api(helper,'GET','/api/customer/order')).status,403);
 });
 await t.test('conflicting edits cannot overwrite and photo survives a name-only edit',async()=>{
  const old=recipient.revision;const r=await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(old,name+' A'));assert.equal(r.status,200);recipient=r.body;assert.equal(recipient.assetId,assetId);
  assert.equal((await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(old,'Conflicting name'))).status,409);
 });
 await t.test('durable worker generates real canonical proof and revision-bound review',async()=>{
  const q=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/proof`,{expectedRevision:recipient.revision});assert.equal(q.status,202);
  await h.waitJob(customer,q.body.id);
  recipient=(await h.api(customer,'GET','/api/customer/order')).body.recipients[0];assert.ok(recipient.proof);proofId=recipient.proof.id;
  assert.equal('snapshot' in recipient.proof,false,'private render snapshots must not be sent to customer');
  const art=recipient.proof.artworks[0];assert.equal('path' in art,false);const bytes=(await h.api(customer,'GET',`/api/artworks/${art.id}`)).bytes;artworkHash=createHash('sha256').update(bytes).digest('hex');assert.equal(artworkHash,art.sha256);assert.equal((await h.sharp(bytes).metadata()).width,Math.round(art.widthMm*300/25.4));
  assert.equal((await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/review`,{expectedRevision:recipient.revision-1,proofId})).status,409);
  const reviewed=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/review`,{expectedRevision:recipient.revision,proofId});assert.equal(reviewed.status,200);assert.equal(reviewed.body.reviewedRevision,recipient.revision);
 });
 await t.test('organiser approval freezes already-rendered artwork and rejects stale revision',async()=>{
  const v=(await h.api(customer,'GET','/api/customer/order')).body;
  assert.equal((await h.api(customer,'POST','/api/customer/approve',{expectedRevision:v.order.revision-1,confirm:true})).status,409);
  const a=await h.api(customer,'POST','/api/customer/approve',{expectedRevision:v.order.revision,confirm:true});assert.equal(a.status,200);approvalId=a.body.id;
  const snapshot=JSON.parse(h.db.prepare('SELECT doc FROM approvals WHERE id=?').get(approvalId).doc);assert.equal(snapshot.recipients[0].proof.artworks[0].sha256,artworkHash);
  const repeat=await h.api(customer,'POST','/api/customer/approve',{expectedRevision:v.order.revision,confirm:true});assert.equal(repeat.status,200);assert.equal('recipients' in repeat.body,false,'approval retry must not expose private immutable snapshot');
 });
 await t.test('diagnostic A3 PDF embeds approved artwork with exact piece quantities and blocks release',async()=>{
  assert.equal((await h.api(owner,'POST',`/api/staff/orders/${orderId}/export`,{})).status,422,'uncalibrated production must be blocked');
  const q=await h.api(owner,'POST',`/api/staff/orders/${orderId}/export`,{diagnostic:true});assert.equal(q.status,202);const job=await h.waitJob(owner,q.body.id);printJobId=job.result.printJobId;
  const pdf=await h.api(owner,'GET',`/api/print-jobs/${printJobId}/pdf`);assert.equal(pdf.status,200);assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');const document=await h.pdfLib.PDFDocument.load(pdf.bytes);for(const page of document.getPages()){assert.ok(Math.abs(page.getWidth()*25.4/72-297)<.0001);assert.ok(Math.abs(page.getHeight()*25.4/72-420)<.0001);}
  const manifest=await h.api(owner,'GET',`/api/print-jobs/${printJobId}/manifest`);assert.equal(manifest.status,200);const placements=manifest.body.placements||manifest.body.pieces;assert.equal(placements.length,2);for(const piece of placements)assert.equal(piece.sha256||piece.artworkSha256,artworkHash);
  assert.equal((await h.api(owner,'POST',`/api/staff/print-jobs/${printJobId}/release`,{})).status,422);
 });
 await t.test('later name edit invalidates review/approval and blocks stale output download',async()=>{
  const before=h.db.prepare('SELECT doc FROM approvals WHERE id=?').get(approvalId).doc;
  const r=await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(recipient.revision,'Changed after approval'));assert.equal(r.status,200);assert.equal(r.body.proofId,null);assert.equal(r.body.reviewedRevision,null);
  const v=(await h.api(customer,'GET','/api/customer/order')).body;assert.equal(v.order.approvalId,null);assert.equal((await h.api(owner,'GET',`/api/print-jobs/${printJobId}/pdf`)).status,409);assert.equal(h.db.prepare('SELECT doc FROM approvals WHERE id=?').get(approvalId).doc,before);
 });
 await t.test('late proof completion cannot overwrite a newer recipient revision',async()=>{
  let current=(await h.api(customer,'GET','/api/customer/order')).body.recipients[0];
  const queued=await h.api(customer,'POST',`/api/customer/recipients/${recipientId}/proof`,{expectedRevision:current.revision});assert.equal(queued.status,202);
  const edited=await h.api(customer,'PUT',`/api/customer/recipients/${recipientId}`,save(current.revision,'Changed while proof was rendering'));assert.equal(edited.status,200);
  const done=await h.waitJob(customer,queued.body.id);assert.equal(done.result.superseded,true);
  current=(await h.api(customer,'GET','/api/customer/order')).body.recipients[0];assert.equal(current.name,'Changed while proof was rendering');assert.equal(current.proofId,null);
 });
 await t.test('shared wording changes invalidate recipient reviews and keep exact Unicode',async()=>{
  const current=(await h.api(customer,'GET','/api/customer/order')).body;const heading='\u0D05\u0D2D\u0D3F\u0D28\u0D28\u0D4D\u0D26\u0D28\u0D19\u0D4D\u0D19\u0D7E';
  const changed=await h.api(customer,'PATCH','/api/customer/shared',{expectedRevision:current.order.revision,shared:{heading,event:'Updated event',date:'2027'}});assert.equal(changed.status,200);
  const after=(await h.api(customer,'GET','/api/customer/order')).body;assert.equal(after.order.shared.heading,heading);assert.equal(after.order.approvalId,null);assert.equal(after.recipients[0].revision,current.recipients[0].revision+1);assert.equal(after.recipients[0].reviewedRevision,null);
  assert.equal((await h.api(customer,'POST','/api/customer/approve',{expectedRevision:after.order.revision,confirm:true})).status,422);
 });
 await t.test('two scoped helpers can contribute concurrently without matching photos by order',async()=>{
  const f=await h.order(owner,{groups:[{label:'Helpers',templateId:fixture.view.templates[0].id,expectedQuantity:2}]});const group=f.view.groups[0].id;
  const helperLinks=await Promise.all([1,2].map(()=>h.api(owner,'POST',`/api/staff/orders/${f.order.id}/links`,{role:'helper',groupId:group})));
  const helpers=await Promise.all(helperLinks.map(l=>h.access(l.body.token)));const ids=[randomUUID(),randomUUID()];
  const records=await Promise.all(helpers.map((helper,i)=>h.api(helper,'PUT',`/api/customer/recipients/${ids[i]}`,{expectedRevision:0,groupId:group,name:`Helper fixture ${i}`,achievement:'',copies:1,crop:{}})));
  assert.ok(records.every(r=>r.status===200));assert.equal((await h.api(f.customer,'GET','/api/customer/order')).body.recipients.length,2);
  for(let i=0;i<2;i++){const view=(await h.api(helpers[i],'GET','/api/customer/order')).body;assert.equal(view.recipients.length,1);assert.equal(view.recipients[0].id,ids[i]);}
 });
 await t.test('calibration requires real numeric measurements and cannot be asserted with missing data',async()=>{
  assert.equal((await h.api(owner,'POST','/api/staff/profiles/a3-default/calibrate',{confirmed:true,notes:'No measurement supplied'})).status,422);
  assert.equal((await h.api(owner,'POST',`/api/staff/templates/${fixture.view.templates[0].id}/calibrate`,{confirmed:true,notes:'No measurement supplied'})).status,400);
 });
 await t.test('mixed model groups keep copy/component counts and isolate override invalidation',async()=>{
  const templates=(await h.api(owner,'GET','/api/templates')).body;const paired=templates.find(t=>t.components.length===2);
  const f=await h.order(owner,{shared:{heading:'Default shared heading',event:'Common event',date:'2026'},groups:[{label:'Single',templateId:fixture.view.templates[0].id,expectedQuantity:1},{label:'Pair',templateId:paired.id,expectedQuantity:1}]});
  const ids=[randomUUID(),randomUUID()];
  for(let i=0;i<2;i++){const r=await h.api(f.customer,'PUT',`/api/customer/recipients/${ids[i]}`,{expectedRevision:0,groupId:f.view.groups[i].id,name:`Mixed fixture ${i}`,achievement:'',copies:i===0?2:1,crop:{}});assert.equal(r.status,200);}
  const before=(await h.api(f.customer,'GET','/api/customer/order')).body;assert.equal(before.counts.recipients,2);assert.equal(before.counts.copies,3);assert.equal(before.counts.components,4);
  const group=f.view.groups[0].id;const override=await h.api(owner,'PATCH',`/api/staff/orders/${f.order.id}/groups/${group}`,{expectedRevision:before.order.revision,shared:{heading:'Only this group',event:'Specific',date:'2027'}});assert.equal(override.status,200);
  let after=(await h.api(f.customer,'GET','/api/customer/order')).body;
  assert.equal(after.recipients.find(r=>r.id===ids[0]).revision,before.recipients.find(r=>r.id===ids[0]).revision+1);assert.equal(after.recipients.find(r=>r.id===ids[1]).revision,before.recipients.find(r=>r.id===ids[1]).revision);
  assert.equal(h.domain.snapshotFor(ids[0]).shared.heading,'Only this group');assert.equal(h.domain.snapshotFor(ids[1]).shared.heading,'Default shared heading');
  const reset=await h.api(owner,'PATCH',`/api/staff/orders/${f.order.id}/groups/${group}`,{expectedRevision:after.order.revision,shared:null});assert.equal(reset.status,200);assert.equal(h.domain.snapshotFor(ids[0]).shared.heading,'Default shared heading');
  assert.equal(h.db.prepare('SELECT count(*) n FROM recipient_revisions WHERE recipient_id=?').get(ids[0]).n,3);
 });
 await t.test('required template fields fail proof generation and block approval',async()=>{
  const publicTemplate=fixture.view.templates[0];for(const component of publicTemplate.components){assert.equal(component.backgroundPath,undefined);assert.equal(component.foregroundPath,undefined);}
  const staffTemplates=await h.api(owner,'GET','/api/templates');assert.equal(staffTemplates.status,200);
  const definition=structuredClone(staffTemplates.body.find(template=>template.id===publicTemplate.id));delete definition.id;definition.modelCode='QA-REQUIRED';definition.name='Synthetic required-field test';definition.fields=definition.fields.map(field=>field.key==='achievement'?{...field,label:'Award wording',required:true}:field);
  const published=await h.api(owner,'POST','/api/staff/templates',definition);assert.equal(published.status,201);assert.equal(published.body.assetPolicy,'sha256-pinned-v1');assert.ok(published.body.components[0].backgroundSha256);
  const f=await h.order(owner,{groups:[{label:'Required',templateId:published.body.id,expectedQuantity:1}]});const rid=randomUUID();let r=await h.api(f.customer,'PUT',`/api/customer/recipients/${rid}`,{expectedRevision:0,groupId:f.view.groups[0].id,name:'Required field fixture',achievement:'',copies:1,crop:{}});assert.equal(r.status,200);
  r=await h.api(f.customer,'POST',`/api/customer/recipients/${rid}/photo`,h.image,{'x-file-name':'fixture.png','x-expected-revision':String(r.body.revision),'x-upload-id':randomUUID()});assert.equal(r.status,200);
  const q=await h.api(f.customer,'POST',`/api/customer/recipients/${rid}/proof`,{expectedRevision:r.body.revision});
  if(q.status===422)assert.match(q.body.error,/required/i);else{assert.equal(q.status,202);let job;for(let attempt=0;attempt<150;attempt++){job=(await h.api(f.customer,'GET',`/api/jobs/${q.body.id}`)).body;if(['failed','completed'].includes(job.status))break;await new Promise(r=>setTimeout(r,100));}assert.equal(job.status,'failed');assert.match(job.error,/required/i);}
  const v=(await h.api(f.customer,'GET','/api/customer/order')).body;assert.equal(v.recipients[0].proofId,null);assert.equal((await h.api(f.customer,'POST','/api/customer/approve',{expectedRevision:v.order.revision,confirm:true})).status,422);
 });
 await t.test('phone EXIF orientation is normalized and metadata stripped from served derivatives',async()=>{
  const f=await h.order(owner),rid=randomUUID();let r=await h.api(f.customer,'PUT',`/api/customer/recipients/${rid}`,{expectedRevision:0,groupId:f.view.groups[0].id,name:'Orientation fixture',achievement:'',copies:1,crop:{}});assert.equal(r.status,200);
  const phonePhoto=await h.sharp({create:{width:80,height:120,channels:3,background:'#aaccee'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  r=await h.api(f.customer,'POST',`/api/customer/recipients/${rid}/photo`,phonePhoto,{'x-file-name':'phone-oriented.jpg','x-expected-revision':String(r.body.revision),'x-upload-id':randomUUID()});assert.equal(r.status,200);
  const derivative=await h.api(f.customer,'GET',`/api/media/${r.body.assetId}`);assert.equal(derivative.status,200);const meta=await h.sharp(derivative.bytes).metadata();assert.equal(meta.width,120);assert.equal(meta.height,80);assert.equal(meta.orientation,undefined);assert.equal(meta.exif,undefined);
 });
});
