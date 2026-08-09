import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { MediaCacheManager } from '../js/cache.js';

describe('MediaCacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new MediaCacheManager();
  });

  it('should pass relative asset URLs through directly', async () => {
    const assetUrl = './assets/coffee_ad.jpg';
    const resolved = await cacheManager.getMediaUrl(assetUrl);

    expect(resolved).toBe(assetUrl);
    expect(cacheManager.getCacheHitRatio()).toBe(1.0);
  });

  it('should identify cached URLs correctly', async () => {
    const assetUrl = './assets/tech_ad.jpg';
    const isCached = await cacheManager.isUrlCached(assetUrl);

    expect(isCached).toBe(true);
  });

  it('should generate playlist cache stats telemetry', async () => {
    const playlist = [
      { id: '1', url: './assets/coffee_ad.jpg' },
      { id: '2', url: 'https://example.com/remote.mp4' }
    ];

    const stats = await cacheManager.getPlaylistCacheStats(playlist);
    expect(stats.totalCount).toBe(2);
    expect(stats.items.length).toBe(2);
  });
});
