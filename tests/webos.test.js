import { describe, it, expect } from 'vitest';
import { WebOSHandler } from '../js/webos.js';

describe('WebOSHandler Integration', () => {
  it('should detect browser mode in non-webOS environment', () => {
    const handler = new WebOSHandler({ enableHardwareKeepAlive: false });
    expect(handler.isWebOS).toBe(false);
  });

  it('should initialize without error in JSDOM', () => {
    const handler = new WebOSHandler({ enableHardwareKeepAlive: false });
    expect(handler).toBeDefined();
  });
});
