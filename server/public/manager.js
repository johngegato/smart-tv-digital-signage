/**
 * Signage Desktop Manager — Client-Side Logic
 * WebSocket real-time sync with TV + REST API for media uploads
 */

// ─── State ────────────────────────────────────────────────────────────────────
let ws = null;
let tvConnected = false;
let connectedTvs = [];
let selectedTargetDeviceId = 'all';
let tvPlaylist = [];
let tvCurrentIndex = -1;
let tvIsPlaying = false;
let tvLayout = 'fullscreen';
let tvCacheStats = null;
let serverInfo = { primaryIp: 'localhost', port: 3000 };
let selectedUploadFile = null;
let uploadFormVisible = false;

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await fetchServerInfo();
  connectWebSocket();
  loadMediaLibrary();
  bindUI();
}

// ─── Fetch Server Info ────────────────────────────────────────────────────────
async function fetchServerInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    serverInfo = { primaryIp: data.primaryIp, port: data.port };
    const ipDisplay = document.getElementById('server-ip-display');
    if (ipDisplay) ipDisplay.textContent = `${data.primaryIp}:${data.port}`;
  } catch (e) {
    console.warn('Could not fetch server info:', e);
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  console.log(`[WS] Connecting Manager UI to ${wsUrl}...`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Connected to server');
    // Identify as desktop
    wsSend({ type: 'identify', role: 'desktop' });
    // Ask TV for status
    wsSend({ type: 'request_status' });
    updateFooter('Server WebSocket connected');
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected from server — retrying...');
    updateFooter('Server connection lost — reconnecting...');
    setTimeout(connectWebSocket, 4000);
  };

  ws.onerror = (err) => {
    console.error('[WS] Error:', err);
  };
}

function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = {
      targetDeviceId: selectedTargetDeviceId,
      ...data
    };
    ws.send(JSON.stringify(payload));
    updateLastSync();
  }
}

// ─── Handle Messages from Server ──────────────────────────────────────────────
function handleServerMessage(msg) {
  switch (msg.type) {

    case 'tv_list':
      connectedTvs = msg.tvs || [];
      renderTvSelector();
      setTVConnected(connectedTvs.length > 0);
      break;

    case 'tv_connected':
      connectedTvs = msg.tvs || [];
      renderTvSelector();
      setTVConnected(true);
      wsSend({ type: 'request_status' });
      showToast(`📺 TV "${msg.deviceName || 'Smart TV'}" connected!`, 'success');
      break;

    case 'tv_disconnected':
      connectedTvs = msg.tvs || [];
      renderTvSelector();
      setTVConnected(connectedTvs.length > 0);
      showToast(`⚠️ TV "${msg.deviceName || 'Smart TV'}" disconnected`, 'error');
      break;

    case 'tv_status':
      tvPlaylist     = msg.playlist || [];
      tvCurrentIndex = msg.currentIndex ?? 0;
      tvIsPlaying    = msg.isPlaying ?? false;
      tvLayout       = msg.layout || 'fullscreen';
      tvCacheStats   = msg.cacheStats || null;
      
      const qrUrlInput = document.getElementById('qr-url-input');
      const qrLabelInput = document.getElementById('qr-label-input');
      if (qrUrlInput && msg.qrUrl && !qrUrlInput.value) qrUrlInput.value = msg.qrUrl;
      if (qrLabelInput && msg.qrLabel && !qrLabelInput.value) qrLabelInput.value = msg.qrLabel;

      renderPlaylist();
      updateNowPlaying();
      updateLayoutButtons();
      updatePlayPauseButton();
      setTVConnected(true);
      break;
  }
}

// ─── Render Connected TV Selector Dropdown ─────────────────────────────────────
function renderTvSelector() {
  const select = document.getElementById('target-tv-select');
  if (!select) return;

  const currentVal = select.value || 'all';
  select.innerHTML = '<option value="all">📺 Target: All Connected TVs</option>';

  connectedTvs.forEach(tv => {
    const opt = document.createElement('option');
    opt.value = tv.deviceId;
    opt.textContent = `📺 ${tv.deviceName} (${tv.ip || 'LAN'})`;
    select.appendChild(opt);
  });

  select.value = connectedTvs.some(t => t.deviceId === currentVal) ? currentVal : 'all';
  selectedTargetDeviceId = select.value;
}

