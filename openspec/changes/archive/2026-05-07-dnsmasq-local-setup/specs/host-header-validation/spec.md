# Delta for Host Header Validation

## MODIFIED Requirements

### Requirement: Host whitelist configurable

The allowed Host values SHALL derive from `HUB_ALLOWED_ORIGINS`, falling back to defaults. Defaults SHALL include `HUB_DOMAIN` (default: `rallyos-hub.local`) alongside `localhost`, `127.0.0.1`, `orangepi.local`, and the newly-added `rallyos.local`. CORS default origins SHALL be computed dynamically: base static origins (`localhost:*`, `127.0.0.1:*`, `orangepi.local:3000`), plus `rallyos.local:3000` (latent bug fix — was never in CORS despite dnsmasq config), plus `http://{HUB_DOMAIN}:3000` and `https://{HUB_DOMAIN}:3000` (dynamic, derived from env var).

(Previously: defaults were `localhost`, `127.0.0.1`, and `orangepi.local` only. `rallyos.local` was configured in dnsmasq but MISSING from CORS — a latent bug. No `HUB_DOMAIN` env var existed.)

#### Scenario: Default hosts include rallyos-hub.local

- GIVEN no `HUB_ALLOWED_ORIGINS` env var
- WHEN the server starts
- THEN `rallyos-hub.local` SHALL be an allowed host

#### Scenario: rallyos-hub.local CORS origins in defaults

- GIVEN no `HUB_ALLOWED_ORIGINS` env var
- WHEN `getAllowedOrigins()` is called
- THEN origins SHALL include `https://rallyos-hub.local:3000` and `http://rallyos-hub.local:3000`

#### Scenario: rallyos.local CORS origins ADDED (latent bug fix)

- GIVEN no `HUB_ALLOWED_ORIGINS` env var
- WHEN `getAllowedOrigins()` is called
- THEN origins SHALL include `https://rallyos.local:3000` and `http://rallyos.local:3000`
- AND `orangepi.local` origins SHALL still be present

#### Scenario: CORS origins are dynamic from HUB_DOMAIN

- GIVEN `HUB_DOMAIN=custom.local` is set
- WHEN `getAllowedOrigins()` is called
- THEN origins SHALL include `https://custom.local:3000` and `http://custom.local:3000`
- AND origins SHALL NOT include hardcoded `rallyos-hub.local`

#### Scenario: rallyos.local host header still accepted

- GIVEN a request with Host `rallyos.local:3000`
- WHEN the server processes it
- THEN it SHALL respond normally (not 400)

#### Scenario: Custom HUB_DOMAIN overrides default domain

- GIVEN `HUB_DOMAIN=custom.local`
- WHEN the server constructs allowed hosts and origins
- THEN `custom.local` SHALL be used and `rallyos-hub.local` SHALL NOT appear

## ADDED Requirements

### Requirement: HUB_DOMAIN env var with fallback

The system SHALL read the `HUB_DOMAIN` environment variable. If unset or empty, the domain SHALL default to `rallyos-hub.local`.

#### Scenario: Default when unset

- GIVEN `HUB_DOMAIN` is not set
- WHEN the server starts
- THEN domain-dependent behavior SHALL use `rallyos-hub.local`

#### Scenario: Custom domain honored

- GIVEN `HUB_DOMAIN=myhub.local`
- WHEN the server starts
- THEN all domain references (host validation, CORS, SSL, display) SHALL use `myhub.local`

### Requirement: SSL certificates cover HUB_DOMAIN

Self-signed SSL certificates (Docker build and `dev.sh`) SHALL include `DNS:{HUB_DOMAIN}` in the Subject Alternative Name extension.

#### Scenario: Docker cert SAN

- GIVEN default `HUB_DOMAIN`
- WHEN the Docker image builds and generates `cert.pem`
- THEN SAN SHALL include `DNS:rallyos-hub.local`

#### Scenario: Dev cert SAN

- GIVEN `dev.sh` generates missing SSL certs
- WHEN `openssl req` runs
- THEN SAN SHALL include `DNS:rallyos-hub.local`

### Requirement: dnsmasq resolves HUB_DOMAIN

The Orange Pi AP dnsmasq configuration SHALL add an `address=/HUB_DOMAIN/AP_IP` line. The existing `address=/rallyos.local/AP_IP` line SHALL be preserved.

#### Scenario: Domain resolves to AP IP

- GIVEN AP IP `192.168.4.1` and `HUB_DOMAIN=rallyos-hub.local`
- WHEN `setup-orangepi-ap.sh` writes `/etc/dnsmasq.conf`
- THEN `address=/rallyos-hub.local/192.168.4.1` SHALL be present

#### Scenario: rallyos.local resolution preserved

- GIVEN dnsmasq config generation
- WHEN `/etc/dnsmasq.conf` is written
- THEN `address=/rallyos.local/192.168.4.1` SHALL remain

### Requirement: Display URLs show domain name

Server startup logs and Orange Pi scripts SHALL display `https://{HUB_DOMAIN}:3000` as the primary access URL, with IP-based URLs retained as fallback.

#### Scenario: Server startup log

- GIVEN server starts with default `HUB_DOMAIN`
- WHEN startup messages are printed
- THEN `https://rallyos-hub.local:3000` SHALL appear in the output

#### Scenario: Orange Pi scripts show domain

- GIVEN `start-orange-pi.sh` or `setup-orange-pi.sh` completes
- WHEN access URLs are displayed
- THEN `https://rallyos-hub.local:3000` SHALL appear alongside `https://192.168.4.1:3000`
