# Security Headers Extended

## Purpose

Extend HTTP security headers with CSP report-uri and HSTS to improve client-side security posture.

## Requirements

### Requirement: CSP includes report-uri

The Content-Security-Policy header SHALL include a `report-uri` directive.

#### Scenario: report-uri present

- GIVEN any HTTP response from the server
- WHEN inspecting the Content-Security-Policy header
- THEN it SHALL contain `report-uri /csp-report`

### Requirement: HSTS enabled

The server SHALL include the `Strict-Transport-Security` header.

#### Scenario: HSTS header present

- GIVEN an HTTPS response from the server
- WHEN inspecting response headers
- THEN `Strict-Transport-Security` SHALL be present
- AND `max-age` SHALL be at least 31536000 (1 year)
