import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { DATA, now } from './config.js';
import { all, one, run, tx } from './db.js';
import { JSZip, sharp } from './deps.js';
import { resolveStoredPath } from './storage-path.js';

export const LEASE_MS = Math.max(3000, Number(process.env.JOB_LEASE_MS || 60000));
const JOB_TIMEOUT_MS = Math.max(10000, Number(process.env.JOB_TIMEOUT_MS || 900000));
const MAX_ATTEMPTS = Math.max(1, Math.min(10, Number(process.env.JOB_MAX_ATTEMPTS || 3)));
const owner = `${process.pid}:${crypto.randomUUID()}`;
let interactiveStreak = 0;
let stopping = false;
let currentController;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

export function recoverExpiredJobs(at = Date.now()) {
  return tx(() => {
    const expired = all("SELECT id,attempts,cancelled FROM jobs WHERE status='running' AND locked_until < ?", at);
    for (const job of expired) {
      const status = job.cancelled ? 'cancelled' : job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      run('UPDATE jobs SET status=?,owner=NULL,locked_until=0,available_at=?,error=?,updated_at=? WHERE id=?',
        status, at, status === 'queued' ? 'Worker stopped before completion; recovered from durable lease.' : 'Worker lease expired.', now(), job.id);
    }
    run("UPDATE jobs SET status='cancelled',updated_at=? WHERE status='queued' AND cancelled=1", now());
    return expired.length;
  });
}

export function claimJob(workerOwner = owner, at = Date.now()) {
  if (fs.existsSync(path.join(DATA, 'maintenance.lock'))) return null;
  recoverExpiredJobs(at);
  return tx(() => {
    // At most five interactive proofs in a row when an export is waiting.
    const fairness = interactiveStreak >= 5 ? "CASE WHEN kind IN ('export','print') THEN 0 ELSE 1 END," : '';
    const job = one(`SELECT * FROM jobs WHERE status='queued' AND cancelled=0 AND available_at<=? ORDER BY ${fairness}priority ASC,created_at ASC,id ASC LIMIT 1`, at);
    if (!job) return null;
    run("UPDATE jobs SET status='running',attempts=attempts+1,owner=?,locked_until=?,updated_at=?,error=NULL WHERE id=? AND status='queued'", workerOwner, at + LEASE_MS, now(), job.id);
    interactiveStreak = job.kind === 'render' ? interactiveStreak + 1 : 0;
    return { ...job, attempts: job.attempts + 1, owner: workerOwner, status: 'running', payload: JSON.parse(job.payload) };
  });
}

function ensureOwned(job) {
  const current = one('SELECT status,owner,cancelled FROM jobs WHERE id=?', job.id);
  if (!current || current.status !== 'running' || current.owner !== job.owner || current.cancelled) {
    const error = new Error('Job cancelled or its lease is no longer owned by this worker.');
    error.code = 'CANCELLED';
    throw error;
  }
}

function updateProgress(job, progress) {
  ensureOwned(job);
  run('UPDATE jobs SET progress=?,locked_until=?,updated_at=? WHERE id=? AND owner=?', Math.max(0, Math.min(0.99, Number(progress) || 0)), Date.now() + LEASE_MS, now(), job.id, job.owner);
}

function safeArtifactPath(file) {
  const absolute = path.resolve(resolveStoredPath(file));
  const root = path.resolve(DATA) + path.sep;
  if (!absolute.startsWith(root)) throw new Error('Artifact is outside private storage.');
  if (!fs.statSync(absolute).isFile()) throw new Error('Artifact does not exist.');
  return absolute;
}

function verifiedArtwork(artwork) {
  const absolute = safeArtifactPath(artwork.path);
  const hash = digest(fs.readFileSync(absolute));
  if (hash !== artwork.sha256) throw new Error(`Approved artwork hash mismatch: ${artwork.componentId || artwork.id}`);
  return absolute;
}

function audit(orderId, action, detail) {
  run('INSERT INTO audit(order_id,actor,action,detail,created_at) VALUES(?,?,?,?,?)', orderId, 'worker', action, JSON.stringify(detail), now());
}

