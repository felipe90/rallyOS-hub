/**
 * Club Admin Auth Middleware (JWT-based)
 *
 * Validates an `Authorization: Bearer <jwt>` header against the
 * SessionTokenService (HMAC-SHA256 JWT), accepting only tokens whose
 * `role` claim is `club_admin`. On success, the decoded `sub` is exposed
 * on `req.club` for downstream handlers (e.g. the CSV export route).
 *
 * Follows the ownerAuth.ts pattern. Used by the `/api/club/sessions/export`
 * route (spec: club-session-history / "CSV Export" requirement).
 *
 * Response codes (spec: "Non-admin gets 401/403"):
 *   - 401  no Authorization header, malformed Bearer, invalid/tampered/
 *          expired JWT (auth failed — caller is not authed at all)
 *   - 403  JWT is valid but role !== 'club_admin' (caller is authed but
 *          lacks the role required for this endpoint)
 *
 * Usage:
 *   const service = new SessionTokenService();
 *   const clubAuthMiddleware = createClubAuthMiddleware(service);
 *   app.use('/api/club/sessions', createClubSessionsExportRouter(store, clubAuthMiddleware));
 */

import type { Request, Response, NextFunction } from 'express';
import type { SessionTokenService } from '../services/security/SessionTokenService';

export interface ClubAuthRequest extends Request {
  club?: { sub: string; role: string };
}

/**
 * Factory: builds an Express middleware bound to a specific
 * SessionTokenService. Mirrors createOwnerAuthMiddleware so that the two
 * roles share the same HMAC secret source of truth.
 */
export function createClubAuthMiddleware(
  sessionTokenService: SessionTokenService,
): (req: Request, res: Response, next: NextFunction) => void {
  return function clubAuthMiddleware(
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
    if (!claims) {
      // Missing/invalid/expired/tampered JWT — caller is not authed at all.
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }
    if (claims.role !== 'club_admin') {
      // Valid JWT but wrong role for this endpoint → 403 Forbidden.
      res.status(403).json({
        error: 'Club admin access required',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Surface the decoded club context for downstream handlers.
    (req as ClubAuthRequest).club = { sub: claims.sub, role: claims.role };
    next();
  };
}