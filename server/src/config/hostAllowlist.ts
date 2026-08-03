/**
 * Hub Host Allowlist
 *
 * Source of truth for which Host header values the Express app accepts.
 * Matches strict private-network IPv4 ranges (RFC 1918) plus the hub's own
 * configured domain and the CORS-allowed origins' hostnames. Public IPs and
 * arbitrary hostnames are rejected, closing the previous broad `192.168.*`
 * prefix check.
 */

import { getAllowedOrigins, getHubDomain } from './allowedOrigins';

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const LOCALHOST_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
]);

/**
 * Parses a hostname as a dotted-quad IPv4 address, returning the octets
 * (0..255 each) or null when the string is not a valid IPv4 address.
 */
export function parseIpv4(host: string): number[] | null {
  const match = host.match(IPV4_RE);
  if (!match) return null;
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets;
}

/**
 * True when the host is a private IPv4 address in one of the RFC 1918
 * ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
 */
export function isPrivateIpv4(host: string): boolean {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * True when the Host header value is permitted: localhost, a private IPv4
 * address, the hub's own configured domain, or the hostname of any
 * CORS-allowed origin.
 */
export function isAllowedHubHost(host: string | undefined): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  if (LOCALHOST_HOSTS.has(normalized)) return true;
  if (isPrivateIpv4(normalized)) return true;
  if (normalized === getHubDomain().toLowerCase()) return true;
  return getAllowedOrigins().some((origin) => {
    try {
      return new URL(origin).hostname.toLowerCase() === normalized;
    } catch {
      return false;
    }
  });
}
