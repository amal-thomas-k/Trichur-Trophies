// Offline, explicit retention. Dry-run is the default. Never erases current work.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { assertStopped } from './backup.js';

export function applyRetention(directory,{days=365,apply=false,at=Date.now()}={}) {
 directory=path.resolve(directory);
 if(!Number.isInteger(days)||days<1||days>36500)throw new Error('Retention days must be an integer from 1 to 36500.');
 if(!fs.existsSync(path.join(directory,'app.sqlite')))throw new Error('No application database found.');
 assertStopped(directory);
 const maintenance=path.join(directory,'maintenance.lock'),lock=fs.openSync(maintenance,'wx');
 let db;
 try {
  fs.writeSync(lock,JSON.stringify({pid:process.pid,operation:'retention',startedAt:new Date(at).toISOString()}));assertStopped(directory);
  db=new DatabaseSync(path.join(directory,'app.sqlite'));db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  const all=(sql,...args)=>db.prepare(sql).all(...args),one=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
  const cutoff=new Date(at-days*86400000).toISOString();
  const candidates=[];
  for(const row of all('SELECT * FROM orders')) {
   const o=JSON.parse(row.doc); // An archive is deliberate; an old active order is retained.
   if(!o.archivedAt||o.archivedAt>=cutoff)continue;
   if(one("SELECT id FROM jobs WHERE order_id=? AND status IN ('queued','running') LIMIT 1",row.id))continue;
   const newest=one('SELECT max(created_at) AS time FROM audit WHERE order_id=?',row.id)?.time;
   if(newest&&newest>=cutoff)continue;
   candidates.push({id:row.id,title:o.title,archivedAt:o.archivedAt,assets:one('SELECT count(*) n FROM assets WHERE order_id=?',row.id).n,approvals:one('SELECT count(*) n FROM approvals WHERE order_id=?',row.id).n});
  }
  const report={dryRun:!apply,days,cutoff,candidates,purged:[],warnings:[],policy:'Only explicitly archived orders past retention, with no queued/running jobs or recent audit activity. Existing approvals and outputs remain until that condition is met.'};
  if(!apply)return report;
  for(const candidate of candidates) {
   // File roots are derived from DB IDs, never from customer-supplied filenames.
   const roots=[...all('SELECT id FROM assets WHERE order_id=?',candidate.id).map(r=>['assets',r.id]),...all('SELECT id FROM jobs WHERE order_id=?',candidate.id).map(r=>['renders',r.id]),...all('SELECT id FROM print_jobs WHERE order_id=?',candidate.id).map(r=>['exports',r.id])];
   for(const [,identifier] of roots)if(!/^[a-zA-Z0-9_-]{8,100}$/.test(identifier))throw new Error('Unexpected stored identifier; retention stopped before deletion.');
   const targets=roots.map(([section,identifier])=>path.resolve(directory,section,identifier));
   for(const target of targets){if(!target.startsWith(directory+path.sep))throw new Error('Retention target escapes DATA_DIR.');if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error('Refusing a symbolic link in retained storage.');}
   db.exec('BEGIN IMMEDIATE');
   try{
    run('DELETE FROM recipient_revisions WHERE recipient_id IN (SELECT id FROM recipients WHERE order_id=?)',candidate.id);
    for(const table of ['print_jobs','approvals','jobs','proofs','assets','recipients','groups','links','audit'])run(`DELETE FROM ${table} WHERE order_id=?`,candidate.id);
    for(const s of all('SELECT id,actor FROM sessions')){if(JSON.parse(s.actor).orderId===candidate.id)run('DELETE FROM sessions WHERE id=?',s.id);}
    run('DELETE FROM orders WHERE id=?',candidate.id);db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   for(const target of targets)try{fs.rmSync(target,{recursive:true,force:true});}catch(error){report.warnings.push(`Unreferenced private files remain at ${target}: ${error.code||error.message}`);}
   report.purged.push(candidate.id);
  }
  run('DELETE FROM sessions WHERE expires_at<?',at);
  fs.appendFileSync(path.join(directory,'retention-log.jsonl'),JSON.stringify({...report,executedAt:new Date(at).toISOString()})+'\n');
  return report;
 }finally{db?.close();fs.closeSync(lock);fs.unlinkSync(maintenance);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const i=process.argv.indexOf('--days');console.log(JSON.stringify(applyRetention(process.env.DATA_DIR||'data',{days:Number(i<0?process.env.RETENTION_DAYS||365:process.argv[i+1]),apply:process.argv.includes('--apply')}),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
