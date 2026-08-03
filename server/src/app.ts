/**
 * Express Application Setup
 *
 * Configures CORS, static file serving, routes, and middleware.
 * Exports the Express app instance.
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';
import { getAllowedOrigins } from './config/allowedOrigins';
import { isAllowedHubHost } from './config/hostAllowlist';

const app = express();

// Host header validation — prevent host injection attacks. Only localhost,
// private RFC 1918 IPv4 ranges, and the hub's own configured domain are
// accepted. See config/hostAllowlist.ts for the exact allowlist.
app.use((req, res, next) => {
  const host = req.hostname;
  if (host && !isAllowedHubHost(host)) {
    logger.warn({ host }, 'Blocked invalid Host header');
    res.status(400).json({ error: 'Invalid host' });
    return;
  }
  next();
});

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
      imgSrc: ["'self'", 'data:', 'blob:'],
      // Socket.io connects to the same HTTPS origin as the page, so 'self'
      // covers both the polling transport and the ws:// upgrade on that host.
      connectSrc: ["'self'"],
      fontSrc: ["'self'"], // Fonts are self-hosted (/fonts/*.woff2)
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      reportUri: '/csp-report',
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin for Socket.io
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
  },
}));

// Compress text responses (HTML/JS/CSS) before they are served. Registered
// before the static middleware and routes so every response benefits, and the
// middleware skips responses that already carry a Content-Encoding header.
app.use(compression());

export const effectiveAllowedOrigins = getAllowedOrigins();

const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (effectiveAllowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  logger.warn({ origin }, 'Blocked origin');
  callback(null, false);
};

app.use(cors({ origin: corsOriginValidator }));

// Serve the React client (from dist, public, or client src)
const rootDir = process.cwd();
const clientDistPath = path.join(rootDir, '../client/dist');
const clientPublicPath = path.join(rootDir, '../client/public');
const clientSrcPath = path.join(rootDir, '../client');
// Docker production path
const dockerPublicPath = path.join(rootDir, 'public/dist');

let clientPath: string;
let indexPath: string;

if (fs.existsSync(dockerPublicPath)) {
  clientPath = dockerPublicPath;
  indexPath = path.join(dockerPublicPath, 'index.html');
  logger.info('Using Docker production client (public/dist)');
} else if (fs.existsSync(clientDistPath)) {
  clientPath = clientDistPath;
  indexPath = path.join(clientDistPath, 'index.html');
  logger.info('Using built client (dist)');
} else if (fs.existsSync(clientPublicPath) && fs.existsSync(path.join(clientPublicPath, 'index.html'))) {
  clientPath = clientPublicPath;
  indexPath = path.join(clientPublicPath, 'index.html');
  logger.info('Using public client');
} else if (fs.existsSync(clientSrcPath)) {
  clientPath = clientSrcPath;
  indexPath = path.join(clientSrcPath, 'index.html');
  logger.warn('Using client source (development mode)');
} else {
  logger.warn('Client files not found in any expected location');
  clientPath = __dirname;
  indexPath = path.join(__dirname, 'index.html');
}

// Vite emits content-hashed filenames under /assets/ — safe to cache immutably.
// Non-hashed files (index.html, favicon, fonts, icons) are left to normal
// heuristics so updates are picked up.
app.use(
  express.static(clientPath, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// Serve the Hub UI
app.get('/', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client not found. Build the client first.');
  }
});

// API health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// CSP violation reporting — browsers POST to /csp-report when a policy is
// triggered. Minimal visibility hook: log the report via pino and respond
// with 204. Mounted with its own small JSON body parser so the report body
// is parsed without enabling body parsing app-wide.
app.post(
  '/csp-report',
  express.json({
    limit: '16kb',
    type: ['application/json', 'application/csp-report', 'application/reports+json'],
  }),
  (req, res) => {
    logger.warn({ report: req.body }, 'CSP violation reported');
    res.status(204).end();
  },
);

// Expose owner PIN for plug-and-play mode (random PIN generation)
// Only returns the PIN when it was randomly generated (not from env var)
// Restricted to localhost — only the kiosk display on the Orange Pi itself needs this.
app.get('/api/owner-pin', (req, res) => {
  // Restrict to localhost: only the kiosk UI on the Orange Pi itself needs the PIN
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!isLocalhost) {
    logger.warn({ ip }, 'Blocked external access to /api/owner-pin');
    return res.status(403).json({ error: 'Access denied' });
  }

  const { getOwnerPin, isRandomPin } = require('./config/ownerPin');
  const pin = getOwnerPin();
  const random = isRandomPin();

  // Only expose PIN when it was randomly generated (plug-and-play mode)
  // When set via env var, the operator already knows it
  if (!random || !pin) {
    return res.json({ pin: null, isRandom: false });
  }

  res.json({ pin, isRandom: true });
});

// Captive Portal redirect — redirects browser to the hub PWA.
app.get('/captive-portal', (req, res) => {
  const domain = process.env.HUB_DOMAIN || 'rallyos.wifi';
  const port = process.env.HUB_PORT || '3000';
  res.redirect(302, `https://${domain}:${port}`);
});

// SPA fallback — serve index.html for any unmatched route.
// Express 5 uses path-to-regexp v8 which doesn't support bare '*'.
// Using middleware instead of a route handler avoids the issue entirely.
// Exported so index.ts can register it AFTER all API routes are mounted.
export const spaFallback = (req: express.Request, res: express.Response) => {
  // Let API and Socket.IO paths return 404 (they have their own handlers)
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // For all other routes, serve the SPA shell so React Router can handle them
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client not found');
  }
};

export { app };
