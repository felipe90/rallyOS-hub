/**
 * Allowed Origins Configuration
 *
 * Single source of truth for CORS allowed origins.
 * Used by both app.ts (Express CORS middleware) and server.ts (Socket.IO CORS).
 *
 * Reads from HUB_ALLOWED_ORIGINS env var. Falls back to computed defaults if empty.
 * The computed defaults dynamically include HUB_DOMAIN origins (default: rallyos-hub.local).
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
  'http://rallyos.local:3000',
  'https://rallyos.local:3000',
];

export function getHubDomain(): string {
  return process.env.HUB_DOMAIN || 'rallyos-hub.local';
}

/**
 * Builds the complete default origin list including dynamic HUB_DOMAIN entries.
 * rallyos-hub.local is NEVER hard-coded — it derives from HUB_DOMAIN env var.
 */
function buildDefaultOrigins(): string[] {
  const domain = getHubDomain();
  return [
    ...defaultAllowedOrigins,
    `http://${domain}:3000`,
    `https://${domain}:3000`,
  ];
}

export function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return envOrigins.length > 0 ? envOrigins : buildDefaultOrigins();
}
