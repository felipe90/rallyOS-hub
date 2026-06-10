/**
 * CourtEventHandler - Handles table-related socket events
 *
 * Events handled:
 * - CREATE_TABLE: Create a new table
 * - LIST_TABLES: Get all public tables
 * - GET_TABLES_WITH_PINS: Get tables with PINs (owner only)
 * - JOIN_TABLE: Join a table as player or spectator
 * - LEAVE_TABLE: Leave a table
 * - DELETE_TABLE: Delete a table (requires PIN)
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { PIN_RULES } from '../../../shared/validation';
import { SocketHandlerBase } from './SocketHandlerBase';
import type { SocketData } from '../domain/types';

export class CourtEventHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all table event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CREATE_TABLE: Create a new table
    socket.on(SocketEvents.CLIENT.CREATE_TABLE, (data?: { name?: string }) => {
      if (!this.validateAuthenticated(socket)) return;
      if (!validateSocketPayload(socket, data || {}, { name: { type: 'string', maxLength: 256, required: false } }, 'CREATE_TABLE')) {
        return;
      }

      // Rate limit: max 10 tables per minute per IP
      const clientIp = socket.handshake.address;
      const rateLimitKey = `CREATE_TABLE:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('CREATE_TABLE', 'global', clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many tables created. Please wait a minute.');
      }

      // Max court limit: prevent memory exhaustion
      const MAX_COURTS = parseInt(process.env.MAX_TABLES || '50', 10);
      const currentCourts = this.tableManager.getAllCourts().length;
      if (currentCourts >= MAX_COURTS) {
        return this.emitError(socket, 'MAX_TABLES_REACHED', `Maximum of ${MAX_COURTS} courts reached`);
      }

      const court = this.tableManager.createCourt(data?.name);
      socket.join(court.id);
      
      // POC UX: creator is trusted as initial referee
      this.tableManager.joinTable(court.id, socket.id, 'Referee');
      this.tableManager.setReferee(court.id, socket.id, court.pin);
      
      socket.emit(SocketEvents.SERVER.TABLE_CREATED, this.tableManager.getCourtWithPin(court.id) ?? this.tableManager.courtToInfo(court));
      socket.emit(SocketEvents.SERVER.REF_SET, { tableId: court.id });

      const qrData = this.tableManager.generateQRData(court.id);
      if (qrData) {
        socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
      }

      socket.emit(SocketEvents.SERVER.MATCH_UPDATE, this.tableManager.getMatchState(court.id));
    });

    // LIST_TABLES: Get all public courts
    socket.on(SocketEvents.CLIENT.LIST_TABLES, () => {
      socket.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicCourtList());
    });

    // GET_TABLES_WITH_PINS: Owner only
    socket.on(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, (data?: { ownerPin?: string }) => {
      if (!validateSocketPayload(socket, data || {}, { ownerPin: { required: false, type: 'string', pattern: PIN_RULES.ownerPin.pattern } }, 'GET_TABLES_WITH_PINS')) {
        return;
      }

      const isSocketOwner = (socket.data as SocketData)?.isOwner === true;
      const isValidOwner = !!data?.ownerPin && this.comparePin(data.ownerPin, this.ownerPin);

      if (!isSocketOwner && !isValidOwner) {
        logger.warn({ socketId: socket.id }, 'GET_TABLES_WITH_PINS rejected - not owner');
        return this.emitError(socket, 'NOT_OWNER', 'No autorizado');
      }

      const courts = this.getCourtsWithPins();
      socket.emit(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, { courts });
    });

    // JOIN_TABLE: Join a table
    socket.on(SocketEvents.CLIENT.JOIN_TABLE, (data: { tableId: string; name?: string; pin?: string; role?: string }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        name: { type: 'string', maxLength: 256, required: false }, 
        pin: { type: 'string', pattern: /^\d{4}$/, required: false } 
      }, 'JOIN_TABLE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const playerName = data.name || `Espectador ${socket.id.slice(0, 6)}`;
      const success = this.tableManager.joinTable(data.tableId, socket.id, playerName, data.pin);

      if (success) {
        socket.join(data.tableId);
        socket.emit(SocketEvents.SERVER.TABLE_JOINED, { tableId: data.tableId });

        const courtInfo = this.tableManager.getAllCourts().find(c => c.id === data.tableId);
        if (courtInfo) {
          socket.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicCourtInfo(courtInfo));
        }

        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        }
      } else {
        const court = this.tableManager.getAllCourts().find(c => c.id === data.tableId);
        if (court && data.pin) {
          this.emitError(socket, 'INVALID_PIN', 'PIN incorrecto');
        } else {
          this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
        }
      }
    });

    // LEAVE_TABLE: Leave a table
    socket.on(SocketEvents.CLIENT.LEAVE_TABLE, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'LEAVE_TABLE')) {
        return;
      }

      if (!data?.tableId) return;
      
      socket.leave(data.tableId);
      
      const court = this.tableManager.getCourt(data.tableId);
      if (!court) return;
      
      const player = court.players.find(p => p.socketId === socket.id);
      if (player) {
        this.tableManager.leaveTable(data.tableId, socket.id);
        this.io.to(data.tableId).emit(SocketEvents.SERVER.PLAYER_LEFT, { tableId: data.tableId, socketId: socket.id });
      }
    });

    // DELETE_TABLE: Delete a table (owner only - no PIN needed)
    socket.on(SocketEvents.CLIENT.DELETE_TABLE, (data: { tableId: string; pin?: string }) => {
      if (!validateSocketPayload(socket, data, {
        tableId: { required: true, type: 'string', maxLength: 36 },
        pin: { required: false, type: 'string', pattern: /^\d{4}$/ }
      }, 'DELETE_TABLE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const clientIp = socket.handshake.address;
      const rateLimitKey = `DELETE_TABLE:${data.tableId}:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('DELETE_TABLE', data.tableId, clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
      }

      const court = this.tableManager.getCourt(data.tableId);
      if (!court) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      const isOwner = (socket.data as SocketData)?.isOwner === true;
      const isRef = this.tableManager.isReferee(data.tableId, socket.id);
      if (!isOwner && !isRef) {
        return this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      }

      // Kick current referee before deleting
      const refSocketId = this.tableManager.getRefereeSocketId(data.tableId);
      if (refSocketId) {
        this.io.to(refSocketId).emit(SocketEvents.SERVER.REF_REVOKED, {
          tableId: data.tableId,
          reason: 'Eliminada'
        });
        this.io.in(refSocketId).socketsLeave(data.tableId);
      }

      // Notify room and delete
      this.io.to(data.tableId).emit(SocketEvents.SERVER.TABLE_DELETED, { tableId: data.tableId });
      this.io.in(data.tableId).socketsLeave(data.tableId);

      const success = this.tableManager.deleteCourt(data.tableId);

      if (success) {
        logger.info({ courtId: data.tableId, socketId: socket.id }, 'Court deleted successfully');
        this.io.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicCourtList());
      }
    });
  }
}
/** @deprecated Use CourtEventHandler instead */
export type TableEventHandler = CourtEventHandler;
/** @deprecated Use CourtEventHandler instead */
export const TableEventHandler = CourtEventHandler;