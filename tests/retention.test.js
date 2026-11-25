import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { applyRetention } from '../scripts/retention.js';

function fixture(){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tt-retention-'));const result=spawnSync(process.execPath,['--input-type=module','-e',"import {db} from './src/db.js';db.close()"],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,DATA_DIR:directory},encoding:'utf8'});assert.equal(result.status,0,result.stderr);const db=new DatabaseSync(path.join(directory,'app.sqlite'));return{directory,db};}
function addOrder(db,id,{archivedAt,createdAt='2020-01-01T00:00:00.000Z'}={}){db.prepare('INSERT INTO orders(id,revision,doc,created_at) VALUES(?,1,?,?)').run(id,JSON.stringify({id,title:id,archivedAt}),createdAt);}
const at=Date.parse('2026-11-20T00:00:00Z');
test('retention is dry-run by default and retains active, recently archived and unfinished orders',()=>{
 const{directory,db}=fixture();addOrder(db,'old-archived',{archivedAt:'2020-01-01T00:00:00.000Z'});addOrder(db,'old-active');addOrder(db,'recent-archived',{archivedAt:'2026-11-19T00:00:00.000Z'});addOrder(db,'pending-job',{archivedAt:'2020-01-01T00:00:00.000Z'});
 db.prepare("INSERT INTO jobs(id,order_id,kind,status,payload,created_at,updated_at) VALUES('pendingjob01','pending-job','render','queued','{}','2020-01-01','2020-01-01')").run();db.close();
 const r=applyRetention(directory,{days:365,at});assert.equal(r.dryRun,true);assert.deepEqual(r.candidates.map(o=>o.id),['old-archived']);const read=new DatabaseSync(path.join(directory,'app.sqlite'));assert.equal(read.prepare('SELECT count(*) n FROM orders').get().n,4);read.close();
});
test('explicit purge removes expired archived data in FK order while preserving active approvals and files',()=>{
 const{directory,db}=fixture();addOrder(db,'purge-order',{archivedAt:'2020-01-01T00:00:00.000Z'});addOrder(db,'keep-order');
 db.prepare("INSERT INTO approvals(id,order_id,revision,doc,created_at) VALUES('oldapproval','purge-order',1,'{}','2020-01-01')").run();db.prepare("INSERT INTO approvals(id,order_id,revision,doc,created_at) VALUES('keepapproval','keep-order',1,'{}','2020-01-01')").run();
 db.prepare("INSERT INTO print_jobs(id,order_id,approval_id,revision,status,doc,created_at) VALUES('oldprintjob01','purge-order','oldapproval',1,'printed','{}','2020-01-01')").run();
 db.prepare("INSERT INTO print_jobs(id,order_id,approval_id,revision,status,doc,created_at) VALUES('keepprintjob01','keep-order','keepapproval',1,'printed','{}','2020-01-01')").run();db.close();
 for(const folder of ['oldprintjob01','keepprintjob01']){fs.mkdirSync(path.join(directory,'exports',folder),{recursive:true});fs.writeFileSync(path.join(directory,'exports',folder,'print.pdf'),'private fixture');}
 const r=applyRetention(directory,{days:365,at,apply:true});assert.deepEqual(r.purged,['purge-order']);assert.equal(fs.existsSync(path.join(directory,'exports','oldprintjob01')),false);assert.equal(fs.existsSync(path.join(directory,'exports','keepprintjob01','print.pdf')),true);
 const read=new DatabaseSync(path.join(directory,'app.sqlite'));assert.equal(read.prepare('SELECT count(*) n FROM approvals').get().n,1);assert.equal(read.prepare('SELECT id FROM orders').get().id,'keep-order');read.close();
});
test('retention refuses live services and invalid periods',()=>{const{directory,db}=fixture();db.close();assert.throws(()=>applyRetention(directory,{days:0}),/Retention days/);fs.writeFileSync(path.join(directory,'worker.lock'),JSON.stringify({pid:process.pid}));assert.throws(()=>applyRetention(directory,{apply:true}),/running process/);assert.equal(fs.existsSync(path.join(directory,'maintenance.lock')),false);});
