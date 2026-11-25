import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp, playwright, pdfLib } from './deps.js';
import { packPieces, MM_TO_PT } from './packing.js';
import { resolveStoredPath } from './storage-path.js';

const { chromium } = playwright;
const { PDFDocument, rgb, degrees, StandardFonts } = pdfLib;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER_VERSION = 'tt-canonical-3';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
let browserPromise;

export async function getBrowser() {
  if (!browserPromise) browserPromise = (async () => {
    const bundled = chromium.executablePath();
    const localChrome = process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined;
    const executablePath = process.env.CHROMIUM_PATH || (existsSync(bundled) ? bundled : localChrome);
    if (!executablePath || !existsSync(executablePath)) throw new Error('Chromium is missing. Install the pinned Playwright Chromium browser or set CHROMIUM_PATH.');
    const offline=process.env.TT_OFFLINE_RENDERING==='1';
    return chromium.launch({ executablePath, headless:true, args:['--disable-dev-shm-usage','--no-sandbox',
      ...(offline?['--disable-background-networking','--disable-component-update','--disable-sync','--disable-domain-reliability','--no-first-run',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
        '--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=localhost;127.0.0.1;[::1]']:[])] });
  })().catch(error => { browserPromise=undefined; throw error; });
  return browserPromise;
}

export async function closeRenderer() {
  if (browserPromise) { const browser = await browserPromise; browserPromise=undefined; await browser.close(); }
}

export async function fontConfiguration() {
  const candidates = [process.env.MALAYALAM_FONT_PATH, path.join(ROOT,'src','fonts','NotoSansMalayalam-Regular.ttf'), path.join(ROOT,'src','fonts','NotoSansMalayalam.ttf')].filter(Boolean);
  let file = candidates.find(existsSync);
  if (process.env.MALAYALAM_FONT_PATH && !existsSync(process.env.MALAYALAM_FONT_PATH)) throw new Error('Configured Malayalam font is missing; rendering stopped to prevent silent substitution.');
  if (file) {
    const bytes = await fs.readFile(file);
    const latinFile=path.join(ROOT,'src','fonts','LiberationSans-Regular.ttf');
    if (!existsSync(latinFile)) throw new Error('Bundled Latin font is missing; rendering stopped to prevent silent substitution.');
    const latin=await fs.readFile(latinFile);
    return { css:`@font-face{font-family:TTMalayalam;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format('truetype');font-weight:100 900;font-display:block}@font-face{font-family:TTLatin;src:url(data:font/ttf;base64,${latin.toString('base64')}) format('truetype');font-display:block}`,family:'TTMalayalam,TTLatin',sha256:hash(bytes),latinSha256:hash(latin),source:path.basename(file),redistributable:true };
  }
  throw new Error('A licensed Malayalam font is required. Place NotoSansMalayalam-Regular.ttf with its OFL license in src/fonts or set MALAYALAM_FONT_PATH. Rendering cannot silently substitute fonts.');
}

function inputPath(file) {
  const absolute=path.resolve(ROOT,file);
  // Prepared reference masters and the local verification harness are trusted
  // workspace inputs. Order assets always resolve through private storage.
  for(const allowed of [path.join(ROOT,'private','prepared-assets'),path.join(ROOT,'samples')])if(absolute.startsWith(allowed+path.sep))return absolute;
  return resolveStoredPath(file);
}

function safeColor(color, fallback) { return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color||'') ? color : fallback; }
function boxStyle(box, scale) { return `left:${box.x*scale}px;top:${box.y*scale}px;width:${box.width*scale}px;height:${box.height*scale}px;`; }
function normalizedBox(box, defaults) { return {...defaults,...box}; }

export function polygonMask(mask,width,height,label='Mask'){
  if(!mask)return null;
  if(mask.type!=='polygon'||!Array.isArray(mask.points)||mask.points.length<3||mask.points.length>128)throw new Error(`${label} must be a polygon with 3-128 explicit numeric points; raw SVG and remote mask URLs are unsupported`);
  let points=mask.points.map(p=>{
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>width||p[1]>height)throw new Error(`${label} points must fit inside the declared millimetre rectangle`);
    return[p[0],p[1]];
  });
  if(points.length>3&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points=points.slice(0,-1);
  if(new Set(points.map(p=>p.join(','))).size!==points.length)throw new Error(`${label} contains duplicate points`);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const between=(a,b,c)=>Math.abs(cross(a,b,c))<1e-9&&c[0]>=Math.min(a[0],b[0])-1e-9&&c[0]<=Math.max(a[0],b[0])+1e-9&&c[1]>=Math.min(a[1],b[1])-1e-9&&c[1]<=Math.max(a[1],b[1])+1e-9;
  const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||between(a,b,c)||between(a,b,d)||between(c,d,a)||between(c,d,b);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    if(j===i+1||i===0&&j===points.length-1)continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))throw new Error(`${label} cannot self-intersect`);
  }
  const area=points.reduce((sum,p,i)=>sum+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0)/2;
  if(Math.abs(area)<.001)throw new Error(`${label} has no usable area`);
  return{type:'polygon',points,css:`polygon(${points.map(([x,y])=>`${x/width*100}% ${y/height*100}%`).join(',')})`};
}

