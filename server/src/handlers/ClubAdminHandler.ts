/**
 * ClubAdminHandler — Handles club admin authentication and setup events
 *
 * Events handled:
 * - CLUB_VERIFY_ADMIN: Verify admin PIN and grant admin session
 * - CLUB_GET_CONFIG: Check if club is configured
 * - CLUB_SETUP: First-run club configuration
 */

import { Server, Socket } from 'socket.io';
import { CourtManager } from '../domain/courtManager';
import type { IClubConfigRepository } from '../domain/ports/IClubConfigRepository';
import { AdminPinService } from '../services/security/AdminPinService';
import { SessionTokenService } from '../services/security/SessionTokenService';
import { validateSocketPayload } from '../utils/validation';
import { logger, maskIp } from '../utils/logger';
import { SocketEvents } from '../../../shared/events';
import { ADMIN_PIN_RULES } from '../../../shared/validation';
import { COURT_MODE } from '../../../shared/types';
import { SocketHandlerBase } from './SocketHandlerBase';
import { isClubCourt } from '../domain/types';
import type { SocketData } from '../domain/types';
import type { ClubSessionHistoryHandler } from './ClubSessionHistoryHandler';
// player-identity (Phase 2 task 2.6) — AES-256-GCM key generator used on
// CLUB_SETUP so the club is born with an encryption key. No key copy reaches
// non-admin/non-joining sockets.
import { generateKey } from '../services/crypto/phoneCipher';

/**
 * Minimal collaborator surface that ClubAdminHandler needs from
 * ClubSessionHistoryHandler. Declared as a structural interface so the
 * handler stays decoupled from the concrete class and tests can pass a
 * stub. See task 3.6 (club-session-history) and apply-gotchas-pr2 #4.
 */
export interface ClubHistoryBridge {
  sendHistoryToSocket(socket: Socket): void;
}

