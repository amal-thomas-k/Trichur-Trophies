const DB_NAME = 'trichur-personalise-v1';
let connection;

export async function database() {
  if (connection) return connection;
  connection = await new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Phone storage is unavailable in this browser. Keep this page open until your work is saved to the order.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

export async function loadDrafts(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get(key);
    request.onsuccess = () => resolve(request.result || {activeId: null, cards: {}, queue: []});
    request.onerror = () => reject(request.error);
  });
}

export async function storeDrafts(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Phone storage is full or unavailable.'));
  });
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const values = crypto.getRandomValues(new Uint8Array(16));
  values[6] = (values[6] & 15) | 64;
  values[8] = (values[8] & 63) | 128;
  const text = Array.from(values, b => b.toString(16).padStart(2, '0')).join('');
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

export function filenameSuggestion(filename) {
  if (!filename) return '';
  const name = filename.replace(/\.[^.]+$/, '').trim();
  if (!name || /^(?:img|image|photo|pic|dsc|pxl|screenshot|screen shot|whatsapp|received|download|signal|telegram|snapchat|vid|heic)[\s_\-\d(]/i.test(name)) return '';
  if (/^(?:img|image|photo|pic|dsc|pxl|screenshot|whatsapp|received|download|file)$/i.test(name)) return '';
  if (/^[\d\s_()\-]+$/.test(name) || /^[a-f\d]{20,}$/i.test(name)) return '';
  return name;
}

export function freshCard(groupId) {
  return {id: newId(), groupId, name: '', achievement: '', copies: 1,
    crop: {x: 0, y: 0, zoom: 1, rotation: 0}, assetId: null, photo: null,
    filename: '', uploadId: null, serverRevision: 0, version: 0,
    savedVersion: -1, edited: false, status: 'empty', conflict: false};
}
