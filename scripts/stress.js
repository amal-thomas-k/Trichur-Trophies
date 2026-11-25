// Actual worker/render/export stress run. Isolated data; never edits customer orders.
// node scripts/stress.js --count 500  (use --count 12 for a separate smoke test)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const resumeDirectory = arg('--resume');
let count = Number(arg('--count') || 500);
if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('--count must be 1 to 1000.');
const root = path.resolve(import.meta.dirname, '..');
const runId = resumeDirectory ? `${path.basename(resumeDirectory)}-resume-${Date.now()}` : `stress-${count}-${Date.now()}`;
const dataDir = path.resolve(resumeDirectory || arg('--data-dir') || path.join(root, 'data', runId));
if (resumeDirectory && (!path.basename(dataDir).startsWith('stress-') || !fs.existsSync(path.join(dataDir, 'app.sqlite')))) throw new Error('--resume must identify an existing isolated synthetic stress-* instance.');
if (!resumeDirectory && fs.existsSync(path.join(dataDir, 'app.sqlite'))) throw new Error('Stress destination already contains a database. Choose a new directory or --resume.');
process.env.DATA_DIR = dataDir;
process.env.JOB_LEASE_MS = '4000';
const { DATA } = await import('../src/config.js');
const { db, run, one, all, tx, parse } = await import('../src/db.js');
const { sharp, pdfLib } = await import('../src/deps.js');
const { snapshotFor, enqueue, reviewRecipient, approveOrder, requestExport, getOrder } = await import('../src/domain.js');
const { piecesFromApproval } = await import('../src/worker.js');
const { MM_TO_PT } = await import('../src/packing.js');
if (resumeDirectory) count = one('SELECT COUNT(*) AS n FROM recipients').n;
const { PDFDocument } = pdfLib;
const actor = { id: 'stress-operator', role: 'admin' };
const now = () => new Date().toISOString();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let child;
let peakWorkerRss = 0;
let peakWorkerHeap = 0;
let lastWorkerError = '';
const report = { runId, count, dataDir, startedAt: now(), imageDimensions: [1200, 1600], sourceFixtureCount: Math.min(count, 10), rendererDpi: 300, crashRestart: false, tests: [] };
report.sourceCodeSha256 = Object.fromEntries(['src/worker.js', 'src/render.js', 'src/packing.js', 'src/domain.js', 'scripts/stress.js'].map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const reportDir = path.join(root, 'artifacts'); fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `${runId}.json`);
const started = performance.now();

