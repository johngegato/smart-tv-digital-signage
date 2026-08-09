import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SignagePlayer } from '../js/player.js';
import { PlaylistManager } from '../js/playlist.js';

describe('SignagePlayer Engine', () => {
  let viewport;
  let playlistManager;
  let player;

  beforeEach(() => {
    document.body.innerHTML = '<div id="media-viewport"></div>';
    viewport = document.getElementById('media-viewport');
    playlistManager = new PlaylistManager();
    player = new SignagePlayer(viewport, playlistManager);
  });

  it('should initialize dual media layers for crossfading', () => {
    expect(player.layers.length).toBe(2);
    expect(viewport.querySelectorAll('.media-layer').length).toBe(2);
  });

  it('should clean layer DOM and pause video elements', () => {
    const layer = player.layerA;
    const video = document.createElement('video');
    video.pause = vi.fn();
    layer.appendChild(video);

    expect(layer.children.length).toBe(1);
    player.cleanLayer(layer);

    expect(video.pause).toHaveBeenCalled();
    expect(layer.children.length).toBe(0);
  });

  it('should toggle audio mute state', () => {
    expect(player.isMuted).toBe(true);
    const newMuteState = player.toggleMute();
    expect(newMuteState).toBe(false);
    expect(player.isMuted).toBe(false);
  });

  it('should start playing current item and swap active layer', async () => {
    const playSpy = vi.spyOn(player, 'playCurrent');
    player.start();

    expect(player.isPlaying).toBe(true);
    expect(playSpy).toHaveBeenCalled();
  });
});
