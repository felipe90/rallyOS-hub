/**
 * Captive Portal — Open WiFi landing page (MVP)
 *
 * A single native `http.createServer` on port 80 that bypasses the Express
 * app entirely (no helmet, no Host-header middleware, no Service Worker
 * concerns). One Node process, two listeners:
 *   - HTTPS (existing) on port 3000 — Express SPA + API + Socket.IO
 *   - HTTP  (this file)  on port 80  — captive portal probe matcher + landing
 *
 * Routing is by Host + Path (deterministic; never User-Agent). Every
 * unmatched GET falls back to the portal HTML so Android OEMs with variant
 * probe domains still trigger the captive sheet (fail-safe default).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';

// Configurable for development — production defaults to 80.
// Override with CAPTIVE_PORTAL_PORT env var (e.g. 8080 for local Mac dev).
const PORTAL_PORT = parseInt(process.env.CAPTIVE_PORTAL_PORT || '80', 10);
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts');

export interface HubPortalConfig {
  domain: string;
  port: number;
  ip: string;
}

// ── Portal HTML ────────────────────────────────────────────────────────
// Self-contained inline <style> with CSS custom properties ported from the
// client `@theme` tokens (client/src/index.css) so the portal is visually
// cohesive with the app. Fonts are served same-origin from /fonts/*.woff2.

function renderPortalHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>rallyOS — Bienvenido</title>
<style>
  @font-face {
    font-family: 'Space Grotesk';
    src: url('/fonts/space-grotesk.woff2') format('woff2');
    font-weight: 300 700;
    font-display: swap;
  }
  @font-face {
    font-family: 'Manrope';
    src: url('/fonts/manrope.woff2') format('woff2');
    font-weight: 200 800;
    font-display: swap;
  }

  :root {
    --color-primary: #006b5f;
    --color-primary-light: #00897b;
    --color-primary-dark: #004d40;
    --color-tertiary: #855300;
    --color-amber: #da8a00;

    --color-background: #f7f9fb;
    --color-surface: #ffffff;
    --color-surface-low: #f2f4f6;

    --color-text-h: #08060d;
    --color-text: #6b6375;
    --color-text-muted: #858093;
    --color-border: #e5e4e7;

    --color-gradient-primary: linear-gradient(135deg, #006b5f 0%, #00897b 100%);

    --radius-sm: 0.5rem;
    --radius-md: 1rem;
    --radius-lg: 2rem;
    --radius-xl: 3rem;

    --shadow-sm: 0 2px 8px rgba(25, 28, 30, 0.04);
    --shadow-md: 0 8px 24px rgba(25, 28, 30, 0.06);
    --shadow-lg: 0 20px 40px rgba(25, 28, 30, 0.06);
    --shadow-xl: 0 32px 64px rgba(25, 28, 30, 0.08);

    --font-heading: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    --font-body: 'Manrope', system-ui, -apple-system, sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: var(--color-background);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 18px;
    line-height: 145%;
    -webkit-font-smoothing: antialiased;
  }

  .card {
    width: 100%;
    max-width: 480px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 2.5rem 2rem;
    text-align: center;
  }

  h1 {
    font-family: var(--font-heading);
    font-size: 28px;
    line-height: 1.2;
    letter-spacing: -0.56px;
    color: var(--color-text-h);
    margin: 0 0 1.25rem;
  }

  .terms {
    text-align: left;
    color: var(--color-text);
    margin: 0 0 2rem;
  }

  .terms p { margin: 0 0 0.75rem; }

  form { display: flex; flex-direction: column; gap: 0.75rem; }

  .accept {
    appearance: none;
    border: none;
    cursor: pointer;
    width: 100%;
    padding: 1rem 1.5rem;
    border-radius: var(--radius-xl);
    background: var(--color-gradient-primary);
    color: #fff;
    font-family: var(--font-heading);
    font-size: 1.125rem;
    font-weight: 600;
    box-shadow: var(--shadow-md);
    transition: filter 0.15s ease;
  }

  .accept:hover { filter: brightness(0.95); }
  .accept:active { filter: brightness(0.9); }

  .secondary {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
  }
</style>
</head>
<body>
  <main class="card">
    <h1>Bienvenido a RallyOS</h1>
    <div class="terms">
      <p>Al conectarte a esta red WiFi y usar rallyOS aceptas los siguientes términos:</p>
      <p>Esta es una red local sin acceso a internet. El tráfico se limita al uso de la aplicación rallyOS dentro del evento.</p>
      <p>Al presionar «Aceptar y Continuar» serás redirigido al tablero de resultados del torneo.</p>
    </div>
    <form action="/accept" method="POST">
      <button class="accept" type="submit">Aceptar y Continuar</button>
      <a class="secondary" href="/">Cancelar</a>
    </form>
  </main>
</body>
</html>`;
}

// ── Response helpers ───────────────────────────────────────────────────

function sendPortalHtml(res: http.ServerResponse): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderPortalHtml());
}

function serveFont(reqPath: string, res: http.ServerResponse): void {
  // Only serve *.woff2 files from the fonts dir; reject anything else so a
  // crafted path can't read arbitrary files.
  const basename = path.basename(reqPath);
  if (!/^[\w.-]+\.woff2$/.test(basename)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  fs.readFile(path.join(FONTS_DIR, basename), (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'application/font-woff');
    res.end(data);
  });
}

// ── Request handler ────────────────────────────────────────────────────

export function createCaptivePortalHandler(hubConfig: HubPortalConfig) {
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const method = req.method || 'GET';
    const host = ((req.headers.host || '').split(':')[0] || '').toLowerCase();
    const url = new URL(req.url || '/', `http://${host || 'localhost'}`);
    const pathname = url.pathname;

    // Static fonts (same-origin, no mixed-content warnings).
    if (method === 'GET' && pathname.startsWith('/fonts/')) {
      serveFont(pathname, res);
      return;
    }

    // Accept → redirect to the HTTPS app (use IP to avoid DNS resolution issues with .local domains).
    if (method === 'POST' && pathname === '/accept') {
      res.statusCode = 302;
      res.setHeader('Location', `https://${hubConfig.domain}:${hubConfig.port}`);
      res.end();
      return;
    }

    if (method !== 'GET') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    // OS captive-portal detection probes. Both return 200 + portal HTML (NOT
    // the iOS "Success" page and NOT an Android 204) so the OS opens the
    // captive sheet. Differentiated only for metrics logging.
    if (host === 'captive.apple.com' && pathname === '/hotspot-detect.html') {
      logger.info({ host, path: pathname }, 'Captive portal probe: iOS');
      sendPortalHtml(res);
      return;
    }
    if (host === 'connectivitycheck.gstatic.com' && pathname === '/generate_204') {
      logger.info({ host, path: pathname }, 'Captive portal probe: Android');
      sendPortalHtml(res);
      return;
    }

    // Fail-safe default: any other GET also returns the portal HTML so devices
    // with variant probe domains still trigger the captive portal.
    sendPortalHtml(res);
  };
}

// ── Server bootstrap ───────────────────────────────────────────────────

export function startCaptivePortal(hubConfig: HubPortalConfig): http.Server {
  const server = http.createServer(createCaptivePortalHandler(hubConfig));
  server.listen(PORTAL_PORT, '0.0.0.0', () => {
    logger.info({ port: PORTAL_PORT }, 'Captive portal listening (HTTP)');
  });
  return server;
}
