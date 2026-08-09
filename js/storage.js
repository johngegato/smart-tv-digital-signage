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
 * @param {string} id - Item Unique ID or Storage Key
 * @param {Blob} blob - Binary File Blob object
 * @returns {Promise<string>} Storage ID
 */
export async function saveMediaBlob(id, blob) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = { id, blob, size: blob ? blob.size : 0, type: blob ? blob.type : '', timestamp: Date.now() };

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
      if (!req.result) return resolve(null);
      let blob = req.result.blob;
      if (blob && req.result.type && blob.type !== req.result.type) {
        try {
          Object.defineProperty(blob, 'type', { value: req.result.type, configurable: true, writable: true });
        } catch (e) {
          // Fallback if property define fails
        }
      }
      resolve(blob);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete Media Blob from IndexedDB
 * @param {string} id 
 * @returns {Promise<boolean>}
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
 * Retrieve all media records from IndexedDB
 * @returns {Promise<Array<{id: string, blob: Blob, size: number, timestamp: number}>>}
 */
export async function getAllMediaRecords() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Clear all stored media blobs from IndexedDB
 * @returns {Promise<boolean>}
 */
export async function clearAllMediaBlobs() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get storage quota & usage estimate
 * @returns {Promise<{quota: number, usage: number}>}
 */
export async function getStorageEstimate() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return { quota: estimate.quota || 0, usage: estimate.usage || 0 };
    } catch (e) {
      console.warn('Storage estimate unavailable:', e);
    }
  }
  return { quota: 0, usage: 0 };
}

/**
 * LocalStorage Helpers for Settings & Playlist Metadata
 */
export function getStoredConfig(key, defaultValue) {
  try {
    const saved = localStorage.getItem(`signage_${key}`);
    return saved !== null ? JSON.parse(saved) : defaultValue;
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

export function removeStoredConfig(key) {
  try {
    localStorage.removeItem(`signage_${key}`);
  } catch (e) {
    console.error('LocalStorage Remove Error:', e);
  }
}
