// Read-only image review: no database, approval, crop or original-file mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { sharp } from '../src/deps.js';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'Work 1','Leonardo DiCaprio');
const output=path.join(root,'Work1-Output');
const review=path.join(output,'qa-visual');
await fs.mkdir(review,{recursive:true});
const start=Number(process.argv[2]||1),end=Number(process.argv[3]||100);
const files=(await fs.readdir(path.join(output,'png'))).filter(file=>/^\d{3}_.+\.png$/.test(file)&&Number(file.slice(0,3))>=start&&Number(file.slice(0,3))<=end).sort();
const esc=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const originals=await fs.readdir(source);
const tileWidth=450,tileHeight=290,columns=3;
const sheets=[];
for(let offset=0;offset<files.length;offset+=18){
 const batch=files.slice(offset,offset+18),layers=[];
 for(const [index,file] of batch.entries()){
  const base=path.parse(file).name,original=originals.find(candidate=>path.parse(candidate).name===base);
  if(!original)throw new Error('Missing source for '+file);
  const left=(index%columns)*tileWidth,top=Math.floor(index/columns)*tileHeight;
  const sourceThumb=await sharp(path.join(source,original)).autoOrient().resize(205,220,{fit:'contain',background:'#eeeeee'}).jpeg({quality:94}).toBuffer();
  const portrait=await sharp(path.join(output,'png',file)).extract({left:1040,top:1430,width:880,height:880}).resize(205,205).jpeg({quality:94}).toBuffer();
  const printedName=await sharp(path.join(output,'png',file)).extract({left:650,top:2400,width:1653,height:190}).resize(414,48).jpeg({quality:96}).toBuffer();
  const label=Buffer.from(`<svg width="450" height="24"><rect width="100%" height="100%" fill="white"/><text x="12" y="17" font-family="sans-serif" font-size="14" fill="#172b31">${esc(base)} | original / rendered portrait</text></svg>`);
  layers.push({input:label,left,top},{input:sourceThumb,left:left+10,top:top+25},{input:portrait,left:left+230,top:top+25},{input:printedName,left:left+18,top:top+242});
 }
 const name=`pairs-${batch[0].slice(0,3)}-${batch.at(-1).slice(0,3)}.jpg`;
 await sharp({create:{width:columns*tileWidth,height:Math.ceil(batch.length/columns)*tileHeight,channels:3,background:'#ffffff'}}).composite(layers).jpeg({quality:95}).toFile(path.join(review,name));
 sheets.push({file:name,entries:batch.length,first:batch[0],last:batch.at(-1)});
}
await fs.writeFile(path.join(review,`overview-${start}-${end}.json`),JSON.stringify({createdAt:new Date().toISOString(),purpose:'Local face/crop/filename comparison only; no approval or print certification',sourceFileCount:originals.length,renderedEntries:files.length,sheets},null,2));
console.log(JSON.stringify({renderedEntries:files.length,sheets}));
