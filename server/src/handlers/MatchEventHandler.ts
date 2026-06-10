/**
 * MatchEventHandler - Handles match-related socket events
 *
 * Events handled:
 * - GET_MATCH_STATE: Get current match state for a table
 * - CONFIGURE_MATCH: Configure match settings (referee only)
 * - START_MATCH: Start a match (referee only)
 * - RECORD_POINT: Record a point (referee only)
 * - SUBTRACT_POINT: Subtract a point (referee only)
 * - UNDO_LAST: Undo last action (referee only)
 * - SET_SERVER: Set server (referee only)
 * - RESET_TABLE: Reset table (referee only)
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { validateSocketPayload, sanitizeInput } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';

import type { Player, MatchConfig } from '../domain/matchEngine';
import { SPORT } from '../../../shared/types';

export class MatchEventHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all match event handlers
   */
  public registerHandlers(socket: Socket): void {
    // GET_MATCH_STATE: Get current match state
    socket.on(SocketEvents.CLIENT.GET_MATCH_STATE, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'GET_MATCH_STATE')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      const state = this.tableManager.getMatchState(data.courtId);
      if (state) {
        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      } else {
        this.emitError(socket, 'TABLE_NOT_FOUND', 'Partido no encontrado');
      }
    });

    // CONFIGURE_MATCH: Configure match settings
    socket.on(SocketEvents.CLIENT.CONFIGURE_MATCH, (data: {
      courtId: string;
      playerNames?: { a: string; b: string };
      format?: number;
      ptsPerSet?: number;
      handicap?: { a: number; b: number };
      sport?: string;
      tiebreakPoints?: number;
      goldenPoint?: boolean;
    }) => {
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
        playerNames: { type: 'object', required: false },
        format: { type: 'number', required: false, min: 1, max: 9 },
        ptsPerSet: { type: 'number', required: false, min: 1, max: 99 },
        handicap: { type: 'object', required: false },
        sport: { type: 'string', required: false, enum: [SPORT.TABLE_TENNIS, SPORT.PADEL] },
        tiebreakPoints: { type: 'number', required: false, min: 7, max: 10 },
        goldenPoint: { type: 'boolean', required: false },
      }, 'CONFIGURE_MATCH')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      // Build MatchConfig union — defaults to table tennis for backward compat
      const sport = data.sport || SPORT.TABLE_TENNIS;
      const matchConfigPartial: Record<string, any> = { sport };

      if (sport === SPORT.PADEL) {
        // Padel-specific fields
        if (data.format) matchConfigPartial.bestOf = data.format;
        if (data.tiebreakPoints) matchConfigPartial.tiebreakPoints = data.tiebreakPoints;
        if (data.goldenPoint !== undefined) matchConfigPartial.goldenPoint = data.goldenPoint;
      } else {
        // Table tennis (legacy) fields
        if (data.format) matchConfigPartial.bestOf = data.format;
        if (data.ptsPerSet) matchConfigPartial.pointsPerSet = data.ptsPerSet;
        if (data.handicap) {
          matchConfigPartial.initialScore = { a: data.handicap.a, b: data.handicap.b };
        }
      }

      // Sanitize player names to prevent XSS and log injection
      const sanitizedNames = data.playerNames ? {
        a: sanitizeInput(data.playerNames.a, 50),
        b: sanitizeInput(data.playerNames.b, 50),
      } : undefined;

      this.tableManager.configureMatch(data.courtId, {
        playerNames: sanitizedNames,
        matchConfig: matchConfigPartial as MatchConfig
      });

      // Emit TABLE_UPDATE for dashboard
      const court = this.tableManager.getCourt(data.courtId);
      if (court) {
        const courtInfo = this.tableManager.courtToInfo(court);
        this.io.emit(SocketEvents.SERVER.COURT_UPDATE, this.toPublicCourtInfo(courtInfo));
      }

      const state = this.tableManager.getMatchState(data.courtId);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // START_MATCH: Start a match
    socket.on(SocketEvents.CLIENT.START_MATCH, (data: { 
      courtId: string;
      pointsPerSet?: number;
      bestOf?: number;
      handicapA?: number;
      handicapB?: number;
      playerNameA?: string;
      playerNameB?: string;
    }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'START_MATCH')) {
        return;
      }

      logger.info({ courtId: data.courtId }, 'START_MATCH received');

      if (!data?.courtId) {
        logger.warn('START_MATCH: courtId missing');
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      // Configure player names before starting (sanitized)
      if (data.playerNameA || data.playerNameB) {
        this.tableManager.configureMatch(data.courtId, {
          playerNames: { 
            a: sanitizeInput(data.playerNameA || 'Player A', 50), 
            b: sanitizeInput(data.playerNameB || 'Player B', 50) 
          }
        });
      }

      const state = this.tableManager.startMatch(data.courtId, data);

      logger.debug({ courtId: data.courtId, state }, 'START_MATCH: Result state');

      // Emit TABLE_UPDATE for dashboard
      const court = this.tableManager.getCourt(data.courtId);
      if (court) {
        const courtInfo = this.tableManager.courtToInfo(court);
        this.io.emit(SocketEvents.SERVER.COURT_UPDATE, this.toPublicCourtInfo(courtInfo));
      }

      if (state) {
        logger.debug({ courtId: data.courtId }, 'START_MATCH: Emitting MATCH_UPDATE to room');
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);

        // Auto-notify kiosk clients on match start (server-sourced, bypasses rate limit)
        const names = state.playerNames;
        const nameA = names?.a || 'Player A';
        const nameB = names?.b || 'Player B';
        this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, {
          type: 'info',
          duration: 10,
          message: `Partido iniciado: ${nameA} vs ${nameB}`,
          timestamp: Date.now(),
        });
      } else {
        logger.warn({ courtId: data.courtId }, 'START_MATCH: tableManager.startMatch returned null');
      }
    });

    // RECORD_POINT: Record a point
    socket.on(SocketEvents.CLIENT.RECORD_POINT, (data: { courtId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        courtId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'RECORD_POINT')) {
        return;
      }

      if (!data?.courtId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId and player required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const state = this.tableManager.recordPoint(data.courtId, data.player);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SUBTRACT_POINT: Subtract a point
    socket.on(SocketEvents.CLIENT.SUBTRACT_POINT, (data: { courtId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        courtId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'SUBTRACT_POINT')) {
        return;
      }

      if (!data?.courtId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId and player required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const state = this.tableManager.subtractPoint(data.courtId, data.player);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // UNDO_LAST: Undo last action
    socket.on(SocketEvents.CLIENT.UNDO_LAST, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'UNDO_LAST')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const state = this.tableManager.undoLast(data.courtId);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SET_SERVER: Set server
    socket.on(SocketEvents.CLIENT.SET_SERVER, (data: { courtId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        courtId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'SET_SERVER')) {
        return;
      }

      if (!data?.courtId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId and player required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const state = this.tableManager.setServer(data.courtId, data.player);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SWAP_SIDES: Manually swap player sides (referee only)
    socket.on(SocketEvents.CLIENT.SWAP_SIDES, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'SWAP_SIDES')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      const state = this.tableManager.swapSides(data.courtId);
      if (state) {
        this.io.to(data.courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // RESET_TABLE: Reset table
    socket.on(SocketEvents.CLIENT.RESET_COURT, (data: { courtId: string; config?: MatchConfig }) => {
      if (!validateSocketPayload(socket, data, { 
        courtId: { required: true, type: 'string', maxLength: 36 }, 
        config: { type: 'object', required: false } 
      }, 'RESET_COURT')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      if (!this.validateReferee(socket, data.courtId)) return;

      this.tableManager.resetTable(data.courtId, data.config);

      const court = this.tableManager.getCourt(data.courtId);
      if (court) {
        const courtInfo = this.tableManager.courtToInfo(court);
        this.io.to(data.courtId).emit(SocketEvents.SERVER.COURT_UPDATE, this.toPublicCourtInfo(courtInfo));
      }
    });

    // REQUEST_TABLE_STATE: Get table state (alias for GET_MATCH_STATE)
    socket.on(SocketEvents.CLIENT.REQUEST_COURT_STATE, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'REQUEST_COURT_STATE')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      const state = this.tableManager.getMatchState(data.courtId);
      if (state) {
        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      } else {
        this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }
    });

    // GET_ALL_HISTORY: Get aggregated history from all tables
    socket.on(SocketEvents.CLIENT.GET_ALL_HISTORY, () => {
      const allHistories = this.tableManager.getAllHistories();
      socket.emit(SocketEvents.SERVER.ALL_HISTORY, allHistories);
    });
  }
}