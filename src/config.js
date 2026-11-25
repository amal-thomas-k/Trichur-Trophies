import path from 'node:path';
import fs from 'node:fs';
export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const PORT = Number(process.env.PORT || 3000);
const configuredOrigin = new URL(process.env.BASE_URL || `http://localhost:${PORT}`);
if (!['http:', 'https:'].includes(configuredOrigin.protocol) ||
    configuredOrigin.username || configuredOrigin.password || configuredOrigin.pathname !== '/' ||
    configuredOrigin.search || configuredOrigin.hash) {
  throw new Error('BASE_URL must be the shop HTTP or HTTPS origin, without a path, credentials, query, or fragment.');
}
export const BASE_URL = configuredOrigin.origin;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;
export const MAX_PIXELS = Number(process.env.MAX_IMAGE_PIXELS || 50000000);
for (const dir of ['', 'assets', 'renders', 'exports', 'tmp']) fs.mkdirSync(path.join(DATA, dir), { recursive: true });
export const now = () => new Date().toISOString();
