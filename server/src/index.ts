/**
 * rallyOS-hub Entry Point
 *
 * Orchestrates app, server, and socket initialization.
 * This file only imports and wires modules together.
 */

import crypto from 'crypto';
import { app } from './app';
import { createSecureServer, gracefulShutdown } from './server';
import { createSocketServer } from './socket';
import { TableManager } from './tableManager';
import { logger } from './utils/logger';

// Owner PIN initialization - mandatory with random fallback
let ownerPin: string;
if (!process.env.TOURNAMENT_OWNER_PIN) {
  ownerPin = crypto.randomInt(10000000, 99999999).toString();
  logger.warn({ ownerPin }, 'OWNER PIN randomly generated — SAVE THIS PIN, it changes on every restart');
} else {
  ownerPin = process.env.TOURNAMENT_OWNER_PIN;
  logger.info({ ownerPin }, 'OWNER PIN loaded from environment');
}

export { ownerPin };

// Create secure server
const { httpsServer, io } = createSecureServer(app);

const PORT = process.env.PORT || 3000;

const hubConfig = {
  ssid: process.env.HUB_SSID || 'RallyOS',
  ip: process.env.HUB_IP || '192.168.4.1',
  port: parseInt(process.env.PORT || '3000'),
  ownerPin,
};

// Create TableManager and SocketHandler
const tableManager = new TableManager(hubConfig);
createSocketServer(io, tableManager, ownerPin);

// Start listening
httpsServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'rallyOS-hub is live (SECURE)');
  logger.info({ url: `https://localhost:${PORT}` }, 'Local URL');
  logger.info({ url: `https://YOUR_IP:${PORT}` }, 'Network URL - Connect mobile phone to same WiFi');
});

// Graceful shutdown handlers
let isShuttingDown = false;

const shutdown = (signal: 'SIGTERM' | 'SIGINT') => {
  if (isShuttingDown) return; // Prevent multiple shutdown attempts
  isShuttingDown = true;
  
  gracefulShutdown(
    httpsServer,
    io,
    () => {
      const allTables = tableManager.getAllTables();
      for (const table of allTables) {
        tableManager.deleteTable(table.id);
      }
      logger.info({ tableCount: allTables.length }, 'Active tables cleared');
    },
    signal
  ).catch((err) => {
    logger.error({ error: err }, 'Shutdown failed');
    process.exit(1);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Global error handling
process.on('uncaughtException', (error) => {
  logger.error({ error, stack: error.stack }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
});