export function textFont(box,text,component={},template={}){
  for(const object of [box,component,template])if(object&&(object.fontPath||object.fontUrl||object.fontAsset||object.fontAssetId))throw new Error('External font assets are unsupported; select bundled malayalam or latin');
  const selection=box.font??box.fontFamily??component.font??component.fontFamily??template.font??template.fontFamily??'malayalam';
  const families={malayalam:'TTMalayalam,TTLatin',latin:'TTLatin','Noto Sans Malayalam':'TTMalayalam,TTLatin','Liberation Sans':'TTLatin',TTMalayalam:'TTMalayalam,TTLatin',TTLatin:'TTLatin'};
  const selected=families[selection];
  if(!selected)throw new Error(`Unsupported font selection: ${selection}. Select bundled malayalam or latin; no silent substitution is allowed`);
  if(selected==='TTLatin'&&/[\u0d00-\u0d7f]/u.test(String(text)))throw new Error('Latin-only font cannot render Malayalam; select the bundled malayalam font');
  return selected;
}

const FIELD_RULES={
  name:{scope:'recipient',box:'nameBox',label:'Recipient name'},
  achievement:{scope:'recipient',box:'achievementBox',label:'Achievement'},
  heading:{scope:'shared',box:'headingBox',label:'Shared heading'},
  event:{scope:'shared',box:'eventBox',label:'Event'},
  date:{scope:'shared',box:'dateBox',label:'Date'},
  logoAssetId:{scope:'shared',box:'logoBox',label:'Logo'},
  photo:{scope:'recipient',box:'photo',label:'Photograph'},
};