// ─── TV Connection State ───────────────────────────────────────────────────────
function setTVConnected(connected) {
  tvConnected = connected;

  // Status pill
  const pill = document.getElementById('tv-status-pill');
  const text = document.getElementById('tv-status-text');
  if (pill && text) {
    const count = connectedTvs.length;
    pill.className = `status-pill ${connected ? 'connected' : 'disconnected'}`;
    text.textContent = connected ? `${count} TV${count > 1 ? 's' : ''} Connected` : 'TV Disconnected';
  }

  // Offline notice
  const notice = document.getElementById('tv-offline-notice');
  if (notice) notice.classList.toggle('hidden', connected);

  // Controls enable/disable
  const controlIds = [
    'ctrl-prev', 'ctrl-playpause', 'ctrl-next', 
    'ticker-input', 'btn-update-ticker',
    'qr-url-input', 'qr-label-input', 'btn-update-qr'
  ];
  controlIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !connected;
  });
  document.querySelectorAll('.layout-btn').forEach(btn => btn.disabled = !connected);

  // Footer state
  const footerTv = document.getElementById('footer-tv-state');
  if (footerTv) footerTv.textContent = connected ? `TV online • Layout: ${tvLayout}` : 'TV not connected';
}

// ─── Render Playlist ──────────────────────────────────────────────────────────
function renderPlaylist() {
  const container = document.getElementById('playlist-container');
  const countBadge = document.getElementById('playlist-count');

  if (!container) return;
  if (countBadge) countBadge.textContent = `${tvPlaylist.length} item${tvPlaylist.length !== 1 ? 's' : ''}`;

  if (tvPlaylist.length === 0) {
    container.innerHTML = '<div class="empty-state">No items in playlist.<br>Upload or add media using the panel on the left.</div>';
    return;
  }

  container.innerHTML = '';
  tvPlaylist.forEach((item, index) => {
    const isPlaying = index === tvCurrentIndex && tvIsPlaying;
    const card = document.createElement('div');
    card.className = `playlist-card${isPlaying ? ' now-playing-item' : ''}`;
    card.setAttribute('data-id', item.id);

    const typeBadge = item.type === 'video' ? 'video' : 'image';
    const scheduleLabel = item.schedule ? item.schedule : 'all';

    let cacheBadgeHtml = '';
    if (tvCacheStats && tvCacheStats.items) {
      const stat = tvCacheStats.items.find(s => s.id === item.id || s.url === item.url);
      if (stat) {
        if (stat.isCached) {
          cacheBadgeHtml = `<span style="font-size:0.75rem; color:#10b981; margin-left:6px;" title="Media downloaded into TV local storage">⚡ Local Cache Ready</span>`;
        } else if (stat.isDownloading) {
          cacheBadgeHtml = `<span style="font-size:0.75rem; color:#f59e0b; margin-left:6px;" title="Downloading to TV local storage">📥 Downloading...</span>`;
        }
      }
    }

    card.innerHTML = `
      <div class="card-index ${isPlaying ? 'playing' : ''}">${isPlaying ? '▶' : index + 1}</div>
      <div class="card-info">
        <div class="card-title">${escHtml(item.title || 'Untitled')}</div>
        <div class="card-meta">
          <span class="card-type-badge ${typeBadge}">${typeBadge === 'video' ? '🎥 VIDEO' : '🖼️ IMAGE'}</span>
          <span>⏱ ${item.duration}s</span>
          <span>📅 ${scheduleLabel}</span>
          ${cacheBadgeHtml}
        </div>
      </div>
      <div class="card-actions">
        <button class="card-action" data-act="play" data-idx="${index}" title="Play this item">▶</button>
        <button class="card-action" data-act="up" data-idx="${index}" title="Move up" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="card-action" data-act="down" data-idx="${index}" title="Move down" ${index === tvPlaylist.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="card-action" data-act="edit" data-id="${item.id}" title="Edit campaign">✏️</button>
        <button class="card-action delete" data-act="del" data-id="${item.id}" title="Remove from TV">🗑️</button>
      </div>
    `;

    container.appendChild(card);
  });

  // Action bindings
  container.querySelectorAll('.card-action').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!tvConnected) return;
      const act = btn.dataset.act;
      const idx = parseInt(btn.dataset.idx, 10);
      const id  = btn.dataset.id;

      if (act === 'play') {
        wsSend({ type: 'play_item', index: idx });
        showToast(`▶ Playing item #${idx + 1}`, 'info');
      } else if (act === 'up') {
        wsSend({ type: 'reorder', fromIndex: idx, toIndex: idx - 1 });
        [tvPlaylist[idx], tvPlaylist[idx - 1]] = [tvPlaylist[idx - 1], tvPlaylist[idx]];
        renderPlaylist();
      } else if (act === 'down') {
        wsSend({ type: 'reorder', fromIndex: idx, toIndex: idx + 1 });
        [tvPlaylist[idx], tvPlaylist[idx + 1]] = [tvPlaylist[idx + 1], tvPlaylist[idx]];
        renderPlaylist();
      } else if (act === 'edit') {
        openEditModal(id);
      } else if (act === 'del') {
        if (confirm(`Remove "${tvPlaylist.find(i => i.id === id)?.title}" from the TV?`)) {
          wsSend({ type: 'delete_item', id });
          tvPlaylist = tvPlaylist.filter(i => i.id !== id);
          renderPlaylist();
          showToast('🗑️ Item removed from TV playlist', 'info');
        }
      }
    });
  });
}

