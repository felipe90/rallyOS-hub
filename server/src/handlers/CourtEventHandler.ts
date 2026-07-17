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
import type { SocketData, CourtInfo } from '../domain/types';

export class CourtEventHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Override: COURT_LIST only includes tournament courts.
   * Club courts are emitted via CLUB_KIOSK_DATA instead.
   */
  protected getPublicCourtList(): CourtInfo[] {
    return this.tableManager.getAllTournamentCourts();
  }

  /**
   * Register all table event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CREATE_TABLE: Create a new table
    socket.on(SocketEvents.CLIENT.CREATE_COURT, (data?: { name?: string }) => {
      if (!this.validateAuthenticated(socket)) return;
      if (!validateSocketPayload(socket, data || {}, { name: { type: 'string', maxLength: 256, required: false } }, 'CREATE_COURT')) {
        return;
      }

      // Rate limit: max 10 tables per minute per IP
      const clientIp = socket.handshake.address;
      const rateLimitKey = `CREATE_TABLE:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('CREATE_COURT', 'global', clientIp);
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
      
      socket.emit(SocketEvents.SERVER.COURT_CREATED, this.tableManager.getCourtWithPin(court.id) ?? this.tableManager.courtToInfo(court));
      socket.emit(SocketEvents.SERVER.REF_SET, { courtId: court.id });

      const qrData = this.tableManager.generateQRData(court.id);
      if (qrData) {
        socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
      }

      socket.emit(SocketEvents.SERVER.MATCH_UPDATE, this.tableManager.getMatchState(court.id));
    });

    // LIST_TABLES: Get all public courts
    socket.on(SocketEvents.CLIENT.LIST_COURTS, () => {
      socket.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());
    });

    // GET_TABLES_WITH_PINS: Owner only
    socket.on(SocketEvents.CLIENT.GET_COURTS_WITH_PINS, (data?: { ownerPin?: string }) => {
      // When the socket is already authenticated as owner via JWT (reload
      // session restore), skip PIN validation — the owner PIN is not
      // persisted to storage for security (REQ-15).
      const isSocketOwner = (socket.data as SocketData)?.isOwner === true;

      if (!isSocketOwner) {
        if (!validateSocketPayload(socket, data || {}, { ownerPin: { required: false, type: 'string', pattern: PIN_RULES.ownerPin.pattern } }, 'GET_COURTS_WITH_PINS')) {
          return;
        }

        const isValidOwner = !!data?.ownerPin && this.comparePin(data.ownerPin, this.ownerPin);

        if (!isValidOwner) {
          logger.warn({ socketId: socket.id }, 'GET_TABLES_WITH_PINS rejected - not owner');
          return this.emitError(socket, 'NOT_OWNER', 'No autorizado');
        }
      }

      const courts = this.getCourtsWithPins();
      socket.emit(SocketEvents.SERVER.COURT_LIST_WITH_PINS, { courts });
    });

    // JOIN_TABLE: Join a table
    socket.on(SocketEvents.CLIENT.JOIN_COURT, (data: { courtId: string; name?: string; pin?: string; role?: string }) => {
      if (!validateSocketPayload(socket, data, { 
        courtId: { required: true, type: 'string', maxLength: 36 }, 
        name: { type: 'string', maxLength: 256, required: false }, 
        pin: { type: 'string', pattern: /^\d{4}$/, required: false } 
      }, 'JOIN_COURT')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const playerName = data.name || `Espectador ${socket.id.slice(0, 6)}`;
      const success = this.tableManager.joinTable(data.courtId, socket.id, playerName, data.pin);

      if (success) {
        socket.join(data.courtId);
        socket.emit(SocketEvents.SERVER.COURT_JOINED, { courtId: data.courtId });

        const courtInfo = this.tableManager.getAllCourts().find(c => c.id === data.courtId);
        if (courtInfo) {
          socket.emit(SocketEvents.SERVER.COURT_UPDATE, this.toPublicCourtInfo(courtInfo));
        }

        const state = this.tableManager.getMatchState(data.courtId);
        if (state) {
          socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        }
      } else {
        const court = this.tableManager.getAllCourts().find(c => c.id === data.courtId);
        if (court && data.pin) {
          this.emitError(socket, 'INVALID_PIN', 'PIN incorrecto');
        } else {
          this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
        }
      }
    });

    // LEAVE_TABLE: Leave a table
    socket.on(SocketEvents.CLIENT.LEAVE_COURT, (data: { courtId: string }) => {
      if (!validateSocketPayload(socket, data, { courtId: { required: true, type: 'string', maxLength: 36 } }, 'LEAVE_COURT')) {
        return;
      }

      if (!data?.courtId) return;
      
      socket.leave(data.courtId);
      
      const court = this.tableManager.getCourt(data.courtId);
      if (!court) return;
      
      const player = court.players.find(p => p.socketId === socket.id);
      if (player) {
        this.tableManager.leaveTable(data.courtId, socket.id);
        this.io.to(data.courtId).emit(SocketEvents.SERVER.PLAYER_LEFT, { courtId: data.courtId, socketId: socket.id });
      }
    });

    // DELETE_TABLE: Delete a table (owner only - no PIN needed)
    socket.on(SocketEvents.CLIENT.DELETE_COURT, (data: { courtId: string; pin?: string }) => {
      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
        pin: { required: false, type: 'string', pattern: /^\d{4}$/ }
      }, 'DELETE_COURT')) {
        return;
      }

      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const clientIp = socket.handshake.address;
      const rateLimitKey = `DELETE_TABLE:${data.courtId}:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('DELETE_COURT', data.courtId, clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
      }

      const court = this.tableManager.getCourt(data.courtId);
      if (!court) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      const isOwner = (socket.data as SocketData)?.isOwner === true;
      const isRef = this.tableManager.isReferee(data.courtId, socket.id);
      if (!isOwner && !isRef) {
        return this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      }

      // Kick current referee before deleting
      const refSocketId = this.tableManager.getRefereeSocketId(data.courtId);
      if (refSocketId) {
        this.io.to(refSocketId).emit(SocketEvents.SERVER.REF_REVOKED, {
          courtId: data.courtId,
          reason: 'Eliminada'
        });
        this.io.in(refSocketId).socketsLeave(data.courtId);
      }

      // Notify room and delete
        this.io.to(data.courtId).emit(SocketEvents.SERVER.COURT_DELETED, { courtId: data.courtId });
      this.io.in(data.courtId).socketsLeave(data.courtId);

      const success = this.tableManager.deleteCourt(data.courtId);

      if (success) {
        logger.info({ courtId: data.courtId, socketId: socket.id }, 'Court deleted successfully');
        this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());
      }
    });
  }
}
/** @deprecated Use CourtEventHandler instead */
export type TableEventHandler = CourtEventHandler;
/** @deprecated Use CourtEventHandler instead */
export const TableEventHandler = CourtEventHandler;