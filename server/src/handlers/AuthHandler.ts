/**
 * AuthHandler - Handles authentication-related socket events
 *
 * Events handled:
 * - SET_REF: Set referee role for a table (requires PIN)
 * - VERIFY_OWNER: Verify tournament owner PIN
 */

import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { TableManager } from '../domain/tableManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { PIN_RULES } from '../../../shared/validation';
import { SocketHandlerBase } from './SocketHandlerBase';
import type { SocketData } from '../domain/types';

export class AuthHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Constant-time PIN comparison to prevent timing attacks.
   */
  private comparePin(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Register all auth event handlers
   */
  public registerHandlers(socket: Socket): void {
    // SET_REF: Set referee role for a table
    socket.on(SocketEvents.CLIENT.SET_REF, (data: { tableId: string; pin: string }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        pin: { required: true, type: 'string', pattern: PIN_RULES.tablePin.pattern } 
      }, 'SET_REF')) {
        return;
      }

      if (!data?.tableId || !data?.pin) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId and pin required');
      }

      const clientIp = socket.handshake.address;
      const rateLimitKey = `SET_REF:${data.tableId}:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('SET_REF', data.tableId, clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
      }
      
      const isOwnerPin = this.comparePin(data.pin, this.ownerPin);
      
      let success = false;
      
      if (isOwnerPin) {
        // Owner PIN can take control regardless of existing referee
        success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
        
        if (!success) {
          const table = this.tableManager.getTable(data.tableId);
          if (table) {
            const existingRef = table.players.find(p => p.role === 'REFEREE');
            if (existingRef) {
              logger.info({ tableId: data.tableId, oldRefereeId: existingRef.socketId }, 'Owner taking control, removing old referee');
              table.players = table.players.filter(p => p.role !== 'REFEREE');
            }
          }
          success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
        }
      } else {
        success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
      }
      
      if (success) {
        socket.join(data.tableId);
        socket.emit(SocketEvents.SERVER.REF_SET, { tableId: data.tableId });

        const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
        if (tableInfo) {
          this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
        }
      } else {
        const table = this.tableManager.getTable(data.tableId);
        if (table) {
          const existingRef = table.players.find(p => p.role === 'REFEREE');
          if (existingRef && existingRef.socketId !== socket.id) {
            return this.emitError(socket, 'REF_ALREADY_ACTIVE', 'Ya hay un árbitro activo en esta mesa');
          }
        }
        this.emitError(socket, 'INVALID_PIN', 'PIN incorrecto');
      }
    });

    // VERIFY_OWNER: Verify tournament owner PIN
    socket.on(SocketEvents.CLIENT.VERIFY_OWNER, (data: { pin: string }) => {
      if (!validateSocketPayload(socket, data, { pin: { required: true, type: 'string', pattern: PIN_RULES.ownerPin.pattern } }, 'VERIFY_OWNER')) {
        return;
      }

      const clientIp = socket.handshake.address;
      const rateLimitKey = `VERIFY_OWNER:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('VERIFY_OWNER', 'owner-verify', clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
      }

      logger.info({ socketId: socket.id }, 'VERIFY_OWNER received');

      if (this.comparePin(data.pin, this.ownerPin)) {
        const socketData = socket.data as SocketData;
        socket.data = { ...socketData, isOwner: true };
        socket.emit(SocketEvents.SERVER.OWNER_VERIFIED, { token: 'owner-session' });
        logger.info({ socketId: socket.id }, 'Owner verified successfully');
      } else {
        this.emitError(socket, 'INVALID_OWNER_PIN', 'PIN de organizador incorrecto');
        logger.warn({ socketId: socket.id }, 'Owner verification failed');
      }
    });

    // REF_ROLE_CHECK: Verify if socket is referee for a table
    socket.on(SocketEvents.CLIENT.REF_ROLE_CHECK, (data: { tableId: string }) => {
      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const isReferee = this.tableManager.isReferee(data.tableId, socket.id);
      socket.emit(SocketEvents.SERVER.REF_ROLE_CHECK_RESULT, { tableId: data.tableId, isReferee });
    });
  }
}