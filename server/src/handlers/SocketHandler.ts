/**
 * SocketHandler - Orchestrator for all socket event handlers
 * 
 * Delegates events to specialized handlers:
 * - CourtEventHandler: CREATE_TABLE, LIST_TABLES, JOIN_TABLE, LEAVE_TABLE, DELETE_TABLE
 * - MatchEventHandler: GET_MATCH_STATE, CONFIGURE_MATCH, START_MATCH, RECORD_POINT, etc.
 * - AuthHandler: SET_REF, VERIFY_OWNER, REF_ROLE_CHECK
 * - AdminHandler: REGENERATE_PIN, GET_RATE_LIMIT_STATUS
 * - ClubAdminHandler: CLUB_VERIFY_ADMIN, CLUB_GET_CONFIG, CLUB_SETUP
 * - ClubCourtHandler: CLUB_CREATE_COURT, CLUB_ACTIVATE_COURT, CLUB_FORCE_END, CLUB_DELETE_COURT
 * - ClubPlayerHandler: CLUB_JOIN
 * - SpotlightHandler: SET_FEATURED, SUBSCRIBE_MATCH, UNSUBSCRIBE_MATCH
 * 
 * Maintains global listeners for table updates and match events.
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { AdminPinService } from '../services/security/AdminPinService';
import { TableInfo, HubConfig } from '../domain/types';
import { logger } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';
import { SocketEvents } from '../../../shared/events';
import { 
  CourtEventHandler, 
  MatchEventHandler, 
  AuthHandler, 
  AdminHandler,
  SpotlightHandler,
  ClubAdminHandler,
  ClubCourtHandler,
  ClubPlayerHandler,
} from './index';

export class SocketHandler {
  private io: Server;
  private tableManager: CourtManager;
  private ownerPin: string;
  private hubConfig: HubConfig;
  private connectionRateLimiter: RateLimiter;
  private clubConfigStore?: ClubConfigStore;
  
  // Handler instances
  private courtHandler: CourtEventHandler;
  private matchHandler: MatchEventHandler;
  private authHandler: AuthHandler;
  private adminHandler: AdminHandler;
  private spotlightHandler: SpotlightHandler;
  private clubAdminHandler: ClubAdminHandler;
  private clubCourtHandler: ClubCourtHandler;
  private clubPlayerHandler: ClubPlayerHandler;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    hubConfig: HubConfig,
    clubConfigStore?: ClubConfigStore,
  ) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.hubConfig = hubConfig;
    this.connectionRateLimiter = new RateLimiter(60_000, 20); // 20 connections per 60s per IP
    this.clubConfigStore = clubConfigStore;
    
    // Initialize services
    const adminPinService = new AdminPinService();
    
    // Initialize handlers
    this.courtHandler = new CourtEventHandler(io, tableManager, ownerPin);
    this.matchHandler = new MatchEventHandler(io, tableManager, ownerPin);
    this.authHandler = new AuthHandler(io, tableManager, ownerPin);
    this.adminHandler = new AdminHandler(io, tableManager, ownerPin);
    this.spotlightHandler = new SpotlightHandler(io, tableManager, ownerPin);
    this.clubAdminHandler = new ClubAdminHandler(io, tableManager, ownerPin, clubConfigStore!, adminPinService);
    this.clubCourtHandler = new ClubCourtHandler(io, tableManager, ownerPin);
    this.clubPlayerHandler = new ClubPlayerHandler(io, tableManager, ownerPin, clubConfigStore!);
    
    // Set up global court update listener once
      this.tableManager.onTableUpdate = (tableInfo) => {
      // TABLE_UPDATE goes only to clients in the court's room
      this.io.to(tableInfo.id).emit(SocketEvents.SERVER.COURT_UPDATE, tableInfo);
      // TABLE_LIST goes to ALL clients (global)
      this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      // CLUB_KIOSK_DATA goes to ALL clients — club-only court data for kiosk display
      const clubConfig = this.clubConfigStore?.load() ?? null;
      const kioskPayload = this.tableManager.getClubKioskPayload(clubConfig);
      this.io.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, kioskPayload);
    };

    // On tournament finish, broadcast empty table list to all clients
    this.tableManager.onTournamentFinish = () => {
      this.io.emit(SocketEvents.SERVER.COURT_LIST, []);
    };

    this.tableManager.onMatchEvent = (courtId, event) => {
      if (event.type === 'SET_WON') {
        this.io.to(courtId).emit(SocketEvents.SERVER.SET_WON, { courtId: courtId, ...event });
      } else if (event.type === 'MATCH_WON') {
        this.io.to(courtId).emit(SocketEvents.SERVER.MATCH_WON, { courtId: courtId, ...event });

        // Auto-clear featured when match ends on a featured court
        const court = this.tableManager.getCourt(courtId);
        if (court && court.featured) {
          court.featured = false;
          const updatedInfo = this.tableManager.courtToInfo(court);
          this.io.emit(SocketEvents.SERVER.COURT_UPDATE, updatedInfo);
          logger.info({ courtId }, 'Featured auto-cleared on match end');
        }

        // Auto-notify kiosk clients on match won (server-sourced, bypasses rate limit)
        const ms = this.tableManager.getMatchState(courtId);
        const names = ms?.playerNames ?? { a: 'Player A', b: 'Player B' };
        const winner = names[event.winner === 'A' ? 'a' : 'b'];
        this.io.emit(SocketEvents.SERVER.KIOSK_NOTIFICATION, {
          type: 'important',
          duration: 10,
          message: `¡Ganador: ${winner}!`,
          timestamp: Date.now(),
        });
      } else if (event.type === 'GAME_WON') {
        this.io.to(courtId).emit(SocketEvents.SERVER.GAME_WON, { courtId: courtId, ...event });
      } else if (event.type === 'DEUCE') {
        this.io.to(courtId).emit(SocketEvents.SERVER.DEUCE, { courtId: courtId, ...event });
      } else if (event.type === 'TIEBREAK_START') {
        this.io.to(courtId).emit(SocketEvents.SERVER.TIEBREAK_START, { courtId: courtId, ...event });
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

      // Send current courts to new client
      socket.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      // Send hub config to new client (WiFi QR credentials + domain)
      socket.emit(SocketEvents.SERVER.HUB_CONFIG, {
        ssid: this.hubConfig.ssid,
        ip: this.hubConfig.ip,
        port: this.hubConfig.port,
        wifiPassword: this.hubConfig.wifiPassword,
        domain: this.hubConfig.domain,
      });

      // Register all handler events
      this.courtHandler.registerHandlers(socket);
      this.matchHandler.registerHandlers(socket);
      this.authHandler.registerHandlers(socket);
      this.adminHandler.registerHandlers(socket);
      this.spotlightHandler.registerHandlers(socket);
      this.clubAdminHandler.registerHandlers(socket);
      this.clubCourtHandler.registerHandlers(socket);
      this.clubPlayerHandler.registerHandlers(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info({ socketId: socket.id, reason }, 'Client disconnected');
        logger.debug({ count: this.io.engine.clientsCount }, 'Connected clients after disconnect');

        // Clean up player from courts on disconnect
        const allCourts = this.tableManager.getAllCourts();
        for (const court of allCourts) {
          const c = this.tableManager.getCourt(court.id);
          if (c?.players.some(p => p.socketId === socket.id)) {
            this.tableManager.leaveTable(court.id, socket.id);
          }
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error({ socketId: socket.id, error }, 'Socket error');
      });
    });
  }
  
  public getCourtInfo(courtId: string) {
    return this.tableManager.getAllCourts().find(c => c.id === courtId);
  }

  private getPublicCourtList(): TableInfo[] {
    return this.tableManager.getAllCourts();
  }
}