// ─── Now Playing Bar ──────────────────────────────────────────────────────────
function updateNowPlaying() {
  const bar    = document.getElementById('now-playing-bar');
  const title  = document.getElementById('np-title');
  const badge  = document.getElementById('np-badge');
  if (!bar || !title || !badge) return;

  const item = tvPlaylist[tvCurrentIndex];
  if (item && tvIsPlaying) {
    bar.classList.remove('hidden');
    title.textContent = item.title || 'Untitled';
    badge.textContent = item.type === 'video' ? 'VIDEO' : 'IMAGE';
  } else {
    bar.classList.add('hidden');
  }
}

// ─── Layout Buttons ────────────────────────────────────────────────────────────
function updateLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === tvLayout);
  });
}

// ─── Play/Pause Button ─────────────────────────────────────────────────────────
function updatePlayPauseButton() {
  const btn = document.getElementById('ctrl-playpause');
  if (btn) btn.textContent = tvIsPlaying ? '⏸' : '▶';
}

// ─── Media Library ─────────────────────────────────────────────────────────────
async function loadMediaLibrary() {
  const list = document.getElementById('media-library-list');
  if (!list) return;

  try {
    const res = await fetch('/api/uploads');
    const { files } = await res.json();

    if (files.length === 0) {
      list.innerHTML = '<div class="empty-state">No media uploaded yet.<br>Upload files above to get started.</div>';
      return;
    }

    list.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'library-item';

      const thumb = file.type === 'image'
        ? `<div class="library-thumb"><img src="${file.localUrl}" alt="${escHtml(file.filename)}" loading="lazy"></div>`
        : `<div class="library-thumb">🎥</div>`;

      item.innerHTML = `
        ${thumb}
        <div class="library-info">
          <div class="library-name">${escHtml(file.filename.replace(/^\d+_/, ''))}</div>
          <div class="library-meta">${file.type.toUpperCase()} · ${formatBytes(file.size)}</div>
        </div>
        <div class="library-actions">
          <button class="lib-action-btn add" title="Add to TV playlist" data-url="${escHtml(file.url)}" data-type="${file.type}" data-name="${escHtml(file.filename)}">➕</button>
          <button class="lib-action-btn delete" title="Delete file" data-filename="${escHtml(file.filename)}">🗑️</button>
        </div>
      `;

      list.appendChild(item);
    });

    // Bind actions
    list.querySelectorAll('.lib-action-btn.add').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!tvConnected) { showToast('⚠️ TV not connected', 'error'); return; }
        const name = btn.dataset.name.replace(/^\d+_/, '').replace(/\.[^/.]+$/, '');
        wsSend({
          type: 'add_item',
          item: {
            title: name,
            subtitle: '',
            type: btn.dataset.type,
            url: btn.dataset.url,
            duration: 10,
            schedule: 'all'
          }
        });
        showToast(`📺 Added to TV: ${name}`, 'success');
        setTimeout(() => wsSend({ type: 'request_status' }), 800);
      });
    });

    list.querySelectorAll('.lib-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        if (!confirm(`Delete "${filename.replace(/^\d+_/, '')}" from server?`)) return;
        try {
          await fetch(`/api/uploads/${encodeURIComponent(filename)}`, { method: 'DELETE' });
          showToast('🗑️ File deleted', 'info');
          loadMediaLibrary();
        } catch (e) {
          showToast('❌ Delete failed', 'error');
        }
      });
    });

  } catch (e) {
    list.innerHTML = '<div class="empty-state">Error loading library.</div>';
    console.error(e);
  }
}

