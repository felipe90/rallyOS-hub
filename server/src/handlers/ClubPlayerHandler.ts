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
import { SPORT, CLUB_STATUS } from '../../../shared/types';
import { isClubCourt } from '../domain/types';
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
    // Wire onClubSessionEnd callback to calculate cost and broadcast to the room
    this.tableManager.onClubSessionEnd = (courtId: string, elapsedMinutes: number, reason: string) => {
      const clubConfig = this.clubConfigStore.load();
      const costPerMinute = clubConfig?.costPerMinute ?? 0;
      const currency = clubConfig?.currency ?? 'ARS';
      const cost = Math.ceil(elapsedMinutes * costPerMinute);

      this.io.to(courtId).emit(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId,
        elapsedMinutes,
        cost,
        currency,
        reason,
      });
    };

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
      const displacedSocketId = this.tableManager.registerClubReferee(court.id, socket.id);
      if (displacedSocketId) {
        // Notify the old referee that their bridge ownership was replaced
        this.io.to(displacedSocketId).emit(SocketEvents.SERVER.REF_REVOKED, { courtId: court.id, reason: 'replaced' });
      }

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

    // CLUB_RECONNECT: Re-establish bridge ownership after page refresh
    socket.on(SocketEvents.CLIENT.CLUB_RECONNECT, (data: { courtId: string }) => {
      if (!data || typeof data.courtId !== 'string' || !data.courtId.trim()) {
        socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
          success: false,
          error: 'INVALID_PARAMS',
        });
        return;
      }

      const court = this.tableManager.getCourt(data.courtId);
      if (!court) {
        socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
          success: false,
          error: 'COURT_NOT_FOUND',
        });
        return;
      }

      if (!isClubCourt(court)) {
        socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
          success: false,
          error: 'NOT_CLUB_MODE',
        });
        return;
      }

      if (court.clubStatus !== CLUB_STATUS.OCCUPIED) {
        socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
          success: false,
          error: 'COURT_NOT_OCCUPIED',
        });
        return;
      }

      // Register socket as referee (reconnection bypasses PIN rate limiting)
      const displacedSocketId = this.tableManager.registerClubReferee(court.id, socket.id);
      if (displacedSocketId) {
        this.io.to(displacedSocketId).emit(SocketEvents.SERVER.REF_REVOKED, { courtId: court.id, reason: 'replaced' });
      }

      // Join socket to court room for match updates
      socket.join(court.id);

      // Get current match state
      const matchState = this.tableManager.getMatchState(court.id);

      socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: true,
        courtId: court.id,
        matchState,
      });

      logger.info(
        { courtId: court.id, socketId: socket.id },
        'CLUB_RECONNECT: bridge ownership re-established',
      );
    });

    // CLUB_END_SESSION: Player-initiated session end
    socket.on(SocketEvents.CLIENT.CLUB_END_SESSION, (data: { courtId: string }) => {
      if (!data || typeof data.courtId !== 'string' || !data.courtId.trim()) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'INVALID_PARAMS',
          message: 'Se requiere courtId',
        });
        return;
      }

      // Validate socket is referee for this court
      if (!this.validateReferee(socket, data.courtId)) return;

      // Validate court exists and is OCCUPIED
      const court = this.tableManager.getCourt(data.courtId);
      if (!court || !isClubCourt(court) || court.clubStatus !== CLUB_STATUS.OCCUPIED) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'SESSION_NOT_ACTIVE',
          message: 'La sesión no está activa',
        });
        return;
      }

      // End the session — the onClubSessionEnd callback handles the broadcast
      const result = this.tableManager.endSession(data.courtId, 'player');
      if (!result) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'END_SESSION_FAILED',
          message: 'No se pudo finalizar la sesión',
        });
        return;
      }

      logger.info(
        { courtId: data.courtId, elapsedMinutes: result.elapsedMinutes, reason: 'player' },
        'CLUB_END_SESSION: player ended session',
      );
    });
  }
}
