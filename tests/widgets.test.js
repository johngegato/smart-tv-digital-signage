import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetEngine } from '../js/widgets.js';

describe('WidgetEngine Module', () => {
  let widgets;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="clock-time"></div>
      <div id="clock-date"></div>
      <div id="ticker-text"></div>
      <canvas id="qr-canvas"></canvas>
    `;

    widgets = new WidgetEngine();
  });

  it('should start clock updates and populate time string', () => {
    widgets.startClock('clock-time', 'clock-date');
    const timeEl = document.getElementById('clock-time');

    expect(timeEl.textContent).not.toBe('');
  });

  it('should set ticker text content', () => {
    widgets.initTicker('ticker-text', 'Welcome to Digital Signage');
    const tickerEl = document.getElementById('ticker-text');

    expect(tickerEl.textContent).toContain('Welcome to Digital Signage');
  });

  it('should render QR Code on HTML Canvas element', () => {
    const canvas = document.getElementById('qr-canvas');
    widgets.generateQRCode('qr-canvas', 'https://example.com');

    expect(canvas.width).toBeGreaterThan(0);
  });
});
