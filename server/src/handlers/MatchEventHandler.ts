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
import { TableManager } from '../domain/tableManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';

/**
 * Sanitize a string to prevent XSS and log injection.
 * Strips HTML tags and limits length.
 */
function sanitizeInput(value: string, maxLength: number = 100): string {
  return value
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .slice(0, maxLength);
}
import type { Player, MatchConfig } from '../domain/matchEngine';

export class MatchEventHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all match event handlers
   */
  public registerHandlers(socket: Socket): void {
    // GET_MATCH_STATE: Get current match state
    socket.on(SocketEvents.CLIENT.GET_MATCH_STATE, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'GET_MATCH_STATE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const state = this.tableManager.getMatchState(data.tableId);
      if (state) {
        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      } else {
        this.emitError(socket, 'TABLE_NOT_FOUND', 'Partido no encontrado');
      }
    });

    // CONFIGURE_MATCH: Configure match settings
    socket.on(SocketEvents.CLIENT.CONFIGURE_MATCH, (data: {
      tableId: string;
      playerNames?: { a: string; b: string };
      format?: number;
      ptsPerSet?: number;
      handicap?: { a: number; b: number }
    }) => {
      if (!validateSocketPayload(socket, data, {
        tableId: { required: true, type: 'string', maxLength: 36 },
        playerNames: { type: 'object', required: false },
        format: { type: 'number', required: false, min: 1, max: 9 },
        ptsPerSet: { type: 'number', required: false, min: 1, max: 99 },
        handicap: { type: 'object', required: false },
      }, 'CONFIGURE_MATCH')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const matchConfig: any = {};
      if (data.format) matchConfig.bestOf = data.format;
      if (data.ptsPerSet) matchConfig.pointsPerSet = data.ptsPerSet;
      if (data.handicap) {
        matchConfig.initialScore = { a: data.handicap.a, b: data.handicap.b };
      }

      // Sanitize player names to prevent XSS and log injection
      const sanitizedNames = data.playerNames ? {
        a: sanitizeInput(data.playerNames.a, 50),
        b: sanitizeInput(data.playerNames.b, 50),
      } : undefined;

      this.tableManager.configureMatch(data.tableId, {
        playerNames: sanitizedNames,
        matchConfig: matchConfig
      });

      // Emit TABLE_UPDATE for dashboard
      const table = this.tableManager.getTable(data.tableId);
      if (table) {
        const tableInfo = this.tableManager.tableToInfo(table);
        this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
      }

      const state = this.tableManager.getMatchState(data.tableId);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // START_MATCH: Start a match
    socket.on(SocketEvents.CLIENT.START_MATCH, (data: { 
      tableId: string;
      pointsPerSet?: number;
      bestOf?: number;
      handicapA?: number;
      handicapB?: number;
      playerNameA?: string;
      playerNameB?: string;
    }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'START_MATCH')) {
        return;
      }

      logger.info({ tableId: data.tableId }, 'START_MATCH received');

      if (!data?.tableId) {
        logger.warn('START_MATCH: tableId missing');
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      // Configure player names before starting (sanitized)
      if (data.playerNameA || data.playerNameB) {
        this.tableManager.configureMatch(data.tableId, {
          playerNames: { 
            a: sanitizeInput(data.playerNameA || 'Player A', 50), 
            b: sanitizeInput(data.playerNameB || 'Player B', 50) 
          }
        });
      }

      const state = this.tableManager.startMatch(data.tableId);

      logger.debug({ tableId: data.tableId, state }, 'START_MATCH: Result state');

      // Emit TABLE_UPDATE for dashboard
      const table = this.tableManager.getTable(data.tableId);
      if (table) {
        const tableInfo = this.tableManager.tableToInfo(table);
        this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
      }

      if (state) {
        logger.debug({ tableId: data.tableId }, 'START_MATCH: Emitting MATCH_UPDATE to room');
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      } else {
        logger.warn({ tableId: data.tableId }, 'START_MATCH: tableManager.startMatch returned null');
      }
    });

    // RECORD_POINT: Record a point
    socket.on(SocketEvents.CLIENT.RECORD_POINT, (data: { tableId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'RECORD_POINT')) {
        return;
      }

      if (!data?.tableId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId and player required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const state = this.tableManager.recordPoint(data.tableId, data.player);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SUBTRACT_POINT: Subtract a point
    socket.on(SocketEvents.CLIENT.SUBTRACT_POINT, (data: { tableId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'SUBTRACT_POINT')) {
        return;
      }

      if (!data?.tableId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId and player required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const state = this.tableManager.subtractPoint(data.tableId, data.player);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // UNDO_LAST: Undo last action
    socket.on(SocketEvents.CLIENT.UNDO_LAST, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'UNDO_LAST')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const state = this.tableManager.undoLast(data.tableId);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SET_SERVER: Set server
    socket.on(SocketEvents.CLIENT.SET_SERVER, (data: { tableId: string; player: Player }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        player: { required: true, type: 'string', enum: ['A', 'B'] } 
      }, 'SET_SERVER')) {
        return;
      }

      if (!data?.tableId || !data?.player) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId and player required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const state = this.tableManager.setServer(data.tableId, data.player);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // SWAP_SIDES: Manually swap player sides (referee only)
    socket.on(SocketEvents.CLIENT.SWAP_SIDES, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'SWAP_SIDES')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      const state = this.tableManager.swapSides(data.tableId);
      if (state) {
        this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }
    });

    // RESET_TABLE: Reset table
    socket.on(SocketEvents.CLIENT.RESET_TABLE, (data: { tableId: string; config?: MatchConfig }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        config: { type: 'object', required: false } 
      }, 'RESET_TABLE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      if (!this.validateReferee(socket, data.tableId)) return;

      this.tableManager.resetTable(data.tableId, data.config);

      const table = this.tableManager.getTable(data.tableId);
      if (table) {
        const tableInfo = this.tableManager.tableToInfo(table);
        this.io.to(data.tableId).emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
      }
    });

    // REQUEST_TABLE_STATE: Get table state (alias for GET_MATCH_STATE)
    socket.on(SocketEvents.CLIENT.REQUEST_TABLE_STATE, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'REQUEST_TABLE_STATE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const state = this.tableManager.getMatchState(data.tableId);
      if (state) {
        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      } else {
        this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
      }
    });
  }
}