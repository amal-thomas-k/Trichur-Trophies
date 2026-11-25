// All probes are intercepted synchronously before any operating-system call.
import assert from 'node:assert/strict';
import {connect,Socket} from 'node:net';
import {request} from 'node:https';
import {lookup} from 'node:dns/promises';
import {createSocket} from 'node:dgram';
import {spawn} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import fs from 'node:fs/promises';
const guard=globalThis[Symbol.for('trichur.work1.offlineGuard')];
assert.ok(guard,'Preload scripts/work1-offline-guard.cjs before running this check.');
for(const probe of [()=>connect(1,'127.0.0.1'),()=>new Socket().connect(1,'127.0.0.1'),()=>request('https://example.invalid'),()=>lookup('example.invalid'),()=>createSocket('udp4'),()=>spawn('does-not-run'),()=>new Worker('does-not-run'),()=>fetch('https://example.invalid'),()=>new WebSocket('wss://example.invalid')]) {
  assert.throws(probe,{code:'WORK1_OFFLINE_DENIED'});
}
assert.equal(guard.blockedAttempts.length,9);
assert.ok((await fs.readFile(new URL('./work1-offline-guard.cjs',import.meta.url),'utf8')).includes('syncBuiltinESMExports'));
console.log(JSON.stringify({ok:true,probes:9,networkOrChildOperationsPerformed:0,guard:guard.version,filesystemReadable:true}));
