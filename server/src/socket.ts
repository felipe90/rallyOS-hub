/**
 * Socket.IO Server Setup
 *
 * Initializes Socket.IO server with event handlers.
 * Exports socket setup function.
 */

import { Server as IOServer } from 'socket.io';
import { SocketHandler } from './socketHandler';
import { TableManager } from './tableManager';
import { logger } from './utils/logger';

export function createSocketServer(
  io: IOServer,
  tableManager: TableManager,
  ownerPin: string
): SocketHandler {
  const socketHandler = new SocketHandler(io, tableManager, ownerPin);

  logger.info('Socket.IO initialized');
  logger.debug({ transports: io.engine.opts.transports }, 'Socket.IO transports');

  return socketHandler;
}