export class ClubAdminHandler extends SocketHandlerBase {
  private clubConfigStore: IClubConfigRepository;
  private adminPinService: AdminPinService;
  private sessionTokenService: SessionTokenService;
  private readonly historyHandler?: ClubHistoryBridge;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    clubConfigStore: IClubConfigRepository,
    adminPinService: AdminPinService,
    sessionTokenService: SessionTokenService,
    /**
     * Optional bridge to ClubSessionHistoryHandler. When injected, a
     * successful PIN verify triggers `sendHistoryToSocket(socket)` so
     * admins that arrive without a JWT (no session-restore path) still
     * receive CLUB_SESSION_HISTORY immediately. Omit to preserve the
     * pre-history backward-compat shape (gotcha #4 — do NOT silently
     * remove the no-history branch).
     */
    historyHandler?: ClubHistoryBridge,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
    this.adminPinService = adminPinService;
    this.sessionTokenService = sessionTokenService;
    this.historyHandler = historyHandler;
  }

  /**
   * Register all club admin event handlers
   */
  public registerHandlers(socket: Socket): void {
    // CLUB_VERIFY_ADMIN: Verify admin PIN and grant admin session
    socket.on(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, (data: { pin: string }) => {
      if (!validateSocketPayload(socket, data, {
        pin: { required: true, type: 'string', pattern: ADMIN_PIN_RULES.pattern },
      }, 'CLUB_VERIFY_ADMIN')) {
        return;
      }

      // Rate limit: 3 attempts per 30s per IP
      const clientIp = socket.handshake.address;
      const rateLimitKey = `CLUB_VERIFY_ADMIN:${clientIp}`;
      if (this.isRateLimited(rateLimitKey)) {
        this.logRateLimitBlocked('CLUB_VERIFY_ADMIN', 'admin-verify', clientIp);
        return this.emitError(socket, 'RATE_LIMITED', 'Demasiados intentos. Esperá 30 segundos.');
      }

      const config = this.clubConfigStore.load();
      if (!config || !config.configured) {
        return this.emitError(socket, 'CLUB_NOT_CONFIGURED', 'El club no está configurado');
      }

      if (this.adminPinService.verifyPin(data.pin, config.adminPinHash)) {
        const socketData = socket.data as SocketData;
        // player-identity (Phase 2 task 2.3) — capture the admin's socket id
        // at verify time so subsequent handlers can attribute admin actions
        // (SessionRecord.adminId) WITHOUT re-decoding the JWT or re-asking
        // the client. Mirrors the existing isClubAdmin flag pattern.
        socket.data = {
          ...socketData,
          isClubAdmin: true,
          adminId: socket.id,
        };
        const token = this.sessionTokenService.signToken({
          sub: (config as any).clubId ?? 'club',
          role: 'club_admin',
        });
        // player-identity (U1 review fix #1) — deliver the club's encryptionKey
        // to the admin client so AdminOccupyModal can encrypt the admin-entered
        // phone with AES-256-GCM before transmitting. The config is already
        // loaded above (guard: config exists and is configured).
        socket.emit(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, {
          success: true,
          token,
          encryptionKey: config.encryptionKey || null,
        });

        // Club courts are already delivered via CLUB_KIOSK_DATA at connection time

        // Task 3.6 (club-session-history): when a history handler is
        // injected, push the persisted session history to the freshly
        // verified admin. This closes the gap for PIN-only clients that
        // did not arrive via the JWT-reconnect path (gotchas-pr2 #4) —
        // the SocketHandler admin-connect hook only covers JWT reconnect.
        this.historyHandler?.sendHistoryToSocket(socket);

        logger.info({ socketId: socket.id }, 'Club admin verified successfully');
      } else {
        this.emitError(socket, 'INVALID_ADMIN_PIN', 'PIN de administrador incorrecto');
        logger.warn({ socketId: socket.id, ip: maskIp(clientIp) }, 'Club admin verification failed');
      }
    });

    // CLUB_GET_CONFIG: Check if club is configured
    socket.on(SocketEvents.CLIENT.CLUB_GET_CONFIG, () => {
      const config = this.clubConfigStore.load();
      socket.emit(SocketEvents.SERVER.CLUB_CONFIG, {
        configured: config?.configured === true,
        clubName: config?.clubName || null,
        sport: config?.sport || null,
      });

      // Send club kiosk data alongside config so ClubKioskPage
      // receives it when it mounts (race condition: connection-time
      // CLUB_KIOSK_DATA arrives before ClubKioskPage is rendered)
      if (config?.configured) {
        const kioskPayload = this.tableManager.getClubKioskPayload(config);
        socket.emit(SocketEvents.SERVER.CLUB_KIOSK_DATA, kioskPayload);
      }
    });

    // CLUB_SETUP: First-run club configuration
    socket.on(SocketEvents.CLIENT.CLUB_SETUP, (data: {
      clubName: string;
      sport: string;
      pin: string;
      courtCount?: number;
      costPerMinute?: number;
      currency?: string;
    }) => {
      if (!validateSocketPayload(socket, data, {
        clubName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        sport: { required: true, type: 'string', minLength: 1, maxLength: 50 },
        pin: { required: true, type: 'string', pattern: ADMIN_PIN_RULES.pattern },
        courtCount: { required: false, type: 'number', min: 0, max: 50 },
        costPerMinute: { required: false, type: 'number', min: 0 },
        currency: { required: false, type: 'string', minLength: 2, maxLength: 10 },
      }, 'CLUB_SETUP')) {
        return;
      }

      // Guard: only allow setup when not configured
      const existing = this.clubConfigStore.load();
      if (existing?.configured) {
        return this.emitError(socket, 'ALREADY_CONFIGURED', 'El club ya está configurado');
      }

      // Hash the admin PIN
      const adminPinHash = this.adminPinService.hashPin(data.pin);

      // Save club config (only the scrypt hash — never plaintext)
      //
      // player-identity (Phase 2 task 2.6) — auto-generate a 32-byte
      // AES-256-GCM key (base64-encoded) on first CLUB_SETUP. Persisted to
      // ClubConfig.encryptionKey so the subsequent CLUB_JOIN_RESULT +
      // CLUB_ADMIN_OCCUPY responses can surface it back to the client for
      // phone encryption. The SERVER is authoritative on key generation —
      // any client-supplied `encryptionKey` field is ignored (the request
      // payload type does not even include it). See `player-identity`
      // spec ("Open Questions RESOLVED" + "Client-Side Phone Encryption"
      // requirement).
      const clubConfig = {
        clubName: data.clubName,
        sport: data.sport,
        configured: true,
        adminPinHash,
        createdAt: Date.now(),
        costPerMinute: data.costPerMinute ?? 0,
        currency: data.currency ?? 'ARS',
        encryptionKey: generateKey(),
      };
      this.clubConfigStore.save(clubConfig);

      // Create initial courts
      const courtCount = Math.max(0, Math.min(data.courtCount ?? 3, 50));
      const courts = [];
      for (let i = 0; i < courtCount; i++) {
        const court = this.tableManager.createClubCourt();
        courts.push(court);
      }

      // Broadcast court creation
      for (const court of courts) {
        this.io.emit(SocketEvents.SERVER.CLUB_COURT_CREATED, {
          id: court.id,
          name: court.name,
          status: isClubCourt(court) ? court.clubStatus : COURT_MODE.CLUB,
          mode: COURT_MODE.CLUB,
        });
      }

      // Emit setup complete
      socket.emit(SocketEvents.SERVER.CLUB_SETUP_COMPLETE, {
        clubName: data.clubName,
        sport: data.sport,
        courtCount: courts.length,
      });

      // Also update the global court list
      this.io.emit(SocketEvents.SERVER.COURT_LIST, this.getPublicCourtList());

      logger.info(
        { clubName: data.clubName, sport: data.sport, courtCount: courts.length },
        'Club setup complete',
      );
    });
  }
}