/** Pure schema/geometry gate used before publishing an immutable template. */
export function validateTemplateGeometry(template){
  if(!template||!Array.isArray(template.components)||template.components.length<1||template.components.length>10)throw new Error('Template needs 1-10 components');
  if(template.fields!==undefined&&!Array.isArray(template.fields))throw new Error('Template fields must be an array');
  const keys=new Set();
  for(const field of template.fields||[]){
    const rule=FIELD_RULES[field.key];
    if(!rule)throw new Error(`Unsupported template field: ${field.key}`);
    if(keys.has(field.key))throw new Error(`Duplicate template field: ${field.key}`);
    keys.add(field.key);
    if(field.scope!==rule.scope)throw new Error(`${rule.label} has invalid scope; expected ${rule.scope}`);
    if(field.required!==undefined&&typeof field.required!=='boolean')throw new Error(`${rule.label} required flag must be boolean`);
    if(field.maxLength!==undefined&&(!Number.isSafeInteger(field.maxLength)||field.maxLength<1||field.maxLength>10000))throw new Error(`${rule.label} maximum length must be an integer from 1 to 10000`);
    if(field.defaultText!==undefined&&typeof field.defaultText!=='string')throw new Error(`${rule.label} defaultText must be a string`);
    if(field.defaultText&&['photo','logoAssetId'].includes(field.key))throw new Error('Image fields cannot use text defaults');
    if(!template.components.some(c=>c[rule.box]))throw new Error(`${rule.label} is declared without matching ${rule.box} geometry`);
  }
  const ids=new Set();
  for(const c of template.components){
    if(!/^[a-zA-Z0-9_-]+$/.test(c.id||'')||ids.has(c.id))throw new Error('Components need unique safe IDs');
    ids.add(c.id);
    if(![c.widthMm,c.heightMm].every(v=>Number.isFinite(v)&&v>0&&v<=500))throw new Error('Component dimensions must be finite millimetres greater than 0 and at most 500');
    const bleed=Number(c.bleedMm??0),safe=Number(c.safeZoneMm??0);
    if(!Number.isFinite(bleed)||bleed<0||bleed>20)throw new Error('Bleed must be from 0 to 20 mm');
    if(!Number.isFinite(safe)||safe<0||safe*2>=Math.min(c.widthMm,c.heightMm))throw new Error('Safe zone must leave a usable component area');
    if(c.allowRotation!==undefined&&typeof c.allowRotation!=='boolean')throw new Error('Rotation permission must be boolean');
    for(const key of ['textColor','accent','backgroundColor'])if(c[key]!==undefined&&!(key==='backgroundColor'&&c[key]==='transparent')&&!safeColor(c[key],null))throw new Error(`${key} must be a hexadecimal colour; only backgrounds may use transparent`);
    textFont({},'',c,template);
    for(const key of ['photo','logoBox','nameBox','headingBox','eventBox','dateBox','achievementBox']){
      const b=c[key];if(!b)continue;
      if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>c.widthMm+.0001||b.y+b.height>c.heightMm+.0001)throw new Error(`${key} must have positive finite geometry within its trim rectangle`);
      if(key==='photo'){
        if(b.shape&&!['circle','rounded','rect','rectangle'].includes(b.shape))throw new Error('Photo shape must be circle, rounded or rect; use an explicit polygon mask for other shapes');
        polygonMask(b.mask,b.width,b.height,'Photo mask');
      }else if(key!=='logoBox'){
        const minimum=b.minFontMm??(key==='nameBox'?3:2),maximum=b.maxFontMm??6;
        if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<1||maximum<minimum||maximum>40)throw new Error(`${key} font limits must be finite millimetres, minimum >=1 and maximum >= minimum, up to 40`);
        if(b.align&&!['left','center','right'].includes(b.align))throw new Error(`${key} alignment must be left, center or right`);
        if(b.x<safe-.0001||b.y<safe-.0001||b.x+b.width>c.widthMm-safe+.0001||b.y+b.height>c.heightMm-safe+.0001)throw new Error(`${key} crosses the declared safe zone`);
        textFont(b,'',c,template);
        if(b.curve)throw new Error('Editable curved text has not passed the Malayalam reader gate; supply a fixed asset');
      }
    }
    if(c.curvedHeading)throw new Error('Editable curved text has not passed the Malayalam reader gate; supply a fixed asset');
    const trim=polygonMask(c.trimMask,c.widthMm,c.heightMm,'Trim mask');
    polygonMask(c.bleedMask,c.widthMm+2*bleed,c.heightMm+2*bleed,'Bleed mask');
    if(trim&&bleed>0&&!c.bleedMask)throw new Error('A shaped insert with bleed requires an explicit full-footprint bleedMask');
    if(bleed>0&&(c.bleedPolicy!=='provided-background'||c.backgroundIncludesBleed!==true||!c.backgroundPath))throw new Error('Nonzero bleed requires an explicitly supplied full-bleed background');
  }
  if(!template.components.some(c=>c.nameBox))throw new Error('At least one component must print the recipient name');
  return template;
}
/** Field omissions are hard errors. A field may appear on any paired component. */
export function validateSnapshotFields(snapshot){
  const template=snapshot.template, recipient={...snapshot.recipient}, shared={...snapshot.shared};
  if(!template?.components?.length)throw new Error('Template components are required');
  const seen=new Set();
  for(const field of template.fields||[]){
    const rule=FIELD_RULES[field.key];
    if(!rule)throw new Error(`Unsupported template field: ${field.key}. Supported fields must have a defined recipient/shared scope and printable geometry.`);
    if(seen.has(field.key))throw new Error(`Duplicate template field: ${field.key}`);
    seen.add(field.key);
    if(field.scope!==rule.scope)throw new Error(`${rule.label} has invalid scope; expected ${rule.scope}`);
    const source=rule.scope==='recipient'?recipient:shared;
    if(source[field.key]===undefined && field.defaultText!==undefined && !['photo','logoAssetId'].includes(field.key))source[field.key]=String(field.defaultText);
    const value=field.key==='photo'?snapshot.asset?.path:field.key==='logoAssetId'?snapshot.logo?.path:source[field.key];
    if(field.required&&!String(value??'').trim())throw new Error(`${field.label||rule.label} is required by this template version`);
    if(field.maxLength!==undefined){
      if(!Number.isSafeInteger(field.maxLength)||field.maxLength<1)throw new Error(`${rule.label} has an invalid maximum length`);
      if([...new Intl.Segmenter('ml',{granularity:'grapheme'}).segment(String(value??''))].length>field.maxLength)throw new Error(`${field.label||rule.label} exceeds this template's ${field.maxLength} grapheme limit; no text was truncated`);
    }
  }
  if(!String(recipient.name??'').trim())throw new Error('Recipient name is required');
  for(const [key,rule] of Object.entries(FIELD_RULES)){
    const value=key==='photo'?snapshot.asset?.path:key==='logoAssetId'?(snapshot.logo?.path||shared.logoAssetId):(rule.scope==='recipient'?recipient[key]:shared[key]);
    if(String(value??'').trim()&&!template.components.some(c=>!!c[rule.box]))throw new Error(`${rule.label} has content but this template version has no ${rule.box}. Staff must publish a corrected template; content cannot be omitted.`);
  }
  if(shared.logoAssetId&&!snapshot.logo?.path)throw new Error('Shared logo asset is missing');
  if(template.components.some(c=>c.photo)&&!snapshot.asset?.path)throw new Error('Recipient photograph is required');
  return{recipient,shared};
}

async function photoHtml(asset, crop, box, scale) {
  if (!asset?.path || !box) return {html:'',effectiveDpi:null};
  const bytes = await fs.readFile(inputPath(asset.path));
  if (asset.sha256 && hash(bytes) !== asset.sha256) throw new Error('Source photo hash changed; proof cannot be produced');
  const rotation = Number(crop?.rotation || 0);
  if (![0,90,180,270].includes(rotation)) throw new Error('Photo rotation must be 0, 90, 180 or 270 degrees');
  if(![crop?.x??0,crop?.y??0].every(n=>Number.isFinite(n)&&n>=-1&&n<=1)||!Number.isFinite(crop?.zoom??1)||(crop?.zoom??1)<1||(crop?.zoom??1)>4)throw new Error('Photo crop must use X/Y from -1 to 1 and zoom from 1 to 4');
  const result = await sharp(bytes, {limitInputPixels:60_000_000}).autoOrient().rotate(rotation).png().toBuffer({resolveWithObject:true});
  const zoom=clamp(crop?.zoom ?? 1,1,4);
  const cover=Math.max(box.width*scale/result.info.width,box.height*scale/result.info.height)*zoom;
  const w=result.info.width*cover,h=result.info.height*cover;
  const x=(box.width*scale-w)/2+clamp(crop?.x,-1,1)*(w-box.width*scale)/2;
  const y=(box.height*scale-h)/2+clamp(crop?.y,-1,1)*(h-box.height*scale)/2;
  const radius=box.shape==='circle'?'50%':box.shape==='rounded'?'8%':'0';
  const mask=polygonMask(box.mask,box.width,box.height,'Photo mask');
  return {html:`<div class="photo" style="${boxStyle(box,scale)}border-radius:${radius};${mask?'clip-path:'+mask.css:''}"><img alt="" src="data:image/png;base64,${result.data.toString('base64')}" style="position:absolute;width:${w}px;height:${h}px;left:${x}px;top:${y}px"></div>`,effectiveDpi:25.4*scale/cover};
}

