# Socket Connection Rate Limit

## Purpose

Prevent resource exhaustion by rate-limiting new Socket.IO connections per IP.

## Requirements

### Requirement: Per-IP connection throttling

New Socket.IO connections from the same IP SHALL be rate-limited.

#### Scenario: Connection rejected after limit

- GIVEN 20 active connections from IP `192.168.1.100`
- WHEN a 21st connection attempt arrives from the same IP within 60s
- THEN the connection SHALL be rejected with an error

#### Scenario: Normal connection allowed

- GIVEN fewer than 20 connections from an IP
- WHEN a new connection attempt arrives
- THEN the connection SHALL be accepted normally

### Requirement: Rejected connection emits error

The server SHALL emit a descriptive error when rejecting a rate-limited connection.

#### Scenario: Error emitted on reject

- GIVEN a rate-limited connection
- WHEN the socket connection middleware rejects it
- THEN the client SHALL receive a `connect_error` with message containing `RATE_LIMITED`
