/**
 * LG webOS TV & Devant Smart TV Integration Module
 */

export class WebOSHandler {
  constructor() {
    this.isWebOS = this.detectWebOS();
    this.deviceInfo = null;
    this.init();
  }

  detectWebOS() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('web0s') || ua.includes('webos') || typeof window.webOS !== 'undefined';
  }

  init() {
    if (this.isWebOS) {
      console.log('[webOS] Running on LG webOS / Devant Smart TV OS environment');
      this.initWebOSSDK();
      this.initLifecycleEvents();
      this.preventScreenSaver();
    } else {
      console.log('[webOS] Non-webOS environment detected (Web browser mode)');
    }
  }

  initWebOSSDK() {
    if (window.webOS && window.webOS.deviceInfo) {
      window.webOS.deviceInfo((info) => {
        this.deviceInfo = info;
        console.log('[webOS] Device Info loaded:', info);
        this.updateSystemBadge(info);
      });
    }
  }

  initLifecycleEvents() {
    // Listen for webOS TV App visibility/launch state events
    document.addEventListener('webOSLaunch', (e) => {
      console.log('[webOS] App Launched with parameters:', e.detail);
    });

    document.addEventListener('webOSReopen', (e) => {
      console.log('[webOS] App Reopened from background');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[webOS] App moved to background');
      } else {
        console.log('[webOS] App returned to foreground');
      }
    });
  }

  /**
   * Keep webOS TV screen active 24/7 during digital signage playback
   * Completely prevents webOS "Press any key except power button" screensaver and clock mode.
   */
  preventScreenSaver() {
    console.log('[webOS] Initializing 24/7 Screen Keep-Awake Hardware & Luna Locks...');

    // 1. Hardware Video Decoder Stream Keep-Alive (Prevents webOS Eco/Clock ScreenSaver)
    this.initHardwareVideoKeepAlive();

    // 2. Web Screen WakeLock API (Standard Browser Keep-Awake)
    this.requestWakeLock();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.requestWakeLock();
        this.ensureHardwareVideoPlaying();
      }
    });

    // 3. Initial webOS Luna Power Service call
    this.callWebOSPowerServices();

    // 4. Periodic Keep-Alive Refresh (Every 15 seconds)
    setInterval(() => {
      this.callWebOSPowerServices();
      this.ensureHardwareVideoPlaying();
    }, 15000);
  }

  /**
   * Creates a hidden HTML5 Video element fed by a continuous 16x16 canvas stream.
   * On LG webOS & Devant Smart TVs, an active hardware video decoding stream tells the OS
   * hardware layer that media is playing, which 100% suppresses system idle/clock screensavers.
   */
  initHardwareVideoKeepAlive() {
    try {
      if (document.getElementById('hw-keepalive-video')) return;

      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      // Continuous subtle color change frame to keep hardware video decoder active
      let val = 0;
      setInterval(() => {
        val = (val + 1) % 255;
        ctx.fillStyle = `rgb(${val}, 128, 200)`;
        ctx.fillRect(0, 0, 16, 16);
      }, 1000);

      const stream = canvas.captureStream ? canvas.captureStream(5) : null;

      const vid = document.createElement('video');
      vid.id = 'hw-keepalive-video';
      vid.setAttribute('muted', '');
      vid.setAttribute('playsinline', '');
      vid.setAttribute('autoplay', '');
      vid.setAttribute('loop', '');
      vid.muted = true;
      vid.playsInline = true;
      vid.autoplay = true;
      vid.loop = true;

      // Positioning out of sight
      vid.style.position = 'fixed';
      vid.style.width = '2px';
      vid.style.height = '2px';
      vid.style.opacity = '0.01';
      vid.style.pointerEvents = 'none';
      vid.style.top = '0';
      vid.style.left = '0';
      vid.style.zIndex = '-99999';

      if (stream) {
        vid.srcObject = stream;
      } else {
        // Fallback: 1-pixel silent looping mp4 data URI
        vid.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAA';
      }

      document.body.appendChild(vid);
      vid.play().then(() => {
        console.log('[webOS KeepAlive] 🎥 Hardware Video Stream Keep-Alive ACTIVE');
      }).catch(e => {
        console.warn('[webOS KeepAlive] Video play deferred:', e.message);
      });
    } catch (e) {
      console.warn('[webOS KeepAlive] Hardware stream init error:', e.message);
    }
  }

  ensureHardwareVideoPlaying() {
    const vid = document.getElementById('hw-keepalive-video');
    if (vid && vid.paused) {
      vid.play().catch(() => {});
    }
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Screen Wake Lock active 24/7');
        this.wakeLock.addEventListener('release', () => {
          this.requestWakeLock();
        });
      }
    } catch (e) {
      console.warn('[WakeLock] Screen WakeLock unavailable or restricted:', e.message);
    }
  }

  callWebOSPowerServices() {
    if (typeof window.webOS !== 'undefined' && window.webOS.service) {
      // Method A: TV Power service turnOffScreenSaver
      try {
        window.webOS.service.request('luna://com.webos.service.tv.power', {
          method: 'turnOffScreenSaver',
          parameters: { subscribe: true },
          onSuccess: () => console.log('[webOS] Luna turnOffScreenSaver active'),
          onFailure: () => {}
        });
      } catch (e) {}

      // Method B: System Power display keepOn
      try {
        window.webOS.service.request('luna://com.webos.service.power', {
          method: 'display/keepOn',
          parameters: { state: 'on' },
          onSuccess: () => console.log('[webOS] Luna display/keepOn active'),
          onFailure: () => {}
        });
      } catch (e) {}

      // Method C: ScreenSaver service setMode off
      try {
        window.webOS.service.request('luna://com.webos.service.screensaver', {
          method: 'setMode',
          parameters: { mode: 'off' },
          onSuccess: () => console.log('[webOS] Luna ScreenSaver mode off'),
          onFailure: () => {}
        });
      } catch (e) {}
    }
  }

  updateSystemBadge(info) {
    const badge = document.getElementById('webos-sys-badge');
    if (badge && info) {
      badge.textContent = `webOS ${info.sdkVersion || 'TV'} (${info.modelName || 'Devant/LG'})`;
    }
  }
}