async function optionalImage(file,expectedHash) {
  if (!file) return {html:'',sha256:null,metadata:null};
  if (/^https?:/i.test(file)) throw new Error('Remote template assets are not permitted');
  const bytes=await fs.readFile(inputPath(file)),sha256=hash(bytes);
  if(expectedHash&&expectedHash!==sha256)throw new Error('Template layer hash changed; publish a new template version instead of replacing its asset');
  const decoded = await sharp(bytes,{limitInputPixels:60_000_000}).png().toBuffer({resolveWithObject:true});
  return {html:`<img alt="" class="fixed-layer" src="data:image/png;base64,${decoded.data.toString('base64')}">`,sha256,metadata:decoded.info};
}

async function logoHtml(logo,box,scale){
  if(!logo?.path||!box)return '';
  const bytes=await fs.readFile(inputPath(logo.path));
  if(logo.sha256 && hash(bytes)!==logo.sha256)throw new Error('Shared logo hash changed; proof cannot be produced');
  const png=await sharp(bytes,{limitInputPixels:60_000_000}).autoOrient().png().toBuffer();
  return `<img alt="" src="data:image/png;base64,${png.toString('base64')}" style="position:absolute;${boxStyle(box,scale)}object-fit:contain">`;
}

export async function renderRecipient(snapshot, outputDir, {signal,onProgress}={}) {
  if(signal?.aborted)throw new Error('Proof cancelled before rendering');
  const template=snapshot.template;
  validateTemplateGeometry(template);
  const{recipient,shared}=validateSnapshotFields(snapshot);
  if (!recipient?.id || !template?.components?.length) throw new Error('Recipient and versioned template components are required');
  if (!String(recipient.name||'').trim()) throw new Error('Recipient name is required');
  if (!snapshot.asset?.path && template.components.some(c=>c.photo)) throw new Error('Recipient photograph is required');
  const font=await fontConfiguration();
  if(template.fontHashes&&(template.fontHashes.malayalam!==font.sha256||template.fontHashes.latin!==font.latinSha256))throw new Error('Template font hash changed; publish a new template version with the reviewed font assets instead of silently substituting fonts');
  const browser=await getBrowser();
  const dpi=Number(snapshot.dpi || 300);
  if (![150,300,600].includes(dpi)) throw new Error('Render DPI must be 150, 300 or 600');
  const scale=dpi/25.4;
  await fs.mkdir(outputDir,{recursive:true});
  const artworks=[], warnings=[];
  if (!font.redistributable) warnings.push('System-licensed Nirmala UI font used locally. Bundle a licensed Unicode Malayalam font before deployment.');
  const context=await browser.newContext({deviceScaleFactor:1});
  const abort=()=>{context.close().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  await context.route('**/*', route=>route.request().url().startsWith('data:') ? route.continue() : route.abort());
  try {
    for (const component of template.components) {
      if(signal?.aborted)throw new Error('Proof cancelled');
      if(component.curvedHeading || component.headingBox?.curve || component.nameBox?.curve)throw new Error('Editable curved text is not approved for production. Supply a staff-approved fixed heading asset.');
      const widthMm=Number(component.widthMm),heightMm=Number(component.heightMm);
      if (!(widthMm>0&&heightMm>0&&widthMm<=500&&heightMm<=500)) throw new Error('Invalid physical component dimensions');
      const bleedMm=Number(component.bleedMm||0);
      if(!Number.isFinite(bleedMm)||bleedMm<0||bleedMm>20)throw new Error('Bleed must be between 0 and 20 mm');
      if(bleedMm>0&&(component.bleedPolicy!=='provided-background'||component.backgroundIncludesBleed!==true||!component.backgroundPath))throw new Error('Non-zero bleed requires bleedPolicy provided-background, backgroundIncludesBleed true and an approved full-bleed background asset; unknown edges are never fabricated');
      const trimPixelWidth=Math.round(widthMm*scale),trimPixelHeight=Math.round(heightMm*scale);
      const pixelWidth=Math.round((widthMm+2*bleedMm)*scale), pixelHeight=Math.round((heightMm+2*bleedMm)*scale);
      const trimMask=polygonMask(component.trimMask,widthMm,heightMm,'Trim mask');
      if(trimMask&&bleedMm>0&&!component.bleedMask)throw new Error('A shaped insert with bleed requires an explicit full-footprint bleedMask; the renderer will not infer an expanded cut path');
      const bleedMask=polygonMask(component.bleedMask,widthMm+2*bleedMm,heightMm+2*bleedMm,'Bleed mask');
      const artworkMask=bleedMm>0?bleedMask:trimMask;
      const textColor=safeColor(component.textColor,'#172b31');
      const accent=safeColor(component.accent,'#a47b25');
      const bg=component.backgroundColor==='transparent'?'transparent':safeColor(component.backgroundColor,'#fffaf0');
      const nameBox=component.nameBox&&normalizedBox(component.nameBox,{minFontMm:3,maxFontMm:6,align:'center'});
      const headingBox=component.headingBox && normalizedBox(component.headingBox,{minFontMm:2.5,maxFontMm:4.3,align:'center'});
      const achievementBox=component.achievementBox && normalizedBox(component.achievementBox,{minFontMm:2,maxFontMm:3.1,align:'center'});
      const eventBox=component.eventBox && normalizedBox(component.eventBox,{minFontMm:2,maxFontMm:3,align:'center'});
      const dateBox=component.dateBox && normalizedBox(component.dateBox,{minFontMm:2,maxFontMm:3,align:'center'});
      const photo=await photoHtml(snapshot.asset,recipient.crop,component.photo,scale);
      if(photo.effectiveDpi && photo.effectiveDpi<200) warnings.push(`${component.name||component.id}: photograph effective resolution ${Math.round(photo.effectiveDpi)} DPI; inspect print quality.`);
      const field=(label,text,box)=>box?`<div class="fit" data-field="${esc(label)}" data-min="${Number(box.minFontMm)*scale}" data-max="${Number(box.maxFontMm)*scale}" style="${boxStyle(box,scale)}font-family:${textFont(box,text,component,template)};text-align:${box.align==='left'?'left':box.align==='right'?'right':'center'}"><span>${esc(text)}</span></div>`:'';
      const fixedBackground=await optionalImage(component.backgroundPath,component.backgroundSha256);
      const fixedForeground=await optionalImage(component.foregroundPath,component.foregroundSha256);
      if(bleedMm>0&&(fixedBackground.metadata.width!==pixelWidth||fixedBackground.metadata.height!==pixelHeight))throw new Error(`Full-bleed background must be exactly ${pixelWidth} x ${pixelHeight} pixels at ${dpi} DPI for this trim plus bleed; got ${fixedBackground.metadata.width} x ${fixedBackground.metadata.height}`);
      const logo=await logoHtml(snapshot.logo,component.logoBox,scale);
      const synthetic=template.synthetic !== false;
      const html=`<!doctype html><html lang="ml"><head><meta charset="utf-8"><style>${font.css}*{box-sizing:border-box}html,body{padding:0;margin:0;width:${pixelWidth}px;height:${pixelHeight}px;background:transparent}body{font-family:${font.family},sans-serif;color:${textColor}}.art{position:relative;width:${pixelWidth}px;height:${pixelHeight}px;overflow:hidden;background:${bg};${artworkMask?'clip-path:'+artworkMask.css:''}}.trim{position:absolute;left:${bleedMm*scale}px;top:${bleedMm*scale}px;width:${trimPixelWidth}px;height:${trimPixelHeight}px}.fixed-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.photo{position:absolute;overflow:hidden}.fit{position:absolute;display:flex;align-items:center;justify-content:center;padding:0;line-height:1.45;white-space:pre-wrap;overflow:visible;overflow-wrap:normal;word-break:normal}.fit span{display:block;width:100%;max-height:none}.line{position:absolute;left:10%;right:10%;height:${scale*.3}px;background:${accent}}.demo-top{position:absolute;top:2%;width:100%;font-size:${scale*1.8}px;letter-spacing:${scale*.3}px;text-align:center;color:${accent}}</style></head><body><div class="art">${fixedBackground.html}<div class="trim">${synthetic?`<div class="demo-top">TRICHUR TROPHIES \u2022 DEMONSTRATION</div><div class="line" style="top:6%"></div><div class="line" style="bottom:3%"></div>`:''}${photo.html}${fixedForeground.html}${logo}${field('Shared heading',shared.heading||'',headingBox)}${field('Event',shared.event||'',eventBox)}${field('Date',shared.date||'',dateBox)}${field('Recipient name',recipient.name,nameBox)}${field('Achievement',recipient.achievement||'',achievementBox)}</div></div></body></html>`;
      const page=await context.newPage();
      try {
        await page.setViewportSize({width:pixelWidth,height:pixelHeight});
        await page.setContent(html,{waitUntil:'load',timeout:30_000});
        const fits=await page.evaluate(async()=>{
          await document.fonts.ready;
          await document.fonts.load('24px TTMalayalam','\u0d15\u0d47\u0d30\u0d33\u0d02 \u0d15\u0d4d\u0d37 \u0d36\u0d4d\u0d30\u0d40 \u0d7b \u0d7d \u0d7e \u0d7c \u0d7a');
          if(!document.fonts.check('24px TTMalayalam','\u0d15\u0d47\u0d30\u0d33\u0d02'))throw new Error('Malayalam font failed to load');
          await Promise.all([...document.images].map(img=>img.decode()));
          return [...document.querySelectorAll('.fit')].map(el=>{
            const span=el.querySelector('span'), min=Number(el.dataset.min),max=Number(el.dataset.max);
            let lo=min,hi=max;
            function fit(size){span.style.fontSize=size+'px';return span.scrollHeight<=el.clientHeight+.5 && span.scrollWidth<=el.clientWidth+.5;}
            if(!fit(min))return {field:el.dataset.field,ok:false,min};
            for(let k=0;k<12;k++){let mid=(lo+hi)/2;if(fit(mid))lo=mid;else hi=mid;}
            fit(lo);return {field:el.dataset.field,ok:true,fontPx:lo};
          });
        });
        const failures=fits.filter(f=>!f.ok);
        if(failures.length)throw new Error(failures.map(f=>`${f.field} does not fit at the template minimum font size; shorten wording or use an approved larger template`).join('; '));
        const png=await page.screenshot({type:'png',omitBackground:true,animations:'disabled',timeout:30_000});
        const canonical=await sharp(png).withMetadata({density:dpi}).png().toBuffer();
        const sha256=hash(canonical);
        const filename=`${String(component.id||component.name||'front').replace(/[^a-zA-Z0-9_-]/g,'_')}-${sha256.slice(0,16)}.png`;
        const outputPath=path.join(outputDir,filename);
        await atomicWrite(outputPath,canonical);
        artworks.push({componentId:component.id||'front',componentName:component.name||component.id||'Front',path:outputPath,sha256,widthMm,heightMm,pixelWidth,pixelHeight,dpi,bleedMm,includesBleed:bleedMm>0,trimMask:trimMask?{type:'polygon',points:trimMask.points}:null,trimGeometryStatus:component.trimGeometryStatus||'unverified',allowRotation:component.allowRotation===true,media:component.media||'photo-paper',effectiveDpi:photo.effectiveDpi,fit:fits,sourceLayerHashes:{background:fixedBackground.sha256,foreground:fixedForeground.sha256}});
        if(onProgress)await onProgress(artworks.length/template.components.length);
      }finally{await page.close();}
    }
  }finally{signal?.removeEventListener('abort',abort);await context.close();}
  return {artworks,warnings:[...new Set(warnings)],renderer:{version:RENDERER_VERSION,browser:browser.version(),font:font.source,fontSha256:font.sha256,latinFontSha256:font.latinSha256,dpi,colorSpace:'sRGB',cropVersion:'normalized-cover-1'}};
}

export async function atomicWrite(outputPath,bytes) {
  await fs.mkdir(path.dirname(outputPath),{recursive:true});
  const temp=outputPath+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,bytes,{flag:'wx'});await fs.rename(temp,outputPath);}catch(error){await fs.rm(temp,{force:true}).catch(()=>{});throw error;}
}

