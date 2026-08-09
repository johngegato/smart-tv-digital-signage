/**
 * LG webOS TV & Devant Smart TV Integration Module
 */

export class WebOSHandler {
  constructor(options = {}) {
    this.enableHardwareKeepAlive = options.enableHardwareKeepAlive !== undefined ? options.enableHardwareKeepAlive : true;
    this.isWebOS = this.detectWebOS();
    this.deviceInfo = null;
    this.init();
  }

  detectWebOS() {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    return ua.includes('web0s') || ua.includes('webos') || (typeof window !== 'undefined' && typeof window.webOS !== 'undefined');
  }

  init() {
    if (this.isWebOS) {
      console.log('[webOS] Running on LG webOS / Devant Smart TV OS environment');
      this.initWebOSSDK();
      this.initLifecycleEvents();
      this.preventScreenSaver();
    } else {
      console.log('[webOS] Non-webOS environment detected (Web browser mode)');
      if (this.enableHardwareKeepAlive) {
        this.requestWakeLock();
      }
    }
  }

  initWebOSSDK() {
    if (typeof window !== 'undefined' && window.webOS && window.webOS.deviceInfo) {
      window.webOS.deviceInfo((info) => {
        this.deviceInfo = info;
        console.log('[webOS] Device Info loaded:', info);
        this.updateSystemBadge(info);
      });
    }
  }

  initLifecycleEvents() {
    if (typeof document === 'undefined') return;

    document.addEventListener('webOSLaunch', (e) => {
      console.log('[webOS] App Launched with parameters:', e.detail);
    });

    document.addEventListener('webOSReopen', () => {
      console.log('[webOS] App Reopened from background');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[webOS] App moved to background');
      } else {
        console.log('[webOS] App returned to foreground');
        this.requestWakeLock();
        this.ensureHardwareVideoPlaying();
      }
    });
  }

  /**
   * Keep webOS TV screen active 24/7 during digital signage playback
   */
  preventScreenSaver() {
    console.log('[webOS] Initializing 24/7 Screen Keep-Awake Hardware & Luna Locks...');

    if (this.enableHardwareKeepAlive) {
      this.initHardwareVideoKeepAlive();
    }

    this.requestWakeLock();
    this.callWebOSPowerServices();

    setInterval(() => {
      this.callWebOSPowerServices();
      if (this.enableHardwareKeepAlive) {
        this.ensureHardwareVideoPlaying();
      }
    }, 15000);
  }

  /**
   * Creates a hidden HTML5 Video element fed by a continuous 16x16 canvas stream.
   */
  initHardwareVideoKeepAlive() {
    try {
      if (typeof document === 'undefined' || document.getElementById('hw-keepalive-video')) return;

      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      let val = 0;
      setInterval(() => {
        val = (val + 1) % 255;
        if (ctx) {
          ctx.fillStyle = `rgb(${val}, 128, 200)`;
          ctx.fillRect(0, 0, 16, 16);
        }
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
        vid.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAA';
      }

      document.body.appendChild(vid);
      if (vid.play) {
        vid.play().then(() => {
          console.log('[webOS KeepAlive] 🎥 Hardware Video Stream Keep-Alive ACTIVE');
        }).catch(e => {
          console.warn('[webOS KeepAlive] Video play deferred:', e.message);
        });
      }
    } catch (e) {
      console.warn('[webOS KeepAlive] Hardware stream init error:', e.message);
    }
  }

  ensureHardwareVideoPlaying() {
    if (typeof document === 'undefined') return;
    const vid = document.getElementById('hw-keepalive-video');
    if (vid && vid.paused && vid.play) {
      vid.play().catch(() => {});
    }
  }

  async requestWakeLock() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Screen Wake Lock active 24/7');
        if (this.wakeLock) {
          this.wakeLock.addEventListener('release', () => {
            this.requestWakeLock();
          });
        }
      }
    } catch (e) {
      console.warn('[WakeLock] Screen WakeLock unavailable or restricted:', e.message);
    }
  }

  callWebOSPowerServices() {
    if (typeof window !== 'undefined' && window.webOS && window.webOS.service) {
      try {
        window.webOS.service.request('luna://com.webos.service.tv.power', {
          method: 'turnOffScreenSaver',
          parameters: { subscribe: true },
          onSuccess: () => console.log('[webOS] Luna turnOffScreenSaver active'),
          onFailure: () => {}
        });
      } catch (e) {}

      try {
        window.webOS.service.request('luna://com.webos.service.power', {
          method: 'display/keepOn',
          parameters: { state: 'on' },
          onSuccess: () => console.log('[webOS] Luna display/keepOn active'),
          onFailure: () => {}
        });
      } catch (e) {}

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
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('webos-sys-badge');
    if (badge && info) {
      badge.textContent = `webOS ${info.sdkVersion || 'TV'} (${info.modelName || 'Devant/LG'})`;
    }
  }
}
