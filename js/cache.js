/**
 * MediaCacheManager - Offline Media Caching & Automatic Storage Pruning
 * Automatically caches remote videos and images into TV IndexedDB storage for 100% smooth,
 * buffer-free playback. Automatically deletes cached files no longer on the playlist.
 */

const DB_NAME = 'SignageOfflineCache';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

export class MediaCacheManager {
  constructor() {
    this.db = null;
    this.blobUrlMap = new Map(); // url -> objectUrl
    this.downloadQueue = new Set();
    this.pendingQueue = [];
    this.isProcessingQueue = false;
    this.initDB();
  }

  initDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log('[MediaCache] 💾 IndexedDB Offline Media Cache ready');
        resolve(this.db);
      };
      request.onerror = (e) => {
        console.warn('[MediaCache] IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  /**
   * Get cached blob URL for a given media URL.
   * Returns instant local blob URL if cached, otherwise starts background download.
   */
  async getMediaUrl(mediaUrl) {
    if (!mediaUrl) return mediaUrl;

    // Direct local relative assets or data/blob URLs pass through
    if (mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('./assets')) {
      return mediaUrl;
    }

    // Return in-memory blob URL if already created
    if (this.blobUrlMap.has(mediaUrl)) {
      return this.blobUrlMap.get(mediaUrl);
    }

    // Check IndexedDB storage
    const cachedRecord = await this.getFromDB(mediaUrl);
    if (cachedRecord && cachedRecord.blob) {
      const blobUrl = URL.createObjectURL(cachedRecord.blob);
      this.blobUrlMap.set(mediaUrl, blobUrl);
      console.log(`[MediaCache] ⚡ Playing from local offline cache: ${mediaUrl.split('/').pop()}`);
      return blobUrl;
    }

    // Trigger background cache & return original URL for first load
    this.queueDownload(mediaUrl);
    return mediaUrl;
  }

  /**
   * Check if a specific media URL is already saved in TV local storage
   */
  async isUrlCached(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('./assets')) {
      return true;
    }
    const cached = await this.getFromDB(url);
    return !!(cached && cached.blob);
  }

  /**
   * Get cache status telemetry for a playlist (returns array of status objects per item)
   */
  async getPlaylistCacheStats(items) {
    if (!items || !Array.isArray(items)) return { cachedCount: 0, totalCount: 0, items: [] };

    let cachedCount = 0;
    const itemStatuses = [];

    for (const item of items) {
      if (!item || !item.url) continue;
      const isLocal = item.url.startsWith('data:') || item.url.startsWith('blob:') || item.url.startsWith('./assets') || item.isLocalBlob;
      const isCached = isLocal || await this.isUrlCached(item.url);
      const isDownloading = this.downloadQueue.has(item.url) || this.pendingQueue.includes(item.url);

      if (isCached) cachedCount++;

      itemStatuses.push({
        id: item.id,
        url: item.url,
        isCached,
        isDownloading
      });
    }

    return {
      cachedCount,
      totalCount: items.length,
      items: itemStatuses
    };
  }

  /**
   * Preload all items in the current active playlist into local TV storage sequentially
   */
  async preloadPlaylist(items) {
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
      if (item && item.url && !item.url.startsWith('data:') && !item.url.startsWith('blob:') && !item.url.startsWith('./assets')) {
        const cached = await this.getFromDB(item.url);
        if (!cached) {
          this.queueDownload(item.url);
        }
      }
    }
  }

  /**
   * Queue download requests sequentially to avoid memory spikes / network congestion
   */
  queueDownload(url) {
    if (!url || this.downloadQueue.has(url) || this.pendingQueue.includes(url)) return;
    this.pendingQueue.push(url);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessingQueue || this.pendingQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.pendingQueue.length > 0) {
      const url = this.pendingQueue.shift();
      if (url && !this.downloadQueue.has(url)) {
        await this.cacheMediaInBackground(url);
      }
    }

    this.isProcessingQueue = false;
  }

  async getFromDB(url) {
    if (!this.db) await this.initDB();
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async cacheMediaInBackground(url) {
    if (this.downloadQueue.has(url)) return;
    this.downloadQueue.add(url);

    try {
      console.log(`[MediaCache] 📥 Downloading to offline TV storage: ${url.split('/').pop()}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      await this.saveToDB(url, blob);

      // If there was an old blob URL for this item, revoke it before creating new one
      if (this.blobUrlMap.has(url)) {
        try { URL.revokeObjectURL(this.blobUrlMap.get(url)); } catch (e) {}
      }

      const blobUrl = URL.createObjectURL(blob);
      this.blobUrlMap.set(url, blobUrl);
      console.log(`[MediaCache] ✅ Cached for offline play: ${url.split('/').pop()}`);
    } catch (e) {
      console.warn(`[MediaCache] Background cache failed for ${url}:`, e.message);
    } finally {
      this.downloadQueue.delete(url);
    }
  }

  async saveToDB(url, blob) {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ url, blob, cachedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Automatic Storage Garbage Collector (Pruning)
   * Deletes cached media blobs from TV storage if they are no longer in the active playlist.
   */
  async pruneUnusedCache(activePlaylistItems) {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    const activeUrls = new Set(
      (activePlaylistItems || []).map(i => i.url).filter(Boolean)
    );

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();

        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const cachedUrl = cursor.key;
            if (!activeUrls.has(cachedUrl)) {
              console.log(`[MediaCache] 🗑️ Auto-pruning deleted media from TV storage: ${cachedUrl.split('/').pop()}`);
              if (this.blobUrlMap.has(cachedUrl)) {
                try { URL.revokeObjectURL(this.blobUrlMap.get(cachedUrl)); } catch (err) {}
                this.blobUrlMap.delete(cachedUrl);
              }
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
}

