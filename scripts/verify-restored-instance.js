// Exercises actual authenticated media/proof/PDF routes on a restored instance.
// Use only a recovery-test directory: a short-lived verification session is added
// and removed there. Original production data is never opened by this script.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { once } from 'node:events';
const argumentsList = process.argv.slice(2);
for (const option of argumentsList.filter(value => value.startsWith('--'))) if (!['--browser','--in-process'].includes(option)) throw new Error(`Unknown verification option ${option}`);
if (argumentsList.includes('--browser') && argumentsList.includes('--in-process')) throw new Error('Choose browser or in-process transport, not both.');
const [directory, orderId, reportFile] = argumentsList.filter(value => !value.startsWith('--'));
if (!directory || !orderId) throw new Error('Usage: node scripts/verify-restored-instance.js RESTORED_DATA_DIRECTORY ORDER_ID [REPORT_JSON] [--browser|--in-process]');
process.env.DATA_DIR = path.resolve(directory);
if (!fs.existsSync(path.join(process.env.DATA_DIR, 'restore-path-map.json'))) throw new Error('This is not a directory produced by the restore script.');
const { db, all, one, run, parse } = await import('../src/db.js');
const { handler } = await import('../src/server.js');
const { resolveStoredPath } = await import('../src/storage-path.js');
const { pdfLib } = await import('../src/deps.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const streamedPaths = [], originalCreateReadStream = fs.createReadStream;
fs.createReadStream = function(file, ...args) {
  streamedPaths.push(path.resolve(String(file)));
  return originalCreateReadStream.call(fs, file, ...args);
};
const token = crypto.randomBytes(32).toString('base64url'), sessionId = hash(token);
run('INSERT INTO sessions(id,actor,csrf,expires_at) VALUES(?,?,?,?)', sessionId, JSON.stringify({ id: 'restore-verification', role: 'admin', username: 'restore-check' }), crypto.randomBytes(24).toString('hex'), Date.now() + 60000);
const inProcessTransport = process.argv.includes('--in-process');
const server = inProcessTransport ? null : http.createServer(handler);
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = server ? `http://127.0.0.1:${server.address().port}` : 'http://localhost:3000';
let browserContext, page;
const browserTransport = process.argv.includes('--browser');
async function request(url, authenticated = true) {
  if (inProcessTransport) {
    const req = Readable.from([]); req.method = 'GET'; req.url = url;
    req.headers = authenticated ? { cookie: `tt_session=${token}` } : {};
    req.socket = { remoteAddress: '127.0.0.1' };
    const chunks = [];
    const res = new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    res.statusCode = 200; res.headersSent = false; res.headers = {};
    res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
    res.getHeader = name => res.headers[name.toLowerCase()];
    res.writeHead = (status, headers = {}) => { res.statusCode = status; for (const [key, value] of Object.entries(headers)) res.setHeader(key, value); res.headersSent = true; return res; };
    const finished = once(res, 'finish');
    await handler(req, res); await finished;
    return { status: res.statusCode, bytes: Buffer.concat(chunks) };
  }
  if (!browserTransport) {
    const response = await fetch(base + url, { headers: authenticated ? { Cookie: `tt_session=${token}` } : {} });
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  }
  const response = await page.evaluate(async ({ url, authenticated }) => {
    const result = await fetch(url, { credentials: authenticated ? 'include' : 'omit' });
    const bytes = new Uint8Array(await result.arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { status: result.status, base64: btoa(binary) };
  }, { url: base + url, authenticated });
  return { status: response.status, bytes: Buffer.from(response.base64, 'base64') };
}
try {
  if (browserTransport) {
    const { getBrowser } = await import('../src/render.js');
    browserContext = await (await getBrowser()).newContext();
    await browserContext.addCookies([{ name: 'tt_session', value: token, url: base, httpOnly: true, sameSite: 'Strict' }]);
    page = await browserContext.newPage();
    await page.goto(base + '/api/health');
  }
  const order = parse(one('SELECT * FROM orders WHERE id=?', orderId)); assert.ok(order?.approvalId, 'The restored order has a current approval');
  const approval = parse(one('SELECT * FROM approvals WHERE id=?', order.approvalId));
  const { snapshotHash, ...snapshot } = approval;
  assert.equal(hash(JSON.stringify(snapshot)), snapshotHash, 'Approval snapshot hash is unchanged');
  const recipient = approval.recipients[0]; const artwork = recipient.proof.artworks[0];
  assert.equal(hash(fs.readFileSync(resolveStoredPath(artwork.path))), artwork.sha256, 'Canonical artwork survives restore');
  const job = parse(one("SELECT * FROM print_jobs WHERE order_id=? AND status<>'superseded' ORDER BY created_at DESC LIMIT 1", orderId)); assert.ok(job?.pdfPath, 'An export survives restore');
  const endpoints = [
    { kind: 'photo', url: `/api/media/${recipient.asset.id}`, path: recipient.asset.path, sha256: recipient.asset.sha256 },
    { kind: 'proof', url: `/api/artworks/${artwork.id}`, path: artwork.path, sha256: artwork.sha256 },
    { kind: 'pdf', url: `/api/print-jobs/${job.id}/pdf`, path: job.pdfPath },
    { kind: 'manifest', url: `/api/print-jobs/${job.id}/manifest`, path: job.manifestPath }
  ];
  const downloads = [];
  for (const endpoint of endpoints) {
    const response = await request(endpoint.url);
    const bytes = response.bytes; assert.equal(response.status, 200, `${endpoint.kind}: ${bytes.toString('utf8').slice(0,100)}`);
    const sha256 = hash(bytes); assert.equal(sha256, endpoint.sha256 || hash(fs.readFileSync(resolveStoredPath(endpoint.path))), `${endpoint.kind} returned exact restored bytes`);
    downloads.push({ kind: endpoint.kind, status: response.status, bytes: bytes.length, sha256 });
  }
  const denied = await request(endpoints[2].url, false); assert.ok([401,403].includes(denied.status), 'Export remains protected without a session');
  assert.equal(streamedPaths.length, endpoints.length, 'All four returned artifacts used real filesystem streams');
  assert.ok(streamedPaths.every(file => file.startsWith(process.env.DATA_DIR + path.sep)), 'File routes read restored files, never the surviving original instance');
  const pdf = await pdfLib.PDFDocument.load(fs.readFileSync(resolveStoredPath(job.pdfPath)));
  const dimensions = pdf.getPages().map(page => ({ widthMm: page.getWidth() * 25.4 / 72, heightMm: page.getHeight() * 25.4 / 72 }));
  for (const page of dimensions) assert.ok(Math.abs(page.widthMm - 297) < 0.001 && Math.abs(page.heightMm - 420) < 0.001);
  const report = { passed: true, transport: inProcessTransport ? 'Actual server handler with Node request/response streams and real restored DB/files; no HTTP socket' : browserTransport ? 'Chromium fetch to actual local HTTP server' : 'Node fetch to actual local HTTP server', httpSocketVerified: !inProcessTransport, verifiedAt: new Date().toISOString(), orderId, approvalId: order.approvalId, snapshotHash, counts: { orders: one('SELECT count(*) AS n FROM orders').n, recipients: one('SELECT count(*) AS n FROM recipients').n, approvals: one('SELECT count(*) AS n FROM approvals').n, assets: one('SELECT count(*) AS n FROM assets').n }, downloads, unauthenticatedExportStatus: denied.status, pdfDimensionsMm: dimensions, immutableSnapshotsRewritten: false, allStreamedFilesWithinRestoredDataDirectory: true, streamedRelativePaths: streamedPaths.map(file => path.relative(process.env.DATA_DIR, file).split(path.sep).join('/')) };
  if (reportFile) { fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify(report, null, 2));
} finally { fs.createReadStream = originalCreateReadStream; if (browserContext) await browserContext.close(); if (browserTransport) await (await import('../src/render.js')).closeRenderer(); if (server?.listening) await new Promise(resolve => server.close(resolve)); run('DELETE FROM sessions WHERE id=?', sessionId); db.close(); }
