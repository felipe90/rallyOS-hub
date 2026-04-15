/**
 * Allowed Origins Configuration
 *
 * Single source of truth for CORS allowed origins.
 * Used by both app.ts (Express CORS middleware) and server.ts (Socket.IO CORS).
 *
 * Reads from HUB_ALLOWED_ORIGINS env var. Falls back to defaults if empty.
 */

export const defaultAllowedOrigins: string[] = [
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

export function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return envOrigins.length > 0 ? envOrigins : defaultAllowedOrigins;
}
