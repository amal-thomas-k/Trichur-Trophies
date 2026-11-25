import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import { sharp } from './deps.js';
import { DATA,ROOT } from './config.js';
import { resolveStoredPath } from './storage-path.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function templateThumbnail(template){
 const key=createHash('sha256').update(JSON.stringify(template)).digest('hex');
 const destination=path.join(DATA,'template-thumbnails',`${key}.png`);
 try{await fs.access(destination);return destination;}catch{}
 const component=template.components[0],scale=Math.min(240/component.widthMm,320/component.heightMm),width=Math.max(1,Math.round(component.widthMm*scale)),height=Math.max(1,Math.round(component.heightMm*scale));
 let source;
 if(component.backgroundPath){const candidate=path.resolve(ROOT,component.backgroundPath),safe=path.join(ROOT,'private','prepared-assets')+path.sep;const bytes=await fs.readFile(candidate.startsWith(safe)?candidate:resolveStoredPath(component.backgroundPath));if(component.backgroundSha256&&createHash('sha256').update(bytes).digest('hex')!==component.backgroundSha256)throw new Error('Prepared template artwork changed. Publish a new version.');source=await sharp(bytes,{limitInputPixels:50000000}).resize(width,height,{fit:'fill'}).png().toBuffer();}
 else source=await sharp({create:{width,height,channels:4,background:component.backgroundColor||'#fffaf0'}}).png().toBuffer();
 // Geometry preview uses no original/sample customer identity and is never an approval proof.
 const photo=component.photo,box=component.nameBox;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${photo?`<rect x="${photo.x*scale}" y="${photo.y*scale}" width="${photo.width*scale}" height="${photo.height*scale}" rx="${photo.shape==='circle'?Math.min(photo.width,photo.height)*scale/2:0}" fill="#b7ccc8"/><text x="${(photo.x+photo.width/2)*scale}" y="${(photo.y+photo.height/2)*scale}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#163840">Photo</text>`:''}${box?`<text x="${(box.x+box.width/2)*scale}" y="${(box.y+box.height/2)*scale}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#163840">${esc(template.modelCode)}</text>`:''}</svg>`;
 const result=await sharp(source).composite([{input:Buffer.from(svg)}]).png().toBuffer();await fs.mkdir(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID()+'.tmp';await fs.writeFile(temporary,result);await fs.rename(temporary,destination);return destination;
}