export async function createPrintPdf({approvalId,orderId,revision,pieces,profile,outputPath,onProgress,shouldCancel,signal,diagnostic=false}) {
  if(signal?.aborted)throw new Error('Export cancelled before rendering');
  if(!approvalId)throw new Error('An immutable approval ID is required for production export');
  const packed=packPieces(pieces,profile);
  const pdf=await PDFDocument.create();
  pdf.setTitle(`Trichur Trophies | ${orderId} | approval ${approvalId}`);
  pdf.setSubject('A3 actual-size sRGB raster artwork; print 100%, disable Fit to Page');
  pdf.setProducer(RENDERER_VERSION);
  const pages=Array.from({length:packed.pageCount},()=>pdf.addPage([packed.profile.widthMm*MM_TO_PT,packed.profile.heightMm*MM_TO_PT]));
  if(diagnostic && packed.profile.marginMm<4)throw new Error('Diagnostic export requires at least 4 mm margin for its uncalibrated notice.');
  if(packed.profile.marginMm>=4){
    const labelFont=await pdf.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<pages.length;i++)pages[i].drawText(`${diagnostic?'UNCALIBRATED - TEST ONLY | ':''}Order ${String(orderId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50)} | revision ${revision} | sheet ${i+1}/${pages.length} | 100% Actual Size`,{x:packed.profile.marginMm*MM_TO_PT,y:packed.profile.heightMm*MM_TO_PT-2.5*MM_TO_PT,size:6,font:labelFont,color:rgb(.2,.2,.2)});
  }
  const imageCache=new Map();
  const manifest={schemaVersion:1,orderId,approvalId,revision,diagnostic,generatedAt:new Date().toISOString(),units:'mm',origin:'top-left',colorSpace:'sRGB',profile:packed.profile,pageCount:packed.pageCount,pieceCount:pieces.length,placements:[]};
  for(const p of packed.placements){
    if(signal?.aborted || (shouldCancel && await shouldCancel()))throw new Error('Export cancelled before publication');
    const file=inputPath(p.path||p.artworkPath);
    const bytes=await fs.readFile(file), sha256=hash(bytes);
    if(!p.sha256 || p.sha256!==sha256)throw new Error(`Approved artwork hash mismatch: ${p.recipientId}/${p.componentId}`);
    let image=imageCache.get(sha256);
    if(!image){
      image=await pdf.embedPng(bytes);
      // pdf-lib releases its PNG decoder/RGB/alpha buffers after embed().
      // Embed immediately so a large job retains compressed PDF streams,
      // rather than hundreds of decoded full-resolution rasters until save().
      await image.embed();
      imageCache.set(sha256,image);
    }
    const page=pages[p.page-1];
    // Nonzero bleed must already be present in the exact approved canonical PNG.
    if(p.bleedMm>0 && !p.includesBleed)throw new Error('Non-zero bleed requires an approved artwork that includes the declared bleed; export stopped');
    if(p.bleedMm>0){
      const info=await sharp(bytes).metadata(),dpi=Number(p.dpi||300);
      if(info.width!==Math.round((p.widthMm+2*p.bleedMm)*dpi/25.4)||info.height!==Math.round((p.heightMm+2*p.bleedMm)*dpi/25.4))throw new Error('Approved full-bleed artwork pixel dimensions do not match its trim, bleed and DPI configuration');
    }
    const x=p.xMm*MM_TO_PT,y=(packed.profile.heightMm-p.yMm-p.footprintHeightMm)*MM_TO_PT;
    if(p.rotation===90)page.drawImage(image,{x:x+p.footprintWidthMm*MM_TO_PT,y,width:p.footprintHeightMm*MM_TO_PT,height:p.footprintWidthMm*MM_TO_PT,rotate:degrees(90)});
    else page.drawImage(image,{x,y,width:p.footprintWidthMm*MM_TO_PT,height:p.footprintHeightMm*MM_TO_PT});
    manifest.placements.push({recipientId:p.recipientId,recipientName:p.recipientName||p.name,modelCode:p.modelCode,componentId:p.componentId,componentName:p.componentName,copyNumber:p.copyNumber||p.copy||1,page:p.page,xMm:p.xMm,yMm:p.yMm,widthMm:p.widthMm,heightMm:p.heightMm,footprintWidthMm:p.footprintWidthMm,footprintHeightMm:p.footprintHeightMm,bleedMm:p.bleedMm,rotation:p.rotation,trimMask:p.trimMask||null,trimGeometryStatus:p.trimGeometryStatus||'unverified',artworkSha256:sha256,pieceId:p.pieceId||`${p.recipientId}:${p.componentId}:${p.copyNumber||p.copy||1}`});
    if(onProgress) await onProgress(manifest.placements.length/pieces.length*.9);
  }
  if(signal?.aborted || (shouldCancel && await shouldCancel()))throw new Error('Export cancelled before publication');
  const bytes=await pdf.save();
  const loaded=await PDFDocument.load(bytes);
  if(loaded.getPages().some(p=>Math.abs(p.getWidth()/MM_TO_PT-packed.profile.widthMm)>.0001||Math.abs(p.getHeight()/MM_TO_PT-packed.profile.heightMm)>.0001))throw new Error('PDF page geometry verification failed');
  const manifestPath=outputPath.replace(/\.pdf$/i,'')+'.manifest.json';
  await atomicWrite(manifestPath,JSON.stringify(manifest,null,2));
  await atomicWrite(outputPath,bytes);
  if(onProgress) await onProgress(1);
  return {pdfPath:outputPath,manifestPath,manifest,sha256:hash(bytes),sizeBytes:bytes.length,pageCount:packed.pageCount};
}

