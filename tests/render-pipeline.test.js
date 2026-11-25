import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA} from '../src/config.js';
import {sharp} from '../src/deps.js';
import {renderRecipient,createPrintPdf,closeRenderer,validateSnapshotFields,validateTemplateGeometry,polygonMask,textFont} from '../src/render.js';

const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const name='\u0d05\u0d30\u0d41\u0d7a \u0d15\u0d46.';
test('polygon masks and bundled font choices reject unsafe or ambiguous geometry',()=>{
  assert.equal(polygonMask({type:'polygon',points:[[0,0],[20,0],[10,20]]},20,20).points.length,3);
  assert.throws(()=>polygonMask({type:'svg',path:'<script/>'},20,20),/raw SVG/);
  assert.throws(()=>polygonMask({type:'polygon',points:[[0,0],[30,0],[10,20]]},20,20),/fit inside/);
  assert.throws(()=>polygonMask({type:'polygon',points:[[0,0],[20,20],[20,0],[0,20]]},20,20),/self-intersect/);
  assert.throws(()=>textFont({font:'Arial'},'Name'),/Unsupported font/);
  assert.throws(()=>textFont({font:'latin'},name),/cannot render Malayalam/);
  assert.throws(()=>textFont({fontPath:'/some/font.ttf'},'Name'),/External font/);
  const template={components:[{id:'front',widthMm:40,heightMm:50,nameBox:{x:2,y:35,width:36,height:10,minFontMm:2,maxFontMm:4}}]};
  assert.equal(validateTemplateGeometry(template),template);
  assert.throws(()=>validateTemplateGeometry({...template,components:[{...template.components[0],nameBox:{...template.components[0].nameBox,minFontMm:5,maxFontMm:2}}]}),/font limits/);
});
test('template field scopes and absent geometry cannot silently omit content',()=>{
  const snapshot={recipient:{name},shared:{event:'Annual awards'},template:{components:[{nameBox:{}}]}};
  assert.throws(()=>validateSnapshotFields(snapshot),/no eventBox/);
  snapshot.template.components.push({eventBox:{},dateBox:{},logoBox:{}});
  assert.equal(validateSnapshotFields(snapshot).shared.event,'Annual awards');
  snapshot.template.fields=[{key:'heading',scope:'recipient'}];
  assert.throws(()=>validateSnapshotFields(snapshot),/invalid scope/);
  snapshot.template.fields=[{key:'heading',scope:'shared',required:true}];
  assert.throws(()=>validateSnapshotFields(snapshot),/required by this template/);
  snapshot.template.fields=[{key:'unknown',scope:'shared'}];
  assert.throws(()=>validateSnapshotFields(snapshot),/Unsupported template field/);
  snapshot.template.fields=[{key:'name',scope:'recipient',maxLength:1}];
  snapshot.recipient.name='e\u0301';
  assert.equal(validateSnapshotFields(snapshot).recipient.name,'e\u0301','grapheme limit retains combining marks');
  snapshot.recipient.name='e\u0301x';
  assert.throws(()=>validateSnapshotFields(snapshot),/grapheme limit/);
});

