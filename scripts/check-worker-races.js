// Uses an existing synthetic stress instance only. Never point at customer data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory = process.argv[2];
if (!directory || !path.basename(directory).startsWith('stress-')) throw new Error('Pass an isolated synthetic stress-* data directory.');
process.env.DATA_DIR = path.resolve(directory);
const { all, one, run, parse } = await import('../src/db.js');
const { enqueue, snapshotFor, saveRecipient } = await import('../src/domain.js');
const { claimJob, runOneJob } = await import('../src/worker.js');
const { closeRenderer } = await import('../src/render.js');
const actor = { id: 'race-qa', role: 'admin' };
const row = one('SELECT * FROM recipients ORDER BY rowid LIMIT 1');
if (!row) throw new Error('No synthetic recipient found.');
const recipient = parse(row);
const initialProof = recipient.proofId;
const initialReviewed = recipient.reviewedRevision;
const initialProofCount = one('SELECT COUNT(*) AS n FROM proofs').n;
const report = { dataDir: process.env.DATA_DIR, tests: [] };
try {
  enqueue(actor, recipient.orderId, 'render', { snapshot: snapshotFor(recipient.id), recipientId: recipient.id, revision: recipient.revision }, 1);
  await runOneJob(claimJob('duplicate-race-test'));
  const afterDuplicate = parse(one('SELECT * FROM recipients WHERE id=?', recipient.id));
  assert.equal(afterDuplicate.proofId, initialProof);
  assert.equal(afterDuplicate.reviewedRevision, initialReviewed);
  assert.equal(one('SELECT COUNT(*) AS n FROM proofs').n, initialProofCount);
  report.tests.push('Duplicate render of same revision reuses the reviewed canonical proof without changing approval');

  const snapshot = snapshotFor(recipient.id);
  const queued = enqueue(actor, recipient.orderId, 'render', { snapshot, recipientId: recipient.id, revision: recipient.revision }, 1);
  const job = claimJob('late-race-test');
  assert.equal(job.id, queued.id);
  const rendering = runOneJob(job);
  const changed = saveRecipient(actor, recipient.orderId, recipient.id, { ...recipient, name: 'Changed QA name', expectedRevision: recipient.revision });
  await rendering;
  const afterLate = parse(one('SELECT * FROM recipients WHERE id=?', recipient.id));
  assert.equal(afterLate.revision, changed.revision);
  assert.equal(afterLate.name, 'Changed QA name');
  assert.equal(afterLate.proofId, null);
  assert.equal(afterLate.reviewedRevision, null);
  const finished = one('SELECT result,status,error FROM jobs WHERE id=?', queued.id);
  assert.equal(finished.status, 'completed', finished.error);
  assert.equal(JSON.parse(finished.result).superseded, true);
  assert.equal(parse(one('SELECT * FROM orders WHERE id=?', recipient.orderId)).approvalId, null);
  report.tests.push('A late render cannot attach to a newer name revision; review and order approval remain invalidated');

  const cancellationSnapshot = snapshotFor(recipient.id);
  const cancelJob = enqueue(actor, recipient.orderId, 'render', { snapshot: cancellationSnapshot, recipientId: recipient.id, revision: cancellationSnapshot.recipient.revision }, 1);
  const proofCountBeforeCancel = one('SELECT COUNT(*) AS n FROM proofs').n;
  const cancellationRun = runOneJob(claimJob('cancel-race-test'));
  await new Promise(resolve => setTimeout(resolve, 100));
  run('UPDATE jobs SET cancelled=1 WHERE id=?', cancelJob.id);
  await cancellationRun;
  const cancelled = one('SELECT * FROM jobs WHERE id=?', cancelJob.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.result, null);
  assert.equal(one('SELECT COUNT(*) AS n FROM proofs').n, proofCountBeforeCancel);
  assert.equal(parse(one('SELECT * FROM recipients WHERE id=?', recipient.id)).proofId, null);
  report.tests.push('Cancellation during actual rendering publishes neither a proof nor a success result');
  report.passed = true;
} finally {
  await closeRenderer();
  const output = path.resolve('artifacts', 'worker-races.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
