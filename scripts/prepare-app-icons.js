// Local geometric T monogram matches the app's existing brand mark.
// No external images, proprietary font, image service or customer data are used.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharp } from '../src/deps.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'public','icons');
const source=await fs.readFile(path.join(directory,'app-icon.svg'));
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180]]){
  await sharp(source,{density:192}).resize(size,size).png().toFile(path.join(directory,name));
}
console.log('Prepared 192px, 512px, maskable and 180px app icons locally.');
