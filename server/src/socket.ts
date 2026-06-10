/**
 * Socket.IO Server Setup
 *
 * Initializes Socket.IO server with event handlers.
 * Exports socket setup function.
 */

import { Server as IOServer } from 'socket.io';
import { SocketHandler } from './handlers/SocketHandler';
import { CourtManager } from './domain/courtManager';
import { HubConfig } from './domain/types';
import { logger } from './utils/logger';

export function createSocketServer(
  io: IOServer,
  courtManager: CourtManager,
  ownerPin: string,
  hubConfig: HubConfig,
): SocketHandler {
  const socketHandler = new SocketHandler(io, courtManager, ownerPin, hubConfig);

  logger.info('Socket.IO initialized');
  logger.debug({ transports: io.engine.opts.transports }, 'Socket.IO transports');

  return socketHandler;
}