test('canonical browser pipeline preserves crop, EXIF orientation, text fit and immutable source hashes',async()=>{
  await fs.mkdir(path.join(DATA,'tmp'),{recursive:true});
  const dir=await fs.mkdtemp(path.join(DATA,'tmp','render-pipeline-'));
  const source=await sharp({create:{width:200,height:100,channels:3,background:'#ff0000'}})
    .composite([{input:await sharp({create:{width:100,height:100,channels:3,background:'#0000ff'}}).png().toBuffer(),left:100,top:0}]).png().toBuffer();
  const file=path.join(dir,'source.png');await fs.writeFile(file,source);
  const base={recipient:{id:'render-test',name,crop:{x:1,y:0,zoom:1,rotation:0}},shared:{},template:{id:'test-v1',modelCode:'TEST',synthetic:false,components:[{id:'front',widthMm:40,heightMm:50,photo:{x:0,y:0,width:40,height:30,shape:'rect'},nameBox:{x:2,y:35,width:36,height:10,minFontMm:2,maxFontMm:4}}]},asset:{path:file,sha256:sha(source)},dpi:150};
  try{
    const left=await renderRecipient(base,path.join(dir,'left'));
    const right=await renderRecipient({...base,recipient:{...base.recipient,crop:{...base.recipient.crop,x:-1}}},path.join(dir,'right'));
    const pixel=async p=>[...await sharp(p).extract({left:118,top:88,width:1,height:1}).removeAlpha().raw().toBuffer()];
    const lp=await pixel(left.artworks[0].path),rp=await pixel(right.artworks[0].path);
    assert.ok(lp[0]>240&&lp[2]<10,'positive crop X shows the left red region');
    assert.ok(rp[2]>240&&rp[0]<10,'negative crop X shows the right blue region');
    assert.notEqual(left.artworks[0].sha256,right.artworks[0].sha256);
    assert.equal(left.artworks[0].pixelWidth,Math.round(40*150/25.4));
    assert.equal(left.renderer.font,'NotoSansMalayalam.ttf');
    const repeated=await renderRecipient(base,path.join(dir,'repeat'));
    assert.equal(repeated.artworks[0].sha256,left.artworks[0].sha256,'identical snapshots yield identical PNG bytes');
    const masked=await renderRecipient({...base,template:{...base.template,components:[{...base.template.components[0],trimMask:{type:'polygon',points:[[10,0],[40,0],[40,50],[0,50],[0,10]]},photo:{...base.template.components[0].photo,mask:{type:'polygon',points:[[0,0],[40,0],[20,30]]}}}]}},path.join(dir,'masked'));
    const outside=[...await sharp(masked.artworks[0].path).extract({left:2,top:2,width:1,height:1}).ensureAlpha().raw().toBuffer()];
    assert.equal(outside[3],0,'explicit trim polygon creates transparent cutouts');
    assert.equal(masked.artworks[0].trimGeometryStatus,'unverified','a numeric mask never implies physical calibration');
    const noPhoto=[...await sharp(masked.artworks[0].path).extract({left:18,top:140,width:1,height:1}).ensureAlpha().raw().toBuffer()];
    assert.ok(noPhoto[0]>240&&noPhoto[1]>240,'photo polygon clips the source independently of trim');
    await assert.rejects(renderRecipient({...base,recipient:{...base.recipient,name:'A'.repeat(500)}},path.join(dir,'overflow')),/does not fit/);
    await assert.rejects(renderRecipient({...base,asset:{...base.asset,sha256:'wrong'}},path.join(dir,'corrupt')),/hash changed/);
    await assert.rejects(renderRecipient({...base,template:{...base.template,fontHashes:{malayalam:'tampered',latin:'tampered'}}},path.join(dir,'font-changed')),/Template font hash changed/);
    const encoded=await sharp(source).jpeg().withMetadata({orientation:6}).toBuffer();
    const encodedPath=path.join(dir,'oriented.jpg');await fs.writeFile(encodedPath,encoded);
    const normalized=await sharp(encoded).autoOrient().png().toBuffer();
    const normalPath=path.join(dir,'normalized.png');await fs.writeFile(normalPath,normalized);
    const crop={x:0,y:.6,zoom:1.5,rotation:90};
    const a=await renderRecipient({...base,recipient:{...base.recipient,crop},asset:{path:encodedPath,sha256:sha(encoded)}},path.join(dir,'exif'));
    const b=await renderRecipient({...base,recipient:{...base.recipient,crop},asset:{path:normalPath,sha256:sha(normalized)}},path.join(dir,'normal'));
    assert.equal(a.artworks[0].sha256,b.artworks[0].sha256,'EXIF orientation precedes user rotation and crop');
    const controller=new AbortController();controller.abort();
    await assert.rejects(renderRecipient(base,path.join(dir,'cancel'),{signal:controller.signal}),/cancelled/);

    const bleedBackground=await sharp({create:{width:Math.round(44*150/25.4),height:Math.round(54*150/25.4),channels:3,background:'#ffffff'}}).png().toBuffer();
    const bleedPath=path.join(dir,'bleed-background.png');await fs.writeFile(bleedPath,bleedBackground);
    const withBleed={...base,template:{...base.template,components:[{...base.template.components[0],bleedMm:2,bleedPolicy:'provided-background',backgroundIncludesBleed:true,backgroundPath:bleedPath,backgroundSha256:sha(bleedBackground)}]}};
    const bleed=await renderRecipient(withBleed,path.join(dir,'bleed'));
    assert.equal(bleed.artworks[0].includesBleed,true);
    assert.equal(bleed.artworks[0].pixelWidth,Math.round(44*150/25.4));
    const print=await createPrintPdf({approvalId:'bleed-test',orderId:'test',revision:1,pieces:[{...bleed.artworks[0],recipientId:'test',copyNumber:1}],profile:{marginMm:10,gapMm:3},outputPath:path.join(dir,'bleed.pdf')});
    assert.equal(print.manifest.placements[0].footprintWidthMm,44);
    assert.equal(print.manifest.placements[0].widthMm,40);
    await assert.rejects(renderRecipient({...withBleed,template:{...withBleed.template,components:[{...withBleed.template.components[0],backgroundIncludesBleed:false}]}},path.join(dir,'bad-bleed')),/supplied full-bleed background/);
  }finally{await closeRenderer();await fs.rm(dir,{recursive:true,force:true});}
});
