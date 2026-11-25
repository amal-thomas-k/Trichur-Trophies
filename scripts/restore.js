import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function restoreBackup(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (source === destination || destination.startsWith(source + path.sep)) throw new Error('Restore destination must be outside the backup.');
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('Restore destination must not be a symbolic link.');
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw new Error('Restore only into a new or empty directory. Existing data will never be overwritten.');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'trichur-trophies-backup' || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported or incomplete backup manifest.');
  const root = path.resolve(source, 'data');
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Backup data directory must not be a symbolic link.');
  const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || path.isAbsolute(file.path) || file.path.split(/[\\/]/).some(p => !p || p === '.' || p === '..') || seen.has(file.path)) throw new Error('Unsafe or duplicate path in backup manifest.');
    seen.add(file.path);
    const original = path.resolve(root, file.path);
    if (!original.startsWith(root + path.sep) || fs.lstatSync(original).isSymbolicLink()) throw new Error('Backup contains an unsafe path.');
    // Check every parent too; an ancestor symlink must not escape the backup root.
    for (let parent = path.dirname(original); parent !== root; parent = path.dirname(parent)) if (fs.lstatSync(parent).isSymbolicLink()) throw new Error('Backup contains a linked directory.');
    if (fs.statSync(original).size !== file.bytes || digest(original) !== file.sha256) throw new Error(`Backup verification failed: ${file.path}`);
  }
  if (!seen.has('app.sqlite')) throw new Error('Backup contains no database.');
  fs.mkdirSync(destination, { recursive: true });
  for (const file of manifest.files) {
    const target = path.join(destination, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file.path), target, fs.constants.COPYFILE_EXCL);
  }
  // Preserve source roots across repeated recovery generations. Immutable
  // approval JSON/hashes remain byte-for-byte intact in the database.
  const mapFile = path.join(destination, 'restore-path-map.json');
  const previousMap = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : { roots: [] };
  const roots = [...new Set([...(previousMap.roots || []), manifest.originalDataDirectory].filter(value => typeof value === 'string' && value.length))];
  fs.writeFileSync(mapFile, JSON.stringify({ version: 1, roots }, null, 2));
  const db = new DatabaseSync(path.join(destination, 'app.sqlite'), { readOnly: true });
  try { if (Object.values(db.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('Restored database integrity check failed.'); }
  finally { db.close(); }
  return { destination, files: manifest.files.length, bytes: manifest.files.reduce((a, f) => a + f.bytes, 0), createdAt: manifest.createdAt };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/restore.js BACKUP_DIRECTORY NEW_DATA_DIRECTORY');
    console.log(JSON.stringify(restoreBackup(process.argv[2], process.argv[3]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
