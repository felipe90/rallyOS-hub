/**
 * SocketHandler - Orchestrator for all socket event handlers
 * 
 * Delegates events to specialized handlers:
 * - TableEventHandler: CREATE_TABLE, LIST_TABLES, JOIN_TABLE, LEAVE_TABLE, DELETE_TABLE
 * - MatchEventHandler: GET_MATCH_STATE, CONFIGURE_MATCH, START_MATCH, RECORD_POINT, etc.
 * - AuthHandler: SET_REF, VERIFY_OWNER, REF_ROLE_CHECK
 * - AdminHandler: REGENERATE_PIN, GET_RATE_LIMIT_STATUS
 * 
 * Maintains global listeners for table updates and match events.
 */

import { Server, Socket } from 'socket.io';
import { TableManager } from '../domain/courtManager';
import { TableInfo, HubConfig } from '../domain/types';
import { logger } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';
import { SocketEvents } from '../../../shared/events';
import { 
  TableEventHandler, 
  MatchEventHandler, 
  AuthHandler, 
  AdminHandler 
} from './index';

export class SocketHandler {
  private io: Server;
  private tableManager: TableManager;
  private ownerPin: string;
  private hubConfig: HubConfig;
  private connectionRateLimiter: RateLimiter;
  
  // Handler instances
  private tableHandler: TableEventHandler;
  private matchHandler: MatchEventHandler;
  private authHandler: AuthHandler;
  private adminHandler: AdminHandler;

  constructor(io: Server, tableManager: TableManager, ownerPin: string, hubConfig: HubConfig) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.hubConfig = hubConfig;
    this.connectionRateLimiter = new RateLimiter(60_000, 20); // 20 connections per 60s per IP
    
    // Initialize handlers
    this.tableHandler = new TableEventHandler(io, tableManager, ownerPin);
    this.matchHandler = new MatchEventHandler(io, tableManager, ownerPin);
    this.authHandler = new AuthHandler(io, tableManager, ownerPin);
    this.adminHandler = new AdminHandler(io, tableManager, ownerPin);
    
    // Set up global table update listener once
    this.tableManager.onTableUpdate = (tableInfo) => {
      // TABLE_UPDATE goes only to clients in the table's room
      this.io.to(tableInfo.id).emit(SocketEvents.SERVER.TABLE_UPDATE, tableInfo);
      // TABLE_LIST goes to ALL clients (global)
      this.io.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
    };

    // On tournament finish, broadcast empty table list to all clients
    this.tableManager.onTournamentFinish = () => {
      this.io.emit(SocketEvents.SERVER.TABLE_LIST, []);
    };

    this.tableManager.onMatchEvent = (tableId, event) => {
      if (event.type === 'SET_WON') {
        this.io.to(tableId).emit(SocketEvents.SERVER.SET_WON, { tableId, ...event });
      } else if (event.type === 'MATCH_WON') {
        this.io.to(tableId).emit(SocketEvents.SERVER.MATCH_WON, { tableId, ...event });

        // Auto-notify kiosk clients on match won (server-sourced, bypasses rate limit)
        const ms = this.tableManager.getMatchState(tableId);
        const names = ms?.playerNames ?? { a: 'Player A', b: 'Player B' };
        const winner = names[event.winner === 'A' ? 'a' : 'b'];
        this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, {
          type: 'important',
          duration: 10,
          message: `¡Ganador: ${winner}!`,
          timestamp: Date.now(),
        });
      } else if (event.type === 'GAME_WON') {
        this.io.to(tableId).emit(SocketEvents.SERVER.GAME_WON, { tableId, ...event });
      } else if (event.type === 'DEUCE') {
        this.io.to(tableId).emit(SocketEvents.SERVER.DEUCE, { tableId, ...event });
      } else if (event.type === 'TIEBREAK_START') {
        this.io.to(tableId).emit(SocketEvents.SERVER.TIEBREAK_START, { tableId, ...event });
      }
    };
    
    this.setupListeners();
  }

  private setupListeners() {
    // Connection rate limiting — max 20 connections per IP per 60s
    this.io.use((socket, next) => {
      const clientIp = socket.handshake.address;
      const rateLimitKey = `CONNECTION:${clientIp}`;
      if (this.connectionRateLimiter.isRateLimited(rateLimitKey)) {
        logger.warn({ ip: clientIp }, 'Connection rate limit exceeded');
        return next(new Error('RATE_LIMITED: Too many connections. Please wait.'));
      }
      next();
    });

    // Socket.io auth middleware — validate session token on connection
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.sessionToken as string | undefined;
      if (token) {
        // Token present — mark as authenticated
        // Full JWT validation can be added later
        (socket.data as import('../domain/types').SocketData).isAuthenticated = true;
        (socket.data as import('../domain/types').SocketData).sessionToken = token;
      }
      next();
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info({ socketId: socket.id }, 'Client connected');
      logger.debug({ socketId: socket.id, count: this.io.engine.clientsCount }, 'Connected clients');

      // Send current tables to new client
      socket.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());

      // Send hub config to new client (WiFi QR credentials + domain)
      socket.emit(SocketEvents.SERVER.HUB_CONFIG, {
        ssid: this.hubConfig.ssid,
        ip: this.hubConfig.ip,
        port: this.hubConfig.port,
        wifiPassword: this.hubConfig.wifiPassword,
        domain: this.hubConfig.domain,
      });

      // Register all handler events
      this.tableHandler.registerHandlers(socket);
      this.matchHandler.registerHandlers(socket);
      this.authHandler.registerHandlers(socket);
      this.adminHandler.registerHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info({ socketId: socket.id, reason }, 'Client disconnected');
        logger.debug({ count: this.io.engine.clientsCount }, 'Connected clients after disconnect');

        // Clean up player from tables on disconnect
        const allTables = this.tableManager.getAllTables();
        for (const table of allTables) {
          const t = this.tableManager.getTable(table.id);
          if (t?.players.some(p => p.socketId === socket.id)) {
            this.tableManager.leaveTable(table.id, socket.id);
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error({ socketId: socket.id, error }, 'Socket error');
      });
    });
  }
  
  public getTableInfo(tableId: string) {
    return this.tableManager.getAllTables().find(t => t.id === tableId);
  }

  private getPublicTableList(): TableInfo[] {
    return this.tableManager.getAllTables();
  }
}