/**
 * Socket.IO Server Setup
 *
 * Initializes Socket.IO server with event handlers.
 * Exports socket setup function.
 */

import { Server as IOServer } from 'socket.io';
import { SocketHandler } from './handlers/SocketHandler';
import { CourtManager } from './domain/courtManager';
import { ClubConfigStore } from './services/store/ClubConfigStore';
import { SessionHistoryStore } from './services/store/SessionHistoryStore';
import { PhoneRevealAuditStore } from './services/store/PhoneRevealAuditStore';
import { HubConfig } from './domain/types';
import { logger } from './utils/logger';

export function createSocketServer(
  io: IOServer,
  courtManager: CourtManager,
  ownerPin: string,
  hubConfig: HubConfig,
  clubConfigStore?: ClubConfigStore,
  sessionHistoryStore?: SessionHistoryStore,
  phoneRevealAuditStore?: PhoneRevealAuditStore,
): SocketHandler {
  const socketHandler = new SocketHandler(
    io,
    courtManager,
    ownerPin,
    hubConfig,
    clubConfigStore,
    sessionHistoryStore,
    phoneRevealAuditStore,
  );

  logger.info('Socket.IO initialized');
  logger.debug({ transports: io.engine.opts.transports }, 'Socket.IO transports');

  return socketHandler;
}