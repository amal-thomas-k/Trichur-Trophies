import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable, Writable } from 'node:stream';

export async function createHarness({worker=true,transport=process.env.TEST_TRANSPORT||'http'}={}) {
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'tt-http-'));
  process.env.DATA_DIR=data;
  const server=transport==='http'?http.createServer():null;
  if(server){server.listen(0,'127.0.0.1');await once(server,'listening');}
  const base=server?`http://127.0.0.1:${server.address().port}`:'http://localhost:3000';
  process.env.BASE_URL=base;
  const {db,run}=await import('../src/db.js');
  const domain=await import('../src/domain.js');
  const {demoTemplates}=await import('../src/demo-templates.js');
  const {sealTemplate}=await import('../src/templates.js');
  const {sharp,pdfLib,playwright}=await import('../src/deps.js');
  const {handler}=await import('../src/server.js');
  const stamp=new Date().toISOString();
  for(const t of demoTemplates)run('INSERT INTO templates(id,doc,created_at) VALUES(?,?,?)',t.id,JSON.stringify(sealTemplate(t)),stamp);
  for(const [username,role] of [['test-owner','admin'],['test-operator','production']])run('INSERT INTO users(id,username,role,password_hash,created_at) VALUES(?,?,?,?,?)',domain.id(),username,role,domain.passwordHash('test-only-password-2026'),stamp);
  if(server)server.on('request',handler);
  let logs='';
  const workerProcess=worker?spawn(process.execPath,['src/worker.js'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,DATA_DIR:data,JOB_LEASE_MS:'3000'},windowsHide:true,stdio:['ignore','pipe','pipe']}):null;
  if(workerProcess){workerProcess.stdout.on('data',b=>{logs+=b;});workerProcess.stderr.on('data',b=>{logs+=b;});}
  const anonymous={cookie:'',csrf:''};
  // Direct transport executes the actual handler, storage, decoding and worker.
  // It substitutes only socket transport on hosts that deny loopback TCP.
  async function dispatch(method,url,bytes=Buffer.alloc(0),headers={}) {
    const request=Readable.from(bytes.length?[bytes]:[]);
    Object.assign(request,{method,url,headers:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v])),socket:{remoteAddress:'127.0.0.1'}});
    const chunks=[], responseHeaders=new Headers();
    const response=new Writable({write(chunk,encoding,callback){this.headersSent=true;chunks.push(Buffer.from(chunk));callback();}});
    response.statusCode=200;response.headersSent=false;
    response.setHeader=(key,value)=>{responseHeaders.set(key,Array.isArray(value)?value.join(', '):String(value));return response;};
    response.getHeader=key=>responseHeaders.get(key);
    response.writeHead=(status,values={})=>{response.statusCode=status;for(const [key,value] of Object.entries(values))response.setHeader(key,value);response.headersSent=true;return response;};
    const finished=once(response,'finish');
    await handler(request,response);await finished;
    const buffer=Buffer.concat(chunks);let result;try{result=JSON.parse(buffer.toString());}catch{result=buffer;}
    return{status:response.statusCode,body:result,headers:responseHeaders,bytes:buffer};
  }
  async function api(client,method,url,value,extra={}) {
    const raw=Buffer.isBuffer(value);
    const headers={...(client?.cookie?{cookie:client.cookie}:{}),...(client?.csrf?{'x-csrf-token':client.csrf}:{}),...(value!==undefined?{'content-type':raw?'application/octet-stream':'application/json'}:{}),...extra};
    const payload=value===undefined?undefined:raw?value:JSON.stringify(value);
    if(transport==='direct')return dispatch(method,url,payload===undefined?Buffer.alloc(0):Buffer.from(payload),headers);
    const response=await fetch(base+url,{method,headers,body:payload});
    const bytes=Buffer.from(await response.arrayBuffer());
    let result;try{result=JSON.parse(bytes.toString());}catch{result=bytes;}
    return{status:response.status,body:result,headers:response.headers,bytes};
  }
  async function login(username='test-owner') {const r=await api(anonymous,'POST','/api/login',{username,password:'test-only-password-2026'});if(r.status!==200)throw Error(JSON.stringify(r.body));return{cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.body.csrf,actor:r.body.actor};}
  async function access(token){const r=await api(anonymous,'POST','/api/access',{token});if(r.status!==200)throw Error(JSON.stringify(r.body));return{cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.body.csrf,actor:r.body.actor};}
  async function order(owner,overrides={}) {const r=await api(owner,'POST','/api/staff/orders',{title:'Synthetic QA order',shared:{heading:'Test Award',event:'Synthetic fixture',date:'2026'},groups:[{label:'Front',templateId:demoTemplates[0].id,expectedQuantity:1}],...overrides});if(r.status!==201)throw Error(JSON.stringify(r.body));const customer=await access(r.body.token);const v=await api(customer,'GET','/api/customer/order');return{...r.body,customer,view:v.body};}
  async function waitJob(client,jobId,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){const r=await api(client,'GET',`/api/jobs/${jobId}`);if(r.status!==200)throw Error(JSON.stringify(r.body));if(['completed','failed','cancelled'].includes(r.body.status)){if(r.body.status!=='completed')throw Error(`${JSON.stringify(r.body)}\n${logs}`);return r.body;}await new Promise(r=>setTimeout(r,100));}throw Error(`Job ${jobId} timed out\n${logs}`);}
  const image=await sharp({create:{width:1600,height:1200,channels:3,background:'#e2a957'}}).png().toBuffer();
  const image2=await sharp({create:{width:900,height:1300,channels:3,background:'#75bbc2'}}).jpeg().toBuffer();
  async function close(){if(workerProcess&&workerProcess.exitCode===null){workerProcess.kill();await Promise.race([once(workerProcess,'exit'),new Promise(r=>setTimeout(r,5000))]);}if(server)await new Promise(r=>{server.close(r);server.closeAllConnections();});db.close();}
  return {data,db,run,domain,sharp,pdfLib,playwright,base,api,dispatch,transport,login,access,order,waitJob,image,image2,anonymous,close,workerProcess,get logs(){return logs;}};
}
