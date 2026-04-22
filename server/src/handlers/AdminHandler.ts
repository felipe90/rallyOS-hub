/**
 * AdminHandler - Handles admin/owner-related socket events
 *
 * Events handled:
 * - REGENERATE_PIN: Regenerate table PIN and revoke previous referee (kill-switch)
 * - REQUEST_TABLE_STATE: Get full table state (handled in MatchEventHandler)
 * - GET_RATE_LIMIT_STATUS: Get rate limit status for debugging
 */

import { Server, Socket } from 'socket.io';
import { TableManager } from '../tableManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';

export class AdminHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all admin event handlers
   */
  public registerHandlers(socket: Socket): void {
    // REGENERATE_PIN: Regenerate table PIN and revoke previous referee (kill-switch)
    socket.on(SocketEvents.CLIENT.REGENERATE_PIN, (data: { tableId: string; pin?: string }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        pin: { required: false, type: 'string', pattern: /^\d{4,8}$/ } 
      }, 'REGENERATE_PIN')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const table = this.tableManager.getTable(data.tableId);
      if (!table) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
      }

      // Verify the requester is the owner
      const isOwnerAuthorizing = !data.pin || data.pin === this.ownerPin;

      if (!isOwnerAuthorizing && table.pin !== data.pin) {
        return this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      }

      // Get old referee before regenerating
      const oldRefereeSocketId = this.tableManager.getRefereeSocketId(data.tableId);

      // Regenerate PIN
      const newPin = this.tableManager.regeneratePin(data.tableId);
      if (!newPin) {
        return this.emitError(socket, 'PIN_REGEN_FAILED', 'Error al regenerar PIN');
      }

      // Emit REF_REVOKED to old referee if exists
      if (oldRefereeSocketId) {
        this.io.to(oldRefereeSocketId).emit(SocketEvents.SERVER.REF_REVOKED, {
          tableId: data.tableId,
          reason: 'Regenerado'
        });
        this.io.in(oldRefereeSocketId).socketsLeave(data.tableId);
        logger.info({ tableId: data.tableId, oldRefereeId: oldRefereeSocketId }, 'Old referee disconnected from table');
      }

      // Send new QR to the owner who requested regeneration
      const qrData = this.tableManager.generateQRData(data.tableId);
      if (qrData) {
        socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
      }

      socket.emit(SocketEvents.SERVER.PIN_REGENERATED, { tableId: data.tableId, newPin });

      // NOTE: Don't emit TABLE_UPDATE here - client will fetch TABLE_LIST_WITH_PINS after PIN_REGENERATED
      // This avoids UI flicker from TABLE_UPDATE (no PIN) followed by TABLE_LIST_WITH_PINS (with PIN)

      logger.info({ tableId: data.tableId }, 'PIN regenerated for table');
    });

    // GET_RATE_LIMIT_STATUS: Get rate limit status for debugging
    socket.on(SocketEvents.CLIENT.GET_RATE_LIMIT_STATUS, () => {
      const clientIp = socket.handshake.address;
      const status = this.rateLimiter.getEntriesForIp(clientIp);
      socket.emit(SocketEvents.SERVER.RATE_LIMIT_STATUS, status);
    });
  }
}