async function doRender(job, signal) {
  const snapshot = job.payload.snapshot;
  if (!snapshot?.recipient || !snapshot?.template) throw new Error('Render job is missing its immutable input snapshot.');
  const offlineWork1 = process.env.TT_OFFLINE_RENDERING === '1' && snapshot.template.id === 'carving-kannadi-r-big-jyothi-v1';
  const renderRecipient = offlineWork1 ? (await import('./render-work1-offline.js')).renderWork1Offline : (await import('./render.js')).renderRecipient;
  const recipientId = job.payload.recipientId || snapshot.recipient.id;
  const revision = job.payload.revision ?? snapshot.recipient.revision;
  const outputDir = path.join(DATA, 'renders', job.id, `attempt-${job.attempts}-${crypto.randomUUID()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  updateProgress(job, 0.05);
  const result = await renderRecipient(snapshot, outputDir, { signal, onProgress: p => updateProgress(job, 0.05 + p * 0.85) });
  if (signal.aborted) throw signal.reason || new Error('Job cancelled.');
  const proofId = crypto.randomUUID();
  const artworks = result.artworks.map(art => {
    const artwork = { ...art, id: crypto.randomUUID() };
    verifiedArtwork(artwork);
    return artwork;
  });
  if (!artworks.length) throw new Error('Renderer returned no artwork.');
  const doc = {
    id: proofId, recipientId, revision, artworks,
    renderer: result.renderer, warnings: result.warnings || [],
    inputHash: digest(JSON.stringify(snapshot)), snapshot, createdAt: now(),
  };
  let publishedProofId = proofId;
  tx(() => {
    ensureOwned(job);
    const row = one('SELECT revision,doc FROM recipients WHERE id=? AND order_id=?', recipientId, job.order_id);
    const current = row && row.revision === revision;
    const recipient = row && JSON.parse(row.doc);
    const existing = current && recipient.proofId && one('SELECT id FROM proofs WHERE id=? AND recipient_id=? AND revision=?', recipient.proofId, recipientId, revision);
    if (existing) {
      // Two concurrent requests can target one immutable input revision. A late
      // duplicate must not replace artwork that the customer already reviewed.
      publishedProofId = existing.id;
      run("UPDATE jobs SET status='completed',progress=1,result=?,locked_until=0,owner=NULL,updated_at=? WHERE id=?", JSON.stringify({ proofId: existing.id, recipientId, revision, superseded: false, reused: true }), now(), job.id);
      audit(job.order_id, 'proof.reused', { jobId: job.id, proofId: existing.id, recipientId, revision });
      return;
    }
    run('INSERT INTO proofs(id,order_id,recipient_id,revision,doc,created_at) VALUES(?,?,?,?,?,?)', proofId, job.order_id, recipientId, revision, JSON.stringify(doc), now());
    if (current) {
      recipient.proofId = proofId;
      recipient.reviewedRevision = null;
      recipient.issues = [];
      run('UPDATE recipients SET doc=? WHERE id=? AND revision=?', JSON.stringify(recipient), recipientId, revision);
    }
    run("UPDATE jobs SET status='completed',progress=1,result=?,locked_until=0,owner=NULL,updated_at=? WHERE id=?", JSON.stringify({ proofId, recipientId, revision, superseded: !current }), now(), job.id);
    audit(job.order_id, 'proof.generated', { jobId: job.id, proofId, recipientId, revision, superseded: !current });
  });
  return { proofId: publishedProofId, recipientId, revision };
}

export function piecesFromApproval(approval, selection) {
  if (!Array.isArray(approval.recipients) || !approval.recipients.length) throw new Error('Approval has no canonical recipient proofs.');
  const pieces = [];
  for (const entry of approval.recipients) {
    const recipient = entry.recipient;
    const template = entry.template;
    const proof = entry.proof;
    if (!recipient?.id || !template?.components?.length || !proof?.artworks?.length) throw new Error('Incomplete approved snapshot.');
    const copies = Number(recipient.copies || 1);
    if (!Number.isSafeInteger(copies) || copies < 1 || copies > 1000) throw new Error('Invalid approved copy count.');
    for (const component of template.components) {
      const art = proof.artworks.find(a => a.componentId === component.id);
      if (!art) throw new Error(`Approved artwork missing for component ${component.id}.`);
      for (let copyNumber = 1; copyNumber <= copies; copyNumber++) {
        const id = `${recipient.id}:${component.id}:${copyNumber}`;
        pieces.push({
          id, pieceId: id, recipientId: recipient.id, name: recipient.name,
          modelCode: template.modelCode, templateId: template.id,
          componentId: component.id, componentName: component.name || component.id,
          copyNumber, copy: copyNumber,
          path: art.path, sha256: art.sha256,
          artworkId: art.id, widthMm: art.widthMm, heightMm: art.heightMm,
          includesBleed: art.includesBleed === true, pixelWidth: art.pixelWidth, pixelHeight: art.pixelHeight, dpi: art.dpi,
          trimMask: art.trimMask, trimGeometryStatus: art.trimGeometryStatus,
          allowRotation: component.allowRotation ?? template.allowRotation ?? false,
          bleedMm: component.bleedMm ?? template.bleedMm ?? 0,
          media: component.media || template.media || 'photo-paper',
        });
      }
    }
  }
  if (selection == null) return pieces;
  if (!Array.isArray(selection) || !selection.length || selection.length > pieces.length) throw new Error('Reprint selection must contain explicit piece identifiers.');
  const ids = new Set(selection.map(value => typeof value === 'string' ? value : `${value?.recipientId}:${value?.componentId}:${value?.copyNumber}`));
  if (ids.size !== selection.length) throw new Error('Duplicate piece identifiers in reprint selection.');
  const filtered = pieces.filter(piece => ids.has(piece.id));
  if (filtered.length !== ids.size) throw new Error('Reprint selection contains pieces outside the approved snapshot.');
  return filtered;
}

async function writeZip(pieces, outputPath, manifest, shouldCancel, progress) {
  const zip = new JSZip();
  // Open each source only when JSZip consumes it, rather than retaining hundreds
  // of full buffers or simultaneously opening every photo in a large order.
  const lazyFile = file => Readable.from((async function* () {
    for await (const chunk of fs.createReadStream(file)) {
      if (shouldCancel()) throw new Error('Export cancelled.');
      yield chunk;
    }
  })());
  const seen = new Set();
  let index = 0;
  for (const piece of pieces) {
    if (shouldCancel()) throw new Error('Export cancelled.');
    // One image per canonical component; copies are expressed in the manifest.
    const key = `${piece.recipientId}_${piece.componentId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (seen.has(key)) continue;
    seen.add(key);
    const original = verifiedArtwork(piece);
    zip.file(`png/${key}.png`, lazyFile(original));
    // JPEG is an explicit white-backed optional derivative; PDF retains canonical PNG.
    const jpegPath = path.join(path.dirname(outputPath), `${key}.jpg`);
    await sharp(original).flatten({ background: '#ffffff' }).jpeg({ quality: 98, chromaSubsampling: '4:4:4' }).toFile(jpegPath);
    zip.file(`jpeg/${key}.jpg`, lazyFile(jpegPath));
    progress(++index / Math.max(1, pieces.length));
  }
  zip.file('README.txt', 'PNG files are canonical approved artwork. JPEG derivatives flatten transparency to white. Copy counts and physical dimensions are specified in placement-manifest.json. Print the A3 PDF at Actual Size; do not rely on image DPI metadata.');
  zip.file('placement-manifest.json', JSON.stringify(manifest, null, 2));
  await new Promise((resolve, reject) => {
    const stream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' });
    const out = fs.createWriteStream(outputPath, { flags: 'wx' });
    stream.on('error', reject); out.on('error', reject); out.on('finish', resolve);
    stream.pipe(out);
  });
}

async function doExport(job, signal) {
  const { createPrintPdf } = await import('./render.js');
  const approvalRow = one('SELECT * FROM approvals WHERE id=? AND order_id=?', job.payload.approvalId, job.order_id);
  if (!approvalRow) throw new Error('Approved snapshot not found.');
  const approval = JSON.parse(approvalRow.doc);
  const { snapshotHash, ...approvedContent } = approval;
  if (!snapshotHash || digest(JSON.stringify(approvedContent)) !== snapshotHash) throw new Error('Approved snapshot hash mismatch; export stopped to protect the approved revision.');
  const pieces = piecesFromApproval(approval, job.payload.selection);
  const profile = job.payload.profile || { id: 'a3-default', orientation: 'portrait', marginMm: 10, gapMm: 3, dpi: 300, media: 'photo-paper' };
  const diagnostic = job.payload.diagnostic === true;
  if (!diagnostic) {
    const { requireCalibration } = await import('./domain.js');
    requireCalibration(approval, profile);
    for (const templateId of new Set(pieces.map(p => p.templateId))) {
      if (!one('SELECT 1 FROM calibrations WHERE template_id=? AND profile_id=?', templateId, profile.id)) throw new Error('Physical template/profile calibration is required for production export.');
    }
  }
  const printJobId = crypto.randomUUID();
  const outputDir = path.join(DATA, 'exports', printJobId);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const piece of pieces) piece.path = verifiedArtwork(piece);
  updateProgress(job, 0.05);
  const shouldCancel = () => signal.aborted || !!one('SELECT cancelled FROM jobs WHERE id=?', job.id)?.cancelled;
  const pdfPath = path.join(outputDir, 'order-a3.pdf');
  const result = await createPrintPdf({
    approvalId: approvalRow.id, orderId: job.order_id, revision: approvalRow.revision,
    pieces, profile, outputPath: pdfPath, diagnostic,
    signal, shouldCancel, onProgress: p => updateProgress(job, 0.05 + p * 0.65),
  });
  if (shouldCancel()) throw signal.reason || new Error('Export cancelled.');
  safeArtifactPath(result.pdfPath || pdfPath);
  const manifest = result.manifest || result.placementManifest;
  if (!manifest) throw new Error('PDF generation returned no placement manifest.');
  const manifestPath = path.join(outputDir, 'placement-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  updateProgress(job, 0.72);
  let zipPath;
  if (job.payload.includeImages !== false) {
    zipPath = path.join(outputDir, 'individual-artworks.zip');
    await writeZip(pieces, zipPath, manifest, shouldCancel, p => updateProgress(job, 0.72 + p * 0.2));
  }
  if (shouldCancel()) throw signal.reason || new Error('Export cancelled.');
  const doc = {
    id: printJobId, jobId: job.id, approvalId: approvalRow.id,
    orderId: job.order_id, revision: approvalRow.revision,
    pdfPath, manifestPath, ...(zipPath ? { zipPath } : {}),
    pdfSha256: digest(fs.readFileSync(pdfPath)),
    manifest, profile, diagnostic, selection: job.payload.selection || null,
    pieceCount: pieces.length, createdAt: now(),
  };
  tx(() => {
    ensureOwned(job);
    const order = one('SELECT doc FROM orders WHERE id=?', job.order_id);
    const current = order && JSON.parse(order.doc).approvalId === approvalRow.id;
    const status = current ? 'generated' : 'superseded';
    run('INSERT INTO print_jobs(id,order_id,approval_id,revision,status,doc,created_at) VALUES(?,?,?,?,?,?,?)', printJobId, job.order_id, approvalRow.id, approvalRow.revision, status, JSON.stringify(doc), now());
    run("UPDATE jobs SET status='completed',progress=1,result=?,locked_until=0,owner=NULL,updated_at=? WHERE id=?", JSON.stringify({ printJobId, pieceCount: pieces.length, superseded: !current }), now(), job.id);
    audit(job.order_id, job.payload.selection ? 'print.reprint.generated' : 'print.generated', { printJobId, approvalId: approvalRow.id, pieceCount: pieces.length, diagnostic, superseded: !current });
  });
  return { printJobId, pdfPath, manifestPath };
}

export async function runOneJob(job) {
  const controller = new AbortController();
  currentController = controller;
  const heartbeat = setInterval(() => {
    try {
      ensureOwned(job);
      run('UPDATE jobs SET locked_until=?,updated_at=? WHERE id=? AND owner=?', Date.now() + LEASE_MS, now(), job.id, job.owner);
    } catch (error) { controller.abort(error); }
  }, Math.max(500, Math.floor(LEASE_MS / 3)));
  const timeout = setTimeout(() => controller.abort(Object.assign(new Error(`Job exceeded ${JOB_TIMEOUT_MS} ms. Retry after checking worker resources.`), { code: 'TIMEOUT' })), JOB_TIMEOUT_MS);
  try {
    if (job.kind === 'render') await doRender(job, controller.signal);
    else if (['export', 'print'].includes(job.kind)) await doExport(job, controller.signal);
    else throw new Error(`Unsupported job kind: ${job.kind}`);
  } catch (error) {
    tx(() => {
      const current = one('SELECT owner,cancelled,status FROM jobs WHERE id=?', job.id);
      if (!current || current.owner !== job.owner || current.status !== 'running') return;
      const cancelled = current.cancelled || error.code === 'CANCELLED';
      const permanent = /missing|mismatch|overflow|too (long|large)|outside|unsupported|invalid|calibrat|fit|font.*(unavailable|missing)/i.test(error.message);
      const retry = !cancelled && !permanent && job.attempts < MAX_ATTEMPTS;
      const status = cancelled ? 'cancelled' : retry ? 'queued' : 'failed';
      run('UPDATE jobs SET status=?,error=?,available_at=?,locked_until=0,owner=NULL,updated_at=? WHERE id=?', status, String(error.message || error).slice(0, 1200), Date.now() + Math.min(30000, 1000 * 2 ** job.attempts), now(), job.id);
      audit(job.order_id, 'job.' + status, { jobId: job.id, attempts: job.attempts, error: String(error.message || error).slice(0, 300) });
    });
  } finally {
    clearInterval(heartbeat); clearTimeout(timeout); currentController = null;
  }
}

export function acquireLock() {
  const file = path.join(DATA, 'worker.lock');
  if (fs.existsSync(file)) {
    const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isInteger(prior.pid) || prior.pid < 1) throw new Error('Invalid worker process lock; inspect it before starting another worker.');
    let alive = false;
    try { process.kill(prior.pid, 0); alive = true; } catch (error) {
      if (error.code !== 'ESRCH') throw new Error(`Cannot safely verify existing worker PID ${prior.pid}: ${error.code}. Stop the existing service before resolving its lock.`);
    }
    if (alive) throw new Error(`A worker is already running (PID ${prior.pid}).`);
    fs.unlinkSync(file);
  }
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: now() }), { flag: 'wx' });
  return () => {
    try { const current = JSON.parse(fs.readFileSync(file, 'utf8')); if (current.pid === process.pid) fs.unlinkSync(file); } catch {}
  };
}

export async function main() {
  if (fs.existsSync(path.join(DATA, 'maintenance.lock'))) throw new Error('Maintenance is active. Finish backup/restore before starting the worker.');
  const release = acquireLock();
  const telemetry = setInterval(() => {
    if (process.send) process.send({ type: 'worker-metrics', at: Date.now(), ...process.memoryUsage(), maxRSS: process.resourceUsage().maxRSS });
  }, 1000);
  telemetry.unref();
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; currentController?.abort(new Error('Worker is stopping.')); });
  process.on('exit', release);
  console.log(`Print worker ready; bounded concurrency 1, lease ${LEASE_MS} ms.`);
  try {
    while (!stopping) {
      const job = claimJob();
      if (job) await runOneJob(job);
      else await sleep(500);
    }
  } finally {
    clearInterval(telemetry);
    release();
    const renderer = await import('./render.js').catch(() => null);
    await renderer?.closeRenderer?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
