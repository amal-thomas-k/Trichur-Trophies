import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './config.js';
import { resolveStoredPath } from './storage-path.js';

// Called only when publishing a NEW immutable version. Never updates old rows.
export function sealTemplate(template){
 const sealed=structuredClone(template);
 for(const c of sealed.components){
  for(const kind of ['background','foreground']){
   const file=c[`${kind}Path`];if(!file)continue;
   const local=path.resolve(ROOT,file);
   const allowed=path.join(ROOT,'private','prepared-assets')+path.sep;
   const resolved=local.startsWith(allowed)?local:resolveStoredPath(file);
   if(!fs.statSync(resolved).isFile())throw new Error('Prepared template asset is unavailable.');
   c[`${kind}Sha256`]=createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  }
 }
 sealed.assetPolicy='sha256-pinned-v1';
 sealed.fontHashes={
  malayalam:createHash('sha256').update(fs.readFileSync(path.join(ROOT,'src','fonts','NotoSansMalayalam.ttf'))).digest('hex'),
  latin:createHash('sha256').update(fs.readFileSync(path.join(ROOT,'src','fonts','LiberationSans-Regular.ttf'))).digest('hex'),
 };
 return sealed;
}
