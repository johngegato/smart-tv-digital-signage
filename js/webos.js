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
   * Keep webOS TV screen active during digital signage playback
   */
  preventScreenSaver() {
    if (window.webOS && window.webOS.service) {
      try {
        window.webOS.service.request('luna://com.webos.service.tv.power', {
          method: 'turnOffScreenSaver',
          parameters: {},
          onSuccess: (res) => console.log('[webOS] Screen saver turned off'),
          onFailure: (err) => console.warn('[webOS] Screen saver command failed:', err)
        });
      } catch (e) {
        // Fallback for webOS web engine
      }
    }
  }

  updateSystemBadge(info) {
    const badge = document.getElementById('webos-sys-badge');
    if (badge && info) {
      badge.textContent = `webOS ${info.sdkVersion || 'TV'} (${info.modelName || 'Devant/LG'})`;
    }
  }
}
