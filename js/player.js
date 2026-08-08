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
   * Completely tear down media elements (especially video decoders for Smart TVs)
   */
  cleanLayer(layer) {
    if (!layer) return;
    const videos = layer.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.pause();
        v.onended = null;
        v.onerror = null;
        v.removeAttribute('src');
        v.load();
        v.remove();
      } catch (e) {
        console.warn('[SignagePlayer] Error tearing down video element:', e);
      }
    });
    layer.innerHTML = '';
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
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    // Pause any playing video
    const activeLayer = this.layers[this.currentLayerIndex];
    const video = activeLayer.querySelector('video');
    if (video) video.pause();
  }

  /**
   * Play current item in playlist
   */
  async playCurrent() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const item = this.playlistManager.getCurrentItem();
    if (!item) return;

    const activeLayer = this.layers[this.currentLayerIndex];
    const nextLayerIndex = (this.currentLayerIndex + 1) % 2;
    const nextLayer = this.layers[nextLayerIndex];

    // Ensure next layer is completely clean before adding new media
    this.cleanLayer(nextLayer);

    const resolvedUrl = await this.playlistManager.getResolvedUrl(item);

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = resolvedUrl;
      video.preload = 'auto';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('autoplay', '');
      video.muted = this.isMuted;
      video.playsInline = true;
      video.autoplay = true;

      // When video ends normally, clear fallback timer and advance to next item
      video.onended = () => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this.isPlaying) this.next();
      };

      // Fast skip / fallback error handling if video fails to load or decode
      video.onerror = (e) => {
        console.error('[SignagePlayer] Video failed to load:', resolvedUrl, e);
        if (resolvedUrl !== item.url && item.url) {
          // If cached blob failed to decode, retry with original network URL
          console.warn('[SignagePlayer] Retrying video with live URL:', item.url);
          video.src = item.url;
          video.play().catch(() => {});
          return;
        }
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

      // Safety duration fallback in case video event fails or gets stuck
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

      // Clean up previous layer after crossfade animation completes (600ms)
      setTimeout(() => {
        this.cleanLayer(activeLayer);
      }, 600);
    }, 50);
  }

  /**
   * Advance to next playlist item
   */
  next() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.playlistManager.next();
    this.playCurrent();
  }

  /**
   * Return to previous item
   */
  previous() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
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
   * Update Lower Third Caption Text - Kept hidden for clean media playback
   */
  updateCaptionOverlay(item) {
    const captionContainer = document.getElementById('media-caption-overlay');
    if (captionContainer) {
      captionContainer.classList.remove('visible');
    }
  }
}
