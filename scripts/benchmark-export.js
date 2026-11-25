// Reuses immutable, already-approved synthetic artwork to measure final export
// independently of photo rendering. Does not mutate any approved snapshot.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
const input = process.argv[2];
if (!input || !path.basename(input).startsWith('stress-')) throw new Error('Pass an isolated synthetic stress-* instance.');
process.env.DATA_DIR = path.resolve(input);
const root = path.resolve(import.meta.dirname, '..');
const { one, all, run, parse, db } = await import('../src/db.js');
const { requestExport } = await import('../src/domain.js');
const { piecesFromApproval } = await import('../src/worker.js');
const { pdfLib } = await import('../src/deps.js');
const { MM_TO_PT, validatePlacements } = await import('../src/packing.js');
const rows = all('SELECT * FROM orders');
if (rows.length !== 1) throw new Error('The benchmark requires one isolated synthetic order.');
const order = parse(rows[0]);
if (!order.approvalId) throw new Error('Finish synthetic review/approval before export benchmarking.');
if (one("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('running','queued')").n) throw new Error('Finish or explicitly cancel existing jobs first.');
const approval = parse(one('SELECT * FROM approvals WHERE id=?', order.approvalId));
const pieces = piecesFromApproval(approval);
const count = approval.recipients.length;
const stamp = Date.now();
const output = path.join(root, 'artifacts', `export-benchmark-${count}-${stamp}.json`);
const report = { startedAt: new Date().toISOString(), count, approvalId: approval.id, dataDir: process.env.DATA_DIR, expectedPieces: pieces.length, sourceCodeSha256: Object.fromEntries(['src/worker.js', 'src/render.js', 'src/packing.js', 'src/domain.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])), memoryMeasurement: 'Node export worker RSS sampled through IPC every second; no browser is launched by export. Between-sample spikes are not included.' };
const requested = requestExport({ id: 'export-benchmark', role: 'admin' }, order.id, { diagnostic: true });
const queued = one('SELECT payload FROM jobs WHERE id=?', requested.id);
run('UPDATE jobs SET payload=? WHERE id=?', JSON.stringify({ ...JSON.parse(queued.payload), includeImages: false }), requested.id);
const began = performance.now();
const child = fork(path.join(root, 'src', 'worker.js'), [], { cwd: root, env: { ...process.env, JOB_LEASE_MS: '10000' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
child.stdout.on('data', bytes => process.stdout.write(bytes)); child.stderr.on('data', bytes => process.stderr.write(bytes));
let peakRss = 0, peakHeap = 0;
child.on('message', message => { if (message.type === 'worker-metrics') { peakRss = Math.max(peakRss, message.rss); peakHeap = Math.max(peakHeap, message.heapUsed); } });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let finished;
  while (true) {
    finished = one('SELECT * FROM jobs WHERE id=?', requested.id);
    if (finished.status === 'completed') break;
    if (['failed', 'cancelled'].includes(finished.status)) throw new Error(finished.error || finished.status);
    if (child.exitCode !== null) throw new Error(`Export worker exited with code ${child.exitCode}.`);
    if (performance.now() - began > 900000) throw new Error('Export exceeded 15 minutes.');
    await sleep(500);
  }
  const print = parse(one('SELECT * FROM print_jobs WHERE id=?', JSON.parse(finished.result).printJobId));
  const manifest = JSON.parse(fs.readFileSync(print.manifestPath, 'utf8'));
  assert.equal(manifest.placements.length, pieces.length);
  assert.equal(manifest.pieceCount, pieces.length);
  const expected = new Map(pieces.map(p => [p.id, p.sha256]));
  assert.equal(new Set(manifest.placements.map(p => p.pieceId)).size, pieces.length);
  assert.deepEqual(new Set(manifest.placements.map(p => p.pieceId)), new Set(expected.keys()));
  assert.ok(manifest.placements.every(p => p.artworkSha256 === expected.get(p.pieceId)));
  validatePlacements({ ...manifest, placements: manifest.placements.map((p, inputIndex) => ({ ...p, inputIndex })) }, pieces.length);
  const pdf = await pdfLib.PDFDocument.load(fs.readFileSync(print.pdfPath));
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() / MM_TO_PT - 297) < 0.0001);
    assert.ok(Math.abs(page.getHeight() / MM_TO_PT - 420) < 0.0001);
  }
  report.passed = true;
  report.exportSeconds = (performance.now() - began) / 1000;
  report.pageCount = pdf.getPageCount();
  report.pdfBytes = fs.statSync(print.pdfPath).size;
  report.pdfPath = print.pdfPath;
  report.manifestPath = print.manifestPath;
  report.tests = ['Exact approved piece/copy/component coverage', 'Canonical artwork hashes match every placement', 'Every A3 page is exactly297x420mm', 'All placements satisfy margins/gaps and non-overlap'];
} catch (error) {
  report.passed = false; report.error = error.stack || String(error); process.exitCode = 1;
} finally {
  report.peakNodeWorkerRssBytes = peakRss; report.peakNodeWorkerHeapBytes = peakHeap; report.finishedAt = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  if (child.exitCode === null) { const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await closed; }
  db.close(); console.log(JSON.stringify(report, null, 2)); console.log(`Export evidence: ${output}`);
}
