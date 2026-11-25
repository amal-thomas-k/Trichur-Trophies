import { sealTemplate } from '../src/templates.js';
// An actual saved -> uploaded -> rendered -> reviewed -> approved -> exported order.
// Uses synthetic identities and photographs and never declares physical calibration.
import fs from 'node:fs/promises';
import path from 'node:path';
import { db,run,one,parse } from '../src/db.js';
import { DATA,ROOT,now } from '../src/config.js';
import * as d from '../src/domain.js';
import { demoTemplates } from '../src/demo-templates.js';
import { sharp } from '../src/deps.js';
import { runOneJob,claimJob } from '../src/worker.js';
import { closeRenderer,createCalibrationPdf } from '../src/render.js';
const staff={id:'sample-command',username:'sample-operator',role:'admin'};
for(const t of demoTemplates)run('INSERT OR IGNORE INTO templates(id,doc,created_at) VALUES(?,?,?)',t.id,JSON.stringify(sealTemplate(t)),now());
const created=d.createOrder(staff,{title:'Approved synthetic Malayalam sample',shared:{heading:'സ്നേഹാദരം',event:'Trichur Trophies Demo',date:'20 November 2026'},groups:[{label:'479 C demonstration',templateId:demoTemplates[0].id,expectedQuantity:1}]});
const orderId=created.order.id,group=d.orderView(staff,orderId).groups[0];
const link=one('SELECT * FROM links WHERE token_hash=?',d.hash(created.token));const actor={role:'organiser',linkId:link.id,orderId,groupId:null};
let r=d.saveRecipient(actor,orderId,d.id(),{expectedRevision:0,groupId:group.id,name:'അനു കെ.',achievement:'അഭിനന്ദനങ്ങൾ',copies:2,crop:{x:0,y:0,zoom:1,rotation:0}});
const assetId=d.id(),dir=path.join(DATA,'assets',assetId);await fs.mkdir(dir,{recursive:true});
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="#d5e5e2"/><circle cx="600" cy="570" r="250" fill="#c3946f"/><path d="M150 1600V1200Q600 650 1050 1200V1600" fill="#183c49"/><circle cx="515" cy="560" r="22"/><circle cx="685" cy="560" r="22"/><path d="M510 680Q600 750 690 680" fill="none" stroke="#754834" stroke-width="18"/></svg>');
const bytes=await sharp(svg).png().toBuffer(),photo=path.join(dir,'normalized.png');await fs.writeFile(photo,bytes);await fs.writeFile(path.join(dir,'original.bin'),bytes);await sharp(bytes).resize(200).jpeg().toFile(path.join(dir,'thumb.jpg'));
r=d.attachPhoto(actor,r.id,r.revision,{id:assetId,path:photo,originalPath:path.join(dir,'original.bin'),thumbnailPath:path.join(dir,'thumb.jpg'),sha256:d.hash(bytes),sourceSha256:d.hash(bytes),originalFilename:'synthetic-portrait.png',width:1200,height:1600},d.id());
const renderJob=d.requestProof(actor,r.id,r.revision);let loops=0;while(one('SELECT status FROM jobs WHERE id=?',renderJob.id).status!=='completed'){await runOneJob(claimJob());const j=one('SELECT status,error FROM jobs WHERE id=?',renderJob.id);if(j.status==='failed'||++loops>20)throw new Error(j.error||'Sample proof did not finish.');}
r=d.getRecipient(r.id);d.reviewRecipient(actor,r.id,{expectedRevision:r.revision,proofId:r.proofId});const approval=d.approveOrder(actor,orderId,{expectedRevision:d.getOrder(orderId).revision,confirm:true});const exportJob=d.requestExport(staff,orderId,{diagnostic:true});loops=0;while(one('SELECT status FROM jobs WHERE id=?',exportJob.id).status!=='completed'){await runOneJob(claimJob());const j=one('SELECT status,error FROM jobs WHERE id=?',exportJob.id);if(j.status==='failed'||++loops>20)throw new Error(j.error||'Sample export did not finish.');}
const job=parse(one('SELECT * FROM print_jobs WHERE order_id=?',orderId)),proof=parse(one('SELECT * FROM proofs WHERE id=?',r.proofId));const out=path.join(ROOT,'artifacts');await fs.mkdir(out,{recursive:true});await fs.copyFile(job.pdfPath,path.join(out,'sample-approved-order-A3.pdf'));await fs.copyFile(job.manifestPath,path.join(out,'sample-placement-manifest.json'));await fs.copyFile(proof.artworks[0].path,path.join(out,'sample-individual-artwork.png'));if(job.zipPath)await fs.copyFile(job.zipPath,path.join(out,'sample-approved-artworks.zip'));await createCalibrationPdf(path.join(out,'calibration.pdf'));await fs.writeFile(path.join(out,'sample-evidence.json'),JSON.stringify({orderId,approvalId:approval.id,snapshotHash:approval.snapshotHash,proofId:proof.id,artworkSha256:proof.artworks[0].sha256,printJobId:job.id,diagnostic:true,calibrated:false,generatedAt:now()},null,2));console.log(JSON.stringify({orderId,approvalId:approval.id,output:out,url:created.url},null,2));await closeRenderer();db.close();


