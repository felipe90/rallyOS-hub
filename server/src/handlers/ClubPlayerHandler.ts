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
import crypto from 'crypto';
import { CourtManager } from '../domain/courtManager';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { validateSocketPayload } from '../utils/validation';
import { logger, maskIp } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { PIN_RULES } from '../../../shared/validation';
import { SPORT, CLUB_STATUS, SESSION_MODE } from '../../../shared/types';
import type { MatchConfig, SessionRecord, SessionMode } from '../../../shared/types';
import { isClubCourt } from '../domain/types';
import type { ClubCourt } from '../domain/types';
import { SocketHandlerBase } from './SocketHandlerBase';
import { PinRateLimiter } from '../services/security/PinRateLimiter';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';

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
  private clubConfigStore: IClubConfigRepository;
  private pinRateLimiter: PinRateLimiter;
  private sessionHistoryStore?: SessionHistoryStore;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    clubConfigStore: IClubConfigRepository,
    sessionHistoryStore?: SessionHistoryStore,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
    this.pinRateLimiter = new PinRateLimiter();
    this.sessionHistoryStore = sessionHistoryStore;
  }

  /**
   * Register all club player event handlers
   */
  public registerHandlers(socket: Socket): void {
    // Wire onClubSessionEnd callback to calculate cost, broadcast to the room,
    // and — when a SessionHistoryStore is injected — persist a SessionRecord
    // snapshot for the admin history tab. See `club-session-history` spec
    // ("Persistence Trigger" and "SessionRecord Schema" requirements):
    //   - The callback fires on BOTH endSession (player confirm=true) and
    //     forceEndSession (admin force-end). One hook covers both paths.
    //   - When no SessionHistoryStore is injected (PR 1 intermediate state,
    //     or a write-time failure inside append) the session end flow MUST
    //     still complete — the court still transitions to FINISHED and the
    //     broadcast still fires. Persistence is best-effort and never
    //     blocks session end.
    //   - When the club is not configured (clubConfigStore.load() returns
    //     null) no SessionRecord is created (spec: "history disabled without
    //     club config").
    this.tableManager.onClubSessionEnd = (courtId: string, elapsedMinutes: number, elapsedSeconds: number, reason: string) => {
      const clubConfig = this.clubConfigStore.load();
      const costPerMinute = clubConfig?.costPerMinute ?? 0;
      const currency = clubConfig?.currency ?? 'ARS';
      const cost = Math.ceil(elapsedMinutes * costPerMinute);

      // Spec: CLUB_SESSION_ENDED MUST include elapsedSeconds (server authoritative
      // timer) in addition to the existing elapsedMinutes/cost/currency/reason.
      this.io.to(courtId).emit(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId,
        elapsedMinutes,
        elapsedSeconds,
        cost,
        currency,
        reason,
      });

      // Persist a SessionRecord snapshot ONLY when both a SessionHistoryStore
      // is injected AND the club is configured. Non-configured clubs disable
      // history per spec ("Club Not Configured" requirement).
      if (!this.sessionHistoryStore || !clubConfig || !clubConfig.configured) {
        return;
      }

      // Capture the courtName + mode at session-end time as a SNAPSHOT. The
      // court has already transitioned to FINISHED in CourtManager.endSession
      // (which fires this callback), but the court object still carries its
      // name and sessionMode values at this point in the lifecycle.
      const court = this.tableManager.getCourt(courtId);
      const courtName = court?.name ?? '';
      const sessionMode: SessionMode | null =
        court && isClubCourt(court) ? court.sessionMode : null;
      const mode: SessionMode = sessionMode ?? SESSION_MODE.MATCH;

      // Spec: free-mode sessions always record cost=0, regardless of costPerMinute.
      const recordedCost = mode === SESSION_MODE.FREE ? 0 : cost;

      const record: SessionRecord = {
        courtName,
        elapsedSeconds,
        elapsedMinutes,
        mode,
        cost: recordedCost,
        currency,
        timestamp: new Date().toISOString(),
        sessionId: crypto.randomUUID(),
      };

      // append() logs errors and never throws — session end is not blocked
      // by persistence failure.
      this.sessionHistoryStore.append(record);
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
    socket.on(SocketEvents.CLIENT.CLUB_RECONNECT, (data: { courtId: string; pin: string }) => {
      // Validate payload with required PIN
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
        pin: { required: true, type: 'string', pattern: PIN_RULES.tablePin.pattern },
      }, 'CLUB_RECONNECT')) {
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

      // Validate PIN — timing-safe comparison (required, no bypass)
      if (!this.comparePin(data.pin, court.pin)) {
        this.pinRateLimiter.recordAttempt(socket.handshake.address);
        logger.warn({ courtId: court.id, ip: maskIp(socket.handshake.address) }, 'CLUB_RECONNECT: invalid PIN');
        socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
          success: false,
          error: 'INVALID_PIN',
        });
        return;
      }
      this.pinRateLimiter.reset(socket.handshake.address);

      // Register socket as referee
      const displacedSocketId = this.tableManager.registerClubReferee(court.id, socket.id);
      if (displacedSocketId) {
        this.io.to(displacedSocketId).emit(SocketEvents.SERVER.REF_REVOKED, { courtId: court.id, reason: 'replaced' });
      }

      // Join socket to court room for match updates
      socket.join(court.id);

      // Get current match state
      const matchState = this.tableManager.getMatchState(court.id);

      // Spec: CLUB_RECONNECT MUST return sessionMode and elapsedSeconds so the
      // client can render the correct mode (free vs match) and the running
      // timer on reconnect. sessionMode is sourced from the in-memory ClubCourt
      // — toPersistedClubCourt persists it (PR 2 fix), so this also covers
      // reconnect-after-restart once the StateStore reloads the court.
      const clubCourt = court as ClubCourt;
      const elapsedSeconds = clubCourt.occupiedAt
        ? Math.max(0, Math.floor((Date.now() - clubCourt.occupiedAt) / 1000))
        : 0;

      socket.emit(SocketEvents.SERVER.CLUB_RECONNECT_RESULT, {
        success: true,
        courtId: court.id,
        matchState,
        sessionMode: clubCourt.sessionMode,
        elapsedSeconds,
      });

      logger.info(
        { courtId: court.id, socketId: socket.id, sessionMode: clubCourt.sessionMode, elapsedSeconds },
        'CLUB_RECONNECT: bridge ownership re-established',
      );
    });

    // CLUB_END_SESSION: Player-initiated session end with confirmation flow
    //
    // Spec scenarios 4, 5, 6:
    //   - first emit WITHOUT confirm → server computes elapsedSeconds and
    //     emits CLUB_END_SESSION_CONFIRM to the requesting socket so the
    //     client renders the confirmation modal. Court STAYS OCCUPIED (timer
    //     runs). PR 3 event swap — previously reused CLUB_SESSION_TIMER, which
    //     conflated confirmation with periodic sync.
    //   - emit with confirm=true → server transitions to FINISHED and the
    //     onClubSessionEnd callback broadcasts CLUB_SESSION_ENDED with
    //     elapsedSeconds/elapsedMinutes.
    //   - cancel → client does not emit confirm; the court stays OCCUPIED
    //     and the timer keeps running server-side.
    socket.on(SocketEvents.CLIENT.CLUB_END_SESSION, (data: { courtId: string; confirm?: boolean }) => {
      if (!data || typeof data.courtId !== 'string' || !data.courtId.trim()) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'INVALID_PARAMS',
          message: 'Se requiere courtId',
        });
        return;
      }

      // Validate socket is referee for this court
      if (!this.validateReferee(socket, data.courtId)) return;

      // Validate court exists and is OCCUPIED (both for confirm and
      // confirmation-request paths). FINISHED courts return ERROR.
      const court = this.tableManager.getCourt(data.courtId);
      if (!court || !isClubCourt(court) || court.clubStatus !== CLUB_STATUS.OCCUPIED) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'SESSION_NOT_ACTIVE',
          message: 'La sesión no está activa',
        });
        return;
      }

      // Confirmation request — do NOT transition. Notify the requesting
      // socket with elapsedSeconds so the client can show the modal.
      if (data.confirm !== true) {
        const now = Date.now();
        const elapsedSeconds = court.occupiedAt
          ? Math.max(0, Math.floor((now - court.occupiedAt) / 1000))
          : 0;
        socket.emit(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM, {
          courtId: court.id,
          elapsedSeconds,
        });
        logger.info(
          { courtId: court.id, elapsedSeconds },
          'CLUB_END_SESSION: confirmation requested',
        );
        return;
      }

      // Confirmed end — transition FINISHED, fire onClubSessionEnd broadcast.
      const result = this.tableManager.endSession(data.courtId, 'player');
      if (!result) {
        socket.emit(SocketEvents.SERVER.ERROR, {
          code: 'END_SESSION_FAILED',
          message: 'No se pudo finalizar la sesión',
        });
        return;
      }

      logger.info(
        { courtId: data.courtId, elapsedMinutes: result.elapsedMinutes, elapsedSeconds: result.elapsedSeconds, reason: 'player' },
        'CLUB_END_SESSION: player ended session',
      );
    });

    // CLUB_START_FREE: Switch the OCCUPIED club court to "free" session mode.
    // Spec scenario 1 — emit CLUB_FREE_STARTED to the room and keep the court
    // OCCUPIED with the timer running.
    socket.on(SocketEvents.CLIENT.CLUB_START_FREE, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_START_FREE')) {
        return;
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const result = this.tableManager.startFreePlay(data.courtId);
      if (!result) {
        this.emitError(socket, 'START_FREE_FAILED', 'No se pudo iniciar modo libre. La cancha debe estar ocupada.');
        return;
      }

      this.io.to(data.courtId).emit(SocketEvents.SERVER.CLUB_FREE_STARTED, {
        courtId: data.courtId,
      });

      logger.info(
        { courtId: data.courtId, sessionMode: result.sessionMode },
        'CLUB_START_FREE: court entered free mode',
      );
    });

    // CLUB_RESET_MATCH: Reset the running match to 0-0 with the SAME config.
    // Spec post-match "Reset" action. Emits CLUB_MATCH_RESET with the fresh
    // zeroed matchState to the room.
    socket.on(SocketEvents.CLIENT.CLUB_RESET_MATCH, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_RESET_MATCH')) {
        return;
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const result = this.tableManager.resetMatch(data.courtId);
      if (!result) {
        this.emitError(socket, 'RESET_MATCH_FAILED', 'No se pudo reiniciar el partido. La cancha debe estar ocupada.');
        return;
      }

      this.io.to(data.courtId).emit(SocketEvents.SERVER.CLUB_MATCH_RESET, {
        courtId: data.courtId,
        matchState: result.matchState,
      });

      logger.info(
        { courtId: data.courtId },
        'CLUB_RESET_MATCH: match reset to 0-0',
      );
    });

    // CLUB_NEW_MATCH: Start a new match with new player names (optionally a
    // new matchConfig). Spec scenario 2 — transitions free→match and serves
    // the post-match "New Match" action. PR 1 risk fix #2 — passes the
    // optional matchConfig through to CourtManager.newMatch so the user can
    // pick non-default points/sets before starting.
    socket.on(SocketEvents.CLIENT.CLUB_NEW_MATCH, (data: {
      courtId: string;
      playerNameA: string;
      playerNameB: string;
      matchConfig?: Partial<MatchConfig>;
    }) => {
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
        playerNameA: { required: true, type: 'string', maxLength: 50 },
        playerNameB: { required: true, type: 'string', maxLength: 50 },
        matchConfig: { type: 'object', required: false },
      }, 'CLUB_NEW_MATCH')) {
        return;
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const result = this.tableManager.newMatch(data.courtId, {
        playerNameA: data.playerNameA,
        playerNameB: data.playerNameB,
        matchConfig: data.matchConfig,
      });
      if (!result) {
        this.emitError(socket, 'NEW_MATCH_FAILED', 'No se pudo iniciar el nuevo partido. La cancha debe estar ocupada.');
        return;
      }

      this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, result.matchState);

      logger.info(
        { courtId: data.courtId, playerNameA: data.playerNameA, playerNameB: data.playerNameB },
        'CLUB_NEW_MATCH: new match started',
      );
    });
  }
}
