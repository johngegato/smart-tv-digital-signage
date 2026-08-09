import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { PlaylistManager } from '../js/playlist.js';

describe('PlaylistManager Core', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    manager = new PlaylistManager();
  });

  it('should initialize with default playlist items', () => {
    const items = manager.getItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBe('sample_coffee');
  });

  it('should filter active items based on schedule constraint', () => {
    const itemMorning = { id: 'm1', schedule: 'morning' };
    const itemEvening = { id: 'e1', schedule: 'evening' };

    // Mock Date.getHours
    const originalGetHours = Date.prototype.getHours;
    Date.prototype.getHours = vi.fn().mockReturnValue(8); // 8 AM

    expect(manager.isItemScheduledForNow(itemMorning)).toBe(true);
    expect(manager.isItemScheduledForNow(itemEvening)).toBe(false);

    Date.prototype.getHours = originalGetHours;
  });

  it('should navigate through items using next() and previous()', () => {
    const first = manager.getCurrentItem();
    expect(first).toBeDefined();

    const second = manager.next();
    expect(second).not.toEqual(first);

    const backToFirst = manager.previous();
    expect(backToFirst).toEqual(first);
  });

  it('should add a new playlist item', async () => {
    const newAd = {
      title: 'New Promo Ad',
      type: 'image',
      url: 'https://example.com/promo.jpg',
      duration: 15
    };

    const added = await manager.addItem(newAd);
    expect(added.id).toBeDefined();
    expect(manager.getItems().length).toBe(5);
  });

  it('should reorder items correctly', () => {
    const initialFirstId = manager.getItems()[0].id;
    const initialSecondId = manager.getItems()[1].id;

    manager.reorder(0, 1);
    expect(manager.getItems()[0].id).toBe(initialSecondId);
    expect(manager.getItems()[1].id).toBe(initialFirstId);
  });

  it('should merge authoritative playlist from server while preserving local blobs', () => {
    const localBlobItem = { id: 'local_101', title: 'Local File', isLocalBlob: true };
    manager.playlist.push(localBlobItem);

    const serverPlaylist = [
      { id: 'server_1', title: 'Server Ad 1' },
      { id: 'server_2', title: 'Server Ad 2' }
    ];

    manager.mergeAuthoritativePlaylist(serverPlaylist);
    const updated = manager.getItems();

    expect(updated.length).toBe(3);
    expect(updated.some(i => i.id === 'server_1')).toBe(true);
    expect(updated.some(i => i.id === 'local_101')).toBe(true);
  });
});
