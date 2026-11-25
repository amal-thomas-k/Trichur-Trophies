import test from 'node:test';
import assert from 'node:assert/strict';
import {work1Crop} from '../scripts/work1-crops.js';
test('Work1 crop coordinates remain inside application bounds for every supplied index',()=>{
 for(let n=1;n<=100;n++)for(const [w,h] of [[300,300],[210,300],[300,200]]){
  const c=work1Crop(String(n).padStart(3,'0')+'_photo.jpg',w,h);
  assert.ok(c.zoom>=1&&c.zoom<=4);assert.ok(Math.abs(c.x)<=1&&Math.abs(c.y)<=1);assert.equal(c.rotation,0);
 }
});
test('Work1 full-body crop moves the chosen upper portrait focus to the circle centre',()=>{
 const w=210,h=300,c=work1Crop('026_ecbdaaa7.jpg',w,h),cover=c.zoom/Math.min(w,h);
 const px=(1-w*cover)/2+c.x*(w*cover-1)/2;
 const py=(1-h*cover)/2+c.y*(h*cover-1)/2;
 assert.ok(Math.abs(px+.49*w*cover-.5)<1e-9);
 assert.ok(Math.abs(py+.26*h*cover-.5)<1e-9);
});
test('Work1 collage crop enlarges the large upper portrait instead of the small lower collage',()=>{
 const c=work1Crop('073_42e32f65.jpg',300,300);
 assert.equal(c.zoom,1.65);assert.ok(c.y>.8);assert.equal(c.x,0);
});
