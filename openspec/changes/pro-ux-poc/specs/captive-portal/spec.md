# captive-portal Specification

## Purpose

POC: WiFi users auto-redirected to the app upon connect (cafe-style captive portal). dnsmasq catch-all DNS + iptables DNAT redirect all HTTP traffic to the app.

## Requirements

### Requirement: DNS Catch-All

dnsmasq MUST resolve ALL DNS queries to `192.168.4.1` (the Orange Pi AP address) via `address=/#/192.168.4.1`. This SHALL intercept any domain the device attempts to reach on port 80.

#### Scenario: Device queries any domain via WiFi AP DNS

- GIVEN a device connects to `RallyOS-Table1` WiFi
- WHEN the device sends a DNS query for any domain (e.g., `connectivitycheck.gstatic.com`)
- THEN dnsmasq responds with `192.168.4.1`

### Requirement: HTTP Port 80 Redirect

iptables `PREROUTING` DNAT rule MUST redirect all incoming TCP port 80 traffic to `localhost:3000`. The Express app SHALL listen on port 3000 and serve `/captive-portal` as an HTTP-only endpoint.

#### Scenario: HTTP request arrives on port 80

- GIVEN a user connects to WiFi and their browser probes port 80
- WHEN an HTTP request hits the Orange Pi on port 80
- THEN iptables redirects it to localhost:3000
- AND Express serves `GET /captive-portal`

#### Scenario: Browser receives captive portal redirect

- GIVEN Express receives `GET /captive-portal`
- WHEN the route handler executes
- THEN response is 302 redirect to `http://rallyos-hub.local:3000`
- AND the browser opens the app

### Requirement: Browser Auto-Detection

Browsers that probe HTTP captive portal endpoints (Android, iOS, Windows, macOS) SHALL auto-detect the portal. No HTTPS interception is required or attempted.

#### Scenario: Android captive portal detection

- GIVEN an Android device connects to WiFi
- WHEN Android's connectivity check hits `http://connectivitycheck.gstatic.com/generate_204`
- THEN dnsmasq resolves → iptables redirects → Express returns 302
- AND the captive portal login screen opens automatically

#### Scenario: iOS captive portal detection

- GIVEN an iOS device connects to WiFi
- WHEN iOS probes `http://captive.apple.com/hotspot-detect.html`
- THEN the server responds with 302
- AND iOS displays the captive portal sheet

#### Scenario: Non-browser HTTP client (curl)

- GIVEN a non-browser HTTP client hits port 80
- WHEN it follows redirects automatically (`-L`)
- THEN it lands on the app at `http://rallyos-hub.local:3000`
