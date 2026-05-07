/**
 * Unit tests for allowedOrigins configuration module.
 *
 * Tests env var parsing, fallback defaults, and whitespace handling.
 */

import { getAllowedOrigins, defaultAllowedOrigins, getHubDomain } from '../src/config/allowedOrigins';

describe('allowedOrigins', () => {
  const originalEnv = process.env.HUB_ALLOWED_ORIGINS;
  const originalDomain = process.env.HUB_DOMAIN;

  afterEach(() => {
    // Restore original env after each test
    if (originalEnv === undefined) {
      delete process.env.HUB_ALLOWED_ORIGINS;
    } else {
      process.env.HUB_ALLOWED_ORIGINS = originalEnv;
    }
    if (originalDomain === undefined) {
      delete process.env.HUB_DOMAIN;
    } else {
      process.env.HUB_DOMAIN = originalDomain;
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

    it('should have exactly 12 static default origins', () => {
      expect(defaultAllowedOrigins).toHaveLength(12);
    });

    it('should contain rallyos.local origins (latent bug fix)', () => {
      expect(defaultAllowedOrigins).toContain('http://rallyos.local:3000');
      expect(defaultAllowedOrigins).toContain('https://rallyos.local:3000');
    });

    it('should contain rallyos-hub.local origins in computed defaults (dynamic)', () => {
      delete process.env.HUB_DOMAIN;
      const origins = getAllowedOrigins();
      expect(origins).toContain('http://rallyos-hub.local:3000');
      expect(origins).toContain('https://rallyos-hub.local:3000');
      // Must be exactly 14: 12 static + 2 dynamic
      expect(origins).toHaveLength(14);
    });
  });

  describe('getAllowedOrigins', () => {
    it('should return computed defaults when env var is not set', () => {
      delete process.env.HUB_DOMAIN;
      delete process.env.HUB_ALLOWED_ORIGINS;
      const origins = getAllowedOrigins();
      // Must contain all static defaults
      for (const origin of defaultAllowedOrigins) {
        expect(origins).toContain(origin);
      }
      // Plus dynamic HUB_DOMAIN entries (default: rallyos-hub.local)
      expect(origins).toContain('http://rallyos-hub.local:3000');
      expect(origins).toContain('https://rallyos-hub.local:3000');
      expect(origins).toHaveLength(14);
    });

    it('should return computed defaults when env var is empty string', () => {
      delete process.env.HUB_DOMAIN;
      process.env.HUB_ALLOWED_ORIGINS = '';
      const origins = getAllowedOrigins();
      // Must contain all static defaults
      for (const origin of defaultAllowedOrigins) {
        expect(origins).toContain(origin);
      }
      // Plus dynamic HUB_DOMAIN entries (default: rallyos-hub.local)
      expect(origins).toContain('http://rallyos-hub.local:3000');
      expect(origins).toContain('https://rallyos-hub.local:3000');
      expect(origins).toHaveLength(14);
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

    it('should derive origins from HUB_DOMAIN when set', () => {
      delete process.env.HUB_ALLOWED_ORIGINS;
      process.env.HUB_DOMAIN = 'custom.local';
      const origins = getAllowedOrigins();
      expect(origins).toContain('https://custom.local:3000');
      expect(origins).toContain('http://custom.local:3000');
    });

    it('should NOT include hardcoded rallyos-hub.local when HUB_DOMAIN is custom', () => {
      delete process.env.HUB_ALLOWED_ORIGINS;
      process.env.HUB_DOMAIN = 'myhub.local';
      const origins = getAllowedOrigins();
      expect(origins).toContain('https://myhub.local:3000');
      expect(origins).toContain('http://myhub.local:3000');
      expect(origins).not.toContain('https://rallyos-hub.local:3000');
      expect(origins).not.toContain('http://rallyos-hub.local:3000');
    });

    it('should preserve orangepi.local origins for backward compatibility', () => {
      delete process.env.HUB_ALLOWED_ORIGINS;
      process.env.HUB_DOMAIN = 'custom.local';
      const origins = getAllowedOrigins();
      expect(origins).toContain('http://orangepi.local:3000');
      expect(origins).toContain('https://orangepi.local:3000');
    });
  });

  describe('getHubDomain', () => {
    it('should default to rallyos-hub.local when HUB_DOMAIN is not set', () => {
      delete process.env.HUB_DOMAIN;
      expect(getHubDomain()).toBe('rallyos-hub.local');
    });

    it('should return custom domain when HUB_DOMAIN is set', () => {
      process.env.HUB_DOMAIN = 'myhub.local';
      expect(getHubDomain()).toBe('myhub.local');
    });

    it('should return default when HUB_DOMAIN is empty string', () => {
      process.env.HUB_DOMAIN = '';
      expect(getHubDomain()).toBe('rallyos-hub.local');
    });
  });
});
