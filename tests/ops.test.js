import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { makeBackup } from '../scripts/backup.js';
import { restoreBackup } from '../scripts/restore.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-backup-'));
  const data = path.join(root, 'live'); fs.mkdirSync(path.join(data, 'assets'), { recursive: true });
  const db = new DatabaseSync(path.join(data, 'app.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE orders(id TEXT PRIMARY KEY, approved INTEGER); INSERT INTO orders VALUES (\'retained-order\', 1)'); db.close();
  fs.writeFileSync(path.join(data, 'assets', 'source.bin'), Buffer.from([1, 4, 7, 9]));
  return { root, data, backup: path.join(root, 'backup'), restored: path.join(root, 'restored') };
}
test('offline backup restores database and private bytes into a clean instance', () => {
  const f = fixture(); const backup = makeBackup(f.data, f.backup);
  assert.equal(backup.files, 2); restoreBackup(f.backup, f.restored);
  const db = new DatabaseSync(path.join(f.restored, 'app.sqlite'));
  assert.equal(db.prepare('SELECT approved FROM orders WHERE id=?').get('retained-order').approved, 1); db.close();
  assert.deepEqual(fs.readFileSync(path.join(f.restored, 'assets', 'source.bin')), Buffer.from([1, 4, 7, 9]));
  const resolved = spawnSync(process.execPath, ['--input-type=module', '-e', "import {resolveStoredPath} from './src/storage-path.js';console.log(resolveStoredPath(process.env.CHECK_PATH))"], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, DATA_DIR: f.restored, CHECK_PATH: path.join(f.data, 'assets', 'source.bin') }, encoding: 'utf8' });
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(resolved.stdout.trim(), path.join(f.restored, 'assets', 'source.bin'));
  assert.throws(() => restoreBackup(f.backup, f.restored), /new or empty/);
});
test('restore rejects traversal in the manifest before creating a destination', () => {
  const f = fixture(); makeBackup(f.data, f.backup);
  const file = path.join(f.backup, 'manifest.json'); const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.files[0].path = '../escape.sqlite'; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => restoreBackup(f.backup, f.restored), /Unsafe or duplicate/);
  assert.equal(fs.existsSync(f.restored), false);
});
test('backup refuses a live process and restore rejects corrupt bytes', () => {
  const f = fixture(); fs.writeFileSync(path.join(f.data, 'server.lock'), JSON.stringify({ pid: process.pid }));
  assert.throws(() => makeBackup(f.data, f.backup), /running process/);
  fs.unlinkSync(path.join(f.data, 'server.lock')); makeBackup(f.data, f.backup);
  fs.appendFileSync(path.join(f.backup, 'data', 'assets', 'source.bin'), 'corrupt');
  assert.throws(() => restoreBackup(f.backup, f.restored), /verification failed/);
  assert.equal(fs.existsSync(f.restored), false);
});
