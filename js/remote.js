/**
 * Smart TV Remote Control & Spatial Navigation Handler for LG webOS TV & Devant Smart TV
 */

export class RemoteController {
  constructor(options = {}) {
    this.player = options.player;
    this.onOpenStudio = options.onOpenStudio;
    this.onToggleFullscreen = options.onToggleFullscreen;
    this.onSwitchLayout = options.onSwitchLayout;

    this.overlayTimeout = null;
    this.isOverlayActive = false;
    this.currentFocusedIndex = 0;

    this.initKeyboardListeners();
    this.initOverlayAutoHiding();
    this.initFocusManager();
  }

  /**
   * Listen to TV Remote & Keyboard events (webOS TV + Desktop)
   */
  initKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      this.showOverlayTemporarily();
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      console.log(`[Remote] Key pressed: key="${key}", keyCode=${keyCode}`);

      // WEBOS BACK BUTTON (KeyCode 461 / 8 / 'Back' / 'GoBack' / 'Escape' / 'Backspace')
      const isInputTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (keyCode === 461 || key === 'Back' || key === 'GoBack' || key === 'Escape' || (key === 'Backspace' && !isInputTyping)) {
        e.preventDefault();
        e.stopPropagation();
        this.handleWebOSBackKey();
        return;
      }

      // LG WEBOS COLOR BUTTON SHORTCUTS
      if (keyCode === 403 || key === 'r' || key === 'R') { // RED
        e.preventDefault();
        if (this.onSwitchLayout) this.onSwitchLayout('fullscreen');
        return;
      }
      if (keyCode === 404 || key === 'g' || key === 'G') { // GREEN
        e.preventDefault();
        if (this.onSwitchLayout) this.onSwitchLayout('splitscreen');
        return;
      }
      if (keyCode === 405 || key === 'y' || key === 'Y') { // YELLOW
        e.preventDefault();
        if (this.onSwitchLayout) this.onSwitchLayout('grid');
        return;
      }
      if (keyCode === 406 || key === 'b' || key === 'B') { // BLUE
        e.preventDefault();
        if (this.onOpenStudio) this.onOpenStudio();
        return;
      }

