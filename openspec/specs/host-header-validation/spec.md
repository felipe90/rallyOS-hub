# Host Header Validation

## Purpose

Prevent Host header injection attacks by validating the Host header against expected values.

## Requirements

### Requirement: Host header validated

The server SHALL validate the Host header on incoming HTTP requests.

#### Scenario: Valid host accepted

- GIVEN a request with Host header matching an allowed origin
- WHEN the server processes it
- THEN it SHALL respond normally

#### Scenario: Invalid host rejected

- GIVEN a request with Host header `evil.com`
- WHEN the server processes it
- THEN it SHALL respond with HTTP 400 Bad Request

### Requirement: Host whitelist configurable

The allowed Host values SHALL be derived from `HUB_ALLOWED_ORIGINS`, falling back to defaults.

#### Scenario: Default hosts allowed

- GIVEN no `HUB_ALLOWED_ORIGINS` env var
- WHEN the server starts
- THEN `localhost`, `127.0.0.1`, `orangepi.local` SHALL be allowed by default
