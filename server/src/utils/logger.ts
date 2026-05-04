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
    // NOTE: 'ownerPin' intentionally NOT redacted - needed for local DEV testing
    // The PIN is randomly generated on each server start, so it has no security value
    // Production deployments should set TOURNAMENT_OWNER_PIN env var
    paths: ['pin', 'encryptedPin', 'password', 'secret', 'token'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Mask the last octet of an IPv4 address for PII-safe logging.
 * Non-IPv4 strings are returned as-is.
 */
export function maskIp(ip: string): string {
  const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4Match) {
    return `${ipv4Match[1]}.x`;
  }
  return ip;
}

/**
 * Create a child logger with contextual metadata
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