// ─── UI Bindings ───────────────────────────────────────────────────────────────
function bindUI() {
  // Dropzone
  const dropzone  = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('upload-file-input');

  dropzone?.addEventListener('click', () => fileInput?.click());

  dropzone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
  });

  // Upload submit
  document.getElementById('btn-upload-add')?.addEventListener('click', handleUploadAndAdd);

  // Cancel upload
  document.getElementById('btn-upload-cancel')?.addEventListener('click', () => {
    resetUploadForm();
  });

  // Add URL
  document.getElementById('btn-add-url')?.addEventListener('click', () => {
    const url = document.getElementById('url-input').value.trim();
    if (!url) { showToast('⚠️ Enter a valid URL', 'error'); return; }
    if (!tvConnected) { showToast('⚠️ TV not connected', 'error'); return; }

    const isVideo = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(url);
    const title = url.split('/').pop().replace(/\?.*/, '').replace(/\.[^/.]+$/, '') || 'Web Media';
    wsSend({
      type: 'add_item',
      item: { title, subtitle: '', type: isVideo ? 'video' : 'image', url, duration: 10, schedule: 'all' }
    });
    showToast(`📺 URL added to TV`, 'success');
    document.getElementById('url-input').value = '';
    setTimeout(() => wsSend({ type: 'request_status' }), 800);
  });

  // Refresh library
  document.getElementById('btn-refresh-library')?.addEventListener('click', () => loadMediaLibrary());

  // Refresh playlist
  document.getElementById('btn-refresh-playlist')?.addEventListener('click', () => {
    wsSend({ type: 'request_status' });
    showToast('↺ Refreshing playlist from TV...', 'info');
  });

  // Playback controls
  document.getElementById('ctrl-prev')?.addEventListener('click', () => {
    wsSend({ type: 'previous' });
  });
  document.getElementById('ctrl-next')?.addEventListener('click', () => {
    wsSend({ type: 'next' });
  });
  document.getElementById('ctrl-playpause')?.addEventListener('click', () => {
    tvIsPlaying = !tvIsPlaying;
    wsSend({ type: 'play_pause' });
    updatePlayPauseButton();
  });

  // Layout buttons
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!tvConnected) return;
      const layout = btn.dataset.layout;
      tvLayout = layout;
      wsSend({ type: 'set_layout', layout });
      updateLayoutButtons();
      showToast(`📺 Layout switched to ${layout}`, 'info');
    });
  });

  // Target TV Selector change
  document.getElementById('target-tv-select')?.addEventListener('change', (e) => {
    selectedTargetDeviceId = e.target.value;
    console.log('[Manager] Target TV changed to:', selectedTargetDeviceId);
    wsSend({ type: 'request_status' });
  });

  // Ticker update
  document.getElementById('btn-update-ticker')?.addEventListener('click', () => {
    if (!tvConnected) return;
    const text = document.getElementById('ticker-input')?.value.trim();
    if (!text) return;
    wsSend({ type: 'set_ticker', text });
    showToast('📢 Ticker updated on TV', 'success');
  });

  // QR Code update
  document.getElementById('btn-update-qr')?.addEventListener('click', () => {
    if (!tvConnected) return;
    const url = document.getElementById('qr-url-input')?.value.trim();
    const label = document.getElementById('qr-label-input')?.value.trim();
    wsSend({ type: 'set_qr', url, label });
    showToast('📱 QR Code updated on TV screen', 'success');
  });

  // Edit modal close
  document.getElementById('btn-close-edit')?.addEventListener('click', closeEditModal);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', closeEditModal);

  // Edit modal submit
  document.getElementById('edit-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('edit-item-id').value;
    const data = {
      title:    document.getElementById('edit-title').value,
      subtitle: document.getElementById('edit-subtitle').value,
      type:     document.getElementById('edit-type').value,
      duration: document.getElementById('edit-duration').value,
      schedule: document.getElementById('edit-schedule').value
    };
    wsSend({ type: 'update_item', id, data });

    // Update local copy
    const item = tvPlaylist.find(i => i.id === id);
    if (item) Object.assign(item, data);
    renderPlaylist();
    closeEditModal();
    showToast('💾 Campaign updated on TV', 'success');
  });

  // Modal overlay click to close
  document.getElementById('edit-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal')) closeEditModal();
  });
}

