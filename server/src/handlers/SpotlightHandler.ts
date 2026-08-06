/**
 * SpotlightHandler - Handles kiosk spotlight/featured court events
 *
 * Events handled:
 * - SET_FEATURED: Set or clear the featured court (owner only)
 * - SUBSCRIBE_MATCH: Subscribe to match updates for a featured court
 * - UNSUBSCRIBE_MATCH: Unsubscribe from match updates for a court
 *
 * The spotlight system allows a single court to be "featured" on the kiosk,
 * showing detailed match information. Only one court can be featured at a time.
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { isClubFlowCourt } from '../domain/types';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';
import type { SocketData } from '../domain/types';

export class SpotlightHandler extends SocketHandlerBase {
  private clubConfigStore?: IClubConfigRepository;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    /**
     * Club config repository — required for the club-featured flow to
     * build a fresh `ClubKioskPayload` (which carries the configured
     * `clubName`) after a club admin toggles `featured` on a club court.
     * Optional so the legacy 3-arg wiring in `SocketHandler` and existing
     * tests that instantiate `new SpotlightHandler(io, tm, pin)` keep
     * working — when omitted the re-broadcast still emits, only the
     * `clubName` falls back to the courtManager default.
     */
    clubConfigStore?: IClubConfigRepository,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
  }

  /**
   * After featuring (or un-featuring) a club court, broadcast the updated
   * `CLUB_KIOSK_DATA` payload so every club admin client reconciles the
   * starred-court state via `useClubCourtManagement.handleKioskData`.
   *
   * No-op for tournament courts — the tournament kiosk reads featured
   * via the ambient `COURT_UPDATE` stream, not `CLUB_KIOSK_DATA`.
   */
  private broadcastClubKioskData(court: { mode?: string }): void {
    if (court.mode !== 'club') return;
    const clubConfig = this.clubConfigStore?.load() ?? null;
    const payload = this.tableManager.getClubKioskPayload(clubConfig);
    this.io.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, payload);
    logger.debug({ courtId: (court as any).id }, 'CLUB_KIOSK_DATA re-broadcast after featured toggle');
  }

  /**
   * Register all spotlight event handlers
   */
  public registerHandlers(socket: Socket): void {
    // SET_FEATURED: Owner or club admin — set or clear the featured court
    socket.on(SocketEvents.CLIENT.SET_FEATURED, (data: { targetCourtId?: string | null }) => {
      const socketData = socket.data as SocketData;
      if (!socketData.isOwner && !socketData.isClubAdmin) {
        return this.emitError(socket, 'UNAUTHORIZED', 'Solo el organizador o admin del club puede destacar una cancha');
      }

      // Clear all featured if targetCourtId is null/undefined/empty
      if (!data?.targetCourtId) {
        const allCourts = this.tableManager.getAllCourts();
        for (const t of allCourts) {
          const court = this.tableManager.getCourt(t.id);
          if (court && court.featured) {
            court.featured = false;
            const courtInfo = this.tableManager.courtToInfo(court);
            // Do not broadcast COURT_UPDATE for club courts — they use CLUB_KIOSK_DATA.
            if (!isClubFlowCourt(court)) {
              this.io.emit(SocketEvents.SERVER.COURT_UPDATE, courtInfo);
            }
            logger.debug({ courtId: court.id }, 'Featured cleared via SET_FEATURED(null)');
            this.broadcastClubKioskData(court);
          }
        }
        return;
      }

      // Validate target court exists
      const targetCourt = this.tableManager.getCourt(data.targetCourtId);
      if (!targetCourt) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      // Single-featured invariant: clear any previously featured court
      const allCourts = this.tableManager.getAllCourts();
      for (const t of allCourts) {
        const court = this.tableManager.getCourt(t.id);
          if (court && court.featured && court.id !== data.targetCourtId) {
            court.featured = false;
            const courtInfo = this.tableManager.courtToInfo(court);
            // Do not broadcast COURT_UPDATE for club courts — they use CLUB_KIOSK_DATA.
            if (!isClubFlowCourt(court)) {
              this.io.emit(SocketEvents.SERVER.COURT_UPDATE, courtInfo);
            }
            logger.debug({ courtId: court.id }, 'Previous featured court cleared');
          }
      }

      // Set new featured court
      targetCourt.featured = true;
      const courtInfo = this.tableManager.courtToInfo(targetCourt);
      // Do not broadcast COURT_UPDATE for club courts — they use CLUB_KIOSK_DATA.
      if (!isClubFlowCourt(targetCourt)) {
        this.io.emit(SocketEvents.SERVER.COURT_UPDATE, courtInfo);
      }
      logger.info({ courtId: targetCourt.id }, 'Court set as featured');
      this.broadcastClubKioskData(targetCourt);
    });

    // SUBSCRIBE_MATCH: Subscribe to match updates for a featured court
    socket.on(SocketEvents.CLIENT.SUBSCRIBE_MATCH, (data: { courtId: string }) => {
      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      const court = this.tableManager.getCourt(data.courtId);
      if (!court) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      if (!court.featured) {
        return this.emitError(socket, 'FORBIDDEN', 'La cancha no está destacada');
      }

      socket.join(data.courtId);

      // Send current match state immediately
      const state = this.tableManager.getMatchState(data.courtId);
      if (state) {
        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
      }

      logger.debug({ socketId: socket.id, courtId: data.courtId }, 'Subscribed to match updates');
    });

    // UNSUBSCRIBE_MATCH: Unsubscribe from match updates
    socket.on(SocketEvents.CLIENT.UNSUBSCRIBE_MATCH, (data: { courtId: string }) => {
      if (!data?.courtId) {
        return;
      }

      socket.leave(data.courtId);
      logger.debug({ socketId: socket.id, courtId: data.courtId }, 'Unsubscribed from match updates');
    });
  }
}
