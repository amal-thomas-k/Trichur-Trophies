import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './config.js';

// Approval snapshots are immutable. A restored instance resolves historical
// absolute paths through a trusted local mapping instead of rewriting snapshots.
const portable = value => String(value).replaceAll('\\', '/').replace(/\/+$/, '');
function suffixWithin(file, root) {
  file = portable(file); root = portable(root);
  const insensitive = /^[A-Za-z]:\//.test(root);
  const f = insensitive ? file.toLowerCase() : file;
  const r = insensitive ? root.toLowerCase() : root;
  if (f === r) return '';
  return f.startsWith(r + '/') ? file.slice(root.length + 1) : null;
}
export function resolveStoredPath(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath || storedPath.includes('\0')) throw new Error('Invalid stored file path.');
  const mapFile = path.join(DATA, 'restore-path-map.json');
  const map = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : { version: 1, roots: [] };
  if (map.version !== 1 || !Array.isArray(map.roots) || map.roots.some(r => typeof r !== 'string')) throw new Error('Invalid restore path map.');
  let relative;
  if (!path.isAbsolute(storedPath) && !path.win32.isAbsolute(storedPath)) relative = portable(storedPath);
  else {
    for (const root of [DATA, ...map.roots]) {
      relative = suffixWithin(storedPath, root);
      if (relative !== null) break;
    }
    if (relative === null || relative === undefined) throw new Error('Stored file is outside current or restored private storage.');
  }
  if (relative.split('/').some(part => part === '..' || part === '.')) throw new Error('Unsafe stored file path.');
  const target = path.resolve(DATA, ...relative.split('/'));
  if (target !== DATA && !target.startsWith(DATA + path.sep)) throw new Error('Stored file escapes private storage.');
  return target;
}
