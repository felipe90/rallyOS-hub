/**
 * Captive portal wiring regression test.
 *
 * `server/src/index.ts` is the process entry point: importing it in a test
 * would start the HTTPS server (requires certs) and bind ports. Instead this
 * is a static-content test that locks the wiring contract: the entry point
 * must import and invoke `startCaptivePortal` so a future edit cannot
 * silently drop the captive portal startup.
 */

import fs from 'fs';
import path from 'path';

const INDEX_TS = path.join(process.cwd(), 'src', 'index.ts');

function readIndex(): string {
  return fs.readFileSync(INDEX_TS, 'utf8');
}

describe('captive portal wiring in server/src/index.ts', () => {
  const source = readIndex();

  it('imports startCaptivePortal from ./captivePortal', () => {
    expect(source).toMatch(/import\s+\{[^}]*startCaptivePortal[^}]*\}\s+from\s+['"]\.\/captivePortal['"]/);
  });

  it('calls startCaptivePortal(...) to boot the HTTP captive portal', () => {
    expect(source).toMatch(/startCaptivePortal\s*\(/);
  });

  it('passes hubConfig to startCaptivePortal', () => {
    expect(source).toMatch(/startCaptivePortal\s*\(\s*hubConfig\s*\)/);
  });
});
