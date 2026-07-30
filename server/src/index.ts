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
import { CourtRepository } from './services/table/CourtRepository';
import { PlayerService } from './services/table/PlayerService';
import { MatchOrchestrator } from './services/table/MatchOrchestrator';
import { CourtFormatter } from './services/table/CourtFormatter';
import { PinService } from './services/security/PinService';
import { QRService } from './services/qr/QRService';
import { SportRegistry } from './domain/sports/sport.registry';
import { DefaultMatchEngineFactory } from './domain/ports';
import { StateStore } from './services/store/StateStore';
import { ClubConfigStore } from './services/store/ClubConfigStore';
import { SessionHistoryStore } from './services/store/SessionHistoryStore';
import { createTournamentRouter } from './routes/tournament';
import { createExportRouter } from './routes/export';
import { createClubSessionsExportRouter } from './routes/clubSessionsExport';
import { createOwnerAuthMiddleware } from './middleware/ownerAuth';
import { createClubAuthMiddleware } from './middleware/clubAuth';
import { SessionTokenService } from './services/security/SessionTokenService';
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
// SessionHistoryStore — append-only JSON log of completed club sessions.
// Spec: club-session-history / "SessionHistoryStore" requirement. Injected
// into both the socket layer (ClubPlayerHandler.append on session end +
// ClubSessionHistoryHandler clear+export flow) and the CSV export route
// (GET /api/club/sessions/export).
const sessionHistoryStore = new SessionHistoryStore();

// Create infrastructure services
const repository = new CourtRepository();
const pinService = new PinService();
const playerService = new PlayerService(pinService);
const registry = new SportRegistry();
const engineFactory = new DefaultMatchEngineFactory(registry);
const matchOrchestrator = new MatchOrchestrator(engineFactory, registry);
const formatter = new CourtFormatter();
const qrService = new QRService(hubConfig);

// Create CourtManager with all dependencies wired explicitly
const courtManager = new CourtManager({
  repository,
  pinService,
  playerService,
  matchOrchestrator,
  formatter,
  qrService,
  persistence: stateStore,
});

// Session token service — shared by SocketHandler (JWT reconnect) and
// the Express ownerAuth middleware (Bearer JWT). Single HMAC secret source
// of truth (ENCRYPTION_SECRET via pinEncryption.getServerSecret).
const sessionTokenService = new SessionTokenService();

createSocketServer(io, courtManager, ownerPin, hubConfig, clubConfigStore, sessionHistoryStore);

// Restore persisted state (OCCUPIED/FINISHED courts) from disk.
// Must run AFTER createSocketServer so onTableUpdate callbacks are wired.
const restored = courtManager.restoreState();
if (restored) {
  logger.info('Restored courts from persisted state');
}

// Express owner auth — bound to the same SessionTokenService used by sockets.
const ownerAuthMiddleware = createOwnerAuthMiddleware(sessionTokenService);
// Express club admin auth — same SessionTokenService, role=club_admin.
// Spec: club-session-history / "Authorization & Security" — the CSV export
// endpoint MUST reject non-admin requests with 401/403.
const clubAuthMiddleware = createClubAuthMiddleware(sessionTokenService);

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

// Mount club session CSV export route (before SPA fallback)
// Spec: club-session-history / "CSV Export" requirement — admin-only,
// text/csv with the 6-column header + injection-safe quoting.
app.use(
  '/api/club/sessions/export',
  createClubSessionsExportRouter(sessionHistoryStore, clubAuthMiddleware),
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
      // Do NOT delete courts on shutdown — OCCUPIED/FINISHED courts are
      // auto-persisted by CourtManager.persistState() and will be restored
      // via restoreState() on next startup. Deleting them here would
      // permanently lose active session state.
      const activeCount = courtManager.getAllCourts().length;
      logger.info({ courtCount: activeCount }, 'Shutdown complete — active courts preserved in state file');
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
