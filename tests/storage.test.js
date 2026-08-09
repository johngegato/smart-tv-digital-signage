import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  initStorage,
  saveMediaBlob,
  getMediaBlob,
  deleteMediaBlob,
  getAllMediaRecords,
  clearAllMediaBlobs,
  getStoredConfig,
  setStoredConfig,
  removeStoredConfig
} from '../js/storage.js';

describe('Storage Manager (IndexedDB & LocalStorage)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllMediaBlobs().catch(() => {});
  });

  it('should initialize IndexedDB successfully', async () => {
    const db = await initStorage();
    expect(db).toBeDefined();
    expect(db.name).toBe('SmartTVDigitalSignageDB');
  });

  it('should save and retrieve a media Blob in IndexedDB', async () => {
    const testBlob = new Blob(['sample-video-binary-content'], { type: 'video/mp4' });
    const id = 'item-101';

    await saveMediaBlob(id, testBlob);
    const retrievedBlob = await getMediaBlob(id);

    expect(retrievedBlob).toBeDefined();
    expect(retrievedBlob).not.toBeNull();
  });

  it('should delete a media Blob from IndexedDB', async () => {
    const testBlob = new Blob(['image-content'], { type: 'image/png' });
    const id = 'item-102';

    await saveMediaBlob(id, testBlob);
    expect(await getMediaBlob(id)).not.toBeNull();

    await deleteMediaBlob(id);
    expect(await getMediaBlob(id)).toBeNull();
  });

  it('should list all stored media records', async () => {
    const blob1 = new Blob(['media1'], { type: 'image/jpeg' });
    const blob2 = new Blob(['media2'], { type: 'video/webm' });

    await saveMediaBlob('id-1', blob1);
    await saveMediaBlob('id-2', blob2);

    const records = await getAllMediaRecords();
    expect(records.length).toBe(2);
    expect(records.map(r => r.id)).toContain('id-1');
    expect(records.map(r => r.id)).toContain('id-2');
  });

  it('should get, set, and remove LocalStorage config helpers', () => {
    expect(getStoredConfig('layout', 'fullscreen')).toBe('fullscreen');

    setStoredConfig('layout', 'splitscreen');
    expect(getStoredConfig('layout', 'fullscreen')).toBe('splitscreen');

    removeStoredConfig('layout');
    expect(getStoredConfig('layout', 'default')).toBe('default');
  });
});
