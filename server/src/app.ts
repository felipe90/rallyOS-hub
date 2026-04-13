/**
 * Express Application Setup
 *
 * Configures CORS, static file serving, routes, and middleware.
 * Exports the Express app instance.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://orangepi.local:3000',
  'https://orangepi.local:3000',
];

const allowedOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;

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
const clientDistPath = path.join(__dirname, '../public/dist');
const clientPublicPath = path.join(__dirname, '../public');
const clientSrcPath = path.join(__dirname, '../../client');

let clientPath: string;
let indexPath: string;

if (fs.existsSync(clientDistPath)) {
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

export { app };
