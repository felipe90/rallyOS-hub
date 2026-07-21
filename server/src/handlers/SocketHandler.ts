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
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { AdminPinService } from '../services/security/AdminPinService';
import { SessionTokenService } from '../services/security/SessionTokenService';
import type { SessionClaims } from '../services/security/SessionTokenService';
import { CourtInfo, HubConfig, isClubCourt } from '../domain/types';
import type { SocketData } from '../domain/types';
import { logger } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';
import { SocketEvents } from '../../../shared/events';
import { COURT_MODE } from '../../../shared/types';
import {
  CourtEventHandler,
  MatchEventHandler,
  AuthHandler,
  AdminHandler,
  SpotlightHandler,
  ClubAdminHandler,
  ClubCourtHandler,
  ClubPlayerHandler,
  ClubSessionHistoryHandler,
} from './index';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';

export class SocketHandler {
  private io: Server;
  private tableManager: CourtManager;
  private ownerPin: string;
  private hubConfig: HubConfig;
  private connectionRateLimiter: RateLimiter;
  private clubConfigStore?: IClubConfigRepository;
  
  // Handler instances
  private courtHandler: CourtEventHandler;
  private matchHandler: MatchEventHandler;
  private authHandler: AuthHandler;
  private adminHandler: AdminHandler;
  private spotlightHandler: SpotlightHandler;
  private clubAdminHandler: ClubAdminHandler;
  private clubCourtHandler: ClubCourtHandler;
  private clubPlayerHandler: ClubPlayerHandler;
  private clubHistoryHandler?: ClubSessionHistoryHandler;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    hubConfig: HubConfig,
    clubConfigStore?: IClubConfigRepository,
    sessionHistoryStore?: SessionHistoryStore,
  ) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.hubConfig = hubConfig;
    this.connectionRateLimiter = new RateLimiter(60_000, 20); // 20 connections per 60s per IP
    this.clubConfigStore = clubConfigStore;
    
    // Initialize services
    const adminPinService = new AdminPinService();
    const sessionTokenService = new SessionTokenService();

    // Initialize handlers
    this.courtHandler = new CourtEventHandler(io, tableManager, ownerPin);
    this.matchHandler = new MatchEventHandler(io, tableManager, ownerPin);
    this.authHandler = new AuthHandler(io, tableManager, ownerPin, sessionTokenService);
    this.adminHandler = new AdminHandler(io, tableManager, ownerPin);
    this.spotlightHandler = new SpotlightHandler(io, tableManager, ownerPin);
    // Spec (club-session-history / Persistence Trigger): when a
    // SessionHistoryStore is injected via the SocketHandler ctor, it is
    // forwarded to ClubPlayerHandler so session-end writes a SessionRecord.
    // When omitted (older tests, or while PR 2 production wiring is in
    // progress), the no-store safety-net path inside ClubPlayerHandler is
    // exercised — see gotchas #3/#4 in sdd/club-session-history/apply-gotchas.
    //
    // History handler (task 3.6): a SINGLE ClubSessionHistoryHandler is
    // constructed up front so the pending-clear state is shared across:
    //   - CLUB_VERIFY_ADMIN success → historyHandler.sendHistoryToSocket
    //     (closes the PIN-only gap; JWT reconnect path is handled in the
    //     io.on('connection') hook below).
    //   - CLUB_CLEAR_HISTORY / CLUB_CLEAR_HISTORY_CONFIRM socket events
    //     (registered in registerHandlers).
    // Instantiating TWO handlers would split the 30s pending-clear window;
    // the structural interface ClubHistoryBridge keeps the seam narrow.
    if (sessionHistoryStore) {
      this.clubHistoryHandler = new ClubSessionHistoryHandler(io, sessionHistoryStore);
    }
    this.clubAdminHandler = new ClubAdminHandler(io, tableManager, ownerPin, clubConfigStore!, adminPinService, sessionTokenService, this.clubHistoryHandler);
    // Phase 3 / U2: pass clubConfigStore so CLUB_ADMIN_OCCUPY can resolve
    // the configured sport for the default match config on the freshly
    // occupied court.
    this.clubCourtHandler = new ClubCourtHandler(io, tableManager, ownerPin, clubConfigStore);
    this.clubPlayerHandler = new ClubPlayerHandler(io, tableManager, ownerPin, clubConfigStore!, sessionHistoryStore);
    
    // Set up global court update listener once
    // COURT_UPDATE always goes to the court's room; COURT_LIST / CLUB_KIOSK_DATA
    // are split by court kind so tournament clients never see club courts and vice versa.
    this.tableManager.onTableUpdate = (tableInfo) => {
      // COURT_UPDATE goes only to clients in the court's room (shared)
      this.io.to(tableInfo.id).emit(SocketEvents.SERVER.COURT_UPDATE, tableInfo);

      if (tableInfo.mode === COURT_MODE.CLUB) {
        // Club court change → only emit CLUB_KIOSK_DATA
        const clubConfig = this.clubConfigStore?.load() ?? null;
        const kioskPayload = this.tableManager.getClubKioskPayload(clubConfig);
        this.io.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, kioskPayload);
      } else {
        // Tournament court change → only emit COURT_LIST
        this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());
      }
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

        const court = this.tableManager.getCourt(courtId);

        if (court && isClubCourt(court)) {
          // Club mode: keep the court OCCUPIED after the match finishes.
          // Spec scenario 3 —— the session is NOT auto-ended; the player
          // choses the next post-match action (reset / new match / free /
          // end session). Emit MATCH_UPDATE with the final matchState so
          // the client renders the post-match modal in PR 4.
          const finalState = this.tableManager.getMatchState(courtId);
          if (finalState) {
            this.io.to(courtId).emit(SocketEvents.SERVER.MATCH_UPDATE, finalState);
          }
        } else {
          // Tournament mode: existing behavior — auto-clear featured on a
          // featured court, then notify kiosk clients on match won.
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
        }
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

    // JWT session reconnect — restore socket.data auth flags from a signed
    // JWT in handshake.auth.sessionToken WITHOUT re-PIN (REQ-07/11).
    // Registered AFTER the rate limiter, BEFORE io.on('connection') so the
    // crypto cost is only paid for non-rate-limited sockets. Invalid/expired/
    // missing tokens pass through unauthenticated (REQ: never reject).
    const sessionTokenService = new SessionTokenService();
    this.io.use((socket: Socket, next: (err?: Error) => void) => {
      const token = (socket.handshake.auth as { sessionToken?: unknown } | undefined)
        ?.sessionToken;
      if (typeof token !== 'string' || token.length === 0) {
        return next(); // unauthenticated — client must re-PIN
      }
      const claims = sessionTokenService.verifyToken(token);
      if (!claims) {
        return next(); // unauthenticated — invalid/expired, pass through
      }
      this.applySessionClaims(socket, claims);
      next();
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info({ socketId: socket.id }, 'Client connected');
      logger.debug({ socketId: socket.id, count: this.io.engine.clientsCount }, 'Connected clients');

      // Send current courts to new client
      socket.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      // Send club kiosk data to new client
      const clubConfig = this.clubConfigStore?.load() ?? null;
      const kioskPayload = this.tableManager.getClubKioskPayload(clubConfig);
      socket.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, kioskPayload);

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
      this.clubHistoryHandler?.registerHandlers(socket);

      // Signal club admin that their session was restored from JWT on reload
      // (REQ-11). The io.use() middleware already set isClubAdmin; this
      // lets the client restore the admin UI without re-entering the PIN.
      if ((socket.data as SocketData).isClubAdmin) {
        socket.emit(SocketEvents.SERVER.CLUB_SESSION_RESTORED);

        // Spec (club-session-history / Server Events): on admin connect,
        // push the full persisted session history to that admin. Only
        // emitted to admin sockets — sendHistoryToSocket re-checks
        // isClubAdmin before emitting (defense-in-depth).
        this.clubHistoryHandler?.sendHistoryToSocket(socket);
      }

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

  /**
   * Apply verified JWT claims to socket.data based on role (REQ-07/11).
   * Pure — no I/O. Exposed as a method for clarity and testability of the
   * role→flags mapping.
   */
  private applySessionClaims(socket: Socket, claims: SessionClaims): void {
    const socketData = socket.data as SocketData;
    if (claims.role === 'tournament_owner') {
      socket.data = {
        ...socketData,
        isOwner: true,
        isAuthenticated: true,
      };
    } else if (claims.role === 'club_admin') {
      // player-identity (Phase 3 / U2 fix for U1 review warning #2):
      // JWT restore previously set isClubAdmin only, leaving adminId
      // undefined. The admin occupy + force-end flows attribute the
      // session to `socket.data.adminId`; without it, the handler refuses
      // (CLUB_ADMIN_OCCUPY → UNAUTHORIZED) and the SessionRecord would
      // silently lose admin traceability for JWT-restored admins. Use the
      // freshly-allocated socket.id as the adminId — matches the
      // PIN-verify path (ClubAdminHandler.CLUB_VERIFY_ADMIN sets
      // socket.id). The id is not stable across reconnects, but the spec
      // accepts socket.id as the adminId unit (design "Open Questions
      // RESOLVED" + session-record MODIFIED requirement).
      socket.data = {
        ...socketData,
        isClubAdmin: true,
        adminId: socket.id,
      };
    }
  }

  private getPublicCourtList(): CourtInfo[] {
    return this.tableManager.getAllTournamentCourts();
  }
}