export async function createCalibrationPdf(outputPath,{orientation='portrait'}={}){
  const landscape=orientation==='landscape',w=landscape?420:297,h=landscape?297:420;
  const pdf=await PDFDocument.create(),page=pdf.addPage([w*MM_TO_PT,h*MM_TO_PT]),font=await pdf.embedFont(StandardFonts.Helvetica);
  const txt=(s,x,y,size=10)=>page.drawText(s,{x:x*MM_TO_PT,y:(h-y)*MM_TO_PT,size,font,color:rgb(.1,.15,.18)});
  txt('TRICHUR TROPHIES - A3 PRINT CALIBRATION',15,20,16);
  txt(`Page: ${w} x ${h} mm. Print Actual Size / 100%. Disable Fit, Shrink and Borderless enlargement.`,15,30,10);
  txt('Measure with a physical ruler. This PDF does not certify a printer or template as calibrated.',15,38,10);
  const line=(x1,y1,x2,y2,t=.5)=>page.drawLine({start:{x:x1*MM_TO_PT,y:(h-y1)*MM_TO_PT},end:{x:x2*MM_TO_PT,y:(h-y2)*MM_TO_PT},thickness:t,color:rgb(0,0,0)});
  for(let mm=0;mm<=100;mm++){line(20+mm,60,20+mm,60+(mm%10===0?5:mm%5===0?3:1.5));if(mm%10===0)txt(String(mm),19+mm,72,8);}
  line(20,60,120,60);txt('Horizontal ruler: exactly 100 mm end to end',20,82);
  for(let mm=0;mm<=100;mm++){line(20,100+mm,20+(mm%10===0?5:mm%5===0?3:1.5),100+mm);if(mm%10===0)txt(String(mm),28,102+mm,8);}line(20,100,20,200);
  page.drawRectangle({x:70*MM_TO_PT,y:(h-160)*MM_TO_PT,width:50*MM_TO_PT,height:50*MM_TO_PT,borderWidth:.5,borderColor:rgb(0,0,0)});
  txt('50 x 50 mm square',70,170);page.drawCircle({x:170*MM_TO_PT,y:(h-135)*MM_TO_PT,size:25*MM_TO_PT,borderWidth:.5,borderColor:rgb(0,0,0)});txt('50 mm diameter',145,170);
  txt('Record printer, driver, paper, measured X/Y, date and operator in the application.',15,225);
  txt('Check trimming and fit using the actual trophy and stock before releasing customer work.',15,233);
  const bytes=await pdf.save();await atomicWrite(outputPath,bytes);return {path:outputPath,sha256:hash(bytes),widthMm:w,heightMm:h};
}

