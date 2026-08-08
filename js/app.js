import { PlaylistManager } from './playlist.js';
import { SignagePlayer } from './player.js';
import { WidgetEngine } from './widgets.js';
import { RemoteController } from './remote.js';
import { WebOSHandler } from './webos.js';
import { SignageWebSocketClient } from './websocket.js';
import { getStoredConfig, setStoredConfig } from './storage.js';

class DigitalSignageApp {
  constructor() {
    this.webOS = new WebOSHandler();
    this.playlistManager = new PlaylistManager();
    this.currentLayout = getStoredConfig('layout', 'fullscreen');
    this.currentSourceMode = 'local'; // 'local' or 'url'
    this.selectedFile = null; // Holds local file selection

    this.viewport = document.getElementById('media-viewport');
    this.player = new SignagePlayer(this.viewport, this.playlistManager);
    this.widgets = new WidgetEngine();

    this.remote = new RemoteController({
      player: this.player,
      onOpenStudio: () => this.toggleStudioDrawer(true),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onSwitchLayout: (layout) => this.setLayout(layout)
    });

    this.deviceId = getStoredConfig('deviceId', null);
    if (!this.deviceId) {
      this.deviceId = 'tv_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      setStoredConfig('deviceId', this.deviceId);
    }
    this.deviceName = getStoredConfig('deviceName', 'Lobby TV');

    this.wsClient = new SignageWebSocketClient({
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      onStatusRequested: () => ({
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        playlist: this.playlistManager.getItems(),
        currentIndex: this.playlistManager.currentIndex,
        isPlaying: this.player.isPlaying,
        layout: this.currentLayout,
        tickerText: this.widgets.tickerText,
        qrUrl: getStoredConfig('qrUrl', 'https://example.com/signage-promo'),
        qrLabel: getStoredConfig('qrLabel', 'Scan to View Special Menu & Exclusive Offers')
      }),
      onPlayItemCommand: async (idx) => {
        this.playlistManager.currentIndex = idx;
        await this.player.playCurrent();
      },
      onReorderCommand: async (fromIdx, toIdx) => {
        this.playlistManager.reorder(fromIdx, toIdx);
        this.renderStudioPlaylist();
        await this.player.playCurrent();
      },
      onAddItemCommand: async (itemData) => {
        await this.playlistManager.addItem(itemData);
        this.renderStudioPlaylist();
        await this.player.playCurrent();
      },
      onUpdateItemCommand: async (itemData) => {
        await this.playlistManager.updateItem(itemData.id, itemData);
        this.renderStudioPlaylist();
        await this.player.playCurrent();
      },
      onDeleteItemCommand: async (id) => {
        await this.playlistManager.removeItem(id);
        this.renderStudioPlaylist();
        await this.player.playCurrent();
      },
      onPlayPauseCommand: () => {
        if (this.player.isPlaying) this.player.pause(); else this.player.start();
      },
      onPrevItemCommand: () => this.player.previous(),
      onNextItemCommand: () => this.player.next(),
      onSetLayoutCommand: (layout) => this.setLayout(layout),
      onSetTickerCommand: (text) => {
        this.widgets.initTicker('ticker-text', text);
        setStoredConfig('tickerText', text);
      },
      onSetQrCommand: (url, label) => {
        if (url) setStoredConfig('qrUrl', url);
        if (label) setStoredConfig('qrLabel', label);
        this.updateQRCodeWidget(url || getStoredConfig('qrUrl', 'https://example.com/signage-promo'), label || getStoredConfig('qrLabel', ''));
      },
      onStateChange: (connected, url) => this.updateServerStatusUI(connected, url)
    });

    this.init();
  }

  /**
   * Initialize App State & UI Listeners
   */
  async init() {
    // Set active initial layout template
    this.setLayout(this.currentLayout);

    // Initialize Widgets
    this.widgets.startClock('clock-time', 'clock-date', 'fs-clock-time');
    this.widgets.startWeather('weather-temp', 'weather-desc', 'weather-icon');
    this.widgets.initTicker('ticker-text', getStoredConfig('tickerText', null));
    
    const savedQrUrl = getStoredConfig('qrUrl', 'https://example.com/signage-promo');
    const savedQrLabel = getStoredConfig('qrLabel', 'Scan to View Special Menu & Exclusive Offers');
    this.updateQRCodeWidget(savedQrUrl, savedQrLabel);

    // Render Studio Playlist Items
    this.renderStudioPlaylist();

    // Setup Studio Form Event Listeners
    this.bindStudioEvents();

    // Setup Edit Modal Events
    this.bindEditModalEvents();

    // Setup Floating Remote Overlay Buttons
    this.bindOverlayControls();

    // Setup Virtual Remote Simulator Controls
    this.bindVirtualRemote();

    // Setup Online/Offline Network Listeners
    this.initNetworkListeners();

    // Setup WebSocket Server Connect UI
    this.bindServerConnectEvents();

    // Setup QR Code Form Events
    this.bindQrFormEvents();

    // Auto-connect to stored WebSocket server IP if saved
    const savedServerIp = getStoredConfig('serverIp', 'localhost');
    if (savedServerIp) {
      const serverIpInput = document.getElementById('input-server-ip');
      if (serverIpInput) serverIpInput.value = savedServerIp;
      this.wsClient.connect(savedServerIp, 3000);
    }

    // Start Player
    this.player.start();
  }