      // SPATIAL D-PAD NAVIGATION (Arrow Keys)
      if ([37, 38, 39, 40, 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(keyCode) || 
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        
        // If an overlay/modal/studio is open, perform spatial D-pad focus movement
        if (this.isNavigationalFocusActive()) {
          const directionMap = {
            37: 'left', 'ArrowLeft': 'left',
            38: 'up', 'ArrowUp': 'up',
            39: 'right', 'ArrowRight': 'right',
            40: 'down', 'ArrowDown': 'down'
          };
          const dir = directionMap[keyCode] || directionMap[key];
          if (dir) {
            e.preventDefault();
            this.navigateSpatial(dir);
            return;
          }
        }
      }

      // MEDIA PLAYBACK CONTROL KEYS
      switch (keyCode) {
        case 415: // VK_PLAY
        case 19:  // VK_PAUSE
        case 463: // VK_PLAY_PAUSE
          e.preventDefault();
          this.player.isPlaying ? this.player.pause() : this.player.start();
          return;

        case 413: // VK_STOP
          e.preventDefault();
          this.player.pause();
          return;

        case 412: // VK_REWIND
          e.preventDefault();
          this.player.previous();
          return;

        case 417: // VK_FAST_FWD
          e.preventDefault();
          this.player.next();
          return;
      }

      // GENERAL KEYBOARD SHORTCUTS
      switch (key) {
        case 'm':
        case 'M':
        case 'VolumeMute':
          const muted = this.player.toggleMute();
          this.updateMuteIcon(muted);
          break;

        case 'f':
        case 'F':
          if (this.onToggleFullscreen) this.onToggleFullscreen();
          break;

        case 's':
        case 'S':
          if (this.onOpenStudio) this.onOpenStudio();
          break;

        case 'h':
        case 'H':
          this.toggleOverlayManual();
          break;

        case '1':
          if (this.onSwitchLayout) this.onSwitchLayout('fullscreen');
          break;
        case '2':
          if (this.onSwitchLayout) this.onSwitchLayout('splitscreen');
          break;
        case '3':
          if (this.onSwitchLayout) this.onSwitchLayout('grid');
          break;
        case '4':
          if (this.onSwitchLayout) this.onSwitchLayout('portrait');
          break;
      }
    });

    // Mouse / Pointer movements reveal overlay
    window.addEventListener('mousemove', () => {
      this.showOverlayTemporarily();
    });
  }

  /**
   * Handle webOS Back Button (KeyCode 461)
   */
  handleWebOSBackKey() {
    const editModal = document.getElementById('edit-item-modal');
    if (editModal && !editModal.classList.contains('hidden')) {
      editModal.classList.add('hidden');
      const closeBtn = document.getElementById('btn-close-studio');
      if (closeBtn) closeBtn.focus();
      return;
    }

    const studioDrawer = document.getElementById('studio-drawer');
    if (studioDrawer && studioDrawer.classList.contains('open')) {
      const closeBtn = document.getElementById('btn-close-studio');
      if (closeBtn) {
        closeBtn.click();
      } else {
        studioDrawer.classList.remove('open');
      }
      return;
    }

    const virtualRemote = document.getElementById('virtual-remote-modal');
    if (virtualRemote && !virtualRemote.classList.contains('hidden')) {
      virtualRemote.classList.add('hidden');
      return;
    }

    // Toggle control overlay or notify exit confirmation
    if (this.isOverlayActive) {
      const overlay = document.getElementById('tv-control-overlay');
      if (overlay) overlay.classList.remove('active');
      this.isOverlayActive = false;
    } else {
      this.showOverlayTemporarily();
    }
  }

  /**
   * Determine if spatial D-pad focus should navigate visible interactive elements
   */
  isNavigationalFocusActive() {
    const studioOpen = document.getElementById('studio-drawer')?.classList.contains('open');
    const modalOpen = !document.getElementById('edit-item-modal')?.classList.contains('hidden');
    const remoteModalOpen = !document.getElementById('virtual-remote-modal')?.classList.contains('hidden');
    const overlayActive = this.isOverlayActive || document.getElementById('tv-control-overlay')?.classList.contains('active');

    return studioOpen || modalOpen || remoteModalOpen || overlayActive;
  }

  /**
   * 4-Directional Spatial Navigation Engine
   */
  navigateSpatial(direction) {
    const focusableSelector = '.tv-focusable, button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    
    // Find containers that are currently active/visible
    let activeContainer = document.body;
    const modal = document.getElementById('edit-item-modal');
    const studio = document.getElementById('studio-drawer');
    
    if (modal && !modal.classList.contains('hidden')) {
      activeContainer = modal;
    } else if (studio && studio.classList.contains('open')) {
      activeContainer = studio;
    }

    const elements = Array.from(activeContainer.querySelectorAll(focusableSelector)).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    });

    if (elements.length === 0) return;

    let current = document.activeElement;
    if (!elements.includes(current)) {
      current = elements[0];
      current.focus();
      return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let minDistance = Infinity;

    elements.forEach(el => {
      if (el === current) return;

      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isCandidate = false;

      if (direction === 'left' && dx < -10 && Math.abs(dy) < Math.abs(dx) * 2) isCandidate = true;
      if (direction === 'right' && dx > 10 && Math.abs(dy) < Math.abs(dx) * 2) isCandidate = true;
      if (direction === 'up' && dy < -10 && Math.abs(dx) < Math.abs(dy) * 2) isCandidate = true;
      if (direction === 'down' && dy > 10 && Math.abs(dx) < Math.abs(dy) * 2) isCandidate = true;

      if (isCandidate) {
        const distance = Math.hypot(dx, dy);
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = el;
        }
      }
    });

    if (bestCandidate) {
      bestCandidate.focus();
    }
  }

  initFocusManager() {
    // Add visual focus styling listener
    document.addEventListener('focusin', (e) => {
      document.querySelectorAll('.tv-focus-active').forEach(el => el.classList.remove('tv-focus-active'));
      if (e.target && e.target.classList) {
        e.target.classList.add('tv-focus-active');
      }
    });
  }

  initOverlayAutoHiding() {
    const overlay = document.getElementById('tv-control-overlay');
    if (!overlay) return;
  }

  showOverlayTemporarily() {
    const overlay = document.getElementById('tv-control-overlay');
    if (!overlay) return;

    overlay.classList.add('active');
    this.isOverlayActive = true;

    if (this.overlayTimeout) clearTimeout(this.overlayTimeout);

    this.overlayTimeout = setTimeout(() => {
      const activeEl = document.activeElement;
      const isInsideOverlay = overlay.contains(activeEl);

      // Only hide if user isn't actively focusing inside overlay buttons
      if (!isInsideOverlay) {
        overlay.classList.remove('active');
        this.isOverlayActive = false;
      }
    }, 6000);
  }

  toggleOverlayManual() {
    const overlay = document.getElementById('tv-control-overlay');
    if (!overlay) return;

    if (this.isOverlayActive) {
      overlay.classList.remove('active');
      this.isOverlayActive = false;
    } else {
      this.showOverlayTemporarily();
      const firstBtn = overlay.querySelector('.tv-focusable');
      if (firstBtn) firstBtn.focus();
    }
  }

  updateMuteIcon(isMuted) {
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
    }
    const unmuteBanner = document.getElementById('unmute-banner');
    if (unmuteBanner) {
      if (isMuted) {
        unmuteBanner.classList.remove('hidden');
      } else {
        unmuteBanner.classList.add('hidden');
      }
    }
  }
}
