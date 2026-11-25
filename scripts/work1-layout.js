// Offline, fixed artwork preparation. No generative image or external API calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import { sharp } from '../src/deps.js';
import { getBrowser, fontConfiguration } from '../src/render.js';

export const WORK1_TITLE='Jyothi Engineering College';
export const WORK1_PIXELS=2953;
export const WORK1_MM=WORK1_PIXELS*25.4/300;
export async function prepareWork1Layout(root, destination){
  await fs.mkdir(destination,{recursive:true});
  const backgroundFile=path.join(root,'Work 1','jyothi-engineering-college-office.jpg');
  const frameFile=path.join(root,'private','prepared-assets','carving-kannadi-r-big-frame.png');
  const campus=await fs.readFile(backgroundFile),frame=await fs.readFile(frameFile);
  const font=await fontConfiguration();
  const browser=await getBrowser(),context=await browser.newContext({deviceScaleFactor:1});
  await context.route('**/*',r=>r.request().url().startsWith('data:')?r.continue():r.abort());
  try{
    const page=await context.newPage();await page.setViewportSize({width:2953,height:2953});
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${font.css}
      *{box-sizing:border-box}html,body{margin:0;width:2953px;height:2953px;background:white}
      .campus{position:absolute;left:0;top:0;width:2953px;height:2953px;clip-path:circle(1205px at 1476.5px 1476.5px)}
      .campus img{position:absolute;left:265px;top:310px;width:2423px;height:1817.25px;object-fit:cover;mask-image:linear-gradient(to bottom,#000 0%,#000 63%,transparent 96%)}
      .frame{position:absolute;inset:0;width:2953px;height:2953px}
      .photo-ring{position:absolute;left:995px;top:1383px;width:962px;height:965px;border-radius:50%;background:white;box-shadow:18px 25px 46px #0004}
      svg{position:absolute;inset:0;overflow:visible}
    </style></head><body><div class="campus"><img src="data:image/jpeg;base64,${campus.toString('base64')}"></div>
    <img class="frame" src="data:image/png;base64,${frame.toString('base64')}">
    <svg width="2953" height="2953" viewBox="0 0 2953 2953"><defs><path id="title-arc" d="M 480 1020 A 1120 1120 0 0 1 2473 1020"/></defs>
    <text id="heading" font-family="TTLatin" font-size="148" font-weight="700" fill="#075785" stroke="white" stroke-width="15" paint-order="stroke" stroke-linejoin="round"><textPath href="#title-arc" startOffset="50%" text-anchor="middle">${WORK1_TITLE}</textPath></text></svg>
    <div class="photo-ring"></div></body></html>`,{waitUntil:'load'});
    const check=await page.evaluate(async()=>{await document.fonts.load('700 148px TTLatin');await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));const t=document.querySelector('#heading'),p=document.querySelector('#title-arc'),b=t.getBBox();return{text:t.textContent,pathLength:p.getTotalLength(),textLength:t.getComputedTextLength(),bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};});
    if(check.text!==WORK1_TITLE||check.textLength>check.pathLength-100||check.bounds.x<250||check.bounds.x+check.bounds.width>2703||check.bounds.y<250)throw new Error('Fixed arched title failed full-text/safe-bounds check');
    const png=await page.screenshot({type:'png',animations:'disabled'});
    const output=path.join(destination,'jyothi-carving-background.png');
    await sharp(png).withMetadata({density:300}).png().toFile(output);
    await fs.writeFile(path.join(destination,'layout-evidence.json'),JSON.stringify({title:WORK1_TITLE,heading:check,sourcePixels:[640,480],campusPlacementPx:{x:265,y:310,width:2423,height:1817.25},campusEffectiveDpi:640/(2423/300),portraitWindowPx:{x:1040,y:1430,width:880,height:880},canvasPixels:[2953,2953],canvasMm:[WORK1_MM,WORK1_MM],dpi:300,physicalFitVerified:false,networkRequestsAllowed:false,headingIsFixedRaster:true},null,2));
    return output;
  }finally{await context.close();}
}

export function work1Template(backgroundPath){
 const mm=p=>p*25.4/300;
 return{id:'carving-kannadi-r-big-jyothi-v1',version:1,modelCode:'CARVING KANNADI R BIG',name:'CARVING KANNADI R BIG - Jyothi Engineering College',sizeVariant:'BIG',synthetic:false,font:'latin',calibrationStatus:'unverified',sourceReference:'CARVING KANNADI R BIG.psd',preparationNote:'Source-derived border and portrait geometry; new locally rendered fixed English arch and college background. Source canvas dimensions; physical fit unverified. No generative AI.',fixedHeading:WORK1_TITLE,fields:[{key:'name',label:'Filename without extension',scope:'recipient',required:true}],components:[{id:'front',name:'Round front',widthMm:WORK1_MM,heightMm:WORK1_MM,backgroundPath,backgroundColor:'#ffffff',textColor:'#075785',photo:{x:mm(1040),y:mm(1430),width:mm(880),height:mm(880),shape:'circle'},nameBox:{x:mm(650),y:mm(2400),width:mm(1653),height:mm(190),minFontMm:6,maxFontMm:10,font:'latin'},bleedMm:0,safeZoneMm:5,allowRotation:false,media:'photo-paper',trimGeometryStatus:'unverified-source-canvas'}]};
}

export async function makeContactSheet(files,output,{columns=5,tile=230,caption=32}={}){
 const rows=Math.ceil(files.length/columns),layers=[];
 for(const [i,item] of files.entries()){
  const image=await sharp(item.path).flatten({background:'#fff'}).resize(tile-12,tile-12,{fit:'inside'}).png().toBuffer();
  layers.push({input:image,left:(i%columns)*tile+6,top:Math.floor(i/columns)*(tile+caption)+6});
  const label=String(item.label).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const text=Buffer.from(`<svg width="${tile}" height="${caption}"><rect width="100%" height="100%" fill="white"/><text x="${tile/2}" y="21" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#172b31">${label}</text></svg>`);
  layers.push({input:text,left:(i%columns)*tile,top:Math.floor(i/columns)*(tile+caption)+tile});
 }
 await sharp({create:{width:columns*tile,height:rows*(tile+caption),channels:3,background:'#ffffff'}}).composite(layers).jpeg({quality:90}).toFile(output);
}
