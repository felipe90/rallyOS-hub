/**
 * TableEventHandler - Handles table-related socket events
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
import { TableManager } from '../tableManager';
import { validateSocketPayload } from '../utils/validation';
import { logger } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { SocketHandlerBase } from './SocketHandlerBase';

export class TableEventHandler extends SocketHandlerBase {
  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    super(io, tableManager, ownerPin);
  }

  /**
   * Register all table event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CREATE_TABLE: Create a new table
    socket.on(SocketEvents.CLIENT.CREATE_TABLE, (data?: { name?: string }) => {
      if (!validateSocketPayload(socket, data || {}, { name: { type: 'string', maxLength: 256, required: false } }, 'CREATE_TABLE')) {
        return;
      }

      const table = this.tableManager.createTable(data?.name);
      socket.join(table.id);
      
      // POC UX: creator is trusted as initial referee
      this.tableManager.joinTable(table.id, socket.id, 'Referee');
      this.tableManager.setReferee(table.id, socket.id, table.pin);
      
      socket.emit(SocketEvents.SERVER.TABLE_CREATED, this.tableManager.tableToInfo(table));
      socket.emit(SocketEvents.SERVER.REF_SET, { tableId: table.id });

      const qrData = this.tableManager.generateQRData(table.id);
      if (qrData) {
        socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
      }

      socket.emit(SocketEvents.SERVER.MATCH_UPDATE, this.tableManager.getMatchState(table.id));
    });

    // LIST_TABLES: Get all public tables
    socket.on(SocketEvents.CLIENT.LIST_TABLES, () => {
      socket.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
    });

    // GET_TABLES_WITH_PINS: Owner only
    socket.on(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, (data?: { ownerPin?: string }) => {
      if (!validateSocketPayload(socket, data || {}, { ownerPin: { required: false, type: 'string', pattern: /^\d{8}$/ } }, 'GET_TABLES_WITH_PINS')) {
        return;
      }

      const isSocketOwner = (socket as any).data?.isOwner === true;
      const isValidOwner = data?.ownerPin === this.ownerPin;

      if (!isSocketOwner && !isValidOwner) {
        logger.warn({ socketId: socket.id }, 'GET_TABLES_WITH_PINS rejected - not owner');
        return this.emitError(socket, 'NOT_OWNER', 'No autorizado');
      }

      const tables = this.getTablesWithPins();
      socket.emit(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, { tables });
    });

    // JOIN_TABLE: Join a table
    socket.on(SocketEvents.CLIENT.JOIN_TABLE, (data: { tableId: string; name?: string; pin?: string; role?: string }) => {
      if (!validateSocketPayload(socket, data, { 
        tableId: { required: true, type: 'string', maxLength: 36 }, 
        name: { type: 'string', maxLength: 256, required: false }, 
        pin: { type: 'string', pattern: /^\d{4}$/, required: false } 
      }, 'JOIN_TABLE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const playerName = data.name || `Espectador ${socket.id.slice(0, 6)}`;
      const success = this.tableManager.joinTable(data.tableId, socket.id, playerName, data.pin);

      if (success) {
        socket.join(data.tableId);
        socket.emit(SocketEvents.SERVER.TABLE_JOINED, { tableId: data.tableId });

        const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
        if (tableInfo) {
          socket.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
        }

        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        }
      } else {
        const table = this.tableManager.getAllTables().find(t => t.id === data.tableId);
        if (table && data.pin) {
          this.emitError(socket, 'INVALID_PIN', 'PIN incorrecto');
        } else {
          this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
        }
      }
    });

    // LEAVE_TABLE: Leave a table
    socket.on(SocketEvents.CLIENT.LEAVE_TABLE, (data: { tableId: string }) => {
      if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'LEAVE_TABLE')) {
        return;
      }

      if (!data?.tableId) return;
      
      socket.leave(data.tableId);
      
      const table = this.tableManager.getTable(data.tableId);
      if (!table) return;
      
      const player = table.players.find(p => p.socketId === socket.id);
      if (player) {
        this.tableManager.leaveTable(data.tableId, socket.id);
        this.io.to(data.tableId).emit(SocketEvents.SERVER.PLAYER_LEFT, { tableId: data.tableId, socketId: socket.id });
      }
    });

    // DELETE_TABLE: Delete a table (owner only - no PIN needed)
    socket.on(SocketEvents.CLIENT.DELETE_TABLE, (data: { tableId: string; pin?: string }) => {
      if (!validateSocketPayload(socket, data, {
        tableId: { required: true, type: 'string', maxLength: 36 },
        pin: { required: false, type: 'string', pattern: /^\d{4}$/ }
      }, 'DELETE_TABLE')) {
        return;
      }

      if (!data?.tableId) {
        return this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      }

      const clientIp = socket.handshake.address;
      const rateLimitKey = `DELETE_TABLE:${data.tableId}:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('DELETE_TABLE', data.tableId, clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
      }

      const table = this.tableManager.getTable(data.tableId);
      if (!table) {
        return this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
      }

      const isOwner = (socket as any).data?.isOwner === true;
      const isRef = this.tableManager.isReferee(data.tableId, socket.id);
      if (!isOwner && !isRef) {
        return this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      }

      // Notify room and delete
      this.io.to(data.tableId).emit(SocketEvents.SERVER.TABLE_DELETED, { tableId: data.tableId });
      this.io.in(data.tableId).socketsLeave(data.tableId);

      const success = this.tableManager.deleteTable(data.tableId);

      if (success) {
        logger.info({ tableId: data.tableId, socketId: socket.id }, 'Table deleted successfully');
        this.io.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
      }
    });
  }
}