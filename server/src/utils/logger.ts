/**
 * Structured Logger with Pino
 *
 * Provides JSON-structured logging with levels (info/warn/error)
 * ISO timestamps, and contextual metadata (tableId, socketId, ip)
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: ['pin', 'ownerPin', 'encryptedPin', 'password', 'secret', 'token'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with contextual metadata
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
