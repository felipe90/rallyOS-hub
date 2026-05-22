/**
 * Owner auth middleware tests.
 *
 * Tests token generation and Express middleware validation
 * against an in-memory Set of active tournament tokens.
 */

import { generateToken, ownerAuthMiddleware, activeTokens } from './ownerAuth';
import type { Request, Response, NextFunction } from 'express';

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

describe('ownerAuth', () => {
  beforeEach(() => {
    activeTokens.clear();
  });

  describe('generateToken', () => {
    it('should generate a non-empty string token', () => {
      const token = generateToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate a valid UUID v4 format', () => {
      const token = generateToken();

      // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Pattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidV4Pattern);
    });

    it('should store generated token in activeTokens set', () => {
      const token = generateToken();

      expect(activeTokens.has(token)).toBe(true);
    });

    it('should generate unique tokens on each call', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
      expect(activeTokens.size).toBe(2);
    });
  });

  describe('ownerAuthMiddleware', () => {
    it('should respond 401 when Authorization header is missing', () => {
      const req = mockReq(undefined);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      ownerAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond 401 when Authorization header has wrong format (no Bearer prefix)', () => {
      const req = mockReq('some-random-token');
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      ownerAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond 401 when token is not in activeTokens set', () => {
      const req = mockReq('Bearer invalid-token');
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      ownerAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() when token is valid (in activeTokens)', () => {
      const token = generateToken();
      const req = mockReq(`Bearer ${token}`);
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      ownerAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should accept token after server restart (fresh Set is empty)', () => {
      // After restart, activeTokens is empty → all tokens invalid
      const req = mockReq('Bearer some-old-token');
      const res = mockRes();
      const next = jest.fn() as NextFunction;

      ownerAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
