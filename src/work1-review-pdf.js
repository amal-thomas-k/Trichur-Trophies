// Memory-bounded, lossless A3 review PDF writer. Canonical opaque PNG pixels are
// embedded using PNG's lossless predictor/deflate streams. Nothing is rescaled.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { sharp } from './deps.js';

const pt = 72/25.4;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pdfString = value => String(value).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');

function rgbPngData(bytes) {
  if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Expected a valid PNG.');
  let width, height, chunks=[];
  for(let at=8;at<bytes.length;) {
    const length=bytes.readUInt32BE(at), type=bytes.subarray(at+4,at+8).toString('ascii');
    const data=bytes.subarray(at+8,at+8+length);
    if(type==='IHDR') {width=data.readUInt32BE(0);height=data.readUInt32BE(4);if(data[8]!==8||data[9]!==2||data[12]!==0)throw new Error('PDF embedding requires non-interlaced 8-bit RGB PNG.');}
    if(type==='IDAT')chunks.push(data);
    at+=length+12;if(type==='IEND')break;
  }
  if(!width||!height||!chunks.length)throw new Error('Incomplete PNG image stream.');
  return{width,height,data:Buffer.concat(chunks)};
}

export async function writeWork1ReviewPdf(entries, outputPath, { onProgress, expectedCount=100 }={}) {
  if(entries.length!==expectedCount || !Number.isInteger(expectedCount) || expectedCount<1 || expectedCount>100)throw new Error(`Work1 review PDF requires exactly ${expectedCount} canonical designs.`);
  const temp=outputPath+'.part', file=await fs.open(temp,'w');
  const offsets=[],placements=[];let position=0;
  async function write(value) {
    const bytes=Buffer.isBuffer(value)?value:Buffer.from(value,'binary');
    let at=0;while(at<bytes.length){const result=await file.write(bytes,at,bytes.length-at,position);if(!result.bytesWritten)throw new Error('Could not finish writing the PDF.');at+=result.bytesWritten;position+=result.bytesWritten;}
  }
  async function object(number,contents){offsets[number]=position;await write(`${number} 0 obj\n${contents}\nendobj\n`);}
  async function stream(number,dictionary,bytes){offsets[number]=position;await write(`${number} 0 obj\n<< ${dictionary} /Length ${bytes.length} >>\nstream\n`);await write(bytes);await write('\nendstream\nendobj\n');}
  try {
    await write('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
    await object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    await object(2,`<< /Type /Pages /Count ${entries.length} /Kids [${entries.map((_,i)=>`${4+i*3} 0 R`).join(' ')}] >>`);
    await object(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    for(const [i,entry] of entries.entries()) {
      const canonical=await fs.readFile(entry.canonicalPath);
      if(sha(canonical)!==entry.artworkSha256)throw new Error('Canonical artwork hash changed during PDF generation.');
      const metadata=await sharp(canonical).metadata();
      if(metadata.width!==2953||metadata.height!==2953)throw new Error('Unexpected canonical Work1 pixel dimensions.');
      if(metadata.hasAlpha){const stats=await sharp(canonical).stats();if(stats.channels.at(-1).min!==255)throw new Error('Work1 review PDF requires opaque artwork; transparent pixels cannot be silently flattened.');}
      const rgb=await sharp(canonical).toColourspace('srgb').removeAlpha().png({palette:false,progressive:false,compressionLevel:6}).toBuffer();
      const image=rgbPngData(rgb), page=4+i*3, content=page+1, imageId=page+2;
      const x=(297-entry.widthMm)/2, y=40;
      if(x<10||y+entry.heightMm>410)throw new Error('Work1 artwork exceeds A3 printable area.');
      await object(page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${297*pt} ${420*pt}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${content} 0 R >>`);
      const commands=`q\n${entry.widthMm*pt} 0 0 ${entry.heightMm*pt} ${x*pt} ${(420-y-entry.heightMm)*pt} cm\n/Im0 Do\nQ\nBT /F1 10 Tf 0.15 0.2 0.25 rg 1 0 0 1 ${15*pt} ${400*pt} Tm (${pdfString(`UNAPPROVED PROOF - UNCALIBRATED | ${i+1}/${entries.length} | ${entry.name}`)}) Tj ET\nBT /F1 9 Tf 1 0 0 1 ${15*pt} ${393*pt} Tm (Print Actual Size / 100%. Artwork 250.020667 mm square. Check physical fit.) Tj ET\n`;
      await stream(content,'',Buffer.from(commands,'ascii'));
      await stream(imageId,`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${image.width} >>`,image.data);
      placements.push({page:i+1,name:entry.name,recipientId:entry.recipientId,xMm:x,yMm:y,widthMm:entry.widthMm,heightMm:entry.heightMm,pixelWidth:image.width,pixelHeight:image.height,artworkSha256:entry.artworkSha256,embeddedLosslessStreamSha256:sha(image.data),pdfImageObject:imageId});
      await onProgress?.(i+1,entries.length);
    }
    const info=4+entries.length*3;
    await object(info,`<< /Title (Work1 - ${entries.length} unapproved Carving design proofs) /Subject (Exact A3 - lossless sRGB artwork - physical fit unverified) /Producer (Trichur Trophies local streaming review PDF v1) >>`);
    const xref=position;
    await write(`xref\n0 ${info+1}\n0000000000 65535 f \n`);
    for(let id=1;id<=info;id++){if(!Number.isSafeInteger(offsets[id])||offsets[id]>9999999999)throw new Error('Invalid PDF object offset.');await write(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);}
    await write(`trailer\n<< /Size ${info+1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    await file.sync();await file.close();await fs.rename(temp,outputPath);
    return{placements,pdfBytes:position,pageCount:entries.length,pageMm:[297,420],encoding:'lossless RGB PNG predictor streams; no downsampling',objectOffsets:offsets};
  } catch(error){await file.close().catch(()=>{});await fs.rm(temp,{force:true}).catch(()=>{});throw error;}
}
