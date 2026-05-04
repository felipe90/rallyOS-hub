# Container Non-Root

## Purpose

Ensure the Docker container runs with least privilege — not as root.

## Requirements

### Requirement: Node process runs as non-root user

The container SHALL use the `node` user for the runtime process.

#### Scenario: Process runs as node user

- GIVEN the Docker image is built
- WHEN the container starts
- THEN the Node process SHALL run as user `node` (UID 1000)
- AND SHALL NOT run as root

#### Scenario: Log directory writable by node user

- GIVEN the container filesystem
- WHEN the `node` user writes to `/app/logs`
- THEN it SHALL succeed
- AND log files SHALL be owned by `node`
