// Trusted offline shop import using the SAME domain, database, job worker and
// canonical renderer as the web application. Does not approve any recipient.
import './work1-offline-guard.cjs';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { work1Crop } from './work1-crops.js';
import { sharp } from '../src/deps.js';
import { writeWork1ReviewPdf } from '../src/work1-review-pdf.js';
const root=path.resolve(import.meta.dirname,'..');
process.env.DATA_DIR=path.join(root,'data','work1');
process.env.BASE_URL='http://localhost:3000';
process.env.TT_OFFLINE_RENDERING='1';
// Set the data directory BEFORE loading any module which imports config.js.
const {work1Template,makeContactSheet,WORK1_MM}=await import('./work1-layout.js');
const {closeRenderer}=await import('../src/render.js');
const {db,one,all,run,parse}=await import('../src/db.js');
const {DATA,now}=await import('../src/config.js');
if(DATA!==process.env.DATA_DIR)throw new Error('Work1 isolation failed; refusing to write to another database');
const d=await import('../src/domain.js');
const {sealTemplate}=await import('../src/templates.js');
const {acquireLock,claimJob,runOneJob}=await import('../src/worker.js');
const args=process.argv.slice(2),limit=args.includes('--preview')?1:100;
const source=path.join(root,'Work 1','Leonardo DiCaprio');
const output=path.join(root,'Work1-Output');
const stateFile=path.join(DATA,'work1-batch-state.json');
const actor={id:'local-work1-import',username:'local-work1-import',role:'admin'};
const started=performance.now(),startedAt=now();
const offlineGuard=globalThis[Symbol.for('trichur.work1.offlineGuard')];
if(!offlineGuard)throw new Error('Offline network/process guard was not loaded. Use Build-Work1.cmd.');
const release=acquireLock();
let state;
const atomic=async(file,value)=>{const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2));await fs.rename(tmp,file);};
const hashFile=async(file)=>{const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
  const files=(await fs.readdir(source)).filter(f=>/\.(jpe?g|png|webp)$/i.test(f)).sort();
  if(files.length!==100)throw new Error(`Expected exactly 100 photographs; found ${files.length}. No silent omissions.`);
  const campusHash=await hashFile(path.join(root,'Work 1','jyothi-engineering-college-office.jpg'));
  if(campusHash!=='4f7c1592ead9cd15bc484ccfc566a65b25f9e295209bca38f76e3bc94ac819c3')throw new Error('Campus source changed. The pinned fixed master belongs to the original supplied photograph; author and verify a new template rather than reuse it.');
  await fs.mkdir(output,{recursive:true});
  for(const dir of ['png','jpeg','thumbnails','contact-sheets'])await fs.mkdir(path.join(output,dir),{recursive:true});
  try{state=JSON.parse(await fs.readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!state){
    // The exact previously verified raster ships locally. A fresh import never
    // invokes the browser-based authoring tool, even when no state file exists.
    const master=path.join(root,'private','prepared-assets','jyothi-carving-round-master.png');
    const masterBytes=await fs.readFile(master);
    if(d.hash(masterBytes)!=='db1f8b4878e6387b03ce3801ee01494c2b214dc6e1ee5ecfdb7c7853ac5986ee')throw new Error('Pinned Work1 master is missing or changed; no browser fallback is allowed.');
    const background=path.join(DATA,'templates','jyothi-v1','jyothi-carving-background.png');
    await fs.mkdir(path.dirname(background),{recursive:true});await fs.writeFile(background,masterBytes);
    const template=sealTemplate(work1Template(background));
    run('INSERT INTO templates(id,doc,created_at) VALUES(?,?,?)',template.id,JSON.stringify(template),now());
    const created=d.createOrder(actor,{title:'Work 1 - Jyothi Engineering College - 100 portraits',shared:{heading:'',event:'',date:''},groups:[{label:'CARVING KANNADI R BIG',templateId:template.id,expectedQuantity:100}]});
    state={orderId:created.order.id,templateId:template.id,url:created.url,groupId:d.orderView(actor,created.order.id).groups[0].id,entries:{},createdAt:now()};
    await atomic(stateFile,state);
    await fs.writeFile(path.join(output,'Open-order.url'),`[InternetShortcut]\r\nURL=${state.url}\r\n`);
  }
  const template=d.getTemplate(state.templateId),entries=[];
  for(const [i,file] of files.slice(0,limit).entries()){
    const original=await fs.readFile(path.join(source,file)),sourceHash=d.hash(original);
    let saved=state.entries[file];
    if(saved&&saved.sourceSha256!==sourceHash)throw new Error(`Source changed after import: ${file}. Make a new order rather than overwrite saved proofs.`);
    if(!saved){saved={recipientId:d.id(),sourceSha256:sourceHash};state.entries[file]=saved;await atomic(stateFile,state);}
    let recipient=one('SELECT * FROM recipients WHERE id=?',saved.recipientId);
    recipient=recipient?parse(recipient):d.saveRecipient(actor,state.orderId,saved.recipientId,{expectedRevision:0,groupId:state.groupId,name:path.parse(file).name,copies:1});
    if(!recipient.assetId){
      const result=await sharp(original,{limitInputPixels:50_000_000}).autoOrient().png().toBuffer({resolveWithObject:true});
      const assetId=d.id(),dir=path.join(DATA,'assets',assetId);await fs.mkdir(dir,{recursive:true});
      const normalized=path.join(dir,'normalized.png'),originalPath=path.join(dir,'original.bin'),thumbnailPath=path.join(dir,'thumb.jpg');
      await fs.writeFile(normalized,result.data);await fs.writeFile(originalPath,original);
      await sharp(result.data).resize(240,240,{fit:'inside'}).jpeg({quality:88}).toFile(thumbnailPath);
      recipient=d.attachPhoto(actor,recipient.id,recipient.revision,{id:assetId,path:normalized,originalPath,thumbnailPath,sha256:d.hash(result.data),sourceSha256:sourceHash,originalFilename:file,width:result.info.width,height:result.info.height},d.id());
    }
    const asset=d.getAsset(recipient.assetId),crop=work1Crop(file,asset.width,asset.height);
    if(!saved.importCompleted){
      recipient=d.saveRecipient(actor,state.orderId,recipient.id,{expectedRevision:recipient.revision,groupId:state.groupId,name:path.parse(file).name,copies:1,crop});
      saved.importCompleted=true;await atomic(stateFile,state);
    }
    if(!recipient.proofId){
      const requested=d.requestProof(actor,recipient.id,recipient.revision);
      for(;;){
        const job=one('SELECT * FROM jobs WHERE id=?',requested.id);
        if(job.status==='completed')break;
        if(['failed','cancelled'].includes(job.status))throw new Error(`${file}: ${job.error||job.status}`);
        const next=claimJob();if(next)await runOneJob(next);else await new Promise(r=>setTimeout(r,250));
      }
      recipient=d.getRecipient(recipient.id);
    }
    const proof=parse(one('SELECT * FROM proofs WHERE id=?',recipient.proofId));
    if(proof.revision!==recipient.revision)throw new Error('Current proof revision mismatch');
    const art=proof.artworks[0],bytes=await fs.readFile(art.path),name=path.parse(file).name;
    if(d.hash(bytes)!==art.sha256)throw new Error('Canonical proof hash mismatch');
    const png=path.join(output,'png',name+'.png'),jpeg=path.join(output,'jpeg',name+'.jpg');
    await fs.writeFile(png,bytes);
    await sharp(bytes).flatten({background:'#fff'}).withMetadata({density:300}).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(jpeg);
    await sharp(bytes).resize(360).jpeg({quality:88}).toFile(path.join(output,'thumbnails',name+'.jpg'));
    entries.push({sourceFilename:file,name,sourceSha256:sourceHash,recipientId:recipient.id,revision:recipient.revision,proofId:proof.id,artworkSha256:art.sha256,pixelWidth:art.pixelWidth,pixelHeight:art.pixelHeight,widthMm:art.widthMm,heightMm:art.heightMm,effectivePhotoDpi:art.effectiveDpi,crop:recipient.crop,warnings:proof.warnings,sourceWidth:asset.width,sourceHeight:asset.height,png:`png/${name}.png`,jpeg:`jpeg/${name}.jpg`,canonicalPath:art.path});
    if(i===0||(i+1)%10===0)console.log(`Rendered/saved ${i+1}/${limit} | ${((performance.now()-started)/1000).toFixed(1)} seconds`);
  }
  await atomic(path.join(output,'design-manifest.json'),{status:'unapproved-proofs',orderId:state.orderId,templateId:state.templateId,title:'Jyothi Engineering College',dpi:300,units:'mm',physicalFitVerified:false,entries});
  if(limit===1){console.log('Preview ready: Work1-Output/png/'+entries[0].name+'.png');}
  else{
    for(let n=0;n<4;n++)await makeContactSheet(entries.slice(n*25,n*25+25).map(e=>({path:path.join(output,e.png),label:e.name})),path.join(output,'contact-sheets',`designs-${n*25+1}-${n*25+25}.jpg`));
    // A review-only PDF deliberately does not fabricate an approval record.
    // Approved production PDFs still require the web app's normal review flow.
    const pdfPath=path.join(output,'Work1-100-designs-A3-review.pdf');
    const pdfResult=await writeWork1ReviewPdf(entries,pdfPath,{onProgress:n=>{if(n%10===0)console.log(`A3 review PDF: ${n}/100 pages embedded`);}});
    const placements=pdfResult.placements;
    for(const e of entries){if(d.hash(await fs.readFile(path.join(source,e.sourceFilename)))!==e.sourceSha256||d.hash(await fs.readFile(path.join(output,e.png)))!==e.artworkSha256)throw new Error('Final source/output pairing verification failed');}
    if(one('SELECT COUNT(*) n FROM approvals WHERE order_id=?',state.orderId).n!==0)throw new Error('Work1 must remain unapproved until actual user review');
    await atomic(path.join(output,'A3-placement-manifest.json'),{status:'unapproved-review-only',approvalId:null,pageMm:[297,420],pieceCount:100,pageCount:100,placements});
    const links=entries.map(e=>`<a class="card" href="${esc(e.png)}"><img loading="lazy" src="thumbnails/${esc(e.name)}.jpg" width="360" height="360"><span>${esc(e.name)}</span></a>`).join('');
    await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Work 1 - 100 Carving designs</title><style>body{font:16px system-ui;margin:32px;background:#f3f5f7;color:#17354b}h1{margin-bottom:8px}nav{display:flex;gap:24px;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.card{background:white;border-radius:12px;padding:12px;text-decoration:none;color:inherit;text-align:center}.card img{width:100%;height:auto}.card span{display:block;margin:10px}a{color:#086da8}</style><h1>Jyothi Engineering College</h1><p>100 CARVING KANNADI R BIG designs · 2953 × 2953 px · 300 DPI · 250.020667 mm square</p><p>Local rendering. Unapproved proofs; physical fit and print quality need checking. Filenames are printed without the image extension.</p><nav><a href="Work1-100-designs-A3-review.pdf">100-page A3 review PDF</a><a href="${esc(state.url)}">Open editable local order</a><a href="RUN-AND-TEST.txt">Run and test instructions</a></nav><div class="grid">${links}</div></html>`);
    await fs.writeFile(path.join(output,'RUN-AND-TEST.txt'),`WORK 1 — LOCAL TEST\r\n\r\n1. Double-click index.html to browse all 100 saved designs without running a server.\r\n2. In the project folder, double-click Start-Work1.cmd. Create an owner password at the first launch; no default password is shipped. Keep the window open.\r\n3. Open Open-order.url in this folder to edit/review the real persisted order, or http://localhost:3000/staff for staff controls.\r\n4. Change one name/crop, save, reload and generate a new proof; review it. Review all entries before approving. Physical calibration is needed for production release.\r\n5. To rerun/resume this exact import, stop Start-Work1 first and run: node scripts/work1-batch.js\r\n\r\nThis folder is an export snapshot; later edits in the app require a new export. Originals are unchanged.\r\nThe 100-page A3 review PDF is unapproved/uncalibrated. Print at Actual Size; each artwork is 250.020667 mm square. No base component was requested.\r\nSource campus JPEG is only 640x480; enlarging it does not create print detail. No cloud or GPT/image-generation API is called.\r\n`);
    const elapsedSeconds=(performance.now()-started)/1000;
    const rendererCounts={};for(const entry of entries){const proof=parse(one('SELECT * FROM proofs WHERE id=?',entry.proofId));const version=proof.renderer?.version||'unknown';rendererCounts[version]=(rendererCounts[version]||0)+1;}
    if(offlineGuard.blockedAttempts.length)throw new Error('An unexpected network/process operation was denied. Inspect the offline guard before accepting this batch.');
    const report={ok:true,startedAt,completedAt:now(),elapsedSeconds,sourceCount:100,pngCount:(await fs.readdir(path.join(output,'png'))).length,jpegCount:(await fs.readdir(path.join(output,'jpeg'))).length,pdfPages:100,pdfBytes:pdfResult.pdfBytes,pdfSha256:await hashFile(pdfPath),pdfEncoding:pdfResult.encoding,pageMm:[297,420],artworkMm:[WORK1_MM,WORK1_MM],canvasPixels:[2953,2953],sourcePairingAndOutputHashesVerified:true,approvalCount:0,orderId:state.orderId,templateId:template.id,rendererCounts,allPortraitsBelow200Dpi:entries.every(e=>e.effectivePhotoDpi<200),photoDpiRange:[Math.min(...entries.map(e=>e.effectivePhotoDpi)),Math.max(...entries.map(e=>e.effectivePhotoDpi))],networkRendering:'completion used local Sharp/libvips/Pango; no browser process, external connection or processing API; existing immutable browser proofs retained',offlineGuard:{version:offlineGuard.version,blockedOperations:offlineGuard.blockedAttempts.length},outputFolder:output};
    await atomic(path.join(output,'RUN-REPORT.json'),report);
    await atomic(path.join(output,'STATUS.json'),{complete:true,designCount:100,report:'RUN-REPORT.json',completedAt:report.completedAt,approvalCount:0,physicalFitVerified:false});
    console.log(JSON.stringify(report,null,2));
  }
}finally{await closeRenderer();release();db.close();}
