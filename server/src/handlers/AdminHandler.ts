/**
 * AdminHandler - Handles admin/owner-related socket events
 *
 * Events handled:
 * - REGENERATE_PIN: Regenerate table PIN and revoke previous referee (kill-switch)
 * - SEND_NOTIFICATION: Send typed notification to all kiosk clients
 * - REQUEST_TABLE_STATE: Get full table state (handled in MatchEventHandler)
 * - GET_RATE_LIMIT_STATUS: Get rate limit status for debugging
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { validateSocketPayload } from '../utils/validation';
import { logger, maskIp } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { sanitizeMessage } from '../../../shared/validation';
import { SocketHandlerBase } from './SocketHandlerBase';

export class AdminHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: CourtManager, ownerPin: string) {
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
        return this.emitError(socket, 'INVALID_PARAMS', 'courtId required');
      }

      const court = this.tableManager.getCourt(data.tableId);
      if (!court) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Cancha no encontrada');
      }

      // Verify the requester is the owner (timing-safe comparison)
      const isOwnerAuthorizing = !data.pin || this.comparePin(data.pin, this.ownerPin);

      if (!isOwnerAuthorizing && !this.comparePin(data.pin!, court.pin)) {
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
        logger.info({ courtId: data.tableId, oldRefereeId: oldRefereeSocketId }, 'Old referee disconnected from court');
      }

      // Send new QR to the owner who requested regeneration
      const qrData = this.tableManager.generateQRData(data.tableId);
      if (qrData) {
        socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
      }

      socket.emit(SocketEvents.SERVER.PIN_REGENERATED, { tableId: data.tableId, newPin });

      // NOTE: Don't emit TABLE_UPDATE here - client will fetch TABLE_LIST_WITH_PINS after PIN_REGENERATED
      // This avoids UI flicker from TABLE_UPDATE (no PIN) followed by TABLE_LIST_WITH_PINS (with PIN)

      logger.info({ courtId: data.tableId }, 'PIN regenerated for court');
    });

    // SEND_NOTIFICATION: Send typed notification to all kiosk clients
    socket.on(SocketEvents.CLIENT.SEND_NOTIFICATION, (data: {
      pin: string;
      type: 'info' | 'warning' | 'error' | 'important';
      message: string;
      duration: number;
    }) => this.handleSendNotification(socket, data));

    // GET_RATE_LIMIT_STATUS: Get rate limit status for debugging
    socket.on(SocketEvents.CLIENT.GET_RATE_LIMIT_STATUS, () => {
      const clientIp = socket.handshake.address;
      const status = this.rateLimiter.getEntriesForIp(clientIp);
      socket.emit(SocketEvents.SERVER.RATE_LIMIT_STATUS, status);
    });
  }

  /**
   * Handle SEND_NOTIFICATION: validate PIN, rate-limit, sanitize, broadcast.
   */
  private handleSendNotification(socket: Socket, data: {
    pin: string;
    type: 'info' | 'warning' | 'error' | 'important';
    message: string;
    duration: number;
  }): void {
    // Validate PIN (timing-safe comparison)
    if (!data?.pin || !this.comparePin(data.pin, this.ownerPin)) {
      return this.emitError(socket, 'UNAUTHORIZED', 'PIN inválido');
    }

    // Rate-limit per IP (5/min)
    const clientIp = socket.handshake.address;
    const rateLimitKey = `NOTIFICATION:${clientIp}`;
    if (this.isRateLimited(rateLimitKey)) {
      return this.emitError(socket, 'RATE_LIMITED', 'Demasiadas notificaciones. Esperá un minuto.');
    }

    // Sanitize HTML and truncate message
    const sanitizedMessage = sanitizeMessage(data.message || '');

    // Build payload with server-set timestamp
    const payload = {
      type: data.type,
      message: sanitizedMessage,
      duration: data.duration,
      timestamp: Date.now(),
    };

    // Broadcast to all connected clients
    this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, payload);

    logger.info({
      type: data.type,
      duration: data.duration,
      ip: maskIp(clientIp),
    }, 'Kiosk notification broadcast');
  }
}