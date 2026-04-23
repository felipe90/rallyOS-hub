/**
 * Express Application Setup
 *
 * Configures CORS, static file serving, routes, and middleware.
 * Exports the Express app instance.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';
import { getAllowedOrigins } from './config/allowedOrigins';

const app = express();

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'], // Required for Socket.io
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin for Socket.io
}));

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

app.use(cors({ origin: corsOriginValidator, credentials: true }));

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

app.use(express.static(clientPath));

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

// Expose owner PIN for plug-and-play mode (random PIN generation)
// Only returns the PIN when it was randomly generated (not from env var)
// This allows the UI to display the PIN on first boot without logging it
app.get('/api/owner-pin', (req, res) => {
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

export { app };
