import { describe, it, expect } from 'vitest';

describe('Smoke Test - Project Scaffold', () => {
  it('should pass basic environment check', () => {
    expect(true).toBe(true);
  });

  it('should have window and document available via jsdom', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
  });
});