// ─── File Selection ────────────────────────────────────────────────────────────
function handleFileSelected(file) {
  selectedUploadFile = file;
  const isVideo = file.type.startsWith('video/');

  const dzMain = document.getElementById('dz-main-label');
  const dzSub  = document.getElementById('dz-sub-label');
  if (dzMain) dzMain.textContent = `✅ ${file.name}`;
  if (dzSub)  dzSub.textContent  = `${formatBytes(file.size)} · ${isVideo ? 'Video' : 'Image'} · Ready to upload`;

  // Auto-fill title
  const titleInput = document.getElementById('upload-title');
  if (titleInput && !titleInput.value) {
    titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  }

  // Show form fields
  const fields = document.getElementById('upload-form-fields');
  if (fields) { fields.classList.remove('hidden'); uploadFormVisible = true; }
}

// ─── Upload and Add to TV ──────────────────────────────────────────────────────
async function handleUploadAndAdd() {
  if (!selectedUploadFile) { showToast('⚠️ Select a file first', 'error'); return; }
  if (!tvConnected) { showToast('⚠️ TV not connected — upload saved to server library', 'info'); }

  const title    = document.getElementById('upload-title')?.value.trim() || selectedUploadFile.name;
  const subtitle = document.getElementById('upload-subtitle')?.value.trim() || '';
  const duration = parseInt(document.getElementById('upload-duration')?.value) || 10;
  const schedule = document.getElementById('upload-schedule')?.value || 'all';

  // Show spinner
  const spinner = document.getElementById('upload-spinner');
  const btnText = document.querySelector('#btn-upload-add span');
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Uploading...';
  document.getElementById('btn-upload-add').disabled = true;

  try {
    const formData = new FormData();
    formData.append('media', selectedUploadFile);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');

    const data = await res.json();
    showToast(`✅ Uploaded: ${selectedUploadFile.name}`, 'success');

    if (tvConnected) {
      const isVideo = selectedUploadFile.type.startsWith('video/');
      wsSend({
        type: 'add_item',
        item: {
          title,
          subtitle,
          type:     isVideo ? 'video' : 'image',
          url:      data.url, // LAN-accessible URL for TV
          duration,
          schedule
        }
      });
      showToast('📺 Added to TV playlist!', 'success');
      setTimeout(() => wsSend({ type: 'request_status' }), 1000);
    }

    resetUploadForm();
    loadMediaLibrary();

  } catch (e) {
    showToast(`❌ Upload failed: ${e.message}`, 'error');
    console.error(e);
  } finally {
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = '📺 Upload & Add to TV';
    document.getElementById('btn-upload-add').disabled = false;
  }
}

// ─── Reset Upload Form ─────────────────────────────────────────────────────────
function resetUploadForm() {
  selectedUploadFile = null;
  uploadFormVisible  = false;

  const dzMain = document.getElementById('dz-main-label');
  const dzSub  = document.getElementById('dz-sub-label');
  if (dzMain) dzMain.textContent = 'Drop file here or click to browse';
  if (dzSub)  dzSub.textContent  = 'Supports MP4, WebM, PNG, JPG, WebP · Max 500 MB';

  const fields = document.getElementById('upload-form-fields');
  if (fields) fields.classList.add('hidden');

  const fileInput = document.getElementById('upload-file-input');
  if (fileInput) fileInput.value = '';

  const titleInput = document.getElementById('upload-title');
  if (titleInput) titleInput.value = '';
  const subtitleInput = document.getElementById('upload-subtitle');
  if (subtitleInput) subtitleInput.value = '';
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function openEditModal(id) {
  const item = tvPlaylist.find(i => i.id === id);
  if (!item) return;

  document.getElementById('edit-item-id').value  = item.id;
  document.getElementById('edit-title').value    = item.title || '';
  document.getElementById('edit-subtitle').value = item.subtitle || '';
  document.getElementById('edit-type').value     = item.type || 'image';
  document.getElementById('edit-duration').value = item.duration || 10;
  document.getElementById('edit-schedule').value = item.schedule || 'all';

  document.getElementById('edit-modal')?.classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal')?.classList.add('hidden');
}

// ─── Toast Notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Footer Helpers ────────────────────────────────────────────────────────────
function updateFooter(msg) {
  const el = document.getElementById('footer-server-status');
  if (el) el.textContent = `⚡ ${msg}`;
}

function updateLastSync() {
  const el = document.getElementById('footer-last-sync');
  if (el) el.textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
