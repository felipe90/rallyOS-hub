/**
 * SessionTokenService — HMAC-SHA256 JWT signing & verification.
 *
 * Spec: jwt-session-persistence / capability session-tokens.
 * - REQ-01: sign with HMAC-SHA256 using ENCRYPTION_SECRET; 3 base64url segments joined by '.'
 * - REQ-02: verify returns { sub, role, iat, exp } on success
 * - REQ-03: reject tampered signature
 * - REQ-04: reject past exp (30s leeway)
 * - REQ-05: production throws if secret unset or < 32 bytes; dev warns
 * - REQ-16: payload carries exactly { sub, role, iat, exp }
 * - REQ-17: 8h default TTL, override via SESSION_TOKEN_HOURS
 * - REQ-18: logs MUST NOT include token content (no segment strings either)
 */

import crypto from 'crypto';
import { SessionTokenService } from './SessionTokenService';
import type { SessionClaims } from './SessionTokenService';

// Use a deterministic 32+ byte secret for tests.
const TEST_SECRET = 'a'.repeat(64);

describe('SessionTokenService', () => {
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;
  let originalTtl: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    originalTtl = process.env.SESSION_TOKEN_HOURS;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV; // non-production
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalTtl === undefined) delete process.env.SESSION_TOKEN_HOURS;
    else process.env.SESSION_TOKEN_HOURS = originalTtl;
  });

  // ── REQ-01: signing shape ────────────────────────────────────────────

  describe('signToken — shape (REQ-01/16/17)', () => {
    it('produces exactly 3 dot-separated segments', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const segments = token.split('.');
      expect(segments).toHaveLength(3);
    });

    it('uses base64url charset in every segment (no "=" padding, no "+" "/")', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'club-123', role: 'club_admin' });
      const segments = token.split('.');
      expect(segments).toHaveLength(3);
      const base64url = /^[A-Za-z0-9_-]+$/;
      for (const seg of segments) {
        expect(seg).toMatch(base64url);
        expect(seg).not.toContain('=');
        expect(seg).not.toContain('+');
        expect(seg).not.toContain('/');
      }
    });

    it('header decodes to alg HS256 + typ JWT', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
      );
      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    });

    it('payload carries exactly { sub, role, iat, exp } (no extra claims)', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const payload: SessionClaims = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
      expect(payload.sub).toBe('owner');
      expect(payload.role).toBe('tournament_owner');
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
    });

    it('default TTL is 8 hours from iat', () => {
      delete process.env.SESSION_TOKEN_HOURS;
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const payload: SessionClaims = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
    });

    it('TTL is overridable via SESSION_TOKEN_HOURS', () => {
      process.env.SESSION_TOKEN_HOURS = '2';
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const payload: SessionClaims = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(payload.exp - payload.iat).toBe(2 * 60 * 60);
    });
  });

  // ── REQ-02: valid verification ──────────────────────────────────────

  describe('verifyToken — valid (REQ-02)', () => {
    it('returns the decoded payload for a freshly signed token', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'club-99', role: 'club_admin' });
      const claims = svc.verifyToken(token);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe('club-99');
      expect(claims!.role).toBe('club_admin');
      expect(typeof claims!.iat).toBe('number');
      expect(typeof claims!.exp).toBe('number');
    });

    it('returns the same payload that was signed (deterministic round-trip)', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const decoded = svc.verifyToken(token);
      const signedPayload: SessionClaims = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(decoded).toEqual(signedPayload);
    });
  });

  // ── REQ-03/04: rejection cases ──────────────────────────────────────

  describe('verifyToken — rejection (REQ-03/04/16)', () => {
    it('returns null for a tampered payload segment (signature mismatch)', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const [h, p, s] = token.split('.');
      // Flip a character in the payload
      const tamperedPayload = p.endsWith('A')
        ? p.slice(0, -1) + 'B'
        : p.slice(0, -1) + 'A';
      const tampered = `${h}.${tamperedPayload}.${s}`;
      expect(svc.verifyToken(tampered)).toBeNull();
    });

    it('returns null for a tampered signature segment', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      const [h, p, s] = token.split('.');
      const tamperedSig = s.endsWith('A')
        ? s.slice(0, -1) + 'B'
        : s.slice(0, -1) + 'A';
      const tampered = `${h}.${p}.${tamperedSig}`;
      expect(svc.verifyToken(tampered)).toBeNull();
    });

    it('returns null for a token signed with a different secret', () => {
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });

      process.env.ENCRYPTION_SECRET = 'b'.repeat(64);
      const other = new SessionTokenService();
      expect(other.verifyToken(token)).toBeNull();
    });

    it('returns null for an expired token beyond the 30s leeway', () => {
      process.env.SESSION_TOKEN_HOURS = '0.0083'; // ~30s — but we need > 30s past
      // Use a 1 hour TTL but forge an exp far in the past instead.
      delete process.env.SESSION_TOKEN_HOURS;
      const svc = new SessionTokenService();
      // Manually forge a token that expired 120s ago.
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'owner', role: 'tournament_owner', iat: now - 200, exp: now - 120 }),
      ).toString('base64url');
      const data = `${header}.${payload}`;
      const secret = process.env.ENCRYPTION_SECRET!;
      const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      const forged = `${data}.${sig}`;
      expect(svc.verifyToken(forged)).toBeNull();
    });

    it('accepts a token within the 30s clock-skew leeway', () => {
      const svc = new SessionTokenService();
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'owner', role: 'tournament_owner', iat: now - 100, exp: now - 10 }),
      ).toString('base64url');
      const data = `${header}.${payload}`;
      const secret = process.env.ENCRYPTION_SECRET!;
      const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      const forged = `${data}.${sig}`;
      expect(svc.verifyToken(forged)).not.toBeNull();
    });

    it('returns null for a malformed token (not 3 segments)', () => {
      const svc = new SessionTokenService();
      expect(svc.verifyToken('not-a-token')).toBeNull();
      expect(svc.verifyToken('a.b')).toBeNull();
      expect(svc.verifyToken('a.b.c.d')).toBeNull();
    });

    it('does not throw on any malformed input (never throws)', () => {
      const svc = new SessionTokenService();
      expect(() => svc.verifyToken('')).not.toThrow();
      expect(() => svc.verifyToken('...')).not.toThrow();
      expect(() => svc.verifyToken('%%%')).not.toThrow();
    });
  });

  // ── REQ-18: log sanitization ────────────────────────────────────────

  describe('log sanitization (REQ-18)', () => {
    it('never logs the token or any of its segments on verify failure', () => {
      const loggerSpy = jest.spyOn(require('../../utils/logger').logger, 'warn')
        .mockImplementation(() => undefined as any);
      const svc = new SessionTokenService();
      const token = svc.signToken({ sub: 'owner', role: 'tournament_owner' });
      loggerSpy.mockClear();
      const [h, p, s] = token.split('.');
      // Pass a tampered token so warn is emitted
      svc.verifyToken(`${h}.${p}X.${s}`);
      for (const call of loggerSpy.mock.calls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain(token);
        expect(serialized).not.toContain(p);
        expect(serialized).not.toContain(s);
      }
      loggerSpy.mockRestore();
    });
  });

  // ── REQ-05: production secret enforcement ──────────────────────────

  describe('production secret enforcement (REQ-05)', () => {
    it('throws in production when ENCRYPTION_SECRET is unset', () => {
      delete process.env.ENCRYPTION_SECRET;
      process.env.NODE_ENV = 'production';
      const svc = new SessionTokenService();
      expect(() => svc.signToken({ sub: 'owner', role: 'tournament_owner' })).toThrow(
        /ENCRYPTION_SECRET/,
      );
    });

    it('throws in production when ENCRYPTION_SECRET is shorter than 32 bytes', () => {
      process.env.ENCRYPTION_SECRET = 'short'; // 5 bytes
      process.env.NODE_ENV = 'production';
      const svc = new SessionTokenService();
      expect(() => svc.signToken({ sub: 'owner', role: 'tournament_owner' })).toThrow(
        /ENCRYPTION_SECRET/,
      );
    });

    it('does not throw outside production even with unset/short secret', () => {
      delete process.env.ENCRYPTION_SECRET;
      delete process.env.NODE_ENV;
      const svc = new SessionTokenService();
      expect(() => svc.signToken({ sub: 'owner', role: 'tournament_owner' })).not.toThrow();
    });
  });
});