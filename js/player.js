/**
 * Media Player Engine - Handles smooth media transitions, video looping, and timers
 */

export class SignagePlayer {
  constructor(viewportContainer, playlistManager) {
    this.viewport = viewportContainer;
    this.playlistManager = playlistManager;
    this.timer = null;
    this.isPlaying = false;
    this.isMuted = true;
    this.currentLayerIndex = 0;

    // Create dual media layers for seamless crossfade
    this.layerA = document.createElement('div');
    this.layerB = document.createElement('div');
    this.layerA.className = 'media-layer active';
    this.layerB.className = 'media-layer previous';

    this.viewport.appendChild(this.layerA);
    this.viewport.appendChild(this.layerB);

    this.layers = [this.layerA, this.layerB];
  }

  /**
   * Start playback cycle
   */
  start() {
    this.isPlaying = true;
    this.playCurrent();
  }

  /**
   * Pause playback cycle
   */
  pause() {
    this.isPlaying = false;
    if (this.timer) clearTimeout(this.timer);
    
    // Pause any playing video
    const activeLayer = this.layers[this.currentLayerIndex];
    const video = activeLayer.querySelector('video');
    if (video) video.pause();
  }

  /**
   * Play current item in playlist
   */
  async playCurrent() {
    if (this.timer) clearTimeout(this.timer);
    const item = this.playlistManager.getCurrentItem();
    if (!item) return;

    const activeLayer = this.layers[this.currentLayerIndex];
    const nextLayerIndex = (this.currentLayerIndex + 1) % 2;
    const nextLayer = this.layers[nextLayerIndex];

    const resolvedUrl = await this.playlistManager.getResolvedUrl(item);

    // Prepare content in upcoming layer
    nextLayer.innerHTML = '';
    
    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = resolvedUrl;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.muted = this.isMuted;
      video.playsInline = true;
      video.autoplay = true;

      video.onended = () => {
        if (this.isPlaying) this.next();
      };

      // Fast skip error handling if video fails to load/decode
      video.onerror = (e) => {
        console.error('[SignagePlayer] Video failed to load:', resolvedUrl, e);
        if (this.isPlaying) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => this.next(), 1500);
        }
      };

      // Autoplay fallback handler
      video.play().catch(err => {
        console.warn('[SignagePlayer] Video Autoplay warning (muted required):', err);
        video.muted = true;
        video.play().catch(e => console.error('[SignagePlayer] Video Play failed:', e));
      });

      nextLayer.appendChild(video);

      // Duration fallback in case video event fails
      const durationMs = (item.duration || 12) * 1000;
      this.timer = setTimeout(() => {
        if (this.isPlaying) this.next();
      }, durationMs);
    } else {
      // Image item
      const img = document.createElement('img');
      img.src = resolvedUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.display = 'block';

      // Fast skip error handling if image fails to load
      img.onerror = (e) => {
        console.error('[SignagePlayer] Image failed to load:', resolvedUrl, e);
        if (this.isPlaying) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => this.next(), 1500);
        }
      };

      nextLayer.appendChild(img);

      const durationMs = (item.duration || 8) * 1000;
      this.timer = setTimeout(() => {
        if (this.isPlaying) this.next();
      }, durationMs);
    }

    // Trigger crossfade transition
    setTimeout(() => {
      activeLayer.classList.remove('active');
      activeLayer.classList.add('previous');

      nextLayer.classList.remove('previous');
      nextLayer.classList.add('active');

      this.currentLayerIndex = nextLayerIndex;
      this.updateCaptionOverlay(item);
    }, 50);
  }

  /**
   * Advance to next playlist item
   */
  next() {
    this.playlistManager.next();
    this.playCurrent();
  }

  /**
   * Return to previous item
   */
  previous() {
    this.playlistManager.previous();
    this.playCurrent();
  }

  /**
   * Toggle Audio Mute State
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    const activeLayer = this.layers[this.currentLayerIndex];
    const video = activeLayer.querySelector('video');
    if (video) {
      video.muted = this.isMuted;
    }
    return this.isMuted;
  }

  /**
  /**
   * Update Lower Third Caption Text - Kept hidden for clean media playback
   */
  updateCaptionOverlay(item) {
    const captionContainer = document.getElementById('media-caption-overlay');
    if (captionContainer) {
      captionContainer.classList.remove('visible');
    }
  }
}
