import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { sharp } from '../src/deps.js';
import { installationCapabilities,validateOrderLink,openOrderLink } from '../public/pwa.js';

test('PWA launch and icons carry no order credential',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.id,'/');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons){
    assert.match(icon.src,/^\/icons\/[a-z0-9-]+\.png$/);
    const metadata=await sharp(await fs.readFile(new URL('../public'+icon.src,import.meta.url))).metadata();
    assert.equal(icon.sizes,`${metadata.width}x${metadata.height}`);
    assert.equal(metadata.format,'png');
  }
  const maskable=manifest.icons.find(icon=>icon.purpose==='maskable');
  assert.ok(maskable);
  const image=await sharp(await fs.readFile(new URL('../public'+maskable.src,import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  // The non-background T mark remains inside the maskable icon's central 80% circle.
  for(let y=0;y<image.info.height;y++)for(let x=0;x<image.info.width;x++){
    if(Math.hypot(x-255.5,y-255.5)<=204.8)continue;
    const index=(y*image.info.width+x)*image.info.channels;
    assert.deepEqual([...image.data.subarray(index,index+3)],[20,43,56]);
  }
});

test('PWA capabilities distinguish secure context, installed mode and iPad desktop UA',()=>{
  assert.deepEqual(installationCapabilities({navigator:{serviceWorker:{}},secure:false,standalone:false,userAgent:'Android'}),{secure:false,standalone:false,ios:false,android:true,canUseServiceWorker:false});
  const installed=installationCapabilities({navigator:{serviceWorker:{}},secure:true,standalone:true,userAgent:'iPhone'});
  assert.equal(installed.ios,true);assert.equal(installed.standalone,true);assert.equal(installed.canUseServiceWorker,true);
  assert.equal(installationCapabilities({secure:true,standalone:false,userAgent:'Macintosh',maxTouchPoints:5}).ios,true);
  assert.equal(installationCapabilities({secure:true,standalone:false,userAgent:'Macintosh',maxTouchPoints:0}).ios,false);
});

test('PWA re-entry opens only an explicitly supplied same-shop credential link',()=>{
  const origin='https://shop.example',token='a'.repeat(43);
  assert.equal(validateOrderLink(`${origin}/o#${token}`,origin),`/o#${token}`);
  assert.equal(validateOrderLink(`/o#${token}`,origin),`/o#${token}`);
  for(const bad of [`https://other.example/o#${token}`,`${origin}/staff#${token}`,`${origin}/o?token=${token}`,`${origin}/o`,`${origin}/o#short`,'javascript:alert(1)',`https://x:y@shop.example/o#${token}`])assert.throws(()=>validateOrderLink(bad,origin));
});

test('PWA re-entry reloads an existing order route and navigates normally from an empty launch',()=>{
  const origin='https://shop.example',token='b'.repeat(43),events=[];
  const location={origin,pathname:'/o',assign:target=>events.push(['assign',target]),reload:()=>events.push(['reload'])};
  const history={replaceState:(state,title,target)=>events.push(['replace',state,title,target])};
  openOrderLink(`${origin}/o#${token}`,{location,history});
  assert.deepEqual(events,[['replace',null,'',`/o#${token}`],['reload']]);
  events.length=0;location.pathname='/';
  openOrderLink(`${origin}/o#${token}`,{location,history});
  assert.deepEqual(events,[['assign',`/o#${token}`]]);
  events.length=0;
  assert.throws(()=>openOrderLink('https://other.example/o#'+token,{location,history}));
  assert.deepEqual(events,[]);
});

async function swHarness(){
  const handlers={},added=[],deleted=[],posted=[];let offline=false,claimed=false,waiting=false;
  const cache={async addAll(requests){added.push(...requests)},async match(url){return url==='/index.html'?new Response('safe static shell'):undefined}};
  class RelativeRequest extends Request{constructor(url,options){super(new URL(url,'https://shop.example'),options)}}
  const context={URL,Request:RelativeRequest,Response,caches:{open:async()=>cache,keys:async()=>['tt-static-old','unrelated-app-cache'],delete:async key=>{deleted.push(key);return true}},fetch:async request=>{posted.push(request.url);if(offline)throw new Error('offline');return new Response('online')},self:{location:{origin:'https://shop.example'},addEventListener:(kind,handler)=>handlers[kind]=handler,clients:{claim:async()=>{claimed=true}},skipWaiting:()=>{waiting=true}}};
  vm.runInNewContext(await fs.readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  const wait=async kind=>{let promise;handlers[kind]({waitUntil:value=>promise=value});await promise};
  const request=async(url,{method='GET',mode='cors'}={})=>{let response;handlers.fetch({request:{url:'https://shop.example'+url,method,mode},respondWith:value=>response=value});return response===undefined?null:await response};
  return {handlers,added,deleted,posted,wait,request,setOffline:value=>offline=value,get claimed(){return claimed},get waiting(){return waiting}};
}

test('service worker caches only credential-free static assets, and updates only on request',async()=>{
  const sw=await swHarness();await sw.wait('install');
  assert.ok(sw.added.length>=10);
  assert.equal(sw.waiting,false);
  for(const request of sw.added){assert.equal(request.credentials,'omit');const url=new URL(request.url);assert.equal(url.search,'');assert.equal(url.hash,'');assert.ok(!url.pathname.startsWith('/api/'));}
  await sw.wait('activate');assert.deepEqual(sw.deleted,['tt-static-old']);assert.equal(sw.claimed,true);
  sw.handlers.message({data:{type:'UNRECOGNISED'}});assert.equal(sw.waiting,false);
  sw.handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(sw.waiting,true);
});

test('service worker bypasses private images, APIs, token query strings and writes',async()=>{
  const sw=await swHarness();
  for(const url of ['/api/customer/order','/api/media/secret','/api/artworks/proof','/api/print-jobs/private/pdf','/private/photo.jpg','/index.html?token=secret','/app.js?token=secret'])assert.equal(await sw.request(url),null);
  assert.equal(await sw.request('/o',{method:'POST',mode:'navigate'}),null);
  assert.equal(await sw.request('/missing',{mode:'navigate'}),null);
  sw.setOffline(true);
  assert.equal(await (await sw.request('/o',{mode:'navigate'})).text(),'safe static shell');
  assert.equal(await sw.request('/api/customer/order',{mode:'navigate'}),null);
  assert.deepEqual(sw.posted,['https://shop.example/o']);
});
