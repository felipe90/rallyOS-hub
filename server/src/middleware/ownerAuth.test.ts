/**
 * Owner auth middleware tests (JWT-based).
 *
 * Spec: jwt-session-persistence / capability tournament-owner-auth.
 * Previously validated tokens against an in-memory UUID Set; now validates
 * a signed JWT via SessionTokenService.verifyToken and checks role ===
 * 'tournament_owner' (REQ-08). UUID tokens MUST be rejected (REQ-09).
 */

import type { Request, Response, NextFunction } from 'express';
import { SessionTokenService } from '../services/security/SessionTokenService';
import { createOwnerAuthMiddleware } from './ownerAuth';

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

// ── Tests ──────────────────────────────────────────────────────────────

describe('ownerAuth (JWT-based)', () => {
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

  describe('createOwnerAuthMiddleware', () => {
    it('calls next() and sets req owner context when Authorization is a valid tournament_owner JWT', () => {
      const token = service.signToken({ sub: 'owner', role: 'tournament_owner' });
      const req: any = mockReq(`Bearer ${token}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(req.owner).toBeDefined();
      // owner context comes from the JWT `sub` claim (REQ-08)
      if (req.owner) {
        expect(req.owner.sub).toBe('owner');
        expect(req.owner.role).toBe('tournament_owner');
      }
    });

    it('responds 401 when Authorization header is missing', () => {
      const req = mockReq(undefined);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when Authorization header has wrong format (no Bearer prefix)', () => {
      const req = mockReq('some-random-token');
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when the JWT is tampered (signature mismatch)', () => {
      const token = service.signToken({ sub: 'owner', role: 'tournament_owner' });
      const [h, p, s] = token.split('.');
      const tampered = `${h}.${p}X.${s}`;
      const req = mockReq(`Bearer ${tampered}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when the JWT role is not tournament_owner (e.g. club_admin)', () => {
      const token = service.signToken({ sub: 'club-1', role: 'club_admin' });
      const req = mockReq(`Bearer ${token}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when the JWT is expired beyond the 30s leeway', () => {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'owner', role: 'tournament_owner', iat: now - 300, exp: now - 200 }),
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

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('REJECTS legacy UUID tokens (clean break, REQ-09)', () => {
      const legacyUuid = 'a1b2c3d4-e5f6-4abc-8def-0123456789ab';
      const req = mockReq(`Bearer ${legacyUuid}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      createOwnerAuthMiddleware(service)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});