/**
 * CourtEventHandler - Handles court socket events
 *
 * Events handled:
 * - LIST_COURTS: Get all public courts (ACTIVE inventory — D11)
 * - GET_COURTS_WITH_PINS: Get courts with PINs (owner only)
 * - JOIN_COURT: Join a court as player or spectator
 * - LEAVE_COURT: Leave a court
 *
 * REMOVED (admin-court-inventory slice 5, breaking): CREATE_COURT /
 * DELETE_COURT — court existence is admin-only via the INVENTORY_* events
 * (ClubCourtHandler). The MAX_COURTS cap and per-IP create/delete
 * rate-limits are dropped, not moved (CE-4): a single trusted admin no
 * longer needs them. The tournament/owner can NEVER mutate existence.
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
   * D11 — the public court list is the ACTIVE inventory catalog (mode-agnostic),
   * enriched with availability. Delegates to CourtManager, which maps the
   * inventory records + runtime flows (falls back to the runtime list when no
   * inventory is wired — legacy test compat).
   */
  protected getPublicCourtList(): CourtInfo[] {
    return this.tableManager.getPublicCourtList();
  }

  /**
   * Register all court event handlers
   */
  public registerHandlers(socket: Socket): void {
    // LIST_COURTS: Get all public courts
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

    // LEAVE_COURT: Leave a court
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
  }
}
/** @deprecated Use CourtEventHandler instead */
export type TableEventHandler = CourtEventHandler;
/** @deprecated Use CourtEventHandler instead */
export const TableEventHandler = CourtEventHandler;