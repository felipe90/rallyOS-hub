/**
 * Captive portal infrastructure config tests.
 *
 * The Orange Pi AP setup script and docker-compose.yml cannot be executed in
 * CI (they require root + a real host), so these are static-content
 * regression tests: they lock in the spec requirements for the open WiFi
 * captive portal change so a future edit cannot silently re-introduce WPA2,
 * drop the catch-all DNS, or revive the dead DNAT rule.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const SETUP_SCRIPT = path.join(REPO_ROOT, 'scripts/setup-orangepi-ap.sh');
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.yml');

function readSetupScript(): string {
  return fs.readFileSync(SETUP_SCRIPT, 'utf8');
}

function readCompose(): string {
  return fs.readFileSync(COMPOSE_FILE, 'utf8');
}

describe('captive portal infrastructure: hostapd (open network)', () => {
  const script = readSetupScript();

  it('configures wpa=0 for an open network', () => {
    expect(script).toContain('wpa=0');
  });

  it('removes the WPA2 passphrase line', () => {
    expect(script).not.toContain('wpa_passphrase');
  });

  it('removes the wpa_key_mgmt line', () => {
    expect(script).not.toContain('wpa_key_mgmt');
  });

  it('removes the rsn_pairwise=CCMP line', () => {
    expect(script).not.toContain('rsn_pairwise=CCMP');
  });

  it('keeps the RallyOS SSID', () => {
    // The hostapd heredoc templates the SSID from AP_SSID; assert both the
    // template usage and the variable definition that resolves to "RallyOS".
    expect(script).toContain('ssid=${AP_SSID}');
    expect(script).toContain('AP_SSID="RallyOS"');
  });
});

describe('captive portal infrastructure: dnsmasq catch-all DNS', () => {
  const script = readSetupScript();

  it('enables catch-all DNS resolving all domains to the AP IP', () => {
    // The dnsmasq heredoc templates the AP IP; assert the catch-all directive
    // uses AP_IP and that AP_IP resolves to 192.168.4.1.
    expect(script).toContain('address=/#/${AP_IP}');
    expect(script).toContain('AP_IP="192.168.4.1"');
  });
});

describe('captive portal infrastructure: iptables cleanup', () => {
  const script = readSetupScript();

  it('removes the dead DNAT rule that forwarded port 80 to :3000', () => {
    // The container now owns :80 directly via Docker port mapping, so the
    // old `--dport 80 -j DNAT --to-destination <ip>:3000` rule must be gone.
    expect(script).not.toContain('--dport 80 -j DNAT');
  });
});

describe('captive portal infrastructure: docker port 80', () => {
  const compose = readCompose();

  it('maps host port 80 to container port 80 so the portal owns :80', () => {
    expect(compose).toContain('"80:80"');
  });
});
