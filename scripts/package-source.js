// Build a source-only handoff from explicit allowed trees. Never bundle live
// database files, order links, passwords, original customer references or backups.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { JSZip } from '../src/deps.js';

const root = path.resolve(import.meta.dirname, '..');
const hostingHandoff = process.argv.includes('--hosting-handoff');
const positional = process.argv.slice(2).filter(value => value !== '--hosting-handoff');
if (positional.length > 1 || positional.some(value => value.startsWith('--'))) throw new Error('Usage: node scripts/package-source.js [output.zip] [--hosting-handoff]');
const output = path.resolve(positional[0] || path.join(root, 'delivery', hostingHandoff ? 'Trichur_Trophies_Hosting_Source.zip' : 'Trichur_Trophies_Source.zip'));
const required = ['README.md','ARCHITECTURE.md','TEMPLATE_SETUP.md','PRINTING_GUIDE.md','BACKUP_RESTORE.md','TEST_REPORT.md','PROGRESS.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','Dockerfile','compose.yaml','compose.https.yaml','.env.example','.gitignore','.dockerignore'];
const trees = ['src','public','scripts','tests','deploy','migrations','private/prepared-assets'];
const docs = ['docs/CUSTOMER_CARD.md','docs/STAFF_PILOT_CHECKLIST.md','docs/SPEC_COVERAGE.md','docs/REFERENCE_AUDIT.md','docs/reference-inventory.json','docs/prepared-assets.json','docs/QA_FINDINGS.md'];
const sampleFiles = ['artifacts/sample-approved-order-A3.pdf','artifacts/sample-individual-artwork.png','artifacts/sample-placement-manifest.json','artifacts/sample-approved-artworks.zip','artifacts/sample-evidence.json','artifacts/calibration.pdf','artifacts/restore-verification.json','samples/render-check/malayalam-corpus.png','samples/render-check/render-verification.json','samples/render-check/sample-A3-artwork.pdf','samples/render-check/sample-A3-artwork.manifest.json','samples/render-check/sample-A3-preview.png','samples/render-check/calibration-A3-preview.png'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Portable releases deliberately list reports; a later artifact is not silently
// promoted into a GitHub handoff merely because its filename ends in .json.
const hostingReports = [
  'artifacts/boundary-checks.json',
  'artifacts/export-benchmark-500-1795172498443.json',
  'artifacts/renderer-v2-v3-equivalence.json',
  'artifacts/restore-verification.json',
  'artifacts/sample-evidence.json',
  'artifacts/sample-placement-manifest.json',
  'artifacts/shop-hosting-check.json',
  'artifacts/stress-12-1795164400969.json',
  'artifacts/stress-2-1795164488286.json',
  'artifacts/stress-2-1795171759874.json',
  'artifacts/stress-2-1795172123864.json',
  'artifacts/stress-500-1795164437663-resume-1795171634549.json',
  'artifacts/stress-500-1795171786367.json',
  'artifacts/worker-races.json',
  'artifacts/qa-browser/browser-report.json',
  'artifacts/shop-qa/browser-report.json',
  'artifacts/shop-qa/counter.json',
  'artifacts/shop-qa/lan-transport.json',
];
const isText = relative => /\.(?:[cm]?js|[jt]sx?|json|md|txt|tap|ya?ml|ps1|cmd|bat|sh|py|sql|css|html|svg|webmanifest|lock|ini|cfg|toml|example)$/i.test(relative)
  || /(?:^|\/)(?:Dockerfile|Caddyfile|\.gitignore|\.dockerignore|LICENSE[^/]*|OFL[^/]*)$/i.test(relative);
const harmless = value => /^(?:<[^>]+>|\[[^\]]+\]|REDACTED|PLACEHOLDER|CHANGE_ME|REPLACE[_ -].*|test-only-password-2026)$/i.test(value.trim());
function scanText(relative, value) {
  const checks = [
    ['order credential', /\/o#[A-Za-z0-9_-]{30,}/g],
    ['GitHub credential', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
    ['API credential', /(?:sk-(?:proj-)?[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{35}|AKIA[A-Z0-9]{16})/g],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['literal authorization', /(?:Bearer\s+[A-Za-z0-9_.-]{32,}|tt_session=[A-Za-z0-9_-]{32,})/g],
  ];
  for (const [kind, pattern] of checks) {
    const match = pattern.exec(value);
    if (match) throw new Error(`Possible ${kind} in ${relative}:${value.slice(0, match.index).split('\n').length}; remove or deliberately replace the value before packaging.`);
  }
}
function scanJson(relative, value, key = '') {
  if (typeof value === 'string' && /^(?:password|token|cookie|authorization|csrf|sessionId|apiKey|accessToken|refreshToken|privateKey)$/i.test(key) && value && !harmless(value))
    throw new Error(`Credential-like JSON field in ${relative}; remove or deliberately replace it before packaging.`);
  if (value && typeof value === 'object') for (const [childKey, child] of Object.entries(value)) scanJson(relative, child, childKey);
}
function portableString(value) {
  let result = value;
  for (const [prefix, replacement] of [[root, '<PROJECT_ROOT>'], [os.tmpdir(), '<TEMP_DIR>']]) {
    for (const spelling of [prefix.replaceAll('\\', '\\\\'), prefix, prefix.replaceAll('\\', '/')]) result = result.split(spelling).join(replacement);
  }
  // Keep generic setup paths/routes intact; remove user profiles and historical
  // executor paths. JSON is transformed after parsing, so escaped paths work.
  result = result.replace(/\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s`"'<>]+/g, '<USER_HOME>')
    .replace(/\b[A-Za-z]:[\\/]+workspace(?=[\\/\s`"'<>]|$)/gi, '<WORKSPACE>')
    .replace(/\b[A-Za-z]:[\\/]+home[\\/]+[^\\/\s`"'<>]+/g, '<USER_HOME>')
    .replace(/\/(?:Users|home)\/[^/\s`"'<>]+/g, '<USER_HOME>')
    .replace(/\/tmp\/(?=[^\s`"'<>])/g, '<TEMP_DIR>/');
  result = result.replace(/\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g, '<SHOP_LAN_IP>');
  return result;
}
function portableJson(value) {
  if (typeof value === 'string') return portableString(value);
  if (Array.isArray(value)) return value.map(portableJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, portableJson(child)]));
  return value;
}
const portableFiles = [];
async function enumerate(relative) {
  if ((await fs.lstat(path.join(root, relative))).isSymbolicLink()) throw new Error(`Refusing linked source tree ${relative}`);
  const results = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    if(entry.name==='__pycache__'||entry.name.endsWith('.pyc'))continue;
    const name = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Refusing linked source entry ${name}`);
    if (entry.isDirectory()) results.push(...await enumerate(name));
    else if (entry.isFile()) results.push(name);
  }
  return results;
}
const files = [...required, ...docs, ...sampleFiles, 'Start-Shop.cmd','Start-Work1.cmd','Build-Work1.cmd',
  'docs/SHOP_HOSTING.md','docs/SHOP_QA.md','docs/WORK1_LOCAL_TEST.md'];
files.push('artifacts/shop-qa/browser-approved-order.pdf', 'artifacts/shop-qa/browser-approved-order-page1.png',
  'artifacts/customer-polish/entry-empty-390.png');
files.push('artifacts/final-test-output.txt', 'artifacts/final-export-regression.txt');
files.push('docs/HOSTING_HANDOFF.md');
files.push('docs/Trichur_Trophies_Codex_Build_Prompt.md');
files.push('artifacts/shop-qa/regression.tap');
for (const tree of trees) files.push(...await enumerate(tree));
// Include complete measured reports, even failures, rather than cherry-picking
// successful stress evidence. Reports must not contain access credentials.
if (hostingHandoff) {
  files.push(...hostingReports, 'artifacts/qa-browser/browser-approved-order.pdf', 'artifacts/qa-browser/browser-approved-order-page1.png');
} else for (const file of await enumerate('artifacts')) {
  if (file.endsWith('.json')) files.push(file);
  else if (/^artifacts\/qa-browser\/(browser-approved-order\.pdf|browser-approved-order-page1\.png)$/.test(file)) files.push(file);
}
const selected = [...new Set(files)].sort();
const archive = new JSZip(); const manifest = [];
for (const relative of selected) {
  if (/(^|\/)(node_modules|data|backups|reference-audit|Catalogues|Design Templates)(\/|$)/i.test(relative) || /\.(sqlite(?:-wal|-shm)?|log)$/i.test(relative) || /(^|\/)\.env$/.test(relative)) throw new Error(`Forbidden private content in source package: ${relative}`);
  if ((await fs.lstat(path.join(root, relative))).isSymbolicLink()) throw new Error(`Refusing linked source file ${relative}`);
  let bytes = await fs.readFile(path.join(root, relative));
  if (isText(relative)) {
    const original = bytes.toString('utf8');
    scanText(relative, original);
    let json;
    if (relative.endsWith('.json')) { json = JSON.parse(original); scanJson(relative, json); }
    // Source code and examples remain runnable; only prose, measured reports
    // and captured text output receive archive-only portability substitutions.
    const immutableSpecification = relative === 'docs/Trichur_Trophies_Codex_Build_Prompt.md';
    if (hostingHandoff && !immutableSpecification && (relative.endsWith('.md') || relative.startsWith('docs/') || relative.startsWith('artifacts/') || relative.startsWith('samples/') || (relative.startsWith('private/prepared-assets/') && relative.endsWith('.json')))) {
      const revised = json === undefined ? portableString(original) : JSON.stringify(portableJson(json), null, 2) + '\n';
      if (revised !== original) { bytes = Buffer.from(revised); portableFiles.push(relative); }
    }
  }
  archive.file(`Trichur-Trophies/${relative}`, bytes);
  manifest.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
}
if (hostingHandoff) {
  const relative = 'PORTABLE_HANDOFF.md';
  const bytes = Buffer.from('# Portable hosting handoff\n\nThis source package retains runnable source, prepared runtime artwork, bundled fonts/licenses and synthetic verification evidence. Machine-specific paths and private LAN addresses in prose/reports were replaced with `<PROJECT_ROOT>`, `<TEMP_DIR>`, `<USER_HOME>`, `<WORKSPACE>` and `<SHOP_LAN_IP>`. Substitute your own paths/address when following commands. The master build specification is included byte-for-byte unchanged. Report measurements and pass/failure results were retained; no deployment, phone test or physical calibration is implied. The JSON report list is explicit. All selected text was scanned for credential patterns before packaging.\n\nThe supplied derived shop-model master is required by the current migration. It is intentionally included for this private project; originals, live databases, order credentials and Work1 exports are excluded. A private repository does not confer an open-source license.\n');
  archive.file(`Trichur-Trophies/${relative}`, bytes);
  manifest.push({path:relative, bytes:bytes.length, sha256:hash(bytes)});
}
const note = { generatedAt: new Date().toISOString(), format: 'trichur-trophies-source-package', version: 1, mode: hostingHandoff ? 'hosting-handoff' : 'local-sample-handoff', portableFiles, excludes: ['live databases and order/customer uploads','original reference PSD/PNG/JPEG files','private reference inspection images','passwords and .env','backups and phone drafts'], files: manifest };
archive.file('Trichur-Trophies/SOURCE_MANIFEST.json', JSON.stringify(note, null, 2));
const zip = await archive.generateAsync({ type:'nodebuffer', compression:'DEFLATE', compressionOptions:{level:6} });
const check = await JSZip.loadAsync(zip);
for (const item of manifest) {
  const file = check.file(`Trichur-Trophies/${item.path}`); if (!file) throw new Error(`Missing archived file ${item.path}`);
  if (hash(await file.async('nodebuffer')) !== item.sha256) throw new Error(`Archive verification failed for ${item.path}`);
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output + '.partial', zip); await fs.rename(output + '.partial', output);
const result = { output, files: manifest.length, bytes: zip.length, sha256: hash(zip), allArchivedFileHashesVerified: true };
await fs.writeFile(output + '.sha256.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
