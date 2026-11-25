import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { orderQrSvg } from '../src/qr.js';
import { sharp } from '../src/deps.js';
import jsQR from './vendor/jsQR.cjs';

// Synthetic credentials only. Never copy a live customer link into tests/logs.
const token='Synthetic_Test_Token_0123456789_abcdefghijklm';
const sample=`https://trophies.example/o#${token}`;
async function decodeSvg(svg, { width = 360, rotation = 0, jpeg = false } = {}) {
  let input = await sharp(Buffer.from(svg)).resize(width,width,{kernel:'nearest'}).rotate(rotation).png().toBuffer();
  if(jpeg)input=await sharp(input).jpeg({quality:65}).toBuffer();
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const result=jsQR(new Uint8ClampedArray(data),info.width,info.height,{inversionAttempts:'dontInvert'});
  assert.ok(result,'Independent decoder must find and decode the rendered QR');
  return result.data;
}

test('order QR is deterministic, self-contained, four-module quiet zone, and omits credential text metadata',async()=>{
  const svg=orderQrSvg(sample);
  assert.equal(svg,orderQrSvg(sample));
  assert.ok(svg.startsWith('<svg '));
  assert.ok(!svg.includes(token));
  assert.ok(!svg.includes(sample));
  assert.ok(!/<(?:script|image|foreignObject|use)\b/i.test(svg));
  assert.ok(!/\b(?:href|onload|onclick)\s*=/i.test(svg));
  const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // SVG width is 8 pixels/module; every outer 32-pixel strip is quiet white.
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x<32||y<32||x>=info.width-32||y>=info.height-32){
    const i=(y*info.width+x)*4;
    assert.equal(data[i],255);assert.equal(data[i+1],255);assert.equal(data[i+2],255);assert.equal(data[i+3],255);
  }
  assert.equal(await decodeSvg(svg),sample);
});

test('independent decoder round-trips public, localhost, LAN, IPv6, Unicode host and long base URLs',async()=>{
  const urls=[sample,`http://localhost:3000/o#${token}`,`http://192.168.1.40:3000/o#${token}`,`http://[::1]:3000/o#${token}`,`https://\u0d15\u0d47\u0d30\u0d33\u0d02.example/o#${token}`,`https://trophies.example/${'safe-base-path/'.repeat(18)}o#${token}`];
  for(const url of urls)assert.equal(await decodeSvg(orderQrSvg(url),{width:560}),new URL(url).href);
});

test('independent decoder reads rotated, reduced and JPEG-compressed QR rasters',async()=>{
  const svg=orderQrSvg(sample);
  assert.equal(await decodeSvg(svg,{width:220,rotation:90}),sample);
  assert.equal(await decodeSvg(svg,{width:360,rotation:180,jpeg:true}),sample);
});

test('unsafe schemes, query credentials, malformed tokens and oversized inputs fail without echoing secrets',()=>{
  const values=[null,42,'',`javascript:alert(1)#${token}`,`ftp://example.com/o#${token}`,`https://user:password@example.com/o#${token}`,`https://example.com/o?token=${token}`,`https://example.com/o?tracking=1#${token}`,`https://example.com/o#short`,`https://example.com/o#${token}<svg>`,` https://example.com/o#${token}`,`https://example.com/${'x'.repeat(2050)}#${token}`];
  for(const value of values)assert.throws(()=>orderQrSvg(value),error=>{
    assert.ok(!error.message.includes(token));
    assert.ok(!error.message.includes('password'));
    return /order link|too long/.test(error.message);
  });
});

test('QR encoding has no network dependency and does not call fetch',()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('Network access forbidden during local QR generation');};
  try{assert.match(orderQrSvg(sample),/^<svg/);}finally{globalThis.fetch=previous;}
});

test('vendored encoder and independent decoder match their upstream Git blob identities',()=>{
  const fixtures=[['../src/vendor/qrcode-generator.mjs','444522524987df3a4e37c2a5150dc5c8a052bd44'],['./vendor/jsQR.cjs','99ea9df26907009e5553233ffe03c529c1521739']];
  for(const [relative,expected]of fixtures){const bytes=fs.readFileSync(new URL(relative,import.meta.url));const hash=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(hash,expected);}
});
