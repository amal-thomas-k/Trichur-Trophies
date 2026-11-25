import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {sharp,pdfLib} from '../src/deps.js';
import {renderRecipient,createPrintPdf,createCalibrationPdf,renderMalayalamCorpus,closeRenderer} from '../src/render.js';
import {demoTemplates} from '../src/demo-templates.js';
import {MM_TO_PT} from '../src/packing.js';

const out=path.resolve(process.argv[2]||'samples/render-check');
await fs.mkdir(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Synthetic identity illustration; no reference customer photograph is used.
const photo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="#dcece8"/><circle cx="600" cy="540" r="280" fill="#658b83"/><ellipse cx="600" cy="1380" rx="570" ry="530" fill="#325b56"/><text x="600" y="1550" font-family="sans-serif" font-size="55" text-anchor="middle" fill="white">SYNTHETIC TEST IMAGE</text></svg>')).png().toBuffer();
const photoPath=path.join(out,'synthetic-photo.png');await fs.writeFile(photoPath,photo);
const logo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect x="10" y="10" width="380" height="380" rx="80" fill="#143f3d"/><path d="M100 90H300V150Q300 250 210 270V300H260V330H140V300H190V270Q100 250 100 150Z" fill="#d2ae61"/></svg>')).png().toBuffer();
const logoPath=path.join(out,'synthetic-logo.png');await fs.writeFile(logoPath,logo);
const report={startedAt:new Date().toISOString(),renders:[],pageChecks:[],warnings:[]};
try{
  report.calibration=await createCalibrationPdf(path.join(out,'calibration-A3.pdf'));
  report.malayalam=await renderMalayalamCorpus(path.join(out,'malayalam-corpus.png'));
  const pieces=[];
  for(const [index,template] of demoTemplates.entries()){
    const name=index===1?'\u0d05\u0d30\u0d41\u0d7a \u0d15\u0d46.':'\u0d36\u0d4d\u0d30\u0d40\u0d32\u0d15\u0d4d\u0d37\u0d4d\u0d2e\u0d3f \u0d15\u0d46. \u0d28\u0d3e\u0d2f\u0d7c';
    const snapshot={recipient:{id:`synthetic-recipient-${index+1}`,name,achievement:'\u0d2e\u0d3f\u0d15\u0d1a\u0d4d\u0d1a \u0d28\u0d47\u0d1f\u0d4d\u0d1f\u0d02',copies:index===1?2:1,crop:{x:0,y:0,zoom:1,rotation:0}},shared:{heading:'\u0d05\u0d2d\u0d3f\u0d28\u0d28\u0d4d\u0d26\u0d28\u0d19\u0d4d\u0d19\u0d7e',event:'Synthetic Achievement Awards',date:'20 November 2026'},template,asset:{path:photoPath,sha256:sha(photo)},logo:{path:logoPath,sha256:sha(logo)},dpi:300};
    const result=await renderRecipient(snapshot,path.join(out,template.id));report.renders.push({templateId:template.id,...result});
    for(let copy=1;copy<=snapshot.recipient.copies;copy++)for(const a of result.artworks)pieces.push({...a,recipientId:snapshot.recipient.id,name,modelCode:template.modelCode,copyNumber:copy});
  }
  report.export=await createPrintPdf({orderId:'SYNTHETIC-RENDER-CHECK',approvalId:'renderer-verification-snapshot-not-customer-approval',revision:1,pieces,profile:{marginMm:10,gapMm:3,media:'photo-paper'},outputPath:path.join(out,'sample-A3-artwork.pdf'),diagnostic:true});
  const pdf=await pdfLib.PDFDocument.load(await fs.readFile(report.export.pdfPath));
  report.pageChecks=pdf.getPages().map((p,i)=>({page:i+1,widthMm:p.getWidth()/MM_TO_PT,heightMm:p.getHeight()/MM_TO_PT}));
  report.completedAt=new Date().toISOString();
  await fs.writeFile(path.join(out,'render-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,output:out,pages:report.export.pageCount,pieces:pieces.length,browser:report.renders[0].renderer.browser,font:report.renders[0].renderer.font,dimensions:report.pageChecks},null,2));
}finally{await closeRenderer();}
