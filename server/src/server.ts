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
import { getAllowedOrigins } from './config/allowedOrigins';

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

        const effectiveAllowedOrigins = getAllowedOrigins();

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
    // Connection limits for security
    maxHttpBufferSize: 1e6, // 1MB max message size
    pingTimeout: 60000,
    pingInterval: 25000,
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

  // Disconnect all Socket.IO clients immediately
  try {
    io.disconnectSockets();
    logger.info('Socket.IO clients disconnected');
  } catch (err) {
    logger.error({ error: err }, 'Error disconnecting sockets');
  }

  // Force close HTTP server after timeout
  const forceClose = () => {
    logger.warn('Force closing HTTP server');
    httpsServer.close(() => {
      logger.info('HTTP server closed (forced)');
    });
  };

  // Give sockets time to close, then force close
  setTimeout(forceClose, 1000);

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

  // Clear active tables
  if (cleanupTables) {
    cleanupTables();
  }

  logger.info('Graceful shutdown complete');
  
  // Force exit after 2 seconds to prevent hanging
  setTimeout(() => {
    logger.info('Forcing process exit');
    process.exit(0);
  }, 2000).unref();
}
