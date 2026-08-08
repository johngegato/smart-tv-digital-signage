/**
 * Storage Manager Module - IndexedDB for Large Media Files (Images/Videos) & LocalStorage for Configuration
 */

const DB_NAME = 'SmartTVDigitalSignageDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

let dbInstance = null;

/**
 * Initialize IndexedDB
 */
export async function initStorage() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB Initialization Error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Save Media Blob to IndexedDB
 * @param {string} id - Item Unique ID
 * @param {Blob} blob - File Blob object
 */
export async function saveMediaBlob(id, blob) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = { id, blob, timestamp: Date.now() };

    const req = store.put(item);
    req.onsuccess = () => resolve(id);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get Media Blob from IndexedDB
 * @param {string} id 
 * @returns {Promise<Blob|null>}
 */
export async function getMediaBlob(id) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(id);
    req.onsuccess = () => {
      resolve(req.result ? req.result.blob : null);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete Media Blob from IndexedDB
 * @param {string} id 
 */
export async function deleteMediaBlob(id) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * LocalStorage Helpers for Settings & Playlist Metadata
 */
export function getStoredConfig(key, defaultValue) {
  try {
    const saved = localStorage.getItem(`signage_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setStoredConfig(key, value) {
  try {
    localStorage.setItem(`signage_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage Save Error:', e);
  }
}
