/**
 * ClubCourtHandler — Handles club court lifecycle events
 *
 * Events handled:
 * - CLUB_CREATE_COURT: Create a new club-mode court
 * - CLUB_ACTIVATE_COURT: Activate a club court (AVAILABLE → RESERVED + PIN)
 * - CLUB_FORCE_END: Force-end an active session (OCCUPIED → FINISHED)
 * - CLUB_DELETE_COURT: Delete a club court (only when AVAILABLE)
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';

export class ClubCourtHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all club court event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CLUB_CREATE_COURT: Create a new club-mode court
    socket.on(SocketEvents.CLIENT.CLUB_CREATE_COURT, (data?: { name?: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data || {}, {
        name: { type: 'string', maxLength: 100, required: false },
      }, 'CLUB_CREATE_COURT')) {
        return;
      }

      const court = this.tableManager.createClubCourt(data?.name);

      // Broadcast to all clients (not just the admin)
      this.io.emit(SocketEvents.SERVER.CLUB_COURT_CREATED, {
        id: court.id,
        name: court.name,
        status: court.clubStatus,
        mode: court.mode,
      });

      // Also update the global court list
      this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      logger.info({ courtId: court.id, courtName: court.name }, 'Club court created by admin');
    });

    // CLUB_ACTIVATE_COURT: Activate a club court
    socket.on(SocketEvents.CLIENT.CLUB_ACTIVATE_COURT, (data: { courtId: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_ACTIVATE_COURT')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      const activated = this.tableManager.activateCourt(data.courtId);
      if (!activated) {
        return this.emitError(socket, 'ACTIVATION_FAILED', 'No se pudo activar la cancha. Debe estar en estado AVAILABLE.');
      }

      socket.emit(SocketEvents.SERVER.CLUB_COURT_ACTIVATED, {
        courtId: activated.id,
        pin: activated.pin,
        status: activated.clubStatus,
      });

      logger.info({ courtId: data.courtId, pin: activated.pin }, 'Club court activated');
    });

    // CLUB_FORCE_END: Force-end an active session
    socket.on(SocketEvents.CLIENT.CLUB_FORCE_END, (data: { courtId: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_FORCE_END')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      const ended = this.tableManager.forceEndSession(data.courtId);
      if (!ended) {
        return this.emitError(socket, 'FORCE_END_FAILED', 'No se pudo finalizar la sesión. La cancha debe estar en estado OCCUPIED.');
      }

      socket.emit(SocketEvents.SERVER.CLUB_SESSION_ENDED, {
        courtId: ended.id,
        status: ended.clubStatus,
        reason: 'force',
      });

      logger.info({ courtId: data.courtId }, 'Club court session force-ended');
    });

    // CLUB_DELETE_COURT: Delete a club court (only when AVAILABLE)
    socket.on(SocketEvents.CLIENT.CLUB_DELETE_COURT, (data: { courtId: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_DELETE_COURT')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      const deleted = this.tableManager.deleteClubCourt(data.courtId);
      if (!deleted) {
        return this.emitError(socket, 'DELETE_FAILED', 'No se pudo eliminar. La cancha debe estar en estado AVAILABLE.');
      }

      // Broadcast deletion
      this.io.emit(SocketEvents.SERVER.COURT_DELETED, { courtId: data.courtId });

      // Update global court list
      this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      logger.info({ courtId: data.courtId }, 'Club court deleted by admin');
    });
  }
}
