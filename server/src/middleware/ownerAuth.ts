/**
 * Owner Tournament Auth Middleware (JWT-based)
 *
 * Validates an `Authorization: Bearer <jwt>` header against the
 * SessionTokenService (HMAC-SHA256 JWT), accepting only tokens whose
 * `role` claim is `tournament_owner` (REQ-08). On success, the decoded
 * `sub` is exposed on `req.owner` for downstream handlers.
 *
 * Migration (clean break, REQ-09): the previous UUID in-memory `activeTokens`
 * Set and `generateToken()` helper are removed. Legacy UUID tokens are no
 * longer accepted — clients must obtain a JWT via VERIFY_OWNER.
 *
 * Usage:
 *   const service = new SessionTokenService();
 *   const ownerAuthMiddleware = createOwnerAuthMiddleware(service);
 *   app.use('/api/tournament', createTournamentRouter(..., ownerAuthMiddleware));
 */

import type { Request, Response, NextFunction } from 'express';
import type { SessionTokenService } from '../services/security/SessionTokenService';

export interface OwnerAuthRequest extends Request {
  owner?: { sub: string; role: string };
}

/**
 * Factory: builds an Express middleware bound to a specific SessionTokenService.
 * Replaces the previous module-level activeTokens Set (which did not survive
 * server restarts).
 */
export function createOwnerAuthMiddleware(
  sessionTokenService: SessionTokenService,
): (req: Request, res: Response, next: NextFunction) => void {
  return function ownerAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const authHeader = req.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const token = parts[1];
    const claims = sessionTokenService.verifyToken(token);
    if (!claims || claims.role !== 'tournament_owner') {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Surface the decoded owner context for downstream handlers (REQ-08).
    (req as OwnerAuthRequest).owner = { sub: claims.sub, role: claims.role };
    next();
  };
}