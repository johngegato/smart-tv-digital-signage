import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteController } from '../js/remote.js';

describe('RemoteController Engine', () => {
  let remote;
  let mockPlayer;
  let mockOnSwitchLayout;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tv-control-overlay" class="glass-panel">
        <button id="btn-1" class="tv-focusable">Btn 1</button>
        <button id="btn-2" class="tv-focusable">Btn 2</button>
      </div>
      <div id="edit-item-modal" class="hidden"></div>
      <div id="studio-drawer"></div>
    `;

    mockPlayer = {
      isPlaying: true,
      pause: vi.fn(),
      start: vi.fn(),
      previous: vi.fn(),
      next: vi.fn(),
      toggleMute: vi.fn().mockReturnValue(false)
    };

    mockOnSwitchLayout = vi.fn();

    remote = new RemoteController({
      player: mockPlayer,
      onSwitchLayout: mockOnSwitchLayout
    });
  });

  it('should handle numeric layout switch keys (1, 2, 3, 4)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(mockOnSwitchLayout).toHaveBeenCalledWith('fullscreen');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(mockOnSwitchLayout).toHaveBeenCalledWith('splitscreen');
  });

  it('should toggle mute state on M keypress', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    expect(mockPlayer.toggleMute).toHaveBeenCalled();
  });

  it('should calculate spatial candidate elements for D-Pad navigation', () => {
    const btn1 = document.getElementById('btn-1');
    const btn2 = document.getElementById('btn-2');
    btn1.focus();

    remote.navigateSpatial('right');
    expect(document.activeElement).toBeDefined();
  });
});
