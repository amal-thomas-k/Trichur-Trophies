import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-jobs-'));
process.env.DATA_DIR = temporary;
process.env.JOB_LEASE_MS = '3000';
const { db, run, one } = await import('../src/db.js');
const { claimJob, recoverExpiredJobs, piecesFromApproval, runOneJob, acquireLock } = await import('../src/worker.js');
const stamp = new Date().toISOString();
run('INSERT INTO orders(id,revision,doc,created_at) VALUES(?,?,?,?)', 'order-test', 1, '{}', stamp);
const addJob = (id, kind = 'render', status = 'queued', options = {}) => run(
  'INSERT INTO jobs(id,order_id,kind,status,payload,priority,attempts,locked_until,cancelled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  id, 'order-test', kind, status, JSON.stringify(options.payload || {}), options.priority ?? 0, options.attempts || 0, options.lockedUntil || 0, options.cancelled || 0, stamp, stamp,
);
const clearJobs = () => run('DELETE FROM jobs');

test('an expired worker lease recovers a durable job without marking it successful', () => {
  clearJobs(); addJob('lease', 'render', 'running', { attempts: 1, lockedUntil: 10 });
  assert.equal(recoverExpiredJobs(20), 1);
  const job = one('SELECT * FROM jobs WHERE id=?', 'lease');
  assert.equal(job.status, 'queued'); assert.equal(job.progress, 0); assert.equal(job.result, null);
  const claimed = claimJob('replacement', 25);
  assert.equal(claimed.id, 'lease'); assert.equal(claimed.attempts, 2);
  assert.equal(claimJob('another', 25), null);
});

test('cancelled or retry-exhausted jobs are not silently rerun', () => {
  clearJobs();
  addJob('cancel', 'render', 'running', { cancelled: 1, attempts: 1, lockedUntil: 5 });
  addJob('exhausted', 'render', 'running', { attempts: 3, lockedUntil: 5 });
  recoverExpiredJobs(10);
  assert.equal(one('SELECT status FROM jobs WHERE id=?', 'cancel').status, 'cancelled');
  assert.equal(one('SELECT status FROM jobs WHERE id=?', 'exhausted').status, 'failed');
  assert.equal(claimJob('worker', 10), null);
});

test('a waiting export cannot be starved by more than five consecutive proofs', () => {
  clearJobs();
  for (let i = 0; i < 12; i++) addJob(`proof-${i}`, 'render');
  addJob('batch', 'export', 'queued', { priority: 10 });
  const kinds = [];
  for (let i = 0; i < 6; i++) {
    const job = claimJob('fair', Date.now());
    kinds.push(job.kind); run('DELETE FROM jobs WHERE id=?', job.id);
  }
  assert.ok(kinds.includes('export'));
});

test('paused maintenance blocks claiming new work', () => {
  clearJobs(); addJob('pause'); fs.writeFileSync(path.join(temporary, 'maintenance.lock'), 'offline backup');
  assert.equal(claimJob(), null); fs.unlinkSync(path.join(temporary, 'maintenance.lock'));
});

