/**
 * Widgets Engine Module - Clock, Weather, Ticker, and procedural QR Code generator
 */

export class WidgetEngine {
  constructor(options = {}) {
    this.tickerText = options.tickerText || '🔥 SPECIAL OFFER: Visit our counter & get 15% off your next purchase!  •  ☕ Fresh Organic Coffee Served Daily  •  ⚡ Download our Smart App for Exclusive Rewards!';
    this.locationName = options.locationName || 'Downtown HQ';
    this.tickerSpeed = options.tickerSpeed || 25; // seconds
    this.clockInterval = null;
    this.weatherInterval = null;
  }

  /**
   * Start Clock Updates
   */
  startClock(clockElementId, dateElementId, fullscreenClockId) {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      const clockEl = document.getElementById(clockElementId);
      const dateEl = document.getElementById(dateElementId);
      const fsClockEl = document.getElementById(fullscreenClockId);

      if (clockEl) clockEl.textContent = timeStr;
      if (dateEl) dateEl.textContent = dateStr;
      if (fsClockEl) fsClockEl.textContent = `${timeStr.slice(0, -3)} • ${dateStr}`;
    };

    update();
    this.clockInterval = setInterval(update, 1000);
  }

  /**
   * Start Simulated Weather Updates
   */
  startWeather(tempId, descId, iconId) {
    const weatherConditions = [
      { temp: '74°F', desc: 'Sunny & Clear', icon: '☀️' },
      { temp: '72°F', desc: 'Partly Cloudy', icon: '⛅' },
      { temp: '76°F', desc: 'Warm & Pleasant', icon: '🌤️' }
    ];

    let current = 0;
    const update = () => {
      const data = weatherConditions[current % weatherConditions.length];
      const tempEl = document.getElementById(tempId);
      const descEl = document.getElementById(descId);
      const iconEl = document.getElementById(iconId);

      if (tempEl) tempEl.textContent = data.temp;
      if (descEl) descEl.textContent = `${data.desc} • ${this.locationName}`;
      if (iconEl) iconEl.textContent = data.icon;

      current++;
    };

    update();
    this.weatherInterval = setInterval(update, 30000);
  }

  /**
   * Initialize Scrolling Ticker Text
   */
  initTicker(tickerTextId, customText) {
    if (customText) this.tickerText = customText;
    const tickerEl = document.getElementById(tickerTextId);
    if (tickerEl) {
      tickerEl.textContent = this.tickerText + '   •   ' + this.tickerText;
    }
  }

  /**
   * Update Ticker Speed
   */
  setTickerSpeed(seconds) {
    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) {
      tickerEl.style.animationDuration = `${seconds}s`;
    }
  }

  /**
   * Generate procedural clean QR Code on Canvas with High-DPI Sharp Scaling
   */
  generateQRCode(canvasId, text = 'https://example.com/promo') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 2;
    const cssSize = 140;

    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Clear canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssSize, cssSize);

    ctx.fillStyle = '#0f172a';
    const modules = 21; // 21x21 QR Grid
    const moduleSize = cssSize / modules;

    // Pseudo-random deterministic grid derived from text string hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    const isDark = (r, c) => {
      // Finder patterns top-left, top-right, bottom-left
      if ((r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7)) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || r === modules - 1 || r === modules - 7 || c === modules - 1 || c === modules - 7) return true;
        if (r >= 2 && r <= 4 && c >= 2 && c <= 4) return true;
        if (r >= 2 && r <= 4 && c >= modules - 5 && c >= modules - 3) return true;
        if (r >= modules - 5 && r <= modules - 3 && c >= 2 && c <= 4) return true;
        return false;
      }
      // Data pattern fill
      const val = (r * 13 + c * 17 + Math.abs(hash)) % 7;
      return val > 2;
    };

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (isDark(r, c)) {
          ctx.fillRect(c * moduleSize, r * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }
}
