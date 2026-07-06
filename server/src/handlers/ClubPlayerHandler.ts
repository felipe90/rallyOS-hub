/**
 * ClubPlayerHandler — Handles club player join via PIN
 *
 * Events handled:
 * - CLUB_JOIN: Player attempts to join a club court using a 4-digit PIN
 *
 * Rate limiting:
 * - 5 failed PIN attempts per 60s per IP → blocked for 60s
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { validateSocketPayload } from '../utils/validation';
import { logger, maskIp } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { PIN_RULES } from '../../../shared/validation';
import { SPORT } from '../../../shared/types';
import { SocketHandlerBase } from './SocketHandlerBase';

// ═══════════════════════════════════════════════════════════════
// PinRateLimiter — dedicated rate limiter for club PIN attempts
// ═══════════════════════════════════════════════════════════════

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const BLOCK_DURATION_MS = 60_000;

class PinRateLimiter {
  private attempts: Map<string, { count: number; blockedUntil: number }> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.cleanupTimer.unref();
  }

  /**
   * Remove stale entries (block expired or no activity in 2 windows).
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.attempts.entries()) {
      if (entry.blockedUntil > 0 && now >= entry.blockedUntil) {
        this.attempts.delete(ip);
      }
    }
  }

  /**
   * Check if an IP is allowed to attempt PIN entry.
   * Returns whether the attempt is allowed and remaining block time if blocked.
   */
  check(ip: string): { allowed: boolean; remainingBlockSeconds?: number } {
    const entry = this.attempts.get(ip);
    if (!entry) return { allowed: true };

    const now = Date.now();

    // Currently blocked
    if (entry.blockedUntil > now) {
      const remaining = Math.ceil((entry.blockedUntil - now) / 1000);
      return { allowed: false, remainingBlockSeconds: remaining };
    }

    // Block expired — clean slate
    if (entry.blockedUntil > 0 && now >= entry.blockedUntil) {
      this.attempts.delete(ip);
      return { allowed: true };
    }

    // Under the limit — allowed
    if (entry.count < MAX_ATTEMPTS) {
      return { allowed: true };
    }

    // Exceeded limit — activate block
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    const remaining = Math.ceil(BLOCK_DURATION_MS / 1000);
    return { allowed: false, remainingBlockSeconds: remaining };
  }

  /**
   * Record a failed attempt from an IP.
   */
  recordAttempt(ip: string): void {
    const entry = this.attempts.get(ip) ?? { count: 0, blockedUntil: 0 };
    entry.count++;
    this.attempts.set(ip, entry);
  }

  /**
   * Reset the rate limiter for a given IP (on successful join).
   */
  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

// ═══════════════════════════════════════════════════════════════
// ClubPlayerHandler
// ═══════════════════════════════════════════════════════════════

/**
 * Socket handler for club player flow — PIN entry, court occupancy, and
 * match auto-init.
 *
 * Extends SocketHandlerBase for shared rate limiting, validation, and
 * common utilities.
 */
export class ClubPlayerHandler extends SocketHandlerBase {
  private clubConfigStore: ClubConfigStore;
  private pinRateLimiter: PinRateLimiter;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    clubConfigStore: ClubConfigStore,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
    this.pinRateLimiter = new PinRateLimiter();
  }

  /**
   * Register all club player event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CLUB_JOIN: Player attempts to join a club court using a 4-digit PIN
    socket.on(SocketEvents.CLIENT.CLUB_JOIN, (data: { pin: string }) => {
      if (!validateSocketPayload(socket, data, {
        pin: { required: true, type: 'string', pattern: PIN_RULES.tablePin.pattern },
      }, 'CLUB_JOIN')) {
        return;
      }

      const clientIp = socket.handshake.address;

      // 1. Rate limit check — 5 attempts / 60s per IP
      const rateCheck = this.pinRateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        this.logRateLimitBlocked('CLUB_JOIN', 'pin-entry', clientIp);
        socket.emit(SocketEvents.SERVER.CLUB_JOIN_RESULT, {
          success: false,
          error: 'RATE_LIMITED',
          ...(rateCheck.remainingBlockSeconds !== undefined && {
            retryAfterSeconds: rateCheck.remainingBlockSeconds,
          }),
        });
        return;
      }

      // 2. Find club court by PIN (only RESERVED or OCCUPIED courts)
      const court = this.tableManager.findClubCourtByPin(data.pin);
      if (!court) {
        this.pinRateLimiter.recordAttempt(clientIp);
        logger.warn({ ip: maskIp(clientIp) }, 'CLUB_JOIN: invalid PIN attempt');
        socket.emit(SocketEvents.SERVER.CLUB_JOIN_RESULT, {
          success: false,
          error: 'INVALID_PIN',
        });
        return;
      }

      // 3. Read club config to get the sport for match defaults
      const clubConfig = this.clubConfigStore.load();
      if (!clubConfig || !clubConfig.configured) {
        this.pinRateLimiter.recordAttempt(clientIp);
        socket.emit(SocketEvents.SERVER.CLUB_JOIN_RESULT, {
          success: false,
          error: 'CLUB_NOT_CONFIGURED',
        });
        return;
      }

      // Validate sport from config — default to table tennis if unrecognized
      const sport = clubConfig.sport === SPORT.PADEL ? SPORT.PADEL : SPORT.TABLE_TENNIS;

      // 4. Occupy court: RESERVED → OCCUPIED + auto-init match
      const result = this.tableManager.occupyClubCourt(court.id, sport);
      if (!result) {
        this.pinRateLimiter.recordAttempt(clientIp);
        socket.emit(SocketEvents.SERVER.CLUB_JOIN_RESULT, {
          success: false,
          error: 'OCCUPY_FAILED',
        });
        return;
      }

      // 5. Success — reset rate limiter, register socket in court room
      this.pinRateLimiter.reset(clientIp);
      socket.join(court.id);

      // 6. Register socket as referee so they can score points
      //    Club courts are self-refereed — the player scoring IS the referee
      this.tableManager.registerClubReferee(court.id, socket.id);

      // Emit success result directly to the joining socket
      socket.emit(SocketEvents.SERVER.CLUB_JOIN_RESULT, {
        success: true,
        courtId: result.court.id,
        courtName: result.court.name,
        matchState: result.matchState,
      });

      // notifyUpdate (called inside occupyClubCourt) already broadcasts
      // COURT_UPDATE to the room and COURT_LIST to all clients.
      // This log entry marks completion of the join flow.
      logger.info(
        { courtId: court.id, ip: maskIp(clientIp) },
        'CLUB_JOIN: player joined club court',
      );
    });
  }
}
