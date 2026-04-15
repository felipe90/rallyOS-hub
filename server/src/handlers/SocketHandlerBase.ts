/**
 * SocketHandlerBase - Base class for all socket event handlers
 *
 * Contains shared logic: rate limiting, table info transformation, 
 * public table list generation, and common utilities.
 */

import { Server, Socket } from 'socket.io';
import { TableManager } from '../tableManager';
import { TableInfo } from '../types';
import { logger } from '../utils/logger';

export abstract class SocketHandlerBase {
  protected io: Server;
  protected tableManager: TableManager;
  protected ownerPin: string;
  
  protected readonly rateLimitWindowMs = 60_000;
  protected readonly rateLimitMaxAttempts = 5;
  protected rateLimitAttempts: Map<string, number[]> = new Map();

  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
  }

  /**
   * Convert table to public info (excludes PIN)
   */
  protected toPublicTableInfo(table: TableInfo): Omit<TableInfo, 'pin'> {
    const { pin: _pin, ...publicTable } = table;
    return publicTable;
  }

  /**
   * Get public table list (without PINs)
   */
  protected getPublicTableList(): Omit<TableInfo, 'pin'>[] {
    return this.tableManager.getAllTables().map((table) => this.toPublicTableInfo(table));
  }

  /**
   * Get tables with PINs (owner only)
   */
  protected getTablesWithPins(): TableInfo[] {
    return this.tableManager.getAllTablesWithPins();
  }

  /**
   * Check if socket is rate limited for given action
   */
  protected isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    const attempts = this.rateLimitAttempts.get(key) ?? [];
    const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
    recentAttempts.push(now);
    this.rateLimitAttempts.set(key, recentAttempts);
    return recentAttempts.length > this.rateLimitMaxAttempts;
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