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
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';
import type { SocketData } from '../domain/types';

export class SpotlightHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all spotlight event handlers
   */
  public registerHandlers(socket: Socket): void {
    // SET_FEATURED: Owner-only — set or clear the featured court
    socket.on(SocketEvents.CLIENT.SET_FEATURED, (data: { targetTableId?: string | null }) => {
      const socketData = socket.data as SocketData;
      if (!socketData.isOwner) {
        return this.emitError(socket, 'UNAUTHORIZED', 'Solo el organizador puede destacar una cancha');
      }

      // Clear all featured if targetCourtId is null/undefined/empty
      if (!data?.targetTableId) {
        const allCourts = this.tableManager.getAllCourts();
        for (const t of allCourts) {
          const court = this.tableManager.getCourt(t.id);
          if (court && court.featured) {
            court.featured = false;
            const courtInfo = this.tableManager.courtToInfo(court);
            this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, courtInfo);
            logger.debug({ courtId: court.id }, 'Featured cleared via SET_FEATURED(null)');
          }
        }
        return;
      }

      // Validate target court exists
      const targetCourt = this.tableManager.getCourt(data.targetTableId);
      if (!targetCourt) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      // Single-featured invariant: clear any previously featured court
      const allCourts = this.tableManager.getAllCourts();
      for (const t of allCourts) {
        const court = this.tableManager.getCourt(t.id);
        if (court && court.featured && court.id !== data.targetTableId) {
          court.featured = false;
          const courtInfo = this.tableManager.courtToInfo(court);
          this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, courtInfo);
          logger.debug({ courtId: court.id }, 'Previous featured court cleared');
        }
      }

      // Set new featured court
      targetCourt.featured = true;
      const courtInfo = this.tableManager.courtToInfo(targetCourt);
      this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, courtInfo);
      logger.info({ courtId: targetCourt.id }, 'Court set as featured');
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
