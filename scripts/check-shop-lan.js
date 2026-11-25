// Perform a short LAN transport check with an empty temporary database.
// No customer database, real photos or existing sessions are used.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {networkInterfaces,tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';

const address=process.argv[2];
const privateV4=/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const assigned=Object.values(networkInterfaces()).flat().some(n=>n.address===address&&!n.internal);
if(!assigned||!privateV4.test(address))throw new Error('Pass the private IPv4 address of the active shop network adapter.');
process.env.DATA_DIR=await mkdtemp(path.join(tmpdir(),'tt-shop-lan-check-'));
const server=createServer();
server.listen(0,address);
await once(server,'listening');
const base='http://'+address+':'+server.address().port;
process.env.BASE_URL=base;
let db;
try{
  const store=await import('../src/db.js');
  db=store.db;
  const d=await import('../src/domain.js');
  const {handler}=await import('../src/server.js');
  const {demoTemplates}=await import('../src/demo-templates.js');
  const staffPassword=randomBytes(32).toString('base64url');
  const template=demoTemplates[0];
  store.run('INSERT INTO templates(id,doc,created_at) VALUES(?,?,?)',template.id,JSON.stringify(template),new Date().toISOString());
  store.run('INSERT INTO users(id,username,role,password_hash,created_at) VALUES(?,?,?,?,?)',d.id(),'lan-check','admin',d.passwordHash(staffPassword),new Date().toISOString());
  server.on('request',handler);
  const get=(url,headers={})=>fetch(base+url,{headers,signal:AbortSignal.timeout(6000)});
  const post=(url,payload,headers={})=>fetch(base+url,{method:'POST',headers:{'content-type':'application/json',origin:base,...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(6000)});
  assert.equal((await get('/staff')).status,200);
  const login=await post('/api/login',{username:'lan-check',password:staffPassword});
  assert.equal(login.status,200);
  const staff={cookie:login.headers.get('set-cookie').split(';')[0],'x-csrf-token':(await login.json()).csrf};
  const created=await post('/api/staff/orders',{title:'Connection check',shared:{heading:''},groups:[{templateId:template.id,expectedQuantity:1}]},staff);
  assert.equal(created.status,201);
  const order=await created.json();
  assert.equal(new URL(order.url).origin,base);
  const qr=await post('/api/staff/order-qr',{url:order.url},staff);
  assert.equal(qr.status,200);
  assert.match((await qr.json()).svg,/<svg\b/);
  const customer=await post('/api/access',{token:order.token});
  assert.equal(customer.status,200);
  const customerCookie=customer.headers.get('set-cookie').split(';')[0];
  const view=await get('/api/customer/order',{cookie:customerCookie});
  assert.equal(view.status,200);
  assert.equal((await view.json()).order.id,order.order.id);
  assert.equal((await get('/api/staff/orders',{cookie:customerCookie})).status,403);
  const report={passed:true,interface:address,tested:['staff page','staff login','create order','LAN order URL','private QR','customer session','correct order','staff access denied to customer'],scope:'This PC to its own private network interface. A physical customer phone must still check Wi-Fi and firewall reachability.'};
  await mkdir('artifacts/shop-qa',{recursive:true});
  await writeFile('artifacts/shop-qa/lan-transport.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(error){
  const report={passed:false,interface:address,error:error.name,detail:error.message,scope:'LAN request from this process. Check the printed URL from a phone on the shop Wi-Fi. Check firewall, network isolation and the configured proxy.'};
  await mkdir('artifacts/shop-qa',{recursive:true});
  await writeFile('artifacts/shop-qa/lan-transport.json',JSON.stringify(report,null,2));
  console.error(report.detail);
  process.exitCode=1;
}finally{
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  db?.close();
}
