import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {packPieces,validatePlacements,normalizeProfile,MM_TO_PT} from '../src/packing.js';
import {createCalibrationPdf,fontConfiguration,createPrintPdf} from '../src/render.js';
import {pdfLib,sharp} from '../src/deps.js';
import {DATA} from '../src/config.js';

test('A3 size is fixed; landscape swaps exact millimetres',()=>{
  assert.equal(normalizeProfile({widthMm:99}).widthMm,297);
  assert.equal(normalizeProfile({orientation:'landscape'}).heightMm,297);
  assert.throws(()=>normalizeProfile({colorSpace:'CMYK'}),/sRGB print workflow/);
  assert.throws(()=>normalizeProfile({orientation:'sideways'}),/orientation/);
});
test('500 mixed recipients pack deterministically with exact coverage and gaps',()=>{
  const pieces=Array.from({length:500},(_,i)=>({recipientId:`r${i}`,componentId:'front',widthMm:i%2?85:34,heightMm:i%2?156:34,allowRotation:true}));
  const first=packPieces(pieces,{marginMm:10,gapMm:3});
  assert.deepEqual(first,packPieces(pieces,{marginMm:10,gapMm:3}));
  assert.equal(first.placements.length,500);
  assert.equal(validatePlacements(first,500),true);
});
test('oversized artwork never shrinks, incompatible media fail',()=>{
  assert.throws(()=>packPieces([{widthMm:350,heightMm:450}]),/Oversized/);
  assert.throws(()=>packPieces([{widthMm:20,heightMm:20,media:'vinyl'}],{media:'photo-paper'}),/Incompatible/);
});
test('rotation permitted only by component policy',()=>{
  assert.throws(()=>packPieces([{widthMm:350,heightMm:46,allowRotation:false}]),/Oversized/);
  assert.equal(packPieces([{widthMm:350,heightMm:46,allowRotation:true}]).placements[0].rotation,90);
});
test('bleed contributes to footprint and overlap checks reject bad placement',()=>{
  const packed=packPieces([{widthMm:40,heightMm:60,bleedMm:2},{widthMm:40,heightMm:60,bleedMm:2}]);
  assert.equal(packed.placements[0].footprintWidthMm,44);
  packed.placements[1].xMm=packed.placements[0].xMm;
  packed.placements[1].yMm=packed.placements[0].yMm;
  assert.throws(()=>validatePlacements(packed),/overlap/);
});
test('calibration PDF has exact A3 MediaBox',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tt-render-'));
  const file=path.join(dir,'calibration.pdf');
  await createCalibrationPdf(file);
  const doc=await pdfLib.PDFDocument.load(await fs.readFile(file));
  const page=doc.getPages()[0];
  assert.ok(Math.abs(page.getWidth()/MM_TO_PT-297)<1e-8);
  assert.ok(Math.abs(page.getHeight()/MM_TO_PT-420)<1e-8);
  await fs.rm(dir,{recursive:true,force:true});
});
test('bundled licensed Malayalam font loads and explicit missing font fails closed',async()=>{
  const config=await fontConfiguration();assert.equal(config.redistributable,true);assert.equal(config.sha256.length,64);
  const previous=process.env.MALAYALAM_FONT_PATH;process.env.MALAYALAM_FONT_PATH='/missing-font-file.ttf';
  try{await assert.rejects(fontConfiguration(),/font is missing/);}finally{if(previous===undefined)delete process.env.MALAYALAM_FONT_PATH;else process.env.MALAYALAM_FONT_PATH=previous;}
});
test('PDF export rejects changed canonical artwork hash',async()=>{
  await fs.mkdir(path.join(DATA,'tmp'),{recursive:true});
  const dir=await fs.mkdtemp(path.join(DATA,'tmp','render-test-hash-'));
  const file=path.join(dir,'photo.png');await sharp({create:{width:10,height:10,channels:3,background:'#ffffff'}}).png().toFile(file);
  await assert.rejects(createPrintPdf({approvalId:'approval-test',orderId:'o',revision:1,pieces:[{path:file,sha256:'wrong',widthMm:20,heightMm:20}],outputPath:path.join(dir,'out.pdf')}),/hash mismatch/);
  await fs.rm(dir,{recursive:true,force:true});
});