test('worker refuses another live process lock or malformed PID', () => {
  const lock = path.join(temporary, 'worker.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  assert.throws(() => acquireLock(), /already running|Cannot safely verify/);
  assert.equal(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, process.pid);
  fs.writeFileSync(lock, JSON.stringify({ pid: -1 }));
  assert.throws(() => acquireLock(), /Invalid worker process lock/);
  fs.unlinkSync(lock);
});

const approved = {
  recipients: [{
    recipient: { id: 'person-1', name: 'Synthetic identity', copies: 2 },
    template: { id: 'tpl', modelCode: '727', components: [{ id: 'front' }, { id: 'base' }] },
    proof: { artworks: [{ id: 'a', componentId: 'front', path: 'front.png', sha256: 'front-hash', widthMm: 34, heightMm: 34 }, { id: 'b', componentId: 'base', path: 'base.png', sha256: 'base-hash', widthMm: 60, heightMm: 18 }] },
  }],
};

test('approved recipients, copies and paired components expand into exact pieces', () => {
  const pieces = piecesFromApproval(approved);
  assert.equal(pieces.length, 4);
  assert.equal(new Set(pieces.map(p => p.id)).size, 4);
  assert.deepEqual(pieces.map(p => p.id), ['person-1:front:1', 'person-1:front:2', 'person-1:base:1', 'person-1:base:2']);
  assert.equal(pieces.every(p => p.templateId === 'tpl'), true);
});

test('reprints contain only deliberately selected approved pieces', () => {
  assert.deepEqual(piecesFromApproval(approved, ['person-1:base:2']).map(p => p.id), ['person-1:base:2']);
  assert.throws(() => piecesFromApproval(approved, ['unknown']), /outside/);
  assert.throws(() => piecesFromApproval(approved, ['person-1:base:2', 'person-1:base:2']), /Duplicate/);
  assert.throws(() => piecesFromApproval(approved, []), /explicit/);
});

test('missing canonical component cannot create a sample-only successful export', () => {
  const missing = structuredClone(approved); missing.recipients[0].proof.artworks.pop();
  assert.throws(() => piecesFromApproval(missing), /missing/);
});

test('a malformed job records a real failure and never publishes an artifact', async () => {
  clearJobs(); addJob('bad-render', 'render', 'queued', { payload: { snapshot: {} } });
  const job = claimJob('test-bad', Date.now());
  await runOneJob(job);
  assert.equal(one('SELECT status FROM jobs WHERE id=?', 'bad-render').status, 'failed');
  assert.equal(one('SELECT COUNT(*) AS count FROM proofs').count, 0);
});

async function approvedFixture(approvalId) {
  const { sharp } = await import('../src/deps.js');
  const bytes = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#34647c' } }).png().toBuffer();
  const file = path.join(temporary, 'renders', `${approvalId}.png`); fs.writeFileSync(file, bytes);
  const fixture = structuredClone(approved);
  for (const art of fixture.recipients[0].proof.artworks) {
    art.path = file; art.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const approval = { id: approvalId, ...fixture };
  approval.snapshotHash = crypto.createHash('sha256').update(JSON.stringify(approval)).digest('hex');
  run('INSERT INTO approvals(id,order_id,revision,doc,created_at) VALUES(?,?,?,?,?)', approvalId, 'order-test', 1, JSON.stringify(approval), stamp);
  return fixture;
}

test('exporting an older approved snapshot creates real artwork but marks output superseded', async () => {
  clearJobs(); await approvedFixture('approved-old');
  run('UPDATE orders SET doc=? WHERE id=?', JSON.stringify({ approvalId: null }), 'order-test');
  addJob('old-export', 'export', 'queued', { payload: { approvalId: 'approved-old', diagnostic: true, includeImages: false } });
  await runOneJob(claimJob('export-test', Date.now()));
  const job = one('SELECT * FROM jobs WHERE id=?', 'old-export');
  assert.equal(job.status, 'completed', job.error);
  const print = one('SELECT * FROM print_jobs WHERE id=?', JSON.parse(job.result).printJobId);
  assert.equal(print.status, 'superseded');
  const doc = JSON.parse(print.doc);
  assert.ok(fs.readFileSync(doc.pdfPath).subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.equal(doc.manifest.placements.length, 4);
  assert.equal(doc.diagnostic, true);
});

test('selected reprint actually exports only one chosen component and copy', async () => {
  clearJobs(); await approvedFixture('approved-reprint');
  run('UPDATE orders SET doc=? WHERE id=?', JSON.stringify({ approvalId: 'approved-reprint' }), 'order-test');
  addJob('selected-export', 'export', 'queued', { payload: { approvalId: 'approved-reprint', diagnostic: true, includeImages: false, selection: [{ recipientId: 'person-1', componentId: 'base', copyNumber: 2 }] } });
  await runOneJob(claimJob('reprint-test', Date.now()));
  const job = one('SELECT * FROM jobs WHERE id=?', 'selected-export');
  assert.equal(job.status, 'completed', job.error);
  const print = one('SELECT * FROM print_jobs WHERE id=?', JSON.parse(job.result).printJobId);
  assert.equal(print.status, 'generated');
  assert.deepEqual(JSON.parse(print.doc).manifest.placements.map(p => p.pieceId), ['person-1:base:2']);
});

test('modified approved image fails its hash check before a PDF is published', async () => {
  clearJobs(); const fixture = await approvedFixture('approved-tamper');
  fs.appendFileSync(fixture.recipients[0].proof.artworks[0].path, 'tampered');
  const before = one('SELECT COUNT(*) AS n FROM print_jobs').n;
  addJob('tampered-export', 'export', 'queued', { payload: { approvalId: 'approved-tamper', diagnostic: true, includeImages: false } });
  await runOneJob(claimJob('tamper-test', Date.now()));
  const job = one('SELECT * FROM jobs WHERE id=?', 'tampered-export');
  assert.equal(job.status, 'failed'); assert.match(job.error, /hash mismatch/);
  assert.equal(one('SELECT COUNT(*) AS n FROM print_jobs').n, before);
});

test('worker independently blocks production export without printer calibration', async () => {
  clearJobs(); await approvedFixture('approved-uncalibrated');
  const before = one('SELECT COUNT(*) AS n FROM print_jobs').n;
  addJob('uncalibrated-export', 'export', 'queued', { payload: { approvalId: 'approved-uncalibrated', diagnostic: false, includeImages: false } });
  await runOneJob(claimJob('calibration-test', Date.now()));
  const job = one('SELECT * FROM jobs WHERE id=?', 'uncalibrated-export');
  assert.equal(job.status, 'failed'); assert.match(job.error, /calibrat/i);
  assert.equal(one('SELECT COUNT(*) AS n FROM print_jobs').n, before);
});

test('modified approval snapshot fails before any export can publish', async () => {
  clearJobs(); await approvedFixture('approved-snapshot-tamper');
  const row = one('SELECT doc FROM approvals WHERE id=?', 'approved-snapshot-tamper');
  const changed = JSON.parse(row.doc); changed.recipients[0].recipient.copies = 3;
  run('UPDATE approvals SET doc=? WHERE id=?', JSON.stringify(changed), 'approved-snapshot-tamper');
  const before = one('SELECT COUNT(*) AS n FROM print_jobs').n;
  addJob('snapshot-tampered-export', 'export', 'queued', { payload: { approvalId: 'approved-snapshot-tamper', diagnostic: true, includeImages: false } });
  await runOneJob(claimJob('snapshot-tamper-test', Date.now()));
  const job = one('SELECT * FROM jobs WHERE id=?', 'snapshot-tampered-export');
  assert.equal(job.status, 'failed'); assert.match(job.error, /snapshot hash mismatch/);
  assert.equal(one('SELECT COUNT(*) AS n FROM print_jobs').n, before);
});

test.after(() => { db.close(); });