  /**
   * Switch TV Display Layout Template
   */
  setLayout(layoutName) {
    const container = document.getElementById('display-container');
    container.className = `layout-${layoutName}`;
    this.currentLayout = layoutName;
    setStoredConfig('layout', layoutName);

    const fsClock = document.getElementById('fullscreen-clock');
    if (fsClock) {
      if (layoutName === 'fullscreen') {
        fsClock.classList.remove('hidden');
      } else {
        fsClock.classList.add('hidden');
      }
    }

    // Highlight active button in controls overlay
    document.querySelectorAll('.layout-opt-btn').forEach(btn => {
      if (btn.dataset.layout === layoutName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Toggle Studio Drawer Open/Closed
   */
  toggleStudioDrawer(forceOpen = null) {
    const drawer = document.getElementById('studio-drawer');
    if (!drawer) return;

    const isOpen = forceOpen !== null ? forceOpen : !drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.add('open');
      this.renderStudioPlaylist();
      
      // Auto-focus Close button for seamless TV remote control navigation
      setTimeout(() => {
        const closeBtn = document.getElementById('btn-close-studio');
        if (closeBtn) {
          closeBtn.classList.add('tv-focusable');
          closeBtn.focus();
        }
      }, 100);
    } else {
      drawer.classList.remove('open');
      const studioBtn = document.getElementById('btn-studio');
      if (studioBtn) studioBtn.focus();
    }
  }

  /**
   * Render Studio Playlist List Cards
   */
  renderStudioPlaylist() {
    const container = document.getElementById('playlist-list-container');
    if (!container) return;

    const items = this.playlistManager.getItems();
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No items in playlist. Upload or add a media item above.</div>`;
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      
      const badge = item.type === 'video' ? '🎥 VIDEO' : '🖼️ IMAGE';
      const durationText = `${item.duration}s`;
      const scheduleText = item.schedule ? ` (${item.schedule})` : '';

      card.innerHTML = `
        <div class="playlist-card-info">
          <div class="playlist-card-title">${item.title}</div>
          <div class="playlist-card-meta">
            <span>${badge}</span> • <span>⏱️ ${durationText}${scheduleText}</span>
          </div>
        </div>
        <div class="playlist-card-actions">
          <button class="action-btn tv-focusable" data-act="edit" data-id="${item.id}" title="Edit Item">✏️</button>
          <button class="action-btn tv-focusable" data-act="up" data-idx="${index}" title="Move Up">▲</button>
          <button class="action-btn tv-focusable" data-act="down" data-idx="${index}" title="Move Down">▼</button>
          <button class="action-btn delete tv-focusable" data-act="del" data-id="${item.id}" title="Delete">🗑️</button>
        </div>
      `;

      container.appendChild(card);
    });

    // Reorder, Edit, and Delete event bindings
    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const act = btn.dataset.act;
        const idx = parseInt(btn.dataset.idx, 10);
        const id = btn.dataset.id;

        if (act === 'edit') {
          this.openEditModal(id);
        } else if (act === 'up') {
          this.playlistManager.reorder(idx, idx - 1);
          this.renderStudioPlaylist();
          this.player.playCurrent();
        } else if (act === 'down') {
          this.playlistManager.reorder(idx, idx + 1);
          this.renderStudioPlaylist();
          this.player.playCurrent();
        } else if (act === 'del') {
          await this.playlistManager.removeItem(id);
          this.renderStudioPlaylist();
          this.player.playCurrent();
        }
      });
    });
  }

  /**
   * Bind Studio Form and Dropzone Events
   */
  bindStudioEvents() {
    // Close Drawer Button
    document.getElementById('btn-close-studio')?.addEventListener('click', () => {
      this.toggleStudioDrawer(false);
    });

    // Source Mode Switcher Tabs (Local vs Web URL)
    document.querySelectorAll('.source-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentSourceMode = tab.dataset.source;

        const localContainer = document.getElementById('local-file-container');
        const urlContainer = document.getElementById('url-input-container');

        if (this.currentSourceMode === 'local') {
          localContainer?.classList.remove('hidden');
          urlContainer?.classList.add('hidden');
          document.getElementById('input-url').required = false;
        } else {
          localContainer?.classList.add('hidden');
          urlContainer?.classList.remove('hidden');
          document.getElementById('input-url').required = true;
        }
      });
    });

    // File Upload Dropzone Events
    const dropzone = document.getElementById('media-dropzone');
    const fileInput = document.getElementById('media-file-input');

    dropzone?.addEventListener('click', () => fileInput?.click());

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.handleFileSelected(fileInput.files[0]);
      }
    });

    // Add Item via Form Submission
    const addForm = document.getElementById('add-item-form');
    addForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('input-title').value;
      const subtitle = document.getElementById('input-subtitle').value;
      const type = document.getElementById('input-type').value;
      const duration = document.getElementById('input-duration').value;
      const schedule = document.getElementById('input-schedule').value;
      const url = document.getElementById('input-url').value;

      if (this.currentSourceMode === 'local' && !this.selectedFile) {
        alert('Please select or drop a local media file.');
        return;
      }

      if (this.currentSourceMode === 'url' && !url) {
        alert('Please enter a valid media web URL.');
        return;
      }

      const itemData = { title, subtitle, type, duration, schedule, url };
      const fileBlob = this.currentSourceMode === 'local' ? this.selectedFile : null;

      await this.playlistManager.addItem(itemData, fileBlob);

      // Reset form and file selection state
      addForm.reset();
      this.selectedFile = null;
      this.resetDropzoneUI();

      this.renderStudioPlaylist();
      this.player.playCurrent();
    });

    // Custom Ticker Text Update Form
    const tickerForm = document.getElementById('ticker-form');
    tickerForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = document.getElementById('input-ticker-text').value;
      if (text) {
        this.widgets.initTicker('ticker-text', text);
        setStoredConfig('tickerText', text);
      }
    });

    // Reset Defaults Button
    document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
      if (confirm('Reset playlist back to original sample campaign?')) {
        this.playlistManager.resetToDefaults();
        this.renderStudioPlaylist();
        this.player.playCurrent();
      }
    });
  }

  /**
   * Handle File Selection for Form
   */
  handleFileSelected(file) {
    this.selectedFile = file;
    const isVideo = file.type.startsWith('video/');

    // Update Dropzone UI indicator
    const mainLabel = document.getElementById('dropzone-label-main');
    const subLabel = document.getElementById('dropzone-label-sub');
    if (mainLabel) mainLabel.textContent = `Selected: ${file.name}`;
    if (subLabel) subLabel.textContent = `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to add`;

    // Auto fill title if empty
    const titleInput = document.getElementById('input-title');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, '');
    }

    // Auto set type dropdown
    const typeSelect = document.getElementById('input-type');
    if (typeSelect) {
      typeSelect.value = isVideo ? 'video' : 'image';
    }
  }

  /**
   * Reset Dropzone UI back to default
   */
  resetDropzoneUI() {
    const mainLabel = document.getElementById('dropzone-label-main');
    const subLabel = document.getElementById('dropzone-label-sub');
    if (mainLabel) mainLabel.textContent = 'Click or Drag & Drop File Here';
    if (subLabel) subLabel.textContent = 'Supports MP4, WebM, PNG, JPG, WebP';
  }

  /**
   * Open Edit Item Modal Pre-filled with Item Data
   */
  openEditModal(id) {
    const items = this.playlistManager.getItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-title').value = item.title || '';
    document.getElementById('edit-subtitle').value = item.subtitle || '';
    document.getElementById('edit-type').value = item.type || 'image';
    document.getElementById('edit-duration').value = item.duration || 10;
    document.getElementById('edit-schedule').value = item.schedule || 'all';
    document.getElementById('edit-url').value = item.isLocalBlob ? '' : (item.url || '');

    const modal = document.getElementById('edit-item-modal');
    modal?.classList.remove('hidden');
  }

  /**
   * Close Edit Item Modal
   */
  closeEditModal() {
    const modal = document.getElementById('edit-item-modal');
    modal?.classList.add('hidden');
  }

  /**
   * Bind Edit Modal Events
   */
  bindEditModalEvents() {
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('btn-cancel-edit-modal')?.addEventListener('click', () => this.closeEditModal());

    const editForm = document.getElementById('edit-item-form');
    editForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-item-id').value;
      const title = document.getElementById('edit-title').value;
      const subtitle = document.getElementById('edit-subtitle').value;
      const type = document.getElementById('edit-type').value;
      const duration = document.getElementById('edit-duration').value;
      const schedule = document.getElementById('edit-schedule').value;
      const url = document.getElementById('edit-url').value;

      await this.playlistManager.updateItem(id, { title, subtitle, type, duration, schedule, url });

      this.closeEditModal();
      this.renderStudioPlaylist();
      this.player.playCurrent();
    });
  }

  /**
   * Bind Floating Control Overlay Buttons
   */
  bindOverlayControls() {
    document.getElementById('btn-prev')?.addEventListener('click', () => this.player.previous());
    document.getElementById('btn-next')?.addEventListener('click', () => this.player.next());
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
      if (this.player.isPlaying) {
        this.player.pause();
        document.getElementById('btn-play-pause').innerHTML = '▶';
      } else {
        this.player.start();
        document.getElementById('btn-play-pause').innerHTML = '⏸';
      }
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => {
      const muted = this.player.toggleMute();
      this.remote.updateMuteIcon(muted);
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-studio')?.addEventListener('click', () => this.toggleStudioDrawer(true));

    // Layout Option Buttons
    document.querySelectorAll('.layout-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        this.setLayout(layout);
      });
    });

    // Unmute Banner Click
    document.getElementById('unmute-banner')?.addEventListener('click', () => {
      const muted = this.player.toggleMute();
      this.remote.updateMuteIcon(muted);
    });
  }

  /**
   * Bind Virtual Remote Simulator D-pad
   */
  bindVirtualRemote() {
    document.getElementById('remote-up')?.addEventListener('click', () => this.player.previous());
    document.getElementById('remote-down')?.addEventListener('click', () => this.player.next());
    document.getElementById('remote-left')?.addEventListener('click', () => this.player.previous());
    document.getElementById('remote-right')?.addEventListener('click', () => this.player.next());
    document.getElementById('remote-ok')?.addEventListener('click', () => {
      if (this.player.isPlaying) this.player.pause(); else this.player.start();
    });

    document.getElementById('toggle-remote-sim')?.addEventListener('click', () => {
      const sim = document.getElementById('virtual-remote-modal');
      sim?.classList.toggle('hidden');
    });
  }

  /**
   * Bind Desktop Remote Server Connection UI
   */
  bindServerConnectEvents() {
    const btnConnect = document.getElementById('btn-connect-server');
    const inputIp = document.getElementById('input-server-ip');
    const inputName = document.getElementById('input-tv-profile-name');

    if (inputName) {
      inputName.value = this.deviceName;
    }

    btnConnect?.addEventListener('click', () => {
      const ip = inputIp?.value.trim();
      const name = inputName?.value.trim() || 'Smart TV';

      if (!ip) {
        alert('Please enter a valid Desktop Server IP address.');
        return;
      }
      this.deviceName = name;
      setStoredConfig('serverIp', ip);
      setStoredConfig('deviceName', name);

      this.wsClient.connect(ip, 3000, this.deviceId, this.deviceName);
    });
  }

  /**
   * Update WebSocket status badge in Studio
   */
  updateServerStatusUI(connected, url) {
    const badge = document.getElementById('ws-status-badge');
    if (!badge) return;
    if (connected) {
      badge.textContent = '● Connected';
      badge.classList.add('connected');
    } else {
      badge.textContent = '● Disconnected';
      badge.classList.remove('connected');
    }
  }

  /**
   * Bind QR Code Customization Form
   */
  bindQrFormEvents() {
    const qrForm = document.getElementById('qr-form');
    qrForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const qrUrl = document.getElementById('input-qr-url').value;
      const qrLabel = document.getElementById('input-qr-label').value;

      if (qrUrl) setStoredConfig('qrUrl', qrUrl);
      if (qrLabel) setStoredConfig('qrLabel', qrLabel);

      this.updateQRCodeWidget(qrUrl || 'https://example.com/signage-promo', qrLabel);
    });
  }

  /**
   * Update QR Code Widget Canvas & Label
   */
  updateQRCodeWidget(url, labelText) {
    this.widgets.generateQRCode('qr-code-canvas', url);
    const labelEl = document.getElementById('qr-code-label');
    if (labelEl && labelText) {
      labelEl.textContent = labelText;
    }
  }

  /**
   * Initialize Network Online/Offline Listeners
   */
  initNetworkListeners() {
    const offlineBanner = document.getElementById('offline-banner');
    const updateStatus = () => {
      if (navigator.onLine) {
        offlineBanner?.classList.add('hidden');
      } else {
        offlineBanner?.classList.remove('hidden');
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  /**
   * Fullscreen API Toggle
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }
}

// Bootstrap Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DigitalSignageApp();
});
