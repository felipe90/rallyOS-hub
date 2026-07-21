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
import { isClubCourt } from '../domain/types';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { COURT_MODE, SPORT, SESSION_MODE } from '../../../shared/types';
import type { SessionMode } from '../../../shared/types';
import { SocketHandlerBase } from './SocketHandlerBase';

export class ClubCourtHandler extends SocketHandlerBase {
  private clubConfigStore?: IClubConfigRepository;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    /**
     * Club config repository — required for the admin occupy flow
     * (CLUB_ADMIN_OCCUPY) to resolve the configured sport when building the
     * default match config for the freshly-occupied court. Optional so the
     * pre-Phase-3 wiring in `SocketHandler` (which constructs handlers in a
     * fixed order) can keep passing four positional args without breaking
     * older tests that instantiate with the legacy 3-arg shape.
     */
    clubConfigStore?: IClubConfigRepository,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
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

      // CLUB_KIOSK_DATA update is handled by onTableUpdate (notifyUpdate inside createClubCourt)

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
        id: activated.id,
        name: activated.name,
        status: isClubCourt(activated) ? activated.clubStatus : COURT_MODE.CLUB,
        mode: COURT_MODE.CLUB,
        pin: activated.pin,
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

      // Broadcast is handled automatically by onClubSessionEnd callback
      // (calculates cost, broadcasts CLUB_SESSION_ENDED to the room)

      logger.info({ courtId: data.courtId }, 'Club court session force-ended');
    });

    // CLUB_ADMIN_OCCUPY: Admin "Iniciar sesión" modal takes a RESERVED court
    // straight to OCCUPIED with player identity (name + AES-256-GCM encrypted
    // phone) and the chosen session mode. Spec: `admin-session-start` —
    //
    //   "Click activates the court (AVAILABLE → RESERVED, PIN generated).
    //    A modal SHALL appear with: player name, phone, mode. Submit SHALL
    //    occupy with timer (RESERVED → OCCUPIED). The kiosk SHALL show the
    //    player name. The PIN SHALL remain valid."
    //
    // player-identity (Phase 3 / U2 task 3.2):
    //   - adminId is sourced from `socket.data.adminId` — set at
    //     CLUB_VERIFY_ADMIN (Phase 2 task 2.3) or by JWT restore in
    //     `SocketHandler.applySessionClaims` (Phase 3 / U2 fix for U1
    //     review warning #2). Without adminId we refuse the occupy: an
    //     unattributed admin session would leave SessionRecord.adminId
    //     null even though the admin started it — breaking the spec's
    //     admin-traceability requirement.
    //   - The kiosk update (CLUB_KIOSK_DATA with playerName) is broadcast
    //     via CourtManager.notifyUpdate → SocketHandler.onTableUpdate; the
    //     handler itself therefore only needs to delegate.
    //   - The handler does NOT emit a dedicated CLUB_ADMIN_OCCUPY_RESULT
    //     event — U1 already finalized the socket-event dictionary without
    //     one, and the spec does not require it. The admin UI (U3) listens
    //     to COURT_UPDATE / CLUB_KIOSK_DATA to detect the transition. This
    //     is a design gap noted in the apply-progress return: a future U3
    //     task MAY add a result event if the UI needs immediate ack.
    socket.on(SocketEvents.CLIENT.CLUB_ADMIN_OCCUPY, (data: {
      courtId: string;
      playerName: string;
      phone: string;
      mode: SessionMode;
    }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
        playerName: { required: true, type: 'string', maxLength: 100 },
        phone: { required: true, type: 'string', maxLength: 512 },
        mode: { required: true, type: 'string', enum: [SESSION_MODE.FREE, SESSION_MODE.MATCH] },
      }, 'CLUB_ADMIN_OCCUPY')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      // adminId MUST be present — see header comment. JWT-restore gap was
      // fixed in `applySessionClaims` (Phase 3 / U2); refuse defensively
      // so a misconfigured caller cannot produce an unattributed session.
      const socketData = socket.data as { adminId?: unknown };
      if (typeof socketData?.adminId !== 'string' || socketData.adminId.length === 0) {
        return this.emitError(socket, 'UNAUTHORIZED', 'Admin identity required');
      }

      // Resolve sport from ClubConfig — required for the default match
      // config the occupy builds (punto/set/deuce/heighth defaults differ
      // per sport). Without a configured club we cannot occupy.
      const clubConfig = this.clubConfigStore?.load();
      if (!clubConfig || !clubConfig.configured) {
        return this.emitError(socket, 'CLUB_NOT_CONFIGURED', 'El club no está configurado');
      }
      const sport = clubConfig.sport === SPORT.PADEL ? SPORT.PADEL : SPORT.TABLE_TENNIS;

      const result = this.tableManager.adminOccupyCourt(data.courtId, {
        playerName: data.playerName,
        phone: data.phone,
        adminId: socketData.adminId,
        mode: data.mode,
        sport,
      });

      if (!result) {
        return this.emitError(
          socket,
          'OCCUPY_FAILED',
          'No se pudo ocupar la cancha. Debe estar en estado RESERVED.',
        );
      }

      // Note: CLUB_KIOSK_DATA (with playerName) is broadcast by
      // courtManager.notifyUpdate → SocketHandler.onTableUpdate. The PIN
      // remains valid — adminOccupyCourt never touches court.pin.
      logger.info(
        {
          courtId: data.courtId,
          adminId: socketData.adminId,
          mode: data.mode,
        },
        'Club court admin-occupied',
      );
    });

    // CLUB_DEACTIVATE_COURT: Deactivate a court (RESERVED → AVAILABLE)
    socket.on(SocketEvents.CLIENT.CLUB_DEACTIVATE_COURT, (data: { courtId: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_DEACTIVATE_COURT')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      const deactivated = this.tableManager.deactivateCourt(data.courtId);
      if (!deactivated) {
        return this.emitError(socket, 'DEACTIVATE_FAILED', 'No se pudo desactivar. La cancha debe estar en estado RESERVED.');
      }

      socket.emit(SocketEvents.SERVER.CLUB_COURT_DEACTIVATED, {
        courtId: deactivated.id,
        status: isClubCourt(deactivated) ? deactivated.clubStatus : COURT_MODE.CLUB,
      });

      logger.info({ courtId: data.courtId }, 'Club court deactivated');
    });

    // CLUB_RESET_COURT: Reset a finished court (FINISHED → AVAILABLE)
    socket.on(SocketEvents.CLIENT.CLUB_RESET_COURT, (data: { courtId: string }) => {
      if (!this.validateClubAdmin(socket)) return;

      if (!validateSocketPayload(socket, data, {
        courtId: { required: true, type: 'string', maxLength: 36 },
      }, 'CLUB_RESET_COURT')) {
        return;
      }

      if (!this.validateCourtExists(socket, data.courtId)) return;

      const reset = this.tableManager.resetCourt(data.courtId);
      if (!reset) {
        return this.emitError(socket, 'RESET_FAILED', 'No se pudo resetear. La cancha debe estar en estado FINISHED.');
      }

      socket.emit(SocketEvents.SERVER.CLUB_COURT_RESETTED, {
        courtId: reset.id,
        status: isClubCourt(reset) ? reset.clubStatus : COURT_MODE.CLUB,
      });

      logger.info({ courtId: data.courtId }, 'Club court reset to available');
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

      // Emit updated club kiosk data (deleteClubCourt does not call notifyUpdate)
      const kioskPayload = this.tableManager.getClubKioskPayload(null);
      this.io.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, kioskPayload);

      logger.info({ courtId: data.courtId }, 'Club court deleted by admin');
    });
  }
}
