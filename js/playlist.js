/**
 * Playlist Manager Module - Data state and campaign presets
 */
import { getStoredConfig, setStoredConfig, saveMediaBlob, getMediaBlob, deleteMediaBlob } from './storage.js';
import { MediaCacheManager } from './cache.js';

// Default Sample Campaign Items
const DEFAULT_PLAYLIST = [
  {
    id: 'sample_coffee',
    title: 'Artisan Coffee & Bakery',
    subtitle: 'Freshly Brewed Morning Specials - 20% OFF',
    type: 'image',
    url: './assets/coffee_ad.jpg',
    duration: 8,
    muted: true,
    schedule: 'all'
  },
  {
    id: 'sample_video_loop',
    title: 'Modern Motion Graphics',
    subtitle: 'High Impact 4K Visual Experience',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 12,
    muted: true,
    schedule: 'all'
  },
  {
    id: 'sample_tech',
    title: 'Next-Gen Smart Home',
    subtitle: 'Experience Ultimate Automation Today',
    type: 'image',
    url: './assets/tech_ad.jpg',
    duration: 8,
    muted: true,
    schedule: 'all'
  },
  {
    id: 'sample_fitness',
    title: 'Summer Pass Promotion',
    subtitle: 'Join Today & Get Your 1st Month Free',
    type: 'image',
    url: './assets/fitness_ad.jpg',
    duration: 8,
    muted: true,
    schedule: 'all'
  }
];

export class PlaylistManager {
  constructor() {
    this.playlist = getStoredConfig('playlist', DEFAULT_PLAYLIST);
    this.currentIndex = 0;
    this.blobUrls = new Map(); // Cache generated object URLs for blobs
    this.mediaCache = new MediaCacheManager();

    // Trigger initial background cache & garbage collection
    setTimeout(() => this.syncCache(), 1000);
  }

  /**
   * Check if item schedule matches current time of day
   */
  isItemScheduledForNow(item) {
    if (!item || !item.schedule || item.schedule === 'all') return true;
    const hour = new Date().getHours();
    if (item.schedule === 'morning') return hour >= 6 && hour < 11;
    if (item.schedule === 'afternoon') return hour >= 11 && hour < 17;
    if (item.schedule === 'evening') return hour >= 17 && hour < 23;
    return true;
  }

  /**
   * Get all playlist items
   */
  getItems() {
    return this.playlist;
  }

  /**
   * Get active scheduled playlist items for current time
   */
  getActiveItems() {
    const active = this.playlist.filter(item => this.isItemScheduledForNow(item));
    return active.length > 0 ? active : this.playlist; // Fallback to all items if none match current slot
  }

  /**
   * Get total number of items
   */
  get length() {
    return this.playlist.length;
  }

  /**
   * Get item by index from active playlist
   */
  getItem(index) {
    const items = this.getActiveItems();
    if (items.length === 0) return null;
    const normalizedIndex = (index + items.length) % items.length;
    return items[normalizedIndex];
  }

  /**
   * Get current playing item
   */
  getCurrentItem() {
    return this.getItem(this.currentIndex);
  }

  /**
   * Advance to next item in active schedule
   */
  next() {
    const items = this.getActiveItems();
    if (items.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % items.length;
    return this.getCurrentItem();
  }

  /**
   * Return to previous item in active schedule
   */
  previous() {
    const items = this.getActiveItems();
    if (items.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + items.length) % items.length;
    return this.getCurrentItem();
  }

  /**
   * Add new item to playlist
   */
  async addItem(itemData, fileBlob = null) {
    const newItem = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: itemData.title || 'Untitled Ad',
      subtitle: itemData.subtitle || '',
      type: itemData.type || 'image',
      url: itemData.url || '',
      duration: parseInt(itemData.duration, 10) || 10,
      muted: itemData.muted !== undefined ? itemData.muted : true,
      schedule: itemData.schedule || 'all',
      isLocalBlob: false
    };

    if (fileBlob) {
      newItem.isLocalBlob = true;
      await saveMediaBlob(newItem.id, fileBlob);
    }

    this.playlist.push(newItem);
    this.save();
    return newItem;
  }

