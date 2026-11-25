import { createRequire } from 'node:module';
import path from 'node:path';
const local = createRequire(import.meta.url);
const runtime = createRequire(path.join(path.dirname(path.dirname(process.execPath)), 'node_modules', '_loader.cjs'));
export function dependency(name) { try { return local(name); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; return runtime(name); } }
export const sharp = dependency('sharp');
export const playwright = dependency('playwright');
export const pdfLib = dependency('pdf-lib');
export const JSZip = dependency('jszip');
