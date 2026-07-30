/**
 * clubAuth middleware tests (JWT-based, role=club_admin).
 *
 * Spec: club-session-history / "Authorization & Security".
 *
 * Mirrors ownerAuth.test.ts pattern: validates a signed JWT via
 * SessionTokenService.verifyToken and checks `role === 'club_admin'`.
 * Used by the /api/club/sessions/export route in task 2.5.
 *
 * Authorization outcomes per spec:
 *   - 401  no Authorization header, wrong Bearer format, tampered JWT
 *   - 403  valid JWT but role !== 'club_admin' (e.g. tournament_owner)
 *   - 200  valid club_admin JWT → next() called + req.club context set
 */

import type { Request, Response, NextFunction } from 'express';
import { SessionTokenService } from '../services/security/SessionTokenService';
import { createClubAuthMiddleware, ClubAuthRequest } from './clubAuth';

// ── Helpers ────────────────────────────────────────────────────────────

function mockReq(headerValue?: string): Request {
  return {
    headers: {
      authorization: headerValue,
    },
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('clubAuth (JWT-based, role=club_admin)', () => {
  const TEST_SECRET = 'a'.repeat(64);
  let service: SessionTokenService;
  let originalSecret: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    delete process.env.NODE_ENV;
    service = new SessionTokenService();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  describe('createClubAuthMiddleware', () => {
    it('calls next() and sets req.club context when Authorization is a valid club_admin JWT', () => {
      const token = service.signToken({ sub: 'club-7', role: 'club_admin' });
      const req = mockReq(`Bearer ${token}`) as ClubAuthRequest;
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(req.club).toBeDefined();
      if (req.club) {
        expect(req.club.sub).toBe('club-7');
        expect(req.club.role).toBe('club_admin');
      }
    });

    it('responds 401 when Authorization header is missing', () => {
      const req = mockReq(undefined);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when Authorization has wrong format (no Bearer prefix)', () => {
      const req = mockReq('some-random-token');
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when the JWT signature is tampered', () => {
      const token = service.signToken({ sub: 'club-7', role: 'club_admin' });
      const [h, p, s] = token.split('.');
      const tampered = `${h}.${p}X.${s}`;
      const req = mockReq(`Bearer ${tampered}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 403 when the JWT is valid but role is not club_admin (e.g. tournament_owner)', () => {
      const token = service.signToken({ sub: 'owner', role: 'tournament_owner' });
      const req = mockReq(`Bearer ${token}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      // Distinct from ownerAuth (401): token is valid but the role is wrong
      // for THIS endpoint's auth scope → 403 Forbidden. Per spec, non-admin
      // callers get 401 OR 403 — never 200.
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Club admin access required',
        code: 'FORBIDDEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when the JWT is expired beyond the 30s leeway', () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'club-7', role: 'club_admin', iat: now - 300, exp: now - 200 }),
      ).toString('base64url');
      const data = `${header}.${payload}`;
      const sig = require('crypto')
        .createHmac('sha256', TEST_SECRET)
        .update(data)
        .digest('base64url');
      const expired = `${data}.${sig}`;
      const req = mockReq(`Bearer ${expired}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects legacy UUID tokens (clean break)', () => {
      const legacyUuid = 'a1b2c3d4-e5f6-4abc-8def-0123456789ab';
      const req = mockReq(`Bearer ${legacyUuid}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createClubAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});