function startWorker() {
  const worker = fork(path.join(root, 'src', 'worker.js'), [], { cwd: root, env: { ...process.env, DATA_DIR: dataDir, JOB_LEASE_MS: '4000' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  worker.stdout.on('data', bytes => process.stdout.write(bytes));
  worker.stderr.on('data', bytes => { lastWorkerError = bytes.toString(); process.stderr.write(bytes); });
  worker.on('message', message => {
    if (message.type === 'worker-metrics') {
      peakWorkerRss = Math.max(peakWorkerRss, message.rss);
      peakWorkerHeap = Math.max(peakWorkerHeap, message.heapUsed);
    }
  });
  return worker;
}

async function stopWorker(force = false) {
  if (!child || child.exitCode !== null) return;
  const done = new Promise(resolve => child.once('exit', resolve));
  child.kill(force ? 'SIGKILL' : 'SIGTERM');
  await done;
}

try {
  let orderId = crypto.randomUUID(), groupId = crypto.randomUUID(), templateId = 'synthetic-stress-v1';
  if (resumeDirectory) {
    const previous = one('SELECT * FROM orders ORDER BY rowid LIMIT 1');
    if (!previous || all('SELECT * FROM orders').length !== 1) throw new Error('Only a single synthetic stress order can be resumed.');
    orderId = previous.id;
    report.resumed = true;
    report.preservedProofCount = one('SELECT COUNT(*) AS n FROM proofs').n;
    report.originalStartedAt = one('SELECT MIN(created_at) AS at FROM jobs').at;
    report.lastPreviousCompletedAt = one("SELECT MAX(updated_at) AS at FROM jobs WHERE status='completed'").at;
    report.originalRestartEvidence = all('SELECT id,attempts,status FROM jobs WHERE attempts>1');
    report.crashRestart = report.originalRestartEvidence.length > 0;
    report.initialJobCounts = all('SELECT status,COUNT(*) AS n FROM jobs GROUP BY status');
    report.timingNote = 'Execution was interrupted by loss of the host connection. Render/export/total seconds below measure this resumed segment only; original elapsed wall time includes the outage and is not a throughput benchmark. Memory samples cover the resumed worker only.';
    report.datasetDescription = 'Ten synthetic graphic portraits at phone-like 1200x1600 resolution, reused across distinct recipient assets. Compressed sizes are smaller than detailed camera photographs.';
    report.sourceFixtureBytes = [...new Set(all('SELECT doc FROM assets').map(row => JSON.parse(row.doc).path))].map(file => fs.statSync(file).size);
    fs.writeFileSync(reportPath, JSON.stringify({ ...report, status: 'resuming' }, null, 2));
  } else {
  report.orderId = orderId;
  const template = {
    id: templateId, modelCode: 'SYNTHETIC STRESS', version: 1, synthetic: true,
    calibrationStatus: 'unverified', preparationNote: 'Synthetic QA geometry only; never represents a source trophy.',
    components: [
      { id: 'front', name: 'Front', widthMm: 50, heightMm: 70, photo: { x: 7, y: 15, width: 36, height: 36, shape: 'circle' }, headingBox: { x: 3, y: 5, width: 44, height: 8, minFontMm: 2, maxFontMm: 3 }, nameBox: { x: 3, y: 53, width: 44, height: 9, minFontMm: 2.5, maxFontMm: 4 }, achievementBox: { x: 3, y: 63, width: 44, height: 4, minFontMm: 1.8, maxFontMm: 2.3 }, allowRotation: true, media: 'photo-paper', bleedMm: 0 },
      { id: 'base', name: 'Base', widthMm: 60, heightMm: 30, headingBox: { x: 3, y: 2, width: 54, height: 6, minFontMm: 1.8, maxFontMm: 2.2 }, nameBox: { x: 3, y: 9, width: 54, height: 8, minFontMm: 2.5, maxFontMm: 3 }, eventBox: { x: 3, y: 19, width: 54, height: 4, minFontMm: 1.6, maxFontMm: 1.8 }, achievementBox: { x: 3, y: 25, width: 54, height: 4, minFontMm: 1.5, maxFontMm: 1.8 }, allowRotation: true, media: 'photo-paper', bleedMm: 0 },
    ],
  };
  const shared = { heading: 'Synthetic QA award', event: '500-record worker stress', date: '' };
  tx(() => {
    run('INSERT INTO templates(id,doc,created_at) VALUES(?,?,?)', templateId, JSON.stringify(template), now());
    run('INSERT INTO orders(id,revision,doc,created_at) VALUES(?,1,?,?)', orderId, JSON.stringify({ id: orderId, title: `${count} synthetic stress recipients`, shared, status: 'collecting', approvalId: null }), now());
    run('INSERT INTO groups(id,order_id,template_id,doc) VALUES(?,?,?,?)', groupId, orderId, templateId, JSON.stringify({ id: groupId, orderId, templateId, label: 'Paired components', expectedQuantity: count, shared: {} }));
  });
  const sourceImages = [];
  for (let i = 0; i < Math.min(count, 10); i++) {
    const color = ['#5686a5', '#658d72', '#bd8a59', '#845e9e', '#bf6f71'][i % 5];
    const svg = `<svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#e8e6de"/></linearGradient></defs><rect width="1200" height="1600" fill="url(#g)"/><circle cx="600" cy="610" r="280" fill="#dac6ac"/><path d="M120 1600 Q150 910 600 940 Q1050 910 1080 1600" fill="${color}"/><rect x="515" y="600" width="45" height="25" rx="10" fill="#263843"/><rect x="650" y="600" width="45" height="25" rx="10" fill="#263843"/><path d="M520 760 Q600 810 680 760" fill="none" stroke="#8f6453" stroke-width="12"/><circle cx="${150 + i * 85}" cy="130" r="65" fill="white" opacity="0.6"/></svg>`;
    const bytes = await sharp(Buffer.from(svg)).jpeg({ quality: 94 }).toBuffer();
    const file = path.join(DATA, 'assets', `synthetic-${i}.jpg`); fs.writeFileSync(file, bytes);
    sourceImages.push({ path: file, sha256: sha(bytes), width: 1200, height: 1600, originalFilename: `synthetic-portrait-${i}.jpg` });
  }
  report.sourceFixtureBytes = sourceImages.map(image => fs.statSync(image.path).size);
  report.datasetDescription = 'Ten synthetic graphic portraits at phone-like 1200x1600 resolution, reused across distinct recipient assets. Their compressed sizes are smaller than detailed camera photographs; this is a controlled synthetic workload, not a real-phone throughput guarantee.';
  tx(() => {
    for (let i = 0; i < count; i++) {
      const recipientId = crypto.randomUUID(), assetId = crypto.randomUUID();
      const r = { id: recipientId, orderId, groupId, name: `${i % 7 === 0 ? '\u0d05\u0d2e\u0d7d' : 'Test'} ${String(i + 1).padStart(3, '0')}`, achievement: `QA ${i + 1}`, copies: 1 + i % 3, crop: { x: ((i % 3) - 1) * 0.15, y: 0, zoom: 1 + (i % 4) * 0.1, rotation: i % 10 === 0 ? 90 : 0 }, assetId, revision: 1, reviewedRevision: null, proofId: null, createdBy: actor.id };
      const asset = { id: assetId, orderId, recipientId, ...sourceImages[i % sourceImages.length] };
      run('INSERT INTO recipients(id,order_id,group_id,revision,doc) VALUES(?,?,?,?,?)', recipientId, orderId, groupId, 1, JSON.stringify(r));
      run('INSERT INTO assets(id,order_id,recipient_id,upload_id,sha256,doc) VALUES(?,?,?,?,?,?)', assetId, orderId, recipientId, `stress-${i}`, asset.sha256, JSON.stringify(asset));
    }
  });
  for (const recipient of all('SELECT id FROM recipients')) {
    const snapshot = snapshotFor(recipient.id);
    enqueue(actor, orderId, 'render', { snapshot, recipientId: recipient.id, revision: 1 }, 1);
  }
  }
  report.orderId = orderId;
  report.preparationSeconds = (performance.now() - started) / 1000;
  const renderStarted = performance.now();
  child = startWorker();
  let interruptedJobId;
  let lastReport = 0;
  while (true) {
    const counts = Object.fromEntries(all('SELECT status,COUNT(*) AS n FROM jobs GROUP BY status').map(r => [r.status, r.n]));
    if (counts.failed) throw new Error(all("SELECT id,error FROM jobs WHERE status='failed'").map(j => `${j.id}: ${j.error}`).join('\n'));
    if ((counts.completed || 0) >= count) break;
    if (!report.crashRestart && (counts.completed || 0) >= Math.min(3, Math.floor(count / 3)) && counts.running) {
      interruptedJobId = one("SELECT id FROM jobs WHERE status='running'").id;
      await stopWorker(true);
      report.crashRestart = true;
      report.interruptedJobId = interruptedJobId;
      child = startWorker();
    }
    if (performance.now() - lastReport > 10000) {
      console.log(`Proofs ${counts.completed || 0}/${count}, queued ${counts.queued || 0}, running ${counts.running || 0}.`);
      fs.writeFileSync(reportPath, JSON.stringify({ ...report, status: 'rendering', completedProofJobs: counts.completed || 0, checkpointAt: now(), peakNodeWorkerRssBytes: peakWorkerRss, peakNodeWorkerHeapBytes: peakWorkerHeap }, null, 2));
      lastReport = performance.now();
    }
    if (child.exitCode !== null) throw new Error(`Worker exited ${child.exitCode}: ${lastWorkerError}`);
    if (performance.now() - renderStarted > 3600000) throw new Error('Stress run exceeded its 60-minute deadline.');
    await sleep(500);
  }
  report.renderSeconds = (performance.now() - renderStarted) / 1000;
  report.renderedInThisSegment = count - (report.preservedProofCount || 0);
  assert.equal(one('SELECT COUNT(*) AS n FROM proofs').n, count);
  assert.equal(one('SELECT COUNT(DISTINCT recipient_id) AS n FROM proofs').n, count);
  if (interruptedJobId) assert.ok(one('SELECT attempts FROM jobs WHERE id=?', interruptedJobId).attempts >= 2);
  report.tests.push('Exactly one current proof per recipient after forced worker restart');
  for (const recipient of all('SELECT * FROM recipients').map(parse)) {
    assert.ok(recipient.proofId);
    reviewRecipient(actor, recipient.id, { expectedRevision: recipient.revision, proofId: recipient.proofId });
  }
  const approval = approveOrder(actor, orderId, { expectedRevision: getOrder(orderId).revision, confirm: true });
  report.approvalId = approval.id;
  const exportStarted = performance.now();
  const exportJob = requestExport(actor, orderId, { diagnostic: true });
  // Full stress defaults to PDF only; --images additionally exercises approved PNG/JPEG ZIP.
  const exportRow = one('SELECT payload FROM jobs WHERE id=?', exportJob.id);
  run('UPDATE jobs SET payload=? WHERE id=?', JSON.stringify({ ...JSON.parse(exportRow.payload), includeImages: process.argv.includes('--images') }), exportJob.id);
  let completed;
  while (true) {
    completed = one('SELECT * FROM jobs WHERE id=?', exportJob.id);
    if (completed.status === 'completed') break;
    if (completed.status === 'failed') throw new Error(completed.error);
    if (child.exitCode !== null) throw new Error(`Worker exited ${child.exitCode}: ${lastWorkerError}`);
    if (performance.now() - exportStarted > 900000) throw new Error('PDF export exceeded 15 minutes.');
    await sleep(500);
  }
  report.exportSeconds = (performance.now() - exportStarted) / 1000;
  const printJobId = JSON.parse(completed.result).printJobId;
  const print = parse(one('SELECT * FROM print_jobs WHERE id=?', printJobId));
  const manifest = JSON.parse(fs.readFileSync(print.manifestPath, 'utf8'));
  const approvedSnapshot = parse(one('SELECT * FROM approvals WHERE id=?', approval.id));
  const expected = piecesFromApproval(approvedSnapshot);
  assert.equal(manifest.pieceCount, expected.length);
  assert.equal(manifest.placements.length, expected.length);
  assert.equal(new Set(manifest.placements.map(p => p.pieceId)).size, expected.length);
  assert.deepEqual(new Set(manifest.placements.map(p => p.pieceId)), new Set(expected.map(p => p.id)));
  const expectedHashes = new Map(expected.map(p => [p.id, p.sha256]));
  assert.ok(manifest.placements.every(p => expectedHashes.get(p.pieceId) === p.artworkSha256));
  const pdf = await PDFDocument.load(fs.readFileSync(print.pdfPath));
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() / MM_TO_PT - 297) < 0.0001);
    assert.ok(Math.abs(page.getHeight() / MM_TO_PT - 420) < 0.0001);
  }
  report.tests.push('Exact copy/component coverage with no missing or duplicated pieces', 'Every PDF placement references its approved canonical artwork SHA-256', 'Every PDF page is exactly A3 297 by 420 mm');
  report.expectedPieces = expected.length;
  report.pageCount = pdf.getPageCount();
  report.pdfBytes = fs.statSync(print.pdfPath).size;
  report.pdfPath = print.pdfPath;
  report.manifestPath = print.manifestPath;
  if (print.zipPath) {
    const { JSZip } = await import('../src/deps.js');
    const archive = await JSZip.loadAsync(fs.readFileSync(print.zipPath));
    assert.equal(Object.keys(archive.files).filter(name => name.startsWith('png/') && name.endsWith('.png')).length, count * 2);
    assert.equal(Object.keys(archive.files).filter(name => name.startsWith('jpeg/') && name.endsWith('.jpg')).length, count * 2);
    const zippedManifest = JSON.parse(await archive.file('placement-manifest.json').async('string'));
    assert.equal(zippedManifest.pieceCount, expected.length);
    report.zipBytes = fs.statSync(print.zipPath).size;
    report.zipPath = print.zipPath;
    report.tests.push('Approved PNG and JPEG ZIP contains exact recipient/component coverage and its manifest');
  }
  report.completedAt = now();
  report.totalSeconds = (performance.now() - started) / 1000;
  report.peakNodeWorkerRssBytes = peakWorkerRss;
  report.peakNodeWorkerHeapBytes = peakWorkerHeap;
  report.memoryMeasurement = 'Worker Node process RSS sampled every second through IPC. Chromium child-process memory and between-sample spikes are not included.';
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.passed = false; report.error = error.stack || String(error); report.totalSeconds = (performance.now() - started) / 1000;
  report.peakNodeWorkerRssBytes = peakWorkerRss; report.peakNodeWorkerHeapBytes = peakWorkerHeap;
  console.error(report.error); process.exitCode = 1;
} finally {
  await stopWorker(true);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  db.close();
  console.log(`Stress evidence: ${reportPath}`);
}