  /**
   * Update existing playlist item properties
   */
  async updateItem(id, itemData, newFileBlob = null) {
    const item = this.playlist.find(i => i.id === id);
    if (!item) return null;

    if (itemData.title !== undefined) item.title = itemData.title;
    if (itemData.subtitle !== undefined) item.subtitle = itemData.subtitle;
    if (itemData.type !== undefined) item.type = itemData.type;
    if (itemData.duration !== undefined) item.duration = parseInt(itemData.duration, 10) || 10;
    if (itemData.schedule !== undefined) item.schedule = itemData.schedule;

    if (newFileBlob) {
      item.isLocalBlob = true;
      item.url = '';
      await saveMediaBlob(item.id, newFileBlob);
      if (this.blobUrls.has(item.id)) {
        URL.revokeObjectURL(this.blobUrls.get(item.id));
        this.blobUrls.delete(item.id);
      }
    } else if (itemData.url !== undefined && itemData.url !== '') {
      if (item.isLocalBlob) {
        await deleteMediaBlob(item.id);
        if (this.blobUrls.has(item.id)) {
          URL.revokeObjectURL(this.blobUrls.get(item.id));
          this.blobUrls.delete(item.id);
        }
        item.isLocalBlob = false;
      }
      item.url = itemData.url;
    }

    this.save();
    return item;
  }

  /**
   * Remove item from playlist
   */
  async removeItem(id) {
    const item = this.playlist.find(i => i.id === id);
    if (item && item.isLocalBlob) {
      await deleteMediaBlob(id);
      if (this.blobUrls.has(id)) {
        URL.revokeObjectURL(this.blobUrls.get(id));
        this.blobUrls.delete(id);
      }
    }
    this.playlist = this.playlist.filter(i => i.id !== id);
    if (this.currentIndex >= this.playlist.length) {
      this.currentIndex = 0;
    }
    this.save();
  }

  /**
   * Move item up or down in order
   */
  reorder(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.playlist.length) return;
    if (toIndex < 0 || toIndex >= this.playlist.length) return;

    const [moved] = this.playlist.splice(fromIndex, 1);
    this.playlist.splice(toIndex, 0, moved);
    this.save();
  }

  /**
   * Resolve final display URL (converting IndexedDB Blob to BlobURL if necessary)
   */
  async getResolvedUrl(item) {
    if (!item) return '';
    if (item.isLocalBlob) {
      if (this.blobUrls.has(item.id)) {
        return this.blobUrls.get(item.id);
      }
      const blob = await getMediaBlob(item.id);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        this.blobUrls.set(item.id, objectUrl);
        return objectUrl;
      }
    }
    // Pass through MediaCacheManager for offline caching & fast local playback
    return await this.mediaCache.getMediaUrl(item.url);
  }

  /**
   * Sync background caching and automatic storage pruning
   */
  syncCache() {
    if (this.mediaCache) {
      this.mediaCache.preloadPlaylist(this.playlist);
      this.mediaCache.pruneUnusedCache(this.playlist);
    }
  }

  /**
   * Get telemetry status of local storage cache for all items
   */
  async getCacheTelemetry() {
    if (!this.mediaCache) return { cachedCount: 0, totalCount: this.playlist.length, items: [] };
    return await this.mediaCache.getPlaylistCacheStats(this.playlist);
  }

  /**
   * Reset playlist back to original sample campaign
   */
  resetToDefaults() {
    this.playlist = [...DEFAULT_PLAYLIST];
    this.currentIndex = 0;
    this.save();
  }

  /**
   * Save playlist state to LocalStorage and sync cache
   */
  save() {
    setStoredConfig('playlist', this.playlist);
    this.syncCache();
  }
}
