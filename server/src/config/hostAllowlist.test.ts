/**
 * Host allowlist tests.
 *
 * Covers the D3 tightened host check: private IPv4 ranges accepted, public
 * IPs rejected, localhost accepted, and the hub's own configured domain
 * accepted. Env-dependent cases snapshot/restore HUB_DOMAIN and
 * HUB_ALLOWED_ORIGINS so the default-origin fallback stays deterministic.
 */

import {
  isAllowedHubHost,
  isPrivateIpv4,
  parseIpv4,
} from './hostAllowlist';

const DEFAULT_HUB_DOMAIN = process.env.HUB_DOMAIN;
const DEFAULT_ALLOWED_ORIGINS = process.env.HUB_ALLOWED_ORIGINS;

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    snapshot[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(snapshot)) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  }
}

describe('parseIpv4', () => {
  it('parses valid dotted-quad addresses', () => {
    expect(parseIpv4('192.168.1.50')).toEqual([192, 168, 1, 50]);
    expect(parseIpv4('10.0.0.1')).toEqual([10, 0, 0, 1]);
  });

  it('rejects out-of-range octets', () => {
    expect(parseIpv4('192.168.1.300')).toBeNull();
    expect(parseIpv4('999.1.1.1')).toBeNull();
  });

  it('rejects non-IPv4 strings', () => {
    expect(parseIpv4('localhost')).toBeNull();
    expect(parseIpv4('rallyos.wifi')).toBeNull();
    expect(parseIpv4('not-an-ip')).toBeNull();
  });
});

describe('isPrivateIpv4', () => {
  it.each([
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.1.50',
    '192.168.255.255',
  ])('accepts private IP %s', (host) => {
    expect(isPrivateIpv4(host)).toBe(true);
  });

  it.each([
    '11.0.0.1',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.0.1',
    '8.8.8.8',
    '1.2.3.4',
  ])('rejects public/outside-range IP %s', (host) => {
    expect(isPrivateIpv4(host)).toBe(false);
  });

  it('rejects non-IP strings', () => {
    expect(isPrivateIpv4('localhost')).toBe(false);
    expect(isPrivateIpv4('192.168.1')).toBe(false);
  });
});

describe('isAllowedHubHost', () => {
  it('accepts localhost and loopback variants', () => {
    expect(isAllowedHubHost('localhost')).toBe(true);
    expect(isAllowedHubHost('127.0.0.1')).toBe(true);
    expect(isAllowedHubHost('::1')).toBe(true);
    expect(isAllowedHubHost('::ffff:127.0.0.1')).toBe(true);
  });

  it('accepts private IPv4 addresses', () => {
    expect(isAllowedHubHost('192.168.1.50')).toBe(true);
    expect(isAllowedHubHost('10.0.0.1')).toBe(true);
    expect(isAllowedHubHost('172.16.5.5')).toBe(true);
  });

  it('rejects public IPv4 addresses', () => {
    expect(isAllowedHubHost('8.8.8.8')).toBe(false);
    expect(isAllowedHubHost('11.0.0.1')).toBe(false);
    expect(isAllowedHubHost('172.32.0.1')).toBe(false);
    expect(isAllowedHubHost('192.169.1.1')).toBe(false);
  });

  it('accepts the default hub domain', () => {
    withEnv({ HUB_DOMAIN: undefined, HUB_ALLOWED_ORIGINS: undefined }, () => {
      expect(isAllowedHubHost('rallyos.wifi')).toBe(true);
    });
  });

  it('accepts a custom HUB_DOMAIN', () => {
    withEnv({ HUB_DOMAIN: 'rallyos.example', HUB_ALLOWED_ORIGINS: undefined }, () => {
      expect(isAllowedHubHost('rallyos.example')).toBe(true);
      expect(isAllowedHubHost('rallyos.wifi')).toBe(false);
    });
  });

  it('accepts hostnames from the default allowed origins', () => {
    withEnv({ HUB_DOMAIN: undefined, HUB_ALLOWED_ORIGINS: undefined }, () => {
      expect(isAllowedHubHost('orangepi.local')).toBe(true);
      expect(isAllowedHubHost('rallyos.local')).toBe(true);
    });
  });

  it('rejects arbitrary hostnames', () => {
    expect(isAllowedHubHost('evil.com')).toBe(false);
    expect(isAllowedHubHost('attacker.local')).toBe(false);
    expect(isAllowedHubHost('hub.internal')).toBe(false);
  });

  it('rejects empty and undefined hosts', () => {
    expect(isAllowedHubHost('')).toBe(false);
    expect(isAllowedHubHost(undefined)).toBe(false);
  });
});

afterAll(() => {
  withEnv(
    { HUB_DOMAIN: DEFAULT_HUB_DOMAIN, HUB_ALLOWED_ORIGINS: DEFAULT_ALLOWED_ORIGINS },
    () => {},
  );
});
