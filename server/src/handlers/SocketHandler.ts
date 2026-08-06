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
import type { InventoryManager } from '../domain/inventory/InventoryManager';
import type { FlowContext } from '../domain/flows/FlowModeContract';
import { AdminPinService } from '../services/security/AdminPinService';
import { SessionTokenService } from '../services/security/SessionTokenService';
import type { SessionClaims } from '../services/security/SessionTokenService';
import { CourtInfo, HubConfig, isClubCourt } from '../domain/types';
import type { SocketData } from '../domain/types';
import { logger } from '../utils/logger';
import { RateLimiter } from '../services/security/RateLimiter';
import { SocketEvents } from '../../../shared/events';
import { COURT_MODE, KIOSK_MODE } from '../../../shared/types';
import type { KioskMode } from '../../../shared/types';
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
  BracketHandler,
} from './index';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';
import { PhoneRevealAuditStore } from '../services/store/PhoneRevealAuditStore';
import { ClubConfigStore } from '../services/store/ClubConfigStore';
import { StateStore } from '../services/store/StateStore';

export class SocketHandler {
  private io: Server;
  private tableManager: CourtManager;
  private ownerPin: string;
  private hubConfig: HubConfig;
  private connectionRateLimiter: RateLimiter;
  private clubConfigStore?: IClubConfigRepository;
  /** Admin court catalog (D3/INV-1) — wired into ClubCourtHandler + connect push. */
  private inventoryManager?: InventoryManager;
  
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
  private bracketHandler?: BracketHandler;
  private phoneRevealAuditStore: PhoneRevealAuditStore;

