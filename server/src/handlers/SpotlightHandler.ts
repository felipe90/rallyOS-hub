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
import { TableManager } from '../domain/courtManager';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';
import type { SocketData } from '../domain/types';

export class SpotlightHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
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

      // Clear all featured if targetTableId is null/undefined/empty
      if (!data?.targetTableId) {
        const allTables = this.tableManager.getAllTables();
        for (const t of allTables) {
          const court = this.tableManager.getTable(t.id);
          if (court && court.featured) {
            court.featured = false;
            const tableInfo = this.tableManager.tableToInfo(court);
            this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, tableInfo);
            logger.debug({ tableId: court.id }, 'Featured cleared via SET_FEATURED(null)');
          }
        }
        return;
      }

      // Validate target table exists
      const targetTable = this.tableManager.getTable(data.targetTableId);
      if (!targetTable) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      // Single-featured invariant: clear any previously featured court
      const allTables = this.tableManager.getAllTables();
      for (const t of allTables) {
        const court = this.tableManager.getTable(t.id);
        if (court && court.featured && court.id !== data.targetTableId) {
          court.featured = false;
          const tableInfo = this.tableManager.tableToInfo(court);
          this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, tableInfo);
          logger.debug({ tableId: court.id }, 'Previous featured court cleared');
        }
      }

      // Set new featured court
      targetTable.featured = true;
      const tableInfo = this.tableManager.tableToInfo(targetTable);
      this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, tableInfo);
      logger.info({ tableId: targetTable.id }, 'Court set as featured');
    });

    // SUBSCRIBE_MATCH: Subscribe to match updates for a featured court
    socket.on(SocketEvents.CLIENT.SUBSCRIBE_MATCH, (data: { courtId: string }) => {
      if (!data?.courtId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      const court = this.tableManager.getTable(data.courtId);
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
