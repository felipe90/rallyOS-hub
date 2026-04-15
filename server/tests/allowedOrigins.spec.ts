/**
 * Unit tests for allowedOrigins configuration module.
 *
 * Tests env var parsing, fallback defaults, and whitespace handling.
 */

import { getAllowedOrigins, defaultAllowedOrigins } from '../src/config/allowedOrigins';

describe('allowedOrigins', () => {
  const originalEnv = process.env.HUB_ALLOWED_ORIGINS;

  afterEach(() => {
    // Restore original env after each test
    if (originalEnv === undefined) {
      delete process.env.HUB_ALLOWED_ORIGINS;
    } else {
      process.env.HUB_ALLOWED_ORIGINS = originalEnv;
    }
  });

  describe('defaultAllowedOrigins', () => {
    it('should contain expected localhost origins', () => {
      expect(defaultAllowedOrigins).toContain('http://localhost:5173');
      expect(defaultAllowedOrigins).toContain('https://localhost:5173');
      expect(defaultAllowedOrigins).toContain('http://localhost:3000');
      expect(defaultAllowedOrigins).toContain('https://localhost:3000');
    });

    it('should contain expected 127.0.0.1 origins', () => {
      expect(defaultAllowedOrigins).toContain('http://127.0.0.1:5173');
      expect(defaultAllowedOrigins).toContain('https://127.0.0.1:3000');
    });

    it('should contain orangepi.local origins', () => {
      expect(defaultAllowedOrigins).toContain('http://orangepi.local:3000');
      expect(defaultAllowedOrigins).toContain('https://orangepi.local:3000');
    });

    it('should have exactly 10 default origins', () => {
      expect(defaultAllowedOrigins).toHaveLength(10);
    });
  });

  describe('getAllowedOrigins', () => {
    it('should return defaults when env var is not set', () => {
      delete process.env.HUB_ALLOWED_ORIGINS;
      const origins = getAllowedOrigins();
      expect(origins).toEqual(defaultAllowedOrigins);
    });

    it('should return defaults when env var is empty string', () => {
      process.env.HUB_ALLOWED_ORIGINS = '';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(defaultAllowedOrigins);
    });

    it('should parse comma-separated origins from env var', () => {
      process.env.HUB_ALLOWED_ORIGINS = 'http://example.com,https://app.example.com';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://example.com', 'https://app.example.com']);
    });

    it('should trim whitespace from origins', () => {
      process.env.HUB_ALLOWED_ORIGINS = ' http://example.com , https://app.example.com ';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://example.com', 'https://app.example.com']);
    });

    it('should filter out empty entries from trailing commas', () => {
      process.env.HUB_ALLOWED_ORIGINS = 'http://example.com,,https://app.example.com,';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://example.com', 'https://app.example.com']);
    });

    it('should return single origin when env var has no commas', () => {
      process.env.HUB_ALLOWED_ORIGINS = 'http://single-origin.com';
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://single-origin.com']);
    });
  });
});