export async function renderMalayalamCorpus(outputPath){
  const font=await fontConfiguration(),browser=await getBrowser();
  const corpus=['\u0d15\u0d47\u0d30\u0d33\u0d02 \u2022 \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02 \u2022 \u0d2a\u0d41\u0d30\u0d38\u0d4d\u0d15\u0d3e\u0d30\u0d02','\u0d15\u0d4d\u0d37\u0d2e \u2022 \u0d36\u0d4d\u0d30\u0d40\u0d32\u0d15\u0d4d\u0d37\u0d4d\u0d2e\u0d3f \u2022 \u0d28\u0d28\u0d4d\u0d26\u0d28 \u2022 \u0d05\u0d2d\u0d3f\u0d28\u0d28\u0d4d\u0d26\u0d28\u0d19\u0d4d\u0d19\u0d7e','\u0d05\u0d30\u0d41\u0d7a \u0d15\u0d46. \u2022 \u0d05\u0d28\u0d3f\u0d7d \u2022 \u0d36\u0d3f\u0d7d\u0d2a \u2022 \u0d15\u0d43\u0d37\u0d4d\u0d23\u0d7b \u2022 \u0d2c\u0d3e\u0d32\u0d7b','\u0d7e \u0d7d \u0d7c \u0d7b \u0d7a \u0d7f \u2022 \u0d15\u0d4d\u200d \u2022 \u0d28\u0d4d\u200d \u2022 \u0d40 \u0d41 \u0d42 \u0d43','Dr. Amal \u0d15\u0d46. \u0d24\u0d4b\u0d2e\u0d38\u0d4d \u2014 2026 / A-1','\u0d36\u0d4d\u0d30\u0d40. \u0d15\u0d43\u0d37\u0d4d\u0d23\u0d2a\u0d4d\u0d30\u0d38\u0d3e\u0d26\u0d4d \u0d0e\u0d02. \u0d0e\u0d7b. \u2014 \u0d2e\u0d3f\u0d15\u0d1a\u0d4d\u0d1a \u0d28\u0d47\u0d1f\u0d4d\u0d1f\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d41\u0d33\u0d4d\u0d33 \u0d05\u0d02\u0d17\u0d40\u0d15\u0d3e\u0d30\u0d02'];
  const page=await browser.newPage({viewport:{width:1500,height:1200},deviceScaleFactor:1});
  await page.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
  try{
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${font.css}body{font-family:TTMalayalam,sans-serif;background:#fff;color:#16292f;margin:50px}h1{font-size:35px}p{font-size:38px;line-height:1.8;margin:15px 0}svg{width:1300px;height:350px}text{font-family:TTMalayalam;font-size:40px}</style><h1>Malayalam shaping and curved-heading feasibility</h1>${corpus.map(s=>`<p>${esc(s)}</p>`).join('')}<svg viewBox="0 0 1300 350"><defs><path id="curve" d="M 100 280 Q 650 20 1200 280"/></defs><path d="M 100 280 Q 650 20 1200 280" fill="none" stroke="#ddd"/><text><textPath href="#curve" startOffset="50%" text-anchor="middle">\u0d05\u0d2d\u0d3f\u0d28\u0d28\u0d4d\u0d26\u0d28\u0d19\u0d4d\u0d19\u0d7e \u2022 \u0d2e\u0d3f\u0d15\u0d1a\u0d4d\u0d1a \u0d28\u0d47\u0d1f\u0d4d\u0d1f\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d41\u0d33\u0d4d\u0d33 \u0d2a\u0d41\u0d30\u0d38\u0d4d\u0d15\u0d3e\u0d30\u0d02</textPath></text></svg><p style="font-size:20px">Human Malayalam-reader sign-off is still required. Curved headings are a feasibility proof, not enabled for approved editable production templates.</p>`);
    await page.evaluate(async()=>{await document.fonts.ready;await document.fonts.load('40px TTMalayalam','\u0d15\u0d47\u0d30\u0d33\u0d02');});
    const bytes=await page.screenshot({type:'png',fullPage:true});await atomicWrite(outputPath,bytes);
    return {path:outputPath,sha256:hash(bytes),corpus,font:font.source,fontSha256:font.sha256,browser:browser.version(),curvedHeadingStatus:'visual-human-review-required; editable curved fields disabled'};
  }finally{await page.close();}
}
