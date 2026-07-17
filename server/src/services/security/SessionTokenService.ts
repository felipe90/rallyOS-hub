/**
 * SessionTokenService — HMAC-SHA256 JWT signing & verification.
 *
 * Spec: jwt-session-persistence / capability session-tokens.
 * - REQ-01: HMAC-SHA256 with ENCRYPTION_SECRET; 3 base64url segments
 * - REQ-02: verify returns { sub, role, iat, exp } on success
 * - REQ-03: reject tampered signature
 * - REQ-04: reject past exp (30s leeway)
 * - REQ-05: production throws if secret unset or < 32 bytes; dev warns
 * - REQ-16: payload carries exactly { sub, role, iat, exp }
 * - REQ-17: 8h default TTL, override via SESSION_TOKEN_HOURS
 * - REQ-18: logs MUST NOT include token content (no segment strings either)
 *
 * No external JWT library — Node `crypto` only.
 */

import crypto from 'crypto';
import { getServerSecret } from '../../utils/pinEncryption';
import { logger } from '../../utils/logger';

export type SessionRole = 'tournament_owner' | 'club_admin';

export interface SessionClaims {
  sub: string;
  role: SessionRole;
  iat: number;
  exp: number;
}

/** Clock-skew leeway in seconds (REQ-04). */
const CLOCK_SKEW_LEEWAY_SECONDS = 30;

/** Default session TTL: 8 hours (REQ-17). */
const DEFAULT_TTL_HOURS = 8;

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function resolveTtlSeconds(): number {
  const hoursEnv = process.env.SESSION_TOKEN_HOURS;
  const hours = hoursEnv ? parseFloat(hoursEnv) : DEFAULT_TTL_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_TTL_HOURS * 60 * 60;
  }
  return Math.floor(hours * 60 * 60);
}

/** REQ-05: enforce a production-grade secret. Reuses pinEncryption.getServerSecret. */
function resolveSecretForSession(): string {
  const secret = getServerSecret();
  // 32-byte length check (what pinEncryption lacks — REQ-05 addition)
  if (process.env.NODE_ENV === 'production') {
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(
        'ENCRYPTION_SECRET must be set and at least 32 bytes long in production',
      );
    }
  }
  return secret;
}

export class SessionTokenService {
  private readonly header: string;

  constructor() {
    // Pre-compute the static JWT header segment once.
    this.header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    // Secret is resolved lazily on first sign/verify (REQ-05: fail on first
    // sign/verify, allowing the service object to be constructed at startup
    // wiring time before the secret is known to be valid).
  }

  /**
   * Sign a JWT carrying exactly { sub, role, iat, exp } (REQ-16).
   * TTL defaults to 8h, overridable via SESSION_TOKEN_HOURS (REQ-17).
   */
  signToken(claims: { sub: string; role: SessionRole }): string {
    const secret = resolveSecretForSession();
    const now = Math.floor(Date.now() / 1000);
    const ttl = resolveTtlSeconds();
    const payload: SessionClaims = {
      sub: claims.sub,
      role: claims.role,
      iat: now,
      exp: now + ttl,
    };
    const payloadSeg = base64url(JSON.stringify(payload));
    const data = `${this.header}.${payloadSeg}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  /**
   * Verify the JWT signature and exp claim (REQ-02/03/04).
   * Returns the decoded payload on success, or null on ANY failure.
   * Never throws — REQ-18: no token content in logs.
   */
  verifyToken(token: string): SessionClaims | null {
    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }
    try {
      const segments = token.split('.');
      if (segments.length !== 3) {
        return null;
      }
      const secret = resolveSecretForSession();
      const [headerSeg, payloadSeg, sigSeg] = segments;

      // Validate header to avoid verifying junk
      if (headerSeg !== this.header) {
        const decodedHeader = JSON.parse(
          Buffer.from(headerSeg, 'base64url').toString('utf8'),
        );
        if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') {
          logger.warn({ reason: 'invalid_header' }, 'Session token verification rejected');
          return null;
        }
      }

      // Re-compute signature and constant-time compare
      const data = `${headerSeg}.${payloadSeg}`;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64url');

      const sigBuf = Buffer.from(sigSeg, 'base64url');
      const expectedBuf = Buffer.from(expected, 'base64url');
      if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
      ) {
        logger.warn({ reason: 'bad_signature' }, 'Session token verification rejected');
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(payloadSeg, 'base64url').toString('utf8'),
      ) as SessionClaims;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.role !== 'string' ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number'
      ) {
        logger.warn({ reason: 'malformed_payload' }, 'Session token verification rejected');
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp + CLOCK_SKEW_LEEWAY_SECONDS < now) {
        logger.warn({ reason: 'expired' }, 'Session token verification rejected');
        return null;
      }

      return payload;
    } catch {
      // REQ-18: never log token or segment content.
      logger.warn({ reason: 'verify_exception' }, 'Session token verification rejected');
      return null;
    }
  }
}