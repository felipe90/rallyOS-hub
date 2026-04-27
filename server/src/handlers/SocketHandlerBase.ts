/**
 * SocketHandlerBase - Base class for all socket event handlers
 *
 * Contains shared logic: rate limiting, table info transformation,
 * public table list generation, and common utilities.
 */

import { Server, Socket } from 'socket.io';
import { TableManager } from '../domain/tableManager';
import { TableInfo, TableInfoWithPin } from '../domain/types';
import { logger } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';

export abstract class SocketHandlerBase {
  protected io: Server;
  protected tableManager: TableManager;
  protected ownerPin: string;
  protected rateLimiter: RateLimiter;

  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.rateLimiter = new RateLimiter();
    this.rateLimiter.startCleanup();
  }

  /**
   * Convert table to public info
   */
  protected toPublicTableInfo(table: TableInfo): TableInfo {
    return table;
  }

  /**
   * Get public table list
   */
  protected getPublicTableList(): TableInfo[] {
    return this.tableManager.getAllTables().map((table) => this.toPublicTableInfo(table));
  }

  /**
   * Get tables with PINs (owner only)
   */
  protected getTablesWithPins(): TableInfoWithPin[] {
    return this.tableManager.getAllTablesWithPins();
  }

  /**
   * Check if socket is rate limited for given action
   */
  protected isRateLimited(key: string): boolean {
    return this.rateLimiter.isRateLimited(key);
  }

  /**
   * Log rate limit warning
   */
  protected logRateLimitBlocked(action: string, tableId: string, clientIp: string): void {
    logger.warn({ action, tableId, ip: clientIp }, `${action} rate limit blocked`);
  }

  /**
   * Emit error to socket
   */
  protected emitError(socket: Socket, code: string, message: string): void {
    socket.emit('ERROR', { code, message });
  }

  /**
   * Check if user is owner (by PIN)
   */
  protected isOwner(pin?: string): boolean {
    return pin === this.ownerPin;
  }

  /**
   * Validate table ID exists and emit error if not
   */
  protected validateTableExists(socket: Socket, tableId: string | undefined): boolean {
    if (!tableId) {
      this.emitError(socket, 'INVALID_PARAMS', 'tableId required');
      return false;
    }
    const table = this.tableManager.getTable(tableId);
    if (!table) {
      this.emitError(socket, 'TABLE_NOT_FOUND', 'Mesa no encontrada');
      return false;
    }
    return true;
  }

  /**
   * Check if socket is authenticated and emit error if not
   */
  protected validateAuthenticated(socket: Socket): boolean {
    const socketData = socket.data as import('../domain/types').SocketData;
    if (!socketData.isAuthenticated) {
      this.emitError(socket, 'UNAUTHORIZED', 'Authentication required');
      return false;
    }
    return true;
  }

  /**
   * Check if socket is referee for table and emit error if not
   */
  protected validateReferee(socket: Socket, tableId: string): boolean {
    if (!this.tableManager.isReferee(tableId, socket.id)) {
      this.emitError(socket, 'UNAUTHORIZED', 'No autorizado');
      return false;
    }
    return true;
  }
}
