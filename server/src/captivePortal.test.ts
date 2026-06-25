/**
 * Captive portal handler tests.
 *
 * Exercises the real request handler through Node's `http` module against a
 * test server bound to an ephemeral port (port 0). This hits the exact same
 * code path production uses — real HTTP parsing of method, path, and the
 * Host header — without needing root to bind port 80.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { createCaptivePortalHandler } from './captivePortal';

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');
const DEFAULT_HUB = { domain: 'rallyos-hub.local', port: 3000 };

// ── Test server helpers ────────────────────────────────────────────────

type ServerHandle = { server: http.Server; baseUrl: string };

function startServer(hubConfig: { domain: string; port: number } = DEFAULT_HUB): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(createCaptivePortalHandler(hubConfig));
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as import('net').AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

type Response = { status: number; headers: http.IncomingHttpHeaders; body: Buffer };

function request(
  baseUrl: string,
  opts: { method: string; path: string; host?: string; body?: string },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: opts.method,
        headers: opts.host ? { Host: opts.host } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('captive portal: iOS probe (captive.apple.com)', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('responds 200 with portal HTML (not the iOS "Success" page)', async () => {
    const res = await request(handle.baseUrl, {
      method: 'GET',
      path: '/hotspot-detect.html',
      host: 'captive.apple.com',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    const body = res.body.toString('utf8');
    expect(body).toContain('Bienvenido a RallyOS');
    // Returning anything other than the canonical "Success" page triggers the
    // captive portal sheet on iOS.
    expect(body).not.toContain('Success');
  });
});

describe('captive portal: Android probe (connectivitycheck.gstatic.com)', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('responds 200 with portal HTML (NOT a 204)', async () => {
    const res = await request(handle.baseUrl, {
      method: 'GET',
      path: '/generate_204',
      host: 'connectivitycheck.gstatic.com',
    });

    // A 204 would tell Android "you have internet" — we must return 200 HTML
    // so Android detects a captive portal and opens it automatically.
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body.toString('utf8')).toContain('Aceptar y Continuar');
  });
});

describe('captive portal: default landing page (any other GET)', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('responds 200 with the portal landing page containing terms + accept button', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/', host: 'example.com' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    const body = res.body.toString('utf8');
    // Terms text and the accept button must be present.
    expect(body).toContain('Aceptar y Continuar');
    expect(body).toContain('términos');
    // The accept button must POST to /accept.
    expect(body).toContain('action="/accept"');
    expect(body).toContain('method="POST"');
  });

  it('inlines the client design tokens as CSS custom properties', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/', host: 'example.com' });
    const body = res.body.toString('utf8');

    // Teal primary palette ported from client @theme.
    expect(body).toContain('--color-primary: #006b5f');
    expect(body).toContain('--color-primary-light: #00897b');
    // Radii tokens.
    expect(body).toContain('--radius-lg: 2rem');
    // Primary gradient.
    expect(body).toContain('linear-gradient(135deg, #006b5f 0%, #00897b 100%)');
  });

  it('references the same-origin fonts via /fonts/*.woff2', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/', host: 'example.com' });
    const body = res.body.toString('utf8');

    expect(body).toContain('/fonts/space-grotesk.woff2');
    expect(body).toContain('/fonts/manrope.woff2');
    expect(body).toContain('Space Grotesk');
    expect(body).toContain('Manrope');
  });
});

describe('captive portal: POST /accept redirect', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('responds 302 to https://${domain}:${port}', async () => {
    const res = await request(handle.baseUrl, { method: 'POST', path: '/accept', host: 'rallyos-hub.local' });

    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('https://rallyos-hub.local:3000');
  });

  it('builds the redirect target from hubConfig (not hardcoded)', async () => {
    const custom = await startServer({ domain: 'hub.test', port: 4000 });
    try {
      const res = await request(custom.baseUrl, { method: 'POST', path: '/accept' });

      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('https://hub.test:4000');
    } finally {
      await closeServer(custom.server);
    }
  });
});

describe('captive portal: GET /accept does not redirect', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('returns the portal HTML (200), not a redirect', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/accept' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['location']).toBeUndefined();
  });
});

describe('captive portal: static font serving', () => {
  let handle: ServerHandle;

  beforeEach(async () => {
    handle = await startServer();
  });
  afterEach(async () => {
    await closeServer(handle.server);
  });

  it('serves space-grotesk.woff2 with application/font-woff Content-Type', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/fonts/space-grotesk.woff2' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/font-woff');
    // Body must be the actual font bytes, non-empty, matching the source file.
    const source = fs.readFileSync(path.join(FONTS_DIR, 'space-grotesk.woff2'));
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.equals(source)).toBe(true);
  });

  it('serves manrope.woff2 with application/font-woff Content-Type', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/fonts/manrope.woff2' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/font-woff');
    const source = fs.readFileSync(path.join(FONTS_DIR, 'manrope.woff2'));
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.equals(source)).toBe(true);
  });

  it('responds 404 for a missing font', async () => {
    const res = await request(handle.baseUrl, { method: 'GET', path: '/fonts/nonexistent.woff2' });

    expect(res.status).toBe(404);
  });
});
