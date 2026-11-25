// Browserless local renderer for the one sealed Work1 template. No URLs, browser
// process, HTTP client, cloud API or font download is involved.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { sharp } from './deps.js';
import { ROOT } from './config.js';
import { resolveStoredPath } from './storage-path.js';
import { validateTemplateGeometry, validateSnapshotFields, atomicWrite } from './render.js';

const TEMPLATE_ID = 'carving-kannadi-r-big-jyothi-v1';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
const cancelled = signal => { if (signal?.aborted) throw signal.reason || new Error('Rendering cancelled.'); };

export function supportsWork1Offline(snapshot) {
  return process.env.TT_OFFLINE_RENDERING === '1' && snapshot?.template?.id === TEMPLATE_ID;
}

export async function renderWork1Offline(snapshot, outputDir, { signal, onProgress } = {}) {
  const template = snapshot.template;
  if (template?.id !== TEMPLATE_ID || template.fixedHeading !== 'Jyothi Engineering College' || template.components?.length !== 1) throw new Error('Unsupported browserless template; this renderer is restricted to the sealed Work1 layout.');
  validateTemplateGeometry(template);
  const { recipient } = validateSnapshotFields(snapshot);
  if (!/^[\x20-\x7e]+$/.test(recipient.name)) throw new Error('The Work1 offline filename renderer supports printable ASCII labels only; no font substitution is allowed.');
  const component = template.components[0];
  if (component.id !== 'front' || component.photo?.shape !== 'circle' || component.foregroundPath || component.bleedMm || component.trimMask) throw new Error('Unsupported modified Work1 geometry. Publish a new supported template version.');
  const dpi = 300, scale = dpi / 25.4;
  const widthMm = component.widthMm, heightMm = component.heightMm;
  const pixelWidth = Math.round(widthMm * scale), pixelHeight = Math.round(heightMm * scale);
  if (pixelWidth !== 2953 || pixelHeight !== 2953) throw new Error('Work1 sealed canvas must remain 2953 x 2953 pixels.');
  const fontPath = path.join(ROOT, 'src', 'fonts', 'LiberationSans-Regular.ttf');
  const fontHash = sha(await fs.readFile(fontPath));
  if (fontHash !== template.fontHashes?.latin) throw new Error('Work1 bundled Latin font hash mismatch.');
  const background = await fs.readFile(resolveStoredPath(component.backgroundPath));
  if (!component.backgroundSha256 || sha(background) !== component.backgroundSha256) throw new Error('Work1 sealed background hash mismatch.');
  const bgMetadata = await sharp(background).metadata();
  if (bgMetadata.width !== pixelWidth || bgMetadata.height !== pixelHeight) throw new Error('Work1 background pixel dimensions changed.');
  const source = await fs.readFile(resolveStoredPath(snapshot.asset.path));
  if (sha(source) !== snapshot.asset.sha256) throw new Error('Source photo hash changed; proof cannot be produced.');
  cancelled(signal);

  const crop = recipient.crop || { x:0, y:0, zoom:1, rotation:0 };
  if (![0,90,180,270].includes(crop.rotation || 0)) throw new Error('Photo rotation must be 0, 90, 180 or 270 degrees.');
  const oriented = await sharp(source, { limitInputPixels:50_000_000 }).autoOrient().rotate(crop.rotation || 0).png().toBuffer({ resolveWithObject:true });
  const box = component.photo;
  const photoWidth = Math.round(box.width * scale), photoHeight = Math.round(box.height * scale);
  const zoom = Number(crop.zoom || 1);
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 4 || !Number.isFinite(crop.x || 0) || !Number.isFinite(crop.y || 0) || Math.abs(crop.x || 0)>1 || Math.abs(crop.y || 0)>1) throw new Error('Invalid crop transform.');
  const cover = Math.max(photoWidth/oriented.info.width, photoHeight/oriented.info.height) * zoom;
  const scaledWidth = Math.max(photoWidth, Math.round(oriented.info.width * cover));
  const scaledHeight = Math.max(photoHeight, Math.round(oriented.info.height * cover));
  const dx = (photoWidth-scaledWidth)/2 + (crop.x || 0)*(scaledWidth-photoWidth)/2;
  const dy = (photoHeight-scaledHeight)/2 + (crop.y || 0)*(scaledHeight-photoHeight)/2;
  const left = Math.max(0, Math.min(scaledWidth-photoWidth, Math.round(-dx)));
  const top = Math.max(0, Math.min(scaledHeight-photoHeight, Math.round(-dy)));
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${photoWidth}" height="${photoHeight}"><ellipse cx="${photoWidth/2}" cy="${photoHeight/2}" rx="${photoWidth/2}" ry="${photoHeight/2}" fill="white"/></svg>`);
  const photo = await sharp(oriented.data).resize(scaledWidth, scaledHeight, { fit:'fill', kernel:'lanczos3' }).extract({ left, top, width:photoWidth, height:photoHeight }).ensureAlpha().composite([{ input:circle, blend:'dest-in' }]).png().toBuffer();
  await onProgress?.(0.4); cancelled(signal);

  const nameBox = component.nameBox;
  const min = Number(nameBox.minFontMm) * scale, max = Number(nameBox.maxFontMm) * scale;
  const boxWidth = Math.round(nameBox.width * scale), boxHeight = Math.round(nameBox.height * scale);
  const color = component.textColor || '#075785';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid Work1 text colour.');
  // Pango receives the bundled font file explicitly. It preserves the complete
  // filename and never truncates or silently shrinks below template minimum.
  async function labelAt(size) {
    return sharp({ text: { text:`<span foreground="${color}">${escape(recipient.name)}</span>`, font:`Liberation Sans ${size.toFixed(6)}`, fontfile:fontPath, dpi:72, rgba:true } }).png().toBuffer({ resolveWithObject:true });
  }
  let size = max - (max-min)/4096; // Same 12-step maximum-fit endpoint as Chromium.
  let label = await labelAt(size);
  if (label.info.width > boxWidth || label.info.height > boxHeight) {
    let lo=min, hi=max;
    label=await labelAt(min);
    if(label.info.width>boxWidth || label.info.height>boxHeight)throw new Error('Recipient name does not fit at the template minimum font size.');
    for(let i=0;i<12;i++) { const mid=(lo+hi)/2, candidate=await labelAt(mid); if(candidate.info.width<=boxWidth && candidate.info.height<=boxHeight){lo=mid;label=candidate;}else hi=mid; }
    size=lo;
  }
  // The label's ink is centred in the original name box. Existing Chromium
  // proofs remain untouched; the renderer and crop rounding are recorded below.
  const textLeft = Math.round(nameBox.x*scale + (boxWidth-label.info.width)/2);
  // Pango returns a tight ink box; CSS centres the font line box. The sealed
  // Liberation Sans reference has its ink centre 11 px below that box centre at
  // 118.098702 px. Preserve that measured baseline, scaling only the offset when
  // the configured fitting algorithm chooses a smaller font.
  const baselineOffset = Math.round(size * 11 / 118.09870201771653);
  const textTop = Math.round(nameBox.y*scale + (boxHeight-label.info.height)/2) + baselineOffset;
  const png = await sharp(background).composite([
    { input:photo, left:Math.round(box.x*scale), top:Math.round(box.y*scale) },
    { input:label.data, left:textLeft, top:textTop },
  ]).withMetadata({ density:dpi }).png().toBuffer();
  cancelled(signal);
  const digest = sha(png), outputPath=path.join(outputDir, `front-${digest.slice(0,16)}.png`);
  await atomicWrite(outputPath, png);
  const effectiveDpi = dpi/cover;
  const warnings = effectiveDpi < 200 ? [`Front: photograph effective resolution ${Math.round(effectiveDpi)} DPI; inspect print quality.`] : [];
  await onProgress?.(1);
  return {
    artworks:[{ componentId:'front',componentName:component.name||'Round front',path:outputPath,sha256:digest,widthMm,heightMm,pixelWidth,pixelHeight,dpi,bleedMm:0,includesBleed:false,trimMask:null,trimGeometryStatus:component.trimGeometryStatus,allowRotation:false,media:component.media||'photo-paper',effectiveDpi,fit:[{field:'Recipient name',ok:true,fontPx:size,inkBoundsPx:{x:textLeft,y:textTop,width:label.info.width,height:label.info.height}}],sourceLayerHashes:{background:component.backgroundSha256,foreground:null} }],
    warnings,
    renderer:{ version:'tt-work1-local-sharp-1', engine:`Sharp ${sharp.versions.sharp}; libvips ${sharp.versions.vips}; Pango ${sharp.versions.pango}`, browser:null,font:'LiberationSans-Regular.ttf',latinFontSha256:fontHash,dpi,colorSpace:'sRGB',cropVersion:'normalized-cover-pixel-rounded-1',network:'no-browser-no-network',fixedHeading:'existing-sha256-pinned-raster',scope:TEMPLATE_ID },
  };
}
