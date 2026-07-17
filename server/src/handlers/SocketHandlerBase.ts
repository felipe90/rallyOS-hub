/**
 * SocketHandlerBase - Base class for all socket event handlers
 *
 * Contains shared logic: rate limiting, table info transformation,
 * public table list generation, and common utilities.
 */

import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { CourtManager } from '../domain/courtManager';
import { CourtInfo, CourtInfoWithPin } from '../domain/types';
import { logger, maskIp } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';

export abstract class SocketHandlerBase {
  protected io: Server;
  protected tableManager: CourtManager;
  protected ownerPin: string;
  protected rateLimiter: RateLimiter;

  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.rateLimiter = new RateLimiter();
    this.rateLimiter.startCleanup();
  }

  /**
   * Convert court to public info
   */
  protected toPublicCourtInfo(court: CourtInfo): CourtInfo {
    return court;
  }

  /**
   * Get public court list
   */
  protected getPublicCourtList(): CourtInfo[] {
    return this.tableManager.getAllCourts().map((court) => this.toPublicCourtInfo(court));
  }

  /**
   * Get courts with PINs (owner only)
   */
  protected getCourtsWithPins(): CourtInfoWithPin[] {
    return this.tableManager.getAllCourtsWithPins();
  }

  /**
   * Check if socket is rate limited for given action
   */
  protected isRateLimited(key: string): boolean {
    return this.rateLimiter.isRateLimited(key);
  }

  /**
   * Constant-time PIN comparison to prevent timing attacks.
   */
  protected comparePin(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Check if user is owner (by PIN) — uses timing-safe comparison.
   */
  protected isOwner(pin?: string): boolean {
    if (!pin) return false;
    return this.comparePin(pin, this.ownerPin);
  }

  /**
   * Log rate limit warning with masked IP.
   */
  protected logRateLimitBlocked(action: string, courtId: string, clientIp: string): void {
    logger.warn({ action, courtId, ip: maskIp(clientIp) }, `${action} rate limit blocked`);
  }

  /**
   * Emit error to socket
   */
  protected emitError(socket: Socket, code: string, message: string): void {
    socket.emit('ERROR', { code, message });
  }

  /**
   * Validate court ID exists and emit error if not
   */
  protected validateCourtExists(socket: Socket, courtId: string | undefined): boolean {
    if (!courtId) {
      this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      return false;
    }
    const court = this.tableManager.getCourt(courtId);
    if (!court) {
      this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      return false;
    }
    return true;
  }

  /**
   * Check if socket is authenticated and emit error if not
   */
  protected validateAuthenticated(socket: Socket): boolean {
    const socketData = socket.data as import('../domain/types').SocketData;
    if (!socketData.isAuthenticated) {
      this.emitError(socket, 'UNAUTHORIZED', 'Authentication required');
      return false;
    }
    return true;
  }

  /**
   * Check if socket is club admin and emit error if not
   */
  protected validateClubAdmin(socket: Socket): boolean {
    const socketData = socket.data as import('../domain/types').SocketData;
    if (!socketData.isClubAdmin) {
      this.emitError(socket, 'UNAUTHORIZED', 'Admin access required');
      return false;
    }
    return true;
  }

  /**
   * Check if socket is referee for court and emit error if not
   */
  protected validateReferee(socket: Socket, courtId: string): boolean {
    if (!this.tableManager.isReferee(courtId, socket.id)) {
      this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      return false;
    }
    return true;
  }
}