  /** Current kiosk display mode — broadcast to all clients on connect and on change */
  private kioskMode: KioskMode = KIOSK_MODE.TOURNAMENT;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    hubConfig: HubConfig,
    clubConfigStore?: IClubConfigRepository,
    sessionHistoryStore?: SessionHistoryStore,
    phoneRevealAuditStore?: PhoneRevealAuditStore,
    stateStore?: StateStore,
    /**
     * InventoryManager — the admin court catalog (admin-court-inventory,
     * D3/INV-1). Injected into ClubCourtHandler for the INVENTORY_* events
     * and pushed to every connecting socket as INVENTORY_UPDATED (mirrors
     * the CLUB_KIOSK_DATA connect push). Optional so older test wiring
     * without an inventory keeps working.
     */
    inventoryManager?: InventoryManager,
  ) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    this.hubConfig = hubConfig;
    this.connectionRateLimiter = new RateLimiter(60_000, 20); // 20 connections per 60s per IP
    this.clubConfigStore = clubConfigStore;
    this.inventoryManager = inventoryManager;
    this.phoneRevealAuditStore = phoneRevealAuditStore ?? new PhoneRevealAuditStore();
    
    // Initialize services
    const adminPinService = new AdminPinService();
    const sessionTokenService = new SessionTokenService();

    // Initialize handlers
    this.courtHandler = new CourtEventHandler(io, tableManager, ownerPin);
    this.matchHandler = new MatchEventHandler(io, tableManager, ownerPin);
    this.authHandler = new AuthHandler(io, tableManager, ownerPin, sessionTokenService);
    this.adminHandler = new AdminHandler(io, tableManager, ownerPin);
    this.spotlightHandler = new SpotlightHandler(io, tableManager, ownerPin, clubConfigStore);
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
      const auditStore = this.phoneRevealAuditStore;
      const configStore = this.clubConfigStore ?? new ClubConfigStore();
      this.clubHistoryHandler = new ClubSessionHistoryHandler(io, sessionHistoryStore, auditStore, configStore);
    }
    this.clubAdminHandler = new ClubAdminHandler(io, tableManager, ownerPin, clubConfigStore!, adminPinService, sessionTokenService, this.clubHistoryHandler);
    // BracketHandler (Tier 2): constructed BEFORE ClubCourtHandler so its
    // force-end context seam (AFE-2 bracket unbind) can be wired into the
    // INVENTORY_FORCE_END handler below. Constructed only when a StateStore
    // is injected so the bracket persists across restarts (R10); omitting
    // the store keeps older test wiring working without a bracket handler.
    if (stateStore) {
      // Slice 4: BracketHandler now consumes the InventoryManager for
      // courtExists (TCS-2 — inventory-ACTIVE) and the strict cold-start gate
      // (TCS-4 — no ACTIVE court → COURT_INVENTORY_EMPTY on BRACKET_CREATE).
      this.bracketHandler = new BracketHandler(io, tableManager, ownerPin, stateStore, inventoryManager);
    }
    // Phase 3 / U2: pass clubConfigStore so CLUB_ADMIN_OCCUPY can resolve
    // the configured sport for the default match config on the freshly
    // occupied court. Slice 3: pass the InventoryManager (INVENTORY_* events)
    // + the AFE-2 bracket force-end context (plumbing — see
    // bracketForceEndContext for what slice 4 completes).
    this.clubCourtHandler = new ClubCourtHandler(
      io,
      tableManager,
      ownerPin,
      clubConfigStore,
      inventoryManager,
      this.bracketHandler ? () => this.bracketForceEndContext() : undefined,
    );
    this.clubPlayerHandler = new ClubPlayerHandler(io, tableManager, ownerPin, clubConfigStore!, sessionHistoryStore);

    // Default kiosk mode — tournament unless club is configured
    const existingConfig = this.clubConfigStore?.load() ?? null
    this.kioskMode = existingConfig?.configured ? KIOSK_MODE.CLUB : KIOSK_MODE.TOURNAMENT
    
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

          // Option 2 — bracket↔court integration: when this tournament court
          // is bound to a bracket match, auto-set the bracket winner (and, for
          // a semifinal, feed the loser into the third-place match). No-op for
          // unbound courts; any bracket edge case falls back to the owner's
          // manual flow without breaking the match-event chain.
          this.bracketHandler?.handleCourtMatchWon(courtId, winner);
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

    // P6: Global connection cap (engine.io 6.6 has no native maxConnections,
    // so guard at the socket.io middleware layer). On the single-board hub a
    // runaway flood of sockets must not exhaust memory; reject handshakes
    // beyond the cap with a clear error. A client beyond the cap should see
    // a "server full" style rejection and retry later.
    const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '100', 10);
    this.io.use((_socket, next) => {
      const active = this.io.engine.clientsCount;
      if (active >= MAX_CONNECTIONS) {
        logger.warn({ active, cap: MAX_CONNECTIONS }, 'Connection cap reached');
        return next(new Error(`MAX_CONNECTIONS: Too many clients (${active}). Please retry later.`));
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

      // Send the admin inventory catalog snapshot so a freshly connected
      // client reconciles the catalog immediately (mirrors the
      // CLUB_KIOSK_DATA / KIOSK_MODE connect pushes). After that, catalog
      // changes arrive via the INVENTORY_UPDATED broadcast.
      if (this.inventoryManager) {
        socket.emit(SocketEvents.SERVER.INVENTORY_UPDATED, {
          courts: this.inventoryManager.list(),
        });
      }

      // Send hub config to new client (WiFi QR credentials + domain)
      socket.emit(SocketEvents.SERVER.HUB_CONFIG, {
        ssid: this.hubConfig.ssid,
        ip: this.hubConfig.ip,
        port: this.hubConfig.port,
        wifiPassword: this.hubConfig.wifiPassword,
        domain: this.hubConfig.domain,
      });

      // Send current kiosk mode — TV display uses this to switch views
      socket.emit(SocketEvents.SERVER.KIOSK_MODE, { mode: this.kioskMode });

      // Push the current bracket state so a freshly connected kiosk (or owner)
      // learns it immediately without emitting any client event. Mirrors the
      // KIOSK_MODE connect push: bracket mutations are broadcast separately by
      // BracketHandler, but a kiosk that connects mid-tournament needs the
      // current snapshot now. No-op when no BracketHandler is wired.
      this.bracketHandler?.sendStateToSocket(socket);

      // Handle kiosk mode switch from admin/owner dashboard
      socket.on(SocketEvents.CLIENT.SET_KIOSK_MODE, (data: { mode: string }) => {
        // Auth gate (S3): only a verified tournament owner or club admin may
        // switch the kiosk mode. Mirrors the owner/admin gates used by the
        // other admin-only handlers (BracketHandler.guardOwner, ClubAdmin
        // validateClubAdmin) — a raw, unauthenticated socket must not be
        // able to flip the whole display mode.
        const socketData = socket.data as SocketData;
        if (socketData.isOwner !== true && socketData.isClubAdmin !== true) {
          socket.emit(SocketEvents.SERVER.ERROR, {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
          return;
        }

        const mode = data?.mode;
        if (
          mode !== KIOSK_MODE.CLUB &&
          mode !== KIOSK_MODE.TOURNAMENT &&
          mode !== KIOSK_MODE.BRACKET
        ) {
          return;
        }
        this.kioskMode = mode as KioskMode;
        this.io.emit(SocketEvents.SERVER.KIOSK_MODE, { mode: this.kioskMode });
        logger.info({ mode: this.kioskMode }, 'Kiosk mode updated');
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
      this.bracketHandler?.registerHandlers(socket);

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
   * AFE-2 force-end bracket context — supplies the resolve + unbind seams for
   * the INVENTORY_FORCE_END handler so a tournament force-end can find the
   * bracket match bound to the court and then clear the binding
   * (assignCourt(m, null)) WITHOUT setWinner/advance. Slice 3 wired only the
   * resolve seam; slice 4 completes `unbindMatch` via the public
   * `BracketHandler.unbindMatch` passthrough (engine is private).
   */
  private bracketForceEndContext(): FlowContext {
    const bh = this.bracketHandler;
    if (!bh) return {};
    return {
      resolveMatchForCourt: (courtId: string) => {
        const m = bh.resolveBracketMatchForCourt(courtId);
        return m ? { id: m.id } : null;
      },
      unbindMatch: (matchId: string) => {
        bh.unbindMatch(matchId);
      },
    };
  }

  /**
   * Release every bracket court binding + tournament flow (TCS-3, Q4) —
   * public seam for the POST /api/tournament/finish route. Bracket-scoped:
   * club courts untouched; the completed bracket is KEPT for display. No-op
   * when no BracketHandler is wired.
   */
  releaseAllBracketCourts(): string[] {
    return this.bracketHandler?.releaseAllCourts() ?? [];
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