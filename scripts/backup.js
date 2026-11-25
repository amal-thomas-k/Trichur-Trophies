import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function assertStopped(directory) {
  for (const name of ['server.lock', 'worker.lock']) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    let pid;
    try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); pid = Number(value.pid ?? value); } catch { throw new Error(`Cannot read ${name}; inspect this lock before backing up.`); }
    if (!Number.isInteger(pid) || pid < 1) throw new Error(`Invalid process lock ${name}; do not continue until it is resolved.`);
    try { process.kill(pid, 0); throw new Error(`${name} belongs to running process ${pid}. Stop the web server and worker first.`); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
function filesUnder(root, relative = '') {
  const files = [];
  for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, item.name);
    if (item.isSymbolicLink()) throw new Error(`Refusing a symbolic link in private data: ${name}`);
    if (!relative && ['server.lock', 'worker.lock', 'maintenance.lock'].includes(item.name)) continue;
    if (item.isDirectory()) files.push(...filesUnder(root, name));
    else if (item.isFile()) files.push(name);
  }
  return files.sort();
}
export function makeBackup(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('The backup must be outside the live data directory.');
  if (!fs.existsSync(path.join(source, 'app.sqlite'))) throw new Error('No app.sqlite found in DATA_DIR.');
  if (fs.existsSync(destination)) throw new Error('Backup destination already exists; choose a new empty path.');
  assertStopped(source);
  const maintenance = path.join(source, 'maintenance.lock');
  const lock = fs.openSync(maintenance, 'wx');
  try {
    fs.writeSync(lock, JSON.stringify({ pid: process.pid, operation: 'backup', startedAt: new Date().toISOString() }));
    assertStopped(source);
    const db = new DatabaseSync(path.join(source, 'app.sqlite'));
    try {
      const check = db.prepare('PRAGMA quick_check').get();
      if (Object.values(check)[0] !== 'ok') throw new Error('SQLite quick_check failed; preserve data and investigate.');
      const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      if (Number(checkpoint.busy) !== 0) throw new Error('Database is busy. Stop every process accessing it.');
    } finally { db.close(); }
    fs.mkdirSync(destination, { recursive: true });
    const files = [];
    for (const relative of filesUnder(source)) {
      const original = path.join(source, relative), target = path.join(destination, 'data', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(original, target, fs.constants.COPYFILE_EXCL);
      const sha256 = digest(original);
      if (digest(target) !== sha256) throw new Error(`Backup hash mismatch: ${relative}`);
      files.push({ path: relative.split(path.sep).join('/'), bytes: fs.statSync(target).size, sha256 });
    }
    const manifest = { format: 'trichur-trophies-backup', version: 1, createdAt: new Date().toISOString(), node: process.version, originalDataDirectory: source, files };
    fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    return { destination, files: files.length, bytes: files.reduce((a, f) => a + f.bytes, 0) };
  } finally { fs.closeSync(lock); fs.unlinkSync(maintenance); }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const destination = process.argv[2] || path.join('backups', new Date().toISOString().replaceAll(':', '-'));
    console.log(JSON.stringify(makeBackup(process.env.DATA_DIR || 'data', destination), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
