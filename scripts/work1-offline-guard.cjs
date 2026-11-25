// Preload BEFORE application/dependency imports. This filesystem-only batch
// requires no network, child process or JavaScript worker capabilities.
'use strict';
const { syncBuiltinESMExports } = require('node:module');
const state = { version:'work1-offline-deny-1', startedAt:new Date().toISOString(), blockedAttempts:[] };
function denied(operation) {
  return function () {
    state.blockedAttempts.push({operation,at:new Date().toISOString()});
    throw Object.assign(new Error(`Offline Work1 batch forbids ${operation}.`),{code:'WORK1_OFFLINE_DENIED'});
  };
}
function replace(object, keys, prefix) {
  for(const key of keys)if(typeof object[key]==='function')object[key]=denied(`${prefix}.${key}`);
}
const net=require('node:net');
replace(net,['connect','createConnection','createServer'],'net');
replace(net.Socket.prototype,['connect'],'net.Socket');
replace(net.Server.prototype,['listen'],'net.Server');
const tls=require('node:tls');replace(tls,['connect','createServer'],'tls');
for(const name of ['http','https','http2']) {
  const mod=require('node:'+name);
  replace(mod,['get','request','connect','createServer','createSecureServer'],'node:'+name);
}
const dns=require('node:dns');
const dnsMethods=['lookup','lookupService','resolve','resolve4','resolve6','resolveAny','resolveCaa','resolveCname','resolveMx','resolveNaptr','resolveNs','resolvePtr','resolveSoa','resolveSrv','resolveTxt','reverse'];
replace(dns,dnsMethods,'dns');replace(dns.promises,dnsMethods,'dns.promises');
replace(dns.Resolver.prototype,dnsMethods,'dns.Resolver');
replace(dns.promises.Resolver.prototype,dnsMethods,'dns.promises.Resolver');
const dgram=require('node:dgram');replace(dgram,['createSocket'],'dgram');replace(dgram.Socket.prototype,['connect','send','bind'],'dgram.Socket');
replace(require('node:child_process'),['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'],'child_process');
replace(require('node:worker_threads'),['Worker'],'worker_threads');
globalThis.fetch=denied('fetch');
globalThis.WebSocket=denied('WebSocket');
globalThis.EventSource=denied('EventSource');
syncBuiltinESMExports();
Object.defineProperty(globalThis,Symbol.for('trichur.work1.offlineGuard'),{value:state,writable:false});
module.exports=state;
