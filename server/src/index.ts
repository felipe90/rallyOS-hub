/**
 * rallyOS-hub Entry Point
 *
 * Orchestrates app, server, and socket initialization.
 * This file only imports and wires modules together.
 */

import fs from 'fs';
import { app, spaFallback } from './app';
import { createSecureServer, gracefulShutdown } from './server';
import { createSocketServer } from './socket';
import { CourtManager } from './domain/courtManager';
import { StateStore } from './services/store/StateStore';
import { ClubConfigStore } from './services/store/ClubConfigStore';
import { createTournamentRouter } from './routes/tournament';
import { createExportRouter } from './routes/export';
import { ownerAuthMiddleware } from './middleware/ownerAuth';
import { logger } from './utils/logger';
import { initOwnerPin } from './config/ownerPin';
import { getHubDomain } from './config/allowedOrigins';
import { startCaptivePortal } from './captivePortal';

// Owner PIN initialization
// If set via env → use it (production). If not → generate random (plug-and-play Orange Pi).
// The PIN is NEVER logged — it's exposed via the /api/owner-pin endpoint for the UI.
const { pin: ownerPin, isRandom } = initOwnerPin();

if (isRandom) {
  logger.info('Owner PIN randomly generated — check the web UI or /api/owner-pin endpoint');
} else {
  logger.info('Owner PIN loaded from environment');
}

export { ownerPin };

// Create secure server
const { httpsServer, io } = createSecureServer(app);

const PORT = process.env.PORT || 3000;

const hubConfig = {
  ssid: process.env.HUB_SSID || 'RallyOS',
  ip: process.env.HUB_IP || '192.168.4.1',
  port: parseInt(process.env.PORT || '3000'),
  domain: getHubDomain(),
  wifiPassword: process.env.HUB_WIFI_PASSWORD || '',
  ownerPin,
};

// Create stores
const stateStore = new StateStore();
const clubConfigStore = new ClubConfigStore();

// Create CourtManager with persistence
const courtManager = new CourtManager(hubConfig, stateStore);
createSocketServer(io, courtManager, ownerPin, hubConfig, clubConfigStore);

// GET /api/club/config — public endpoint to check if club is configured
app.get('/api/club/config', (_req, res) => {
  const config = clubConfigStore.load();
  res.json({
    configured: config?.configured === true,
    clubName: config?.clubName || null,
    sport: config?.sport || null,
  });
});

// Mount tournament lifecycle routes (before SPA fallback)
app.use(
  '/api/tournament',
  createTournamentRouter(stateStore, courtManager, ownerAuthMiddleware),
);

// Mount CSV export route (before SPA fallback)
app.use(
  '/api/export/matches.csv',
  createExportRouter(stateStore, ownerAuthMiddleware),
);

// SPA fallback — must be registered LAST (after all API routes)
app.use(spaFallback);

// Ensure data directory exists for tournament persistence
const DATA_DIR = 'data';
const ARCHIVE_DIR = 'data/archive';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  logger.info('Created data/ directory for tournament persistence');
}
if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  logger.info('Created data/archive/ directory');
}

// Start listening
httpsServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'rallyOS-hub is live (SECURE)');
  logger.info({ url: `https://localhost:${PORT}` }, 'Local URL');
  logger.info({ url: `https://${hubConfig.domain}:${PORT}` }, 'Domain URL');
  logger.info({ url: `https://YOUR_IP:${PORT}` }, 'Network URL - Connect mobile phone to same WiFi');

  // Start the HTTP captive portal on port 80 alongside the HTTPS server.
  startCaptivePortal(hubConfig);
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
      const allCourts = courtManager.getAllCourts();
      for (const court of allCourts) {
        courtManager.deleteCourt(court.id);
      }
      logger.info({ courtCount: allCourts.length }, 'Active courts cleared');
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
