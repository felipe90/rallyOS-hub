# Owner PIN Endpoint Protection

## Purpose

Protect the `/api/owner-pin` HTTP endpoint from abuse by adding rate limiting and IP-based access controls.

## Requirements

### Requirement: Rate limited endpoint

The `/api/owner-pin` endpoint SHALL be rate-limited.

#### Scenario: Rate limit enforced

- GIVEN 10 requests from IP `192.168.1.100` in the last 60s
- WHEN an 11th request arrives from the same IP
- THEN the server SHALL respond with HTTP 429 Too Many Requests

#### Scenario: Normal requests succeed

- GIVEN fewer than 10 requests from an IP in the last 60s
- WHEN a request arrives
- THEN the server SHALL respond with HTTP 200 and the PIN data
