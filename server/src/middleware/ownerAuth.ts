/**
 * Owner Tournament Auth Middleware
 *
 * Provides in-memory token-based authentication for HTTP tournament endpoints.
 * Token is generated on successful VERIFY_OWNER (WebSocket) and stored in
 * a module-level Set. Server restart clears all tokens — re-auth is required.
 *
 * Usage:
 *   import { generateToken, ownerAuthMiddleware } from './middleware/ownerAuth';
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Module-level in-memory store for active tournament tokens. */
export const activeTokens = new Set<string>();

/**
 * Generate a new tournament auth token and store it.
 * Called from AuthHandler.VERIFY_OWNER on successful PIN verification.
 *
 * @returns The generated UUID v4 token string.
 */
export function generateToken(): string {
  const token = crypto.randomUUID();
  activeTokens.add(token);
  return token;
}

/**
 * Express middleware that validates the Authorization: Bearer <token> header
 * against the in-memory `activeTokens` Set.
 *
 * Responds with 401 JSON if the token is missing or invalid.
 */
export function ownerAuthMiddleware(
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

  if (!activeTokens.has(token)) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  next();
}
