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

export class ClubAdminHandler extends SocketHandlerBase {
  private clubConfigStore: IClubConfigRepository;
  private adminPinService: AdminPinService;
  private sessionTokenService: SessionTokenService;

  constructor(
    io: Server,
    tableManager: CourtManager,
    ownerPin: string,
    clubConfigStore: IClubConfigRepository,
    adminPinService: AdminPinService,
    sessionTokenService: SessionTokenService,
  ) {
    super(io, tableManager, ownerPin);
    this.clubConfigStore = clubConfigStore;
    this.adminPinService = adminPinService;
    this.sessionTokenService = sessionTokenService;
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
        socket.data = { ...socketData, isClubAdmin: true };
        const token = this.sessionTokenService.signToken({
          sub: (config as any).clubId ?? 'club',
          role: 'club_admin',
        });
        socket.emit(SocketEvents.SERVER.CLUB_ADMIN_VERIFIED, { success: true, token });

        // Club courts are already delivered via CLUB_KIOSK_DATA at connection time

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
      const clubConfig = {
        clubName: data.clubName,
        sport: data.sport,
        configured: true,
        adminPinHash,
        createdAt: Date.now(),
        costPerMinute: data.costPerMinute ?? 0,
        currency: data.currency ?? 'ARS',
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
