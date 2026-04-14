/**
 * HTTPS Server Setup with Graceful Shutdown
 *
 * Creates secure HTTPS server and handles graceful shutdown.
 * Exports server instance and shutdown function.
 */

import { createServer, Server as HttpsServer } from 'https';
import { Server as IOServer } from 'socket.io';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';

function validateCertificates(): { key: Buffer; cert: Buffer } {
  const keyPath = path.join(process.cwd(), 'key.pem');
  const certPath = path.join(process.cwd(), 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    logger.error(`
SSL Certificates not found!
To run rallyOS-hub, you need self-signed certificates.
RUN THIS COMMAND IN THE 'server' DIRECTORY:
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"
Then restart the server.
`);
    process.exit(1);
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export function createSecureServer(app: Express): {
  httpsServer: HttpsServer;
  io: IOServer;
} {
  const httpsOptions = validateCertificates();

  const httpsServer = createServer(httpsOptions, app);

  const io = new IOServer(httpsServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const allowedOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

        const effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : [
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

        if (effectiveAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        logger.warn({ origin }, 'Blocked origin');
        callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  return { httpsServer, io };
}

export async function gracefulShutdown(
  httpsServer: HttpsServer,
  io: IOServer,
  cleanupTables?: () => void,
  signal: 'SIGTERM' | 'SIGINT' = 'SIGTERM'
): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Close HTTP/HTTPS server
  await new Promise<void>((resolve, reject) => {
    httpsServer.close((err) => {
      if (err) {
        logger.error({ error: err }, 'Error during server close');
        reject(err);
      } else {
        resolve();
      }
    });
  });

  logger.info('HTTP server closed');

  // Close Socket.IO connections
  await io.close();
  logger.info('Socket.IO server closed');

  // Clear active tables
  if (cleanupTables) {
    cleanupTables();
  }

  logger.info('Graceful shutdown complete');
}
